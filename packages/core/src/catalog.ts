export type CatalogProductInput = {
  code: string;
  name: string;
  category: string;
  pricePkr: number;
  fertilizerPricePkr: number | null;
  active: boolean;
};

export type ProvinceDeliveryRateInput = {
  province: string;
  deliveryFeePkr: number;
  active: boolean;
};

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("CATALOG_VALIDATION_FAILED");
  return input as Record<string, unknown>;
}

function requiredText(value: unknown, error: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(error);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(error);
  return text;
}

export function validatePositiveInteger(value: unknown, error = "CATALOG_POSITIVE_INTEGER_REQUIRED"): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(error);
  return number;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("CATALOG_ACTIVE_REQUIRED");
  return value;
}

export function parseProductInput(input: unknown): CatalogProductInput {
  const body = recordInput(input);
  const fertilizer = body.fertilizerPricePkr ?? body.fertilizer_price_pkr;
  return {
    code: requiredText(body.code, "CATALOG_CODE_REQUIRED", 100),
    name: requiredText(body.name, "CATALOG_NAME_REQUIRED", 160),
    category: requiredText(body.category, "CATALOG_CATEGORY_REQUIRED", 100),
    pricePkr: validatePositiveInteger(body.pricePkr ?? body.price_pkr, "PRODUCT_PRICE_INVALID"),
    fertilizerPricePkr: fertilizer === null || fertilizer === undefined || fertilizer === "" ? null : validatePositiveInteger(fertilizer, "FERTILIZER_PRICE_INVALID"),
    active: booleanValue(body.active ?? body.enabled)
  };
}

export function parseProvinceDeliveryRateInput(input: unknown): ProvinceDeliveryRateInput {
  const body = recordInput(input);
  return {
    province: requiredText(body.province, "PROVINCE_REQUIRED", 100),
    deliveryFeePkr: validatePositiveInteger(body.deliveryFeePkr ?? body.delivery_fee_pkr, "DELIVERY_RATE_INVALID"),
    active: booleanValue(body.active ?? body.enabled)
  };
}
