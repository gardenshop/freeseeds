import { Hono } from "hono";
import type { Context } from "hono";
import { applyFertilizerDecision, codQuote, codReferenceHmac, createWhatsAppProvider, customerTransactionReferenceHash, decryptMetaFlowRequest, encryptMetaFlowResponse, formatCustomerOrderStatus, formatPaymentMessage, getLatestOrderForWaId, getPersistedOrderSummary, InteractiveButton, isAllowedInstantFormLead, isInsideWhatsAppServiceWindow, isPaymentMethodComplete, isPaymentMethodLocaleComplete, isTerminalOutboxStatus, logWhatsAppContentMediaError, MetaCapiProvider, MetaFlowEnvelope, normalizeCodEvidenceReference, normalizeCustomerTransactionReference, normalizeMobileContactNumber, normalizePaymentMethodRow, normalizeWhatsAppWaId, OrderCooldownError, OutboundImage, parseFlowSubmission, parseMetaInstantFormLead, PaymentMethod, persistFlowSubmission, persistInboundConversationActivity, persistInstantFormSubmission, persistWebhookRecords, provinceDeliveryListRows, publishedWhatsAppContent, quoteOrder, renderWhatsAppContent, retryDelaySeconds, selectPaymentMethod, selectPublishedWhatsAppContentMedia, storeReceipt, verifyPaymentQrAsset, whatsAppActionLabel, WhatsAppTemplateKey } from "@gfs/core";
import { handleMetaFlowPayload } from "./flow-endpoint";
import { admitWhatsAppSenders } from "./rate-limit";
import { createPaymentV2Schedule, enqueueDuePaymentV2Stages, resolvePaymentReminderCodFallback, setPaymentReminderV2OptOut } from "./payment-reminders-v2";

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
    COD_V1_ENABLED?: string;
    COD_ROLLOUT_MODE?: string;
    COD_TESTER_WA_ID?: string;
    PAYMENT_AUTOMATION_V2_ENABLED?: string;
    PAYMENT_REMINDERS_V2_ENABLED?: string;
    PAYMENT_UTILITY_TEMPLATES_APPROVED?: string;
  };
};

const app = new Hono<Env>();

function isD1QuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b7500\b|row[- ]read|daily.*limit|quota.*exhaust|too many rows/i.test(message);
}

app.onError((error, c) => {
  if (isD1QuotaError(error)) return c.json({ error: "D1_QUOTA_EXHAUSTED", message: "D1 is temporarily unavailable. No order confirmation or payment state change was reported; retry after the quota reset." }, 503);
  return c.json({ error: "API_REQUEST_FAILED" }, 500);
});

async function syncPaymentReminderDeliveryStatuses(db: D1Database): Promise<void> {
  await db.prepare(`UPDATE payment_reminder_v2_stages SET
    status=CASE WHEN m.status IN ('DELIVERED','READ') THEN m.status WHEN m.status='FAILED' THEN 'DEAD_LETTER' ELSE status END,
    last_error=CASE WHEN m.status='FAILED' THEN COALESCE(m.last_error,'META_DELIVERY_FAILED') ELSE last_error END,
    completed_at=CASE WHEN m.status IN ('DELIVERED','READ','FAILED') THEN COALESCE(completed_at,m.updated_at) ELSE completed_at END,
    updated_at=m.updated_at
    FROM outbound_messages m
    WHERE m.kind='WHATSAPP_PAYMENT_REMINDER' AND m.idempotency_key=payment_reminder_v2_stages.idempotency_key
      AND m.status IN ('DELIVERED','READ','FAILED')`).run();
}

function base64Url(data: Uint8Array): string { return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function decodeBase64Url(value: string): Uint8Array { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }
async function createFlowToken(waId: string, inboundId: string, secret: string): Promise<string> { const payload = base64Url(new TextEncoder().encode(JSON.stringify({ waId, inboundId, exp: Date.now() + 60 * 60 * 1000 }))); const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)); return `${payload}.${base64Url(new Uint8Array(signature))}`; }
async function verifyFlowToken(token: string, secret: string): Promise<string | null> { const [payload, signature] = token.split("."); if (!payload || !signature) return null; try { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); if (!(await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload)))) return null; const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { waId?: string; exp?: number }; return typeof data.waId === "string" && typeof data.exp === "number" && data.exp > Date.now() ? data.waId : null; } catch { return null; } }

type CodQuoteSnapshot = { baseAmountPkr: number; feePkr: number; totalPkr: number; policyRevision: string; collectionPolicyHash: string | null; remittancePolicyHash: string | null };
type ConversationData = { language?: "en" | "ur"; fullName?: string; deliveryAddress?: string; nearbyPlace?: string; city?: string; contactNumber?: string; province?: string; fertilizerSelected?: boolean; checkoutId?: string; orderId?: string; orderNumber?: string; amountPkr?: number; codQuote?: CodQuoteSnapshot };

function isControlledCodTester(waId: string, configuredTester: string | undefined): boolean {
  const normalizedInbound = normalizeWhatsAppWaId(waId);
  const normalizedConfigured = normalizeWhatsAppWaId(configuredTester ?? "");
  return Boolean(normalizedInbound && normalizedConfigured && normalizedInbound === normalizedConfigured);
}

function isCodAdmitted(waId: string, enabled: boolean, rolloutMode: string | undefined, configuredTester: string | undefined): boolean {
  if (!enabled) return false;
  const mode = rolloutMode?.trim().toUpperCase();
  if (mode === "PUBLIC") return true;
  if (mode === "TESTER_ONLY") return isControlledCodTester(waId, configuredTester);
  return false;
}

function codTestHoldForAdmission(rolloutMode: string | undefined): 0 | 1 | undefined {
  const mode = rolloutMode?.trim().toUpperCase();
  if (mode === "PUBLIC") return 0;
  if (mode === "TESTER_ONLY") return 1;
  return undefined;
}

type ConversationReplyOptions = { buttons?: InteractiveButton[]; list?: { buttonText: string; rows: Array<{ id: string; title: string; description?: string }> }; image?: OutboundImage; flow?: { id: string; token: string } };
type ConversationOutboundAssociation = { orderId?: string; customerId?: string; kind?: string };

const LOCALE_FALLBACKS: Partial<Record<WhatsAppTemplateKey, { en: string; ur: string }>> = {
  WELCOME: { en: "Welcome to Get Free Seeds! Tap below to begin your order.", ur: "گٹ فری سیڈز میں خوش آمدید! آرڈر شروع کرنے کے لیے نیچے دبائیں۔" },
  OFFER: { en: "Choose whether to continue your free seed order or cancel this unsubmitted request.", ur: "مفت بیجوں کا غیر جمع شدہ آرڈر جاری رکھنے یا منسوخ کرنے کا انتخاب کریں۔" },
  FERTILIZER: { en: "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?", ur: "کیا آپ مائیکرو نیوٹرینٹس کھاد شامل کرنا چاہتے ہیں یا صرف بیج جاری رکھنا چاہتے ہیں؟" },
  PROVINCE_DELIVERY: { en: "Choose your province for delivery.", ur: "ڈیلیوری کے لیے اپنا صوبہ منتخب کریں۔" },
  FIELD_FULL_NAME: { en: "Please reply with your full name.", ur: "براہ کرم اپنا پورا نام لکھیں۔" },
  FIELD_DELIVERY_ADDRESS: { en: "Please reply with your complete delivery address.", ur: "براہ کرم مکمل ڈیلیوری پتہ لکھیں۔" },
  FIELD_NEARBY_PLACE: { en: "Please reply with a nearby famous place.", ur: "براہ کرم قریبی مشہور جگہ لکھیں۔" },
  FIELD_CITY: { en: "Please reply with your city.", ur: "براہ کرم اپنا شہر لکھیں۔" },
  FIELD_CONTACT_NUMBER: { en: "Please reply with your contact number.", ur: "براہ کرم اپنا رابطہ نمبر لکھیں۔" },
  VALIDATION: { en: "Please choose one of the listed options.", ur: "براہ کرم دیے گئے اختیارات میں سے انتخاب کریں۔" },
  REVIEW: { en: "Review your order. Tap Place Order to confirm.", ur: "اپنے آرڈر کا جائزہ لیں۔ تصدیق کے لیے آرڈر کریں دبائیں۔" },
  CONFIRMATION: { en: "Order {orderNumber} created. Total: PKR {totalPkr}.", ur: "آرڈر {orderNumber} تیار ہو گیا۔ کل: PKR {totalPkr}۔" },
  ORDER_STATUS: { en: "Use Check Order to see the current order and payment status.", ur: "موجودہ آرڈر اور ادائیگی کی حالت دیکھنے کے لیے آرڈر چیک کریں۔" },
  SUPPORT: { en: "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry.", ur: "شروع کرنے کے لیے START، آرڈر دیکھنے کے لیے STATUS، یا روکنے کے لیے CANCEL لکھیں۔" },
  PAYMENT: { en: "For order {orderNumber}, the payable amount is PKR {amount}. Select an enabled payment method below.", ur: "آرڈر {orderNumber} کی قابلِ ادائیگی رقم PKR {amount} ہے۔ نیچے سے فعال ادائیگی کا طریقہ منتخب کریں۔" },
  RECEIPT: { en: "Receipt received for order {orderNumber}. Reply with the transaction/reference ID shown in your payment app. This is not payment confirmation; Garden Shop will verify actual account credit. Payment remains under Admin review.", ur: "آرڈر {orderNumber} کی رسید موصول ہوئی۔ اپنی ادائیگی کی ایپ میں دکھایا گیا ٹرانزیکشن/حوالہ نمبر جواب میں بھیجیں۔ یہ ادائیگی کی تصدیق نہیں؛ گارڈن شاپ اکاؤنٹ میں اصل رقم کی تصدیق کرے گا۔ ادائیگی ایڈمن کے جائزے میں رہے گی۔" }
};

async function contentFor(db: D1Database, key: WhatsAppTemplateKey, fallback: string, values: { orderNumber?: string; amount?: string | number; totalPkr?: string | number; province?: string; paymentMethod?: string; recipientName?: string; tillId?: string } = {}, sessionKey?: string, locale: "en" | "ur" = "en") {
  const content = await publishedWhatsAppContent(db, key, locale, sessionKey);
  const localizedFallback = LOCALE_FALLBACKS[key]?.[locale] ?? fallback;
  return {
    text: renderWhatsAppContent(content?.text ?? localizedFallback, values),
    buttonLabel: content?.buttonLabel,
    listButtonLabel: content?.listButtonLabel,
    listDescription: content?.listDescription,
    actionLabels: content?.actionLabels,
    mediaId: content?.mediaId,
    mediaR2Key: content?.mediaR2Key,
    mediaMimeType: content?.mediaMimeType
  };
}

async function completeEnabledPaymentMethods(db: D1Database, locale: "en" | "ur" = "en") {
  const methods = await db.prepare("SELECT pm.* FROM payment_methods pm JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE pm.enabled=1 AND pm.qr_owner_verified=1 ORDER BY pm.sort_order, pm.method").all();
  return (methods.results ?? []).map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)).filter((method) => method.qrOwnerVerified && isPaymentMethodComplete(method) && isPaymentMethodLocaleComplete(method, locale));
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

function guidedFieldIsValid(state: string, value: string): boolean {
  const length = value.trim().length;
  if (state === "FULL_NAME") return length >= 2 && length <= 120;
  if (state === "ADDRESS") return length >= 5 && length <= 500;
  if (state === "NEARBY" || state === "CITY") return length >= 2 && length <= 160;
  if (state === "CONTACT") return normalizeMobileContactNumber(value) !== undefined;
  return true;
}

function comparableDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "").replace(/^00/, "");
}

async function recoverPendingGuidedOrder(db: D1Database, waId: string, data: ConversationData): Promise<{ customerId: string; leadId: string; orderId: string; orderNumber: string; duplicate: true } | undefined> {
  const normalizedWaId = normalizeWhatsAppWaId(waId);
  if (!normalizedWaId || !data.fullName || !data.deliveryAddress || !data.nearbyPlace || !data.city || !data.contactNumber || !data.province) return undefined;
  const row = await db.prepare(`SELECT o.id AS order_id,o.order_number,o.total_payable,o.province,o.fertilizer_selected,
      c.id AS customer_id,c.full_name,c.delivery_address,c.nearby_place,c.city,c.contact_number,
      l.id AS lead_id
    FROM orders o JOIN customers c ON c.id=o.customer_id JOIN leads l ON l.order_id=o.id
    JOIN payments p ON p.order_id=o.id
    WHERE (c.wa_id IN (?,?) OR c.normalized_whatsapp_number=? OR c.whatsapp_number=? )
      AND o.state='DETAILS_COMPLETED' AND o.payment_status='PENDING'
      AND p.method IS NULL AND p.review_state='PENDING' AND p.approved_amount IS NULL
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id)
      AND o.created_at >= datetime('now','-30 minutes')
    ORDER BY o.created_at DESC,o.id DESC LIMIT 1`).bind(normalizedWaId, `+${normalizedWaId}`, `+${normalizedWaId}`, normalizedWaId).first<Record<string, unknown>>();
  if (!row || String(row.full_name).trim() !== data.fullName.trim() || String(row.delivery_address).trim() !== data.deliveryAddress.trim() || String(row.nearby_place).trim() !== data.nearbyPlace.trim() || String(row.city).trim() !== data.city.trim() || comparableDigits(String(row.contact_number)) !== comparableDigits(data.contactNumber) || String(row.province) !== data.province || Number(row.fertilizer_selected) !== (data.fertilizerSelected ? 1 : 0)) return undefined;
  const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province, fertilizerSelected: data.fertilizerSelected ?? false });
  if (Number(row.total_payable) !== quote.totalPayablePkr) return undefined;
  return { customerId: String(row.customer_id), leadId: String(row.lead_id), orderId: String(row.order_id), orderNumber: String(row.order_number), duplicate: true };
}

function webhookPhoneNumberIds(payload: unknown): string[] {
  const root = payload && typeof payload === "object" ? payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: unknown } } }> }> } : {};
  return (root.entry ?? []).flatMap((entry) => (entry.changes ?? []).map((change) => change.value?.metadata?.phone_number_id).map((id) => typeof id === "string" ? id.trim() : ""));
}

