import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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
  orderNumber = "FS-261016-990001";
  state = "PAID";
  paymentStatus = "PAID";
  reviewState = "APPROVED";
  audits: string[] = [];
  confirmed = false;
  city = "Synthetic city";
  province = "Punjab";

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
    if (sql.startsWith("SELECT o.id,o.order_number,o.state")) return { id: "order", order_number: this.orderNumber, state: this.state, payment_status: this.paymentStatus, total_payable: 1000, province: this.province, created_at: "2026-10-16T12:00:00.000Z", updated_at: "2026-10-16T12:00:00.000Z", archived_at: null, order_confirmed_at: null, full_name: "Synthetic Tester", delivery_address: "Synthetic address", nearby_place: "Synthetic landmark", city: this.city, wa_id: "923000000001", contact_number: "03000000000", normalized_contact_number: "923000000000", whatsapp_number: "923000000001", normalized_whatsapp_number: "923000000001", payment_id: "payment", method: "BANK_TRANSFER", expected_amount: 1000, approved_amount: 1000, review_state: this.reviewState, submitted_at: "2026-10-16T12:01:00.000Z", approved_by: "admin@example.test", approved_at: "2026-10-16T12:02:00.000Z", rejection_reason: null, customer_transaction_reference: null, payment_created_at: "2026-10-16T12:01:00.000Z", payment_updated_at: "2026-10-16T12:02:00.000Z", receipt_count: 1, items_json: "[]", receipts_json: "[]", tracking_number: null, cancelled_at: null, cancelled_by: null, cancellation_reason: null, archived_by: null, archive_reason: null };
    if (sql.includes("SELECT o.order_number,o.state,o.payment_status")) return { order_number: this.orderNumber, state: this.state, payment_status: this.paymentStatus, review_state: this.reviewState, archived_at: null, city: this.city, province: this.province };
    if (sql.includes("SELECT order_number,state,archived_at")) return { order_number: this.orderNumber, state: this.state, archived_at: null };
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
const env = (db: FulfillmentDb, v2 = false) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", ...(v2 ? { PAYMENT_CONFIRMATION_V2_ENABLED: "true" } : {}) }) as never;

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
    expect(html).toContain("TEST_IMAGE_NOT_PAYMENT_PROOF");
    expect(html).toContain("No additional opaque evidence reference is required");
    expect(html).toContain("Preview private receipt");
    expect(html).toContain("shipping-label?format=4x6");
    expect(html).toContain("shipping-label?format=A6");
    expect(html).toContain("Assign Tracking");
    expect(html).toContain("Fulfillment held pending independent settlement verification and transaction reference.");
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

  it("watermarks synthetic fulfillment labels so they cannot represent physical shipment", () => {
    const order = { orderNumber:"SIM-GFS210-DO-NOT-SHIP",customerName:"SYNTHETIC TEST ONLY",deliveryAddress:"SIMULATED ADDRESS",landmark:"SIMULATED",city:"Synthetic City",province:"Synthetic Province",contactNumber:"" };
    const label=renderShippingLabelHtml(order,"A6","SIMULATED-GFS210-NOT-A-SHIPMENT");
    expect(label).toContain("TEST ONLY — SIMULATED FULFILLMENT; DO NOT SHIP");
    expect(label).toContain("SIMULATED-GFS210-NOT-A-SHIPMENT");
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

  it("flags a known city/province conflict and blocks labels and dispatch without editing it", async () => {
    const db = new FulfillmentDb();
    db.city = "Quetta";
    db.province = "Punjab";
    db.state = "PACKING";
    const v1Response = await app.fetch(new Request("https://admin.example.test/api/orders/order", { headers: auth }), env(db));
    const v1Order = (await v1Response.json() as { order: { locationIssue: string | null; canPrintShippingLabel: boolean } }).order;
    expect(v1Order).toMatchObject({ locationIssue: null, canPrintShippingLabel: true });
    const detailResponse = await app.fetch(new Request("https://admin.example.test/api/orders/order", { headers: auth }), env(db, true));
    const { order } = await detailResponse.json() as { order: { city: string; province: string; locationIssue: string; expectedProvince: string; canPrintShippingLabel: boolean } };
    expect(order).toMatchObject({ city: "Quetta", province: "Punjab", locationIssue: "CITY_PROVINCE_MISMATCH", expectedProvince: "Balochistan", canPrintShippingLabel: false });
    expect((await app.fetch(new Request("https://admin.example.test/api/orders/order/shipping-label?format=A6", { headers: auth }), env(db, true))).status).toBe(409);

    const csrfResponse = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env(db, true));
    const csrfBody = await csrfResponse.json() as { csrfToken: string };
    const session = { token: csrfBody.csrfToken, cookie: csrfResponse.headers.get("set-cookie")!.split(";", 1)[0] };
    const transition = await app.fetch(new Request("https://admin.example.test/api/orders/order/transition", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ from: "PACKING", to: "DISPATCHED", confirmation: db.orderNumber }) }), env(db, true));
    expect(transition.status).toBe(409);
    await expect(transition.json()).resolves.toMatchObject({ error: "DELIVERY_LOCATION_REVIEW_REQUIRED" });
    expect(db.state).toBe("PACKING");
    expect(db.city).toBe("Quetta");
    expect(db.province).toBe("Punjab");
  });

  it("keeps the unresolved FS-261019 incident on hold in detail, transition, label, tracking, and confirmation routes", async () => {
    const db = new FulfillmentDb();
    db.orderNumber = "FS-261019-000001";
    db.state = "PACKING";
    const detailResponse = await app.fetch(new Request("https://admin.example.test/api/orders/order", { headers: auth }), env(db));
    const { order } = await detailResponse.json() as { order: { fulfillmentHold: boolean; canConfirmOrder: boolean; canPrintShippingLabel: boolean } };
    expect(order.fulfillmentHold).toBe(true);
    expect(order.canConfirmOrder).toBe(false);
    expect(order.canPrintShippingLabel).toBe(false);
    expect((await app.fetch(new Request("https://admin.example.test/api/orders/order/shipping-label?format=4x6", { headers: auth }), env(db))).status).toBe(409);

    const session = await csrf(db);
    const transition = await app.fetch(new Request("https://admin.example.test/api/orders/order/transition", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ from: "PACKING", to: "DISPATCHED", confirmation: db.orderNumber }) }), env(db));
    expect(transition.status).toBe(409);
    await expect(transition.json()).resolves.toEqual({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" });

    const tracking = await app.fetch(new Request("https://admin.example.test/api/orders/order/tracking", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ trackingNumber: "TRK-SYNTHETIC", confirmation: db.orderNumber }) }), env(db));
    expect(tracking.status).toBe(409);
    await expect(tracking.json()).resolves.toEqual({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" });

    const confirmation = await app.fetch(new Request("https://admin.example.test/api/orders/order/confirm", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: db.orderNumber }) }), env(db));
    expect(confirmation.status).toBe(409);
    expect(db.state).toBe("PACKING");
    expect(db.audits).toHaveLength(0);
  });

  it("blocks incident fulfillment audit inserts in D1 while permitting unrelated orders", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT NOT NULL);");
      db.exec("CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,actor_id TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);");
      db.exec("INSERT INTO orders VALUES('incident','FS-261019-000001'),('synthetic','FS-TEST-000001');");
      db.exec(readFileSync("migrations/0023_incident_fulfillment_audit_hold.sql", "utf8"));
      expect(() => db.exec("INSERT INTO audit_log VALUES('blocked','ORDER_TRACKING_ASSIGNED','ADMIN','synthetic','ORDER','incident','c','{}','2026-10-20T00:00:00Z')")).toThrow("FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED");
      db.exec("INSERT INTO audit_log VALUES('allowed','ORDER_TRACKING_ASSIGNED','ADMIN','synthetic','ORDER','synthetic','c','{}','2026-10-20T00:00:00Z');");
      expect(db.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 1 });
    } finally {
      db.close();
    }
  });
});
