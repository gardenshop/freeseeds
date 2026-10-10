import { describe, expect, it, vi } from "vitest";
import admin from "../apps/admin/src/index";
import { createMetaActivationService, META_SEND_TEST_MESSAGE, META_SEND_TEST_RECIPIENT } from "@gfs/core";

const accessHeaders = { "cf-access-authenticated-user-email": "admin@example.test" };

describe("Meta activation safety boundary", () => {
  it("does not call Graph or expose a token when the secret binding is missing", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const service = createMetaActivationService({ accessToken: undefined, phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher });
    const status = await service.status();

    expect(fetcher).not.toHaveBeenCalled();
    expect(status.graph).toEqual({ configured: false, version: "v26.0", permissions: [] });
    expect(JSON.stringify(status)).not.toContain("token");
    expect(status.phone.state).toBe("not_configured");
    expect(status.wabaSubscription.state).toBe("not_configured");
  });

  it("sanitizes Graph errors and whitelists read fields", async () => {
    const token = "secret-token-fixture";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: `leaked ${token}`, access_token: token }, id: "phone-id", status: "ACTIVE" }), { status: 500 }));
    const service = createMetaActivationService({ accessToken: token, phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher });
    const status = await service.status();

     expect(fetcher).toHaveBeenCalledTimes(3);
    expect(status.graph.error).toEqual({ code: "META_GRAPH_REQUEST_FAILED", status: 500 });
    expect(JSON.stringify(status)).not.toContain(token);
    expect(JSON.stringify(status)).not.toContain("leaked");
    expect(status.phone.registrationStatus).toBeUndefined();
  });

  it("uses the official Graph read endpoints only through the secret-backed client", async () => {
    const token = "secret-token-fixture";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "phone-id", display_phone_number: "+923000000000", verified_name: "Free Seeds", name_status: "APPROVED", quality_rating: "GREEN", status: "CONNECTED", internal_secret: token }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ whatsapp_business_api_data: { id: "app-id" }, access_token: token }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ permission: "whatsapp_business_messaging", status: "granted" }, { permission: "whatsapp_business_management", status: "granted" }] }), { status: 200 }));
    const status = await createMetaActivationService({ accessToken: token, phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher }).status();

    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    expect(status.phone).toMatchObject({ state: "available", displayNumber: "+923000000000", verifiedName: "Free Seeds", nameStatus: "APPROVED", qualityRating: "GREEN", registrationStatus: "CONNECTED" });
    expect(status.wabaSubscription).toMatchObject({ state: "subscribed", subscribed: true });
    expect(JSON.stringify(status)).not.toContain(token);
  });

  it("keeps protected OTP/PIN fields out of the action response and performs no send", async () => {
    const response = await admin.fetch(new Request("https://admin.example.test/api/meta-activation/actions/controlled-test", {
      method: "POST",
      headers: { ...accessHeaders, "content-type": "application/json" },
      body: JSON.stringify({ otp: "123456", pin: "987654", password: "not-for-logs", accessToken: "request-token" })
    }), { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", META_PHONE_NUMBER_ID: "phone-id", META_WABA_ID: "waba-id", META_APP_ID: "app-id" } as never);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ action: "controlled-test", executed: false, reason: "READ_ONLY_ACTIVATION" });
    expect(JSON.stringify(body)).not.toMatch(/123456|987654|not-for-logs|request-token/);
    expect(body).not.toHaveProperty("otp");
    expect(body).not.toHaveProperty("pin");
    expect((body.status as Record<string, unknown>).controlledTest).toEqual({ allowed: true, sendsMessages: false, performsMutations: false });
  });

  it("calls the official activation endpoints with allowlisted arguments and rereads status", async () => {
    const token = "fixture-token-not-for-output";
    const otp = "123456";
    const pin = "987654";
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ id: "opaque-result" }), { status: 200 });
      const url = String(input);
      return url.includes("subscribed_apps")
        ? new Response(JSON.stringify({ data: [] }), { status: 200 })
        : new Response(JSON.stringify({ id: "phone-id", status: "PENDING" }), { status: 200 });
    });
    const service = createMetaActivationService({ accessToken: token, phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher });

    const request = await service.action("request-code", { codeMethod: "SMS", locale: "en_US" });
    const duplicate = await service.action("request-code", { codeMethod: "SMS", locale: "en_US" });
    const verify = await service.action("verify-code", { otp });
    const register = await service.action("register", { pin });
    const subscribe = await service.action("subscribe-app");
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === "POST");

    expect(request).toMatchObject({ action: "request-code", executed: true, reason: "GRAPH_MUTATION_APPLIED" });
    expect(duplicate.reason).toBe("META_REQUEST_CODE_ALREADY_SENT");
    expect(verify.executed).toBe(true);
    expect(register.executed).toBe(true);
    expect(subscribe.executed).toBe(true);
    expect(posts).toHaveLength(4);
    expect(posts[0]?.[0]).toBe("https://graph.facebook.com/v26.0/phone-id/request_code");
    expect(JSON.parse(String(posts[0]?.[1]?.body))).toEqual({ code_method: "SMS", locale: "en_US" });
    expect(posts[1]?.[0]).toBe("https://graph.facebook.com/v26.0/phone-id/verify_code");
    expect(JSON.parse(String(posts[1]?.[1]?.body))).toEqual({ code: otp });
    expect(posts[2]?.[0]).toBe("https://graph.facebook.com/v26.0/phone-id/register");
    expect(JSON.parse(String(posts[2]?.[1]?.body))).toEqual({ messaging_product: "whatsapp", pin });
    expect(posts[3]?.[0]).toBe("https://graph.facebook.com/v26.0/waba-id/subscribed_apps");
    expect(posts[3]?.[1]?.body).toBeUndefined();
    expect(JSON.stringify({ request, duplicate, verify, register, subscribe })).not.toMatch(new RegExp(`${token}|${otp}|${pin}`));
  });

  it("keeps status-only activation actions from mutating Graph", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const service = createMetaActivationService({ accessToken: "fixture-token", phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher });
    const result = await service.action("provider");

    expect(result).toMatchObject({ action: "provider", executed: false, reason: "READ_ONLY_ACTIVATION" });
    expect(fetcher.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });

  it("keeps the activation API behind Access", async () => {
    const response = await admin.fetch(new Request("https://admin.example.test/api/meta-activation/status"), { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never);
    expect(response.status).toBe(403);
  });

  it("sends only the fixed test message to the fixed recipient through Graph", async () => {
    const token = "fixture-send-test-token";
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ messages: [{ id: "wamid.test-message-1" }], access_token: token }), { status: 200 });
      return new Response(JSON.stringify({ id: "phone-id", status: "CONNECTED", access_token: token }), { status: 200 });
    });
    const service = createMetaActivationService({ accessToken: token, providerEnabled: true, phoneNumberId: "phone-id", wabaId: "waba-id", appId: "app-id", fetcher });

    const result = await service.action("send-test");
    const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST");

    expect(result).toMatchObject({ action: "send-test", executed: true, reason: "META_TEST_MESSAGE_SENT", messageId: "wamid.test-message-1", httpStatus: 200 });
    expect(post?.[0]).toBe("https://graph.facebook.com/v26.0/phone-id/messages");
    expect(post?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: META_SEND_TEST_RECIPIENT,
      type: "text",
      text: { preview_url: false, body: META_SEND_TEST_MESSAGE }
    });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("returns only sanitized Graph failure details for the send action", async () => {
    const token = "fixture-send-error-token";
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ error: { code: "131000", message: `secret ${token} must not escape` }, access_token: token }), { status: 400 });
      return new Response(JSON.stringify({ id: "phone-id", access_token: token }), { status: 200 });
    });
    const result = await createMetaActivationService({ accessToken: token, providerEnabled: true, phoneNumberId: "phone-id", fetcher }).action("send-test");

    expect(result).toMatchObject({ action: "send-test", executed: false, reason: "META_GRAPH_REQUEST_FAILED", error: { code: "131000", status: 400 } });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain("must not escape");
  });

  it("rejects an arbitrary recipient at the Access-protected endpoint", async () => {
    const response = await admin.fetch(new Request("https://admin.example.test/api/meta-activation/actions/send-test", {
      method: "POST",
      headers: { ...accessHeaders, "content-type": "application/json" },
      body: JSON.stringify({ to: "+923000000000" })
    }), { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", META_ACCESS_TOKEN: "fixture-token", META_PROVIDER_ENABLED: "true", META_PHONE_NUMBER_ID: "phone-id" } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "META_SEND_TEST_RECIPIENT_FIXED" });
  });
});
