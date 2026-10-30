import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";
import { parseAnalyticsFilters, readInboundAnalytics } from "../apps/admin/src/analytics";

type FakeStatement = {
  bind: (...args: unknown[]) => FakeStatement;
  all: <T>() => Promise<{ results: T[]; meta: { rows_read: number } }>;
};

class AnalyticsDb {
  calls: Array<{ sql: string; args: unknown[] }> = [];

  prepare(sql: string): FakeStatement {
    const statement = (args: unknown[]): FakeStatement => ({
      bind: (...next: unknown[]) => statement(next),
      all: async <T>() => {
        this.calls.push({ sql, args });
        let results: unknown[] = [];
        if (sql.includes("COUNT(DISTINCT provider_event_id)") && sql.includes("GROUP BY event_type")) results = [{ event_type: "MESSAGE", count: 8 }, { event_type: "INTERACTIVE", count: 4 }, { event_type: "MEDIA", count: 2 }, { event_type: "STATUS", count: 7 }];
        else if (sql.includes("substr(created_at,1,10)")) results = [{ day: "2026-10-30", event_type: "MESSAGE", count: 8 }, { day: "2026-10-30", event_type: "INTERACTIVE", count: 4 }, { day: "2026-10-30", event_type: "MEDIA", count: 2 }, { day: "2026-10-30", event_type: "STATUS", count: 7 }];
        else if (sql.includes("WITH conversation_snapshot")) results = [{ status: "PRE_ORDER", count: 1 }, { status: "POST_ORDER", count: 1 }, { status: "ADVANCE_PENDING", count: 1 }, { status: "COD_CONFIRMED", count: 1 }, { status: "ACTIVE", count: 1 }];
        else if (sql.includes("COUNT(DISTINCT wa_id)")) results = [{ unique_contacts: 5, new_contacts: 2, returning_contacts: 3 }];
        else if (sql.includes("COUNT(DISTINCT o.id)")) results = [{ submitted: 3, paid_or_fulfilled: 1, advance_selected: 1, cod_confirmed: 1, advance_pending: 1 }];
        else if (sql.includes("payment_choice_recovery_stages")) results = [{ stage_minutes: 15, status: "DELIVERED", count: 2 }, { stage_minutes: 210, status: "SENT", count: 1 }];
        return { results: results as T[], meta: { rows_read: 25 } };
      }
    });
    return statement([]);
  }
}

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
const environment = (db: AnalyticsDb) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;

