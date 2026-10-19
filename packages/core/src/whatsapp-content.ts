import { z } from "zod";
import { logWhatsAppContentMediaError, selectPublishedWhatsAppContentMedia } from "./whatsapp-media";

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

export const WHATSAPP_ACTION_IDS = [
  "LANG_EN",
  "LANG_UR",
  "ADD_FERTILIZER",
  "SEEDS_ONLY",
  "PLACE_ORDER",
  "BACK",
  "CHECK_ORDER",
  "SUPPORT"
] as const;

export const WhatsAppActionId = z.enum(WHATSAPP_ACTION_IDS);
export type WhatsAppActionId = z.infer<typeof WhatsAppActionId>;

export const WHATSAPP_TEMPLATE_ACTION_IDS: Partial<Record<WhatsAppTemplateKey, readonly WhatsAppActionId[]>> = {
  WELCOME: ["LANG_EN", "LANG_UR"],
  FERTILIZER: ["ADD_FERTILIZER", "SEEDS_ONLY"],
  REVIEW: ["PLACE_ORDER", "BACK"],
  PAYMENT: [],
  ORDER_STATUS: ["CHECK_ORDER"],
  SUPPORT: ["SUPPORT"]
};

const SAFE_PLACEHOLDERS = new Set(["orderNumber", "totalPkr", "province", "paymentMethod", "recipientName", "tillId"]);
const PRIVATE_R2_KEY = /^whatsapp-content\/(?!.*(?:^|\/)\.\.?\/)[A-Za-z0-9][A-Za-z0-9/_.-]{0,510}$/;

export type WhatsAppContent = {
  text: string;
  buttonLabel?: string;
  listButtonLabel?: string;
  listDescription?: string;
  actionLabels?: Partial<Record<WhatsAppActionId, string>>;
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
  listDescription: z.string().trim().min(1).max(72).optional(),
  actionLabels: z.record(WhatsAppActionId, z.string().trim().min(1).max(20)).optional()
}).strict();

function validatePlaceholders(value: string): void {
  for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
    if (!SAFE_PLACEHOLDERS.has(match[1])) throw new Error("WHATSAPP_CONTENT_PLACEHOLDER_NOT_ALLOWED");
  }
  if (/\{[^{}]*$|^[^{}]*\}/.test(value)) throw new Error("WHATSAPP_CONTENT_PLACEHOLDER_INVALID");
}

function validateContent(content: WhatsAppContent): WhatsAppContent {
  const parsed = contentSchema.parse(content);
  for (const value of [parsed.text, parsed.buttonLabel, parsed.listButtonLabel, parsed.listDescription, ...Object.values(parsed.actionLabels ?? {})]) if (value) validatePlaceholders(value);
  return parsed;
}

export function whatsAppActionIdsForTemplate(templateKey: WhatsAppTemplateKey): readonly WhatsAppActionId[] {
  return WHATSAPP_TEMPLATE_ACTION_IDS[templateKey] ?? [];
}

export function validateWhatsAppTemplateContent(templateKey: WhatsAppTemplateKey, content: WhatsAppContent): WhatsAppContent {
  const parsed = validateContent(content);
  const expected = whatsAppActionIdsForTemplate(templateKey);
  const supplied = Object.keys(parsed.actionLabels ?? {});
  if (supplied.some((actionId) => !expected.includes(actionId as WhatsAppActionId)) || expected.some((actionId) => !parsed.actionLabels?.[actionId])) throw new Error("WHATSAPP_CONTENT_ACTION_LABELS_INVALID");
  if (templateKey === "PROVINCE_DELIVERY" && (!parsed.listButtonLabel || !parsed.listDescription)) throw new Error("WHATSAPP_CONTENT_PROVINCE_LIST_INVALID");
  return parsed;
}

export function whatsAppActionLabel(content: WhatsAppContent, actionId: WhatsAppActionId): string {
  const label = content.actionLabels?.[actionId];
  if (!label) throw new Error("WHATSAPP_CONTENT_ACTION_LABEL_MISSING");
  return label;
}

