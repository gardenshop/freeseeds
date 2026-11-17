import type { MoCandidate } from "./adapter";

export type MoFaceSlots = Readonly<{
  left: MoCandidate;
  right: MoCandidate | null;
}>;

export type MoSheet = Readonly<{
  sheetNumber: number;
  front: MoFaceSlots;
  back: MoFaceSlots;
}>;

export type MoImposition = Readonly<{
  eligibleCount: number;
  sheetCount: number;
  pdfPageCount: number;
  sheets: readonly MoSheet[];
}>;

/** Pairs logical record slots only. No face order, turn edge, mirroring, or physical rotation is encoded. */
export function imposeMoCandidates(candidates: readonly MoCandidate[]): MoImposition {
  const seenIndexes = new Set<number>();
  for (const candidate of candidates) {
    if (!Number.isInteger(candidate.sourceIndex) || candidate.sourceIndex < 0 || seenIndexes.has(candidate.sourceIndex)) {
      throw new Error("MO_IMPOSITION_DUPLICATE_OR_INVALID_SOURCE_INDEX");
    }
    seenIndexes.add(candidate.sourceIndex);
  }

  const sourceOrdered = [...candidates].sort((left, right) => left.sourceIndex - right.sourceIndex);
  const eligibleCount = sourceOrdered.length;
  const sheetCount = Math.ceil(eligibleCount / 2);
  const sheets: MoSheet[] = [];
  for (let index = 0; index < sheetCount; index += 1) {
    const left = sourceOrdered[index];
    const right = sourceOrdered[index + sheetCount] ?? null;
    const front = Object.freeze({ left, right });
    const back = Object.freeze({ left, right });
    sheets.push(Object.freeze({ sheetNumber: index + 1, front, back }));
  }

  return Object.freeze({
    eligibleCount,
    sheetCount,
    pdfPageCount: 2 * sheetCount,
    sheets: Object.freeze(sheets),
  });
}
