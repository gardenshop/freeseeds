import { normalizeWhatsAppWaId } from "./domain";

export type CurrentOrderDetails = {
  id: string;
  orderNumber: string;
  state: string;
  paymentStatus: string;
  totalPayablePkr: number;
  codQuotedTotalPkr: number | null;
  province: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  paymentId: string | null;
  paymentMethod: string | null;
  expectedAmountPkr: number | null;
  approvedAmountPkr: number | null;
  paymentReviewState: string | null;
  paymentSubmittedAt: string | null;
  paymentApprovedAt: string | null;
  receiptCount: number;
  householdKey: string;
};

export async function getLatestOrderForWaId(db: D1Database, trustedWaId: string, preferredOrderId?: string): Promise<CurrentOrderDetails | undefined> {
  const waId = normalizeWhatsAppWaId(trustedWaId);
  if (!waId) return undefined;
  const row = await db.prepare(`SELECT o.id,o.order_number,o.state,o.payment_status,o.total_payable,o.province,o.created_at,o.updated_at,o.archived_at,cod.quoted_total_pkr AS cod_quoted_total_pkr,
    p.id AS payment_id,p.method,p.expected_amount,p.approved_amount,p.review_state,p.submitted_at,p.approved_at,
    COUNT(pr.id) AS receipt_count,c.normalized_address_hash
    FROM orders o
    JOIN customers c ON c.id=o.customer_id
    LEFT JOIN payments p ON p.order_id=o.id
    LEFT JOIN payment_receipts pr ON pr.order_id=o.id
    LEFT JOIN cod_order_details cod ON cod.order_id=o.id
    WHERE c.wa_id IN (?,?) OR c.normalized_whatsapp_number=?
    GROUP BY o.id,p.id
    ORDER BY CASE WHEN o.id=? THEN 0 ELSE 1 END,o.created_at DESC
    LIMIT 1`).bind(waId, `+${waId}`, `+${waId}`, preferredOrderId ?? "").first<Record<string, unknown>>();
  if (!row) return undefined;
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    state: String(row.state),
    paymentStatus: String(row.payment_status),
    totalPayablePkr: Number(row.total_payable),
    codQuotedTotalPkr: row.cod_quoted_total_pkr == null ? null : Number(row.cod_quoted_total_pkr),
    province: row.province == null ? null : String(row.province),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at == null ? null : String(row.archived_at),
    paymentId: row.payment_id == null ? null : String(row.payment_id),
    paymentMethod: row.method == null ? null : String(row.method),
    expectedAmountPkr: row.expected_amount == null ? null : Number(row.expected_amount),
    approvedAmountPkr: row.approved_amount == null ? null : Number(row.approved_amount),
    paymentReviewState: row.review_state == null ? null : String(row.review_state),
    paymentSubmittedAt: row.submitted_at == null ? null : String(row.submitted_at),
    paymentApprovedAt: row.approved_at == null ? null : String(row.approved_at),
    receiptCount: Number(row.receipt_count ?? 0),
    householdKey: String(row.normalized_address_hash)
  };
}

