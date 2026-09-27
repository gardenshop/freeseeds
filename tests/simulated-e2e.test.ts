import { describe, expect, it } from "vitest";
import { MockWhatsAppProvider, canTransition, createLeadEvent, createPurchaseEvent, paymentInstructions, validateReceipt } from "@gfs/core";

describe("simulated WhatsApp-to-delivery journey", () => {
  it("runs referral, five-field submission, payment, receipt, approval, CAPI and fulfillment with mocks", async () => {
    const provider = new MockWhatsAppProvider();
    const orderNumber = "FS-100001";
    const referral = { ctwaClid: "synthetic_ctwa", campaignId: "synthetic_campaign" };
    const fields = { fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "+923001234567" };
    expect(Object.keys(fields)).toHaveLength(5);
    expect(referral.ctwaClid).toBe("synthetic_ctwa");
    expect(createLeadEvent(orderNumber, referral).eventId).toBe("lead_FS-100001");
    expect(canTransition("NEW", "DETAILS_COMPLETED")).toBe(true);
    expect(canTransition("DETAILS_COMPLETED", "PAYMENT_PENDING")).toBe(true);
    for (const method of ["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"] as const) expect(paymentInstructions(method, {}).configured).toBe(false);
    await provider.sendInteractive("synthetic", "Choose payment method", ["JazzCash", "Easypaisa", "Bank Transfer"]);
    await provider.sendText("synthetic", "Send your payment receipt in this chat.");
    const receipt = await provider.downloadMedia("synthetic-media");
    validateReceipt(receipt.mimeType, receipt.size);
    expect(canTransition("PAYMENT_PENDING", "RECEIPT_SUBMITTED")).toBe(true);
    expect(canTransition("RECEIPT_SUBMITTED", "PAYMENT_REVIEW")).toBe(true);
    const purchase = createPurchaseEvent(orderNumber, 250, referral);
    expect(purchase).toMatchObject({ eventId: "purchase_FS-100001", currency: "PKR", value: 250, ctwaClid: "synthetic_ctwa" });
    await provider.sendText("synthetic", "Payment Received. Get Free Seeds order confirmed.");
    expect(canTransition("PAYMENT_REVIEW", "PAID")).toBe(true);
    expect(canTransition("PAID", "PACKING")).toBe(true);
    expect(canTransition("PACKING", "DISPATCHED")).toBe(true);
    expect(canTransition("DISPATCHED", "DELIVERED")).toBe(true);
  });
});
