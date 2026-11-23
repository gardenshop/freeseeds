import { describe, expect, it } from "vitest";
import { projectMoRecords } from "../src/mo/adapter";
import { correctMoPartyPositions, defaultMoLayout, hasLegacyMoPartyPositions, loadMoLayout, newMoLayoutField, resetMoLayout, resolveMoLayoutSource, saveMoLayout, updateMoLayoutField, validateMoLayout } from "../src/mo/layout";
import { emptyMoSessionMapping } from "../src/mo/mapping";
import { EMPTY_ORDER } from "../src/types";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

function candidate() {
  const order = { ...EMPTY_ORDER(), tracking: "VPL 000123", cod: "Rs. 25,000", orderId: "SYNTHETIC-ONLY", name: "Synthetic Receiver", phone: "03001234567", address: "Synthetic Address", sourceAddress: "Original Synthetic Address", city: "Sahiwal", province: "Punjab" };
  return projectMoRecords([order], { requiredFields: [] }).candidates[0];
}

describe("MO-51 persistent layout definitions", () => {
  it("starts with a reusable blank default and stores only layout definitions", () => {
    const storage = memoryStorage();
    const field = newMoLayoutField("f-tracking", "tracking", "front", 74, 28);
    const layout = validateMoLayout({ ...defaultMoLayout(), fields: [field] });
    saveMoLayout(layout, storage);
    const saved = storage.getItem("gfs-mo51-layout-v1") ?? "";
    expect(saved).toContain("f-tracking");
    expect(saved).toContain("tracking");
    expect(saved).not.toMatch(/VPL 000123|SYNTHETIC-ONLY|Synthetic Receiver|03001234567/u);
    expect(loadMoLayout(storage)).toEqual(layout);
    expect(resetMoLayout(storage)).toEqual(defaultMoLayout());
    expect(storage.getItem("gfs-mo51-layout-v1")).toBeNull();
  });

  it("uses source-appropriate initial field geometry while keeping the default unbound", () => {
    expect(defaultMoLayout().fields).toEqual([]);
    expect(newMoLayoutField("receiver-name", "name", "front", 10, 80)).toMatchObject({ widthMm: 75, heightMm: 7, fontSizePt: 9, wrap: true });
    expect(newMoLayoutField("receiver-address", "address", "front", 10, 88)).toMatchObject({ widthMm: 105, heightMm: 12, fontSizePt: 8, wrap: true });
    expect(newMoLayoutField("sender-phone", "manualSenderPhone", "front", 10, 118)).toMatchObject({ widthMm: 48, heightMm: 6, fontSizePt: 9, wrap: false });
    expect(newMoLayoutField("article", "tracking", "front", 10, 40)).toMatchObject({ widthMm: 55, heightMm: 7, fontSizePt: 9, wrap: false });
    expect(newMoLayoutField("edge-address", "address", "front", 147.5, 209.5)).toMatchObject({ xMm: 144.5, yMm: 207, widthMm: 4, heightMm: 3 });
  });

  it("migrates saved definitions without bold styling and persists font controls only", () => {
    const field = newMoLayoutField("f-style", "tracking", "front", 10, 20);
    expect(field.fontSizePt).toBe(9);
    expect(field.bold).toBe(false);
    const legacy = { ...field } as Record<string, unknown>;
    delete legacy.bold;
    expect(validateMoLayout({ ...defaultMoLayout(), fields: [legacy] }).fields[0].bold).toBe(false);
    const styled = validateMoLayout({ ...defaultMoLayout(), fields: [{ ...field, fontSizePt: 14, bold: true }] });
    const storage = memoryStorage();
    saveMoLayout(styled, storage);
    expect(loadMoLayout(storage).fields[0]).toMatchObject({ fontSizePt: 14, bold: true });
    expect(storage.getItem("gfs-mo51-layout-v1")).not.toMatch(/VPL000123|Synthetic Receiver|03001234567/u);
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [{ ...field, bold: "yes" }] })).toThrow("MO_LAYOUT_INVALID_BOLD");
  });

  it("flags and corrects a pre-LP-052 layout without changing bindings or other custom fields", () => {
    const legacy = validateMoLayout({ version: 1, fields: [
      { ...newMoLayoutField("sender-name", "senderName", "front", 19.4, 86), fontSizePt: 13, bold: true, wrap: true, alignment: "right" },
      { ...newMoLayoutField("sender-phone", "manualSenderPhone", "front", 20, 92) },
      { ...newMoLayoutField("sender-cnic", "senderCnic", "front", 22, 86) },
      { ...newMoLayoutField("receiver-name", "name", "front", 18, 113), widthMm: 52 },
      { ...newMoLayoutField("receiver-address", "address", "front", 20, 121), widthMm: 72 },
      { ...newMoLayoutField("custom-title", "tracking", "front", 34, 52), widthMm: 61, fontSizePt: 15, bold: true },
      { ...newMoLayoutField("back-custom", "tracking", "back", 18, 34) },
    ] });
    expect(legacy.version).toBe(2);
    expect(legacy.partyPositionVersion).toBe(1);
    expect(hasLegacyMoPartyPositions(legacy)).toBe(true);
    const corrected = correctMoPartyPositions(legacy);
    expect(corrected.partyPositionVersion).toBe(2);
    expect(hasLegacyMoPartyPositions(corrected)).toBe(false);
    expect(corrected.fields.find((field) => field.id === "sender-name")).toMatchObject({ source: "senderName", xMm: 19.4, yMm: 113, fontSizePt: 13, bold: true, wrap: true, alignment: "right" });
    expect(corrected.fields.find((field) => field.id === "sender-phone")?.yMm).toBe(119);
    expect(corrected.fields.find((field) => field.id === "sender-cnic")).toMatchObject({ source: "senderCnic", face: "front", xMm: 22, yMm: 113 });
    expect(corrected.fields.find((field) => field.id === "receiver-name")?.yMm).toBe(86);
    expect(corrected.fields.find((field) => field.id === "receiver-address")?.yMm).toBe(94);
    expect(corrected.fields.find((field) => field.id === "custom-title")).toEqual(legacy.fields.find((field) => field.id === "custom-title"));
    expect(corrected.fields.find((field) => field.id === "back-custom")).toEqual(legacy.fields.find((field) => field.id === "back-custom"));

    const storage = memoryStorage();
    saveMoLayout(legacy, storage);
    expect(hasLegacyMoPartyPositions(loadMoLayout(storage))).toBe(true);
    saveMoLayout(corrected, storage);
    expect(loadMoLayout(storage)).toEqual(corrected);
    expect(hasLegacyMoPartyPositions(loadMoLayout(storage))).toBe(false);
  });

  it("fails the legacy-position correction without mutating the saved input when a field would leave the page", () => {
    const legacy = validateMoLayout({ version: 1, fields: [
      { ...newMoLayoutField("sender-near-edge", "senderName", "front", 10, 100), heightMm: 105 },
    ] });
    expect(() => correctMoPartyPositions(legacy)).toThrow("MO_LAYOUT_PARTY_CORRECTION_OUT_OF_BOUNDS");
    expect(legacy.fields[0].yMm).toBe(100);
    expect(legacy.partyPositionVersion).toBe(1);
  });

  it("rejects clipping, invalid source identifiers and duplicate field keys", () => {
    const outside = { ...defaultMoLayout(), fields: [newMoLayoutField("f-out", "tracking", "front", 120, 20)] };
    expect(() => validateMoLayout({ ...outside, fields: [{ ...outside.fields[0], widthMm: 40 }] })).toThrow("MO_LAYOUT_OUT_OF_BOUNDS");
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [{ ...newMoLayoutField("f-bad", "tracking", "front", 5, 5), source: "orderId" }] })).toThrow("MO_LAYOUT_INVALID_SOURCE");
    const field = newMoLayoutField("same", "name", "front", 5, 5);
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [field, field] })).toThrow("MO_LAYOUT_INVALID_FIELD_ID");
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [newMoLayoutField("cnic-back", "senderCnic", "back", 15, 15)] })).toThrow("MO_SENDER_CNIC_SECTION1_ONLY");
  });

  it("anchors Sender CNIC to the semantic Sender group instead of editable saved coordinates", () => {
    const cnic = newMoLayoutField("sender-cnic-anchor", "senderCnic", "front", 22, 113);
    const layout = validateMoLayout({ ...defaultMoLayout(), fields: [cnic] });
    expect(() => updateMoLayoutField(layout, cnic.id, { xMm: 24 })).toThrow("MO_SENDER_CNIC_SEMANTIC_ANCHOR");
    expect(() => updateMoLayoutField(layout, cnic.id, { yMm: 90 })).toThrow("MO_SENDER_CNIC_SEMANTIC_ANCHOR");
    expect(() => updateMoLayoutField(layout, cnic.id, { widthMm: 30 })).toThrow("MO_SENDER_CNIC_SEMANTIC_ANCHOR");
    expect(updateMoLayoutField(layout, cnic.id, { fontSizePt: 11 }).fields[0]).toMatchObject({ source: "senderCnic", xMm: 22, yMm: 113, fontSizePt: 11 });
  });

  it("resolves reviewed sources per candidate without mutating the frozen snapshot", () => {
    const source = candidate();
    const original = source.sourceSnapshot;
    expect(resolveMoLayoutSource(source, "tracking", "", emptyMoSessionMapping())).toMatchObject({ value: "VPL 000123", provenance: "label candidate" });
    expect(resolveMoLayoutSource(source, "declaredPrincipal", "", emptyMoSessionMapping())?.value).toBe("25000");
    expect(resolveMoLayoutSource(source, "senderCnic", "", emptyMoSessionMapping())).toBeUndefined();
    expect(resolveMoLayoutSource(source, "senderCnic", "00000-1234567-8", emptyMoSessionMapping())).toMatchObject({ value: "00000-1234567-8", provenance: "optional MO-session CNIC" });
    expect(source.sourceSnapshot).toBe(original);
    expect(source.sourceSnapshot.cod).toBe("Rs. 25,000");
  });
});
