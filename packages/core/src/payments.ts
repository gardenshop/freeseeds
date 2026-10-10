import { PaymentMethod } from "./domain";

export type PaymentMethodConfig = {
  id: string;
  method: PaymentMethod;
  displayName: string;
  recipientName?: string;
  tillId?: string;
  qrR2Key?: string;
  qrSha256?: string;
  qrMimeType?: string;
  qrSizeBytes?: number;
  instructions?: string;
  referenceInstruction?: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt?: string;
  updatedBy?: string;
};

export type PaymentInstructions = {
  method: PaymentMethod;
  displayName: string;
  configured: boolean;
  recipientName?: string;
  tillId?: string;
  qrR2Key?: string;
  instructions?: string;
  referenceInstruction?: string;
};

export function validatePaymentAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("PAYMENT_AMOUNT_INVALID");
  return amount;
}

export function requirePaymentAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") throw new Error("PAYMENT_AMOUNT_NOT_CONFIGURED");
  try {
    return validatePaymentAmount(value);
  } catch {
    throw new Error("PAYMENT_AMOUNT_NOT_CONFIGURED");
  }
}

export function isPaymentMethodComplete(config: PaymentMethodConfig | undefined): boolean {
  return Boolean(config?.enabled && config.recipientName?.trim() && config.instructions?.trim());
}

export function hasCompleteEnabledPaymentMethod(configs: PaymentMethodConfig[]): boolean {
  return configs.some((config) => isPaymentMethodComplete(config));
}

export async function configuredPaymentMethodNames(db: D1Database, payableAmount?: number): Promise<string[]> {
  if (payableAmount !== undefined && (!Number.isSafeInteger(payableAmount) || payableAmount <= 0)) return [];
  const methods = await db.prepare("SELECT display_name, enabled, recipient_name, instructions FROM payment_methods WHERE enabled=1 ORDER BY sort_order, method").all<{ display_name: string; enabled: number; recipient_name?: string | null; instructions?: string | null }>();
  return (methods.results ?? [])
    .filter((row) => Number(row.enabled) === 1 && Boolean(row.recipient_name?.trim()) && Boolean(row.instructions?.trim()))
    .map((row) => String(row.display_name).trim())
    .filter(Boolean);
}

export function paymentInstructions(config: PaymentMethodConfig | undefined): PaymentInstructions {
  if (!config) return { method: "JAZZCASH", displayName: "Unavailable", configured: false };
  return {
    method: config.method,
    displayName: config.displayName,
    configured: isPaymentMethodComplete(config),
    ...(config.recipientName ? { recipientName: config.recipientName } : {}),
    ...(config.tillId ? { tillId: config.tillId } : {}),
    ...(config.qrR2Key ? { qrR2Key: config.qrR2Key } : {}),
    ...(config.instructions ? { instructions: config.instructions } : {}),
    ...(config.referenceInstruction ? { referenceInstruction: config.referenceInstruction } : {})
  };
}

export function formatPaymentMessage(orderNumber: string, amount: number, config: PaymentMethodConfig): string {
  const payableAmount = requirePaymentAmount(amount);
  const details = paymentInstructions(config);
  if (!details.configured) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
  const lines = [details.displayName, `Amount due: PKR ${payableAmount}`, `Payments for Get Free Seeds are processed by Garden Shop.`, `Recipient: ${details.recipientName}`];
  if (details.tillId) lines.push(`TILL/TIL ID: ${details.tillId}`);
  if (details.instructions) lines.push(details.instructions);
  if (details.referenceInstruction) lines.push(details.referenceInstruction);
  lines.push(`Reference: ${orderNumber}`, "After payment, select I Have Paid and share your receipt here.");
  return lines.join("\n");
}

export function normalizePaymentMethodRow(row: Record<string, unknown>): PaymentMethodConfig {
  return {
    id: String(row.id),
    method: PaymentMethod.parse(String(row.method)),
    displayName: String(row.display_name),
    ...(row.recipient_name ? { recipientName: String(row.recipient_name) } : {}),
    ...(row.till_id ? { tillId: String(row.till_id) } : {}),
    ...(row.qr_r2_key ? { qrR2Key: String(row.qr_r2_key) } : {}),
    ...(row.qr_sha256 ? { qrSha256: String(row.qr_sha256) } : {}),
    ...(row.qr_mime_type ? { qrMimeType: String(row.qr_mime_type) } : {}),
    ...(row.qr_size_bytes ? { qrSizeBytes: Number(row.qr_size_bytes) } : {}),
    ...(row.instructions ? { instructions: String(row.instructions) } : {}),
    ...(row.reference_instruction ? { referenceInstruction: String(row.reference_instruction) } : {}),
    enabled: Number(row.enabled) === 1,
    sortOrder: Number(row.sort_order),
    ...(row.updated_at ? { updatedAt: String(row.updated_at) } : {}),
    ...(row.updated_by ? { updatedBy: String(row.updated_by) } : {})
  };
}
