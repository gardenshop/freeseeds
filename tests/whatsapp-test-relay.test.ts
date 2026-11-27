import { describe, expect, it } from "vitest";
import { isolatedTestRelayUrl, signMetaWebhook, splitTestWebhookPayload } from "../apps/api/src/whatsapp-test-relay.js";

const testWaId = "+15555550123";

describe("isolated CTWA webhook relay", () => {
  it("splits only the allowlisted test messages and statuses from ordinary customer events", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "synthetic-waba", changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { phone_number_id: "synthetic-business-phone" },
        contacts: [{ wa_id: "15555550123", profile: { name: "Private synthetic" } }],
        messages: [{ id: "synthetic-test-inbound", from: "15555550123", type: "text", text: { body: "Hi" } }, { id: "synthetic-ordinary-inbound", from: "15555550124", type: "text", text: { body: "Hello" } }],
        statuses: [{ id: "synthetic-test-status", recipient_id: "15555550123", status: "delivered" }, { id: "synthetic-ordinary-status", recipient_id: "15555550124", status: "read" }]
      } }] }]
    };
    const split = splitTestWebhookPayload(payload, testWaId);
    const testValue = split.test!.entry![0]!.changes![0]!.value!;
    const productionValue = split.production!.entry![0]!.changes![0]!.value!;
    expect(testValue.messages).toEqual([{ id: "synthetic-test-inbound", from: "15555550123", type: "text", text: { body: "Hi" } }]);
    expect(testValue.statuses).toEqual([{ id: "synthetic-test-status", recipient_id: "15555550123", status: "delivered" }]);
    expect(testValue).not.toHaveProperty("contacts");
    expect(productionValue.messages).toEqual([{ id: "synthetic-ordinary-inbound", from: "15555550124", type: "text", text: { body: "Hello" } }]);
    expect(productionValue.statuses).toEqual([{ id: "synthetic-ordinary-status", recipient_id: "15555550124", status: "read" }]);
    expect(productionValue).not.toHaveProperty("contacts");
  });

  it("keeps ordinary payloads unchanged when no test-recipient event is present", () => {
    const payload = { object: "whatsapp_business_account", entry: [{ id: "synthetic-waba", changes: [{ field: "messages", value: { messages: [{ id: "ordinary", from: "15555550124" }] } }] }] };
    expect(splitTestWebhookPayload(payload, testWaId)).toEqual({ production: payload });
  });

  it("accepts only HTTPS workers.dev webhook URLs for relay", () => {
    expect(isolatedTestRelayUrl("https://getfreeseeds-api-wa-test.get-free-seeds.workers.dev/webhooks/whatsapp")).toBe("https://getfreeseeds-api-wa-test.get-free-seeds.workers.dev/webhooks/whatsapp");
    expect(isolatedTestRelayUrl("http://getfreeseeds-api-wa-test.get-free-seeds.workers.dev/webhooks/whatsapp")).toBeUndefined();
    expect(isolatedTestRelayUrl("https://example.com/webhooks/whatsapp")).toBeUndefined();
    expect(isolatedTestRelayUrl("https://getfreeseeds-api-wa-test.get-free-seeds.workers.dev/webhooks/whatsapp?redirect=1")).toBeUndefined();
    expect(isolatedTestRelayUrl("https://getfreeseeds-api-wa-test.other-account.workers.dev/webhooks/whatsapp")).toBeUndefined();
  });

  it("signs the transformed payload for the candidate's normal webhook verification", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({ entry: [] }));
    const body = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(body).set(encoded);
    const signature = await signMetaWebhook(body, "synthetic-app-secret");
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("synthetic-app-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const rawSignature = Uint8Array.from(signature.slice(7).match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
    expect(await crypto.subtle.verify("HMAC", key, rawSignature, body)).toBe(true);
  });
});
