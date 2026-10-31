import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";
import { conversationPageHtml, parseConversationFilters, readConversation, readConversationSummary } from "../apps/admin/src/conversations";
import { conversationsDashboardPageHtml } from "../apps/admin/src/conversations-dashboard";

type Statement = { bind: (...args: unknown[]) => Statement; all: <T>() => Promise<{ results: T[]; meta: { rows_read: number } }>; first: <T>() => Promise<T | null> };
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string): Statement {
    let args: SQLInputValue[] = [];
    const statement = { bind: (...next: unknown[]) => { args = next as SQLInputValue[]; return statement; }, all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...args) as T[], meta: { rows_read: 25 } }), first: async <T>() => (this.sqlite.prepare(sql).get(...args) as T | undefined) ?? null } as Statement;
    return statement;
  }
}

function fixture(includeHistory = false): SqliteD1 {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY,wa_id TEXT UNIQUE,state TEXT,state_data TEXT,last_inbound_message_id TEXT,created_at TEXT,updated_at TEXT,last_inbound_at TEXT);
    CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT); CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT,customer_id TEXT,state TEXT,payment_status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT,method TEXT,review_state TEXT); CREATE TABLE outbound_messages(id TEXT PRIMARY KEY,idempotency_key TEXT,order_id TEXT,customer_id TEXT,kind TEXT,provider_message_id TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE whatsapp_events(id TEXT PRIMARY KEY,provider_event_id TEXT,event_type TEXT,status TEXT,created_at TEXT); CREATE TABLE payment_choice_recovery_stages(order_id TEXT,stage_minutes INTEGER,status TEXT,due_at TEXT,updated_at TEXT);`);
  if (includeHistory) sqlite.exec(readFileSync("migrations/0045_admin_message_history.sql", "utf8"));
  sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?,?,?,?,?)").run("conv-1", "923001234567", "PAYMENT_METHOD", "{}", "in-1", "2026-10-30T00:00:00Z", "2026-10-30T01:00:00Z", "2026-10-30T01:00:00Z");
  sqlite.prepare("INSERT INTO customers VALUES(?,?)").run("customer-1", "923001234567");
  sqlite.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?)").run("order-1", "FS-TEST-0001", "customer-1", "CREATED", "PENDING", "2026-10-30T00:30:00Z", "2026-10-30T01:00:00Z");
  sqlite.prepare("INSERT INTO payments VALUES(?,?,?,?)").run("payment-1", "order-1", "COD", "PENDING");
  sqlite.prepare("INSERT INTO outbound_messages VALUES(?,?,?,?,?,?,?,?,?)").run("out-1", "idem-1", "order-1", "customer-1", "PAYMENT_CHOICE", "wamid-test", "DELIVERED", "2026-10-30T00:31:00Z", "2026-10-30T00:31:00Z");
  sqlite.prepare("INSERT INTO whatsapp_events VALUES(?,?,?,?,?)").run("event-1", "message:in-1", "INTERACTIVE", "RECEIVED", "2026-10-30T01:00:00Z");
  sqlite.prepare("INSERT INTO payment_choice_recovery_stages VALUES(?,?,?,?,?)").run("order-1", 15, "DELIVERED", "2026-10-30T01:15:00Z", "2026-10-30T01:20:00Z");
  if (includeHistory) sqlite.prepare("INSERT INTO admin_message_history(id,conversation_id,direction,message_kind,status,status_rank,occurred_at,text_body,interactive_id,interactive_title,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("hist-1", "conv-1", "INBOUND", "INTERACTIVE", "RECEIVED", 0, "2026-10-30T01:00:00Z", "COD selected", "cod", "Cash on Delivery", "2026-10-30T01:00:00Z");
  return new SqliteD1(sqlite);
}

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
const env = (db: SqliteD1) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;

describe("GFS-341 read-only conversation viewer", () => {
  it("requires Admin authentication and validates bounded filters", async () => {
    const db = fixture();
    const denied = await app.fetch(new Request("https://admin.example.test/api/conversations"), env(db));
    expect(denied.status).toBe(403);
    expect(() => parseConversationFilters({ pageSize: "51" })).toThrow("CONVERSATION_PAGE_SIZE_INVALID");
    expect(() => parseConversationFilters({ q: "x".repeat(81) })).not.toThrow();
  });

  it("masks customer references, paginates, and exposes legacy metadata without inventing bodies", async () => {
    const db = fixture();
    db.sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?,?,?,?,?)").run("conv-2", "923009999999", "OFFER", "{}", "in-2", "2026-10-30T00:00:00Z", "2026-10-30T02:00:00Z", "2026-10-30T02:00:00Z");
    db.sqlite.prepare("INSERT INTO customers VALUES(?,?)").run("customer-2", "923009999999");
    db.sqlite.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?)").run("order-2", "FS-TEST-0002", "customer-2", "CREATED", "PENDING", "2026-10-30T01:30:00Z", "2026-10-30T02:00:00Z");
    db.sqlite.prepare("INSERT INTO payments VALUES(?,?,?,?)").run("payment-2", "order-2", null, "PENDING");
    const response = await app.fetch(new Request("https://admin.example.test/api/conversations?pageSize=1", { headers: auth }), env(db));
    expect(response.status).toBe(200);
    const list = await response.json() as { conversations: Array<Record<string, unknown>>; pagination: Record<string, number> };
    expect(list.conversations[0]).toMatchObject({ customerRef: "***9999", orderCount: 1, historyAvailable: false });
    expect(list.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(JSON.stringify(list)).not.toContain("923001234567");
    expect(JSON.stringify(list)).not.toContain("923009999999");
    const detail = await app.fetch(new Request("https://admin.example.test/api/conversations/conv-1", { headers: auth }), env(db));
    const body = await detail.json() as { historyAvailability: Record<string, unknown>; messages: Array<Record<string, unknown>>; recoveryTimeline: Array<Record<string, unknown>> };
    expect(body.historyAvailability).toMatchObject({ mode: "LEGACY_METADATA_ONLY", inboundBodyStored: false, outboundBodyStored: false });
    expect(body.messages).toEqual(expect.arrayContaining([expect.objectContaining({ direction: "INBOUND", text: null }), expect.objectContaining({ direction: "OUTBOUND", status: "DELIVERED", text: null })]));
    expect(body.recoveryTimeline[0]).toMatchObject({ stageMinutes: 15, status: "DELIVERED" });
    expect(JSON.stringify(body)).not.toContain("wamid-test");
    expect(JSON.stringify(body)).not.toContain("FS-TEST-0002");
    const filtered = await app.fetch(new Request("https://admin.example.test/api/conversations?q=FS-TEST-0002", { headers: auth }), env(db));
    const filteredBody = await filtered.json() as { conversations: Array<{ customerRef: string; latestOrder: { orderNumber: string } }> };
    expect(filteredBody.conversations).toEqual([expect.objectContaining({ customerRef: "***9999", latestOrder: expect.objectContaining({ orderNumber: "FS-TEST-0002" }) })]);
    expect(JSON.stringify(filteredBody)).not.toContain("FS-TEST-0001");
  });

  it("returns only captured future fields and enforces monotonic status", async () => {
    const db = fixture(true);
    const body = await readConversation(db as unknown as D1Database, "conv-1");
    expect(body.historyAvailability).toMatchObject({ mode: "MESSAGE_HISTORY", inboundBodyStored: true });
    expect(body.messages[0]).toMatchObject({ text: "COD selected", interactive: { id: "cod", title: "Cash on Delivery" } });
    expect(JSON.stringify(body)).not.toContain("wamid-test");
    expect(() => db.sqlite.exec("UPDATE admin_message_history SET status='FAILED',status_rank=0 WHERE id='hist-1'")).not.toThrow();
    expect(() => db.sqlite.exec("UPDATE admin_message_history SET status='READ',status_rank=3 WHERE id='hist-1'")) .not.toThrow();
    expect(() => db.sqlite.exec("UPDATE admin_message_history SET status='SENT',status_rank=1 WHERE id='hist-1'")).toThrow("ADMIN_MESSAGE_STATUS_REGRESSION");
  });

  it("renders a mobile read-only page without send controls", () => {
    const html = conversationPageHtml();
    expect(html).toContain("/api/conversations");
    expect(html).toContain("read-only");
    expect(html).toContain("Historical content unavailable");
    expect(html).not.toContain("method:'POST'");
    expect(html).not.toContain("/send");
  });

  it("returns server-side dashboard aggregates without exposing identifiers", async () => {
    const db = fixture();
    const body = await readConversationSummary(db as unknown as D1Database, new Date("2026-10-30T02:00:00Z"));
    expect(body.summary).toMatchObject({ total: 1, activeLast24Hours: 1, paymentReviewPending: 0, codPending: 0 });
    expect(JSON.stringify(body)).not.toContain("923001234567");
    const response = await app.fetch(new Request("https://admin.example.test/api/conversations/summary", { headers: auth }), env(db));
    expect(response.status).toBe(200);
    expect((await response.json() as { summary: Record<string, unknown> }).summary).toHaveProperty("activeLast24Hours");
  });

  it("renders the stale-safe automatic dashboard without write controls", () => {
    const html = conversationsDashboardPageHtml();
    expect(html).toContain("/api/conversations/summary");
    expect(html).toContain("setTimeout(()=>runAutomatic('automatic'),60000)");
    expect(html).toContain("Date.now()-lastSummaryAt>=300000");
    expect(html).toContain("gfs_admin_conversations_auto_update");
    expect(html).toContain("Auto update OFF");
    expect(html).toContain("document.hidden");
    expect(html).toContain("document.hasFocus()");
    expect(html).toContain("gfs_admin_conversations_auto_lock");
    expect(html).toContain("window.addEventListener('focus',resumeAutomatic)");
    expect(html).toContain("Update failed; showing the last successful data.");
    expect(html).toContain("prefers-reduced-motion");
    expect(html).not.toContain("method:'POST'");
    expect(html).not.toContain("/send");
  });
});
