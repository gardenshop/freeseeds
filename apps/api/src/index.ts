import { Hono } from "hono";
import type { Context } from "hono";
import { applyFertilizerDecision, calculateV2CodPrice, createWhatsAppProvider, customerTransactionReferenceHash, decryptMetaFlowRequest, encryptMetaFlowResponse, formatCustomerOrderStatus, formatPaymentMessage, getLatestOrderForWaId, getPersistedOrderSummary, InteractiveButton, isAllowedInstantFormLead, isInsideWhatsAppServiceWindow, isPaymentMethodComplete, isPaymentMethodLocaleComplete, isTerminalOutboxStatus, logWhatsAppContentMediaError, MetaCapiProvider, MetaFlowEnvelope, normalizeCustomerTransactionReference, normalizePaymentMethodRow, OrderCooldownError, OutboundImage, parseFlowSubmission, parseMetaInstantFormLead, parseV2CodPolicy, PaymentMethod, persistFlowSubmission, persistInboundConversationActivity, persistInstantFormSubmission, persistWebhookRecords, provinceDeliveryListRows, publishedWhatsAppContent, quoteOrder, renderWhatsAppContent, retryDelaySeconds, selectPaymentMethod, selectPublishedWhatsAppContentMedia, storeReceipt, verifyPaymentQrAsset, whatsAppActionLabel, WhatsAppTemplateKey } from "@gfs/core";
import { handleMetaFlowPayload } from "./flow-endpoint";
import { admitWhatsAppSenders } from "./rate-limit";
import { createPaymentV2Schedule, enqueueDuePaymentV2Stages, setPaymentReminderV2OptOut } from "./payment-reminders-v2";

