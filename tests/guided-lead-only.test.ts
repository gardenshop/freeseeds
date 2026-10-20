import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index";

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

function conversation() {
  const row = sqlite.prepare("SELECT state,state_data FROM whatsapp_conversations WHERE wa_id=?").get(sender);
  return row ? { state: row.state, data: JSON.parse(String(row.state_data)) as Record<string, unknown> } : undefined;
}

function body() {
  const sent = sends.at(-1)!;
  return sent.type === "text" ? String((sent.text as { body: string }).body) : String((sent.interactive as { body: { text: string } }).body.text);
}

function buttons() {
  return (sends.at(-1)?.interactive as { action?: { buttons?: Array<{ reply: { id: string } }> } } | undefined)?.action?.buttons?.map((button) => button.reply.id) ?? [];
}

function env() {
  return { DB: db, RECEIPTS: { get: vi.fn(async () => null) }, EVENTS: { send: queueSend }, DEPLOYMENT_STATE: "LOCAL", WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true", META_PHONE_NUMBER_ID: phoneId, META_ACCESS_TOKEN: "synthetic-token", META_APP_SECRET: secret, META_CAPI_ENABLED: "false", WHATSAPP_CHECKOUT_MODE: "guided" } as never;
}

async function callback(messages: Record<string, unknown>[], extraChanges: unknown[] = []) {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages } }, ...extraChanges] }] });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return api.fetch(new Request("https://api.example.test/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` }, body: payload }), env());
}

async function inbound(input: string | Record<string, unknown>, id = `synthetic-inbound-${++sequence}`) {
  const message = { from: sender, id, timestamp: "1792497600", ...(typeof input === "string" ? { type: "text", text: { body: input } } : { type: "interactive", interactive: input }) };
  const response = await callback([message]);
  expect(response.status).toBe(200);
  return message;
}

const tap = (id: string) => ({ type: "button_reply", button_reply: { id, title: "Synthetic button" } });

async function reachReview(locale: "en" | "ur", fertilizer = false) {
  await inbound("START");
  expect(buttons()).toEqual(["LANG_UR", "LANG_EN"]);
  await inbound(tap(locale === "ur" ? "LANG_UR" : "LANG_EN"));
  await inbound(tap(fertilizer ? "ADD_FERTILIZER" : "SEEDS_ONLY"));
  expect(sends.at(-1)).toMatchObject({ interactive: { type: "list", action: { sections: [{ rows: [{ id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" }] }] } } });
  await inbound({ type: "list_reply", list_reply: { id: "PROVINCE_SYNTHETIC_PROVINCE", title: "Synthetic Province" } });
  for (const value of ["Synthetic Customer", "123 Synthetic Street", "Synthetic Park", "Synthetic City", "03001234567"]) await inbound(value);
  expect(conversation()?.state).toBe("REVIEW");
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
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    if (failNextSend) { failNextSend = false; return new Response("{}", { status: 503 }); }
    sends.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return Response.json({ messages: [{ id: `synthetic-outbound-${sends.length}` }] });
  }));
});

afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); });

describe("GFS-178 simulated signed-webhook lead-only journey", () => {
  it.each(["en", "ur"] as const)("persists one %s lead/order with every payment method disabled", async (locale) => {
    await reachReview(locale, true);
    if (locale === "ur") expect(body()).not.toMatch(/Delivery:|TOTAL:/);
    const confirmation = await inbound(tap("PLACE_ORDER"));
    expect(conversation()?.state).toBe("COMPLETE");
    const order = sqlite.prepare("SELECT * FROM orders").get()!;
    expect(order).toMatchObject({ state: "DETAILS_COMPLETED", payment_status: "PENDING", total_payable: 200 });
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
