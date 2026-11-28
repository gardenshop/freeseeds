import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index.js";
import admin from "../apps/admin/src/index.js";

// Synthetic, in-memory only. Explicit transactions model an atomic runner, NOT
// proof of Wrangler import chunking, remote D1 atomicity, or a deployed rollback.
const now = "2026-01-01T00:00:00.000Z";
const files = readdirSync("migrations").filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const releaseFiles = files.filter((name) => Number(name.slice(0, 4)) >= 49);
let sqlite: DatabaseSync;

function transaction(work: () => void) {
  sqlite.exec("BEGIN");
  try { work(); sqlite.exec("COMMIT"); }
  catch (error) { sqlite.exec("ROLLBACK"); throw error; }
}

function migrate() {
  for (const file of releaseFiles) transaction(() => sqlite.exec(readFileSync(`migrations/${file}`, "utf8")));
}

function dbAdapter(): D1Database {
  function prepare(sql: string, values: SQLInputValue[] = []) {
    return {
      bind: (...args: SQLInputValue[]) => prepare(sql, args),
      first: async () => sqlite.prepare(sql).get(...values) ?? null,
      all: async () => ({ success: true, results: sqlite.prepare(sql).all(...values) }),
      run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } })
    };
  }
  return { prepare, batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } as unknown as D1Database;
}

function order(id: string, state = "PAYMENT_PENDING", review = "PENDING") {
  const cod = review === "COD_PENDING";
  sqlite.prepare(`INSERT INTO orders(id,order_number,customer_id,offer_code,pack_quantity,seed_price,delivery_fee,fertilizer_fee,total_payable,state,payment_status,created_at,updated_at)
    VALUES(?,?,'synthetic-customer','SYNTHETIC',5,0,250,0,250,?,?,?,?)`)
    .run(id, `SYNTHETIC-${id}`, state, cod ? "COD_PENDING" : "PENDING", now, now);
  sqlite.prepare(`INSERT INTO payments(id,order_id,method,expected_amount,review_state,created_at,updated_at)
    VALUES(?,?,?,250,?,?,?)`).run(`payment-${id}`, id, cod ? null : "JAZZCASH", review, now, now);
  if (cod) sqlite.prepare(`INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,test_hold,created_at,updated_at)
    VALUES(?,250,125,375,?,0,?,?)`).run(id, state, now, now);
}

function receipt(ledger: "NORMAL" | "HISTORICAL", id: string, hmac: string) {
  // Original 0047/0048 Worker INSERT shapes: no explicit global claim write.
  if (ledger === "NORMAL") sqlite.prepare(`INSERT INTO cod_mo_receipts(order_id,mo_reference_hmac,mo_amount_pkr,operator_id,received_at)
    VALUES(?,?,375,'synthetic-operator',?)`).run(id, hmac, now);
  else sqlite.prepare(`INSERT INTO cod_historical_mo_receipts(order_id,mo_reference_hmac,received_amount_pkr,receipt_date,evidence_reference_hmac,settlement_reason,operator_id,received_at)
    VALUES(?,?,250,'2026-01-01','synthetic-evidence','SYNTHETIC NON-PAYABLE','synthetic-operator',?)`).run(id, hmac, now);
}

function snapshot() {
  return Object.fromEntries(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(({ name }) => [String(name), sqlite.prepare(`SELECT * FROM "${String(name).replaceAll('"', '""')}" ORDER BY rowid`).all()]));
}

