import { Hono } from "hono";
import type { Context } from "hono";
import { applyFertilizerDecision, createWhatsAppProvider, decryptMetaFlowRequest, encryptMetaFlowResponse, formatCustomerOrderStatus, getLatestOrderForWaId, getPersistedOrderSummary, InteractiveButton, isAllowedInstantFormLead, isPaymentMethodComplete, isTerminalOutboxStatus, logWhatsAppContentMediaError, MetaCapiProvider, MetaFlowEnvelope, normalizePaymentMethodRow, OrderCooldownError, OutboundImage, parseFlowSubmission, parseMetaInstantFormLead, PaymentMethod, persistFlowSubmission, persistInstantFormSubmission, persistWebhookRecords, publishedWhatsAppContent, quoteOrder, renderWhatsAppContent, retryDelaySeconds, selectPaymentMethod, selectPublishedWhatsAppContentMedia, storeReceipt, verifyPaymentQr, whatsAppActionLabel, WhatsAppTemplateKey } from "@gfs/core";
import { handleMetaFlowPayload } from "./flow-endpoint";

type Env = {
  Bindings: {
    DB: D1Database;
    RECEIPTS: R2Bucket;
    EVENTS: Queue;
    DEPLOYMENT_STATE: string;
    WHATSAPP_PROVIDER: string;
    META_PROVIDER_ENABLED: string;
    WHATSAPP_CHECKOUT_MODE?: string;
    META_GRAPH_VERSION?: string;
    META_ACCESS_TOKEN?: string;
    META_PHONE_NUMBER_ID?: string;
    META_WABA_ID?: string;
    META_FLOW_ID?: string;
    WEBHOOK_VERIFY_TOKEN?: string;
    META_APP_SECRET?: string;
    META_CAPI_ENABLED?: string;
    META_DATASET_ID?: string;
    META_INSTANT_FORM_ENABLED?: string;
    META_LEAD_ACCESS_TOKEN?: string;
    META_PAGE_ID?: string;
    META_INSTANT_FORM_ID?: string;
    FLOW_PRIVATE_KEY?: string;
  };
};

const app = new Hono<Env>();

function base64Url(data: Uint8Array): string { return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function decodeBase64Url(value: string): Uint8Array { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }
async function createFlowToken(waId: string, inboundId: string, secret: string): Promise<string> { const payload = base64Url(new TextEncoder().encode(JSON.stringify({ waId, inboundId, exp: Date.now() + 60 * 60 * 1000 }))); const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)); return `${payload}.${base64Url(new Uint8Array(signature))}`; }
async function verifyFlowToken(token: string, secret: string): Promise<string | null> { const [payload, signature] = token.split("."); if (!payload || !signature) return null; try { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); if (!(await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload)))) return null; const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { waId?: string; exp?: number }; return typeof data.waId === "string" && typeof data.exp === "number" && data.exp > Date.now() ? data.waId : null; } catch { return null; } }

type ConversationData = { language?: "en" | "ur"; fullName?: string; deliveryAddress?: string; nearbyPlace?: string; city?: string; contactNumber?: string; province?: string; fertilizerSelected?: boolean; orderId?: string; orderNumber?: string };

type ConversationReplyOptions = { buttons?: InteractiveButton[]; list?: { buttonText: string; rows: Array<{ id: string; title: string; description?: string }> }; image?: OutboundImage; flow?: { id: string; token: string } };

async function contentFor(db: D1Database, key: WhatsAppTemplateKey, fallback: string, values: { orderNumber?: string; totalPkr?: string | number; province?: string; paymentMethod?: string; recipientName?: string; tillId?: string } = {}, sessionKey?: string, locale: "en" | "ur" = "en") {
  const content = await publishedWhatsAppContent(db, key, locale, sessionKey);
  return {
    text: renderWhatsAppContent(content?.text ?? fallback, values),
    buttonLabel: content?.buttonLabel,
    listButtonLabel: content?.listButtonLabel,
    listDescription: content?.listDescription,
    actionLabels: content?.actionLabels,
    mediaId: content?.mediaId,
    mediaR2Key: content?.mediaR2Key,
    mediaMimeType: content?.mediaMimeType
  };
}

async function completeEnabledPaymentMethods(db: D1Database) {
  const methods = await db.prepare("SELECT * FROM payment_methods WHERE enabled=1 ORDER BY sort_order, method").all();
  return (methods.results ?? []).map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)).filter((method) => isPaymentMethodComplete(method));
}

function paymentMethodFromAction(value: string): PaymentMethod | undefined {
  const method = value.startsWith("PAY_") ? value.slice("PAY_".length) : value;
  return PaymentMethod.safeParse(method).data;
}

function paymentActionId(method: PaymentMethod): string {
  return `PAY_${method}`;
}

function paymentActionTitle(payment: Awaited<ReturnType<typeof contentFor>>, method: ReturnType<typeof normalizePaymentMethodRow>): string {
  return (payment.actionLabels as Record<string, string> | undefined)?.[paymentActionId(method.method)] ?? method.displayName;
}

async function paymentCopyForOrder(db: D1Database, orderId: string | undefined, field: "payment_help_copy" | "status_copy"): Promise<string | undefined> {
  if (!orderId) return undefined;
  const row = await db.prepare(`SELECT pm.${field} AS copy FROM payments p JOIN payment_methods pm ON pm.method=p.method WHERE p.order_id=?`).bind(orderId).first<{ copy: string | null }>();
  return row?.copy?.trim() || undefined;
}

async function contentImageFor(db: D1Database, bucket: R2Bucket, key: WhatsAppTemplateKey, sessionKey: string): Promise<OutboundImage | undefined> {
  try {
    const selected = await selectPublishedWhatsAppContentMedia(db, key, sessionKey);
    if (!selected) return undefined;
    const object = await bucket.get(selected.r2Key);
    if (!object) {
      logWhatsAppContentMediaError(key, new Error("WHATSAPP_CONTENT_MEDIA_OBJECT_MISSING"));
      return undefined;
    }
    return { body: await object.arrayBuffer(), mimeType: selected.mimeType, filename: `${key.toLowerCase()}.${selected.mimeType === "image/png" ? "png" : "jpg"}` };
  } catch (error) {
    logWhatsAppContentMediaError(key, error);
    return undefined;
  }
}

export function guidedReplyMediaKey(normalized: string, state: string, nextState: string): WhatsAppTemplateKey | undefined {
  if (normalized === "CANCEL" || (state === "NEW" && nextState === "LANGUAGE")) return "WELCOME";
  if (/^(STATUS|CHECK_ORDER)$/i.test(normalized)) return "ORDER_STATUS";
  if (/^(HELP|SUPPORT)$/i.test(normalized)) return "SUPPORT";
  if (normalized === "PAYMENT_HELP") return "PAYMENT";
  if (["PRODUCT", "PROVINCE", "FERTILIZER"].includes(state) && nextState === state) return "VALIDATION";
  if (state === "NEW" && normalized === "GET_FREE_PACKS") return "OFFER";
  if (state === "PAYMENT_METHOD" || nextState === "PAYMENT_PENDING") return "PAYMENT";
  if (state === "REVIEW" && nextState === "PAYMENT_METHOD") return "CONFIRMATION";
  const nextStateTemplate: Partial<Record<string, WhatsAppTemplateKey>> = { FERTILIZER: "OFFER", PROVINCE: "PROVINCE_DELIVERY", FULL_NAME: "FIELD_FULL_NAME", ADDRESS: "FIELD_DELIVERY_ADDRESS", NEARBY: "FIELD_NEARBY_PLACE", CITY: "FIELD_CITY", CONTACT: "FIELD_CONTACT_NUMBER", REVIEW: "REVIEW", COMPLETE: "CONFIRMATION" };
  return nextStateTemplate[nextState];
}

