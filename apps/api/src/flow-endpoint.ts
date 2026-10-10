import { FlowCustomerDetails, FlowOrderSelection, MetaFlowPayload, parseFlowSubmission, persistFlowSubmission, quoteOrder, PaymentMethod, selectPaymentMethod, applyFertilizerDecision, getPersistedOrderSummary, configuredPaymentMethodNames, parseFertilizerDecision } from "@gfs/core";

const CUSTOMER_FIELDS = ["fullName", "deliveryAddress", "nearbyPlace", "city", "contactNumber"] as const;
const ORDER_FIELDS = ["productCode", "province", "fertilizerSelected", "orderId", "fertilizerDecision", "paymentMethod"] as const;

type FlowData = Record<string, unknown>;

function isRecord(value: unknown): value is FlowData {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dataFromPayload(payload: MetaFlowPayload): FlowData {
  const topLevel = Object.fromEntries([...CUSTOMER_FIELDS, ...ORDER_FIELDS].filter((key) => key in payload).map((key) => [key, payload[key]]));
  const nestedData = isRecord(payload.data) ? payload.data : {};
  const nested = Object.fromEntries([...CUSTOMER_FIELDS, ...ORDER_FIELDS].filter((key) => key in nestedData).map((key) => [key, nestedData[key]]));
  return { ...topLevel, ...nested };
}

function actionName(payload: MetaFlowPayload): string {
  return typeof payload.action === "string" ? payload.action.trim().toUpperCase() : "";
}

function screenName(payload: MetaFlowPayload): string {
  return typeof payload.screen === "string" ? payload.screen.trim().toUpperCase() : "";
}

function protocolResponse(screen: string, data: FlowData): MetaFlowPayload {
  return { version: "3.0", screen, data };
}

function protocolError(code: string, screen?: string): MetaFlowPayload {
  return screen ? protocolResponse(screen, { error: code }) : { version: "3.0", error: code };
}

function safeErrorCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "FLOW_REQUEST_FAILED";
  return /^[A-Z0-9_]{3,80}$/.test(code) ? code : "FLOW_REQUEST_FAILED";
}

