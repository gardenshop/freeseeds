import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

describe("GFS-111 WhatsApp content admin", () => {
  it("keeps the content page Access-protected", async () => {
    expect((await app.fetch(new Request("https://admin.example.test/whatsapp-content"), env)).status).toBe(403);
    expect((await app.fetch(new Request("https://admin.example.test/api/whatsapp-content"), env)).status).toBe(403);
  });

  it("keeps private content-media uploads CSRF-protected", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/whatsapp-content/media", { method: "POST", headers: auth, body: new Uint8Array([137, 80, 78, 71]) }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "CSRF_VALIDATION_FAILED" });
  });

  it("requires CSRF and rejects an unapproved template key before a write", async () => {
    const csrf = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env);
    const token = (await csrf.json() as { csrfToken: string }).csrfToken;
    const cookie = csrf.headers.get("set-cookie")!.split(";", 1)[0];
    const headers = { ...auth, origin: "https://admin.example.test", cookie, "x-csrf-token": token, "content-type": "application/json" };
    const noCsrf = await app.fetch(new Request("https://admin.example.test/api/whatsapp-content/WELCOME/draft", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: "{}" }), env);
    expect(noCsrf.status).toBe(403);
    const invalidKey = await app.fetch(new Request("https://admin.example.test/api/whatsapp-content/UNSAFE/draft", { method: "POST", headers, body: JSON.stringify({ confirmation: "UNSAFE" }) }), env);
    expect(invalidKey.status).toBe(400);
    expect(await invalidKey.json()).toEqual({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" });
  });
});
