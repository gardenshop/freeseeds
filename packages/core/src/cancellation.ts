export const CANCELLATION_STAGES = ["OFFER", "REVIEW", "OTHER_PRE_SUBMISSION", "UNKNOWN"] as const;
export type CancellationStage = (typeof CANCELLATION_STAGES)[number];

export const CANCELLATION_REASON_CODES = [
  "DELIVERY_FEE_HIGH",
  "COD_COLLECTION_FEE",
  "ADVANCE_TRUST",
  "PRODUCT_UNSUITABLE",
  "ORDER_LATER",
  "OFFER_UNCLEAR",
  "FERTILIZER_COST",
  "OTHER",
  "UNKNOWN"
] as const;
export type CancellationReasonCode = (typeof CANCELLATION_REASON_CODES)[number];

export type CancellationFeedbackPhase = "REASON" | "SUGGESTION_DECISION" | "SUGGESTION_TEXT" | "COMPLETE";
export type CancellationFeedbackState = {
  eventId: string;
  originalStage: CancellationStage;
  phase: CancellationFeedbackPhase;
  reasonCode?: CancellationReasonCode;
  fertilizerSelected?: boolean;
};

const REASON_ACTIONS: Record<string, CancellationReasonCode> = {
  CANCEL_REASON_DELIVERY: "DELIVERY_FEE_HIGH",
  CANCEL_REASON_COD_FEE: "COD_COLLECTION_FEE",
  CANCEL_REASON_ADVANCE: "ADVANCE_TRUST",
  CANCEL_REASON_PRODUCT: "PRODUCT_UNSUITABLE",
  CANCEL_REASON_LATER: "ORDER_LATER",
  CANCEL_REASON_UNCLEAR: "OFFER_UNCLEAR",
  CANCEL_REASON_FERTILIZER: "FERTILIZER_COST",
  CANCEL_REASON_OTHER: "OTHER"
};

const REASON_ROWS: Record<Exclude<CancellationReasonCode, "UNKNOWN">, { en: string; ur: string; enDescription: string; urDescription: string }> = {
  DELIVERY_FEE_HIGH: { en: "Delivery charge high", ur: "ڈیلیوری فیس زیادہ", enDescription: "The provincial delivery charge affected my decision.", urDescription: "صوبائی ڈیلیوری فیس کی وجہ سے۔" },
  COD_COLLECTION_FEE: { en: "COD collection fee", ur: "COD فیس", enDescription: "The PKR 125 cash collection fee affected my decision.", urDescription: "PKR 125 کیش کلیکشن فیس کی وجہ سے۔" },
  ADVANCE_TRUST: { en: "Advance payment trust", ur: "ایڈوانس پر اعتماد نہیں", enDescription: "I do not want to pay in advance.", urDescription: "میں پیشگی ادائیگی نہیں کرنا چاہتا۔" },
  PRODUCT_UNSUITABLE: { en: "Seeds not suitable", ur: "بیج موزوں نہیں", enDescription: "I am not interested or the seeds are unsuitable.", urDescription: "دلچسپی نہیں یا بیج موزوں نہیں۔" },
  ORDER_LATER: { en: "Order later", ur: "بعد میں آرڈر", enDescription: "I may place the order later.", urDescription: "میں بعد میں آرڈر کر سکتا ہوں۔" },
  OFFER_UNCLEAR: { en: "Offer unclear", ur: "آفر واضح نہیں", enDescription: "The offer or charges were unclear.", urDescription: "آفر یا فیس واضح نہیں تھی۔" },
  FERTILIZER_COST: { en: "Fertilizer cost", ur: "کھاد کی قیمت", enDescription: "I do not want the optional fertilizer cost.", urDescription: "اختیاری کھاد کی قیمت کی وجہ سے۔" },
  OTHER: { en: "Other", ur: "دیگر", enDescription: "Another reason.", urDescription: "کوئی اور وجہ۔" }
};

