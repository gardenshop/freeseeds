import { describe, expect, it } from "vitest";
import { projectMoRecords } from "../src/mo/adapter";
import { createMoPdfBlob, MO_PDF_GEOMETRY } from "../src/mo/pdf";
import { EMPTY_ORDER } from "../src/types";

function candidate() {
  const row = { ...EMPTY_ORDER(), tracking: "VPL-SYN-1", cod: "25000", orderId: "SYNTHETIC-ONLY" };
  return projectMoRecords([row], { requiredFields: [] }).candidates;
}

describe("MO-51 PDF export gate", () => {
  it("uses exact A4 landscape MediaBox geometry and 300-DPI raster artwork", () => {
    expect(MO_PDF_GEOMETRY.widthMm).toBe(297);
    expect(MO_PDF_GEOMETRY.heightMm).toBe(210);
    expect(MO_PDF_GEOMETRY.widthPt).toBeCloseTo(841.8897638, 6);
    expect(MO_PDF_GEOMETRY.heightPt).toBeCloseTo(595.2755906, 6);
    expect(MO_PDF_GEOMETRY.rasterDpi).toBe(300);
  });

  it("rejects an empty eligible sequence without creating an empty PDF", async () => {
    await expect(createMoPdfBlob([], "")).rejects.toThrow("MO_PDF_NO_ELIGIBLE_RECORDS");
  });

  it("rejects invalid CNIC before rasterization or PDF creation", async () => {
    await expect(createMoPdfBlob(candidate(), "123456789012")).rejects.toThrow("MO_SENDER_CNIC_INVALID");
  });

  it("honors cancellation before creating temporary frames or output", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createMoPdfBlob(candidate(), "", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
