import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index";
import admin from "../apps/admin/src/index";
import { codReferenceHmac, formatCustomerOrderStatus, formatPaymentMessage, getLatestOrderForWaId, MockWhatsAppProvider, persistFlowSubmission, selectPaymentMethod, storeReceipt } from "@gfs/core";
import { defaultPaymentChoiceRecoveryCopy, enqueueDuePaymentChoiceRecoveryStages, paymentChoiceRecoveryCopy } from "../apps/api/src/payment-choice-recovery";

// Synthetic fixtures only. SQLite executes the real migrations and journey SQL.
const sender = "923001234567";
const phoneId = "1323932417479627";
const secret = "synthetic-webhook-secret";
let sqlite: DatabaseSync;
let db: D1Database;
let sequence: number;
let sends: Array<Record<string, unknown>>;
let failNextSend: boolean;
let queueSend: ReturnType<typeof vi.fn>;
let receiptPuts: number;
let codEnabled: boolean;
let codRolloutMode: "OFF" | "TESTER_ONLY" | "PUBLIC";
let codTesterWaId: string;
const codHmacKey = "synthetic-guided-cod-hmac-key-v1-2026-synthetic";
let codRuntimeHmacKey = codHmacKey;
let beforeBatch: ((sql: string[]) => Promise<void> | void) | undefined;
let beforeRun: ((sql: string) => Promise<void> | void) | undefined;
let qrAvailable: boolean;
let qrReads: number;
let remindersEnabled: boolean;
let reminderAutomationEnabled: boolean;
// NON-PAYABLE PNG signature only, not an encoded or scannable payment QR.
const syntheticQrBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function statement(sql: string) {
  let values: SQLInputValue[] = [];
  const prepared = {
    sql,
    bind: (...args: SQLInputValue[]) => { values = args; return prepared; },
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => { await beforeRun?.(sql); return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) }, success: true }; }
  };
  return prepared;
}

function conversation(waId = sender) {
  const row = sqlite.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").get(waId);
  return row ? { state: row.state, data: JSON.parse(String(row.state_data)) as Record<string, unknown> } : undefined;
}

function lastInboundAt() {
  return sqlite.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id=?").get(sender)?.last_inbound_at as string | null | undefined;
}

function body() {
  const sent = sends.at(-1)!;
  return sent.type === "text" ? String((sent.text as { body: string }).body) : String((sent.interactive as { body: { text: string } }).body.text);
}

function buttons() {
  return (sends.at(-1)?.interactive as { action?: { buttons?: Array<{ reply: { id: string } }> } } | undefined)?.action?.buttons?.map((button) => button.reply.id) ?? [];
}

function env() {
  return { DB: db, RECEIPTS: { get: vi.fn(async () => { qrReads++; return qrAvailable ? { httpMetadata: { contentType: "image/png" }, arrayBuffer: async () => syntheticQrBytes.buffer } : null; }), put: vi.fn(async () => { receiptPuts++; }), delete: vi.fn(async () => undefined) }, EVENTS: { send: queueSend }, DEPLOYMENT_STATE: "LOCAL", WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true", META_PHONE_NUMBER_ID: phoneId, META_ACCESS_TOKEN: "synthetic-token", META_APP_SECRET: secret, META_CAPI_ENABLED: "false", WHATSAPP_CHECKOUT_MODE: "guided", COD_V1_ENABLED: codEnabled ? "true" : "false", COD_ROLLOUT_MODE: codRolloutMode, COD_TESTER_WA_ID: codTesterWaId, COD_REFERENCE_HMAC_KEY: codRuntimeHmacKey, PAYMENT_REMINDERS_V2_ENABLED: remindersEnabled ? "true" : "false", PAYMENT_AUTOMATION_V2_ENABLED: reminderAutomationEnabled ? "true" : "false", PAYMENT_UTILITY_TEMPLATES_APPROVED: "false" } as never;
}

async function callback(messages: Record<string, unknown>[], extraChanges: unknown[] = []) {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages } }, ...extraChanges] }] });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return api.fetch(new Request("https://api.example.test/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` }, body: payload }), env());
}

async function adminPost(path: string, body: Record<string, unknown>, referenceRequestsEnabled = "true", events: { send: typeof queueSend } = { send: vi.fn(async () => undefined) }) {
  const adminEnv = { DB: db, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", REFERENCE_REQUESTS_ENABLED: referenceRequestsEnabled, EVENTS: events } as never;
  const identity = { "cf-access-authenticated-user-email": "admin@example.test" };
  const csrfResponse = await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers: identity }), adminEnv);
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const cookie = `__Host-gfs_admin_csrf=${csrf.csrfToken}`;
  return admin.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: { ...identity, origin:"https://admin.example.test", cookie, "x-csrf-token": csrf.csrfToken, "content-type": "application/json" }, body: JSON.stringify(body) }), adminEnv);
}

async function inbound(input: string | Record<string, unknown>, id = `synthetic-inbound-${++sequence}`, waId = sender) {
  const message = { from: waId, id, timestamp: "1792497600", ...(typeof input === "string" ? { type: "text", text: { body: input } } : { type: "interactive", interactive: input }) };
  const response = await callback([message]);
  expect(response.status).toBe(200);
  return message;
}

const tap = (id: string) => ({ type: "button_reply", button_reply: { id, title: "Synthetic button" } });

