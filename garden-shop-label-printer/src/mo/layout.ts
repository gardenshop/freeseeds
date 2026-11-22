import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import type { MoSessionMapping } from "./mapping";

export const MO_LAYOUT_STORAGE_KEY = "gfs-mo51-layout-v1";

export const MO_LAYOUT_SOURCES = [
  { id: "tracking", label: "Tracking (exact imported string)" },
  { id: "orderDate", label: "Order Date / Month Stamp (DD-MM-YY)" },
  { id: "articleType", label: "VPL/VPP article type" },
  { id: "declaredPrincipal", label: "Validated declared principal (commission excluded)" },
  { id: "sourceAmount", label: "Original imported amount text" },
  { id: "name", label: "Label receiver name" },
  { id: "address", label: "Label receiver/display address" },
  { id: "sourceAddress", label: "Original imported receiver address" },
  { id: "phone", label: "Label receiver/contact phone" },
  { id: "city", label: "Label city" },
  { id: "province", label: "Label province" },
  { id: "landmark", label: "Label landmark" },
  { id: "senderName", label: "Label sender/profile name (unverified default)" },
  { id: "senderAddress", label: "Label sender/profile address (unverified default)" },
  { id: "email", label: "Existing email field" },
  { id: "facebookName", label: "Existing Facebook name field" },
  { id: "product", label: "Existing product field" },
  { id: "senderCnic", label: "Optional MO-session Sender CNIC" },
  { id: "manualArticleNumber", label: "Manual MO-session V.P. article number" },
  { id: "manualPrincipal", label: "Manual MO-session principal" },
  { id: "manualSenderName", label: "Manual MO-session sender name" },
  { id: "manualSenderAddress", label: "Manual MO-session sender address" },
  { id: "manualSenderPhone", label: "Manual MO-session sender telephone" },
  { id: "manualReceiverName", label: "Manual MO-session receiver name" },
  { id: "manualReceiverAddress", label: "Manual MO-session receiver address" },
  { id: "manualReceiverPhone", label: "Manual MO-session receiver telephone" },
] as const;

export type MoDataSource = (typeof MO_LAYOUT_SOURCES)[number]["id"];
export type MoLayoutFace = "front" | "back";
export type MoLayoutAlignment = "left" | "center" | "right";

export type MoLayoutField = Readonly<{
  id: string;
  source: MoDataSource;
  face: MoLayoutFace;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSizePt: number;
  bold: boolean;
  alignment: MoLayoutAlignment;
  wrap: boolean;
}>;

export type MoLayout = Readonly<{
  version: 2;
  name: "Default MO-51 Layout";
  /** Version 1 layouts were authored with the old sender-upper/receiver-lower form. */
  partyPositionVersion: 1 | 2;
  fields: readonly MoLayoutField[];
}>;

const PARTY_BLOCK_SWAP_MM = 27;
const PARTY_BLOCK_SPLIT_Y_MM = 105;
const senderSources = new Set<MoDataSource>(["senderName", "senderAddress", "senderCnic", "manualSenderName", "manualSenderAddress", "manualSenderPhone"]);
const receiverSources = new Set<MoDataSource>(["name", "address", "sourceAddress", "phone", "city", "province", "landmark", "manualReceiverName", "manualReceiverAddress", "manualReceiverPhone"]);

export type MoResolvedLayoutField = Readonly<{
  value: string;
  provenance: "label candidate" | "user-confirmed MO-session entry" | "optional MO-session CNIC";
  source: MoDataSource;
}>;

const sourceIds = new Set<string>(MO_LAYOUT_SOURCES.map(({ id }) => id));

/** Blank, reusable coordinate system; field binding occurs only when the user drops a palette field. */
export function defaultMoLayout(): MoLayout {
  return Object.freeze({ version: 2, name: "Default MO-51 Layout", partyPositionVersion: 2, fields: Object.freeze([]) });
}

