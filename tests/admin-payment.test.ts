import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];
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

  it("keeps the amount endpoint Access-protected and rejects non-positive values", async () => {
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/payment-configuration"), env);
    expect(unauthorized.status).toBe(403);

    const invalid = await app.fetch(new Request("https://admin.example.test/api/payment-configuration", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ advanceAmountPkr: 0 })
    }), env);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "PAYMENT_AMOUNT_INVALID" });

    const valid = await app.fetch(new Request("https://admin.example.test/api/payment-configuration", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ advanceAmountPkr: 250 })
    }), env);
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ ok: true, advanceAmountPkr: 250 });
  });

  it("protects catalog mutations and validates prices before a write", async () => {
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/catalog/products", { method: "POST", body: "{}" }), env);
    expect(unauthorized.status).toBe(403);

    const invalidProduct = await app.fetch(new Request("https://admin.example.test/api/catalog/products", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ code: "SYNTHETIC", name: "Synthetic product", category: "Synthetic", pricePkr: -1, fertilizerPricePkr: null, active: false })
    }), env);
    expect(invalidProduct.status).toBe(400);
    expect(await invalidProduct.json()).toEqual({ error: "PRODUCT_PRICE_INVALID" });

    const invalidRate = await app.fetch(new Request("https://admin.example.test/api/catalog/province-delivery-rates", {
      method: "POST",
      headers: { "cf-access-authenticated-user-email": "admin@example.test", "content-type": "application/json" },
      body: JSON.stringify({ province: "Synthetic Province", deliveryFeePkr: 0, active: false })
    }), env);
    expect(invalidRate.status).toBe(400);
    expect(await invalidRate.json()).toEqual({ error: "DELIVERY_RATE_INVALID" });
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