type Env = {
  Bindings: {
    DB: D1Database;
    RECEIPTS: R2Bucket;
    EVENTS: Queue;
    DEPLOYMENT_STATE: string;
    WHATSAPP_PROVIDER: string;
    META_PROVIDER_ENABLED: string;
    PAYMENT_CONFIRMATION_V2_ENABLED?: string;
    PAYMENT_AUTOMATION_V2_ENABLED?: string;
    PAYMENT_REMINDERS_V2_ENABLED?: string;
    PAYMENT_UTILITY_TEMPLATES_APPROVED?: string;
    ORDER_STATUS_NOTIFICATIONS_V2_ENABLED?: string;
    COD_V2_ENABLED?: string;
    COD_POLICY_HMAC_KEY?: string;
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

type CodPreview = { seedPkr:number;fertilizerPkr:number;deliveryFeePkr:number;codFeePkr:number;totalPayablePkr:number;province:string };
type ConversationData = { language?: "en" | "ur"; fullName?: string; deliveryAddress?: string; nearbyPlace?: string; city?: string; contactNumber?: string; province?: string; provinceCorrection?: boolean; fertilizerSelected?: boolean; orderId?: string; orderNumber?: string; amountPkr?: number; codAttempt?:number; codChangedToAdvance?:boolean;codPreview?:CodPreview };

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

type V2OrderStatusName = "PAYMENT_REJECTED" | "REQUEST_CLEARER_RECEIPT" | "ORDER_CONFIRMED" | "PACKING" | "DISPATCHED" | "DELIVERED" | "ORDER_CANCELLED";
function renderV2OrderStatusNotice(eventName: V2OrderStatusName, orderNumber: string, locale: "en" | "ur", trackingNumber?: string | null, simulation = false): string {
  const copy: Record<V2OrderStatusName, { en:string;ur:string }> = {
    PAYMENT_REJECTED:{en:`The receipt for order ${orderNumber} was not sufficient to verify payment. No funds were confirmed. If you have paid, contact Admin before paying again.`,ur:`آرڈر ${orderNumber} کی رسید سے ادائیگی کی تصدیق نہیں ہو سکی۔ کوئی رقم تصدیق شدہ نہیں ہے۔ اگر آپ نے ادائیگی کی ہے تو دوبارہ ادائیگی سے پہلے ایڈمن سے رابطہ کریں۔`},
    REQUEST_CLEARER_RECEIPT:{en:`The image submitted for order ${orderNumber} is not clear payment evidence. If you have paid, please upload a clear genuine receipt for this order. No payment is confirmed.`,ur:`آرڈر ${orderNumber} کے لیے بھیجی گئی تصویر واضح ادائیگی کا ثبوت نہیں ہے۔ اگر آپ نے ادائیگی کی ہے تو براہِ کرم اس آرڈر کی واضح اور اصل رسید اپ لوڈ کریں۔ کوئی ادائیگی تصدیق شدہ نہیں ہے۔`},
    ORDER_CONFIRMED:{en:`Order ${orderNumber} is confirmed. We will notify you when it is packed and dispatched.`,ur:`آرڈر ${orderNumber} کی تصدیق ہو گئی ہے۔ پیک اور روانہ ہونے پر ہم آپ کو اطلاع دیں گے۔`},
    PACKING:{en:`Order ${orderNumber} is being packed.`,ur:`آرڈر ${orderNumber} کی پیکنگ ہو رہی ہے۔`},
    DISPATCHED:{en:`Order ${orderNumber} has been dispatched. Tracking: ${trackingNumber??"pending"}.`,ur:`آرڈر ${orderNumber} روانہ کر دیا گیا ہے۔ ٹریکنگ: ${trackingNumber??"زیرِ عمل"}۔`},
    DELIVERED:{en:`Order ${orderNumber} is marked delivered. Contact support if you have not received it.`,ur:`آرڈر ${orderNumber} ڈیلیور شدہ درج کیا گیا ہے۔ اگر آپ کو موصول نہیں ہوا تو سپورٹ سے رابطہ کریں۔`},
    ORDER_CANCELLED:{en:`Order ${orderNumber} was cancelled. Contact support if you need help.`,ur:`آرڈر ${orderNumber} منسوخ کر دیا گیا ہے۔ مدد کے لیے سپورٹ سے رابطہ کریں۔`}
  };
  const prefix=simulation?(locale==="ur"?"ٹیسٹ: یہ فرضی اسٹیٹس ہے؛ کوئی حقیقی ادائیگی یا کھیپ نہیں۔ ":"TEST ONLY: simulated status; no real payment or shipment. "):"";
  return prefix+copy[eventName][locale];
}

function parseV2OrderStatusPayload(value:string):{orderId:string;orderNumber:string;noticeName:V2OrderStatusName;paymentId?:string;to?:string;trackingNumber?:string|null;reasonCode?:string;simulation?:boolean}|null{
  try{const d=JSON.parse(value) as Record<string,unknown>;const names:V2OrderStatusName[]=["PAYMENT_REJECTED","REQUEST_CLEARER_RECEIPT","ORDER_CONFIRMED","PACKING","DISPATCHED","DELIVERED","ORDER_CANCELLED"];if(typeof d.orderId!=="string"||typeof d.orderNumber!=="string"||typeof d.noticeName!=="string"||!names.includes(d.noticeName as V2OrderStatusName))return null;return{orderId:d.orderId,orderNumber:d.orderNumber,noticeName:d.noticeName as V2OrderStatusName,paymentId:typeof d.paymentId==="string"?d.paymentId:undefined,to:typeof d.to==="string"?d.to:undefined,trackingNumber:typeof d.trackingNumber==="string"?d.trackingNumber:null,reasonCode:typeof d.reasonCode==="string"?d.reasonCode:undefined,simulation:d.simulation===true};}catch{return null;}
}

function parseV2StatusPayload(value: string): { orderId:string;orderNumber:string;noticeName:V2OrderStatusName;expectedState?:string;from?:string;trackingNumber?:string|null;paymentId?:string;receiptId?:string;reasonCode?:string;simulation?:boolean } | null {
  try {
    const d=JSON.parse(value) as Record<string,unknown>;
    const names:V2OrderStatusName[]=["PAYMENT_REJECTED","REQUEST_CLEARER_RECEIPT","ORDER_CONFIRMED","PACKING","DISPATCHED","DELIVERED","ORDER_CANCELLED"];
    if(typeof d.orderId!=="string"||typeof d.orderNumber!=="string"||typeof d.noticeName!=="string"||!names.includes(d.noticeName as V2OrderStatusName))return null;
    return {orderId:d.orderId,orderNumber:d.orderNumber,noticeName:d.noticeName as V2OrderStatusName,expectedState:typeof d.to==="string"?d.to:typeof d.expectedState==="string"?d.expectedState:undefined,from:typeof d.from==="string"?d.from:undefined,trackingNumber:typeof d.trackingNumber==="string"?d.trackingNumber:null,paymentId:typeof d.paymentId==="string"?d.paymentId:undefined,receiptId:typeof d.receiptId==="string"?d.receiptId:undefined,reasonCode:typeof d.reasonCode==="string"?d.reasonCode:undefined,simulation:d.simulation===true};
  } catch { return null; }
}

async function contentFor(db: D1Database, key: WhatsAppTemplateKey, fallback: string, values: { orderNumber?: string; amount?: string | number; totalPkr?: string | number; province?: string; paymentMethod?: string; recipientName?: string; tillId?: string } = {}, _sessionKey?: string, locale: "en" | "ur" = "en") {
  const content = await publishedWhatsAppContent(db, key, locale);
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

async function loadV2CodPolicy(db:D1Database,environment:string){
  const row=await db.prepare("SELECT value,updated_by,updated_at FROM configuration WHERE key='COD_V2_POLICY' AND environment=?").bind(environment).first<{value:string|null;updated_by:string|null;updated_at:string|null}>();
  if(!row?.value||!row.updated_by||!row.updated_at)return null;
  const provenance=await db.prepare("SELECT 1 AS valid FROM audit_log WHERE action='COD_POLICY_UPDATED' AND entity_type='SYSTEM_CONFIG' AND entity_id='COD_V2_POLICY' AND actor_id=? AND created_at>=? LIMIT 1").bind(row.updated_by,row.updated_at).first();
  return provenance?parseV2CodPolicy(row.value):null;
}
function codPolicyReady(policy:ReturnType<typeof parseV2CodPolicy>,featureFlag:boolean,hmacKey:string|undefined){
  return Boolean(policy&&featureFlag&&policy.enabled&&policy.courierProvider.trim()&&policy.collectionSupported&&policy.remittanceSupported&&policy.verificationReferenceHash&&hmacKey&&hmacKey.length>=32);
}

function normalizedLocation(value:string|undefined){return value?.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g," ").trim()??"";}

function knownProvinceForCity(city:string|undefined):string|undefined{
  const cityProvince:Record<string,string>={lahore:"Punjab",rawalpindi:"Punjab",karachi:"Sindh",quetta:"Balochistan",peshawar:"KPK",islamabad:"Islamabad",muzaffarabad:"AJK",gilgit:"Gilgit Baltistan",skardu:"Gilgit Baltistan"};
  return cityProvince[normalizedLocation(city)];
}

function priceBreakdown(locale:"en"|"ur",seedPkr:number,fertilizerPkr:number,deliveryPkr:number,totalPkr:number,province?:string,codFeePkr?:number){
  const lines=locale==="ur"
    ? [`بیج: PKR ${seedPkr}`,`کھاد: PKR ${fertilizerPkr}`,`ڈیلیوری${province?` (${province})`:""}: PKR ${deliveryPkr}`]
    : [`Seeds: PKR ${seedPkr}`,`Fertilizer: PKR ${fertilizerPkr}`,`Delivery${province?` (${province})`:""}: PKR ${deliveryPkr}`];
  if(codFeePkr!==undefined)lines.push(`${locale==="ur"?"COD فیس":"COD fee"}: PKR ${codFeePkr}`);
  lines.push(`${locale==="ur"?"کل":"TOTAL"}: PKR ${totalPkr}`);
  return lines.join("\n");
}

type EligibleCodOrder={id:string;orderNumber:string;paymentId:string;advanceTotalPkr:number;attempt:number;preview:CodPreview};
async function eligibleCodOrder(db:D1Database,orderId:string,waId:string,eligibleProvinces:string[],codFeePkr:number):Promise<EligibleCodOrder|null>{
  const current=await db.prepare(`SELECT o.id,o.order_number,o.state,o.payment_status,o.seed_price,o.fertilizer_fee,o.delivery_fee,o.total_payable,o.province,pr.delivery_fee_pkr AS current_delivery_fee,p.id AS payment_id,p.review_state,p.customer_transaction_reference,
      EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS has_receipt,
      (SELECT COALESCE(MAX(cd.attempt),0)+1 FROM cod_order_details cd WHERE cd.order_id=o.id) AS next_attempt
    FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id JOIN province_delivery_rates pr ON pr.province=o.province COLLATE NOCASE AND pr.enabled=1
    WHERE o.id=? AND c.wa_id=?`).bind(orderId,waId).first<{id:string;order_number:string;state:string;payment_status:string;seed_price:number;fertilizer_fee:number;delivery_fee:number;current_delivery_fee:number;total_payable:number;province:string|null;payment_id:string;review_state:string;customer_transaction_reference:string|null;has_receipt:number;next_attempt:number}>();
  if(!current||!current.province||current.has_receipt||current.customer_transaction_reference||!["DETAILS_COMPLETED","PAYMENT_PENDING"].includes(current.state)||!["PENDING","REJECTED"].includes(current.review_state)||current.payment_status==="PAID")return null;
  if(Number(current.seed_price)+Number(current.fertilizer_fee)+Number(current.delivery_fee)!==Number(current.total_payable)||Number(current.current_delivery_fee)!==Number(current.delivery_fee)||!eligibleProvinces.some((province)=>normalizedLocation(province)===normalizedLocation(current.province!)))return null;
  const totals=calculateV2CodPrice(Number(current.seed_price),Number(current.fertilizer_fee),Number(current.current_delivery_fee),codFeePkr);
  return{id:current.id,orderNumber:current.order_number,paymentId:current.payment_id,advanceTotalPkr:Number(current.total_payable),attempt:Number(current.next_attempt),preview:{seedPkr:totals.seedPkr,fertilizerPkr:totals.fertilizerPkr,deliveryFeePkr:totals.deliveryFeePkr,codFeePkr:totals.codFeePkr,totalPayablePkr:totals.totalPayablePkr,province:current.province}};
}

function sameCodPreview(left:CodPreview|undefined,right:CodPreview){return Boolean(left&&left.seedPkr===right.seedPkr&&left.fertilizerPkr===right.fertilizerPkr&&left.deliveryFeePkr===right.deliveryFeePkr&&left.codFeePkr===right.codFeePkr&&left.totalPayablePkr===right.totalPayablePkr&&normalizedLocation(left.province)===normalizedLocation(right.province));}

function offerCopyDeniesCod(text:string){
  return /(?:\b(?:COD|cash\s+on\s+delivery)\b.{0,60}\b(?:not\s+available|unavailable|disabled)\b)|(?:\b(?:not\s+available|unavailable|disabled)\b.{0,60}\b(?:COD|cash\s+on\s+delivery)\b)/i.test(text)||/(?:COD|کیش\s*آن\s*ڈیلیوری).{0,40}دستیاب\s*نہیں/i.test(text);
}
function offerCopyContradictsCod(text:string,codReady:boolean){
  const mentionsCod=/\b(?:COD|cash\s+on\s+delivery)\b/i.test(text)||/(?:COD|کیش\s*آن\s*ڈیلیوری)/i.test(text);
  const deniesCod=offerCopyDeniesCod(text);
  return codReady?deniesCod:mentionsCod&&!deniesCod;
}

async function offerForCodAvailability(db:D1Database,locale:"en"|"ur",codReady:boolean){
  const published=await publishedWhatsAppContent(db,"OFFER",locale);
  if(published&&!offerCopyContradictsCod(published.text,codReady))return{content:published,mediaAllowed:!offerCopyDeniesCod(published.text)};
  const text=codReady
    ? locale==="ur"?"اپنے آرڈر کو جاری رکھیں۔ ادائیگی کے مرحلے پر، اہل صوبوں میں پیشگی ادائیگی اور کیش آن ڈیلیوری کے آپشن دکھائے جائیں گے۔":"Continue your order. At payment, advance payment and Cash on Delivery options will appear in eligible provinces."
    : LOCALE_FALLBACKS.OFFER![locale];
  return{content:{text},mediaAllowed:false};
}

async function hasTable(db:D1Database,name:string){return Boolean(await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").bind(name).first());}

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
  if (state === "CONTACT") return /^\+?\d{7,20}$/.test(value.replace(/[\s().-]/g, ""));
  return true;
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

export function isSuccessfulPaymentDelivery(status: string, providerMessageId: string | null): boolean {
  return Boolean(providerMessageId) || ["SENT", "DELIVERED", "READ"].includes(status);
}

async function completedPaymentPartStatus(db: D1Database, key: string): Promise<PaymentPartStatus | undefined> {
  const row = await db.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?")
    .bind(key).first<{ status: string; provider_message_id: string | null }>();
  if (!row) return undefined;
  if (row.status === "SKIPPED") return "SKIPPED";
  return isSuccessfulPaymentDelivery(row.status, row.provider_message_id) ? "SENT" : undefined;
}

async function sendPaymentPart(db: D1Database, to: string, orderId: string, key: string, kind: string, send: () => Promise<{ providerMessageId: string }>): Promise<PaymentPartStatus> {
  const existing = await db.prepare("SELECT id,status,provider_message_id,updated_at FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null; updated_at?: string }>();
  if (existing?.status === "SKIPPED") return "SKIPPED";
  if (existing && isSuccessfulPaymentDelivery(existing.status, existing.provider_message_id)) return "SENT";
  const now = new Date().toISOString();
  if (!existing) await db.prepare("INSERT OR IGNORE INTO outbound_messages (id,idempotency_key,order_id,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, orderId, kind, "PENDING", 0, now, now).run();
  const row = await db.prepare("SELECT id,status,provider_message_id,updated_at FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ id: string; status: string; provider_message_id: string | null; updated_at?: string }>();
  const staleSending = row?.status === "SENDING" && row.updated_at && Date.now() - Date.parse(row.updated_at) > 5 * 60 * 1000;
  if (!row || (!staleSending && !["PENDING", "FAILED", "RETRY"].includes(row.status))) return row && isSuccessfulPaymentDelivery(row.status, row.provider_message_id) ? "SENT" : "FAILED";
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

async function deliverPaymentInstructions(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, to: string, orderId: string, orderNumber: string, amount: number, method: PaymentMethod, locale: "en" | "ur", message: string, requestKey: string, config: ReturnType<typeof normalizePaymentMethodRow>, allowPaymentGrace = false): Promise<PaymentDeliveryResult> {
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
  const orderStillPending = (order?.state === "PAYMENT_PENDING" || (allowPaymentGrace && order?.state === "PAYMENT_GRACE")) && order.payment_status === "PENDING" && order.selected_method === method && String(order.order_number) === orderNumber && Number(order.total_payable) === amount;
  const sameSettings = currentConfig && currentConfig.method === config.method && currentConfig.qrR2Key === config.qrR2Key && currentConfig.qrSha256 === config.qrSha256 && currentConfig.recipientName === config.recipientName && currentConfig.tillId === config.tillId;
  if (!orderStillPending || !currentConfig?.qrOwnerVerified || !sameSettings || currentMessage !== message) {
    await markPaymentPartSkipped(db, orderId, textKey, "WHATSAPP_PAYMENT_TEXT", "PAYMENT_METHOD_NO_LONGER_ELIGIBLE");
    await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", "PAYMENT_METHOD_NO_LONGER_ELIGIBLE");
    return { textSent: false, qrStatus: "SKIPPED" };
  }
  const textStatus = await sendPaymentPart(db, to, orderId, textKey, "WHATSAPP_PAYMENT_TEXT", () => provider.sendText(to, currentMessage));
  let qrStatus: PaymentPartStatus;
  if (!currentConfig.qrR2Key) {
    qrStatus = await markPaymentPartSkipped(db, orderId, qrKey, "WHATSAPP_PAYMENT_QR", "PAYMENT_QR_NOT_CONFIGURED");
  } else {
    const completedQrStatus = await completedPaymentPartStatus(db, qrKey);
    if (completedQrStatus) {
      qrStatus = completedQrStatus;
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
  }
  await db.prepare("UPDATE outbox_jobs SET status=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(textStatus === "SENT" && qrStatus !== "FAILED" ? "SENT" : "RETRY", qrStatus === "FAILED" ? "PAYMENT_QR_DELIVERY_BLOCKED" : null, new Date().toISOString(), `payment_instructions_${orderId}_${method}_${locale}`).run();
  return { textSent: textStatus === "SENT", qrStatus };
}

async function processGuidedConversation(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }, flowId: string, flowTokenSecret?: string, checkoutMode: string = "guided", events?: Queue, paymentReminderV2Enabled = false, paymentAutomationV2Enabled = false, codV2Enabled = false,codPolicyHmacKey?:string): Promise<boolean> {
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
  const row = await db.prepare("SELECT state,state_data,last_inbound_message_id FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string;last_inbound_message_id:string|null }>();
  const state = row?.state ?? "NEW";
  if (/^[12]$/.test(normalized)) {
    if (state === "LANGUAGE") normalized = normalized === "1" ? "LANG_UR" : "LANG_EN";
    else if (state === "FERTILIZER") normalized = normalized === "1" ? "ADD_FERTILIZER" : "SEEDS_ONLY";
    else if (state === "REVIEW") normalized = normalized === "1" ? "PLACE_ORDER" : "BACK";
  }
  const originalStateData = row?.state_data ?? "{}";
  let data: ConversationData = {};
  try { data = row?.state_data ? JSON.parse(row.state_data) as ConversationData : {}; } catch { data = {}; }
  const codPolicy=codV2Enabled?await loadV2CodPolicy(db,"V2_ISOLATED_STAGING"):null;
  const enabledProvinces = (await db.prepare("SELECT province,delivery_fee_pkr FROM province_delivery_rates WHERE enabled=1 ORDER BY province").all<{ province: string; delivery_fee_pkr: number }>()).results ?? [];
  const policyReady=codPolicyReady(codPolicy,codV2Enabled,codPolicyHmacKey);
  const codApproved=Boolean(policyReady&&codPolicy&&enabledProvinces.some((row)=>codPolicy.eligibleProvinces.some((province)=>normalizedLocation(province)===normalizedLocation(row.province))));
  let codSelectable=Boolean(codApproved&&codPolicy&&data.province&&enabledProvinces.some((row)=>normalizedLocation(row.province)===normalizedLocation(data.province)&&codPolicy.eligibleProvinces.some((province)=>normalizedLocation(province)===normalizedLocation(row.province))));
  const completePaymentMethods=await completeEnabledPaymentMethods(db,data.language??"en");
  const advanceSelectable=completePaymentMethods.length>0;
  const offerLocale=normalized==="LANG_UR"?"ur":normalized==="LANG_EN"?"en":data.language??"en";
  const presentingOffer=(state==="NEW"&&normalized==="GET_FREE_PACKS")||(state==="LANGUAGE"&&/^(LANG_EN|LANG_UR)$/.test(normalized));
  const offerPresentation=presentingOffer?await offerForCodAvailability(db,offerLocale,codApproved):{content:{text:LOCALE_FALLBACKS.OFFER![offerLocale]},mediaAllowed:false};
  if(paymentReminderV2Enabled&&paymentAutomationV2Enabled&&/^(STOP|UNSUBSCRIBE|STOP_REMINDERS|STOP_PAYMENT_REMINDERS|NO_MORE_REMINDERS)$/.test(normalized)){
    const customer=await db.prepare("SELECT id FROM customers WHERE wa_id=?").bind(event.from).first<{id:string}>();
    await setPaymentReminderV2OptOut(db,customer?.id??null,event.from,new Date());
    const reply=data.language==="ur"?"آپ کو ادائیگی کی یاد دہانیوں سے ہٹا دیا گیا ہے۔ آپ رسید بھیج سکتے ہیں یا آرڈر کی ضروری سروس معلومات حاصل کر سکتے ہیں۔":"You are opted out of payment reminders. You can still send a receipt and receive essential order-service information.";
    await sendConversationReply(db,provider,event.from,event.id,reply);
    return true;
  }
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
    || (state === "REVIEW" && /^(CONFIRM|PLACE_ORDER|BACK)$/.test(normalized))
    || (state === "PAYMENT_CHOICE" && normalized === "PAY_ADVANCE" && advanceSelectable && Boolean(data.orderId))
    || (state === "PAYMENT_CHOICE" && normalized === "PAY_COD" && codSelectable && Boolean(data.orderId))
    || (state === "COD_FEE_WARNING" && /^(COD_CONFIRM|COD_ADVANCE_PAYMENT)$/.test(normalized))
    || (state === "COD_ORDER_REVIEW" && /^(COD_CONFIRM_ORDER|COD_BACK_TO_PAYMENT)$/.test(normalized))
    || (state === "COD_PENDING_CONFIRMATION" && /^(COD_CONFIRM|COD_CHANGE_PAYMENT|COD_CANCEL)$/.test(normalized))
    || (["PAYMENT_METHOD", "PAYMENT_PENDING", ...(state === "PAYMENT_GRACE" && paymentReminderV2Enabled && paymentAutomationV2Enabled ? ["PAYMENT_GRACE"] : [])].includes(state) && Boolean(paymentMethodFromAction(normalized)));
  const semanticAction = /^(START|GET_FREE_PACKS|LANG_.*|PAY_.*|PAYMENT_HELP|PROVINCE_.*|ADD_FERTILIZER|SEEDS_ONLY|PLACE_ORDER|CONFIRM|BACK|CONTINUE_ORDER|CANCEL_ORDER|COD_.*|FLOW_SUBMIT)$/.test(normalized) || Boolean(paymentMethodFromAction(normalized));
  const invalidAction = Boolean(message.interactive || message.button || semanticAction) && !actionAllowed;
  let paymentSelection: { orderId: string; orderNumber: string; amount: number; method: PaymentMethod; locale: "en" | "ur"; message: string; idempotencyKey: string; config: ReturnType<typeof normalizePaymentMethodRow>; allowPaymentGrace:boolean } | undefined;
  let conversationClaimed=false;
  if (invalidAction) { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; }
  else if (normalized === "CANCEL") { nextState = "CANCELLED"; data = { language: data.language }; reply = data.language === "ur" ? "یہ غیر جمع شدہ آرڈر منسوخ کر دیا گیا ہے۔ کوئی آرڈر یا ادائیگی نہیں بنائی گئی۔ دوبارہ شروع کرنے کے لیے START لکھیں۔" : "This unsubmitted order entry is cancelled. No order or payment was created. Reply START to begin again."; }
  else if (normalized === "BACK" && state === "REVIEW") { nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; }
  else if (/^(STATUS|CHECK_ORDER)$/i.test(normalized)) { const locale = data.language ?? "en"; const order = await getLatestOrderForWaId(db, event.from, data.orderId); const status = await sessionContent("ORDER_STATUS", "Use Check Order to see the current order and payment status."); const paymentStatusCopy = order ? await paymentCopyForOrder(db, order.id, "status_copy", locale) : undefined; reply = order ? `${paymentStatusCopy ?? status.text}\n${formatCustomerOrderStatus(order, locale)}` : locale === "ur" ? "اس واٹس ایپ گفتگو کے لیے کوئی آرڈر نہیں ملا۔" : "No order was found for this WhatsApp conversation."; }
  else if (/^(HELP|SUPPORT)$/i.test(normalized)) { reply = (await sessionContent("SUPPORT", "Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry.")).text; }
  else if ((state === "NEW" && normalized === "GET_FREE_PACKS")) { nextState = "OFFER"; reply = offerPresentation.content.text; }
  else if (state === "CANCELLED" && normalized === "START") { nextState = "LANGUAGE"; data = {}; const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "NEW" && (normalized === "START" || Boolean(text))) { nextState = "LANGUAGE"; const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "LANGUAGE" && (normalized === "LANG_EN" || normalized === "LANG_UR")) { data.language = normalized === "LANG_UR" ? "ur" : "en"; nextState = "OFFER"; reply=offerPresentation.content.text; }
  else if (state === "LANGUAGE") { const [welcomeUr, welcomeEn] = await Promise.all([contentFor(db, "WELCOME", "گٹ فری سیڈز میں خوش آمدید!", {}, `CHAT:${event.from}`, "ur"), contentFor(db, "WELCOME", "Welcome to Get Free Seeds!", {}, `CHAT:${event.from}`, "en")]); reply = `${welcomeUr.text}\n\n${welcomeEn.text}`; }
  else if (state === "OFFER" && normalized === "CONTINUE_ORDER") { nextState = checkoutMode === "guided" ? "FERTILIZER" : "FLOW_ACTIVE"; reply = (await sessionContent("FERTILIZER", "Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?")).text; }
  else if (state === "OFFER" && normalized === "CANCEL_ORDER") { nextState = "CANCELLED"; data = { language: data.language }; reply = data.language === "ur" ? "یہ غیر جمع شدہ آرڈر منسوخ کر دیا گیا ہے۔ کوئی آرڈر یا ادائیگی نہیں بنائی گئی۔ دوبارہ شروع کرنے کے لیے START لکھیں۔" : "This unsubmitted order entry is cancelled. No order or payment was created. Reply START to begin again."; }
  else if (state === "FULL_NAME") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid full name.")).text; else { data.fullName = text; nextState = "ADDRESS"; reply = (await sessionContent("FIELD_DELIVERY_ADDRESS", "Please reply with your complete delivery address.")).text; } }
  else if (state === "ADDRESS") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a complete delivery address.")).text; else { data.deliveryAddress = text; nextState = "NEARBY"; reply = (await sessionContent("FIELD_NEARBY_PLACE", "Please reply with a nearby famous place.")).text; } }
  else if (state === "NEARBY") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a nearby famous place.")).text; else { data.nearbyPlace = text; nextState = "CITY"; reply = (await sessionContent("FIELD_CITY", "Please reply with your city.")).text; } }
  else if (state === "CITY") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid city.")).text; else { data.city = text; nextState = "CONTACT"; reply = (await sessionContent("FIELD_CONTACT_NUMBER", "Please reply with your contact number.")).text; } }
  else if (state === "CONTACT") { if (!guidedFieldIsValid(state, text)) reply = (await sessionContent("VALIDATION", "Please enter a valid contact number.")).text; else { data.contactNumber = text; nextState = "REVIEW"; const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province ?? "", fertilizerSelected: data.fertilizerSelected ?? false }); const review = await sessionContent("REVIEW", "Review your order. Tap Place Order to confirm."); const seedPkr=quote.items.find((item)=>item.type==="PRODUCT")?.lineTotalPkr??0,fertilizerPkr=quote.items.find((item)=>item.type==="FERTILIZER")?.lineTotalPkr??0;reply = `${priceBreakdown(data.language??"en",seedPkr,fertilizerPkr,quote.deliveryFeePkr,quote.totalPayablePkr,quote.province)}\n${review.text}`; } }
  else if (state === "PRODUCT") { if (!/^(YES|SEEDS_ONLY|ADD_FERTILIZER)$/i.test(normalized)) { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } else { data.fertilizerSelected = normalized === "ADD_FERTILIZER"; nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "PROVINCE") { const provinceChoice = normalized.startsWith("PROVINCE_") ? normalized.slice(9).replace(/_/g, " ") : text; try { const quote = await quoteOrder(db, { productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: provinceChoice, fertilizerSelected: data.fertilizerSelected ?? false }); const expectedProvince=data.provinceCorrection?knownProvinceForCity(data.city):undefined;if(expectedProvince&&normalizedLocation(expectedProvince)!==normalizedLocation(quote.province)){nextState="PROVINCE";reply=data.language==="ur"?`${data.city} شہر ${expectedProvince} میں ہے۔ براہ کرم درست صوبہ منتخب کریں؛ آپ کا پتہ تبدیل نہیں کیا گیا۔`:`${data.city} is in ${expectedProvince}. Choose the correct province; your address was not changed.`;}else{data.province = quote.province;if(data.provinceCorrection&&data.fullName&&data.deliveryAddress&&data.nearbyPlace&&data.city&&data.contactNumber){delete data.provinceCorrection;nextState="REVIEW";const review=await sessionContent("REVIEW","Review your order. Tap Place Order to confirm.");const seedPkr=quote.items.find((item)=>item.type==="PRODUCT")?.lineTotalPkr??0,fertilizerPkr=quote.items.find((item)=>item.type==="FERTILIZER")?.lineTotalPkr??0;reply=`${priceBreakdown(data.language??"en",seedPkr,fertilizerPkr,quote.deliveryFeePkr,quote.totalPayablePkr,quote.province)}\n${review.text}`;}else{nextState = "FULL_NAME"; reply = (await sessionContent("FIELD_FULL_NAME", "Please reply with your full name.")).text;}} } catch { reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; } }
  else if (state === "FERTILIZER") { if (!/^(YES|NO|ADD_FERTILIZER|SEEDS_ONLY)$/i.test(normalized)) reply = (await sessionContent("VALIDATION", "Please choose one of the listed options.")).text; else { data.fertilizerSelected = /^(YES|ADD_FERTILIZER)$/i.test(normalized); nextState = "PROVINCE"; reply = (await sessionContent("PROVINCE_DELIVERY", "Choose your province for delivery.")).text; } }
  else if (state === "REVIEW") {
    if (!/^(CONFIRM|PLACE_ORDER)$/i.test(normalized)) reply = (await sessionContent("REVIEW", "Review your order. Tap Place Order to confirm.")).text;
    else if (!data.fullName || !data.deliveryAddress || !data.nearbyPlace || !data.city || !data.contactNumber || !data.province) {
      nextState = "FULL_NAME"; data = { language: data.language };
      reply = (await sessionContent("FIELD_FULL_NAME", "I need to restart safely. Please reply with your full name.")).text;
    } else if(knownProvinceForCity(data.city)&&normalizedLocation(knownProvinceForCity(data.city))!==normalizedLocation(data.province)){
      const expectedProvince=knownProvinceForCity(data.city)!;
      data.provinceCorrection=true;nextState="PROVINCE";
      reply=data.language==="ur"?`${data.city} شہر ${expectedProvince} میں ہے، لیکن آپ نے ${data.province} منتخب کیا۔ درست صوبہ منتخب کریں؛ آپ کا پتہ خودکار طور پر تبدیل نہیں کیا گیا۔`:`${data.city} is in ${expectedProvince}, but ${data.province} was selected. Choose the correct province; your address was not changed.`;
    } else {
      const submission = { fullName: data.fullName, deliveryAddress: data.deliveryAddress, nearbyPlace: data.nearbyPlace, city: data.city, contactNumber: data.contactNumber, productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: data.province, fertilizerSelected: data.fertilizerSelected ?? false, whatsappNumber: event.from };
      try {
         const result = await persistFlowSubmission(db, submission, undefined, `WHATSAPP:${event.id}`, event.from, false);
        data.orderId = result.orderId; data.orderNumber = result.orderNumber;
        const summary = result.quote ?? await getPersistedOrderSummary(db, result.orderId);
        data.amountPkr = summary.totalPayablePkr;
        nextState = codSelectable ? "PAYMENT_CHOICE" : "PAYMENT_METHOD";
        reply = (await sessionContent("CONFIRMATION", "Order {orderNumber} created. Total: PKR {totalPkr}.", { orderNumber: result.orderNumber, totalPkr: summary.totalPayablePkr })).text;
      } catch (error) {
        if (!(error instanceof OrderCooldownError)) throw error;
        nextState = "PAYMENT_PENDING"; data.orderNumber = error.orderNumber;
        const nextDate = new Date(error.nextEligibleAt).toLocaleDateString(data.language === "ur" ? "ur-PK" : "en-PK", { timeZone: "Asia/Karachi" });
        reply = data.language === "ur" ? `آپ کا آرڈر ${error.orderNumber} پہلے سے موجود ہے۔ نیا آرڈر ${nextDate} کو دے سکتے ہیں۔` : `You already have order ${error.orderNumber}. You can request another order on ${nextDate}.`;
      }
    }
  }
  else if(state==="PAYMENT_CHOICE"&&normalized==="PAY_ADVANCE"&&advanceSelectable){
    nextState="PAYMENT_METHOD";delete data.codPreview;
    reply=data.language==="ur"?"تصدیق شدہ پیشگی ادائیگی کا طریقہ منتخب کریں۔":"Choose a verified advance payment method.";
  }
  else if(state==="PAYMENT_CHOICE"&&normalized==="PAY_COD"&&codSelectable&&codPolicy&&data.orderId){
    const current=await eligibleCodOrder(db,data.orderId,event.from,codPolicy.eligibleProvinces,codPolicy.feePkr);
    if(!current){
      codSelectable=false;reply=data.language==="ur"?"یہ آرڈر COD کے لیے اہل نہیں ہے۔ کوئی COD فیس یا ادائیگی ریکارڈ نہیں کی گئی۔":"This order is not eligible for COD. No COD fee or payment was recorded.";
    }else{
      data.codPreview=current.preview;nextState="COD_ORDER_REVIEW";
      const breakdown=priceBreakdown(data.language??"en",current.preview.seedPkr,current.preview.fertilizerPkr,current.preview.deliveryFeePkr,current.preview.totalPayablePkr,current.preview.province,current.preview.codFeePkr);
      reply=data.language==="ur"
        ?`COD آرڈر ${current.orderNumber} کا خلاصہ:\n${breakdown}`
        :`COD order ${current.orderNumber} summary:\n${breakdown}`;
    }
  }
  else if(state==="COD_FEE_WARNING"&&normalized==="COD_ADVANCE_PAYMENT"&&advanceSelectable){
    nextState="PAYMENT_METHOD";data.codChangedToAdvance=true;delete data.codPreview;
    reply=data.language==="ur"?"تصدیق شدہ پیشگی ادائیگی کا طریقہ منتخب کریں۔":"Choose a verified advance payment method.";
  }
  else if(state==="COD_FEE_WARNING"&&normalized==="COD_CONFIRM"&&codSelectable&&codPolicy&&data.orderId){
    const current=await eligibleCodOrder(db,data.orderId,event.from,codPolicy.eligibleProvinces,codPolicy.feePkr);
    if(!current){reply=data.language==="ur"?"COD قیمت کی تصدیق نہیں ہو سکی۔ کوئی COD فیس یا ادائیگی ریکارڈ نہیں کی گئی۔":"The COD quote could not be verified. No COD fee or payment was recorded.";}
    else{
      data.codPreview=current.preview;nextState="COD_ORDER_REVIEW";
      const breakdown=priceBreakdown(data.language??"en",current.preview.seedPkr,current.preview.fertilizerPkr,current.preview.deliveryFeePkr,current.preview.totalPayablePkr,current.preview.province,current.preview.codFeePkr);
      reply=data.language==="ur"?`COD آرڈر ${current.orderNumber} کا خلاصہ:\n${breakdown}\nآرڈر مکمل کرنے سے پہلے رقم چیک کریں۔`:`COD order ${current.orderNumber} summary:\n${breakdown}\nReview the amount before confirming the order.`;
    }
  }
  else if(state==="COD_ORDER_REVIEW"&&normalized==="COD_BACK_TO_PAYMENT"){
    delete data.codPreview;data.codChangedToAdvance=true;nextState="PAYMENT_METHOD";
    reply=data.language==="ur"?"پیشگی ادائیگی کا تصدیق شدہ طریقہ منتخب کریں۔ COD فیس لاگو نہیں ہوگی۔":"Choose a verified advance payment method. The COD fee will not apply.";
  }
  else if(state==="COD_ORDER_REVIEW"&&normalized==="COD_CONFIRM_ORDER"&&codSelectable&&codPolicy&&data.orderId){
    const current=await eligibleCodOrder(db,data.orderId,event.from,codPolicy.eligibleProvinces,codPolicy.feePkr);
    if(!current){
      const finalized=await db.prepare("SELECT cd.status,cd.total_payable_pkr,o.state,o.order_number FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN customers c ON c.id=o.customer_id WHERE cd.order_id=? AND c.wa_id=? AND cd.status IN ('COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED') ORDER BY cd.attempt DESC LIMIT 1").bind(data.orderId,event.from).first<{status:string;total_payable_pkr:number;state:string;order_number:string}>();
      if(finalized){nextState="COD_PENDING";data.amountPkr=Number(finalized.total_payable_pkr);reply=data.language==="ur"?`COD آرڈر ${finalized.order_number} پہلے ہی تصدیق شدہ ہے۔ کوئی دوسری فیس یا آرڈر نہیں بنایا گیا۔`:`COD order ${finalized.order_number} is already confirmed. No second fee or order was created.`;}
      else reply=data.language==="ur"?"COD آرڈر کی تصدیق نہیں ہوئی۔ کوئی COD فیس یا ادائیگی ریکارڈ نہیں کی گئی۔":"The COD order was not confirmed. No COD fee or payment was recorded.";
    }else if(!sameCodPreview(data.codPreview,current.preview)){
      data.codPreview=current.preview;
      const breakdown=priceBreakdown(data.language??"en",current.preview.seedPkr,current.preview.fertilizerPkr,current.preview.deliveryFeePkr,current.preview.totalPayablePkr,current.preview.province,current.preview.codFeePkr);
      reply=data.language==="ur"?`COD رقم تبدیل ہو گئی ہے۔ تازہ خلاصہ دوبارہ چیک کریں:\n${breakdown}`:`The COD amount changed. Review the refreshed summary before confirming again:\n${breakdown}`;
    }else{
      const now=new Date().toISOString(),detailId=`cod:${current.id}:${current.attempt}`;
      const results=await db.batch([
        db.prepare("UPDATE whatsapp_conversations SET state='COD_FINALIZING',last_inbound_message_id=?,updated_at=? WHERE wa_id=? AND state=? AND state_data=? AND last_inbound_message_id IS ?").bind(event.id,now,event.from,state,originalStateData,row?.last_inbound_message_id??null),
        db.prepare(`INSERT OR IGNORE INTO cod_order_details(id,order_id,attempt,seed_total_pkr,fertilizer_total_pkr,delivery_fee_pkr,cod_fee_pkr,total_payable_pkr,status,created_at,updated_at)
          SELECT ?,o.id,?,?,?,?,?,?,'COD_CONFIRMED',?,? FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id
          WHERE o.id=? AND c.wa_id=? AND changes()=1 AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND o.payment_status='PENDING' AND p.review_state IN ('PENDING','REJECTED') AND p.customer_transaction_reference IS NULL
            AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
            AND NOT EXISTS(SELECT 1 FROM cod_order_details active WHERE active.order_id=o.id AND active.status IN ('COD_PENDING','COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED'))`).bind(detailId,current.attempt,current.preview.seedPkr,current.preview.fertilizerPkr,current.preview.deliveryFeePkr,current.preview.codFeePkr,current.preview.totalPayablePkr,now,now,current.id,event.from),
        db.prepare("UPDATE payments SET method='COD',expected_amount=?,review_state='COD_PENDING',updated_at=? WHERE id=? AND order_id=? AND review_state IN ('PENDING','REJECTED') AND customer_transaction_reference IS NULL AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(current.preview.totalPayablePkr,now,current.paymentId,current.id,detailId),
        db.prepare("UPDATE orders SET state='COD_PENDING',payment_status='COD_PENDING',updated_at=? WHERE id=? AND state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND payment_status='PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED') AND EXISTS(SELECT 1 FROM payments WHERE id=? AND method='COD' AND expected_amount=? AND review_state='COD_PENDING')").bind(now,current.id,detailId,current.paymentId,current.preview.totalPayablePkr),
        db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(crypto.randomUUID(),"COD_ORDER_CONFIRMED","CUSTOMER","ORDER",current.id,await customerTransactionReferenceHash(event.id),JSON.stringify({attempt:current.attempt,totalPayablePkr:current.preview.totalPayablePkr,feePkr:current.preview.codFeePkr,province:current.preview.province,paid:false}),now,detailId),
        db.prepare("UPDATE payment_reminder_v2_schedules SET status='STOPPED',phase='STOPPED',stop_reason='COD_CONFIRMED',updated_at=? WHERE order_id=? AND status IN ('ACTIVE','PAUSED') AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(now,current.id,detailId),
        db.prepare("UPDATE payment_reminder_v2_stages SET status='CANCELLED',completed_at=?,last_error='COD_CONFIRMED',updated_at=? WHERE schedule_id IN (SELECT id FROM payment_reminder_v2_schedules WHERE order_id=?) AND status IN ('PENDING','CLAIMED','QUEUED') AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(now,now,current.id,detailId),
        db.prepare("UPDATE outbox_jobs SET status='CANCELLED',last_error='COD_CONFIRMED',updated_at=? WHERE idempotency_key IN (SELECT idempotency_key FROM payment_reminder_v2_stages WHERE schedule_id IN (SELECT id FROM payment_reminder_v2_schedules WHERE order_id=?)) AND status NOT IN ('SENT','DEAD_LETTER') AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(now,current.id,detailId),
        db.prepare("UPDATE outbound_messages SET status='SUPERSEDED',last_error='COD_CONFIRMED',updated_at=? WHERE order_id=? AND kind IN ('WHATSAPP_PAYMENT_TEXT','WHATSAPP_PAYMENT_QR','WHATSAPP_PAYMENT_REMINDER') AND status NOT IN ('DELIVERED','READ','SUPERSEDED') AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(now,current.id,detailId)
      ]);
      conversationClaimed=Number(results[0]?.meta?.changes??0)===1;
      if([0,1,2,3,4].every((index)=>Number(results[index]?.meta?.changes??0)===1)){
         data.amountPkr=current.preview.totalPayablePkr;data.codAttempt=current.attempt;delete data.codChangedToAdvance;delete data.codPreview;nextState="COD_PENDING";
        const breakdown=priceBreakdown(data.language??"en",current.preview.seedPkr,current.preview.fertilizerPkr,current.preview.deliveryFeePkr,current.preview.totalPayablePkr,current.preview.province,current.preview.codFeePkr);
        reply=data.language==="ur"?`آپ کا COD آرڈر ${current.orderNumber} تصدیق ہو گیا ہے۔\n${breakdown}\n${codPolicy.instructionsUr} کوئی پیشگی QR، رسید یا ادائیگی درکار نہیں۔`:`Your COD order ${current.orderNumber} is confirmed.\n${breakdown}\n${codPolicy.instructionsEn} No advance QR, receipt, or payment is required.`;
      }else{
        const actual=await db.prepare("SELECT cd.status,o.state,cd.total_payable_pkr FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id WHERE cd.id=?").bind(detailId).first<{status:string;state:string;total_payable_pkr:number}>();
        if(actual?.status==="COD_CONFIRMED"){nextState="COD_PENDING";data.amountPkr=Number(actual.total_payable_pkr);delete data.codPreview;}
        reply=data.language==="ur"?"COD آرڈر پہلے ہی تبدیل ہو چکا ہے۔ کوئی دوسری فیس یا آرڈر نہیں بنایا گیا۔":"The COD order was already changed. No second fee or order was created.";
      }
    }
  }
  else if(state==="COD_PENDING_CONFIRMATION"&&normalized==="COD_CONFIRM"&&data.orderId){
    const now=new Date().toISOString();
    const current=await db.prepare(`SELECT cd.id,cd.total_payable_pkr,o.order_number,p.id AS payment_id FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id WHERE cd.order_id=? AND cd.attempt=? AND cd.status='COD_PENDING' AND c.wa_id=? AND p.method='COD' AND p.review_state='COD_PENDING' AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)`).bind(data.orderId,data.codAttempt??0,event.from).first<{id:string;total_payable_pkr:number;order_number:string;payment_id:string}>();
    if(!current)reply=data.language==='ur'?"COD آرڈر کی حالت تبدیل نہیں ہوئی۔ کوئی ادائیگی تصدیق نہیں ہوئی۔":"The COD order was not changed. No payment was marked confirmed.";
    else{
      const results=await db.batch([
        db.prepare(`UPDATE cod_order_details SET status='COD_CONFIRMED',updated_at=? WHERE id=? AND status='COD_PENDING' AND EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=cod_order_details.order_id AND o.state='COD_PENDING_CONFIRMATION' AND o.payment_status='COD_PENDING' AND p.method='COD' AND p.review_state='COD_PENDING')`).bind(now,current.id),
        db.prepare("UPDATE orders SET state='COD_PENDING',payment_status='COD_PENDING',updated_at=? WHERE id=? AND state='COD_PENDING_CONFIRMATION' AND payment_status='COD_PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CONFIRMED')").bind(now,data.orderId,current.id),
        db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN payments p ON p.order_id=o.id WHERE cd.id=? AND cd.status='COD_CONFIRMED' AND o.state='COD_PENDING' AND o.payment_status='COD_PENDING' AND p.method='COD' AND p.review_state='COD_PENDING')").bind(crypto.randomUUID(),"COD_ORDER_CONFIRMED","CUSTOMER","ORDER",data.orderId,await customerTransactionReferenceHash(event.id),JSON.stringify({totalPayablePkr:current.total_payable_pkr,paid:false}),now,current.id)
      ]);
      if(Number(results[0]?.meta?.changes??0)===1&&Number(results[1]?.meta?.changes??0)===1&&Number(results[2]?.meta?.changes??0)===1){
        nextState="COD_PENDING";const detail=await db.prepare("SELECT seed_total_pkr,fertilizer_total_pkr,delivery_fee_pkr,cod_fee_pkr,total_payable_pkr,o.province FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id WHERE cd.id=?").bind(current.id).first<{seed_total_pkr:number;fertilizer_total_pkr:number;delivery_fee_pkr:number;cod_fee_pkr:number;total_payable_pkr:number;province:string|null}>();const breakdown=detail?priceBreakdown(data.language??"en",detail.seed_total_pkr,detail.fertilizer_total_pkr,detail.delivery_fee_pkr,detail.total_payable_pkr,detail.province??undefined,detail.cod_fee_pkr):`PKR ${current.total_payable_pkr}`;reply=data.language==='ur'?`آپ کا COD آرڈر ${current.order_number} تصدیق ہو گیا ہے۔\n${breakdown}\n${codPolicy?.instructionsUr??"کوئی پیشگی ادائیگی یا رسید درکار نہیں۔"}`:`Your COD order ${current.order_number} is confirmed.\n${breakdown}\n${codPolicy?.instructionsEn??"No advance payment or receipt is required."}`;
      }else{const actual=await db.prepare("SELECT cd.status,o.state,o.total_payable FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id WHERE cd.id=?").bind(current.id).first<{status:string;state:string;total_payable:number}>();nextState=actual?.state??state;if(actual?.status==="COD_METHOD_CHANGED"){nextState="PAYMENT_METHOD";delete data.codAttempt;data.codChangedToAdvance=true;data.amountPkr=actual.total_payable;}else if(actual?.status==="COD_CANCELLED")nextState="CANCELLED";reply=data.language==='ur'?"COD آرڈر کی حالت پہلے ہی تبدیل ہو چکی ہے۔ کوئی دوسری تبدیلی ریکارڈ نہیں ہوئی۔":"The COD order was already changed. No second transition was recorded.";}
    }
  }
  else if(state==="COD_PENDING_CONFIRMATION"&&normalized==="COD_CHANGE_PAYMENT"&&data.orderId){
    const now=new Date().toISOString();
    const current=await db.prepare("SELECT cd.id,cd.order_id,p.id AS payment_id,o.total_payable FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id WHERE cd.order_id=? AND cd.attempt=? AND cd.status='COD_PENDING' AND c.wa_id=? AND p.method='COD' AND p.review_state='COD_PENDING'").bind(data.orderId,data.codAttempt??0,event.from).first<{id:string;order_id:string;payment_id:string;total_payable:number}>();
    if(!current)reply=data.language==='ur'?"ادائیگی کا طریقہ تبدیل نہیں ہوا۔":"The payment method was not changed.";
    else{
      const results=await db.batch([
        db.prepare("UPDATE cod_order_details SET status='COD_METHOD_CHANGED',updated_at=? WHERE id=? AND status='COD_PENDING' AND EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=cod_order_details.order_id AND o.state='COD_PENDING_CONFIRMATION' AND o.payment_status='COD_PENDING' AND p.method='COD' AND p.review_state='COD_PENDING')").bind(now,current.id),
        db.prepare("UPDATE payments SET method=NULL,expected_amount=?,review_state='PENDING',updated_at=? WHERE id=? AND method='COD' AND review_state='COD_PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_METHOD_CHANGED')").bind(current.total_payable,now,current.payment_id,current.id),
        db.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING',updated_at=? WHERE id=? AND state='COD_PENDING_CONFIRMATION' AND payment_status='COD_PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_METHOD_CHANGED') AND EXISTS(SELECT 1 FROM payments WHERE id=? AND method IS NULL AND review_state='PENDING')").bind(now,current.order_id,current.id,current.payment_id),
        db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN payments p ON p.order_id=o.id WHERE cd.id=? AND cd.status='COD_METHOD_CHANGED' AND o.state='PAYMENT_PENDING' AND o.payment_status='PENDING' AND p.method IS NULL AND p.review_state='PENDING')").bind(crypto.randomUUID(),"COD_ORDER_METHOD_CHANGED","CUSTOMER","ORDER",current.order_id,await customerTransactionReferenceHash(event.id),JSON.stringify({attempt:Number(data.codAttempt),toPaymentSelection:true}),now,current.id)
      ]);
      if(Number(results[0]?.meta?.changes??0)===1&&Number(results[3]?.meta?.changes??0)===1){delete data.codAttempt;data.codChangedToAdvance=true;nextState="PAYMENT_METHOD";data.amountPkr=current.total_payable;reply=data.language==='ur'?"ادائیگی کا طریقہ منتخب کریں۔":"Choose an advance payment method.";}else{const actual=await db.prepare("SELECT cd.status,o.state FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id WHERE cd.id=?").bind(current.id).first<{status:string;state:string}>();nextState=actual?.state??state;if(actual?.status==="COD_CONFIRMED")nextState="COD_PENDING";else if(actual?.status==="COD_CANCELLED")nextState="CANCELLED";reply=data.language==='ur'?"COD آرڈر کی حالت پہلے ہی تبدیل ہو چکی ہے۔ کوئی دوسری تبدیلی ریکارڈ نہیں ہوئی۔":"The COD order was already changed. No second transition was recorded.";}
    }
  }
  else if(state==="COD_PENDING_CONFIRMATION"&&normalized==="COD_CANCEL"&&data.orderId){
    const now=new Date().toISOString();
    const current=await db.prepare("SELECT cd.id,cd.order_id FROM cod_order_details cd JOIN customers c ON c.id=(SELECT customer_id FROM orders WHERE id=cd.order_id) WHERE cd.order_id=? AND cd.attempt=? AND cd.status='COD_PENDING' AND c.wa_id=?").bind(data.orderId,data.codAttempt??0,event.from).first<{id:string;order_id:string}>();
    if(!current)reply=data.language==='ur'?"COD آرڈر منسوخ نہیں ہوا۔":"The COD order was not cancelled.";
    else{
      const results=await db.batch([
        db.prepare("UPDATE cod_order_details SET status='COD_CANCELLED',updated_at=? WHERE id=? AND status='COD_PENDING' AND EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=cod_order_details.order_id AND o.state='COD_PENDING_CONFIRMATION' AND o.payment_status='COD_PENDING' AND p.method='COD' AND p.review_state='COD_PENDING')").bind(now,current.id),
        db.prepare("UPDATE payments SET review_state='COD_CANCELLED',updated_at=? WHERE order_id=? AND method='COD' AND review_state='COD_PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CANCELLED')").bind(now,current.order_id,current.id),
        db.prepare("UPDATE orders SET state='CANCELLED',payment_status='PENDING',updated_at=? WHERE id=? AND state='COD_PENDING_CONFIRMATION' AND payment_status='COD_PENDING' AND changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details WHERE id=? AND status='COD_CANCELLED') AND EXISTS(SELECT 1 FROM payments WHERE order_id=? AND review_state='COD_CANCELLED')").bind(now,current.order_id,current.id,current.order_id),
        db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN payments p ON p.order_id=o.id WHERE cd.id=? AND cd.status='COD_CANCELLED' AND o.state='CANCELLED' AND o.payment_status='PENDING' AND p.review_state='COD_CANCELLED')").bind(crypto.randomUUID(),"COD_ORDER_CANCELLED","CUSTOMER","ORDER",current.order_id,await customerTransactionReferenceHash(event.id),JSON.stringify({attempt:Number(data.codAttempt)}),now,current.id)
      ]);
      if(Number(results[0]?.meta?.changes??0)===1&&Number(results[3]?.meta?.changes??0)===1){nextState="CANCELLED";reply=data.language==='ur'?"COD آرڈر منسوخ کر دیا گیا ہے۔ کوئی پیشگی ادائیگی نہیں لی گئی۔":"The COD order was cancelled. No advance payment was taken.";}else{const actual=await db.prepare("SELECT cd.status,o.state FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id WHERE cd.id=?").bind(current.id).first<{status:string;state:string}>();nextState=actual?.state??state;if(actual?.status==="COD_CONFIRMED")nextState="COD_PENDING";else if(actual?.status==="COD_METHOD_CHANGED"){nextState="PAYMENT_METHOD";delete data.codAttempt;data.codChangedToAdvance=true;}reply=data.language==='ur'?"COD آرڈر کی حالت پہلے ہی تبدیل ہو چکی ہے۔ کوئی دوسری تبدیلی ریکارڈ نہیں ہوئی۔":"The COD order was already changed. No second transition was recorded.";}
    }
  }
  else if (["PAYMENT_METHOD", "PAYMENT_PENDING", ...(state === "PAYMENT_GRACE" && paymentReminderV2Enabled && paymentAutomationV2Enabled ? ["PAYMENT_GRACE"] : [])].includes(state) && paymentMethodFromAction(normalized) && data.orderId) { const selectedMethod = paymentMethodFromAction(normalized)!; try { const allowPaymentGrace=paymentReminderV2Enabled && paymentAutomationV2Enabled;const selected = await selectPaymentMethod(db, data.orderId, selectedMethod, data.language ?? "en", event.from, event.id, allowPaymentGrace); if(allowPaymentGrace){const payment=await db.prepare("SELECT id FROM payments WHERE order_id=?").bind(data.orderId).first<{id:string}>();if(payment)await createPaymentV2Schedule(db,data.orderId,payment.id,new Date(),data.codChangedToAdvance?1:0,!data.codChangedToAdvance);delete data.codChangedToAdvance;} nextState = selected.orderState; reply = selected.message; paymentSelection = { orderId: data.orderId, orderNumber: selected.orderNumber, amount: selected.amount, method: selectedMethod, locale: data.language ?? "en", message: selected.message, idempotencyKey: selected.idempotencyKey, config: selected.config,allowPaymentGrace }; } catch { reply = data.language === "ur" ? "یہ ادائیگی کا طریقہ فی الحال دستیاب نہیں؛ کوئی ادائیگی کی درخواست نہیں بھیجی گئی۔" : "That payment method is not currently available; no payment request was sent."; } }
  else if ((state === "PAYMENT_PENDING" || state === "PAYMENT_GRACE") && /^(HELP|PAYMENT_HELP)$/i.test(normalized)) { reply = (await sessionContent("ORDER_STATUS", "Upload your payment receipt here after payment. Garden Shop will review it manually.", { orderNumber: data.orderNumber ?? "" })).text; }
  else if ((state === "PAYMENT_PENDING" || state === "PAYMENT_GRACE") && normalized === "START") { const order = await getLatestOrderForWaId(db, event.from, data.orderId); const locale = data.language ?? "en"; reply = order ? formatCustomerOrderStatus(order, locale) : (await sessionContent("ORDER_STATUS", "Your order is still in progress. Upload the receipt or use Check Order.")).text; }
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
    const invalidKey: WhatsAppTemplateKey = ["PAYMENT_CHOICE","PAYMENT_METHOD","COD_FEE_WARNING","COD_ORDER_REVIEW"].includes(state) ? "PAYMENT" : state === "PAYMENT_PENDING" ? "ORDER_STATUS" : state === "LANGUAGE" ? "WELCOME" : "VALIDATION";
    reply = (await sessionContent(invalidKey, invalidKey === "PAYMENT" ? "Choose a verified payment method." : "Please choose one of the listed options.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text;
  }
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
  const offer=offerPresentation.content;
  const sessionFlowToken = checkoutMode !== "guided" && state === "OFFER" && normalized === "CONTINUE_ORDER" && flowTokenSecret ? await createFlowToken(event.from, event.id, flowTokenSecret) : undefined;
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
    if (!completePaymentMethods.length&&!codSelectable) {
      nextState = "COMPLETE";
      reply = state === "REVIEW" ? `${reply}\n${noPaymentRequest()}` : noPaymentRequest();
    } else if (state === "REVIEW") {
      reply = `${reply}\n${(await sessionContent("PAYMENT", "Choose a verified payment method for order {orderNumber}.", { orderNumber: data.orderNumber ?? "", amount: data.amountPkr })).text}`;
    }
  }
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
    options = { buttons: [{ id: "PLACE_ORDER", title: whatsAppActionLabel(review, "PLACE_ORDER") }, { id: "BACK", title: whatsAppActionLabel(review, "BACK") }] };
  } else if(nextState==="PAYMENT_CHOICE"){
    options={buttons:[...(advanceSelectable?[{id:"PAY_ADVANCE",title:data.language==="ur"?"پیشگی ادائیگی":"Advance Payment"}]:[]),...(codSelectable?[{id:"PAY_COD",title:"COD"}]:[])]};
  } else if (nextState === "PAYMENT_METHOD" && paymentOptions.length) {
    options = {buttons:paymentOptions};
  } else if(nextState==="COD_FEE_WARNING"){
    options={buttons:[{id:"COD_CONFIRM",title:data.language==="ur"?"COD کی تصدیق":"Confirm COD"},...(advanceSelectable?[{id:"COD_ADVANCE_PAYMENT",title:data.language==="ur"?"پیشگی ادائیگی":"Advance Payment"}]:[])]};
  } else if(nextState==="COD_ORDER_REVIEW"){
    options={buttons:[{id:"COD_CONFIRM_ORDER",title:data.language==="ur"?"COD آرڈر کی تصدیق":"Confirm COD Order"},{id:"COD_BACK_TO_PAYMENT",title:data.language==="ur"?"پیشگی ادائیگی":"Advance Payment"}]};
  } else if(nextState==="COD_PENDING_CONFIRMATION"){
    options={buttons:[{id:"COD_CONFIRM",title:data.language==="ur"?"COD آرڈر کی تصدیق":"Confirm COD Order"},{id:"COD_CHANGE_PAYMENT",title:data.language==="ur"?"ادائیگی تبدیل کریں":"Change Payment"},{id:"COD_CANCEL",title:data.language==="ur"?"منسوخ":"Cancel COD"}]};
  } else if (["PAYMENT_PENDING", "PAYMENT_GRACE", "PAYMENT_REFERENCE", "PAYMENT_REVIEW","COD_PENDING"].includes(state) || nextState === "PAYMENT_REVIEW" || nextState === "COD_PENDING" || nextState === "COMPLETE") {
    options = { buttons: [{ id: "CHECK_ORDER", title: whatsAppActionLabel(status, "CHECK_ORDER") }] };
  }
  const mediaKey = invalidAction ? "VALIDATION" : guidedReplyMediaKey(normalized, state, nextState);
  // Payment images must come only from the selected method's verified private asset.
  if (mediaKey && mediaKey !== "PAYMENT" && (mediaKey!=="OFFER"||offerPresentation.mediaAllowed)) options.image = await contentImageFor(db, bucket, mediaKey, `CHAT:${event.from}`);
  const now = new Date().toISOString();
  const saved=conversationClaimed
    ?await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,updated_at=? WHERE wa_id=? AND state='COD_FINALIZING' AND last_inbound_message_id=?").bind(nextState,JSON.stringify(data),now,event.from,event.id).run()
    :row
    ?await db.prepare("UPDATE whatsapp_conversations SET state=?,state_data=?,last_inbound_message_id=?,updated_at=? WHERE wa_id=? AND state=? AND state_data=? AND last_inbound_message_id IS ?").bind(nextState,JSON.stringify(data),event.id,now,event.from,state,originalStateData,row.last_inbound_message_id).run()
    :await db.prepare("INSERT OR IGNORE INTO whatsapp_conversations (id,wa_id,state,state_data,last_inbound_message_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),event.from,nextState,JSON.stringify(data),event.id,now,now).run();
  if(Number(saved.meta.changes??0)!==1){
    if(codV2Enabled&&data.orderId){
      const finalized=await db.prepare("SELECT cd.total_payable_pkr FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN customers c ON c.id=o.customer_id WHERE cd.order_id=? AND c.wa_id=? AND cd.status IN ('COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED') ORDER BY cd.attempt DESC LIMIT 1").bind(data.orderId,event.from).first<{total_payable_pkr:number}>();
      if(finalized){data.amountPkr=Number(finalized.total_payable_pkr);delete data.codPreview;await db.prepare("UPDATE whatsapp_conversations SET state='COD_PENDING',state_data=?,last_inbound_message_id=?,updated_at=? WHERE wa_id=?").bind(JSON.stringify(data),event.id,now,event.from).run();}
    }
    return true;
  }
  if (paymentSelection) {
    const delivery = await deliverPaymentInstructions(db, bucket, provider, event.from, paymentSelection.orderId, paymentSelection.orderNumber, paymentSelection.amount, paymentSelection.method, paymentSelection.locale, paymentSelection.message, paymentSelection.idempotencyKey, paymentSelection.config,paymentSelection.allowPaymentGrace);
    try { if (events) await events.send({ kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey: paymentSelection.idempotencyKey, entityId: paymentSelection.orderId, schemaVersion: 1 }); } catch { /* the durable outbox remains authoritative */ }
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

async function recordReceiptMediaDiagnostic(db: D1Database,eventId:string,mediaId:string,reason:string,stage:string,candidateCount=0):Promise<void>{
  const messageIdHash=await customerTransactionReferenceHash(eventId),mediaIdHash=await customerTransactionReferenceHash(mediaId),now=new Date().toISOString();
  await db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),"RECEIPT_INGESTION_BLOCKED","SYSTEM","WHATSAPP_RECEIPT_EVENT",messageIdHash,messageIdHash,JSON.stringify({messageIdHash,mediaIdHash,reason,stage,candidateCount}),now).run();
}

async function processReceiptMedia(db: D1Database, bucket: R2Bucket, provider: ReturnType<typeof createWhatsAppProvider>, event: { id: string; from: string; payload: unknown }, paymentReminderV2Enabled = false): Promise<boolean> {
  const message = event.payload && typeof event.payload === "object" ? event.payload as { image?: { id?: string }; document?: { id?: string }; context?: { id?: string } } : {};
  const mediaId = message.image?.id ?? message.document?.id;
  if (!mediaId) return false;
  const conversation = await db.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(event.from).first<{ state: string; state_data: string }>();
  let data:ConversationData={};
  try{if(conversation)data=JSON.parse(conversation.state_data) as ConversationData;}catch{if(!message.context?.id)return false;}
  const codOrder=await hasTable(db,"cod_order_details")?await db.prepare(`SELECT o.order_number,cd.total_payable_pkr FROM cod_order_details cd JOIN orders o ON o.id=cd.order_id JOIN customers c ON c.id=o.customer_id
      WHERE c.wa_id=? AND (? IS NULL OR cd.order_id=?) AND cd.status IN ('COD_PENDING','COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED')
      ORDER BY cd.attempt DESC LIMIT 1`).bind(event.from,data.orderId??null,data.orderId??null).first<{order_number:string;total_payable_pkr:number}>():null;
  if(codOrder){
    await recordReceiptMediaDiagnostic(db,event.id,mediaId,"COD_RECEIPT_NOT_ACCEPTED","COD_ORDER");
    const locale=data.language??"en";
    await sendConversationReply(db,provider,event.from,event.id,locale==="ur"?`COD آرڈر ${codOrder.order_number} کے لیے پیشگی رسید درکار نہیں۔ ڈیلیوری پر PKR ${codOrder.total_payable_pkr} ادا کریں۔`:`No advance receipt is needed for COD order ${codOrder.order_number}. Pay PKR ${codOrder.total_payable_pkr} on delivery.`);
    return true;
  }
  const paymentConversationStates = ["PAYMENT_PENDING", "PAYMENT_REFERENCE", "PAYMENT_REVIEW", ...(paymentReminderV2Enabled ? ["PAYMENT_GRACE", "CANCELLED_UNPAID"] : [])];
  if (!message.context?.id && conversation && conversation.state !== "NEW" && !paymentConversationStates.includes(conversation.state)) return false;
  const recordSelect = `SELECT o.id,o.order_number,o.state,p.id AS payment_id,p.method,p.review_state,p.customer_transaction_reference
    FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id`;
  const eligibleStates = paymentReminderV2Enabled
    ? "('PAYMENT_PENDING','PAYMENT_GRACE','PAYMENT_REVIEW','CANCELLED_UNPAID')"
    : "('PAYMENT_PENDING','PAYMENT_REVIEW')";
  let record = message.context?.id
    ? await db.prepare(`${recordSelect} JOIN outbound_messages m ON m.order_id=o.id
        WHERE c.wa_id=? AND m.provider_message_id=?
          AND m.kind IN ('WHATSAPP_PAYMENT_TEXT','WHATSAPP_PAYMENT_QR','WHATSAPP_PAYMENT_REMINDER')
          AND o.state IN ${eligibleStates} AND p.review_state IN ('PENDING','REJECTED','REVIEW','CANCELLED_UNPAID') LIMIT 1`)
      .bind(event.from, message.context.id).first<{ id: string; order_number: string; state: string; payment_id: string; method: string | null; review_state: string; customer_transaction_reference: string | null }>()
    : null;
  if (message.context?.id && !record) { await recordReceiptMediaDiagnostic(db,event.id,mediaId,"REPLY_TO_PAYMENT_NOT_FOUND","ORDER_ASSOCIATION"); return false; }
  if (!record) {
    const candidates = await db.prepare(`${recordSelect} WHERE c.wa_id=? AND o.state IN ${eligibleStates}
      AND p.review_state IN ('PENDING','REJECTED','REVIEW','CANCELLED_UNPAID') ORDER BY o.created_at DESC,o.id DESC LIMIT 2`)
      .bind(event.from).all<{ id: string }>();
    if (candidates.results?.length !== 1) {
      await recordReceiptMediaDiagnostic(db,event.id,mediaId,candidates.results?.length?"MULTIPLE_ELIGIBLE_PAYMENT_ORDERS":"NO_ELIGIBLE_PAYMENT_ORDER","ORDER_ASSOCIATION",candidates.results?.length??0);
      return false;
    }
    if (data.orderId && candidates.results[0].id !== data.orderId) { await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ACTIVE_CONVERSATION_ORDER_MISMATCH","ORDER_ASSOCIATION",1); return false; }
    const targetOrderId = data.orderId ?? candidates.results[0].id;
    record = await db.prepare(`${recordSelect} WHERE o.id=? AND c.wa_id=?`)
      .bind(targetOrderId, event.from).first<{ id: string; order_number: string; state: string; payment_id: string; method: string | null; review_state: string; customer_transaction_reference: string | null }>();
  }
  if (!record) return false;
  if (record.state !== "PAYMENT_PENDING" && record.state !== "PAYMENT_REVIEW" && !(paymentReminderV2Enabled && ["PAYMENT_GRACE", "CANCELLED_UNPAID"].includes(record.state))) { await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ORDER_STATE_NOT_RECEIVABLE","ORDER_ASSOCIATION"); return false; }
  const associationEvidence = message.context?.id ? "PAYMENT_REPLY_WAMID" : data.orderId ? "ACTIVE_CONVERSATION_ORDER" : "UNIQUE_SENDER_PAYMENT";
  const status = await contentFor(db, "ORDER_STATUS", "Use Check Order to see the current order and payment status.", {}, `CHAT:${event.from}`, data.language ?? "en");
  const existing = await db.prepare("SELECT id FROM payment_receipts WHERE provider_media_id=? AND order_id=?").bind(mediaId, record.id).first<{ id: string }>();
  if (!existing && record.state === "CANCELLED_UNPAID") {
    let media:Awaited<ReturnType<typeof provider.downloadMedia>>,stored:{objectKey:string;sha256:string};
    try{media=await provider.downloadMedia(mediaId)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"META_MEDIA_DOWNLOAD_FAILED","MEDIA_DOWNLOAD");throw new Error("RECEIPT_MEDIA_DOWNLOAD_FAILED")}
    try{stored=await storeReceipt(bucket,record.order_number,media)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"PRIVATE_R2_WRITE_FAILED","R2_WRITE");throw new Error("RECEIPT_R2_WRITE_FAILED")}
    const now=new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at,review_state) VALUES (?,?,?,?,?,?,?,?,?,?,'LATE_REVIEW')").bind(crypto.randomUUID(),record.payment_id,record.id,media.mediaId,stored.objectKey,stored.sha256,media.mimeType,media.size,now,now),
      db.prepare("UPDATE payments SET review_state='LATE_REVIEW',submitted_at=?,updated_at=? WHERE id=? AND review_state='CANCELLED_UNPAID'").bind(now,now,record.payment_id),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"LATE_PAYMENT_EVIDENCE_RECEIVED","CUSTOMER","PAYMENT",record.payment_id,await customerTransactionReferenceHash(event.id),JSON.stringify({orderId:record.id,orderNumber:record.order_number,providerMediaIdHash:await customerTransactionReferenceHash(mediaId)}),now)
    ]);
    const lateNotice=data.language==="ur"?`منسوخ شدہ آرڈر ${record.order_number} کے لیے ادائیگی کا ثبوت موصول ہو گیا ہے۔ یہ ایڈمن کے جائزے میں ہے؛ ابھی PAID کی تصدیق نہیں ہوئی۔ دوبارہ ادائیگی نہ کریں۔`:`Payment evidence for cancelled order ${record.order_number} was received. It is under Admin review and is not marked PAID. Do not pay again.`;
    await sendConversationReply(db,provider,event.from,event.id,lateNotice,{buttons:[{id:"CHECK_ORDER",title:whatsAppActionLabel(status,"CHECK_ORDER")}]});
    return true;
  }
  if (!existing) {
    if (paymentReminderV2Enabled) await db.prepare(`UPDATE payment_reminder_v2_schedules SET status='PAUSED',stop_reason='RECEIPT_INGESTION_PENDING',updated_at=?
      WHERE payment_id=? AND order_id=? AND status='ACTIVE'`).bind(new Date().toISOString(),record.payment_id,record.id).run();
    let media:Awaited<ReturnType<typeof provider.downloadMedia>>,stored:{objectKey:string;sha256:string};
    try{media=await provider.downloadMedia(mediaId)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"META_MEDIA_DOWNLOAD_FAILED","MEDIA_DOWNLOAD");throw new Error("RECEIPT_MEDIA_DOWNLOAD_FAILED")}
    try{stored=await storeReceipt(bucket,record.order_number,media)}catch{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"PRIVATE_R2_WRITE_FAILED","R2_WRITE");throw new Error("RECEIPT_R2_WRITE_FAILED")}
    const now = new Date().toISOString();
    const messageIdHash=await customerTransactionReferenceHash(event.id),mediaIdHash=await customerTransactionReferenceHash(mediaId);
    const receiptStatements = [
      db.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.payment_id, record.id, media.mediaId, stored.objectKey, stored.sha256, media.mimeType, media.size, now, now),
      db.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=COALESCE(submitted_at,?),updated_at=? WHERE id=? AND review_state IN ('PENDING','REJECTED','REVIEW')").bind(now, now, record.payment_id),
      db.prepare("UPDATE orders SET state='PAYMENT_REVIEW',updated_at=? WHERE id=? AND state IN ('PAYMENT_PENDING','PAYMENT_GRACE','PAYMENT_REVIEW')").bind(now, record.id),
      db.prepare(`UPDATE whatsapp_conversations SET state=CASE WHEN state IN ('PAYMENT_PENDING','PAYMENT_GRACE','NEW') THEN 'PAYMENT_REFERENCE' ELSE state END,
        state_data=CASE WHEN state='NEW' OR state_data IN ('{}','') THEN ? ELSE state_data END,last_inbound_message_id=?,updated_at=?
        WHERE wa_id=? AND ((state IN ('PAYMENT_PENDING','PAYMENT_GRACE','PAYMENT_REFERENCE','PAYMENT_REVIEW') AND (state_data LIKE ? OR state_data IN ('{}',''))) OR state='NEW')`)
        .bind(JSON.stringify({ ...data, orderId: record.id, orderNumber: record.order_number, language: data.language ?? "en" }), event.id, now, event.from, `%\"orderId\":\"${record.id}\"%`),
      db.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "RECEIPT_SUBMITTED", "CUSTOMER", "PAYMENT", record.payment_id, messageIdHash, JSON.stringify({ orderId: record.id, providerMediaIdHash: mediaIdHash, messageIdHash, associationEvidence }), now)
    ];
    if (paymentReminderV2Enabled) receiptStatements.push(db.prepare(`UPDATE payment_reminder_v2_schedules SET status='PAUSED',stop_reason='RECEIPT_SUBMITTED',updated_at=?
      WHERE payment_id=? AND order_id=? AND (status='ACTIVE' OR stop_reason='RECEIPT_INGESTION_PENDING')`).bind(now, record.payment_id, record.id));
    try{await db.batch(receiptStatements)}catch{
      try{await bucket.delete(stored.objectKey)}catch{try{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"ORPHAN_R2_CLEANUP_FAILED","D1_COMMIT",1)}catch{}}
      try{await recordReceiptMediaDiagnostic(db,event.id,mediaId,"RECEIPT_D1_COMMIT_FAILED","D1_COMMIT",1)}catch{}
      throw new Error("RECEIPT_D1_COMMIT_FAILED");
    }
  }
  const receipt = await contentFor(db, "RECEIPT", "Receipt received for order {orderNumber}. Reply with the transaction/reference ID shown in your payment app. Payment remains under Admin review until actual account credit is verified.", { orderNumber: record.order_number }, `CHAT:${event.from}`, data.language ?? "en");
  const orderStatus = await contentFor(db, "ORDER_STATUS", "Use Check Order to see the current order and payment status.", {}, `CHAT:${event.from}`, data.language ?? "en");
  const image = await contentImageFor(db, bucket, "RECEIPT", `CHAT:${event.from}`);
  await sendConversationReply(db, provider, event.from, event.id, receipt.text, { image, buttons: [{ id: "CHECK_ORDER", title: whatsAppActionLabel(orderStatus, "CHECK_ORDER") }] });
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
  if(c.env.DB&&payload&&typeof payload==="object"){
    const entries=(payload as Record<string,unknown>).entry;
    if(Array.isArray(entries))for(const entry of entries){
      if(!entry||typeof entry!=="object")continue;
      const changes=(entry as Record<string,unknown>).changes;
      if(!Array.isArray(changes))continue;
      for(const change of changes){
        if(!change||typeof change!=="object")continue;
        const value=(change as Record<string,unknown>).value;
        const statuses=value&&typeof value==="object"?(value as Record<string,unknown>).statuses:undefined;
        if(!Array.isArray(statuses))continue;
        for(const status of statuses){
          if(!status||typeof status!=="object")continue;
          const row=status as Record<string,unknown>;
          if(typeof row.id==="string"&&["delivered","read"].includes(String(row.status).toLowerCase())){
            const stage=await c.env.DB.prepare(`SELECT id,schedule_id,stage_minutes,status FROM payment_reminder_v2_stages
              WHERE idempotency_key=(SELECT idempotency_key FROM outbound_messages WHERE provider_message_id=? LIMIT 1)`)
              .bind(row.id).first<{id:string;schedule_id:string;stage_minutes:number;status:string}>();
            if(stage&&stage.status!=="DELIVERED"){
              const deliveredAt=new Date().toISOString();
              await c.env.DB.prepare("UPDATE payment_reminder_v2_stages SET status='DELIVERED',completed_at=?,updated_at=? WHERE id=? AND status IN ('QUEUED','SENT')").bind(deliveredAt,deliveredAt,stage.id).run();
              if(Number(stage.stage_minutes)===240){const graceUntil=new Date(Date.now()+30*60_000).toISOString();await c.env.DB.prepare("UPDATE payment_reminder_v2_stages SET due_at=CASE WHEN due_at<? THEN ? ELSE due_at END,updated_at=? WHERE schedule_id=? AND stage_minutes=270 AND status='PENDING'").bind(graceUntil,graceUntil,deliveredAt,stage.schedule_id).run();}
            }
          }
        }
      }
    }
  }
  if (c.env.DB) await persistInboundConversationActivity(c.env.DB, inbound);
  let autoReplies = 0;
  for (const event of inbound) {
    const codGate=c.env.COD_V2_ENABLED==="true"&&(c.env.DEPLOYMENT_STATE==="V2_ISOLATED_STAGING"||c.env.DEPLOYMENT_STATE==="LOCAL");
    if (event.kind === "media") { if (c.env.DB && await processReceiptMedia(c.env.DB, c.env.RECEIPTS, provider, event, c.env.PAYMENT_REMINDERS_V2_ENABLED === "true" && c.env.PAYMENT_AUTOMATION_V2_ENABLED === "true")) continue; else continue; }
     if (c.env.DB && await processGuidedConversation(c.env.DB, c.env.RECEIPTS, provider, event, c.env.META_FLOW_ID ?? "1133458765899784", c.env.META_APP_SECRET, c.env.WHATSAPP_CHECKOUT_MODE ?? "guided", c.env.EVENTS, c.env.PAYMENT_REMINDERS_V2_ENABLED === "true", c.env.PAYMENT_AUTOMATION_V2_ENABLED === "true", codGate,c.env.COD_POLICY_HMAC_KEY)) continue;
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
  const record = await c.env.DB.prepare("SELECT o.order_number, o.state, p.id AS payment_id,p.method FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND p.id=?").bind(body.orderId, body.paymentId).first<{ order_number: string; state: string; payment_id: string;method:string|null }>();
  if (!record) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if(record.method==="COD"||(await hasTable(c.env.DB,"cod_order_details")&&await c.env.DB.prepare("SELECT 1 FROM cod_order_details WHERE order_id=? AND status IN ('COD_PENDING','COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED') LIMIT 1").bind(body.orderId).first()))return c.json({error:"COD_RECEIPT_NOT_ACCEPTED"},409);
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
  async scheduled(controller: ScheduledController, env: Env["Bindings"]): Promise<void> {
    const remindersEnabled = env.PAYMENT_REMINDERS_V2_ENABLED === "true" && env.PAYMENT_AUTOMATION_V2_ENABLED === "true";
    const confirmationsEnabled = env.PAYMENT_CONFIRMATION_V2_ENABLED === "true";
    if (!remindersEnabled && !confirmationsEnabled) return;
    const now = new Date(controller.scheduledTime);
    if (remindersEnabled) await enqueueDuePaymentV2Stages(env.DB, now, true);
    const timestamp = now.toISOString();
    const staleQueuedAt = new Date(now.getTime() - 5 * 60_000).toISOString();
    const jobs = await env.DB.prepare(`SELECT idempotency_key,kind,entity_id FROM outbox_jobs
      WHERE ((kind='WHATSAPP_PAYMENT_CONFIRMATION' AND ?=1) OR (kind='WHATSAPP_PAYMENT_REMINDER' AND ?=1))
        AND ((status IN ('PENDING','RETRY') AND available_at<=?) OR (status='QUEUED' AND updated_at<=?))
      ORDER BY available_at,id LIMIT 100`).bind(confirmationsEnabled ? 1 : 0, remindersEnabled ? 1 : 0, timestamp, staleQueuedAt)
      .all<{ idempotency_key: string; kind: string; entity_id: string }>();
    for (const job of jobs.results ?? []) {
      const nextAvailable = new Date(now.getTime() + 5 * 60_000).toISOString();
      const claimed = await env.DB.prepare(`UPDATE outbox_jobs SET status='QUEUED',available_at=?,updated_at=?
        WHERE idempotency_key=? AND ((status IN ('PENDING','RETRY') AND available_at<=?) OR (status='QUEUED' AND updated_at<=?))`)
        .bind(nextAvailable, timestamp, job.idempotency_key, timestamp, staleQueuedAt).run();
      if (!Number(claimed.meta?.changes)) continue;
      try {
        await env.EVENTS.send({ kind: job.kind, idempotencyKey: job.idempotency_key, entityId: job.entity_id, schemaVersion: 1 });
      } catch {
        await env.DB.prepare(`UPDATE outbox_jobs SET status='RETRY',available_at=?,last_error='QUEUE_DISPATCH_FAILED',updated_at=?
          WHERE idempotency_key=? AND status='QUEUED'`).bind(timestamp, timestamp, job.idempotency_key).run();
      }
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
            const persisted = await persistInstantFormSubmission(env.DB, lead, env.PAYMENT_REMINDERS_V2_ENABLED === "true" && env.PAYMENT_AUTOMATION_V2_ENABLED === "true");
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
        if (message.body.kind === "WHATSAPP_PAYMENT_CONFIRMATION") {
          const block = async (reason: string) => {
            const now = new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt, reason, now, message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_PAYMENT_CONFIRMATION_BLOCKED", "SYSTEM", "ORDER", message.body.entityId, crypto.randomUUID(), JSON.stringify({ reason }), now)
            ]);
            message.ack();
          };
          try {
            if (env.PAYMENT_CONFIRMATION_V2_ENABLED !== "true") { await block("PAYMENT_CONFIRMATION_V2_DISABLED"); continue; }
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = outbox ? JSON.parse(outbox.payload_json) as { paymentId: string; orderId: string; customerId: string; orderNumber: string; amount: number } : undefined;
            if (!payload || payload.orderId !== message.body.entityId) { await block("PAYMENT_CONFIRMATION_PAYLOAD_INVALID"); continue; }
            const current = await env.DB.prepare(`SELECT o.order_number,o.state,o.archived_at,o.total_payable,p.review_state,p.approved_amount,c.id AS customer_id,c.wa_id,wc.last_inbound_at,wc.state_data,
                EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id) AS opted_out
              FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id
              LEFT JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id WHERE o.id=? AND p.id=? AND c.id=?`)
              .bind(payload.orderId, payload.paymentId, payload.customerId)
              .first<{ order_number: string; state: string; archived_at: string | null; total_payable: number; review_state: string; approved_amount: number | null; customer_id: string; wa_id: string | null; last_inbound_at: string | null; state_data: string | null;opted_out:number }>();
            if (!current || current.order_number !== payload.orderNumber || current.state !== "PAID" || current.archived_at !== null || current.review_state !== "APPROVED" || Number(current.approved_amount) !== Number(current.total_payable) || Number(payload.amount) !== Number(current.total_payable)) { await block("PAYMENT_CONFIRMATION_STATE_MISMATCH"); continue; }
            if(current.opted_out){await block("PAYMENT_CONFIRMATION_CUSTOMER_OPTED_OUT");continue;}
            if (!current.wa_id || !/^\d{8,15}$/.test(current.wa_id)) { await block("PAYMENT_CONFIRMATION_CUSTOMER_WA_ID_INVALID"); continue; }
            let locale: "en" | "ur";
            try {
              const conversation = JSON.parse(current.state_data ?? "{}") as { language?: unknown };
              if (conversation.language !== "en" && conversation.language !== "ur") { await block("PAYMENT_CONFIRMATION_CUSTOMER_LOCALE_UNVERIFIED"); continue; }
              locale = conversation.language;
            } catch { await block("PAYMENT_CONFIRMATION_CUSTOMER_LOCALE_UNVERIFIED"); continue; }
            const provider = createWhatsAppProvider("meta", { enabled: env.META_PROVIDER_ENABLED === "true", graphVersion: env.META_GRAPH_VERSION ?? "v26.0", accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, verifyToken: env.WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET });
            let send: () => Promise<{ providerMessageId: string }>;
            if (isInsideWhatsAppServiceWindow(current.last_inbound_at)) {
              const text = locale === "ur"
                ? `آپ کے آرڈر ${current.order_number} کی ${current.total_payable} روپے ادائیگی کی تصدیق ہو گئی ہے۔ آپ کا آرڈر کنفرم ہو گیا ہے۔`
                : `Payment of PKR ${current.total_payable} received and verified for order ${current.order_number}. Your order is confirmed.`;
              send = () => provider.sendText(current.wa_id!, text);
            } else {
              const approvedTemplate = await env.DB.prepare(`SELECT body,utility_template_name,utility_approved_at FROM payment_v2_template_versions
                WHERE template_key='PAYMENT_CONFIRMED' AND locale=? AND state='PUBLISHED'
                  AND utility_template_name IS NOT NULL AND utility_approved_at IS NOT NULL`)
                .bind(locale).first<{ body:string;utility_template_name: string;utility_approved_at:string }>();
              if (env.PAYMENT_UTILITY_TEMPLATES_APPROVED!=="true"||!approvedTemplate?.utility_template_name||!approvedTemplate.utility_approved_at||!/{amount}/.test(approvedTemplate.body)||!/{orderNumber}/.test(approvedTemplate.body)) { await block("PAYMENT_CONFIRMATION_TEMPLATE_NOT_APPROVED"); continue; }
              const values:Record<string,string>={amount:String(current.total_payable),orderNumber:current.order_number};
              const parameters=[...approvedTemplate.body.matchAll(/\{(amount|orderNumber)\}/g)].map((match)=>values[match[1]]??"");
              send = () => provider.sendTemplate(current.wa_id!, approvedTemplate.utility_template_name, parameters, locale);
            }
            const outbound = await sendPaymentPart(env.DB, current.wa_id, payload.orderId, `${message.body.idempotencyKey}:whatsapp`, "WHATSAPP_PAYMENT_CONFIRMATION", send);
            if (outbound !== "SENT") throw new Error("PAYMENT_CONFIRMATION_SEND_FAILED");
            await env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, new Date().toISOString(), message.body.idempotencyKey).run();
            message.ack();
            continue;
          } catch (error) {
            const failure = error instanceof Error&&/^[A-Z0-9_:-]{1,120}$/.test(error.message)?error.message:"PAYMENT_CONFIRMATION_SEND_FAILED";
            if (nextAttempt >= 5) {
              await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, new Date().toISOString(), message.body.idempotencyKey).run();
              message.ack();
              continue;
            }
            const now=new Date().toISOString();const retryAt=new Date(Date.now()+retryDelaySeconds(nextAttempt)*1000).toISOString();
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,available_at=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt, failure, retryAt, now, message.body.idempotencyKey).run();
            message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
            continue;
          }
        }
        if (message.body.kind === "WHATSAPP_ORDER_STATUS") {
          const block = async (reason:string, status:"DEFERRED"|"PERMANENT_FAILURE"="DEFERRED") => {
            const now=new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status=?,attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(status,nextAttempt,reason,now,message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"WHATSAPP_ORDER_STATUS_BLOCKED","SYSTEM","ORDER",message.body.entityId,crypto.randomUUID(),JSON.stringify({reason,idempotencyKey:message.body.idempotencyKey}),now)
            ]);
            message.ack();
          };
          try {
            if(env.ORDER_STATUS_NOTIFICATIONS_V2_ENABLED!=="true"){await block("ORDER_STATUS_NOTIFICATIONS_V2_DISABLED");continue;}
            if(env.META_PROVIDER_ENABLED!=="true"){await block("META_PROVIDER_DISABLED");continue;}
            const stored=await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{payload_json:string}>();
            const payload=stored?parseV2StatusPayload(stored.payload_json):null;
            if(!payload||payload.orderId!==message.body.entityId){await block("ORDER_STATUS_PAYLOAD_INVALID","PERMANENT_FAILURE");continue;}
            const current=await env.DB.prepare(`SELECT o.order_number,o.state,o.archived_at,o.payment_status,o.total_payable,c.id AS customer_id,c.wa_id,wc.last_inbound_at,wc.state_data,
              p.id AS payment_id,p.review_state,p.approved_amount,
              EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id) AS opted_out,
              (SELECT COUNT(*) FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS receipt_count,
              EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='ORDER' AND a.entity_id=o.id AND a.action='ORDER_CONFIRMED') AS order_confirmed
              FROM orders o JOIN customers c ON c.id=o.customer_id
              LEFT JOIN payments p ON p.id=COALESCE(?,(SELECT p2.id FROM payments p2 WHERE p2.order_id=o.id ORDER BY p2.created_at DESC LIMIT 1))
              LEFT JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id WHERE o.id=? AND (p.id IS NULL OR p.order_id=o.id)`).bind(payload.paymentId??null,payload.orderId)
              .first<{order_number:string;state:string;archived_at:string|null;payment_status:string;total_payable:number;customer_id:string;wa_id:string|null;last_inbound_at:string|null;state_data:string|null;payment_id:string|null;review_state:string|null;approved_amount:number|null;opted_out:number;receipt_count:number;order_confirmed:number}>();
            if(!current||current.archived_at||current.order_number!==payload.orderNumber){await block("ORDER_STATUS_ORDER_MISMATCH","PERMANENT_FAILURE");continue;}
            const eligible=payload.noticeName==="PAYMENT_REJECTED"?current.state==="PAYMENT_REJECTED"&&current.review_state==="REJECTED"
              :payload.noticeName==="REQUEST_CLEARER_RECEIPT"?current.state==="PAYMENT_REVIEW"&&current.review_state==="REVIEW"&&Number(current.receipt_count)>0
              :payload.noticeName==="ORDER_CONFIRMED"?["PAID","PACKING","DISPATCHED","DELIVERED"].includes(current.state)&&current.payment_status==="PAID"&&current.review_state==="APPROVED"&&Number(current.order_confirmed)===1
              :payload.noticeName==="PACKING"?current.state==="PACKING"&&current.payment_status==="PAID"&&current.review_state==="APPROVED"
              :payload.noticeName==="DISPATCHED"?current.state==="DISPATCHED"&&current.payment_status==="PAID"&&current.review_state==="APPROVED"
              :payload.noticeName==="DELIVERED"?current.state==="DELIVERED"&&current.payment_status==="PAID"&&current.review_state==="APPROVED"
              :current.state==="CANCELLED"&&current.payment_status!=="PAID"&&current.review_state!=="APPROVED"&&Number(current.receipt_count)===0;
            if(!eligible||current.opted_out){await block(current.opted_out?"ORDER_STATUS_CUSTOMER_OPTED_OUT":"ORDER_STATUS_STATE_MISMATCH","PERMANENT_FAILURE");continue;}
            if(!current.wa_id||!/^[0-9]{7,20}$/.test(current.wa_id)){await block("ORDER_STATUS_CUSTOMER_WA_ID_INVALID","PERMANENT_FAILURE");continue;}
            let locale:"en"|"ur";
            try{const data=JSON.parse(current.state_data??"{}") as {language?:unknown};if(data.language!=="en"&&data.language!=="ur"){await block("ORDER_STATUS_LOCALE_UNVERIFIED","PERMANENT_FAILURE");continue;}locale=data.language;}catch{await block("ORDER_STATUS_LOCALE_UNVERIFIED","PERMANENT_FAILURE");continue;}
            let trackingNumber=payload.trackingNumber??null;
            if(payload.noticeName==="DISPATCHED"&&!trackingNumber){const row=await env.DB.prepare("SELECT metadata_json FROM audit_log WHERE entity_type='ORDER' AND entity_id=? AND action='ORDER_TRACKING_ASSIGNED' ORDER BY created_at DESC LIMIT 1").bind(payload.orderId).first<{metadata_json:string}>();try{trackingNumber=(JSON.parse(row?.metadata_json??"{}") as {trackingNumber?:string}).trackingNumber??null;}catch{trackingNumber=null;}}
            if(payload.noticeName==="DISPATCHED"&&!trackingNumber){await block("ORDER_STATUS_TRACKING_MISSING","PERMANENT_FAILURE");continue;}
            const simulation=payload.simulation===true&&payload.orderNumber.startsWith("SIM-GFS210-");
            const text=renderV2OrderStatusNotice(payload.noticeName,current.order_number,locale,trackingNumber,simulation);
            const serviceWindow=isInsideWhatsAppServiceWindow(current.last_inbound_at);
            let send:()=>Promise<{providerMessageId:string}>;
            let templateName:string|null=null;
            if(serviceWindow){const provider=createWhatsAppProvider("meta",{enabled:true,graphVersion:env.META_GRAPH_VERSION??"v26.0",accessToken:env.META_ACCESS_TOKEN,phoneNumberId:env.META_PHONE_NUMBER_ID,verifyToken:env.WEBHOOK_VERIFY_TOKEN,appSecret:env.META_APP_SECRET});send=()=>provider.sendText(current.wa_id!,text);}
            else {
              const template=await env.DB.prepare("SELECT body,utility_template_name,utility_approved_at FROM payment_v2_template_versions WHERE template_key=? AND locale=? AND state='PUBLISHED' AND utility_template_name IS NOT NULL AND utility_approved_at IS NOT NULL ORDER BY version DESC LIMIT 1").bind(payload.noticeName,locale).first<{body:string;utility_template_name:string;utility_approved_at:string}>();
              if(env.PAYMENT_UTILITY_TEMPLATES_APPROVED!=="true"||!template){await block("ORDER_STATUS_UTILITY_TEMPLATE_NOT_APPROVED");continue;}
              const parameters=[payload.orderNumber,...(payload.noticeName==="DISPATCHED"?[trackingNumber??""]:[])];templateName=template.utility_template_name;
              const provider=createWhatsAppProvider("meta",{enabled:true,graphVersion:env.META_GRAPH_VERSION??"v26.0",accessToken:env.META_ACCESS_TOKEN,phoneNumberId:env.META_PHONE_NUMBER_ID,verifyToken:env.WEBHOOK_VERIFY_TOKEN,appSecret:env.META_APP_SECRET});send=()=>provider.sendTemplate(current.wa_id!,templateName!,parameters,locale);
            }
            const delivery=await sendPaymentPart(env.DB,current.wa_id,payload.orderId,message.body.idempotencyKey,"WHATSAPP_ORDER_STATUS",send);
            if(delivery!=="SENT")throw new Error("ORDER_STATUS_NOTIFICATION_SEND_FAILED");
            const sentAt=new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,sentAt,message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"WHATSAPP_ORDER_STATUS_SENT","SYSTEM","ORDER",payload.orderId,crypto.randomUUID(),JSON.stringify({noticeName:payload.noticeName,locale,templateName,simulation}),sentAt)
            ]);
            message.ack();
            continue;
          } catch(error) {
            const failure=error instanceof Error&&/^[A-Z0-9_:-]{1,120}$/.test(error.message)?error.message:"ORDER_STATUS_NOTIFICATION_SEND_FAILED";
            if(nextAttempt>=5){const now=new Date().toISOString();await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,now,message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"WHATSAPP_ORDER_STATUS_DEAD_LETTER","SYSTEM","ORDER",message.body.entityId,crypto.randomUUID(),JSON.stringify({reason:failure}),now)
            ]);message.ack();continue;}
            const now=new Date().toISOString();const retryAt=new Date(Date.now()+retryDelaySeconds(nextAttempt)*1000).toISOString();await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,available_at=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,retryAt,now,message.body.idempotencyKey).run();message.retry({delaySeconds:retryDelaySeconds(nextAttempt)});continue;
          }
        }
        if (message.body.kind === "WHATSAPP_PAYMENT_REMINDER") {
          const block = async (reason: string, stageStatus: "BLOCKED_TEMPLATE" | "BLOCKED_WINDOW" | "SKIPPED") => {
            const now = new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt, reason, now, message.body.idempotencyKey),
              env.DB.prepare("UPDATE payment_reminder_v2_stages SET status=?,last_error=?,completed_at=?,updated_at=? WHERE idempotency_key=? AND status='QUEUED'").bind(stageStatus, reason, now, now, message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "WHATSAPP_PAYMENT_REMINDER_BLOCKED", "SYSTEM", "ORDER", message.body.entityId, crypto.randomUUID(), JSON.stringify({ reason, idempotencyKey: message.body.idempotencyKey }), now)
            ]);
            message.ack();
          };
          try {
            if (env.PAYMENT_REMINDERS_V2_ENABLED !== "true" || env.PAYMENT_AUTOMATION_V2_ENABLED !== "true") { await block("PAYMENT_REMINDERS_V2_DISABLED", "SKIPPED"); continue; }
            const stored = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = stored ? JSON.parse(stored.payload_json) as { stageId: string; stageMinutes: number; scheduleId: string; orderId: string; paymentId: string } : undefined;
            if (!payload || payload.orderId !== message.body.entityId || payload.stageId !== message.body.idempotencyKey) { await block("PAYMENT_REMINDER_PAYLOAD_INVALID", "SKIPPED"); continue; }
            const current = await env.DB.prepare(`SELECT st.id,st.stage_minutes,st.status AS stage_status,st.due_at,st.idempotency_key,st.locale AS pinned_locale,st.template_version AS pinned_template_version,
                s.id AS schedule_id,s.status AS schedule_status,s.phase,s.source_created_at,
                o.order_number,o.state,o.archived_at,o.payment_status,o.total_payable,
                p.id AS payment_id,p.review_state,p.method,c.id AS customer_id,c.wa_id,
                wc.last_inbound_at,wc.state_data,
                EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED') AS has_receipt,
                EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id) AS opted_out
              FROM payment_reminder_v2_stages st JOIN payment_reminder_v2_schedules s ON s.id=st.schedule_id
              JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id JOIN customers c ON c.id=o.customer_id
              LEFT JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id WHERE st.id=? AND s.id=? AND o.id=? AND p.id=? AND c.id=?`)
              .bind(payload.stageId, payload.scheduleId, payload.orderId, payload.paymentId, (JSON.parse(stored!.payload_json) as { customerId?: string }).customerId ?? "")
              .first<{ id:string;stage_minutes:number;stage_status:string;due_at:string;idempotency_key:string;pinned_locale:string|null;pinned_template_version:number|null;schedule_id:string;schedule_status:string;phase:string;source_created_at:string;order_number:string;state:string;archived_at:string|null;payment_status:string;total_payable:number;payment_id:string;review_state:string;method:string|null;customer_id:string;wa_id:string|null;last_inbound_at:string|null;state_data:string|null;has_receipt:number;opted_out:number }>();
            if (!current || current.id !== payload.stageId || Number(current.stage_minutes) !== Number(payload.stageMinutes) || current.stage_status !== "QUEUED") { await block("PAYMENT_REMINDER_STATE_MISMATCH", "SKIPPED"); continue; }
            const isCancellation = Number(payload.stageMinutes) === 270;
            const eligible = isCancellation
              ? current.schedule_status === "TERMINAL" && current.phase === "CANCELLED_UNPAID" && current.state === "CANCELLED_UNPAID" && current.payment_status === "CANCELLED_UNPAID" && current.review_state === "CANCELLED_UNPAID"
              : current.schedule_status === "ACTIVE" && current.payment_status === "PENDING" && current.review_state === "PENDING" && current.has_receipt === 0 && current.state === (Number(payload.stageMinutes) >= 240 ? "PAYMENT_GRACE" : current.state) && ["DETAILS_COMPLETED","PAYMENT_PENDING","PAYMENT_GRACE"].includes(current.state);
            if (!eligible || current.archived_at || current.opted_out) { await block(current.opted_out ? "PAYMENT_REMINDER_OPTED_OUT" : "PAYMENT_REMINDER_NO_LONGER_ELIGIBLE", "SKIPPED"); continue; }
            if (!current.wa_id || !/^\d{7,20}$/.test(current.wa_id)) { await block("PAYMENT_REMINDER_CUSTOMER_WA_ID_INVALID", "SKIPPED"); continue; }
            let locale: "en" | "ur";
            try {
              const conversation = JSON.parse(current.state_data ?? "{}") as { language?: unknown };
              if (current.pinned_locale === "en" || current.pinned_locale === "ur") locale=current.pinned_locale;
              else if (conversation.language === "en" || conversation.language === "ur") locale=conversation.language;
              else { await block("PAYMENT_REMINDER_CUSTOMER_LOCALE_UNVERIFIED", "SKIPPED"); continue; }
            } catch { await block("PAYMENT_REMINDER_CUSTOMER_LOCALE_UNVERIFIED", "SKIPPED"); continue; }
            const templateKeys: Record<number, string> = { 15:"REMINDER_15M",30:"REMINDER_30M",60:"REMINDER_60M",210:"FINAL_WARNING_210M",240:"GRACE_NOTICE_240M",270:"CANCELLATION_270M" };
            const templateKey=templateKeys[Number(payload.stageMinutes)];
            if (!templateKey) { await block("PAYMENT_REMINDER_STAGE_INVALID", "SKIPPED"); continue; }
            const template = await env.DB.prepare(`SELECT version,body,utility_template_name,utility_approved_at FROM payment_v2_template_versions
              WHERE template_key=? AND locale=? AND state IN ('PUBLISHED','SUPERSEDED') AND ((? IS NULL AND state='PUBLISHED') OR version=?)`).bind(templateKey,locale,current.pinned_template_version,current.pinned_template_version)
              .first<{ version:number;body:string;utility_template_name:string|null;utility_approved_at:string|null }>();
            if (!template?.body) { await block("PAYMENT_REMINDER_CMS_TEMPLATE_NOT_PUBLISHED", "BLOCKED_TEMPLATE"); continue; }
            const serviceWindow = isInsideWhatsAppServiceWindow(current.last_inbound_at);
            if (!serviceWindow && (env.PAYMENT_UTILITY_TEMPLATES_APPROVED !== "true" || !template.utility_template_name || !template.utility_approved_at)) { await block("PAYMENT_REMINDER_UTILITY_TEMPLATE_NOT_APPROVED", "BLOCKED_TEMPLATE"); continue; }
            const dueMinutes=Number(payload.stageMinutes)<240?240:270;
            const remainingMinutes=Math.max(0,dueMinutes-Number(payload.stageMinutes));
            const deadline=new Date(new Date(current.source_created_at).getTime()+dueMinutes*60_000).toLocaleString(locale==="ur"?"ur-PK":"en-PK",{timeZone:"Asia/Karachi"});
            const paymentMethod=current.method??(locale==="ur"?"فعال ادائیگی کا طریقہ منتخب کریں":"choose an available payment method");
            const values:Record<string,string>={orderNumber:current.order_number,amount:String(current.total_payable),deadline,remainingMinutes:String(remainingMinutes),paymentMethod};
            const text=template.body.replace(/\{(orderNumber|amount|deadline|remainingMinutes|paymentMethod)\}/g,(_match,key:string)=>values[key]??"");
            const parameters=[...template.body.matchAll(/\{(orderNumber|amount|deadline|remainingMinutes|paymentMethod)\}/g)].map((match)=>values[match[1]]??"");
            const provider=createWhatsAppProvider("meta",{enabled:env.META_PROVIDER_ENABLED==="true",graphVersion:env.META_GRAPH_VERSION??"v26.0",accessToken:env.META_ACCESS_TOKEN,phoneNumberId:env.META_PHONE_NUMBER_ID,verifyToken:env.WEBHOOK_VERIFY_TOKEN,appSecret:env.META_APP_SECRET});
            const send=serviceWindow?()=>provider.sendText(current.wa_id!,text):()=>provider.sendTemplate(current.wa_id!,template.utility_template_name!,parameters,locale);
            const delivery=await sendPaymentPart(env.DB,current.wa_id,payload.orderId,payload.stageId,"WHATSAPP_PAYMENT_REMINDER",send);
            if (delivery!=="SENT") throw new Error("PAYMENT_REMINDER_SEND_FAILED");
            const now=new Date().toISOString();
            await env.DB.batch([
              env.DB.prepare("UPDATE payment_reminder_v2_stages SET status='SENT',template_name=?,locale=?,template_version=?,rendered_text=?,sent_at=?,last_error=NULL,updated_at=? WHERE id=? AND status='QUEUED'").bind(template.utility_template_name??"SERVICE_WINDOW",locale,template.version,text,now,now,payload.stageId),
              env.DB.prepare("UPDATE outbox_jobs SET status='SENT',attempts=?,last_error=NULL,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,now,message.body.idempotencyKey)
            ]);
            message.ack();
            continue;
          } catch(error) {
            const failure=error instanceof Error&&/^[A-Z0-9_:-]{1,120}$/.test(error.message)?error.message:"PAYMENT_REMINDER_SEND_FAILED";
            if(nextAttempt>=5){const now=new Date().toISOString();await env.DB.batch([
              env.DB.prepare("UPDATE payment_reminder_v2_stages SET status='DEAD_LETTER',last_error=?,completed_at=?,updated_at=? WHERE idempotency_key=? AND status IN ('QUEUED','SENT')").bind(failure,now,now,message.body.idempotencyKey),
              env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER',attempts=?,last_error=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,now,message.body.idempotencyKey),
              env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"PAYMENT_REMINDER_DEAD_LETTER","SYSTEM","ORDER",message.body.entityId,crypto.randomUUID(),JSON.stringify({reason:failure,idempotencyKey:message.body.idempotencyKey}),now)
            ]);message.ack();continue;}
            const now=new Date().toISOString();const retryAt=new Date(Date.now()+retryDelaySeconds(nextAttempt)*1000).toISOString();
            await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY',attempts=?,last_error=?,available_at=?,updated_at=? WHERE idempotency_key=?").bind(nextAttempt,failure,retryAt,now,message.body.idempotencyKey).run();
            message.retry({delaySeconds:retryDelaySeconds(nextAttempt)});continue;
          }
        }
        if (message.body.kind === "WHATSAPP_PAYMENT_INSTRUCTIONS") {
          try {
            const outbox = await env.DB.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ payload_json: string }>();
            const payload = outbox ? JSON.parse(outbox.payload_json) as { orderId: string; orderNumber: string; amount: number; method: PaymentMethod; locale: "en" | "ur"; recipient?: string; requestKey?: string; message: string } : undefined;
            if (!payload?.recipient) throw new Error("PAYMENT_RECIPIENT_REQUIRED");
            if(await hasTable(env.DB,"cod_order_details")){
              const historicalCod=await env.DB.prepare("SELECT 1 FROM cod_order_details WHERE order_id=? AND status IN ('COD_PENDING','COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED') LIMIT 1").bind(payload.orderId).first();
              if(historicalCod){
                const blockedAt=new Date().toISOString();
                await env.DB.batch([
                  env.DB.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',attempts=?,last_error='COD_PAYMENT_INSTRUCTIONS_BLOCKED',updated_at=? WHERE idempotency_key=? AND status NOT IN ('SENT','DEAD_LETTER')").bind(nextAttempt,blockedAt,message.body.idempotencyKey),
                  env.DB.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"COD_PAYMENT_INSTRUCTIONS_BLOCKED","SYSTEM","ORDER",payload.orderId,crypto.randomUUID(),JSON.stringify({reason:"HISTORICAL_COD_ORDER"}),blockedAt)
                ]);
                message.ack();continue;
              }
            }
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
            const delivery = await deliverPaymentInstructions(env.DB, env.RECEIPTS, provider, payload.recipient, payload.orderId, payload.orderNumber, Number(payload.amount), payload.method, payload.locale ?? "en", payload.message, payload.requestKey ?? message.body.idempotencyKey, normalizePaymentMethodRow(row), env.PAYMENT_REMINDERS_V2_ENABLED === "true" && env.PAYMENT_AUTOMATION_V2_ENABLED === "true");
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
