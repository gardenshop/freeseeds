import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deterministicMediaIndex, parseWhatsAppContentDraft, publishedWhatsAppContent, renderWhatsAppContent, selectPublishedWhatsAppContentMedia, storeWhatsAppContentMedia, validateWhatsAppContentImage, whatsAppActionLabel, WhatsAppTemplateKey } from "@gfs/core";
import { guidedReplyMediaKey } from "../apps/api/src/index";

describe("GFS-111 WhatsApp content", () => {
  const draft = {
    contentEn: { text: "Order {orderNumber} total PKR {totalPkr}", buttonLabel: "Continue", listButtonLabel: "Choose", listDescription: "Delivery option" },
    contentUr: { text: "آرڈر {orderNumber} کل PKR {totalPkr}", buttonLabel: "جاری رکھیں" },
    mediaR2Key: "whatsapp-content/synthetic-banner.png"
  };

  it("accepts only whitelisted keys, safe placeholders, and private R2 references", () => {
    expect(WhatsAppTemplateKey.safeParse("WELCOME").success).toBe(true);
    expect(WhatsAppTemplateKey.safeParse("ARBITRARY_TEMPLATE").success).toBe(false);
    expect(parseWhatsAppContentDraft(draft)).toMatchObject({ mediaR2Key: "whatsapp-content/synthetic-banner.png" });
    expect(() => parseWhatsAppContentDraft({ ...draft, mediaR2Key: "https://public.example.test/banner.png" })).toThrow("WHATSAPP_CONTENT_MEDIA_KEY_INVALID");
    expect(() => parseWhatsAppContentDraft({ ...draft, contentEn: { text: "Hello {customerName}" } })).toThrow("WHATSAPP_CONTENT_PLACEHOLDER_NOT_ALLOWED");
  });

  it("renders only declared semantic placeholders", () => {
    expect(renderWhatsAppContent("Order {orderNumber}: PKR {totalPkr}", { orderNumber: "FS-SYNTHETIC", totalPkr: 250 })).toBe("Order FS-SYNTHETIC: PKR 250");
    expect(renderWhatsAppContent("Unknown {customerName}", {})).toBe("Unknown {customerName}");
  });

  it("requires the stable per-template action labels and province list copy", () => {
    const welcome = { contentEn: { text: "Welcome", actionLabels: { LANG_EN: "English", LANG_UR: "Urdu" } }, contentUr: { text: "خوش آمدید", actionLabels: { LANG_EN: "انگریزی", LANG_UR: "اردو" } } };
    expect(parseWhatsAppContentDraft(welcome, "WELCOME").contentUr.actionLabels?.LANG_UR).toBe("اردو");
    expect(() => parseWhatsAppContentDraft({ ...welcome, contentEn: { text: "Welcome", actionLabels: { LANG_EN: "English" } } }, "WELCOME")).toThrow("WHATSAPP_CONTENT_ACTION_LABELS_INVALID");
    expect(() => parseWhatsAppContentDraft({ contentEn: { text: "Province" }, contentUr: { text: "صوبہ" } }, "PROVINCE_DELIVERY")).toThrow("WHATSAPP_CONTENT_PROVINCE_LIST_INVALID");
  });

  it("defines stable journey metadata for every WhatsApp template", async () => {
    const migration = await readFile("migrations/0016_whatsapp_content_journey.sql", "utf8");
    expect(migration).toContain("ADD COLUMN flow_order");
    expect(migration).toContain("ADD COLUMN section");
    for (const key of ["WELCOME", "OFFER", "FERTILIZER", "PROVINCE_DELIVERY", "FIELD_FULL_NAME", "FIELD_DELIVERY_ADDRESS", "FIELD_NEARBY_PLACE", "FIELD_CITY", "FIELD_CONTACT_NUMBER", "REVIEW", "CONFIRMATION", "PAYMENT", "RECEIPT", "ORDER_STATUS", "SUPPORT", "VALIDATION"]) expect(migration).toContain(`WHEN '${key}'`);
  });

  it("stores a private master and WhatsApp variant under the exact screen prefix", async () => {
    const writes: Array<{ key: string; metadata: R2PutOptions | undefined }> = [];
    const bucket = {
      put: async (key: string, _body: ArrayBuffer, metadata?: R2PutOptions) => { writes.push({ key, metadata }); },
      delete: async () => undefined
    } as unknown as R2Bucket;
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
    const jpeg = new Uint8Array([255, 216, 255, 224]).buffer;
    const stored = await storeWhatsAppContentMedia(bucket, "PROVINCE_DELIVERY", "synthetic-id", { body: png, mimeType: "image/png" }, { body: jpeg, mimeType: "image/jpeg" });
    expect(stored.masterR2Key).toMatch(/^whatsapp-content\/images\/province-delivery\/synthetic-id\/master-/);
    expect(stored.r2Key).toMatch(/^whatsapp-content\/images\/province-delivery\/synthetic-id\/whatsapp-/);
    expect(writes).toHaveLength(2);
    expect(writes.every((write) => write.metadata?.httpMetadata && "cacheControl" in write.metadata.httpMetadata && write.metadata.httpMetadata.cacheControl === "private, no-store")).toBe(true);
    expect(() => validateWhatsAppContentImage(png, "image/webp", "variant")).toThrow("WHATSAPP_CONTENT_MEDIA_MIME_INVALID");
  });

  it("uses deterministic rotation and persists one stable selection per session", async () => {
    expect(deterministicMediaIndex("checkout-a", "OFFER", 3)).toBe(deterministicMediaIndex("checkout-a", "OFFER", 3));
    let selection: { id: string; version: number } | undefined;
    const rows = [
      { id: "media-a", template_key: "OFFER", r2_key: "whatsapp-content/images/offer/a/whatsapp.jpg", master_r2_key: "whatsapp-content/images/offer/a/master.jpg", mime_type: "image/jpeg", size_bytes: 4, sha256: "a".repeat(64), enabled: 1, active: 0, sort_order: 0, created_at: "2026-01-01" },
      { id: "media-b", template_key: "OFFER", r2_key: "whatsapp-content/images/offer/b/whatsapp.jpg", master_r2_key: "whatsapp-content/images/offer/b/master.jpg", mime_type: "image/jpeg", size_bytes: 4, sha256: "b".repeat(64), enabled: 1, active: 0, sort_order: 10, created_at: "2026-01-02" }
    ];
    const db = {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const statement = {
          bind: (...values: unknown[]) => { args = values; return statement; },
          first: async () => {
            if (sql.includes("media_selections s")) return selection?.version === 2 ? rows.find((row) => row.id === selection?.id) ?? null : null;
            if (sql.includes("published_version")) return { published_version: 2 };
            return null;
          },
          all: async () => ({ results: rows.map((row) => ({ ...row, published_active: 0, published_sort_order: row.sort_order })) }),
          run: async () => { if (sql.startsWith("DELETE")) selection = undefined; if (sql.startsWith("INSERT OR IGNORE")) selection = { id: String(args[6]), version: Number(args[5]) }; return { success: true }; }
        };
        return statement;
      }
    } as unknown as D1Database;
    const first = await selectPublishedWhatsAppContentMedia(db, "OFFER", "checkout-stable");
    const replay = await selectPublishedWhatsAppContentMedia(db, "OFFER", "checkout-stable");
    expect(replay?.id).toBe(first?.id);
  });

  it("deletes and reselects cached media that is stale, disabled, or outside the published snapshot", async () => {
    const media = {
      old: { id: "media-old", template_key: "WELCOME", r2_key: "whatsapp-content/images/welcome/old/whatsapp.jpg", master_r2_key: "whatsapp-content/images/welcome/old/master.jpg", mime_type: "image/jpeg", size_bytes: 4, sha256: "a".repeat(64), enabled: 0, active: 0, sort_order: 0, created_at: "2026-01-01" },
      current: { id: "media-current", template_key: "WELCOME", r2_key: "whatsapp-content/images/welcome/current/whatsapp.jpg", master_r2_key: "whatsapp-content/images/welcome/current/master.jpg", mime_type: "image/jpeg", size_bytes: 4, sha256: "b".repeat(64), enabled: 1, active: 1, sort_order: 10, created_at: "2026-01-02" }
    };
    let selection: { id: string; version: number } | undefined = { id: media.old.id, version: 1 };
    let deletes = 0;
    const db = {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const statement = {
          bind: (...values: unknown[]) => { args = values; return statement; },
          first: async () => {
            if (sql.includes("media_selections s")) return selection?.version === 2 && selection.id === media.current.id ? media.current : null;
            if (sql.includes("published_version")) return { published_version: 2 };
            return null;
          },
          all: async () => ({ results: [{ ...media.current, published_active: 1, published_sort_order: 10 }] }),
          run: async () => {
            if (sql.startsWith("DELETE")) { selection = undefined; deletes += 1; }
            if (sql.startsWith("INSERT OR IGNORE")) selection = { id: String(args[6]), version: Number(args[5]) };
            return { success: true };
          }
        };
        return statement;
      }
    } as unknown as D1Database;
    await expect(selectPublishedWhatsAppContentMedia(db, "WELCOME", "stale-session")).resolves.toMatchObject({ id: "media-current", enabled: true });
    expect(selection).toEqual({ id: "media-current", version: 2 });
    expect(deletes).toBe(1);
  });

  it("maps published semantic action labels by locale without changing action IDs", async () => {
    const db = {
      prepare: (sql: string) => {
        const statement = {
          bind: () => statement,
          first: async () => sql.includes("content_en_json") ? { version: 1, content_en_json: '{"text":"Welcome"}', content_ur_json: '{"text":"خوش آمدید"}', media_r2_key: null } : null,
          all: async () => ({ results: [
            { action_id: "LANG_EN", label_en: "English", label_ur: "انگریزی" },
            { action_id: "LANG_UR", label_en: "Urdu", label_ur: "اردو" }
          ] })
        };
        return statement;
      }
    } as unknown as D1Database;
    const en = await publishedWhatsAppContent(db, "WELCOME", "en");
    const ur = await publishedWhatsAppContent(db, "WELCOME", "ur");
    expect(whatsAppActionLabel(en!, "LANG_EN")).toBe("English");
    expect(whatsAppActionLabel(ur!, "LANG_EN")).toBe("انگریزی");
    expect(whatsAppActionLabel(ur!, "LANG_UR")).toBe("اردو");
  });

  it("uses WELCOME media for every eligible NEW greeting", () => {
    expect(guidedReplyMediaKey("START", "NEW", "LANGUAGE")).toBe("WELCOME");
    expect(guidedReplyMediaKey("HELLO", "NEW", "LANGUAGE")).toBe("WELCOME");
    expect(guidedReplyMediaKey("ANY GREETING", "NEW", "LANGUAGE")).toBe("WELCOME");
    expect(guidedReplyMediaKey("CHECK_ORDER", "NEW", "NEW")).toBe("ORDER_STATUS");
  });

  it("defines gallery, publish snapshots, and D1 session selections additively", async () => {
    const migration = await readFile("migrations/0017_whatsapp_content_media.sql", "utf8");
    for (const table of ["whatsapp_content_media", "whatsapp_content_version_media", "whatsapp_content_media_selections"]) expect(migration).toContain(`CREATE TABLE ${table}`);
    expect(migration).toContain("whatsapp-content/images/*/*");
    expect(migration).toContain("UNIQUE(session_key, template_key)");
  });

  it("adds version-scoped semantic action labels without rewriting content versions", async () => {
    const migration = await readFile("migrations/0018_whatsapp_content_action_labels.sql", "utf8");
    expect(migration).toContain("CREATE TABLE whatsapp_content_version_action_labels");
    expect(migration).not.toContain("UPDATE whatsapp_content_template_versions");
    for (const actionId of ["LANG_EN", "LANG_UR", "ADD_FERTILIZER", "SEEDS_ONLY", "PLACE_ORDER", "BACK", "PAY_JAZZCASH", "CHECK_ORDER", "PAYMENT_HELP", "SUPPORT"]) expect(migration).toContain(`'${actionId}'`);
  });
});
