import { describe, expect, it } from "vitest";
import { formatCustomerOrderStatus, getLatestOrderForWaId } from "@gfs/core";

function statusDb(row: Record<string, unknown>) {
  return { prepare: () => { const statement = { bind: (..._args: unknown[]) => statement, first: async () => row }; return statement; } } as unknown as D1Database;
}

const base = {
  id: "synthetic-order",
  order_number: "FS-261012-999001",
  state: "PAYMENT_PENDING",
  payment_status: "PENDING",
  total_payable: 250,
  province: "Punjab",
  created_at: "2026-10-12T10:00:00.000Z",
  updated_at: "2026-10-12T10:00:00.000Z",
  archived_at: null,
  payment_id: "synthetic-payment",
  method: "JAZZCASH",
  expected_amount: 250,
  approved_amount: null,
  review_state: "PENDING",
  submitted_at: null,
  approved_at: null,
  receipt_count: 0,
  normalized_address_hash: "synthetic-household"
};

describe("Check Order details", () => {
  it("reports PAYMENT_PENDING only when no receipt is under review", async () => {
    const order = await getLatestOrderForWaId(statusDb(base), "923001234567");
    expect(order).toBeDefined();
    expect(formatCustomerOrderStatus(order!)).toContain("Payment pending; no receipt is under review.");
  });

  it("reports PAYMENT_REVIEW from actual receipt and payment state", async () => {
    const order = await getLatestOrderForWaId(statusDb({ ...base, state: "PAYMENT_REVIEW", review_state: "REVIEW", submitted_at: "2026-10-12T11:00:00.000Z", receipt_count: 1 }), "923001234567");
    const message = formatCustomerOrderStatus(order!);
    expect(message).toContain("Order status: PAYMENT_REVIEW");
    expect(message).toContain("Payment receipt received and under review.");
    expect(message).not.toContain("no receipt is under review");
  });

  it("returns payment and fulfillment truth for paid, dispatched orders", async () => {
    const order = await getLatestOrderForWaId(statusDb({ ...base, state: "DISPATCHED", payment_status: "PAID", review_state: "APPROVED", approved_amount: 250, approved_at: "2026-10-12T12:00:00.000Z", receipt_count: 1 }), "923001234567");
    expect(formatCustomerOrderStatus(order!)).toContain("Payment approved.");
    expect(formatCustomerOrderStatus(order!)).toContain("Fulfillment: Dispatched.");
  });
});