async function reachReview(locale: "en" | "ur", fertilizer = false, waId = sender) {
  await inbound("START", undefined, waId);
  expect(buttons()).toEqual(["LANG_UR", "LANG_EN"]);
  await inbound(tap(locale === "ur" ? "LANG_UR" : "LANG_EN"), undefined, waId);
  expect(conversation(waId)?.state).toBe("OFFER");
  expect(buttons()).toEqual(["CONTINUE_ORDER", "CANCEL_ORDER"]);
  await inbound(tap("CONTINUE_ORDER"), undefined, waId);
  expect(conversation(waId)?.state).toBe("FERTILIZER");
  expect(buttons()).toEqual(["ADD_FERTILIZER", "SEEDS_ONLY"]);
  await inbound(tap(fertilizer ? "ADD_FERTILIZER" : "SEEDS_ONLY"), undefined, waId);
  expect(sends.at(-1)).toMatchObject({ interactive: { type: "list", action: { sections: [{ rows: [{ id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" }] }] } } });
  await inbound({ type: "list_reply", list_reply: { id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" } }, undefined, waId);
  for (const value of ["Synthetic Customer", "123 Synthetic Street", "Synthetic Park", "Synthetic City", "03001234567"]) await inbound(value, undefined, waId);
  expect(conversation(waId)?.state).toBe("REVIEW");
}

async function enableAuditedCodPolicy(feePkr = 125) {
  const updatedAt = new Date(Date.now() + 1).toISOString();
  const revision = crypto.randomUUID();
  sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(revision, "COD_CONFIGURATION_UPDATED", "ADMIN", "admin@example.test", "COD_CONFIGURATION", "default", crypto.randomUUID(), JSON.stringify({ enabled: true, feePkr, collectionPolicyHash: null, remittancePolicyHash: null }), updatedAt);
  sqlite.prepare("UPDATE cod_configuration SET enabled=1,fee_pkr=?,collection_policy_hash=NULL,remittance_policy_hash=NULL,revision=?,updated_by=?,updated_at=? WHERE id='default'").run(feePkr, revision, "admin@example.test", updatedAt);
}

async function enableSyntheticPaymentMethod(method: "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER" = "JAZZCASH") {
  const key = `synthetic-nonpayable/${method}.png`;
  const digest = await crypto.subtle.digest("SHA-256", syntheticQrBytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  sqlite.prepare("UPDATE payment_methods SET recipient_name=?,till_id=?,qr_r2_key=?,qr_sha256=?,qr_mime_type='image/png',qr_size_bytes=8,instructions=?,instructions_ur=?,reference_instruction=?,reference_instruction_ur=?,heading_ur=?,receipt_instructions=?,receipt_instructions_ur=? WHERE method=?")
    .run(`NON-PAYABLE ${method}`, `TEST-ONLY-${method}`, key, hash, "NON-PAYABLE TEST {amount} {recipientName} {tillId}", "NON-PAYABLE TEST {amount} {recipientName} {tillId}", "TEST {orderNumber}", "TEST {orderNumber}", "NON-PAYABLE TEST", "NON-PAYABLE TEST RECEIPT", "NON-PAYABLE TEST RECEIPT", method);
  sqlite.prepare(`INSERT INTO payment_qr_assets(id,method,source_r2_key,source_sha256,source_mime_type,source_size_bytes,derivative_r2_key,derivative_sha256,derivative_mime_type,derivative_size_bytes,derivative_width,derivative_height,payload_sha256,decoder_agreement,payload_match,scan_pass,decoder_versions,extractor_version,independent_ownership_verified,independent_evidence_ref,created_at,created_by)
    VALUES(?,?,?,?,'image/png',8,?,?,'image/png',8,1,1,?,1,1,1,'SYNTHETIC-NOT-SCANNABLE','SYNTHETIC',1,'SYNTHETIC-NON-PAYABLE',?,'TEST_FIXTURE')`).run(crypto.randomUUID(), method, key, hash, key, hash, hash, new Date().toISOString());
  sqlite.prepare("UPDATE payment_methods SET qr_owner_verified=1,enabled=1 WHERE method=?").run(method);
}

async function pendingPaymentFixture(method: "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER" = "JAZZCASH", locale: "en" | "ur" = "en") {
  await enableSyntheticPaymentMethod(method);
  const order = await persistFlowSubmission(db, { fullName: "NON-PAYABLE Synthetic", deliveryAddress: "SYNTHETIC PAYMENT DELIVERY TEST", nearbyPlace: "SYNTHETIC ONLY", city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, "SYNTHETIC-PAYMENT-DELIVERY", sender);
  const now = new Date().toISOString();
  sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_at,created_at,updated_at) VALUES('SYNTHETIC-PAYMENT-CONVERSATION',?,'PAYMENT_PENDING',?,?,?,?)").run(sender, JSON.stringify({ language: locale, orderId: order.orderId, orderNumber: order.orderNumber }), now, now, now);
  return { order, selected: await selectPaymentMethod(db, order.orderId, method, locale, sender, "SYNTHETIC-PAYMENT-DELIVERY-REQUEST") };
}

async function runPaymentJob(orderId: string, idempotencyKey: string) {
  const message = { body: { kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey, entityId: orderId, schemaVersion: 1 as const }, attempts: 1, ack: vi.fn(), retry: vi.fn() };
  await api.queue({ messages: [message] } as unknown as MessageBatch<typeof message.body>, env());
  return message;
}

async function createSyntheticPaymentReviewOrder(waId: string, idempotencyKey: string) {
  sqlite.prepare("INSERT OR IGNORE INTO cooldown_exemptions(wa_id,reason,created_by,created_at) VALUES(?,?,?,?)").run(waId,"SYNTHETIC_TEST_ONLY","TEST_FIXTURE",new Date().toISOString());
  const order = await persistFlowSubmission(db, { fullName: "NON-PAYABLE Synthetic", deliveryAddress: `SYNTHETIC ${idempotencyKey}`, nearbyPlace: `SYNTHETIC ${idempotencyKey}`, city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, idempotencyKey, waId);
  if(!order.quote)throw new Error("SYNTHETIC_QUOTE_MISSING");
  const payment = sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId) as { id: string };
  sqlite.prepare("UPDATE payments SET method='JAZZCASH',review_state='REVIEW',expected_amount=? WHERE id=?").run(order.quote.totalPayablePkr,payment.id);
  sqlite.prepare("UPDATE orders SET state='PAYMENT_REVIEW' WHERE id=?").run(order.orderId);
  const receipt=await storeReceipt({put:vi.fn(async(_key:string,_body:ArrayBuffer,options:R2PutOptions)=>options)} as unknown as R2Bucket,order.orderNumber,{body:new Uint8Array([4,5,6]).buffer,size:3,mimeType:"image/png",mediaId:`SYNTHETIC-${idempotencyKey}`});
  const now=new Date().toISOString();
  sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,provider_media_id,r2_object_key,mime_type,size_bytes,sha256,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(`receipt-${idempotencyKey}`,order.orderId,payment.id,`SYNTHETIC-${idempotencyKey}`,receipt.objectKey,"image/png",3,receipt.sha256,now,now);
  sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(`conversation-${idempotencyKey}`,waId,"PAYMENT_REFERENCE",JSON.stringify({language:"en",orderId:order.orderId,orderNumber:order.orderNumber,amountPkr:order.quote.totalPayablePkr}),null,null,now,now);
  return {order,paymentId:payment.id,amount:order.quote.totalPayablePkr};
}

describe("frozen V1 receipt hotfix", () => {
  it.each(["en", "ur"] as const)("keeps CONTACT for invalid mobile input and normalizes a valid hyphenated number (%s)", async (language) => {
    await inbound("START");
    await inbound(tap(language === "ur" ? "LANG_UR" : "LANG_EN"));
    await inbound(tap("CONTINUE_ORDER"));
    await inbound(tap("SEEDS_ONLY"));
    await inbound({ type: "list_reply", list_reply: { id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" } });
    for (const value of ["Synthetic Customer", "123 Synthetic Street", "Synthetic Park", "Synthetic City"]) await inbound(value);
    await inbound("0300 1234567");
    expect(conversation()?.state).toBe("CONTACT");
    expect(body()).toContain("03XX");
    await inbound("0300-1234567");
    expect(conversation()).toMatchObject({ state: "REVIEW", data: { contactNumber: "03001234567" } });
  });

  it("attaches a new inbound image to the sender's only eligible payment when the webhook creates a NEW conversation", async () => {
    const idempotencyKey="gfs206-v1-new-conversation-receipt";
    const order=await persistFlowSubmission(db,{fullName:"NON-PAYABLE Synthetic",deliveryAddress:"SYNTHETIC GFS206 RECEIPT TEST",nearbyPlace:"SYNTHETIC ONLY",city:"Synthetic City",contactNumber:"03001234567",productCode:"FREE_5_PACK_VEGETABLE_SEEDS",province:"Synthetic Province",fertilizerSelected:false},undefined,idempotencyKey,sender);
    if(!order.quote)throw new Error("SYNTHETIC_QUOTE_MISSING");
    const payment=sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId) as {id:string};
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING' WHERE id=?").run(order.orderId);
    sqlite.prepare("UPDATE payments SET method='JAZZCASH',review_state='PENDING',customer_transaction_reference=NULL,expected_amount=? WHERE id=?").run(order.quote.totalPayablePkr,payment.id);
    expect(conversation(sender)).toBeUndefined();
    const sendFetch=globalThis.fetch;
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
      const url=String(input);
      if(url.includes("synthetic-v1-media-id"))return Response.json({url:"https://synthetic-media.test/receipt.png",mime_type:"image/png",file_size:3});
      if(url==="https://synthetic-media.test/receipt.png")return new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"image/png"}});
      return sendFetch(input,init);
    }));

    const response=await callback([{from:sender,id:"synthetic-v1-image-event",timestamp:"1792497600",type:"image",image:{id:"synthetic-v1-media-id",mime_type:"image/png"}}]);

    expect(response.status).toBe(200);
    expect(conversation(sender)).toMatchObject({state:"PAYMENT_REFERENCE",data:{orderId:order.orderId,orderNumber:order.orderNumber}});
    expect(sqlite.prepare("SELECT order_id,payment_id FROM payment_receipts WHERE provider_media_id='synthetic-v1-media-id'").get()).toEqual({order_id:order.orderId,payment_id:payment.id});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(order.orderId)).toEqual({state:"PAYMENT_REVIEW",payment_status:"PENDING"});
    expect(sqlite.prepare("SELECT review_state,customer_transaction_reference FROM payments WHERE id=?").get(payment.id)).toEqual({review_state:"REVIEW",customer_transaction_reference:null});
    expect(receiptPuts).toBe(1);
    const audit=sqlite.prepare("SELECT correlation_id,metadata_json FROM audit_log WHERE action='RECEIPT_SUBMITTED' AND entity_id=?").get(payment.id) as {correlation_id:string;metadata_json:string};
    expect(audit.metadata_json).toContain('"associationEvidence":"UNIQUE_SENDER_PAYMENT"');
    expect(audit.metadata_json).not.toContain("synthetic-v1-media-id");
    expect(audit.metadata_json).not.toContain("synthetic-v1-image-event");
  });

  it("accepts a supported image document replying to an unrelated message and deduplicates the media id", async () => {
    const { order } = await pendingPaymentFixture("JAZZCASH", "en");
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      if (url.includes("synthetic-document-media")) return Response.json({ url: "https://synthetic-media.test/document.jpg", mime_type: "image/jpeg", file_size: 3 });
      if (url === "https://synthetic-media.test/document.jpg") return new Response(new Uint8Array([9, 8, 7]), { headers: { "content-type": "image/jpeg" } });
      return originalFetch(input, init);
    }));
    const document = { from: sender, id: "synthetic-document-event", timestamp: "1792497600", type: "document", document: { id: "synthetic-document-media", mime_type: "image/jpeg" }, context: { id: "synthetic-unrelated-chat-message" } };
    expect((await callback([document])).status).toBe(200);
    expect(sqlite.prepare("SELECT order_id,mime_type FROM payment_receipts WHERE provider_media_id=?").get("synthetic-document-media")).toEqual({ order_id: order.orderId, mime_type: "image/jpeg" });
    const audit = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='RECEIPT_SUBMITTED' AND entity_id=(SELECT id FROM payments WHERE order_id=?)").get(order.orderId) as { metadata_json: string };
    expect(audit.metadata_json).toContain('"associationEvidence":"UNMATCHED_REPLY_UNIQUE_SENDER_PAYMENT"');
    const sendsAfterReceipt = sends.length;
    expect((await callback([{ ...document, id: "synthetic-document-duplicate-event" }])).status).toBe(200);
    expect(sends).toHaveLength(sendsAfterReceipt);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(order.orderId)).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(order.orderId)).toEqual({ state: "PAYMENT_REVIEW", payment_status: "PENDING" });
  });

  it.each(["en", "ur"] as const)("accepts an exact payment reply for a customer with no stored Meta wa_id and sends the %s review acknowledgement once", async (language) => {
    const waId="923000000001",idempotencyKey=`gfs208-missing-wa-id-${language}`,paymentMessageId=`synthetic-payment-message-${language}`;
    const order=await persistFlowSubmission(db,{fullName:"NON-PAYABLE Synthetic",deliveryAddress:`SYNTHETIC ${idempotencyKey}`,nearbyPlace:"SYNTHETIC ONLY",city:"Synthetic City",contactNumber:"03000000001",productCode:"FREE_5_PACK_VEGETABLE_SEEDS",province:"Synthetic Province",fertilizerSelected:false},undefined,idempotencyKey,waId);
    if(!order.quote)throw new Error("SYNTHETIC_QUOTE_MISSING");
    const payment=sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId) as {id:string};
    sqlite.prepare("UPDATE customers SET wa_id=NULL,whatsapp_number=?,normalized_whatsapp_number=NULL WHERE id=?").run(waId,order.customerId);
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING' WHERE id=?").run(order.orderId);
    sqlite.prepare("UPDATE payments SET method='EASYPAISA',review_state='PENDING',expected_amount=? WHERE id=?").run(order.quote.totalPayablePkr,payment.id);
    sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,order_id,customer_id,kind,provider_message_id,status,attempt_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(`outbound-${idempotencyKey}`,idempotencyKey,order.orderId,order.customerId,"WHATSAPP_PAYMENT_TEXT",paymentMessageId,"SENT",1,new Date().toISOString(),new Date().toISOString());
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`conversation-${idempotencyKey}`,waId,"PAYMENT_PENDING",JSON.stringify({language,orderId:order.orderId,orderNumber:order.orderNumber}),new Date().toISOString(),new Date().toISOString());
    const sendFetch=globalThis.fetch;
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
      const url=String(input);
      if(url.includes("synthetic-wamid-media-id"))return Response.json({url:"https://synthetic-media.test/non-payment.png",mime_type:"image/png",file_size:3});
      if(url==="https://synthetic-media.test/non-payment.png")return new Response(new Uint8Array([7,8,9]),{headers:{"content-type":"image/png"}});
      return sendFetch(input,init);
    }));
    const image={from:waId,id:`synthetic-image-event-${language}`,timestamp:"1792497600",type:"image",image:{id:`synthetic-wamid-media-id-${language}`,mime_type:"image/png"},context:{id:paymentMessageId}};

    expect((await callback([image])).status).toBe(200);
    expect(body()).toBe(language === "ur" ? `آرڈر ${order.orderNumber} کی رسید موصول ہو گئی۔ ادائیگی ایڈمن کے جائزے میں ہے۔ تصدیق کے بعد اطلاع دی جائے گی۔` : `Receipt received for order ${order.orderNumber}. Your payment is under Admin review. We will notify you after verification.`);
    expect(sqlite.prepare("SELECT order_id,payment_id FROM payment_receipts WHERE provider_media_id=?").get(`synthetic-wamid-media-id-${language}`)).toEqual({order_id:order.orderId,payment_id:payment.id});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(order.orderId)).toEqual({state:"PAYMENT_REVIEW",payment_status:"PENDING"});
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(payment.id)).toEqual({review_state:"REVIEW"});
    expect(receiptPuts).toBe(1);
    const outboundCount=sends.length;
    expect((await callback([image])).status).toBe(200);
    expect(sends).toHaveLength(outboundCount);
    expect(receiptPuts).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(order.orderId)).toEqual({count:1});
    const audit=sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='RECEIPT_SUBMITTED' AND entity_id=?").get(payment.id) as {metadata_json:string};
    expect(audit.metadata_json).toContain('"associationEvidence":"PAYMENT_REPLY_WAMID"');
    expect(audit.metadata_json).not.toContain(paymentMessageId);

    const ambiguousOrder=await persistFlowSubmission(db,{fullName:"NON-PAYABLE Synthetic",deliveryAddress:`SYNTHETIC ${idempotencyKey} SECOND`,nearbyPlace:"SYNTHETIC ONLY",city:"Synthetic City",contactNumber:"03000000001",productCode:"FREE_5_PACK_VEGETABLE_SEEDS",province:"Synthetic Province",fertilizerSelected:false},undefined,`${idempotencyKey}-second`,waId);
    if(!ambiguousOrder.quote)throw new Error("SYNTHETIC_SECOND_QUOTE_MISSING");
    const secondPayment=sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(ambiguousOrder.orderId) as {id:string};
    sqlite.prepare("UPDATE customers SET wa_id=NULL,whatsapp_number=?,normalized_whatsapp_number=NULL WHERE id=?").run(waId,ambiguousOrder.customerId);
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING' WHERE id=?").run(ambiguousOrder.orderId);
    sqlite.prepare("UPDATE payments SET review_state='PENDING' WHERE id=?").run(secondPayment.id);
    const unassociatedImage={from:waId,id:`synthetic-ambiguous-image-event-${language}`,timestamp:"1792497601",type:"image",image:{id:`synthetic-unassociated-media-id-${language}`,mime_type:"image/png"}};
    expect((await callback([unassociatedImage])).status).toBe(200);
    expect(sends).toHaveLength(outboundCount);
    expect(receiptPuts).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(ambiguousOrder.orderId)).toEqual({count:0});
  });
});

