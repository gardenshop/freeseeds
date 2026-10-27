import { createLeadEvent } from "./capi";
import { FlowSubmission, InstantFormSubmission, LeadSource, normalizeContactNumber, normalizeMobileContactNumber, normalizeWhatsAppWaId } from "./domain";
import { allocateOrderNumber } from "./order-number";
import { requirePaymentAmount } from "./payments";
import { OrderQuote, quoteOrder } from "./quote";

export function parseFlowSubmission(input: unknown): FlowSubmission {
  return FlowSubmission.parse(input);
}

export function parseInstantFormSubmission(input: unknown): InstantFormSubmission {
  return InstantFormSubmission.parse(input);
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
type PersistOptions = { source: LeadSource; attribution?: Attribution; providerLeadId?: string; formId?: string; pageId?: string; createdTime?: string; idempotencyKey?: string };
export type PersistLeadResult = { customerId: string; leadId: string; orderId: string; orderNumber: string; duplicate: boolean; quote?: OrderQuote };

export class OrderCooldownError extends Error {
  constructor(readonly orderNumber: string, readonly nextEligibleAt: string) { super("ORDER_COOLDOWN_ACTIVE"); }
}

export async function persistFlowSubmission(db: D1Database, submission: FlowSubmission, attribution?: Attribution, idempotencyKey?: string, trustedWaId?: string): Promise<PersistLeadResult> {
  return persistLeadSubmission(db, submission, { source: "WHATSAPP", attribution, idempotencyKey }, trustedWaId);
}

export async function persistInstantFormSubmission(db: D1Database, submission: InstantFormSubmission): Promise<PersistLeadResult> {
  return persistLeadSubmission(db, submission, { source: "META_INSTANT_FORM", providerLeadId: submission.leadId, formId: submission.formId, pageId: submission.pageId, createdTime: submission.createdTime, idempotencyKey: `META_INSTANT_FORM:${submission.leadId}`, attribution: { campaignId: submission.campaignId, adSetId: submission.adSetId, adId: submission.adId } });
}

async function persistLeadSubmission(db: D1Database, submission: FlowSubmission, options: PersistOptions, trustedWaId?: string): Promise<PersistLeadResult> {
  const existing = await findExistingOrderRequest(db, options);
  if (existing) return existing;
  const hasDynamicField = submission.productCode !== undefined || submission.province !== undefined || submission.fertilizerSelected !== undefined;
  const hasDynamicOrder = submission.productCode !== undefined && submission.province !== undefined;
  if (hasDynamicField && !hasDynamicOrder) throw new Error("DYNAMIC_ORDER_FIELDS_INCOMPLETE");
  const quote = hasDynamicOrder ? await quoteOrder(db, { productCode: submission.productCode as string, province: submission.province as string, fertilizerSelected: submission.fertilizerSelected ?? false }) : undefined;
  const paymentConfiguration = quote ? undefined : await db.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>();
  const paymentAmount = quote ? quote.totalPayablePkr : paymentConfiguration?.advance_amount_pkr == null ? 0 : requirePaymentAmount(paymentConfiguration.advance_amount_pkr);
  const productItem = quote?.items.find((item) => item.type === "PRODUCT");
  const fertilizerItem = quote?.items.find((item) => item.type === "FERTILIZER");
  const productRow = quote ? await db.prepare("SELECT id FROM products WHERE code=?").bind(quote.productCode).first<{ id: string }>() : undefined;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const customerId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const attributionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const addressHash = await digestText(`${submission.deliveryAddress.trim().toLowerCase()}|${submission.city.trim().toLowerCase()}`);
  const normalizedTrustedWaId = trustedWaId ? normalizeWhatsAppWaId(trustedWaId) : undefined;
  const existingWhatsAppCustomer = normalizedTrustedWaId
    ? await db.prepare("SELECT id FROM customers WHERE wa_id IN (?,?) LIMIT 1").bind(normalizedTrustedWaId, `+${normalizedTrustedWaId}`).first<{ id: string }>()
    : undefined;
  const cooldownExempt = normalizedTrustedWaId ? Boolean(await db.prepare("SELECT wa_id FROM cooldown_exemptions WHERE wa_id=?").bind(normalizedTrustedWaId).first<{ wa_id: string }>()) : false;
  let cooldownClaimed = false;
  if (!cooldownExempt) {
    const threshold = new Date(nowDate.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const claim = await db.prepare("INSERT INTO order_eligibility_locks (household_key,order_id,order_number,last_order_at) VALUES (?,?,NULL,?) ON CONFLICT(household_key) DO UPDATE SET order_id=excluded.order_id,order_number=NULL,last_order_at=excluded.last_order_at WHERE order_eligibility_locks.last_order_at<=? RETURNING order_id").bind(addressHash, orderId, now, threshold).first<{ order_id: string }>();
    if (!claim) {
      const existingLock = await db.prepare("SELECT order_number,last_order_at FROM order_eligibility_locks WHERE household_key=?").bind(addressHash).first<{ order_number: string | null; last_order_at: string }>();
      const nextEligible = new Date(new Date(existingLock?.last_order_at ?? now).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      throw new OrderCooldownError(existingLock?.order_number ?? "existing order", nextEligible);
    }
    cooldownClaimed = true;
  }
  const orderNumber = await allocateOrderNumber(db, nowDate);
  const leadEvent = createLeadEvent(orderNumber, options.attribution);
  const leadEventId = leadEvent.eventId;
  const outboxId = crypto.randomUUID();
  // Retain prior order delivery snapshots; only the first snapshot owns unique wa_id.
  const snapshotWaId = existingWhatsAppCustomer ? undefined : normalizedTrustedWaId;
  const whatsappNumber = existingWhatsAppCustomer ? normalizedTrustedWaId : !normalizedTrustedWaId && "whatsappNumber" in submission && typeof submission.whatsappNumber === "string" ? submission.whatsappNumber : undefined;
  const storedContactNumber = normalizeMobileContactNumber(submission.contactNumber) ?? submission.contactNumber;
  try {
    await db.batch([
    db.prepare("INSERT INTO customers (id,wa_id,bsuid,bsuid_business_id,whatsapp_username,full_name,delivery_address,nearby_place,city,contact_number,normalized_phone,normalized_address_hash,created_at,updated_at,normalized_contact_number,whatsapp_number,normalized_whatsapp_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(customerId, snapshotWaId ?? null, submission.bsuid ?? null, submission.bsuidBusinessId ?? null, submission.whatsappUsername ?? null, submission.fullName, submission.deliveryAddress, submission.nearbyPlace, submission.city, storedContactNumber, normalizeContactNumber(storedContactNumber), addressHash, now, now, normalizeContactNumber(storedContactNumber), whatsappNumber ?? null, whatsappNumber ? normalizeContactNumber(whatsappNumber) : null),
    db.prepare("INSERT INTO orders (id,order_number,customer_id,offer_code,pack_quantity,seed_price,delivery_fee,fertilizer_fee,total_payable,province,fertilizer_selected,state,payment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId, orderNumber, customerId, quote?.productCode ?? "GET_FREE_SEEDS_5_PACKS", quote ? 1 : 5, productItem?.lineTotalPkr ?? 0, quote?.deliveryFeePkr ?? paymentAmount, fertilizerItem?.lineTotalPkr ?? 0, paymentAmount, quote?.province ?? null, quote?.fertilizerSelected ? 1 : 0, "DETAILS_COMPLETED", "PENDING", now, now),
    ...(quote ? quote.items.map((item) => db.prepare("INSERT INTO order_items (id,order_id,product_id,item_type,product_code,description,quantity,unit_price_pkr,line_total_pkr,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), orderId, item.type === "PRODUCT" ? productRow?.id ?? null : null, item.type, item.code, item.name, item.quantity, item.unitPricePkr, item.lineTotalPkr, now)) : []),
    db.prepare("INSERT INTO payments (id,order_id,expected_amount,review_state,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(paymentId, orderId, paymentAmount, "PENDING", now, now),
    db.prepare("INSERT INTO leads (id,customer_id,order_id,status,capi_event_id,created_at) VALUES (?,?,?,?,?,?)").bind(leadId, customerId, orderId, "CREATED", leadEventId, now),
    db.prepare("INSERT INTO meta_attribution (id,order_id,customer_id,ctwa_clid,campaign_id,ad_set_id,ad_id,minimized_referral_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attributionId, orderId, customerId, options.attribution?.ctwaClid ?? null, options.attribution?.campaignId ?? null, options.attribution?.adSetId ?? null, options.attribution?.adId ?? null, JSON.stringify({ source: options.source, ...options.attribution }), now),
    db.prepare("INSERT INTO lead_sources (id,lead_id,order_id,source,provider_lead_id,meta_form_id,provider_created_time,campaign_id,ad_set_id,ad_id,created_at,page_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), leadId, orderId, options.source, options.providerLeadId ?? null, options.formId ?? null, options.createdTime ?? null, options.attribution?.campaignId ?? null, options.attribution?.adSetId ?? null, options.attribution?.adId ?? null, now, options.pageId ?? null),
    ...(options.idempotencyKey ? [db.prepare("INSERT INTO order_requests (idempotency_key,order_id,source,created_at) VALUES (?,?,?,?)").bind(options.idempotencyKey, orderId, options.source, now)] : []),
    ...(options.source === "META_INSTANT_FORM" ? [db.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `whatsapp_order_confirmation_${orderId}`, "WHATSAPP_ORDER_CONFIRMATION", orderId, JSON.stringify({ orderId, customerId }), "PENDING", now, now, now)] : []),
    db.prepare("INSERT INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), leadEventId, "Lead", orderId, customerId, "PENDING", now, now),
    db.prepare("INSERT INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(outboxId, leadEventId, "CAPI_LEAD", orderId, JSON.stringify(leadEvent), "PENDING", now, now, now),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `${options.source}_SUBMITTED`, "CUSTOMER", "ORDER", orderId, correlationId, JSON.stringify({ orderNumber, source: options.source }), now),
      ...(cooldownClaimed ? [db.prepare("UPDATE order_eligibility_locks SET order_number=? WHERE household_key=? AND order_id=?").bind(orderNumber, addressHash, orderId)] : []),
      ...(cooldownExempt ? [db.prepare("INSERT INTO order_eligibility_locks (household_key,order_id,order_number,last_order_at) VALUES (?,?,?,?) ON CONFLICT(household_key) DO UPDATE SET order_id=excluded.order_id,order_number=excluded.order_number,last_order_at=excluded.last_order_at").bind(addressHash, orderId, orderNumber, now)] : [])
    ]);
  } catch (error) {
    // A concurrent replay may lose the idempotency-key insert after allocating a number.
    const replay = await findExistingOrderRequest(db, options);
    if (replay) return replay;
    if (cooldownClaimed) await db.prepare("DELETE FROM order_eligibility_locks WHERE household_key=? AND order_id=?").bind(addressHash, orderId).run();
    throw error;
  }
  return { customerId, leadId, orderId, orderNumber, duplicate: false, ...(quote ? { quote } : {}) };
}

async function findExistingOrderRequest(db: D1Database, options: PersistOptions): Promise<PersistLeadResult | undefined> {
  if (options.idempotencyKey) {
    const existing = await db.prepare("SELECT l.id AS lead_id, o.id AS order_id, l.customer_id, o.order_number FROM order_requests r JOIN orders o ON o.id=r.order_id JOIN leads l ON l.order_id=o.id WHERE r.idempotency_key=?").bind(options.idempotencyKey).first<{ lead_id: string; order_id: string; customer_id: string; order_number: string }>();
    if (existing) return { customerId: existing.customer_id, leadId: existing.lead_id, orderId: existing.order_id, orderNumber: existing.order_number, duplicate: true };
  }
  if (!options.providerLeadId) return undefined;
  const existing = await db.prepare("SELECT ls.lead_id, ls.order_id, l.customer_id, o.order_number FROM lead_sources ls JOIN leads l ON l.id=ls.lead_id JOIN orders o ON o.id=ls.order_id WHERE ls.provider_lead_id=?").bind(options.providerLeadId).first<{ lead_id: string; order_id: string; customer_id: string; order_number: string }>();
  return existing ? { customerId: existing.customer_id, leadId: existing.lead_id, orderId: existing.order_id, orderNumber: existing.order_number, duplicate: true } : undefined;
}

async function digestText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
