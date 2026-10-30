import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

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
        else if (sql.includes("COUNT(DISTINCT o.id)")) results = [{ submitted: 3, completed: 1, advance_selected: 1, cod_confirmed: 1, advance_pending: 1 }];
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
    expect(body.orders).toMatchObject({ submitted: 3, completed: 1, advanceSelected: 1, codConfirmed: 1, advancePending: 1, conversionPct: 21.43 });
    expect(body.abandonment).toMatchObject({ preOrder: 1, postOrder: 1, advancePending: 1, codConfirmed: 1, active: 1, inactivityHours: 24 });
    expect(body.abandonment.filtered).toEqual([{ status: "POST_ORDER", count: 1 }]);
    expect(body.reminders).toMatchObject({ available: true, delivered15: 2, delivered210: 1 });
    expect(body.queryCosts.every((item: { rowsRead: number }) => item.rowsRead === 25)).toBe(true);
    const eventQuery = db.calls.find((call) => call.sql.includes("COUNT(DISTINCT provider_event_id)") && call.sql.includes("GROUP BY event_type"));
    expect(eventQuery?.sql).toContain("event_type IN ('MESSAGE','INTERACTIVE','MEDIA','STATUS')");
    expect(eventQuery?.args).toEqual(["2026-10-30T00:00:00.000Z", "2026-10-31T00:00:00.000Z"]);
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