async function paymentCopyForOrder(db: D1Database, orderId: string | undefined, field: "payment_help_copy" | "status_copy", locale: "en" | "ur"): Promise<string | undefined> {
  if (!orderId) return undefined;
  const localizedField = locale === "ur" ? `${field}_ur` : field;
  const row = await db.prepare(`SELECT pm.${localizedField} AS copy FROM payments p JOIN payment_methods pm ON pm.method=p.method WHERE p.order_id=?`).bind(orderId).first<{ copy: string | null }>();
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
  const nextStateTemplate: Partial<Record<string, WhatsAppTemplateKey>> = { OFFER: "OFFER", FERTILIZER: "FERTILIZER", PROVINCE: "PROVINCE_DELIVERY", FULL_NAME: "FIELD_FULL_NAME", ADDRESS: "FIELD_DELIVERY_ADDRESS", NEARBY: "FIELD_NEARBY_PLACE", CITY: "FIELD_CITY", CONTACT: "FIELD_CONTACT_NUMBER", REVIEW: "REVIEW", COMPLETE: "CONFIRMATION" };
  return nextStateTemplate[nextState];
}

async function sendConversationReply(db: D1Database, provider: ReturnType<typeof createWhatsAppProvider>, to: string, inboundId: string, body: string, options: ConversationReplyOptions = {}, idempotencyKey = `conversation_reply:${inboundId}`, association: ConversationOutboundAssociation = {}): Promise<{ sent: boolean; messageId?: string }> {
  const key = idempotencyKey;
  const existing = await db.prepare("SELECT id,status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null }>();
  const now = new Date().toISOString();
  if (existing?.status === "SENT" || existing?.provider_message_id) return { sent: true, ...(existing.provider_message_id ? { messageId: existing.provider_message_id } : {}) };
  if (existing && isTerminalOutboxStatus(existing.status)) return { sent: false };
  const outboundId = existing?.id ?? crypto.randomUUID();
  if (!existing) await db.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,order_id,customer_id,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(outboundId, key, association.orderId ?? null, association.customerId ?? null, association.kind ?? "CONVERSATION_REPLY", "PENDING", 0, now, now).run();
  const inboundEvent = await db.prepare("SELECT created_at FROM whatsapp_events WHERE provider_event_id=?").bind(`message:${inboundId}`).first<{ created_at: string }>();
  if (!isInsideWhatsAppServiceWindow(inboundEvent?.created_at)) {
    await db.batch([
      db.prepare("UPDATE outbound_messages SET status='PERMANENT_FAILURE',last_error='WHATSAPP_SERVICE_WINDOW_CLOSED',updated_at=? WHERE id=? AND provider_message_id IS NULL AND status IN ('PENDING','FAILED','RETRY','SENDING')").bind(now, outboundId),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_SERVICE_WINDOW_BLOCKED", "SYSTEM", "OUTBOUND_MESSAGE", outboundId, crypto.randomUUID(), JSON.stringify({ reason: "WHATSAPP_SERVICE_WINDOW_CLOSED" }), now)
    ]);
    return { sent: false };
  }
  const claim = await db.prepare("UPDATE outbound_messages SET status='SENDING',attempt_count=attempt_count+1,updated_at=? WHERE idempotency_key=? AND provider_message_id IS NULL AND status IN ('PENDING','FAILED','RETRY')").bind(now, key).run();
  if (!claim.meta.changes) return { sent: false };
  try {
    const sent = options.flow ? await provider.sendFlow(to, options.flow.id, options.flow.token) : options.list ? await provider.sendList(to, body, options.list.buttonText, options.list.rows, options.image) : options.buttons?.length ? await provider.sendInteractive(to, body, options.buttons, options.image) : options.image ? await provider.sendImage(to, body, options.image) : await provider.sendText(to, body);
    await db.prepare("UPDATE outbound_messages SET provider_message_id=?,status='SENT',updated_at=? WHERE idempotency_key=?").bind(sent.providerMessageId, new Date().toISOString(), key).run();
    return { sent: true, messageId: sent.providerMessageId };
  } catch (error) {
    const safe = error instanceof Error ? error.message.slice(0, 160) : "META_CONVERSATION_REPLY_FAILED";
    await db.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE idempotency_key=?").bind(safe, new Date().toISOString(), key).run();
    return { sent: false };
  }
}

async function saveCustomerTransactionReference(db: D1Database, waId: string, orderId: string, submitted: unknown, inboundId: string): Promise<"SAVED" | "ALREADY_SAVED" | "INVALID_REFERENCE" | "REFERENCE_ALREADY_SAVED" | "REFERENCE_DUPLICATE" | "PAYMENT_NOT_IN_REVIEW"> {
  const current = await db.prepare("SELECT p.id,p.method,p.review_state,p.expected_amount,p.customer_transaction_reference,o.order_number,o.state,o.archived_at,o.total_payable,COUNT(r.id) AS receipt_count FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id LEFT JOIN payment_receipts r ON r.payment_id=p.id AND r.order_id=o.id WHERE p.order_id=? AND o.id=? AND c.wa_id=? GROUP BY p.id,o.id").bind(orderId,orderId,waId).first<{id:string;method:string|null;review_state:string;expected_amount:number;customer_transaction_reference:string|null;order_number:string;state:string;archived_at:string|null;total_payable:number;receipt_count:number}>();
  if (!current || current.archived_at || current.order_number === "FS-261019-000001" || current.state !== "PAYMENT_REVIEW" || current.review_state !== "REVIEW" || !current.method || Number(current.receipt_count) < 1 || Number(current.expected_amount) !== Number(current.total_payable)) return "PAYMENT_NOT_IN_REVIEW";
  const reference = normalizeCustomerTransactionReference(submitted, current.order_number);
  if (!reference) return "INVALID_REFERENCE";
  if (current.customer_transaction_reference) return current.customer_transaction_reference.trim().toUpperCase() === reference.toUpperCase() ? "ALREADY_SAVED" : "REFERENCE_ALREADY_SAVED";
  const now = new Date().toISOString();
  const fingerprint = await customerTransactionReferenceHash(reference);
  try {
    const results = await db.batch([
      db.prepare("UPDATE payments SET customer_transaction_reference=?,updated_at=? WHERE id=? AND order_id=? AND review_state='REVIEW' AND (customer_transaction_reference IS NULL OR trim(customer_transaction_reference)='') AND expected_amount=? AND EXISTS(SELECT 1 FROM orders o JOIN payment_receipts r ON r.order_id=o.id WHERE o.id=? AND o.state='PAYMENT_REVIEW' AND o.archived_at IS NULL AND o.total_payable=? AND r.payment_id=payments.id)").bind(reference,now,current.id,orderId,current.expected_amount,orderId,current.total_payable),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? AND p.order_id=? AND p.customer_transaction_reference=? AND p.review_state='REVIEW' AND o.state='PAYMENT_REVIEW')").bind(crypto.randomUUID(),"CUSTOMER_TRANSACTION_REFERENCE_SAVED","CUSTOMER","PAYMENT",current.id,inboundId,JSON.stringify({orderId,method:current.method,referenceHash:fingerprint,source:"SIGNED_WHATSAPP"}),now,current.id,orderId,reference)
    ]);
    if (Number(results[0].meta?.changes ?? 0) !== 1 || Number(results[1].meta?.changes ?? 0) !== 1) return "PAYMENT_NOT_IN_REVIEW";
    return "SAVED";
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) return "REFERENCE_DUPLICATE";
    throw error;
  }
}

type PaymentPartStatus = "SENT" | "SKIPPED" | "FAILED";
type PaymentDeliveryResult = { textSent: boolean; qrStatus: PaymentPartStatus };

async function sendPaymentPart(db: D1Database, to: string, orderId: string, key: string, kind: string, send: () => Promise<{ providerMessageId: string }>): Promise<PaymentPartStatus> {
  const existing = await db.prepare("SELECT id,status,provider_message_id,updated_at FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null; updated_at?: string }>();
  if (existing?.provider_message_id || (existing && ["SENT", "DELIVERED", "READ"].includes(existing.status))) return "SENT";
  if (existing?.status === "SKIPPED") return "SKIPPED";
  const now = new Date().toISOString();
  if (!existing) await db.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,order_id,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, orderId, kind, "PENDING", 0, now, now).run();
  const row = await db.prepare("SELECT id,status,provider_message_id,updated_at FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null; updated_at?: string }>();
  const staleSending = row?.status === "SENDING" && row.updated_at && Date.now() - Date.parse(row.updated_at) > 5 * 60 * 1000;
  if (row?.provider_message_id || (row && ["SENT", "DELIVERED", "READ"].includes(row.status))) return "SENT";
  if (!row || (!staleSending && !["PENDING", "FAILED", "RETRY"].includes(row.status))) return "FAILED";
  const claim = await db.prepare("UPDATE outbound_messages SET status='SENDING',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND provider_message_id IS NULL AND (status IN ('PENDING','FAILED','RETRY') OR (status='SENDING' AND updated_at<?))").bind(now, row.id, new Date(Date.now() - 5 * 60 * 1000).toISOString()).run();
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

async function paymentQrFromR2(db: D1Database, bucket: R2Bucket, config: ReturnType<typeof normalizePaymentMethodRow>): Promise<{ body: ArrayBuffer; mimeType: string } | undefined> {
  if (!config.qrR2Key) return undefined;
  if (!config.qrOwnerVerified) throw new Error("PAYMENT_QR_OWNERSHIP_UNVERIFIED");
  if (!config.qrMimeType || !config.qrSha256 || config.qrSizeBytes === undefined) throw new Error("PAYMENT_QR_METADATA_UNVERIFIED");
  const asset = await db.prepare("SELECT method,derivative_r2_key AS object_key,derivative_sha256 AS sha256,derivative_mime_type AS mime_type,derivative_size_bytes AS size_bytes,decoder_agreement,payload_match,scan_pass,independent_ownership_verified,independent_evidence_ref,active FROM payment_qr_assets WHERE method=? AND derivative_r2_key=?").bind(config.method, config.qrR2Key).first<Record<string, unknown>>();
  if (!asset) throw new Error("PAYMENT_QR_PROVENANCE_NOT_FOUND");
  const object = await bucket.get(config.qrR2Key);
  if (!object) throw new Error("PAYMENT_QR_NOT_FOUND");
  const body = await object.arrayBuffer();
  const contentType = object.httpMetadata?.contentType;
  if (!contentType || contentType !== config.qrMimeType) throw new Error("PAYMENT_QR_CONTENT_TYPE_MISMATCH");
  await verifyPaymentQrAsset(body, contentType, config, {
    method: String(asset.method),
    objectKey: String(asset.object_key),
    sha256: String(asset.sha256),
    mimeType: String(asset.mime_type),
    sizeBytes: Number(asset.size_bytes),
    decoderAgreement: Number(asset.decoder_agreement) === 1,
    payloadMatch: Number(asset.payload_match) === 1,
    scanPass: Number(asset.scan_pass) === 1,
    independentOwnershipVerified: Number(asset.independent_ownership_verified) === 1,
    independentEvidenceRef: asset.independent_evidence_ref == null ? null : String(asset.independent_evidence_ref),
    active: Number(asset.active) === 1
  });
  return { body, mimeType: config.qrMimeType };
}

async function deliverPaymentInstructions(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, to: string, orderId: string, orderNumber: string, amount: number, method: PaymentMethod, locale: "en" | "ur", message: string, requestKey: string, config: ReturnType<typeof normalizePaymentMethodRow>): Promise<PaymentDeliveryResult> {
  const textKey = `${requestKey}:text`;
  const qrKey = `${requestKey}:qr`;
  const conversation = await db.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id=?").bind(to).first<{ last_inbound_at: string | null }>();
  if (!isInsideWhatsAppServiceWindow(conversation?.last_inbound_at)) {
    const reason = "WHATSAPP_SERVICE_WINDOW_CLOSED";
    const blockedAt = new Date().toISOString();
    await markPaymentPartSkipped(db, orderId, textKey, "WHATSAPP_PAYMENT_TEXT", reason);
    await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", reason);
    await db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_SERVICE_WINDOW_BLOCKED", "SYSTEM", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ reason }), blockedAt).run();
    return { textSent: false, qrStatus: "FAILED" };
  }
  const order = await db.prepare("SELECT o.order_number,o.total_payable,o.state,o.payment_status,p.method AS selected_method FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=?").bind(orderId).first<Record<string, unknown>>();
  const currentRow = await db.prepare("SELECT pm.* FROM payment_methods pm JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE pm.method=? AND pm.enabled=1 AND pm.qr_owner_verified=1").bind(method).first<Record<string, unknown>>();
  const currentConfig = currentRow ? normalizePaymentMethodRow(currentRow) : undefined;
  const currentMessage = order && currentConfig && isPaymentMethodLocaleComplete(currentConfig, locale)
    ? formatPaymentMessage(String(order.order_number), Number(order.total_payable), currentConfig, locale)
    : undefined;
  const orderStillPending = order?.state === "PAYMENT_PENDING" && order.payment_status === "PENDING" && order.selected_method === method && String(order.order_number) === orderNumber && Number(order.total_payable) === amount;
  const sameSettings = currentConfig && currentConfig.method === config.method && currentConfig.qrR2Key === config.qrR2Key && currentConfig.qrSha256 === config.qrSha256 && currentConfig.recipientName === config.recipientName && currentConfig.tillId === config.tillId;
  if (!orderStillPending || !currentConfig?.qrOwnerVerified || !sameSettings || currentMessage !== message) {
    await markPaymentPartSkipped(db, orderId, textKey, "WHATSAPP_PAYMENT_TEXT", "PAYMENT_METHOD_NO_LONGER_ELIGIBLE");
    await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", "PAYMENT_METHOD_NO_LONGER_ELIGIBLE");
    return { textSent: false, qrStatus: "SKIPPED" };
  }
  const textStatus = await sendPaymentPart(db, to, orderId, textKey, "WHATSAPP_PAYMENT_TEXT", () => provider.sendText(to, currentMessage));
  const completedQr = await db.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(qrKey).first<{ status: string; provider_message_id: string | null }>();
  let qrStatus: PaymentPartStatus;
  if (completedQr?.provider_message_id || (completedQr && ["SENT", "DELIVERED", "READ"].includes(completedQr.status))) {
    qrStatus = "SENT";
  } else if (completedQr?.status === "SKIPPED") {
    qrStatus = "SKIPPED";
  } else if (completedQr && isTerminalOutboxStatus(completedQr.status)) {
    qrStatus = "FAILED";
  } else if (!currentConfig.qrR2Key) {
    qrStatus = await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", "PAYMENT_QR_NOT_CONFIGURED");
  } else {
    try {
      const qr = await paymentQrFromR2(db, bucket, currentConfig);
      qrStatus = qr ? await sendPaymentPart(db, to, orderId, qrKey, "WHATSAPP_PAYMENT_QR", () => provider.sendPaymentQr(to, qr)) : "SKIPPED";
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 160) : "PAYMENT_QR_DELIVERY_BLOCKED";
      qrStatus = await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", reason);
      await db.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE idempotency_key=? AND status='SKIPPED'").bind(reason, new Date().toISOString(), qrKey).run();
      qrStatus = "FAILED";
      await db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_QR_DELIVERY_BLOCKED", "SYSTEM", "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ method, orderNumber, reason }), new Date().toISOString()).run();
    }
  }
  await db.prepare("UPDATE outbox_jobs SET status=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','SUCCEEDED','PERMANENT_FAILURE','DEAD_LETTER')").bind(textStatus === "SENT" && qrStatus !== "FAILED" ? "SENT" : "RETRY", qrStatus === "FAILED" ? "PAYMENT_QR_DELIVERY_BLOCKED" : null, new Date().toISOString(), requestKey).run();
  return { textSent: textStatus === "SENT", qrStatus };
}

