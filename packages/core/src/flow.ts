import { createLeadEvent } from "./capi";
import { FlowSubmission, normalizeContactNumber } from "./domain";

export function parseFlowSubmission(input: unknown): FlowSubmission {
  const parsed = FlowSubmission.parse(input);
  return { ...parsed, contactNumber: normalizeContactNumber(parsed.contactNumber) };
}

export async function persistFlowSubmission(db: D1Database, submission: FlowSubmission, attribution?: { ctwaClid?: string; campaignId?: string; adSetId?: string; adId?: string }): Promise<{ customerId: string; leadId: string; orderId: string; orderNumber: string }> {
  const now = new Date().toISOString();
  const customerId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const attributionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const addressHash = await digestText(`${submission.deliveryAddress.trim().toLowerCase()}|${submission.city.trim().toLowerCase()}`);
  const orderNumber = await allocateOrderNumber(db, "FREE_SEEDS");
  const leadEvent = createLeadEvent(orderNumber, attribution);
  const leadEventId = leadEvent.eventId;
  const outboxId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO customers (id,wa_id,full_name,delivery_address,nearby_place,city,contact_number,normalized_phone,normalized_address_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(customerId, null, submission.fullName, submission.deliveryAddress, submission.nearbyPlace, submission.city, submission.contactNumber, submission.contactNumber, addressHash, now, now),
    db.prepare("INSERT INTO orders (id,order_number,customer_id,offer_code,pack_quantity,seed_price,delivery_fee,total_payable,state,payment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId, orderNumber, customerId, "GET_FREE_SEEDS_5_PACKS", 5, 0, 0, 0, "DETAILS_COMPLETED", "PENDING", now, now),
    db.prepare("INSERT INTO payments (id,order_id,expected_amount,review_state,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(paymentId, orderId, 0, "PENDING", now, now),
    db.prepare("INSERT INTO leads (id,customer_id,order_id,status,capi_event_id,created_at) VALUES (?,?,?,?,?,?)").bind(leadId, customerId, orderId, "CREATED", leadEventId, now),
    db.prepare("INSERT INTO meta_attribution (id,order_id,customer_id,ctwa_clid,campaign_id,ad_set_id,ad_id,minimized_referral_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attributionId, orderId, customerId, attribution?.ctwaClid ?? null, attribution?.campaignId ?? null, attribution?.adSetId ?? null, attribution?.adId ?? null, attribution ? JSON.stringify(attribution) : null, now),
    db.prepare("INSERT INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), leadEventId, "Lead", orderId, customerId, "PENDING", now, now),
    db.prepare("INSERT INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(outboxId, leadEventId, "CAPI_LEAD", orderId, JSON.stringify(leadEvent), "PENDING", now, now, now),
    db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "FLOW_SUBMITTED", "CUSTOMER", "ORDER", orderId, correlationId, JSON.stringify({ orderNumber }), now)
  ]);
  return { customerId, leadId, orderId, orderNumber };
}

async function allocateOrderNumber(db: D1Database, namespace: string): Promise<string> {
  const result = await db.batch([
    db.prepare("UPDATE order_counters SET next_value = next_value + 1 WHERE namespace = ?").bind(namespace),
    db.prepare("SELECT next_value - 1 AS allocated FROM order_counters WHERE namespace = ?").bind(namespace)
  ]);
  const allocated = Number((result[1].results[0] as { allocated: number } | undefined)?.allocated);
  if (!Number.isInteger(allocated)) throw new Error("ORDER_NUMBER_ALLOCATION_FAILED");
  return `FS-${String(allocated).padStart(6, "0")}`;
}

async function digestText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