describe("GFS-339 inbound analytics", () => {
  it("requires Admin authentication", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/analytics"), environment(new AnalyticsDb()));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
  });

  it("returns deduplicated inbound, conversion, abandonment, and recovery aggregates", async () => {
    const db = new AnalyticsDb();
    const response = await app.fetch(new Request("https://admin.example.test/api/analytics?from=2026-10-30&to=2026-10-30&status=POST_ORDER", { headers: auth }), environment(db));
    expect(response.status).toBe(200);
    const body = await response.json() as {
      inbound: Record<string, number>;
      orders: Record<string, number>;
      abandonment: { preOrder: number; postOrder: number; advancePending: number; codConfirmed: number; active: number; inactivityHours: number; filtered: Array<{ status: string; count: number }> };
      reminders: { available: boolean; delivered15: number; delivered210: number };
      queryCosts: Array<{ rowsRead: number }>;
    };
    expect(body.inbound).toMatchObject({ customerMessages: 14, textMessages: 8, interactiveMessages: 4, mediaMessages: 2, statusCallbacks: 7, uniqueContacts: 5, newContacts: 2, returningContacts: 3 });
    expect(body.orders).toMatchObject({ submitted: 3, paidOrFulfilled: 1, advanceSelected: 1, codConfirmed: 1, advancePending: 1, conversionPct: 21.43 });
    expect(body.abandonment).toMatchObject({ preOrder: 1, postOrder: 1, advancePending: 1, codConfirmed: 1, active: 1, inactivityHours: 24 });
    expect(body.abandonment.filtered).toEqual([{ status: "POST_ORDER", count: 1 }]);
    expect(body.reminders).toMatchObject({ available: true, sent15: 0, delivered15: 2, read15: 0, sent210: 1, delivered210: 0, read210: 0 });
    expect(body.queryCosts.every((item: { rowsRead: number }) => item.rowsRead === 25)).toBe(true);
    const eventQuery = db.calls.find((call) => call.sql.includes("COUNT(DISTINCT provider_event_id)") && call.sql.includes("GROUP BY event_type"));
    expect(eventQuery?.sql).toContain("event_type IN ('MESSAGE','INTERACTIVE','MEDIA','STATUS')");
    expect(eventQuery?.args).toEqual(["2026-10-30T00:00:00.000Z", "2026-10-31T00:00:00.000Z"]);
  });

  it("executes real SQLite/D1-compatible abandonment fixtures without false lifecycle classification", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE whatsapp_events(id TEXT PRIMARY KEY, provider_event_id TEXT UNIQUE NOT NULL, event_type TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY, wa_id TEXT UNIQUE NOT NULL, state TEXT NOT NULL, state_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_inbound_at TEXT);
      CREATE TABLE customers(id TEXT PRIMARY KEY, wa_id TEXT);
      CREATE TABLE orders(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, state TEXT NOT NULL, payment_status TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE payments(id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, method TEXT, review_state TEXT NOT NULL);
      CREATE TABLE cod_order_details(order_id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE outbound_messages(id TEXT PRIMARY KEY, order_id TEXT, kind TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE payment_choice_recovery_stages(order_id TEXT, stage_minutes INTEGER, status TEXT, updated_at TEXT);
    `);
    const insertConversation = sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?,?,?,?)");
    const insertCustomer = sqlite.prepare("INSERT INTO customers VALUES(?,?)");
    const insertOrder = sqlite.prepare("INSERT INTO orders VALUES(?,?,?,?,?)");
    const insertPayment = sqlite.prepare("INSERT INTO payments VALUES(?,?,?,?)");
    const insertInbound = sqlite.prepare("INSERT OR IGNORE INTO whatsapp_events VALUES(?,?,?,?)");
    insertInbound.run("event-1", "provider-1", "MESSAGE", "2026-10-29T01:00:00.000Z");
    insertInbound.run("event-1-duplicate", "provider-1", "MESSAGE", "2026-10-29T01:00:01.000Z");
    insertInbound.run("event-2", "provider-2", "INTERACTIVE", "2026-10-29T02:00:00.000Z");
    insertInbound.run("event-3", "provider-3", "MEDIA", "2026-10-30T01:00:00.000Z");
    insertInbound.run("event-4", "provider-4", "STATUS", "2026-10-29T03:00:00.000Z");
    const conversations = [
      ["conversation-pre", "wa-pre", "OFFER", "{}", "2026-10-28T00:00:00.000Z", "2026-10-28T00:00:00.000Z", "2026-10-29T00:00:00.000Z"],
      ["conversation-post", "wa-post", "REVIEW", "{}", "2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "2026-10-29T01:00:00.000Z"],
      ["conversation-active", "wa-active", "OFFER", "{}", "2026-10-30T00:00:00.000Z", "2026-10-30T00:00:00.000Z", "2026-10-30T10:00:00.000Z"],
      ["conversation-advance", "wa-advance", "REVIEW", "{}", "2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "2026-10-29T02:00:00.000Z"],
      ["conversation-cod", "wa-cod", "REVIEW", "{}", "2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "2026-10-29T02:30:00.000Z"],
      ["conversation-paid", "wa-paid", "REVIEW", "{}", "2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "2026-10-29T02:40:00.000Z"],
      ["conversation-cancelled", "wa-cancelled", "REVIEW", "{}", "2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "2026-10-29T02:50:00.000Z"],
      ["conversation-later", "wa-later", "REVIEW", "{}", "2026-10-30T18:00:00.000Z", "2026-10-30T18:00:00.000Z", "2026-10-30T18:00:00.000Z"]
    ];
    for (const row of conversations) insertConversation.run(...row as SQLInputValue[]);
    for (const [id, wa] of [["customer-post", "wa-post"], ["customer-advance", "wa-advance"], ["customer-cod", "wa-cod"], ["customer-paid", "wa-paid"], ["customer-cancelled", "wa-cancelled"], ["customer-later", "wa-later"]]) insertCustomer.run(id, wa);
    insertOrder.run("order-post", "customer-post", "CREATED", "PENDING", "2026-10-29T04:00:00.000Z");
    insertOrder.run("order-advance", "customer-advance", "CREATED", "PENDING", "2026-10-29T04:01:00.000Z");
    insertOrder.run("order-cod", "customer-cod", "COD_PENDING", "PENDING", "2026-10-29T04:02:00.000Z");
    insertOrder.run("order-paid", "customer-paid", "PAID", "PAID", "2026-10-29T04:03:00.000Z");
    insertOrder.run("order-cancelled", "customer-cancelled", "CANCELLED", "CANCELLED", "2026-10-29T04:04:00.000Z");
    insertOrder.run("order-later", "customer-later", "CREATED", "PENDING", "2026-10-29T04:05:00.000Z");
    insertPayment.run("payment-post", "order-post", null, "PENDING");
    insertPayment.run("payment-advance", "order-advance", "JAZZCASH", "PENDING");
    insertPayment.run("payment-cod", "order-cod", null, "PENDING");
    insertPayment.run("payment-paid", "order-paid", "JAZZCASH", "APPROVED");
    insertPayment.run("payment-cancelled", "order-cancelled", null, "PENDING");
    insertPayment.run("payment-later", "order-later", null, "PENDING");
    sqlite.prepare("INSERT INTO cod_order_details VALUES(?,?)").run("order-cod", "COD_PENDING");
    for (const [id, order] of [["out-post", "order-post"], ["out-cancelled", "order-cancelled"], ["out-later", "order-later"]]) sqlite.prepare("INSERT INTO outbound_messages VALUES(?,?,?,?)").run(id, order, "PAYMENT_CHOICE", "SENT");
    sqlite.prepare("INSERT INTO payment_choice_recovery_stages VALUES(?,?,?,?)").run("order-advance", 15, "DELIVERED", "2026-10-30T01:00:00.000Z");
    sqlite.prepare("INSERT INTO payment_choice_recovery_stages VALUES(?,?,?,?)").run("order-advance", 210, "READ", "2026-10-30T02:00:00.000Z");
    const db = { prepare(sql: string) {
      let args: SQLInputValue[] = [];
      return { bind(...next: unknown[]) { args = next as SQLInputValue[]; return this; }, async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[], meta: {} }; } };
    } } as unknown as Parameters<typeof readInboundAnalytics>[0];
    try {
      const filters = parseAnalyticsFilters({ from: "2026-10-29", to: "2026-10-30", now: new Date("2026-10-30T12:00:00.000Z") });
      const result = await readInboundAnalytics(db, filters);
      expect(result.inbound.customerMessages).toBe(3);
      expect(result.inbound.statusCallbacks).toBe(1);
      expect(result.inbound.contactAttribution).toBe("SNAPSHOT_ESTIMATE");
      expect(result.orders).toMatchObject({ submitted: 6, paidOrFulfilled: 1, advanceSelected: 2, codConfirmed: 1, advancePending: 1 });
      expect(result.abandonment).toMatchObject({ preOrder: 1, postOrder: 1, advancePending: 1, codConfirmed: 1, active: 1 });
      expect(result.reminders).toMatchObject({ sent15: 0, delivered15: 1, read15: 0, sent210: 0, delivered210: 0, read210: 1 });
      expect(result.definitions.join(" ")).toMatch(/UTC/);
      expect(result.definitions.join(" ")).toMatch(/not mutually exclusive/);
    } finally {
      sqlite.close();
    }
  });

  it("rejects unsafe ranges/statuses and keeps CSV privacy-safe", async () => {
    const invalidDate = await app.fetch(new Request("https://admin.example.test/api/analytics?from=2026-01-01&to=2026-02-15", { headers: auth }), environment(new AnalyticsDb()));
    expect(invalidDate.status).toBe(400);
    expect(await invalidDate.json()).toEqual({ error: "ANALYTICS_RANGE_TOO_WIDE" });
    const invalidStatus = await app.fetch(new Request("https://admin.example.test/api/analytics?status=customer-id", { headers: auth }), environment(new AnalyticsDb()));
    expect(invalidStatus.status).toBe(400);
    expect(await invalidStatus.json()).toEqual({ error: "ANALYTICS_STATUS_INVALID" });
    const csv = await app.fetch(new Request("https://admin.example.test/api/analytics/export?from=2026-10-30&to=2026-10-30", { headers: auth }), environment(new AnalyticsDb()));
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("customer_inbound_messages");
    expect(text).not.toMatch(/wa_id|provider_event_id|order_id|customer-id/i);
  });
});
