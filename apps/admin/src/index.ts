import { Hono } from "hono";
import { canTransition, OrderState, approvedPurchaseValue, createPurchaseEvent, paymentInstructions, PaymentMethod } from "@gfs/core";

type Env = { Bindings: { DB: D1Database; RECEIPTS: R2Bucket; DEPLOYMENT_STATE: string; ADMIN_EMAIL: string; PAYMENT_CONFIGURED: string } };
const app = new Hono<Env>();

function authorized(c: { req: { header(name: string): string | undefined }; env: Env["Bindings"] }): boolean {
  return c.req.header("cf-access-authenticated-user-email") === c.env.ADMIN_EMAIL;
}

app.use("*", async (c, next) => {
  if (!authorized(c)) return c.json({ error: "ADMIN_ACCESS_REQUIRED" }, 403);
  await next();
});

app.get("/health", (c) => c.json({ ok: true, service: "getfreeseeds-admin", state: c.env.DEPLOYMENT_STATE, paymentConfigured: c.env.PAYMENT_CONFIGURED === "true" }));
app.get("/", (c) => c.html("<h1>Get Free Seeds Admin</h1><p>Payment review and fulfillment console.</p><nav>Dashboard | Leads | Orders | Payment Verification | Paid Orders | Packing | Dispatch | Delivered | Cancelled | Customers | Meta CAPI | WhatsApp Status | Audit Log | Configuration Summary</nav>"));

app.post("/api/orders/:id/transition", async (c) => {
  const body = await c.req.json<{ from: OrderState; to: OrderState }>();
  if (!canTransition(body.from, body.to)) return c.json({ error: "INVALID_STATE_TRANSITION" }, 409);
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const result = await c.env.DB.prepare("UPDATE orders SET state = ?, updated_at = ? WHERE id = ? AND state = ?").bind(body.to, new Date().toISOString(), c.req.param("id"), body.from).run();
  return result.meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: "STATE_CONFLICT" }, 409);
});

app.post("/api/payments/:id/approve", async (c) => {
  const body = await c.req.json<{ orderId: string; orderNumber: string; expectedAmount: number; approvedAmount: number; customerId: string }>();
  try {
    const amount = approvedPurchaseValue(body.expectedAmount, body.approvedAmount);
    const event = createPurchaseEvent(body.orderNumber, amount);
    if (!c.env.DB) return c.json({ ok: true, simulated: true, event });
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE payments SET review_state='APPROVED', approved_amount=?, approved_by=?, approved_at=?, updated_at=? WHERE id=? AND review_state='REVIEW'").bind(amount, c.env.ADMIN_EMAIL, now, now, c.req.param("id")),
      c.env.DB.prepare("UPDATE orders SET state='PAID', payment_status='PAID', updated_at=? WHERE id=? AND state='PAYMENT_REVIEW'").bind(now, body.orderId),
      c.env.DB.prepare("INSERT OR IGNORE INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), event.eventId, event.eventName, body.orderId, body.customerId, "PENDING", now, now),
      c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), event.eventId, "CAPI_PURCHASE", body.orderId, JSON.stringify(event), "PENDING", now, now, now)
    ]);
    return c.json({ ok: true, eventId: event.eventId });
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : "APPROVAL_FAILED" }, 400); }
});

app.get("/api/payment-instructions/:method", (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  return c.json(paymentInstructions(method, {}));
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
export default app;
