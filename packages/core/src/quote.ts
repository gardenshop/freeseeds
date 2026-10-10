import { z } from "zod";
import { configuredPaymentMethodNames } from "./payments";

export const QuoteRequest = z.object({
  productCode: z.string().trim().min(1).max(100),
  fertilizerSelected: z.boolean(),
  province: z.string().trim().min(1).max(100)
}).strict();
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export type QuoteItem = {
  type: "PRODUCT" | "FERTILIZER";
  code: string;
  name: string;
  quantity: number;
  unitPricePkr: number;
  lineTotalPkr: number;
};

export type OrderQuote = {
  currency: "PKR";
  productCode: string;
  province: string;
  fertilizerSelected: boolean;
  items: QuoteItem[];
  subtotalPkr: number;
  deliveryPkr: number;
  deliveryFeePkr: number;
  totalPkr: number;
  totalPayablePkr: number;
  paymentMethods: string[];
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  price_pkr: number;
  fertilizer_price_pkr?: number | null;
  enabled: number;
};

type RateRow = {
  province: string;
  delivery_fee_pkr: number;
  enabled: number;
};

function configuredInteger(value: unknown, error: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(error);
  return number;
}

export async function quoteOrder(db: D1Database, input: QuoteRequest): Promise<OrderQuote> {
  const request = QuoteRequest.parse(input);
  const product = await db.prepare("SELECT id, code, name, price_pkr, fertilizer_price_pkr, enabled FROM products WHERE code=?").bind(request.productCode).first<ProductRow>();
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (Number(product.enabled) !== 1) throw new Error("PRODUCT_DISABLED");

  const rate = await db.prepare("SELECT province, delivery_fee_pkr, enabled FROM province_delivery_rates WHERE province=? COLLATE NOCASE").bind(request.province).first<RateRow>();
  if (!rate) throw new Error("PROVINCE_DELIVERY_RATE_NOT_FOUND");
  if (Number(rate.enabled) !== 1) throw new Error("PROVINCE_DELIVERY_RATE_DISABLED");

  const productPrice = configuredInteger(product.price_pkr, "PRODUCT_PRICE_INVALID");
  const delivery = configuredInteger(rate.delivery_fee_pkr, "DELIVERY_RATE_INVALID");
  const items: QuoteItem[] = [{ type: "PRODUCT", code: product.code, name: product.name, quantity: 1, unitPricePkr: productPrice, lineTotalPkr: productPrice }];
  if (request.fertilizerSelected) {
    if (product.fertilizer_price_pkr === null || product.fertilizer_price_pkr === undefined) throw new Error("FERTILIZER_NOT_CONFIGURED");
    const fertilizerPrice = configuredInteger(product.fertilizer_price_pkr, "FERTILIZER_PRICE_INVALID");
    items.push({ type: "FERTILIZER", code: `${product.code}:FERTILIZER`, name: "Fertilizer", quantity: 1, unitPricePkr: fertilizerPrice, lineTotalPkr: fertilizerPrice });
  }
  const subtotal = items.reduce((sum, item) => sum + item.lineTotalPkr, 0);
  const total = subtotal + delivery;
  const paymentMethods = total > 0 ? await configuredPaymentMethodNames(db, total) : [];
  return {
    currency: "PKR",
    productCode: product.code,
    province: rate.province,
    fertilizerSelected: request.fertilizerSelected,
    items,
    subtotalPkr: subtotal,
    deliveryPkr: delivery,
    deliveryFeePkr: delivery,
    totalPkr: total,
    totalPayablePkr: total,
    paymentMethods
  };
}
