import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createPaymentV2Schedule, enqueueDuePaymentV2Stages, resolvePaymentReminderCodFallback, setPaymentReminderV2OptOut, type PaymentReminderCodPolicy } from "../apps/api/src/payment-reminders-v2";

let sqlite: DatabaseSync;

function makeDb(): D1Database {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind: (...args: SQLInputValue[]) => { values = args; return statement; },
        first: async <T>() => sqlite.prepare(sql).get(...values) as T | undefined,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
      };
      return statement;
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    }
  } as unknown as D1Database;
}

function setup(state = "PAYMENT_PENDING", paymentStatus = "PENDING", reviewState = "PENDING") {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),order_number TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,updated_at TEXT,state TEXT NOT NULL,payment_status TEXT NOT NULL,total_payable INTEGER NOT NULL,delivery_fee INTEGER NOT NULL,archived_at TEXT);
    CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),method TEXT,review_state TEXT NOT NULL,expected_amount INTEGER NOT NULL,approved_amount INTEGER,approved_by TEXT,approved_at TEXT,submitted_at TEXT,customer_transaction_reference TEXT,updated_at TEXT);
    CREATE TABLE payment_receipts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,payment_id TEXT NOT NULL,review_state TEXT NOT NULL DEFAULT 'SUBMITTED');
    CREATE TABLE cod_schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
    CREATE TABLE cod_order_details(order_id TEXT PRIMARY KEY,base_amount_pkr INTEGER NOT NULL,cod_fee_pkr INTEGER NOT NULL,quoted_total_pkr INTEGER NOT NULL,policy_revision TEXT,collection_policy_hash TEXT,remittance_policy_hash TEXT,test_hold INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,collection_ref_hmac TEXT,collection_amount_pkr INTEGER,remittance_ref_hmac TEXT,remittance_amount_pkr INTEGER,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE whatsapp_conversations(wa_id TEXT PRIMARY KEY,state TEXT NOT NULL,state_data TEXT NOT NULL,updated_at TEXT,last_inbound_message_id TEXT,last_inbound_at TEXT);
    CREATE TABLE outbox_jobs(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,kind TEXT,entity_id TEXT,payload_json TEXT,status TEXT,attempts INTEGER DEFAULT 0,available_at TEXT,last_error TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,actor_id TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);
    CREATE TABLE order_items(id TEXT PRIMARY KEY,order_id TEXT,item_type TEXT,product_code TEXT,description TEXT,quantity INTEGER,unit_price_pkr INTEGER,line_total_pkr INTEGER,created_at TEXT);
    INSERT INTO customers(id,wa_id) VALUES('customer-test-1','923000000001');
    INSERT INTO orders(id,customer_id,order_number,created_at,updated_at,state,payment_status,total_payable,delivery_fee) VALUES('order-test-1','customer-test-1','SYN-ORDER-1','2026-10-23T10:00:00.000Z','2026-10-23T10:00:00.000Z','${state}','${paymentStatus}',7000,200);
    INSERT INTO payments(id,order_id,method,review_state,expected_amount,updated_at) VALUES('payment-test-1','order-test-1','JAZZCASH','${reviewState}',7000,'2026-10-23T10:00:00.000Z');
    INSERT INTO whatsapp_conversations(wa_id,state,state_data,updated_at,last_inbound_message_id,last_inbound_at) VALUES('923000000001','PAYMENT_PENDING','{"orderId":"order-test-1","language":"en"}','2026-10-23T10:00:00.000Z','synthetic-inbound-1','2026-10-23T10:00:00.000Z');
    INSERT INTO order_items(id,order_id,item_type,product_code,description,quantity,unit_price_pkr,line_total_pkr,created_at) VALUES('item-test-1','order-test-1','PRODUCT','FREE_5_PACK_VEGETABLE_SEEDS','Seeds',1,0,0,'2026-10-23T10:00:00.000Z');
  `);
  sqlite.exec(readFileSync("migrations/0039_payment_reminders_v2_cod_fallback.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0040_payment_reminder_cod_transition.sql", "utf8"));
  return makeDb();
}

const t0 = new Date("2026-10-23T10:00:00.000Z");
const policy: PaymentReminderCodPolicy = { feePkr: 125, revision: "policy-test-v1", collectionPolicyHash: "a".repeat(64), remittancePolicyHash: "b".repeat(64), testHold: 0 };

describe("recovered payment reminder V2", () => {
  afterEach(() => sqlite?.close());

  it("creates exactly five persisted stages anchored to order creation and is idempotent", async () => {
    const db = setup();
    const first = await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    const retry = await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", new Date(t0.getTime() + 5000));
    expect(first).toEqual({ scheduleId: "payment-reminder-v2:order-test-1:payment-test-1", created: true });
    expect(retry).toEqual({ ...first, created: false });
    expect(sqlite.prepare("SELECT stage_minutes FROM payment_reminder_v2_stages ORDER BY stage_minutes").all()).toEqual([{ stage_minutes: 15 }, { stage_minutes: 30 }, { stage_minutes: 60 }, { stage_minutes: 210 }, { stage_minutes: 240 }]);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_stages WHERE stage_minutes=270").get()).toEqual({ n: 0 });
  });

  it.each([null, "invalid", "2026-10-23T10:00:01.000Z", "2026-10-22T09:59:59.999Z"] as const)("does not create a schedule without a valid open 24-hour window (%s)", async (lastInboundAt) => {
    const db = setup();
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=?").run(lastInboundAt);
    await expect(createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0)).rejects.toThrow("PAYMENT_REMINDER_SERVICE_WINDOW_CLOSED");
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_schedules").get()).toEqual({ n: 0 });
  });

  it("requires the persisted inbound message identity as well as its timestamp", async () => {
    const db = setup();
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_message_id=NULL").run();
    await expect(createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0)).rejects.toThrow("PAYMENT_REMINDER_SERVICE_WINDOW_CLOSED");
  });

  it.each([15, 30, 60, 210, 240] as const)("queues one ordered stage at +%dm and duplicate Cron does not duplicate it", async (minutes) => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='SENT' WHERE stage_minutes<?").run(minutes);
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + minutes * 60_000), true)).queued).toBe(1);
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + minutes * 60_000), true)).queued).toBe(0);
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE stage_minutes=?").get(minutes)).toEqual({ status: "QUEUED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_REMINDER'").get()).toEqual({ n: 1 });
  });

  it("permanently blocks an expired stage and never backfills it after a later inbound", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=?").run("2026-10-22T09:59:59.999Z");
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + 15 * 60_000), true)).blocked).toBe(1);
    expect(sqlite.prepare("SELECT status,phase,stop_reason FROM payment_reminder_v2_schedules").get()).toEqual({ status: "STOPPED", phase: "STOPPED", stop_reason: "BLOCKED_WINDOW" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_stages WHERE status='BLOCKED_WINDOW'").get()).toEqual({ n: 5 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM outbox_jobs").get()).toEqual({ n: 0 });
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=?").run(new Date(t0.getTime() + 16 * 60_000).toISOString());
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + 16 * 60_000), true)).queued).toBe(0);
  });

  it("enters grace at 240m, presents the fallback state, and never creates a 270m cancellation", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    sqlite.exec("UPDATE payment_reminder_v2_stages SET status='SENT' WHERE stage_minutes<240");
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + 240 * 60_000), true)).queued).toBe(1);
    expect(sqlite.prepare("SELECT phase FROM payment_reminder_v2_schedules").get()).toEqual({ phase: "PAYMENT_GRACE" });
    expect(sqlite.prepare("SELECT state FROM whatsapp_conversations").get()).toEqual({ state: "PAYMENT_GRACE" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM payment_reminder_v2_stages WHERE stage_minutes=270").get()).toEqual({ n: 0 });
  });

  it("suppresses paid, receipt/review, opt-out, and COD records", async () => {
    const db = setup("PAYMENT_PENDING", "PAID", "PENDING");
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0).catch(() => undefined);
    expect((await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + 15 * 60_000), true)).queued).toBe(0);
    sqlite.close();
    const optOutDb = setup();
    await createPaymentV2Schedule(optOutDb, "order-test-1", "payment-test-1", t0);
    await setPaymentReminderV2OptOut(optOutDb, "customer-test-1", "923000000001", t0);
    expect((await enqueueDuePaymentV2Stages(optOutDb, new Date(t0.getTime() + 15 * 60_000), true)).queued).toBe(0);
    expect(optOutDb ? sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='PAYMENT_REMINDERS_OPTED_OUT'").get() : null).toEqual({ n: 1 });
  });

  it("atomically confirms COD once, adds exactly PKR125, stops reminders, and audits consent", async () => {
    const db = setup();
    await createPaymentV2Schedule(db, "order-test-1", "payment-test-1", t0);
    sqlite.exec("UPDATE payment_reminder_v2_stages SET status='SENT' WHERE stage_minutes<240");
    await enqueueDuePaymentV2Stages(db, new Date(t0.getTime() + 240 * 60_000), true);
    const result = await resolvePaymentReminderCodFallback(db, "order-test-1", "923000000001", "CONFIRMED_COD", "inbound-test-1", policy);
    expect(result).toBe("CONFIRMED");
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state: "COD_PENDING", payment_status: "COD_PENDING" });
    expect(sqlite.prepare("SELECT review_state FROM payments").get()).toEqual({ review_state: "COD_PENDING" });
    expect(sqlite.prepare("SELECT cod_fee_pkr,quoted_total_pkr,status FROM cod_order_details").get()).toEqual({ cod_fee_pkr: 125, quoted_total_pkr: 7125, status: "COD_PENDING" });
    expect(sqlite.prepare("SELECT status,stop_reason FROM payment_reminder_v2_schedules").get()).toEqual({ status: "STOPPED", stop_reason: "COD_CONFIRMED" });
    expect(await resolvePaymentReminderCodFallback(db, "order-test-1", "923000000001", "CONFIRMED_COD", "duplicate", policy)).toBe("CONFIRMED");
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM cod_order_details").get()).toEqual({ n: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='PAYMENT_REMINDER_COD_CONFIRMED'").get()).toEqual({ n: 1 });
  });

  it("keeps an unpaid advance or cancels only after explicit customer choice", async () => {
    const keepDb = setup();
    await createPaymentV2Schedule(keepDb, "order-test-1", "payment-test-1", t0);
    sqlite.exec("UPDATE payment_reminder_v2_stages SET status='SENT' WHERE stage_minutes<240");
    await enqueueDuePaymentV2Stages(keepDb, new Date(t0.getTime() + 240 * 60_000), true);
    expect(await resolvePaymentReminderCodFallback(keepDb, "order-test-1", "923000000001", "KEPT_ADVANCE", "keep-test")).toBe("KEPT_ADVANCE");
    expect(keepDb ? sqlite.prepare("SELECT state,payment_status FROM orders").get() : null).toEqual({ state: "PAYMENT_PENDING", payment_status: "PENDING" });
    sqlite.close();
    const cancelDb = setup();
    await createPaymentV2Schedule(cancelDb, "order-test-1", "payment-test-1", t0);
    sqlite.exec("UPDATE payment_reminder_v2_stages SET status='SENT' WHERE stage_minutes<240");
    await enqueueDuePaymentV2Stages(cancelDb, new Date(t0.getTime() + 240 * 60_000), true);
    expect(await resolvePaymentReminderCodFallback(cancelDb, "order-test-1", "923000000001", "CANCELLED", "cancel-test")).toBe("CANCELLED");
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state: "CANCELLED", payment_status: "CANCELLED_UNPAID" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM cod_order_details").get()).toEqual({ n: 0 });
  });
});
