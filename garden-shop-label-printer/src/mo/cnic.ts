export type SenderCnicResult =
  | Readonly<{ status: "empty"; formatted: "" }>
  | Readonly<{ status: "valid"; formatted: string }>
  | Readonly<{ status: "invalid"; formatted: "" }>;

/** Accepts only 13 ASCII digits, either bare or in the standard 5-7-1 grouping. */
export function formatSenderCnic(value: string): SenderCnicResult {
  if (!value.trim()) return Object.freeze({ status: "empty", formatted: "" });
  if (!/^\d{5}-?\d{7}-?\d$/u.test(value)) return Object.freeze({ status: "invalid", formatted: "" });
  const digits = value.replace(/-/gu, "");
  return Object.freeze({
    status: "valid",
    formatted: `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`,
  });
}