export function formatCustomerOrderStatus(order: CurrentOrderDetails, locale: "en" | "ur" = "en"): string {
  if (order.codQuotedTotalPkr != null && (order.state === "PAID" || order.paymentStatus === "PAID" || order.paymentReviewState === "COD_PAID")) {
    return locale === "ur"
      ? `آرڈر نمبر: ${order.orderNumber}\nادائیگی کا طریقہ: COD\nآرڈر کی حالت: COD ادا ہو گیا\nڈیلیوری پر کل واجب الادا: PKR ${order.codQuotedTotalPkr}`
      : `Order Number: ${order.orderNumber}\nPayment Method: COD\nOrder Status: COD Paid\nTotal Due on Delivery: PKR ${order.codQuotedTotalPkr}`;
  }
  if (order.codQuotedTotalPkr != null && ["COD_PENDING", "PACKING", "DISPATCHED", "DELIVERED", "COLLECTION_PENDING"].includes(order.state)) {
    const status = order.state === "COD_PENDING" ? "COD Confirmed/Pending Dispatch" : order.state === "PACKING" ? "COD Confirmed/Packing" : order.state === "DISPATCHED" ? "COD Confirmed/Dispatched" : order.state === "DELIVERED" ? "COD Confirmed/Delivered" : "COD Confirmed/Collection Pending";
    return locale === "ur"
      ? `آرڈر نمبر: ${order.orderNumber}\nادائیگی کا طریقہ: COD\nآرڈر کی حالت: ${order.state === "COD_PENDING" ? "COD کی تصدیق ہو گئی/روانگی زیر التوا" : status.replace("COD Confirmed/", "COD کی تصدیق/")}\nڈیلیوری پر کل واجب الادا: PKR ${order.codQuotedTotalPkr}`
      : `Order Number: ${order.orderNumber}\nPayment Method: COD\nOrder Status: ${status}\nTotal Due on Delivery: PKR ${order.codQuotedTotalPkr}`;
  }
  if (locale === "ur") {
    const payment = order.state === "PAID" || order.paymentStatus === "PAID" || order.paymentReviewState === "APPROVED" ? "ادائیگی منظور ہو گئی ہے۔"
      : order.receiptCount > 0 || order.state === "PAYMENT_REVIEW" || order.paymentReviewState === "REVIEW" ? "ادائیگی کی رسید موصول ہو گئی ہے اور جائزہ جاری ہے۔"
        : order.state === "PAYMENT_REJECTED" || order.paymentReviewState === "REJECTED" ? "ادائیگی کی رسید منظور نہیں ہوئی؛ نئی رسید درکار ہے۔"
          : order.state === "PAYMENT_PENDING" || order.paymentReviewState === "PENDING" ? "ادائیگی زیر التوا ہے؛ کوئی رسید جائزے میں نہیں ہے۔"
            : "ادائیگی ابھی ترتیب نہیں دی گئی۔";
    const fulfillment = order.state === "DELIVERED" ? "ڈیلیور ہو گیا"
      : order.state === "DISPATCHED" ? "روانہ کر دیا گیا"
        : order.state === "PACKING" ? "پیکنگ جاری ہے"
          : order.state === "CANCELLED" ? "منسوخ"
            : order.state === "PAID" ? "منظور؛ پیکنگ شروع نہیں ہوئی"
              : "شروع نہیں ہوا";
    const method = order.paymentMethod ? ` طریقہ: ${order.paymentMethod}۔` : "";
    const stateLabels: Record<string, string> = { DETAILS_COMPLETED: "تفصیلات مکمل", PAYMENT_PENDING: "ادائیگی زیر التوا", PAYMENT_REVIEW: "رسید کا جائزہ جاری", PAYMENT_REJECTED: "رسید مسترد", PAID: "ادائیگی منظور", PACKING: "پیکنگ جاری", DISPATCHED: "روانہ کر دیا گیا", DELIVERED: "ڈیلیور ہو گیا", CANCELLED: "منسوخ" };
    return `آرڈر ${order.orderNumber}\nآرڈر کی حالت: ${stateLabels[order.state] ?? "آرڈر پر کارروائی جاری"}\n${payment}${method}\nرقم: PKR ${order.totalPayablePkr}\nتکمیل: ${fulfillment}۔`;
  }
  let payment = "Payment has not been configured.";
  if (order.state === "PAID" || order.paymentStatus === "PAID" || order.paymentReviewState === "APPROVED") payment = "Payment approved.";
  else if (order.receiptCount > 0 || order.state === "PAYMENT_REVIEW" || order.paymentReviewState === "REVIEW") payment = "Payment receipt received and under review.";
  else if (order.state === "PAYMENT_REJECTED" || order.paymentReviewState === "REJECTED") payment = "Payment receipt was not approved; a new receipt is required.";
  else if (order.state === "PAYMENT_PENDING" || order.paymentReviewState === "PENDING") payment = "Payment pending; no receipt is under review.";

  const fulfillment = order.state === "DELIVERED" ? "Delivered"
    : order.state === "DISPATCHED" ? "Dispatched"
      : order.state === "PACKING" ? "Packing"
        : order.state === "CANCELLED" ? "Cancelled"
          : order.state === "PAID" ? "Paid; packing has not started"
            : "Not started";
  const method = order.paymentMethod ? ` Method: ${order.paymentMethod}.` : "";
  return `Order ${order.orderNumber}\nOrder status: ${order.state}\n${payment}${method}\nAmount: PKR ${order.totalPayablePkr}\nFulfillment: ${fulfillment}.`;
}
