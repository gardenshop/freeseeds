import { Hono } from "hono";
import { canTransition, OrderState, approvedPurchaseValue, createPurchaseEvent, isPaymentMethodComplete, normalizePaymentMethodRow, paymentInstructions, PaymentMethod, storePaymentQr } from "@gfs/core";

type Env = { Bindings: { DB: D1Database; RECEIPTS: R2Bucket; EVENTS?: Queue; DEPLOYMENT_STATE: string; ADMIN_EMAIL: string } };
const app = new Hono<Env>();

function authorized(c: { req: { header(name: string): string | undefined }; env: Env["Bindings"] }): boolean {
  return c.req.header("cf-access-authenticated-user-email") === c.env.ADMIN_EMAIL;
}

app.use("*", async (c, next) => {
  if (!authorized(c)) return c.json({ error: "ADMIN_ACCESS_REQUIRED" }, 403);
  await next();
});

app.get("/health", async (c) => {
  const configured = c.env.DB ? await c.env.DB.prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE enabled=1 AND recipient_name IS NOT NULL AND instructions IS NOT NULL").first<{ count: number }>() : null;
  return c.json({ ok: true, service: "getfreeseeds-admin", state: c.env.DEPLOYMENT_STATE, paymentConfigured: Number(configured?.count ?? 0) > 0 });
});
app.get("/", (c) => c.html("<h1>Get Free Seeds Admin</h1><p>Payment review and fulfillment console.</p><nav>Dashboard | Leads | Orders | Payment Verification | Paid Orders | Packing | Dispatch | Delivered | Cancelled | Customers | Meta CAPI | WhatsApp Status | Audit Log | Configuration Summary</nav>"));

app.get("/api/payment-methods", async (c) => {
  if (!c.env.DB) return c.json({ paymentMethods: [] });
  const result = await c.env.DB.prepare("SELECT * FROM payment_methods ORDER BY sort_order, method").all();
  return c.json({ paymentMethods: result.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)) });
});

app.get("/api/configuration", async (c) => {
  const methods = c.env.DB ? (await c.env.DB.prepare("SELECT * FROM payment_methods ORDER BY sort_order, method").all()).results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)) : [];
  return c.json({ paymentMethods: methods.map((method) => paymentInstructions(method)), whatsappState: c.env.DEPLOYMENT_STATE, metaProviderEnabled: false });
});

app.post("/api/payment-methods/:method", async (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  const body = await c.req.json<{ recipientName?: string; tillId?: string; instructions?: string; referenceInstruction?: string; enabled?: boolean; sortOrder?: number }>();
  const candidate = { id: `payment-method-${method.toLowerCase()}`, method, displayName: method === "BANK_TRANSFER" ? "Bank Transfer" : method === "EASYPAISA" ? "Easypaisa" : "JazzCash", recipientName: body.recipientName?.trim(), tillId: body.tillId?.trim(), instructions: body.instructions?.trim(), referenceInstruction: body.referenceInstruction?.trim(), enabled: body.enabled === true, sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 100 };
  if (candidate.enabled && !isPaymentMethodComplete(candidate)) return c.json({ error: "PAYMENT_METHOD_INCOMPLETE" }, 400);
  if (!c.env.DB) return c.json({ ok: true, simulated: true, configured: isPaymentMethodComplete(candidate) });
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO payment_methods (id,method,display_name,recipient_name,till_id,instructions,reference_instruction,enabled,sort_order,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(method) DO UPDATE SET recipient_name=excluded.recipient_name,till_id=excluded.till_id,instructions=excluded.instructions,reference_instruction=excluded.reference_instruction,enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(candidate.id, candidate.method, candidate.displayName, candidate.recipientName ?? null, candidate.tillId ?? null, candidate.instructions ?? null, candidate.referenceInstruction ?? null, candidate.enabled ? 1 : 0, candidate.sortOrder, now, c.env.ADMIN_EMAIL),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_METHOD_UPDATED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, enabled: candidate.enabled, sortOrder: candidate.sortOrder }), now)
  ]);
  return c.json({ ok: true, configured: isPaymentMethodComplete(candidate) });
});

app.post("/api/payment-methods/:method/qr", async (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const mimeType = c.req.header("content-type")?.split(";", 1)[0] ?? "";
  const body = await c.req.arrayBuffer();
  try {
    const stored = await storePaymentQr(c.env.RECEIPTS, method, body, mimeType);
    const current = await c.env.DB.prepare("SELECT qr_r2_key FROM payment_methods WHERE method=?").bind(method).first<{ qr_r2_key?: string }>();
    const now = new Date().toISOString();
    try {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE payment_methods SET qr_r2_key=?, qr_sha256=?, qr_mime_type=?, qr_size_bytes=?, updated_at=?, updated_by=? WHERE method=?").bind(stored.objectKey, stored.sha256, mimeType, stored.sizeBytes, now, c.env.ADMIN_EMAIL, method),
        c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_QR_REPLACED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, sha256: stored.sha256, sizeBytes: stored.sizeBytes }), now)
      ]);
    } catch (error) {
      await c.env.RECEIPTS.delete(stored.objectKey);
      throw error;
    }
    if (current?.qr_r2_key && current.qr_r2_key !== stored.objectKey) await c.env.RECEIPTS.delete(current.qr_r2_key);
    return c.json({ ok: true, method, qrR2Key: stored.objectKey, sha256: stored.sha256, sizeBytes: stored.sizeBytes });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "PAYMENT_QR_UPLOAD_FAILED" }, 400);
  }
});

app.get("/api/payment-methods/:method/qr", async (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const row = await c.env.DB.prepare("SELECT qr_r2_key, qr_mime_type FROM payment_methods WHERE method=?").bind(method).first<{ qr_r2_key?: string; qr_mime_type?: string }>();
  if (!row?.qr_r2_key) return c.json({ error: "PAYMENT_QR_NOT_CONFIGURED" }, 404);
  const object = await c.env.RECEIPTS.get(row.qr_r2_key);
  if (!object) return c.json({ error: "PAYMENT_QR_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": row.qr_mime_type ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

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
    if (!c.env.DB) return c.json({ ok: true, simulated: true, event: createPurchaseEvent(body.orderNumber, amount) });
    const current = await c.env.DB.prepare("SELECT p.review_state, o.state, ma.ctwa_clid FROM payments p JOIN orders o ON o.id = p.order_id LEFT JOIN meta_attribution ma ON ma.order_id = o.id WHERE p.id = ? AND o.id = ?").bind(c.req.param("id"), body.orderId).first<{ review_state: string; state: OrderState; ctwa_clid?: string }>();
    if (!current) return c.json({ error: "PAYMENT_NOT_FOUND" }, 404);
    const event = createPurchaseEvent(body.orderNumber, amount, current.ctwa_clid ? { ctwaClid: current.ctwa_clid } : undefined);
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
    if (c.env.EVENTS) await c.env.EVENTS.send({ kind: "CAPI_PURCHASE", idempotencyKey: event.eventId, entityId: body.orderId, schemaVersion: 1 });
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

app.get("/api/payment-instructions/:method", async (c) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_METHOD_NOT_CONFIGURED" }, 503);
  const row = await c.env.DB.prepare("SELECT * FROM payment_methods WHERE method=?").bind(c.req.param("method").toUpperCase()).first();
  return row ? c.json(paymentInstructions(normalizePaymentMethodRow(row as Record<string, unknown>))) : c.json({ error: "PAYMENT_METHOD_NOT_FOUND" }, 404);
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
export default app;
