import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseWhatsAppContentDraft, renderWhatsAppContent, WhatsAppTemplateKey } from "@gfs/core";

describe("GFS-111 WhatsApp content", () => {
  const draft = {
    contentEn: { text: "Order {orderNumber} total PKR {totalPkr}", buttonLabel: "Continue", listButtonLabel: "Choose", listDescription: "Delivery option" },
    contentUr: { text: "آرڈر {orderNumber} کل PKR {totalPkr}", buttonLabel: "جاری رکھیں" },
    mediaR2Key: "whatsapp-content/synthetic-banner.png"
  };

  it("accepts only whitelisted keys, safe placeholders, and private R2 references", () => {
    expect(WhatsAppTemplateKey.safeParse("WELCOME").success).toBe(true);
    expect(WhatsAppTemplateKey.safeParse("ARBITRARY_TEMPLATE").success).toBe(false);
    expect(parseWhatsAppContentDraft(draft)).toMatchObject({ mediaR2Key: "whatsapp-content/synthetic-banner.png" });
    expect(() => parseWhatsAppContentDraft({ ...draft, mediaR2Key: "https://public.example.test/banner.png" })).toThrow("WHATSAPP_CONTENT_MEDIA_KEY_INVALID");
    expect(() => parseWhatsAppContentDraft({ ...draft, contentEn: { text: "Hello {customerName}" } })).toThrow("WHATSAPP_CONTENT_PLACEHOLDER_NOT_ALLOWED");
  });

  it("renders only declared semantic placeholders", () => {
    expect(renderWhatsAppContent("Order {orderNumber}: PKR {totalPkr}", { orderNumber: "FS-SYNTHETIC", totalPkr: 250 })).toBe("Order FS-SYNTHETIC: PKR 250");
    expect(renderWhatsAppContent("Unknown {customerName}", {})).toBe("Unknown {customerName}");
  });

  it("defines stable journey metadata for every WhatsApp template", async () => {
    const migration = await readFile("migrations/0016_whatsapp_content_journey.sql", "utf8");
    expect(migration).toContain("ADD COLUMN flow_order");
    expect(migration).toContain("ADD COLUMN section");
    for (const key of ["WELCOME", "OFFER", "FERTILIZER", "PROVINCE_DELIVERY", "FIELD_FULL_NAME", "FIELD_DELIVERY_ADDRESS", "FIELD_NEARBY_PLACE", "FIELD_CITY", "FIELD_CONTACT_NUMBER", "REVIEW", "CONFIRMATION", "PAYMENT", "RECEIPT", "ORDER_STATUS", "SUPPORT", "VALIDATION"]) expect(migration).toContain(`WHEN '${key}'`);
  });
});
