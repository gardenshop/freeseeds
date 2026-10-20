const allowedQrMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PAYMENT_QR_BYTES = 5 * 1024 * 1024;

export function validatePaymentQr(mimeType: string, size: number): void {
  if (!allowedQrMimeTypes.has(mimeType)) throw new Error("PAYMENT_QR_MIME_NOT_ALLOWED");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PAYMENT_QR_BYTES) throw new Error("PAYMENT_QR_SIZE_NOT_ALLOWED");
}

export async function verifyPaymentQr(body: ArrayBuffer, mimeType: string, expectedSha256?: string, expectedSizeBytes?: number): Promise<void> {
  validatePaymentQr(mimeType, body.byteLength);
  if (expectedSizeBytes !== undefined && body.byteLength !== expectedSizeBytes) throw new Error("PAYMENT_QR_SIZE_MISMATCH");
  const bytes = new Uint8Array(body);
  const validSignature = mimeType === "image/png"
    ? bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
    : mimeType === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!validSignature) throw new Error("PAYMENT_QR_TYPE_MISMATCH");
  if (expectedSha256) {
    const digest = await crypto.subtle.digest("SHA-256", body);
    const actual = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (actual !== expectedSha256.toLowerCase()) throw new Error("PAYMENT_QR_CHECKSUM_MISMATCH");
  }
}

export async function storePaymentQr(bucket: R2Bucket, method: string, body: ArrayBuffer, mimeType: string, now = new Date()): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
  await verifyPaymentQr(body, mimeType);
  const digest = await crypto.subtle.digest("SHA-256", body);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  const objectKey = `payment-qr/${method}/${now.toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sha256.slice(0, 12)}`;
  await bucket.put(objectKey, body, { httpMetadata: { contentType: mimeType, cacheControl: "private, no-store", contentDisposition: "inline" }, customMetadata: { method, sha256 } });
  return { objectKey, sha256, sizeBytes: body.byteLength };
}
