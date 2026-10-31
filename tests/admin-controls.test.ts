import { describe, expect, it } from "vitest";
import { Script } from "node:vm";
import app from "../apps/admin/src/index";

type ConversationFixture = { waId: string; state: string; stateData: string; lastInboundMessageId: string | null; createdAt: string; updatedAt: string };
type OrderFixture = { id: string; orderNumber: string; state: string; paymentStatus: string; receiptCount: number; approved: boolean; archivedAt?: string; cancelledAt?: string };
type BoundStatement = { sql: string; args: unknown[]; bind: (...args: unknown[]) => BoundStatement; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta: { changes: number } }> };

class AdminMemoryDb {
  conversations = new Map<string, ConversationFixture>();
  exemptions = new Set(["923034901810"]);
  orders = new Map<string, OrderFixture>();
  payments = new Map<string, { amount: number }>();
  sql: string[] = [];

  prepare(sql: string): D1PreparedStatement {
    return this.statement(sql, []) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const item of statements as unknown as BoundStatement[]) {
      const changes = this.execute(item.sql, item.args);
      results.push({ meta: { changes } } as unknown as D1Result<T>);
    }
    return results;
  }

  private statement(sql: string, args: unknown[]): BoundStatement {
    return {
      sql,
      args,
      bind: (...next: unknown[]) => this.statement(sql, next),
      first: async <T>() => this.first(sql, args) as T | null,
      all: async <T>() => ({ results: this.all(sql) as T[] }),
      run: async () => ({ meta: { changes: this.execute(sql, args) } })
    };
  }

  private first(sql: string, args: unknown[]): Record<string, unknown> | null {
    if (sql.includes("SELECT wa_id,state FROM whatsapp_conversations")) {
      const row = this.conversations.get(String(args[0])) ?? this.conversations.get(String(args[1]));
      return row ? { wa_id: row.waId, state: row.state } : null;
    }
    if (sql.includes("SELECT order_number FROM orders")) {
      const order = this.orders.get(String(args[0]));
      return order ? { order_number: order.orderNumber } : null;
    }
    return null;
  }

  private all(sql: string): Record<string, unknown>[] {
    if (sql.includes("FROM cooldown_exemptions")) return [...this.exemptions].map((waId) => ({ wa_id: waId, reason: "SYNTHETIC", created_by: "test", created_at: "2026-10-12T00:00:00.000Z" }));
    return [];
  }

  private execute(sql: string, args: unknown[]): number {
    this.sql.push(sql);
    if (sql.startsWith("UPDATE whatsapp_conversations SET state='NEW'")) {
      const row = this.conversations.get(String(args[1]));
      if (!row) return 0;
      this.conversations.set(row.waId, { ...row, state: "NEW", stateData: "{}", lastInboundMessageId: null, updatedAt: String(args[0]) });
      return 1;
    }
    if (sql.startsWith("INSERT INTO cooldown_exemptions")) {
      const waId = String(args[0]);
      if (this.exemptions.has(waId)) throw new Error("duplicate");
      this.exemptions.add(waId);
      return 1;
    }
    if (sql.startsWith("DELETE FROM cooldown_exemptions")) return this.exemptions.delete(String(args[0])) ? 1 : 0;
    if (sql.startsWith("UPDATE orders SET state='CANCELLED'")) return this.retainOrder(String(args[4]), "cancel", String(args[0]));
    if (sql.startsWith("UPDATE orders SET archived_at=")) return this.retainOrder(String(args[4]), "archive", String(args[0]));
    if (sql.startsWith("INSERT INTO audit_log")) return 1;
    return 0;
  }

  private retainOrder(id: string, action: "cancel" | "archive", now: string): number {
    const order = this.orders.get(id);
    if (!order || order.archivedAt || order.paymentStatus === "PAID" || order.approved || order.receiptCount > 0) return 0;
    if (!["NEW", "DETAILS_COMPLETED", "PAYMENT_PENDING", "PAYMENT_REJECTED", "CANCELLED"].includes(order.state)) return 0;
    if (action === "cancel") {
      if (order.state === "CANCELLED") return 0;
      order.state = "CANCELLED";
      order.cancelledAt = now;
    } else order.archivedAt = now;
    return 1;
  }
}

