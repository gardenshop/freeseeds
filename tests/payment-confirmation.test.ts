import { describe, expect, it } from "vitest";
import { paymentReceivedText } from "../apps/api/src/payment-confirmation.js";
import { formatWhatsAppText } from "../packages/core/src/whatsapp-formatting.js";

function removeDirectionMarks(value: string): string {
  return value.replace(/[\u200e\u200f\u2066\u2067\u2069]/g, "");
}

describe("localized verified advance payment confirmation", () => {
  it("keeps the English paragraph order, amount and order ID readable", () => {
    const message = paymentReceivedText(1250, "FS-SYNTHETIC-001", "en");
    expect(message).toBe("Payment Received\n\nYour advance payment of Rs. 1,250 has been received and verified.\n\nOrder Number: FS-SYNTHETIC-001\n\nYour order is confirmed. Your tracking details will be shared once available.");
    expect(removeDirectionMarks(formatWhatsAppText(message, "en"))).toBe(message);
  });

  it("keeps the Urdu paragraph order while isolating numeric amounts and IDs LTR", () => {
    const message = paymentReceivedText(1250, "FS-SYNTHETIC-001", "ur");
    const formatted = formatWhatsAppText(message, "ur");
    expect(removeDirectionMarks(formatted)).toBe(message);
    expect(message.indexOf("ادائیگی موصول ہو گئی")).toBeLessThan(message.indexOf("1,250"));
    expect(message.indexOf("1,250")).toBeLessThan(message.indexOf("FS-SYNTHETIC-001"));
    expect(formatted).toContain("\u20661,250\u2069");
    expect(formatted).toContain("\u2066FS-SYNTHETIC-001\u2069");
  });

  it("rejects unverified amounts and missing order identity", () => {
    expect(() => paymentReceivedText(0, "FS-SYNTHETIC-001", "en")).toThrow("PAYMENT_CONFIRMATION_DATA_INVALID");
    expect(() => paymentReceivedText(100, " ", "ur")).toThrow("PAYMENT_CONFIRMATION_DATA_INVALID");
  });
});
