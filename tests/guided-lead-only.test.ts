import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index";
import admin from "../apps/admin/src/index";
import { formatPaymentMessage, getLatestOrderForWaId, MockWhatsAppProvider, normalizePaymentMethodRow, persistFlowSubmission, selectPaymentMethod, storeReceipt } from "@gfs/core";
import { createPaymentV2Schedule, enqueueDuePaymentV2Stages } from "../apps/api/src/payment-reminders-v2";

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
let receiptBucketGet: ReturnType<typeof vi.fn>;
let receiptBucketPut: ReturnType<typeof vi.fn>;

function statement(sql: string) {
  let values: SQLInputValue[] = [];
  const prepared = {
    bind: (...args: SQLInputValue[]) => { values = args; return prepared; },
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) }, success: true })
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

function env(paymentConfirmationEnabled = "false", paymentRemindersEnabled = "false", paymentAutomationEnabled = "false", utilityTemplatesApproved = "false") {
  return { DB: db, RECEIPTS: { get: receiptBucketGet, put: receiptBucketPut }, EVENTS: { send: queueSend }, DEPLOYMENT_STATE: "LOCAL", WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true", PAYMENT_CONFIRMATION_V2_ENABLED: paymentConfirmationEnabled, PAYMENT_REMINDERS_V2_ENABLED: paymentRemindersEnabled, PAYMENT_AUTOMATION_V2_ENABLED: paymentAutomationEnabled, PAYMENT_UTILITY_TEMPLATES_APPROVED: utilityTemplatesApproved, META_PHONE_NUMBER_ID: phoneId, META_ACCESS_TOKEN: "synthetic-token", META_APP_SECRET: secret, META_CAPI_ENABLED: "false", WHATSAPP_CHECKOUT_MODE: "guided" } as never;
}

async function callback(messages: Record<string, unknown>[], extraChanges: unknown[] = [], paymentRemindersEnabled = false) {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages } }, ...extraChanges] }] });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return api.fetch(new Request("https://api.example.test/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` }, body: payload }), env("false",String(paymentRemindersEnabled),String(paymentRemindersEnabled)));
}

async function adminPost(path: string, body: Record<string, unknown>, referenceRequestsEnabled = "true", paymentConfirmationEnabled = "false", paymentRemindersEnabled = "false", paymentAutomationEnabled = "false") {
  const adminEnv = { DB: db, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", REFERENCE_REQUESTS_ENABLED: referenceRequestsEnabled, PAYMENT_CONFIRMATION_V2_ENABLED: paymentConfirmationEnabled, PAYMENT_REMINDERS_V2_ENABLED:paymentRemindersEnabled, PAYMENT_AUTOMATION_V2_ENABLED:paymentAutomationEnabled, EVENTS: { send: vi.fn(async () => undefined) } } as never;
  const identity = { "cf-access-authenticated-user-email": "admin@example.test" };
  const csrfResponse = await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers: identity }), adminEnv);
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const cookie = `__Host-gfs_admin_csrf=${csrf.csrfToken}`;
  return admin.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: { ...identity, origin:"https://admin.example.test", cookie, "x-csrf-token": csrf.csrfToken, "content-type": "application/json" }, body: JSON.stringify(body) }), adminEnv);
}

async function inbound(input: string | Record<string, unknown>, id = `synthetic-inbound-${++sequence}`, waId = sender, paymentRemindersEnabled = false) {
  const message = { from: waId, id, timestamp: "1792497600", ...(typeof input === "string" ? { type: "text", text: { body: input } } : { type: "interactive", interactive: input }) };
  const response = await callback([message],[],paymentRemindersEnabled);
  expect(response.status).toBe(200);
  return message;
}

const tap = (id: string) => ({ type: "button_reply", button_reply: { id, title: "Synthetic button" } });

