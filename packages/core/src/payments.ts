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
  qrOwnerVerified?: boolean;
  instructions?: string;
  instructionsUr?: string;
  referenceInstruction?: string;
  referenceInstructionUr?: string;
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
  instructionsUr?: string;
  referenceInstruction?: string;
  referenceInstructionUr?: string;
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

export function hasPaymentMessagePlaceholders(config: PaymentMethodConfig | undefined, locale: "en" | "ur"): boolean {
  if (!config) return false;
  const instructions = locale === "ur" ? config.instructionsUr : config.instructions;
  const reference = locale === "ur" ? config.referenceInstructionUr : config.referenceInstruction;
  const template = `${instructions ?? ""} ${reference ?? ""}`;
  const required = ["{amount}", "{recipientName}", "{orderNumber}", ...(config.tillId ? ["{tillId}"] : [])];
  return required.every((placeholder) => template.includes(placeholder));
}

export function isPaymentMethodLocaleComplete(config: PaymentMethodConfig | undefined, locale: "en" | "ur"): boolean {
  if (!config || !isPaymentMethodComplete(config)) return false;
  const receipt = locale === "ur" ? config.receiptInstructionsUr : config.receiptInstructions;
  if (!receipt?.trim() || !hasPaymentMessagePlaceholders(config, locale)) return false;
  if (locale === "en") return true;
  return Boolean(config.headingUr?.trim() && config.instructionsUr?.trim() && config.referenceInstructionUr?.trim() && config.receiptInstructionsUr?.trim());
}

export function hasCompleteEnabledPaymentMethod(configs: PaymentMethodConfig[]): boolean {
  return configs.some((config) => isPaymentMethodComplete(config) && isPaymentMethodLocaleComplete(config, "en"));
}

export async function configuredPaymentMethodNames(db: D1Database, payableAmount?: number): Promise<string[]> {
  if (payableAmount !== undefined && (!Number.isSafeInteger(payableAmount) || payableAmount <= 0)) return [];
  const methods = await db.prepare("SELECT pm.* FROM payment_methods pm JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE pm.enabled=1 AND pm.qr_owner_verified=1 ORDER BY pm.sort_order, pm.method").all<Record<string, unknown>>();
  return (methods.results ?? [])
    .map((row) => normalizePaymentMethodRow(row))
    .filter((method) => method.qrOwnerVerified && isPaymentMethodComplete(method) && isPaymentMethodLocaleComplete(method, "en"))
    .map((method) => String(method.displayName).trim())
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
    ...(config.instructionsUr ? { instructionsUr: config.instructionsUr } : {}),
    ...(config.referenceInstruction ? { referenceInstruction: config.referenceInstruction } : {}),
    ...(config.referenceInstructionUr ? { referenceInstructionUr: config.referenceInstructionUr } : {}),
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
  if (!isPaymentMethodLocaleComplete(config, locale)) throw new Error("PAYMENT_TRANSLATION_MISSING");
  const instructions = locale === "ur" ? details.instructionsUr : details.instructions;
  const reference = locale === "ur" ? details.referenceInstructionUr : details.referenceInstruction;
  const receipt = locale === "ur" ? details.receiptInstructionsUr : details.receiptInstructions;
  const values: Record<string, string> = {
    amount: String(payableAmount),
    recipientName: details.recipientName ?? "",
    tillId: details.tillId ?? "",
    orderNumber
  };
  const render = (template: string | undefined) => template?.replace(/\{(amount|recipientName|tillId|orderNumber)\}/g, (_match, key: string) => values[key]) ?? "";
  return [locale === "ur" ? details.headingUr : (details.heading ?? details.displayName), render(instructions), render(reference), receipt].filter(Boolean).join("\n");
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
    qrOwnerVerified: Number(row.qr_owner_verified ?? 0) === 1,
    ...(row.instructions ? { instructions: String(row.instructions) } : {}),
    ...(row.instructions_ur ? { instructionsUr: String(row.instructions_ur) } : {}),
    ...(row.reference_instruction ? { referenceInstruction: String(row.reference_instruction) } : {}),
    ...(row.reference_instruction_ur ? { referenceInstructionUr: String(row.reference_instruction_ur) } : {}),
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