async function sendConversationReply(db: D1Database, provider: ReturnType<typeof createWhatsAppProvider>, to: string, inboundId: string, body: string, options: ConversationReplyOptions = {}): Promise<{ sent: boolean; messageId?: string }> {
  const key = `conversation_reply:${inboundId}`;
  const existing = await db.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ status: string; provider_message_id: string | null }>();
  if (existing) return { sent: existing.status === "SENT", ...(existing.provider_message_id ? { messageId: existing.provider_message_id } : {}) };
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, "CONVERSATION_REPLY", "PENDING", 0, now, now).run();
  try {
    const sent = options.flow ? await provider.sendFlow(to, options.flow.id, options.flow.token) : options.list ? await provider.sendList(to, body, options.list.buttonText, options.list.rows, options.image) : options.buttons?.length ? await provider.sendInteractive(to, body, options.buttons, options.image) : options.image ? await provider.sendImage(to, body, options.image) : await provider.sendText(to, body);
    await db.prepare("UPDATE outbound_messages SET provider_message_id=?,status='SENT',attempt_count=1,updated_at=? WHERE idempotency_key=?").bind(sent.providerMessageId, new Date().toISOString(), key).run();
    return { sent: true, messageId: sent.providerMessageId };
  } catch (error) {
    const safe = error instanceof Error ? error.message.slice(0, 160) : "META_CONVERSATION_REPLY_FAILED";
    await db.prepare("UPDATE outbound_messages SET status='FAILED',attempt_count=1,last_error=?,updated_at=? WHERE idempotency_key=?").bind(safe, new Date().toISOString(), key).run();
    return { sent: false };
  }
}

type PaymentPartStatus = "SENT" | "SKIPPED" | "FAILED";
type PaymentDeliveryResult = { textSent: boolean; qrStatus: PaymentPartStatus };

async function sendPaymentPart(db: D1Database, to: string, orderId: string, key: string, kind: string, send: () => Promise<{ providerMessageId: string }>): Promise<PaymentPartStatus> {
  const existing = await db.prepare("SELECT id,status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null }>();
  if (existing?.status === "SENT" || existing?.status === "SKIPPED") return existing.status;
  const now = new Date().toISOString();
  if (!existing) await db.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,order_id,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, orderId, kind, "PENDING", 0, now, now).run();
  const row = await db.prepare("SELECT id,status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null }>();
  if (!row || row.provider_message_id || !["PENDING", "FAILED", "RETRY"].includes(row.status)) return row?.status === "SENT" ? "SENT" : "FAILED";
  const claim = await db.prepare("UPDATE outbound_messages SET status='SENDING',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND provider_message_id IS NULL AND status IN ('PENDING','FAILED','RETRY')").bind(now, row.id).run();
  if (!claim.meta.changes) return "FAILED";
  try {
    const sent = await send();
    await db.prepare("UPDATE outbound_messages SET provider_message_id=?,status='SENT',last_error=NULL,updated_at=? WHERE id=?").bind(sent.providerMessageId, new Date().toISOString(), row.id).run();
    return "SENT";
  } catch (error) {
    const safe = error instanceof Error ? error.message.slice(0, 160) : "PAYMENT_OUTBOUND_FAILED";
    await db.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE id=?").bind(safe, new Date().toISOString(), row.id).run();
    return "FAILED";
  }
}

async function markPaymentPartSkipped(db: D1Database, orderId: string, key: string, kind: string, reason: string): Promise<PaymentPartStatus> {
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,order_id,kind,status,attempt_count,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, orderId, kind, "SKIPPED", 0, reason, now, now).run();
  return "SKIPPED";
}

async function paymentQrFromR2(bucket: R2Bucket, config: ReturnType<typeof normalizePaymentMethodRow>): Promise<{ body: ArrayBuffer; mimeType: string } | undefined> {
  if (!config.qrR2Key) return undefined;
  if (!config.qrOwnerVerified) throw new Error("PAYMENT_QR_OWNERSHIP_UNVERIFIED");
  if (!config.qrMimeType || !config.qrSha256 || config.qrSizeBytes === undefined) throw new Error("PAYMENT_QR_METADATA_UNVERIFIED");
  const object = await bucket.get(config.qrR2Key);
  if (!object) throw new Error("PAYMENT_QR_NOT_FOUND");
  const body = await object.arrayBuffer();
  const contentType = object.httpMetadata?.contentType;
  if (contentType && contentType !== config.qrMimeType) throw new Error("PAYMENT_QR_CONTENT_TYPE_MISMATCH");
  if (object.customMetadata?.method && object.customMetadata.method !== config.method) throw new Error("PAYMENT_QR_METHOD_MISMATCH");
  if (object.customMetadata?.sha256 && object.customMetadata.sha256 !== config.qrSha256) throw new Error("PAYMENT_QR_METADATA_CHECKSUM_MISMATCH");
  await verifyPaymentQr(body, config.qrMimeType, config.qrSha256, config.qrSizeBytes);
  return { body, mimeType: config.qrMimeType };
}

async function deliverPaymentInstructions(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, to: string, orderId: string, orderNumber: string, method: PaymentMethod, locale: "en" | "ur", message: string, config: ReturnType<typeof normalizePaymentMethodRow>): Promise<PaymentDeliveryResult> {
  const textStatus = await sendPaymentPart(db, to, orderId, `payment_text_${orderId}_${method}_${locale}`, "WHATSAPP_PAYMENT_TEXT", () => provider.sendText(to, message));
  const qrKey = `payment_qr_${orderId}_${method}`;
  let qrStatus: PaymentPartStatus;
  if (!config.qrR2Key) {
    qrStatus = await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", "PAYMENT_QR_NOT_CONFIGURED");
  } else {
    try {
      const qr = await paymentQrFromR2(bucket, config);
      qrStatus = qr ? await sendPaymentPart(db, to, orderId, qrKey, "WHATSAPP_PAYMENT_QR", () => provider.sendPaymentQr(to, qr)) : "SKIPPED";
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 160) : "PAYMENT_QR_DELIVERY_BLOCKED";
      qrStatus = await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", reason);
      await db.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE idempotency_key=? AND status='SKIPPED'").bind(reason, reason, new Date().toISOString(), qrKey).run();
      qrStatus = "FAILED";
      await db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_QR_DELIVERY_BLOCKED", "SYSTEM", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ method, orderNumber, reason }), new Date().toISOString()).run();
    }
  }
  await db.prepare("UPDATE outbox_jobs SET status=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(textStatus === "SENT" && qrStatus !== "FAILED" ? "SENT" : "RETRY", qrStatus === "FAILED" ? "PAYMENT_QR_DELIVERY_BLOCKED" : null, new Date().toISOString(), `payment_instructions_${orderId}_${method}`).run();
  return { textSent: textStatus === "SENT", qrStatus };
}

