export type OrderPaymentClass =
  | "PAID_RECORDED"
  | "CONFIRMED_COD"
  | "PAYMENT_REVIEW"
  | "UNRESOLVED"
  | "COD_CONFIRMATION_UNVERIFIED"
  | "EXPIRED"
  | "CANCELLED"
  | "PAYMENT_STATE_CONFLICT"
  | "FULFILLMENT_CONFLICT"
  | "OTHER";

export type OrderReconciliationInput = {
  state: string;
  paymentStatus: string;
  reviewState: string;
  totalPayable: number | null;
  expectedAmount: number | null;
  approvedAmount: number | null;
  approvedAt: string | null;
  paymentApprovalEvidenceVerified: boolean;
  receiptCount: number;
  transactionReference: string | null;
  codStatus: string | null;
  codQuotedTotal: number | null;
  codConfirmationVerified: boolean;
  historicalSettlementVerified?: boolean;
  testHold: boolean;
  archived: boolean;
  hasWhatsAppId: boolean;
  intentState: string | null;
  intentPresentedAt: string | null;
  intentDeadlineAt: string | null;
  intentSchemaAvailable?: boolean;
  fulfillmentHold: boolean;
  hasTrackingNumber: boolean | null;
  trackingEvidenceAvailable?: boolean;
};

export type OrderReconciliation = {
  paymentClass: OrderPaymentClass;
  codConsent: "NOT_COD" | "CUSTOMER_CONFIRMED" | "CONFIRMATION_UNVERIFIED" | "SETTLED";
  sequenceDisposition:
    | "ACTIVE_INTENT_GUARDED"
    | "NO_INTENT_NO_HISTORICAL_BACKFILL"
    | "INTENT_SCHEMA_NOT_DEPLOYED"
    | "UNREACHABLE_NO_WHATSAPP_ID"
    | "EXPIRED_NO_SEND"
    | "RESOLVED_NO_SEND";
  dispatchDisposition:
    | "ADMIN_REVIEW_REQUIRED"
    | "BLOCKED_PAYMENT_REVIEW"
    | "BLOCKED_COD_CONFIRMATION"
    | "BLOCKED_TRACKING_REQUIRED"
    | "BLOCKED_DETAIL_CHECK_REQUIRED"
    | "BLOCKED_UNCONFIRMED"
    | "BLOCKED_HOLD"
    | "BLOCKED_RESOLVED"
    | "ALREADY_DISPATCHED_OR_COURIER";
};

const ACTIVE_INTENT_STATES = new Set(["AWAITING_DECISION", "ADVANCE_PENDING", "COD_CONFIRM_PENDING"]);
const FULFILLMENT_STATES = new Set(["PACKING", "DISPATCHED", "DELIVERED", "COLLECTION_PENDING"]);

function positiveInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