type CodPolicyRow = { enabled: number; fee_pkr: number; revision: string; collection_policy_hash: string | null; remittance_policy_hash: string | null; updated_by: string | null; updated_at: string; audited: number };

const codAuditMatch = `a.id=cfg.revision AND a.action='COD_CONFIGURATION_UPDATED' AND a.entity_type='COD_CONFIGURATION' AND a.entity_id='default'
  AND a.actor_type='ADMIN' AND a.actor_id=cfg.updated_by AND a.created_at=cfg.updated_at
  AND json_extract(a.metadata_json,'$.enabled')=1 AND json_extract(a.metadata_json,'$.feePkr')=cfg.fee_pkr
  AND json_extract(a.metadata_json,'$.collectionPolicyHash') IS cfg.collection_policy_hash
  AND json_extract(a.metadata_json,'$.remittancePolicyHash') IS cfg.remittance_policy_hash`;

async function codPolicy(db: D1Database): Promise<CodPolicyRow | null> {
  try {
    const row = await db.prepare(`SELECT cfg.enabled,cfg.fee_pkr,cfg.revision,cfg.collection_policy_hash,cfg.remittance_policy_hash,cfg.updated_by,cfg.updated_at,
      EXISTS(SELECT 1 FROM audit_log a WHERE ${codAuditMatch}) AS audited
      FROM cod_configuration cfg WHERE cfg.id='default'`).first<CodPolicyRow>();
    if (!row || Number(row.enabled) !== 1 || Number(row.audited) !== 1 || !row.updated_by?.trim() || !row.updated_at || Number(row.fee_pkr) !== 125) return null;
    return row;
  } catch {
    return null;
  }
}

function codItemLabel(item: { type: string; code: string; name: string }, locale: "en" | "ur"): string {
  if (item.type === "PRODUCT" && item.code === "FREE_5_PACK_VEGETABLE_SEEDS") return locale === "ur" ? "بیج (5 مفت پیکٹ)" : "Seeds (5 free packs)";
  if (item.type === "FERTILIZER" && item.code === "MICRO_NUTRIENTS_FERTILIZER") return locale === "ur" ? "مائیکرو نیوٹرینٹس کھاد (25 گرام)" : "Micro Nutrients Fertilizer (25 g)";
  return item.name;
}

function codQuoteLines(summary: Awaited<ReturnType<typeof getPersistedOrderSummary>>, feePkr: number, total: number, locale: "en" | "ur"): string[] {
  const items = [...summary.items].sort((a, b) => Number(a.type === "FERTILIZER") - Number(b.type === "FERTILIZER"));
  if (locale === "ur") {
    const itemLines = items.map((item) => `${codItemLabel(item, locale)}: PKR ${item.lineTotalPkr}`);
    return ["اشیاء:", ...itemLines, `ڈیلیوری فیس: PKR ${summary.deliveryPkr}`, `کیش آن ڈیلیوری وصولی فیس: PKR ${feePkr}`, `ڈیلیوری پر کل قابل ادائیگی: PKR ${total}`, "اگر آپ مکمل رقم ڈیلیوری پر ادا کرنے سے متفق ہیں تو ایک بار تصدیق کریں۔"];
  }
  const itemLines = items.map((item) => `${codItemLabel(item, locale)}: PKR ${item.lineTotalPkr}`);
  return ["Items:", ...itemLines, `Delivery Fee: PKR ${summary.deliveryPkr}`, `COD Cash Collection Fee: PKR ${feePkr}`, `TOTAL PAYABLE ON DELIVERY: PKR ${total}`, "Confirm once only if you agree to pay this full amount on delivery."];
}

function checkoutReviewLines(summary: { items: Array<{ type: string; code: string; name: string; lineTotalPkr: number }>; deliveryPkr: number; totalPayablePkr: number }, codFeePkr: number, locale: "en" | "ur"): string[] {
  const items = [...summary.items].sort((a, b) => Number(a.type === "FERTILIZER") - Number(b.type === "FERTILIZER"));
  const itemLines = items.map((item) => `${codItemLabel(item, locale)}: PKR ${item.lineTotalPkr}`);
  const labels = locale === "ur" ? { items: "اشیاء:", delivery: "ڈیلیوری فیس", advance: "پیشگی کل", fee: "COD فیس", total: "COD کل" } : { items: "Items:", delivery: "Delivery Fee", advance: "Advance total", fee: "COD fee", total: "COD total" };
  return [labels.items, ...itemLines, `${labels.delivery}: PKR ${summary.deliveryPkr}`, `${labels.advance}: PKR ${summary.totalPayablePkr}`, `${labels.fee}: PKR ${codFeePkr}`, `${labels.total}: PKR ${codQuote(summary.totalPayablePkr, codFeePkr)}`];
}

