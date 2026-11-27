import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index";
import admin from "../apps/admin/src/index";
import { persistFlowSubmission } from "@gfs/core";

// Entirely synthetic, in-memory data. No external provider or database is used.
const sender = "923001234567";
const phoneId = "1323932417479627";
const secret = "synthetic-recovery-webhook-secret";
let sqlite: DatabaseSync;
let db: D1Database;
let network: ReturnType<typeof vi.fn>;
let queueSend: ReturnType<typeof vi.fn>;
let puts: ReturnType<typeof vi.fn>;

function statement(sql: string) {
  let values: SQLInputValue[] = [];
  const result = {
    bind: (...args: SQLInputValue[]) => { values = args; return result; },
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) }, success: true })
  };
  return result;
}

function env(mode: string | undefined = "true") {
  return {
    DB: db, RECEIPTS: { get: vi.fn(), put: puts, delete: vi.fn() }, EVENTS: { send: queueSend },
    DEPLOYMENT_STATE: "LOCAL", ...(mode === "absent" ? {} : { RECOVERY_MODE: mode }), WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true",
    META_PHONE_NUMBER_ID: phoneId, META_ACCESS_TOKEN: "synthetic-token", META_APP_SECRET: secret,
    META_CAPI_ENABLED: "true", META_INSTANT_FORM_ENABLED: "true", WHATSAPP_CHECKOUT_MODE: "native",
    COD_V1_ENABLED: "true", COD_ROLLOUT_MODE: "PUBLIC", PAYMENT_AUTOMATION_V2_ENABLED: "true",
    PAYMENT_REMINDERS_V2_ENABLED: "true", PAYMENT_CHOICE_RECOVERY_ENABLED: "true", ORDER_INTENT_AUTOMATION_ENABLED: "true"
  };
}

async function callback(value: Record<string, unknown>, mode: string | undefined = "true", canonicalPhone = phoneId, validSignature = true) {
  const body = JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: canonicalPhone }, ...value } }] }] });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return api.fetch(new Request("https://synthetic.test/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": `sha256=${validSignature ? signature : "0".repeat(64)}` }, body }), env(mode) as never);
}

function textMessage(id: string, text = "START") {
  return { id, from: sender, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text }, referral: { ctwa_clid: "synthetic-click", source_type: "ad", platform: "android" } };
}

async function existingOrder() {
  const order = await persistFlowSubmission(db, { fullName: "SYNTHETIC NON-PAYABLE", deliveryAddress: "SYNTHETIC TEST ADDRESS", nearbyPlace: "SYNTHETIC ONLY", city: "Synthetic City", contactNumber: "03001234567", productCode: "FREE_5_PACK_VEGETABLE_SEEDS", province: "Synthetic Province", fertilizerSelected: false }, undefined, "synthetic-recovery-order", sender);
  sqlite.prepare("UPDATE orders SET state='PAYMENT_PENDING' WHERE id=?").run(order.orderId);
  sqlite.prepare("UPDATE payments SET method='JAZZCASH' WHERE order_id=?").run(order.orderId);
  const now = new Date().toISOString();
  sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at) VALUES('synthetic-conversation',?,'PAYMENT_PENDING',?,'synthetic-original-inbound',?,?,?)")
    .run(sender, JSON.stringify({ language: "en", orderId: order.orderId, orderNumber: order.orderNumber }), now, now, now);
  return order;
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").filter((name) => /^\d+.*\.sql$/.test(name)).sort()) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  db = { prepare: statement, batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
    sqlite.exec("BEGIN");
    try { const results = []; for (const item of statements) results.push(await item.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } as unknown as D1Database;
  sqlite.exec("INSERT INTO products(id,code,name,price_pkr,enabled,created_at,updated_at) VALUES('synthetic-product','FREE_5_PACK_VEGETABLE_SEEDS','SYNTHETIC',0,1,'2026-01-01','2026-01-01'); INSERT INTO province_delivery_rates(province,delivery_fee_pkr,enabled,created_at,updated_at) VALUES('Synthetic Province',250,1,'2026-01-01','2026-01-01');");
  puts = vi.fn(async () => undefined);
  queueSend = vi.fn(async () => undefined);
  network = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("synthetic-recovery-media")) return Response.json({ url: "https://synthetic-media.test/receipt", mime_type: "image/png", file_size: 3 });
    if (String(input) === "https://synthetic-media.test/receipt") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
    return Response.json({ messages: [{ id: "synthetic-outbound" }] });
  });
  vi.stubGlobal("fetch", network);
});

afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); });

