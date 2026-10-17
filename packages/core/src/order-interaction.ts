import { z } from "zod";
import { quoteOrder, OrderQuote, QuoteItem } from "./quote";
import { configuredPaymentMethodNames } from "./payments";

export const FertilizerDecision = z.enum(["ADD_FERTILIZER", "CONTINUE_WITHOUT_FERTILIZER"]);
export type FertilizerDecision = z.infer<typeof FertilizerDecision>;

export type OrderSummary = {
  currency: "PKR";
  orderId: string;
  orderNumber: string;
  productCode: string;
  province?: string;
  fertilizerSelected: boolean;
  items: QuoteItem[];
  subtotalPkr: number;
  deliveryPkr: number;
  totalPayablePkr: number;
  paymentMethods: string[];
};

export type FertilizerDecisionResult = {
  orderId: string;
  orderNumber: string;
  fertilizerSelected: boolean;
  orderSummary: OrderSummary;
  paymentMethods: string[];
  idempotent: boolean;
};

type OrderRow = {
  id: string;
  order_number: string;
  offer_code: string;
  province?: string | null;
  fertilizer_selected: number;
  seed_price: number;
  fertilizer_fee: number;
  delivery_fee: number;
  total_payable: number;
  state: string;
};

type ItemRow = {
  item_type: "PRODUCT" | "FERTILIZER";
  product_code: string;
  description: string;
  quantity: number;
  unit_price_pkr: number;
  line_total_pkr: number;
};

export function parseFertilizerDecision(input: unknown): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const value = input.trim().toUpperCase();
    if (value === "ADD" || value === "ADD_FERTILIZER" || value === "YES") return true;
    if (value === "CONTINUE" || value === "CONTINUE_WITHOUT_FERTILIZER" || value === "NO") return false;
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const body = input as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(body, "fertilizerSelected")) return parseFertilizerDecision(body.fertilizerSelected);
    if (Object.prototype.hasOwnProperty.call(body, "addFertilizer")) return parseFertilizerDecision(body.addFertilizer);
    if (Object.prototype.hasOwnProperty.call(body, "fertilizerDecision")) return parseFertilizerDecision(body.fertilizerDecision);
    if (Object.prototype.hasOwnProperty.call(body, "fertilizer")) return parseFertilizerDecision(body.fertilizer);
    if (Object.prototype.hasOwnProperty.call(body, "decision")) return parseFertilizerDecision(body.decision);
  }
  throw new Error("FERTILIZER_DECISION_REQUIRED");
}

function summaryFromQuote(orderId: string, orderNumber: string, quote: OrderQuote): OrderSummary {
  return {
    currency: "PKR",
    orderId,
    orderNumber,
    productCode: quote.productCode,
    province: quote.province,
    fertilizerSelected: quote.fertilizerSelected,
    items: quote.items,
    subtotalPkr: quote.subtotalPkr,
    deliveryPkr: quote.deliveryFeePkr,
    totalPayablePkr: quote.totalPayablePkr,
    paymentMethods: quote.paymentMethods
  };
}

export async function getPersistedOrderSummary(db: D1Database, orderId: string): Promise<OrderSummary> {
  const order = await db.prepare("SELECT id, order_number, offer_code, province, fertilizer_selected, seed_price, fertilizer_fee, delivery_fee, total_payable, state FROM orders WHERE id=?").bind(orderId).first<OrderRow>();
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const seedPrice = Number(order.seed_price);
  const fertilizerFee = Number(order.fertilizer_fee);
  const deliveryFee = Number(order.delivery_fee);
  const totalPayable = Number(order.total_payable);
  if (![seedPrice, fertilizerFee, deliveryFee, totalPayable].every((value) => Number.isSafeInteger(value) && value >= 0) || totalPayable !== seedPrice + fertilizerFee + deliveryFee) throw new Error("ORDER_TOTAL_INVALID");
  const itemRows = await db.prepare("SELECT item_type, product_code, description, quantity, unit_price_pkr, line_total_pkr FROM order_items WHERE order_id=? ORDER BY item_type, product_code").bind(orderId).all<ItemRow>();
  const items = (itemRows.results ?? []).map((item) => ({ type: item.item_type, code: item.product_code, name: item.description, quantity: Number(item.quantity), unitPricePkr: Number(item.unit_price_pkr), lineTotalPkr: Number(item.line_total_pkr) }));
  const paymentMethods = await configuredPaymentMethodNames(db, totalPayable);
  return {
    currency: "PKR",
    orderId: String(order.id),
    orderNumber: String(order.order_number),
    productCode: String(order.offer_code),
    ...(order.province ? { province: String(order.province) } : {}),
    fertilizerSelected: Number(order.fertilizer_selected) === 1,
    items,
    subtotalPkr: seedPrice + fertilizerFee,
    deliveryPkr: deliveryFee,
    totalPayablePkr: totalPayable,
    paymentMethods
  };
}