export function parseWhatsAppContentDraft(value: unknown, templateKey?: WhatsAppTemplateKey): WhatsAppContentDraft {
  const input = z.object({ contentEn: contentSchema, contentUr: contentSchema, mediaR2Key: z.string().trim().min(1).max(512).optional() }).strict().parse(value);
  const mediaR2Key = input.mediaR2Key || undefined;
  if (mediaR2Key && !PRIVATE_R2_KEY.test(mediaR2Key)) throw new Error("WHATSAPP_CONTENT_MEDIA_KEY_INVALID");
  const contentEn = templateKey ? validateWhatsAppTemplateContent(templateKey, input.contentEn) : validateContent(input.contentEn);
  const contentUr = templateKey ? validateWhatsAppTemplateContent(templateKey, input.contentUr) : validateContent(input.contentUr);
  return { contentEn, contentUr, ...(mediaR2Key ? { mediaR2Key } : {}) };
}

export function renderWhatsAppContent(template: string, values: Partial<Record<(typeof WHATSAPP_TEMPLATE_KEYS)[number] | "orderNumber" | "totalPkr" | "province" | "paymentMethod" | "recipientName" | "tillId", string | number>>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, name: string) => {
    if (!SAFE_PLACEHOLDERS.has(name)) return match;
    const value = values[name as keyof typeof values];
    return value === undefined || value === null ? match : String(value);
  });
}

export async function publishedWhatsAppContent(db: D1Database, key: WhatsAppTemplateKey, locale: "en" | "ur" = "en", sessionKey?: string): Promise<(WhatsAppContent & { mediaId?: string; mediaR2Key?: string; mediaMimeType?: string }) | undefined> {
  const row = await db.prepare("SELECT v.version,v.content_en_json,v.content_ur_json,v.media_r2_key FROM whatsapp_content_templates t JOIN whatsapp_content_template_versions v ON v.template_key=t.template_key AND v.version=t.published_version WHERE t.template_key=? AND t.published_version IS NOT NULL").bind(key).first<{ version: number; content_en_json: string; content_ur_json: string; media_r2_key: string | null }>();
  if (!row) return undefined;
  try {
    const labels = await db.prepare("SELECT action_id,label_en,label_ur FROM whatsapp_content_version_action_labels WHERE template_key=? AND version=? ORDER BY action_id").bind(key, row.version).all<{ action_id: string; label_en: string; label_ur: string }>();
    const actionLabels = Object.fromEntries((labels.results ?? []).flatMap((label) => {
      const actionId = WhatsAppActionId.safeParse(label.action_id).data;
      return actionId ? [[actionId, locale === "ur" ? label.label_ur : label.label_en]] : [];
    }));
    const content = validateWhatsAppTemplateContent(key, { ...(JSON.parse(locale === "ur" ? row.content_ur_json : row.content_en_json) as WhatsAppContent), ...(Object.keys(actionLabels).length ? { actionLabels } : {}) });
    if (sessionKey) {
      try {
        const media = await selectPublishedWhatsAppContentMedia(db, key, sessionKey);
        if (media) return { ...content, mediaId: media.id, mediaR2Key: media.r2Key, mediaMimeType: media.mimeType };
      } catch (error) {
        logWhatsAppContentMediaError(key, error);
      }
    }
    return { ...content, ...(row.media_r2_key ? { mediaR2Key: row.media_r2_key } : {}) };
  } catch (error) {
    const code = error instanceof Error && /^WHATSAPP_CONTENT_[A-Z0-9_]+$/.test(error.message) ? error.message : "WHATSAPP_CONTENT_LOAD_FAILED";
    // eslint-disable-next-line no-console -- logs contain only the allowlisted template key and sanitized code
    console.error("WHATSAPP_CONTENT_ERROR", { templateKey: key, code });
    return undefined;
  }
}
