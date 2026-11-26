import { describe, expect, it } from "vitest";
import { evaluateFreeWhatsAppOutbound, FEP_OPENING_POLICY_VERSION, type FreeMessagingEvidence } from "../packages/core/src/free-messaging.js";

const NOW = Date.parse("2026-11-26T10:00:00.000Z");
const EVIDENCE: FreeMessagingEvidence = {
  fep: {
    sourceType: "CTWA_AD",
    platform: "ANDROID",
    clickIdHash: "a".repeat(64),
    referralAt: new Date(NOW - 15 * 60_000).toISOString(),
    firstBusinessResponseAt: new Date(NOW - 14 * 60_000).toISOString(),
    expiryVerified: true,
    verifiedAt: new Date(NOW - 60_000).toISOString(),
    verifiedExpiresAt: new Date(NOW + 6 * 24 * 60 * 60_000).toISOString(),
    expiryEvidenceRef: "synthetic-meta-expiry-evidence"
  },
  pricing: {
    verified: true,
    billable: false,
    basis: "FEP",
    type: "free_entry_point",
    category: "REFERRAL_CONVERSION",
    messageCategory: "SERVICE",
    pricingModel: "PMP",
    evidenceRef: "synthetic-free-pricing-evidence",
    observedAt: new Date(NOW - 60_000).toISOString(),
    verifiedAt: new Date(NOW - 60_000).toISOString(),
    validUntil: new Date(NOW + 10 * 60_000).toISOString(),
    form: "FREEFORM"
  }
};

function evaluate(overrides: Partial<Parameters<typeof evaluateFreeWhatsAppOutbound>[0]> = {}) {
  return evaluateFreeWhatsAppOutbound({
    now: new Date(NOW),
    lastInboundAt: new Date(NOW - 5 * 60_000).toISOString(),
    form: "FREEFORM",
    category: "SERVICE",
    locale: "en",
    evidence: EVIDENCE,
    ...overrides
  });
}

