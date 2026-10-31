import { describe, expect, it } from "vitest";
import { FlowSubmission, MetaWhatsAppProvider, MockWhatsAppProvider, canTransition, createLeadEvent, createPurchaseEvent, eventId, formatPaymentMessage, hasCompleteEnabledPaymentMethod, normalizeContactNumber, normalizeMobileContactNumber, parseProductInput, parseProvinceDeliveryRateInput, paymentInstructions, provinceDeliveryListRows, requirePaymentAmount, resolveWhatsAppRecipients, validatePaymentAmount, validatePositiveInteger, validateReceipt } from "@gfs/core";

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
  it("accepts only the two new-customer mobile formats and stores eleven digits", () => {
    expect(normalizeMobileContactNumber("03001234567")).toBe("03001234567");
    expect(normalizeMobileContactNumber("0300-1234567")).toBe("03001234567");
    for (const value of ["0300 1234567", "+923001234567", "923001234567", "0300123456", "030012345678", "0300-123456", "03AA1234567"]) {
      expect(normalizeMobileContactNumber(value)).toBeUndefined();
      expect(() => FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: value })).toThrow();
    }
    expect(FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "0300-1234567" }).contactNumber).toBe("03001234567");
  });
  it("accepts optional scoped BSUID without replacing phone identity fields", () => {
    expect(FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567", bsuid: "bsuid-test", bsuidBusinessId: "business-test", whatsappUsername: "customer-test" })).toMatchObject({ bsuid: "bsuid-test", bsuidBusinessId: "business-test" });
    expect(FlowSubmission.parse({ fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567" })).not.toHaveProperty("bsuid");
  });
  it("resolves WhatsApp recipient priority without using the business sender", () => {
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923034901810", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923034901810", "+923001234567"]);
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923001234567", normalized_contact_number: "+923001234567" })).toHaveLength(1);
    expect(resolveWhatsAppRecipients({ wa_id: "923034901810", normalized_whatsapp_number: "+923034901810", normalized_contact_number: "+923001234567" })[0].source).toBe("META_WA_ID");
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923328883383", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923001234567"]);
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923044429933", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923001234567"]);
    expect(resolveWhatsAppRecipients({ normalized_whatsapp_number: "+923124093162", normalized_contact_number: "+923001234567" }).map((candidate) => candidate.recipient)).toEqual(["+923001234567"]);
  });
  it("guards legal order transitions", () => { expect(canTransition("PAYMENT_REVIEW", "PAID")).toBe(true); expect(canTransition("NEW", "PAID")).toBe(false); });
  it("creates deterministic event IDs", () => { expect(eventId("lead", "FS-100001")).toBe("lead_FS-100001"); expect(createLeadEvent("FS-100001").eventId).toBe("lead_FS-100001"); expect(createPurchaseEvent("FS-100001", 250).value).toBe(250); });
  it("keeps payment methods safely disabled until configuration", () => expect(paymentInstructions({ id: "synthetic", method: "JAZZCASH", displayName: "JazzCash", enabled: false, sortOrder: 10 }).configured).toBe(false));
  it("requires a positive PKR payment amount and never formats Rs. 0", () => {
    expect(validatePaymentAmount(250)).toBe(250);
    expect(() => validatePaymentAmount(0)).toThrow("PAYMENT_AMOUNT_INVALID");
    expect(() => validatePaymentAmount(-1)).toThrow("PAYMENT_AMOUNT_INVALID");
    expect(() => validatePaymentAmount(true)).toThrow("PAYMENT_AMOUNT_INVALID");
    expect(() => requirePaymentAmount(null)).toThrow("PAYMENT_AMOUNT_NOT_CONFIGURED");
    expect(() => requirePaymentAmount(0)).toThrow("PAYMENT_AMOUNT_NOT_CONFIGURED");
    expect(() => formatPaymentMessage("FS-100001", 0, { id: "synthetic", method: "JAZZCASH", displayName: "JazzCash", recipientName: "Garden Shop", instructions: "Synthetic instruction", enabled: true, sortOrder: 10 })).toThrow("PAYMENT_AMOUNT_NOT_CONFIGURED");
  });
  it("requires at least one complete enabled payment method", () => {
    expect(hasCompleteEnabledPaymentMethod([{ id: "synthetic", method: "JAZZCASH", displayName: "JazzCash", enabled: false, sortOrder: 10 }])).toBe(false);
    expect(hasCompleteEnabledPaymentMethod([{ id: "synthetic", method: "JAZZCASH", displayName: "JazzCash", recipientName: "Synthetic recipient", instructions: "Pay {amount} to {recipientName}.", referenceInstruction: "Reference {orderNumber}.", receiptInstructions: "Share the receipt here.", enabled: true, sortOrder: 10 }])).toBe(true);
  });
  it("never mixes English payment fields into an Urdu payment message", () => {
    const config = { id: "synthetic", method: "BANK_TRANSFER" as const, displayName: "Bank Transfer", recipientName: "Synthetic recipient", tillId: "SYNTHETIC_ACCOUNT", instructions: "Pay PKR {amount} to {recipientName} ({tillId}).", heading: "Bank transfer", referenceInstruction: "Include reference {orderNumber}.", receiptInstructions: "Share the receipt in this chat.", instructionsUr: "{amount} روپے {recipientName} کو {tillId} پر ادا کریں۔", headingUr: "بینک ٹرانسفر", referenceInstructionUr: "حوالہ نمبر {orderNumber} شامل کریں۔", receiptInstructionsUr: "ادائیگی کے بعد رسید اسی چیٹ میں بھیجیں۔", enabled: true, sortOrder: 10 };
    const ur = formatPaymentMessage("FS-100001", 250, config, "ur");
    expect(ur).toContain("بینک ٹرانسفر");
    expect(ur).toContain("SYNTHETIC_ACCOUNT");
    expect(ur).toContain("FS-100001");
    expect(ur).not.toContain("Pay PKR");
    expect(() => formatPaymentMessage("FS-100001", 250, { ...config, instructionsUr: undefined }, "ur")).toThrow("PAYMENT_TRANSLATION_MISSING");
    expect(() => formatPaymentMessage("FS-100001", 250, { ...config, instructionsUr: "بینک ٹرانسفر" }, "ur")).toThrow("PAYMENT_TRANSLATION_MISSING");
  });
  it("validates catalog prices as positive integers without inventing catalog values", () => {
    expect(validatePositiveInteger(1)).toBe(1);
    expect(() => validatePositiveInteger(0)).toThrow("CATALOG_POSITIVE_INTEGER_REQUIRED");
    expect(() => validatePositiveInteger(1.5)).toThrow("CATALOG_POSITIVE_INTEGER_REQUIRED");
    expect(parseProductInput({ code: "SYNTHETIC", name: "Synthetic product", category: "Synthetic", pricePkr: 10, fertilizerPricePkr: null, active: false })).toMatchObject({ pricePkr: 10, fertilizerPricePkr: null, active: false });
    expect(parseProductInput({ code: "SYNTHETIC_ZERO", name: "Synthetic free product", category: "Synthetic", pricePkr: 0, fertilizerPricePkr: 0, active: true })).toMatchObject({ pricePkr: 0, fertilizerPricePkr: 0 });
    expect(() => parseProductInput({ code: "SYNTHETIC_NEGATIVE", name: "Synthetic product", category: "Synthetic", pricePkr: -1, fertilizerPricePkr: null, active: false })).toThrow("PRODUCT_PRICE_INVALID");
    expect(() => parseProvinceDeliveryRateInput({ province: "Synthetic Province", deliveryFeePkr: -1, active: false })).toThrow("DELIVERY_RATE_INVALID");
  });
  it("builds bounded, localized Meta province LIST rows from D1 rates", () => {
    const rates = ["Synthetic A", "Synthetic B", "Synthetic C", "Synthetic D", "Synthetic E", "Synthetic F", "Synthetic G"].map((province, index) => ({ province, delivery_fee_pkr: 250 + index * 10 }));
    const english = provinceDeliveryListRows(rates, "en");
    const urdu = provinceDeliveryListRows(rates, "ur");
    expect(english).toHaveLength(7);
    expect(english[0]).toEqual({ id: "PROVINCE_SYNTHETIC_A", title: "Synthetic A", description: "Delivery Fee: Rs. 250" });
    expect(urdu[0]).toEqual({ id: "PROVINCE_SYNTHETIC_A", title: "Synthetic A", description: "ڈلیوری فیس: 250 روپے" });
    expect([...english, ...urdu].every((row) => row.title.length <= 24 && row.description.length <= 72)).toBe(true);
    expect(() => provinceDeliveryListRows(Array.from({ length: 11 }, (_, index) => ({ province: `Province ${index}`, delivery_fee_pkr: 1 })), "en")).toThrow("PROVINCE_LIST_ROW_LIMIT_EXCEEDED");
    expect(() => provinceDeliveryListRows([{ province: "A province name exceeding twenty-four characters", delivery_fee_pkr: 1 }], "en")).toThrow("PROVINCE_LIST_TITLE_INVALID");
  });
  it("validates receipt media", () => { expect(() => validateReceipt("image/png", 10)).not.toThrow(); expect(() => validateReceipt("text/html", 10)).toThrow(); });
  it("uses a provider boundary with a mock", async () => { const provider = new MockWhatsAppProvider(); await provider.sendText("synthetic", "Payment received for verification"); expect(provider.sent[0]?.kind).toBe("text"); });
   it("keeps stable action IDs inside the provider boundary", async () => { const provider = new MockWhatsAppProvider(); await provider.sendInteractive("synthetic", "Choose", [{ id: "CONTINUE", title: "Continue" }], { body: new Uint8Array([255, 216, 255, 224]).buffer, mimeType: "image/jpeg" }); expect(provider.sent[0]?.kind).toBe("interactive-image"); });
  it("sends Meta-compatible Flow parameters", async () => {
    const originalFetch = globalThis.fetch;
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-flow-message" }] }), { status: 200 });
    };
    try {
      const provider = new MetaWhatsAppProvider({ enabled: true, graphVersion: "v26.0", phoneNumberId: "synthetic-phone", accessToken: "synthetic-token" });
      await provider.sendFlow("synthetic-recipient", "synthetic-flow", "synthetic-flow-token");
      expect(payload).toMatchObject({ type: "interactive", interactive: { type: "flow", action: { name: "flow", parameters: { flow_id: "synthetic-flow", flow_token: "synthetic-flow-token", flow_message_version: "3", flow_cta: "Get Free Seeds", mode: "published" } } } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends localized utility templates with deterministic quick-reply consent payloads", async () => {
    const originalFetch = globalThis.fetch;
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-template-message" }] }), { status: 200 });
    };
    try {
      const provider = new MetaWhatsAppProvider({ enabled: true, graphVersion: "v26.0", phoneNumberId: "synthetic-phone", accessToken: "synthetic-token" });
      await provider.sendTemplate("synthetic-recipient", "payment_grace_240m", ["SYN-ORDER", "7000", "125", "7125"], "ur", ["CONFIRM_COD", "KEEP_ADVANCE", "CANCEL_ORDER"]);
      expect(payload).toMatchObject({
        type: "template",
        template: {
          name: "payment_grace_240m",
          language: { policy: "deterministic", code: "ur" },
          components: [
            { type: "body", parameters: [{ type: "text", text: "SYN-ORDER" }, { type: "text", text: "7000" }, { type: "text", text: "125" }, { type: "text", text: "7125" }] },
            { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: "CONFIRM_COD" }] },
            { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "KEEP_ADVANCE" }] },
            { type: "button", sub_type: "quick_reply", index: "2", parameters: [{ type: "payload", payload: "CANCEL_ORDER" }] }
          ]
        }
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends province rows as a Meta LIST with localized descriptions", async () => {
    const originalFetch = globalThis.fetch;
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-list-message" }] }), { status: 200 });
    };
    try {
      const provider = new MetaWhatsAppProvider({ enabled: true, graphVersion: "v26.0", phoneNumberId: "synthetic-phone", accessToken: "synthetic-token" });
      const rows = provinceDeliveryListRows([{ province: "Synthetic Province", delivery_fee_pkr: 275 }], "ur");
      await provider.sendList("synthetic-recipient", "صوبہ منتخب کریں", "اختیار منتخب کریں", rows);
      expect(payload).toMatchObject({ type: "interactive", interactive: { type: "list", action: { button: "اختیار منتخب کریں", sections: [{ title: "اختیار منتخب کریں", rows: [{ id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province", description: "ڈلیوری فیس: 275 روپے" }] }] } } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uploads private content media before sending an interactive image header", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body });
      return url.endsWith("/media") ? new Response(JSON.stringify({ id: "synthetic-media-id" }), { status: 200 }) : new Response(JSON.stringify({ messages: [{ id: "synthetic-message-id" }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const provider = new MetaWhatsAppProvider({ enabled: true, graphVersion: "v26.0", phoneNumberId: "synthetic-phone", accessToken: "synthetic-token" });
      await provider.sendInteractive("synthetic-recipient", "Synthetic offer", [{ id: "CONTINUE", title: "Continue" }], { body: new Uint8Array([255, 216, 255, 224]).buffer, mimeType: "image/jpeg" });
      expect(requests).toHaveLength(2);
      expect(requests[0]?.url).toContain("synthetic-phone/media");
      expect(requests[1]?.body).toMatchObject({ type: "interactive", interactive: { header: { type: "image", image: { id: "synthetic-media-id" } } } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
