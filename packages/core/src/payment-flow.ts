import { formatPaymentMessage, isPaymentMethodComplete, normalizePaymentMethodRow, PaymentMethodConfig } from "./payments";
import { PaymentMethod } from "./domain";

export async function selectPaymentMethod(db: D1Database, orderId: string, method: PaymentMethod): Promise<{ orderNumber: string; amount: number; config: PaymentMethodConfig; message: string }> {
  const row = await db.prepare("SELECT o.order_number, o.total_payable, o.state, p.id AS payment_id, pm.* FROM orders o JOIN payments p ON p.order_id=o.id JOIN payment_methods pm ON pm.method=? WHERE o.id=?").bind(method, orderId).first<Record<string, unknown>>();
  if (!row) throw new Error("ORDER_OR_PAYMENT_METHOD_NOT_FOUND");
  const config = normalizePaymentMethodRow(row);
  if (!isPaymentMethodComplete(config)) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
  if (row.state !== "DETAILS_COMPLETED" && row.state !== "PAYMENT_PENDING") throw new Error("ORDER_NOT_ACCEPTING_PAYMENT_METHOD");
  const orderNumber = String(row.order_number);
  const amount = Number(row.total_payable);
  const now = new Date().toISOString();
  const idempotencyKey = `payment_instructions_${orderId}_${method}`;
  await db.batch([
    db.prepare("UPDATE payments SET method=?, expected_amount=?, review_state='PENDING', updated_at=? WHERE order_id=? AND review_state IN ('PENDING','REJECTED')").bind(method, amount, now, orderId),
    db.prepare("UPDATE orders SET state='PAYMENT_PENDING', payment_status='PENDING', updated_at=? WHERE id=? AND state='DETAILS_COMPLETED'").bind(now, orderId),
    db.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), idempotencyKey, "WHATSAPP_PAYMENT_INSTRUCTIONS", orderId, JSON.stringify({ orderId, orderNumber, amount, method, qrR2Key: config.qrR2Key, message: formatPaymentMessage(orderNumber, amount, config) }), "PENDING", now, now, now),
    db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_METHOD_SELECTED", "CUSTOMER", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ method, orderNumber }), now)
  ]);
  return { orderNumber, amount, config, message: formatPaymentMessage(orderNumber, amount, config) };
}
