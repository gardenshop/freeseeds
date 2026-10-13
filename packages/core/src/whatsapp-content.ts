import { z } from "zod";
import { selectPublishedWhatsAppContentMedia } from "./whatsapp-media";

export const WHATSAPP_TEMPLATE_KEYS = [
  "WELCOME",
  "OFFER",
  "FERTILIZER",
  "PROVINCE_DELIVERY",
  "FIELD_FULL_NAME",
  "FIELD_DELIVERY_ADDRESS",
  "FIELD_NEARBY_PLACE",
  "FIELD_CITY",
  "FIELD_CONTACT_NUMBER",
  "VALIDATION",
  "REVIEW",
  "CONFIRMATION",
  "ORDER_STATUS",
  "SUPPORT",
  "PAYMENT",
  "RECEIPT"
] as const;

export const WhatsAppTemplateKey = z.enum(WHATSAPP_TEMPLATE_KEYS);
export type WhatsAppTemplateKey = z.infer<typeof WhatsAppTemplateKey>;

const SAFE_PLACEHOLDERS = new Set(["orderNumber", "totalPkr", "province", "paymentMethod", "recipientName", "tillId"]);
const PRIVATE_R2_KEY = /^whatsapp-content\/(?!.*(?:^|\/)\.\.?\/)[A-Za-z0-9][A-Za-z0-9/_.-]{0,510}$/;

export type WhatsAppContent = {
  text: string;
  buttonLabel?: string;
  listButtonLabel?: string;
  listDescription?: string;
};

export type WhatsAppContentDraft = {
  contentEn: WhatsAppContent;
  contentUr: WhatsAppContent;
  mediaR2Key?: string;
};

const contentSchema = z.object({
  text: z.string().trim().min(1).max(2048),
  buttonLabel: z.string().trim().min(1).max(80).optional(),
  listButtonLabel: z.string().trim().min(1).max(20).optional(),
  listDescription: z.string().trim().min(1).max(72).optional()
}).strict();

function validatePlaceholders(value: string): void {
  for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
    if (!SAFE_PLACEHOLDERS.has(match[1])) throw new Error("WHATSAPP_CONTENT_PLACEHOLDER_NOT_ALLOWED");
  }
  if (/\{[^{}]*$|^[^{}]*\}/.test(value)) throw new Error("WHATSAPP_CONTENT_PLACEHOLDER_INVALID");
}

function validateContent(content: WhatsAppContent): WhatsAppContent {
  const parsed = contentSchema.parse(content);
  for (const value of [parsed.text, parsed.buttonLabel, parsed.listButtonLabel, parsed.listDescription]) if (value) validatePlaceholders(value);
  return parsed;
}

export function parseWhatsAppContentDraft(value: unknown): WhatsAppContentDraft {
  const input = z.object({ contentEn: contentSchema, contentUr: contentSchema, mediaR2Key: z.string().trim().min(1).max(512).optional() }).strict().parse(value);
  const mediaR2Key = input.mediaR2Key || undefined;
  if (mediaR2Key && !PRIVATE_R2_KEY.test(mediaR2Key)) throw new Error("WHATSAPP_CONTENT_MEDIA_KEY_INVALID");
  return { contentEn: validateContent(input.contentEn), contentUr: validateContent(input.contentUr), ...(mediaR2Key ? { mediaR2Key } : {}) };
}

export function renderWhatsAppContent(template: string, values: Partial<Record<(typeof WHATSAPP_TEMPLATE_KEYS)[number] | "orderNumber" | "totalPkr" | "province" | "paymentMethod" | "recipientName" | "tillId", string | number>>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, name: string) => {
    if (!SAFE_PLACEHOLDERS.has(name)) return match;
    const value = values[name as keyof typeof values];
    return value === undefined || value === null ? match : String(value);
  });
}

export async function publishedWhatsAppContent(db: D1Database, key: WhatsAppTemplateKey, locale: "en" | "ur" = "en", sessionKey?: string): Promise<(WhatsAppContent & { mediaId?: string; mediaR2Key?: string; mediaMimeType?: string }) | undefined> {
  const row = await db.prepare("SELECT v.content_en_json,v.content_ur_json,v.media_r2_key FROM whatsapp_content_templates t JOIN whatsapp_content_template_versions v ON v.template_key=t.template_key AND v.version=t.published_version WHERE t.template_key=? AND t.published_version IS NOT NULL").bind(key).first<{ content_en_json: string; content_ur_json: string; media_r2_key: string | null }>();
  if (!row) return undefined;
  try {
    const content = validateContent(JSON.parse(locale === "ur" ? row.content_ur_json : row.content_en_json) as WhatsAppContent);
    if (sessionKey) {
      try {
        const media = await selectPublishedWhatsAppContentMedia(db, key, sessionKey);
        if (media) return { ...content, mediaId: media.id, mediaR2Key: media.r2Key, mediaMimeType: media.mimeType };
      } catch {
        // Older databases remain text-capable until additive migration 0017 is applied.
      }
    }
    return { ...content, ...(row.media_r2_key ? { mediaR2Key: row.media_r2_key } : {}) };
  } catch {
    return undefined;
  }
}
