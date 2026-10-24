import { describe, expect, it } from "vitest";
import { calculateV2CodPrice, hashV2CodVerificationReference, parseV2CodPolicy, V2CodPolicySchema } from "@gfs/core";

const policy = {
  version: 1,
  feePkr: 125,
  enabled: false,
  eligibleProvinces: ["Punjab"],
  courierProvider: "Synthetic Courier",
  collectionSupported: false,
  remittanceSupported: false,
  verificationReferenceHash: null,
  instructionsEn: "Pay the order total to the courier on delivery.",
  instructionsUr: "ڈیلیوری کے وقت کورئیر کو کل رقم ادا کریں۔"
};

describe("V2 COD policy", () => {
  it("accepts only the single versioned canonical policy shape", () => {
    expect(V2CodPolicySchema.parse(policy)).toEqual(policy);
    expect(parseV2CodPolicy(JSON.stringify(policy))).toEqual(policy);
    expect(parseV2CodPolicy(JSON.stringify({ ...policy, verificationReference: "legacy plaintext" }))).toBeNull();
    expect(parseV2CodPolicy(JSON.stringify({ ...policy, version: undefined }))).toBeNull();
  });

  it("uses keyed HMAC and never serializes the verification reference", async () => {
    const secret = "test-only-policy-key-with-sufficient-entropy";
    const [first, repeat, otherKey] = await Promise.all([
      hashV2CodVerificationReference("  TEST CONTRACT  42 ", secret),
      hashV2CodVerificationReference("TEST CONTRACT 42", secret),
      hashV2CodVerificationReference("TEST CONTRACT 42", `${secret}-rotated`)
    ]);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(repeat).toBe(first);
    expect(otherKey).not.toBe(first);
    expect(JSON.stringify({ ...policy, verificationReferenceHash: first })).not.toContain("TEST CONTRACT");
    await expect(hashV2CodVerificationReference("x", "short")).rejects.toThrow("COD_POLICY_HMAC_KEY_INVALID");
  });

  it.each([250, 300, 350])("adds the COD fee to a configured provincial delivery fee of PKR %i", (deliveryFee) => {
    expect(calculateV2CodPrice(0, 250, deliveryFee, 125).totalPayablePkr).toBe(375 + deliveryFee);
    expect(calculateV2CodPrice(0, 0, deliveryFee, 125).totalPayablePkr).toBe(125 + deliveryFee);
  });

  it("matches requested example totals and rejects invalid price snapshots", () => {
    expect(calculateV2CodPrice(0, 250, 250, 125).totalPayablePkr).toBe(625);
    expect(calculateV2CodPrice(0, 0, 250, 125).totalPayablePkr).toBe(375);
    expect(() => calculateV2CodPrice(0, -1, 250, 125)).toThrow("COD_PRICE_INVALID");
  });
});