export function cancellationStageForState(state: string): CancellationStage {
  if (state === "OFFER") return "OFFER";
  if (state === "REVIEW") return "REVIEW";
  return "OTHER_PRE_SUBMISSION";
}

export function cancellationReasonFromAction(action: string): CancellationReasonCode | undefined {
  return REASON_ACTIONS[action];
}

export function cancellationReasonRows(locale: "en" | "ur", includeFertilizer = false): Array<{ id: string; title: string; description: string }> {
  return Object.entries(REASON_ACTIONS).flatMap(([id, rawCode]) => {
    const code = rawCode as Exclude<CancellationReasonCode, "UNKNOWN">;
    if (code === "FERTILIZER_COST" && !includeFertilizer) return [];
    const copy = REASON_ROWS[code];
    return [{ id, title: locale === "ur" ? copy.ur : copy.en, description: locale === "ur" ? copy.urDescription : copy.enDescription }];
  });
}

export function cancellationReasonLabel(code: CancellationReasonCode, locale: "en" | "ur" = "en"): string {
  if (code === "UNKNOWN") return locale === "ur" ? "نامعلوم" : "Unknown";
  return locale === "ur" ? REASON_ROWS[code].ur : REASON_ROWS[code].en;
}

export function cancellationRecovery(code: CancellationReasonCode, locale: "en" | "ur"): { code: string; text: string } | undefined {
  const copy: Partial<Record<CancellationReasonCode, { code: string; en: string; ur: string }>> = {
    COD_COLLECTION_FEE: { code: "ADVANCE_AVOIDS_COD_FEE", en: "If suitable, Advance Payment avoids the PKR 125 COD collection fee.", ur: "اگر مناسب ہو تو پیشگی ادائیگی سے PKR 125 COD کلیکشن فیس نہیں لگتی۔" },
    FERTILIZER_COST: { code: "SEEDS_ONLY", en: "You can continue with the free seeds only and leave out the optional fertilizer.", ur: "آپ صرف مفت بیج جاری رکھ سکتے ہیں اور اختیاری کھاد چھوڑ سکتے ہیں۔" },
    DELIVERY_FEE_HIGH: { code: "PROVINCIAL_CHARGE", en: "The actual provincial delivery charge is shown before confirmation when you restart.", ur: "دوبارہ شروع کرنے پر تصدیق سے پہلے اصل صوبائی ڈیلیوری فیس دکھائی جاتی ہے۔" },
    PRODUCT_UNSUITABLE: { code: "AVAILABLE_SEEDS", en: "Reply START whenever you want to review the currently available seeds.", ur: "موجودہ دستیاب بیج دیکھنے کے لیے جب چاہیں START لکھیں۔" },
    ORDER_LATER: { code: "START_WHEN_READY", en: "Reply START whenever you are ready to order.", ur: "جب آرڈر کے لیے تیار ہوں تو START لکھیں۔" },
    ADVANCE_TRUST: { code: "COD_WHERE_AVAILABLE", en: "Where available, COD can be selected with the disclosed PKR 125 collection fee.", ur: "جہاں دستیاب ہو، واضح PKR 125 کلیکشن فیس کے ساتھ COD منتخب کیا جا سکتا ہے۔" },
    OFFER_UNCLEAR: { code: "CHARGES_BEFORE_CONFIRM", en: "Reply START to review the offer and charges again before confirming.", ur: "تصدیق سے پہلے آفر اور فیس دوبارہ دیکھنے کے لیے START لکھیں۔" }
  };
  const selected = copy[code];
  return selected ? { code: selected.code, text: locale === "ur" ? selected.ur : selected.en } : undefined;
}

export function sanitizeCancellationSuggestion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 300) return undefined;
  return normalized;
}

export function maskCancellationReference(waId: string): string {
  const suffix = waId.replace(/\D/g, "").slice(-4);
  return suffix.length === 4 ? `***${suffix}` : "unavailable";
}