async function finalizeCodOrder(db: D1Database, orderId: string, quote: CodQuoteSnapshot | undefined, correlationId: string, waId: string, stateData: string, testHold: 0 | 1 | undefined): Promise<"CREATED" | "NOT_ELIGIBLE"> {
  if (testHold === undefined) return "NOT_ELIGIBLE";
  if (!quote || codQuote(quote.baseAmountPkr, quote.feePkr) !== quote.totalPkr) return "NOT_ELIGIBLE";
  const now = new Date().toISOString();
  const correlationHash = await customerTransactionReferenceHash(correlationId);
  const auditId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,status,created_at,updated_at)
      SELECT o.id,o.total_payable,cfg.fee_pkr,?,?,cfg.collection_policy_hash,cfg.remittance_policy_hash,?,'COD_PENDING',?,?
      FROM orders o JOIN payments p ON p.order_id=o.id JOIN province_delivery_rates province ON province.province=o.province AND province.enabled=1
      JOIN cod_configuration cfg ON cfg.id='default' AND cfg.enabled=1 JOIN audit_log a ON ${codAuditMatch}
      WHERE o.id=? AND o.state='DETAILS_COMPLETED' AND o.payment_status='PENDING' AND o.total_payable=?
      AND cfg.revision=? AND cfg.fee_pkr=? AND cfg.collection_policy_hash IS ? AND cfg.remittance_policy_hash IS ?
      AND p.method IS NULL AND p.review_state='PENDING' AND p.approved_amount IS NULL AND p.approved_by IS NULL AND p.approved_at IS NULL AND p.submitted_at IS NULL AND p.customer_transaction_reference IS NULL
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM audit_log h WHERE h.entity_id IN (o.id,p.id) AND h.action IN ('PAYMENT_METHOD_SELECTED','PAYMENT_APPROVED','PAYMENT_CONFIRMED','RECEIPT_SUBMITTED'))
      AND NOT EXISTS(SELECT 1 FROM outbox_jobs j WHERE j.entity_id=o.id AND j.kind='WHATSAPP_PAYMENT_INSTRUCTIONS')
      AND EXISTS(SELECT 1 FROM whatsapp_conversations c WHERE c.wa_id=? AND c.state='COD_CONFIRM' AND c.state_data=?)`).bind(quote.totalPkr, quote.policyRevision, testHold, now, now, orderId, quote.baseAmountPkr, quote.policyRevision, quote.feePkr, quote.collectionPolicyHash, quote.remittancePolicyHash, waId, stateData),
    db.prepare("UPDATE orders SET state='COD_PENDING',payment_status='COD_PENDING',updated_at=? WHERE id=? AND changes()=1").bind(now, orderId),
    db.prepare("UPDATE payments SET review_state='COD_PENDING',updated_at=? WHERE order_id=? AND changes()=1").bind(now, orderId),
    db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1").bind(auditId, "COD_ORDER_CONFIRMED", "CUSTOMER", "ORDER", orderId, correlationHash, JSON.stringify({ orderId, baseAmountPkr: quote.baseAmountPkr, codFeePkr: quote.feePkr, totalPkr: quote.totalPkr, policyRevision: quote.policyRevision, admission: testHold === 0 ? "PUBLIC" : "TESTER_ONLY", testHold }), now)
  ]);
  return results.every((result) => Number(result.meta?.changes ?? 0) === 1) ? "CREATED" : "NOT_ELIGIBLE";
}

async function processGuidedConversation(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }, flowId: string, flowTokenSecret?: string, checkoutMode: string = "guided", events?: Queue, codEnabled = false, codRolloutMode?: string, codTesterWaId?: string, paymentRemindersV2Enabled = false, paymentAutomationV2Enabled = false): Promise<boolean> {
  const sessionContent = (key: WhatsAppTemplateKey, fallback: string, values: { orderNumber?: string; amount?: string | number; totalPkr?: string | number; province?: string; paymentMethod?: string; recipientName?: string; tillId?: string } = {}) => contentFor(db, key, fallback, values, `CHAT:${event.from}`, data.language ?? "en");
  const message = event.payload && typeof event.payload === "object" ? event.payload as { text?: { body?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string }; nfm_reply?: { response_json?: string } }; button?: { payload?: string; text?: string } } : {};
  const interaction = message.interactive?.button_reply ?? message.interactive?.list_reply;
  const interactionId = interaction?.id ?? message.button?.payload;
  const text = (typeof message.text?.body === "string" ? message.text.body.trim() : String(interactionId ?? interaction?.title ?? message.button?.text ?? (message.interactive?.nfm_reply ? "FLOW_SUBMIT" : "")).trim()) || (message.interactive || message.button ? "INVALID_CALLBACK" : "");
  if (!text) return false;
  // Deduplicate before interpreting a replay against a later conversation state.
  const delivered = await db.prepare("SELECT provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(`conversation_reply:${event.id}`).first<{ provider_message_id: string | null }>();
  if (delivered?.provider_message_id) return true;
  let normalized = (interactionId ?? text).toUpperCase().replace(/\s+/g, "_");
  const row = await db.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string }>();
  const state = row?.state ?? "NEW";
  if (/^[12]$/.test(normalized)) {
    if (state === "LANGUAGE") normalized = normalized === "1" ? "LANG_UR" : "LANG_EN";
    else if (state === "FERTILIZER") normalized = normalized === "1" ? "ADD_FERTILIZER" : "SEEDS_ONLY";
    else if (state === "REVIEW") normalized = normalized === "1" ? "PLACE_ORDER" : "BACK";
  }
  const originalStateData = row?.state_data ?? "{}";
  let data: ConversationData = {};
  try { data = row?.state_data ? JSON.parse(row.state_data) as ConversationData : {}; } catch { data = {}; }
  const codConfirmationReply = (orderNumber: string, total: number) => data.language === "ur" ? `آرڈر ${orderNumber} وصولی پر ادائیگی کے لیے تصدیق ہو گیا۔ ڈیلیوری پر PKR ${total} ادا کریں۔` : `Order ${orderNumber} is confirmed for Cash on Delivery. Pay PKR ${total} on delivery.`;
  if (state === "COD_PENDING" && normalized === "CONFIRM_COD_ORDER" && data.orderId) {
    // Only the winning event can recover its reply; this never reopens COD intake or changes the winning state.
    const confirmed = await db.prepare(`SELECT o.order_number,cod.quoted_total_pkr FROM orders o
      JOIN cod_order_details cod ON cod.order_id=o.id JOIN payments p ON p.order_id=o.id
      JOIN whatsapp_conversations c ON c.wa_id=? AND c.state='COD_PENDING' AND json_extract(c.state_data,'$.orderId')=o.id
      JOIN audit_log a ON a.entity_type='ORDER' AND a.entity_id=o.id AND a.action='COD_ORDER_CONFIRMED' AND a.actor_type='CUSTOMER'
      WHERE o.id=? AND a.correlation_id=? AND o.state='COD_PENDING' AND o.payment_status='COD_PENDING'
      AND p.review_state='COD_PENDING' AND cod.status='COD_PENDING'
      AND json_extract(a.metadata_json,'$.baseAmountPkr')=cod.base_amount_pkr
      AND json_extract(a.metadata_json,'$.codFeePkr')=cod.cod_fee_pkr
      AND json_extract(a.metadata_json,'$.totalPkr')=cod.quoted_total_pkr
      AND json_extract(a.metadata_json,'$.policyRevision')=cod.policy_revision`)
      .bind(event.from, data.orderId, await customerTransactionReferenceHash(event.id)).first<{ order_number: string; quoted_total_pkr: number }>();
    if (confirmed) {
      const status = await sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status.");
      await sendConversationReply(db, provider, event.from, event.id, codConfirmationReply(confirmed.order_number, Number(confirmed.quoted_total_pkr)), { buttons: [{ id: "CHECK_ORDER", title: whatsAppActionLabel(status, "CHECK_ORDER") }] });
      return true;
    }
  }
  const codSettings = isCodAdmitted(event.from, codEnabled, codRolloutMode, codTesterWaId) ? await codPolicy(db) : null;
  const codAvailable = Boolean(codSettings);
  if (checkoutMode !== "guided" && state === "FLOW_ACTIVE" && message.interactive?.nfm_reply?.response_json) {
    try {
      const flowData = JSON.parse(message.interactive.nfm_reply.response_json) as { orderId?: string; orderNumber?: string };
      const order = await getLatestOrderForWaId(db, event.from, flowData.orderId);
      if (order && (flowData.orderId || flowData.orderNumber) && (!flowData.orderId || flowData.orderId === order.id) && (!flowData.orderNumber || flowData.orderNumber === order.orderNumber)) {
        Object.assign(data, { orderId: order.id, orderNumber: order.orderNumber });
        await db.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_METHOD',state_data=?,last_inbound_message_id=?,updated_at=? WHERE wa_id=?").bind(JSON.stringify(data), event.id, new Date().toISOString(), event.from).run();
        return true;
      }
    } catch { /* Invalid Flow callbacks cannot supply trusted order references. */ }
  }
  if (state === "PAYMENT_METHOD" && data.orderId) {
    const orderSummary = await getPersistedOrderSummary(db, data.orderId);
    data.orderNumber = orderSummary.orderNumber;
    data.amountPkr = orderSummary.totalPayablePkr;
  }
  let nextState = state;
  let reply: string | null = null;
  const noPaymentRequest = () => data.language === "ur" ? "فی الحال کوئی تصدیق شدہ ادائیگی کا طریقہ دستیاب نہیں؛ کوئی ادائیگی کی درخواست نہیں بھیجی گئی۔" : "No verified payment method is currently available; no payment request was sent.";
  const ensureProvisionalOrder = async () => {
    if (data.orderId) return { orderId: data.orderId, orderNumber: data.orderNumber ?? "", quote: await getPersistedOrderSummary(db, data.orderId) };
    const submission = { fullName: data.fullName!, deliveryAddress: data.deliveryAddress!, nearbyPlace: data.nearbyPlace!, city: data.city!, contactNumber: data.contactNumber!, productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province!, fertilizerSelected: data.fertilizerSelected ?? false, whatsappNumber: event.from };
    const key = `WHATSAPP:CHECKOUT:${data.checkoutId ?? event.from}`;
    try {
      const result = await persistFlowSubmission(db, submission, undefined, key, event.from);
      data.orderId = result.orderId; data.orderNumber = result.orderNumber;
      const quote = await getPersistedOrderSummary(db, result.orderId);
      data.amountPkr = quote.totalPayablePkr;
      return { orderId: result.orderId, orderNumber: result.orderNumber, quote };
    } catch (error) {
      if (!(error instanceof OrderCooldownError)) throw error;
      const recovered = await db.prepare("SELECT o.id,o.order_number FROM order_requests r JOIN orders o ON o.id=r.order_id WHERE r.idempotency_key=?").bind(key).first<{ id: string; order_number: string }>();
      if (!recovered) throw error;
      data.orderId = recovered.id; data.orderNumber = recovered.order_number;
      const quote = await getPersistedOrderSummary(db, recovered.id);
      data.amountPkr = quote.totalPayablePkr;
      return { orderId: recovered.id, orderNumber: recovered.order_number, quote };
    }
  };
  const preSubmitStates = ["NEW", "LANGUAGE", "OFFER", "FERTILIZER", "PRODUCT", "PROVINCE", "FULL_NAME", "ADDRESS", "NEARBY", "CITY", "CONTACT", "REVIEW"];
  const actionAllowed = /^(STATUS|CHECK_ORDER|HELP|SUPPORT)$/.test(normalized)
    || (normalized === "CANCEL" && preSubmitStates.includes(state))
    || (state === "OFFER" && /^(CONTINUE_ORDER|CANCEL_ORDER)$/.test(normalized))
    || (state === "NEW" && normalized === "GET_FREE_PACKS")
    || (state === "CANCELLED" && normalized === "START")
    || (["NEW", "PAYMENT_PENDING", "COMPLETE"].includes(state) && normalized === "START")
    || (state === "LANGUAGE" && /^(LANG_EN|LANG_UR)$/.test(normalized))
    || (["FERTILIZER", "PRODUCT"].includes(state) && /^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/.test(normalized))
    || (state === "PROVINCE" && normalized.startsWith("PROVINCE_"))
    || (state === "REVIEW" && (/^(CONFIRM|PLACE_ORDER|BACK)$/.test(normalized) || normalized === "PAY_ADVANCE" || (normalized === "PAY_COD" && codAvailable)))
    || (["PAYMENT_METHOD", "PAYMENT_PENDING"].includes(state) && Boolean(paymentMethodFromAction(normalized)))
    || (state === "PAYMENT_METHOD" && /^(ADVANCE_PAYMENT|COD)$/.test(normalized))
    || (state === "COD_CONFIRM" && /^(CONFIRM_COD_ORDER|ADVANCE_PAYMENT)$/.test(normalized))
    || (state === "COD_PENDING" && normalized === "ADVANCE_PAYMENT")
    || (state === "PAYMENT_GRACE" && Boolean(data.orderId) && /^(CONFIRM_COD|KEEP_ADVANCE|CANCEL_ORDER)$/.test(normalized));
  const semanticAction = /^(START|GET_FREE_PACKS|LANG_.*|PAY_.*|PAYMENT_HELP|PROVINCE_.*|ADD_FERTILIZER|SEEDS_ONLY|PLACE_ORDER|CONFIRM|BACK|CONTINUE_ORDER|CANCEL_ORDER|FLOW_SUBMIT|ADVANCE_PAYMENT|COD|CONFIRM_COD_ORDER|KEEP_ADVANCE|CONFIRM_COD)$/.test(normalized) || Boolean(paymentMethodFromAction(normalized));
  const invalidAction = Boolean(message.interactive || message.button || semanticAction) && !actionAllowed;
  let paymentSelection: { orderId: string; orderNumber: string; amount: number; method: PaymentMethod; locale: "en" | "ur"; message: string; idempotencyKey: string; config: ReturnType<typeof normalizePaymentMethodRow> } | undefined;
  let completePaymentMethods: Awaited<ReturnType<typeof completeEnabledPaymentMethods>> = [];
  let showPaymentChoice = false;
  let showAdvanceMethods = false;
  if (invalidAction) { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; }
  else if (state === "PAYMENT_GRACE" && data.orderId && /^(CONFIRM_COD|KEEP_ADVANCE|CANCEL_ORDER)$/.test(normalized)) {
    const policy = codAvailable ? { feePkr: Number(codSettings!.fee_pkr), revision: codSettings!.revision, collectionPolicyHash: codSettings!.collection_policy_hash, remittancePolicyHash: codSettings!.remittance_policy_hash, testHold: codTestHoldForAdmission(codRolloutMode) } : undefined;
    const choice = normalized === "CONFIRM_COD" ? "CONFIRMED_COD" : normalized === "KEEP_ADVANCE" ? "KEPT_ADVANCE" : "CANCELLED";
    const resolved = await resolvePaymentReminderCodFallback(db, data.orderId, event.from, choice, event.id, policy);
    if (resolved === "CONFIRMED") { nextState = "COD_PENDING"; reply = data.language === "ur" ? `آرڈر ${data.orderNumber ?? ""} COD کے لیے تصدیق ہو گیا۔ ڈیلیوری پر PKR ${Number(data.amountPkr ?? 0) + 125} ادا کریں۔` : `Order ${data.orderNumber ?? ""} is confirmed for COD. Pay PKR ${Number(data.amountPkr ?? 0) + 125} on delivery.`; }
    else if (resolved === "KEPT_ADVANCE") { nextState = "PAYMENT_PENDING"; reply = data.language === "ur" ? "ایڈوانس ادائیگی برقرار ہے۔ آرڈر زیرِ التوا رہے گا؛ آپ ادائیگی کی رسید بھیج سکتے ہیں۔" : "Advance payment is retained. The order remains unpaid and pending; you may send the payment receipt."; }
    else if (resolved === "CANCELLED") { nextState = "CANCELLED"; data = { language: data.language }; reply = data.language === "ur" ? "آپ کا زیرِ التوا آرڈر منسوخ کر دیا گیا ہے۔" : "Your pending order has been cancelled."; }
    else reply = data.language === "ur" ? "آرڈر کی حالت تبدیل ہو چکی ہے؛ کوئی COD تبدیلی نہیں کی گئی۔" : "The order is no longer eligible; no COD change was applied.";
  }
  else if (state === "COD_PENDING" && normalized === "ADVANCE_PAYMENT") { reply = data.language === "ur" ? "یہ آرڈر پہلے ہی COD کے لیے تصدیق ہو چکا ہے۔ حالت دیکھنے کے لیے Check Order استعمال کریں۔" : "This order is already confirmed for Cash on Delivery. Use Check Order to view its status."; }
  else if (normalized === "CANCEL") { nextState = "CANCELLED"; data = { language: data.language }; reply = data.language === "ur" ? "یہ غیر جمع شدہ آرڈر منسوخ کر دیا گیا ہے۔ کوئی آرڈر یا ادائیگی نہیں بنائی گئی۔ دوبارہ شروع کرنے کے لیے START لکھیں۔" : "This unsubmitted order entry is cancelled. No order or payment was created. Reply START to begin again."; }
  else if (normalized === "BACK" && state === "REVIEW") { nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; }
  else if (/^(STATUS|CHECK_ORDER)$/i.test(normalized)) { const locale = data.language ?? "en"; const order = await getLatestOrderForWaId(db, event.from, data.orderId); const status = await sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status."); const paymentStatusCopy = order ? await paymentCopyForOrder(db, order.id, "status_copy", locale) : undefined; reply = order ? `${paymentStatusCopy ?? status.text}\n${formatCustomerOrderStatus(order, locale)}` : locale === "ur" ? "اس واٹس ایپ گفتگو کے لیے کوئی آرڈر نہیں ملا۔" : "No order was found for this WhatsApp conversation."; }
  else if (/^(HELP|SUPPORT)$/i.test(normalized)) { reply = (await sessionContent("SUPPORT", "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry.")).text; }
  else if ((state === "NEW" && normalized === "GET_FREE_PACKS")) { nextState = "OFFER"; reply = (await sessionContent("OFFER", "Choose whether to continue your free seed order or cancel this unsubmitted request.")).text; }
  else if (state === "CANCELLED" && normalized === "START") { nextState = "LANGUAGE"; data = {}; const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "NEW" && (normalized === "START" || Boolean(text))) { nextState = "LANGUAGE"; const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) { data.language = normalized === "LANG_UR" ? "ur" : "en"; nextState = "OFFER"; reply = (await sessionContent("OFFER", "Choose whether to continue your free seed order or cancel this unsubmitted request.")).text; }
  else if (state === "LANGUAGE") { const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "OFFER" && normalized === "CONTINUE_ORDER") { nextState = checkoutMode === "guided" ? "FERTILIZER" : "FLOW_ACTIVE"; reply = (await sessionContent("FERTILIZER", "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?")).text; }
  else if (state === "OFFER" && normalized === "CANCEL_ORDER") { nextState = "CANCELLED"; data = { language: data.language }; reply = data.language === "ur" ? "یہ غیر جمع شدہ آرڈر منسوخ کر دیا گیا ہے۔ کوئی آرڈر یا ادائیگی نہیں بنائی گئی۔ دوبارہ شروع کرنے کے لیے START لکھیں۔" : "This unsubmitted order entry is cancelled. No order or payment was created. Reply START to begin again."; }
  else if (state === "FULL_NAME") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid full name.")).text; else { data.fullName = text; nextState = "ADDRESS"; reply = (await sessionContent("FIELD_DELIVERY_ADDRESS", "Please reply with your complete delivery address.")).text; } }
  else if (state === "ADDRESS") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a complete delivery address.")).text; else { data.deliveryAddress = text; nextState = "NEARBY"; reply = (await sessionContent("FIELD_NEARBY_PLACE", "Please reply with a nearby famous place.")).text; } }
  else if (state === "NEARBY") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a nearby famous place.")).text; else { data.nearbyPlace = text; nextState = "CITY"; reply = (await sessionContent("FIELD_CITY", "Please reply with your city.")).text; } }
  else if (state === "CITY") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid city.")).text; else { data.city = text; nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; } }
  else if (state === "CONTACT") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid contact number.")).text; else { data.contactNumber = text; data.checkoutId ??= crypto.randomUUID(); nextState = "REVIEW"; const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province ?? "", fertilizerSelected: data.fertilizerSelected ?? false }); const review = await sessionContent("REVIEW", "Review your order and choose a payment method."); reply = `${checkoutReviewLines({ items: quote.items, deliveryPkr: quote.deliveryFeePkr, totalPayablePkr: quote.totalPayablePkr }, codSettings?.fee_pkr ?? 125, data.language ?? "en").join("\n")}\n${review.text.replace(/Tap Place Order to confirm\./g, "Choose a payment method to continue.")}`; } }
  else if (state === "PRODUCT") { if (!/^(YES|SEEDS_ONLY|ADD_FERTILIZER)$/i.test(normalized)) { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } else { data.fertilizerSelected = normalized === "ADD_FERTILIZER"; nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "PROVINCE") { const provinceChoice = normalized.startsWith("PROVINCE_") ? normalized.slice(9).replace(/_/g, " ") : text; try { const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: provinceChoice, fertilizerSelected: data.fertilizerSelected ?? false }); data.province = quote.province; nextState = "FULL_NAME"; reply = (await sessionContent("FIELD_FULL_NAME", "Please reply with your full name.")).text; } catch { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } }
  else if (state === "FERTILIZER") { if (!/^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/i.test(normalized)) reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; else { data.fertilizerSelected = /^(YES|ADD_FERTILIZER)$/i.test(normalized); nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "REVIEW" && /^(PAY_ADVANCE|PAY_COD)$/.test(normalized)) {
    if (!data.fullName || !data.deliveryAddress || !data.nearbyPlace || !data.city || !data.contactNumber || !data.province) { nextState = "FULL_NAME"; data = { language: data.language }; reply = (await sessionContent("FIELD_FULL_NAME", "Please reply with your full name.")).text; }
    else {
      try {
        const result = await ensureProvisionalOrder();
        if (normalized === "PAY_ADVANCE") { nextState = "PAYMENT_METHOD"; showAdvanceMethods = true; reply = (await sessionContent("PAYMENT", "Choose an enabled advance payment method for order {orderNumber}.", { orderNumber: result.orderNumber, amount: result.quote.totalPayablePkr })).text; }
        else { const feePkr = Number(codSettings!.fee_pkr); const total = codQuote(result.quote.totalPayablePkr, feePkr); data.codQuote = { baseAmountPkr: result.quote.totalPayablePkr, feePkr, totalPkr: total, policyRevision: codSettings!.revision, collectionPolicyHash: codSettings!.collection_policy_hash, remittancePolicyHash: codSettings!.remittance_policy_hash }; nextState = "COD_CONFIRM"; reply = codQuoteLines(result.quote, feePkr, total, data.language ?? "en").join("\n"); }
      } catch (error) { if (error instanceof OrderCooldownError) { nextState = "PAYMENT_PENDING"; data.orderNumber = error.orderNumber; reply = `You already have order ${error.orderNumber}.`; } else throw error; }
    }
  }
  else if (state === "REVIEW") {
    if (!/^(CONFIRM|PLACE_ORDER)$/i.test(normalized)) reply = (await sessionContent("REVIEW", "Review your order. Tap Place Order to confirm.")).text;
    else if (!data.fullName || !data.deliveryAddress || !data.nearbyPlace || !data.city || !data.contactNumber || !data.province) {
      nextState = "FULL_NAME"; data = { language: data.language };
      reply = (await sessionContent("FIELD_FULL_NAME", "I need to restart safely. Please reply with your full name.")).text;
    } else {
      const submission = { fullName: data.fullName, deliveryAddress: data.deliveryAddress, nearbyPlace: data.nearbyPlace, city: data.city, contactNumber: data.contactNumber, productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province, fertilizerSelected: data.fertilizerSelected ?? false, whatsappNumber: event.from };
      try {
        const result = await recoverPendingGuidedOrder(db, event.from, data) ?? await persistFlowSubmission(db, submission, undefined, `WHATSAPP:${event.id}`, event.from);
        data.orderId = result.orderId; data.orderNumber = result.orderNumber;
        const summary = ("quote" in result ? result.quote : undefined) ?? await getPersistedOrderSummary(db, result.orderId);
        data.amountPkr = summary.totalPayablePkr;
        nextState = "PAYMENT_METHOD";
        reply = (await sessionContent("CONFIRMATION", "Order {orderNumber} created. Total: PKR {totalPkr}.", { orderNumber: result.orderNumber, totalPkr: summary.totalPayablePkr })).text;
      } catch (error) {
        if (!(error instanceof OrderCooldownError)) throw error;
        nextState = "PAYMENT_PENDING"; data.orderNumber = error.orderNumber;
        const nextDate = new Date(error.nextEligibleAt).toLocaleDateString(data.language === "ur" ? "ur-PK" : "en-PK", { timeZone: "Asia/Karachi" });
        reply = data.language === "ur" ? `آپ کا آرڈر ${error.orderNumber} پہلے سے موجود ہے۔ نیا آرڈر ${nextDate} کو دے سکتے ہیں۔` : `You already have order ${error.orderNumber}. You can request another order on ${nextDate}.`;
      }
    }
  }
  else if (state === "PAYMENT_METHOD" && normalized === "ADVANCE_PAYMENT" && data.orderId) {
    nextState = "PAYMENT_METHOD";
    showAdvanceMethods = true;
    reply = (await sessionContent("PAYMENT", "Choose an enabled advance payment method for order {orderNumber}.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text;
  }
  else if (state === "PAYMENT_METHOD" && normalized === "COD" && data.orderId && codAvailable) {
    try {
      const summary = await getPersistedOrderSummary(db, data.orderId);
      const feePkr = Number(codSettings!.fee_pkr);
      const total = codQuote(summary.totalPayablePkr, feePkr);
      data.codQuote = { baseAmountPkr: summary.totalPayablePkr, feePkr, totalPkr: total, policyRevision: codSettings!.revision, collectionPolicyHash: codSettings!.collection_policy_hash, remittancePolicyHash: codSettings!.remittance_policy_hash };
      const quoteLines = codQuoteLines(summary, feePkr, total, data.language ?? "en");
      nextState = "COD_CONFIRM";
      reply = quoteLines.join("\n");
    } catch {
      reply = data.language === "ur" ? "COD کوٹ دستیاب نہیں۔ آپ کا موجودہ آرڈر تبدیل نہیں ہوا۔" : "The COD quote is unavailable. Your existing order is unchanged.";
    }
  }
  else if (state === "COD_CONFIRM" && normalized === "ADVANCE_PAYMENT" && data.orderId) {
    delete data.codQuote;
    nextState = "PAYMENT_METHOD";
    showAdvanceMethods = true;
    reply = (await sessionContent("PAYMENT", "Choose an enabled advance payment method for order {orderNumber}.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text;
  }
  else if (state === "COD_CONFIRM" && normalized === "CONFIRM_COD_ORDER" && data.orderId) {
    const finalized = codAvailable ? await finalizeCodOrder(db, data.orderId, data.codQuote, event.id, event.from, originalStateData, codTestHoldForAdmission(codRolloutMode)) : "NOT_ELIGIBLE";
    if (finalized === "CREATED") {
      nextState = "COD_PENDING";
      const total = data.codQuote!.totalPkr;
      reply = codConfirmationReply(data.orderNumber ?? "", total);
    } else {
      delete data.codQuote;
      nextState = "PAYMENT_METHOD";
      showPaymentChoice = codAvailable;
      reply = data.language === "ur" ? "کوٹ یا آرڈر کی حالت تبدیل ہو چکی ہے؛ کوئی COD آرڈر جمع نہیں ہوا۔ نیا کوٹ دیکھ کر دوبارہ تصدیق کریں۔" : "The quote or order eligibility changed; no COD confirmation was applied. Request a fresh quote and confirm it again.";
    }
  }
  else if (["PAYMENT_METHOD", "PAYMENT_PENDING"].includes(state) && paymentMethodFromAction(normalized) && data.orderId) { const selectedMethod = paymentMethodFromAction(normalized)!; try { const selected = await selectPaymentMethod(db, data.orderId, selectedMethod, data.language ?? "en", event.from, event.id); if (paymentRemindersV2Enabled && paymentAutomationV2Enabled) { const payment = await db.prepare("SELECT id FROM payments WHERE order_id=?").bind(data.orderId).first<{ id: string }>(); if (payment) await createPaymentV2Schedule(db, data.orderId, payment.id, new Date()); } nextState = "PAYMENT_PENDING"; reply = selected.message; paymentSelection = { orderId: data.orderId, orderNumber: selected.orderNumber, amount: selected.amount, method: selectedMethod, locale: data.language ?? "en", message: selected.message, idempotencyKey: selected.idempotencyKey, config: selected.config }; } catch { reply = data.language === "ur" ? "یہ ادائیگی کا طریقہ فی الحال دستیاب نہیں؛ کوئی ادائیگی کی درخواست نہیں بھیجی گئی۔" : "That payment method is not currently available; no payment request was sent."; } }
  else if (state === "PAYMENT_PENDING" && /^(HELP|PAYMENT_HELP)$/i.test(normalized)) { reply = (await sessionContent("ORDER_STATUS", "Upload your payment receipt here after payment. Garden Shop will review it manually.", { orderNumber: data.orderNumber ?? "" })).text; }
  else if (state === "PAYMENT_PENDING" && normalized === "START") { const order = await getLatestOrderForWaId(db, event.from, data.orderId); const locale = data.language ?? "en"; reply = order ? formatCustomerOrderStatus(order, locale) : (await sessionContent("ORDER_STATUS", "Your order is still in progress. Upload the receipt or use Check Order.")).text; }
  else if (state === "PAYMENT_REFERENCE" || state === "PAYMENT_REVIEW") {
    const saved = await saveCustomerTransactionReference(db, event.from, data.orderId ?? "", text, event.id);
    if (saved === "SAVED" || saved === "ALREADY_SAVED") {
      nextState = "PAYMENT_REVIEW";
      reply = data.language === "ur" ? "ٹرانزیکشن حوالہ موصول ہو گیا۔ ادائیگی ایڈمن کے جائزے میں ہے اور اصل رقم کی تصدیق تک PAID نہیں ہو گی۔" : "Transaction reference received. Payment remains under Admin review and will not be marked PAID until actual account credit is verified.";
    } else if (saved === "REFERENCE_DUPLICATE") {
      reply = data.language === "ur" ? "یہ حوالہ پہلے استعمال ہو چکا ہے۔ اپنی رسید یا ادائیگی ایپ سے درست ٹرانزیکشن حوالہ بھیجیں۔" : "That reference was already used for this payment method. Check your receipt or payment app and send the correct transaction reference.";
    } else if (saved === "REFERENCE_ALREADY_SAVED") {
      nextState = "PAYMENT_REVIEW";
      reply = data.language === "ur" ? "حوالہ پہلے محفوظ ہو چکا ہے۔ ادائیگی ایڈمن کے جائزے میں ہے؛ دوبارہ کوئی حوالہ نہ بھیجیں۔" : "A transaction reference is already saved. Payment remains under Admin review; do not send a duplicate reference.";
    } else if (saved === "PAYMENT_NOT_IN_REVIEW") {
      reply = data.language === "ur" ? "ادائیگی کی حالت تبدیل نہیں ہوئی۔ آرڈر چیک کریں یا گارڈن شاپ سے رابطہ کریں۔" : "Payment remains unchanged. Use Check Order or contact Garden Shop for help.";
    } else {
      reply = data.language === "ur" ? "اپنی ادائیگی کی ایپ میں دکھایا گیا ٹرانزیکشن حوالہ 4 سے 80 حروف میں بھیجیں، آرڈر نمبر نہیں۔" : "Reply with the 4-80 character transaction reference shown in your payment app, not the order number.";
    }
  }
  else if (state === "COMPLETE" && normalized === "START") { const order = await getLatestOrderForWaId(db, event.from, data.orderId); reply = order ? `${formatCustomerOrderStatus(order, data.language ?? "en")}\n${noPaymentRequest()}` : noPaymentRequest(); }
  if (!reply) {
    const invalidKey: WhatsAppTemplateKey = state === "PAYMENT_METHOD" ? "PAYMENT" : state === "PAYMENT_PENDING" ? "ORDER_STATUS" : state === "LANGUAGE" ? "WELCOME" : "VALIDATION";
    reply = (await sessionContent(invalidKey, invalidKey === "PAYMENT" ? "Choose a verified payment method." : "Please choose one of the listed options.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text;
  }
  const [welcomeEn, welcomeUr, offer, fertilizer, province, review, status, support, payment] = await Promise.all([
    contentFor(db, "WELCOME", "Welcome to Get Free Seeds! Tap below to begin your order.", {}, `CHAT:${event.from}`, "en"),
    contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"),
    sessionContent("OFFER", "Choose whether to continue your free seed order or cancel this unsubmitted request."),
    sessionContent("FERTILIZER", "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?"),
    sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery."),
    sessionContent("REVIEW", "Review your order. Tap Place Order to confirm."),
    sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status."),
    sessionContent("SUPPORT", "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry."),
    sessionContent("PAYMENT", "Choose a verified payment method.")
  ]);
  const sessionFlowToken = checkoutMode !== "guided" && state === "OFFER" && normalized === "CONTINUE_ORDER" && flowTokenSecret ? await createFlowToken(event.from, event.id, flowTokenSecret) : undefined;
  const enabledProvinces = (await db.prepare("SELECT province,delivery_fee_pkr FROM province_delivery_rates WHERE enabled=1 ORDER BY province").all<{ province: string; delivery_fee_pkr: number }>()).results ?? [];
  let provinceRows: Array<{ id: string; title: string; description: string }> = [];
  if (nextState === "PROVINCE") {
    try {
      provinceRows = provinceDeliveryListRows(enabledProvinces, data.language ?? "en");
    } catch {
      provinceRows = [];
    }
    if (!provinceRows.length || !province.listButtonLabel?.trim()) {
      nextState = state;
      reply = (await sessionContent("VALIDATION", "Province delivery options are temporarily unavailable. Please try again later.")).text;
    }
  }
  if (nextState === "PAYMENT_METHOD") {
    completePaymentMethods = await completeEnabledPaymentMethods(db, data.language ?? "en");
    if (showPaymentChoice || (state === "REVIEW" && codAvailable)) {
      showPaymentChoice = true;
      reply = `${reply}\n${data.language === "ur" ? "ادائیگی کا طریقہ منتخب کریں: ایڈوانس پیمنٹ یا کیش آن ڈیلیوری (COD)۔ COD آرڈر پر PKR 125 اضافی کیش کلیکشن فیس لاگو ہوگی۔" : "Choose payment method: Advance Payment or Cash on Delivery (COD). COD orders include an additional PKR 125 cash collection fee."}`;
    } else if (!completePaymentMethods.length) {
      nextState = "COMPLETE";
      reply = state === "REVIEW" ? `${reply}\n${noPaymentRequest()}` : noPaymentRequest();
    } else if (state === "REVIEW" && !showPaymentChoice) {
      reply = `${reply}\n${(await sessionContent("PAYMENT", "Choose a verified payment method for order {orderNumber}.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text}`;
    }
  }
  const previousContactNumber = data.contactNumber;
  const rawContactInput = typeof message.text?.body === "string" ? message.text.body : text;
  if (state === "CONTACT" && !guidedFieldIsValid(state, rawContactInput)) { nextState = "CONTACT"; delete data.contactNumber; reply = data.language === "ur" ? "\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0645\u0648\u0628\u0627\u0626ل \u0646\u0645\u0628\u0631 03XXXXXXXXX \u06cc\u0627 03XX-XXXXXXX \u0641\u0627\u0631\u0645\u06ccٹ \u0645\u06cc\u06ba \u0644\u06a9ھیں۔" : "Please enter a mobile number in 03XXXXXXXXX or 03XX-XXXXXXX format."; }
  if (state === "CONTACT" && !guidedFieldIsValid(state, rawContactInput) && previousContactNumber) data.contactNumber = previousContactNumber;
  if (state === "CONTACT" && nextState === "REVIEW" && data.contactNumber) data.contactNumber = normalizeMobileContactNumber(data.contactNumber) ?? data.contactNumber;
  const paymentOptions = completePaymentMethods.map((method) => ({ id: paymentActionId(method.method), title: paymentActionTitle(payment, method) }));
  let options: ConversationReplyOptions = {};
  if ((state === "LANGUAGE" && !/^(LANG_EN|LANG_UR)$/.test(normalized)) || (state === "CANCELLED" && normalized === "START") || (state === "NEW" && normalized !== "GET_FREE_PACKS" && Boolean(text))) {
    options = { buttons: [{ id: "LANG_UR", title: whatsAppActionLabel(welcomeUr, "LANG_UR") }, { id: "LANG_EN", title: whatsAppActionLabel(welcomeEn, "LANG_EN") }] };
  } else if (sessionFlowToken) {
    options = { flow: { id: flowId, token: sessionFlowToken } };
  } else if ((state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) || (state === "NEW" && normalized === "GET_FREE_PACKS")) {
    options = { buttons: [{ id: "CONTINUE_ORDER", title: offer.actionLabels?.CONTINUE_ORDER ?? (data.language === "ur" ? "آرڈر جاری رکھیں" : "Continue Order") }, { id: "CANCEL_ORDER", title: offer.actionLabels?.CANCEL_ORDER ?? (data.language === "ur" ? "آرڈر منسوخ کریں" : "Cancel Order") }] };
  } else if (state === "OFFER" && normalized === "CONTINUE_ORDER" && nextState === "FERTILIZER") {
    options = { buttons: [{ id: "ADD_FERTILIZER", title: whatsAppActionLabel(fertilizer, "ADD_FERTILIZER") }, { id: "SEEDS_ONLY", title: whatsAppActionLabel(fertilizer, "SEEDS_ONLY") }] };
  } else if ((state === "FERTILIZER" || state === "PRODUCT") && /^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/i.test(normalized) && nextState === "PROVINCE" && provinceRows.length) {
    options = { list: { buttonText: province.listButtonLabel!, rows: provinceRows } };
  } else if (state === "CONTACT" && nextState === "REVIEW") {
    options = { buttons: [{ id: "PAY_ADVANCE", title: data.language === "ur" ? "پیشگی ادائیگی" : "Advance Payment" }, ...(codAvailable ? [{ id: "PAY_COD", title: data.language === "ur" ? "کیش آن ڈیلیوری" : "Cash on Delivery" }] : [])] };
  } else if (showPaymentChoice) {
    // Meta reply-button titles are limited to 20 characters. Keep the COD
    // abbreviation in the payment notice while using the valid button label.
    options = { buttons: [{ id: "ADVANCE_PAYMENT", title: data.language === "ur" ? "ایڈوانس ادائیگی" : "Advance Payment" }, { id: "COD", title: data.language === "ur" ? "کیش آن ڈیلیوری" : "Cash on Delivery" }] };
  } else if (nextState === "PAYMENT_GRACE" || state === "PAYMENT_GRACE") {
    options = { buttons: [
      { id: "CONFIRM_COD", title: data.language === "ur" ? "COD کی تصدیق" : "Confirm COD" },
      { id: "KEEP_ADVANCE", title: data.language === "ur" ? "ایڈوانس برقرار" : "Keep Advance" },
      { id: "CANCEL_ORDER", title: data.language === "ur" ? "آرڈر منسوخ" : "Cancel Order" }
    ] };
  } else if (nextState === "COD_CONFIRM") {
    options = { buttons: [{ id: "CONFIRM_COD_ORDER", title: data.language === "ur" ? "COD آرڈر کی تصدیق" : "Confirm COD Order" }, { id: "ADVANCE_PAYMENT", title: data.language === "ur" ? "ایڈوانس ادائیگی" : "Advance Payment" }] };
  } else if (nextState === "PAYMENT_METHOD" && paymentOptions.length) {
    options = { buttons: paymentOptions };
  } else if (["PAYMENT_PENDING", "PAYMENT_REFERENCE", "PAYMENT_REVIEW", "COD_PENDING"].includes(state) || nextState === "PAYMENT_REVIEW" || nextState === "COD_PENDING" || nextState === "COMPLETE") {
    options = { buttons: [{ id: "CHECK_ORDER", title: whatsAppActionLabel(status, "CHECK_ORDER") }] };
  }
  const mediaKey = invalidAction ? "VALIDATION" : guidedReplyMediaKey(normalized, state, nextState);
  // Payment images must come only from the selected method's verified private asset.
  if (mediaKey && mediaKey !== "PAYMENT") options.image = await contentImageFor(db, bucket, mediaKey, `CHAT:${event.from}`);
  const now = new Date().toISOString();
  const statusReply = /^(STATUS|CHECK_ORDER|HELP|SUPPORT)$/.test(normalized) || (normalized === "START" && ["PAYMENT_PENDING", "COMPLETE"].includes(state));
  const savedConversation = await db.prepare(`INSERT INTO whatsapp_conversations (id,wa_id,state,state_data,last_inbound_message_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(wa_id) DO UPDATE SET state=excluded.state,state_data=excluded.state_data,last_inbound_message_id=excluded.last_inbound_message_id,updated_at=excluded.updated_at
    WHERE whatsapp_conversations.state=? AND whatsapp_conversations.state_data=?
    AND (? IS NULL OR ?='COD_PENDING' OR ?=1 OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=? AND o.payment_status IN ('COD_PENDING','PAID')))`)
    .bind(crypto.randomUUID(), event.from, nextState, JSON.stringify(data), event.id, now, now, state, originalStateData, data.orderId ?? null, nextState, statusReply ? 1 : 0, data.orderId ?? null).run();
  if (!savedConversation.meta.changes) return true;
  if (paymentSelection) {
    const delivery = await deliverPaymentInstructions(db, bucket, provider, event.from, paymentSelection.orderId, paymentSelection.orderNumber, paymentSelection.amount, paymentSelection.method, paymentSelection.locale, paymentSelection.message, paymentSelection.idempotencyKey, paymentSelection.config);
    try { if (events) await events.send({ kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey: paymentSelection.idempotencyKey, entityId: paymentSelection.orderId, schemaVersion: 1 }); } catch { /* the durable outbox remains authoritative */ }
    if (delivery.textSent && delivery.qrStatus !== "FAILED") {
      return true;
    }
    if (delivery.textSent) return true;
    await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,updated_at=? WHERE wa_id=? AND last_inbound_message_id=? AND state=? AND state_data=? AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=? AND o.payment_status IN ('COD_PENDING','PAID'))").bind(state, originalStateData, new Date().toISOString(), event.from, event.id, nextState, JSON.stringify(data), paymentSelection.orderId).run();
    return true;
  }
  const sent = await sendConversationReply(db, provider, event.from, event.id, reply, options);
  if (!sent.sent && nextState !== "COD_PENDING") await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,updated_at=? WHERE wa_id=? AND last_inbound_message_id=? AND state=? AND state_data=? AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=? AND o.payment_status IN ('COD_PENDING','PAID')))").bind(state, originalStateData, new Date().toISOString(), event.from, event.id, nextState, JSON.stringify(data), data.orderId ?? null, data.orderId ?? null).run();
  return true;
}

