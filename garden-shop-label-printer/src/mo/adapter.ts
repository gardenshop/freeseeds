import type { Order } from "../types";
import { calculateCommission, classifyTrackingPrefix, normalizeTrackingReference } from "../tracking-rules";

export const MO_REQUIRED_FIELDS = [
  "articleKind",
  "remitterName",
  "remitterAddress",
  "remitterPhone",
  "remitterCnic",
  "remitterRelationship",
  "sourceOfIncome",
  "remittanceReason",
  "payeeName",
  "payeeAddress",
  "payeePhone",
  "payeeCnic",
  "payeeRelationship",
  "moneyOrderNumber",
  "moneyOrderDate",
  "declarationDate",
  "issuingOfficeName",
  "issuingOfficePostcode",
  "destinationPostcode",
  "payingOfficeName",
  "deliveryOfficeName",
  "journalEntryDate",
  "articleDate",
] as const;

export type MoRequiredField = (typeof MO_REQUIRED_FIELDS)[number];
export type MoSupplement = Readonly<Partial<Record<MoRequiredField, string>>>;
export type MoOrderSnapshot = Readonly<Omit<Order, "warnings"> & { warnings: readonly string[] }>;

export type MoCandidate = Readonly<{
  sourceIndex: number;
  sourceRecord: Order;
  sourceSnapshot: MoOrderSnapshot;
  sourceOrderId: string;
  sourceTracking: string;
  normalizedTracking: string;
  prefix: "VPL" | "VPP";
  sourceAmount: string;
  declaredPrincipalRupees: number;
  labelCommissionRupees: number;
}>;

export type MoExclusionCode =
  | "TRACKING_MISSING"
  | "TRACKING_INVALID"
  | "TRACKING_PREFIX_UNSUPPORTED"
  | "PREFIX_NOT_ELIGIBLE"
  | "TRACKING_DUPLICATE"
  | "AMOUNT_INVALID"
  | "MO_REQUIRED_FIELD_MISSING";

export type MoExcludedRecord = Readonly<{
  sourceIndex: number;
  sourceRecord: Order;
  sourceSnapshot: MoOrderSnapshot;
  sourceTracking: unknown;
  sourceAmount: unknown;
  normalizedTracking?: string;
  prefix?: ReturnType<typeof classifyTrackingPrefix>;
  reasons: readonly Readonly<{ code: MoExclusionCode; field?: MoRequiredField }>[];
}>;

export type MoProjection = Readonly<{
  candidates: readonly MoCandidate[];
  excluded: readonly MoExcludedRecord[];
}>;

export type MoProjectionOptions = Readonly<{
  /** Selection is a membership filter; output always remains in original import order. */
  selectedSourceIndexes?: ReadonlySet<number>;
  /** Must be provided explicitly; an empty list means no postal field has been approved required yet. */
  requiredFields: readonly MoRequiredField[];
  /** Ephemeral caller-supplied values keyed by original import index; never persisted here. */
  supplements?: ReadonlyMap<number, MoSupplement>;
}>;

function duplicateTrackingIndexes(orders: readonly Order[]): ReadonlySet<number> {
  const indexesByTracking = new Map<string, number[]>();
  orders.forEach((order, sourceIndex) => {
    if (typeof order.tracking !== "string") return;
    const normalized = normalizeTrackingReference(order.tracking);
    if (!normalized) return;
    const indexes = indexesByTracking.get(normalized) ?? [];
    indexes.push(sourceIndex);
    indexesByTracking.set(normalized, indexes);
  });

  const duplicates = new Set<number>();
  for (const indexes of indexesByTracking.values()) {
    if (indexes.length > 1) indexes.forEach((index) => duplicates.add(index));
  }
  return duplicates;
}

function snapshotOrder(order: Order): MoOrderSnapshot {
  return Object.freeze({ ...order, warnings: Object.freeze([...order.warnings]) });
}

/** Builds a read-only, source-ordered MO candidate projection. It never edits an Order or supplement. */
export function projectMoRecords(orders: readonly Order[], options: MoProjectionOptions): MoProjection {
  const selected = options.selectedSourceIndexes;
  const duplicates = duplicateTrackingIndexes(orders);
  const candidates: MoCandidate[] = [];
  const excluded: MoExcludedRecord[] = [];

  orders.forEach((order, sourceIndex) => {
    if (selected && !selected.has(sourceIndex)) return;

    const reasons: Array<{ code: MoExclusionCode; field?: MoRequiredField }> = [];
    const tracking: unknown = order.tracking;
    const amount: unknown = order.cod;
    let normalizedTracking: string | undefined;
    let prefix: ReturnType<typeof classifyTrackingPrefix> | undefined;

    if (typeof tracking !== "string") {
      reasons.push({ code: "TRACKING_INVALID" });
    } else if (!tracking.trim()) {
      reasons.push({ code: "TRACKING_MISSING" });
    } else {
      normalizedTracking = normalizeTrackingReference(tracking);
      prefix = classifyTrackingPrefix(tracking);
      if (!normalizedTracking) reasons.push({ code: "TRACKING_MISSING" });
      else if (prefix === "UNKNOWN") reasons.push({ code: "TRACKING_PREFIX_UNSUPPORTED" });
      else if (prefix === "RGL" || prefix === "UMS") reasons.push({ code: "PREFIX_NOT_ELIGIBLE" });
      else if (duplicates.has(sourceIndex)) reasons.push({ code: "TRACKING_DUPLICATE" });
    }

    let amountResult: ReturnType<typeof calculateCommission> | undefined;
    if (prefix === "VPL" || prefix === "VPP") {
      if (typeof amount !== "string") {
        reasons.push({ code: "AMOUNT_INVALID" });
      } else {
        amountResult = calculateCommission(amount);
        if (!amountResult.ok) reasons.push({ code: "AMOUNT_INVALID" });
      }

      const supplement = options.supplements?.get(sourceIndex);
      for (const field of options.requiredFields) {
        const value = supplement?.[field];
        if (typeof value !== "string" || !value.trim()) reasons.push({ code: "MO_REQUIRED_FIELD_MISSING", field });
      }
    }

    if (reasons.length > 0) {
      excluded.push(Object.freeze({
        sourceIndex,
        sourceRecord: order,
        sourceSnapshot: snapshotOrder(order),
        sourceTracking: tracking,
        sourceAmount: amount,
        normalizedTracking,
        prefix,
        reasons: Object.freeze(reasons.map((reason) => Object.freeze(reason))),
      }));
      return;
    }

    if ((prefix !== "VPL" && prefix !== "VPP") || !normalizedTracking || !amountResult?.ok) return;
    candidates.push(Object.freeze({
      sourceIndex,
      sourceRecord: order,
      sourceSnapshot: snapshotOrder(order),
      sourceOrderId: order.orderId,
      sourceTracking: tracking as string,
      normalizedTracking,
      prefix,
      sourceAmount: amount as string,
      declaredPrincipalRupees: amountResult.declaredAmount,
      labelCommissionRupees: amountResult.commission,
    }));
  });

  return Object.freeze({ candidates: Object.freeze(candidates), excluded: Object.freeze(excluded) });
}
