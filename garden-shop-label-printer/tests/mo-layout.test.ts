import { describe, expect, it } from "vitest";
import { projectMoRecords } from "../src/mo/adapter";
import { defaultMoLayout, loadMoLayout, newMoLayoutField, resetMoLayout, resolveMoLayoutSource, saveMoLayout, validateMoLayout } from "../src/mo/layout";
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

  it("rejects clipping, invalid source identifiers and duplicate field keys", () => {
    const outside = { ...defaultMoLayout(), fields: [newMoLayoutField("f-out", "tracking", "front", 120, 20)] };
    expect(() => validateMoLayout({ ...outside, fields: [{ ...outside.fields[0], widthMm: 40 }] })).toThrow("MO_LAYOUT_OUT_OF_BOUNDS");
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [{ ...newMoLayoutField("f-bad", "tracking", "front", 5, 5), source: "orderId" }] })).toThrow("MO_LAYOUT_INVALID_SOURCE");
    const field = newMoLayoutField("same", "name", "front", 5, 5);
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [field, field] })).toThrow("MO_LAYOUT_INVALID_FIELD_ID");
    expect(() => validateMoLayout({ ...defaultMoLayout(), fields: [newMoLayoutField("cnic-back", "senderCnic", "back", 15, 15)] })).toThrow("MO_SENDER_CNIC_SECTION1_ONLY");
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
