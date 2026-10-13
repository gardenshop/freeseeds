import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deterministicMediaIndex, parseWhatsAppContentDraft, renderWhatsAppContent, selectPublishedWhatsAppContentMedia, storeWhatsAppContentMedia, validateWhatsAppContentImage, WhatsAppTemplateKey } from "@gfs/core";

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
    let selectedId: string | undefined;
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
            if (sql.includes("media_selections s")) return rows.find((row) => row.id === selectedId) ?? null;
            if (sql.includes("published_version")) return { published_version: 2 };
            return null;
          },
          all: async () => ({ results: rows.map((row) => ({ ...row, published_active: 0, published_sort_order: row.sort_order })) }),
          run: async () => { if (sql.startsWith("INSERT OR IGNORE")) selectedId = String(args[3]); return { success: true }; }
        };
        return statement;
      }
    } as unknown as D1Database;
    const first = await selectPublishedWhatsAppContentMedia(db, "OFFER", "checkout-stable");
    const replay = await selectPublishedWhatsAppContentMedia(db, "OFFER", "checkout-stable");
    expect(replay?.id).toBe(first?.id);
  });

  it("defines gallery, publish snapshots, and D1 session selections additively", async () => {
    const migration = await readFile("migrations/0017_whatsapp_content_media.sql", "utf8");
    for (const table of ["whatsapp_content_media", "whatsapp_content_version_media", "whatsapp_content_media_selections"]) expect(migration).toContain(`CREATE TABLE ${table}`);
    expect(migration).toContain("whatsapp-content/images/*/*");
    expect(migration).toContain("UNIQUE(session_key, template_key)");
  });
});
