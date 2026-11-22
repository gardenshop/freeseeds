import { describe, expect, it } from "vitest";
import { isExpectedMoPrintTarget } from "../src/mo/print-target";

describe("MO print target safety", () => {
  const expected = "blob:https://garden-shop-label-printer-staging.pages.dev/00000000-0000-4000-8000-000000000057";

  it("accepts only the exact generated application/pdf blob", () => {
    expect(isExpectedMoPrintTarget(expected, expected, "application/pdf")).toBe(true);
  });

  it.each([
    ["about:blank", "application/pdf"],
    ["https://garden-shop-label-printer-staging.pages.dev/", "text/html"],
    ["https://garden-shop-label-printer-staging.pages.dev/", "application/pdf"],
    ["blob:https://garden-shop-label-printer-staging.pages.dev/00000000-0000-4000-8000-000000000058", "application/pdf"],
    ["not a URL", "application/pdf"],
  ])("rejects unexpected popup %j (%j) without authorizing print", (actual, contentType) => {
    expect(isExpectedMoPrintTarget(actual, expected, contentType)).toBe(false);
  });
});
