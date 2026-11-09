import type { PDFDocument, PDFPage } from "pdf-lib";
import { FIELDS, type ImportMapping, type Order } from "./types";

export const TEMPLATE_VERSION = "gfs-a4-18-v2";
export const LABELS_PER_PAGE = 18;
export const LABEL_WIDTH_MM = 65;
export const LABEL_HEIGHT_MM = 44;
export const A4 = { width: 210, height: 297 } as const;
export const A4_LABEL_COLUMNS_MM = [5, 72.5, 140] as const;
export const A4_LABEL_ROWS_MM = [8, 55, 102, 149, 196, 243] as const;
export const MM_TO_POINTS = 72 / 25.4;
export const A4_POINTS = {
  width: A4.width * MM_TO_POINTS,
  height: A4.height * MM_TO_POINTS,
} as const;

export function addA4Page(pdf: PDFDocument): PDFPage {
  return pdf.addPage([A4_POINTS.width, A4_POINTS.height]);
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

export function findAmbiguousMappings(headers: string[]): Array<{ key: keyof ImportMapping; label: string; headers: string[] }> {
  return FIELDS.flatMap((field) => {
    const matches = headers.filter((header) => field.aliases.some((alias) => normalizeHeader(alias) === normalizeHeader(header)));
    return matches.length > 1 ? [{ key: field.key, label: field.label, headers: matches }] : [];
  });
}

export function detectMapping(headers: string[]): ImportMapping {
  const mapping = Object.fromEntries(FIELDS.map(({ key }) => [key, ""])) as ImportMapping;
  for (const field of FIELDS) {
    const matches = headers.filter((candidate) => field.aliases.some((alias) => normalizeHeader(alias) === normalizeHeader(candidate)));
    if (matches.length === 1) mapping[field.key] = matches[0];
  }
  return mapping;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV_UNCLOSED_QUOTE");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function safeContactRemoval(address: string, phone: string): { address: string; removed: boolean } {
  const candidate = phone.trim();
  if (!candidate || candidate.length < 7) return { address, removed: false };
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(^|[\\s,;])${escaped}(?=$|[\\s,;])`).exec(address);
  if (!match) return { address, removed: false };
  const cleaned = (address.slice(0, match.index) + match[0].replace(candidate, "") + address.slice(match.index + match[0].length))
    .replace(/\s+([,;])/g, "$1").replace(/([,;])\s*([,;])/g, "$1").replace(/^[\s,;]+|[\s,;]+$/g, "").replace(/\s{2,}/g, " ");
  return { address: cleaned, removed: true };
}

export function normalizePakistaniPhone(value: string): string | undefined {
  const compact = value.trim().replace(/[\s().\-/–—,:;]/gu, "");
  if (!/^\+?\d+$/u.test(compact)) return undefined;
  if (/^03\d{9}$/u.test(compact)) return compact;
  if (/^3\d{9}$/u.test(compact)) return `0${compact}`;
  const international = /^(?:\+?92)(3\d{9})$/u.exec(compact);
  return international ? `0${international[1]}` : undefined;
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeRows(headers: string[], rows: unknown[][], mapping: ImportMapping, sourceIsCsv = false): Order[] {
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const orders = rows.map((cells, index) => {
    const value = (key: keyof ImportMapping): string => {
      const mapped = mapping[key];
      const column = headerIndex.get(mapped);
      return column === undefined ? "" : textValue(cells[column]);
    };
    const order: Order = {
      rowNumber: index + 2, serial: value("serial"), orderId: value("orderId"), name: value("name"), email: value("email"), phone: value("phone"),
      address: value("address"), sourceAddress: value("address"), facebookName: value("facebookName"), tracking: value("tracking"), cod: value("cod"),
      product: value("product"), city: value("city"), province: value("province"), landmark: value("landmark"),
      senderName: value("senderName") || "Garden Shop", senderAddress: value("senderAddress") || "C/o City Post Office, Sahiwal, Punjab", warnings: [],
    };
    if (!sourceIsCsv && order.phone && typeof cells[headerIndex.get(mapping.phone) ?? -1] === "number") order.warnings.push("Phone cell was numeric; verify leading zeros against the original source.");
    const importedPhone = order.phone;
    const deduped = safeContactRemoval(order.address, importedPhone);
    if (deduped.removed) {
      order.address = deduped.address;
      order.warnings.push("Exact contact match removed from displayed address; original source is retained in the editor.");
    }
    const normalizedPhone = normalizePakistaniPhone(importedPhone);
    if (normalizedPhone) order.phone = normalizedPhone;
    else if (importedPhone) order.warnings.push("Contact number is invalid; enter a Pakistani mobile number with 11 digits.");
    if (!order.name) order.warnings.push("Receiver name is required.");
    if (!order.phone) order.warnings.push("Contact number is missing.");
    if (!order.address) order.warnings.push("Delivery address is required.");
    if (!order.orderId) order.warnings.push("Order ID is missing; none was generated.");
    if (!order.tracking) order.warnings.push("Tracking number is missing; barcode cannot be generated.");
    if (!order.city || !order.province) order.warnings.push("Destination city or province is missing; confirm before printing.");
    return order;
  });
  const phones = new Map<string, number[]>(), tracks = new Map<string, number[]>();
  orders.forEach((order, index) => {
    const phone = normalizePakistaniPhone(order.phone) ?? order.phone.replace(/\D/g, "");
    const tracking = order.tracking.trim().toLocaleUpperCase();
    if (phone) phones.set(phone, [...(phones.get(phone) ?? []), index]);
    if (tracking) tracks.set(tracking, [...(tracks.get(tracking) ?? []), index]);
  });
  for (const group of phones.values()) if (group.length > 1) group.forEach((index) => orders[index].warnings.push("Duplicate contact number."));
  for (const group of tracks.values()) if (group.length > 1) group.forEach((index) => orders[index].warnings.push("Duplicate tracking number."));
  return orders;
}

export function pageForIndex(index: number): { page: number; slot: number } {
  if (!Number.isInteger(index) || index < 0) throw new Error("LABEL_INDEX_INVALID");
  return { page: Math.floor(index / LABELS_PER_PAGE) + 1, slot: index % LABELS_PER_PAGE };
}

export function pagesForCount(count: number, startPosition = 1): number {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(startPosition) || startPosition < 1 || startPosition > LABELS_PER_PAGE) throw new Error("SHEET_POSITION_INVALID");
  return count === 0 ? 0 : Math.ceil((startPosition - 1 + count) / LABELS_PER_PAGE);
}

export function fitText(ctx: CanvasRenderingContext2D, value: string, width: number, height: number, options: { maxFont: number; minFont: number; lineHeight?: number; bold?: boolean; fontFamily?: string; noWrap?: boolean }): { fontSize: number; lines: string[]; fits: boolean } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lineHeight = options.lineHeight ?? 1.15;
  if (options.noWrap) {
    for (let size = options.maxFont; size >= options.minFont; size -= 0.25) {
      ctx.font = `${options.bold ? "900 " : ""}${size}px ${options.fontFamily ?? "Arial"}`;
      if (ctx.measureText(value).width <= width && size * lineHeight <= height)
        return { fontSize: size, lines: [value], fits: true };
    }
    return { fontSize: options.minFont, lines: [value], fits: false };
  }
  const wrap = (size: number) => {
    ctx.font = `${options.bold ? "900 " : ""}${size}px ${options.fontFamily ?? "Arial"}`;
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      const characters = typeof Intl.Segmenter === "function"
        ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((item) => item.segment)
        : [...word];
      for (const character of characters) {
        if (ctx.measureText(current + character).width > width && current) {
          lines.push(current);
          current = character;
        } else current += character;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  for (let size = options.maxFont; size >= options.minFont; size -= 0.25) {
    const lines = wrap(size);
    if (lines.length * lineHeight * size <= height) return { fontSize: size, lines, fits: true };
  }
  const lines = wrap(options.minFont);
  return { fontSize: options.minFont, lines, fits: lines.length * lineHeight * options.minFont <= height };
}

export function safeCsvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function labelBox(index: number, startPosition = 1): { x: number; y: number; page: number; slot: number } {
  if (!Number.isInteger(startPosition) || startPosition < 1 || startPosition > LABELS_PER_PAGE) throw new Error("SHEET_POSITION_INVALID");
  const absolute = startPosition - 1 + index;
  const slot = absolute % LABELS_PER_PAGE;
  const col = slot % 3, row = Math.floor(slot / 3);
  return { x: A4_LABEL_COLUMNS_MM[col], y: A4_LABEL_ROWS_MM[row], page: Math.floor(absolute / LABELS_PER_PAGE) + 1, slot };
}