const env = (db: AdminMemoryDb) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" }) as never;
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

async function csrf(db: AdminMemoryDb) {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env(db));
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: response.headers.get("set-cookie")!.split(";", 1)[0] };
}

function mutationHeaders(session: { token: string; cookie: string }, origin = "https://admin.example.test") {
  return { ...auth, origin, cookie: session.cookie, "x-csrf-token": session.token, "content-type": "application/json" };
}

describe("GFS-109 admin controls", () => {
  it("Access-protects both pages and APIs", async () => {
    const db = new AdminMemoryDb();
    for (const path of ["/orders", "/test-controls", "/api/orders", "/api/test-controls/cooldown-exemptions"]) {
      const response = await app.fetch(new Request(`https://admin.example.test${path}`), env(db));
      expect(response.status).toBe(403);
    }
  });

  it("renders a responsive, privacy-safe Admin home navigation", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/", { headers: auth }), env(new AdminMemoryDb()));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Get Free Seeds Admin");
    expect(html).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(html).toContain("@media(max-width:560px)");
    for (const path of ["/orders", "/analytics", "/conversations", "/payment-settings", "/cod-settings", "/whatsapp-content", "/meta-activation"]) expect(html).toContain(`href=\"${path}\"`);
    expect(html).not.toContain("SELECT");
    expect(html).not.toContain("customerName");
  });

  it("renders the tabbed, URL-hydrated split-pane order workspace", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders?q=synthetic&paymentStatus=REVIEW&archived=all", { headers: auth }), env(new AdminMemoryDb()));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("new URLSearchParams(location.search)");
    expect(html).toContain('id="download-export"');
    expect(html).toContain("/api/orders/export?");
    for (const tab of ["All Orders", "Verify Payments", "Confirmed Payments", "Fulfillment"]) expect(html).toContain(tab);
    for (const size of ["25", "50", "100"]) expect(html).toContain(`<option>${size}</option>`);
    expect(html).toContain("selectedId=list[0].id");
    expect(html).toContain(".orders{display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0}");
    expect(html).toContain("/api/payments/'");
    expect(html).toContain("request-clearer-receipt");
    expect(html).toContain("Reason code: TEST_IMAGE_NOT_PAYMENT_PROOF or INSUFFICIENT_OR_UNCLEAR_RECEIPT");
    expect(html).toContain("textContent.trim().toLowerCase()==='request clearer receipt'");
    expect(html).toContain("Preview private receipt");
    expect(html).toContain("order.receiptCount>0");
    expect(html).toContain("Mark Packing");
    expect(html).toContain("Mark Dispatched");
    expect(html).toContain("Mark Delivered");
  });

  it("renders bounded, stale-safe startup request handling", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders?q=synthetic&tab=verify&page=2", { headers: auth }), env(new AdminMemoryDb()));
    const html = await response.text();
    expect(html).toContain("setTimeout(()=>{timedOut=true;controller.abort()},12000)");
    expect(html).toContain("Server returned a non-JSON response (HTTP '+response.status+')");
    expect(html).toContain("Request failed (HTTP '+response.status+')");
    expect(html).toContain("if(listController)listController.abort()");
    expect(html).toContain("if(generation!==listGeneration||isAbort(error))return");
    expect(html).toContain("Orders could not be loaded. Use Refresh to try again.");
    expect(html).toContain("hydrate();setTabs({});load();");
  });

  it("keeps the professional startup script parseable with all queues and auto-selection", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders?tab=confirmed&page=3&q=synthetic", { headers: auth }), env(new AdminMemoryDb()));
    const html = await response.text();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Script(script!)).not.toThrow();
    for (const tab of ["all", "verify", "confirmed", "fulfillment"]) expect(html).toContain(`data-tab="${tab}"`);
    expect(html).toContain("setTabs(data.counts)");
    expect(html).toContain("selectedId=list[0].id");
    expect(html).toContain("if(id)await show(id)");
  });

  it("bounds order cards and gives Refresh visible safe feedback", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env(new AdminMemoryDb()));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("height:calc(100vh - 285px)");
    expect(html).toContain(".orders{display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0}");
    expect(html).toContain("max-height:42vh");
    expect(html).toContain("Checking latest orders...");
    expect(html).toContain("· Checked ");
    expect(html).toContain("const refreshWithoutFeedback=refreshOrders");
  });

  it("requires CSRF for payment and fulfillment detail mutations", async () => {
    const db = new AdminMemoryDb();
    const requests = [
      ["/api/payments/payment/approve", { orderId: "order", confirmation: "FS-261012-990001" }],
      ["/api/payments/payment/reject", { orderId: "order", reason: "Synthetic", confirmation: "FS-261012-990001" }],
      ["/api/payments/payment/request-clearer-receipt", { orderId: "order", confirmation: "FS-261012-990001" }],
      ["/api/orders/order/transition", { from: "PAID", to: "PACKING", confirmation: "FS-261012-990001" }],
      ["/api/orders/order/confirm", { confirmation: "FS-261012-990001" }],
      ["/api/orders/order/tracking", { trackingNumber: "TRK-123", confirmation: "FS-261012-990001" }]
    ] as const;
    for (const [path, body] of requests) {
      const response = await app.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) }), env(db));
      expect(response.status).toBe(403);
    }
  });

  it("requires a same-origin per-session CSRF token and explicit confirmation", async () => {
    const db = new AdminMemoryDb();
    db.conversations.set("923001234567", { waId: "923001234567", state: "PAYMENT_PENDING", stateData: "{}", lastInboundMessageId: "synthetic-message", createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z" });
    const noToken = await app.fetch(new Request("https://admin.example.test/api/test-controls/conversations/923001234567/reset", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "923001234567" }) }), env(db));
    expect(noToken.status).toBe(403);
    const session = await csrf(db);
    const crossOrigin = await app.fetch(new Request("https://admin.example.test/api/test-controls/conversations/923001234567/reset", { method: "POST", headers: mutationHeaders(session, "https://attacker.example.test"), body: JSON.stringify({ confirmation: "923001234567" }) }), env(db));
    expect(crossOrigin.status).toBe(403);
    const unconfirmed = await app.fetch(new Request("https://admin.example.test/api/test-controls/conversations/923001234567/reset", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "wrong" }) }), env(db));
    expect(unconfirmed.status).toBe(400);
  });

  it("resets only the selected conversation and preserves commerce history", async () => {
    const db = new AdminMemoryDb();
    db.conversations.set("923001234567", { waId: "923001234567", state: "PAYMENT_PENDING", stateData: "{\"orderId\":\"order-one\"}", lastInboundMessageId: "message-one", createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z" });
    db.conversations.set("923009999999", { waId: "923009999999", state: "REVIEW", stateData: "{\"orderId\":\"order-two\"}", lastInboundMessageId: "message-two", createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z" });
    db.orders.set("order-one", { id: "order-one", orderNumber: "FS-261012-990001", state: "PAYMENT_PENDING", paymentStatus: "PENDING", receiptCount: 0, approved: false });
    db.payments.set("order-one", { amount: 250 });
    const history = JSON.stringify({ orders: [...db.orders], payments: [...db.payments] });
    const session = await csrf(db);
    const response = await app.fetch(new Request("https://admin.example.test/api/test-controls/conversations/923001234567/reset", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "923001234567" }) }), env(db));
    expect(response.status).toBe(200);
    expect(db.conversations.get("923001234567")).toMatchObject({ state: "NEW", stateData: "{}", lastInboundMessageId: null });
    expect(db.conversations.get("923009999999")).toMatchObject({ state: "REVIEW", lastInboundMessageId: "message-two" });
    expect(JSON.stringify({ orders: [...db.orders], payments: [...db.payments] })).toBe(history);
  });

  it("validates and audits D1 exemption add/remove mutations", async () => {
    const db = new AdminMemoryDb();
    const session = await csrf(db);
    const invalid = await app.fetch(new Request("https://admin.example.test/api/test-controls/cooldown-exemptions", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ waId: "+923001234567", confirmation: "+923001234567" }) }), env(db));
    expect(invalid.status).toBe(400);
    const add = await app.fetch(new Request("https://admin.example.test/api/test-controls/cooldown-exemptions", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ waId: "923001234567", confirmation: "923001234567" }) }), env(db));
    expect(add.status).toBe(201);
    expect(db.exemptions).toEqual(new Set(["923034901810", "923001234567"]));
    const remove = await app.fetch(new Request("https://admin.example.test/api/test-controls/cooldown-exemptions/923001234567", { method: "DELETE", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "923001234567" }) }), env(db));
    expect(remove.status).toBe(200);
    expect(db.exemptions).toEqual(new Set(["923034901810"]));
  });

  it("cancels or archives only receipt-free unpaid orders without deleting history", async () => {
    const db = new AdminMemoryDb();
    db.orders.set("eligible-cancel", { id: "eligible-cancel", orderNumber: "FS-261012-990010", state: "PAYMENT_PENDING", paymentStatus: "PENDING", receiptCount: 0, approved: false });
    db.orders.set("eligible-archive", { id: "eligible-archive", orderNumber: "FS-261012-990011", state: "PAYMENT_REJECTED", paymentStatus: "REJECTED", receiptCount: 0, approved: false });
    db.orders.set("paid", { id: "paid", orderNumber: "FS-261012-990012", state: "PAID", paymentStatus: "PAID", receiptCount: 1, approved: true });
    db.orders.set("receipt", { id: "receipt", orderNumber: "FS-261012-990013", state: "PAYMENT_REVIEW", paymentStatus: "PENDING", receiptCount: 1, approved: false });
    db.payments.set("eligible-cancel", { amount: 250 });
    const paymentHistory = JSON.stringify([...db.payments]);
    const session = await csrf(db);
    const act = (id: string, action: "cancel" | "archive", confirmation: string) => app.fetch(new Request(`https://admin.example.test/api/orders/${id}/${action}`, { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ reason: "Synthetic administrative reason", confirmation }) }), env(db));
    expect((await act("paid", "cancel", "FS-261012-990012")).status).toBe(409);
    expect((await act("paid", "archive", "FS-261012-990012")).status).toBe(409);
    expect((await act("receipt", "cancel", "FS-261012-990013")).status).toBe(409);
    expect((await act("receipt", "archive", "FS-261012-990013")).status).toBe(409);
    expect((await act("eligible-cancel", "cancel", "FS-261012-990010")).status).toBe(200);
    expect((await act("eligible-archive", "archive", "FS-261012-990011")).status).toBe(200);
    expect(db.orders.get("eligible-cancel")?.state).toBe("CANCELLED");
    expect(db.orders.get("eligible-archive")?.archivedAt).toBeTruthy();
    expect(JSON.stringify([...db.payments])).toBe(paymentHistory);
    expect(db.sql.some((sql) => /^DELETE FROM (orders|payments|payment_receipts)/.test(sql))).toBe(false);

    const legacyCancel = await app.fetch(new Request("https://admin.example.test/api/orders/paid/transition", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ from: "PAID", to: "CANCELLED" }) }), env(db));
    expect(legacyCancel.status).toBe(409);
    expect(await legacyCancel.json()).toEqual({ error: "USE_EXPLICIT_CANCELLATION" });
  });
});
