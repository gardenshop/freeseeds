import { describe, expect, it } from "vitest";
import { decryptMetaFlowRequest, encryptMetaFlowResponse } from "@gfs/core";
import { handleMetaFlowPayload } from "../apps/api/src/flow-endpoint";
import api from "../apps/api/src/index";

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary);
}

async function makeEnvelope(payload: Record<string, unknown>, keyPair: CryptoKeyPair) {
  const aesBytes = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await crypto.subtle.importKey("raw", aesBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const initialVector = crypto.getRandomValues(new Uint8Array(12));
  const encryptedFlowData = await crypto.subtle.encrypt({ name: "AES-GCM", iv: initialVector, tagLength: 128 }, aesKey, new TextEncoder().encode(JSON.stringify(payload)));
  const encryptedAesKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, keyPair.publicKey, aesBytes);
  return {
    envelope: { encrypted_flow_data: toBase64(encryptedFlowData), encrypted_aes_key: toBase64(encryptedAesKey), initial_vector: toBase64(initialVector) },
    aesKey,
    initialVector
  };
}

describe("Meta encrypted WhatsApp Flow protocol", () => {
  it("decrypts generated RSA-OAEP/AES-GCM data and encrypts the response", async () => {
    const keyPair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]) as CryptoKeyPair;
    const payload = { version: "3.0", action: "ping", data: {} };
    const fixture = await makeEnvelope(payload, keyPair);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pem = `-----BEGIN PRIVATE KEY-----\n${toBase64(privateKey as ArrayBuffer)}\n-----END PRIVATE KEY-----`;
    const decrypted = await decryptMetaFlowRequest(fixture.envelope, pem);
    expect(decrypted.payload).toEqual(payload);
    const encrypted = await encryptMetaFlowResponse({ version: "3.0", data: { status: "active" } }, decrypted.aesKey, decrypted.initialVector);
    const response = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fixture.initialVector, tagLength: 128 }, fixture.aesKey, Uint8Array.from(atob(encrypted), (value) => value.charCodeAt(0)));
    expect(JSON.parse(new TextDecoder().decode(response))).toEqual({ version: "3.0", data: { status: "active" } });
  });

  it("returns safe protocol screens and quote errors without exposing input data", async () => {
    await expect(handleMetaFlowPayload({ version: "3.0", action: "INIT", data: {} })).resolves.toMatchObject({ screen: "CUSTOMER_DETAILS" });
    await expect(handleMetaFlowPayload({ version: "3.0", action: "data_exchange", screen: "ORDER", data: {
      fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567", productCode: "MISSING", province: "Punjab", fertilizerSelected: false
    } }, { prepare: () => ({ bind: () => ({ first: async () => undefined }) }) } as unknown as D1Database)).resolves.toMatchObject({ screen: "ORDER", data: { error: "PRODUCT_NOT_FOUND" } });
    await expect(handleMetaFlowPayload({ version: "3.0", action: "data_exchange", screen: "ORDER", data: { fullName: "x" } })).resolves.toMatchObject({ screen: "ORDER", data: { error: expect.stringMatching(/^[A-Z_]+$/) } });
  });

  it("returns only server quote values and complete payment method names", async () => {
    const db = {
      prepare: (sql: string) => {
        const statement = {
          bind: (..._args: unknown[]) => statement,
          first: async () => sql.includes("FROM products")
            ? { id: "fixture-product", code: "FIXTURE-SEEDS", name: "Fixture Seeds", price_pkr: 300, fertilizer_price_pkr: 50, enabled: 1 }
            : { province: "Punjab", delivery_fee_pkr: 150, enabled: 1 },
          all: async () => ({ results: [
            { display_name: "JazzCash", enabled: 1, recipient_name: "Garden Shop", instructions: "Synthetic instructions" },
            { display_name: "Incomplete", enabled: 1, recipient_name: null, instructions: null }
          ] })
        };
        return statement;
      }
    } as unknown as D1Database;
    const response = await handleMetaFlowPayload({ version: "3.0", action: "data_exchange", screen: "ORDER", data: {
      fullName: "Synthetic Customer", deliveryAddress: "1 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "03001234567", productCode: "FIXTURE-SEEDS", province: "Punjab"
    } }, db);
    expect(response).toMatchObject({ screen: "FERTILIZER", data: { quote: { totalPayablePkr: 450, paymentMethods: ["JazzCash"] } } });
    expect(JSON.stringify(response)).not.toContain("Incomplete");
  });

  it("serves plaintext health checks and encrypted INIT responses", async () => {
    const health = await api.fetch(new Request("https://example.test/webhooks/whatsapp/flows", { method: "POST", body: JSON.stringify({ health_check: "ping" }) }), {} as never);
    await expect(health.json()).resolves.toEqual({ data: { status: "active" } });

    const keyPair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]) as CryptoKeyPair;
    const fixture = await makeEnvelope({ version: "3.0", action: "INIT", data: {} }, keyPair);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pem = `-----BEGIN PRIVATE KEY-----\n${toBase64(privateKey as ArrayBuffer)}\n-----END PRIVATE KEY-----`;
    const response = await api.fetch(new Request("https://example.test/webhooks/whatsapp/flows", { method: "POST", body: JSON.stringify(fixture.envelope), headers: { "content-type": "application/json" } }), { FLOW_PRIVATE_KEY: pem } as never);
    const encrypted = await response.text();
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fixture.initialVector, tagLength: 128 }, fixture.aesKey, Uint8Array.from(atob(encrypted), (value) => value.charCodeAt(0)));
    expect(JSON.parse(new TextDecoder().decode(plaintext))).toMatchObject({ screen: "CUSTOMER_DETAILS" });
  });
});