async function processGuidedConversation(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }, flowId: string, flowTokenSecret?: string, checkoutMode: string = "guided", events?: Queue): Promise<boolean> {
  const sessionContent = (key: WhatsAppTemplateKey, fallback: string, values: { orderNumber?: string; totalPkr?: string | number; province?: string; paymentMethod?: string; recipientName?: string; tillId?: string } = {}) => contentFor(db, key, fallback, values, `CHAT:${event.from}`, data.language ?? "en");
  const message = event.payload && typeof event.payload === "object" ? event.payload as { text?: { body?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string }; nfm_reply?: { response_json?: string } }; button?: { payload?: string; text?: string } } : {};
  const interaction = message.interactive?.button_reply ?? message.interactive?.list_reply;
  const interactionId = interaction?.id ?? message.button?.payload;
  if (message.interactive?.nfm_reply?.response_json) {
    try {
      const flowData = JSON.parse(message.interactive.nfm_reply.response_json) as { orderNumber?: string; orderId?: string; submitted?: boolean };
      if (flowData.orderId || flowData.orderNumber) {
        const existing = await db.prepare("SELECT state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state_data: string }>();
        let stateData: Record<string, unknown> = {};
        try { stateData = existing?.state_data ? JSON.parse(existing.state_data) as Record<string, unknown> : {}; } catch { stateData = {}; }
        Object.assign(stateData, { orderId: flowData.orderId, orderNumber: flowData.orderNumber });
        await db.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_METHOD',state_data=?,last_inbound_message_id=?,updated_at=? WHERE wa_id=?").bind(JSON.stringify(stateData), event.id, new Date().toISOString(), event.from).run();
        return true;
      }
    } catch { /* invalid Flow response remains ignored without raw-body logging */ }
  }
  const text = typeof message.text?.body === "string" ? message.text.body.trim() : String(interactionId ?? interaction?.title ?? message.button?.text ?? (message.interactive?.nfm_reply ? "FLOW_SUBMIT" : "")).trim();
  if (!text) return false;
  const normalized = (interactionId ?? text).toUpperCase();
  const row = await db.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string }>();
  const state = row?.state ?? "NEW";
  const originalStateData = row?.state_data ?? "{}";
  let data: ConversationData = {};
  try { data = row?.state_data ? JSON.parse(row.state_data) as ConversationData : {}; } catch { data = {}; }
  let nextState = state;
  let reply: string | null = null;
  let paymentSelection: { orderId: string; orderNumber: string; method: PaymentMethod; locale: "en" | "ur"; message: string; config: ReturnType<typeof normalizePaymentMethodRow> } | undefined;
  let completePaymentMethods: Awaited<ReturnType<typeof completeEnabledPaymentMethods>> = [];
  if (normalized === "CANCEL") { nextState = "NEW"; data = {}; reply = (await sessionContent("WELCOME", "Order entry cancelled. Tap below when you are ready to start.")).text; }
  else if (normalized === "BACK" && state === "REVIEW") { nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; }
  else if (/^(STATUS|CHECK_ORDER)$/i.test(normalized)) { const order = await getLatestOrderForWaId(db, event.from, data.orderId); const status = await sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status."); const paymentStatusCopy = order ? await paymentCopyForOrder(db, order.id, "status_copy") : undefined; reply = order ? `${paymentStatusCopy ?? status.text}\n${formatCustomerOrderStatus(order)}` : "No order was found for this WhatsApp conversation."; }
  else if (/^(HELP|SUPPORT)$/i.test(normalized)) { reply = (await sessionContent("SUPPORT", "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry.")).text; }
  else if (state === "NEW" && (normalized === "START" || Boolean(text))) { nextState = "LANGUAGE"; const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) { data.language = normalized === "LANG_UR" ? "ur" : "en"; nextState = checkoutMode === "guided" ? "FERTILIZER" : "FLOW_ACTIVE"; reply = (await sessionContent("FERTILIZER", "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?")).text; }
  else if (state === "LANGUAGE") { const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "NEW" && normalized === "GET_FREE_PACKS") { nextState = "FERTILIZER"; reply = (await sessionContent("OFFER", "Get 5 seed packs FREE. Choose your option to continue.")).text; }
  else if (state === "FULL_NAME") { data.fullName = text; nextState = "ADDRESS"; reply = (await sessionContent("FIELD_DELIVERY_ADDRESS", "Please reply with your complete delivery address.")).text; }
  else if (state === "ADDRESS") { data.deliveryAddress = text; nextState = "NEARBY"; reply = (await sessionContent("FIELD_NEARBY_PLACE", "Please reply with a nearby famous place.")).text; }
  else if (state === "NEARBY") { data.nearbyPlace = text; nextState = "CITY"; reply = (await sessionContent("FIELD_CITY", "Please reply with your city.")).text; }
  else if (state === "CITY") { data.city = text; nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; }
  else if (state === "CONTACT") { data.contactNumber = text; nextState = "REVIEW"; const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province ?? "", fertilizerSelected: data.fertilizerSelected ?? false }); const review = await sessionContent("REVIEW", "Review your order. Tap Place Order to confirm."); reply = `${quote.items.map((item) => `${item.name}: PKR ${item.lineTotalPkr}`).join("\n")}\nDelivery: PKR ${quote.deliveryFeePkr}\nTOTAL: PKR ${quote.totalPayablePkr}\n${review.text}`; }
  else if (state === "PRODUCT") { if (!/^(YES|SEEDS_ONLY|ADD_FERTILIZER)$/i.test(normalized)) { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } else { data.fertilizerSelected = normalized === "ADD_FERTILIZER"; nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "PROVINCE") { const provinceChoice = normalized.startsWith("PROVINCE_") ? normalized.slice(9).replace(/_/g, " ") : text; try { const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: provinceChoice, fertilizerSelected: data.fertilizerSelected ?? false }); data.province = quote.province; nextState = "FULL_NAME"; reply = (await sessionContent("FIELD_FULL_NAME", "Please reply with your full name.")).text; } catch { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } }
  else if (state === "FERTILIZER") { if (!/^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/i.test(normalized)) reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; else { data.fertilizerSelected = /^(YES|ADD_FERTILIZER)$/i.test(normalized); nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "REVIEW") { if (!/^(CONFIRM|PLACE_ORDER)$/i.test(normalized)) reply = (await sessionContent("REVIEW", "Review your order. Tap Place Order to confirm.")).text; else if (!data.fullName || !data.deliveryAddress || !data.nearbyPlace || !data.city || !data.contactNumber || !data.province) { nextState = "FULL_NAME"; data = {}; reply = (await sessionContent("FIELD_FULL_NAME", "I need to restart safely. Please reply with your full name.")).text; } else { const submission = { fullName: data.fullName, deliveryAddress: data.deliveryAddress, nearbyPlace: data.nearbyPlace, city: data.city, contactNumber: data.contactNumber, productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province, fertilizerSelected: data.fertilizerSelected ?? false, whatsappNumber: event.from }; try { const result = await persistFlowSubmission(db, submission, undefined, `WHATSAPP:${event.id}`, event.from); data.orderId = result.orderId; data.orderNumber = result.orderNumber; const methods = (await db.prepare("SELECT * FROM payment_methods WHERE enabled=1").all()).results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)).filter((method) => isPaymentMethodComplete(method)); nextState = methods.length ? "PAYMENT_METHOD" : "COMPLETE"; const confirmation = await sessionContent("CONFIRMATION", "Order {orderNumber} created. Total: PKR {totalPkr}.", { orderNumber: result.orderNumber, totalPkr: result.quote?.totalPayablePkr ?? "configured tariff" }); reply = `${confirmation.text}\n${methods.length ? (await sessionContent("PAYMENT", "Choose a verified payment method for order {orderNumber}.", { orderNumber: result.orderNumber })).text : "Payment methods are not configured; no payment request was sent."}`; } catch (error) { if (error instanceof OrderCooldownError) { nextState = "PAYMENT_PENDING"; data.orderNumber = error.orderNumber; reply = `You already have order ${error.orderNumber}. You can request another order on ${new Date(error.nextEligibleAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}.`; } else throw error; } } }
  else if (state === "PAYMENT_METHOD") { const selectedMethod = paymentMethodFromAction(normalized); if (!selectedMethod || !data.orderId) reply = (await sessionContent("PAYMENT", "Choose a verified payment method for order {orderNumber}.", { orderNumber: data.orderNumber ?? "" })).text; else { try { const selected = await selectPaymentMethod(db, data.orderId, selectedMethod, data.language ?? "en", event.from); nextState = "PAYMENT_PENDING"; reply = selected.message; paymentSelection = { orderId: data.orderId, orderNumber: selected.orderNumber, method: selectedMethod, locale: data.language ?? "en", message: selected.message, config: selected.config }; } catch { reply = (await sessionContent("PAYMENT", "That payment method is not currently available.", { orderNumber: data.orderNumber ?? "" })).text; } } }
  else if (state === "PAYMENT_PENDING" && paymentMethodFromAction(normalized) && data.orderId) { const selectedMethod = paymentMethodFromAction(normalized)!; try { const selected = await selectPaymentMethod(db, data.orderId, selectedMethod, data.language ?? "en", event.from); nextState = "PAYMENT_PENDING"; reply = selected.message; paymentSelection = { orderId: data.orderId, orderNumber: selected.orderNumber, method: selectedMethod, locale: data.language ?? "en", message: selected.message, config: selected.config }; } catch { reply = (await sessionContent("PAYMENT", "That payment method is not currently available.", { orderNumber: data.orderNumber ?? "" })).text; } }
  else if (state === "PAYMENT_PENDING" && /^(HELP|PAYMENT_HELP)$/i.test(normalized)) { reply = (await paymentCopyForOrder(db, data.orderId, "payment_help_copy")) ?? (await sessionContent("PAYMENT", "Upload your payment receipt here after payment. Garden Shop will review it manually.", { orderNumber: data.orderNumber ?? "" })).text; }
  else if (state === "PAYMENT_PENDING" && normalized === "START") { reply = `You already have order ${data.orderNumber ?? "in progress"}. Upload the receipt, check status, or contact support.`; }
  else if (state === "COMPLETE" && normalized === "START") { nextState = "FULL_NAME"; data = {}; reply = (await sessionContent("FIELD_FULL_NAME", "Please reply with your full name.")).text; }
  if (!reply) return false;
  const [welcomeEn, welcomeUr, fertilizer, province, review, status, support, payment] = await Promise.all([
    contentFor(db, "WELCOME", "Welcome to Get Free Seeds! Tap below to begin your order.", {}, `CHAT:${event.from}`, "en"),
    contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"),
    sessionContent("FERTILIZER", "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?"),
    sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery."),
    sessionContent("REVIEW", "Review your order. Tap Place Order to confirm."),
    sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status."),
    sessionContent("SUPPORT", "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry."),
    sessionContent("PAYMENT", "Choose a verified payment method.")
  ]);
  const sessionFlowToken = checkoutMode !== "guided" && state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR") && flowTokenSecret ? await createFlowToken(event.from, event.id, flowTokenSecret) : undefined;
  const enabledProvinces = (await db.prepare("SELECT province,delivery_fee_pkr FROM province_delivery_rates WHERE enabled=1 ORDER BY province").all<{ province: string; delivery_fee_pkr: number }>()).results ?? [];
  if (nextState === "PAYMENT_METHOD") completePaymentMethods = await completeEnabledPaymentMethods(db);
  const paymentOptions = completePaymentMethods.map((method) => ({ id: paymentActionId(method.method), title: paymentActionTitle(payment, method) }));
  const options: ConversationReplyOptions = (state === "LANGUAGE" || (state === "NEW" && Boolean(text)) || normalized === "CANCEL") && !(state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) ? { buttons: [{ id: "LANG_UR", title: whatsAppActionLabel(welcomeUr, "LANG_UR") }, { id: "LANG_EN", title: whatsAppActionLabel(welcomeEn, "LANG_EN") }] } : sessionFlowToken ? { flow: { id: flowId, token: sessionFlowToken } } : (state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) || state === "NEW" && normalized === "GET_FREE_PACKS" ? { buttons: [{ id: "ADD_FERTILIZER", title: whatsAppActionLabel(fertilizer, "ADD_FERTILIZER") }, { id: "SEEDS_ONLY", title: whatsAppActionLabel(fertilizer, "SEEDS_ONLY") }] } : state === "FERTILIZER" && /^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/i.test(normalized) ? { list: { buttonText: province.listButtonLabel!, rows: enabledProvinces.slice(0, 10).map((row) => ({ id: `PROVINCE_${row.province.toUpperCase().replace(/ /g, "_")}`, title: row.province, description: `PKR ${row.delivery_fee_pkr}` })) } } : state === "CONTACT" ? { buttons: [{ id: "PLACE_ORDER", title: whatsAppActionLabel(review, "PLACE_ORDER") }, { id: "BACK", title: whatsAppActionLabel(review, "BACK") }] } : nextState === "PAYMENT_METHOD" && paymentOptions.length ? { buttons: [...paymentOptions, ...(paymentOptions.length < 3 ? [{ id: "CHECK_ORDER", title: whatsAppActionLabel(status, "CHECK_ORDER") }] : [])] } : state === "PAYMENT_PENDING" ? { buttons: [{ id: "CHECK_ORDER", title: whatsAppActionLabel(status, "CHECK_ORDER") }, { id: "PAYMENT_HELP", title: whatsAppActionLabel(payment, "PAYMENT_HELP") }, { id: "SUPPORT", title: whatsAppActionLabel(support, "SUPPORT") }] } : {};
  const mediaKey = guidedReplyMediaKey(normalized, state, nextState);
  if (mediaKey) options.image = await contentImageFor(db, bucket, mediaKey, `CHAT:${event.from}`);
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO whatsapp_conversations (id,wa_id,state,state_data,last_inbound_message_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(wa_id) DO UPDATE SET state=excluded.state,state_data=excluded.state_data,last_inbound_message_id=excluded.last_inbound_message_id,updated_at=excluded.updated_at").bind(crypto.randomUUID(), event.from, nextState, JSON.stringify(data), event.id, now, now).run();
  if (paymentSelection) {
    const delivery = await deliverPaymentInstructions(db, bucket, provider, event.from, paymentSelection.orderId, paymentSelection.orderNumber, paymentSelection.method, paymentSelection.locale, paymentSelection.message, paymentSelection.config);
    try { if (events) await events.send({ kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey: `payment_instructions_${paymentSelection.orderId}_${paymentSelection.method}`, entityId: paymentSelection.orderId, schemaVersion: 1 }); } catch { /* the durable outbox remains authoritative */ }
    if (delivery.textSent && delivery.qrStatus !== "FAILED") {
      return true;
    }
    if (delivery.textSent) return true;
    await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,updated_at=? WHERE wa_id=? AND last_inbound_message_id=?").bind(state, originalStateData, new Date().toISOString(), event.from, event.id).run();
    return true;
  }
  const sent = await sendConversationReply(db, provider, event.from, event.id, reply, options);
  if (!sent.sent) await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,updated_at=? WHERE wa_id=? AND last_inbound_message_id=?").bind(state, originalStateData, new Date().toISOString(), event.from, event.id).run();
  return true;
}

