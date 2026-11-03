import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";
import { parseAnalyticsFilters } from "../apps/admin/src/analytics";
import { readAttributionReport as readReport } from "../apps/admin/src/attribution";

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
function d1(db: DatabaseSync) {
  return { prepare(sql: string) { let args: SQLInputValue[] = []; const statement = { bind(...next: unknown[]) { args = next as SQLInputValue[]; return statement; }, async all<T>() { return { results: db.prepare(sql).all(...args) as T[], meta: {} }; } }; return statement; } };
}
const environment = (db: DatabaseSync) => ({ DB: d1(db) as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;

function fixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE whatsapp_conversations(id TEXT, wa_id TEXT, last_inbound_at TEXT);
    CREATE TABLE leads(id TEXT, order_id TEXT, created_at TEXT);
    CREATE TABLE orders(id TEXT, state TEXT);
    CREATE TABLE cod_order_details(order_id TEXT, status TEXT);
    CREATE TABLE meta_attribution(order_id TEXT, ctwa_clid TEXT, campaign_id TEXT, ad_set_id TEXT, ad_id TEXT);
  `);
  db.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?)").run("conversation-1", "wa-1", "2026-10-30T01:00:00.000Z");
  db.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?)").run("conversation-2", "wa-2", "2026-10-30T02:00:00.000Z");
  db.prepare("INSERT INTO leads VALUES(?,?,?)").run("lead-1", "order-1", "2026-10-30T03:00:00.000Z");
  db.prepare("INSERT INTO leads VALUES(?,?,?)").run("lead-2", "order-2", "2026-10-30T04:00:00.000Z");
  db.prepare("INSERT INTO orders VALUES(?,?)").run("order-1", "PAID");
  db.prepare("INSERT INTO orders VALUES(?,?)").run("order-2", "COD_PENDING");
  db.prepare("INSERT INTO cod_order_details VALUES(?,?)").run("order-2", "COD_PENDING");
  db.prepare("INSERT INTO meta_attribution VALUES(?,?,?,?,?)").run("order-1", "synthetic-ctwa", "synthetic-campaign", "synthetic-adset", "synthetic-ad");
  db.prepare("INSERT INTO meta_attribution VALUES(?,?,?,?,?)").run("order-2", null, null, null, null);
  return db;
}

describe("GFS-472 privacy-safe attribution report", () => {
  it("requires Admin authentication", async () => {
    const db = fixture();
    const response = await app.fetch(new Request("https://admin.example.test/api/attribution-report"), environment(db));
    expect(response.status).toBe(403);
    db.close();
  });

  it("reports aggregate attribution without referral or customer values", async () => {
    const db = fixture();
    const response = await app.fetch(new Request("https://admin.example.test/api/attribution-report?from=2026-10-30&to=2026-10-30", { headers: auth }), environment(db));
    const text = await response.text();
    expect(response.status, text).toBe(200);
    const body = JSON.parse(text) as { totals: Record<string, number | null>; daily: Array<Record<string, number>>; definitions: string[] };
    expect(body.totals).toMatchObject({ whatsappConversations: 2, persistedLeads: 2, attributedLeads: 1, attributedOrders: 1, attributedPaidOrFulfilledOrders: 1, campaignAttributedOrders: 1, persistedLeadOrderLinkPct: 100, campaignToOrderConversionPct: null });
    expect(body.daily).toEqual([{ day: "2026-10-30", whatsappConversations: 2, persistedLeads: 2, attributedLeads: 1, attributedOrders: 1, attributedPaidOrFulfilledOrders: 1 }]);
    expect(text).not.toContain("synthetic-ctwa");
    expect(text).not.toContain("order-1");
    expect(body.definitions.join(" ")).toMatch(/denominator/);
    db.close();
  });

  it("keeps the report implementation D1-compatible", async () => {
    const db = fixture();
    const filters = parseAnalyticsFilters({ from: "2026-10-30", to: "2026-10-30", now: new Date("2026-10-31T12:00:00.000Z") });
    const report = await readReport(d1(db) as unknown as Pick<D1Database, "prepare">, filters);
    expect(report.totals.attributedOrders).toBe(1);
    db.close();
  });
});
