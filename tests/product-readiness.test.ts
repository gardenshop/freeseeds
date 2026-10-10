import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyFertilizerDecision, isAllowedInstantFormLead, LeadSource, MetaWhatsAppProvider, MetaCapiProvider, formatPaymentMessage, isPaymentMethodComplete, isTerminalOutboxStatus, parseMetaInstantFormLead, parseWebhookRecords, paymentInstructions, quoteOrder, retryDelaySeconds, selectPaymentMethod, shouldDeadLetter, storePaymentQr, storeReceipt, validatePaymentQr } from "@gfs/core";
import api from "../apps/api/src/index";

describe("product readiness safeguards", () => {
  it("verifies Meta signatures and keeps the disabled provider closed", async () => {
    const body = new TextEncoder().encode("synthetic webhook");
    const rawBody = body.buffer as ArrayBuffer;
    const secret = "synthetic-secret";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
    const signature = `sha256=${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    const provider = new MetaWhatsAppProvider({ enabled: false, graphVersion: "v26.0", appSecret: secret });
    expect(await provider.validateSignature(rawBody, signature)).toBe(true);
    expect(await provider.validateSignature(rawBody, "sha256=bad", secret)).toBe(false);
    await expect(provider.sendText("synthetic", "blocked")).rejects.toThrow("META_PROVIDER_DISABLED");
  });

  it("parses referral attribution without fabricating absent values", () => {
    const provider = new MetaWhatsAppProvider({ enabled: false, graphVersion: "v26.0" });
    const events = provider.parseInboundEvent({ entry: [{ changes: [{ value: { messages: [{ id: "synthetic-message", from: "synthetic-user", type: "text", referral: { ctwa_clid: "synthetic-ctwa" } }] } }] }] });
    expect(events[0]).toMatchObject({ id: "synthetic-message", referral: { ctwaClid: "synthetic-ctwa" } });
    expect(provider.parseInboundEvent({ entry: [] })).toEqual([]);
  });

  it("classifies inbound messages, media, and statuses without storing payloads", () => {
    const records = parseWebhookRecords({ entry: [{ changes: [{ value: { messages: [{ id: "synthetic-message", type: "text" }, { id: "synthetic-media", type: "image", image: { id: "synthetic-media" } }], statuses: [{ id: "synthetic-status", status: "delivered" }] } }] }] });
    expect(records).toEqual([
      { providerEventId: "message:synthetic-message", eventType: "MESSAGE", status: "RECEIVED" },
      { providerEventId: "message:synthetic-media", eventType: "MEDIA", status: "RECEIVED" },
      { providerEventId: "status:synthetic-status", eventType: "STATUS", status: "delivered" }
    ]);
  });

  it("normalizes a Meta Instant Form lead into the shared five-field model", () => {
    const lead = parseMetaInstantFormLead({ id: "synthetic-meta-lead", form_id: "synthetic-form", page_id: "synthetic-page", created_time: "2026-10-03T00:00:00Z", campaign_id: "synthetic-campaign", adset_id: "synthetic-adset", ad_id: "synthetic-ad", field_data: [
      { name: "Full Name", values: ["Synthetic Customer"] },
      { name: "Complete Delivery Address", values: ["1 Test Street"] },
      { name: "Nearby Famous Place", values: ["Test Park"] },
      { name: "City", values: ["Sahiwal"] },
      { name: "Contact Number", values: ["03001234567"] }
    ] });
    expect(lead).toMatchObject({ leadId: "synthetic-meta-lead", formId: "synthetic-form", pageId: "synthetic-page", contactNumber: "+923001234567", campaignId: "synthetic-campaign" });
    expect(LeadSource.options).toEqual(["META_INSTANT_FORM", "WHATSAPP", "FACEBOOK_MESSENGER", "INSTAGRAM_DM"]);
    expect(isAllowedInstantFormLead({ page_id: "canonical-page", form_id: "canonical-form" }, "canonical-page", "canonical-form")).toBe(true);
    expect(isAllowedInstantFormLead({ page_id: "other-page", form_id: "canonical-form" }, "canonical-page", "canonical-form")).toBe(false);
    expect(isAllowedInstantFormLead({ page_id: "canonical-page", form_id: "other-form" }, "canonical-page", "canonical-form")).toBe(false);
  });

  it("keeps entered contact and Meta WhatsApp numbers separate", () => {
    const lead = parseMetaInstantFormLead({ id: "two-number-lead", form_id: "synthetic-form", page_id: "synthetic-page", created_time: "2026-10-05T00:00:00Z", field_data: [
      { name: "اپنا درست موبایل نمبر مہیا کریں۔", values: ["03001234567"] },
      { name: "phone_number", values: ["+923034901810"] },
      { name: "Full Name", values: ["Synthetic Customer"] },
      { name: "Complete Delivery Address", values: ["1 Test Street"] },
      { name: "Nearby Famous Place", values: ["Test Park"] },
      { name: "City", values: ["Lahore"] }
    ] });
    expect(lead.contactNumber).toBe("+923001234567");
    expect(lead.whatsappNumber).toBe("+923034901810");
  });

  it("uses bounded retry and DLQ decisions", () => {
    expect(retryDelaySeconds(0)).toBe(30);
    expect(retryDelaySeconds(20)).toBe(3600);
    expect(shouldDeadLetter(5)).toBe(true);
    expect(shouldDeadLetter(4)).toBe(false);
    expect(isTerminalOutboxStatus("SENT")).toBe(true);
    expect(isTerminalOutboxStatus("RETRY")).toBe(false);
  });

  it("keeps all payment methods disabled without verified recipient values", () => {
    for (const [method, displayName] of [["JAZZCASH", "JazzCash"], ["EASYPAISA", "Easypaisa"], ["BANK_TRANSFER", "Bank Transfer"]] as const) expect(paymentInstructions({ id: `synthetic-${method}`, method, displayName, enabled: false, sortOrder: 10 }).configured).toBe(false);
    const config = { id: "synthetic", method: "JAZZCASH" as const, displayName: "JazzCash", recipientName: "Garden Shop", instructions: "Synthetic instruction", referenceInstruction: "Use order number", enabled: true, sortOrder: 10 };
    expect(isPaymentMethodComplete(config)).toBe(true);
    expect(formatPaymentMessage("FS-100001", 250, config)).toContain("Garden Shop");
  });

  it("selects only a complete configured method and creates idempotent payment work", async () => {
    const statements: unknown[] = [];
    const row = { order_number: "FS-100001", total_payable: 250, state: "DETAILS_COMPLETED", payment_id: "synthetic-payment", id: "synthetic-method", method: "JAZZCASH", display_name: "JazzCash", recipient_name: "Garden Shop", instructions: "Synthetic instruction", reference_instruction: "Use order number", enabled: 1, sort_order: 10 };
    const db = { prepare: (_sql: string) => { const statement = { bind: (...args: unknown[]) => { statements.push(args); return statement; }, first: async () => row }; return statement; }, batch: async (batchStatements: unknown[]) => { statements.push(batchStatements); return []; } } as unknown as D1Database;
    const result = await selectPaymentMethod(db, "synthetic-order", "JAZZCASH");
    expect(result.message).toContain("Amount due: PKR 250");
    expect(JSON.stringify(statements)).toContain("WHATSAPP_PAYMENT_INSTRUCTIONS");
    const incomplete = { ...row, enabled: 0 };
    const incompleteDb = { prepare: (_sql: string) => { const statement = { bind: (..._args: unknown[]) => statement, first: async () => incomplete }; return statement; } } as unknown as D1Database;
    await expect(selectPaymentMethod(incompleteDb, "synthetic-order", "JAZZCASH")).rejects.toThrow("PAYMENT_METHOD_NOT_CONFIGURED");
  });

  it("quotes authoritative fixture catalog values and hides incomplete payment methods", async () => {
    const db = {
      prepare: (sql: string) => {
        const statement = {
          bind: (..._args: unknown[]) => statement,
          first: async () => sql.includes("FROM products") ? { id: "fixture-product", code: "FIXTURE-SEEDS", name: "Fixture Seeds", price_pkr: 300, fertilizer_price_pkr: 50, enabled: 1 } : { province: "Punjab", delivery_fee_pkr: 150, enabled: 1 },
          all: async () => ({ results: [{ display_name: "Configured Fixture Method", enabled: 1, recipient_name: "Fixture recipient", instructions: "Fixture instructions" }, { display_name: "Incomplete Fixture Method", enabled: 1, recipient_name: null, instructions: null }] })
        };
        return statement;
      }
    } as unknown as D1Database;
    const quote = await quoteOrder(db, { productCode: "FIXTURE-SEEDS", fertilizerSelected: true, province: "Punjab" });
    expect(quote).toMatchObject({ subtotalPkr: 350, deliveryPkr: 150, totalPkr: 500, paymentMethods: ["Configured Fixture Method"] });
    expect(quote.items).toHaveLength(2);
  });

  it("rejects disabled or missing catalog and rate fixtures", async () => {
    const makeDb = (product: unknown, rate: unknown) => ({ prepare: (sql: string) => { const statement = { bind: (..._args: unknown[]) => statement, first: async () => sql.includes("FROM products") ? product : rate, all: async () => ({ results: [] }) }; return statement; } }) as unknown as D1Database;
    await expect(quoteOrder(makeDb(undefined, undefined), { productCode: "MISSING", fertilizerSelected: false, province: "Punjab" })).rejects.toThrow("PRODUCT_NOT_FOUND");
    await expect(quoteOrder(makeDb({ code: "DISABLED", enabled: 0 }, undefined), { productCode: "DISABLED", fertilizerSelected: false, province: "Punjab" })).rejects.toThrow("PRODUCT_DISABLED");
    await expect(quoteOrder(makeDb({ code: "FIXTURE", price_pkr: 1, enabled: 1 }, undefined), { productCode: "FIXTURE", fertilizerSelected: false, province: "Punjab" })).rejects.toThrow("PROVINCE_DELIVERY_RATE_NOT_FOUND");
    await expect(quoteOrder(makeDb({ code: "FIXTURE", price_pkr: 1, enabled: 1 }, { province: "Punjab", delivery_fee_pkr: 100, enabled: 0 }), { productCode: "FIXTURE", fertilizerSelected: false, province: "Punjab" })).rejects.toThrow("PROVINCE_DELIVERY_RATE_DISABLED");
  });

  it("rejects client-supplied quote prices", async () => {
    const db = {} as D1Database;
    await expect(quoteOrder(db, { productCode: "FIXTURE", fertilizerSelected: false, province: "Punjab", pricePkr: 1 } as never)).rejects.toThrow();
  });

  it("uses the persisted payable total instead of global payment configuration", async () => {
    const statements: string[] = [];
    const row = { order_number: "FS-100002", total_payable: 500, province: "Punjab", state: "DETAILS_COMPLETED", payment_id: "synthetic-payment", id: "synthetic-method", method: "JAZZCASH", display_name: "JazzCash", recipient_name: "Garden Shop", instructions: "Fixture instruction", enabled: 1, sort_order: 10 };
    const db = { prepare: (sql: string) => { statements.push(sql); const statement = { bind: (..._args: unknown[]) => statement, first: async () => row }; return statement; }, batch: async () => [] } as unknown as D1Database;
    const result = await selectPaymentMethod(db, "synthetic-order", "JAZZCASH");
    expect(result.amount).toBe(500);
    expect(statements.join(" ")).not.toContain("payment_configuration");
  });

  it("recalculates and idempotently applies the fertilizer decision", async () => {
    const sql: string[] = [];
    const row = { id: "synthetic-order", order_number: "FS-100004", offer_code: "FIXTURE-SEEDS", province: "Punjab", fertilizer_selected: 0, seed_price: 300, fertilizer_fee: 0, delivery_fee: 150, total_payable: 450, state: "DETAILS_COMPLETED" };
    const db = {
      prepare: (query: string) => {
        sql.push(query);
        const statement = {
          bind: (..._args: unknown[]) => statement,
          first: async () => query.includes("offer_code") ? row : query.includes("province_delivery_rates") ? { province: "Punjab", delivery_fee_pkr: 150, enabled: 1 } : query.includes("id FROM products") ? { id: "fixture-product" } : { id: "fixture-product", code: "FIXTURE-SEEDS", name: "Fixture Seeds", price_pkr: 300, fertilizer_price_pkr: 50, enabled: 1 },
          all: async () => ({ results: query.includes("payment_methods") ? [{ display_name: "JazzCash", enabled: 1, recipient_name: "Garden Shop", instructions: "Synthetic instructions" }] : [] })
        };
        return statement;
      },
      batch: async (statements: unknown[]) => { sql.push(JSON.stringify(statements)); return []; }
    } as unknown as D1Database;
    const result = await applyFertilizerDecision(db, "synthetic-order", { decision: "ADD_FERTILIZER", clientTotalPkr: 1 });
    expect(result.orderSummary.totalPayablePkr).toBe(500);
    expect(result.orderSummary.paymentMethods).toEqual(["JazzCash"]);
    expect(sql.some((query) => query.includes("DELETE FROM order_items"))).toBe(true);
    expect(sql.some((query) => query.includes("UPDATE orders SET seed_price"))).toBe(true);
    expect(sql.join(" ")).not.toContain("clientTotalPkr");
  });

  it("keeps legacy zero-seed orders payable by their persisted delivery total", async () => {
    const row = { order_number: "FS-100003", seed_price: 0, delivery_fee: 250, fertilizer_fee: 0, total_payable: 250, province: null, state: "DETAILS_COMPLETED", payment_id: "synthetic-payment", id: "synthetic-method", method: "JAZZCASH", display_name: "JazzCash", recipient_name: "Garden Shop", instructions: "Fixture instruction", enabled: 1, sort_order: 10 };
    const db = { prepare: (_sql: string) => { const statement = { bind: (..._args: unknown[]) => statement, first: async () => row }; return statement; }, batch: async () => [] } as unknown as D1Database;
    await expect(selectPaymentMethod(db, "synthetic-order", "JAZZCASH")).resolves.toMatchObject({ amount: 250 });
  });

  it("validates, stores and replaces private payment QR objects", async () => {
    const writes: Array<{ key: string; value: ArrayBuffer }> = [];
    const bucket = { put: async (key: string, value: ArrayBuffer) => { writes.push({ key, value }); } } as unknown as R2Bucket;
    expect(() => validatePaymentQr("image/png", 4)).not.toThrow();
    expect(() => validatePaymentQr("application/pdf", 4)).toThrow("PAYMENT_QR_MIME_NOT_ALLOWED");
    const stored = await storePaymentQr(bucket, "JAZZCASH", new Uint8Array([1, 2, 3, 4]).buffer, "image/png");
    expect(stored.objectKey).toMatch(/^payment-qr\/JAZZCASH\//);
    expect(stored.sha256).toHaveLength(64);
    expect(writes).toHaveLength(1);
  });

  it("stores receipts privately with a checksum and safe metadata", async () => {
    const writes: Array<{ key: string; value: ArrayBuffer }> = [];
    const bucket = { put: async (key: string, value: ArrayBuffer) => { writes.push({ key, value }); } } as unknown as R2Bucket;
    const result = await storeReceipt(bucket, "FS-100001", { mediaId: "synthetic-media", mimeType: "image/png", size: 4, body: new Uint8Array([1, 2, 3, 4]).buffer });
    expect(result.objectKey).toMatch(/^receipts\/FS-100001\//);
    expect(result.sha256).toHaveLength(64);
    expect(writes).toHaveLength(1);
  });

  it("associates a repeated private receipt request idempotently", async () => {
    let bucketWrites = 0;
    const db = {
      prepare: (sql: string) => {
        const statement = {
          bind: (..._args: unknown[]) => statement,
          first: async () => sql.includes("SELECT o.order_number")
            ? { order_number: "FS-100001", state: "PAYMENT_PENDING", payment_id: "synthetic-payment" }
            : sql.includes("payment_receipts")
              ? { r2_object_key: "receipts/FS-100001/synthetic/object", sha256: "synthetic-sha256" }
              : undefined
        };
        return statement;
      }
    } as unknown as D1Database;
    const bucket = { put: async () => { bucketWrites += 1; } } as unknown as R2Bucket;
    const response = await api.fetch(new Request("https://api.example.test/receipts/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "synthetic-order", paymentId: "synthetic-payment", mediaId: "synthetic-media" })
    }), { DB: db, RECEIPTS: bucket, WHATSAPP_PROVIDER: "mock", META_PROVIDER_ENABLED: "false", DEPLOYMENT_STATE: "LOCAL" } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, alreadyAssociated: true, reviewState: "REVIEW" });
    expect(bucketWrites).toBe(0);
  });

  it("contains all required D1 tables and no third-party CRM dependency", () => {
    const schema = readFileSync("migrations/0001_initial.sql", "utf8");
    const migrations = schema + readFileSync("migrations/0002_payment_methods.sql", "utf8") + readFileSync("migrations/0003_lead_sources.sql", "utf8") + readFileSync("migrations/0004_lead_source_page.sql", "utf8") + readFileSync("migrations/0005_customer_whatsapp_numbers.sql", "utf8") + readFileSync("migrations/0006_payment_configuration.sql", "utf8") + readFileSync("migrations/0007_dynamic_catalog.sql", "utf8") + readFileSync("migrations/0008_catalog_category.sql", "utf8");
    for (const table of ["customers", "leads", "lead_sources", "orders", "payments", "payment_receipts", "payment_methods", "payment_configuration", "products", "province_delivery_rates", "order_items", "meta_attribution", "capi_events", "whatsapp_events", "outbound_messages", "audit_log", "configuration", "outbox_jobs"]) expect(migrations).toContain(`CREATE TABLE ${table}`);
    expect(migrations).toContain("CHECK(advance_amount_pkr IS NULL OR (typeof(advance_amount_pkr) = 'integer' AND advance_amount_pkr > 0))");
    expect(migrations).toContain("total_payable INTEGER NOT NULL CHECK(typeof(total_payable) = 'integer' AND total_payable = seed_price + fertilizer_fee + delivery_fee)");
    expect(readFileSync("migrations/0007_dynamic_catalog.sql", "utf8")).not.toMatch(/INSERT INTO (products|province_delivery_rates)/);
    expect(readFileSync("migrations/0008_catalog_category.sql", "utf8")).toContain("ALTER TABLE products ADD COLUMN category");
    expect(migrations).not.toMatch(/INSERT INTO products\s*\([^)]*\)\s*VALUES\s*\([^)]*\)/i);
    expect(migrations).not.toMatch(/INSERT INTO province_delivery_rates\s*\([^)]*\)\s*VALUES\s*\([^)]*\)/i);
    expect(schema).not.toContain("google");
  });

  it("keeps live CAPI disabled without a clean event source", async () => {
    await expect(new MetaCapiProvider({ enabled: false, graphVersion: "v26.0" }).send({ eventId: "lead_FS-100001", eventName: "Lead", orderNumber: "FS-100001" })).rejects.toThrow("META_CAPI_DISABLED");
  });
});