function intent(id: string) {
  sqlite.prepare(`INSERT INTO order_confirmation_intents(intent_id,workflow_version,order_id,conversation_id,state,advance_total_pkr,cod_enabled,created_at,updated_at)
    VALUES(?,'GFS-ORDERFLOW-INTENT-030-V1',?,'synthetic-conversation','AWAITING_DECISION',250,0,?,?)`).run(id, id, now, now);
  sqlite.prepare("INSERT INTO order_confirmation_intent_preferences VALUES(?,'ur',?)").run(id, now);
  for (const stage of [10, 25, 30]) sqlite.prepare(`INSERT INTO order_confirmation_intent_stages(intent_id,stage_minutes,due_at,status,idempotency_key,created_at,updated_at)
    VALUES(?,?,?,'PENDING',?,?,?)`).run(id, stage, now, `${id}-${stage}`, now, now);
  sqlite.prepare("INSERT INTO order_eligibility_locks(household_key,order_id,order_number,last_order_at) VALUES(?,?,?,?)")
    .run(`household-${id}`, id, `SYNTHETIC-${id}`, now);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  for (const file of files.filter((name) => Number(name.slice(0, 4)) <= 48)) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE d1_migrations(name TEXT PRIMARY KEY)");
  sqlite.prepare(`INSERT INTO customers(id,full_name,delivery_address,nearby_place,city,contact_number,normalized_phone,normalized_address_hash,created_at,updated_at)
    VALUES('synthetic-customer','SYNTHETIC NON-PAYABLE','Synthetic lane','Synthetic park','Synthetic city','03000000000','923000000000','synthetic-household',?,?)`).run(now, now);
  sqlite.prepare(`INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,created_at,updated_at)
    VALUES('synthetic-conversation','923000000000','COD_PENDING','{"language":"ur","orderId":"cod","orderNumber":"SYNTHETIC-cod"}',?,?)`).run(now, now);
  order("cod", "COD_PENDING", "COD_PENDING");
  order("advance");
  order("review", "PAYMENT_REVIEW", "REVIEW");
  sqlite.prepare(`INSERT INTO payment_receipts(id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at)
    VALUES('synthetic-receipt','payment-review','review','synthetic-media','private/synthetic','synthetic-hash','image/png',128,?,?)`).run(now, now);
  sqlite.prepare(`INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
    VALUES('synthetic-consent','COD_ORDER_CONFIRMED','CUSTOMER','ORDER','cod','synthetic-correlation','{"baseAmountPkr":250,"codFeePkr":125,"totalPkr":375}',?)`).run(now);
});

afterEach(() => { vi.unstubAllGlobals(); sqlite.close(); });