async function recordReceiptMediaDiagnostic(db:D1Database,eventId:string,mediaId:string,reason:string,stage:string,candidateCount=0):Promise<void>{
  const messageIdHash=await customerTransactionReferenceHash(eventId),mediaIdHash=await customerTransactionReferenceHash(mediaId),now=new Date().toISOString();
  await db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),"RECEIPT_INGESTION_BLOCKED","SYSTEM","WHATSAPP_RECEIPT_EVENT",messageIdHash,messageIdHash,JSON.stringify({messageIdHash,mediaIdHash,reason,stage,candidateCount}),now).run();
}

async function processReceiptMedia(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }): Promise<boolean> {
  const message = event.payload && typeof event.payload === "object" ? event.payload as { image?: { id?: string }; document?: { id?: string }; context?: { id?: string } } : {};
  const mediaId = message.image?.id ?? message.document?.id;
  if (!mediaId) return false;
  const conversation = await db.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string }>();
  const paymentStates=["PAYMENT_PENDING","PAYMENT_REFERENCE","PAYMENT_REVIEW"];
  if(!message.context?.id&&conversation&&conversation.state!=="NEW"&&!paymentStates.includes(conversation.state))return false;
  let data:ConversationData={};
  try{if(conversation)data=JSON.parse(conversation.state_data) as ConversationData}catch{if(!message.context?.id)return false}
  const select=`SELECT o.id,o.order_number,o.state,p.id AS payment_id,p.method,p.review_state,p.customer_transaction_reference
    FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id`;
  const senderDigits=event.from.startsWith("+")?event.from.slice(1):event.from;
  const senderNumbers=[senderDigits,`+${senderDigits}`,senderDigits,`+${senderDigits}`,senderDigits,`+${senderDigits}`];
  const senderMatch="(c.wa_id IN (?,?) OR (c.wa_id IS NULL AND (c.normalized_whatsapp_number IN (?,?) OR c.whatsapp_number IN (?,?))))";
  let record=message.context?.id?await db.prepare(`${select} JOIN outbound_messages m ON m.order_id=o.id WHERE ${senderMatch} AND m.provider_message_id=?
    AND m.kind IN ('WHATSAPP_PAYMENT_TEXT','WHATSAPP_PAYMENT_QR') AND o.state IN ('PAYMENT_PENDING','PAYMENT_REVIEW')
    AND p.review_state IN ('PENDING','REJECTED','REVIEW') LIMIT 1`).bind(...senderNumbers,message.context.id)
    .first<{id:string;order_number:string;state:string;payment_id:string;method:string|null;review_state:string;customer_transaction_reference:string|null}>():null;
  const paymentReplyMatched = Boolean(record);
  if(!record){
    const candidates=await db.prepare(`${select} WHERE ${senderMatch} AND o.state IN ('PAYMENT_PENDING','PAYMENT_REVIEW') AND p.review_state IN ('PENDING','REJECTED','REVIEW') ORDER BY o.created_at DESC,o.id DESC LIMIT 2`).bind(...senderNumbers).all<{id:string}>();
    if(candidates.results?.length!==1){await recordReceiptMediaDiagnostic(db,event.id,mediaId,candidates.results?.length?"MULTIPLE_ELIGIBLE_PAYMENT_ORDERS":"NO_ELIGIBLE_PAYMENT_ORDER","ORDER_ASSOCIATION",candidates.results?.length??0);return false}
    if(data.orderId&&candidates.results[0].id!==data.orderId){await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ACTIVE_CONVERSATION_ORDER_MISMATCH","ORDER_ASSOCIATION",1);return false}
    record=await db.prepare(`${select} WHERE o.id=? AND ${senderMatch}`).bind(data.orderId??candidates.results[0].id,...senderNumbers)
      .first<{id:string;order_number:string;state:string;payment_id:string;method:string|null;review_state:string;customer_transaction_reference:string|null}>();
  }
  if(!record)return false;
  if(record.state!=="PAYMENT_PENDING"&&record.state!=="PAYMENT_REVIEW"){await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ORDER_STATE_NOT_RECEIVABLE","ORDER_ASSOCIATION");return false}
  if(!record.method || !["JAZZCASH","EASYPAISA","BANK_TRANSFER"].includes(record.method)){await recordReceiptMediaDiagnostic(db,event.id,mediaId,record.method === "COD" ? "COD_RECEIPT_REJECTED" : "NON_ADVANCE_RECEIPT_REJECTED","ORDER_ASSOCIATION");return false}
  const associationEvidence=paymentReplyMatched?"PAYMENT_REPLY_WAMID":message.context?.id?"UNMATCHED_REPLY_UNIQUE_SENDER_PAYMENT":data.orderId?"ACTIVE_CONVERSATION_ORDER":"UNIQUE_SENDER_PAYMENT";
  const existing=await db.prepare("SELECT id,order_id FROM payment_receipts WHERE provider_media_id=? LIMIT 1").bind(mediaId).first<{id:string;order_id:string}>();
  if(existing && existing.order_id!==record.id){await recordReceiptMediaDiagnostic(db,event.id,mediaId,"MEDIA_ALREADY_ASSOCIATED","ORDER_ASSOCIATION");return true}
  if(existing)return true;
  if(!existing){
    let media:Awaited<ReturnType<typeof provider.downloadMedia>>,stored:{objectKey:string;sha256:string};
    try{media=await provider.downloadMedia(mediaId)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"META_MEDIA_DOWNLOAD_FAILED","MEDIA_DOWNLOAD");throw new Error("RECEIPT_MEDIA_DOWNLOAD_FAILED")}
    try{stored=await storeReceipt(bucket,record.order_number,media)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"PRIVATE_R2_WRITE_FAILED","R2_WRITE");throw new Error("RECEIPT_R2_WRITE_FAILED")}
    const now=new Date().toISOString(),messageIdHash=await customerTransactionReferenceHash(event.id),mediaIdHash=await customerTransactionReferenceHash(mediaId);
    const updatedData=JSON.stringify({...data,orderId:record.id,orderNumber:record.order_number,language:data.language??"en"});
    try{await db.batch([
      db.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),record.payment_id,record.id,media.mediaId,stored.objectKey,stored.sha256,media.mimeType,media.size,now,now),
      db.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=COALESCE(submitted_at,?),updated_at=? WHERE id=? AND review_state IN ('PENDING','REJECTED','REVIEW')").bind(now,now,record.payment_id),
      db.prepare("UPDATE orders SET state='PAYMENT_REVIEW',updated_at=? WHERE id=? AND state IN ('PAYMENT_PENDING','PAYMENT_REVIEW')").bind(now,record.id),
      db.prepare(`UPDATE whatsapp_conversations SET state=CASE WHEN state IN ('PAYMENT_PENDING','NEW') THEN 'PAYMENT_REFERENCE' ELSE state END,state_data=CASE WHEN state='NEW' OR state_data IN ('{}','') THEN ? ELSE state_data END,last_inbound_message_id=?,updated_at=?
        WHERE wa_id=? AND ((state IN ('PAYMENT_PENDING','PAYMENT_REFERENCE','PAYMENT_REVIEW') AND (state_data LIKE ? OR state_data IN ('{}',''))) OR state='NEW')`).bind(updatedData,event.id,now,event.from,`%\"orderId\":\"${record.id}\"%`),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"RECEIPT_SUBMITTED","CUSTOMER","PAYMENT",record.payment_id,messageIdHash,JSON.stringify({orderId:record.id,messageIdHash,providerMediaIdHash:mediaIdHash,associationEvidence}),now)
    ])}catch{
      try{await bucket.delete(stored.objectKey)}catch{try{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ORPHAN_R2_CLEANUP_FAILED","D1_COMMIT",1)}catch{}}
      try{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"RECEIPT_D1_COMMIT_FAILED","D1_COMMIT",1)}catch{}
      throw new Error("RECEIPT_D1_COMMIT_FAILED");
    }
  }
  const receiptText=data.language === "ur" ? `\u0622\u0631\u0688\u0631 ${record.order_number} \u06a9\u06cc \u0631\u0633\u06cc\u062f \u0645\u0648\u0635\u0648\u0644 \u06c1\u0648 \u06af\u0626\u06cc\u06d4 \u0627\u062f\u0627\u0626\u06cc\u06af\u06cc \u0627\u06cc\u0688\u0645\u0646 \u06a9\u06d2 \u062cا\u0626ز\u06d2 \u0645ی\u06ba \u06c1\u06d2\u06d4 \u062a\u0635\u062f\u06cc\u0642 \u06a9\u06d2 \u0628عد \u0627طلاع \u062f\u06cc \u062c\u0627\u0626\u06d2 \u06af\u06cc\u06d4` : `Receipt received for order ${record.order_number}. Your payment is under Admin review. We will notify you after verification.`;
  const orderStatus=await contentFor(db,"ORDER_STATUS","Use Check Order to see the current order and payment status.",{},`CHAT:${event.from}`,data.language??"en");
  const image=await contentImageFor(db,bucket,"RECEIPT",`CHAT:${event.from}`);
  await sendConversationReply(db,provider,event.from,event.id,receiptText,{image,buttons:[{id:"CHECK_ORDER",title:whatsAppActionLabel(orderStatus,"CHECK_ORDER")}]});
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
  const configuredPhoneId = c.env.META_PHONE_NUMBER_ID?.trim();
  const callbackPhoneIds = webhookPhoneNumberIds(payload);
  if (!configuredPhoneId || callbackPhoneIds.length === 0 || callbackPhoneIds.some((phoneId) => phoneId !== configuredPhoneId)) {
    if (c.env.DB) await c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_CALLBACK_REJECTED", "SYSTEM", "WEBHOOK", "whatsapp", correlationId, JSON.stringify({ reason: "WHATSAPP_PHONE_NUMBER_MISMATCH", callbackPhoneIdsPresent: callbackPhoneIds.length > 0 }), new Date().toISOString()).run();
    return c.json({ error: "WHATSAPP_PHONE_NUMBER_MISMATCH" }, 403);
  }
  const inbound = provider.parseInboundEvent(payload);
  if (c.env.DB && !(await admitWhatsAppSenders(c.env.DB, inbound))) {
    c.header("Retry-After", "60");
    return c.json({ error: "WHATSAPP_SENDER_RATE_LIMITED", retryAfterSeconds: 60 }, 429);
  }
  const eventCount = c.env.DB ? await persistWebhookRecords(c.env.DB, payload, raw, correlationId) : 0;
  if (c.env.DB && c.env.PAYMENT_REMINDERS_V2_ENABLED === "true") await syncPaymentReminderDeliveryStatuses(c.env.DB);
  if (c.env.DB) await persistInboundConversationActivity(c.env.DB, inbound);
  let autoReplies = 0;
  for (const event of inbound) {
    if (event.kind === "media") { if (c.env.DB && await processReceiptMedia(c.env.DB, c.env.RECEIPTS, provider, event)) continue; else continue; }
    if (c.env.DB && await processGuidedConversation(c.env.DB, c.env.RECEIPTS, provider, event, c.env.META_FLOW_ID ?? "1133458765899784", c.env.META_APP_SECRET, c.env.WHATSAPP_CHECKOUT_MODE ?? "guided", c.env.EVENTS, c.env.COD_V1_ENABLED === "true", c.env.COD_ROLLOUT_MODE, c.env.COD_TESTER_WA_ID, c.env.PAYMENT_REMINDERS_V2_ENABLED === "true", c.env.PAYMENT_AUTOMATION_V2_ENABLED === "true")) continue;
    const activeConversation = c.env.DB ? await c.env.DB.prepare("SELECT state FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string }>() : null;
    if (activeConversation) continue;
    const idempotencyKey = `welcome_reply:${event.id}`;
    const existing = c.env.DB ? await c.env.DB.prepare("SELECT status FROM outbound_messages WHERE idempotency_key=?").bind(idempotencyKey).first<{ status: string }>() : null;
    if (existing) continue;
    const now = new Date().toISOString();
    if (c.env.DB) {
      const inboundEvent = await c.env.DB.prepare("SELECT created_at FROM whatsapp_events WHERE provider_event_id=?").bind(`message:${event.id}`).first<{ created_at: string }>();
      if (!isInsideWhatsAppServiceWindow(inboundEvent?.created_at)) {
        await c.env.DB.batch([
          c.env.DB.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), idempotencyKey, "WELCOME_REPLY", "PERMANENT_FAILURE", 0, "WHATSAPP_SERVICE_WINDOW_CLOSED", now, now),
          c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_SERVICE_WINDOW_BLOCKED", "SYSTEM", "OUTBOUND_MESSAGE", idempotencyKey, crypto.randomUUID(), JSON.stringify({ reason: "WHATSAPP_SERVICE_WINDOW_CLOSED" }), now)
        ]);
        continue;
      }
    }
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
  if ((c.env.WHATSAPP_CHECKOUT_MODE ?? "guided") === "guided") return c.json({ error: "NATIVE_FLOW_DISABLED" }, 410);
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
    if (isD1QuotaError(error)) return c.json({ error: "D1_QUOTA_EXHAUSTED", message: "D1 is temporarily unavailable. No order confirmation was issued; retry after the quota reset." }, 503);
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
    if (isD1QuotaError(error)) return c.json({ error: "D1_QUOTA_EXHAUSTED", message: "D1 is temporarily unavailable. No quote or order state was reported; retry after the quota reset." }, 503);
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
    if (c.env.PAYMENT_REMINDERS_V2_ENABLED === "true" && c.env.PAYMENT_AUTOMATION_V2_ENABLED === "true") {
      const payment = await c.env.DB.prepare("SELECT id FROM payments WHERE order_id=?").bind(orderId).first<{ id: string }>();
      if (payment) await createPaymentV2Schedule(c.env.DB, orderId, payment.id, new Date());
    }
    const orderSummary = await getPersistedOrderSummary(c.env.DB, orderId);
    return c.json({ ok: true, orderNumber: result.orderNumber, amount: result.amount, method: result.config.method, message: result.message, qrAvailable: Boolean(result.config.qrR2Key), orderSummary, paymentMethods: orderSummary.paymentMethods, paymentMethodOptions: orderSummary.paymentMethods.map((name) => ({ id: name, title: name })) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYMENT_METHOD_SELECTION_FAILED";
    if (isD1QuotaError(error)) return c.json({ error: "D1_QUOTA_EXHAUSTED", message: "D1 is temporarily unavailable. No payment selection or confirmation was reported; retry after the quota reset." }, 503);
    return c.json({ error: code }, code === "PAYMENT_SELECTION_CONFLICT" ? 409 : 400);
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
    if (isD1QuotaError(error)) return c.json({ error: "D1_QUOTA_EXHAUSTED", message: "D1 is temporarily unavailable. No receipt or payment confirmation was reported; retry after the quota reset." }, 503);
    return c.json({ error: error instanceof Error ? error.message : "RECEIPT_INGEST_FAILED" }, 400);
  }
});

