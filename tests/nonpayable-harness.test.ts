import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const harness = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/nonpayable-checkout.html"), "utf8");

describe("offline NON-PAYABLE browser harness boundary", () => {
  it("denies network and persistence while exposing only synthetic test payment details", () => {
    expect(harness).toContain("connect-src 'none'");
    expect(harness).toContain("form-action 'none'");
    expect(harness).toContain("memory only");
    expect(harness).toContain("NON-PAYABLE");
    expect(harness).toContain("NOT SCANNABLE");
    expect(harness).toContain("TEST-JC-001");
    expect(harness).toContain("TEST-EP-002");
    expect(harness).toContain("TEST-IBAN-003");
    expect(harness).toContain("URL.createObjectURL(file)");
    expect(harness).toContain("URL.revokeObjectURL(state.receipt.previewUrl)");
    expect(harness).toContain("NON-PAYABLE synthetic receipt preview");
    expect(harness).toContain("TEST RECEIPT AWAITING ADMIN REVIEW");
    expect(harness).toContain("ٹیسٹ رسید ایڈمن کے جائزے کی منتظر ہے");
    expect(harness).toContain("Duplicate suppressed; same test order retained.");
    expect(harness).toContain("image/svg+xml");
    expect(harness).toContain("state.fields.name");
    expect(harness).toContain("state.fields.address");
    expect(harness).toContain("state.fields.landmark");
    expect(harness).toContain("state.fields.city");
    expect(harness).toContain("state.fields.contact");
    expect(harness).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator\.serviceWorker/i);
    expect(harness).not.toContain("923044429933");
    expect(harness).not.toContain("923034901810");
    expect(harness).not.toMatch(/https?:\/\/(?!www\.w3\.org\/)/i);
  });

  it("labels approvals and fulfillment as simulated and never models real PAID", () => {
    expect(harness).toContain("SIMULATED APPROVAL · NOT PAID");
    expect(harness).toContain("SIMULATED FULFILLMENT · NOT DISPATCHED");
    expect(harness).not.toMatch(/state\s*\.status\s*=\s*['"]PAID['"]/i);
    expect(harness).toContain("TEST_ADMIN_SIMULATED_APPROVAL_NOT_PAID");
  });
});
