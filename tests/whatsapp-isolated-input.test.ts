import { describe, expect, it } from "vitest";
import { resolveIsolatedWhatsAppTestInput } from "../apps/api/src/index.js";

describe("isolated WhatsApp test input", () => {
  it("accepts only a CTWA ad opening and localized language buttons", () => {
    expect(resolveIsolatedWhatsAppTestInput({ kind: "text", payload: { text: { body: "Hi, I want to learn more" } }, referral: { sourceType: "ad", ctwaClid: "synthetic-click-id" } })).toBe("CTWA_OPENING");
    expect(resolveIsolatedWhatsAppTestInput({ kind: "interactive", payload: { interactive: { button_reply: { id: "LANG_EN" } } } })).toBe("LANG_EN");
    expect(resolveIsolatedWhatsAppTestInput({ kind: "interactive", payload: { interactive: { list_reply: { id: "LANG_UR" } } } })).toBe("LANG_UR");
  });

  it("rejects non-referral greetings and every order, payment, or dispatch action", () => {
    for (const body of ["Hello", "START", "GET_FREE_PACKS", "PLACE_ORDER", "PAY_ADVANCE", "COD", "SUBMIT"]) {
      const event = { kind: "text", payload: { text: { body } }, referral: body === "Hello" ? undefined : { sourceType: "ad", ctwaClid: "synthetic-click-id" } };
      expect(resolveIsolatedWhatsAppTestInput(event)).toBeUndefined();
    }
    expect(resolveIsolatedWhatsAppTestInput({ kind: "media", payload: { image: { id: "synthetic-media" } } })).toBeUndefined();
    expect(resolveIsolatedWhatsAppTestInput({ kind: "interactive", payload: { interactive: { button_reply: { id: "PAY_COD" } } } })).toBeUndefined();
  });
});
