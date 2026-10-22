const CUSTOMER_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,79}$/;

export function normalizeCustomerTransactionReference(value: unknown, orderNumber?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const reference = value.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "").replace(/[ \t\r\n\f\v]+/g, "");
  if (!CUSTOMER_REFERENCE.test(reference)) return undefined;
  if (orderNumber && reference.toUpperCase() === orderNumber.trim().replace(/\s+/g, "").toUpperCase()) return undefined;
  return reference;
}

export async function customerTransactionReferenceHash(value: string): Promise<string> {
  const normalized = value.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "").replace(/[ \t\r\n\f\v]+/g, "").toUpperCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
