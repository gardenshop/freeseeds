import { describe, expect, it } from "vitest";
import { formatNeutralLanguagePrompt, formatWhatsAppText } from "../packages/core/src/whatsapp-formatting.js";

const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

function visible(value: string): string {
  return value.replace(/[\u200e\u200f\u2066\u2067\u2069]/g, "");
}

describe("WhatsApp directional text formatting", () => {
  it("wraps each English paragraph LTR and preserves paragraph/blank-line order", () => {
    const input = "Payment Received\n\nYour advance payment of Rs. 1,250 has been received and verified.\n\nOrder Number: FS-TID-001\nTracking: https://example.test/track?id=0012";
    const formatted = formatWhatsAppText(input, "en");
    expect(visible(formatted)).toBe(input);
    expect(formatted).toContain(`\u200e${LRI}Payment Received${PDI}\n\n`);
    expect(formatted).toContain(`\u200e${LRI}Order Number: FS-TID-001${PDI}`);
    expect(formatted).toContain(`\u200e${LRI}Tracking: https://example.test/track?id=0012${PDI}`);
    expect(formatted).not.toMatch(/<\/?(?:p|div|span|b|strong)\b/i);
  });

  it("wraps Urdu paragraphs RTL and isolates amounts, TIDs, tracking IDs, phones and URLs LTR", () => {
    const input = "ادائیگی موصول ہو گئی\n\nآپ کی 1,250 روپے کی پیشگی ادائیگی موصول ہو گئی ہے اور اس کی تصدیق کر دی گئی ہے۔\n\nآرڈر نمبر: FS-TID-001\nٹریکنگ: https://example.test/track?id=0012\nفون: +923001234567";
    const formatted = formatWhatsAppText(input, "ur");
    expect(visible(formatted)).toBe(input);
    expect(formatted).toContain(`\u200f${RLI}ادائیگی موصول ہو گئی${PDI}\n\n`);
    expect(formatted).toContain(`${LRI}1,250${PDI}`);
    expect(formatted).toContain(`${LRI}FS-TID-001${PDI}`);
    expect(formatted).toContain(`${LRI}https://example.test/track?id=0012${PDI}`);
    expect(formatted).toContain(`${LRI}+923001234567${PDI}`);
  });

  it("uses a self-labeled neutral picker before a customer locale is selected", () => {
    const prompt = formatNeutralLanguagePrompt();
    expect(visible(prompt)).toBe("Choose your language / اپنی زبان منتخب کریں");
    expect(prompt).toContain(`${LRI}Choose your language${PDI}`);
    expect(prompt).toContain(`${RLI}اپنی زبان منتخب کریں${PDI}`);
  });
});
