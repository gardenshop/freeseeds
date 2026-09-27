import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MetaWhatsAppProvider, MetaCapiProvider, formatPaymentMessage, isPaymentMethodComplete, isTerminalOutboxStatus, paymentInstructions, retryDelaySeconds, selectPaymentMethod, shouldDeadLetter, storePaymentQr, storeReceipt, validatePaymentQr } from "@gfs/core";

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

  it("contains all required D1 tables and no third-party CRM dependency", () => {
    const schema = readFileSync("migrations/0001_initial.sql", "utf8");
    for (const table of ["customers", "leads", "orders", "payments", "payment_receipts", "payment_methods", "meta_attribution", "capi_events", "whatsapp_events", "outbound_messages", "audit_log", "configuration", "outbox_jobs"]) expect(schema + readFileSync("migrations/0002_payment_methods.sql", "utf8")).toContain(`CREATE TABLE ${table}`);
    expect(schema).not.toContain("google");
  });

  it("keeps live CAPI disabled without a clean event source", async () => {
    await expect(new MetaCapiProvider({ enabled: false, graphVersion: "v26.0" }).send({ eventId: "lead_FS-100001", eventName: "Lead", orderNumber: "FS-100001" })).rejects.toThrow("META_CAPI_DISABLED");
  });
});