async function reachReview(locale: "en" | "ur", fertilizer = false) {
  await inbound("START");
  expect(buttons()).toEqual(["LANG_UR", "LANG_EN"]);
  await inbound(tap(locale === "ur" ? "LANG_UR" : "LANG_EN"));
  expect(conversation()?.state).toBe("OFFER");
  expect(buttons()).toEqual(["CONTINUE_ORDER", "CANCEL_ORDER"]);
  await inbound(tap("CONTINUE_ORDER"));
  expect(conversation()?.state).toBe("FERTILIZER");
  expect(buttons()).toEqual(["ADD_FERTILIZER", "SEEDS_ONLY"]);
  await inbound(tap(fertilizer ? "ADD_FERTILIZER" : "SEEDS_ONLY"));
  expect(sends.at(-1)).toMatchObject({ interactive: { type: "list", action: { sections: [{ rows: [{ id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" }] }] } } });
  await inbound({ type: "list_reply", list_reply: { id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" } });
  for (const value of ["Synthetic Customer", "123 Synthetic Street", "Synthetic Park", "Synthetic City", "03001234567"]) await inbound(value);
  expect(conversation()?.state).toBe("REVIEW");
}

async function createSyntheticPaymentReviewOrder(waId: string, idempotencyKey: string, paymentReminderV2Enabled = false) {
  sqlite.prepare("INSERT OR IGNORE INTO cooldown_exemptions(wa_id,reason,created_by,created_at) VALUES(?,?,?,?)").run(waId,"SYNTHETIC_TEST_ONLY","TEST_FIXTURE",new Date().toISOString());
  const order = await persistFlowSubmission(db, { fullName: "NON-PAYABLE Synthetic", deliveryAddress: `SYNTHETIC ${idempotencyKey}`, nearbyPlace: `SYNTHETIC ${idempotencyKey}`, city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, idempotencyKey, waId, paymentReminderV2Enabled);
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

function verifySyntheticPaymentMethod(method = "JAZZCASH") {
  const digest = "a".repeat(64);
  const qrKey = `synthetic/${method.toLowerCase()}-verified.png`;
  const now = new Date().toISOString();
  sqlite.prepare("UPDATE payment_methods SET recipient_name='Synthetic recipient',till_id='SYNTHETIC-DESTINATION',updated_at=? WHERE method=?").run(now,method);
  sqlite.prepare(`INSERT INTO payment_qr_assets (id,method,source_r2_key,source_sha256,source_mime_type,source_size_bytes,derivative_r2_key,derivative_sha256,derivative_mime_type,derivative_size_bytes,derivative_width,derivative_height,payload_sha256,decoder_agreement,payload_match,scan_pass,decoder_versions,extractor_version,independent_ownership_verified,independent_evidence_ref,active,created_at,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`asset-${method}`,method,`source-${method}`,digest,"image/png",8,qrKey,digest,"image/png",8,8,8,digest,1,1,1,"synthetic-test","synthetic-test",1,"SYNTHETIC-OWNERSHIP-EVIDENCE",1,now,"TEST_FIXTURE");
  sqlite.prepare(`UPDATE payment_methods SET qr_r2_key=?,qr_sha256=?,qr_mime_type='image/png',qr_size_bytes=8,enabled=1,qr_owner_verified=1,updated_at=? WHERE method=?`).run(qrKey,digest,now,method);
}

function configureSyntheticPaymentMethodCopy(method = "JAZZCASH") {
  sqlite.prepare(`UPDATE payment_methods SET instructions='Pay PKR {amount} to {recipientName} for {orderNumber}, destination {tillId}',reference_instruction='Reference {orderNumber} PKR {amount} {recipientName} {tillId}',receipt_instructions='Send receipt for {orderNumber}',heading_ur='ادائیگی',instructions_ur='PKR {amount} {recipientName} {orderNumber} {tillId}',reference_instruction_ur='حوالہ PKR {amount} {recipientName} {orderNumber} {tillId}',receipt_instructions_ur='رسید {orderNumber}' WHERE method=?`).run(method);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").filter((name) => /^\d+.*\.sql$/.test(name)).sort()) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  sqlite.exec("INSERT INTO products(id,code,name,price_pkr,enabled,created_at,updated_at) VALUES('synthetic-seeds','FREE_5_PACK_VEGETABLE_SEEDS','Synthetic seeds',0,1,'2026-01-01','2026-01-01'),('synthetic-fertilizer','MICRO_NUTRIENTS_FERTILIZER','Synthetic fertilizer',75,1,'2026-01-01','2026-01-01');");
  sqlite.exec("INSERT INTO province_delivery_rates(province,delivery_fee_pkr,enabled,created_at,updated_at) VALUES('Synthetic Province',125,1,'2026-01-01','2026-01-01');");
  db = { prepare: statement, batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
    sqlite.exec("BEGIN");
    try { const results = []; for (const item of statements) results.push(await item.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } as unknown as D1Database;
  sequence = 0;
  sends = [];
  failNextSend = false;
  queueSend = vi.fn(async () => undefined);
  receiptBucketGet = vi.fn(async () => null);
  receiptBucketPut=vi.fn(async()=>undefined);
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    const url=String(input);
    if(url.includes("/synthetic-late-media"))return Response.json({url:"https://synthetic-media.test/receipt",mime_type:"image/png",file_size:4});
    if(url==="https://synthetic-media.test/receipt")return new Response(new Uint8Array([137,80,78,71]),{headers:{"content-type":"image/png"}});
    if (failNextSend&&init?.method==="POST") { failNextSend = false; return new Response("{}", { status: 503 }); }
    if(init?.body)sends.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return Response.json({ messages: [{ id: `synthetic-outbound-${sends.length}` }] });
  }));
});

afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); });

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
  },10_000);

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

  it("confirms a verified payment once, atomically saves the reference and queues the gated acknowledgement", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder(sender,"single-confirm-order",true);
    verifySyntheticPaymentMethod();
    const path=`/api/payments/${testOrder.paymentId}/approve`;
    const bodyData={orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reference:"SYNTHETIC-TXN-193001",settlementEvidenceRef:"SYNTHETIC-STATEMENT-193",settlementConfirmed:true};
    const approval=await adminPost(path,bodyData,"true","true");
    expect(approval.status,JSON.stringify(await approval.clone().json())).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"PAID",payment_status:"PAID"});
    expect(sqlite.prepare("SELECT review_state,customer_transaction_reference,approved_amount FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({review_state:"APPROVED",customer_transaction_reference:"SYNTHETIC-TXN-193001",approved_amount:testOrder.amount});
    expect(sqlite.prepare("SELECT kind,status,idempotency_key FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_CONFIRMATION'").get()).toEqual({kind:"WHATSAPP_PAYMENT_CONFIRMATION",status:"QUEUED",idempotency_key:`payment_confirmation_v2_${testOrder.paymentId}`});
    const audit=sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='PAYMENT_APPROVED'").get() as {metadata_json:string};
    expect(audit.metadata_json).toContain('"transactionReferenceHash"');
    expect(audit.metadata_json).not.toContain("SYNTHETIC-TXN-193001");

    const lastInboundAt=new Date().toISOString();
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_message_id=?,last_inbound_at=?,state_data=? WHERE wa_id=?").run("synthetic-confirmation-window",lastInboundAt,JSON.stringify({language:"en"}),sender);
    const queueMessage={body:{kind:"WHATSAPP_PAYMENT_CONFIRMATION",idempotencyKey:`payment_confirmation_v2_${testOrder.paymentId}`,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    failNextSend=true;
    await api.queue({messages:[queueMessage]} as never,env("true"));
    expect(queueMessage.retry).toHaveBeenCalledWith({delaySeconds:expect.any(Number)});
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"PAID"});
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(`payment_confirmation_v2_${testOrder.paymentId}`)).toEqual({status:"RETRY"});
    await api.queue({messages:[queueMessage]} as never,env("true"));
    expect(queueMessage.ack).toHaveBeenCalledOnce();
    expect(queueMessage.retry).toHaveBeenCalledOnce();
    expect(sends.at(-1)).toMatchObject({to:sender,type:"text",text:{body:`Payment of PKR ${testOrder.amount} received and verified for order ${testOrder.order.orderNumber}. Your order is confirmed.`}});
    const sentMessage=sqlite.prepare("SELECT provider_message_id,status FROM outbound_messages WHERE idempotency_key=?").get(`payment_confirmation_v2_${testOrder.paymentId}:whatsapp`) as {provider_message_id:string;status:string};
    expect(sentMessage).toMatchObject({status:"SENT",provider_message_id:`synthetic-outbound-${sends.length}`});
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(`payment_confirmation_v2_${testOrder.paymentId}`)).toEqual({status:"SENT"});
    await callback([], [{field:"messages",value:{metadata:{phone_number_id:phoneId},statuses:[{id:sentMessage.provider_message_id,status:"read"},{id:sentMessage.provider_message_id,status:"delivered"}]}}]);
    expect(sqlite.prepare("SELECT status FROM outbound_messages WHERE idempotency_key=?").get(`payment_confirmation_v2_${testOrder.paymentId}:whatsapp`)).toEqual({status:"READ"});
    const duplicateQueueMessage={...queueMessage,ack:vi.fn(),retry:vi.fn()};
    const sendCount=sends.length;
    await api.queue({messages:[duplicateQueueMessage]} as never,env("true"));
    expect(duplicateQueueMessage.ack).toHaveBeenCalledOnce();
    expect(sends).toHaveLength(sendCount);

    const retry=await adminPost(path,bodyData,"true","true");
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({alreadyApproved:true});
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_CONFIRMATION'").get()).toEqual({count:1});
    expect(sqlite.prepare("SELECT count(*) AS count FROM audit_log WHERE action='PAYMENT_APPROVED'").get()).toEqual({count:1});
  });

  it("sends the exact Urdu PAID confirmation to the order's stored WhatsApp identity", async () => {
    const target="923001234563";
    const testOrder=await createSyntheticPaymentReviewOrder(target,"urdu-confirmation-order",true);
    verifySyntheticPaymentMethod();
    const key=`payment_confirmation_v2_${testOrder.paymentId}`;
    const now=new Date().toISOString();
    const response=await adminPost(`/api/payments/${testOrder.paymentId}/approve`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reference:"SYNTHETIC-UR-TXN-193",settlementEvidenceRef:"SYNTHETIC-UR-STATEMENT-193",settlementConfirmed:true},"true","true");
    expect(response.status).toBe(200);
    sqlite.prepare("UPDATE whatsapp_conversations SET state_data=?,last_inbound_at=?,last_inbound_message_id=? WHERE wa_id=?").run(JSON.stringify({language:"ur",orderId:testOrder.order.orderId}),now,"synthetic-urdu-confirmation-window",target);
    const message={body:{kind:"WHATSAPP_PAYMENT_CONFIRMATION",idempotencyKey:key,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    const sendsBefore=sends.length;
    await api.queue({messages:[message]} as never,env("true"));
    expect(message.ack).toHaveBeenCalledOnce();
    expect(sends.at(-1)).toMatchObject({to:target,type:"text",text:{body:`آپ کے آرڈر ${testOrder.order.orderNumber} کی ${testOrder.amount} روپے ادائیگی کی تصدیق ہو گئی ہے۔ آپ کا آرڈر کنفرم ہو گیا ہے۔`}});
    expect(sqlite.prepare("SELECT provider_message_id,status FROM outbound_messages WHERE idempotency_key=?").get(`${key}:whatsapp`)).toEqual({provider_message_id:`synthetic-outbound-${sendsBefore+1}`,status:"SENT"});
  });

  it("blocks a PAID acknowledgement outside the service window without an approved utility template", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder("923001234566","closed-window-paid-confirmation",true);
    verifySyntheticPaymentMethod();
    const key=`payment_confirmation_v2_${testOrder.paymentId}`;
    const approval=await adminPost(`/api/payments/${testOrder.paymentId}/approve`,{orderId:testOrder.order.orderId,confirmation:testOrder.order.orderNumber,reference:"SYNTHETIC-TXN-CLOSED-193",settlementEvidenceRef:"SYNTHETIC-CREDIT-CLOSED-193",settlementConfirmed:true},"true","true");
    expect(approval.status).toBe(200);
    sqlite.prepare("UPDATE whatsapp_conversations SET state_data=?,last_inbound_at=? WHERE wa_id=?").run(JSON.stringify({language:"en",orderId:testOrder.order.orderId}),new Date(Date.now()-25*60*60_000).toISOString(),"923001234566");
    const message={body:{kind:"WHATSAPP_PAYMENT_CONFIRMATION",idempotencyKey:key,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    const sendsBefore=sends.length;
    await api.queue({messages:[message]} as never,env("true"));
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sendsBefore);
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key=?").get(key)).toEqual({status:"PERMANENT_FAILURE",last_error:"PAYMENT_CONFIRMATION_TEMPLATE_NOT_APPROVED"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='WHATSAPP_PAYMENT_CONFIRMATION_BLOCKED'").get()).toEqual({count:1});
  });

  it("resumes only a scheduled V2 order after Admin rejects its receipt and permits a fresh payment method", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder(sender,"v2-rejected-review-resume",true);
    verifySyntheticPaymentMethod();
    configureSyntheticPaymentMethodCopy();
    const rejected=await adminPost(`/api/payments/${testOrder.paymentId}/reject`,{orderId:testOrder.order.orderId,reason:"Synthetic mismatch for workflow test",confirmation:testOrder.order.orderNumber},"true","false","true","true");
    expect(rejected.status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"PAYMENT_REJECTED",payment_status:"PENDING"});
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({review_state:"REJECTED"});
    expect(sqlite.prepare("SELECT review_state FROM payment_receipts WHERE order_id=?").get(testOrder.order.orderId)).toEqual({review_state:"REJECTED"});
    expect(sqlite.prepare("SELECT status,phase FROM payment_reminder_v2_schedules WHERE order_id=?").get(testOrder.order.orderId)).toEqual({status:"ACTIVE",phase:"PAYMENT_PENDING"});
    expect(conversation()?.state).not.toBe("CANCELLED_UNPAID");
    const selected=await selectPaymentMethod(db,testOrder.order.orderId,"JAZZCASH","en",undefined,"synthetic-v2-rejection-retry",true);
    expect(selected.orderState).toBe("PAYMENT_PENDING");
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"PAYMENT_PENDING"});
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({review_state:"PENDING"});
  });

  it("retains late post-cancellation receipt evidence for Admin without marking PAID", async () => {
    const target="923001234565";
    const testOrder=await createSyntheticPaymentReviewOrder(target,"late-after-cancelled-order",true);
    sqlite.prepare("DELETE FROM payment_receipts WHERE order_id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE orders SET state='CANCELLED_UNPAID',payment_status='CANCELLED_UNPAID' WHERE id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE payments SET review_state='CANCELLED_UNPAID' WHERE id=?").run(testOrder.paymentId);
    sqlite.prepare("UPDATE payment_reminder_v2_schedules SET status='TERMINAL',phase='CANCELLED_UNPAID' WHERE order_id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE whatsapp_conversations SET state='CANCELLED_UNPAID',state_data=? WHERE wa_id=?").run(JSON.stringify({language:"en",orderId:testOrder.order.orderId}),target);
    const lateMediaId="synthetic-late-media-evidence";
    const response=await callback([{from:target,id:"synthetic-late-receipt-inbound",timestamp:"1792497600",type:"image",image:{id:lateMediaId,mime_type:"image/png"}}],[],true);
    expect(response.status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id=?").get(testOrder.order.orderId)).toEqual({state:"CANCELLED_UNPAID",payment_status:"CANCELLED_UNPAID"});
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id=?").get(testOrder.paymentId)).toEqual({review_state:"LATE_REVIEW"});
    expect(sqlite.prepare("SELECT review_state,provider_media_id FROM payment_receipts WHERE order_id=?").get(testOrder.order.orderId)).toEqual({review_state:"LATE_REVIEW",provider_media_id:lateMediaId});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='LATE_PAYMENT_EVIDENCE_RECEIVED'").get()).toEqual({count:1});
    expect(sends.at(-1)).toMatchObject({to:target,type:"interactive"});
    expect(sqlite.prepare("SELECT state FROM orders WHERE id=?").get(testOrder.order.orderId)).not.toEqual({state:"PAID"});
  });

  it("renders and records a published reminder and advances its delivery stage only on Meta callback", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder(sender,"reminder-queue-order");
    sqlite.prepare("DELETE FROM payment_receipts WHERE order_id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING' WHERE id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE payments SET review_state='PENDING' WHERE id=?").run(testOrder.paymentId);
    const order=sqlite.prepare("SELECT created_at FROM orders WHERE id=?").get(testOrder.order.orderId) as {created_at:string};
    const schedule=await createPaymentV2Schedule(db,testOrder.order.orderId,testOrder.paymentId,new Date(order.created_at));
    const stageId=`${schedule.scheduleId}:stage:15`;
    const idempotencyKey=stageId;
    const now=new Date().toISOString();
    sqlite.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_PENDING',state_data=?,last_inbound_at=?,last_inbound_message_id=? WHERE wa_id=?").run(JSON.stringify({language:"en",orderId:testOrder.order.orderId}),now,"synthetic-reminder-window",sender);
    sqlite.prepare("UPDATE payment_v2_template_versions SET body=?,state='PUBLISHED',published_at=?,published_by='SYNTHETIC_TEST' WHERE template_key='REMINDER_15M' AND locale='en' AND version=1").run("Reminder {orderNumber}: PKR {amount}; {remainingMinutes} min left until {deadline}; method {paymentMethod}.",now);
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='QUEUED' WHERE id=?").run(stageId);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'QUEUED',?,?,?)").run(`outbox-${stageId}`,idempotencyKey,"WHATSAPP_PAYMENT_REMINDER",testOrder.order.orderId,JSON.stringify({scheduleId:schedule.scheduleId,stageId,stageMinutes:15,orderId:testOrder.order.orderId,paymentId:testOrder.paymentId,customerId:sqlite.prepare("SELECT customer_id FROM orders WHERE id=?").get(testOrder.order.orderId)?.customer_id}),now,now,now);
    const message={body:{kind:"WHATSAPP_PAYMENT_REMINDER",idempotencyKey,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    await api.queue({messages:[message]} as never,env("false","true","true"));
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    const expectedDeadline=new Date(Date.parse(order.created_at)+240*60_000).toLocaleString("en-PK",{timeZone:"Asia/Karachi"});
    expect(sends.at(-1)).toMatchObject({to:sender,type:"text",text:{body:`Reminder ${testOrder.order.orderNumber}: PKR ${testOrder.amount}; 225 min left until ${expectedDeadline}; method JAZZCASH.`}});
    const sent=sqlite.prepare("SELECT provider_message_id,status FROM outbound_messages WHERE idempotency_key=?").get(idempotencyKey) as {provider_message_id:string;status:string};
    expect(sent).toMatchObject({provider_message_id:`synthetic-outbound-${sends.length}`,status:"SENT"});
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE id=?").get(stageId)).toEqual({status:"SENT"});
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET due_at='2000-01-01T00:00:00.000Z' WHERE schedule_id=? AND stage_minutes=270").run(schedule.scheduleId);
    await callback([], [{field:"messages",value:{metadata:{phone_number_id:phoneId},statuses:[{id:sent.provider_message_id,status:"delivered"}]}}]);
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE id=?").get(stageId)).toEqual({status:"DELIVERED"});

    const closedWindowAt=new Date(Date.now()-25*60*60_000).toISOString();
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=? WHERE wa_id=?").run(closedWindowAt,sender);
    const blockedStage=`${schedule.scheduleId}:stage:30`;
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='QUEUED' WHERE id=?").run(blockedStage);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'QUEUED',?,?,?)").run(`outbox-${blockedStage}`,blockedStage,"WHATSAPP_PAYMENT_REMINDER",testOrder.order.orderId,JSON.stringify({scheduleId:schedule.scheduleId,stageId:blockedStage,stageMinutes:30,orderId:testOrder.order.orderId,paymentId:testOrder.paymentId,customerId:sqlite.prepare("SELECT customer_id FROM orders WHERE id=?").get(testOrder.order.orderId)?.customer_id}),now,now,now);
    const sendsBefore=sends.length;
    const blockedMessage={body:{kind:"WHATSAPP_PAYMENT_REMINDER",idempotencyKey:blockedStage,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    await api.queue({messages:[blockedMessage]} as never,env("false","true","true"));
    expect(blockedMessage.ack).toHaveBeenCalledOnce();
    expect(blockedMessage.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sendsBefore);
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key=?").get(blockedStage)).toEqual({status:"PERMANENT_FAILURE",last_error:"PAYMENT_REMINDER_CMS_TEMPLATE_NOT_PUBLISHED"});
    expect(sqlite.prepare("SELECT status,last_error FROM payment_reminder_v2_stages WHERE id=?").get(blockedStage)).toEqual({status:"BLOCKED_TEMPLATE",last_error:"PAYMENT_REMINDER_CMS_TEMPLATE_NOT_PUBLISHED"});

    const graceStage=`${schedule.scheduleId}:stage:240`;
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='DELIVERED' WHERE schedule_id=? AND stage_minutes IN (60,210)").run(schedule.scheduleId);
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='QUEUED' WHERE id=?").run(graceStage);
    sqlite.prepare("UPDATE payment_reminder_v2_schedules SET phase='PAYMENT_GRACE' WHERE id=?").run(schedule.scheduleId);
    sqlite.prepare("UPDATE orders SET state='PAYMENT_GRACE' WHERE id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=? WHERE wa_id=?").run(new Date().toISOString(),sender);
    sqlite.prepare("UPDATE payment_v2_template_versions SET body=?,state='PUBLISHED',published_at=?,published_by='SYNTHETIC_TEST' WHERE template_key='GRACE_NOTICE_4H' AND locale='en' AND version=1").run("Final grace for {orderNumber}, PKR {amount}, until {deadline}: {remainingMinutes} minutes remain.",new Date().toISOString());
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'QUEUED',?,?,?)").run(`outbox-${graceStage}`,graceStage,"WHATSAPP_PAYMENT_REMINDER",testOrder.order.orderId,JSON.stringify({scheduleId:schedule.scheduleId,stageId:graceStage,stageMinutes:240,orderId:testOrder.order.orderId,paymentId:testOrder.paymentId,customerId:sqlite.prepare("SELECT customer_id FROM orders WHERE id=?").get(testOrder.order.orderId)?.customer_id}),now,now,now);
    const graceMessage={body:{kind:"WHATSAPP_PAYMENT_REMINDER",idempotencyKey:graceStage,entityId:testOrder.order.orderId,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    await api.queue({messages:[graceMessage]} as never,env("false","true","true"));
    expect(graceMessage.ack).toHaveBeenCalledOnce();
    expect(sends.at(-1)).toMatchObject({to:sender,type:"text",text:{body:`Final grace for ${testOrder.order.orderNumber}, PKR ${testOrder.amount}, until ${new Date(Date.parse(order.created_at)+270*60_000).toLocaleString("en-PK",{timeZone:"Asia/Karachi"})}: 30 minutes remain.`}});
    const graceWamid=sqlite.prepare("SELECT provider_message_id FROM outbound_messages WHERE idempotency_key=?").get(graceStage)?.provider_message_id as string;
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET due_at='2000-01-01T00:00:00.000Z' WHERE schedule_id=? AND stage_minutes=270").run(schedule.scheduleId);
    await callback([], [{field:"messages",value:{metadata:{phone_number_id:phoneId},statuses:[{id:graceWamid,status:"delivered"}]}}]);
    expect(sqlite.prepare("SELECT status FROM payment_reminder_v2_stages WHERE id=?").get(graceStage)).toEqual({status:"DELIVERED"});
    expect(Date.parse(sqlite.prepare("SELECT due_at FROM payment_reminder_v2_stages WHERE schedule_id=? AND stage_minutes=270").get(schedule.scheduleId)?.due_at as string)).toBeGreaterThan(Date.now()+29*60_000);
  });

  it("creates milestones only for explicitly V2-enabled new submissions", async () => {
    const v1=await createSyntheticPaymentReviewOrder("923001234561","v1-order-no-v2-schedule");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_reminder_v2_schedules WHERE order_id=?").get(v1.order.orderId)).toEqual({count:0});
    const v2=await createSyntheticPaymentReviewOrder("923001234562","v2-order-with-schedule",true);
    const order=sqlite.prepare("SELECT created_at FROM orders WHERE id=?").get(v2.order.orderId) as {created_at:string};
    const schedule=sqlite.prepare("SELECT source_created_at,status FROM payment_reminder_v2_schedules WHERE order_id=?").get(v2.order.orderId);
    expect(schedule).toEqual({source_created_at:order.created_at,status:"ACTIVE"});
    expect(sqlite.prepare("SELECT stage_minutes,due_at FROM payment_reminder_v2_stages WHERE schedule_id=(SELECT id FROM payment_reminder_v2_schedules WHERE order_id=?) ORDER BY stage_minutes").all(v2.order.orderId)).toEqual([15,30,60,210,240,270].map(minutes=>({stage_minutes:minutes,due_at:new Date(Date.parse(order.created_at)+minutes*60_000).toISOString()})));
  });

  it("Cron dispatches due outbox jobs once and recovers stale queue claims", async () => {
    const testOrder=await createSyntheticPaymentReviewOrder(sender,"cron-outbox-recovery",true);
    sqlite.prepare("DELETE FROM payment_receipts WHERE order_id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING',payment_status='PENDING' WHERE id=?").run(testOrder.order.orderId);
    sqlite.prepare("UPDATE payments SET review_state='PENDING' WHERE id=?").run(testOrder.paymentId);
    const schedule=await createPaymentV2Schedule(db,testOrder.order.orderId,testOrder.paymentId,new Date(sqlite.prepare("SELECT created_at FROM orders WHERE id=?").get(testOrder.order.orderId)?.created_at as string));
    const stageId=`${schedule.scheduleId}:stage:15`,now=new Date().toISOString();
    sqlite.prepare("UPDATE payment_reminder_v2_stages SET status='QUEUED' WHERE id=?").run(stageId);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").run(`outbox-${stageId}`,stageId,"WHATSAPP_PAYMENT_REMINDER",testOrder.order.orderId,JSON.stringify({scheduleId:schedule.scheduleId,stageId,stageMinutes:15,orderId:testOrder.order.orderId,paymentId:testOrder.paymentId,customerId:sqlite.prepare("SELECT customer_id FROM orders WHERE id=?").get(testOrder.order.orderId)?.customer_id}),now,now,now);
    const scheduled=(scheduledTime:number)=>api.scheduled!({scheduledTime} as ScheduledController,env("false","true","true"));
    await scheduled(Date.now());
    expect(queueSend).toHaveBeenCalledOnce();
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(stageId)).toEqual({status:"QUEUED"});
    await scheduled(Date.now()+60_000);
    expect(queueSend).toHaveBeenCalledOnce();
    await scheduled(Date.now()+6*60_000);
    expect(queueSend).toHaveBeenCalledTimes(2);
  });

  it("honors STOP REMINDERS before an order exists and suppresses later V2 stages", async () => {
    const target="923001234564";
    await inbound("STOP REMINDERS","synthetic-stop-before-order",target,true);
    expect(body()).toContain("opted out of payment reminders");
    expect(sqlite.prepare("SELECT customer_id,wa_id,source FROM payment_reminder_v2_opt_outs WHERE wa_id=?").get(target)).toEqual({customer_id:null,wa_id:target,source:"WHATSAPP"});
    const result=await persistFlowSubmission(db,{fullName:"NON-PAYABLE Synthetic",deliveryAddress:"SYNTHETIC opted-out order",nearbyPlace:"SYNTHETIC opted-out order",city:"Synthetic City",contactNumber:"03001234567",productCode:"FREE_5_PACK_VEGETABLE_SEEDS",province:"Synthetic Province",fertilizerSelected:false},undefined,"v2-opted-out-order",target,true);
    const createdAt=sqlite.prepare("SELECT created_at FROM orders WHERE id=?").get(result.orderId)?.created_at as string;
    expect(await enqueueDuePaymentV2Stages(db,new Date(Date.parse(createdAt)+5*60*60_000),true)).toMatchObject({queued:0});
    expect(sqlite.prepare("SELECT status,stop_reason FROM payment_reminder_v2_schedules WHERE order_id=?").get(result.orderId)).toEqual({status:"STOPPED",stop_reason:"OPTED_OUT"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_PAYMENT_REMINDER'").get()).toEqual({count:0});
  });

  it("lets authenticated Admin create and publish a versioned Urdu reminder without approving Meta utility status", async () => {
    const text="آرڈر {orderNumber} کی PKR {amount} ادائیگی باقی ہے۔ آخری وقت {deadline} ہے۔";
    const draft=await adminPost("/api/payment-reminder-templates/REMINDER_15M/ur/draft",{body:text,confirmation:"REMINDER_15M:ur"});
    expect(draft.status).toBe(200);
    const draftData=await draft.json() as {version:number;state:string};
    expect(draftData).toEqual({ok:true,version:2,state:"DRAFT"});
    const invalid=await adminPost("/api/payment-reminder-templates/REMINDER_15M/ur/draft",{body:"Unknown {customerPhone} placeholder must fail safely.",confirmation:"REMINDER_15M:ur"});
    expect(invalid.status).toBe(400);
    const publish=await adminPost("/api/payment-reminder-templates/REMINDER_15M/ur/publish",{version:2,confirmation:"REMINDER_15M:ur:2"});
    expect(publish.status).toBe(200);
    expect(sqlite.prepare("SELECT version,body,state,utility_template_name,utility_approved_at FROM payment_v2_template_versions WHERE template_key='REMINDER_15M' AND locale='ur' AND version=2").get()).toEqual({version:2,body:text,state:"PUBLISHED",utility_template_name:null,utility_approved_at:null});
    expect(sqlite.prepare("SELECT state FROM payment_v2_template_versions WHERE template_key='REMINDER_15M' AND locale='ur' AND version=1").get()).toEqual({state:"SUPERSEDED"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action IN ('PAYMENT_REMINDER_TEMPLATE_DRAFT_SAVED','PAYMENT_REMINDER_TEMPLATE_PUBLISHED')").get()).toEqual({count:2});
  });

  it("stores trusted inbound receipt time and leaves it unchanged for status-only callbacks", async () => {
    const message = await inbound("START", "synthetic-window-inbound");
    const event = sqlite.prepare("SELECT created_at FROM whatsapp_events WHERE provider_event_id=?").get(`message:${message.id}`) as { created_at: string };
    expect(lastInboundAt()).toBe(event.created_at);
    const recordedAt = lastInboundAt();
    await callback([], [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, statuses: [{ id: "synthetic-provider-status", status: "delivered" }] } }]);
    expect(lastInboundAt()).toBe(recordedAt);
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

  it("does not reread or replay payment text/QR already delivered or read", async () => {
    await reachReview("en");
    await inbound(tap("PLACE_ORDER"));
    const order=sqlite.prepare("SELECT id,order_number,total_payable FROM orders").get() as {id:string;order_number:string;total_payable:number};
    sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING' WHERE id=?").run(order.id);
    sqlite.prepare("UPDATE payments SET method='JAZZCASH' WHERE order_id=?").run(order.id);
    configureSyntheticPaymentMethodCopy();
    verifySyntheticPaymentMethod();
    const method=sqlite.prepare("SELECT * FROM payment_methods WHERE method='JAZZCASH'").get() as Record<string,unknown>;
    const config=normalizePaymentMethodRow(method);
    const paymentText=formatPaymentMessage(order.order_number,order.total_payable,config,"en");
    const key="synthetic-already-delivered-payment";
    const now=new Date().toISOString();
    sqlite.prepare("UPDATE whatsapp_conversations SET last_inbound_at=?,last_inbound_message_id=? WHERE wa_id=?").run(now,"synthetic-payment-method-choice",sender);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?)").run(key,key,"WHATSAPP_PAYMENT_INSTRUCTIONS",order.id,JSON.stringify({orderId:order.id,orderNumber:order.order_number,amount:order.total_payable,method:"JAZZCASH",locale:"en",recipient:sender,message:paymentText,requestKey:key}),now,now,now);
    sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,order_id,kind,provider_message_id,status,attempt_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?)").run("sent-text",`${key}:text`,order.id,"WHATSAPP_PAYMENT_TEXT","synthetic-wamid-payment-text","READ",1,now,now,"sent-qr",`${key}:qr`,order.id,"WHATSAPP_PAYMENT_QR","synthetic-wamid-payment-qr","DELIVERED",1,now,now);
    await callback([], [{field:"messages",value:{metadata:{phone_number_id:phoneId},statuses:[{id:"synthetic-wamid-payment-text",status:"delivered"},{id:"synthetic-wamid-payment-qr",status:"read"},{id:"synthetic-wamid-payment-text",status:"read"}]}}]);
    const sentBefore=sends.length;
    const message={body:{kind:"WHATSAPP_PAYMENT_INSTRUCTIONS",idempotencyKey:key,entityId:order.id,schemaVersion:1 as const},attempts:1,ack:vi.fn(),retry:vi.fn()};
    await api.queue({messages:[message]} as never,env());
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(sends).toHaveLength(sentBefore);
    expect(receiptBucketGet).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(key)).toEqual({status:"SENT"});
    expect(sqlite.prepare("SELECT status FROM outbound_messages WHERE idempotency_key IN (?,?) ORDER BY idempotency_key").all(`${key}:qr`,`${key}:text`)).toEqual([{status:"READ"},{status:"READ"}]);
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