/** Strip unknown keys so no source/customer value can leak into the saved layout object. */
export function validateMoLayout(value: unknown): MoLayout {
  if (!value || typeof value !== "object") throw new Error("MO_LAYOUT_INVALID");
  const data = value as { version?: unknown; partyPositionVersion?: unknown; fields?: unknown };
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.fields) || data.fields.length > 100) throw new Error("MO_LAYOUT_INVALID");
  if (data.version === 2 && data.partyPositionVersion !== 1 && data.partyPositionVersion !== 2) throw new Error("MO_LAYOUT_INVALID_PARTY_POSITION_VERSION");
  const fields: MoLayoutField[] = [];
  const ids = new Set<string>();
  for (const raw of data.fields) {
    if (!raw || typeof raw !== "object") throw new Error("MO_LAYOUT_INVALID_FIELD");
    const field = raw as Record<string, unknown>;
    if (typeof field.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/u.test(field.id) || ids.has(field.id)) throw new Error("MO_LAYOUT_INVALID_FIELD_ID");
    if (typeof field.source !== "string" || !sourceIds.has(field.source)) throw new Error("MO_LAYOUT_INVALID_SOURCE");
    if (field.face !== "front" && field.face !== "back") throw new Error("MO_LAYOUT_INVALID_FACE");
    if (field.source === "senderCnic" && field.face !== "front") throw new Error("MO_SENDER_CNIC_SECTION1_ONLY");
    const numbers = [field.xMm, field.yMm, field.widthMm, field.heightMm, field.fontSizePt];
    if (!numbers.every((number) => typeof number === "number" && Number.isFinite(number))) throw new Error("MO_LAYOUT_INVALID_GEOMETRY");
    const [x, y, width, height, fontSize] = numbers as number[];
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 148.5 || y + height > 210 || fontSize < 4 || fontSize > 48) throw new Error("MO_LAYOUT_OUT_OF_BOUNDS");
    if (field.alignment !== "left" && field.alignment !== "center" && field.alignment !== "right") throw new Error("MO_LAYOUT_INVALID_ALIGNMENT");
    if (typeof field.wrap !== "boolean") throw new Error("MO_LAYOUT_INVALID_WRAP");
    if (field.bold !== undefined && typeof field.bold !== "boolean") throw new Error("MO_LAYOUT_INVALID_BOLD");
    ids.add(field.id);
    fields.push(Object.freeze({
      id: field.id,
      source: field.source as MoDataSource,
      face: field.face,
      xMm: x,
      yMm: y,
      widthMm: width,
      heightMm: height,
      fontSizePt: fontSize,
      bold: field.bold === true,
      alignment: field.alignment,
      wrap: field.wrap,
    }));
  }
  const partyPositionVersion = data.version === 1
    ? (fields.some((field) => field.face === "front" && (senderSources.has(field.source) || receiverSources.has(field.source))) ? 1 : 2)
    : data.partyPositionVersion as 1 | 2;
  return Object.freeze({ version: 2, name: "Default MO-51 Layout", partyPositionVersion, fields: Object.freeze(fields) });
}

export function hasLegacyMoPartyPositions(layout: MoLayout): boolean {
  if (layout.partyPositionVersion !== 1) return false;
  return layout.fields.some((field) => field.face === "front" && (
    (senderSources.has(field.source) && field.yMm < PARTY_BLOCK_SPLIT_Y_MM)
    || (receiverSources.has(field.source) && field.yMm >= PARTY_BLOCK_SPLIT_Y_MM)
  ));
}

/** Translate only party fields still in their old block, preserving all other field styling and geometry. */
export function correctMoPartyPositions(layout: MoLayout): MoLayout {
  const fields = layout.fields.map((field) => {
    if (field.face !== "front") return field;
    const delta = senderSources.has(field.source) && field.yMm < PARTY_BLOCK_SPLIT_Y_MM
      ? PARTY_BLOCK_SWAP_MM
      : receiverSources.has(field.source) && field.yMm >= PARTY_BLOCK_SPLIT_Y_MM
        ? -PARTY_BLOCK_SWAP_MM
        : 0;
    if (!delta) return field;
    const yMm = field.yMm + delta;
    if (yMm < 0 || yMm + field.heightMm > 210) throw new Error("MO_LAYOUT_PARTY_CORRECTION_OUT_OF_BOUNDS");
    return Object.freeze({ ...field, yMm });
  });
  return validateMoLayout({ version: 2, partyPositionVersion: 2, fields });
}

export function loadMoLayout(storage: Pick<Storage, "getItem">): MoLayout {
  try {
    const raw = storage.getItem(MO_LAYOUT_STORAGE_KEY);
    return raw ? validateMoLayout(JSON.parse(raw)) : defaultMoLayout();
  } catch {
    return defaultMoLayout();
  }
}

export function saveMoLayout(layout: MoLayout, storage: Pick<Storage, "setItem">): void {
  const validated = validateMoLayout(layout);
  storage.setItem(MO_LAYOUT_STORAGE_KEY, JSON.stringify(validated));
}

