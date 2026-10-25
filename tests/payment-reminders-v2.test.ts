import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPaymentV2Schedule,
  enqueueDuePaymentV2Stages,
  holdPaymentV2Schedule,
  processDuePaymentV2Schedules,
  setPaymentReminderV2OptOut,
  type PaymentReminderV2Delivery
} from "../apps/api/src/payment-reminders-v2";

let sqlite: DatabaseSync;

function makeDb(): D1Database {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind: (...args: SQLInputValue[]) => { values = args; return statement; },
        first: async <T>() => sqlite.prepare(sql).get(...values) as T | undefined,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => {
          const result = sqlite.prepare(sql).run(...values);
          return { meta: { changes: Number(result.changes) } };
        }
      };
      return statement;
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
}

function setup(orderState = "PAYMENT_PENDING", paymentStatus = "PENDING", reviewState = "PENDING") {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
      order_number TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT, state TEXT NOT NULL, payment_status TEXT NOT NULL,total_payable INTEGER NOT NULL DEFAULT 500,archived_at TEXT);
    CREATE TABLE payments(id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), review_state TEXT NOT NULL,updated_at TEXT);
    CREATE TABLE payment_receipts(id TEXT PRIMARY KEY, order_id TEXT NOT NULL, payment_id TEXT NOT NULL,review_state TEXT NOT NULL DEFAULT 'SUBMITTED');
    CREATE TABLE whatsapp_conversations(wa_id TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at TEXT);
    CREATE TABLE outbox_jobs(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,kind TEXT,entity_id TEXT,payload_json TEXT,status TEXT,attempts INTEGER DEFAULT 0,available_at TEXT,last_error TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);
    INSERT INTO customers(id,wa_id) VALUES('customer-test-1','923001234567');
  `);
  sqlite.exec(readFileSync("migrations/0030_payment_reminders_v2.sql", "utf8"));
  sqlite.prepare(`INSERT INTO orders(id,customer_id,order_number,created_at,state,payment_status,total_payable,archived_at) VALUES('order-test-1','customer-test-1','TEST-ORDER-1',?,?,?,?,NULL)`)
    .run("2026-10-23T10:00:00.000Z", orderState, paymentStatus,500);
  sqlite.prepare("INSERT INTO payments(id,order_id,review_state,updated_at) VALUES('payment-test-1','order-test-1',?,?)").run(reviewState,"2026-10-23T10:00:00.000Z");
  return makeDb();
}

const t0 = new Date("2026-10-23T10:00:00.000Z");
const enabledServiceWindow = {
  enabled: true,
  eligibility: { verified: true as const, kind: "SERVICE_WINDOW" as const },
  sendReminder: vi.fn(async () => undefined)
};

describe("V2 payment reminder schedules", () => {
  afterEach(() => sqlite?.close());

  it("creates only explicitly requested schedules and uses persisted order time for every stage", async () => {
    const db = setup();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_schedules").get()).toEqual({ n: 0 });
    const first = await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const retry = await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", new Date(t0.getTime() + 5_000));
    expect(first).toEqual({ scheduleId: "payment-reminder-v2:order-test-1:payment-test-1", created: true });
    expect(retry).toEqual({ ...first, created: false });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_stages").get()).toEqual({ n: 6 });
    expect(sqlite.prepare(`SELECT stage_minutes,due_at FROM payment_reminder_v2_stages ORDER BY stage_minutes`).all()).toEqual([
      { stage_minutes: 15, due_at: "2026-10-23T10:15:00.000Z" },
      { stage_minutes: 30, due_at: "2026-10-23T10:30:00.000Z" },
      { stage_minutes: 60, due_at: "2026-10-23T11:00:00.000Z" },
      { stage_minutes: 210, due_at: "2026-10-23T13:30:00.000Z" },
      { stage_minutes: 240, due_at: "2026-10-23T14:00:00.000Z" },
      { stage_minutes: 270, due_at: "2026-10-23T14:30:00.000Z" }
    ]);
  });

  it("atomically queues one ordered durable stage and survives duplicate Cron runs", async () => {
    const db=setup();
    await createPaymentV2Schedule(db,"order-test-1","payment-test-1",t0);
    const due=new Date(t0.getTime()+15*60_000);
    expect(await enqueueDuePaymentV2Stages(db,due,true)).toEqual({queued:1,cancelled:0,blocked:0});
    expect(await enqueueDuePaymentV2Stages(db,due,true)).toEqual({queued:0,cancelled:0,blocked:0});
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE stage_minutes=15").get()).toEqual({status:"QUEUED"});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_REMINDER'").get()).toEqual({n:1});
    expect(await enqueueDuePaymentV2Stages(db,new Date(t0.getTime()+5*60*60_000),true)).toEqual({queued:0,cancelled:0,blocked:0});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_REMINDER'").get()).toEqual({n:1});
  });

  it("persists an opt-out by WhatsApp identity before a V2 order and suppresses its schedule", async () => {
    const db=setup();
    await setPaymentReminderV2OptOut(db,null,"923001234567",t0);
    await createPaymentV2Schedule(db,"order-test-1","payment-test-1",t0);
    const result=await enqueueDuePaymentV2Stages(db,new Date(t0.getTime()+5*60*60_000),true);
    expect(result.queued).toBe(0);
    expect(sqlite.prepare("SELECT status,stop_reason FROM payment_reminder_v2_schedules").get()).toEqual({status:"STOPPED",stop_reason:"OPTED_OUT"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_reminder_v2_stages WHERE status='SKIPPED'").get()).toEqual({count:6});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_REMINDERS_OPTED_OUT'").get()).toEqual({count:1});
  });

  it.each([
    ["paid", "PAYMENT_PENDING", "PAID", "PENDING", "STOPPED"],
    ["payment review", "PAYMENT_REVIEW", "PENDING", "REVIEW", "PAUSED"],
    ["terminal cancellation", "CANCELLED_UNPAID", "CANCELLED_UNPAID", "CANCELLED_UNPAID", "STOPPED"]
  ])("stops or pauses durable scheduling for %s", async (_label, orderState, paymentStatus, reviewState, expectedStatus) => {
    const db=setup(orderState,paymentStatus,reviewState);
    await createPaymentV2Schedule(db,"order-test-1","payment-test-1",t0);
    if(reviewState==="REVIEW")sqlite.exec("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('receipt-test-1','order-test-1','payment-test-1')");
    await enqueueDuePaymentV2Stages(db,new Date(t0.getTime()+5*60*60_000),true);
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_schedules").get()).toEqual({status:expectedStatus});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs").get()).toEqual({count:0});
  });

  it("enters PAYMENT_GRACE at four hours and cancels only after the grace notice is delivered", async () => {
    const db=setup();
    await createPaymentV2Schedule(db,"order-test-1","payment-test-1",t0);
    sqlite.exec("UPDATE payment_reminder_v2_stages SET status='DELIVERED' WHERE stage_minutes<240");
    const graceDue=new Date(t0.getTime()+240*60_000);
    expect(await enqueueDuePaymentV2Stages(db,graceDue,true)).toEqual({queued:1,cancelled:0,blocked:0});
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-test-1'").get()).toEqual({state:"PAYMENT_GRACE"});
    expect(sqlite.prepare("SELECT phase FROM payment_reminder_v2_schedules").get()).toEqual({phase:"PAYMENT_GRACE"});

    const cancelDue=new Date(t0.getTime()+270*60_000);
    expect(await enqueueDuePaymentV2Stages(db,cancelDue,true)).toMatchObject({cancelled:0,blocked:1});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-test-1'").get()).toEqual({state:"PAYMENT_GRACE",payment_status:"PENDING"});
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='DELIVERED' WHERE stage_minutes=240").run();
    expect(await enqueueDuePaymentV2Stages(db,cancelDue,true)).toEqual({queued:1,cancelled:1,blocked:0});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-test-1'").get()).toEqual({state:"CANCELLED_UNPAID",payment_status:"CANCELLED_UNPAID"});
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id='payment-test-1'").get()).toEqual({review_state:"CANCELLED_UNPAID"});
    expect(sqlite.prepare("SELECT status,phase FROM payment_reminder_v2_schedules").get()).toEqual({status:"TERMINAL",phase:"CANCELLED_UNPAID"});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='ORDER_CANCELLED_UNPAID'").get()).toEqual({n:1});
  });

  it("does not send by default; an explicitly enabled, verified caller can send once", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const due = new Date(t0.getTime() + 15 * 60_000);
    const blocked = await processDuePaymentV2Schedules(db, due);
    expect(blocked.sent).toBe(0);
    expect(blocked.blocked).toBe(1);
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE stage_minutes=15").get()).toEqual({ status: "PENDING" });

    const sendReminder = vi.fn(async (_delivery: PaymentReminderV2Delivery) => undefined);
    const sent = await processDuePaymentV2Schedules(db, due, {
      enabled: true,
      eligibility: { verified: true, kind: "SERVICE_WINDOW" },
      sendReminder
    });
    expect(sent.sent).toBe(1);
    expect(sendReminder).toHaveBeenCalledTimes(1);
    expect(sendReminder.mock.calls[0][0]).toMatchObject({
      orderId: "order-test-1", paymentId: "payment-test-1", stageMinutes: 15,
      idempotencyKey: "payment-reminder-v2:order-test-1:payment-test-1:stage:15"
    });
    await processDuePaymentV2Schedules(db, due, { ...enabledServiceWindow, sendReminder });
    expect(sendReminder).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["paid", "PAYMENT_PENDING", "PAID", "PENDING", "STOPPED"],
    ["payment review", "PAYMENT_REVIEW", "PENDING", "REVIEW", "PAUSED"],
    ["terminal order", "CANCELLED", "PENDING", "PENDING", "STOPPED"]
  ])("stops reminders and cancellation for %s", async (_label, orderState, paymentStatus, reviewState, expectedStatus) => {
    const db = setup(orderState, paymentStatus, reviewState);
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const result = await processDuePaymentV2Schedules(db, new Date(t0.getTime() + 5 * 60 * 60_000), {
      ...enabledServiceWindow
    });
    expect(result.sent).toBe(0);
    expect(result.cancelled).toBe(0);
    expect(sqlite.prepare("SELECT status,phase,stop_reason FROM payment_reminder_v2_schedules").get()).toMatchObject({
      status: expectedStatus, phase: expectedStatus === "PAUSED" ? "PAYMENT_PENDING" : "STOPPED"
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_stages WHERE status='SKIPPED'").get()).toEqual({
      n: expectedStatus === "PAUSED" ? 0 : 6
    });
  });

  it("stops for an associated receipt, opt-out, or a persisted hold", async () => {
    const reasons = ["receipt", "opt-out", "hold"] as const;
    for (const [index, reason] of reasons.entries()) {
      const db = setup();
      await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
      if (reason === "receipt") sqlite.exec("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('receipt-test-1','order-test-1','payment-test-1')");
      if (reason === "opt-out") await setPaymentReminderV2OptOut(db, "customer-test-1", "923001234567", t0);
      if (reason === "hold") await holdPaymentV2Schedule(db, "order-test-1", "TEST_HOLD", t0);
      await processDuePaymentV2Schedules(db, new Date(t0.getTime() + 5 * 60 * 60_000), enabledServiceWindow);
      const paused = reason === "receipt";
      expect(sqlite.prepare("SELECT status,phase FROM payment_reminder_v2_schedules").get()).toEqual({
        status: paused ? "PAUSED" : "STOPPED", phase: paused || reason === "opt-out" ? "PAYMENT_PENDING" : "STOPPED"
      });
      expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-test-1'").get()).toEqual({ state: "PAYMENT_PENDING" });
      if (index < reasons.length - 1) sqlite.close();
    }
  });

  it("enters grace at four hours and cancellation is terminal at four hours thirty", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const options = {
      enabled: true,
      eligibility: { verified: true as const, kind: "SERVICE_WINDOW" as const },
      sendReminder: vi.fn(async () => undefined)
    };
    const grace = await processDuePaymentV2Schedules(db, new Date(t0.getTime() + 240 * 60_000), options);
    expect(grace.sent).toBe(5);
    expect(sqlite.prepare("SELECT phase,status FROM payment_reminder_v2_schedules").get()).toEqual({ phase: "PAYMENT_GRACE", status: "ACTIVE" });
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE stage_minutes=240").get()).toEqual({ status: "SENT" });

    const cancellation = await processDuePaymentV2Schedules(db, new Date(t0.getTime() + 270 * 60_000), options);
    expect(cancellation.cancelled).toBe(1);
    expect(sqlite.prepare("SELECT phase,status FROM payment_reminder_v2_schedules").get()).toEqual({ phase: "CANCELLED_UNPAID", status: "TERMINAL" });
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE stage_minutes=270").get()).toEqual({ status: "CANCELLED" });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-test-1'").get()).toEqual({ state: "PAYMENT_PENDING" });
    const later = await processDuePaymentV2Schedules(db, new Date(t0.getTime() + 300 * 60_000), options);
    expect(later.cancelled).toBe(0);
    expect(options.sendReminder).toHaveBeenCalledTimes(5);
    expect(cancellation.stockRelease).toBe("NOT_APPLICABLE");
  });

  it("requires an approved enabled V2 template as well as explicit send enablement", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const sendReminder = vi.fn(async () => undefined);
    const due = new Date(t0.getTime() + 15 * 60_000);
    const eligibility = { verified: true as const, kind: "APPROVED_TEMPLATE" as const, locale: "en" as const, templateName: "payment_reminder_en" };
    expect((await processDuePaymentV2Schedules(db, due, { enabled: true, eligibility, sendReminder })).blocked).toBe(1);
    sqlite.prepare(`INSERT INTO payment_reminder_v2_templates(stage_minutes,locale,template_name,approved,enabled,updated_at)
      VALUES(15,'en','payment_reminder_en',1,1,?)`).run(t0.toISOString());
    expect((await processDuePaymentV2Schedules(db, due, { enabled: true, eligibility, sendReminder })).sent).toBe(1);
    expect(sendReminder).toHaveBeenCalledTimes(1);
  });
});
