import { describe, expect, it } from "vitest";
import { EMPTY_ORDER, type Order } from "../src/types";
import { imposeMoCandidates } from "../src/mo/imposition";
import { projectMoRecords, type MoRequiredField, type MoSupplement } from "../src/mo/adapter";

function order(tracking: string, cod = "25,000"): Order {
  return { ...EMPTY_ORDER(), rowNumber: 2, tracking, cod, orderId: `ORDER-${tracking}` };
}

function project(orders: readonly Order[], requiredFields: readonly MoRequiredField[] = [], supplements?: ReadonlyMap<number, MoSupplement>) {
  return projectMoRecords(orders, { requiredFields, supplements });
}

describe("MO-51 isolated adapter", () => {
  it.each([
    [1, 1, 2, [1, null, 1, null]],
    [2, 1, 2, [1, 2, 1, 2]],
    [3, 2, 4, [1, 3, 2, null]],
    [5, 3, 6, [1, 4, 3, null]],
    [50, 25, 50, [1, 26, 25, 50]],
    [99, 50, 100, [1, 51, 50, null]],
    [100, 50, 100, [1, 51, 50, 100]],
    [101, 51, 102, [1, 52, 51, null]],
  ] as const)("imposes N=%i into %i sheets and %i logical PDF pages", (count, sheets, pages, expectedPositions) => {
    const records = Array.from({ length: count }, (_, index) => order(`VPL${index + 1}`));
    const eligible = project(records).candidates;
    const plan = imposeMoCandidates(eligible);
    expect(plan.sheetCount).toBe(sheets);
    expect(plan.pdfPageCount).toBe(pages);
    expect(plan.sheets[0].front.left.sourceIndex).toBe(expectedPositions[0] - 1);
    expect(plan.sheets[0].front.right?.sourceIndex ?? null).toBe(expectedPositions[1] === null ? null : expectedPositions[1] - 1);
    expect(plan.sheets.at(-1)?.front.left.sourceIndex).toBe(expectedPositions[2] - 1);
    expect(plan.sheets.at(-1)?.front.right?.sourceIndex ?? null).toBe(expectedPositions[3] === null ? null : expectedPositions[3] - 1);
    expect(plan.sheets.every(({ front, back }) => front.left === back.left && front.right === back.right)).toBe(true);
    const frontIndexes = plan.sheets.flatMap(({ front }) => [front.left.sourceIndex, front.right?.sourceIndex].filter((index): index is number => index !== undefined));
    const rightIndexes = plan.sheets.map(({ front }) => front.right?.sourceIndex ?? null);
    expect(frontIndexes.sort((left, right) => left - right)).toEqual(Array.from({ length: count }, (_, index) => index));
    expect(rightIndexes.filter((index) => index === null)).toHaveLength(count % 2);
    expect(Object.isFrozen(plan) && Object.isFrozen(plan.sheets)).toBe(true);
  });

  it("keeps source selection in import order, source text, identity and commission separate", () => {
    const records = [order("VPL 1", "Rs. 45,000"), order("VPP 2", "PKR 65,000"), order("VPL 3")];
    const selected = new Set([2, 1, 0]);
    const result = projectMoRecords(records, { selectedSourceIndexes: selected, requiredFields: [] });
    expect(result.candidates.map((candidate) => candidate.sourceIndex)).toEqual([0, 1, 2]);
    expect(result.candidates[0].sourceRecord).toBe(records[0]);
    expect(result.candidates[0]).toMatchObject({ sourceTracking: "VPL 1", normalizedTracking: "VPL1", sourceAmount: "Rs. 45,000", declaredPrincipalRupees: 45_000, labelCommissionRupees: 275 });
    expect(Object.isFrozen(result.candidates[0].sourceSnapshot)).toBe(true);
    expect(records[0]).toMatchObject({ tracking: "VPL 1", cod: "Rs. 45,000" });
    expect(Object.isFrozen(records[0])).toBe(false);
    expect(Object.isFrozen(result.candidates[0])).toBe(true);
  });

  it("excludes RGL and UMS without amount validation or mutation", () => {
    const records = [order("RGL1", "not amount"), order("UMS2", "not amount"), order("VPL3")];
    const before = records.map((record) => ({ ...record, warnings: [...record.warnings] }));
    const result = project(records);
    expect(result.candidates.map((candidate) => candidate.sourceIndex)).toEqual([2]);
    expect(result.excluded.map((item) => item.reasons[0].code)).toEqual(["PREFIX_NOT_ELIGIBLE", "PREFIX_NOT_ELIGIBLE"]);
    expect(records).toEqual(before);
  });

  it("filters a mixed-prefix batch using existing classifications and preserves eligible source order", () => {
    const records = [
      order("RGL1", "not money"),
      order("VPL 2", "20,000"),
      order("UMS3", "not money"),
      order("VPP4", "45,000"),
      order("XYZ5", "25,000"),
      order(" v p l 6 ", "25,000"),
      order("VPP7", "100001"),
    ];
    const before = records.map((record) => ({ ...record, warnings: [...record.warnings] }));
    const result = project(records);
    expect(result.candidates.map(({ sourceIndex, prefix }) => [sourceIndex, prefix])).toEqual([[1, "VPL"], [3, "VPP"], [5, "VPL"]]);
    expect(result.excluded.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 2, 4, 6]);
    expect(result.excluded.at(-1)?.reasons.map(({ code }) => code)).toContain("AMOUNT_INVALID");
    expect(records).toEqual(before);
  });

  it.each([
    ["", "TRACKING_MISSING"],
    ["   ", "TRACKING_MISSING"],
    ["TRK1", "TRACKING_PREFIX_UNSUPPORTED"],
  ] as const)("fails closed for tracking %j", (tracking, code) => {
    const result = project([order(tracking)]);
    expect(result.candidates).toHaveLength(0);
    expect(result.excluded[0].reasons.map(({ code: reason }) => reason)).toContain(code);
  });

  it("fails closed for a malformed runtime tracking value without applying string normalization", () => {
    const malformed = { ...order("VPL1"), tracking: null } as unknown as Order;
    const result = project([malformed]);
    expect(result.candidates).toHaveLength(0);
    expect(result.excluded[0].reasons.map(({ code }) => code)).toContain("TRACKING_INVALID");
  });

  it.each(["", "0", "-1", "1.5", "1,00,000", "100001", "not money"])("excludes invalid declared amount %j without changing source", (amount) => {
    const row = order("VPL1", amount);
    const result = project([row]);
    expect(result.candidates).toHaveLength(0);
    expect(result.excluded[0].reasons.map(({ code }) => code)).toContain("AMOUNT_INVALID");
    expect(row.cod).toBe(amount);
  });

  it("rejects every row in a duplicate normalized tracking group, including an unselected collision", () => {
    const records = [order("VPL 12 3"), order(" v p l 1 2 3 "), order("VPP456")];
    const result = projectMoRecords(records, { selectedSourceIndexes: new Set([0, 2]), requiredFields: [] });
    expect(result.candidates.map((candidate) => candidate.sourceIndex)).toEqual([2]);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reasons.map(({ code }) => code)).toContain("TRACKING_DUPLICATE");
  });

  it("requires explicitly configured postal fields and never supplies defaults", () => {
    const required: readonly MoRequiredField[] = ["remitterCnic", "payeeName", "issuingOfficeName", "moneyOrderDate"];
    const supplements = new Map<number, MoSupplement>([[0, { remitterCnic: "TEST-CNIC", payeeName: "TEST PAYEE", issuingOfficeName: "TEST OFFICE" }]]);
    const result = project([order("VPL1")], required, supplements);
    expect(result.candidates).toHaveLength(0);
    expect(result.excluded[0].reasons.filter(({ code }) => code === "MO_REQUIRED_FIELD_MISSING").map(({ field }) => field)).toEqual(["moneyOrderDate"]);
    expect(supplements.get(0)?.remitterCnic).toBe("TEST-CNIC");
    expect(result.excluded[0].sourceRecord.senderName).toBe("Garden Shop");
  });

  it("preserves invalid source records and supplement objects exactly", () => {
    const source = order("VPL1", "100001");
    const supplement = { remitterName: "Synthetic only" } as const;
    const originalSource = structuredClone(source);
    const originalSupplement = structuredClone(supplement);
    projectMoRecords([source], { requiredFields: ["remitterName"], supplements: new Map([[0, supplement]]) });
    expect(source).toEqual(originalSource);
    expect(supplement).toEqual(originalSupplement);
  });

  it("keeps immutable review snapshots while retaining original record identity", () => {
    const source = order("VPL1");
    const candidate = project([source]).candidates[0];
    source.tracking = "VPP_CHANGED";
    source.cod = "999";
    source.warnings.push("later edit");
    expect(candidate.sourceRecord).toBe(source);
    expect(candidate.sourceTracking).toBe("VPL1");
    expect(candidate.sourceAmount).toBe("25,000");
    expect(candidate.sourceSnapshot.tracking).toBe("VPL1");
    expect(candidate.sourceSnapshot.cod).toBe("25,000");
    expect(candidate.sourceSnapshot.warnings).toEqual([]);
  });

  it("returns no sheets for an empty eligible sequence", () => {
    expect(imposeMoCandidates([])).toEqual({ eligibleCount: 0, sheetCount: 0, pdfPageCount: 0, sheets: [] });
  });

  it("rejects duplicate candidate identities rather than producing ambiguous slots", () => {
    const candidate = project([order("VPL1")]).candidates[0];
    expect(() => imposeMoCandidates([candidate, candidate])).toThrow("MO_IMPOSITION_DUPLICATE_OR_INVALID_SOURCE_INDEX");
  });

  it("orders an eligible sequence by source index without mutating the caller array", () => {
    const candidates = project([order("VPL1"), order("VPL2"), order("VPL3")]).candidates;
    const reversed = [...candidates].reverse();
    const plan = imposeMoCandidates(reversed);
    expect(plan.sheets.map(({ front }) => [front.left.sourceIndex, front.right?.sourceIndex ?? null])).toEqual([[0, 2], [1, null]]);
    expect(reversed.map(({ sourceIndex }) => sourceIndex)).toEqual([2, 1, 0]);
  });
});
