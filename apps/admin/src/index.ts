import { Hono } from "hono";
import { canTransition, OrderState, approvedPurchaseValue, createPurchaseEvent, paymentInstructions, PaymentMethod } from "@gfs/core";

type Env = { Bindings: { DB: D1Database; RECEIPTS: R2Bucket; DEPLOYMENT_STATE: string; ADMIN_EMAIL: string; PAYMENT_CONFIGURED: string; PAYMENT_JAZZCASH?: string; PAYMENT_EASYPAISA?: string; PAYMENT_BANK_TRANSFER?: string } };
const app = new Hono<Env>();

function authorized(c: { req: { header(name: string): string | undefined }; env: Env["Bindings"] }): boolean {
  return c.req.header("cf-access-authenticated-user-email") === c.env.ADMIN_EMAIL;
}

function paymentConfig(env: Env["Bindings"]): Record<string, string | undefined> {
  return { PAYMENT_JAZZCASH: env.PAYMENT_JAZZCASH, PAYMENT_EASYPAISA: env.PAYMENT_EASYPAISA, PAYMENT_BANK_TRANSFER: env.PAYMENT_BANK_TRANSFER };
}

app.use("*", async (c, next) => {
  if (!authorized(c)) return c.json({ error: "ADMIN_ACCESS_REQUIRED" }, 403);
  await next();
});

app.get("/health", (c) => c.json({ ok: true, service: "getfreeseeds-admin", state: c.env.DEPLOYMENT_STATE, paymentConfigured: c.env.PAYMENT_CONFIGURED === "true" }));
app.get("/", (c) => c.html("<h1>Get Free Seeds Admin</h1><p>Payment review and fulfillment console.</p><nav>Dashboard | Leads | Orders | Payment Verification | Paid Orders | Packing | Dispatch | Delivered | Cancelled | Customers | Meta CAPI | WhatsApp Status | Audit Log | Configuration Summary</nav>"));

app.get("/api/configuration", (c) => c.json({ paymentMethods: Object.fromEntries(PaymentMethod.options.map((method) => [method, paymentInstructions(method, paymentConfig(c.env))])), whatsappState: c.env.DEPLOYMENT_STATE, metaProviderEnabled: false }));

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
    const current = await c.env.DB.prepare("SELECT p.review_state, o.state FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ? AND o.id = ?").bind(c.req.param("id"), body.orderId).first<{ review_state: string; state: OrderState }>();
    if (!current) return c.json({ error: "PAYMENT_NOT_FOUND" }, 404);
    if (current.review_state === "APPROVED" && current.state === "PAID") return c.json({ ok: true, alreadyApproved: true, eventId: event.eventId });
    if (current.review_state !== "REVIEW" || current.state !== "PAYMENT_REVIEW") return c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE payments SET review_state='APPROVED', approved_amount=?, approved_by=?, approved_at=?, updated_at=? WHERE id=? AND review_state='REVIEW'").bind(amount, c.env.ADMIN_EMAIL, now, now, c.req.param("id")),
      c.env.DB.prepare("UPDATE orders SET state='PAID', payment_status='PAID', updated_at=? WHERE id=? AND state='PAYMENT_REVIEW' AND EXISTS (SELECT 1 FROM payments WHERE id=? AND review_state='APPROVED')").bind(now, body.orderId, c.req.param("id")),
      c.env.DB.prepare("INSERT OR IGNORE INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND o.state='PAID' AND p.id=? AND p.review_state='APPROVED'").bind(crypto.randomUUID(), event.eventId, event.eventName, body.orderId, body.customerId, "PENDING", now, now, body.orderId, c.req.param("id")),
      c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND o.state='PAID' AND p.id=? AND p.review_state='APPROVED'").bind(crypto.randomUUID(), event.eventId, "CAPI_PURCHASE", body.orderId, JSON.stringify(event), "PENDING", now, now, now, body.orderId, c.req.param("id")),
      c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders WHERE id=? AND state='PAID'").bind(crypto.randomUUID(), "PAYMENT_APPROVED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ orderNumber: body.orderNumber, eventId: event.eventId }), now, body.orderId)
    ]);
    return c.json({ ok: true, eventId: event.eventId });
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : "APPROVAL_FAILED" }, 400); }
});

app.post("/api/payments/:id/reject", async (c) => {
  const body = await c.req.json<{ orderId: string; reason: string }>();
  if (!body.reason?.trim()) return c.json({ error: "REJECTION_REASON_REQUIRED" }, 400);
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE payments SET review_state='REJECTED', rejection_reason=?, approved_by=?, updated_at=? WHERE id=? AND review_state='REVIEW'").bind(body.reason.trim().slice(0, 500), c.env.ADMIN_EMAIL, now, c.req.param("id")),
    c.env.DB.prepare("UPDATE orders SET state='PAYMENT_REJECTED', payment_status='REJECTED', updated_at=? WHERE id=? AND state='PAYMENT_REVIEW' AND EXISTS (SELECT 1 FROM payments WHERE id=? AND review_state='REJECTED')").bind(now, body.orderId, c.req.param("id")),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders WHERE id=? AND state='PAYMENT_REJECTED'").bind(crypto.randomUUID(), "PAYMENT_REJECTED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ reason: body.reason.trim().slice(0, 500) }), now, body.orderId)
  ]);
  return result[1].meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
});

app.post("/api/payments/:id/request-clearer-receipt", async (c) => {
  const body = await c.req.json<{ orderId: string }>();
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `clearer_receipt_${c.req.param("id")}`, "WHATSAPP_CLEARER_RECEIPT", body.orderId, JSON.stringify({ paymentId: c.req.param("id"), orderId: body.orderId }), "PENDING", now, now, now),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "REQUEST_CLEARER_RECEIPT", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ orderId: body.orderId }), now)
  ]);
  return c.json({ ok: true });
});

app.get("/api/receipts/:key{.+}", async (c) => {
  const object = await c.env.RECEIPTS.get(c.req.param("key"));
  if (!object) return c.json({ error: "RECEIPT_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

app.get("/api/payment-instructions/:method", (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  return c.json(paymentInstructions(method, paymentConfig(c.env)));
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
export default app;
