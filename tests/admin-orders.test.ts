import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

type Statement = {
  sql: string;
  args: unknown[];
  bind: (...args: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};

const syntheticOrder = {
  id: "synthetic-order-newest",
  order_number: "FS-261016-990001",
  state: "PAYMENT_REVIEW",
  payment_status: "PENDING",
  total_payable: 300,
  province: "Synthetic Province",
  created_at: "2026-10-16T12:00:00.000Z",
  updated_at: "2026-10-16T12:30:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: null,
  archived_at: null,
  archived_by: null,
  archive_reason: null,
  full_name: "Synthetic Customer",
  delivery_address: "Synthetic delivery address",
  nearby_place: "Synthetic landmark",
  city: "Synthetic City",
  contact_number: "03001234567",
  normalized_phone: "+923001234567",
  normalized_contact_number: "+923001234567",
  whatsapp_number: "+923001234567",
  normalized_whatsapp_number: "+923001234567",
  wa_id: "923001234567",
  payment_id: "synthetic-payment",
  method: "JAZZCASH",
  expected_amount: 300,
  approved_amount: null,
  review_state: "REVIEW",
  submitted_at: "2026-10-16T12:20:00.000Z",
  approved_by: null,
  approved_at: null,
  rejection_reason: null,
  customer_transaction_reference: "SYNTHETIC-REFERENCE",
  payment_created_at: "2026-10-16T12:10:00.000Z",
  payment_updated_at: "2026-10-16T12:20:00.000Z",
  receipt_count: 1,
  items_json: JSON.stringify([{ id: "synthetic-item", itemType: "PRODUCT", productCode: "SYNTHETIC_PRODUCT", description: "Synthetic seed packs", quantity: 5, unitPricePkr: 0, lineTotalPkr: 0, createdAt: "2026-10-16T12:00:00.000Z" }]),
  receipts_json: JSON.stringify([{ id: "synthetic-receipt", paymentId: "synthetic-payment", objectKey: "receipts/synthetic/private-object", mimeType: "image/png", sizeBytes: 1200, submittedAt: "2026-10-16T12:20:00.000Z", createdAt: "2026-10-16T12:20:00.000Z" }])
};

class OrdersDb {
  calls: Array<{ sql: string; args: unknown[] }> = [];
  batches = 0;
  approvalRow: Record<string, unknown> | null = null;

  prepare(sql: string): D1PreparedStatement {
    return this.statement(sql, []) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batches += 1;
    return [];
  }

  private statement(sql: string, args: unknown[]): Statement {
    return {
      sql,
      args,
      bind: (...next: unknown[]) => this.statement(sql, next),
      first: async <T>() => this.first(sql, args) as T | null,
      all: async <T>() => ({ results: this.all(sql, args) as T[] }),
      run: async () => ({ meta: { changes: 0 } })
    };
  }

  private first(sql: string, args: unknown[]): Record<string, unknown> | null {
    this.calls.push({ sql, args });
    if (sql.startsWith("SELECT COUNT(*) AS all_count")) return { all_count: 58, verify_count: 7, confirmed_count: 19, fulfillment_count: 14 };
    if (sql.startsWith("SELECT COUNT(*) AS total")) return { total: 58 };
    if (sql.startsWith("SELECT p.review_state")) return this.approvalRow;
    if (sql.startsWith("SELECT o.id") && sql.includes("WHERE o.id=?")) return syntheticOrder;
    return null;
  }

  private all(sql: string, args: unknown[]): Record<string, unknown>[] {
    this.calls.push({ sql, args });
    if (sql.startsWith("SELECT o.id") && sql.includes("ORDER BY o.created_at DESC,o.id DESC")) return [syntheticOrder];
    if (sql.startsWith("SELECT id,action")) return [{ id: "synthetic-audit", action: "RECEIPT_SUBMITTED", actor_type: "CUSTOMER", actor_id: null, metadata_json: "{}", created_at: "2026-10-16T12:20:00.000Z" }];
    return [];
  }
}

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
const environment = (db?: OrdersDb) => ({ ...(db ? { DB: db as unknown as D1Database } : {}), ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;

async function csrf(db: OrdersDb) {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), environment(db));
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: response.headers.get("set-cookie")!.split(";", 1)[0] };
}