async function processReceiptMedia(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }): Promise<boolean> {
  const message = event.payload && typeof event.payload === "object" ? event.payload as { image?: { id?: string }; document?: { id?: string } } : {};
  const mediaId = message.image?.id ?? message.document?.id;
  if (!mediaId) return false;
  const conversation = await db.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string }>();
  if (conversation?.state !== "PAYMENT_PENDING") return false;
  let data: ConversationData = {};
  try { data = JSON.parse(conversation.state_data) as ConversationData; } catch { return false; }
  if (!data.orderId) return false;
  const record = await db.prepare("SELECT o.id,o.order_number,p.id AS payment_id,p.review_state FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=?").bind(data.orderId).first<{ id: string; order_number: string; payment_id: string; review_state: string }>();
  if (!record) return false;
  const existing = await db.prepare("SELECT id FROM payment_receipts WHERE provider_media_id=? AND order_id=?").bind(mediaId, record.id).first<{ id: string }>();
  if (!existing) {
    const media = await provider.downloadMedia(mediaId);
    const stored = await storeReceipt(bucket, record.order_number, media);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.payment_id, record.id, media.mediaId, stored.objectKey, stored.sha256, media.mimeType, media.size, now, now),
      db.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=?,updated_at=? WHERE id=? AND review_state IN ('PENDING','REJECTED')").bind(now, now, record.payment_id),
      db.prepare("UPDATE orders SET state='PAYMENT_REVIEW',updated_at=? WHERE id=? AND state='PAYMENT_PENDING'").bind(now, record.id),
      db.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_REVIEW',last_inbound_message_id=?,updated_at=? WHERE wa_id=?").bind(event.id, now, event.from)
    ]);
  }
  const receipt = await contentFor(db, "RECEIPT", "Receipt received for order {orderNumber}. Garden Shop will review it before payment is marked PAID.", { orderNumber: record.order_number }, `CHAT:${event.from}`);
  const image = await contentImageFor(db, bucket, "RECEIPT", `CHAT:${event.from}`);
  await sendConversationReply(db, provider, event.from, event.id, receipt.text, { image });
  return true;
}

