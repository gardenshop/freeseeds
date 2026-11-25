import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import admin from "../apps/admin/src/index";
import api from "../apps/api/src/index";

const adminEnv = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" };
const adminIdentity = { "cf-access-authenticated-user-email": "admin@example.test" };

async function signedWebhook(payload: string, signatureOverride?: string) {
  const secret = "synthetic-hono-webhook-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return api.fetch(new Request("https://api.example.test/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signatureOverride ?? `sha256=${signature}` },
    body: payload
  }), {
    META_PROVIDER_ENABLED: "true",
    META_PHONE_NUMBER_ID: "synthetic-phone-number",
    META_APP_SECRET: secret,
    DEPLOYMENT_STATE: "LOCAL"
  } as never);
}

async function middlewareProbe(middlewarePath: string, routePath: string, requestPath: string) {
  const app = new Hono();
  let middlewareCalls = 0;
  let protectedHandlerCalls = 0;
  app.use(middlewarePath, async (c, next) => {
    middlewareCalls += 1;
    if (c.req.header("authorization") !== "Bearer synthetic") return c.text("UNAUTHORIZED", 401);
    await next();
  });
  app.get(routePath, (c) => {
    protectedHandlerCalls += 1;
    return c.text("PROTECTED_HANDLER_REACHED");
  });
  const response = await app.request(`https://router.example.test${requestPath}`);
  return { response, middlewareCalls, protectedHandlerCalls };
}

describe("Hono security and Worker authorization boundaries", () => {
  it.each([
    ["/api/:tenant{[^/]+}/admin/*", "/api/:tenant/admin/:id", "/api/acme/admin/secret"],
    ["/admin/*", "/admin*", "/admin/secret"]
  ])("enforces authorization for wildcard route pattern %s", async (middlewarePath, routePath, requestPath) => {
    const result = await middlewareProbe(middlewarePath, routePath, requestPath);
    expect(result.response.status).toBe(401);
    expect(result.middlewareCalls).toBe(1);
    expect(result.protectedHandlerCalls).toBe(0);
  });

  it.each(["%0A", "%0D", "%E2%80%A8", "%E2%80%A9"]) ("runs global auth middleware for encoded line-terminator path %s", async (encodedTerminator) => {
    const result = await middlewareProbe("*", "/api/orders/:id", `/api/orders/${encodedTerminator}`);
    expect(result.response.status).toBe(401);
    expect(result.middlewareCalls).toBe(1);
    expect(result.protectedHandlerCalls).toBe(0);
  });

  it("keeps unauthenticated and mismatched Access users out of protected Admin and financial POST routes", async () => {
    const deniedRead = await admin.fetch(new Request("https://admin.example.test/api/csrf"), adminEnv as never);
    const mismatchedRead = await admin.fetch(new Request("https://admin.example.test/api/orders/synthetic-order"), {
      ...adminEnv,
      ADMIN_EMAIL: "different-admin@example.test"
    } as never);
    const deniedFinancialPost = await admin.fetch(new Request("https://admin.example.test/api/payments/synthetic-payment/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "synthetic-order", confirmation: "SYNTHETIC-ORDER" })
    }), adminEnv as never);

    expect(deniedRead.status).toBe(403);
    expect(mismatchedRead.status).toBe(403);
    expect(deniedFinancialPost.status).toBe(403);
    expect(await deniedFinancialPost.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
  });

  it("accepts an authorized Admin request and preserves health-only Access service identity", async () => {
    const csrf = await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers: adminIdentity }), adminEnv as never);
    expect(csrf.status).toBe(200);
    expect(typeof (await csrf.json() as { csrfToken?: unknown }).csrfToken).toBe("string");

    const accessHealth = await admin.fetch(new Request("https://admin.example.test/health"), adminEnv as never, {
      access: { getIdentity: async () => ({}) }
    } as never);
    const accessOrders = await admin.fetch(new Request("https://admin.example.test/orders"), adminEnv as never, {
      access: { getIdentity: async () => ({}) }
    } as never);
    expect(accessHealth.status).toBe(200);
    expect(accessOrders.status).toBe(403);
  });

  it("rejects unsigned API webhooks and accepts a valid synthetic Meta signature", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "synthetic-phone-number" }, messages: [] } }] }]
    });
    const rejected = await signedWebhook(payload, "sha256=invalid");
    expect(rejected.status).toBe(403);

    const accepted = await signedWebhook(payload);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ accepted: true, eventCount: 0, autoReplies: 0 });
  });
});
