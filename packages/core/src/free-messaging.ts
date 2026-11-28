import { WHATSAPP_SERVICE_WINDOW_MS } from "./service-window";

export type WhatsAppOutboundForm = "FREEFORM" | "TEMPLATE";
export type WhatsAppBillingCategory = "SERVICE" | "UTILITY" | "MARKETING" | "AUTHENTICATION";
export const FEP_OPENING_POLICY_VERSION = "META-PMP-CTWA-FEP-2026-10-01";

export type FreeMessagingEvidence = {
  openingResponse?: {
    sourceType: "CTWA_AD";
    clickIdHash: string;
    referralAt: string;
    policyVerified: true;
    policyRef: typeof FEP_OPENING_POLICY_VERSION;
    sourceEvidenceRef: string;
    firstResponseAttemptedAt?: string;
    firstResponseKeyHash?: string;
    firstResponseMessageIdHash?: string;
  };
  fep?: {
    sourceType: "CTWA_AD";
    clickIdHash: string;
    conversationIdHash?: string;
    referralAt: string;
    firstBusinessResponseAt: string;
    expiryVerified: true;
    verifiedAt: string;
    verifiedExpiresAt: string;
    expiryEvidenceRef: string;
  };
  pricing?: {
    verified: true;
    billable?: boolean;
    basis: "FEP" | "SERVICE_ALLOWANCE";
    type: "free_entry_point" | "free_customer_service";
    subtype?: "free_tier";
    category: WhatsAppBillingCategory | "REFERRAL_CONVERSION";
    messageCategory: WhatsAppBillingCategory;
    pricingModel: "PMP";
    evidenceRef: string;
    observedAt: string;
    verifiedAt: string;
    validUntil: string;
    form: WhatsAppOutboundForm;
    remainingServiceMessages?: number;
  };
  template?: {
    approved: true;
    id: string;
    locale: "en" | "ur";
    category: WhatsAppBillingCategory;
    verifiedAt: string;
    validUntil: string;
  };
};

export type FreeMessagingDecision = { eligible: true; reason: "VERIFIED_FREE"; basis: "FEP_OPENING_RESPONSE" | "FEP" | "SERVICE_ALLOWANCE"; expiresAt: string; evidenceRef: string; locale: "en" | "ur" } | { eligible: false; reason: string };