app.get("/health", (c) => c.json({ ok: true, service: "getfreeseeds-api", state: c.env.DEPLOYMENT_STATE, whatsapp: c.env.META_PROVIDER_ENABLED === "true" && c.env.WHATSAPP_PROVIDER === "meta" ? "enabled" : "disabled-until-meta-onboarding" }));
app.get("/privacy", (c) => c.html("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Get Free Seeds Privacy Policy</title></head><body><main><h1>Get Free Seeds Privacy Policy</h1><p>Get Free Seeds is operated by Garden Shop. We collect the information a customer submits to request seed delivery, including name, delivery address, nearby landmark, city, contact number, WhatsApp identifiers supplied by Meta, order choices, and payment receipt evidence when provided.</p><p>We use this information only to process, verify, fulfil, support, and audit the customer request; prevent duplicate or fraudulent requests; and measure service performance. Payment evidence is stored privately and is reviewed only by authorised staff.</p><p>We do not sell customer information. We share data only with service providers required to operate the service, comply with law, or protect the service and its users.</p><p>Customers may request access, correction, or deletion through the Get Free Seeds Page or the same official WhatsApp conversation used for the request.</p><p>Last updated: 11 October 2026.</p></main></body></html>"));

app.get("/data-deletion", (c) => c.html("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Get Free Seeds Data Deletion</title></head><body><main><h1>Data Deletion Instructions</h1><p>To request deletion of information held by Get Free Seeds, contact the Get Free Seeds Facebook Page or send the request through the same official WhatsApp conversation used for the seed request. Include only the information needed to identify the request. Garden Shop will verify the requester and delete or anonymise eligible records, subject to legal, fraud-prevention, and accounting retention requirements.</p></main></body></html>"));