describe("release 0049 -> unchanged 0050 -> 0051 -> additive 0052 compatibility", () => {
  it("restores a synthetic SQLite backup with financial claims, COD totals, receipts and intent guards intact", () => {
    migrate();
    receipt("NORMAL", "cod", "synthetic-backup-claim");
    intent("advance");
    const rows = snapshot();
    const schema = sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY name").all();
    const directory = mkdtempSync(join(tmpdir(), "gfs-synthetic-restore-"));
    const backup = join(directory, "synthetic.sqlite");
    try {
      sqlite.prepare("VACUUM INTO ?").run(backup);
      sqlite.close();
      sqlite = new DatabaseSync(backup);
      sqlite.exec("PRAGMA foreign_keys=ON");
      expect(snapshot()).toEqual(rows);
      expect(sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY name").all()).toEqual(schema);
      expect(sqlite.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
      expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(() => sqlite.exec("DELETE FROM cod_mo_reference_claims")).toThrow(/IMMUTABLE/);
      sqlite.exec("UPDATE orders SET state='CANCELLED' WHERE id='advance'");
      expect(sqlite.prepare("SELECT state FROM order_confirmation_intents").get()).toEqual({ state: "CANCELLED" });
    } finally {
      sqlite.close();
      sqlite = new DatabaseSync(":memory:");
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("pins the reviewed migration bytes and preserves all pre-0049 rows and old schema definitions", () => {
    const hashes = ["01fd20cb7294c9401efa3773f5ecb05f4373972969c86de74493e546df34fec6", "d3aad32271a7988fd44d34fc36e03486c68d4551237dc68c696bb3bafba4e5b4", "900c4410796cb0de20da568088a7563f670be758454f129d38fd28207606a47a", "6fa6189bf04f5327693f366434102a36d8ff82d4cf41c61d10a682a093ba91ca"];
    expect(releaseFiles).toHaveLength(4);
    releaseFiles.forEach((file, index) => expect(createHash("sha256").update(readFileSync(`migrations/${file}`)).digest("hex")).toBe(hashes[index]));
    const before = snapshot();
    const schema = sqlite.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
    migrate();
    const after = snapshot();
    for (const [name, rows] of Object.entries(before)) {
      if (name !== "cod_schema_migrations") expect(after[name]).toEqual(rows);
    }
    for (const definition of schema) expect(sqlite.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name=?").get(String(definition.name))).toEqual(definition);
    expect(sqlite.prepare("SELECT version FROM cod_schema_migrations WHERE version>='0048' ORDER BY version").all()).toEqual([{ version: "0048" }, { version: "0049" }, { version: "0051" }, { version: "0052" }]);
    // 0050 deliberately has no custom marker; objects, not invented ledger rows, prove it.
    expect(sqlite.prepare("SELECT count(*) AS n FROM order_confirmation_intents").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM d1_migrations").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("backfills both ledgers and auto-claims later old-Worker inserts without changing financial snapshots", () => {
    receipt("NORMAL", "cod", "synthetic-normal-before");
    receipt("HISTORICAL", "advance", "synthetic-historical-before");
    migrate();
    order("normal-after", "COLLECTION_PENDING", "COD_PENDING");
    order("historical-after", "DELIVERED");
    receipt("NORMAL", "normal-after", "synthetic-normal-after");
    receipt("HISTORICAL", "historical-after", "synthetic-historical-after");
    expect(sqlite.prepare("SELECT ledger_type,count(*) AS n FROM cod_mo_reference_claims GROUP BY ledger_type ORDER BY ledger_type").all())
      .toEqual([{ ledger_type: "HISTORICAL", n: 2 }, { ledger_type: "NORMAL", n: 2 }]);
    const claims = sqlite.prepare("SELECT * FROM cod_mo_reference_claims ORDER BY order_id").all();
    migrate();
    expect(sqlite.prepare("SELECT * FROM cod_mo_reference_claims ORDER BY order_id").all()).toEqual(claims);
    expect(sqlite.prepare("SELECT base_amount_pkr,cod_fee_pkr,quoted_total_pkr FROM cod_order_details WHERE order_id='cod'").get()).toEqual({ base_amount_pkr: 250, cod_fee_pkr: 125, quoted_total_pkr: 375 });
    for (const sql of ["UPDATE cod_mo_reference_claims SET order_id='other'", "DELETE FROM cod_mo_reference_claims", "UPDATE cod_mo_receipts SET mo_amount_pkr=0", "DELETE FROM cod_historical_mo_receipts"]) expect(() => sqlite.exec(sql)).toThrow(/IMMUTABLE/);
  });

  it.each(["NORMAL", "HISTORICAL"] as const)("rejects a conflicting %s old insert and rolls back the containing batch", (ledger) => {
    migrate();
    receipt(ledger === "NORMAL" ? "HISTORICAL" : "NORMAL", ledger === "NORMAL" ? "advance" : "cod", "synthetic-shared");
    const before = snapshot();
    expect(() => transaction(() => {
      sqlite.exec("UPDATE orders SET updated_at='synthetic-losing-batch' WHERE id='review'");
      receipt(ledger, ledger === "NORMAL" ? "cod" : "advance", "synthetic-shared");
    })).toThrow(/UNIQUE constraint failed/);
    expect(snapshot()).toEqual(before);
  });

  it("fails pre-existing duplicate preflight closed and removes partial DDL only with explicit rollback", () => {
    receipt("NORMAL", "cod", "synthetic-conflict");
    receipt("HISTORICAL", "advance", "synthetic-conflict");
    const before = snapshot();
    expect(() => transaction(() => sqlite.exec(readFileSync(`migrations/${releaseFiles[0]}`, "utf8")))).toThrow(/CHECK constraint failed/);
    expect(snapshot()).toEqual(before);
    // Raw SQLite exec is NOT file-atomic: preceding CREATE survives an ABORT.
    expect(() => sqlite.exec(readFileSync(`migrations/${releaseFiles[0]}`, "utf8"))).toThrow(/CHECK constraint failed/);
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name='cod_mo_reference_migration_preflight'").get()).toBeDefined();
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name='cod_mo_reference_claims'").get()).toBeUndefined();
    expect(sqlite.prepare("SELECT version FROM cod_schema_migrations WHERE version='0049'").get()).toBeUndefined();
  });

  it.each(releaseFiles)("rolls back successful %s DDL/trigger replacement if the atomic runner fails late", (file) => {
    for (const previous of releaseFiles.slice(0, releaseFiles.indexOf(file))) transaction(() => sqlite.exec(readFileSync(`migrations/${previous}`, "utf8")));
    const rows = snapshot();
    const schema = sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY name").all();
    expect(() => transaction(() => {
      sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
      sqlite.exec("INSERT INTO cod_configuration(id,enabled,fee_pkr,updated_at) VALUES('invalid',0,125,'synthetic')");
    })).toThrow(/CHECK constraint failed/);
    expect(snapshot()).toEqual(rows);
    expect(sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY name").all()).toEqual(schema);
  });

  it.each(["PAYMENT_PENDING", "PAYMENT_REVIEW", "CANCELLED", "EXPIRED"])("0051 synchronizes old order UPDATE to %s and preserves locale/other locks", (state) => {
    migrate();
    order("intent-order", "DETAILS_COMPLETED");
    intent("intent-order");
    sqlite.exec("INSERT INTO order_eligibility_locks VALUES('synthetic-other-household','advance','SYNTHETIC-advance','synthetic')");
    sqlite.prepare("UPDATE orders SET state=?,updated_at=? WHERE id='intent-order'").run(state, now);
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id='intent-order'").get()).toEqual({ state: state === "PAYMENT_PENDING" ? "ADVANCE_PENDING" : state });
    const statuses = sqlite.prepare("SELECT stage_minutes,status FROM order_confirmation_intent_stages ORDER BY stage_minutes").all();
    expect(statuses).toEqual([10, 25, 30].map((stage) => ({ stage_minutes: stage, status: state === "PAYMENT_PENDING" || (state === "EXPIRED" && stage === 30) ? "PENDING" : "SUPPRESSED" })));
    expect(sqlite.prepare("SELECT locale FROM order_confirmation_intent_preferences").get()).toEqual({ locale: "ur" });
    expect(sqlite.prepare("SELECT count(*) AS n FROM order_eligibility_locks WHERE order_id='intent-order'").get()).toEqual({ n: ["CANCELLED", "EXPIRED"].includes(state) ? 0 : 1 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM order_eligibility_locks WHERE order_id='advance'").get()).toEqual({ n: 1 });
  });

  it("0051 lets late review protect an expired intent and suppresses all stages without converting Advance to COD", () => {
    migrate();
    intent("advance");
    sqlite.exec("UPDATE orders SET state='EXPIRED' WHERE id='advance'; UPDATE payments SET review_state='REVIEW' WHERE order_id='advance'");
    expect(sqlite.prepare("SELECT state FROM order_confirmation_intents").get()).toEqual({ state: "PAYMENT_REVIEW" });
    expect(sqlite.prepare("SELECT DISTINCT status FROM order_confirmation_intent_stages").all()).toEqual([{ status: "SUPPRESSED" }]);
    expect(sqlite.prepare("SELECT method,expected_amount,review_state FROM payments WHERE order_id='advance'").get()).toEqual({ method: "JAZZCASH", expected_amount: 250, review_state: "REVIEW" });
    expect(sqlite.prepare("SELECT count(*) AS n FROM cod_order_details WHERE order_id='advance'").get()).toEqual({ n: 0 });
  });

  it.each([false, true])("current patched source + RECOVERY_MODE retains COD/Advance reads and suppresses intake on migrated=%s", async (migrated) => {
    if (migrated) migrate();
    const DB = dbAdapter();
    const send = vi.fn();
    const env = { DB, EVENTS: { send }, RECEIPTS: {}, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", RECOVERY_MODE: "true", COD_V1_ENABLED: "false", COD_ROLLOUT_MODE: "OFF", WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true", META_PHONE_NUMBER_ID: "synthetic-phone-id", META_APP_SECRET: "synthetic-secret", META_ACCESS_TOKEN: "synthetic-token", META_CAPI_ENABLED: "false", WHATSAPP_CHECKOUT_MODE: "guided", PAYMENT_CHOICE_RECOVERY_ENABLED: "true" } as never;
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Synthetic compatibility tests forbid network"); }));
    const response = await admin.fetch(new Request("https://admin.example.test/api/orders?tab=all", { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { orders: Array<Record<string, unknown>> };
    expect(body.orders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "cod", totalPayablePkr: 375, paymentStatus: "COD_PENDING" }),
      expect.objectContaining({ id: "advance", totalPayablePkr: 250, paymentStatus: "PENDING" }),
      expect.objectContaining({ id: "review", totalPayablePkr: 250, state: "PAYMENT_REVIEW" })
    ]));
    const financial = ["orders", "payments", "payment_receipts", "cod_order_details"].map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "synthetic-phone-id" }, messages: [{ from: "923000000000", id: "synthetic-recovery-input", type: "text", text: { body: "CONFIRM_COD_ORDER" } }] } }] }] });
    const inbound = await api.fetch(new Request("https://api.example.test/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", "synthetic-secret").update(payload).digest("hex")}` }, body: payload }), env);
    expect(inbound.status).toBe(migrated ? 200 : 503);
    if (migrated) expect(await inbound.json()).toMatchObject({ recoveryMode: true, autoReplies: 0 });
    else expect(await inbound.json()).toEqual({ error: "WHATSAPP_WEBHOOK_DURABILITY_UNAVAILABLE" });
    await api.scheduled({ scheduledTime: Date.parse(now) } as ScheduledController, env);
    expect(send).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(["orders", "payments", "payment_receipts", "cod_order_details"].map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())).toEqual(financial);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
