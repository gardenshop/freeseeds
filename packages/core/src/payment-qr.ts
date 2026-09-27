const allowedQrMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PAYMENT_QR_BYTES = 5 * 1024 * 1024;

export function validatePaymentQr(mimeType: string, size: number): void {
  if (!allowedQrMimeTypes.has(mimeType)) throw new Error("PAYMENT_QR_MIME_NOT_ALLOWED");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PAYMENT_QR_BYTES) throw new Error("PAYMENT_QR_SIZE_NOT_ALLOWED");
}

export async function storePaymentQr(bucket: R2Bucket, method: string, body: ArrayBuffer, mimeType: string, now = new Date()): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
  validatePaymentQr(mimeType, body.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", body);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  const objectKey = `payment-qr/${method}/${now.toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sha256.slice(0, 12)}`;
  await bucket.put(objectKey, body, { httpMetadata: { contentType: mimeType, cacheControl: "private, no-store", contentDisposition: "inline" }, customMetadata: { method, sha256 } });
  return { objectKey, sha256, sizeBytes: body.byteLength };
}
