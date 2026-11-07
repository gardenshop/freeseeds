import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("API release manifest protections", () => {
  it("keeps payment-choice recovery enabled in every API candidate manifest", () => {
    const manifest = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../apps/api/wrangler.jsonc"), "utf8");
    expect(manifest).toMatch(/"PAYMENT_CHOICE_RECOVERY_ENABLED"\s*:\s*"true"/);
    expect(manifest).not.toMatch(/"PAYMENT_CHOICE_RECOVERY_ENABLED"\s*:\s*"false"/);
  });
});