app.get("/webhooks/whatsapp", (c) => {
  const provider = createWhatsAppProvider(c.env.WHATSAPP_PROVIDER, { enabled: c.env.META_PROVIDER_ENABLED === "true", graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", accessToken: c.env.META_ACCESS_TOKEN, phoneNumberId: c.env.META_PHONE_NUMBER_ID, verifyToken: c.env.WEBHOOK_VERIFY_TOKEN, appSecret: c.env.META_APP_SECRET });
  const challenge = provider.verifyWebhook(c.req.query("hub.challenge") ?? "", c.req.query("hub.verify_token") ?? "", c.env.WEBHOOK_VERIFY_TOKEN);
  return challenge === null ? c.text("Forbidden", 403) : c.text(challenge);
});

app.post("/webhooks/whatsapp", async (c) => {
  if (c.env.META_PROVIDER_ENABLED !== "true") return c.json({ error: "WHATSAPP_ONBOARDING_PENDING", state: c.env.DEPLOYMENT_STATE }, 503);
  const raw = await c.req.arrayBuffer();
  const signature = c.req.header("x-hub-signature-256") ?? null;
  const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", accessToken: c.env.META_ACCESS_TOKEN, phoneNumberId: c.env.META_PHONE_NUMBER_ID, verifyToken: c.env.WEBHOOK_VERIFY_TOKEN, appSecret: c.env.META_APP_SECRET });
  if (!(await provider.validateSignature(raw, signature, c.env.META_APP_SECRET))) return c.text("Forbidden", 403);
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return c.json({ error: "INVALID_WEBHOOK_JSON" }, 400);
  }
  const correlationId = c.req.header("x-correlation-id") ?? crypto.randomUUID();
  const eventCount = c.env.DB ? await persistWebhookRecords(c.env.DB, payload, raw, correlationId) : 0;
  const inbound = provider.parseInboundEvent(payload);
  let autoReplies = 0;
  for (const event of inbound) {
    if (event.kind === "media") { if (c.env.DB && await processReceiptMedia(c.env.DB, c.env.RECEIPTS, provider, event)) continue; else continue; }
    if (c.env.DB && await processGuidedConversation(c.env.DB, c.env.RECEIPTS, provider, event, c.env.META_FLOW_ID ?? "1133458765899784", c.env.META_APP_SECRET, c.env.WHATSAPP_CHECKOUT_MODE ?? "guided", c.env.EVENTS)) continue;
    const activeConversation = c.env.DB ? await c.env.DB.prepare("SELECT state FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string }>() : null;
    if (activeConversation) continue;
    const idempotencyKey = `welcome_reply:${event.id}`;
    const existing = c.env.DB ? await c.env.DB.prepare("SELECT status FROM outbound_messages WHERE idempotency_key=?").bind(idempotencyKey).first<{ status: string }>() : null;
    if (existing) continue;
    const now = new Date().toISOString();
    if (c.env.DB) await c.env.DB.prepare("INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), idempotencyKey, "WELCOME_REPLY", "PENDING", 0, now, now).run();
    try {
      const welcome = await contentFor(c.env.DB, "WELCOME", "Welcome to Get Free Seeds! Tap below to begin your order.", {}, `CHAT:${event.from}`);
      const image = await contentImageFor(c.env.DB, c.env.RECEIPTS, "WELCOME", `CHAT:${event.from}`);
      const sent = await provider.sendInteractive(event.from, welcome.text, [{ id: "GET_FREE_PACKS", title: welcome.buttonLabel ?? "Get 5 Free Packs" }], image);
      if (c.env.DB) await c.env.DB.prepare("UPDATE outbound_messages SET provider_message_id=?,status='SENT',attempt_count=1,updated_at=? WHERE idempotency_key=?").bind(sent.providerMessageId, new Date().toISOString(), idempotencyKey).run();
      autoReplies += 1;
    } catch (error) {
      const safeError = error instanceof Error ? error.message.slice(0, 160) : "META_AUTO_REPLY_FAILED";
      if (c.env.DB) await c.env.DB.prepare("UPDATE outbound_messages SET status='FAILED',attempt_count=1,last_error=?,updated_at=? WHERE idempotency_key=?").bind(safeError, new Date().toISOString(), idempotencyKey).run();
    }
  }
  return c.json({ accepted: true, eventCount, autoReplies });
});

app.get("/webhooks/whatsapp/flows", (c) => c.json({ data: { status: "active" } }));
app.post("/webhooks/whatsapp/flows", async (c) => {
  let envelope: MetaFlowEnvelope;
  try {
    envelope = await c.req.json<MetaFlowEnvelope>();
  } catch {
    return c.json({ error: "INVALID_FLOW_JSON" }, 400);
  }
  if (envelope && envelope.health_check === "ping") return c.json({ data: { status: "active" } });
  if (!c.env.FLOW_PRIVATE_KEY) return c.json({ error: "FLOW_PRIVATE_KEY_NOT_CONFIGURED" }, 503);
  let decrypted: Awaited<ReturnType<typeof decryptMetaFlowRequest>>;
  try {
    decrypted = await decryptMetaFlowRequest(envelope, c.env.FLOW_PRIVATE_KEY);
  } catch {
    return c.json({ error: "FLOW_DECRYPTION_FAILED" }, 400);
  }
  const flowToken = typeof decrypted.payload.flow_token === "string" ? decrypted.payload.flow_token : "";
  const trustedWaId = c.env.META_APP_SECRET && flowToken ? await verifyFlowToken(flowToken, c.env.META_APP_SECRET) : null;
  if (c.env.META_PROVIDER_ENABLED === "true" && !trustedWaId) {
    const encrypted = await encryptMetaFlowResponse({ version: "3.0", data: { error: "FLOW_TOKEN_INVALID" } }, decrypted.aesKey, decrypted.initialVector);
    return c.text(encrypted, 200, { "content-type": "text/plain; charset=UTF-8" });
  }
  if (trustedWaId) decrypted.payload.__trustedWaId = trustedWaId;
  try {
    const response = await handleMetaFlowPayload(decrypted.payload, c.env.DB);
    const encrypted = await encryptMetaFlowResponse(response, decrypted.aesKey, decrypted.initialVector);
    return c.text(encrypted, 200, { "content-type": "text/plain; charset=UTF-8" });
  } catch {
    try {
      const encrypted = await encryptMetaFlowResponse({ version: "3.0", error: "FLOW_RESPONSE_FAILED" }, decrypted.aesKey, decrypted.initialVector);
      return c.text(encrypted, 200, { "content-type": "text/plain; charset=UTF-8" });
    } catch {
      return c.json({ error: "FLOW_RESPONSE_FAILED" }, 500);
    }
  }
});

app.get("/webhooks/meta/instant-form", (c) => {
  if (c.env.META_INSTANT_FORM_ENABLED !== "true") return c.text("Forbidden", 403);
  const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", appSecret: c.env.META_APP_SECRET, verifyToken: c.env.WEBHOOK_VERIFY_TOKEN });
  const challenge = provider.verifyWebhook(c.req.query("hub.challenge") ?? "", c.req.query("hub.verify_token") ?? "", c.env.WEBHOOK_VERIFY_TOKEN);
  return challenge === null ? c.text("Forbidden", 403) : c.text(challenge);
});

app.post("/webhooks/meta/instant-form", async (c) => {
  if (c.env.META_INSTANT_FORM_ENABLED !== "true") return c.json({ error: "META_INSTANT_FORM_DISABLED" }, 503);
  const raw = await c.req.arrayBuffer();
  const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", appSecret: c.env.META_APP_SECRET });
  if (!(await provider.validateSignature(raw, c.req.header("x-hub-signature-256") ?? null, c.env.META_APP_SECRET))) return c.text("Forbidden", 403);
  let payload: { entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }> };
  try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return c.json({ error: "INVALID_META_LEAD_WEBHOOK" }, 400); }
  const now = new Date().toISOString();
  const leads = (payload.entry ?? []).flatMap((entry) => (entry.changes ?? []).filter((change) => change.field === "leadgen" && typeof change.value?.leadgen_id === "string").map((change) => change.value as Record<string, unknown>));
  const allowedLeads = leads.filter((lead) => isAllowedInstantFormLead(lead, c.env.META_PAGE_ID ?? "", c.env.META_INSTANT_FORM_ID ?? ""));
  if (!c.env.DB || !allowedLeads.length) return c.json({ accepted: true, eventCount: 0, ignoredCount: leads.length });
  await c.env.DB.batch(allowedLeads.map((lead) => {
    const leadId = lead.leadgen_id as string;
    const idempotencyKey = `meta_lead_${leadId}`;
    return c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), idempotencyKey, "META_INSTANT_FORM_LEAD", leadId, JSON.stringify({ leadId, formId: lead.form_id, createdTime: lead.created_time, campaignId: lead.campaign_id, adSetId: lead.adgroup_id, adId: lead.ad_id }), "PENDING", now, now, now);
  }));
  for (const lead of allowedLeads) await c.env.EVENTS.send({ kind: "META_INSTANT_FORM_LEAD", idempotencyKey: `meta_lead_${lead.leadgen_id as string}`, entityId: lead.leadgen_id as string, schemaVersion: 1 });
  return c.json({ accepted: true, eventCount: allowedLeads.length, ignoredCount: leads.length - allowedLeads.length });
});