describe("GFS-221 additive V1-compatible COD path", () => {
  it("creates only the bounded +15/+210 recovery stages for a new no-method order", async () => {
    const base = new Date(Date.now() - 16 * 60_000);
    const order = await persistFlowSubmission(db, { fullName: "NON-PAYABLE Synthetic", deliveryAddress: "SYNTHETIC RECOVERY", nearbyPlace: "SYNTHETIC ONLY", city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, "SYNTHETIC-PAYMENT-CHOICE-RECOVERY", sender);
    const payment = sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId) as { id: string };
    sqlite.prepare("UPDATE orders SET created_at=?,state='DETAILS_COMPLETED',payment_status='PENDING' WHERE id=?").run(base.toISOString(), order.orderId);
    sqlite.prepare("UPDATE payments SET method=NULL,review_state='PENDING' WHERE id=?").run(payment.id);
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("synthetic-recovery-conversation", sender, "PAYMENT_METHOD", JSON.stringify({ language: "en", orderId: order.orderId, orderNumber: order.orderNumber }), "synthetic-recovery-inbound", base.toISOString(), base.toISOString(), base.toISOString());
    const first = await enqueueDuePaymentChoiceRecoveryStages(db, new Date(base.getTime() + 16 * 60_000), true, new Date(base.getTime() - 60_000).toISOString());
    expect(first.queued).toBe(1);
    expect(sqlite.prepare("SELECT stage_minutes,status FROM payment_choice_recovery_stages WHERE order_id=? ORDER BY stage_minutes").all(order.orderId)).toEqual([{ stage_minutes: 15, status: "QUEUED" }, { stage_minutes: 210, status: "PENDING" }]);
    const second = await enqueueDuePaymentChoiceRecoveryStages(db, new Date(base.getTime() + 211 * 60_000), true, new Date(base.getTime() - 60_000).toISOString());
    expect(second.queued).toBe(1);
    expect(sqlite.prepare("SELECT stage_minutes,status FROM payment_choice_recovery_stages WHERE order_id=? ORDER BY stage_minutes").all(order.orderId)).toEqual([{ stage_minutes: 15, status: "QUEUED" }, { stage_minutes: 210, status: "QUEUED" }]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_CHOICE_RECOVERY' AND entity_id=?").get(order.orderId)).toEqual({ count: 2 });
  });

  it("keeps the +15 and +210 recovery copy distinct in both locales and renders only approved values", async () => {
    const values = { orderNumber: "SYNTHETIC-302", amount: 500, deliveryFee: 250, codFee: 125 };
    const firstEn = await paymentChoiceRecoveryCopy(db, 15, "en", values);
    const finalEn = await paymentChoiceRecoveryCopy(db, 210, "en", values);
    const finalUr = await paymentChoiceRecoveryCopy(db, 210, "ur", values);
    const noCod = await paymentChoiceRecoveryCopy(db, 210, "en", { orderNumber: "SYNTHETIC-302", amount: 500, deliveryFee: 250 });
    expect(firstEn.text).toContain("Your Free Seeds Order Is Almost Ready");
    expect(finalEn.text).toContain("Your Free Seeds Order Is Still Awaiting Your Choice");
    expect(finalEn.text).toContain("PKR 125");
    expect(finalUr.text).toContain("آپ کے مفت بیجوں کے آرڈر");
    expect(noCod.text).not.toContain("COD adds");
    expect(firstEn.text).not.toBe(finalEn.text);
    expect(firstEn.text).not.toContain("{orderNumber}");
    expect(defaultPaymentChoiceRecoveryCopy(15, "en")).toContain("{deliveryFee}");
  });

  it("separates review confirmation from payment choice and advance methods", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    codRolloutMode = "PUBLIC";
    await reachReview("en");
    expect(buttons()).toEqual(["CONFIRM_ORDER", "CANCEL_ORDER"]);
    const before = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count);
    await inbound(tap("CONFIRM_ORDER"));
    expect(conversation()?.state).toBe("PAYMENT_METHOD");
    expect(buttons()).toEqual(["ADVANCE_PAYMENT", "COD"]);
    expect(Number((sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count)).toBe(before + 1);
    expect(sqlite.prepare("SELECT kind,order_id,status FROM outbound_messages WHERE kind='PAYMENT_CHOICE' ORDER BY created_at DESC LIMIT 1").get()).toMatchObject({ kind: "PAYMENT_CHOICE", order_id: expect.any(String), status: "SENT" });
    await inbound(tap("ADVANCE_PAYMENT"));
    expect(conversation()?.state).toBe("PAYMENT_METHOD");
    expect(buttons()).not.toContain("ADVANCE_PAYMENT");
    expect(buttons()).not.toContain("COD");
    expect(buttons()).toContain("PAY_JAZZCASH");
    expect(body()).not.toContain("Choose payment method: Advance Payment or Cash on Delivery");
  });

  it("cancels from review without creating an order or payment", async () => {
    await reachReview("en");
    expect(buttons()).toEqual(["CONFIRM_ORDER", "CANCEL_ORDER"]);
    await inbound(tap("CANCEL_ORDER"));
    expect(conversation()?.state).toBe("CANCELLED");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get()).toEqual({ count: 0 });
  });

  it("uses two review payment choices and creates one unheld public COD order", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    codRolloutMode = "PUBLIC";
    await reachReview("en", true);
    expect(buttons()).toEqual(["CONFIRM_ORDER", "CANCEL_ORDER"]);
    expect(body()).toContain("🛒 *Order Summary*");
    expect(body()).toContain("Free Vegetables Seeds (5 Packs): FREE");
    expect(body()).toContain("Micro Nutrients (25g): PKR 75");
    expect(body()).toContain("Delivery Fee: PKR 125");
    expect(body()).toContain("*Order Total: PKR 200*");
    expect(body()).toContain("Please confirm or cancel your order.");
    expect(body()).not.toContain("Choose payment:");
    expect(body()).not.toContain("additional PKR 125 collection fee");
    expect(body()).not.toContain("Advance total");
    expect(body()).not.toContain("COD fee: PKR 125");
    expect(body()).not.toContain("COD total");
    expect(body()).not.toContain("Place Order");
    await inbound(tap("CONFIRM_ORDER"), "synthetic-public-confirm-order");
    expect(buttons()).toEqual(["ADVANCE_PAYMENT", "COD"]);
    await inbound(tap("COD"), "synthetic-public-cod-choice");
    expect(conversation()?.state).toBe("COD_CONFIRM");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
    expect(buttons()).toEqual(["CONFIRM_COD_ORDER", "ADVANCE_PAYMENT"]);
    await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-public-cod-confirm");
    const order = sqlite.prepare("SELECT order_number,internal_sequence,internal_sequence_date FROM orders").get() as { order_number: string; internal_sequence: number; internal_sequence_date: string };
    expect(order.order_number).toMatch(/^FS-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
    expect(order.internal_sequence).toBe(1);
    expect(order.internal_sequence_date).toBe(new Date().toISOString().slice(0, 10).replaceAll("-", ""));
    expect(sqlite.prepare("SELECT test_hold FROM cod_order_details").get()).toEqual({ test_hold: 0 });
  });

  it("keeps registered tester COD blocked but permits one audited legacy-public release", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-held-cod-confirm");
    const held = sqlite.prepare("SELECT id,order_number FROM orders").get() as { id: string; order_number: string };
    const blocked = await adminPost(`/api/orders/${held.id}/cod-hold-release`, { confirmation: held.order_number, provenanceVerified: true, provenanceReference: "PUBLIC-COD-TEST-001", reason: "Synthetic tester must remain held" });
    expect(blocked.status).toBe(409);
    sqlite.prepare("UPDATE audit_log SET metadata_json=json_remove(metadata_json,'$.admission','$.testHold') WHERE entity_type='ORDER' AND entity_id=? AND action='COD_ORDER_CONFIRMED'").run(held.id);
    const released = await adminPost(`/api/orders/${held.id}/cod-hold-release`, { confirmation: held.order_number, provenanceVerified: true, provenanceReference: "PUBLIC-COD-LEGACY-001", reason: "Synthetic legacy public provenance verified" });
    expect(released.status).toBe(200);
    expect(sqlite.prepare("SELECT test_hold FROM cod_order_details WHERE order_id=?").get(held.id)).toEqual({ test_hold: 0 });
    const packing = await adminPost(`/api/orders/${held.id}/transition`, { from: "COD_PENDING", to: "PACKING", confirmation: held.order_number });
    expect(packing.status).toBe(200);
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(held.id)).toEqual({ state: "PACKING" });
  });

  it("keeps COD off even for the configured tester when rollout mode is OFF", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    codRolloutMode = "OFF";
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    expect(buttons()).toEqual(["PAY_JAZZCASH"]);
    expect(body()).not.toContain("Cash on Delivery");
  });

  it("admits non-testers only when rollout mode is PUBLIC", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    codRolloutMode = "PUBLIC";
    const nonTester = "923001234568";
    await reachReview("en", false, nonTester);
    await inbound(tap("PLACE_ORDER"), "synthetic-public-place-order", nonTester);
    expect(buttons()).toEqual(["ADVANCE_PAYMENT", "COD"]);
  });

  it("normalizes the configured tester identity before admitting COD", async () => {
    await enableAuditedCodPolicy();
    codTesterWaId = `+${sender}`;
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    expect(buttons()).toEqual(["ADVANCE_PAYMENT", "COD"]);
  });

  it("fails closed for non-allowlisted customers while preserving Advance checkout", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    const nonTester = "923001234568";
    await reachReview("en", false, nonTester);
    await inbound(tap("PLACE_ORDER"), "synthetic-non-tester-place-order", nonTester);
    expect(conversation(nonTester)?.state).toBe("PAYMENT_METHOD");
    expect(buttons()).toEqual(["PAY_JAZZCASH"]);
    expect(body()).not.toContain("Cash on Delivery");
    await inbound(tap("COD"), "synthetic-non-tester-cod", nonTester);
    expect(conversation(nonTester)?.state).toBe("PAYMENT_METHOD");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
  });

  it("fails closed when the protected tester configuration is absent", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    codTesterWaId = "";
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    expect(buttons()).toEqual(["PAY_JAZZCASH"]);
    expect(body()).not.toContain("Cash on Delivery");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
  });

  it.each([
    { locale: "en", intakeEnabled: true },
    { locale: "en", intakeEnabled: false },
    { locale: "ur", intakeEnabled: true },
    { locale: "ur", intakeEnabled: false }
  ] as const)("recovers the same failed COD confirmation reply in $locale with intake $intakeEnabled", async ({ locale, intakeEnabled }) => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview(locale, true);
    await inbound(tap("PLACE_ORDER"));
    const orderId = String(conversation()?.data.orderId);
    const orderNumber = String(conversation()?.data.orderNumber);
    await inbound(tap("COD"));
    const sendsBeforeConfirmation = sends.length;
    failNextSend = true;
    const confirmation = await inbound(tap("CONFIRM_COD_ORDER"), `synthetic-failed-cod-confirmation-${locale}-${intakeEnabled}`);
    expect(sends).toHaveLength(sendsBeforeConfirmation);
    expect(conversation()?.state).toBe("COD_PENDING");
    const persistedCod = sqlite.prepare("SELECT * FROM cod_order_details WHERE order_id=?").get(orderId);
    const confirmationAudit = sqlite.prepare("SELECT * FROM audit_log WHERE action='COD_ORDER_CONFIRMED' AND entity_id=?").get(orderId);
    expect(sqlite.prepare("SELECT status,attempt_count,provider_message_id FROM outbound_messages WHERE idempotency_key=?").get(`conversation_reply:${confirmation.id}`)).toEqual({ status: "FAILED", attempt_count: 1, provider_message_id: null });

    // Recovery must use the immutable saved order/quote, not stale conversation display fields.
    const cachedData: Record<string, unknown> = { ...conversation()!.data, orderNumber: "SYNTHETIC-STALE-DISPLAY", amountPkr: 1 };
    delete cachedData.codQuote;
    sqlite.prepare("UPDATE whatsapp_conversations SET state_data=? WHERE wa_id=?").run(JSON.stringify(cachedData), sender);
    const winningConversation = conversation();
    codEnabled = intakeEnabled;
    if (!intakeEnabled) codRuntimeHmacKey = "";
    expect((await callback([confirmation])).status).toBe(200);
    expect(sends).toHaveLength(sendsBeforeConfirmation + 1);
    expect(body()).toContain(locale === "en" ? "confirmed for Cash on Delivery" : "وصولی پر ادائیگی کے لیے تصدیق ہو گیا");
    expect(body()).toContain(orderNumber);
    expect(body()).toContain("PKR 325");
    expect(body()).not.toContain("SYNTHETIC-STALE-DISPLAY");
    expect(buttons()).toEqual(["CHECK_ORDER"]);
    expect(conversation()).toEqual(winningConversation);
    expect(sqlite.prepare("SELECT * FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual(persistedCod);
    expect(sqlite.prepare("SELECT * FROM audit_log WHERE action='COD_ORDER_CONFIRMED' AND entity_id=?").get(orderId)).toEqual(confirmationAudit);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT status,attempt_count FROM outbound_messages WHERE idempotency_key=?").get(`conversation_reply:${confirmation.id}`)).toEqual({ status: "SENT", attempt_count: 2 });

    expect((await callback([confirmation])).status).toBe(200);
    expect(sends).toHaveLength(sendsBeforeConfirmation + 1);
    await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-unrelated-confirmation-event");
    expect(body()).not.toContain(locale === "en" ? "is confirmed for COD" : "COD کے لیے تصدیق ہو گیا");
    expect(conversation()).toEqual(winningConversation);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 1 });
  });

  it("does not confirm an undisplayed COD fee after the policy changes", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    const orderId = (conversation()?.data as { orderId: string }).orderId;
    await inbound(tap("COD"));
    expect(body()).toContain("TOTAL ON DELIVERY: PKR 325");
    await enableAuditedCodPolicy(); // Same fee; a new audited revision invalidates the displayed quote.
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(orderId)).toEqual({ state: "DETAILS_COMPLETED" });
    expect(body()).toContain("fresh quote");
    await inbound(tap("COD"));
    expect(body()).toContain("TOTAL ON DELIVERY: PKR 325");
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT quoted_total_pkr FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual({ quoted_total_pkr: 325 });
  });

  it("does not admit COD after the order's province is disabled", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    const orderId = (conversation()?.data as { orderId: string }).orderId;
    await inbound(tap("COD"));
    sqlite.prepare("UPDATE province_delivery_rates SET enabled=0 WHERE province='Synthetic Province'").run();
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual({ count: 0 });
  });

  it.each(["policy revision", "province"])("rechecks %s inside the winning COD INSERT, after the pre-read", async (change) => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    const orderId = String(conversation()?.data.orderId);
    beforeBatch = async (sql) => {
      if (!sql[0]?.startsWith("INSERT OR IGNORE INTO cod_order_details")) return;
      beforeBatch = undefined;
      if (change === "province") sqlite.prepare("UPDATE province_delivery_rates SET enabled=0").run();
      else await enableAuditedCodPolicy(); // Same price, different authorization revision.
    };
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(orderId)).toEqual({ state: "DETAILS_COMPLETED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind LIKE '%PAYMENT%'").get()).toEqual({ count: 0 });
  });

  it.each(["advance method", "advance audit", "receipt", "approval"])("refuses COD over inherited %s history", async (history) => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    const orderId = String(conversation()?.data.orderId);
    const paymentId = String(sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(orderId)!.id);
    if (history === "advance method") sqlite.prepare("UPDATE payments SET method='JAZZCASH' WHERE id=?").run(paymentId);
    if (history === "approval") sqlite.prepare("UPDATE payments SET approved_amount=125,approved_by='SYNTHETIC',approved_at='2026-01-01' WHERE id=?").run(paymentId);
    if (history === "advance audit") sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,'PAYMENT_METHOD_SELECTED','CUSTOMER','ORDER',?,'SYNTHETIC','{}','2026-01-01')").run(crypto.randomUUID(), orderId);
    if (history === "receipt") sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,provider_media_id,r2_object_key,mime_type,size_bytes,sha256,submitted_at,created_at) VALUES('SYNTHETIC-RECEIPT',?,?,'SYNTHETIC-MEDIA','NON-PAYABLE','image/png',8,?,'2026-01-01','2026-01-01')").run(orderId, paymentId, "a".repeat(64));
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 0 });
    expect(receiptPuts).toBe(0);
  });

  it("has exactly one confirmation winner and terminal audit under concurrent confirmations", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    const quote = conversation()?.data.codQuote as Record<string, unknown>;
    expect(quote).toMatchObject({ baseAmountPkr: 125, feePkr: 125, totalPkr: 250 });
    const sentBefore = sends.length;
    beforeBatch = async (sql) => {
      if (!sql[0]?.startsWith("INSERT OR IGNORE INTO cod_order_details")) return;
      beforeBatch = undefined;
      await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-winning-confirmation");
    };
    await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-losing-confirmation");
    expect(conversation()?.state).toBe("COD_PENDING");
    expect(sends).toHaveLength(sentBefore + 1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT policy_revision,collection_policy_hash,remittance_policy_hash,test_hold FROM cod_order_details").get()).toEqual({ policy_revision: quote.policyRevision, collection_policy_hash: null, remittance_policy_hash: null, test_hold: 1 });
  });

  it("does not let a stale Advance Payment back callback overwrite a COD winner", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    beforeRun = async (sql) => {
      if (!sql.includes("WHERE whatsapp_conversations.state=?")) return;
      beforeRun = undefined;
      await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-cod-wins-back-race");
    };
    await inbound(tap("ADVANCE_PAYMENT"), "synthetic-stale-back");
    expect(conversation()?.state).toBe("COD_PENDING");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 1 });
  });

  it("makes advance selection lose atomically to COD without payment writes, outbox, QR or audit", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    const orderId = String(conversation()?.data.orderId);
    beforeBatch = async (sql) => {
      if (!sql[0]?.startsWith("UPDATE payments SET method=")) return;
      beforeBatch = undefined;
      await inbound(tap("CONFIRM_COD_ORDER"));
    };
    await expect(selectPaymentMethod(db, orderId, "JAZZCASH", "en", sender, "SYNTHETIC-LOSING-ADVANCE")).rejects.toThrow("PAYMENT_SELECTION_CONFLICT");
    expect(sqlite.prepare("SELECT method,review_state FROM payments WHERE order_id=?").get(orderId)).toEqual({ method: null, review_state: "COD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_METHOD_SELECTED'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 0 });
    expect(qrReads).toBe(0);
  });

  it("makes COD lose atomically to an advance selection", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    const orderId = String(conversation()?.data.orderId);
    beforeBatch = async (sql) => {
      if (!sql[0]?.startsWith("INSERT OR IGNORE INTO cod_order_details")) return;
      beforeBatch = undefined;
      await selectPaymentMethod(db, orderId, "JAZZCASH", "en", sender, "SYNTHETIC-WINNING-ADVANCE");
    };
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(orderId)).toEqual({ state: "PAYMENT_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_ORDER_CONFIRMED'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 1 });
    expect(qrReads).toBe(0);
  });

  it("retains COD obligation status and blocks advance/receipt when intake is disabled", async () => {
    await enableAuditedCodPolicy();
    await enableSyntheticPaymentMethod();
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    await inbound(tap("COD"));
    await inbound(tap("CONFIRM_COD_ORDER"));
    codEnabled = false;
    await inbound(tap("CHECK_ORDER"));
    expect(body()).toContain("Total Due on Delivery: PKR 250");
    await inbound(tap("PAY_JAZZCASH"));
    await callback([{ from: sender, id: "synthetic-disabled-cod-receipt", type: "image", image: { id: "synthetic-media", mime_type: "image/png" } }]);
    expect(conversation()?.state).toBe("COD_PENDING");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 0 });
    expect(receiptPuts).toBe(0);
    expect(qrReads).toBe(0);
  });

  it("uses the audit referenced by the revision rather than the latest timestamp", async () => {
    await enableAuditedCodPolicy();
    sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,'COD_CONFIGURATION_UPDATED','ADMIN','admin@example.test','COD_CONFIGURATION','default','SYNTHETIC','{}','2099-01-01')").run(crypto.randomUUID());
    codEnabled = true;
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    expect(buttons()).toContain("COD");
    await inbound(tap("COD"));
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(conversation()?.state).toBe("COD_PENDING");
  });

  it("quotes COD on the existing order, confirms once, and refuses advance receipts", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en", true);
    expect(body()).toContain("🛒 *Order Summary*");
    expect(body()).toContain("Free Vegetables Seeds (5 Packs): FREE");
    expect(body()).toContain("Micro Nutrients (25g): PKR 75");
    expect(body()).toContain("Delivery Fee: PKR 125");
    expect(body()).toContain("*Order Total: PKR 200*");
    expect(body()).toContain("Please confirm or cancel your order.");
    expect(body()).not.toContain("Choose payment:");
    expect(body()).not.toContain("additional PKR 125 collection fee");
    expect(body()).not.toContain("COD total");
    const countBefore = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count);
    await inbound(tap("PLACE_ORDER"));
    const orderData = conversation()?.data as { orderId: string; orderNumber: string; amountPkr: number };
    expect(conversation()?.state).toBe("PAYMENT_METHOD");
    expect(buttons()).toEqual(["ADVANCE_PAYMENT", "COD"]);
    expect(body()).not.toContain("Choose payment method: Advance Payment or Cash on Delivery (COD). COD orders include an additional PKR 125 cash collection fee.");
    expect(body()).toContain("Your Order Has Been Received");
    expect(body().match(/Cash on Delivery/g)).toHaveLength(1);
    expect((sends.at(-1)?.interactive as { action: { buttons: Array<{ reply: { title: string } }> } }).action.buttons.map((button) => button.reply.title)).toEqual(["Advance Payment", "Cash on Delivery"]);
    await inbound(tap("COD"));
    expect(conversation()?.state).toBe("COD_CONFIRM");
    expect(body()).toContain("Order amount including delivery: PKR 200");
    expect(body()).toContain("COD collection fee: PKR 125");
    expect(body()).toContain("TOTAL ON DELIVERY: PKR 325");
    expect(body()).not.toContain("Free Seeds (5 packs)");
    expect(body()).not.toContain("Micro Nutrients (25g)");
    expect(buttons()).toEqual(["CONFIRM_COD_ORDER", "ADVANCE_PAYMENT"]);
    expect(sqlite.prepare("SELECT state,total_payable FROM orders WHERE id=?").get(orderData.orderId)).toEqual({ state: "DETAILS_COMPLETED", total_payable: 200 });
    const sendCountBeforeConfirmation = sends.length;

    const confirmedEvent = await inbound(tap("CONFIRM_COD_ORDER"), "synthetic-cod-confirmation-retry");

    expect(conversation()?.state).toBe("COD_PENDING");
    expect(body()).toContain("confirmed for Cash on Delivery");
    expect(body()).toContain(orderData.orderNumber);
    expect(sends).toHaveLength(sendCountBeforeConfirmation + 1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: countBefore + 1 });
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id=?").get(orderData.orderId)).toEqual({ state: "COD_PENDING", payment_status: "COD_PENDING", total_payable: 200 });
    expect(sqlite.prepare("SELECT method,review_state,expected_amount FROM payments WHERE order_id=?").get(orderData.orderId)).toEqual({ method: null, review_state: "COD_PENDING", expected_amount: 200 });
    expect(sqlite.prepare("SELECT base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status FROM cod_order_details WHERE order_id=?").get(orderData.orderId)).toEqual({ base_amount_pkr: 200, cod_fee_pkr: 125, quoted_total_pkr: 325, status: "COD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(orderData.orderId)).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE entity_id=? AND kind LIKE '%PAYMENT%'").get(orderData.orderId)).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE entity_id=? AND (kind LIKE '%REMINDER%' OR kind LIKE '%QR%')").get(orderData.orderId)).toEqual({ count: 0 });
    const audit = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='COD_ORDER_CONFIRMED' AND entity_id=?").get(orderData.orderId) as { metadata_json: string };
    expect(audit.metadata_json).toContain('"codFeePkr":125');
    expect(audit.metadata_json).not.toContain(codHmacKey);

    const adminResponse = await admin.fetch(new Request("https://admin.example.test/api/orders?tab=all", { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), { DB: db, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never);
    const adminOrders = await adminResponse.json() as { orders: Array<{ id: string; paymentStatus: string; paymentReviewState: string; expectedAmountPkr: number; totalPayablePkr: number; codBaseAmountPkr: number; codQuotedTotalPkr: number }> };
    const adminOrder = adminOrders.orders.find((item) => item.id === orderData.orderId)!;
    expect(adminOrder).toMatchObject({ paymentMethod: "COD", paymentStatus: "COD_PENDING", paymentReviewState: "COD_PENDING", expectedAmountPkr: 325, totalPayablePkr: 325, codBaseAmountPkr: 200, codQuotedTotalPkr: 325 });

    const sendsAfterConfirmation = sends.length;
    await callback([confirmedEvent]);
    expect(sends).toHaveLength(sendsAfterConfirmation);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id=?").get(orderData.orderId)).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT base_amount_pkr,cod_fee_pkr,quoted_total_pkr FROM cod_order_details WHERE order_id=?").get(orderData.orderId)).toEqual({ base_amount_pkr: 200, cod_fee_pkr: 125, quoted_total_pkr: 325 });

    await inbound(tap("ADVANCE_PAYMENT"), "synthetic-stale-advance-after-cod");
    expect(body()).toContain("This order is already confirmed for Cash on Delivery. Use Check Order to view its status.");
    expect(conversation()?.state).toBe("COD_PENDING");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id=?").get(orderData.orderId)).toEqual({ count: 1 });

    await inbound(tap("CHECK_ORDER"));
    expect(body()).toContain("Order Number:");
    expect(body()).toContain("Payment Method: COD");
    expect(body()).toContain("Order Status: COD Confirmed/Pending Dispatch");
    expect(body()).toContain("Total Due on Delivery: PKR 325");

    const image = { from: sender, id: "synthetic-cod-receipt-image", timestamp: "1792497600", type: "image", image: { id: "synthetic-cod-media-id", mime_type: "image/png" } };
    const sentBeforeImage = sends.length;
    expect((await callback([image])).status).toBe(200);
    expect(sends).toHaveLength(sentBeforeImage);
    expect(receiptPuts).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(orderData.orderId)).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(orderData.orderId)).toEqual({ state: "COD_PENDING", payment_status: "COD_PENDING" });

    const adminEnv = { DB: db, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never;
    const identity = { "cf-access-authenticated-user-email": "admin@example.test" };
    const detailBefore = await admin.fetch(new Request(`https://admin.example.test/api/orders/${orderData.orderId}`, { headers: identity }), adminEnv);
    expect((await detailBefore.json() as { order: { canPrintShippingLabel: boolean } }).order.canPrintShippingLabel).toBe(false);
    expect((await admin.fetch(new Request(`https://admin.example.test/api/orders/${orderData.orderId}/shipping-label?format=4x6`, { headers: identity }), adminEnv)).status).toBe(409);
    expect(sqlite.prepare("SELECT test_hold FROM cod_order_details WHERE order_id=?").get(orderData.orderId)).toEqual({ test_hold: 1 });
    expect((await adminPost(`/api/orders/${orderData.orderId}/transition`, { from: "COD_PENDING", to: "PACKING", confirmation: orderData.orderNumber })).status).toBe(409);
    expect((await admin.fetch(new Request(`https://admin.example.test/api/orders/${orderData.orderId}/shipping-label?format=4x6`, { headers: identity }), adminEnv)).status).toBe(409);
    expect((await adminPost(`/api/orders/${orderData.orderId}/tracking`, { trackingNumber: "SYNTHETIC-TRACK-001", confirmation: orderData.orderNumber })).status).toBe(409);
    const detailWithTracking = await admin.fetch(new Request(`https://admin.example.test/api/orders/${orderData.orderId}`, { headers: identity }), adminEnv);
    expect((await detailWithTracking.json() as { order: { paymentMethod: string; expectedAmountPkr: number; codBaseAmountPkr: number; canPrintShippingLabel: boolean } }).order).toMatchObject({ paymentMethod: "COD", expectedAmountPkr: 325, codBaseAmountPkr: 200, canPrintShippingLabel: false });
    expect((await admin.fetch(new Request(`https://admin.example.test/api/orders/${orderData.orderId}/shipping-label?format=4x6`, { headers: identity }), adminEnv)).status).toBe(409);
  });

  it("drops the previewed COD fee when the customer selects Advance Payment", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    const orderId = (conversation()?.data as { orderId: string }).orderId;
    await inbound(tap("COD"));
    expect(body()).toContain("TOTAL ON DELIVERY: PKR 325");
    await inbound(tap("ADVANCE_PAYMENT"));
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id=?").get(orderId)).toEqual({ state: "DETAILS_COMPLETED", payment_status: "PENDING", total_payable: 200 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual({ count: 0 });
  });

  it("localizes the itemized Urdu COD quote and includes the base, fee, and total exactly once", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("ur", true);
    await inbound(tap("PLACE_ORDER"));
    expect(body()).toContain("آپ کا آرڈر موصول ہو گیا ہے");
    expect(body()).toContain("کیش آن ڈیلیوری پر اضافی PKR 125 کیش کلیکشن فیس لاگو ہوگی۔");
    expect((sends.at(-1)?.interactive as { action: { buttons: Array<{ reply: { title: string } }> } }).action.buttons.map((button) => button.reply.title)).toEqual(["ایڈوانس ادائیگی", "کیش آن ڈیلیوری"]);
    await inbound(tap("COD"));
    expect(body()).toContain("ڈیلیوری سمیت آرڈر کی رقم: PKR 200");
    expect(body()).toContain("COD وصولی فیس: PKR 125");
    expect(body()).toContain("ڈیلیوری پر کل: PKR 325");
    expect(body()).not.toContain("بیج (5 مفت پیکٹ)");
    expect(body()).not.toContain("مائیکرو نیوٹرینٹس کھاد (25 گرام)");
    expect(body().match(/COD وصولی فیس/g)).toHaveLength(1);
    expect(buttons()).toEqual(["CONFIRM_COD_ORDER", "ADVANCE_PAYMENT"]);
  });

  it("accepts COD_PENDING with fixed PKR 125 and no collection HMAC secret", async () => {
    await enableAuditedCodPolicy();
    codRuntimeHmacKey = "";
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    const orderId = (conversation()?.data as { orderId: string }).orderId;
    await inbound(tap("COD"));
    expect(body()).toContain("COD collection fee: PKR 125");
    await inbound(tap("CONFIRM_COD_ORDER"));
    expect(body()).toContain("Pay PKR 325 on delivery");
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id=?").get(orderId)).toEqual({ state: "COD_PENDING", payment_status: "COD_PENDING", total_payable: 200 });
    expect(sqlite.prepare("SELECT cod_fee_pkr,quoted_total_pkr,test_hold,collection_policy_hash,remittance_policy_hash FROM cod_order_details WHERE order_id=?").get(orderId)).toEqual({ cod_fee_pkr: 125, quoted_total_pkr: 325, test_hold: 1, collection_policy_hash: null, remittance_policy_hash: null });
  });

  it("fails closed when D1 COD settings are enabled without matching latest audit provenance", async () => {
    const collectionPolicyHash = await codReferenceHmac("SYNTHETIC-COURIER-POLICY", codHmacKey);
    const remittancePolicyHash = await codReferenceHmac("SYNTHETIC-REMITTANCE-POLICY", codHmacKey);
    const updatedAt = new Date().toISOString();
    sqlite.prepare("UPDATE cod_configuration SET enabled=1,fee_pkr=125,collection_policy_hash=?,remittance_policy_hash=?,updated_by=?,updated_at=? WHERE id='default'").run(collectionPolicyHash, remittancePolicyHash, "admin@example.test", updatedAt);
    codEnabled = true;
    await reachReview("en", true);
    await inbound(tap("PLACE_ORDER"));
    expect(buttons()).not.toContain("COD");
    expect(body()).not.toContain("Cash on Delivery");
    expect(body()).not.toContain("{codFee}");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
  });
});

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").filter((name) => /^\d+.*\.sql$/.test(name)).sort()) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  sqlite.exec("INSERT INTO products(id,code,name,price_pkr,enabled,created_at,updated_at) VALUES('synthetic-seeds','FREE_5_PACK_VEGETABLE_SEEDS','Synthetic seeds',0,1,'2026-01-01','2026-01-01'),('synthetic-fertilizer','MICRO_NUTRIENTS_FERTILIZER','Synthetic fertilizer',75,1,'2026-01-01','2026-01-01');");
  sqlite.exec("INSERT INTO province_delivery_rates(province,delivery_fee_pkr,enabled,created_at,updated_at) VALUES('Synthetic Province',125,1,'2026-01-01','2026-01-01');");
  db = { prepare: statement, batch: async (statements: Array<{ sql: string; run: () => Promise<unknown> }>) => {
    await beforeBatch?.(statements.map((item) => item.sql));
    sqlite.exec("BEGIN");
    try { const results = []; for (const item of statements) results.push(await item.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } as unknown as D1Database;
  sequence = 0;
  sends = [];
  failNextSend = false;
  receiptPuts = 0;
  codEnabled = false;
  codRolloutMode = "TESTER_ONLY";
  codTesterWaId = sender;
  codRuntimeHmacKey = codHmacKey;
  beforeBatch = undefined;
  beforeRun = undefined;
  qrAvailable = false;
  qrReads = 0;
  remindersEnabled = false;
  reminderAutomationEnabled = false;
  queueSend = vi.fn(async () => undefined);
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    if (failNextSend) { failNextSend = false; return new Response("{}", { status: 503 }); }
    if (init.body instanceof FormData) return Response.json({ id: "synthetic-nonpayable-media" });
    sends.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return Response.json({ messages: [{ id: `synthetic-outbound-${sends.length}` }] });
  }));
});

afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); });

describe("GFS-222 local advance and payment delivery repairs", () => {
  it("gates a concurrent same-method loser by the winning selection audit", async () => {
    const { order, selected } = await pendingPaymentFixture();
    beforeBatch = async (sql) => {
      if (!sql[0]?.startsWith("UPDATE payments SET method=")) return;
      beforeBatch = undefined;
      await selectPaymentMethod(db, order.orderId, "JAZZCASH", "en", sender, "SYNTHETIC-CONCURRENT-WINNER");
    };
    await expect(selectPaymentMethod(db, order.orderId, "JAZZCASH", "en", sender, "SYNTHETIC-CONCURRENT-LOSER")).rejects.toThrow("PAYMENT_SELECTION_CONFLICT");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_METHOD_SELECTED'").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(selected.idempotencyKey)).toEqual({ status: "PENDING" });
    expect(sends).toHaveLength(0);
  });

  it("returns HTTP409 without partial selection when review wins the race", async () => {
    const { order } = await pendingPaymentFixture();
    beforeBatch = (sql) => {
      if (!sql[0]?.startsWith("UPDATE payments SET method=")) return;
      beforeBatch = undefined;
      sqlite.prepare("UPDATE payments SET review_state='REVIEW',submitted_at='2026-01-01' WHERE order_id=?").run(order.orderId);
      sqlite.prepare("UPDATE orders SET state='PAYMENT_REVIEW' WHERE id=?").run(order.orderId);
    };
    const response = await api.fetch(new Request(`https://api.example.test/payments/${order.orderId}/select`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "JAZZCASH" }) }), env());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "PAYMENT_SELECTION_CONFLICT" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_METHOD_SELECTED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(order.orderId)).toEqual({ state: "PAYMENT_REVIEW" });
  });

  it("rolls back the advance claim if the winner audit fails", async () => {
    const { order } = await pendingPaymentFixture();
    await enableSyntheticPaymentMethod("EASYPAISA");
    beforeRun = (sql) => {
      if (!sql.startsWith("INSERT INTO audit_log") || !sql.includes("changes()=1")) return;
      beforeRun = undefined;
      throw new Error("SYNTHETIC_AUDIT_FAILURE");
    };
    await expect(selectPaymentMethod(db, order.orderId, "EASYPAISA", "en", sender, "SYNTHETIC-FAILED-AUDIT")).rejects.toThrow("SYNTHETIC_AUDIT_FAILURE");
    expect(sqlite.prepare("SELECT method FROM payments WHERE order_id=?").get(order.orderId)).toEqual({ method: "JAZZCASH" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_METHOD_SELECTED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_INSTRUCTIONS'").get()).toEqual({ count: 1 });
  });

  it.each(["SENT", "DELIVERED", "READ", "PROVIDER_ID_ONLY"])("treats %s children as delivered success without provider replay or R2 reads", async (status) => {
    const { order, selected } = await pendingPaymentFixture();
    for (const part of ["text", "qr"]) sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,order_id,kind,provider_message_id,status,attempt_count,created_at,updated_at) VALUES(?,?,?,?,?,?,1,'2026-01-01','2026-01-01')").run(`synthetic-${part}`, `${selected.idempotencyKey}:${part}`, order.orderId, part === "qr" ? "WHATSAPP_PAYMENT_QR" : "WHATSAPP_PAYMENT_TEXT", `synthetic-provider-${part}`, status === "PROVIDER_ID_ONLY" ? "FAILED" : status);
    const message = await runPaymentJob(order.orderId, selected.idempotencyKey);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(0);
    expect(qrReads).toBe(0);
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key=?").get(selected.idempotencyKey)).toEqual({ status: "SENT", last_error: null });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_QR_DELIVERY_BLOCKED'").get()).toEqual({ count: 0 });
  });

  it("records a missing QR error with correct SQL bindings and does not resend the successful text", async () => {
    const { order, selected } = await pendingPaymentFixture();
    const first = await runPaymentJob(order.orderId, selected.idempotencyKey);
    expect(first.retry).toHaveBeenCalledOnce();
    expect(sends).toHaveLength(1);
    expect(sqlite.prepare("SELECT status,last_error FROM outbound_messages WHERE idempotency_key=?").get(`${selected.idempotencyKey}:qr`)).toEqual({ status: "FAILED", last_error: "PAYMENT_QR_NOT_FOUND" });
    expect(sqlite.prepare("SELECT last_error FROM outbox_jobs WHERE idempotency_key=?").get(selected.idempotencyKey)).toEqual({ last_error: "PAYMENT_QR_DELIVERY_BLOCKED" });
    qrAvailable = true;
    const retry = await runPaymentJob(order.orderId, selected.idempotencyKey);
    expect(retry.ack).toHaveBeenCalledOnce();
    expect(sends).toHaveLength(2);
    expect(sends[1]?.type).toBe("image");
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(selected.idempotencyKey)).toEqual({ status: "SENT" });
  });

  it.each(["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"] as const)("preserves %s legacy text and QR delivery in both locales", async (method) => {
    const { order, selected } = await pendingPaymentFixture(method, "ur");
    qrAvailable = true;
    const message = await runPaymentJob(order.orderId, selected.idempotencyKey);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(sends).toHaveLength(2);
    expect(sends[0]).toMatchObject({ type: "text", text: { body: selected.message } });
    expect(sends[1]?.type).toBe("image");
    expect(selected.message).toContain("125");
    expect(selected.message).toContain(`NON-PAYABLE ${method}`);
    await selectPaymentMethod(db, order.orderId, method, "en", sender, "SYNTHETIC-EN-METHOD-RESELECT");
    expect(sqlite.prepare("SELECT method,review_state,expected_amount FROM payments WHERE order_id=?").get(order.orderId)).toEqual({ method, review_state: "PENDING", expected_amount: 125 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
  });

  it.each(["SENT", "SUCCEEDED", "PERMANENT_FAILURE", "DEAD_LETTER"])("does not replay a terminal %s payment job", async (status) => {
    const { order, selected } = await pendingPaymentFixture();
    sqlite.prepare("UPDATE outbox_jobs SET status=? WHERE idempotency_key=?").run(status, selected.idempotencyKey);
    const message = await runPaymentJob(order.orderId, selected.idempotencyKey);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(qrReads).toBe(0);
    expect(sends).toHaveLength(0);
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(selected.idempotencyKey)).toEqual({ status });
  });

  it.each(["en", "ur"] as const)("formats reconciled COD PAID with the quoted amount and delivered context in %s", async (locale) => {
    const { order } = await pendingPaymentFixture();
    const details = (await getLatestOrderForWaId(db, sender, order.orderId))!;
    const formatted = formatCustomerOrderStatus({ ...details, state: "PAID", paymentStatus: "PAID", paymentReviewState: "COD_PAID", codQuotedTotalPkr: 250 }, locale);
    expect(formatted).toContain("PKR 250");
    expect(formatted).not.toContain("PKR 125");
    expect(formatted).not.toMatch(/packing has not started|پیکنگ شروع نہیں ہوئی/);
    expect(formatted).toContain(locale === "en" ? "Order Status: COD Paid" : "آرڈر کی حالت: COD ادا ہو گیا");
  });

  it("keeps legacy PAID status replies available without reopening payment selection", async () => {
    const { order } = await pendingPaymentFixture();
    sqlite.prepare("UPDATE orders SET state='PAID',payment_status='PAID' WHERE id=?").run(order.orderId);
    sqlite.prepare("UPDATE payments SET review_state='APPROVED',approved_amount=125,approved_by='SYNTHETIC',approved_at='2026-01-01' WHERE order_id=?").run(order.orderId);
    await inbound(tap("CHECK_ORDER"));
    expect(body()).toContain("Payment approved");
    expect(body()).toContain("Amount: PKR 125");
    expect(buttons()).toEqual(["CHECK_ORDER"]);
    expect(conversation()?.state).toBe("PAYMENT_PENDING");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_METHOD_SELECTED'").get()).toEqual({ count: 1 });
  });
});

