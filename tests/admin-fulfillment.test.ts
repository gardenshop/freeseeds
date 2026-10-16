import { describe, expect, it } from "vitest";
import app, { renderShippingLabelHtml } from "../apps/admin/src/index";

type BoundStatement = {
  sql: string;
  args: unknown[];
  bind: (...args: unknown[]) => BoundStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};

class FulfillmentDb {
  state = "PAID";
  paymentStatus = "PAID";
  reviewState = "APPROVED";
  audits: string[] = [];
  confirmed = false;

  prepare(sql: string): D1PreparedStatement {
    return this.statement(sql, []) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return (statements as unknown as BoundStatement[]).map((statement) => ({ meta: { changes: this.execute(statement) } })) as unknown as D1Result<T>[];
  }

  private statement(sql: string, args: unknown[]): BoundStatement {
    return {
      sql,
      args,
      bind: (...next: unknown[]) => this.statement(sql, next),
      first: async <T>() => this.first(sql) as T | null,
      all: async <T>() => ({ results: [] as T[] }),
      run: async () => ({ meta: { changes: this.execute({ sql, args }) } })
    };
  }

  private first(sql: string): Record<string, unknown> | null {
    if (sql.includes("SELECT o.order_number,o.state,o.payment_status")) return { order_number: "FS-261016-990001", state: this.state, payment_status: this.paymentStatus, review_state: this.reviewState, archived_at: null };
    if (sql.includes("SELECT order_number,state,archived_at")) return { order_number: "FS-261016-990001", state: this.state, archived_at: null };
    if (sql.includes("action='ORDER_CONFIRMED'")) return this.confirmed ? { created_at: "2026-10-16T12:00:00.000Z" } : null;
    return null;
  }

  private execute(statement: { sql: string; args: unknown[] }): number {
    if (statement.sql.startsWith("UPDATE orders SET state=")) {
      const next = String(statement.args[0]);
      const expected = String(statement.args[3]);
      if (this.state !== expected) return 0;
      this.state = next;
      return 1;
    }
    if (statement.sql.includes("INSERT INTO audit_log")) {
      this.audits.push(statement.sql);
      if (statement.args[1] === "ORDER_CONFIRMED") this.confirmed = true;
      return 1;
    }
    return 0;
  }
}

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
const env = (db: FulfillmentDb) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;

async function csrf(db: FulfillmentDb) {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env(db));
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: response.headers.get("set-cookie")!.split(";", 1)[0] };
}

function mutationHeaders(session: { token: string; cookie: string }) {
  return { ...auth, origin: "https://admin.example.test", cookie: session.cookie, "x-csrf-token": session.token, "content-type": "application/json" };
}

describe("GFS-141 admin fulfillment actions", () => {
  it("renders separate operational confirmation, receipt, fulfillment, label, and tracking actions", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env(new FulfillmentDb()));
    const html = await response.text();
    expect(html).toContain("Confirm Order");
    expect(html).toContain("Approve payment");
    expect(html).toContain("Request Clearer Receipt");
    expect(html).toContain("Preview private receipt");
    expect(html).toContain("shipping-label?format=4x6");
    expect(html).toContain("shipping-label?format=A6");
    expect(html).toContain("Assign Tracking");
  });

  it("escapes label fields and omits tracking until it is assigned", () => {
    const order = { orderNumber: "FS-261016-990001", customerName: "<img src=x onerror=alert(1)>", deliveryAddress: "A & B <unsafe>", landmark: "Near \"Market\"", city: "City", province: "Province", contactNumber: "+923001234567" };
    const withoutTracking = renderShippingLabelHtml(order, "4x6");
    expect(withoutTracking).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(withoutTracking).toContain("A &amp; B &lt;unsafe&gt;");
    expect(withoutTracking).not.toContain("Tracking:");
    const withTracking = renderShippingLabelHtml(order, "A6", "TRK-123");
    expect(withTracking).toContain("@page{size:105mm 148mm");
    expect(withTracking).toContain("Tracking: TRK-123");
  });

  it("requires server-approved payment and exact sequential fulfillment transitions", async () => {
    const db = new FulfillmentDb();
    const session = await csrf(db);
    const transition = (from: string, to: string) => app.fetch(new Request("https://admin.example.test/api/orders/order/transition", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ from, to, confirmation: "FS-261016-990001" }) }), env(db));
    db.paymentStatus = "PENDING";
    db.reviewState = "REVIEW";
    const blocked = await transition("PAID", "PACKING");
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ error: "FULFILLMENT_PAYMENT_NOT_APPROVED" });
    db.paymentStatus = "PAID";
    db.reviewState = "APPROVED";
    expect((await transition("PAID", "PACKING")).status).toBe(200);
    expect(db.state).toBe("PACKING");
    expect((await transition("PACKING", "DELIVERED")).status).toBe(409);
    expect(db.audits.length).toBe(1);
  });

  it("records Confirm Order without changing the financial or fulfillment state", async () => {
    const db = new FulfillmentDb();
    const session = await csrf(db);
    const response = await app.fetch(new Request("https://admin.example.test/api/orders/order/confirm", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-261016-990001" }) }), env(db));
    expect(response.status).toBe(200);
    expect(db.state).toBe("PAID");
    expect(db.paymentStatus).toBe("PAID");
    expect(db.confirmed).toBe(true);
    expect((await app.fetch(new Request("https://admin.example.test/api/orders/order/confirm", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-261016-990001" }) }), env(db))).status).toBe(200);
  });
});
