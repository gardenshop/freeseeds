import { Hono } from "hono";
import { canTransition, OrderState, approvedPurchaseValue, createPurchaseEvent, hasCompleteEnabledPaymentMethod, isPaymentMethodComplete, normalizePaymentMethodRow, paymentInstructions, PaymentMethod, storePaymentQr, validatePaymentAmount } from "@gfs/core";

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
  const configured = c.env.DB ? await c.env.DB.prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE enabled=1 AND recipient_name IS NOT NULL AND instructions IS NOT NULL AND EXISTS (SELECT 1 FROM payment_configuration WHERE id=1 AND advance_amount_pkr > 0)").first<{ count: number }>() : null;
  return c.json({ ok: true, service: "getfreeseeds-admin", state: c.env.DEPLOYMENT_STATE, paymentConfigured: Number(configured?.count ?? 0) > 0 });
});
app.get("/", (c) => c.html("<h1>Get Free Seeds Admin</h1><p>Payment review and fulfillment console.</p><nav><a href='/payment-settings'>Payment Settings</a> | <a href='/payment-amount'>Advance Amount</a> | Dashboard | Leads | Meta Instant Form | Orders | Payment Verification | Paid Orders | Packing | Dispatch | Delivered | Cancelled | Customers | Meta CAPI | WhatsApp Status | Audit Log | Configuration Summary</nav>"));