function asFertilizerSelection(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parseCustomer(data: FlowData) {
  try {
    return FlowCustomerDetails.parse({
      fullName: data.fullName,
      deliveryAddress: data.deliveryAddress,
      nearbyPlace: data.nearbyPlace,
      city: data.city,
      contactNumber: data.contactNumber
    });
  } catch {
    throw new Error("INVALID_CUSTOMER_DETAILS");
  }
}

function parseSelection(data: FlowData, defaultFertilizer = false) {
  try {
    return FlowOrderSelection.parse({
      productCode: data.productCode,
      province: data.province,
      fertilizerSelected: asFertilizerSelection(data.fertilizerSelected) ?? defaultFertilizer
    });
  } catch {
    throw new Error("INVALID_ORDER_SELECTION");
  }
}

async function catalogData(db: D1Database): Promise<FlowData> {
  try {
    const [products, provinces, paymentMethods] = await Promise.all([
      db.prepare("SELECT code, name FROM products WHERE enabled=1 ORDER BY name, code").all<{ code: string; name: string }>(),
      db.prepare("SELECT province FROM province_delivery_rates WHERE enabled=1 ORDER BY province").all<{ province: string }>(),
      configuredPaymentMethodNames(db)
    ]);
    return {
      products: (products.results ?? []).map((product) => ({ id: product.code, title: product.name, code: product.code })),
      provinces: (provinces.results ?? []).map((province) => ({ id: province.province, title: province.province })),
      paymentMethods: paymentMethods.map((name) => ({ id: name, title: name })),
      paymentMethodNames: paymentMethods
    };
  } catch {
    return { products: [], provinces: [], paymentMethods: [], paymentMethodNames: [] };
  }
}

function quoteData(quote: Awaited<ReturnType<typeof quoteOrder>>): FlowData {
  const orderSummary = {
    currency: quote.currency,
    productCode: quote.productCode,
    province: quote.province,
    fertilizerSelected: quote.fertilizerSelected,
    items: quote.items.map((item) => ({ type: item.type, code: item.code, name: item.name, quantity: item.quantity, unitPricePkr: item.unitPricePkr, lineTotalPkr: item.lineTotalPkr })),
    subtotalPkr: quote.subtotalPkr,
    deliveryPkr: quote.deliveryPkr,
    totalPayablePkr: quote.totalPayablePkr
  };
  return {
    ...orderSummary,
    orderSummary,
    paymentMethods: quote.paymentMethods,
    paymentMethodOptions: quote.paymentMethods.map((name) => ({ id: name, title: name }))
  };
}

export async function handleMetaFlowPayload(payload: MetaFlowPayload, db?: D1Database): Promise<MetaFlowPayload> {
  const action = actionName(payload);
  const screen = screenName(payload);
  if (action === "PING" || payload.health_check === "ping") return { version: "3.0", data: { status: "active" } };
  if (action === "INIT") return protocolResponse("CUSTOMER_DETAILS", db ? await catalogData(db) : { products: [], provinces: [] });
  if (action !== "DATA_EXCHANGE" && action !== "NAVIGATE") return protocolError("FLOW_ACTION_UNSUPPORTED", screen || undefined);

  const data = dataFromPayload(payload);
  try {
    if (screen === "CUSTOMER_DETAILS") {
      const customer = parseCustomer(data);
      return protocolResponse("ORDER", { ...customer, ...(db ? await catalogData(db) : { products: [], provinces: [] }) });
    }
    if (screen === "ORDER") {
      const customer = parseCustomer(data);
      const selection = parseSelection(data);
      if (!db) return protocolError("ORDER_QUOTE_UNAVAILABLE", screen);
      const quote = await quoteOrder(db, { ...selection, fertilizerSelected: false });
      return protocolResponse("FERTILIZER", { ...customer, ...selection, fertilizerSelected: false, quote: quoteData(quote), paymentMethods: quote.paymentMethods, paymentMethodOptions: quote.paymentMethods.map((name) => ({ id: name, title: name })) });
    }
    if (screen === "FERTILIZER") {
      if (db && typeof data.orderId === "string" && data.orderId.trim()) {
        const decision = parseFertilizerDecision(data.fertilizerDecision ?? data.fertilizerSelected);
        const result = await applyFertilizerDecision(db, data.orderId, decision);
        return protocolResponse("REVIEW", { orderId: result.orderId, orderNumber: result.orderNumber, fertilizerSelected: result.fertilizerSelected, orderSummary: result.orderSummary, paymentMethods: result.paymentMethods, paymentMethodOptions: result.paymentMethods.map((name) => ({ id: name, title: name })) });
      }
      const customer = parseCustomer(data);
      const selection = parseSelection(data);
      if (!db) return protocolError("ORDER_QUOTE_UNAVAILABLE", screen);
      const quote = await quoteOrder(db, selection);
      return protocolResponse("REVIEW", { ...customer, ...selection, quote: quoteData(quote), paymentMethods: quote.paymentMethods, paymentMethodOptions: quote.paymentMethods.map((name) => ({ id: name, title: name })) });
    }
    if (screen === "REVIEW") {
      const customer = parseCustomer(data);
      const selection = parseSelection(data);
      if (!db) return protocolError("ORDER_QUOTE_UNAVAILABLE", screen);
      const quote = await quoteOrder(db, selection);
      return protocolResponse("SUBMIT", { ...customer, ...selection, quote: quoteData(quote), paymentMethods: quote.paymentMethods, paymentMethodOptions: quote.paymentMethods.map((name) => ({ id: name, title: name })) });
    }
    if (screen === "SUBMIT") {
      const customer = parseCustomer(data);
      const selection = parseSelection(data);
      if (!db) return protocolError("ORDER_PERSISTENCE_UNAVAILABLE", screen);
      const result = await persistFlowSubmission(db, parseFlowSubmission({ ...customer, ...selection }));
      const summary = result.quote ? { ...quoteData(result.quote), orderId: result.orderId, orderNumber: result.orderNumber } : { orderId: result.orderId, orderNumber: result.orderNumber, paymentMethods: [] };
      return protocolResponse("PAYMENT_METHOD", { submitted: true, orderId: result.orderId, orderNumber: result.orderNumber, orderSummary: summary, paymentMethods: result.quote?.paymentMethods ?? [], paymentMethodOptions: (result.quote?.paymentMethods ?? []).map((name) => ({ id: name, title: name })) });
    }
    if (screen === "PAYMENT_METHOD") {
      if (!db || typeof data.orderId !== "string" || !data.orderId.trim()) return protocolError("ORDER_ID_REQUIRED", screen);
      let method: PaymentMethod;
      try { method = PaymentMethod.parse(typeof data.paymentMethod === "string" ? data.paymentMethod.toUpperCase() : data.paymentMethod); } catch { throw new Error("PAYMENT_METHOD_REQUIRED"); }
      const result = await selectPaymentMethod(db, data.orderId, method);
      const summary = await getPersistedOrderSummary(db, data.orderId);
      return protocolResponse("PAYMENT_DETAILS", { orderId: data.orderId, orderNumber: result.orderNumber, amount: result.amount, method: result.config.method, message: result.message, qrAvailable: Boolean(result.config.qrR2Key), orderSummary: summary, paymentMethods: summary.paymentMethods, paymentMethodOptions: summary.paymentMethods.map((name) => ({ id: name, title: name })) });
    }
    if (screen === "PAYMENT_DETAILS") {
      return protocolResponse("PAYMENT_DETAILS", data);
    }
    return protocolError("FLOW_SCREEN_UNSUPPORTED", screen || undefined);
  } catch (error) {
    return protocolError(safeErrorCode(error), screen || undefined);
  }
}
