import { PaymentMethod } from "./domain";

export type PaymentInstructions = { method: PaymentMethod; configured: boolean; recipientLabel?: string; recipientValue?: string };

export function paymentInstructions(method: PaymentMethod, config: Record<string, string | undefined>): PaymentInstructions {
  const key = method.toUpperCase();
  const value = config[`PAYMENT_${key}`] ?? config[`payment_${method.toLowerCase()}`];
  return value ? { method, configured: true, recipientLabel: "Garden Shop", recipientValue: value } : { method, configured: false };
}
