const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export function validateReceipt(mimeType: string, size: number): void {
  if (!allowedMimeTypes.has(mimeType)) throw new Error("RECEIPT_MIME_NOT_ALLOWED");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_RECEIPT_BYTES) throw new Error("RECEIPT_SIZE_NOT_ALLOWED");
}

export async function sha256Hex(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function storeReceipt(bucket: R2Bucket, orderNumber: string, media: { body: ArrayBuffer; mimeType: string; size: number; mediaId: string }, now = new Date()): Promise<{ objectKey: string; sha256: string }> {
  validateReceipt(media.mimeType, media.size);
  if (media.size !== media.body.byteLength) throw new Error("RECEIPT_SIZE_MISMATCH");
  const sha256 = await sha256Hex(media.body);
  const objectKey = `receipts/${orderNumber}/${now.toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sha256.slice(0, 12)}`;
  await bucket.put(objectKey, media.body, { httpMetadata: { contentType: media.mimeType, cacheControl: "private, no-store", contentDisposition: "attachment" }, customMetadata: { mediaId: media.mediaId, sha256, orderNumber } });
  return { objectKey, sha256 };
}
