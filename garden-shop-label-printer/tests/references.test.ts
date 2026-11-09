import { describe, expect, it } from "vitest";
import { labelReferenceSourceKey, makeLabelReference, reserveUniqueReference } from "../src/references";

describe("secure printed label references", () => {
  it("formats YYMM plus five cryptographically sourced digits", () => {
    const words = [0xffff_ffff, 58_374];
    const reference = makeLabelReference(new Date(2026, 10, 9), () => words.shift()!);
    expect(reference).toBe("FS-2611-58374");
    expect(reference).toMatch(/^FS-\d{4}-\d{5}$/u);
  });

  it("retries collisions and reserves an available non-sequential candidate", async () => {
    const words = [12_345, 12_345, 88_704];
    const reserved = new Set(["FS-2611-12345"]);
    const reference = await reserveUniqueReference(
      new Date(2026, 10, 9),
      () => words.shift()!,
      async (candidate) => {
        if (reserved.has(candidate)) return undefined;
        reserved.add(candidate);
        return candidate;
      },
    );
    expect(reference).toBe("FS-2611-88704");
    expect(reserved.size).toBe(2);
  });

  it("fails closed if the namespace repeatedly collides", async () => {
    await expect(reserveUniqueReference(new Date(2026, 10, 9), () => 7, async () => undefined, 3))
      .rejects.toThrow("REFERENCE_COLLISION_LIMIT");
  });

  it("keys persistence by original Order ID and tracking", () => {
    expect(labelReferenceSourceKey(" SYN-001 ", " trk-syn-001 ")).toBe('["SYN-001","TRK-SYN-001"]');
  });
});
