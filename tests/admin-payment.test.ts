import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];
const v2Env = { ...env, PAYMENT_CONFIRMATION_V2_UI_ENABLED: "true", PAYMENT_CONFIRMATION_V2_ENABLED: "false" } as NonNullable<Parameters<typeof app.fetch>[1]> & { PAYMENT_CONFIRMATION_V2_ENABLED: string };
const access = { "cf-access-authenticated-user-email": "admin@example.test" };

async function csrfHeaders(contentType = "application/json") {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: access }), env);
  const data = await response.json() as { csrfToken: string };
  return { ...access, "content-type": contentType, origin: "https://admin.example.test", cookie: `__Host-gfs_admin_csrf=${data.csrfToken}`, "x-csrf-token": data.csrfToken };
}

describe("admin payment configuration", () => {
  it("renders transaction-reference, reference-request and settlement-confirmation controls", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: access }), env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("singlePaymentConfirmation=addActions");
    expect(html).toContain("Confirm Payment");
    expect(html).toContain("reference:reference.value");
    expect(html).toContain("Request Reference");
    expect(html).toContain("Receiving-account settlement evidence reference");
    expect(html).toContain("I verified the actual credit in the authorized Garden Shop receiving account");
    expect(html).toContain("data.message==='string'");
  });

  it("renders V2 Confirm Paid UI while payment notifications remain disabled", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: access }), v2Env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("data-v2-confirm-paid");
    expect(html).toContain("Confirm Paid");
    expect(html).toContain("I independently checked the authorized Garden Shop receiving account");
    expect(html).toContain("Supplementary evidence (optional)");
    expect(html).not.toContain("singlePaymentConfirmation=addActions");
    expect(html).not.toContain("data-settlement-confirm");
    expect(v2Env.PAYMENT_CONFIRMATION_V2_ENABLED).toBe("false");
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script as string)).not.toThrow();
  });

  it("does not expose the V2 Confirm Paid UI without the isolated UI flag", async () => {
    const response=await app.fetch(new Request("https://admin.example.test/orders",{headers:access}),{...env,PAYMENT_CONFIRMATION_V2_ENABLED:"true"} as Parameters<typeof app.fetch>[1]);
    const html=await response.text();
    expect(response.status).toBe(200);
    expect(html).not.toContain("data-v2-confirm-paid");
    expect(html).toContain("singlePaymentConfirmation=addActions");
  });

  it("leaves the existing V1 Orders source unchanged when the V2 flag is off", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: access }), env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).not.toContain("data-v2-confirm-paid");
    expect(html).toContain("singlePaymentConfirmation=addActions");
  });

  it("keeps the amount endpoint Access-protected and rejects non-positive values", async () => {
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/payment-configuration"), env);
    expect(unauthorized.status).toBe(403);

    const invalid = await app.fetch(new Request("https://admin.example.test/api/payment-configuration", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ advanceAmountPkr: 0 })
    }), env);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "PAYMENT_AMOUNT_INVALID" });

    const noCsrf = await app.fetch(new Request("https://admin.example.test/api/payment-configuration", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ advanceAmountPkr: 250 })
    }), env);
    expect(noCsrf.status).toBe(403);

    const valid = await app.fetch(new Request("https://admin.example.test/api/payment-configuration", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ advanceAmountPkr: 250 })
    }), env);
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ ok: true, advanceAmountPkr: 250 });
  });

  it("protects catalog mutations and validates prices before a write", async () => {
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/catalog/products", { method: "POST", body: "{}" }), env);
    expect(unauthorized.status).toBe(403);

    const missingCsrf = await app.fetch(new Request("https://admin.example.test/api/catalog/products", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ code: "SYNTHETIC", name: "Synthetic product", category: "Synthetic", pricePkr: -1, fertilizerPricePkr: null, active: false })
    }), env);
    expect(missingCsrf.status).toBe(403);

    const invalidProduct = await app.fetch(new Request("https://admin.example.test/api/catalog/products", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ code: "SYNTHETIC", name: "Synthetic product", category: "Synthetic", pricePkr: -1, fertilizerPricePkr: null, active: false })
    }), env);
    expect(invalidProduct.status).toBe(400);
    expect(await invalidProduct.json()).toEqual({ error: "PRODUCT_PRICE_INVALID" });

    const invalidRate = await app.fetch(new Request("https://admin.example.test/api/catalog/province-delivery-rates", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ province: "Synthetic Province", deliveryFeePkr: 0, active: false })
    }), env);
    expect(invalidRate.status).toBe(400);
    expect(await invalidRate.json()).toEqual({ error: "DELIVERY_RATE_INVALID" });

    for (const path of ["/api/catalog/products/synthetic", "/api/catalog/province-delivery-rates/synthetic"]) {
      const response = await app.fetch(new Request(`https://admin.example.test${path}`, {
        method: "PUT",
        headers: { ...access, "content-type": "application/json" },
        body: "{}"
      }), env);
      expect(response.status).toBe(403);
    }

    for (const path of ["/payment-amount", "/catalog", "/tariff"]) {
      const page = await app.fetch(new Request(`https://admin.example.test${path}`, { headers: access }), env);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("X-CSRF-Token");
    }
  });

  it("allows incomplete drafts but validates methods when enabling", async () => {
    const draft = await app.fetch(new Request("https://admin.example.test/api/payment-methods/JAZZCASH", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ recipientName: "", instructions: "", enabled: false })
    }), env);
    expect(draft.status).toBe(200);
    expect(await draft.json()).toMatchObject({ ok: true, configured: false });

    const enabled = await app.fetch(new Request("https://admin.example.test/api/payment-methods/JAZZCASH", {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ recipientName: "", instructions: "", enabled: true })
    }), env);
    expect(enabled.status).toBe(400);
    expect(await enabled.json()).toEqual({
      error: "PAYMENT_METHOD_INCOMPLETE",
      message: "Enabled payment methods require a recipient name and instructions."
    });
  });
});
