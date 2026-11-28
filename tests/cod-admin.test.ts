import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codReferenceHmac } from "@gfs/core";
import apiWorker from "../apps/api/src/index.js";
import app from "../apps/admin/src/index";

const hmacKey = "synthetic-admin-cod-hmac-key-v1-2026-synthetic";
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

class D1Adapter {
  private pending: Promise<unknown> = Promise.resolve();
  beforeFirst?: (sql: string) => Promise<void>;
  beforeRun?: (sql: string, batchStatementIndex: number) => void;
  private nextBatchHook?: () => void;
  private batchStatementIndex = -1;
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return this.prepareBound(sql, []);
  }

  private prepareBound(sql: string, args: unknown[]): D1PreparedStatement {
    return {
      bind: (...values: unknown[]) => this.prepareBound(sql, values),
      first: async <T>() => {
        await this.beforeFirst?.(sql);
        return this.sqlite.prepare(sql).get(...args as SQLInputValue[]) as T ?? null;
      },
      all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...args as SQLInputValue[]) as T[] }),
      run: async () => {
        this.beforeRun?.(sql, this.batchStatementIndex);
        return { meta: { changes: Number(this.sqlite.prepare(sql).run(...args as SQLInputValue[]).changes) } };
      }
    } as unknown as D1PreparedStatement;
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const beforeBatch = this.nextBatchHook;
    this.nextBatchHook = undefined;
    const result = this.pending.then(async () => {
      beforeBatch?.();
      return this.executeBatch<T>(statements);
    });
    this.pending = result.catch(() => undefined);
    return result;
  }

  beforeNextBatch(hook: () => void) {
    this.nextBatchHook = hook;
  }

  private async executeBatch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    this.sqlite.exec("BEGIN");
    try {
      for (let index = 0; index < statements.length; index++) {
        this.batchStatementIndex = index;
        const statement = statements[index];
        results.push({ meta: (await (statement as unknown as { run(): Promise<{ meta: { changes: number } }> }).run()).meta } as D1Result<T>);
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    } finally {
      this.batchStatementIndex = -1;
    }
  }
}

let sqlite: DatabaseSync;
let db: D1Adapter;
const env = (key: string | undefined = hmacKey, capi = "false", events?: unknown) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", COD_REFERENCE_HMAC_KEY: key, META_CAPI_ENABLED: capi, EVENTS: events }) as never;

async function csrf() {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env());
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: response.headers.get("set-cookie")!.split(";", 1)[0] };
}

function mutationHeaders(session: { token: string; cookie: string }) {
  return { ...auth, origin: "https://admin.example.test", cookie: session.cookie, "x-csrf-token": session.token, "content-type": "application/json" };
}