app.post("/flows/get-free-seeds", async (c) => {
  const body = await c.req.json<{ data?: unknown; action?: string; screen?: string; flow_token?: unknown }>();
  try {
    const submission = parseFlowSubmission(body.data ?? body);
    const metadata = body as { referral?: unknown; data?: unknown; flow_token?: unknown };
    const referral = metadata.referral && typeof metadata.referral === "object" ? metadata.referral as Record<string, unknown> : undefined;
    const attribution = referral ? {
      ctwaClid: typeof referral.ctwa_clid === "string" ? referral.ctwa_clid : undefined,
      campaignId: typeof referral.campaign_id === "string" ? referral.campaign_id : undefined,
      adSetId: typeof referral.adset_id === "string" ? referral.adset_id : undefined,
      adId: typeof referral.ad_id === "string" ? referral.ad_id : undefined
    } : undefined;
    if (!c.env.DB) return c.json({ screen: "SUBMIT", data: { accepted: true, mode: "mock" } });
    const flowToken = typeof metadata.flow_token === "string" ? metadata.flow_token.trim() : "";
    const result = await persistFlowSubmission(c.env.DB, submission, attribution, flowToken && flowToken.length <= 200 ? `META_FLOW:${flowToken}` : undefined);
    const orderSummary = result.quote ? {
      currency: result.quote.currency,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      productCode: result.quote.productCode,
      province: result.quote.province,
      fertilizerSelected: result.quote.fertilizerSelected,
      items: result.quote.items,
      subtotalPkr: result.quote.subtotalPkr,
      deliveryPkr: result.quote.deliveryFeePkr,
      totalPayablePkr: result.quote.totalPayablePkr,
      paymentMethods: result.quote.paymentMethods
    } : await getPersistedOrderSummary(c.env.DB, result.orderId);
    let queued = false;
    try {
      if (c.env.EVENTS) {
        await c.env.EVENTS.send({ kind: "CAPI_LEAD", idempotencyKey: `lead_${result.orderNumber}`, entityId: result.orderId, schemaVersion: 1 });
        queued = true;
      }
    } catch {
      // The durable outbox remains authoritative when Queue delivery is temporarily unavailable.
    }
    return c.json({ screen: "PAYMENT_METHOD", data: { accepted: true, orderId: result.orderId, orderNumber: result.orderNumber, orderSummary, paymentMethods: orderSummary.paymentMethods, paymentMethodOptions: orderSummary.paymentMethods.map((name) => ({ id: name, title: name })), capiQueue: queued ? "QUEUED" : "DEFERRED" } });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "INVALID_FLOW_SUBMISSION" }, 400);
  }
});

app.post("/api/orders/quote", async (c) => {
  if (!c.env.DB) return c.json({ error: "QUOTE_UNAVAILABLE" }, 503);
  try {
    const quote = await quoteOrder(c.env.DB, await c.req.json());
    const orderSummary = { currency: quote.currency, productCode: quote.productCode, province: quote.province, fertilizerSelected: quote.fertilizerSelected, items: quote.items, subtotalPkr: quote.subtotalPkr, deliveryPkr: quote.deliveryFeePkr, totalPayablePkr: quote.totalPayablePkr };
    return c.json({ ...quote, orderSummary, paymentMethodOptions: quote.paymentMethods.map((name) => ({ id: name, title: name })) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "QUOTE_FAILED";
    return c.json({ error: code }, code === "PRODUCT_NOT_FOUND" || code === "PROVINCE_DELIVERY_RATE_NOT_FOUND" ? 404 : 400);
  }
});

const fertilizerDecisionHandler = async (c: Context<Env>) => {
  if (!c.env.DB) return c.json({ error: "ORDER_INTERACTION_UNAVAILABLE" }, 503);
  try {
    const body = await c.req.json<unknown>();
    const result = await applyFertilizerDecision(c.env.DB, c.req.param("orderId") ?? "", body);
    return c.json({ ok: true, orderId: result.orderId, orderNumber: result.orderNumber, fertilizerSelected: result.fertilizerSelected, idempotent: result.idempotent, orderSummary: result.orderSummary, paymentMethods: result.paymentMethods, paymentMethodOptions: result.paymentMethods.map((name) => ({ id: name, title: name })) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FERTILIZER_DECISION_FAILED";
    return c.json({ error: code }, code === "ORDER_NOT_FOUND" ? 404 : 400);
  }
};
app.post("/api/orders/:orderId/fertilizer", fertilizerDecisionHandler);
app.post("/orders/:orderId/fertilizer", fertilizerDecisionHandler);

const paymentSelectionHandler = async (c: Context<Env>) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  try {
    const body = await c.req.json<{ method: string }>();
    const orderId = c.req.param("orderId") ?? "";
    const result = await selectPaymentMethod(c.env.DB, orderId, PaymentMethod.parse(body.method.toUpperCase()));
    const orderSummary = await getPersistedOrderSummary(c.env.DB, orderId);
    return c.json({ ok: true, orderNumber: result.orderNumber, amount: result.amount, method: result.config.method, message: result.message, qrAvailable: Boolean(result.config.qrR2Key), orderSummary, paymentMethods: orderSummary.paymentMethods, paymentMethodOptions: orderSummary.paymentMethods.map((name) => ({ id: name, title: name })) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "PAYMENT_METHOD_SELECTION_FAILED" }, 400);
  }
};
app.post("/payments/:orderId/select", paymentSelectionHandler);
app.post("/api/payments/:orderId/select", paymentSelectionHandler);

app.post("/payments/:orderId/i-have-paid", async (c) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const payment = await c.env.DB.prepare("SELECT id, review_state FROM payments WHERE order_id=? AND method IS NOT NULL").bind(c.req.param("orderId")).first<{ id: string; review_state: string }>();
  if (!payment) return c.json({ error: "PAYMENT_METHOD_NOT_SELECTED" }, 409);
  if (payment.review_state !== "PENDING") return c.json({ error: "PAYMENT_NOT_AWAITING_RECEIPT" }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `receipt_request_${c.req.param("orderId")}`, "WHATSAPP_RECEIPT_REQUEST", c.req.param("orderId"), JSON.stringify({ orderId: c.req.param("orderId"), paymentId: payment.id }), "PENDING", now, now, now),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_RECEIPT_REQUESTED", "CUSTOMER", "PAYMENT", payment.id, crypto.randomUUID(), JSON.stringify({ orderId: c.req.param("orderId") }), now)
  ]);
  return c.json({ ok: true, message: "Please share your payment receipt or screenshot here. Payment will be reviewed manually." });
});

