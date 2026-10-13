import { WhatsAppTemplateKey } from "./whatsapp-content";

export const MAX_WHATSAPP_CONTENT_MASTER_BYTES = 10 * 1024 * 1024;
export const MAX_WHATSAPP_CONTENT_VARIANT_BYTES = 5 * 1024 * 1024;

const MASTER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VARIANT_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export type WhatsAppContentMedia = {
  id: string;
  templateKey: WhatsAppTemplateKey;
  r2Key: string;
  masterR2Key: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  sha256: string;
  enabled: boolean;
  active: boolean;
  sortOrder: number;
};

function hasImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return mimeType === "image/webp" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

export function validateWhatsAppContentImage(body: ArrayBuffer, mimeType: string, kind: "master" | "variant"): void {
  const allowed = kind === "master" ? MASTER_MIME_TYPES : VARIANT_MIME_TYPES;
  const limit = kind === "master" ? MAX_WHATSAPP_CONTENT_MASTER_BYTES : MAX_WHATSAPP_CONTENT_VARIANT_BYTES;
  if (!allowed.has(mimeType)) throw new Error(kind === "master" ? "WHATSAPP_CONTENT_MASTER_MIME_INVALID" : "WHATSAPP_CONTENT_MEDIA_MIME_INVALID");
  if (!body.byteLength || body.byteLength > limit) throw new Error(kind === "master" ? "WHATSAPP_CONTENT_MASTER_SIZE_INVALID" : "WHATSAPP_CONTENT_MEDIA_SIZE_INVALID");
  if (!hasImageSignature(new Uint8Array(body), mimeType)) throw new Error("WHATSAPP_CONTENT_MEDIA_SIGNATURE_INVALID");
}

async function contentMediaSha256Hex(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function extension(mimeType: string): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

function screenPath(templateKey: WhatsAppTemplateKey): string {
  return templateKey.toLowerCase().replace(/_/g, "-");
}

export async function storeWhatsAppContentMedia(
  bucket: R2Bucket,
  templateKey: WhatsAppTemplateKey,
  id: string,
  master: { body: ArrayBuffer; mimeType: string },
  variant: { body: ArrayBuffer; mimeType: string }
): Promise<{ r2Key: string; masterR2Key: string; sha256: string; masterSha256: string; sizeBytes: number; masterSizeBytes: number }> {
  validateWhatsAppContentImage(master.body, master.mimeType, "master");
  validateWhatsAppContentImage(variant.body, variant.mimeType, "variant");
  const [sha256, masterSha256] = await Promise.all([contentMediaSha256Hex(variant.body), contentMediaSha256Hex(master.body)]);
  const prefix = `whatsapp-content/images/${screenPath(templateKey)}/${id}`;
  const r2Key = `${prefix}/whatsapp-${sha256.slice(0, 12)}.${extension(variant.mimeType)}`;
  const masterR2Key = `${prefix}/master-${masterSha256.slice(0, 12)}.${extension(master.mimeType)}`;
  const privateMetadata = { cacheControl: "private, no-store", contentDisposition: "inline" };
  await bucket.put(masterR2Key, master.body, { httpMetadata: { ...privateMetadata, contentType: master.mimeType }, customMetadata: { purpose: "whatsapp-content-master", templateKey, sha256: masterSha256 } });
  try {
    await bucket.put(r2Key, variant.body, { httpMetadata: { ...privateMetadata, contentType: variant.mimeType }, customMetadata: { purpose: "whatsapp-content-image", templateKey, sha256 } });
  } catch (error) {
    await bucket.delete(masterR2Key);
    throw error;
  }
  return { r2Key, masterR2Key, sha256, masterSha256, sizeBytes: variant.body.byteLength, masterSizeBytes: master.body.byteLength };
}

export function deterministicMediaIndex(sessionKey: string, templateKey: WhatsAppTemplateKey, count: number): number {
  if (!Number.isInteger(count) || count <= 0) throw new Error("WHATSAPP_CONTENT_MEDIA_COUNT_INVALID");
  let hash = 2166136261;
  for (const character of `${sessionKey}:${templateKey}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function mediaFromRow(row: Record<string, unknown>): WhatsAppContentMedia {
  return {
    id: String(row.id),
    templateKey: WhatsAppTemplateKey.parse(row.template_key),
    r2Key: String(row.r2_key),
    masterR2Key: String(row.master_r2_key),
    mimeType: String(row.mime_type) as WhatsAppContentMedia["mimeType"],
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    enabled: Number(row.enabled) === 1,
    active: Number(row.active) === 1,
    sortOrder: Number(row.sort_order)
  };
}

export async function selectPublishedWhatsAppContentMedia(db: D1Database, templateKey: WhatsAppTemplateKey, sessionKey: string): Promise<WhatsAppContentMedia | undefined> {
  if (!sessionKey || sessionKey.length > 200) throw new Error("WHATSAPP_CONTENT_MEDIA_SESSION_INVALID");
  const existing = await db.prepare("SELECT m.* FROM whatsapp_content_media_selections s JOIN whatsapp_content_media m ON m.id=s.media_id WHERE s.session_key=? AND s.template_key=?").bind(sessionKey, templateKey).first<Record<string, unknown>>();
  if (existing) return mediaFromRow(existing);
  const template = await db.prepare("SELECT published_version FROM whatsapp_content_templates WHERE template_key=?").bind(templateKey).first<{ published_version: number | null }>();
  const version = Number(template?.published_version ?? 0);
  if (!version) return undefined;
  const result = await db.prepare("SELECT m.*,vm.active AS published_active,vm.sort_order AS published_sort_order FROM whatsapp_content_version_media vm JOIN whatsapp_content_media m ON m.id=vm.media_id WHERE vm.template_key=? AND vm.version=? AND m.enabled=1 ORDER BY vm.active DESC,vm.sort_order,m.created_at,m.id").bind(templateKey, version).all<Record<string, unknown>>();
  const candidates = result.results ?? [];
  if (!candidates.length) return undefined;
  const active = candidates.filter((row) => Number(row.published_active) === 1);
  const selected = (active.length ? active : candidates)[deterministicMediaIndex(sessionKey, templateKey, (active.length ? active : candidates).length)];
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO whatsapp_content_media_selections (id,session_key,template_key,media_id,content_version,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), sessionKey, templateKey, String(selected.id), version, now).run();
  const persisted = await db.prepare("SELECT m.* FROM whatsapp_content_media_selections s JOIN whatsapp_content_media m ON m.id=s.media_id WHERE s.session_key=? AND s.template_key=?").bind(sessionKey, templateKey).first<Record<string, unknown>>();
  return persisted ? mediaFromRow(persisted) : mediaFromRow(selected);
}