type ClearerReceiptReasonCode = "TEST_IMAGE_NOT_PAYMENT_PROOF" | "INSUFFICIENT_OR_UNCLEAR_RECEIPT";
function clearerReceiptText(orderNumber: string, locale: "en" | "ur", reasonCode: ClearerReceiptReasonCode): string {
  if (locale === "ur") return reasonCode === "TEST_IMAGE_NOT_PAYMENT_PROOF"
    ? `آپ نے آرڈر ${orderNumber} کے لیے جو تصویر بھیجی ہے وہ ٹیسٹ تصویر ہے، ادائیگی کا ثبوت نہیں۔ کوئی ادائیگی تصدیق شدہ نہیں ہے۔ اگر آپ نے ادائیگی کی ہے تو براہِ کرم اس آرڈر کی واضح اور اصل رسید اپ لوڈ کریں۔ آپ کی ادائیگی ایڈمن کے جائزے میں رہے گی۔`
    : `آرڈر ${orderNumber} کی بھیجی گئی تصویر واضح نہیں ہے۔ براہِ کرم درست آرڈر کی واضح رسید دوبارہ اپ لوڈ کریں۔ آپ کی ادائیگی ایڈمن کے جائزے میں ہے۔`;
  return reasonCode === "TEST_IMAGE_NOT_PAYMENT_PROOF"
    ? `The image you sent for order ${orderNumber} is a test image, not payment proof. No payment has been confirmed. If you have paid, please upload a clear genuine receipt for this order. Your payment remains under Admin review.`
    : `The image submitted for order ${orderNumber} is unclear. Please upload a clear receipt for the correct order. Your payment remains under Admin review.`;
}

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env["Bindings"]): Promise<void> {
    if (env.PAYMENT_REMINDERS_V2_ENABLED !== "true" || env.PAYMENT_AUTOMATION_V2_ENABLED !== "true") return;
    const now = new Date(controller.scheduledTime).toISOString();
    await enqueueDuePaymentV2Stages(env.DB, new Date(controller.scheduledTime), true);
    const stale = new Date(Date.parse(now) - 5 * 60_000).toISOString();
    const jobs = await env.DB.prepare(`SELECT idempotency_key,entity_id FROM outbox_jobs
      WHERE kind='WHATSAPP_PAYMENT_REMINDER' AND ((status IN ('PENDING','RETRY') AND available_at<=?) OR (status='QUEUED' AND updated_at<=?))
      ORDER BY available_at,id LIMIT 100`).bind(now, stale).all<{ idempotency_key: string; entity_id: string }>();
    for (const job of jobs.results ?? []) {
      const claimed = await env.DB.prepare(`UPDATE outbox_jobs SET status='QUEUED',updated_at=?
        WHERE idempotency_key=? AND ((status IN ('PENDING','RETRY') AND available_at<=?) OR (status='QUEUED' AND updated_at<=?))`)
        .bind(now, job.idempotency_key, now, stale).run();
      if (Number(claimed.meta.changes) !== 1) continue;
      try { await env.EVENTS.send({ kind: "WHATSAPP_PAYMENT_REMINDER", idempotencyKey: job.idempotency_key, entityId: job.entity_id, schemaVersion: 1 }); }
      catch { await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',last_error='QUEUE_DISPATCH_FAILED',available_at=?,updated_at=? WHERE idempotency_key=? AND status='QUEUED'").bind(new Date(Date.parse(now) + 60_000).toISOString(), now, job.idempotency_key).run(); }
    }
  },
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
        if (message.body.kind === "WHATSAPP_PAYMENT_REMINDER") {
          const blockReminder = async (reason: string, stageStatus: "BLOCKED_TEMPLATE" | "BLOCKED_WINDOW" | "SKIPPED") => {
            const blockedAt = new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt, reason, blockedAt, message.body.idempotencyKey),
              env.DB.prepare("UPDATE payment_reminder_v2_stages SET status=?,last_error=?,completed_at=?,updated_at=? WHERE idempotency_key=? AND status='QUEUED'").bind(stageStatus, reason, blockedAt, blockedAt, message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_PAYMENT_REMINDER_BLOCKED", "SYSTEM", "ORDER", message.body.entityId, crypto.randomUUID(), JSON.stringify({ reason }), blockedAt)
            ]);
            message.ack();
          };
          try {
            if (env.PAYMENT_REMINDERS_V2_ENABLED !== "true" || env.PAYMENT_AUTOMATION_V2_ENABLED !== "true") { await blockReminder("PAYMENT_REMINDERS_V2_DISABLED", "SKIPPED"); continue; }
            const stored = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = stored ? JSON.parse(stored.payload_json) as { stageId?: string; stageMinutes?: number; scheduleId?: string; orderId?: string; paymentId?: string; customerId?: string } : undefined;
            if (!payload?.stageId || !payload.scheduleId || payload.orderId !== message.body.entityId || payload.stageId !== message.body.idempotencyKey) { await blockReminder("PAYMENT_REMINDER_PAYLOAD_INVALID", "SKIPPED"); continue; }
            const current = await env.DB.prepare(`SELECT st.id,st.stage_minutes,st.status AS stage_status,st.locale AS pinned_locale,st.template_version AS pinned_template_version,
                s.status AS schedule_status,s.phase,s.source_created_at,o.order_number,o.state,o.archived_at,o.payment_status,o.total_payable,
                p.id AS payment_id,p.review_state,p.method,c.id AS customer_id,c.wa_id,wc.last_inbound_at,wc.state_data,
                EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS has_receipt,
                EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id) AS opted_out
              FROM payment_reminder_v2_stages st JOIN payment_reminder_v2_schedules s ON s.id=st.schedule_id
              JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id JOIN customers c ON c.id=o.customer_id
              LEFT JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id
              WHERE st.id=? AND s.id=? AND o.id=? AND p.id=? AND c.id=?`).bind(payload.stageId, payload.scheduleId, payload.orderId, payload.paymentId, payload.customerId ?? "")
              .first<{ id:string; stage_minutes:number; stage_status:string; pinned_locale:string|null; pinned_template_version:number|null; schedule_status:string; phase:string; source_created_at:string; order_number:string; state:string; archived_at:string|null; payment_status:string; total_payable:number; payment_id:string; review_state:string; method:string|null; customer_id:string; wa_id:string|null; last_inbound_at:string|null; state_data:string|null; has_receipt:number; opted_out:number }>();
            if (!current || current.stage_status !== "QUEUED" || Number(current.stage_minutes) !== Number(payload.stageMinutes)) { await blockReminder("PAYMENT_REMINDER_STATE_MISMATCH", "SKIPPED"); continue; }
            const eligible = current.schedule_status === "ACTIVE" && current.payment_status === "PENDING" && current.review_state === "PENDING" && current.has_receipt === 0 && current.state === "PAYMENT_PENDING" && (Number(payload.stageMinutes) < 240 || current.phase === "PAYMENT_GRACE");
            if (!eligible || current.archived_at || current.opted_out || !current.wa_id || !/^\d{7,20}$/.test(current.wa_id)) { await blockReminder(current.opted_out ? "PAYMENT_REMINDER_OPTED_OUT" : "PAYMENT_REMINDER_NO_LONGER_ELIGIBLE", "SKIPPED"); continue; }
            let locale: "en" | "ur";
            try { const data = JSON.parse(current.state_data ?? "{}") as { language?: unknown }; locale = current.pinned_locale === "ur" || current.pinned_locale === "en" ? current.pinned_locale : data.language === "ur" || data.language === "en" ? data.language : (() => { throw new Error("PAYMENT_REMINDER_LOCALE_UNVERIFIED"); })(); }
            catch { await blockReminder("PAYMENT_REMINDER_LOCALE_UNVERIFIED", "SKIPPED"); continue; }
            const templateKey: Record<number,string> = { 15:"REMINDER_15M", 30:"REMINDER_30M", 60:"REMINDER_60M", 210:"FINAL_WARNING_210M", 240:"GRACE_NOTICE_240M" };
            const key = templateKey[Number(payload.stageMinutes)];
            const template = key ? await env.DB.prepare(`SELECT version,body,utility_template_name,utility_approved_at FROM payment_v2_template_versions
              WHERE template_key=? AND locale=? AND state='PUBLISHED' ORDER BY version DESC LIMIT 1`).bind(key, locale).first<{ version:number; body:string; utility_template_name:string|null; utility_approved_at:string|null }>() : null;
            if (!template?.body) { await blockReminder("PAYMENT_REMINDER_CMS_TEMPLATE_NOT_PUBLISHED", "BLOCKED_TEMPLATE"); continue; }
            const serviceWindow = isInsideWhatsAppServiceWindow(current.last_inbound_at);
            if (!serviceWindow && (env.PAYMENT_UTILITY_TEMPLATES_APPROVED !== "true" || !template.utility_template_name || !template.utility_approved_at)) { await blockReminder("PAYMENT_REMINDER_UTILITY_TEMPLATE_NOT_APPROVED", "BLOCKED_TEMPLATE"); continue; }
            const itemRows = await env.DB.prepare("SELECT description,line_total_pkr FROM order_items WHERE order_id=? ORDER BY item_type,product_code").bind(payload.orderId).all<{ description:string; line_total_pkr:number }>();
            const items = (itemRows.results ?? []).map((item) => `${item.description} PKR ${Number(item.line_total_pkr)}`).join("; ") || `order total PKR ${Number(current.total_payable)}`;
            const values: Record<string,string> = { orderNumber: current.order_number, amount: String(current.total_payable), items, delivery: String((await env.DB.prepare("SELECT delivery_fee FROM orders WHERE id=?").bind(payload.orderId).first<{ delivery_fee:number }>())?.delivery_fee ?? 0), codFee: "125", codTotal: String(Number(current.total_payable) + 125) };
            const rendered = template.body.replace(/\{(orderNumber|amount|items|delivery|codFee|codTotal)\}/g, (_match, name: string) => values[name] ?? "");
            const parameters = [...template.body.matchAll(/\{(orderNumber|amount|items|delivery|codFee|codTotal)\}/g)].map((match) => values[match[1]] ?? "");
            const provider = createWhatsAppProvider("meta", { enabled: env.META_PROVIDER_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, verifyToken: env.WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET });
            const send = serviceWindow ? () => Number(payload.stageMinutes) === 240 ? provider.sendInteractive(current.wa_id!, rendered, [{ id:"CONFIRM_COD", title: locale === "ur" ? "COD کی تصدیق" : "Confirm COD" }, { id:"KEEP_ADVANCE", title: locale === "ur" ? "ایڈوانس برقرار" : "Keep Advance" }, { id:"CANCEL_ORDER", title: locale === "ur" ? "آرڈر منسوخ" : "Cancel Order" }]) : provider.sendText(current.wa_id!, rendered) : () => provider.sendTemplate(current.wa_id!, template.utility_template_name!, parameters);
            const delivered = await sendPaymentPart(env.DB, current.wa_id, payload.orderId!, message.body.idempotencyKey, "WHATSAPP_PAYMENT_REMINDER", send);
            if (delivered !== "SENT") throw new Error("PAYMENT_REMINDER_SEND_FAILED");
            const sentAt = new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE payment_reminder_v2_stages SET status='SENT',template_name=?,locale=?,template_version=?,rendered_text=?,sent_at=?,last_error=NULL,updated_at=? WHERE id=? AND status='QUEUED'").bind(template.utility_template_name ?? "SERVICE_WINDOW", locale, template.version, rendered, sentAt, sentAt, payload.stageId),
              env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, sentAt, message.body.idempotencyKey)
            ]);
            message.ack();
            continue;
          } catch (error) {
            const failure = error instanceof Error && /^[A-Z0-9_:-]{1,120}$/.test(error.message) ? error.message : "PAYMENT_REMINDER_SEND_FAILED";
            const failedAt = new Date().toISOString();
            if (nextAttempt >= 5) { await env.DB.batch([env.DB.prepare("UPDATE payment_reminder_v2_stages SET status='DEAD_LETTER',last_error=?,completed_at=?,updated_at=? WHERE idempotency_key=? AND status='QUEUED'").bind(failure, failedAt, failedAt, message.body.idempotencyKey), env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, failedAt, message.body.idempotencyKey)]); message.ack(); continue; }
            const retryAt = new Date(Date.now() + retryDelaySeconds(nextAttempt) * 1000).toISOString();
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,available_at=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, retryAt, failedAt, message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          }
        }
        if (message.body.kind === "WHATSAPP_PAYMENT_INSTRUCTIONS") {
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = outbox ? JSON.parse(outbox.payload_json) as { orderId: string; orderNumber: string; amount: number; method: PaymentMethod; locale: "en" | "ur"; recipient?: string; requestKey?: string; message: string } : undefined;
            if (!payload?.recipient) throw new Error("PAYMENT_RECIPIENT_REQUIRED");
            const recipient = payload.recipient.trim();
            const conversation = await env.DB.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id IN (?,?) ORDER BY CASE WHEN wa_id=? THEN 0 ELSE 1 END LIMIT 1").bind(recipient, recipient.startsWith("+") ? recipient.slice(1) : `+${recipient}`, recipient).first<{ last_inbound_at: string | null }>();
            if (!isInsideWhatsAppServiceWindow(conversation?.last_inbound_at)) {
              const blockedAt = new Date().toISOString();
              await env.DB.batch([
                env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error='WHATSAPP_SERVICE_WINDOW_CLOSED',updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt, blockedAt, message.body.idempotencyKey),
                env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_SERVICE_WINDOW_BLOCKED", "SYSTEM", "ORDER", message.body.entityId, crypto.randomUUID(), JSON.stringify({ reason: "WHATSAPP_SERVICE_WINDOW_CLOSED" }), blockedAt)
              ]);
              message.ack();
              continue;
            }
            const row = await env.DB.prepare("SELECT * FROM payment_methods WHERE method=?").bind(payload.method).first<Record<string, unknown>>();
            if (!row) throw new Error("PAYMENT_METHOD_NOT_CONFIGURED");
            const provider = createWhatsAppProvider("meta", { enabled: env.META_PROVIDER_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, verifyToken: env.WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET });
            const delivery = await deliverPaymentInstructions(env.DB, env.RECEIPTS, provider, payload.recipient, payload.orderId, payload.orderNumber, Number(payload.amount), payload.method, payload.locale ?? "en", payload.message, payload.requestKey ?? message.body.idempotencyKey, normalizePaymentMethodRow(row));
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
        if (message.body.kind === "WHATSAPP_TRANSACTION_REFERENCE_REQUEST") {
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json:string }>();
            const payload = outbox ? JSON.parse(outbox.payload_json) as { paymentId:string;orderId:string;orderNumber:string;waId:string;locale:"en"|"ur";windowMessageId:string } : undefined;
            if (!payload) throw new Error("REFERENCE_REQUEST_PAYLOAD_MISSING");
            const current = await env.DB.prepare("SELECT p.review_state,p.customer_transaction_reference,o.state,o.archived_at,o.total_payable,p.expected_amount,c.wa_id,wc.last_inbound_at,wc.last_inbound_message_id,(SELECT COUNT(*) FROM payment_receipts r WHERE r.payment_id=p.id AND r.order_id=o.id AND r.r2_object_key<>'' AND r.sha256<>'') AS receipt_count FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id WHERE p.id=? AND o.id=? AND c.wa_id=?").bind(payload.paymentId,payload.orderId,payload.waId).first<{review_state:string;customer_transaction_reference:string|null;state:string;archived_at:string|null;total_payable:number;expected_amount:number;wa_id:string;last_inbound_at:string|null;last_inbound_message_id:string|null;receipt_count:number}>();
            if (!current) {
              await env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error='PAYMENT_REFERENCE_CONTEXT_MISSING',updated_at=? WHERE idempotency_key=?").bind(nextAttempt,new Date().toISOString(),message.body.idempotencyKey).run();
              message.ack();
              continue;
            }
            const failure = current.archived_at || current.review_state!=="REVIEW" || current.state!=="PAYMENT_REVIEW" || current.customer_transaction_reference?.trim() || Number(current.receipt_count)<1 || Number(current.total_payable)!==Number(current.expected_amount) ? "PAYMENT_REFERENCE_NO_LONGER_REQUIRED" : !current.last_inbound_message_id || !isInsideWhatsAppServiceWindow(current.last_inbound_at) ? "WHATSAPP_SERVICE_WINDOW_CLOSED" : null;
            if (failure) {
              const now=new Date().toISOString();
              await env.DB.batch([
                env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status IN ('PENDING','RETRY')").bind(nextAttempt,failure,now,message.body.idempotencyKey),
                env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),failure==="WHATSAPP_SERVICE_WINDOW_CLOSED"?"WHATSAPP_SERVICE_WINDOW_BLOCKED":"REFERENCE_REQUEST_SUPPRESSED","SYSTEM","PAYMENT",payload.paymentId,crypto.randomUUID(),JSON.stringify({orderId:payload.orderId,reason:failure}),now)
              ]);
              message.ack();
              continue;
            }
            const provider=createWhatsAppProvider("meta",{enabled:env.META_PROVIDER_ENABLED==="true",graphVersion:env.META_GRAPH_VERSION??"v26.0",accessToken:env.META_ACCESS_TOKEN,phoneNumberId:env.META_PHONE_NUMBER_ID,verifyToken:env.WEBHOOK_VERIFY_TOKEN,appSecret:env.META_APP_SECRET});
            const receipt=await contentFor(env.DB,"RECEIPT","Receipt received for order {orderNumber}. Reply with the transaction/reference ID from your payment app.",{orderNumber:payload.orderNumber},`CHAT:${payload.waId}`,payload.locale);
            const status=await contentFor(env.DB,"ORDER_STATUS","Use Check Order to see your current order and payment status.",{},`CHAT:${payload.waId}`,payload.locale);
            const sent=await sendConversationReply(env.DB,provider,payload.waId,current.last_inbound_message_id!,receipt.text,{buttons:[{id:"CHECK_ORDER",title:whatsAppActionLabel(status,"CHECK_ORDER")}]},message.body.idempotencyKey,{orderId:payload.orderId,kind:"TRANSACTION_REFERENCE_REQUEST"});
            if(sent.sent){await env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,new Date().toISOString(),message.body.idempotencyKey).run();message.ack();continue;}
            const failureRow=await env.DB.prepare("SELECT status,last_error FROM outbound_messages WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{status:string;last_error:string|null}>();
            if(failureRow?.last_error==="WHATSAPP_SERVICE_WINDOW_CLOSED"){await env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failureRow.last_error,new Date().toISOString(),message.body.idempotencyKey).run();message.ack();continue;}
            if(nextAttempt>=5){await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error='REFERENCE_REQUEST_SEND_FAILED',updated_at=? WHERE idempotency_key=?").bind(nextAttempt,new Date().toISOString(),message.body.idempotencyKey).run();message.ack();continue;}
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error='REFERENCE_REQUEST_SEND_FAILED',updated_at=? WHERE idempotency_key=?").bind(nextAttempt,new Date().toISOString(),message.body.idempotencyKey).run();message.retry({delaySeconds:retryDelaySeconds(nextAttempt)});continue;
          } catch(error) {
            const failure=error instanceof Error?error.message.slice(0,120):"REFERENCE_REQUEST_SEND_FAILED";
            if(nextAttempt>=5){await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,new Date().toISOString(),message.body.idempotencyKey).run();message.ack();continue;}
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,new Date().toISOString(),message.body.idempotencyKey).run();message.retry({delaySeconds:retryDelaySeconds(nextAttempt)});continue;
          }
        }
        if (message.body.kind === "WHATSAPP_CLEARER_RECEIPT") {
          const failClosed = async (reason: string, action: string = "REQUEST_CLEARER_RECEIPT_SUPPRESSED") => {
            const failedAt = new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt, reason, failedAt, message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), action, "SYSTEM", "PAYMENT", message.body.entityId, crypto.randomUUID(), JSON.stringify({ reason, stage: "CLEARER_RECEIPT_SEND", idempotencyKey: message.body.idempotencyKey }), failedAt)
            ]);
            message.ack();
          };
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            if (!outbox) { message.ack(); continue; }
            const payload = JSON.parse(outbox.payload_json) as { paymentId?: string; orderId?: string; receiptId?: string; reasonCode?: string };
            if (!payload.paymentId || !payload.orderId || !payload.receiptId || !["TEST_IMAGE_NOT_PAYMENT_PROOF", "INSUFFICIENT_OR_UNCLEAR_RECEIPT"].includes(payload.reasonCode ?? "")) {
              await failClosed("CLEARER_RECEIPT_PAYLOAD_INVALID");
              continue;
            }
            const current = await env.DB.prepare("SELECT p.review_state,o.id AS order_id,o.order_number,o.state,o.archived_at,c.id AS customer_id,c.wa_id,c.normalized_whatsapp_number,c.whatsapp_number,(SELECT COUNT(*) FROM payment_receipts r WHERE r.id=? AND r.payment_id=p.id AND r.order_id=o.id AND r.r2_object_key<>'' AND r.sha256<>'') AS receipt_count FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id WHERE p.id=? AND o.id=?").bind(payload.receiptId, payload.paymentId, payload.orderId).first<{ review_state: string; order_id: string; order_number: string; state: string; archived_at: string | null; customer_id: string; wa_id: string | null; normalized_whatsapp_number: string | null; whatsapp_number: string | null; receipt_count: number }>();
            if (!current || current.archived_at || current.review_state !== "REVIEW" || current.state !== "PAYMENT_REVIEW" || Number(current.receipt_count) !== 1) {
              await failClosed("CLEARER_RECEIPT_NO_LONGER_ELIGIBLE");
              continue;
            }
            const recipientSource = current.wa_id?.trim() || current.normalized_whatsapp_number || current.whatsapp_number || "";
            const recipient = normalizeWhatsAppWaId(recipientSource);
            if (!recipient) {
              await failClosed("CLEARER_RECEIPT_RECIPIENT_UNAVAILABLE");
              continue;
            }
            const conversation = await env.DB.prepare("SELECT state_data,last_inbound_at,last_inbound_message_id FROM whatsapp_conversations WHERE wa_id IN (?,?) ORDER BY CASE WHEN wa_id=? THEN 0 ELSE 1 END LIMIT 1").bind(recipient, `+${recipient}`, recipient).first<{ state_data: string; last_inbound_at: string | null; last_inbound_message_id: string | null }>();
            if (!conversation?.last_inbound_message_id || !isInsideWhatsAppServiceWindow(conversation.last_inbound_at)) {
              await failClosed("WHATSAPP_SERVICE_WINDOW_CLOSED", "WHATSAPP_SERVICE_WINDOW_BLOCKED");
              continue;
            }
            let locale: "en" | "ur" = "en";
            try { locale = JSON.parse(conversation.state_data).language === "ur" ? "ur" : "en"; } catch { /* default to English */ }
            const provider = createWhatsAppProvider("meta", { enabled: env.META_PROVIDER_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, verifyToken: env.WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET });
            const reasonCode = payload.reasonCode as ClearerReceiptReasonCode;
            const sent = await sendConversationReply(env.DB, provider, recipient, conversation.last_inbound_message_id, clearerReceiptText(current.order_number, locale, reasonCode), {}, message.body.idempotencyKey, { orderId: current.order_id, customerId: current.customer_id, kind: "CLEARER_RECEIPT_REQUEST" });
            if (sent.sent) {
              const sentAt = new Date().toISOString();
              await env.DB.batch([
                env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, sentAt, message.body.idempotencyKey),
                env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "REQUEST_CLEARER_RECEIPT_SENT", "SYSTEM", "PAYMENT", payload.paymentId, crypto.randomUUID(), JSON.stringify({ orderId: payload.orderId, receiptId: payload.receiptId, reasonCode, locale }), sentAt)
              ]);
              message.ack();
              continue;
            }
            const failure = await env.DB.prepare("SELECT last_error FROM outbound_messages WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ last_error: string | null }>();
            if (failure?.last_error === "WHATSAPP_SERVICE_WINDOW_CLOSED") {
              await failClosed("WHATSAPP_SERVICE_WINDOW_CLOSED", "WHATSAPP_SERVICE_WINDOW_BLOCKED");
              continue;
            }
            if (nextAttempt >= 5) {
              await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error='CLEARER_RECEIPT_SEND_FAILED',updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey).run();
              message.ack();
              continue;
            }
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error='CLEARER_RECEIPT_SEND_FAILED',updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          } catch (error) {
            const failure = error instanceof Error ? error.message.slice(0, 120) : "CLEARER_RECEIPT_SEND_FAILED";
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
