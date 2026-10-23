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

export async function verifyPaymentQrAsset(body: ArrayBuffer, mimeType: string, config: { method: string; qrR2Key?: string; qrSha256?: string; qrMimeType?: string; qrSizeBytes?: number; qrOwnerVerified?: boolean }, asset: { method: string; objectKey: string; sha256: string; mimeType: string; sizeBytes: number; decoderAgreement: boolean; payloadMatch: boolean; scanPass: boolean; independentOwnershipVerified: boolean; independentEvidenceRef?: string | null; active: boolean }): Promise<void> {
  if (!config.qrOwnerVerified || !asset.independentOwnershipVerified || !asset.independentEvidenceRef?.trim()) throw new Error("PAYMENT_QR_OWNERSHIP_UNVERIFIED");
  if (!asset.active || !asset.decoderAgreement || !asset.payloadMatch || !asset.scanPass) throw new Error("PAYMENT_QR_PROVENANCE_UNVERIFIED");
  if (asset.method !== config.method) throw new Error("PAYMENT_QR_METHOD_MISMATCH");
  if (!config.qrR2Key || asset.objectKey !== config.qrR2Key) throw new Error("PAYMENT_QR_METADATA_KEY_MISMATCH");
  if (!config.qrSha256 || asset.sha256 !== config.qrSha256) throw new Error("PAYMENT_QR_METADATA_CHECKSUM_MISMATCH");
  if (!config.qrMimeType || asset.mimeType !== config.qrMimeType || mimeType !== config.qrMimeType) throw new Error("PAYMENT_QR_CONTENT_TYPE_MISMATCH");
  if (config.qrSizeBytes === undefined || asset.sizeBytes !== config.qrSizeBytes) throw new Error("PAYMENT_QR_SIZE_MISMATCH");
  await verifyPaymentQr(body, config.qrMimeType, config.qrSha256, config.qrSizeBytes);
}

export async function storePaymentQr(bucket: R2Bucket, method: string, body: ArrayBuffer, mimeType: string): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
  await verifyPaymentQr(body, mimeType);
  const digest = await crypto.subtle.digest("SHA-256", body);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  const objectKey = `payment-qr/original/${method}/${sha256}`;
  const existing = await bucket.head(objectKey);
  if (existing) {
    if (existing.size !== body.byteLength || existing.customMetadata?.method !== method || existing.customMetadata.sha256 !== sha256 || existing.httpMetadata?.contentType !== mimeType) {
      throw new Error("PAYMENT_QR_IMMUTABLE_OBJECT_MISMATCH");
    }
  } else {
    await bucket.put(objectKey, body, { httpMetadata: { contentType: mimeType, cacheControl: "private, no-store", contentDisposition: "inline" }, customMetadata: { method, sha256 } });
  }
  return { objectKey, sha256, sizeBytes: body.byteLength };
}
