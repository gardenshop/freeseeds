import { describe, expect, it } from "vitest";
import app, { whatsappContentMediaSnapshotMatches } from "../apps/admin/src/index";

const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

describe("GFS-111 WhatsApp content admin", () => {
  it("keeps the content page Access-protected", async () => {
    expect((await app.fetch(new Request("https://admin.example.test/whatsapp-content"), env)).status).toBe(403);
    expect((await app.fetch(new Request("https://admin.example.test/api/whatsapp-content"), env)).status).toBe(403);
  });

  it("renders the protected multiple-image gallery controls and local optimizer", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/whatsapp-content", { headers: auth }), env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("multiple accept=\"image/png,image/jpeg,image/webp\"");
    expect(html).toContain("createImageBitmap");
    expect(html).toContain("Set active");
    expect(html).toContain("softDisabled");
    expect(html).toContain("Actual WhatsApp preview");
    expect(html).toContain("data-action-ids");
  });

  it("detects gallery-only changes against the immutable published snapshot", () => {
    const published = [{ id: "media-old", active: 1, sort_order: 0 }];
    expect(whatsappContentMediaSnapshotMatches(published, published)).toBe(true);
    expect(whatsappContentMediaSnapshotMatches([{ id: "media-new", active: 1, sort_order: 0 }], published)).toBe(false);
    expect(whatsappContentMediaSnapshotMatches([{ id: "media-old", active: 0, sort_order: 10 }], published)).toBe(false);
  });

  it("creates and publishes a new version for a gallery-only change", async () => {
    const batches: Array<Array<{ sql: string; args: unknown[] }>> = [];
    const db = {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const statement = {
          sql,
          get args() { return args; },
          bind: (...values: unknown[]) => { args = values; return statement; },
          first: async () => {
            if (sql.includes("SELECT published_version,draft_version")) return { published_version: 1, draft_version: 1 };
            if (sql.includes("SELECT status,content_en_json")) return { status: "PUBLISHED", content_en_json: '{"text":"Welcome"}', content_ur_json: '{"text":"خوش آمدید"}', media_r2_key: null };
            if (sql.includes("MAX(version)")) return { version: 1 };
            return null;
          },
          all: async () => {
            if (sql.includes("version_action_labels")) return { results: [
              { action_id: "LANG_EN", label_en: "English", label_ur: "انگریزی" },
              { action_id: "LANG_UR", label_en: "Urdu", label_ur: "اردو" }
            ] };
            if (sql.includes("FROM whatsapp_content_media WHERE")) return { results: [{ id: "media-new", active: 1, sort_order: 0 }] };
            if (sql.includes("FROM whatsapp_content_version_media")) return { results: [{ id: "media-old", active: 1, sort_order: 0 }] };
            return { results: [] };
          },
          run: async () => ({ success: true })
        };
        return statement;
      },
      batch: async (statements: Array<{ sql: string; args: unknown[] }>) => { batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args }))); return []; }
    } as unknown as D1Database;
    const testEnv = { ...env, DB: db };
    const csrf = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), testEnv);
    const token = (await csrf.json() as { csrfToken: string }).csrfToken;
    const cookie = csrf.headers.get("set-cookie")!.split(";", 1)[0];
    const response = await app.fetch(new Request("https://admin.example.test/api/whatsapp-content/WELCOME/publish", {
      method: "POST",
      headers: { ...auth, origin: "https://admin.example.test", cookie, "x-csrf-token": token, "content-type": "application/json" },
      body: JSON.stringify({ version: 1, confirmation: "WELCOME:1" })
    }), testEnv);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ publishedVersion: 2, rolledBack: false });
    expect(batches).toHaveLength(1);
    expect(batches[0].some((statement) => statement.sql.startsWith("INSERT INTO whatsapp_content_template_versions") && statement.args[2] === 2)).toBe(true);
    expect(batches[0].some((statement) => statement.sql.startsWith("INSERT INTO whatsapp_content_version_media") && statement.args[1] === 2 && statement.args[2] === "media-new")).toBe(true);
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