export async function applyFertilizerDecision(db: D1Database, orderId: string, input: unknown): Promise<FertilizerDecisionResult> {
  const fertilizerSelected = parseFertilizerDecision(input);
  const current = await db.prepare("SELECT id, order_number, offer_code, province, fertilizer_selected, seed_price, fertilizer_fee, delivery_fee, total_payable, state FROM orders WHERE id=?").bind(orderId).first<OrderRow>();
  if (!current) throw new Error("ORDER_NOT_FOUND");
  const currentSelection = Number(current.fertilizer_selected) === 1;
  if (current.state === "PAYMENT_PENDING" && currentSelection === fertilizerSelected) {
    const orderSummary = await getPersistedOrderSummary(db, orderId);
    return { orderId, orderNumber: orderSummary.orderNumber, fertilizerSelected, orderSummary, paymentMethods: orderSummary.paymentMethods, idempotent: true };
  }
  if (current.state !== "DETAILS_COMPLETED") throw new Error("ORDER_NOT_ACCEPTING_FERTILIZER_DECISION");
  if (!current.province || !current.offer_code) throw new Error("ORDER_COMMERCE_FIELDS_MISSING");

  // Re-read catalog and delivery authority for every decision; client totals are never used.
  const quote = await quoteOrder(db, { productCode: current.offer_code, province: current.province, fertilizerSelected });
  const product = await db.prepare("SELECT id FROM products WHERE code=?").bind(quote.productCode).first<{ id: string }>();
  const now = new Date().toISOString();
  const auditId = `fertilizer_decision_${orderId}_${fertilizerSelected ? "add" : "continue"}`;
  await db.batch([
    db.prepare("DELETE FROM order_items WHERE order_id=?").bind(orderId),
    ...quote.items.map((item) => db.prepare("INSERT INTO order_items (id,order_id,product_id,item_type,product_code,description,quantity,unit_price_pkr,line_total_pkr,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), orderId, item.type === "PRODUCT" ? product?.id ?? null : null, item.type, item.code, item.name, item.quantity, item.unitPricePkr, item.lineTotalPkr, now)),
    db.prepare("UPDATE orders SET seed_price=?,delivery_fee=?,fertilizer_fee=?,total_payable=?,fertilizer_selected=?,updated_at=? WHERE id=? AND state='DETAILS_COMPLETED'").bind(quote.items.find((item) => item.type === "PRODUCT")?.lineTotalPkr ?? 0, quote.deliveryFeePkr, quote.items.find((item) => item.type === "FERTILIZER")?.lineTotalPkr ?? 0, quote.totalPayablePkr, fertilizerSelected ? 1 : 0, now, orderId),
    db.prepare("UPDATE payments SET expected_amount=?,updated_at=? WHERE order_id=? AND review_state IN ('PENDING','REJECTED')").bind(quote.totalPayablePkr, now, orderId),
    db.prepare("INSERT OR IGNORE INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(auditId, "FERTILIZER_DECISION_APPLIED", "CUSTOMER", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ fertilizerSelected, totalPayablePkr: quote.totalPayablePkr }), now)
  ]);
  const orderSummary = summaryFromQuote(orderId, current.order_number, quote);
  return { orderId, orderNumber: current.order_number, fertilizerSelected, orderSummary, paymentMethods: orderSummary.paymentMethods, idempotent: currentSelection === fertilizerSelected };
}