app.post("/receipts/ingest", async (c) => {
  const body = await c.req.json<{ orderId: string; paymentId: string; mediaId: string }>();
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "RECEIPT_STORAGE_UNAVAILABLE" }, 503);
  const record = await c.env.DB.prepare("SELECT o.order_number, o.state, p.id AS payment_id FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND p.id=?").bind(body.orderId, body.paymentId).first<{ order_number: string; state: string; payment_id: string }>();
  if (!record) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (!["PAYMENT_PENDING", "RECEIPT_SUBMITTED", "PAYMENT_REVIEW"].includes(record.state)) return c.json({ error: "ORDER_NOT_ACCEPTING_RECEIPT" }, 409);
  const existingReceipt = await c.env.DB.prepare("SELECT r2_object_key, sha256 FROM payment_receipts WHERE provider_media_id=? AND payment_id=? AND order_id=?").bind(body.mediaId, body.paymentId, body.orderId).first<{ r2_object_key: string; sha256: string }>();
  if (existingReceipt) return c.json({ ok: true, alreadyAssociated: true, reviewState: "REVIEW", receiptKey: existingReceipt.r2_object_key, sha256: existingReceipt.sha256 });
  try {
    const media = await createWhatsAppProvider(c.env.WHATSAPP_PROVIDER, { enabled: c.env.META_PROVIDER_ENABLED === "true", graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", accessToken: c.env.META_ACCESS_TOKEN, phoneNumberId: c.env.META_PHONE_NUMBER_ID, verifyToken: c.env.WEBHOOK_VERIFY_TOKEN, appSecret: c.env.META_APP_SECRET }).downloadMedia(body.mediaId);
    const stored = await storeReceipt(c.env.RECEIPTS, record.order_number, media);
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), body.paymentId, body.orderId, media.mediaId, stored.objectKey, stored.sha256, media.mimeType, media.size, now, now),
      c.env.DB.prepare("UPDATE payments SET review_state='REVIEW', submitted_at=?, updated_at=? WHERE id=? AND review_state IN ('PENDING','REJECTED')").bind(now, now, body.paymentId),
      c.env.DB.prepare("UPDATE orders SET state='PAYMENT_REVIEW', updated_at=? WHERE id=? AND state IN ('PAYMENT_PENDING','RECEIPT_SUBMITTED')").bind(now, body.orderId),
      c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "RECEIPT_ASSOCIATED", "CUSTOMER", "PAYMENT", body.paymentId, crypto.randomUUID(), JSON.stringify({ orderId: body.orderId, objectKey: stored.objectKey, sha256: stored.sha256 }), now)
    ]);
    return c.json({ ok: true, reviewState: "REVIEW", receiptKey: stored.objectKey });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "RECEIPT_INGEST_FAILED" }, 400);
  }
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ kind: string; idempotencyKey: string; entityId: string; schemaVersion: 1 }>, env: Env["Bindings"]): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (!env.DB) { message.ack(); continue; }
        const job = await env.DB.prepare("SELECT status, attempts FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ status: string; attempts: number }>();
        if (!job || isTerminalOutboxStatus(job.status)) { message.ack(); continue; }
        const nextAttempt = Number(job.attempts ?? 0) + 1;
        if (message.body.kind.startsWith("WHATSAPP_") && (env.DEPLOYMENT_STATE === "WHATSAPP_NUMBER_PENDING" || env.DEPLOYMENT_STATE === "WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING" || env.DEPLOYMENT_STATE === "WHATSAPP_PHONE_VERIFICATION_PENDING" || env.DEPLOYMENT_STATE === "WHATSAPP_OTP_REQUIRED" || env.DEPLOYMENT_STATE === "WHATSAPP_NUMBER_SLOT_BLOCKED" || env.DEPLOYMENT_STATE === "META_ASSETS_PENDING")) {
          await env.DB.prepare("UPDATE outbox_jobs SET status='DEFERRED', last_error=?, updated_at=? WHERE idempotency_key=?").bind("WHATSAPP_ONBOARDING_PENDING", new Date().toISOString(), message.body.idempotencyKey).run();
          message.ack();
          continue;
        }
        if (message.body.kind === "META_INSTANT_FORM_LEAD") {
          try {
            if (!env.META_LEAD_ACCESS_TOKEN) throw new Error("META_LEAD_ACCESS_TOKEN_MISSING");
            const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION ?? "v26.0"}/${encodeURIComponent(message.body.entityId)}?fields=id,form_id,created_time,campaign_id,adset_id,ad_id,field_data&access_token=${encodeURIComponent(env.META_LEAD_ACCESS_TOKEN)}`);
            if (!response.ok) throw new Error(`META_LEAD_FETCH_${response.status}`);
            const lead = parseMetaInstantFormLead(await response.json());
            if (lead.pageId !== env.META_PAGE_ID || lead.formId !== env.META_INSTANT_FORM_ID) throw new Error("META_LEAD_ALLOWLIST_REJECTED");
            const persisted = await persistInstantFormSubmission(env.DB, lead);
            await env.DB.prepare("UPDATE outbox_jobs SET status='SENT', attempts=?, last_error=NULL, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey).run();
            if (!persisted.duplicate) await env.EVENTS.send({ kind: "CAPI_LEAD", idempotencyKey: `lead_${persisted.orderNumber}`, entityId: persisted.orderId, schemaVersion: 1 });
            message.ack();
            continue;
          } catch (error) {
            const failure = error instanceof Error ? error.message.slice(0, 120) : "META_LEAD_INGEST_FAILED";
            if (nextAttempt >= 5) {
              await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
              message.ack();
              continue;
            }
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          }
        }
        if (message.body.kind === "WHATSAPP_PAYMENT_INSTRUCTIONS") {
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = outbox ? JSON.parse(outbox.payload_json) as { orderId: string; orderNumber: string; method: PaymentMethod; locale: "en" | "ur"; recipient?: string; message: string } : undefined;
            if (!payload?.recipient) throw new Error("PAYMENT_RECIPIENT_REQUIRED");
            const row = await env.DB.prepare("SELECT * FROM payment_methods WHERE method=?").bind(payload.method).first<Record<string, unknown>>();
            if (!row) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
            const provider = createWhatsAppProvider("meta", { enabled: env.META_PROVIDER_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, verifyToken: env.WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET });
            const delivery = await deliverPaymentInstructions(env.DB, env.RECEIPTS, provider, payload.recipient, payload.orderId, payload.orderNumber, payload.method, payload.locale ?? "en", payload.message, normalizePaymentMethodRow(row));
            if (!delivery.textSent || delivery.qrStatus === "FAILED") throw new Error(delivery.textSent ? "PAYMENT_QR_DELIVERY_BLOCKED" : "PAYMENT_TEXT_DELIVERY_FAILED");
            await env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey).run();
            message.ack();
            continue;
          } catch (error) {
            const failure = error instanceof Error ? error.message.slice(0, 120) : "PAYMENT_INSTRUCTIONS_FAILED";
            if (nextAttempt >= 5) {
              await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
              message.ack();
              continue;
            }
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          }
        }
        if (nextAttempt > 5) {
          await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, "MAX_RETRIES_EXCEEDED", new Date().toISOString(), message.body.idempotencyKey).run();
          message.ack();
          continue;
        }
        if (message.body.kind === "CAPI_LEAD" || message.body.kind === "CAPI_PURCHASE") {
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            if (!outbox) { message.ack(); continue; }
            const event = JSON.parse(outbox.payload_json) as Parameters<MetaCapiProvider["send"]>[0];
            const response = await new MetaCapiProvider({ enabled: env.META_CAPI_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", datasetId: env.META_DATASET_ID, accessToken: env.META_ACCESS_TOKEN }).send(event);
            await env.DB.batch([
              env.DB.prepare("UPDATE capi_events SET send_status='SENT', provider_response_id=?, sent_at=?, updated_at=? WHERE event_id=?").bind(response.responseId ?? null, new Date().toISOString(), new Date().toISOString(), event.eventId),
              env.DB.prepare("UPDATE outbox_jobs SET status='SENT', attempts=?, last_error=NULL, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey)
            ]);
            message.ack();
            continue;
          } catch (error) {
            const failure = error instanceof Error ? error.message.slice(0, 120) : "CAPI_SEND_FAILED";
            if (nextAttempt >= 5) {
              await env.DB.batch([
                env.DB.prepare("UPDATE capi_events SET send_status='FAILED', attempt_count=?, last_error=?, updated_at=? WHERE event_id=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey),
                env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey)
              ]);
              message.ack();
              continue;
            }
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          }
        }
        await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, "PROVIDER_NOT_CONFIGURED", new Date().toISOString(), message.body.idempotencyKey).run();
        message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
      } catch {
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      }
    }
  }
};
