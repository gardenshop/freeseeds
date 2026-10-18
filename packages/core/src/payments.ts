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
  heading?: string;
  headingUr?: string;
  qrCaption?: string;
  qrCaptionUr?: string;
  shortInstructions?: string;
  shortInstructionsUr?: string;
  receiptInstructions?: string;
  receiptInstructionsUr?: string;
  paymentHelpCopy?: string;
  paymentHelpCopyUr?: string;
  statusCopy?: string;
  statusCopyUr?: string;
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
  heading?: string;
  headingUr?: string;
  qrCaption?: string;
  qrCaptionUr?: string;
  shortInstructions?: string;
  shortInstructionsUr?: string;
  receiptInstructions?: string;
  receiptInstructionsUr?: string;
  paymentHelpCopy?: string;
  paymentHelpCopyUr?: string;
  statusCopy?: string;
  statusCopyUr?: string;
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
    ...(config.referenceInstruction ? { referenceInstruction: config.referenceInstruction } : {}),
    ...(config.heading ? { heading: config.heading } : {}),
    ...(config.headingUr ? { headingUr: config.headingUr } : {}),
    ...(config.qrCaption ? { qrCaption: config.qrCaption } : {}),
    ...(config.qrCaptionUr ? { qrCaptionUr: config.qrCaptionUr } : {}),
    ...(config.shortInstructions ? { shortInstructions: config.shortInstructions } : {}),
    ...(config.shortInstructionsUr ? { shortInstructionsUr: config.shortInstructionsUr } : {}),
    ...(config.receiptInstructions ? { receiptInstructions: config.receiptInstructions } : {}),
    ...(config.receiptInstructionsUr ? { receiptInstructionsUr: config.receiptInstructionsUr } : {}),
    ...(config.paymentHelpCopy ? { paymentHelpCopy: config.paymentHelpCopy } : {}),
    ...(config.paymentHelpCopyUr ? { paymentHelpCopyUr: config.paymentHelpCopyUr } : {}),
    ...(config.statusCopy ? { statusCopy: config.statusCopy } : {}),
    ...(config.statusCopyUr ? { statusCopyUr: config.statusCopyUr } : {})
  };
}

export function formatPaymentMessage(orderNumber: string, amount: number, config: PaymentMethodConfig, locale: "en" | "ur" = "en"): string {
  const payableAmount = requirePaymentAmount(amount);
  const details = paymentInstructions(config);
  if (!details.configured) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
  const lines = [locale === "ur" ? (details.headingUr ?? details.heading ?? details.displayName) : (details.heading ?? details.displayName), locale === "ur" ? `قابل ادائیگی رقم: PKR ${payableAmount}` : `Amount due: PKR ${payableAmount}`, locale === "ur" ? `وصول کنندہ: ${details.recipientName}` : `Recipient: ${details.recipientName}`];
  if (details.tillId) lines.push(`TILL/TIL ID: ${details.tillId}`);
  const shortInstructions = locale === "ur" ? (details.shortInstructionsUr ?? details.shortInstructions) : details.shortInstructions;
  if (shortInstructions) lines.push(shortInstructions);
  else if (details.instructions) lines.push(details.instructions);
  if (details.referenceInstruction) lines.push(details.referenceInstruction);
  const receipt = locale === "ur" ? (details.receiptInstructionsUr ?? details.receiptInstructions ?? "ادائیگی کے بعد رسید اسی چیٹ میں بھیجیں۔") : (details.receiptInstructions ?? "After payment, share your receipt here.");
  lines.push(locale === "ur" ? `حوالہ: ${orderNumber}` : `Reference: ${orderNumber}`, receipt);
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
    ...(row.heading ? { heading: String(row.heading) } : {}),
    ...(row.heading_ur ? { headingUr: String(row.heading_ur) } : {}),
    ...(row.qr_caption ? { qrCaption: String(row.qr_caption) } : {}),
    ...(row.qr_caption_ur ? { qrCaptionUr: String(row.qr_caption_ur) } : {}),
    ...(row.short_instructions ? { shortInstructions: String(row.short_instructions) } : {}),
    ...(row.short_instructions_ur ? { shortInstructionsUr: String(row.short_instructions_ur) } : {}),
    ...(row.receipt_instructions ? { receiptInstructions: String(row.receipt_instructions) } : {}),
    ...(row.receipt_instructions_ur ? { receiptInstructionsUr: String(row.receipt_instructions_ur) } : {}),
    ...(row.payment_help_copy ? { paymentHelpCopy: String(row.payment_help_copy) } : {}),
    ...(row.payment_help_copy_ur ? { paymentHelpCopyUr: String(row.payment_help_copy_ur) } : {}),
    ...(row.status_copy ? { statusCopy: String(row.status_copy) } : {}),
    ...(row.status_copy_ur ? { statusCopyUr: String(row.status_copy_ur) } : {}),
    enabled: Number(row.enabled) === 1,
    sortOrder: Number(row.sort_order),
    ...(row.updated_at ? { updatedAt: String(row.updated_at) } : {}),
    ...(row.updated_by ? { updatedBy: String(row.updated_by) } : {})
  };
}
