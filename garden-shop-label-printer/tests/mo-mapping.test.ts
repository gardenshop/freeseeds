import { describe, expect, it } from "vitest";
import { projectMoRecords } from "../src/mo/adapter";
import { emptyMoSessionMapping, hasMoSessionMapping, hasVisibleMoFields, moSessionMappingError, resolveMoVisibleFields } from "../src/mo/mapping";
import { EMPTY_ORDER } from "../src/types";

function candidate() {
  const row = {
    ...EMPTY_ORDER(),
    tracking: "VPL 000001",
    cod: "Rs. 25,000",
    orderId: "SYNTHETIC-ORDER",
    name: "Synthetic Receiver",
    phone: "03001234567",
    address: "Synthetic delivery address",
    senderName: "Synthetic Merchant",
    senderAddress: "Synthetic sender address",
  };
  return projectMoRecords([row], { requiredFields: [] }).candidates[0];
}

describe("MO-51 session mapping", () => {
  it("leaves every postal field unmapped unless the user makes an explicit MO-session choice", () => {
    const source = candidate();
    const mapping = emptyMoSessionMapping();
    expect(hasMoSessionMapping(mapping)).toBe(false);
    expect(resolveMoVisibleFields(source, mapping)).toEqual({});
    expect(source.sourceSnapshot.name).toBe("Synthetic Receiver");
    expect(source.sourceSnapshot.senderName).toBe("Synthetic Merchant");
  });

  it("requires explicit user selection and labels candidate provenance without declaring it official", () => {
    const mapping = {
      ...emptyMoSessionMapping(),
      articleNumberSource: "tracking" as const,
      principalSource: "declared-principal" as const,
      senderSource: "article-sender" as const,
      receiverSource: "article-receiver" as const,
    };
    const visible = resolveMoVisibleFields(candidate(), mapping);
    expect(hasMoSessionMapping(mapping)).toBe(true);
    expect(visible).toMatchObject({
      articleNumber: { value: "VPL 000001", provenance: "user-confirmed label candidate" },
      principal: { value: "25000", provenance: "user-confirmed label candidate" },
      senderName: { value: "Synthetic Merchant" },
      receiverName: { value: "Synthetic Receiver" },
    });
    expect(visible.principal?.source).toContain("commission 175 excluded");
  });

  it("never substitutes the source order ID for a V.P. article number", () => {
    const mapping = { ...emptyMoSessionMapping(), articleNumberSource: "tracking" as const };
    const visible = resolveMoVisibleFields(candidate(), mapping);
    expect(visible.articleNumber?.value).toBe("VPL 000001");
    expect(visible.articleNumber?.value).not.toBe("SYNTHETIC-ORDER");
  });

  it("keeps manual entries distinct from imported-field provenance", () => {
    const mapping = {
      ...emptyMoSessionMapping(),
      articleNumberSource: "manual" as const,
      manualArticleNumber: "VPL-MANUAL-7",
      receiverSource: "manual" as const,
      manualReceiverName: "Manual Synthetic Receiver",
      manualReceiverAddress: "Manual Synthetic Address",
    };
    const visible = resolveMoVisibleFields(candidate(), mapping);
    expect(visible.articleNumber).toEqual({ value: "VPL-MANUAL-7", provenance: "manual MO-session entry" });
    expect(visible.receiverName?.provenance).toBe("manual MO-session entry");
    expect(visible.receiverName?.source).toBeUndefined();
  });

  it("marks any selected mapping as a draft and distinguishes it from an empty blank packet", () => {
    const blank = emptyMoSessionMapping();
    expect(hasMoSessionMapping(blank)).toBe(false);
    expect(hasVisibleMoFields(resolveMoVisibleFields(candidate(), blank))).toBe(false);
    const userConfirmed = { ...blank, articleNumberSource: "tracking" as const };
    const fields = resolveMoVisibleFields(candidate(), userConfirmed);
    expect(hasMoSessionMapping(userConfirmed)).toBe(true);
    expect(hasVisibleMoFields(fields)).toBe(true);
  });

  it("fails invalid manual tracking and amount entries without altering the mapping", () => {
    const missingTracking = { ...emptyMoSessionMapping(), articleNumberSource: "manual" as const };
    expect(moSessionMappingError(missingTracking)).toContain("manual V.P. article number");
    const invalidAmount = { ...emptyMoSessionMapping(), principalSource: "manual" as const, manualPrincipal: "12.50" };
    expect(moSessionMappingError(invalidAmount)).toContain("whole-rupee amount");
    const unsafeAmount = { ...emptyMoSessionMapping(), principalSource: "manual" as const, manualPrincipal: "999999999999999999999999999999" };
    expect(moSessionMappingError(unsafeAmount)).toContain("safe whole-rupee integer");
    expect(invalidAmount.manualPrincipal).toBe("12.50");
  });

  it("requires explicit article number provenance before any other mapped field can enter a DRAFT", () => {
    const noArticleNumber = { ...emptyMoSessionMapping(), senderSource: "article-sender" as const };
    expect(moSessionMappingError(noArticleNumber)).toMatch(/Confirm the exact V\.P\. article number/u);
    const confirmedTracking = { ...noArticleNumber, articleNumberSource: "tracking" as const };
    expect(moSessionMappingError(confirmedTracking)).toBeUndefined();
  });
});
