export const KARACHI_TIME_ZONE = "Asia/Karachi";

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
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) throw new Error("ORDER_SEQUENCE_EXHAUSTED");
  return `FS-${karachiOrderDate(orderDate).slice(2)}-${String(sequence).padStart(6, "0")}`;
}

export async function allocateOrderNumber(db: D1Database, now = new Date()): Promise<string> {
  const orderDate = karachiOrderDate(now);
  const result = await db.prepare(ORDER_NUMBER_ALLOCATION_SQL).bind(orderDate, now.toISOString()).first<{ sequence: number }>();
  const sequence = Number(result?.sequence);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) throw new Error("ORDER_SEQUENCE_EXHAUSTED");
  return nextOrderNumber(now, sequence);
}