app.get("/payment-settings", (c) => c.html(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Settings | Get Free Seeds</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.card{border:1px solid #ccc;border-radius:8px;padding:1rem}.card h2{margin-top:0}.card label{display:block;margin:.6rem 0}.card input,.card textarea{box-sizing:border-box;width:100%;padding:.5rem}.status{font-size:.9rem;margin:.5rem 0}.configured{color:green}.incomplete{color:#a15c00}.error{color:#b00020}.qr{max-width:180px;max-height:180px;display:block;margin-top:.5rem}.actions{display:flex;gap:.5rem;align-items:center}button{padding:.5rem .8rem}</style></head><body><nav><a href='/'>Admin home</a></nav><h1>Garden Shop Payment Settings</h1><p>Values are backend-controlled. Disabled or incomplete methods cannot send payment instructions.</p><div id="methods" class="grid">Loading...</div><script>
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(m)=>m==='BANK_TRANSFER'?'Bank Transfer':m==='EASYPAISA'?'Easypaisa':'JazzCash';
async function load(){const r=await fetch('/api/payment-methods');const d=await r.json();document.querySelector('#methods').innerHTML=(d.paymentMethods||[]).map((m)=>{const complete=m.enabled&&m.recipientName&&m.instructions;const qr=m.qrR2Key?'<img class="qr" data-preview alt="Private QR preview">':'';return '<section class="card" data-method="'+m.method+'"><h2>'+label(m.method)+'</h2><div class="status '+(complete?'configured':'incomplete')+'">'+(complete?'Configured':'Incomplete or disabled')+'</div><label>Recipient name<input data-key="recipientName" value="'+esc(m.recipientName)+'"></label><label>TILL/TIL/account identifier<input data-key="tillId" value="'+esc(m.tillId)+'"></label><label>Instructions<textarea data-key="instructions">'+esc(m.instructions)+'</textarea></label><label>Reference instruction<input data-key="referenceInstruction" value="'+esc(m.referenceInstruction)+'"></label><label>Sort order<input data-key="sortOrder" type="number" value="'+(Number(m.sortOrder)||100)+'"></label><label><input data-key="enabled" type="checkbox" '+(m.enabled?'checked':'')+'> Enabled</label><div class="actions"><button data-save>Save</button><input data-qr type="file" accept="image/*"><button data-upload>Upload QR</button></div><div data-result class="status"></div>'+qr+'</section>'}).join('');for(const card of document.querySelectorAll('.card')){const method=card.dataset.method;const result=card.querySelector('[data-result]');card.querySelector('[data-save]').onclick=async()=>{const body={};for(const e of card.querySelectorAll('[data-key]'))body[e.dataset.key]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;const r=await fetch('/api/payment-methods/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});result.textContent=r.ok?'Saved':'Validation blocked';result.className='status '+(r.ok?'configured':'error');if(r.ok)await load()};card.querySelector('[data-upload]').onclick=async()=>{const file=card.querySelector('[data-qr]').files[0];if(!file){result.textContent='Choose an image first';return}const r=await fetch('/api/payment-methods/'+method+'/qr',{method:'POST',headers:{'Content-Type':file.type},body:file});result.textContent=r.ok?'QR uploaded privately':'QR upload failed';if(r.ok)await load()};const img=card.querySelector('[data-preview]');if(img){img.src='/api/payment-methods/'+method+'/qr'}}}
load().catch(()=>document.querySelector('#methods').textContent='Payment settings unavailable');</script></body></html>`));

app.get("/payment-amount", (c) => c.html(`<!doctype html><html><head><meta charset="utf-8"><title>Advance Amount | Get Free Seeds</title><style>body{font:16px system-ui;max-width:700px;margin:2rem auto;padding:0 1rem}label{display:block;margin:1rem 0}input{box-sizing:border-box;width:100%;padding:.6rem}button{padding:.6rem .9rem}.status{margin:1rem 0}.error{color:#b00020}.ok{color:green}</style></head><body><nav><a href='/'>Admin home</a> | <a href='/payment-settings'>Payment methods</a></nav><h1>Authoritative advance payment</h1><p>Set the positive PKR delivery/advance amount used for new payment requests. At least one complete enabled payment method is required.</p><label>Amount (PKR)<input id="amount" type="number" min="1" step="1" inputmode="numeric"></label><button id="save">Save amount</button><div id="status" class="status"></div><script>
const amount=document.querySelector('#amount');const status=document.querySelector('#status');
async function load(){const r=await fetch('/api/payment-configuration');const d=await r.json();amount.value=d.advanceAmountPkr??'';status.textContent=d.paymentMethodsConfigured?'':'Configure a complete enabled payment method before saving an amount.';status.className='status '+(d.paymentMethodsConfigured?'':'error')}
document.querySelector('#save').onclick=async()=>{const value=Number(amount.value);const r=await fetch('/api/payment-configuration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({advanceAmountPkr:value})});const d=await r.json();status.textContent=r.ok?'Saved':'Unable to save: '+(d.error||'validation failed');status.className='status '+(r.ok?'ok':'error');if(r.ok)await load()};load().catch(()=>status.textContent='Payment configuration unavailable');</script></body></html>`));

app.get("/api/leads", async (c) => {
  if (!c.env.DB) return c.json({ leads: [] });
  const source = c.req.query("source");
  const query = "SELECT l.id AS lead_id, l.status, l.capi_event_id, o.id AS order_id, o.order_number, o.state AS order_state, c.full_name, c.city, ls.source, ls.provider_lead_id, ls.meta_form_id, ls.provider_created_time, ls.campaign_id, ls.ad_set_id, ls.ad_id FROM leads l JOIN orders o ON o.id=l.order_id JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_sources ls ON ls.lead_id=l.id" + (source ? " WHERE ls.source=?" : "") + " ORDER BY l.created_at DESC";
  const result = source ? await c.env.DB.prepare(query).bind(source).all() : await c.env.DB.prepare(query).all();
  return c.json({ leads: result.results });
});

app.get("/api/payment-methods", async (c) => {
  if (!c.env.DB) return c.json({ paymentMethods: [] });
  const result = await c.env.DB.prepare("SELECT * FROM payment_methods ORDER BY sort_order, method").all();
  return c.json({ paymentMethods: result.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)) });
});

app.get("/api/payment-configuration", async (c) => {
  if (!c.env.DB) return c.json({ advanceAmountPkr: null, paymentMethodsConfigured: false });
  const [configuration, methods] = await Promise.all([
    c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>(),
    c.env.DB.prepare("SELECT * FROM payment_methods WHERE enabled=1 ORDER BY sort_order, method").all()
  ]);
  const configs = methods.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>));
  return c.json({ advanceAmountPkr: configuration?.advance_amount_pkr == null ? null : Number(configuration.advance_amount_pkr), paymentMethodsConfigured: hasCompleteEnabledPaymentMethod(configs) });
});

app.post("/api/payment-configuration", async (c) => {
  let amount: number;
  try {
    const body = await c.req.json<{ advanceAmountPkr?: unknown }>();
    amount = validatePaymentAmount(body.advanceAmountPkr);
  } catch (error) {
    return c.json({ error: error instanceof Error && error.message === "PAYMENT_AMOUNT_INVALID" ? error.message : "PAYMENT_AMOUNT_INVALID" }, 400);
  }
  if (!c.env.DB) return c.json({ ok: true, simulated: true, advanceAmountPkr: amount });
  const methods = await c.env.DB.prepare("SELECT * FROM payment_methods WHERE enabled=1").all();
  const configs = methods.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>));
  if (!hasCompleteEnabledPaymentMethod(configs)) return c.json({ error: "PAYMENT_METHOD_NOT_CONFIGURED" }, 400);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO payment_configuration (id,advance_amount_pkr,updated_at,updated_by) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET advance_amount_pkr=excluded.advance_amount_pkr,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(amount, now, c.env.ADMIN_EMAIL),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_CONFIGURATION_UPDATED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_CONFIGURATION", "1", crypto.randomUUID(), JSON.stringify({ advanceAmountPkr: amount }), now)
  ]);
  return c.json({ ok: true, advanceAmountPkr: amount });
});

app.get("/api/configuration", async (c) => {
  const methods = c.env.DB ? (await c.env.DB.prepare("SELECT * FROM payment_methods ORDER BY sort_order, method").all()).results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)) : [];
  const amount = c.env.DB ? await c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>() : null;
  const advanceAmountPkr = amount?.advance_amount_pkr == null ? null : Number(amount.advance_amount_pkr);
  return c.json({ advanceAmountPkr, paymentMethods: methods.map((method) => { const instructions = paymentInstructions(method); return advanceAmountPkr && advanceAmountPkr > 0 ? instructions : { ...instructions, configured: false }; }), whatsappState: c.env.DEPLOYMENT_STATE, metaProviderEnabled: false });
});

