import { formatPaymentMessage, isPaymentMethodComplete, normalizePaymentMethodRow, PaymentMethodConfig, requirePaymentAmount } from "./payments";
import { PaymentMethod } from "./domain";

export async function selectPaymentMethod(db: D1Database, orderId: string, method: PaymentMethod, locale: "en" | "ur" = "en", recipient?: string, requestId?: string): Promise<{ orderNumber: string; amount: number; config: PaymentMethodConfig; message: string; idempotencyKey: string }> {
  const row = await db.prepare("SELECT o.order_number,o.total_payable,o.state,p.id AS payment_id,p.method AS selected_method,(SELECT COUNT(*) FROM audit_log a WHERE a.entity_type='ORDER' AND a.entity_id=o.id AND a.action='PAYMENT_METHOD_SELECTED') AS selection_count,pm.* FROM orders o JOIN payments p ON p.order_id=o.id JOIN payment_methods pm ON pm.method=? AND pm.enabled=1 AND pm.qr_owner_verified=1 JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE o.id=?").bind(method, orderId).first<Record<string, unknown>>();
  if (!row) throw new Error("PAYMENT_METHOD_NOT_ELIGIBLE");
  if (row.state !== "DETAILS_COMPLETED" && row.state !== "PAYMENT_PENDING") throw new Error("ORDER_NOT_ACCEPTING_ADVANCE_PAYMENT");
  const config = normalizePaymentMethodRow(row);
  if (!isPaymentMethodComplete(config)) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
  if (row.state !== "DETAILS_COMPLETED" && row.state !== "PAYMENT_PENDING") throw new Error("ORDER_NOT_ACCEPTING_PAYMENT_METHOD");
  const orderNumber = String(row.order_number);
  const persistedAmount = Number(row.total_payable);
  const amount = requirePaymentAmount(persistedAmount);
  const now = new Date().toISOString();
  const requestDigest = requestId ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestId)))].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24) : "";
  const idempotencyKey = `payment_instructions_${orderId}_${method}_${locale}${requestDigest ? `_${requestDigest}` : ""}`;
  const auditId = crypto.randomUUID();
  const statements = [
    // The selection audit count is a CAS version even when two requests select the same method in the same millisecond.
    db.prepare(`UPDATE payments SET method=?,expected_amount=?,review_state='PENDING',updated_at=?
      WHERE id=? AND method IS ? AND review_state IN ('PENDING','REJECTED')
      AND approved_amount IS NULL AND approved_by IS NULL AND approved_at IS NULL AND submitted_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=payments.order_id)
      AND EXISTS(SELECT 1 FROM orders o WHERE o.id=payments.order_id AND o.state=? AND o.payment_status='PENDING' AND o.total_payable=?)
      AND (SELECT COUNT(*) FROM audit_log a WHERE a.entity_type='ORDER' AND a.entity_id=payments.order_id AND a.action='PAYMENT_METHOD_SELECTED')=?`).bind(method, amount, now, row.payment_id, row.selected_method ?? null, row.state, amount, Number(row.selection_count ?? 0)),
    db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1").bind(auditId, "PAYMENT_METHOD_SELECTED", "CUSTOMER", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ method, orderNumber }), now),
    db.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM audit_log WHERE id=?)").bind(now, orderId, auditId),
    ...(recipient?.trim() ? [db.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_log WHERE id=?)").bind(crypto.randomUUID(), idempotencyKey, "WHATSAPP_PAYMENT_INSTRUCTIONS", orderId, JSON.stringify({ orderId, orderNumber, amount, method, locale, recipient: recipient.trim(), requestKey: idempotencyKey, qrR2Key: config.qrR2Key, message: formatPaymentMessage(orderNumber, amount, config, locale) }), "PENDING", now, now, now, auditId)] : [])
  ];
  const results = await db.batch(statements);
  if (Number(results[0].meta?.changes ?? 0) !== 1) throw new Error("PAYMENT_SELECTION_CONFLICT");
  return { orderNumber, amount, config, message: formatPaymentMessage(orderNumber, amount, config, locale), idempotencyKey };
}
