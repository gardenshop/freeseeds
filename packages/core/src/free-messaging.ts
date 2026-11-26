import { WHATSAPP_SERVICE_WINDOW_MS } from "./service-window";

export type WhatsAppOutboundForm = "FREEFORM" | "TEMPLATE";
export type WhatsAppBillingCategory = "SERVICE" | "UTILITY" | "MARKETING" | "AUTHENTICATION";

export type FreeMessagingEvidence = {
  fep?: {
    sourceType: "CTWA_AD";
    platform: "ANDROID" | "IOS";
    clickIdHash: string;
    referralAt: string;
    firstBusinessResponseAt: string;
    expiryVerified: true;
    verifiedAt: string;
    verifiedExpiresAt: string;
    expiryEvidenceRef: string;
  };
  pricing?: {
    verified: true;
    billable: false;
    basis: "FEP" | "SERVICE_ALLOWANCE";
    type: "free_entry_point" | "free_customer_service";
    subtype: "free_entry_point" | "free_tier";
    category: WhatsAppBillingCategory;
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

export type FreeMessagingDecision = { eligible: true; reason: "VERIFIED_FREE"; basis: "FEP" | "SERVICE_ALLOWANCE"; expiresAt: string; evidenceRef: string; locale: "en" | "ur" } | { eligible: false; reason: string };

export function evaluateFreeWhatsAppOutbound(input: {
  now: Date;
  lastInboundAt: string | null;
  optedOut?: boolean;
  blocked?: boolean;
  form: WhatsAppOutboundForm;
  category: WhatsAppBillingCategory;
  locale: "en" | "ur";
  templateId?: string;
  evidence?: unknown;
  safetyMarginMs?: number;
}): FreeMessagingDecision {
  const deny = (reason: string): FreeMessagingDecision => ({ eligible: false, reason });
  if (input.optedOut) return deny("CUSTOMER_OPTED_OUT");
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
  const pricing = evidence?.pricing;
  if (!pricing || pricing.verified !== true || pricing.billable !== false || !pricing.evidenceRef?.trim() || pricing.form !== input.form || pricing.category !== input.category) return deny("FREE_BILLING_UNKNOWN_OR_MISMATCHED");
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
    if (!serviceWindowOpen || input.category !== "SERVICE" || pricing.type !== "free_customer_service" || pricing.subtype !== "free_tier" || !Number.isSafeInteger(pricing.remainingServiceMessages) || Number(pricing.remainingServiceMessages) <= 0) return deny("FREE_SERVICE_ALLOWANCE_UNVERIFIED");
    return { eligible: true, reason: "VERIFIED_FREE", basis: "SERVICE_ALLOWANCE", expiresAt: new Date(Math.min(serviceWindowExpiresAt, pricingExpiresAt)).toISOString(), evidenceRef: pricing.evidenceRef, locale: input.locale };
  }

  if (pricing.basis !== "FEP" || pricing.type !== "free_entry_point" || pricing.subtype !== "free_entry_point") return deny("FREE_BILLING_UNKNOWN_OR_MISMATCHED");
  const fep = evidence?.fep;
  if (pricing.basis !== "FEP" || !fep || fep.sourceType !== "CTWA_AD" || !["ANDROID", "IOS"].includes(fep.platform) || !/^[a-f0-9]{64}$/i.test(fep.clickIdHash) || fep.expiryVerified !== true || !fep.expiryEvidenceRef?.trim()) return deny("QUALIFYING_CTWA_EVIDENCE_UNKNOWN");
  const referralAt = Date.parse(fep.referralAt);
  const firstResponseAt = Date.parse(fep.firstBusinessResponseAt);
  const fepVerifiedAt = Date.parse(fep.verifiedAt);
  const fepExpiresAt = Date.parse(fep.verifiedExpiresAt);
  if (!Number.isFinite(referralAt) || !Number.isFinite(firstResponseAt) || referralAt > firstResponseAt || firstResponseAt - referralAt > WHATSAPP_SERVICE_WINDOW_MS || firstResponseAt > now || !Number.isFinite(fepVerifiedAt) || fepVerifiedAt > now || !Number.isFinite(fepExpiresAt) || fepExpiresAt <= now + margin) return deny("FEP_EXPIRED_OR_UNVERIFIED");
  return { eligible: true, reason: "VERIFIED_FREE", basis: "FEP", expiresAt: new Date(Math.min(fepExpiresAt, pricingExpiresAt, input.form === "FREEFORM" ? serviceWindowExpiresAt : Number.POSITIVE_INFINITY)).toISOString(), evidenceRef: `${fep.expiryEvidenceRef}:${pricing.evidenceRef}`, locale: input.locale };
}

export async function evaluateStoredFreeWhatsAppOutbound(db: D1Database, waId: string, localeHint?: "en" | "ur", now = new Date()): Promise<FreeMessagingDecision> {
  let conversation: { state_data: string | null; last_inbound_at: string | null } | null | undefined;
  try {
    conversation = await db.prepare("SELECT state_data,last_inbound_at FROM whatsapp_conversations WHERE wa_id=?").bind(waId).first<{ state_data: string | null; last_inbound_at: string | null }>();
  } catch { return { eligible: false, reason: "FREE_EVIDENCE_STORAGE_UNAVAILABLE" }; }
  if (!conversation) return { eligible: false, reason: "CUSTOMER_CONVERSATION_UNKNOWN" };
  let state: { language?: unknown; freeMessagingEvidence?: unknown; blocked?: unknown } = {};
  try { state = JSON.parse(conversation.state_data ?? "{}") as typeof state; } catch { return { eligible: false, reason: "CUSTOMER_STATE_INVALID" }; }
  let optedOut = false;
  try {
    const result = await db.prepare("SELECT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.wa_id=? OR EXISTS(SELECT 1 FROM customers c WHERE c.id=x.customer_id AND c.wa_id=?)) AS opted_out").bind(waId,waId).first<{ opted_out: number }>();
    optedOut = Number(result?.opted_out) === 1;
  } catch { return { eligible: false, reason: "FREE_OPT_OUT_STATE_UNKNOWN" }; }
  const locale = localeHint ?? state.language;
  if (locale !== "en" && locale !== "ur") return { eligible: false, reason: "CUSTOMER_LOCALE_UNKNOWN" };
  return evaluateFreeWhatsAppOutbound({ now, lastInboundAt: conversation.last_inbound_at, optedOut, blocked: state.blocked === true, form: "FREEFORM", category: "SERVICE", locale, evidence: state.freeMessagingEvidence });
}
