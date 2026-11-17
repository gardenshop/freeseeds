import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  classifyTrackingPrefix,
  normalizeTrackingReference,
  trackingLabelDisplay,
} from "../src/tracking-rules";

describe("tracking prefix classification", () => {
  it.each([
    ["rgl 123", "RGL"],
    [" ums 123 ", "UMS"],
    [" v p l 123 ", "VPL"],
    ["vpp123", "VPP"],
    ["trk123", "UNKNOWN"],
    ["", "UNKNOWN"],
  ] as const)("classifies %s as %s", (tracking, expected) => {
    expect(classifyTrackingPrefix(tracking)).toBe(expected);
  });

  it("normalizes whitespace/case only for classification and retains source tracking", () => {
    const tracking = " v p l 12 34 ";
    expect(normalizeTrackingReference(tracking)).toBe("VPL1234");
    expect(tracking).toBe(" v p l 12 34 ");
  });
});

describe("VPL/VPP commission", () => {
  it.each([
    [5_000, 75],
    [9_999, 75],
    [10_000, 100],
    [15_000, 100],
    [20_000, 100],
    [20_001, 175],
    [25_000, 175],
    [40_000, 200],
    [45_000, 275],
    [60_000, 300],
    [65_000, 375],
    [80_000, 400],
    [85_000, 475],
    [90_000, 500],
    [95_000, 500],
    [100_000, 500],
  ])("calculates %i rupees as %i rupees", (amount, commission) => {
    expect(calculateCommission(amount)).toEqual({ ok: true, declaredAmount: amount, commission });
  });

  it("uses the 45,000 and 65,000 remainder rules", () => {
    expect(calculateCommission(45_000)).toEqual({ ok: true, declaredAmount: 45_000, commission: 200 + 75 });
    expect(calculateCommission(65_000)).toEqual({ ok: true, declaredAmount: 65_000, commission: 300 + 75 });
  });

  it("accepts whole-rupee legacy/currency formats without floating-point arithmetic", () => {
    expect(calculateCommission("Rs. 25,000")).toEqual({ ok: true, declaredAmount: 25_000, commission: 175 });
    expect(calculateCommission("VPL COD 20,000/-")).toEqual({ ok: true, declaredAmount: 20_000, commission: 100 });
    expect(calculateCommission(100_001)).toEqual({ ok: false, error: "AMOUNT_TOO_HIGH" });
  });

  it.each([
    ["", "AMOUNT_MISSING"],
    ["0", "AMOUNT_ZERO"],
    ["-1", "AMOUNT_INVALID"],
    ["10.50", "AMOUNT_INVALID"],
    ["1,00,000", "AMOUNT_INVALID"],
    ["not money", "AMOUNT_INVALID"],
    ["999999999999999999999999999999", "AMOUNT_TOO_HIGH"],
  ] as const)("rejects invalid amount %j", (amount, error) => {
    expect(calculateCommission(amount)).toEqual({ ok: false, error });
  });
});

describe("tracking label display model", () => {
  it.each(["RGL123", "UMS123"])("does not show or calculate a fee for %s", (tracking) => {
    const display = trackingLabelDisplay(tracking, "not an amount");
    expect(display.error).toBeUndefined();
    expect(display.showAmountBox).toBe(false);
    expect(display.expandDestination).toBe(true);
    expect(display.commission).toBeUndefined();
  });

  it.each(["VPL123", "VPP123"])("shows the corresponding fee for %s", (tracking) => {
    const display = trackingLabelDisplay(tracking, "25,000");
    expect(display.prefix).toBe(tracking.slice(0, 3));
    expect(display.showAmountBox).toBe(true);
    expect(display.expandDestination).toBe(false);
    expect(display.declaredAmount).toBe(25_000);
    expect(display.commission).toBe(175);
  });

  it("fails closed for unknown prefixes and exposes editable amount errors", () => {
    expect(trackingLabelDisplay("TRK123", "5000").error).toMatch(/Unsupported tracking prefix/u);
    expect(trackingLabelDisplay("VPL123", "").error).toMatch(/Enter a positive declared VPL amount/u);
    expect(trackingLabelDisplay("VPP123", "100001").error).toMatch(/exceeds Rs\. 100,000/u);
  });
});
