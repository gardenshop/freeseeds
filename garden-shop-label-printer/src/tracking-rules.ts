export type TrackingPrefix = "RGL" | "UMS" | "VPL" | "VPP" | "UNKNOWN";

export type CommissionError = "AMOUNT_MISSING" | "AMOUNT_INVALID" | "AMOUNT_ZERO" | "AMOUNT_TOO_HIGH";

export type CommissionCalculation =
  | { ok: true; declaredAmount: number; commission: number }
  | { ok: false; error: CommissionError };

export type TrackingLabelDisplay = {
  prefix: TrackingPrefix;
  normalizedTracking: string;
  showAmountBox: boolean;
  expandDestination: boolean;
  declaredAmount?: number;
  commission?: number;
  error?: string;
};

export const MAX_DECLARED_AMOUNT = 100_000;
export const MAX_COMMISSION = 500;

/** Normalizes only for prefix/duplicate detection; callers must retain the source barcode value. */
export function normalizeTrackingReference(tracking: string): string {
  return tracking.trim().replace(/\s+/gu, "").toLocaleUpperCase("en-US");
}

export function classifyTrackingPrefix(tracking: string): TrackingPrefix {
  const normalized = normalizeTrackingReference(tracking);
  for (const prefix of ["RGL", "UMS", "VPL", "VPP"] as const) {
    if (normalized.startsWith(prefix)) return prefix;
  }
  return "UNKNOWN";
}

function parseWholeRupees(value: string | number): CommissionCalculation | number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return { ok: false, error: "AMOUNT_INVALID" };
    if (value === 0) return { ok: false, error: "AMOUNT_ZERO" };
    if (value < 0) return { ok: false, error: "AMOUNT_INVALID" };
    if (value > MAX_DECLARED_AMOUNT) return { ok: false, error: "AMOUNT_TOO_HIGH" };
    return value;
  }

  let normalized = value.trim();
  if (!normalized) return { ok: false, error: "AMOUNT_MISSING" };
  normalized = normalized
    .replace(/^(?:(?:VPL|VPP|COD)\s*)+/iu, "")
    .replace(/^(?:Rs\.?|PKR)\s*/iu, "")
    .replace(/\s*\/-\s*$/u, "")
    .trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/u.test(normalized)) return { ok: false, error: "AMOUNT_INVALID" };
  const exactAmount = BigInt(normalized.replace(/,/gu, ""));
  if (exactAmount === 0n) return { ok: false, error: "AMOUNT_ZERO" };
  if (exactAmount > BigInt(MAX_DECLARED_AMOUNT)) return { ok: false, error: "AMOUNT_TOO_HIGH" };
  return Number(exactAmount);
}

/** Calculates label-only VPL/VPP commission using whole-rupee integer arithmetic. */
export function calculateCommission(value: string | number): CommissionCalculation {
  const parsed = parseWholeRupees(value);
  if (typeof parsed !== "number") return parsed;
  const fullBlockCommission = Math.floor(parsed / 20_000) * 100;
  const remainder = parsed % 20_000;
  const remainderCommission = remainder === 0 ? 0 : remainder < 10_000 ? 75 : 100;
  return {
    ok: true,
    declaredAmount: parsed,
    commission: Math.min(MAX_COMMISSION, fullBlockCommission + remainderCommission),
  };
}

function amountError(error: CommissionError, prefix: "VPL" | "VPP"): string {
  if (error === "AMOUNT_TOO_HIGH") return `Declared ${prefix} amount exceeds Rs. 100,000; edit the amount before printing.`;
  if (error === "AMOUNT_MISSING") return `Enter a positive declared ${prefix} amount up to Rs. 100,000 before printing.`;
  if (error === "AMOUNT_ZERO") return `Declared ${prefix} amount must be greater than zero; edit the amount before printing.`;
  return `Declared ${prefix} amount must be a positive whole-rupee value; edit the amount before printing.`;
}

export function trackingLabelDisplay(tracking: string, amount: string): TrackingLabelDisplay {
  const normalizedTracking = normalizeTrackingReference(tracking);
  const prefix = classifyTrackingPrefix(tracking);
  if (prefix === "UNKNOWN") {
    return {
      prefix,
      normalizedTracking,
      showAmountBox: false,
      expandDestination: false,
      error: "Unsupported tracking prefix. Use RGL, UMS, VPL, or VPP and correct the tracking value before printing.",
    };
  }
  if (prefix === "RGL" || prefix === "UMS") {
    return { prefix, normalizedTracking, showAmountBox: false, expandDestination: true };
  }
  const calculation = calculateCommission(amount);
  if (!calculation.ok) {
    return {
      prefix,
      normalizedTracking,
      showAmountBox: true,
      expandDestination: false,
      error: amountError(calculation.error, prefix),
    };
  }
  return {
    prefix,
    normalizedTracking,
    showAmountBox: true,
    expandDestination: false,
    declaredAmount: calculation.declaredAmount,
    commission: calculation.commission,
  };
}
