import { z } from "zod";

export const REQUIRED_FLOW_FIELDS = ["fullName", "deliveryAddress", "nearbyPlace", "city", "contactNumber"] as const;
export const PaymentMethod = z.enum(["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export const OrderState = z.enum(["NEW", "DETAILS_COMPLETED", "PAYMENT_PENDING", "RECEIPT_SUBMITTED", "PAYMENT_REVIEW", "PAYMENT_REJECTED", "PAID", "PACKING", "DISPATCHED", "DELIVERED", "CANCELLED"]);
export type OrderState = z.infer<typeof OrderState>;

export const FlowSubmission = z.object({
  fullName: z.string().trim().min(2).max(120),
  deliveryAddress: z.string().trim().min(5).max(500),
  nearbyPlace: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(100),
  contactNumber: z.string().trim().min(7).max(30)
}).strict();
export type FlowSubmission = z.infer<typeof FlowSubmission>;

export const transitions: Record<OrderState, readonly OrderState[]> = {
  NEW: ["DETAILS_COMPLETED", "CANCELLED"],
  DETAILS_COMPLETED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["RECEIPT_SUBMITTED", "PAYMENT_REJECTED", "CANCELLED"],
  RECEIPT_SUBMITTED: ["PAYMENT_REVIEW", "CANCELLED"],
  PAYMENT_REVIEW: ["PAID", "PAYMENT_REJECTED", "CANCELLED"],
  PAYMENT_REJECTED: ["PAYMENT_PENDING", "RECEIPT_SUBMITTED", "CANCELLED"],
  PAID: ["PACKING", "CANCELLED"],
  PACKING: ["DISPATCHED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return transitions[from].includes(to);
}

export function normalizeContactNumber(value: string): string {
  const digits = value.replace(/[^0-9+]/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("03") && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.startsWith("92") && !digits.startsWith("+")) return `+${digits}`;
  return digits;
}

export function eventId(kind: "lead" | "purchase", orderNumber: string): string {
  return `${kind}_${orderNumber}`;
}

export function nextOrderNumber(sequence: number): string {
  return `FS-${String(sequence).padStart(6, "0")}`;
}

export function approvedPurchaseValue(expectedAmount: number, approvedAmount: number): number {
  if (!Number.isInteger(approvedAmount) || approvedAmount < 0 || approvedAmount > expectedAmount) throw new Error("INVALID_APPROVED_AMOUNT");
  return approvedAmount;
}
