import { describe, expect, it } from "vitest";
import { FlowSubmission, MockWhatsAppProvider, canTransition, createLeadEvent, createPurchaseEvent, eventId, nextOrderNumber, normalizeContactNumber, paymentInstructions, resolveWhatsAppRecipients, validateReceipt } from "@gfs/core";

describe("Get Free Seeds domain", () => {
  it("requires exactly five Flow fields", () => {
    expect(FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567" })).toBeTruthy();
    expect(() => FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567", email: "x@example.test" })).toThrow();
  });
  it("normalizes Pakistani numbers without using a real number", () => {
    expect(normalizeContactNumber("03001234567")).toBe("+923001234567");
    expect(normalizeContactNumber("03034901810")).toBe("+923034901810");
    expect(normalizeContactNumber("923034901810")).toBe("+923034901810");
    expect(normalizeContactNumber("+923034901810")).toBe("+923034901810");
  });
  it("resolves WhatsApp recipient priority without using the business sender", () => {
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923034901810", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923034901810", "+923001234567"]);
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923001234567", normalized_contact_number: "+923001234567" })).toHaveLength(1);
    expect(resolveWhatsAppRecipients({ wa_id: "923034901810", normalized_whatsapp_number: "+923034901810", normalized_contact_number: "+923001234567" })[0].source).toBe("META_WA_ID");
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923328883383", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923001234567"]);
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923124093162", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923001234567"]);
  });
  it("guards legal order transitions", () => { expect(canTransition("PAYMENT_REVIEW", "PAID")).toBe(true); expect(canTransition("NEW", "PAID")).toBe(false); });
  it("creates deterministic event IDs", () => { expect(eventId("lead", "FS-100001")).toBe("lead_FS-100001"); expect(createLeadEvent("FS-100001").eventId).toBe("lead_FS-100001"); expect(createPurchaseEvent("FS-100001", 250).value).toBe(250); });
  it("formats concurrent-safe sequence output", () => expect(nextOrderNumber(100001)).toBe("FS-100001"));
  it("keeps payment methods safely disabled until configuration", () => expect(paymentInstructions({ id: "synthetic", method: "JAZZCASH", displayName: "JazzCash", enabled: false, sortOrder: 10 }).configured).toBe(false));
  it("validates receipt media", () => { expect(() => validateReceipt("image/png", 10)).not.toThrow(); expect(() => validateReceipt("text/html", 10)).toThrow(); });
  it("uses a provider boundary with a mock", async () => { const provider = new MockWhatsAppProvider(); await provider.sendText("synthetic", "Payment received for verification"); expect(provider.sent[0]?.kind).toBe("text"); });
});
