import { describe, expect, it } from "vitest";
import { formatSenderCnic } from "../src/mo/cnic";
import { glyphInkTopFromLineBox, MO_FORM_GEOMETRY } from "../src/mo/renderer";

describe("MO-51 sender CNIC", () => {
  it("allows a blank optional value", () => {
    expect(formatSenderCnic("")).toEqual({ status: "empty", formatted: "" });
    expect(formatSenderCnic("   ")).toEqual({ status: "empty", formatted: "" });
  });

  it("formats 13 digits while preserving leading zeroes", () => {
    expect(formatSenderCnic("0000012345678")).toEqual({ status: "valid", formatted: "00000-1234567-8" });
    expect(formatSenderCnic("00000-1234567-8")).toEqual({ status: "valid", formatted: "00000-1234567-8" });
  });

  it.each(["123456789012", "12345678901234", "12x4567890123", "1234-56789012", "12345--1234567-8", "+92-12345678901"])(
    "rejects invalid nonblank value %j",
    (value) => expect(formatSenderCnic(value)).toEqual({ status: "invalid", formatted: "" }),
  );
});

describe("MO-51 artwork fit", () => {
  it("fits the original 148 x 220 mm page uniformly inside a 148.5 x 210 mm half", () => {
    const geometry = MO_FORM_GEOMETRY;
    expect(geometry.uniformScale).toBeCloseTo(210 / 220, 12);
    expect(geometry.sourceWidthMm * geometry.uniformScale).toBeLessThanOrEqual(geometry.halfWidthMm);
    expect(geometry.sourceHeightMm * geometry.uniformScale).toBeCloseTo(geometry.halfHeightMm, 10);
    expect(geometry.halfWidthMm - geometry.sourceWidthMm * geometry.uniformScale).toBeCloseTo(7.2272727, 6);
    expect(geometry.sheetWidthMm).toBe(297);
    expect(geometry.sheetHeightMm).toBe(210);
  });

  it("anchors Urdu City ink to the CSS line box rather than the taller Range rectangle", () => {
    const fieldTop = 360.4875;
    const fieldHeight = 18.1375;
    const lineRangeTop = fieldTop - 4;
    const fontAscent = 14;
    const fontDescent = 8;
    const actualAscent = 10.8534;
    const actualDescent = 4;
    const inkTop = glyphInkTopFromLineBox(fieldTop, 16, fontAscent, fontDescent, actualAscent);
    const inkBottom = inkTop + actualAscent + actualDescent;

    expect(lineRangeTop + fontAscent - actualAscent).toBeLessThan(fieldTop);
    expect(inkTop).toBeGreaterThanOrEqual(fieldTop);
    expect(inkBottom).toBeLessThanOrEqual(fieldTop + fieldHeight);
    const wrappedLineTop = glyphInkTopFromLineBox(fieldTop, 16, fontAscent, fontDescent, actualAscent, 1);
    expect(wrappedLineTop).toBeCloseTo(inkTop + 16, 6);
    expect(wrappedLineTop + actualAscent + actualDescent).toBeGreaterThan(fieldTop + fieldHeight);
  });
});
