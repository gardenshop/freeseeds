import { describe, expect, it } from "vitest";
import { classifyOrderReconciliation } from "../apps/admin/src/order-reconciliation";

const now = "2026-11-26T16:00:00.000Z";
const base = {
  state: "PAYMENT_PENDING",
  paymentStatus: "PENDING",
  reviewState: "PENDING",
  totalPayable: 1000,
  expectedAmount: 1000,
  approvedAmount: null,
  approvedAt: null,
  paymentApprovalEvidenceVerified: false,
  receiptCount: 0,
  transactionReference: null,
  codStatus: null,
  codQuotedTotal: null,
  codConfirmationVerified: false,
  testHold: false,
  archived: false,
  hasWhatsAppId: true,
  intentState: null,
  intentPresentedAt: null,
  intentDeadlineAt: null,
  fulfillmentHold: false,
  hasTrackingNumber: false,
};

describe("PENDING-001 order reconciliation", () => {
  it("labels only an exact recorded approval as paid without claiming fresh fund verification", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "PAID",
      paymentStatus: "PAID",
      reviewState: "APPROVED",
      approvedAmount: 1000,
      approvedAt: "2026-11-20T12:00:00.000Z",
      paymentApprovalEvidenceVerified: true,
      receiptCount: 1,
      transactionReference: "SIMULATED-TID-0001",
    }, now);

    expect(result.paymentClass).toBe("PAID_RECORDED");
    expect(result.dispatchDisposition).toBe("ADMIN_REVIEW_REQUIRED");
  });

  it("keeps receipt/TID evidence in review until a complete approval exists", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "PAYMENT_REVIEW",
      reviewState: "REVIEW",
      receiptCount: 1,
      transactionReference: "SIMULATED-TID-0002",
    }, now);

    expect(result.paymentClass).toBe("PAYMENT_REVIEW");
    expect(result.dispatchDisposition).toBe("BLOCKED_PAYMENT_REVIEW");
  });

  it("flags a PAID state without its matched approval audit as a conflict", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "PAID",
      paymentStatus: "PAID",
      reviewState: "APPROVED",
      approvedAmount: 1000,
      approvedAt: "2026-11-20T12:00:00.000Z",
      receiptCount: 1,
      transactionReference: "SIMULATED-TID-0003",
    }, now);

    expect(result.paymentClass).toBe("PAYMENT_STATE_CONFLICT");
    expect(result.dispatchDisposition).toBe("BLOCKED_UNCONFIRMED");
  });

  it("requires a matched customer confirmation before COD fulfillment", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "COD_PENDING",
      paymentStatus: "COD_PENDING",
      reviewState: "COD_PENDING",
      codStatus: "COD_PENDING",
      codQuotedTotal: 1125,
    }, now);

    expect(result.codConsent).toBe("CONFIRMATION_UNVERIFIED");
    expect(result.dispatchDisposition).toBe("BLOCKED_COD_CONFIRMATION");
  });

  it("recognizes explicitly confirmed COD without converting it to paid", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "COD_PENDING",
      paymentStatus: "COD_PENDING",
      reviewState: "COD_PENDING",
      codStatus: "COD_PENDING",
      codQuotedTotal: 1125,
      codConfirmationVerified: true,
    }, now);

    expect(result.paymentClass).toBe("CONFIRMED_COD");
    expect(result.codConsent).toBe("CUSTOMER_CONFIRMED");
    expect(result.dispatchDisposition).toBe("ADMIN_REVIEW_REQUIRED");
  });

  it("keeps an unconfirmed COD choice in the existing guarded sequence without allowing fulfillment", () => {
    const result = classifyOrderReconciliation({
      ...base,
      state: "COD_PENDING",
      paymentStatus: "COD_PENDING",
      reviewState: "COD_PENDING",
      codStatus: "COD_PENDING",
      codQuotedTotal: 1125,
      intentState: "COD_CONFIRM_PENDING",
      intentPresentedAt: "2026-11-26T15:40:00.000Z",
      intentDeadlineAt: "2026-11-26T16:10:00.000Z",
    }, now);

    expect(result.codConsent).toBe("CONFIRMATION_UNVERIFIED");
    expect(result.sequenceDisposition).toBe("ACTIVE_INTENT_GUARDED");
    expect(result.dispatchDisposition).toBe("BLOCKED_COD_CONFIRMATION");
  });

  it("marks old unresolved orders as no-backfill and missing recipients as unreachable", () => {
    const historical = classifyOrderReconciliation(base, now);
    const unreachable = classifyOrderReconciliation({ ...base, hasWhatsAppId: false }, now);

    expect(historical.sequenceDisposition).toBe("NO_INTENT_NO_HISTORICAL_BACKFILL");
    expect(unreachable.sequenceDisposition).toBe("UNREACHABLE_NO_WHATSAPP_ID");
  });

  it("recognizes only an existing, presented and unexpired intent as guarded sequence work", () => {
    const result = classifyOrderReconciliation({
      ...base,
      intentState: "AWAITING_DECISION",
      intentPresentedAt: "2026-11-26T15:40:00.000Z",
      intentDeadlineAt: "2026-11-26T16:10:00.000Z",
    }, now);

    expect(result.sequenceDisposition).toBe("ACTIVE_INTENT_GUARDED");
  });

  it("suppresses expired intents and blocks an unconfirmed fulfillment state", () => {
    const expired = classifyOrderReconciliation({
      ...base,
      intentState: "EXPIRED",
      intentPresentedAt: "2026-11-26T15:00:00.000Z",
      intentDeadlineAt: "2026-11-26T15:30:00.000Z",
    }, now);
    const conflict = classifyOrderReconciliation({ ...base, state: "DISPATCHED" }, now);

    expect(expired.sequenceDisposition).toBe("EXPIRED_NO_SEND");
    expect(conflict.paymentClass).toBe("FULFILLMENT_CONFLICT");
    expect(conflict.dispatchDisposition).toBe("BLOCKED_UNCONFIRMED");
  });
});
