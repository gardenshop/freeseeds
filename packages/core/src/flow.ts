import { createLeadEvent } from "./capi";
import { FlowSubmission, InstantFormSubmission, LeadSource, normalizeContactNumber } from "./domain";
import { requirePaymentAmount } from "./payments";

export function parseFlowSubmission(input: unknown): FlowSubmission {
  const parsed = FlowSubmission.parse(input);
  return { ...parsed, contactNumber: normalizeContactNumber(parsed.contactNumber) };
}

export function parseInstantFormSubmission(input: unknown): InstantFormSubmission {
  const parsed = InstantFormSubmission.parse(input);
  return { ...parsed, contactNumber: normalizeContactNumber(parsed.contactNumber) };
}

export function parseMetaInstantFormLead(input: unknown): InstantFormSubmission {
  const value = input as { id?: unknown; form_id?: unknown; page_id?: unknown; created_time?: unknown; campaign_id?: unknown; adset_id?: unknown; adgroup_id?: unknown; ad_id?: unknown; field_data?: unknown };
  const fields = new Map<string, string>();
  for (const item of Array.isArray(value.field_data) ? value.field_data : []) {
    if (!item || typeof item !== "object") continue;
    const field = item as { name?: unknown; values?: unknown };
    const name = typeof field.name === "string" ? field.name.replace(/[^a-z0-9]/gi, "").toLowerCase() : "";
    const firstValue = Array.isArray(field.values) && typeof field.values[0] === "string" ? field.values[0] : undefined;
    if (name && firstValue) fields.set(name, firstValue);
  }
  const exact = (names: string[]) => {
    for (const item of Array.isArray(value.field_data) ? value.field_data : []) {
      if (!item || typeof item !== "object") continue;
      const field = item as { name?: unknown; values?: unknown };
      if (typeof field.name === "string" && names.includes(field.name) && Array.isArray(field.values) && typeof field.values[0] === "string") return field.values[0];
    }
    return undefined;
  };
  const required = (keys: string[]) => keys.map((key) => fields.get(key)).find(Boolean);
  const contactNumber = exact(["اپنا درست موبایل نمبر مہیا کریں۔", "اپنا درست موبایل نمبر مہیا کریں۔"]) ?? required(["contactnumber"]);
  const whatsappNumber = required(["phonenumber", "whatsappnumber"]);
  return parseInstantFormSubmission({
    leadId: value.id,
    formId: value.form_id,
    pageId: value.page_id,
    createdTime: value.created_time,
    fullName: required(["fullname", "fullnamequestion"]),
    deliveryAddress: required(["completedeliveryaddress", "deliveryaddress"]),
    nearbyPlace: required(["nearbyfamousplace", "nearbyplace"]),
    city: required(["city"]),
    contactNumber,
    whatsappNumber,
    campaignId: value.campaign_id,
    adSetId: value.adset_id ?? value.adgroup_id,
    adId: value.ad_id
  });
}

export function isAllowedInstantFormLead(input: { page_id?: unknown; form_id?: unknown }, pageId: string, formId: string): boolean {
  return input.page_id === pageId && input.form_id === formId;
}

type Attribution = { ctwaClid?: string; campaignId?: string; adSetId?: string; adId?: string };
type PersistOptions = { source: LeadSource; attribution?: Attribution; providerLeadId?: string; formId?: string; pageId?: string; createdTime?: string };
export type PersistLeadResult = { customerId: string; leadId: string; orderId: string; orderNumber: string; duplicate: boolean };

export async function persistFlowSubmission(db: D1Database, submission: FlowSubmission, attribution?: Attribution): Promise<PersistLeadResult> {
  return persistLeadSubmission(db, submission, { source: "WHATSAPP", attribution });
}

export async function persistInstantFormSubmission(db: D1Database, submission: InstantFormSubmission): Promise<PersistLeadResult> {
  return persistLeadSubmission(db, submission, { source: "META_INSTANT_FORM", providerLeadId: submission.leadId, formId: submission.formId, pageId: submission.pageId, createdTime: submission.createdTime, attribution: { campaignId: submission.campaignId, adSetId: submission.adSetId, adId: submission.adId } });
}