export function evaluateFreeWhatsAppOutbound(input: {
  now: Date;
  lastInboundAt: string | null;
  optedOut?: boolean;
  blocked?: boolean;
  billingIncidentActive?: boolean;
  form: WhatsAppOutboundForm;
  category: WhatsAppBillingCategory;
  locale: "en" | "ur";
  allowFepOpeningResponse?: boolean;
  allowFepOpeningResponseRetry?: boolean;
  fepOpeningResponseKeyHash?: string;
  templateId?: string;
  evidence?: unknown;
  safetyMarginMs?: number;
}): FreeMessagingDecision {
  const deny = (reason: string): FreeMessagingDecision => ({ eligible: false, reason });
  if (input.optedOut) return deny("CUSTOMER_OPTED_OUT");
  if (input.billingIncidentActive) return deny("UNEXPECTED_BILLABLE_MESSAGE_PAUSE");
  if (input.blocked) return deny("CUSTOMER_BLOCKED");
  const now = input.now.getTime();
  if (!Number.isFinite(now)) return deny("CLOCK_INVALID");
  if (!(["FREEFORM", "TEMPLATE"] as unknown[]).includes(input.form)) return deny("MESSAGE_TYPE_UNKNOWN");
  if (!(["SERVICE", "UTILITY", "MARKETING", "AUTHENTICATION"] as unknown[]).includes(input.category)) return deny("MESSAGE_CATEGORY_UNKNOWN");
  const lastInbound = Date.parse(input.lastInboundAt ?? "");
  const margin = Math.max(0, input.safetyMarginMs ?? 60_000);
  const serviceWindowExpiresAt = lastInbound + WHATSAPP_SERVICE_WINDOW_MS;
  const serviceWindowOpen = Number.isFinite(lastInbound) && lastInbound <= now && serviceWindowExpiresAt > now + margin;
  if (input.form === "FREEFORM" && !serviceWindowOpen) return deny("SERVICE_WINDOW_CLOSED_OR_MARGIN");

  const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence as FreeMessagingEvidence : undefined;
  if(input.allowFepOpeningResponse){
    const opening=evidence?.openingResponse;
    const safeKnownRetry=input.allowFepOpeningResponseRetry===true&&typeof input.fepOpeningResponseKeyHash==="string"&&opening?.firstResponseKeyHash===input.fepOpeningResponseKeyHash&&Boolean(opening?.firstResponseAttemptedAt);
    if(input.form==="FREEFORM"&&input.category==="SERVICE"&&serviceWindowOpen&&opening&&opening.sourceType==="CTWA_AD"&&/^[a-f0-9]{64}$/i.test(opening.clickIdHash)&&opening.policyVerified===true&&opening.policyRef===FEP_OPENING_POLICY_VERSION&&opening.sourceEvidenceRef?.trim()&&(!opening.firstResponseAttemptedAt||safeKnownRetry)){
      const referralAt=Date.parse(opening.referralAt);
      if(Number.isFinite(referralAt)&&referralAt<=now&&now-referralAt<=WHATSAPP_SERVICE_WINDOW_MS)return {eligible:true,reason:"VERIFIED_FREE",basis:"FEP_OPENING_RESPONSE",expiresAt:new Date(serviceWindowExpiresAt).toISOString(),evidenceRef:opening.sourceEvidenceRef,locale:input.locale};
    }
  }
  const pricing = evidence?.pricing;
  if (!pricing || pricing.verified !== true || pricing.billable === true || pricing.pricingModel!=="PMP" || !pricing.evidenceRef?.trim() || (pricing.basis==="SERVICE_ALLOWANCE"&&(pricing.form!==input.form||pricing.messageCategory!==input.category))) return deny("FREE_BILLING_UNKNOWN_OR_MISMATCHED");
  const pricingObservedAt = Date.parse(pricing.observedAt);
  const pricingVerifiedAt = Date.parse(pricing.verifiedAt);
  const pricingExpiresAt = Date.parse(pricing.validUntil);
  if (!Number.isFinite(pricingObservedAt) || pricingObservedAt > now || !Number.isFinite(pricingVerifiedAt) || pricingVerifiedAt > now || !Number.isFinite(pricingExpiresAt) || pricingExpiresAt <= now + margin) return deny("FREE_BILLING_EVIDENCE_STALE");

  if (input.form === "TEMPLATE") {
    const template = evidence?.template;
    if (!input.templateId || !template || template.approved !== true || template.id !== input.templateId || template.locale !== input.locale || template.category !== input.category) return deny("APPROVED_TEMPLATE_REQUIRED");
    const verifiedAt = Date.parse(template.verifiedAt);
    const validUntil = Date.parse(template.validUntil);
    if (!Number.isFinite(verifiedAt) || verifiedAt > now || !Number.isFinite(validUntil) || validUntil <= now + margin) return deny("TEMPLATE_APPROVAL_STALE");
  }

  if (pricing.basis === "SERVICE_ALLOWANCE") {
    return deny("FREE_SERVICE_ALLOWANCE_DISABLED");
  }

  if (pricing.basis !== "FEP" || pricing.type !== "free_entry_point" || pricing.category!=="REFERRAL_CONVERSION") return deny("FREE_BILLING_UNKNOWN_OR_MISMATCHED");
  const fep = evidence?.fep;
  if (pricing.basis !== "FEP" || !fep || fep.sourceType !== "CTWA_AD" || !/^[a-f0-9]{64}$/i.test(fep.clickIdHash) || fep.expiryVerified !== true || !fep.expiryEvidenceRef?.trim()) return deny("QUALIFYING_CTWA_EVIDENCE_UNKNOWN");
  const referralAt = Date.parse(fep.referralAt);
  const firstResponseAt = Date.parse(fep.firstBusinessResponseAt);
  const fepVerifiedAt = Date.parse(fep.verifiedAt);
  const fepExpiresAt = Date.parse(fep.verifiedExpiresAt);
  if (!Number.isFinite(referralAt) || !Number.isFinite(firstResponseAt) || referralAt > firstResponseAt || firstResponseAt - referralAt > WHATSAPP_SERVICE_WINDOW_MS || firstResponseAt > now || !Number.isFinite(fepVerifiedAt) || fepVerifiedAt > now || !Number.isFinite(fepExpiresAt) || fepExpiresAt <= now + margin || fepExpiresAt - firstResponseAt > 7 * 24 * 60 * 60 * 1000) return deny("FEP_EXPIRED_OR_UNVERIFIED");
  return { eligible: true, reason: "VERIFIED_FREE", basis: "FEP", expiresAt: new Date(Math.min(fepExpiresAt, pricingExpiresAt, input.form === "FREEFORM" ? serviceWindowExpiresAt : Number.POSITIVE_INFINITY)).toISOString(), evidenceRef: `${fep.expiryEvidenceRef}:${pricing.evidenceRef}`, locale: input.locale };
}

