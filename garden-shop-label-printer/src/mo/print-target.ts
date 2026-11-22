/** A print target is accepted only when it is the exact generated PDF blob. */
export function isExpectedMoPrintTarget(actualUrl: string, expectedUrl: string, contentType: string): boolean {
  if (contentType !== "application/pdf") return false;
  try {
    const expected = new URL(expectedUrl);
    const actual = new URL(actualUrl);
    return expected.protocol === "blob:" && actual.href === expected.href;
  } catch {
    return false;
  }
}
