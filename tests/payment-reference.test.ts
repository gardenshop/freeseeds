import { describe, expect, it } from "vitest";
import { customerTransactionReferenceHash, normalizeCustomerTransactionReference } from "@gfs/core";

describe("customer payment transaction references", () => {
  it("normalizes harmless whitespace while preserving the reference value", () => {
    expect(normalizeCustomerTransactionReference("  Txn-192  004 ")).toBe("Txn-192004");
    expect(normalizeCustomerTransactionReference("\tTxn-192\n004\r")).toBe("Txn-192004");
  });

  it("rejects empty, malformed and order-number references", () => {
    expect(normalizeCustomerTransactionReference("  ")).toBeUndefined();
    expect(normalizeCustomerTransactionReference("FS-261022-000001", "FS-261022-000001")).toBeUndefined();
    expect(normalizeCustomerTransactionReference("A?B!C")).toBeUndefined();
    expect(normalizeCustomerTransactionReference("x".repeat(81))).toBeUndefined();
  });

  it("fingerprints references without returning or logging the reference", async () => {
    const a = await customerTransactionReferenceHash("Txn-192004");
    const b = await customerTransactionReferenceHash(" txn-192004 ");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(b).toBe(a);
    expect(a).not.toContain("Txn-192004");
  });
});