export async function evaluateStoredFreeWhatsAppOutbound(db: D1Database, waId: string, localeHint?: "en" | "ur", now = new Date(), options: {allowFepOpeningResponse?:boolean;allowFepOpeningResponseRetry?:boolean;fepOpeningResponseKeyHash?:string} = {}): Promise<FreeMessagingDecision> {
  let recipientHash: string;
  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(waId.replace(/^\+/, ""))));
    recipientHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const globalPause = await db.prepare("SELECT 1 AS paused FROM whatsapp_system_send_pauses WHERE pause_key='WABA_GLOBAL' AND status='ACTIVE'").first<{ paused: number }>();
    if (Number(globalPause?.paused) === 1) return { eligible: false, reason: "GLOBAL_BILLING_INCIDENT_PAUSE" };
    const block = await db.prepare("SELECT 1 AS blocked FROM whatsapp_send_blocks WHERE recipient_hash=? AND status='ACTIVE'").bind(recipientHash).first<{ blocked: number }>();
    if (Number(block?.blocked) === 1) return { eligible: false, reason: "UNEXPECTED_BILLABLE_MESSAGE_PAUSE" };
  } catch { return { eligible: false, reason: "BILLING_BLOCK_STORAGE_UNAVAILABLE" }; }
  let conversation: { state_data: string | null; last_inbound_at: string | null } | null | undefined;
  try {
    conversation = await db.prepare("SELECT state_data,last_inbound_at FROM whatsapp_conversations WHERE wa_id=?").bind(waId).first<{ state_data: string | null; last_inbound_at: string | null }>();
  } catch { return { eligible: false, reason: "FREE_EVIDENCE_STORAGE_UNAVAILABLE" }; }
  if (!conversation) return { eligible: false, reason: "CUSTOMER_CONVERSATION_UNKNOWN" };
  let state: { language?: unknown; freeMessagingEvidence?: unknown; blocked?: unknown; leadAccounting?: { billingIncidentActive?: unknown } } = {};
  try { state = JSON.parse(conversation.state_data ?? "{}") as typeof state; } catch { return { eligible: false, reason: "CUSTOMER_STATE_INVALID" }; }
  let optedOut = false;
  try {
    const result = await db.prepare("SELECT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.wa_id=? OR EXISTS(SELECT 1 FROM customers c WHERE c.id=x.customer_id AND c.wa_id=?)) AS opted_out").bind(waId,waId).first<{ opted_out: number }>();
    optedOut = Number(result?.opted_out) === 1;
  } catch { return { eligible: false, reason: "FREE_OPT_OUT_STATE_UNKNOWN" }; }
  const locale = localeHint ?? state.language;
  if (locale !== "en" && locale !== "ur") return { eligible: false, reason: "CUSTOMER_LOCALE_UNKNOWN" };
  return evaluateFreeWhatsAppOutbound({ now, lastInboundAt: conversation.last_inbound_at, optedOut, blocked: state.blocked === true, billingIncidentActive: state.leadAccounting?.billingIncidentActive === true, form: "FREEFORM", category: "SERVICE", locale, evidence: state.freeMessagingEvidence, allowFepOpeningResponse:options.allowFepOpeningResponse, allowFepOpeningResponseRetry:options.allowFepOpeningResponseRetry, fepOpeningResponseKeyHash:options.fepOpeningResponseKeyHash });
}