describe("fail-closed free-only WhatsApp guard", () => {
  it("allows one qualifying mobile CTWA opening response without requiring an already-open FEP or delivered pricing receipt", () => {
    const opening = {
      sourceType: "CTWA_AD",
      platform: "ANDROID",
      clickIdHash: "f".repeat(64),
      referralAt: new Date(NOW - 2 * 60_000).toISOString(),
      policyVerified: true,
      policyRef: FEP_OPENING_POLICY_VERSION,
      sourceEvidenceRef: "synthetic-signed-referral"
    };
    expect(evaluate({ evidence: { openingResponse: opening }, allowFepOpeningResponse: true })).toMatchObject({ eligible: true, basis: "FEP_OPENING_RESPONSE" });
    expect(evaluate({ evidence: { openingResponse: { ...opening, platform: "UNKNOWN" } }, allowFepOpeningResponse: true })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
    expect(evaluate({ evidence: { openingResponse: { ...opening, firstResponseAttemptedAt: new Date(NOW - 60_000).toISOString() } }, allowFepOpeningResponse: true })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
    expect(evaluate({ lastInboundAt: new Date(NOW - 25 * 60 * 60_000).toISOString(), evidence: { openingResponse: opening }, allowFepOpeningResponse: true })).toMatchObject({ eligible: false, reason: "SERVICE_WINDOW_CLOSED_OR_MARGIN" });
  });

  it("allows a free-form service message only with verified mobile CTWA, FEP expiry, and matching free-pricing evidence", () => {
    expect(evaluate()).toMatchObject({ eligible: true, reason: "VERIFIED_FREE", basis: "FEP" });
  });

  it("fails closed when CTWA, mobile platform, expiry, or free-billing evidence is unknown", () => {
    expect(evaluate({ evidence: undefined })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
    expect(evaluate({ evidence: { ...EVIDENCE, fep: { ...EVIDENCE.fep!, platform: "UNKNOWN" } } })).toMatchObject({ eligible: false, reason: "QUALIFYING_CTWA_EVIDENCE_UNKNOWN" });
    expect(evaluate({ evidence: { ...EVIDENCE, fep: { ...EVIDENCE.fep!, expiryVerified: false } } })).toMatchObject({ eligible: false, reason: "QUALIFYING_CTWA_EVIDENCE_UNKNOWN" });
    expect(evaluate({ evidence: { ...EVIDENCE, fep: { ...EVIDENCE.fep!, verifiedExpiresAt: new Date(NOW).toISOString() } } })).toMatchObject({ eligible: false, reason: "FEP_EXPIRED_OR_UNVERIFIED" });
    expect(evaluate({ evidence: { ...EVIDENCE, fep: { ...EVIDENCE.fep!, verifiedExpiresAt: new Date(NOW + 30_000).toISOString() } } })).toMatchObject({ eligible: false, reason: "FEP_EXPIRED_OR_UNVERIFIED" });
    expect(evaluate({ evidence: { ...EVIDENCE, pricing: { ...EVIDENCE.pricing!, billable: true } } })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
    expect(evaluate({ evidence: { ...EVIDENCE, pricing: { ...EVIDENCE.pricing!, verified: false } } })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
  });

  it("does not treat an active FEP as a free-form service window", () => {
    expect(evaluate({ lastInboundAt: new Date(NOW - 25 * 60 * 60_000).toISOString() })).toMatchObject({ eligible: false, reason: "SERVICE_WINDOW_CLOSED_OR_MARGIN" });
  });

  it("requires an approved, locale/category-matched template outside the service window", () => {
    const templateEvidence: FreeMessagingEvidence = {
      fep: EVIDENCE.fep,
      pricing: EVIDENCE.pricing,
      template: { approved: true, id: "synthetic-approved-utility", locale: "ur", category: "UTILITY", verifiedAt: new Date(NOW - 60_000).toISOString(), validUntil: new Date(NOW + 10 * 60_000).toISOString() }
    };
    const args = { lastInboundAt: new Date(NOW - 25 * 60 * 60_000).toISOString(), form: "TEMPLATE" as const, category: "UTILITY" as const, locale: "ur" as const, templateId: "synthetic-approved-utility", evidence: templateEvidence };
    expect(evaluate(args)).toMatchObject({ eligible: true, reason: "VERIFIED_FREE", basis: "FEP" });
    expect(evaluate({ ...args, templateId: "unapproved" })).toMatchObject({ eligible: false, reason: "APPROVED_TEMPLATE_REQUIRED" });
    expect(evaluate({ ...args, locale: "en" })).toMatchObject({ eligible: false, reason: "APPROVED_TEMPLATE_REQUIRED" });
  });

  it("requires positive verified service-message allowance and re-evaluates expiry on retry", () => {
    const allowance: FreeMessagingEvidence = {
      pricing: { verified: true, billable: false, basis: "SERVICE_ALLOWANCE", type: "free_customer_service", subtype: "free_tier", evidenceRef: "synthetic-remaining-free-messages", observedAt: new Date(NOW - 60_000).toISOString(), verifiedAt: new Date(NOW - 60_000).toISOString(), validUntil: new Date(NOW + 5 * 60_000).toISOString(), form: "FREEFORM", category: "SERVICE", messageCategory: "SERVICE", pricingModel: "PMP", remainingServiceMessages: 1 }
    };
    expect(evaluate({ evidence: allowance })).toMatchObject({ eligible: true, basis: "SERVICE_ALLOWANCE" });
    expect(evaluate({ evidence: { ...allowance, pricing: { ...allowance.pricing!, remainingServiceMessages: 0 } } })).toMatchObject({ eligible: false, reason: "FREE_SERVICE_ALLOWANCE_UNVERIFIED" });
    expect(evaluate({ now: new Date(NOW + 5 * 60_000), evidence: allowance })).toMatchObject({ eligible: false, reason: "FREE_BILLING_EVIDENCE_STALE" });
  });

  it("blocks opted-out recipients and mismatched pricing evidence while allowing FEP-covered message categories", () => {
    expect(evaluate({ optedOut: true })).toMatchObject({ eligible: false, reason: "CUSTOMER_OPTED_OUT" });
    expect(evaluate({ form: "TEMPLATE" })).toMatchObject({ eligible: false, reason: "APPROVED_TEMPLATE_REQUIRED" });
    expect(evaluate({ category: "UTILITY" })).toMatchObject({ eligible: true, basis: "FEP" });
    expect(evaluate({ evidence: { ...EVIDENCE, pricing: { ...EVIDENCE.pricing!, type: "regular" } } })).toMatchObject({ eligible: false, reason: "FREE_BILLING_UNKNOWN_OR_MISMATCHED" });
    expect(evaluate({ form: "UNVERIFIED" as never })).toMatchObject({ eligible: false, reason: "MESSAGE_TYPE_UNKNOWN" });
  });
});
