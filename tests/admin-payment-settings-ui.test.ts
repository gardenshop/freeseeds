import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const origin = "https://admin.example.test";
const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];

describe("payment settings generated UI", () => {
  it("renders one canonical protected route with an independently compilable script", async () => {
    const response = await app.fetch(new Request(`${origin}/payment-settings`, {
      headers: { "cf-access-authenticated-user-email": "admin@example.test" }
    }), env);
    expect(response.status).toBe(200);
    const html = await response.text();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script as string)).not.toThrow();
    expect(html).toContain("JazzCash");
    expect(html).toContain("Easypaisa");
    expect(html).toContain("Bank Transfer");
    expect(html).toContain("Advanced EN / UR copy");
    expect(script).toContain("item[0]+suffix");
    expect(script).not.toContain("prefix+item[0]");
    expect(script).toContain("current[item[0]+suffix]");
    expect(script).toContain("headingUr");
    expect(script).toContain("shortInstructionsUr");
    expect(html).toContain("/whatsapp-content");
    expect(html).toContain("/api/payment-instructions/");
    expect(html).toContain("X-CSRF-Token");
    expect(html).toContain("/api/payment-methods/");
    expect(script).toContain("QR preview only");
    expect(script).toContain("independent ownership evidence");
    expect(html).not.toContain("qrOwnerVerified");
    expect(response.headers.get("set-cookie")).toMatch(/__Host-gfs_admin_csrf=[a-f0-9]{64}/);
  });

  it("rejects self-service QR ownership verification", async () => {
    const page = await app.fetch(new Request(`${origin}/payment-settings`, {
      headers: { "cf-access-authenticated-user-email": "admin@example.test" }
    }), env);
    const cookie = page.headers.get("set-cookie")?.match(/__Host-gfs_admin_csrf=([a-f0-9]{64})/)?.[1];
    expect(cookie).toBeTruthy();

    const response = await app.fetch(new Request(`${origin}/api/payment-methods/JAZZCASH`, {
      method: "POST",
      headers: {
        "cf-access-authenticated-user-email": "admin@example.test",
        "content-type": "application/json",
        origin,
        cookie: `__Host-gfs_admin_csrf=${cookie}`,
        "x-csrf-token": cookie as string
      },
      body: JSON.stringify({ qrOwnerVerified: true })
    }), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "QR_OWNERSHIP_REQUIRES_INDEPENDENT_EVIDENCE" });
  });

  it("requires separate valid English and Urdu settings before enabling a method", async () => {
    const page = await app.fetch(new Request(`${origin}/payment-settings`, {
      headers: { "cf-access-authenticated-user-email": "admin@example.test" }
    }), env);
    const cookie = page.headers.get("set-cookie")?.match(/__Host-gfs_admin_csrf=([a-f0-9]{64})/)?.[1] as string;
    const headers = {
      "cf-access-authenticated-user-email": "admin@example.test",
      "content-type": "application/json",
      origin,
      cookie: `__Host-gfs_admin_csrf=${cookie}`,
      "x-csrf-token": cookie
    };
    const base = {
      recipientName: "Synthetic Recipient",
      tillId: "SYNTHETIC_ACCOUNT",
      instructions: "Pay {amount} to {recipientName} using {tillId}.",
      referenceInstruction: "Include the order reference {orderNumber}.",
      receiptInstructions: "Share the receipt in this chat.",
      enabled: true
    };
    const missingUrdu = await app.fetch(new Request(`${origin}/api/payment-methods/JAZZCASH`, {
      method: "POST", headers, body: JSON.stringify(base)
    }), env);
    expect(missingUrdu.status).toBe(400);
    await expect(missingUrdu.json()).resolves.toMatchObject({ error: "PAYMENT_URDU_TRANSLATION_MISSING" });

    const mixedEnglish = await app.fetch(new Request(`${origin}/api/payment-methods/JAZZCASH`, {
      method: "POST", headers, body: JSON.stringify({ ...base, instructions: "بینک ادائیگی کریں" })
    }), env);
    expect(mixedEnglish.status).toBe(400);
    await expect(mixedEnglish.json()).resolves.toMatchObject({ error: "PAYMENT_COPY_LANGUAGE_MIXED" });

    const missingPlaceholders = await app.fetch(new Request(`${origin}/api/payment-methods/JAZZCASH`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...base,
        instructions: "Pay using the selected method.",
        referenceInstruction: "Include the reference.",
        headingUr: "جازکیش ادائیگی",
        instructionsUr: "منتخب طریقے سے ادائیگی کریں۔",
        referenceInstructionUr: "حوالہ شامل کریں۔",
        receiptInstructionsUr: "رسید اسی چیٹ میں بھیجیں۔"
      })
    }), env);
    expect(missingPlaceholders.status).toBe(400);
    await expect(missingPlaceholders.json()).resolves.toMatchObject({ error: "PAYMENT_COPY_PLACEHOLDER_MISSING" });

    const complete = await app.fetch(new Request(`${origin}/api/payment-methods/JAZZCASH`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...base,
        heading: "JazzCash payment",
        headingUr: "جازکیش ادائیگی",
        instructionsUr: "{amount} روپے {recipientName} کو {tillId} کے ذریعے ادا کریں۔",
        referenceInstructionUr: "آرڈر کا حوالہ {orderNumber} شامل کریں۔",
        receiptInstructionsUr: "رسید اسی چیٹ میں شیئر کریں۔"
      })
    }), env);
    expect(complete.status).toBe(400);
    await expect(complete.json()).resolves.toMatchObject({ error: "PAYMENT_RECIPIENT_OWNERSHIP_UNVERIFIED" });
  });

  it("keeps the route Access-protected", async () => {
    const response = await app.fetch(new Request(`${origin}/payment-settings`), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
  });
});
