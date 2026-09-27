import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MetaWhatsAppProvider, MetaCapiProvider, isTerminalOutboxStatus, paymentInstructions, retryDelaySeconds, shouldDeadLetter, storeReceipt } from "@gfs/core";

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
    for (const method of ["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"] as const) expect(paymentInstructions(method, {}).configured).toBe(false);
    expect(paymentInstructions("JAZZCASH", { PAYMENT_JAZZCASH: "Garden Shop synthetic wallet" }).configured).toBe(true);
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
    for (const table of ["customers", "leads", "orders", "payments", "payment_receipts", "meta_attribution", "capi_events", "whatsapp_events", "outbound_messages", "audit_log", "configuration", "outbox_jobs"]) expect(schema).toContain(`CREATE TABLE ${table}`);
    expect(schema).not.toContain("google");
  });

  it("keeps live CAPI disabled without a clean event source", async () => {
    await expect(new MetaCapiProvider({ enabled: false, graphVersion: "v26.0" }).send({ eventId: "lead_FS-100001", eventName: "Lead", orderNumber: "FS-100001" })).rejects.toThrow("META_CAPI_DISABLED");
  });
});
