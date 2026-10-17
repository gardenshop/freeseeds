import { normalizeWhatsAppWaId } from "./domain";

export type CurrentOrderDetails = {
  id: string;
  orderNumber: string;
  state: string;
  paymentStatus: string;
  totalPayablePkr: number;
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
  const row = await db.prepare(`SELECT o.id,o.order_number,o.state,o.payment_status,o.total_payable,o.province,o.created_at,o.updated_at,o.archived_at,
    p.id AS payment_id,p.method,p.expected_amount,p.approved_amount,p.review_state,p.submitted_at,p.approved_at,
    COUNT(pr.id) AS receipt_count,c.normalized_address_hash
    FROM orders o
    JOIN customers c ON c.id=o.customer_id
    LEFT JOIN payments p ON p.order_id=o.id
    LEFT JOIN payment_receipts pr ON pr.order_id=o.id
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

export function formatCustomerOrderStatus(order: CurrentOrderDetails): string {
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
