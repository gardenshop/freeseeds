export type CodConfiguration = {
  enabled: boolean;
  feePkr: number;
  collectionPolicyHash: string | null;
  remittancePolicyHash: string | null;
};

export function normalizeCodEvidenceReference(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/[\t\n\v\f\r ]+/g, "");
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,127}$/.test(normalized) ? normalized : undefined;
}

export async function codReferenceHmac(value: string, secret: string): Promise<string> {
  if (secret.trim().length < 32) throw new Error("COD_REFERENCE_HMAC_KEY_REQUIRED");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function codQuote(baseAmountPkr: number, feePkr: number): number {
  if (![baseAmountPkr, feePkr].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("COD_QUOTE_INVALID");
  const total = baseAmountPkr + feePkr;
  if (!Number.isSafeInteger(total)) throw new Error("COD_QUOTE_INVALID");
  return total;
}