export function resetMoLayout(storage: Pick<Storage, "removeItem">): MoLayout {
  storage.removeItem(MO_LAYOUT_STORAGE_KEY);
  return defaultMoLayout();
}

export function newMoLayoutField(id: string, source: MoDataSource, face: MoLayoutFace, xMm: number, yMm: number): MoLayoutField {
  const widthMm = Math.min(42, 148.5 - xMm);
  const heightMm = Math.min(8, 210 - yMm);
  return Object.freeze({ id, source, face, xMm, yMm, widthMm, heightMm, fontSizePt: 10, bold: false, alignment: "left", wrap: false });
}

export function updateMoLayoutField(layout: MoLayout, fieldId: string, patch: Partial<Omit<MoLayoutField, "id">>): MoLayout {
  const current = layout.fields.find((field) => field.id === fieldId);
  if (!current) throw new Error("MO_LAYOUT_FIELD_NOT_FOUND");
  if (current.source === "senderCnic" && ["face", "xMm", "yMm", "widthMm", "heightMm"].some((key) => key in patch)) {
    throw new Error("MO_SENDER_CNIC_SEMANTIC_ANCHOR");
  }
  const fields = layout.fields.map((field) => field.id === fieldId ? Object.freeze({ ...field, ...patch }) : field);
  return validateMoLayout({ ...layout, fields });
}

export function removeMoLayoutField(layout: MoLayout, fieldId: string): MoLayout {
  return validateMoLayout({ ...layout, fields: layout.fields.filter((field) => field.id !== fieldId) });
}

export function resolveMoLayoutSource(
  candidate: MoCandidate,
  source: MoDataSource,
  senderCnic: string,
  mapping: MoSessionMapping,
): MoResolvedLayoutField | undefined {
  let value: string | undefined;
  let provenance: MoResolvedLayoutField["provenance"] = "label candidate";
  switch (source) {
    case "tracking": value = candidate.sourceTracking; break;
    case "orderDate": value = candidate.sourceSnapshot.orderDate; break;
    case "articleType": value = candidate.prefix; break;
    case "declaredPrincipal": value = String(candidate.declaredPrincipalRupees); break;
    case "sourceAmount": value = candidate.sourceAmount; break;
    case "name": value = candidate.sourceSnapshot.name; break;
    case "address": value = candidate.sourceSnapshot.address; break;
    case "sourceAddress": value = candidate.sourceSnapshot.sourceAddress; break;
    case "phone": value = candidate.sourceSnapshot.phone; break;
    case "city": value = candidate.sourceSnapshot.city; break;
    case "province": value = candidate.sourceSnapshot.province; break;
    case "landmark": value = candidate.sourceSnapshot.landmark; break;
    case "senderName": value = candidate.sourceSnapshot.senderName; break;
    case "senderAddress": value = candidate.sourceSnapshot.senderAddress; break;
    case "email": value = candidate.sourceSnapshot.email; break;
    case "facebookName": value = candidate.sourceSnapshot.facebookName; break;
    case "product": value = candidate.sourceSnapshot.product; break;
    case "senderCnic": {
      const result = formatSenderCnic(senderCnic);
      value = result.status === "valid" ? result.formatted : undefined;
      provenance = "optional MO-session CNIC";
      break;
    }
    case "manualArticleNumber": value = mapping.manualArticleNumber; provenance = "user-confirmed MO-session entry"; break;
    case "manualPrincipal": value = mapping.manualPrincipal; provenance = "user-confirmed MO-session entry"; break;
    case "manualSenderName": value = mapping.manualSenderName; provenance = "user-confirmed MO-session entry"; break;
    case "manualSenderAddress": value = mapping.manualSenderAddress; provenance = "user-confirmed MO-session entry"; break;
    case "manualSenderPhone": value = mapping.manualSenderPhone; provenance = "user-confirmed MO-session entry"; break;
    case "manualReceiverName": value = mapping.manualReceiverName; provenance = "user-confirmed MO-session entry"; break;
    case "manualReceiverAddress": value = mapping.manualReceiverAddress; provenance = "user-confirmed MO-session entry"; break;
    case "manualReceiverPhone": value = mapping.manualReceiverPhone; provenance = "user-confirmed MO-session entry"; break;
  }
  return value?.trim() ? Object.freeze({ value, provenance, source }) : undefined;
}
