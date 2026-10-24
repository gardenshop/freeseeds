import { z } from "zod";

export const V2CodPolicySchema = z.object({
  version: z.literal(1),
  feePkr: z.number().int().min(1).max(10000),
  enabled: z.boolean(),
  eligibleProvinces: z.array(z.string().min(1)).max(20),
  courierProvider: z.string().max(120),
  collectionSupported: z.boolean(),
  remittanceSupported: z.boolean(),
  verificationReferenceHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  instructionsEn: z.string().max(500),
  instructionsUr: z.string().max(500)
}).strict();

export type V2CodPolicy = z.infer<typeof V2CodPolicySchema>;

export function calculateV2CodPrice(seedPkr: number, fertilizerPkr: number, deliveryFeePkr: number, codFeePkr: number): { seedPkr: number; fertilizerPkr: number; deliveryFeePkr: number; codFeePkr: number; totalPayablePkr: number } {
  const values = [seedPkr, fertilizerPkr, deliveryFeePkr, codFeePkr];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0) || codFeePkr === 0) throw new Error("COD_PRICE_INVALID");
  const totalPayablePkr = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(totalPayablePkr)) throw new Error("COD_PRICE_INVALID");
  return { seedPkr, fertilizerPkr, deliveryFeePkr, codFeePkr, totalPayablePkr };
}

export function parseV2CodPolicy(value: string | null | undefined): V2CodPolicy | null {
  if (!value) return null;
  try {
    const parsed = V2CodPolicySchema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function hashV2CodVerificationReference(reference: string, key: string): Promise<string> {
  if (!key || key.length < 32) throw new Error("COD_POLICY_HMAC_KEY_INVALID");
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const normalized = reference.trim().replace(/\s+/g, " ");
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(normalized));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