async function persistLeadSubmission(db: D1Database, submission: FlowSubmission, options: PersistOptions): Promise<PersistLeadResult> {
  if (options.providerLeadId) {
    const existing = await db.prepare("SELECT ls.lead_id, ls.order_id, l.customer_id, o.order_number FROM lead_sources ls JOIN leads l ON l.id=ls.lead_id JOIN orders o ON o.id=ls.order_id WHERE ls.provider_lead_id=?").bind(options.providerLeadId).first<{ lead_id: string; order_id: string; customer_id: string; order_number: string }>();
    if (existing) return { customerId: existing.customer_id, leadId: existing.lead_id, orderId: existing.order_id, orderNumber: existing.order_number, duplicate: true };
  }
  const paymentConfiguration = await db.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>();
  const paymentAmount = paymentConfiguration?.advance_amount_pkr == null ? 0 : requirePaymentAmount(paymentConfiguration.advance_amount_pkr);
  const now = new Date().toISOString();
  const customerId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const attributionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const addressHash = await digestText(`${submission.deliveryAddress.trim().toLowerCase()}|${submission.city.trim().toLowerCase()}`);
  const orderNumber = await allocateOrderNumber(db, "FREE_SEEDS");
  const leadEvent = createLeadEvent(orderNumber, options.attribution);
  const leadEventId = leadEvent.eventId;
  const outboxId = crypto.randomUUID();
  const whatsappNumber = "whatsappNumber" in submission && typeof submission.whatsappNumber === "string" ? submission.whatsappNumber : undefined;
  await db.batch([
    db.prepare("INSERT INTO customers (id,wa_id,full_name,delivery_address,nearby_place,city,contact_number,normalized_phone,normalized_address_hash,created_at,updated_at,normalized_contact_number,whatsapp_number,normalized_whatsapp_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(customerId, null, submission.fullName, submission.deliveryAddress, submission.nearbyPlace, submission.city, submission.contactNumber, normalizeContactNumber(submission.contactNumber), addressHash, now, now, normalizeContactNumber(submission.contactNumber), whatsappNumber ?? null, whatsappNumber ? normalizeContactNumber(whatsappNumber) : null),
    db.prepare("INSERT INTO orders (id,order_number,customer_id,offer_code,pack_quantity,seed_price,delivery_fee,total_payable,state,payment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId, orderNumber, customerId, "GET_FREE_SEEDS_5_PACKS", 5, 0, paymentAmount, paymentAmount, "DETAILS_COMPLETED", "PENDING", now, now),
    db.prepare("INSERT INTO payments (id,order_id,expected_amount,review_state,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(paymentId, orderId, paymentAmount, "PENDING", now, now),
    db.prepare("INSERT INTO leads (id,customer_id,order_id,status,capi_event_id,created_at) VALUES (?,?,?,?,?,?)").bind(leadId, customerId, orderId, "CREATED", leadEventId, now),
    db.prepare("INSERT INTO meta_attribution (id,order_id,customer_id,ctwa_clid,campaign_id,ad_set_id,ad_id,minimized_referral_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attributionId, orderId, customerId, options.attribution?.ctwaClid ?? null, options.attribution?.campaignId ?? null, options.attribution?.adSetId ?? null, options.attribution?.adId ?? null, JSON.stringify({ source: options.source, ...options.attribution }), now),
    db.prepare("INSERT INTO lead_sources (id,lead_id,order_id,source,provider_lead_id,meta_form_id,provider_created_time,campaign_id,ad_set_id,ad_id,created_at,page_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), leadId, orderId, options.source, options.providerLeadId ?? null, options.formId ?? null, options.createdTime ?? null, options.attribution?.campaignId ?? null, options.attribution?.adSetId ?? null, options.attribution?.adId ?? null, now, options.pageId ?? null),
    ...(options.source === "META_INSTANT_FORM" ? [db.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `whatsapp_order_confirmation_${orderId}`, "WHATSAPP_ORDER_CONFIRMATION", orderId, JSON.stringify({ orderId, customerId }), "PENDING", now, now, now)] : []),
    db.prepare("INSERT INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), leadEventId, "Lead", orderId, customerId, "PENDING", now, now),
    db.prepare("INSERT INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(outboxId, leadEventId, "CAPI_LEAD", orderId, JSON.stringify(leadEvent), "PENDING", now, now, now),
    db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `${options.source}_SUBMITTED`, "CUSTOMER", "ORDER", orderId, correlationId, JSON.stringify({ orderNumber, source: options.source }), now)
  ]);
  return { customerId, leadId, orderId, orderNumber, duplicate: false };
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
