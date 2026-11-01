import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";
import { cancellationDashboardPageHtml, parseCancellationFilters, readCancellationReport } from "../apps/admin/src/cancellations";

type Statement = { bind: (...args: unknown[]) => Statement; all: <T>() => Promise<{ results: T[]; meta: { rows_read: number } }> };
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string): Statement {
    let args: SQLInputValue[] = [];
    const statement = { bind: (...next: unknown[]) => { args = next as SQLInputValue[]; return statement; }, all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...args) as T[], meta: { rows_read: 12 } }) } as Statement;
    return statement;
  }
}

function fixture(): SqliteD1 {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY,wa_id TEXT UNIQUE,state TEXT,state_data TEXT,last_inbound_message_id TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY);`);
  sqlite.exec(readFileSync("migrations/0046_checkout_cancellation_feedback.sql", "utf8"));
  sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?,?,?,?)").run("conv-a", "923001234567", "CANCELLED", "{}", "in-a", "2026-10-29T20:00:00Z", "2026-10-29T20:00:00Z");
  sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?,?,?,?)").run("conv-b", "923001234568", "CANCELLED", "{}", "in-b", "2026-10-30T20:00:00Z", "2026-10-30T20:00:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_events VALUES(?,?,?,?,?,?,?,?,?)").run("cancel-a", "conv-a", "***4567", "OFFER", "en", null, "message:cancel-a", "2026-10-29T20:00:00Z", "2026-10-29T20:00:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_events VALUES(?,?,?,?,?,?,?,?,?)").run("cancel-b", "conv-b", "***4568", "REVIEW", "ur", null, "message:cancel-b", "2026-10-30T20:00:00Z", "2026-10-30T20:00:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_events VALUES(?,?,?,?,?,?,?,?,?)").run("cancel-unknown", "conv-b", "***4568", "UNKNOWN", "UNKNOWN", null, "message:cancel-unknown", "2026-10-31T20:00:00Z", "2026-10-31T20:00:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_feedback_events VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("feedback-a", "cancel-a", "REASON", "COD_COLLECTION_FEE", null, "ADVANCE_AVOIDS_COD_FEE", "REASON_SELECTED", "message:feedback-a", "2026-10-29T20:01:00Z", null, "2026-10-29T20:01:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_feedback_events VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("suggestion-a", "cancel-a", "SUGGESTION", null, "Synthetic suggestion", null, "SUGGESTION_PROVIDED", "message:suggestion-a", "2026-10-29T20:02:00Z", "2027-01-27T20:02:00Z", "2026-10-29T20:02:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_feedback_events VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("feedback-b", "cancel-b", "REASON", "ORDER_LATER", null, "START_WHEN_READY", "REASON_SELECTED", "message:feedback-b", "2026-10-30T20:01:00Z", null, "2026-10-30T20:01:00Z");
  sqlite.prepare("INSERT INTO checkout_cancellation_feedback_events VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("suggestion-b", "cancel-b", "SUGGESTION", null, "Expired synthetic suggestion", null, "SUGGESTION_PROVIDED", "message:suggestion-b", "2026-10-30T20:02:00Z", "2026-10-31T00:00:00Z", "2026-10-30T20:02:00Z");
  return new SqliteD1(sqlite);
}

describe("GFS-403 Admin cancellation analytics", () => {
  it("validates bounded PKT date, stage, and reason filters", () => {
    expect(parseCancellationFilters({ from: "2026-10-01", to: "2026-11-01", stage: "offer", reason: "cod_collection_fee" })).toMatchObject({ stage: "OFFER", reason: "COD_COLLECTION_FEE" });
    expect(() => parseCancellationFilters({ from: "2026-01-01", to: "2026-11-01" })).toThrow("CANCELLATION_DATE_RANGE_INVALID");
    expect(() => parseCancellationFilters({ stage: "INVALID" })).toThrow("CANCELLATION_STAGE_INVALID");
  });

  it("returns exact stage totals, reason percentages, PKT-window facts, and hides expired suggestions", async () => {
    const db = fixture();
    const report = await readCancellationReport(db as unknown as D1Database, parseCancellationFilters({ from: "2026-10-29", to: "2026-11-01" }), new Date("2026-11-01T12:00:00Z"));
    expect(report.window).toMatchObject({ fromUtc: "2026-10-28T19:00:00.000Z", toUtcExclusive: "2026-11-01T19:00:00.000Z" });
    expect(report.totals).toMatchObject({ total: 3, offer: 1, review: 1, unknown: 1, reasonResponses: 2 });
    expect(report.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: "COD_COLLECTION_FEE", count: 1, percentageOfResponses: 50, percentageOfCancellations: 33.3 })]));
    expect(report.latest.find((row) => row.stage === "OFFER")).toMatchObject({ customerRef: "***4567", suggestion: "Synthetic suggestion", linkedOrder: false });
    expect(report.latest.find((row) => row.stage === "REVIEW")).toMatchObject({ customerRef: "***4568", suggestion: null });
    expect(JSON.stringify(report)).not.toContain("923001234567");
    expect(JSON.stringify(report)).not.toContain("conv-a");
    expect(report.queryCosts).toHaveLength(3);
    db.sqlite.close();
  });

  it("serves an authenticated read-only endpoint and mobile-safe dashboard", async () => {
    const db = fixture();
    const environment = { DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never;
    const denied = await app.fetch(new Request("https://admin.example.test/api/cancellations?from=2026-10-29&to=2026-11-01"), environment);
    expect(denied.status).toBe(403);
    const response = await app.fetch(new Request("https://admin.example.test/api/cancellations?from=2026-10-29&to=2026-11-01&stage=OFFER", { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), environment);
    expect(response.status).toBe(200);
    expect((await response.json() as { totals: { offer: number } }).totals.offer).toBe(1);
    const html = cancellationDashboardPageHtml();
    expect(html).toContain("Asia/Karachi");
    expect(html).toContain("OTHER_PRE_SUBMISSION");
    expect(html).toContain("suggestions disappear after 90 days");
    expect(html).not.toContain("method:'POST'");
    db.sqlite.close();
  });
});
