import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];

describe("admin payment configuration", () => {
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
});
