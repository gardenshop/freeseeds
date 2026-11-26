import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anchorOrderIntentOnDelivery, cancelOrderIntent, expireDueOrderIntents, expireOrderIntent, formatIntentRemainingTime, orderIntentCodConfirmationText, orderIntentNewOrderButton, orderIntentOptionRows, orderIntentOptionsText, orderIntentReminderText, queueDueOrderIntentReminders, switchIntentAdvanceToCod, ORDER_INTENT_DURATION_MS, ORDER_INTENT_VERSION } from "../apps/api/src/order-intent.js";
import worker, { finalizeCodOrder } from "../apps/api/src/index.js";
import { enqueueDuePaymentChoiceRecoveryStages } from "../apps/api/src/payment-choice-recovery.js";
import { parseWhatsAppDeliveryReceipts } from "../packages/core/src/webhook.js";
import { evaluateStoredFreeWhatsAppOutbound } from "../packages/core/src/free-messaging.js";

let sqlite: DatabaseSync;

function makeDb(): D1Database {
  let batchTail: Promise<unknown> = Promise.resolve();
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind: (...args: SQLInputValue[]) => { values = args; return statement; },
        first: async <T>() => sqlite.prepare(sql).get(...values) as T | undefined,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
      };
      return statement;
    },
    batch: (statements: Array<{ run: () => Promise<unknown> }>) => {
      const run = batchTail.then(async () => {
        sqlite.exec("BEGIN");
        try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
        catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      });
      batchTail = run.catch(() => undefined);
      return run;
    }
  } as unknown as D1Database;
}

function seedIntent(now: string, locale: "en" | "ur" = "en") {
  sqlite.prepare("INSERT INTO customers(id,wa_id,normalized_address_hash) VALUES('customer-synthetic','synthetic-wa-id','household-synthetic')").run();
  sqlite.prepare(`INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at)
    VALUES('conversation-synthetic','synthetic-wa-id','REVIEW',?,'inbound-synthetic',?,?,?)`).run(JSON.stringify({ language: locale }), now, now, now);
  sqlite.prepare(`INSERT INTO orders(id,order_number,customer_id,state,payment_status,total_payable,province,archived_at,created_at,updated_at)
    VALUES('order-synthetic','SYNTHETIC-ORDER','customer-synthetic','PAYMENT_PENDING','PENDING',250,'SYNTHETIC-PROVINCE',NULL,?,?)`).run(now, now);
  sqlite.prepare(`INSERT INTO payments(id,order_id,method,review_state,approved_amount,approved_by,approved_at,submitted_at,customer_transaction_reference,expected_amount,updated_at)
    VALUES('payment-synthetic','order-synthetic','JAZZCASH','PENDING',NULL,NULL,NULL,NULL,NULL,250,?)`).run(now);
  sqlite.prepare(`INSERT INTO order_eligibility_locks(household_key,order_id,order_number,last_order_at)
    VALUES('household-synthetic','order-synthetic','SYNTHETIC-ORDER',?)`).run(now);
  sqlite.prepare(`INSERT INTO order_confirmation_intents(intent_id,workflow_version,order_id,conversation_id,state,advance_total_pkr,cod_enabled,cod_fee_pkr,cod_total_pkr,created_at,updated_at)
    VALUES('intent-synthetic',?,'order-synthetic','conversation-synthetic','PRESENTATION_PENDING',250,0,NULL,NULL,?,?)`).run(ORDER_INTENT_VERSION, now, now);
  sqlite.prepare("INSERT INTO order_confirmation_intent_preferences(intent_id,locale,created_at) VALUES('intent-synthetic',?,?)").run(locale, now);
}

function addReceipt(now: string) {
  sqlite.prepare(`INSERT INTO payment_receipts(id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at)
    VALUES('receipt-synthetic','payment-synthetic','order-synthetic','media-synthetic','private/synthetic','hash-synthetic','image/png',128,?,?)`).run(now, now);
}

function prepareCodConfirmation(now: string) {
  const quote = { baseAmountPkr: 250, feePkr: 125, totalPkr: 375, policyRevision: "synthetic-policy", collectionPolicyHash: "synthetic-collection", remittancePolicyHash: "synthetic-remittance" };
  const stateData = JSON.stringify({ language: "en", intentId: "intent-synthetic", orderId: "order-synthetic", orderNumber: "SYNTHETIC-ORDER", codQuote: quote });
  sqlite.prepare(`UPDATE order_confirmation_intents SET state='COD_CONFIRM_PENDING',cod_enabled=1,cod_fee_pkr=125,cod_total_pkr=375,
    cod_policy_revision=?,collection_policy_hash=?,remittance_policy_hash=?,presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'`)
    .run(quote.policyRevision, quote.collectionPolicyHash, quote.remittancePolicyHash, now, new Date(Date.parse(now) + ORDER_INTENT_DURATION_MS).toISOString());
  sqlite.prepare("UPDATE payments SET method=NULL WHERE id='payment-synthetic'").run();
  sqlite.prepare("UPDATE whatsapp_conversations SET wa_id='00000000000',state='COD_CONFIRM',state_data=? WHERE id='conversation-synthetic'").run(stateData);
  sqlite.prepare("INSERT INTO province_delivery_rates(province,enabled) VALUES('SYNTHETIC-PROVINCE',1)").run();
  sqlite.prepare("INSERT INTO cod_configuration(id,enabled,fee_pkr,revision,collection_policy_hash,remittance_policy_hash,updated_by,updated_at) VALUES('default',1,125,?,'synthetic-collection','synthetic-remittance','synthetic-admin',?)").run(quote.policyRevision, now);
  sqlite.prepare(`INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at)
    VALUES(?,'COD_CONFIGURATION_UPDATED','ADMIN','synthetic-admin','COD_CONFIGURATION','default','synthetic-correlation',?,?)`)
    .run(quote.policyRevision, JSON.stringify({ enabled: 1, feePkr: 125, collectionPolicyHash: quote.collectionPolicyHash, remittancePolicyHash: quote.remittancePolicyHash }), now);
  return { quote, stateData };
}

