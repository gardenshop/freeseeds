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
    expect(html).toContain("/whatsapp-content");
    expect(html).toContain("/api/payment-instructions/");
    expect(html).toContain("X-CSRF-Token");
    expect(html).toContain("/api/payment-methods/");
    expect(response.headers.get("set-cookie")).toMatch(/__Host-gfs_admin_csrf=[a-f0-9]{64}/);
  });

  it("keeps the route Access-protected", async () => {
    const response = await app.fetch(new Request(`${origin}/payment-settings`), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
  });
});