describe("GFS-139 orders dashboard API", () => {
  it("returns 503 when the order database binding is unavailable", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/orders", { headers: auth }), environment());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ORDER_ADMIN_UNAVAILABLE" });
  });

  it("returns queue counts, total, server pagination, and stable newest ordering", async () => {
    const db = new OrdersDb();
    const response = await app.fetch(new Request("https://admin.example.test/api/orders?tab=verify&page=2&pageSize=25&q=03001234567&date=2026-10-16&paymentStatus=REVIEW&archived=all", { headers: auth }), environment(db));
    expect(response.status).toBe(200);
    const body = await response.json() as { counts: Record<string, number>; total: number; pagination: Record<string, number>; orders: Array<Record<string, unknown>> };
    expect(body.counts).toEqual({ all: 58, verify: 7, confirmed: 19, fulfillment: 14 });
    expect(body.total).toBe(58);
    expect(body.pagination).toEqual({ page: 2, pageSize: 25, totalPages: 3 });
    expect(body.orders[0]).toMatchObject({ id: "synthetic-order-newest", itemSummary: "Synthetic seed packs x 5", receiptCount: 1 });
    const listCall = db.calls.find((call) => call.sql.startsWith("SELECT o.id") && call.sql.includes("LIMIT ? OFFSET ?"));
    expect(listCall?.sql).toContain("ORDER BY o.created_at DESC,o.id DESC");
    expect(listCall?.args.slice(-2)).toEqual([25, 25]);
    expect(listCall?.args).toContain("%923001234567%");
    expect(listCall?.args).toContain("%+923001234567%");
  });

  it("accepts only the supported 25, 50, and 100 row page sizes", async () => {
    for (const pageSize of [25, 50, 100]) {
      const response = await app.fetch(new Request(`https://admin.example.test/api/orders?pageSize=${pageSize}`, { headers: auth }), environment(new OrdersDb()));
      expect(response.status).toBe(200);
      expect((await response.json() as { pagination: { pageSize: number } }).pagination.pageSize).toBe(pageSize);
    }
    const invalid = await app.fetch(new Request("https://admin.example.test/api/orders?pageSize=10", { headers: auth }), environment(new OrdersDb()));
    expect(invalid.status).toBe(400);
  });

  it("returns complete delivery, payment, item, and private receipt detail", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/orders/synthetic-order-newest", { headers: auth }), environment(new OrdersDb()));
    expect(response.status).toBe(200);
    const body = await response.json() as { order: Record<string, unknown>; items: Array<Record<string, unknown>>; receipts: Array<Record<string, unknown>> };
    expect(body.order).toMatchObject({ deliveryAddress: "Synthetic delivery address", landmark: "Synthetic landmark", city: "Synthetic City", province: "Synthetic Province", contactNumber: "03001234567", waId: "923001234567", expectedAmountPkr: 300, paymentSubmittedAt: "2026-10-16T12:20:00.000Z", fulfillmentStatus: "NOT_READY" });
    expect(body.items[0]).toMatchObject({ description: "Synthetic seed packs", quantity: 5, lineTotalPkr: 0 });
    expect(body.receipts[0]).toMatchObject({ mimeType: "image/png", previewUrl: "/api/receipts/receipts%2Fsynthetic%2Fprivate-object" });
    expect(JSON.stringify(body)).not.toContain("r2_object_key");
  });

  it("blocks approval without a receipt or with a non-positive expected amount", async () => {
    const db = new OrdersDb();
    const session = await csrf(db);
    const approve = () => app.fetch(new Request("https://admin.example.test/api/payments/synthetic-payment/approve", { method: "POST", headers: { ...auth, origin: "https://admin.example.test", cookie: session.cookie, "x-csrf-token": session.token, "content-type": "application/json" }, body: JSON.stringify({ orderId: "synthetic-order-newest", confirmation: "FS-261016-990001" }) }), environment(db));
    db.approvalRow = { review_state: "REVIEW", expected_amount: 300, approved_amount: null, order_id: "synthetic-order-newest", order_number: "FS-261016-990001", state: "PAYMENT_REVIEW", archived_at: null, customer_id: "synthetic-customer", receipt_count: 0 };
    const missingReceipt = await approve();
    expect(missingReceipt.status).toBe(409);
    expect(await missingReceipt.json()).toEqual({ error: "PAYMENT_RECEIPT_REQUIRED" });
    db.approvalRow = { ...db.approvalRow, expected_amount: 0, receipt_count: 1 };
    const zeroAmount = await approve();
    expect(zeroAmount.status).toBe(409);
    expect(await zeroAmount.json()).toEqual({ error: "PAYMENT_AMOUNT_INVALID" });
    expect(db.batches).toBe(0);
  });
});
