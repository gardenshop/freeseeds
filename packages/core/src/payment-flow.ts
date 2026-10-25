import { formatPaymentMessage, isPaymentMethodComplete, normalizePaymentMethodRow, PaymentMethodConfig, requirePaymentAmount } from "./payments";
import { PaymentMethod } from "./domain";

export async function selectPaymentMethod(db: D1Database, orderId: string, method: PaymentMethod, locale: "en" | "ur" = "en", recipient?: string, requestId?: string, allowV2Retry = false): Promise<{ orderNumber: string; amount: number; config: PaymentMethodConfig; message: string; idempotencyKey: string; orderState:"PAYMENT_PENDING"|"PAYMENT_GRACE" }> {
  const v2Phase = allowV2Retry ? ",(SELECT phase FROM payment_reminder_v2_schedules s WHERE s.order_id=o.id AND s.status IN ('ACTIVE','PAUSED') ORDER BY cycle DESC LIMIT 1) AS payment_v2_phase" : "";
  const row = await db.prepare(`SELECT o.order_number,o.total_payable,o.state${v2Phase},p.id AS payment_id,pm.* FROM orders o JOIN payments p ON p.order_id=o.id JOIN payment_methods pm ON pm.method=? AND pm.enabled=1 AND pm.qr_owner_verified=1 JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE o.id=?`).bind(method, orderId).first<Record<string, unknown>>();
  if (!row) throw new Error("PAYMENT_METHOD_NOT_ELIGIBLE");
  const config = normalizePaymentMethodRow(row);
  if (!isPaymentMethodComplete(config)) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
  if (row.state !== "DETAILS_COMPLETED" && row.state !== "PAYMENT_PENDING" && !(allowV2Retry && (row.state === "PAYMENT_GRACE" || row.state === "PAYMENT_REJECTED"))) throw new Error("ORDER_NOT_ACCEPTING_PAYMENT_METHOD");
  const nextOrderState: "PAYMENT_PENDING" | "PAYMENT_GRACE" = row.state === "PAYMENT_GRACE" || (row.state === "PAYMENT_REJECTED" && row.payment_v2_phase === "PAYMENT_GRACE") ? "PAYMENT_GRACE" : "PAYMENT_PENDING";
  const orderNumber = String(row.order_number);
  const persistedAmount = Number(row.total_payable);
  const amount = requirePaymentAmount(persistedAmount);
  const now = new Date().toISOString();
  const requestDigest = requestId ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestId)))].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24) : "";
  const idempotencyKey = `payment_instructions_${orderId}_${method}_${locale}${requestDigest ? `_${requestDigest}` : ""}`;
  const statements = [
    db.prepare("UPDATE payments SET method=?, expected_amount=?, review_state='PENDING', updated_at=? WHERE order_id=? AND review_state IN ('PENDING','REJECTED') AND EXISTS(SELECT 1 FROM orders WHERE id=? AND state IN ('DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_GRACE','PAYMENT_REJECTED'))").bind(method, amount, now, orderId, orderId),
    db.prepare("UPDATE orders SET state=?, payment_status='PENDING', updated_at=? WHERE id=? AND state IN ('DETAILS_COMPLETED','PAYMENT_REJECTED')").bind(nextOrderState, now, orderId),
    ...(recipient?.trim() ? [db.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), idempotencyKey, "WHATSAPP_PAYMENT_INSTRUCTIONS", orderId, JSON.stringify({ orderId, orderNumber, amount, method, locale, recipient: recipient.trim(), requestKey: idempotencyKey, qrR2Key: config.qrR2Key, message: formatPaymentMessage(orderNumber, amount, config, locale) }), "PENDING", now, now, now)] : []),
    db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_METHOD_SELECTED", "CUSTOMER", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ method, orderNumber }), now)
  ];
  await db.batch(statements);
  return { orderNumber, amount, config, message: formatPaymentMessage(orderNumber, amount, config, locale), idempotencyKey,orderState:nextOrderState };
}