function presentIntent(startMs: number) {
  const presentedAt = new Date(startMs).toISOString();
  const deadline = new Date(startMs + ORDER_INTENT_DURATION_MS).toISOString();
  sqlite.prepare("UPDATE order_confirmation_intents SET state='AWAITING_DECISION',presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'").run(presentedAt, deadline);
  for (const [minutes, offset] of [[10, 10], [25, 25], [30, 30]] as const) {
    sqlite.prepare("INSERT OR IGNORE INTO order_confirmation_intent_stages(intent_id,stage_minutes,due_at,status,idempotency_key,created_at,updated_at) VALUES('intent-synthetic',?,?, 'PENDING',?,?,?)")
      .run(minutes, new Date(startMs + offset * 60_000).toISOString(), `intent-stage-${minutes}`, presentedAt, presentedAt);
  }
  return { presentedAt, deadline };
}

function syntheticReceiptBatch(db: D1Database, now: string, deadline: string) {
  return db.batch([
    db.prepare(`INSERT INTO payment_receipts(id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at)
      SELECT 'race-receipt','payment-synthetic','order-synthetic','synthetic-media','private/synthetic','synthetic-hash','image/png',128,?,?
      WHERE EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id JOIN order_confirmation_intents i ON i.order_id=o.id
        WHERE o.id='order-synthetic' AND o.state='PAYMENT_PENDING' AND o.payment_status='PENDING' AND p.review_state='PENDING' AND i.deadline_at>=?)`).bind(now,now,deadline),
    db.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=COALESCE(submitted_at,?),updated_at=? WHERE id='payment-synthetic' AND changes()=1").bind(now,now),
    db.prepare("UPDATE orders SET state='PAYMENT_REVIEW',updated_at=? WHERE id='order-synthetic' AND state='PAYMENT_PENDING' AND changes()=1").bind(now)
  ]);
}