export function classifyOrderReconciliation(input: OrderReconciliationInput, now = new Date().toISOString()): OrderReconciliation {
  const state = input.state.toUpperCase();
  const paymentStatus = input.paymentStatus.toUpperCase();
  const reviewState = input.reviewState.toUpperCase();
  const codStatus = input.codStatus?.toUpperCase() ?? null;
  const isCod = codStatus !== null || paymentStatus === "COD_PENDING" || reviewState === "COD_PENDING";
  const advancePaid = !isCod
    && state === "PAID"
    && paymentStatus === "PAID"
    && reviewState === "APPROVED"
    && positiveInteger(input.totalPayable)
    && input.expectedAmount === input.totalPayable
    && input.approvedAmount === input.totalPayable
    && input.approvedAt !== null
    && input.paymentApprovalEvidenceVerified;
  const codPaid = isCod
    && state === "PAID"
    && paymentStatus === "PAID"
    && reviewState === "COD_PAID"
    && codStatus === "PAID"
    && positiveInteger(input.codQuotedTotal)
    && input.approvedAmount === input.codQuotedTotal
    && input.approvedAt !== null;
  const paidRecorded = advancePaid || codPaid || (!isCod
    && state === "PAID"
    && paymentStatus === "PAID"
    && input.historicalSettlementVerified === true);
  const hasPaymentEvidence = input.receiptCount > 0 || Boolean(input.transactionReference);
  const paymentReview = !paidRecorded && (state === "PAYMENT_REVIEW" || reviewState === "REVIEW" || hasPaymentEvidence);
  const codConsent: OrderReconciliation["codConsent"] = !isCod
    ? "NOT_COD"
    : codPaid
      ? "SETTLED"
      : input.codConfirmationVerified
        ? "CUSTOMER_CONFIRMED"
        : "CONFIRMATION_UNVERIFIED";
  const expired = state === "EXPIRED" || paymentStatus === "EXPIRED";
  const cancelled = state === "CANCELLED" || paymentStatus === "CANCELLED";
  const codConfirmationMissing = isCod && !input.codConfirmationVerified && !codPaid && !paymentReview && !expired && !cancelled;
  const unconfirmedFulfillment = FULFILLMENT_STATES.has(state) && !paidRecorded && codConsent !== "CUSTOMER_CONFIRMED" && codConsent !== "SETTLED";
  const paidStateConflict = (state === "PAID" || paymentStatus === "PAID") && !paidRecorded;
  const activeOrder = ["NEW", "DETAILS_COMPLETED", "PAYMENT_PENDING", "PAYMENT_REJECTED", "COD_PENDING"].includes(state);

  let paymentClass: OrderPaymentClass;
  if (paidRecorded) paymentClass = "PAID_RECORDED";
  else if (paidStateConflict) paymentClass = "PAYMENT_STATE_CONFLICT";
  else if (paymentReview) paymentClass = "PAYMENT_REVIEW";
  else if (expired) paymentClass = "EXPIRED";
  else if (cancelled) paymentClass = "CANCELLED";
  else if (codConfirmationMissing) paymentClass = "COD_CONFIRMATION_UNVERIFIED";
  else if (unconfirmedFulfillment) paymentClass = "FULFILLMENT_CONFLICT";
  else if (codConsent === "CUSTOMER_CONFIRMED") paymentClass = "CONFIRMED_COD";
  else if (activeOrder && paymentStatus !== "PAID") paymentClass = "UNRESOLVED";
  else paymentClass = "OTHER";

  const deadline = input.intentDeadlineAt ? Date.parse(input.intentDeadlineAt) : Number.NaN;
  const expiredIntent = input.intentState === "EXPIRED" || Number.isFinite(deadline) && deadline <= Date.parse(now);
  const presentedActiveIntent = input.intentState !== null
    && ACTIVE_INTENT_STATES.has(input.intentState)
    && Boolean(input.intentPresentedAt)
    && Number.isFinite(deadline)
    && deadline > Date.parse(now);
  const sequenceUnresolved = paymentClass === "UNRESOLVED" || paymentClass === "COD_CONFIRMATION_UNVERIFIED";
  let sequenceDisposition: OrderReconciliation["sequenceDisposition"];
  if (!input.hasWhatsAppId) sequenceDisposition = "UNREACHABLE_NO_WHATSAPP_ID";
  else if (expired || cancelled || expiredIntent) sequenceDisposition = "EXPIRED_NO_SEND";
  else if (input.intentSchemaAvailable === false) sequenceDisposition = "INTENT_SCHEMA_NOT_DEPLOYED";
  else if (!sequenceUnresolved) sequenceDisposition = "RESOLVED_NO_SEND";
  else if (presentedActiveIntent) sequenceDisposition = "ACTIVE_INTENT_GUARDED";
  else sequenceDisposition = "NO_INTENT_NO_HISTORICAL_BACKFILL";

  const alreadyDispatched = state === "DISPATCHED" || state === "DELIVERED" || state === "COLLECTION_PENDING";
  let dispatchDisposition: OrderReconciliation["dispatchDisposition"];
  if (input.testHold || input.archived || input.fulfillmentHold) dispatchDisposition = "BLOCKED_HOLD";
  else if (alreadyDispatched && (paidRecorded || codConsent === "CUSTOMER_CONFIRMED" || codConsent === "SETTLED")) dispatchDisposition = "ALREADY_DISPATCHED_OR_COURIER";
  else if (paidStateConflict) dispatchDisposition = "BLOCKED_UNCONFIRMED";
  else if (paymentReview) dispatchDisposition = "BLOCKED_PAYMENT_REVIEW";
  else if (isCod && codConsent === "CONFIRMATION_UNVERIFIED") dispatchDisposition = "BLOCKED_COD_CONFIRMATION";
  else if (state === "EXPIRED" || state === "CANCELLED") dispatchDisposition = "BLOCKED_RESOLVED";
  else if (paymentClass === "PAID_RECORDED" || paymentClass === "CONFIRMED_COD") {
    dispatchDisposition = state === "PACKING" && input.hasTrackingNumber === false
      ? "BLOCKED_TRACKING_REQUIRED"
      : state === "PACKING" && input.trackingEvidenceAvailable === false
        ? "BLOCKED_DETAIL_CHECK_REQUIRED"
        : "ADMIN_REVIEW_REQUIRED";
  } else if (paymentClass === "FULFILLMENT_CONFLICT" || alreadyDispatched) dispatchDisposition = "BLOCKED_UNCONFIRMED";
  else dispatchDisposition = "BLOCKED_UNCONFIRMED";

  return { paymentClass, codConsent, sequenceDisposition, dispatchDisposition };
}