describe("COD-compatible API recovery mode", () => {
  it("blocks Admin direct sends, reminder requests and fulfillment while retaining protected read access", async () => {
    const bindings = { ...env(), ADMIN_EMAIL: "admin@example.test" } as never;
    for (const path of ["/api/meta-activation/actions/send-test", "/api/meta-activation/actions/retry-failed-reply", "/api/payments/synthetic/request-transaction-reference", "/api/payments/synthetic/request-clearer-receipt", "/api/orders/synthetic/transition", "/api/orders/synthetic/tracking", "/api/orders/synthetic/confirm"]) {
      const response = await admin.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: { "cf-access-authenticated-user-email": "admin@example.test" }, body: "{}" }), bindings);
      expect(response.status, path).toBe(503);
    }
    for (const path of ["label", "shipping-label"]) expect((await admin.fetch(new Request(`https://admin.example.test/api/orders/synthetic/${path}`, { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), bindings)).status).toBe(503);
    expect((await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), bindings)).status).toBe(200);
    expect((await admin.fetch(new Request("https://admin.example.test/api/csrf"), bindings)).status).toBe(403);
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });
  it.each(["true", "TRUE", "", "invalid"])("fails closed for configured recovery value %j", async (mode) => {
    for (const path of ["/flows/get-free-seeds", "/webhooks/whatsapp/flows", "/webhooks/meta/instant-form", "/api/orders/quote", "/api/orders/synthetic/fertilizer", "/orders/synthetic/fertilizer", "/payments/synthetic/select", "/api/payments/synthetic/select", "/payments/synthetic/i-have-paid"]) {
      const response = await api.fetch(new Request(`https://synthetic.test${path}`, { method: "POST", body: "{}" }), env(mode) as never);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "RECOVERY_MODE" });
    }
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it("retains delivered intent timing evidence in recovery without scheduling or anchoring new work", async () => {
    const order = await existingOrder();
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO order_confirmation_intents(intent_id,workflow_version,order_id,conversation_id,state,advance_total_pkr,cod_enabled,presentation_message_id,created_at,updated_at) SELECT 'synthetic-intent','GFS-ORDERFLOW-INTENT-030-V1',id,'synthetic-conversation','PRESENTATION_PENDING',total_payable,0,'synthetic-delivery',?,? FROM orders WHERE id=?").run(now, now, order.orderId);
    sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,kind,status,provider_message_id,created_at,updated_at) VALUES('synthetic-outbound','synthetic-outbound-key','ORDER_INTENT_OPTIONS','SENT','synthetic-delivery',?,?)").run(now, now);
    const response = await callback({ statuses: [{ id: "synthetic-delivery", recipient_id: sender, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)) }] });
    expect(response.status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_delivery_receipts").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT state,presented_at FROM order_confirmation_intents").get()).toEqual({ state: "PRESENTATION_PENDING", presented_at: null });
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it("silently suppresses new and in-progress checkout inputs, including replay after resume", async () => {
    const message = textMessage("synthetic-suppressed-checkout");
    expect((await callback({ messages: [message] })).status).toBe(200);
    expect((await callback({ messages: [message] }, "false")).status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_conversations").get()).toEqual({ count: 0 });
    const now = new Date().toISOString();
    const state = JSON.stringify({ language: "en", fullName: "SYNTHETIC", deliveryAddress: "SYNTHETIC ADDRESS", nearbyPlace: "SYNTHETIC", city: "Synthetic City", contactNumber: "03001234567", province: "Synthetic Province" });
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,created_at,updated_at) VALUES('synthetic-review',?,'REVIEW',?,?,?)").run(sender, state, now, now);
    for (const action of ["PAY_ADVANCE", "PAY_COD", "PLACE_ORDER", "CONFIRM_COD_ORDER"]) {
      const input = { id: `synthetic-${action}`, from: sender, type: "interactive", interactive: { type: "button_reply", button_reply: { id: action, title: "SYNTHETIC" } } };
      expect((await callback({ messages: [input] })).status).toBe(200);
      expect((await callback({ messages: [input] }, "false")).status).toBe(200);
    }
    expect(sqlite.prepare("SELECT state,state_data FROM whatsapp_conversations").get()).toEqual({ state: "REVIEW", state_data: state });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it("retains existing receipt ingestion and reference review without any acknowledgement or approval", async () => {
    const order = await existingOrder();
    const media = { from: sender, id: "synthetic-receipt-event", type: "image", image: { id: "synthetic-recovery-media", mime_type: "image/png" } };
    expect((await callback({ messages: [media] })).status).toBe(200);
    expect((await callback({ messages: [media] })).status).toBe(200);
    expect(puts).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(2); // Only private receipt download, never a send.
    expect((await callback({ messages: [textMessage("synthetic-reference-event", "SYNTHETIC-TID-1234")] })).status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id=?").get(order.orderId)).toEqual({ state: "PAYMENT_REVIEW", payment_status: "PENDING", total_payable: 250 });
    expect(sqlite.prepare("SELECT review_state,customer_transaction_reference,approved_at FROM payments WHERE order_id=?").get(order.orderId)).toEqual({ review_state: "REVIEW", customer_transaction_reference: "SYNTHETIC-TID-1234", approved_at: null });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbound_messages").get()).toEqual({ count: 0 });
    expect(queueSend).not.toHaveBeenCalled();
    const payment = sqlite.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId)!;
    const replay = await api.fetch(new Request("https://synthetic.test/receipts/ingest", { method: "POST", body: JSON.stringify({ orderId: order.orderId, paymentId: payment.id, mediaId: "synthetic-recovery-media" }) }), env() as never);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ alreadyAssociated: true, reviewState: "REVIEW" });
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("keeps signed canonical status callbacks monotonic without requiring new intent schema", async () => {
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO outbound_messages(id,idempotency_key,kind,provider_message_id,status,created_at,updated_at) VALUES('synthetic-out','synthetic-out','CONVERSATION_REPLY','synthetic-provider-id','SENT',?,?)").run(now, now);
    for (const status of ["read", "delivered", "sent", "failed"]) {
      expect((await callback({ statuses: [{ id: "synthetic-provider-id", status, timestamp: String(Math.floor(Date.now() / 1000)) }] })).status).toBe(200);
    }
    expect(sqlite.prepare("SELECT status FROM outbound_messages").get()).toEqual({ status: "READ" });
    expect(network).not.toHaveBeenCalled();
  });

  it("still rejects invalid signatures and noncanonical phone callbacks", async () => {
    expect((await callback({ messages: [textMessage("synthetic-invalid")] }, "true", phoneId, false)).status).toBe(403);
    expect((await callback({ messages: [textMessage("synthetic-wrong-phone")] }, "true", "synthetic-wrong-phone")).status).toBe(403);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_events").get()).toEqual({ count: 0 });
    expect(network).not.toHaveBeenCalled();
  });

  it("defers all existing Queue kinds without sends, dropped work or durable attempt changes", async () => {
    const kinds = ["WHATSAPP_ORDER_INTENT_STAGE", "WHATSAPP_PAYMENT_CONFIRMED", "WHATSAPP_PAYMENT_REMINDER", "WHATSAPP_PAYMENT_CHOICE_RECOVERY", "WHATSAPP_PAYMENT_INSTRUCTIONS", "WHATSAPP_TRANSACTION_REFERENCE_REQUEST", "WHATSAPP_CLEARER_RECEIPT", "WHATSAPP_RECEIPT_REQUEST", "META_INSTANT_FORM_LEAD", "CAPI_LEAD", "CAPI_PURCHASE", "FUTURE_KIND"];
    const now = new Date().toISOString();
    for (const kind of kinds) sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at) VALUES(?,?,?,'synthetic-entity','{}','QUEUED',4,?,?,?)").run(kind, kind, kind, now, now, now);
    const before = sqlite.prepare("SELECT * FROM outbox_jobs ORDER BY id").all();
    const messages = kinds.map((kind) => ({ body: { kind, idempotencyKey: kind, entityId: "synthetic-entity", schemaVersion: 1 as const }, attempts: 99, ack: vi.fn(), retry: vi.fn() }));
    for (let replay = 0; replay < 2; replay++) await api.queue({ messages } as unknown as MessageBatch<typeof messages[number]["body"]>, env() as never);
    for (const message of messages) { expect(message.ack).not.toHaveBeenCalled(); expect(message.retry).toHaveBeenCalledTimes(2); expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 300 }); }
    expect(sqlite.prepare("SELECT * FROM outbox_jobs ORDER BY id").all()).toEqual(before);
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it("makes scheduled recovery a no-op even when every automation flag is on", async () => {
    await existingOrder();
    const before = sqlite.prepare("SELECT total_changes() AS changes").get();
    await api.scheduled({ scheduledTime: Date.now() + 24 * 60 * 60_000 } as ScheduledController, env() as never);
    expect(sqlite.prepare("SELECT total_changes() AS changes").get()).toEqual(before);
    expect(network).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it.each(["absent", "false"])("preserves default normal inbound behavior for %j and resumes only on fresh input", async (mode) => {
    expect((await callback({ messages: [textMessage("synthetic-normal")] }, mode)).status).toBe(200);
    expect(network).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare("SELECT state FROM whatsapp_conversations").get()).toEqual({ state: "LANGUAGE" });
  });
});