app.post("/api/payment-methods/:method", async (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  const body = await c.req.json<{ recipientName?: string; tillId?: string; instructions?: string; referenceInstruction?: string; enabled?: boolean; sortOrder?: number }>();
  const candidate = { id: `payment-method-${method.toLowerCase()}`, method, displayName: method === "BANK_TRANSFER" ? "Bank Transfer" : method === "EASYPAISA" ? "Easypaisa" : "JazzCash", recipientName: body.recipientName?.trim(), tillId: body.tillId?.trim(), instructions: body.instructions?.trim(), referenceInstruction: body.referenceInstruction?.trim(), enabled: body.enabled === true, sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 100 };
  if (candidate.enabled && !isPaymentMethodComplete(candidate)) return c.json({ error: "PAYMENT_METHOD_INCOMPLETE" }, 400);
  if (!c.env.DB) return c.json({ ok: true, simulated: true, configured: isPaymentMethodComplete(candidate) });
  const [configuration, existingMethods] = await Promise.all([
    c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>(),
    c.env.DB.prepare("SELECT * FROM payment_methods").all()
  ]);
  if (configuration?.advance_amount_pkr != null) {
    const configs = existingMethods.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)).filter((config) => config.method !== method);
    configs.push(candidate);
    if (!hasCompleteEnabledPaymentMethod(configs)) return c.json({ error: "PAYMENT_METHOD_REQUIRED" }, 400);
  }
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
    let queued = false;
    try {
      if (c.env.EVENTS) {
        await c.env.EVENTS.send({ kind: "CAPI_PURCHASE", idempotencyKey: event.eventId, entityId: body.orderId, schemaVersion: 1 });
        queued = true;
      }
    } catch {
      // The durable outbox remains authoritative when Queue delivery is temporarily unavailable.
    }
    return c.json({ ok: true, eventId: event.eventId, capiQueue: queued ? "QUEUED" : "DEFERRED" });
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
  if (!row) return c.json({ error: "PAYMENT_METHOD_NOT_FOUND" }, 404);
  const amount = await c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>();
  if (amount?.advance_amount_pkr == null || Number(amount.advance_amount_pkr) <= 0) return c.json({ error: "PAYMENT_AMOUNT_NOT_CONFIGURED" }, 503);
  return c.json(paymentInstructions(normalizePaymentMethodRow(row as Record<string, unknown>)));
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
export default app;
