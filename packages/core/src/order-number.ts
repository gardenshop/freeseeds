export const KARACHI_TIME_ZONE = "Asia/Karachi";
export const ORDER_REFERENCE_MAX_ATTEMPTS = 5;
export const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ORDER_NUMBER_ALLOCATION_SQL = `
INSERT INTO order_number_sequences (order_date, next_sequence, created_at)
VALUES (?, 2, ?)
ON CONFLICT(order_date) DO UPDATE SET next_sequence = order_number_sequences.next_sequence + 1
WHERE order_number_sequences.next_sequence <= 999999
RETURNING next_sequence - 1 AS sequence
`;

export function karachiOrderDate(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error("ORDER_DATE_INVALID");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KARACHI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("ORDER_DATE_FORMAT_FAILED");
  return `${year}${month}${day}`;
}

export function nextOrderNumber(orderDate: Date, sequence: number): string {
  karachiOrderDate(orderDate);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) throw new Error("ORDER_SEQUENCE_EXHAUSTED");
  return createOpaqueOrderNumber();
}

export function createOpaqueOrderNumber(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((value) => CROCKFORD_BASE32[value & 31]).join("");
  return `FS-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export type OrderNumberIdentity = { orderNumber: string; internalSequence: number; internalSequenceDate: string };

export async function allocateOrderIdentity(db: D1Database, now = new Date()): Promise<OrderNumberIdentity> {
  const orderDate = karachiOrderDate(now);
  const result = await db.prepare(ORDER_NUMBER_ALLOCATION_SQL).bind(orderDate, now.toISOString()).first<{ sequence: number }>();
  const sequence = Number(result?.sequence);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) throw new Error("ORDER_SEQUENCE_EXHAUSTED");
  return { orderNumber: createOpaqueOrderNumber(), internalSequence: sequence, internalSequenceDate: orderDate };
}

export async function allocateOrderNumber(db: D1Database, now = new Date()): Promise<string> {
  return (await allocateOrderIdentity(db, now)).orderNumber;
}
