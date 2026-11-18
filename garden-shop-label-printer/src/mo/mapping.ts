import type { MoCandidate } from "./adapter";

export type MoPartySource = "blank" | "article-sender" | "article-receiver" | "manual";
export type MoValueSource = "blank" | "tracking" | "declared-principal" | "manual";
export type MoSessionMappingKey = keyof MoSessionMapping;

export type MoSessionMapping = Readonly<{
  articleNumberSource: MoValueSource;
  manualArticleNumber: string;
  principalSource: MoValueSource;
  manualPrincipal: string;
  senderSource: MoPartySource;
  manualSenderName: string;
  manualSenderAddress: string;
  manualSenderPhone: string;
  receiverSource: MoPartySource;
  manualReceiverName: string;
  manualReceiverAddress: string;
  manualReceiverPhone: string;
}>;

export type MoVisibleField = Readonly<{
  value: string;
  provenance: "user-confirmed label candidate" | "manual MO-session entry";
  source?: string;
}>;

export type MoVisibleFields = Readonly<{
  articleNumber?: MoVisibleField;
  principal?: MoVisibleField;
  senderName?: MoVisibleField;
  senderAddress?: MoVisibleField;
  senderPhone?: MoVisibleField;
  receiverName?: MoVisibleField;
  receiverAddress?: MoVisibleField;
  receiverPhone?: MoVisibleField;
}>;

export function emptyMoSessionMapping(): MoSessionMapping {
  return Object.freeze({
    articleNumberSource: "blank",
    manualArticleNumber: "",
    principalSource: "blank",
    manualPrincipal: "",
    senderSource: "blank",
    manualSenderName: "",
    manualSenderAddress: "",
    manualSenderPhone: "",
    receiverSource: "blank",
    manualReceiverName: "",
    manualReceiverAddress: "",
    manualReceiverPhone: "",
  });
}

function sourceField(value: string, source: string): MoVisibleField | undefined {
  return value.trim() ? Object.freeze({ value, provenance: "user-confirmed label candidate", source }) : undefined;
}

function manualField(value: string): MoVisibleField | undefined {
  return value.trim() ? Object.freeze({ value, provenance: "manual MO-session entry" }) : undefined;
}

function partyFields(candidate: MoCandidate, mapping: MoSessionMapping, party: "sender" | "receiver"): Pick<MoVisibleFields, "senderName" | "senderAddress" | "senderPhone" | "receiverName" | "receiverAddress" | "receiverPhone"> {
  const source = party === "sender" ? mapping.senderSource : mapping.receiverSource;
  const manual = party === "sender"
    ? { name: mapping.manualSenderName, address: mapping.manualSenderAddress, phone: mapping.manualSenderPhone }
    : { name: mapping.manualReceiverName, address: mapping.manualReceiverAddress, phone: mapping.manualReceiverPhone };
  let fields: { name?: MoVisibleField; address?: MoVisibleField; phone?: MoVisibleField } = {};

  if (source === "manual") {
    fields = { name: manualField(manual.name), address: manualField(manual.address), phone: manualField(manual.phone) };
  } else if (source === "article-sender") {
    fields = {
      name: sourceField(candidate.sourceSnapshot.senderName, "Order.senderName (label sender profile; defaults are unverified)"),
      address: sourceField(candidate.sourceSnapshot.senderAddress, "Order.senderAddress (label sender profile; defaults are unverified)"),
    };
  } else if (source === "article-receiver") {
    fields = {
      name: sourceField(candidate.sourceSnapshot.name, "Order.name (label article addressee candidate)"),
      address: sourceField(candidate.sourceSnapshot.address, "Order.address (label delivery address candidate)"),
      phone: sourceField(candidate.sourceSnapshot.phone, "Order.phone (label contact candidate)"),
    };
  }

  return party === "sender"
    ? { senderName: fields.name, senderAddress: fields.address, senderPhone: fields.phone }
    : { receiverName: fields.name, receiverAddress: fields.address, receiverPhone: fields.phone };
}

/** Resolve only explicit MO-session selections; there are deliberately no automatic field mappings. */
export function resolveMoVisibleFields(candidate: MoCandidate, mapping: MoSessionMapping): MoVisibleFields {
  const articleNumber = mapping.articleNumberSource === "tracking"
    ? sourceField(candidate.sourceTracking, "Order.tracking (exact imported string)")
    : mapping.articleNumberSource === "manual" ? manualField(mapping.manualArticleNumber) : undefined;
  const principal = mapping.principalSource === "declared-principal"
    ? sourceField(String(candidate.declaredPrincipalRupees), `validated declared amount from Order.cod; commission ${candidate.labelCommissionRupees} excluded`)
    : mapping.principalSource === "manual" ? manualField(mapping.manualPrincipal) : undefined;

  return Object.freeze({
    articleNumber,
    principal,
    ...partyFields(candidate, mapping, "sender"),
    ...partyFields(candidate, mapping, "receiver"),
  });
}

export function hasMoSessionMapping(mapping: MoSessionMapping): boolean {
  return mapping.articleNumberSource !== "blank"
    || mapping.principalSource !== "blank"
    || mapping.senderSource !== "blank"
    || mapping.receiverSource !== "blank";
}

export function hasVisibleMoFields(fields: MoVisibleFields): boolean {
  return Object.values(fields).some((field) => Boolean(field?.value.trim()));
}

export function moSessionMappingError(mapping: MoSessionMapping): string | undefined {
  if (mapping.articleNumberSource === "manual" && !mapping.manualArticleNumber.trim()) return "Enter the manual V.P. article number or choose blank.";
  if (mapping.principalSource === "manual" && !/^\d+(?:,\d{3})*$/u.test(mapping.manualPrincipal)) return "Enter a whole-rupee amount using digits and standard comma groups, or choose blank.";
  if (mapping.principalSource === "manual" && (!Number.isSafeInteger(Number(mapping.manualPrincipal.replaceAll(",", ""))) || Number(mapping.manualPrincipal.replaceAll(",", "")) <= 0)) return "Manual principal must be a positive safe whole-rupee integer.";
  const hasOtherConfirmedFields = mapping.principalSource !== "blank" || mapping.senderSource !== "blank" || mapping.receiverSource !== "blank";
  if (hasOtherConfirmedFields && mapping.articleNumberSource === "blank") return "Confirm the exact V.P. article number source before creating a populated draft.";
  return undefined;
}