function extendFulfillmentReadSchema() {
  for (const [table, columns] of Object.entries({
    orders: ["internal_sequence", "internal_sequence_date", "province", "created_at", "cancelled_at", "cancelled_by", "cancellation_reason", "archived_by", "archive_reason", "pack_quantity", "delivery_fee", "fertilizer_fee"],
    payments: ["submitted_at", "rejection_reason", "created_at"],
    customers: ["full_name", "delivery_address", "nearby_place", "city", "contact_number", "normalized_phone", "normalized_contact_number", "whatsapp_number", "normalized_whatsapp_number", "whatsapp_username"],
    payment_receipts: ["mime_type", "size_bytes", "submitted_at", "created_at"]
  })) for (const column of columns) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
  sqlite.exec("CREATE TABLE order_items(id TEXT,order_id TEXT,item_type TEXT,product_code TEXT,description TEXT,quantity INTEGER,unit_price_pkr INTEGER,line_total_pkr INTEGER,created_at TEXT)");
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT NOT NULL,customer_id TEXT,state TEXT NOT NULL,payment_status TEXT NOT NULL,total_payable INTEGER NOT NULL,archived_at TEXT,updated_at TEXT);
    CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,method TEXT,expected_amount INTEGER NOT NULL,review_state TEXT NOT NULL,approved_amount INTEGER,approved_by TEXT,approved_at TEXT,customer_transaction_reference TEXT,updated_at TEXT);
    CREATE TABLE payment_receipts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,payment_id TEXT NOT NULL,r2_object_key TEXT,sha256 TEXT);
    CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT);
    CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY,wa_id TEXT,state TEXT,state_data TEXT,last_inbound_message_id TEXT,last_inbound_at TEXT);
    CREATE TABLE whatsapp_events(provider_event_id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE outbound_messages(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,order_id TEXT,customer_id TEXT,kind TEXT,status TEXT,attempt_count INTEGER DEFAULT 0,last_error TEXT,provider_message_id TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE payment_reminder_v2_opt_outs(customer_id TEXT,wa_id TEXT);
    CREATE TABLE whatsapp_send_blocks(recipient_hash TEXT PRIMARY KEY,incident_provider_message_hash TEXT,status TEXT,created_at TEXT);
    CREATE TABLE meta_attribution(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,ctwa_clid TEXT);
    CREATE TABLE payment_methods(method TEXT PRIMARY KEY,enabled INTEGER,qr_owner_verified INTEGER,qr_r2_key TEXT,qr_sha256 TEXT);
    CREATE TABLE payment_qr_assets(method TEXT,derivative_r2_key TEXT,derivative_sha256 TEXT,active INTEGER,decoder_agreement INTEGER,payload_match INTEGER,scan_pass INTEGER,independent_ownership_verified INTEGER,independent_evidence_ref TEXT);
    CREATE TABLE capi_events(id TEXT PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,event_name TEXT NOT NULL,order_id TEXT NOT NULL,customer_id TEXT NOT NULL,send_status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE outbox_jobs(id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,entity_id TEXT NOT NULL,payload_json TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,available_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,actor_id TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);
  `);
  sqlite.exec(readFileSync("migrations/0030_cod_v1_compat.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0047_cod_pakistan_post_mo.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0048_historical_cod_mo.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0049_cod_mo_global_reference_claims.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0029_normalize_legacy_payment_references.sql", "utf8"));
  db = new D1Adapter(sqlite);
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

it("tracks historical migration 0048 exactly once", () => {
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_schema_migrations WHERE version='0048'").get()).toEqual({ count: 1 });
});

it("backfills the shared MO namespace, rejects legacy conflicts, and remains compatible with old ledger inserts", () => {
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_schema_migrations WHERE version='0049'").get()).toEqual({ count: 1 });
  seedCod();
  seedHistorical();
  sqlite.prepare("INSERT INTO cod_mo_receipts(order_id,mo_reference_hmac,mo_amount_pkr,operator_id,received_at) VALUES('order-1','legacy-normal-hmac',325,'synthetic','2026-01-01')").run();
  sqlite.prepare("INSERT INTO cod_historical_mo_receipts(order_id,mo_reference_hmac,received_amount_pkr,receipt_date,evidence_reference_hmac,settlement_reason,operator_id,received_at) VALUES('historical-order','legacy-historical-hmac',200,'2026-01-01','evidence-hmac','synthetic test','synthetic','2026-01-01')").run();
  expect(sqlite.prepare("SELECT ledger_type,COUNT(*) AS count FROM cod_mo_reference_claims GROUP BY ledger_type ORDER BY ledger_type").all()).toEqual([
    { ledger_type: "HISTORICAL", count: 1 },
    { ledger_type: "NORMAL", count: 1 }
  ]);
  sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('order-2','SIM-GFS222-SECOND','COLLECTION_PENDING','COD_PENDING',200,'synthetic')").run();
  sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES('payment-2','order-2',NULL,200,'COD_PENDING','synthetic')").run();
  sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,created_at,updated_at) VALUES('order-2',200,125,325,'COLLECTION_PENDING','synthetic-policy','a','b',0,'synthetic','synthetic')").run();
  expect(() => sqlite.prepare("INSERT INTO cod_mo_receipts(order_id,mo_reference_hmac,mo_amount_pkr,operator_id,received_at) VALUES('order-2','legacy-historical-hmac',325,'synthetic','2026-01-02')").run()).toThrow(/cod_mo_reference_claims\.mo_reference_hmac/i);
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts WHERE order_id='order-2'").get()).toEqual({ count: 0 });
  sqlite.exec(readFileSync("migrations/0049_cod_mo_global_reference_claims.sql", "utf8"));
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_reference_claims").get()).toEqual({ count: 2 });
});

it("aborts migration 0049 preflight on an existing cross-ledger digest conflict without changing legacy rows", () => {
  const conflictDb = new DatabaseSync(":memory:");
  try {
    conflictDb.exec("CREATE TABLE cod_schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL); CREATE TABLE cod_mo_receipts(order_id TEXT PRIMARY KEY,mo_reference_hmac TEXT UNIQUE,received_at TEXT NOT NULL); CREATE TABLE cod_historical_mo_receipts(order_id TEXT PRIMARY KEY,mo_reference_hmac TEXT UNIQUE,received_at TEXT NOT NULL);");
    conflictDb.prepare("INSERT INTO cod_mo_receipts VALUES('normal-order','same-synthetic-hmac','2026-01-01')").run();
    conflictDb.prepare("INSERT INTO cod_historical_mo_receipts VALUES('historical-order','same-synthetic-hmac','2026-01-01')").run();
    conflictDb.exec("BEGIN");
    expect(() => conflictDb.exec(readFileSync("migrations/0049_cod_mo_global_reference_claims.sql", "utf8"))).toThrow(/CHECK constraint failed/);
    conflictDb.exec("ROLLBACK");
    expect(conflictDb.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 1 });
    expect(conflictDb.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 1 });
    expect(conflictDb.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name='cod_mo_reference_claims'").get()).toEqual({ count: 0 });
  } finally {
    conflictDb.close();
  }
});

// Independent synthetic settlement fixtures deliberately opt out at INSERT, never through an endpoint.
function seedCod(status = "COLLECTION_PENDING", hold = 0, snapshot = true, orderNumber = "SIM-GFS222-DO-NOT-SHIP") {
  const now = "2026-01-01T00:00:00.000Z";
  sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('order-1',?,?,'COD_PENDING',200,?)").run(orderNumber, status, now);
  sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES('payment-1','order-1',NULL,200,'COD_PENDING',?)").run(now);
  sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,created_at,updated_at) VALUES('order-1',200,125,325,?,?,?,?,?,?,?)")
    .run(status, snapshot ? "synthetic-policy-revision" : null, snapshot ? "a".repeat(64) : null, snapshot ? "b".repeat(64) : null, hold, now, now);
}

async function post(path: string, body: Record<string, unknown>, session?: Awaited<ReturnType<typeof csrf>>, runtime = env()) {
  return app.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: mutationHeaders(session ?? await csrf()), body: JSON.stringify(body) }), runtime);
}

function seedHistorical(method: string | null = null, state = "DELIVERED", orderNumber = "SIM-HISTORICAL-COD") {
  const now = "2026-01-01T00:00:00.000Z";
  sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('historical-order',?,?,?,200,?)").run(orderNumber, state, "PENDING", now);
  sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES('historical-payment','historical-order',?,200,'PENDING',?)").run(method, now);
  sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,metadata_json,created_at) VALUES('historical-tracking','ORDER','SYSTEM','system','ORDER','historical-order','{}',?)").run(now);
  sqlite.prepare("UPDATE audit_log SET action='ORDER_TRACKING_ASSIGNED' WHERE id='historical-tracking'").run();
}

function reconcile(kind: string, evidenceReference = `SYNTHETIC-${kind.toUpperCase()}-EVIDENCE`, session?: Awaited<ReturnType<typeof csrf>>) {
  return post(`/api/orders/order-1/cod-${kind}`, { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, evidenceReference }, session);
}

function seedAdvanceApproval(orderId: string, paymentId: string, orderNumber: string, method = "BANK", reference: string | null = "SYNTHETIC-ADVANCE-TID-001", amount = 625) {
  const now = "2026-01-01T00:00:00.000Z";
  sqlite.prepare("INSERT OR IGNORE INTO customers(id) VALUES(?)").run(`customer-${orderId}`);
  sqlite.prepare("INSERT INTO orders(id,order_number,customer_id,state,payment_status,total_payable,updated_at) VALUES(?,?,?,'PAYMENT_REVIEW','PENDING',?,?)").run(orderId, orderNumber, `customer-${orderId}`, amount, now);
  sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,customer_transaction_reference,updated_at) VALUES(?,?,?,?,'REVIEW',?,?)").run(paymentId, orderId, method, amount, reference, now);
  sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,r2_object_key,sha256) VALUES(?,?,?,'private/synthetic-receipt','a')").run(`receipt-${paymentId}`, orderId, paymentId);
  const qrKey = `private/qr/${method}`;
  const qrSha = "b".repeat(64);
  sqlite.prepare("INSERT OR IGNORE INTO payment_methods(method,enabled,qr_owner_verified,qr_r2_key,qr_sha256) VALUES(?,1,1,?,?)").run(method, qrKey, qrSha);
  sqlite.prepare("INSERT OR IGNORE INTO payment_qr_assets(method,derivative_r2_key,derivative_sha256,active,decoder_agreement,payload_match,scan_pass,independent_ownership_verified,independent_evidence_ref) VALUES(?,?,?,1,1,1,1,1,'SYNTHETIC-QR-OWNERSHIP')").run(method, qrKey, qrSha);
}

function synchronizeFirstQueries(predicate: (sql: string) => boolean, participants = 2) {
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  db.beforeFirst = async (sql) => {
    if (!predicate(sql)) return;
    arrivals += 1;
    if (arrivals === participants) {
      db.beforeFirst = undefined;
      release();
    }
    await barrier;
  };
}

describe("actual Admin financial atomicity and duplicate races", () => {
  it("rejects unauthorized and incorrect-amount Advance approval without financial writes", async () => {
    seedAdvanceApproval("approval-order-guards", "approval-payment-guards", "SIM-APPROVAL-GUARDS");
    const body = JSON.stringify({ orderId: "approval-order-guards", confirmation: "SIM-APPROVAL-GUARDS", settlementEvidenceRef: "SYNTHETIC-SETTLEMENT-EVIDENCE", settlementConfirmed: true });
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/payments/approval-payment-guards/approve", { method: "POST", headers: { "content-type": "application/json" }, body }), env());
    expect(unauthorized.status).toBe(403);
    sqlite.prepare("UPDATE payments SET expected_amount=624 WHERE id='approval-payment-guards'").run();

    const mismatch = await post("/api/payments/approval-payment-guards/approve", JSON.parse(body), await csrf());
    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toMatchObject({ error: "PAYMENT_AMOUNT_MISMATCH" });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='approval-payment-guards'").get()).toEqual({ review_state: "REVIEW", approved_amount: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='approval-order-guards'").get()).toEqual({ state: "PAYMENT_REVIEW", payment_status: "PENDING" });
  });

  it("keeps an Advance payment under review when the order becomes stale after preflight", async () => {
    seedAdvanceApproval("approval-order-stale", "approval-payment-stale", "SIM-APPROVAL-STALE");
    const session = await csrf();
    db.beforeNextBatch(() => sqlite.prepare("UPDATE orders SET state='CANCELLED' WHERE id='approval-order-stale'").run());

    const response = await post("/api/payments/approval-payment-stale/approve", {
      orderId: "approval-order-stale",
      confirmation: "SIM-APPROVAL-STALE",
      settlementEvidenceRef: "SYNTHETIC-CREDIT-EVIDENCE-STALE",
      settlementConfirmed: true
    }, session);

    expect(response.status).toBe(409);
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id='approval-payment-stale'").get()).toEqual({ review_state: "REVIEW" });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='approval-order-stale'").get()).toEqual({ state: "CANCELLED", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_APPROVED'").get()).toEqual({ count: 0 });
  });

  it("keeps COD receipt and sidecar unchanged when the payment update fails after preflight", async () => {
    seedCod();
    db.beforeNextBatch(() => sqlite.prepare("UPDATE payments SET expected_amount=201 WHERE id='payment-1'").run());

    const response = await post("/api/orders/order-1/mark-payment-received", {
      confirmation: "SIM-GFS222-DO-NOT-SHIP",
      amountPkr: 325,
      moNumber: "PK-SYNTHETIC-PAYMENT-FAIL",
      confirmed: true
    });

    expect(response.status).toBe(409);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT status FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ status: "COLLECTION_PENDING" });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='payment-1'").get()).toEqual({ review_state: "COD_PENDING", approved_amount: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-1'").get()).toEqual({ state: "COLLECTION_PENDING", payment_status: "COD_PENDING" });
  });

  it("does not duplicate approval audit or settle twice when two Admin requests race", async () => {
    seedAdvanceApproval("approval-order-race", "approval-payment-race", "SIM-APPROVAL-RACE");
    const now=new Date().toISOString();
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES('reminder-v2-outbox','reminder-v2-key','WHATSAPP_PAYMENT_REMINDER','approval-order-race','{}','QUEUED',?,?,?)").run(now,now,now);
    sqlite.prepare("INSERT INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES('recovery-outbox','recovery-key','WHATSAPP_PAYMENT_CHOICE_RECOVERY','approval-order-race','{}','PENDING',?,?,?)").run(now,now,now);
    const session = await csrf();
    const events = { send: vi.fn(async () => undefined) };
    const runtime = env(hmacKey, "true", events);
    synchronizeFirstQueries((sql) => sql.startsWith("SELECT p.review_state,p.method"));
    const request = () => post("/api/payments/approval-payment-race/approve", {
      orderId: "approval-order-race",
      confirmation: "SIM-APPROVAL-RACE",
      settlementEvidenceRef: "SYNTHETIC-CREDIT-EVIDENCE-RACE",
      settlementConfirmed: true
    }, session, runtime);

    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='approval-payment-race'").get()).toEqual({ review_state: "APPROVED", approved_amount: 625 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='approval-order-race'").get()).toEqual({ state: "PAID", payment_status: "PAID" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_APPROVED' AND entity_id='approval-payment-race'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events WHERE order_id='approval-order-race' AND event_name='Purchase'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE entity_id='approval-order-race' AND kind='CAPI_PURCHASE'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE id='reminder-v2-outbox'").get()).toEqual({status:"PERMANENT_FAILURE",last_error:"PAYMENT_APPROVED"});
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE id='recovery-outbox'").get()).toEqual({status:"PERMANENT_FAILURE",last_error:"PAYMENT_APPROVED"});
    expect(events.send).toHaveBeenCalledTimes(1);
  });

  it("rolls back an Advance approval when its required audit write fails", async () => {
    seedAdvanceApproval("approval-order-audit-fail", "approval-payment-audit-fail", "SIM-APPROVAL-AUDIT-FAIL");
    db.beforeRun = (sql, index) => {
      if (index === 2 && sql.startsWith("INSERT INTO audit_log")) throw new Error("SYNTHETIC_APPROVAL_AUDIT_FAILURE");
    };

    const response = await post("/api/payments/approval-payment-audit-fail/approve", {
      orderId: "approval-order-audit-fail",
      confirmation: "SIM-APPROVAL-AUDIT-FAIL",
      settlementEvidenceRef: "SYNTHETIC-CREDIT-EVIDENCE-AUDIT",
      settlementConfirmed: true
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "APPROVAL_FAILED" });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='approval-payment-audit-fail'").get()).toEqual({ review_state: "REVIEW", approved_amount: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='approval-order-audit-fail'").get()).toEqual({ state: "PAYMENT_REVIEW", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_APPROVED'").get()).toEqual({ count: 0 });
  });

  it("rolls back a normal MO settlement when its required financial audit fails", async () => {
    seedCod();
    db.beforeRun = (sql, index) => {
      if (index === 4 && sql.startsWith("INSERT INTO audit_log")) throw new Error("SYNTHETIC_COD_MO_AUDIT_FAILURE");
    };

    const response = await post("/api/orders/order-1/mark-payment-received", {
      confirmation: "SIM-GFS222-DO-NOT-SHIP",
      amountPkr: 325,
      moNumber: "PK-MO-AUDIT-ROLLBACK",
      confirmed: true
    });

    expect(response.status).toBe(409);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT status FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ status: "COLLECTION_PENDING" });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='payment-1'").get()).toEqual({ review_state: "COD_PENDING", approved_amount: null });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-1'").get()).toEqual({ state: "COLLECTION_PENDING", payment_status: "COD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_MO_RECEIVED'").get()).toEqual({ count: 0 });
  });

  it("rolls back a historical MO settlement when its required audit write fails", async () => {
    seedHistorical();
    db.beforeRun = (sql, index) => {
      if (index === 2 && sql.startsWith("INSERT INTO audit_log")) throw new Error("SYNTHETIC_HISTORICAL_MO_AUDIT_FAILURE");
    };

    const response = await post("/api/orders/historical-order/mark-historical-cod-received", {
      confirmation: "SIM-HISTORICAL-COD",
      amountPkr: 200,
      moNumber: "PK-HIST-MO-AUDIT-ROLLBACK",
      receiptDate: "2026-01-01",
      evidenceReference: "SYNTHETIC-HISTORICAL-AUDIT-EVIDENCE",
      reason: "Synthetic audit rollback test",
      confirmed: true
    });

    expect(response.status).toBe(409);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='historical-order'").get()).toEqual({ state: "DELIVERED", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_HISTORICAL_MO_RECEIVED'").get()).toEqual({ count: 0 });
  });

  it("rolls back normal MO settlement and CAPI outbox when a required durable outbox write fails", async () => {
    seedCod();
    sqlite.prepare("INSERT INTO customers(id) VALUES('customer-1')").run();
    sqlite.prepare("UPDATE orders SET customer_id='customer-1' WHERE id='order-1'").run();
    sqlite.prepare("INSERT INTO meta_attribution(id,order_id,ctwa_clid) VALUES('attribution-1','order-1','synthetic-ctwa')").run();
    db.beforeRun = (sql, index) => {
      if (index === 6 && sql.startsWith("INSERT OR IGNORE INTO outbox_jobs")) throw new Error("SYNTHETIC_OUTBOX_FAILURE");
    };
    const events = { send: vi.fn(async () => undefined) };

    const response = await post("/api/orders/order-1/mark-payment-received", {
      confirmation: "SIM-GFS222-DO-NOT-SHIP",
      amountPkr: 325,
      moNumber: "PK-MO-OUTBOX-ROLLBACK",
      confirmed: true
    }, undefined, env(hmacKey, "true", events));

    expect(response.status).toBe(409);
    expect(events.send).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT status FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ status: "COLLECTION_PENDING" });
    expect(sqlite.prepare("SELECT review_state FROM payments WHERE id='payment-1'").get()).toEqual({ review_state: "COD_PENDING" });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='order-1'").get()).toEqual({ state: "COLLECTION_PENDING", payment_status: "COD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='CAPI_PURCHASE'").get()).toEqual({ count: 0 });
  });

  it("serializes concurrent duplicate TID submissions across different orders using the existing method scope", async () => {
    seedAdvanceApproval("tid-order-one", "tid-payment-one", "SIM-TID-ORDER-ONE", "BANK", null);
    seedAdvanceApproval("tid-order-two", "tid-payment-two", "SIM-TID-ORDER-TWO", "BANK", null);
    const session = await csrf();
    synchronizeFirstQueries((sql) => sql.startsWith("SELECT p.id AS payment_id,o.id AS order_id,o.order_number,p.method FROM payments p JOIN orders o ON o.id=p.order_id") && sql.includes("p.method=?"));
    const request = (paymentId: string, orderId: string, orderNumber: string) => post(`/api/payments/${paymentId}/transaction-reference`, {
      orderId,
      confirmation: orderNumber,
      reference: "SYNTHETIC-TID-RACE-001"
    }, session);

    const responses = await Promise.all([
      request("tid-payment-one", "tid-order-one", "SIM-TID-ORDER-ONE"),
      request("tid-payment-two", "tid-order-two", "SIM-TID-ORDER-TWO")
    ]);
    expect(responses.map((response) => response.status).sort(), JSON.stringify(await Promise.all(responses.map((response) => response.clone().json())))).toEqual([200, 409]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE customer_transaction_reference='SYNTHETIC-TID-RACE-001'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_SAVED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_DUPLICATE_REJECTED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM orders WHERE state<>'PAYMENT_REVIEW' OR payment_status<>'PENDING'").get()).toEqual({ count: 0 });
  });

  it("rejects the same provider reference across orders but preserves method-scoped identifiers", async () => {
    seedAdvanceApproval("tid-provider-order-one", "tid-provider-payment-one", "SIM-TID-PROVIDER-ONE", "BANK", null);
    seedAdvanceApproval("tid-provider-order-two", "tid-provider-payment-two", "SIM-TID-PROVIDER-TWO", "EASYPAISA", null);
    const session = await csrf();
    const request = (paymentId: string, orderId: string, orderNumber: string) => post(`/api/payments/${paymentId}/transaction-reference`, {
      orderId,
      confirmation: orderNumber,
      reference: "SYNTHETIC-PROVIDER-TID-001"
    }, session);

    expect((await request("tid-provider-payment-one", "tid-provider-order-one", "SIM-TID-PROVIDER-ONE")).status).toBe(200);
    const second=await request("tid-provider-payment-two", "tid-provider-order-two", "SIM-TID-PROVIDER-TWO");
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({crossMethodWarning:{code:"REFERENCE_REUSED_ACROSS_METHODS",conflictingOrderId:"tid-provider-order-one",conflictingMethod:"BANK"}});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_CROSS_METHOD_WARNING'").get()).toEqual({count:1});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE customer_transaction_reference='SYNTHETIC-PROVIDER-TID-001'").get()).toEqual({ count: 2 });
  });

  it("preserves leading-zero TIDs and makes same-order reference replay idempotent", async () => {
    seedAdvanceApproval("tid-leading-order","tid-leading-payment","SIM-TID-LEADING", "BANK", null);
    const session=await csrf();
    const body={orderId:"tid-leading-order",confirmation:"SIM-TID-LEADING",reference:"000012345678"};
    const first=await post("/api/payments/tid-leading-payment/transaction-reference",body,session);
    const replay=await post("/api/payments/tid-leading-payment/transaction-reference",body,session);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({alreadySaved:true,reference:"000012345678"});
    expect(sqlite.prepare("SELECT customer_transaction_reference FROM payments WHERE id='tid-leading-payment'").get()).toEqual({customer_transaction_reference:"000012345678"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_TRANSACTION_REFERENCE_SAVED' AND entity_id='tid-leading-payment'").get()).toEqual({count:1});
  });

  it("does not reopen or approve an expired order from late TID evidence alone", async () => {
    seedAdvanceApproval("tid-late-order","tid-late-payment","SIM-TID-LATE", "BANK", null);
    sqlite.prepare("UPDATE payments SET review_state='EXPIRED' WHERE id='tid-late-payment'").run();
    sqlite.prepare("UPDATE orders SET state='EXPIRED',payment_status='EXPIRED',updated_at='synthetic-expiry' WHERE id='tid-late-order'").run();
    const session=await csrf();
    const response=await post("/api/payments/tid-late-payment/transaction-reference",{orderId:"tid-late-order",confirmation:"SIM-TID-LATE",reference:"SYNTHETIC-LATE-TID-001"},session);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({error:"PAYMENT_NOT_IN_REVIEW"});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='tid-late-order'").get()).toEqual({state:"EXPIRED",payment_status:"EXPIRED"});
    expect(sqlite.prepare("SELECT review_state,approved_amount,customer_transaction_reference FROM payments WHERE id='tid-late-payment'").get()).toEqual({review_state:"EXPIRED",approved_amount:null,customer_transaction_reference:null});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id='tid-late-order'").get()).toEqual({count:0});
  });

  it("requires an explicit cross-method warning acknowledgement before an otherwise verified approval", async () => {
    seedAdvanceApproval("tid-cross-order-one","tid-cross-payment-one","SIM-TID-CROSS-ONE","BANK","SYNTHETIC-CROSS-METHOD-001");
    seedAdvanceApproval("tid-cross-order-two","tid-cross-payment-two","SIM-TID-CROSS-TWO","EASYPAISA",null);
    const session=await csrf();
    const save=await post("/api/payments/tid-cross-payment-two/transaction-reference",{orderId:"tid-cross-order-two",confirmation:"SIM-TID-CROSS-TWO",reference:"SYNTHETIC-CROSS-METHOD-001"},session);
    expect(save.status).toBe(200);
    const saveBody=await save.json() as {crossMethodWarning:{conflictingPaymentId:string;conflictingOrderId:string;conflictingOrderNumber:string;conflictingMethod:string}};
    expect(saveBody).toMatchObject({crossMethodWarning:{conflictingPaymentId:"tid-cross-payment-one",conflictingOrderId:"tid-cross-order-one",conflictingOrderNumber:"SIM-TID-CROSS-ONE",conflictingMethod:"BANK"}});
    const approval={orderId:"tid-cross-order-two",confirmation:"SIM-TID-CROSS-TWO",settlementEvidenceRef:"SYNTHETIC-RECEIVING-CREDIT",settlementConfirmed:true};
    const blocked=await post("/api/payments/tid-cross-payment-two/approve",approval,session);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({error:"CROSS_METHOD_REFERENCE_REVIEW_REQUIRED",conflictingOrderId:"tid-cross-order-one"});
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='tid-cross-payment-two'").get()).toEqual({review_state:"REVIEW",approved_amount:null});
    const approved=await post("/api/payments/tid-cross-payment-two/approve",{...approval,crossMethodConfirmed:true,crossMethodPaymentId:saveBody.crossMethodWarning.conflictingPaymentId,crossMethodMethod:saveBody.crossMethodWarning.conflictingMethod},session);
    expect(approved.status).toBe(200);
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='tid-cross-payment-two'").get()).toEqual({review_state:"APPROVED",approved_amount:625});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='tid-cross-order-two'").get()).toEqual({state:"PAID",payment_status:"PAID"});
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_APPROVAL_CROSS_METHOD_REJECTED'").get()).toEqual({count:1});
    const approvalAudit=sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='PAYMENT_APPROVED' AND entity_id='tid-cross-payment-two'").get() as {metadata_json:string};
    expect(JSON.parse(approvalAudit.metadata_json)).toMatchObject({crossMethodConfirmed:true,crossMethodConflictOrderId:"tid-cross-order-one"});
  });

  it("queues localized payment confirmation after verified approval and suppresses it without free evidence", async () => {
    seedAdvanceApproval("tid-notice-order","tid-notice-payment","SIM-TID-NOTICE","BANK","000012345678");
    const waId="00000000000";
    const now=new Date().toISOString();
    sqlite.prepare("UPDATE customers SET wa_id=? WHERE id='customer-tid-notice-order'").run(waId);
    sqlite.prepare("INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at) VALUES('tid-notice-conversation',?,'REVIEW',?,'inbound-tid-notice',?)").run(waId,JSON.stringify({language:"ur"}),now);
    sqlite.prepare("INSERT INTO whatsapp_events(provider_event_id,created_at) VALUES('message:inbound-tid-notice',?)").run(now);
    const events={send:vi.fn(async(_job:{kind:string;idempotencyKey:string;entityId:string;schemaVersion:1})=>undefined)};
    const session=await csrf();
    const approved=await post("/api/payments/tid-notice-payment/approve",{orderId:"tid-notice-order",confirmation:"SIM-TID-NOTICE",settlementEvidenceRef:"SYNTHETIC-CREDIT-RECEIPT",settlementConfirmed:true},session,env(hmacKey,"false",events));
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({paymentStatus:"PAID",paymentConfirmationQueue:"QUEUED"});
    expect(events.send).toHaveBeenCalledOnce();
    const job=events.send.mock.calls[0]?.[0] as {kind:string;idempotencyKey:string;entityId:string;schemaVersion:1};
    expect(job).toMatchObject({kind:"WHATSAPP_PAYMENT_CONFIRMED",entityId:"tid-notice-order",schemaVersion:1});
    expect(sqlite.prepare("SELECT status FROM outbox_jobs WHERE idempotency_key=?").get(job.idempotencyKey)).toEqual({status:"QUEUED"});

    const delivery={body:job,ack:vi.fn(),retry:vi.fn()};
    await apiWorker.queue({messages:[delivery]} as never,{DB:db as unknown as D1Database,DEPLOYMENT_STATE:"READY",META_PROVIDER_ENABLED:"false",META_GRAPH_VERSION:"v26.0"} as never);
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(delivery.retry).not.toHaveBeenCalled();
    expect(sqlite.prepare("SELECT status,last_error FROM outbox_jobs WHERE idempotency_key=?").get(job.idempotencyKey)).toMatchObject({status:"PERMANENT_FAILURE",last_error:"FREE_MESSAGE_BLOCKED:FREE_BILLING_UNKNOWN_OR_MISMATCHED"});
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='tid-notice-payment'").get()).toEqual({review_state:"APPROVED",approved_amount:625});
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='tid-notice-order'").get()).toEqual({state:"PAID",payment_status:"PAID"});
  });

  it("reproduces concurrent normal/historical MO reference reuse through both Admin handlers", async () => {
    seedCod("COLLECTION_PENDING");
    seedHistorical();
    const session = await csrf();
    synchronizeFirstQueries((sql) => sql.startsWith("SELECT 1 AS present FROM cod_mo_receipts") || sql.startsWith("SELECT 1 AS present FROM cod_historical_mo_receipts"));

    const normal = post("/api/orders/order-1/mark-payment-received", {
      confirmation: "SIM-GFS222-DO-NOT-SHIP",
      amountPkr: 325,
      moNumber: "PK-CROSS-LEDGER-RACE-001",
      confirmed: true
    }, session);
    const historical = post("/api/orders/historical-order/mark-historical-cod-received", {
      confirmation: "SIM-HISTORICAL-COD",
      amountPkr: 200,
      moNumber: "PK-CROSS-LEDGER-RACE-001",
      receiptDate: "2026-01-01",
      evidenceReference: "SYNTHETIC-HISTORICAL-EVIDENCE-RACE",
      reason: "Synthetic cross-ledger concurrency test",
      confirmed: true
    }, session);

    const responses = await Promise.all([normal, historical]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const rejected = responses.find((response) => response.status === 409)!;
    expect(await rejected.json()).toMatchObject({ error: "COD_MO_ALREADY_USED" });
    const normalDigest = await codReferenceHmac("PK-CROSS-LEDGER-RACE-001", hmacKey);
    expect(sqlite.prepare("SELECT (SELECT COUNT(*) FROM cod_mo_receipts WHERE mo_reference_hmac=?) + (SELECT COUNT(*) FROM cod_historical_mo_receipts WHERE mo_reference_hmac=?) AS count").get(normalDigest, normalDigest)).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action IN ('COD_MO_RECEIVED','COD_HISTORICAL_MO_RECEIVED')").get()).toEqual({ count: 1 });
  });

  it("returns an idempotent result for simultaneous same-order MO retries", async () => {
    seedCod("COLLECTION_PENDING");
    const session = await csrf();
    synchronizeFirstQueries((sql) => sql.startsWith("SELECT 1 AS present FROM cod_mo_receipts"));
    const request = () => post("/api/orders/order-1/mark-payment-received", {
      confirmation: "SIM-GFS222-DO-NOT-SHIP",
      amountPkr: 325,
      moNumber: "PK-MO-SAME-ORDER-RACE",
      confirmed: true
    }, session);

    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const results = await Promise.all(responses.map((response) => response.json() as Promise<Record<string, unknown>>));
    expect(results.some((result) => result.alreadyPaid === true)).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_reference_claims").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_MO_RECEIVED'").get()).toEqual({ count: 1 });
  });

  it("rejects stale and protected historical COD settlement before recording an MO", async () => {
    seedHistorical();
    db.beforeNextBatch(() => sqlite.prepare("UPDATE orders SET state='CANCELLED' WHERE id='historical-order'").run());
    const stale = await post("/api/orders/historical-order/mark-historical-cod-received", {
      confirmation: "SIM-HISTORICAL-COD",
      amountPkr: 200,
      moNumber: "PK-HIST-MO-STALE",
      receiptDate: "2026-01-01",
      evidenceReference: "SYNTHETIC-HISTORICAL-STALE-EVIDENCE",
      reason: "Synthetic stale state test",
      confirmed: true
    });
    expect(stale.status).toBe(409);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 0 });

    sqlite.prepare("UPDATE orders SET state='DELIVERED',order_number='FS-261019-000001' WHERE id='historical-order'").run();
    const held = await post("/api/orders/historical-order/mark-historical-cod-received", {
      confirmation: "FS-261019-000001",
      amountPkr: 200,
      moNumber: "PK-HIST-MO-HELD",
      receiptDate: "2026-01-01",
      evidenceReference: "SYNTHETIC-HISTORICAL-HOLD-EVIDENCE",
      reason: "Synthetic protected hold test",
      confirmed: true
    });
    expect(held.status).toBe(409);
    expect(await held.json()).toMatchObject({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 0 });
  });
});

describe("COD Admin configuration and reconciliation", () => {
  it("enables basic COD intake at PKR 125 without collection HMAC or remittance policy references", async () => {
    await expect(codReferenceHmac("SYNTHETIC-EVIDENCE", "short-key")).rejects.toThrow("COD_REFERENCE_HMAC_KEY_REQUIRED");
    const session = await csrf();
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 125, expectedRevision: "unconfigured" }) }), env(""));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, enabled: true, feePkr: 125 });
    expect(sqlite.prepare("SELECT enabled,fee_pkr,collection_policy_hash,remittance_policy_hash FROM cod_configuration WHERE id='default'").get()).toEqual({ enabled: 1, fee_pkr: 125, collection_policy_hash: null, remittance_policy_hash: null });
    const settlement = await app.fetch(new Request("https://admin.example.test/api/orders/order-1/cod-collection", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, evidenceReference: "SYNTHETIC-SETTLEMENT-EVIDENCE" }) }), env(""));
    expect(settlement.status).toBe(503);
    expect(await settlement.json()).toEqual({ error: "COD_REFERENCE_HMAC_KEY_REQUIRED" });
  });

  it("starts disabled with the additive PKR 125 default", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { headers: auth }), env());
    expect(await response.json()).toMatchObject({ enabled: false, feePkr: 125, collectionPolicyConfigured: false, remittancePolicyConfigured: false, revision: "unconfigured" });
  });

  it("requires the UI revision and admits only one concurrent config winner even at identical timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const session = await csrf();
    expect((await post("/api/cod-configuration", { enabled: false, feePkr: 125 }, session)).status).toBe(409);
    const body = { enabled: true, feePkr: 125, expectedRevision: "unconfigured" };
    const responses = await Promise.all([post("/api/cod-configuration", body, session), post("/api/cod-configuration", { ...body, enabled: false }, session)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const current = sqlite.prepare("SELECT revision,fee_pkr FROM cod_configuration").get() as { revision: string; fee_pkr: number };
    const audits = sqlite.prepare("SELECT id,metadata_json FROM audit_log WHERE action='COD_CONFIGURATION_UPDATED'").all() as { id: string; metadata_json: string }[];
    expect(audits).toHaveLength(1);
    expect(audits[0].id).toBe(current.revision);
    expect(JSON.parse(audits[0].metadata_json).feePkr).toBe(current.fee_pkr);
    expect((await post("/api/cod-configuration", body, session)).status).toBe(409);
    const previousAudit = audits[0];
    expect((await post("/api/cod-configuration", { enabled: false, feePkr: 125, expectedRevision: current.revision }, session)).status).toBe(200);
    expect(sqlite.prepare("SELECT id,metadata_json FROM audit_log WHERE id=?").get(previousAudit.id)).toEqual(previousAudit);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_CONFIGURATION_UPDATED'").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT COUNT(DISTINCT created_at) AS count FROM audit_log WHERE action='COD_CONFIGURATION_UPDATED'").get()).toEqual({ count: 1 });
    const page = await (await app.fetch(new Request("https://admin.example.test/cod-settings", { headers: auth }), env())).text();
    expect(page).toContain("expectedRevision=d.revision");
    expect(page).toContain("COD collection fee: PKR 125");
    expect(page).not.toContain("remittance policy");
    expect(page).not.toContain("collectionPolicyReference");
  });

  it("preserves prior reconciliation hashes and settles historical COD after intake is disabled", async () => {
    const initial = await post("/api/cod-configuration", { enabled: true, feePkr: 125, collectionPolicyReference: "SYNTHETIC-OLD-COLLECTION", remittancePolicyReference: "SYNTHETIC-OLD-REMITTANCE", expectedRevision: "unconfigured" });
    const { revision } = await initial.json() as { revision: string };
    const original = sqlite.prepare("SELECT collection_policy_hash,remittance_policy_hash FROM cod_configuration").get();
    seedCod();
    const disabled = await post("/api/cod-configuration", { enabled: false, feePkr: 125, expectedRevision: revision });
    expect(disabled.status).toBe(200);
    expect(sqlite.prepare("SELECT collection_policy_hash,remittance_policy_hash FROM cod_configuration").get()).toEqual(original);
    const next = await disabled.json() as { revision: string };
    expect((await reconcile("collection")).status).toBe(200);
    expect((await post("/api/cod-configuration", { enabled: false, feePkr: 125, expectedRevision: next.revision })).status).toBe(200);
    expect((await reconcile("remittance")).status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders").get()).toEqual({ state: "PAID", payment_status: "PAID", total_payable: 200 });
    expect(sqlite.prepare("SELECT policy_revision,collection_policy_hash,remittance_policy_hash FROM cod_order_details").get()).toEqual({ policy_revision: "synthetic-policy-revision", collection_policy_hash: "a".repeat(64), remittance_policy_hash: "b".repeat(64) });
  });

  it("fails closed for historical COD without its immutable policy snapshot", async () => {
    seedCod("COLLECTION_PENDING", 0, false);
    expect(await (await reconcile("collection")).json()).toEqual({ error: "COD_POLICY_SNAPSHOT_REQUIRED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
  });

  it("records exact persisted collection and remittance once when both kinds race", async () => {
    seedCod();
    const session = await csrf();
    const results = await Promise.all([reconcile("collection", "SYNTHETIC-COLLECTION-WINNER", session), reconcile("remittance", "SYNTHETIC-REMITTANCE-WINNER", session)]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state: "PAID", payment_status: "PAID" });
    const audits = sqlite.prepare("SELECT id,metadata_json FROM audit_log WHERE action='COD_PAYMENT_RECONCILED'").all() as { id: string; metadata_json: string }[];
    expect(audits).toHaveLength(1);
    expect(audits[0].id).toBe("cod_paid_order-1");
    const detail = sqlite.prepare("SELECT collection_ref_hmac,remittance_ref_hmac FROM cod_order_details").get() as { collection_ref_hmac: string; remittance_ref_hmac: string };
    expect(JSON.parse(audits[0].metadata_json)).toEqual({ orderId: "order-1", amountPkr: 325, collectionReferenceHmac: detail.collection_ref_hmac, remittanceReferenceHmac: detail.remittance_ref_hmac, policyRevision: "synthetic-policy-revision" });
    expect((await reconcile("collection", "SYNTHETIC-COLLECTION-WINNER")).status).toBe(200);
    expect((await reconcile("remittance", "SYNTHETIC-REMITTANCE-WINNER")).status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action LIKE 'COD_%RECONCILED'").get()).toEqual({ count: 3 });
  });

  it("does not let a losing same-kind reconciliation emit stale financial audit", async () => {
    seedCod();
    expect((await reconcile("collection")).status).toBe(200);
    const session = await csrf();
    const responses = await Promise.all([reconcile("remittance", "SYNTHETIC-REMITTANCE-A", session), reconcile("remittance", "SYNTHETIC-REMITTANCE-B", session)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_PAYMENT_RECONCILED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_REMITTANCE_RECONCILED'").get()).toEqual({ count: 1 });
    const row = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='COD_PAYMENT_RECONCILED'").get() as { metadata_json: string };
    expect(JSON.parse(row.metadata_json).remittanceReferenceHmac).toBe((sqlite.prepare("SELECT remittance_ref_hmac FROM cod_order_details").get() as { remittance_ref_hmac: string }).remittance_ref_hmac);
  });

  it.each(["COD_REMITTANCE_RECONCILED", "COD_PAYMENT_RECONCILED"])("rolls back the whole exact-PAID path if %s audit fails", async (action) => {
    seedCod();
    expect((await reconcile("collection")).status).toBe(200);
    const order = sqlite.prepare("SELECT * FROM orders").get();
    const payment = sqlite.prepare("SELECT * FROM payments").get();
    const detail = sqlite.prepare("SELECT * FROM cod_order_details").get();
    sqlite.exec(`CREATE TRIGGER synthetic_financial_audit_failure BEFORE INSERT ON audit_log WHEN NEW.action='${action}' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END;`);
    expect((await reconcile("remittance")).status).toBe(409);
    expect(sqlite.prepare("SELECT * FROM orders").get()).toEqual(order);
    expect(sqlite.prepare("SELECT * FROM payments").get()).toEqual(payment);
    expect(sqlite.prepare("SELECT * FROM cod_order_details").get()).toEqual(detail);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 1 });
    sqlite.exec("DROP TRIGGER synthetic_financial_audit_failure");
    expect((await reconcile("remittance")).status).toBe(200);
  });

  it("cannot partially settle an ineligible payment", async () => {
    seedCod();
    expect((await reconcile("collection")).status).toBe(200);
    sqlite.exec("UPDATE payments SET expected_amount=999 WHERE id='payment-1'");
    expect((await reconcile("remittance")).status).toBe(409);
    expect(sqlite.prepare("SELECT status,remittance_ref_hmac FROM cod_order_details").get()).toEqual({ status: "COLLECTION_PENDING", remittance_ref_hmac: null });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 1 });
  });

  it.each(["COD_PENDING", "PACKING", "DISPATCHED", "DELIVERED", "COLLECTION_PENDING"])("blocks all operational endpoints for held %s COD", async (state) => {
    seedCod(state, 1);
    const next = { COD_PENDING: "PACKING", PACKING: "DISPATCHED", DISPATCHED: "DELIVERED", DELIVERED: "COLLECTION_PENDING", COLLECTION_PENDING: "PAID" }[state];
    const session = await csrf();
    for (const [path, body] of [
      ["tracking", { trackingNumber: "SYNTHETIC-DO-NOT-SHIP" }],
      ["confirm", {}],
      ["transition", { from: state, to: next }],
      ["cod-collection", { amountPkr: 325, evidenceReference: "SYNTHETIC-COLLECTION" }],
      ["cod-remittance", { amountPkr: 325, evidenceReference: "SYNTHETIC-REMITTANCE" }]
    ] as const) {
      expect((await post(`/api/orders/order-1/${path}`, { confirmation: "SIM-GFS222-DO-NOT-SHIP", ...body }, session)).status, path).toBe(409);
    }
    for (const path of ["shipping-label", "label"]) {
      const response = await app.fetch(new Request(`https://admin.example.test/api/orders/order-1/${path}?format=A6`, { headers: auth }), env());
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "COD_TEST_HOLD_DO_NOT_SHIP" });
    }
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state, payment_status: "COD_PENDING" });
  });

  it("defaults to DO NOT SHIP and prevents old-worker SQL tracking, fulfillment and hold clearing", () => {
    sqlite.exec("INSERT INTO orders(id,order_number,state,payment_status,total_payable,archived_at,updated_at) VALUES('order-1','SIM-GFS222-DO-NOT-SHIP','COD_PENDING','COD_PENDING',200,NULL,'synthetic'); INSERT INTO payments(id,order_id,expected_amount,review_state) VALUES('payment-1','order-1',200,'COD_PENDING'); INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,created_at,updated_at) VALUES('order-1',200,125,325,'synthetic','synthetic')");
    expect(sqlite.prepare("SELECT test_hold FROM cod_order_details").get()).toEqual({ test_hold: 1 });
    expect(() => sqlite.exec("UPDATE orders SET state='PACKING' WHERE id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("UPDATE cod_order_details SET status='PACKING' WHERE order_id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("UPDATE orders SET payment_status='PAID' WHERE id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("INSERT INTO audit_log(id,entity_type,entity_id,action) VALUES('tracking','ORDER','order-1','ORDER_TRACKING_ASSIGNED')")).toThrow("COD_TEST_HOLD_DO_NOT_SHIP");
    expect(() => sqlite.exec("UPDATE cod_order_details SET test_hold=0 WHERE order_id='order-1'")).toThrow("COD_SNAPSHOT_IMMUTABLE");
    expect(() => sqlite.exec("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('receipt','order-1','payment-1')")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
  });

  it("keeps price, policy and evidence snapshots immutable and retains the incident hold", async () => {
    seedCod();
    for (const change of ["base_amount_pkr=201,cod_fee_pkr=124", "cod_fee_pkr=126,quoted_total_pkr=326", "policy_revision='other'", "collection_policy_hash=NULL", "remittance_policy_hash=NULL", "test_hold=1"]) {
      expect(() => sqlite.exec(`UPDATE cod_order_details SET ${change} WHERE order_id='order-1'`)).toThrow("COD_SNAPSHOT_IMMUTABLE");
    }
    expect(() => sqlite.exec("UPDATE orders SET total_payable=201 WHERE id='order-1'")).toThrow("COD_SNAPSHOT_IMMUTABLE");
    expect(() => sqlite.exec("DELETE FROM cod_order_details WHERE order_id='order-1'")).toThrow("COD_SNAPSHOT_IMMUTABLE");
    expect(() => sqlite.exec("INSERT OR REPLACE INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,created_at,updated_at) VALUES('order-1',1,1,2,'synthetic','synthetic')")).toThrow("COD_SNAPSHOT_IMMUTABLE");
    expect((await reconcile("collection")).status).toBe(200);
    expect(() => sqlite.exec("UPDATE cod_order_details SET collection_ref_hmac='different' WHERE order_id='order-1'")).toThrow("COD_EVIDENCE_IMMUTABLE");
    sqlite.exec("UPDATE orders SET order_number='FS-261019-000001' WHERE id='order-1'");
    const response = await post("/api/orders/order-1/tracking", { confirmation: "FS-261019-000001", trackingNumber: "SYNTHETIC-HELD" });
    expect(await response.json()).toEqual({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" });
  });

  it("blocks advance receipt reassignment by either order or payment association", () => {
    seedCod();
    sqlite.exec("INSERT INTO orders(id,order_number,state,payment_status,total_payable,archived_at,updated_at) VALUES('advance','SIM-ADVANCE','PAYMENT_REVIEW','PENDING',200,NULL,'synthetic'); INSERT INTO payments(id,order_id,expected_amount,review_state) VALUES('advance-payment','advance',200,'REVIEW'); INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('advance-receipt','advance','advance-payment')");
    expect(() => sqlite.exec("UPDATE payment_receipts SET order_id='order-1' WHERE id='advance-receipt'")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    expect(() => sqlite.exec("UPDATE payment_receipts SET payment_id='payment-1' WHERE id='advance-receipt'")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    expect(() => sqlite.exec("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('wrong-association','advance','payment-1')")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    expect(sqlite.prepare("SELECT order_id,payment_id FROM payment_receipts").get()).toEqual({ order_id: "advance", payment_id: "advance-payment" });
  });

  it("renders hold notices instead of active fulfillment controls", async () => {
    const html = await (await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env())).text();
    const script = html.slice(html.indexOf("const addUnheldOrderActions=addActions;"), html.indexOf("function renderDetail(data){"));
    expect(script).toContain("DO NOT SHIP");
    const notices: { textContent?: string }[] = [];
    let calls = 0;
    const context = { addActions: () => { calls++; }, detail: { querySelector: () => ({ replaceChildren: (notice: { textContent: string }) => notices.push(notice) }) }, document: { createElement: () => ({}) } };
    runInNewContext(`${script}\naddActions({fulfillmentHold:true,fulfillmentHoldReason:'TEST ONLY / DO NOT SHIP'});`, context);
    expect(calls).toBe(0);
    expect(notices[0].textContent).toBe("TEST ONLY / DO NOT SHIP");
  });

  it("rolls back configuration and policy hashes if the required audit write fails", async () => {
    const before = sqlite.prepare("SELECT * FROM cod_configuration WHERE id='default'").get();
    sqlite.exec(`CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_log
      WHEN NEW.action='COD_CONFIGURATION_UPDATED'
      BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_WRITE_FAILURE'); END;`);
    const session = await csrf();
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", {
      method: "POST", headers: mutationHeaders(session),
      body: JSON.stringify({ enabled: true, feePkr: 125, collectionPolicyReference: "SYNTHETIC-COLLECTION-POLICY", remittancePolicyReference: "SYNTHETIC-REMITTANCE-POLICY", expectedRevision: "unconfigured" })
    }), env());
    expect(response.status).toBe(503);
    expect(sqlite.prepare("SELECT * FROM cod_configuration WHERE id='default'").get()).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_CONFIGURATION_UPDATED'").get()).toEqual({ count: 0 });
  });

  it("renders explicit COD stages while preserving the PUBLIC Worker flag", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env());
    const html = await response.text();
    expect(html).toContain("COD_PENDING:['PACKING','Mark packing']");
    expect(html).toContain("DELIVERED:['COLLECTION_PENDING','Move to collection pending']");
    expect(html).toContain('<option value="COD_PENDING">COD pending</option>');
    expect(readFileSync("apps/api/wrangler.jsonc", "utf8")).toContain('"COD_V1_ENABLED": "true"');
    expect(readFileSync("apps/api/wrangler.jsonc", "utf8")).toContain('"COD_ROLLOUT_MODE": "PUBLIC"');
    expect(html).toContain("MO Received");
    expect(html).toContain("/mark-payment-received");
    expect(html).toContain("Original COD amount: PKR ");
    expect(html).toContain("Pakistan Post MO number");
    expect(html).toContain("confirmed:true");
    expect(html).toContain("order.state==='COLLECTION_PENDING'");
    expect(html).toContain("Record historical MO Received");
    expect(html).toContain("mark-historical-cod-received");
    expect(html).toContain("Private evidence reference");
  });

  it("shows read-only MO information on COD_PENDING without a payment submission", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env());
    const html = await response.text();
    const script = html.slice(html.indexOf("const addUnheldOrderActions=addActions;"), html.indexOf("function renderDetail(data){"));
    type SyntheticNode = {
      tagName?: string;
      className?: string;
      textContent?: string;
      onclick?: () => unknown;
      title?: string;
      style: Record<string, string>;
      dataset: Record<string, string>;
      children: SyntheticNode[];
      append: (...nodes: SyntheticNode[]) => void;
    };
    const appended: SyntheticNode[] = [];
    const root = {
      querySelectorAll: () => [],
      querySelector: () => null,
      append: (...nodes: SyntheticNode[]) => appended.push(...nodes),
      insertAdjacentHTML: () => undefined
    };
    const context = {
      addActions: () => undefined,
      detail: { querySelector: () => root },
      document: {
        createElement: (tag: string): SyntheticNode => ({ tagName: tag, className: "", style: {}, dataset: {}, children: [], append(...nodes: SyntheticNode[]) { this.children.push(...nodes); } })
      },
      actionButton: (label: string, handler: () => unknown, className: string): SyntheticNode => ({ textContent: label, onclick: handler, className, style: {}, dataset: {}, children: [], append: () => undefined, title: "" }),
      money: (value: number) => `PKR ${value}`,
      alert: vi.fn()
    };
    runInNewContext(`${script}\naddActions({codOrder:true,codStatus:'COD_PENDING',state:'COD_PENDING',codQuotedTotalPkr:625,orderNumber:'SYNTHETIC-COD'});`, context);
    const panel = appended.find((node) => node.className === "cod-mo-info");
    if (!panel) throw new Error("MO information panel was not rendered");
    expect(panel.children.map((node) => node.textContent).join(" ")).toContain("COD amount: PKR 625");
    expect(panel.children.map((node) => node.textContent).join(" ")).toContain("MO settlement status: COD_PENDING");
    const button = panel.children.find((node) => node.textContent === "MO Received" && typeof node.onclick === "function");
    if (!button?.onclick) throw new Error("MO information button was not rendered");
    expect(button.className).toBe("");
    await button.onclick();
    expect(context.alert).toHaveBeenCalledOnce();
  });

  it("marks an eligible COD order paid once through one audited manual confirmation", async () => {
    seedCod();
    const response = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, paymentStatus: "PAID", capiQueue: "DISABLED" });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state: "PAID", payment_status: "PAID" });
    expect(sqlite.prepare("SELECT review_state,approved_amount,approved_by FROM payments").get()).toEqual({ review_state: "COD_PAID", approved_amount: 325, approved_by: "admin@example.test" });
    expect(sqlite.prepare("SELECT status FROM cod_order_details").get()).toEqual({ status: "PAID" });
    expect(sqlite.prepare("SELECT mo_amount_pkr,operator_id FROM cod_mo_receipts").get()).toEqual({ mo_amount_pkr: 325, operator_id: "admin@example.test" });
    const audit = sqlite.prepare("SELECT action,actor_id,metadata_json FROM audit_log WHERE action='COD_MO_RECEIVED'").get() as { action: string; actor_id: string; metadata_json: string };
    expect(audit.actor_id).toBe("admin@example.test");
    expect(JSON.parse(audit.metadata_json)).toMatchObject({ orderId: "order-1", amountPkr: 325, settlementMode: "PAKISTAN_POST_MO" });
    const repeat = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({ alreadyPaid: true, paymentStatus: "PAID" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_MO_RECEIVED'").get()).toEqual({ count: 1 });
    const conflictingReplay = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-DIFFERENT-REPLAY", confirmed: true });
    expect(conflictingReplay.status).toBe(409);
    expect(await conflictingReplay.json()).toEqual({ error: "COD_MO_ALREADY_RECORDED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_mo_receipts").get()).toEqual({ count: 1 });
  });

  it("rejects unauthorized, wrong-amount and premature manual COD confirmation", async () => {
    seedCod();
    const unauthorized = await app.fetch(new Request("https://admin.example.test/api/orders/order-1/mark-payment-received", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true }) }), env());
    expect(unauthorized.status).toBe(403);
    expect((await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 324, moNumber: "PK-MO-001", confirmed: true })).status).toBe(409);
    expect((await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: false })).status).toBe(400);
  });

  it("rejects manual payment confirmation before collection pending", async () => {
    seedCod("COD_PENDING");
    expect((await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true })).status).toBe(409);
    expect(sqlite.prepare("SELECT state,payment_status FROM orders").get()).toEqual({ state: "COD_PENDING", payment_status: "COD_PENDING" });
  });

  it("settles one delivered historical COD order without changing original payment method or review history", async () => {
    seedHistorical();
    const response = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-001", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-001", reason: "Owner verified delivered COD and company receipt", confirmed: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, historical: true, paymentStatus: "PAID", capiQueue: "DISABLED" });
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id='historical-order'").get()).toEqual({ state: "PAID", payment_status: "PAID", total_payable: 200 });
    expect(sqlite.prepare("SELECT method,review_state,approved_amount FROM payments WHERE id='historical-payment'").get()).toEqual({ method: null, review_state: "PENDING", approved_amount: null });
    expect(sqlite.prepare("SELECT received_amount_pkr,receipt_date,operator_id FROM cod_historical_mo_receipts").get()).toEqual({ received_amount_pkr: 200, receipt_date: "2026-01-01", operator_id: "admin@example.test" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_HISTORICAL_MO_RECEIVED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events").get()).toEqual({ count: 0 });
    const replay = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-001", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-001", reason: "Owner verified delivered COD and company receipt", confirmed: true });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ ok: true, alreadyRecorded: true, historical: true, paymentStatus: "PAID" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_HISTORICAL_MO_RECEIVED'").get()).toEqual({ count: 1 });
  });

  it("creates one durable historical Purchase outbox event without blocking PAID when Queue is unavailable", async () => {
    seedHistorical();
    sqlite.prepare("INSERT INTO customers(id) VALUES('historical-customer')").run();
    sqlite.prepare("UPDATE orders SET customer_id='historical-customer' WHERE id='historical-order'").run();
    sqlite.prepare("INSERT INTO meta_attribution(id,order_id,ctwa_clid) VALUES('historical-attribution','historical-order','synthetic-historical-ctwa')").run();
    const events = { send: vi.fn(async () => { throw new Error("QUEUE_UNAVAILABLE"); }) };
    const response = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-CAPI-001", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-CAPI-001", reason: "Owner verified delivered COD and company receipt", confirmed: true }, undefined, env(hmacKey, "true", events));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, paymentStatus: "PAID", historical: true, capiQueue: "DEFERRED" });
    expect(events.send).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare("SELECT event_id,event_name,send_status FROM capi_events").get()).toMatchObject({ event_id: "purchase_SIM-HISTORICAL-COD", event_name: "Purchase", send_status: "PENDING" });
    expect(sqlite.prepare("SELECT kind,idempotency_key,status FROM outbox_jobs").get()).toMatchObject({ kind: "CAPI_PURCHASE", idempotency_key: "purchase_SIM-HISTORICAL-COD", status: "PENDING" });
  });

  it("blocks historical settlement for an unverified Advance receipt and preserves the receipt", async () => {
    seedHistorical("EASYPAISA");
    sqlite.prepare("UPDATE payments SET review_state='REVIEW' WHERE id='historical-payment'").run();
    sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('advance-slip','historical-order','historical-payment')").run();
    const response = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-002", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-002", reason: "Historical COD review", confirmed: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "HISTORICAL_ADVANCE_RECEIPT_RECONCILIATION_REQUIRED" });
    expect(sqlite.prepare("SELECT state,payment_status FROM orders WHERE id='historical-order'").get()).toEqual({ state: "DELIVERED", payment_status: "PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id='historical-order'").get()).toEqual({ count: 1 });
  });

  it("rejects historical mismatches, non-delivered orders, duplicate MO and concurrent losers", async () => {
    seedHistorical(null, "DISPATCHED");
    expect((await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-003", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-003", reason: "Historical COD review", confirmed: true })).status).toBe(409);
    sqlite.prepare("UPDATE orders SET state='DELIVERED' WHERE id='historical-order'").run();
    const mismatch = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 201, moNumber: "PK-HIST-MO-003", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-003", reason: "Historical COD review", confirmed: true });
    expect(mismatch.status).toBe(409);
    const [winner, loser] = await Promise.all([
      post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-003", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-003", reason: "Historical COD review", confirmed: true }),
      post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-HIST-MO-003", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-003", reason: "Historical COD review", confirmed: true })
    ]);
    expect([winner.status, loser.status].sort(), JSON.stringify(await Promise.all([winner.clone().json(), loser.clone().json()]))).toEqual([200, 200]);
    expect([await winner.clone().json(), await loser.clone().json()].some((body) => (body as { alreadyRecorded?: boolean }).alreadyRecorded === true)).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_historical_mo_receipts").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='COD_HISTORICAL_MO_RECEIVED'").get()).toEqual({ count: 1 });
  });

  it("blocks a normal-ledger MO from historical settlement", async () => {
    seedCod();
    seedHistorical();
    const referenceHmac = await codReferenceHmac("PK-CROSS-LEDGER-001", hmacKey);
    sqlite.prepare("INSERT INTO cod_mo_receipts(order_id,mo_reference_hmac,mo_amount_pkr,operator_id,received_at) VALUES(?,?,?,?,?)")
      .run("order-1", referenceHmac, 200, "synthetic", "2026-01-01T00:00:00.000Z");
    const response = await post("/api/orders/historical-order/mark-historical-cod-received", { confirmation: "SIM-HISTORICAL-COD", amountPkr: 200, moNumber: "PK-CROSS-LEDGER-001", receiptDate: "2026-01-01", evidenceReference: "PRIVATE-RECEIPT-CROSS-001", reason: "Cross-ledger duplicate test", confirmed: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "COD_MO_ALREADY_USED" });
  });

  it("blocks a historical-ledger MO from normal COD settlement", async () => {
    seedCod();
    seedHistorical();
    const referenceHmac = await codReferenceHmac("PK-CROSS-LEDGER-002", hmacKey);
    sqlite.prepare("INSERT INTO cod_historical_mo_receipts(order_id,mo_reference_hmac,received_amount_pkr,receipt_date,evidence_reference_hmac,settlement_reason,operator_id,received_at) VALUES(?,?,?,?,?,?,?,?)")
      .run("historical-order", referenceHmac, 200, "2026-01-01", "synthetic-evidence", "Cross-ledger duplicate test", "synthetic", "2026-01-01T00:00:00.000Z");
    const response = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-CROSS-LEDGER-002", confirmed: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "COD_MO_ALREADY_USED" });
  });

  it("queues one idempotent Purchase event and keeps payment paid when Queue delivery is unavailable", async () => {
    seedCod();
    sqlite.prepare("INSERT INTO customers(id) VALUES('customer-1')").run();
    sqlite.prepare("UPDATE orders SET customer_id='customer-1' WHERE id='order-1'").run();
    sqlite.prepare("INSERT INTO meta_attribution(id,order_id,ctwa_clid) VALUES('attribution-1','order-1','synthetic-ctwa')").run();
    const events = { send: vi.fn(async () => { throw new Error("QUEUE_UNAVAILABLE"); }) };
    const runtime = env(hmacKey, "true", events);
    const response = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true }, undefined, runtime);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentStatus: "PAID", capiQueue: "DEFERRED" });
    expect(events.send).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare("SELECT event_id,event_name,send_status FROM capi_events").get()).toMatchObject({ event_id: "purchase_SIM-GFS222-DO-NOT-SHIP", event_name: "Purchase", send_status: "PENDING" });
    expect(sqlite.prepare("SELECT kind,idempotency_key,status FROM outbox_jobs").get()).toMatchObject({ kind: "CAPI_PURCHASE", idempotency_key: "purchase_SIM-GFS222-DO-NOT-SHIP", status: "PENDING" });
    const repeat = await post("/api/orders/order-1/mark-payment-received", { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, moNumber: "PK-MO-001", confirmed: true }, undefined, runtime);
    expect(repeat.status).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM capi_events WHERE event_name='Purchase'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE kind='CAPI_PURCHASE'").get()).toEqual({ count: 1 });
  });

  it("keeps the intake toggle simple and fixed at PKR 125 without collecting courier references", async () => {
    const session = await csrf();
    const wrongFee = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 150, expectedRevision: "unconfigured" }) }), env(""));
    expect(wrongFee.status).toBe(400);
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 125, expectedRevision: "unconfigured" }) }), env(""));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: true, feePkr: 125, collectionPolicyConfigured: false, remittancePolicyConfigured: false });
    const config = sqlite.prepare("SELECT enabled,fee_pkr,collection_policy_hash,remittance_policy_hash FROM cod_configuration WHERE id='default'").get() as { enabled: number; fee_pkr: number; collection_policy_hash: string; remittance_policy_hash: string };
    expect(config).toEqual({ enabled: 1, fee_pkr: 125, collection_policy_hash: null, remittance_policy_hash: null });
    const audits = JSON.stringify(sqlite.prepare("SELECT metadata_json FROM audit_log").all());
    expect(audits).not.toContain("PolicyReference");
    const page = await (await app.fetch(new Request("https://admin.example.test/cod-settings", { headers: auth }), env(""))).text();
    expect(page).toContain("COD collection fee: PKR 125");
    expect(page).not.toContain("remittance");
    expect(page).not.toContain("evidence reference");
  });

  it.each(["PAID", "PACKING"])("quarantines synthetic %s records with exact receipt/amount but no approval audit across actual handlers", async (state) => {
    extendFulfillmentReadSchema();
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO customers(id,wa_id,full_name) VALUES('quarantine-customer','923000000099','SYNTHETIC DO NOT SHIP')").run();
    for (const [id, valid] of [["quarantined", false], ["unrelated", true]] as const) {
      sqlite.prepare("INSERT INTO orders(id,order_number,customer_id,state,payment_status,total_payable,created_at,updated_at) VALUES(?,?, 'quarantine-customer',?,'PAID',1000,?,?)").run(id, `SIM-${id}`, state, now, now);
      sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,approved_amount,approved_by,approved_at,customer_transaction_reference,updated_at) VALUES(?,?,'JAZZCASH',1000,'APPROVED',1000,'admin@example.test',?,?,?)").run(`${id}-payment`, id, now, `SYNTHETIC-TID-${id}`, now);
      sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,r2_object_key,sha256) VALUES(?,?,?,'synthetic/receipt','synthetic-sha')").run(`${id}-receipt`, id, `${id}-payment`);
      if (valid) sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,'PAYMENT_APPROVED','ADMIN','PAYMENT',?,?,?)").run(`${id}-approval`, `${id}-payment`, JSON.stringify({ orderId: id, amountPkr: 1000, settlementEvidenceRef: "synthetic-evidence", transactionReferenceHash: "synthetic-hash" }), now);
    }
    const session = await csrf();
    const mutate = (id: string, path: string, extra: Record<string, unknown> = {}) => app.fetch(new Request(`https://admin.example.test/api/orders/${id}/${path}`, { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: `SIM-${id}`, ...extra }) }), env());
    const before = sqlite.prepare("SELECT * FROM payments WHERE order_id='quarantined'").get();
    for (const [path, extra] of [["tracking", { trackingNumber: "SYNTHETIC-TRACK" }], ["confirm", {}], ["transition", { from: state, to: state === "PAID" ? "PACKING" : "DISPATCHED" }]] as const) {
      expect((await mutate("quarantined", path, extra)).status, path).toBe(409);
      expect((await mutate("unrelated", path, extra)).status, path).toBe(200);
    }
    for (const path of ["shipping-label", "label"]) {
      expect((await app.fetch(new Request(`https://admin.example.test/api/orders/quarantined/${path}`, { headers: auth }), env())).status).toBe(409);
      expect((await app.fetch(new Request(`https://admin.example.test/api/orders/unrelated/${path}`, { headers: auth }), env())).status).toBe(200);
    }
    const detail = await app.fetch(new Request("https://admin.example.test/api/orders/quarantined", { headers: auth }), env());
    expect(await detail.json()).toMatchObject({ order: { fulfillmentHold: true, canPrintShippingLabel: false, canConfirmOrder: false } });
    const csv = await (await app.fetch(new Request("https://admin.example.test/api/orders/export", { headers: auth }), env())).text();
    expect(csv.split("\r\n").find((row) => row.includes("SIM-quarantined"))).toContain(`${state} / HOLD`);
    expect(csv.split("\r\n").find((row) => row.includes("SIM-unrelated"))).not.toContain("HOLD");
    expect(sqlite.prepare("SELECT * FROM payments WHERE order_id='quarantined'").get()).toEqual(before);
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='quarantined'").get()).toEqual({ state });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity_type='ORDER' AND entity_id='quarantined'").get()).toEqual({ count: 0 });
  });

  it("keeps six synthetic test-held COD sidecars blocked while confirmed unrelated COD can resume safely", async () => {
    const now = new Date().toISOString();
    for (let index = 0; index < 7; index++) {
      const id = `synthetic-held-${index}`;
      sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES(?,?,'COD_PENDING','COD_PENDING',200,?)").run(id, `SIM-HOLD-${index}`, now);
      sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES(?,?,NULL,200,'COD_PENDING',?)").run(`${id}-payment`, id, now);
      sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,test_hold,created_at,updated_at) VALUES(?,200,125,325,'COD_PENDING',?,?,?)").run(id, index < 6 ? 1 : 0, now, now);
      sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,'COD_ORDER_CONFIRMED','CUSTOMER','ORDER',?,'{\"totalPkr\":325}',?)").run(`${id}-consent`, id, now);
    }
    const session = await csrf();
    for (let index = 0; index < 7; index++) {
      const path = `https://admin.example.test/api/orders/synthetic-held-${index}`;
      const post = (action: string, body: Record<string, unknown>, recovery = "false") => app.fetch(new Request(`${path}/${action}`, { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: `SIM-HOLD-${index}`, ...body }) }), Object.assign({}, env(), { RECOVERY_MODE: recovery }) as never);
      expect((await post("transition", { from: "COD_PENDING", to: "PACKING" }, "true")).status).toBe(503);
      expect((await post("tracking", { trackingNumber: "SYNTHETIC-TRACK" }, "true")).status).toBe(503);
      expect((await post("tracking", { trackingNumber: "SYNTHETIC-TRACK" })).status).toBe(index < 6 ? 409 : 200);
      expect((await post("transition", { from: "COD_PENDING", to: "PACKING" })).status).toBe(index < 6 ? 409 : 200);
      if (index === 6) {
        expect((await post("transition", { from: "COD_PENDING", to: "PACKING" })).status).toBe(409);
        expect((await post("transition", { from: "PACKING", to: "DISPATCHED" })).status).toBe(200);
        expect((await post("transition", { from: "PACKING", to: "DISPATCHED" })).status).toBe(409);
      }
    }
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE test_hold=1 AND status='COD_PENDING' AND cod_fee_pkr=125 AND quoted_total_pkr=325").get()).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='ORDER_STATE_TRANSITIONED'").get()).toEqual({ count: 2 });
  });

  it("rechecks tracking and confirmation evidence inside the audit write after a concurrent evidence loss", async () => {
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('advance-order','SIM-CAS','PAID','PAID',1000,?)").run(now);
    sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,approved_amount,approved_at,updated_at) VALUES('advance-payment','advance-order','JAZZCASH',1000,'APPROVED',1000,?,?)").run(now, now);
    sqlite.exec("INSERT INTO payment_receipts VALUES('receipt','advance-order','advance-payment','synthetic/receipt','synthetic-sha')");
    const session = await csrf();
    for (const path of ["tracking", "confirm"]) {
      sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,metadata_json,created_at) VALUES('cas-approval','PAYMENT_APPROVED','ADMIN','PAYMENT','advance-payment',?,?)").run(JSON.stringify({ orderId: "advance-order", amountPkr: 1000, settlementEvidenceRef: "synthetic-evidence", transactionReferenceHash: "synthetic-hash" }), now);
      db.beforeNextBatch(() => sqlite.exec("DELETE FROM audit_log WHERE id='cas-approval'"));
      const response = await app.fetch(new Request(`https://admin.example.test/api/orders/advance-order/${path}`, { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "SIM-CAS", trackingNumber: "SYNTHETIC-TRACK" }) }), env());
      expect(response.status).toBe(409);
    }
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity_type='ORDER'").get()).toEqual({ count: 0 });
  });

  it("blocks advance fulfillment until the approved amount, stored receipt and settlement audit agree", async () => {
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('advance-order','FS-SYNTHETIC-ADVANCE','PAID','PAID',1000,?)").run(now);
    sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,approved_amount,approved_by,approved_at,customer_transaction_reference,updated_at) VALUES('advance-payment','advance-order','JAZZCASH',1000,'APPROVED',999,'admin@example.test',?,'SYNTHETIC-TID-0001',?)").run(now, now);
    const session = await csrf();
    const transition = () => app.fetch(new Request("https://admin.example.test/api/orders/advance-order/transition", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-SYNTHETIC-ADVANCE", from: "PAID", to: "PACKING" }) }), env());

    const incomplete = await transition();
    expect(incomplete.status).toBe(409);
    expect(await incomplete.json()).toMatchObject({ error: "FULFILLMENT_PAYMENT_NOT_APPROVED" });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='advance-order'").get()).toEqual({ state: "PAID" });

    sqlite.prepare("UPDATE payments SET approved_amount=1000 WHERE id='advance-payment'").run();
    sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id,r2_object_key,sha256) VALUES('advance-receipt','advance-order','advance-payment','synthetic/receipt','synthetic-sha256')").run();
    sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,metadata_json,created_at) VALUES('advance-approval','PAYMENT_APPROVED','ADMIN','PAYMENT','advance-payment',?,?)").run(JSON.stringify({ orderId: "advance-order", amountPkr: 1000, settlementEvidenceRef: "synthetic-settlement-evidence", transactionReferenceHash: "synthetic-reference-hash" }), now);

    const accepted = await transition();
    expect(accepted.status).toBe(200);
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='advance-order'").get()).toEqual({ state: "PACKING" });
  });

  it("guards advance settlement, enforces COD fulfillment, and reaches COD_PAID only after exact collection and remittance", async () => {
    const collectionPolicyHash = await codReferenceHmac("SYNTHETIC-COURIER-POLICY", hmacKey);
    const remittancePolicyHash = await codReferenceHmac("SYNTHETIC-REMITTANCE-POLICY", hmacKey);
    const now = new Date().toISOString();
    sqlite.prepare("UPDATE cod_configuration SET enabled=1,collection_policy_hash=?,remittance_policy_hash=? WHERE id='default'").run(collectionPolicyHash, remittancePolicyHash);
    sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('order-1','FS-SYNTHETIC-1','COD_PENDING','COD_PENDING',200,?)").run(now);
    sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES('payment-1','order-1',NULL,200,'COD_PENDING',?)").run(now);
    sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,created_at,updated_at) VALUES('order-1',200,125,325,'COD_PENDING','synthetic-policy',?,?,0,?,?)").run(collectionPolicyHash, remittancePolicyHash, now, now);
    expect(() => sqlite.prepare("UPDATE orders SET state='PAID',payment_status='PAID' WHERE id='order-1'").run()).toThrow(/COD_/);
    expect(() => sqlite.prepare("UPDATE payments SET review_state='APPROVED',approved_amount=200 WHERE id='payment-1'").run()).toThrow("COD_REQUIRES_COLLECTION_REMITTANCE_RECONCILIATION");
    expect(() => sqlite.prepare("UPDATE payments SET review_state='REJECTED' WHERE id='payment-1'").run()).toThrow("COD_REQUIRES_COLLECTION_REMITTANCE_RECONCILIATION");
    expect(() => sqlite.prepare("UPDATE cod_order_details SET status='PAID' WHERE order_id='order-1'").run()).toThrow(/COD_/);
    const session = await csrf();
    const reconcile = (kind: string, amountPkr: number, evidenceReference: string) => app.fetch(new Request(`https://admin.example.test/api/orders/order-1/cod-${kind}`, { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-SYNTHETIC-1", amountPkr, evidenceReference }) }), env());
    const transition = (from: string, to: string) => app.fetch(new Request("https://admin.example.test/api/orders/order-1/transition", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-SYNTHETIC-1", from, to }) }), env());

    const missingCustomerConfirmation = await transition("COD_PENDING", "PACKING");
    expect(missingCustomerConfirmation.status).toBe(409);
    expect(await missingCustomerConfirmation.json()).toMatchObject({ error: "COD_CUSTOMER_CONFIRMATION_REQUIRED" });
    expect(sqlite.prepare("SELECT state FROM orders WHERE id='order-1'").get()).toEqual({ state: "COD_PENDING" });
    sqlite.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES('synthetic-cod-consent','COD_ORDER_CONFIRMED','CUSTOMER','ORDER','order-1','synthetic-correlation',?,?)").run(JSON.stringify({ totalPkr: 325, admission: "PUBLIC", testHold: 0 }), now);

    const packing = await transition("COD_PENDING", "PACKING");
    expect(packing.status, JSON.stringify(await packing.json())).toBe(200);
    const dispatchWithoutTracking = await transition("PACKING", "DISPATCHED");
    expect(dispatchWithoutTracking.status).toBe(409);
    expect(await dispatchWithoutTracking.json()).toMatchObject({ error: "COD_TRACKING_REQUIRED_BEFORE_DISPATCH" });
    const track = await app.fetch(new Request("https://admin.example.test/api/orders/order-1/tracking", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ confirmation: "FS-SYNTHETIC-1", trackingNumber: "SYNTHETIC-TRACK-001" }) }), env());
    expect(track.status).toBe(200);
    expect((await transition("PACKING", "DISPATCHED")).status).toBe(200);
    expect((await transition("DISPATCHED", "DELIVERED")).status).toBe(200);
    expect((await transition("DELIVERED", "COLLECTION_PENDING")).status).toBe(200);
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id='order-1'").get()).toEqual({ state: "COLLECTION_PENDING", payment_status: "COD_PENDING", total_payable: 200 });
    const wrongCollection = await reconcile("collection", 324, "SYNTHETIC-COLLECTION-REF");
    expect(wrongCollection.status).toBe(409);
    expect(sqlite.prepare("SELECT status FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ status: "COLLECTION_PENDING" });

    const collection = await reconcile("collection", 325, "SYNTHETIC-COLLECTION-REF");
    expect(collection.status).toBe(200);
    expect(await collection.json()).toMatchObject({ paid: false, status: "COLLECTION_PENDING" });
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id='order-1'").get()).toEqual({ state: "COLLECTION_PENDING", payment_status: "COD_PENDING", total_payable: 200 });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='payment-1'").get()).toEqual({ review_state: "COD_PENDING", approved_amount: null });
    expect(() => sqlite.prepare("UPDATE orders SET state='PAID',payment_status='PAID' WHERE id='order-1'").run()).toThrow(/COD_/);
    expect(() => sqlite.prepare("UPDATE cod_order_details SET status='PAID' WHERE order_id='order-1'").run()).toThrow("COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED");
    expect((await reconcile("remittance", 324, "SYNTHETIC-WRONG-REMITTANCE")).status).toBe(409);
    expect(sqlite.prepare("SELECT remittance_ref_hmac FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ remittance_ref_hmac: null });

    const remittance = await reconcile("remittance", 325, "SYNTHETIC-REMITTANCE-REF");
    expect(remittance.status).toBe(200);
    expect(await remittance.json()).toMatchObject({ paid: true, status: "PAID" });
    expect(sqlite.prepare("SELECT state,payment_status,total_payable FROM orders WHERE id='order-1'").get()).toEqual({ state: "PAID", payment_status: "PAID", total_payable: 200 });
    expect(sqlite.prepare("SELECT review_state,approved_amount FROM payments WHERE id='payment-1'").get()).toEqual({ review_state: "COD_PAID", approved_amount: 325 });
    expect(await (await reconcile("collection", 325, "SYNTHETIC-COLLECTION-REF")).json()).toMatchObject({ alreadyRecorded: true });
    expect(await (await reconcile("remittance", 325, "SYNTHETIC-REMITTANCE-REF")).json()).toMatchObject({ alreadyRecorded: true });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT cod_fee_pkr,quoted_total_pkr FROM cod_order_details WHERE order_id='order-1'").get()).toEqual({ cod_fee_pkr: 125, quoted_total_pkr: 325 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='ORDER_STATE_TRANSITIONED' AND entity_id='order-1'").get()).toEqual({ count: 4 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='ORDER_TRACKING_ASSIGNED' AND entity_id='order-1'").get()).toEqual({ count: 1 });
    expect(() => sqlite.prepare("UPDATE payments SET review_state='APPROVED',approved_amount=200,approved_by='admin',approved_at=? WHERE id='payment-1'").run(now)).toThrow("COD_REQUIRES_COLLECTION_REMITTANCE_RECONCILIATION");
    expect(() => sqlite.prepare("INSERT INTO payment_receipts(id,order_id,payment_id) VALUES('receipt-1','order-1','payment-1')").run()).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    const detail = sqlite.prepare("SELECT collection_ref_hmac,remittance_ref_hmac,status FROM cod_order_details WHERE order_id='order-1'").get() as { collection_ref_hmac: string; remittance_ref_hmac: string; status: string };
    expect(detail).toEqual({ collection_ref_hmac: await codReferenceHmac("SYNTHETIC-COLLECTION-REF", hmacKey), remittance_ref_hmac: await codReferenceHmac("SYNTHETIC-REMITTANCE-REF", hmacKey), status: "PAID" });
    const audit = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action LIKE 'COD_%'").all() as { metadata_json: string }[];
    expect(JSON.stringify(audit)).not.toContain("SYNTHETIC-COLLECTION-REF");
    expect(JSON.stringify(audit)).not.toContain("SYNTHETIC-REMITTANCE-REF");
  });
});