describe("GFS-ORDERFLOW INTENT-030", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sqlite?.close();
  });

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys=ON");
    sqlite.exec(`
      CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT,normalized_address_hash TEXT);
      CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY,wa_id TEXT,state TEXT,state_data TEXT,last_inbound_message_id TEXT,last_inbound_at TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT,customer_id TEXT,state TEXT,payment_status TEXT,total_payable INTEGER,province TEXT,archived_at TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT,method TEXT,review_state TEXT,approved_amount INTEGER,approved_by TEXT,approved_at TEXT,submitted_at TEXT,customer_transaction_reference TEXT,expected_amount INTEGER,updated_at TEXT);
      CREATE TABLE payment_receipts(id TEXT PRIMARY KEY,payment_id TEXT,order_id TEXT,provider_media_id TEXT,r2_object_key TEXT,sha256 TEXT,mime_type TEXT,size_bytes INTEGER,submitted_at TEXT,created_at TEXT);
      CREATE TABLE cod_order_details(order_id TEXT PRIMARY KEY,base_amount_pkr INTEGER,cod_fee_pkr INTEGER,quoted_total_pkr INTEGER,policy_revision TEXT,collection_policy_hash TEXT,remittance_policy_hash TEXT,test_hold INTEGER,status TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE province_delivery_rates(province TEXT PRIMARY KEY,enabled INTEGER);
      CREATE TABLE cod_configuration(id TEXT PRIMARY KEY,enabled INTEGER,fee_pkr INTEGER,revision TEXT,collection_policy_hash TEXT,remittance_policy_hash TEXT,updated_by TEXT,updated_at TEXT);
      CREATE TABLE order_eligibility_locks(household_key TEXT PRIMARY KEY,order_id TEXT,order_number TEXT,last_order_at TEXT);
      CREATE TABLE cod_mo_receipts(mo_reference_hmac TEXT PRIMARY KEY,order_id TEXT NOT NULL,received_at TEXT NOT NULL);
      CREATE TABLE cod_historical_mo_receipts(mo_reference_hmac TEXT PRIMARY KEY,order_id TEXT NOT NULL,received_at TEXT NOT NULL);
      CREATE TABLE whatsapp_events(provider_event_id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
      CREATE TABLE outbound_messages(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,order_id TEXT,customer_id TEXT,kind TEXT,status TEXT,attempt_count INTEGER DEFAULT 0,last_error TEXT,provider_message_id TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE payment_reminder_v2_opt_outs(customer_id TEXT,wa_id TEXT);
      CREATE TABLE payment_choice_recovery_stages(order_id TEXT,stage_minutes INTEGER,status TEXT,due_at TEXT,locale TEXT,inbound_message_id TEXT,inbound_at TEXT,outbound_idempotency_key TEXT,last_error TEXT,created_at TEXT,updated_at TEXT,PRIMARY KEY(order_id,stage_minutes));
      CREATE TABLE payment_reminder_v2_stages(id TEXT PRIMARY KEY,schedule_id TEXT,stage_minutes INTEGER,status TEXT,idempotency_key TEXT UNIQUE,last_error TEXT,completed_at TEXT,updated_at TEXT);
      CREATE TABLE outbox_jobs(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,kind TEXT,entity_id TEXT,payload_json TEXT,status TEXT,attempts INTEGER DEFAULT 0,available_at TEXT,last_error TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,actor_id TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);
      CREATE TABLE cod_schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT);
    `);
    sqlite.exec(readFileSync("migrations/0049_cod_mo_global_reference_claims.sql", "utf8"));
    sqlite.exec(readFileSync("migrations/0050_order_confirmation_intents.sql", "utf8"));
    sqlite.exec(readFileSync("migrations/0051_order_confirmation_intent_state_guards.sql", "utf8"));
  });

  it("anchors T0 and all stages to the first qualifying provider timestamp", async () => {
    const started = Date.parse("2026-11-25T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(started + 90_000);
    seedIntent(new Date(started).toISOString());
    sqlite.prepare("UPDATE order_confirmation_intents SET presentation_message_id=? WHERE intent_id=?").run("wamid-synthetic-options", "intent-synthetic");
    sqlite.prepare("INSERT INTO whatsapp_delivery_receipts VALUES(?,?,?,?)").run("wamid-synthetic-options", "READ", new Date(started + 75_000).toISOString(), new Date(started + 80_000).toISOString());
    sqlite.prepare("INSERT INTO whatsapp_delivery_receipts VALUES(?,?,?,?)").run("wamid-synthetic-options", "DELIVERED", new Date(started + 60_000).toISOString(), new Date(started + 90_000).toISOString());

    const db = makeDb();
    expect(await anchorOrderIntentOnDelivery(db, "intent-synthetic", "wamid-synthetic-options", new Date(started + 90_000))).toBe(true);
    expect(await anchorOrderIntentOnDelivery(db, "intent-synthetic", "wamid-synthetic-options", new Date(started + 90_000))).toBe(false);
    const intent = sqlite.prepare("SELECT state,presented_at,deadline_at FROM order_confirmation_intents WHERE intent_id=?").get("intent-synthetic");
    expect(intent).toEqual({ state: "AWAITING_DECISION", presented_at: new Date(started + 60_000).toISOString(), deadline_at: new Date(started + 60_000 + ORDER_INTENT_DURATION_MS).toISOString() });
    expect(sqlite.prepare("SELECT stage_minutes,due_at,status FROM order_confirmation_intent_stages ORDER BY stage_minutes").all()).toEqual([
      { stage_minutes: 10, due_at: new Date(started + 11 * 60_000).toISOString(), status: "PENDING" },
      { stage_minutes: 25, due_at: new Date(started + 26 * 60_000).toISOString(), status: "PENDING" },
      { stage_minutes: 30, due_at: new Date(started + 31 * 60_000).toISOString(), status: "PENDING" }
    ]);
    expect(ORDER_INTENT_VERSION).toBe("GFS-ORDERFLOW-INTENT-030-V1");
  });

  it("uses bilingual customer copy and buttons for every intent stage", () => {
    const englishOptions = orderIntentOptionsText("en", 250, 375, 125);
    const urduOptions = orderIntentOptionsText("ur", 250, 375, 125);
    expect(englishOptions).toContain("Confirm your order within 30 minutes through advance payment or Cash on Delivery (COD)");
    expect(urduOptions).toContain("30 منٹ کے اندر");
    expect(orderIntentOptionRows("en", true)).toEqual([{ id: "PAY_ADVANCE", title: "Advance Payment" }, { id: "PAY_COD", title: "Cash on Delivery" }, { id: "CANCEL_ORDER", title: "Cancel Order" }]);
    expect(orderIntentOptionRows("ur", true)).toEqual([{ id: "PAY_ADVANCE", title: "پیشگی ادائیگی" }, { id: "PAY_COD", title: "کیش آن ڈیلیوری" }, { id: "CANCEL_ORDER", title: "آرڈر منسوخ کریں" }]);
    expect(formatIntentRemainingTime("2026-11-26T10:30:00.000Z", new Date("2026-11-26T10:10:30.000Z"), "en")).toBe("19 minutes 30 seconds");
    expect(orderIntentReminderText(10, "en", undefined, "19 minutes 30 seconds")).toContain("within the remaining 19 minutes 30 seconds");
    expect(orderIntentReminderText(10, "ur", undefined, "19 منٹ 30 سیکنڈ")).toContain("باقی 19 منٹ 30 سیکنڈ");
    expect(orderIntentReminderText(25, "en", undefined, "4 minutes 30 seconds")).toContain("Only 4 minutes 30 seconds left");
    expect(orderIntentReminderText(25, "ur", undefined, "4 منٹ 30 سیکنڈ")).toContain("صرف 4 منٹ 30 سیکنڈ باقی");
    expect(orderIntentReminderText(30, "en")).toContain("No parcel will be dispatched against this request");
    expect(orderIntentReminderText(30, "ur")).toContain("کوئی پارسل روانہ نہیں کیا جائے گا");
    expect(orderIntentNewOrderButton("en")).toEqual({ id: "START", title: "Place a new order" });
    expect(orderIntentNewOrderButton("ur")).toEqual({ id: "START", title: "نیا آرڈر دیں" });
    expect(orderIntentCodConfirmationText("SYNTHETIC-ORDER", 375, "en")).toContain("full gross total of PKR 375 to the delivery rider or Pakistan Post postman");
    expect(orderIntentCodConfirmationText("SYNTHETIC-ORDER", 375, "ur")).toContain("پاکستان پوسٹ کے ڈاکیے کو مکمل مجموعی رقم PKR 375");
  });

  it("does not invent T0 or expire an unpresented intent when delivery webhooks are missing", async () => {
    const started = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(started).toISOString());
    sqlite.prepare("UPDATE order_confirmation_intents SET presentation_message_id='wamid-synthetic-options' WHERE intent_id='intent-synthetic'").run();
    const db = makeDb();
    expect(await anchorOrderIntentOnDelivery(db, "intent-synthetic", "wamid-synthetic-options", new Date(started + 40 * 60_000))).toBe(false);
    expect(await expireDueOrderIntents(db, new Date(started + 60 * 60_000))).toBe(0);
    expect(sqlite.prepare("SELECT state,presented_at,deadline_at FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "PRESENTATION_PENDING", presented_at: null, deadline_at: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAYMENT_PENDING", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
  });

  it("parses only exact-message delivered/read provider timestamps and tolerates duplicate or missing statuses", () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [
      { id: "wamid-synthetic-options", recipient_id: "synthetic-wa-id", status: "read", timestamp: "1795600875" },
      { id: "wamid-synthetic-options", recipient_id: "synthetic-wa-id", status: "delivered", timestamp: "1795600860" },
      { id: "wamid-synthetic-options", recipient_id: "synthetic-wa-id", status: "delivered", timestamp: "1795600860" },
      { id: "wamid-synthetic-options", recipient_id: "synthetic-wa-id", status: "sent", timestamp: "1795600850" },
      { id: "wamid-synthetic-options", recipient_id: "synthetic-wa-id", status: "read", timestamp: "not-a-time" }
    ] } }] }] };
    const receipts = parseWhatsAppDeliveryReceipts(payload);
    expect(receipts).toEqual([
      { providerMessageId: "wamid-synthetic-options", recipientId: "synthetic-wa-id", status: "READ", providerTimestamp: new Date(1795600875_000).toISOString() },
      { providerMessageId: "wamid-synthetic-options", recipientId: "synthetic-wa-id", status: "DELIVERED", providerTimestamp: new Date(1795600860_000).toISOString() },
      { providerMessageId: "wamid-synthetic-options", recipientId: "synthetic-wa-id", status: "DELIVERED", providerTimestamp: new Date(1795600860_000).toISOString() }
    ]);
    expect(parseWhatsAppDeliveryReceipts({ entry: [{ changes: [{ value: { statuses: [] } }] }] })).toEqual([]);
  });

  it("loads only persisted synthetic free-evidence snapshots and enforces the stored customer language/opt-out", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    const freeMessagingEvidence = {
      fep: { sourceType: "CTWA_AD", platform: "IOS", clickIdHash: "c".repeat(64), referralAt: new Date(start - 5 * 60_000).toISOString(), firstBusinessResponseAt: new Date(start - 4 * 60_000).toISOString(), expiryVerified: true, verifiedAt: new Date(start - 3 * 60_000).toISOString(), verifiedExpiresAt: new Date(start + 6 * 24 * 60 * 60_000).toISOString(), expiryEvidenceRef: "synthetic-verified-expiry" },
      pricing: { verified: true, billable: false, basis: "FEP", type: "free_entry_point", subtype: "free_entry_point", evidenceRef: "synthetic-verified-pricing", observedAt: new Date(start - 4 * 60_000).toISOString(), verifiedAt: new Date(start - 3 * 60_000).toISOString(), validUntil: new Date(start + 60 * 60_000).toISOString(), form: "FREEFORM", category: "SERVICE" }
    };
    seedIntent(new Date(start).toISOString(), "ur");
    sqlite.prepare("UPDATE whatsapp_conversations SET state_data=? WHERE id='conversation-synthetic'").run(JSON.stringify({ language: "ur", freeMessagingEvidence }));
    const db = makeDb();
    expect(await evaluateStoredFreeWhatsAppOutbound(db, "synthetic-wa-id", undefined, new Date(start + 5 * 60_000))).toMatchObject({ eligible: true, basis: "FEP", locale: "ur" });
    sqlite.prepare("INSERT INTO payment_reminder_v2_opt_outs(customer_id,wa_id) VALUES('customer-synthetic','synthetic-wa-id')").run();
    expect(await evaluateStoredFreeWhatsAppOutbound(db, "synthetic-wa-id", undefined, new Date(start + 5 * 60_000))).toMatchObject({ eligible: false, reason: "CUSTOMER_OPTED_OUT" });
  });

  it("applies 0049 then unchanged 0050 then 0051 without backfilling legacy orders or adding inventory tables", async () => {
    const now = new Date("2026-11-25T10:00:00.000Z").toISOString();
    sqlite.prepare("INSERT INTO customers(id,wa_id,normalized_address_hash) VALUES('legacy-customer','legacy-wa-id','legacy-household')").run();
    sqlite.prepare("INSERT INTO orders(id,order_number,customer_id,state,payment_status,total_payable,province,created_at,updated_at) VALUES('legacy-order','LEGACY-SYNTHETIC','legacy-customer','PAYMENT_PENDING','PENDING',250,'SYNTHETIC-PROVINCE',?,?)").run(now,now);
    sqlite.prepare("INSERT INTO payments(id,order_id,review_state,expected_amount,updated_at) VALUES('legacy-payment','legacy-order','PENDING',250,?)").run(now);
    sqlite.prepare("INSERT INTO order_eligibility_locks(household_key,order_id,order_number,last_order_at) VALUES('legacy-household','legacy-order','LEGACY-SYNTHETIC',?)").run(now);
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_confirmation_intents WHERE order_id='legacy-order'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM cod_mo_reference_migration_preflight WHERE legacy_duplicate_count=0").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_confirmation_intent_preferences").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND (lower(name) LIKE '%inventory%' OR lower(name) LIKE '%stock%')").get()).toEqual({ count: 0 });

    expect(await expireDueOrderIntents(makeDb(), new Date("2026-12-01T00:00:00.000Z"))).toBe(0);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='legacy-order'").get()).toEqual({ state: "PAYMENT_PENDING", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='legacy-order'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM cod_schema_migrations WHERE version IN ('0049','0051')").get()).toEqual({ count: 2 });
  });

  it("pins language across delayed +10/+25 jobs and suppresses a stale +10 stage", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString(), "ur");
    const db = makeDb();
    sqlite.prepare("UPDATE whatsapp_conversations SET state_data=? WHERE id='conversation-synthetic'").run(JSON.stringify({ language: "en" }));
    sqlite.prepare("UPDATE order_confirmation_intents SET state='AWAITING_DECISION',presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'")
      .run(new Date(start).toISOString(), new Date(start + ORDER_INTENT_DURATION_MS).toISOString());
    for (const [stage, offset] of [[10, 10], [25, 25], [30, 30]] as const) {
      sqlite.prepare("INSERT INTO order_confirmation_intent_stages(intent_id,stage_minutes,due_at,status,idempotency_key,created_at,updated_at) VALUES(?,?,?,'PENDING',?,?,?)")
        .run("intent-synthetic", stage, new Date(start + offset * 60_000).toISOString(), `stage-${stage}`, new Date(start).toISOString(), new Date(start).toISOString());
    }
    vi.useFakeTimers();
    vi.setSystemTime(start + 10 * 60_000 + 30_000);
    expect(await queueDueOrderIntentReminders(db, new Date(Date.now()))).toBe(1);
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "QUEUED" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_ORDER_INTENT_STAGE'").get()).toEqual({ count: 1 });
    const t10PayloadRow = sqlite.prepare("SELECT payload_json FROM outbox_jobs WHERE idempotency_key='stage-10'").get() as { payload_json:string } | undefined;
    const t10Payload = JSON.parse(t10PayloadRow?.payload_json ?? "{}") as { locale:string };
    expect(t10Payload.locale).toBe("ur");

    vi.setSystemTime(start + 25 * 60_000 + 30_000);
    expect(await queueDueOrderIntentReminders(db, new Date(Date.now()))).toBe(1);
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=25").get()).toEqual({ status: "QUEUED" });

    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='PENDING',due_at=? WHERE stage_minutes=10").run(new Date(start + 10 * 60_000).toISOString());
    sqlite.prepare("DELETE FROM outbox_jobs").run();
    vi.setSystemTime(start + 11 * 60_000 + 1_000);
    expect(await queueDueOrderIntentReminders(db, new Date(Date.now()))).toBe(1);
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "QUEUED" });
    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='PENDING' WHERE stage_minutes=10").run();
    sqlite.prepare("DELETE FROM outbox_jobs").run();
    vi.setSystemTime(start + 25 * 60_000);
    expect(await queueDueOrderIntentReminders(db, new Date(Date.now()))).toBe(0);
    expect(sqlite.prepare("SELECT status,last_error FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "SUPPRESSED", last_error: "ORDER_INTENT_REMINDER_STALE" });
  });

  it("suppresses both legacy reminder schedulers for intent-owned orders", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    sqlite.prepare("UPDATE payments SET method=NULL WHERE id='payment-synthetic'").run();
    sqlite.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_METHOD' WHERE id='conversation-synthetic'").run();
    const db = makeDb();
    expect(await enqueueDuePaymentChoiceRecoveryStages(db, new Date(start + 60_000), true, new Date(start).toISOString(), true)).toEqual({ scheduled: 0, queued: 0, blocked: 0, skipped: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM payment_choice_recovery_stages").get()).toEqual({ count: 0 });

    sqlite.prepare(`INSERT INTO payment_reminder_v2_stages(id,schedule_id,stage_minutes,status,idempotency_key)
      VALUES('v2-stage','v2-schedule',15,'QUEUED','v2-job')`).run();
    sqlite.prepare(`INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
      VALUES('v2-outbox','v2-job','WHATSAPP_PAYMENT_REMINDER','order-synthetic',?,'QUEUED',0,?,?,?)`)
      .run(JSON.stringify({ stageId: "v2-job", stageMinutes: 15, scheduleId: "v2-schedule", orderId: "order-synthetic", paymentId: "payment-synthetic", customerId: "customer-synthetic" }), new Date(start).toISOString(), new Date(start).toISOString(), new Date(start).toISOString());
    let acked = 0;
    const message = { body: { kind: "WHATSAPP_PAYMENT_REMINDER", idempotencyKey: "v2-job", entityId: "order-synthetic", schemaVersion: 1 }, ack: () => { acked += 1; }, retry: () => { throw new Error("unexpected retry"); } };
    const env = { DB: db, DEPLOYMENT_STATE: "READY", PAYMENT_REMINDERS_V2_ENABLED: "true", PAYMENT_AUTOMATION_V2_ENABLED: "true", META_PROVIDER_ENABLED: "false" } as never;
    await worker.queue({ messages: [message] } as never, env);
    expect(acked).toBe(1);
    expect(sqlite.prepare("SELECT status,last_error FROM payment_reminder_v2_stages WHERE id='v2-stage'").get()).toEqual({ status: "SKIPPED", last_error: "ORDER_INTENT_030_OWNS_ORDER" });
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key='v2-job'").get()).toEqual({ status: "PERMANENT_FAILURE", last_error: "ORDER_INTENT_030_OWNS_ORDER" });
  });

  it("switches advance choice to pending COD without changing the deadline or confirming the order", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const deadline = new Date(start + ORDER_INTENT_DURATION_MS).toISOString();
    sqlite.prepare(`UPDATE order_confirmation_intents SET state='ADVANCE_PENDING',cod_enabled=1,cod_fee_pkr=125,cod_total_pkr=375,
      cod_policy_revision='synthetic-policy',collection_policy_hash='synthetic-collection-hash',remittance_policy_hash='synthetic-remittance-hash',
      presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'`).run(new Date(start).toISOString(), deadline);

    expect(await switchIntentAdvanceToCod(makeDb(), "intent-synthetic", "order-synthetic", "synthetic-customer-hash", "synthetic-correlation-hash", new Date(start + 5 * 60_000))).toBe(true);
    expect(sqlite.prepare("SELECT state,deadline_at FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "COD_CONFIRM_PENDING", deadline_at: deadline });
    expect(sqlite.prepare("SELECT method FROM payments WHERE id='payment-synthetic'").get()).toEqual({ method: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAYMENT_PENDING", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details").get()).toEqual({ count: 0 });
  });

  it("arbitrates concurrent explicit COD confirmation against T+30 expiry", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const prepared = prepareCodConfirmation(new Date(start).toISOString());
    const deadline = new Date(start + ORDER_INTENT_DURATION_MS);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(start + ORDER_INTENT_DURATION_MS - 1_000));
    const db = makeDb();
    const [confirmed, expired] = await Promise.all([
      finalizeCodOrder(db, "order-synthetic", prepared.quote, "synthetic-correlation", "00000000000", prepared.stateData, 0, "intent-synthetic"),
      expireOrderIntent(db, "intent-synthetic", deadline)
    ]);
    const order = sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get() as { state:string;payment_status:string };
    const intent = sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get() as { state:string };
    if (order.state === "COD_PENDING") {
      expect(confirmed).toBe("CREATED");
      expect(intent.state).toBe("CONFIRMED_COD");
      expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
      expect(expired).toBe("ALREADY_RESOLVED");
    } else {
      expect(order).toEqual({ state: "EXPIRED", payment_status: "EXPIRED" });
      expect(intent.state).toBe("EXPIRED");
      expect(confirmed).toBe("NOT_ELIGIBLE");
      expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    }
  });

  it("arbitrates cancellation against confirmation without COD dispatch after cancellation", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const prepared = prepareCodConfirmation(new Date(start).toISOString());
    vi.useFakeTimers();
    vi.setSystemTime(new Date(start + 5 * 60_000));
    const db = makeDb();
    const [confirmed, cancelled] = await Promise.all([
      finalizeCodOrder(db, "order-synthetic", prepared.quote, "synthetic-correlation", "00000000000", prepared.stateData, 0, "intent-synthetic"),
      cancelOrderIntent(db, "intent-synthetic", new Date(start + 5 * 60_000))
    ]);
    const order = sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get() as { state:string;payment_status:string };
    if (order.state === "COD_PENDING") {
      expect(confirmed).toBe("CREATED");
      expect(cancelled).toBe(false);
      expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
    } else {
      expect(order).toEqual({ state: "CANCELLED", payment_status: "CANCELLED" });
      expect(confirmed).toBe("NOT_ELIGIBLE");
      expect(cancelled).toBe(true);
      expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    }
  });

  it("suppresses duplicate unknown-free jobs while internal T+30 expiry still commits", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const { deadline } = presentIntent(start);
    sqlite.prepare("UPDATE customers SET wa_id='00000000000' WHERE id='customer-synthetic'").run();
    sqlite.prepare("UPDATE whatsapp_conversations SET wa_id='00000000000' WHERE id='conversation-synthetic'").run();
    sqlite.prepare("INSERT INTO whatsapp_events(provider_event_id,created_at) VALUES('message:inbound-synthetic',?)").run(new Date(start).toISOString());
    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='QUEUED' WHERE intent_id='intent-synthetic' AND stage_minutes=10").run();
    sqlite.prepare(`INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
      VALUES('outbox-t10','intent-stage-10','WHATSAPP_ORDER_INTENT_STAGE','order-synthetic',?,'QUEUED',0,?,?,?)`)
      .run(JSON.stringify({ intentId: "intent-synthetic", stageMinutes: 10, workflowVersion: ORDER_INTENT_VERSION, locale: "en" }), new Date(start).toISOString(), new Date(start).toISOString(), new Date(start).toISOString());
    const db = makeDb();
    vi.useFakeTimers();
    vi.setSystemTime(start + 10 * 60_000 + 30_000);
    let ackCount = 0;
    let retryCount = 0;
    const message = { body: { kind: "WHATSAPP_ORDER_INTENT_STAGE", idempotencyKey: "intent-stage-10", entityId: "order-synthetic", schemaVersion: 1 }, ack: () => { ackCount += 1; }, retry: () => { retryCount += 1; } };
    const env = { DB: db, DEPLOYMENT_STATE: "READY", META_PROVIDER_ENABLED: "false", ORDER_INTENT_AUTOMATION_ENABLED: "true", META_GRAPH_VERSION: "v26.0" } as never;
    await worker.queue({ messages: [message] } as never, env);
    expect(ackCount).toBe(1);
    expect(retryCount).toBe(0);
    expect(sqlite.prepare("SELECT status,last_error FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "SUPPRESSED", last_error: expect.stringContaining("FREE_MESSAGE_BLOCKED") });
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key='intent-stage-10'").get()).toEqual({ status: "PERMANENT_FAILURE", last_error: expect.stringContaining("FREE_MESSAGE_BLOCKED") });

    await worker.queue({ messages: [message] } as never, env);
    expect(ackCount).toBe(2);
    expect(retryCount).toBe(0);
    expect(await expireOrderIntent(db, "intent-synthetic", new Date(deadline))).toBe("EXPIRED");
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "EXPIRED", payment_status: "EXPIRED" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=30").get()).toEqual({ status: "QUEUED" });
  });

  it("rechecks verified free expiry on retry and never falls back to a paid send", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    const verifiedFreeEvidence = {
      fep: { sourceType: "CTWA_AD", platform: "ANDROID", clickIdHash: "b".repeat(64), referralAt: new Date(start - 5 * 60_000).toISOString(), firstBusinessResponseAt: new Date(start - 4 * 60_000).toISOString(), expiryVerified: true, verifiedAt: new Date(start - 3 * 60_000).toISOString(), verifiedExpiresAt: new Date(start + 12 * 60_000).toISOString(), expiryEvidenceRef: "synthetic-meta-expiry" },
      pricing: { verified: true, billable: false, basis: "FEP", type: "free_entry_point", subtype: "free_entry_point", evidenceRef: "synthetic-pricing", observedAt: new Date(start - 4 * 60_000).toISOString(), verifiedAt: new Date(start - 3 * 60_000).toISOString(), validUntil: new Date(start + 20 * 60_000).toISOString(), form: "FREEFORM", category: "SERVICE" }
    };
    seedIntent(new Date(start).toISOString());
    const { deadline } = presentIntent(start);
    sqlite.prepare("UPDATE customers SET wa_id='00000000000' WHERE id='customer-synthetic'").run();
    sqlite.prepare("UPDATE whatsapp_conversations SET wa_id='00000000000',state_data=? WHERE id='conversation-synthetic'").run(JSON.stringify({ language: "en", freeMessagingEvidence: verifiedFreeEvidence }));
    sqlite.prepare("INSERT INTO whatsapp_events(provider_event_id,created_at) VALUES('message:inbound-synthetic',?)").run(new Date(start).toISOString());
    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='QUEUED' WHERE intent_id='intent-synthetic' AND stage_minutes=10").run();
    sqlite.prepare(`INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
      VALUES('outbox-t10','intent-stage-10','WHATSAPP_ORDER_INTENT_STAGE','order-synthetic',?,'QUEUED',0,?,?,?)`)
      .run(JSON.stringify({ intentId: "intent-synthetic", stageMinutes: 10, workflowVersion: ORDER_INTENT_VERSION, locale: "en" }), new Date(start).toISOString(), new Date(start).toISOString(), new Date(start).toISOString());
    const db = makeDb();
    vi.useFakeTimers();
    vi.setSystemTime(start + 10 * 60_000 + 30_000);
    let retryCount = 0;
    const message = { body: { kind: "WHATSAPP_ORDER_INTENT_STAGE", idempotencyKey: "intent-stage-10", entityId: "order-synthetic", schemaVersion: 1 }, ack: () => undefined, retry: () => { retryCount += 1; } };
    const env = { DB: db, DEPLOYMENT_STATE: "READY", META_PROVIDER_ENABLED: "false", ORDER_INTENT_AUTOMATION_ENABLED: "true", META_GRAPH_VERSION: "v26.0" } as never;
    await worker.queue({ messages: [message] } as never, env);
    expect(retryCount).toBe(1);
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key='intent-stage-10'").get()).toEqual({ status: "RETRY" });

    vi.setSystemTime(start + 13 * 60_000);
    sqlite.prepare("UPDATE outbox_jobs SET status='QUEUED' WHERE idempotency_key='intent-stage-10' AND status='RETRY'").run();
    let ackCount = 0;
    const retryMessage = { ...message, ack: () => { ackCount += 1; } };
    await worker.queue({ messages: [retryMessage] } as never, env);
    expect(ackCount).toBe(1);
    expect(retryCount).toBe(1);
    expect(sqlite.prepare("SELECT status,last_error FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "SUPPRESSED", last_error: expect.stringContaining("FREE_MESSAGE_BLOCKED") });
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key='intent-stage-10'").get()).toEqual({ status: "PERMANENT_FAILURE", last_error: expect.stringContaining("FREE_MESSAGE_BLOCKED") });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAYMENT_PENDING" });
    expect(Date.parse(deadline)).toBeGreaterThan(Date.now());
  });

  it("sends delayed reminders in the immutable selected locale with a live remaining-time countdown and localized buttons", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    const deadline = new Date(start + ORDER_INTENT_DURATION_MS).toISOString();
    const freeMessagingEvidence = {
      fep: { sourceType: "CTWA_AD", platform: "IOS", clickIdHash: "e".repeat(64), referralAt: new Date(start - 5 * 60_000).toISOString(), firstBusinessResponseAt: new Date(start - 4 * 60_000).toISOString(), expiryVerified: true, verifiedAt: new Date(start - 3 * 60_000).toISOString(), verifiedExpiresAt: new Date(start + 6 * 24 * 60 * 60_000).toISOString(), expiryEvidenceRef: "synthetic-delayed-expiry" },
      pricing: { verified: true, billable: false, basis: "FEP", type: "free_entry_point", subtype: "free_entry_point", category: "SERVICE", form: "FREEFORM", evidenceRef: "synthetic-delayed-pricing", observedAt: new Date(start - 4 * 60_000).toISOString(), verifiedAt: new Date(start - 3 * 60_000).toISOString(), validUntil: new Date(start + 60 * 60_000).toISOString() }
    };
    seedIntent(new Date(start).toISOString(), "ur");
    presentIntent(start);
    sqlite.prepare("UPDATE order_confirmation_intents SET cod_enabled=1,cod_fee_pkr=125,cod_total_pkr=375,cod_policy_revision='synthetic-policy',collection_policy_hash='synthetic-collection',remittance_policy_hash='synthetic-remittance' WHERE intent_id='intent-synthetic'").run();
    sqlite.prepare("UPDATE customers SET wa_id='00000000000' WHERE id='customer-synthetic'").run();
    sqlite.prepare("UPDATE whatsapp_conversations SET wa_id='00000000000',state_data=? WHERE id='conversation-synthetic'").run(JSON.stringify({ language: "en", freeMessagingEvidence }));
    sqlite.prepare("INSERT INTO whatsapp_events(provider_event_id,created_at) VALUES('message:inbound-synthetic',?)").run(new Date(start).toISOString());
    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='QUEUED' WHERE intent_id='intent-synthetic' AND stage_minutes=10").run();
    sqlite.prepare(`INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
      VALUES('outbox-delayed-t10','intent-stage-10','WHATSAPP_ORDER_INTENT_STAGE','order-synthetic',?,'QUEUED',0,?,?,?)`)
      .run(JSON.stringify({ intentId: "intent-synthetic", stageMinutes: 10, workflowVersion: ORDER_INTENT_VERSION, locale: "ur" }), new Date(start).toISOString(), new Date(start).toISOString(), new Date(start).toISOString());
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ messages: [{ id: "wamid-synthetic-delayed" }] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(start + 24 * 60_000 + 30_000);
    const message = { body: { kind: "WHATSAPP_ORDER_INTENT_STAGE", idempotencyKey: "intent-stage-10", entityId: "order-synthetic", schemaVersion: 1 }, ack: vi.fn(), retry: vi.fn() };
    const env = { DB: makeDb(), DEPLOYMENT_STATE: "READY", META_PROVIDER_ENABLED: "true", META_ACCESS_TOKEN: "synthetic-token", META_PHONE_NUMBER_ID: "synthetic-phone-id", ORDER_INTENT_AUTOMATION_ENABLED: "true", META_GRAPH_VERSION: "v26.0" } as never;
    await worker.queue({ messages: [message] } as never, env);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT status,last_error FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "SENT", last_error: null });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { interactive: { body: { text: string }; action: { buttons: Array<{ reply: { title: string } }> } } };
    expect(request.interactive.body.text).toContain("باقی 5 منٹ 30 سیکنڈ");
    expect(request.interactive.action.buttons.map((button) => button.reply.title)).toEqual(["پیشگی ادائیگی", "کیش آن ڈیلیوری", "آرڈر منسوخ کریں"]);
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=10").get()).toEqual({ status: "SENT" });
    expect(sqlite.prepare("SELECT state,deadline_at FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "AWAITING_DECISION", deadline_at: deadline });
  });

  it("arbitrates submitted receipt/TID against expiry and keeps only pre-deadline evidence in review", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const { deadline } = presentIntent(start);
    const db = makeDb();
    const atDeadline = new Date(deadline);
    const [receiptResults, receiptExpiry] = await Promise.all([syntheticReceiptBatch(db, new Date(start + 29 * 60_000).toISOString(), deadline), expireOrderIntent(db, "intent-synthetic", atDeadline)]);
    const receiptCount = Number(sqlite.prepare("SELECT count(*) AS count FROM payment_receipts WHERE order_id='order-synthetic'").get()?.count);
    if (receiptCount) {
      expect(receiptResults[0]?.meta?.changes).toBe(1);
      expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "PAYMENT_REVIEW" });
      expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAYMENT_REVIEW" });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
      expect(receiptExpiry).not.toBe("EXPIRED");
    } else {
      expect(receiptResults[0]?.meta?.changes).toBe(0);
      expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "EXPIRED" });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    }

    const lateReference = await db.prepare(`UPDATE payments SET review_state='REVIEW',customer_transaction_reference='SYNTHETIC-TID',submitted_at=?,updated_at=?
      WHERE id='payment-synthetic' AND EXISTS(SELECT 1 FROM orders WHERE id='order-synthetic' AND state='PAYMENT_REVIEW')`).bind(new Date(deadline).toISOString(),new Date(deadline).toISOString()).run();
    if (sqlite.prepare("SELECT state FROM orders WHERE id='order-synthetic'").get()?.state === "EXPIRED") {
      expect(lateReference.meta.changes).toBe(0);
      expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "EXPIRED", payment_status: "EXPIRED" });
      expect(sqlite.prepare("SELECT count(*) AS count FROM cod_order_details WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    }
  });

  it("allows verified payment approval to win review-versus-expiry without expiring or releasing the lock", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const { deadline } = presentIntent(start);
    addReceipt(new Date(start + 29 * 60_000).toISOString());
    sqlite.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=? WHERE id='payment-synthetic'").run(new Date(start + 29 * 60_000).toISOString());
    sqlite.prepare("UPDATE orders SET state='PAYMENT_REVIEW' WHERE id='order-synthetic'").run();
    const db = makeDb();
    const approval = db.batch([
      db.prepare(`UPDATE payments SET review_state='APPROVED',approved_amount=250,approved_by='synthetic-admin',approved_at=?,updated_at=? WHERE id='payment-synthetic' AND review_state='REVIEW'
        AND EXISTS(SELECT 1 FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE r.payment_id=payments.id AND o.state='PAYMENT_REVIEW' AND o.payment_status='PENDING')`).bind(new Date(deadline).toISOString(),new Date(deadline).toISOString()),
      db.prepare("UPDATE orders SET state='PAID',payment_status='PAID',updated_at=? WHERE id='order-synthetic' AND state='PAYMENT_REVIEW' AND payment_status='PENDING' AND changes()=1").bind(new Date(deadline).toISOString())
    ]);
    const [approved, expiry] = await Promise.all([approval, expireOrderIntent(db, "intent-synthetic", new Date(deadline))]);
    expect(approved[0]?.meta?.changes).toBe(1);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAID", payment_status: "PAID" });
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "PAID" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
    expect(expiry).not.toBe("EXPIRED");
  });

  it("arbitrates a submitted TID against expiry without treating the TID as payment approval", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const { deadline } = presentIntent(start);
    const db = makeDb();
    const referenceSubmission = db.batch([
      db.prepare(`UPDATE payments SET review_state='REVIEW',customer_transaction_reference='SYNTHETIC-TID-REF',submitted_at=?,updated_at=? WHERE id='payment-synthetic'
        AND review_state='PENDING' AND EXISTS(SELECT 1 FROM orders o JOIN order_confirmation_intents i ON i.order_id=o.id WHERE o.id='order-synthetic' AND o.state='PAYMENT_PENDING' AND i.deadline_at>=?)`).bind(new Date(start + 29 * 60_000).toISOString(),new Date(start + 29 * 60_000).toISOString(),deadline),
      db.prepare("UPDATE orders SET state='PAYMENT_REVIEW',updated_at=? WHERE id='order-synthetic' AND state='PAYMENT_PENDING' AND changes()=1").bind(new Date(start + 29 * 60_000).toISOString())
    ]);
    const [submitted, expired] = await Promise.all([referenceSubmission, expireOrderIntent(db, "intent-synthetic", new Date(deadline))]);
    expect(sqlite.prepare("SELECT approved_amount,approved_at FROM payments WHERE id='payment-synthetic'").get()).toEqual({ approved_amount: null, approved_at: null });
    const order = sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get() as { state:string;payment_status:string };
    if (order.state === "PAYMENT_REVIEW") {
      expect(submitted[0]?.meta?.changes).toBe(1);
      expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "PAYMENT_REVIEW" });
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });
      expect(expired).not.toBe("EXPIRED");
    } else {
      expect(order).toEqual({ state: "EXPIRED", payment_status: "EXPIRED" });
      expect(submitted[0]?.meta?.changes).toBe(0);
      expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    }
  });

  it("protects receipt or review evidence and releases only the expired/cancelled order lock", async () => {
    const start = Date.parse("2026-11-25T10:00:00.000Z");
    seedIntent(new Date(start).toISOString());
    const db = makeDb();
    const deadline = new Date(start + ORDER_INTENT_DURATION_MS).toISOString();
    sqlite.prepare("UPDATE order_confirmation_intents SET state='AWAITING_DECISION',presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'")
      .run(new Date(start).toISOString(), deadline);
    sqlite.prepare(`INSERT INTO order_confirmation_intent_stages(intent_id,stage_minutes,due_at,status,idempotency_key,created_at,updated_at)
      VALUES('intent-synthetic',30,?,'PENDING','stage-30',?,?)`).run(deadline, new Date(start).toISOString(), new Date(start).toISOString());
    addReceipt(deadline);
    expect(await expireOrderIntent(db, "intent-synthetic", new Date(deadline))).toBe("PAYMENT_REVIEW");
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "PAYMENT_PENDING" });
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "PAYMENT_REVIEW" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 1 });

    sqlite.prepare("DELETE FROM payment_receipts").run();
    sqlite.prepare("UPDATE order_confirmation_intent_stages SET status='PENDING' WHERE intent_id='intent-synthetic' AND stage_minutes=30").run();
    sqlite.prepare("UPDATE order_confirmation_intents SET state='AWAITING_DECISION' WHERE intent_id='intent-synthetic'").run();
    expect(await expireOrderIntent(db, "intent-synthetic", new Date(deadline))).toBe("EXPIRED");
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "EXPIRED", payment_status: "EXPIRED" });
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "EXPIRED" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT status FROM order_confirmation_intent_stages WHERE stage_minutes=30").get()).toEqual({ status: "QUEUED" });
  });

  it("cancels an eligible intent atomically and releases its matching cooldown lock", async () => {
    const now = new Date("2026-11-25T10:00:00.000Z");
    seedIntent(now.toISOString());
    sqlite.prepare("UPDATE order_confirmation_intents SET state='AWAITING_DECISION',presentation_message_id='wamid-synthetic-options',presented_at=?,deadline_at=? WHERE intent_id='intent-synthetic'")
      .run(now.toISOString(), new Date(now.getTime() + ORDER_INTENT_DURATION_MS).toISOString());
    expect(await cancelOrderIntent(makeDb(), "intent-synthetic", now)).toBe(true);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-synthetic'").get()).toEqual({ state: "CANCELLED", payment_status: "CANCELLED" });
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-synthetic'").get()).toEqual({ state: "CANCELLED" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM order_eligibility_locks WHERE order_id='order-synthetic'").get()).toEqual({ count: 0 });
  });
});