describe("GFS-178 simulated signed-webhook lead-only journey", () => {
  it.each(["en", "ur"] as const)("offers bilingual Continue/Cancel and safely restarts after $language cancellation", async (language) => {
    await inbound("START");
    await inbound(tap(language === "ur" ? "LANG_UR" : "LANG_EN"));
    expect(conversation()?.state).toBe("OFFER");
    expect(buttons()).toEqual(["CONTINUE_ORDER", "CANCEL_ORDER"]);
    const cancel = await inbound(tap("CANCEL_ORDER"), `synthetic-cancel-${language}`);
    expect(conversation()?.state).toBe("CANCELLED");
    expect(body()).toContain(language === "ur" ? "منسوخ" : "cancelled");
    expect(sqlite.prepare("SELECT count(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM payments").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM capi_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs").get()).toEqual({ count: 0 });
    const sendsAfterCancel = sends.length;
    await callback([cancel]);
    expect(sends).toHaveLength(sendsAfterCancel);
    await inbound(tap("CONTINUE_ORDER"), `synthetic-stale-continue-${language}`);
    expect(conversation()?.state).toBe("CANCELLED");
    expect(sqlite.prepare("SELECT count(*) AS count FROM orders").get()).toEqual({ count: 0 });
    await inbound("START", `synthetic-restart-${language}`);
    expect(conversation()?.state).toBe("LANGUAGE");
    expect(buttons()).toEqual(["LANG_UR", "LANG_EN"]);
    expect(sqlite.prepare("SELECT count(*) AS count FROM orders").get()).toEqual({ count: 0 });
  });

  it("captures a signed customer transaction reference and rejects reuse on another payment", async () => {
    const first=await createSyntheticPaymentReviewOrder(sender,"reference-order-one");
    await inbound("SYNTHETIC-TXN-192001","synthetic-customer-reference-one",sender);
    expect(sqlite.prepare("SELECT customer_transaction_reference,review_state FROM payments WHERE id=?").get(first.paymentId)).toEqual({customer_transaction_reference:"SYNTHETIC-TXN-192001",review_state:"REVIEW"});
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(first.order.orderId)).toEqual({state:"PAYMENT_REVIEW"});
    const referenceAudit=sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='CUSTOMER_TRANSACTION_REFERENCE_SAVED'").get() as {metadata_json:string};
    expect(referenceAudit.metadata_json).toContain('"referenceHash"');
    expect(referenceAudit.metadata_json).not.toContain("SYNTHETIC-TXN-192001");
    sqlite.prepare("UPDATE payments SET customer_transaction_reference=? WHERE id=?").run("SYNTHETIC-TXN -192001",first.paymentId);

    const secondWa="923001234568";
    const second=await createSyntheticPaymentReviewOrder(secondWa,"reference-order-two");
    await inbound("SYNTHETIC-TXN-192001","synthetic-customer-reference-two",secondWa);
    expect(body()).toContain("already used");
    expect(sqlite.prepare("SELECT customer_transaction_reference,review_state FROM payments WHERE id=?").get(second.paymentId)).toEqual({customer_transaction_reference:null,review_state:"REVIEW"});
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(second.order.orderId)).toEqual({state:"PAYMENT_REVIEW"});
    expect(sqlite.prepare("SELECT count(*) AS count FROM capi_events WHERE event_name='Purchase'").get()).toEqual({count:0});
  });

  it("saves Admin reference with a hash audit, keeps REVIEW, and blocks PAID without verified settlement method", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder(sender,"admin-reference-order");
    const disabledApiRequest=await adminPost(`/api/payments/${testOrder.paymentId}/request-transaction-reference`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber},"false");
    expect(disabledApiRequest.status).toBe(503);
    expect(await disabledApiRequest.json()).toMatchObject({error:"REFERENCE_REQUEST_API_NOT_DEPLOYED"});
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_TRANSACTION_REFERENCE_REQUEST'").get()).toEqual({count:0});
    const closedWindowRequest=await adminPost(`/api/payments/${testOrder.paymentId}/request-transaction-reference`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber},"true");
    expect(closedWindowRequest.status).toBe(409);
    expect(await closedWindowRequest.json()).toMatchObject({error:"WHATSAPP_SERVICE_WINDOW_CLOSED_TEMPLATE_REQUIRED"});
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_TRANSACTION_REFERENCE_REQUEST'").get()).toEqual({count:0});
    const saved=await adminPost(`/api/payments/${testOrder.paymentId}/transaction-reference`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reference:"SYNTHETIC-ADMIN-TXN-192"});
    expect(saved.status, JSON.stringify({error:await saved.clone().json(),payment:sqlite.prepare("SELECT customer_transaction_reference,review_state FROM payments WHERE id=?").get(testOrder.paymentId),auditCount:sqlite.prepare("SELECT count(*) AS count FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_SAVED'").get()})).toBe(200);
    expect(await saved.json()).toMatchObject({ok:true,saved:true,paymentRemainsUnderReview:true,reference:"SYNTHETIC-ADMIN-TXN-192"});
    const audit=sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_SAVED'").get() as {metadata_json:string};
    expect(audit.metadata_json).toContain('"referenceHash"');
    expect(audit.metadata_json).not.toContain("SYNTHETIC-ADMIN-TXN-192");

    const approval=await adminPost(`/api/payments/${testOrder.paymentId}/approve`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,settlementEvidenceRef:"SYNTHETIC-BANK-RECORD-192",settlementConfirmed:true});
    expect(approval.status).toBe(409);
    expect(await approval.json()).toMatchObject({error:"PAYMENT_METHOD_NOT_VERIFIED"});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"PAYMENT_REVIEW",payment_status:"PENDING"});
    expect(sqlite.prepare("SELECT review_state,customer_transaction_reference FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({review_state:"REVIEW",customer_transaction_reference:"SYNTHETIC-ADMIN-TXN-192"});

    const request=await adminPost(`/api/payments/${testOrder.paymentId}/request-transaction-reference`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber});
    expect(request.status).toBe(409);
    expect(await request.json()).toMatchObject({error:"TRANSACTION_REFERENCE_ALREADY_SAVED"});
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_TRANSACTION_REFERENCE_REQUEST'").get()).toEqual({count:0});
    expect(sqlite.prepare("SELECT count(*) AS count FROM capi_events WHERE event_name='Purchase'").get()).toEqual({count:0});
  });

  it("stores trusted inbound receipt time and leaves it unchanged for status-only callbacks", async () => {
    const message = await inbound("START", "synthetic-window-inbound");
    const event = sqlite.prepare("SELECT created_at FROM whatsapp_events WHERE provider_event_id=?").get(`message:${message.id}`) as { created_at: string };
    expect(lastInboundAt()).toBe(event.created_at);
    const recordedAt = lastInboundAt();
    await callback([], [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, statuses: [{ id: "synthetic-provider-status", status: "delivered" }] } }]);
    expect(lastInboundAt()).toBe(recordedAt);
  });

  it("keeps reminder delivery reconciliation off the customer webhook path", async () => {
    remindersEnabled = true;
    reminderAutomationEnabled = true;
    let syncAttempts = 0;
    beforeRun = async (sql) => {
      if (!sql.startsWith("UPDATE payment_reminder_v2_stages")) return;
      syncAttempts++;
      throw new Error("SYNTHETIC_REMINDER_SYNC_UNAVAILABLE");
    };

    await inbound("START", "synthetic-reminder-isolation-inbound");
    expect(conversation()?.state).toBe("LANGUAGE");
    expect(sends).toHaveLength(1);
    expect(syncAttempts).toBe(0);

    await expect(api.scheduled({ scheduledTime: Date.now(), cron: "* * * * *", noRetry: vi.fn() } as unknown as ScheduledController, env())).rejects.toThrow("SYNTHETIC_REMINDER_SYNC_UNAVAILABLE");
    expect(syncAttempts).toBe(1);
  });

  it("runs the qualified reminder delivery reconciliation from Cron", async () => {
    remindersEnabled = true;
    reminderAutomationEnabled = true;
    await expect(api.scheduled({ scheduledTime: Date.now(), cron: "* * * * *", noRetry: vi.fn() } as unknown as ScheduledController, env())).resolves.toBeUndefined();
  });

  it("permanently blocks a free-form reply retry after the original inbound event leaves the 24-hour window", async () => {
    const oldAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const inboundId = "synthetic-stale-reply";
    sqlite.prepare("INSERT INTO whatsapp_events(id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?)").run("synthetic-old-event", `message:${inboundId}`, "MESSAGE", "synthetic-hash", "RECEIVED", "synthetic-correlation", oldAt);
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("synthetic-stale-conversation", sender, "LANGUAGE", "{}", inboundId, oldAt, oldAt, oldAt);
    sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,kind,status,attempt_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("synthetic-stale-outbound", `conversation_reply:${inboundId}`, "CONVERSATION_REPLY", "FAILED", 1, oldAt, oldAt);
    const sentBefore = sends.length;
    const response = await callback([{ from: sender, id: inboundId, type: "text", text: { body: "invalid-language" } }]);
    expect(response.status).toBe(200);
    expect(sends).toHaveLength(sentBefore);
    expect(sqlite.prepare("SELECT status,last_error FROM outbound_messages WHERE idempotency_key=?").get(`conversation_reply:${inboundId}`)).toEqual({ status: "PERMANENT_FAILURE", last_error: "WHATSAPP_SERVICE_WINDOW_CLOSED" });
    expect(lastInboundAt()).toBe(oldAt);
  });

  it("terminally blocks expired queued payment instructions without calling the provider", async () => {
    const oldAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("synthetic-expired-conversation", sender, "PAYMENT_PENDING", "{}", "synthetic-old-message", oldAt, oldAt, oldAt);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("synthetic-expired-job", "synthetic-expired-payment", "WHATSAPP_PAYMENT_INSTRUCTIONS", "synthetic-order", JSON.stringify({ recipient: sender, orderId: "synthetic-order", orderNumber: "TEST-ORDER" }), "PENDING", 0, oldAt, oldAt, oldAt);
    const message = { body: { kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey: "synthetic-expired-payment", entityId: "synthetic-order", schemaVersion: 1 as const }, attempts: 1, ack: vi.fn(), retry: vi.fn() };
    const sentBefore = sends.length;
    await api.queue({ messages: [message] } as unknown as MessageBatch<typeof message.body>, env());
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sentBefore);
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key=?").get("synthetic-expired-payment")).toEqual({ status: "PERMANENT_FAILURE", last_error: "WHATSAPP_SERVICE_WINDOW_CLOSED" });
  });

  it("returns retryable 429 before mutation and accepts the signed retry after the durable window", async () => {
    const first = await inbound("START");
    for (let i = 1; i < 30; i++) await inbound("START");
    expect((await callback([first])).status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_sender_admissions").get()).toEqual({ count: 30 });
    const before = conversation();
    const retry = { from: sender, id: "synthetic-throttled-retry", type: "text", text: { body: "START" } };
    const limited = await callback([retry]);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(conversation()).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_events WHERE provider_event_id=?").get(retry.id)).toEqual({ count: 0 });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    try { expect((await callback([retry])).status).toBe(200); } finally { clock.mockRestore(); }
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_sender_admissions").get()).toEqual({ count: 31 });
  });

  it("exercises NON-PAYABLE bilingual composition, private receipt storage and Admin rejection without enabling a method or PAID", async () => {
    const order = await persistFlowSubmission(db, { fullName: "NON-PAYABLE Synthetic", deliveryAddress: "Synthetic test lane", nearbyPlace: "Synthetic Park", city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, "synthetic-non-payable-tail", sender);
    const provider = new MockWhatsAppProvider();
    for (const method of ["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"] as const) {
      await expect(selectPaymentMethod(db, order.orderId, method)).rejects.toThrow("PAYMENT_METHOD_NOT_ELIGIBLE");
      // Pure formatter input only: never persisted as a payable method or ownership proof.
      const config = { id: "NON-PAYABLE", method, displayName: method, enabled: true, sortOrder: 0, qrOwnerVerified: false, recipientName: "NON-PAYABLE FIXTURE", tillId: "NOT-AN-ACCOUNT", heading: "NON-PAYABLE TEST", headingUr: "NON-PAYABLE TEST", instructions: "TEST {amount} {recipientName} {tillId} {orderNumber}", instructionsUr: "ٹیسٹ {amount} {recipientName} {tillId} {orderNumber}", referenceInstruction: "TEST {orderNumber}", referenceInstructionUr: "ٹیسٹ {orderNumber}", receiptInstructions: "TEST ONLY", receiptInstructionsUr: "صرف ٹیسٹ" };
      for (const locale of ["en", "ur"] as const) {
        const copy = formatPaymentMessage(order.orderNumber, 125, config, locale);
        expect(copy).toContain("125");
        expect(copy).toContain("NON-PAYABLE");
        expect(copy).not.toMatch(/\{(amount|orderNumber|recipientName|tillId)\}/);
        await provider.sendPaymentInstructions("synthetic-only", copy, { body: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/png" });
      }
    }
    expect(provider.sent.filter((item) => item.kind === "payment-qr")).toHaveLength(6);
    const put = vi.fn(async (_key: string, _body: ArrayBuffer, options: R2PutOptions) => options);
    const receipt = await storeReceipt({ put } as unknown as R2Bucket, order.orderNumber, { body: new Uint8Array([1, 2, 3]).buffer, size: 3, mimeType: "image/png", mediaId: "NON-PAYABLE-SYNTHETIC" });
    expect(put.mock.calls[0]?.[2]).toMatchObject({ httpMetadata: { cacheControl: "private, no-store" } });
    const payment = sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId)!;
    sqlite.prepare("UPDATE orders SET state='PAYMENT_REVIEW' WHERE id=?").run(order.orderId);
    sqlite.prepare("UPDATE payments SET review_state='REVIEW' WHERE id=?").run(payment.id);
    sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,provider_media_id,r2_object_key,mime_type,size_bytes,sha256,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("synthetic-receipt", order.orderId, payment.id, "NON-PAYABLE-SYNTHETIC", receipt.objectKey, "image/png", 3, receipt.sha256, "2026-01-01", "2026-01-01");
    const adminEnv = { DB: db, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never;
    const headers = { "cf-access-authenticated-user-email": "admin@example.test" };
    const csrf = await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers }), adminEnv);
    const { csrfToken } = await csrf.json() as { csrfToken: string };
    const response = await admin.fetch(new Request(`https://admin.example.test/api/payments/${payment.id}/reject`, { method: "POST", headers: { ...headers, "content-type": "application/json", origin: "https://admin.example.test", cookie: `__Host-gfs_admin_csrf=${csrfToken}`, "x-csrf-token": csrfToken }, body: JSON.stringify({ orderId: order.orderId, confirmation: order.orderNumber, reason: "NON-PAYABLE SYNTHETIC TEST - no funds" }) }), adminEnv);
    expect(response.status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(order.orderId)).toEqual({ state: "PAYMENT_REJECTED", payment_status: "REJECTED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events WHERE event_name='Purchase'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE enabled=1 OR qr_owner_verified=1").get()).toEqual({ count: 0 });
  });

  it("allows a returning exempt tester order without rewriting historical delivery details", async () => {
    sqlite.prepare("INSERT INTO cooldown_exemptions(wa_id,reason,created_by,created_at) VALUES (?,?,?,?)").run(sender, "SYNTHETIC_TEST", "synthetic-admin", "2026-01-01");
    const submission = { fullName: "Synthetic First", deliveryAddress: "First synthetic street", nearbyPlace: "Synthetic Park", city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false };
    const first = await persistFlowSubmission(db, submission, undefined, "synthetic-first-order", sender);
    const second = await persistFlowSubmission(db, { ...submission, fullName: "Synthetic Second", deliveryAddress: "Second synthetic street" }, undefined, "synthetic-second-order", sender);
    expect(second.orderId).not.toBe(first.orderId);
    expect(sqlite.prepare("SELECT full_name,delivery_address,wa_id FROM customers WHERE id=?").get(first.customerId)).toEqual({ full_name: "Synthetic First", delivery_address: "First synthetic street", wa_id: sender });
    expect(sqlite.prepare("SELECT full_name,delivery_address,normalized_whatsapp_number FROM customers WHERE id=?").get(second.customerId)).toEqual({ full_name: "Synthetic Second", delivery_address: "Second synthetic street", normalized_whatsapp_number: `+${sender}` });
    expect((await getLatestOrderForWaId(db, sender, second.orderId))?.id).toBe(second.orderId);
    expect((await getLatestOrderForWaId(db, "923009999999", second.orderId))).toBeUndefined();
  });
  it.each(["en", "ur"] as const)("persists one %s lead/order with every payment method disabled", async (locale) => {
    await reachReview(locale, true);
    if (locale === "ur") expect(body()).not.toMatch(/Delivery:|TOTAL:|Synthetic seeds|Synthetic fertilizer/);
    const confirmation = await inbound(tap("PLACE_ORDER"));
    expect(conversation()?.state).toBe("COMPLETE");
    const order = sqlite.prepare("SELECT * FROM orders").get()!;
    expect(order).toMatchObject({ state: "DETAILS_COMPLETED", payment_status: "PENDING", total_payable: 200 });
    expect(conversation()?.data.amountPkr).toBe(order.total_payable);
    expect(body()).toContain(String(order.order_number));
    expect(body()).toContain("200");
    expect(body()).toContain(locale === "ur" ? "کوئی ادائیگی کی درخواست نہیں بھیجی گئی" : "no payment request was sent");
    expect(buttons()).toEqual(["CHECK_ORDER"]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM leads").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT wa_id FROM customers").get()).toEqual({ wa_id: sender });
    expect(sqlite.prepare("SELECT method,review_state FROM payments").get()).toEqual({ method: null, review_state: "PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE enabled=1 OR qr_owner_verified=1").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT kind,status FROM outbox_jobs").all()).toEqual([{ kind: "CAPI_LEAD", status: "PENDING" }]);
    expect(queueSend).not.toHaveBeenCalled();
    const beforeReplay = sends.length;
    await callback([confirmation]);
    expect(sends).toHaveLength(beforeReplay);
    for (const id of ["PAY_JAZZCASH", "PAY_EASYPAISA", "PAY_BANK_TRANSFER", "PAYMENT_HELP", "UNKNOWN_CALLBACK"]) {
      const before = conversation();
      await inbound(tap(id));
      expect(conversation()).toEqual(before);
      expect(buttons()).toEqual(["CHECK_ORDER"]);
      expect(body()).not.toMatch(/Choose a verified|JazzCash|Easypaisa|Bank Transfer/);
    }
    await inbound(tap("CHECK_ORDER"));
    expect(body()).toContain(String(order.order_number));
    if (locale === "ur") expect(body()).not.toMatch(/Payment|Order status/);
    await inbound("START");
    expect(conversation()?.data.language).toBe(locale);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
  });

  it("does not reinterpret a delivered field callback after later progress", async () => {
    await inbound("START"); await inbound("2"); await inbound("2");
    await inbound("Synthetic Province");
    const name = await inbound("Synthetic Customer");
    await inbound("123 Synthetic Street");
    const before = conversation();
    const count = sends.length;
    await callback([name]);
    expect(conversation()).toEqual(before);
    expect(sends).toHaveLength(count);
  });

  it.each([tap("PAY_JAZZCASH"), tap("UNKNOWN_CALLBACK"), tap(""), "JAZZCASH", "START", { type: "nfm_reply", nfm_reply: { response_json: '{"orderId":"untrusted-order","orderNumber":"FS-UNTRUSTED"}' } }])("rejects stale/invalid callback %j without treating it as a name", async (input) => {
    await inbound("START"); await inbound("1"); await inbound("2"); await inbound("Synthetic Province");
    const before = conversation();
    await inbound(input);
    expect(conversation()).toEqual(before);
    expect(body()).toContain("انتخاب");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(queueSend).not.toHaveBeenCalled();
  });

  it("retries a failed confirmation without duplicating order/Lead or losing its numeric total", async () => {
    await reachReview("ur");
    failNextSend = true;
    const confirmation = await inbound(tap("PLACE_ORDER"));
    expect(conversation()?.state).toBe("REVIEW");
    await callback([confirmation]);
    expect(conversation()?.state).toBe("COMPLETE");
    expect(body()).toContain("125");
    expect(body()).not.toContain("configured tariff");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events").get()).toEqual({ count: 1 });
  });

  it("reuses the exact pending order when a new Place Order tap retries a failed reply", async () => {
    await enableAuditedCodPolicy();
    codEnabled = true;
    await reachReview("en");
    failNextSend = true;
    await inbound(tap("PLACE_ORDER"), "synthetic-place-order-send-failure");
    expect(conversation()?.state).toBe("REVIEW");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
    await inbound(tap("PLACE_ORDER"), "synthetic-place-order-retry");
    expect(conversation()?.state).toBe("PAYMENT_METHOD");
    expect(body()).toContain("Your Order Has Been Received");
    expect(body().match(/Cash on Delivery/g)).toHaveLength(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM leads").get()).toEqual({ count: 1 });
  });

  it("rejects a signed batch containing a callback without its phone identity", async () => {
    const response = await callback([], [{ field: "messages", value: { messages: [{ from: sender, id: "synthetic-missing-phone", type: "text", text: { body: "START" } }] } }]);
    expect(response.status).toBe(403);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT action FROM audit_log").all()).toEqual([{ action: "WHATSAPP_CALLBACK_REJECTED" }]);
    expect(sends).toHaveLength(0);
  });

  it("keeps invalid contact input and stale review buttons from advancing the entry", async () => {
    await reachReview("ur");
    await inbound(tap("BACK"));
    expect(conversation()?.state).toBe("CONTACT");
    for (const value of ["not a number", tap("PLACE_ORDER")]) {
      const before = conversation();
      await inbound(value);
      expect(conversation()).toEqual(before);
      expect(buttons()).toEqual([]);
    }
  });

  it.each(["PAYMENT_METHOD", "PAYMENT_PENDING"])("rejects historical payment taps in %s with disabled methods", async (state) => {
    await reachReview("ur"); await inbound(tap("PLACE_ORDER"));
    sqlite.prepare("UPDATE whatsapp_conversations SET state=? WHERE wa_id=?").run(state, sender);
    const order = sqlite.prepare("SELECT * FROM orders").get();
    const payment = sqlite.prepare("SELECT * FROM payments").get();
    for (const id of ["PAY_JAZZCASH", "PAY_EASYPAISA", "PAY_BANK_TRANSFER", "PAYMENT_HELP"]) {
      await inbound(tap(id));
      expect(body()).not.toContain("تصدیق شدہ ادائیگی کا طریقہ منتخب");
      expect(buttons()).toEqual(["CHECK_ORDER"]);
      expect(sqlite.prepare("SELECT * FROM orders").get()).toEqual(order);
      expect(sqlite.prepare("SELECT * FROM payments").get()).toEqual(payment);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind LIKE 'WHATSAPP_PAYMENT%'").get()).toEqual({ count: 0 });
    }
  });

  it.each(["en", "ur"] as const)("queues a reasoned clearer-receipt notice, sends it once in the %s service window, and preserves REVIEW", async (locale) => {
    const testOrder = await createSyntheticPaymentReviewOrder(sender, `clearer-receipt-${locale}`);
    const inboundId = `synthetic-clearer-window-${locale}`;
    const now = new Date().toISOString();
    sqlite.prepare("UPDATE customers SET wa_id=NULL,whatsapp_number=?,normalized_whatsapp_number=NULL WHERE id=?").run(sender, testOrder.order.customerId);
    sqlite.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_REVIEW',state_data=?,last_inbound_message_id=?,last_inbound_at=?,updated_at=? WHERE wa_id=?").run(JSON.stringify({ language: locale, orderId: testOrder.order.orderId, orderNumber: testOrder.order.orderNumber }), inboundId, now, now, sender);
    sqlite.prepare("INSERT INTO whatsapp_events(id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?)").run(`event-${locale}`, `message:${inboundId}`, "MESSAGE", "synthetic-payload-hash", "RECEIVED", `correlation-${locale}`, now);
    const receiptId = `receipt-clearer-receipt-${locale}`;

    const response = await adminPost(`/api/payments/${testOrder.paymentId}/request-clearer-receipt`, { orderId: testOrder.order.orderId, confirmation: testOrder.order.orderNumber, reasonCode: "TEST_IMAGE_NOT_PAYMENT_PROOF" }, "true", { send: queueSend });
    expect(response.status).toBe(202);
    expect(queueSend).toHaveBeenCalledOnce();
    const job = sqlite.prepare("SELECT idempotency_key,kind,status,payload_json FROM outbox_jobs WHERE entity_id=? AND kind='WHATSAPP_CLEARER_RECEIPT'").get(testOrder.order.orderId) as { idempotency_key:string;kind:string;status:string;payload_json:string };
    expect(job).toMatchObject({ kind:"WHATSAPP_CLEARER_RECEIPT",status:"QUEUED" });
    expect(JSON.parse(job.payload_json)).toMatchObject({ orderId:testOrder.order.orderId,paymentId:testOrder.paymentId,receiptId,reasonCode:"TEST_IMAGE_NOT_PAYMENT_PROOF" });
    const audit = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='REQUEST_CLEARER_RECEIPT' AND entity_id=?").get(testOrder.paymentId) as { metadata_json:string };
    expect(audit.metadata_json).toContain('"reasonCode":"TEST_IMAGE_NOT_PAYMENT_PROOF"');

    const queued = queueSend.mock.calls[0]?.[0] as { kind:string;idempotencyKey:string;entityId:string;schemaVersion:1 };
    const queuedMessage = { body:queued,attempts:1,ack:vi.fn(),retry:vi.fn() };
    const sendCount = sends.length;
    await api.queue({ messages:[queuedMessage] } as never,env());
    expect(queuedMessage.ack).toHaveBeenCalledOnce();
    expect(queuedMessage.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sendCount+1);
    expect(body()).toBe(locale === "ur"
      ? `آپ نے آرڈر ${testOrder.order.orderNumber} کے لیے جو تصویر بھیجی ہے وہ ٹیسٹ تصویر ہے، ادائیگی کا ثبوت نہیں۔ کوئی ادائیگی تصدیق شدہ نہیں ہے۔ اگر آپ نے ادائیگی کی ہے تو براہِ کرم اس آرڈر کی واضح اور اصل رسید اپ لوڈ کریں۔ آپ کی ادائیگی ایڈمن کے جائزے میں رہے گی۔`
      : `The image you sent for order ${testOrder.order.orderNumber} is a test image, not payment proof. No payment has been confirmed. If you have paid, please upload a clear genuine receipt for this order. Your payment remains under Admin review.`);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({ state:"PAYMENT_REVIEW",payment_status:"PENDING" });
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({ review_state:"REVIEW" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE id=?").get(receiptId)).toEqual({ count:1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(testOrder.order.orderId)).toEqual({ count:1 });
    expect(sqlite.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").get(job.idempotency_key)).toMatchObject({ status:"SENT",provider_message_id:"synthetic-outbound-1" });
    expect(sqlite.prepare("SELECT status,attempts FROM outbox_jobs WHERE idempotency_key=?").get(job.idempotency_key)).toEqual({ status:"SENT",attempts:1 });

    const replay = { body:queued,attempts:2,ack:vi.fn(),retry:vi.fn() };
    await api.queue({ messages:[replay] } as never,env());
    expect(replay.ack).toHaveBeenCalledOnce();
    expect(replay.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sendCount+1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(testOrder.order.orderId)).toEqual({ count:1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbound_messages WHERE idempotency_key=?").get(job.idempotency_key)).toEqual({ count:1 });
  });

  it("requires the test-image reason and refuses clearer-receipt sending after the service window", async () => {
    const testOrder = await createSyntheticPaymentReviewOrder(sender, "clearer-receipt-expired-window");
    const oldAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const inboundId = "synthetic-clearer-expired-window";
    sqlite.prepare("UPDATE customers SET wa_id=NULL,whatsapp_number=?,normalized_whatsapp_number=NULL WHERE id=?").run(sender, testOrder.order.customerId);
    sqlite.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_REVIEW',last_inbound_message_id=?,last_inbound_at=?,updated_at=? WHERE wa_id=?").run(inboundId, oldAt, oldAt, sender);
    sqlite.prepare("INSERT INTO whatsapp_events(id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?)").run("event-clearer-expired", `message:${inboundId}`, "MESSAGE", "synthetic-expired-payload", "RECEIVED", "correlation-clearer-expired", oldAt);
    const invalidReason = await adminPost(`/api/payments/${testOrder.paymentId}/request-clearer-receipt`, { orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reasonCode:"FREE_TEXT_NOT_ALLOWED" }, "true", { send:queueSend });
    expect(invalidReason.status).toBe(400);
    const closedWindow = await adminPost(`/api/payments/${testOrder.paymentId}/request-clearer-receipt`, { orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reasonCode:"TEST_IMAGE_NOT_PAYMENT_PROOF" }, "true", { send:queueSend });
    expect(closedWindow.status).toBe(409);
    expect(await closedWindow.json()).toMatchObject({ error:"WHATSAPP_SERVICE_WINDOW_CLOSED_TEMPLATE_REQUIRED" });
    expect(queueSend).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_CLEARER_RECEIPT'").get()).toEqual({ count:0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='REQUEST_CLEARER_RECEIPT'").get()).toEqual({ count:0 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({ state:"PAYMENT_REVIEW",payment_status:"PENDING" });
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({ review_state:"REVIEW" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id=?").get(testOrder.order.orderId)).toEqual({ count:1 });
  });

  it("retries a failed queue publish without duplicate audit and keeps the original reason code", async () => {
    const testOrder = await createSyntheticPaymentReviewOrder(sender, "clearer-receipt-queue-retry");
    const now = new Date().toISOString();
    const inboundId = "synthetic-clearer-queue-retry";
    sqlite.prepare("UPDATE customers SET wa_id=NULL,whatsapp_number=?,normalized_whatsapp_number=NULL WHERE id=?").run(sender, testOrder.order.customerId);
    sqlite.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_REVIEW',last_inbound_message_id=?,last_inbound_at=?,updated_at=? WHERE wa_id=?").run(inboundId, now, now, sender);
    sqlite.prepare("INSERT INTO whatsapp_events(id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?)").run("event-clearer-queue-retry", `message:${inboundId}`, "MESSAGE", "synthetic-retry-payload", "RECEIVED", "correlation-clearer-queue-retry", now);
    queueSend.mockRejectedValueOnce(new Error("synthetic queue failure"));
    const request = () => adminPost(`/api/payments/${testOrder.paymentId}/request-clearer-receipt`, { orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reasonCode:"TEST_IMAGE_NOT_PAYMENT_PROOF" }, "true", { send:queueSend });
    const first = await request();
    expect(first.status).toBe(503);
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE kind='WHATSAPP_CLEARER_RECEIPT'").get()).toEqual({ status:"RETRY",last_error:"QUEUE_DISPATCH_FAILED" });
    const second = await request();
    expect(second.status).toBe(202);
    expect(queueSend).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE kind='WHATSAPP_CLEARER_RECEIPT'").get()).toEqual({ status:"QUEUED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='REQUEST_CLEARER_RECEIPT'").get()).toEqual({ count:1 });
    const job = sqlite.prepare("SELECT payload_json FROM outbox_jobs WHERE kind='WHATSAPP_CLEARER_RECEIPT'").get() as { payload_json:string };
    expect(JSON.parse(job.payload_json)).toMatchObject({ reasonCode:"TEST_IMAGE_NOT_PAYMENT_PROOF" });
  });

  it("fails closed on legacy queued payment work with all methods disabled", async () => {
    await reachReview("en"); await inbound(tap("PLACE_ORDER"));
    const order = sqlite.prepare("SELECT id,order_number,total_payable FROM orders").get()!;
    const beforeOrder = sqlite.prepare("SELECT * FROM orders").get();
    const beforePayment = sqlite.prepare("SELECT * FROM payments").get();
    const now = new Date().toISOString();
    const key = "synthetic-legacy-payment-job";
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").run(key, key, "WHATSAPP_PAYMENT_INSTRUCTIONS", String(order.id), JSON.stringify({ orderId: order.id, orderNumber: order.order_number, amount: order.total_payable, method: "JAZZCASH", locale: "en", recipient: sender, message: "Synthetic stale payment text" }), now, now, now);
    const count = sends.length;
    const ack = vi.fn(); const retry = vi.fn();
    const message = { body: { kind: "WHATSAPP_PAYMENT_INSTRUCTIONS", idempotencyKey: key, entityId: order.id, schemaVersion: 1 }, attempts: 1, ack, retry };
    await api.queue({ messages: [message] } as never, env());
    expect(sends).toHaveLength(count);
    expect(retry).toHaveBeenCalledWith({ delaySeconds: expect.any(Number) });
    expect(sqlite.prepare("SELECT status,attempts FROM outbox_jobs WHERE idempotency_key=?").get(key)).toEqual({ status: "RETRY", attempts: 1 });
    sqlite.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE' WHERE idempotency_key=?").run(key);
    await api.queue({ messages: [message] } as never, env());
    expect(ack).toHaveBeenCalledOnce();
    expect(sends).toHaveLength(count);
    expect(sqlite.prepare("SELECT * FROM orders").get()).toEqual(beforeOrder);
    expect(sqlite.prepare("SELECT * FROM payments").get()).toEqual(beforePayment);
    expect(sqlite.prepare("SELECT event_name,send_status FROM capi_events").all()).toEqual([{ event_name: "Lead", send_status: "PENDING" }]);
  });
});
