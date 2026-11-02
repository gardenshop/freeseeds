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
  it("reports reminders as not deployed when the reminder schema is unavailable", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/payment-reminders", { headers: access }), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "REMINDERS_NOT_DEPLOYED",
      message: "Reminder migrations are not deployed on this database; no schedules, templates, or deliveries are available."
    });
  });

  it("renders transaction-reference, reference-request and settlement-confirmation controls", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: access }), env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Save Reference");
    expect(html).toContain("Request Reference");
    expect(html).toContain("Receiving-account settlement evidence reference");
    expect(html).toContain("I verified the actual credit in the authorized Garden Shop receiving account");
    expect(html).toContain("Confirm PAID");
    expect(html).toContain("Use the settlement-confirmation panel; direct approval is disabled.");
    expect(html).toContain("settlementEvidenceRef:evidenceRef(),settlementConfirmed:true");
    expect(html).not.toContain("Approve after verified settlement");
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

  it("renders a payment-copy preview without requiring a legacy fixed amount", async () => {
    const sql: string[] = [];
    const previewEnv = {
      ...env,
      DB: {
        prepare(query: string) {
          sql.push(query);
          const statement = {
            bind: (..._args: unknown[]) => statement,
            first: async () => ({
              id: "synthetic-method",
              method: "JAZZCASH",
              display_name: "JazzCash",
              recipient_name: "Synthetic Recipient",
              till_id: "SYNTHETIC-TILL",
              instructions: "Pay {amount} to {recipientName}.",
              reference_instruction: "Include {orderNumber}.",
              enabled: 1,
              sort_order: 10
            })
          };
          return statement;
        }
      }
    } as unknown as Parameters<typeof app.fetch>[1];
    const response = await app.fetch(new Request("https://admin.example.test/api/payment-instructions/JAZZCASH", { headers: access }), previewEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ method: "JAZZCASH", configured: true });
    expect(sql.some((query) => query.includes("payment_configuration"))).toBe(false);
  });

  it("reports dynamic payment methods as configured when the legacy amount is null", async () => {
    const row = {
      id: "synthetic-method",
      method: "JAZZCASH",
      display_name: "JazzCash",
      recipient_name: "Synthetic Recipient",
      till_id: "SYNTHETIC-TILL",
      instructions: "Pay {amount} to {recipientName}.",
      reference_instruction: "Include {orderNumber}.",
      enabled: 1,
      sort_order: 10
    };
    const dynamicEnv = {
      ...env,
      DEPLOYMENT_STATE: "LOCAL",
      DB: {
        prepare(query: string) {
          const statement = {
            bind: (..._args: unknown[]) => statement,
            all: async () => ({ results: query.includes("payment_methods") ? [row] : [] }),
            first: async () => null
          };
          return statement;
        }
      }
    } as unknown as Parameters<typeof app.fetch>[1];
    const response = await app.fetch(new Request("https://admin.example.test/api/configuration", { headers: access }), dynamicEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ advanceAmountPkr: null, paymentMethods: [{ method: "JAZZCASH", configured: true }] });
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
