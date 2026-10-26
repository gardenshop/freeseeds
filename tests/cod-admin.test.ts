import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codReferenceHmac } from "@gfs/core";
import app from "../apps/admin/src/index";

const hmacKey = "synthetic-admin-cod-hmac-key-v1-2026-synthetic";
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

class D1Adapter {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return this.prepareBound(sql, []);
  }

  private prepareBound(sql: string, args: unknown[]): D1PreparedStatement {
    return {
      bind: (...values: unknown[]) => this.prepareBound(sql, values),
      first: async <T>() => this.sqlite.prepare(sql).get(...args as SQLInputValue[]) as T ?? null,
      all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...args as SQLInputValue[]) as T[] }),
      run: async () => ({ meta: { changes: Number(this.sqlite.prepare(sql).run(...args as SQLInputValue[]).changes) } })
    } as unknown as D1PreparedStatement;
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const result = this.pending.then(() => this.executeBatch<T>(statements));
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async executeBatch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    this.sqlite.exec("BEGIN");
    try {
      for (const statement of statements) results.push({ meta: (await (statement as unknown as { run(): Promise<{ meta: { changes: number } }> }).run()).meta } as D1Result<T>);
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

let sqlite: DatabaseSync;
let db: D1Adapter;
const env = (key: string | undefined = hmacKey) => ({ DB: db as unknown as D1Database, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", COD_REFERENCE_HMAC_KEY: key }) as never;

async function csrf() {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: auth }), env());
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: response.headers.get("set-cookie")!.split(";", 1)[0] };
}

function mutationHeaders(session: { token: string; cookie: string }) {
  return { ...auth, origin: "https://admin.example.test", cookie: session.cookie, "x-csrf-token": session.token, "content-type": "application/json" };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT NOT NULL,state TEXT NOT NULL,payment_status TEXT NOT NULL,total_payable INTEGER NOT NULL,archived_at TEXT,updated_at TEXT);
    CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,method TEXT,expected_amount INTEGER NOT NULL,review_state TEXT NOT NULL,approved_amount INTEGER,approved_by TEXT,approved_at TEXT,updated_at TEXT);
    CREATE TABLE payment_receipts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,payment_id TEXT NOT NULL);
    CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT,actor_type TEXT,actor_id TEXT,entity_type TEXT,entity_id TEXT,correlation_id TEXT,metadata_json TEXT,created_at TEXT);
  `);
  sqlite.exec(readFileSync("migrations/0030_cod_v1_compat.sql", "utf8"));
  db = new D1Adapter(sqlite);
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

// Independent synthetic settlement fixtures deliberately opt out at INSERT, never through an endpoint.
function seedCod(status = "COLLECTION_PENDING", hold = 0, snapshot = true, orderNumber = "SIM-GFS222-DO-NOT-SHIP") {
  const now = "2026-01-01T00:00:00.000Z";
  sqlite.prepare("INSERT INTO orders(id,order_number,state,payment_status,total_payable,updated_at) VALUES('order-1',?,?,'COD_PENDING',200,?)").run(orderNumber, status, now);
  sqlite.prepare("INSERT INTO payments(id,order_id,method,expected_amount,review_state,updated_at) VALUES('payment-1','order-1',NULL,200,'COD_PENDING',?)").run(now);
  sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,created_at,updated_at) VALUES('order-1',200,125,325,?,?,?,?,?,?,?)")
    .run(status, snapshot ? "synthetic-policy-revision" : null, snapshot ? "a".repeat(64) : null, snapshot ? "b".repeat(64) : null, hold, now, now);
}

async function post(path: string, body: Record<string, unknown>, session?: Awaited<ReturnType<typeof csrf>>) {
  return app.fetch(new Request(`https://admin.example.test${path}`, { method: "POST", headers: mutationHeaders(session ?? await csrf()), body: JSON.stringify(body) }), env());
}

function reconcile(kind: string, evidenceReference = `SYNTHETIC-${kind.toUpperCase()}-EVIDENCE`, session?: Awaited<ReturnType<typeof csrf>>) {
  return post(`/api/orders/order-1/cod-${kind}`, { confirmation: "SIM-GFS222-DO-NOT-SHIP", amountPkr: 325, evidenceReference }, session);
}

describe("COD Admin configuration and reconciliation", () => {
  it("fails closed when the dedicated HMAC key is shorter than 32 characters", async () => {
    await expect(codReferenceHmac("SYNTHETIC-EVIDENCE", "short-key")).rejects.toThrow("COD_REFERENCE_HMAC_KEY_REQUIRED");
    const session = await csrf();
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 125, collectionPolicyReference: "SYNTHETIC-COLLECTION-POLICY", remittancePolicyReference: "SYNTHETIC-REMITTANCE-POLICY" }) }), env("short-key"));
    expect(response.status).toBe(503);
    expect(sqlite.prepare("SELECT enabled FROM cod_configuration WHERE id='default'").get()).toEqual({ enabled: 0 });
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
    const body = { enabled: true, feePkr: 125, collectionPolicyReference: "SYNTHETIC-COLLECTION-POLICY", remittancePolicyReference: "SYNTHETIC-REMITTANCE-POLICY", expectedRevision: "unconfigured" };
    const responses = await Promise.all([post("/api/cod-configuration", body, session), post("/api/cod-configuration", { ...body, feePkr: 150 }, session)]);
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
    expect(page).toContain("remittancePolicyReference.value,expectedRevision");
  });

  it("preserves disabled intake policy hashes and reconciles historical snapshots after policies change", async () => {
    const initial = await post("/api/cod-configuration", { enabled: true, feePkr: 125, collectionPolicyReference: "SYNTHETIC-OLD-COLLECTION", remittancePolicyReference: "SYNTHETIC-OLD-REMITTANCE", expectedRevision: "unconfigured" });
    const { revision } = await initial.json() as { revision: string };
    const original = sqlite.prepare("SELECT collection_policy_hash,remittance_policy_hash FROM cod_configuration").get();
    seedCod();
    const disabled = await post("/api/cod-configuration", { enabled: false, feePkr: 999, expectedRevision: revision });
    expect(disabled.status).toBe(200);
    expect(sqlite.prepare("SELECT collection_policy_hash,remittance_policy_hash FROM cod_configuration").get()).toEqual(original);
    const next = await disabled.json() as { revision: string };
    expect((await reconcile("collection")).status).toBe(200);
    expect((await post("/api/cod-configuration", { enabled: false, feePkr: 999, collectionPolicyReference: "SYNTHETIC-NEW-COLLECTION", remittancePolicyReference: "SYNTHETIC-NEW-REMITTANCE", expectedRevision: next.revision })).status).toBe(200);
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
    sqlite.exec("INSERT INTO orders VALUES('order-1','SIM-GFS222-DO-NOT-SHIP','COD_PENDING','COD_PENDING',200,NULL,'synthetic'); INSERT INTO payments(id,order_id,expected_amount,review_state) VALUES('payment-1','order-1',200,'COD_PENDING'); INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,created_at,updated_at) VALUES('order-1',200,125,325,'synthetic','synthetic')");
    expect(sqlite.prepare("SELECT test_hold FROM cod_order_details").get()).toEqual({ test_hold: 1 });
    expect(() => sqlite.exec("UPDATE orders SET state='PACKING' WHERE id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("UPDATE cod_order_details SET status='PACKING' WHERE order_id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("UPDATE orders SET payment_status='PAID' WHERE id='order-1'")).toThrow(/COD_/);
    expect(() => sqlite.exec("INSERT INTO audit_log(id,entity_type,entity_id,action) VALUES('tracking','ORDER','order-1','ORDER_TRACKING_ASSIGNED')")).toThrow("COD_TEST_HOLD_DO_NOT_SHIP");
    expect(() => sqlite.exec("UPDATE cod_order_details SET test_hold=0 WHERE order_id='order-1'")).toThrow("COD_SNAPSHOT_IMMUTABLE");
    expect(() => sqlite.exec("INSERT INTO payment_receipts VALUES('receipt','order-1','payment-1')")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
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
    sqlite.exec("INSERT INTO orders VALUES('advance','SIM-ADVANCE','PAYMENT_REVIEW','PENDING',200,NULL,'synthetic'); INSERT INTO payments(id,order_id,expected_amount,review_state) VALUES('advance-payment','advance',200,'REVIEW'); INSERT INTO payment_receipts VALUES('advance-receipt','advance','advance-payment')");
    expect(() => sqlite.exec("UPDATE payment_receipts SET order_id='order-1' WHERE id='advance-receipt'")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    expect(() => sqlite.exec("UPDATE payment_receipts SET payment_id='payment-1' WHERE id='advance-receipt'")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
    expect(() => sqlite.exec("INSERT INTO payment_receipts VALUES('wrong-association','advance','payment-1')")).toThrow("COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS");
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

  it("renders explicit COD stages while keeping the staging Worker flag off", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env());
    const html = await response.text();
    expect(html).toContain("COD_PENDING:['PACKING','Mark packing']");
    expect(html).toContain("DELIVERED:['COLLECTION_PENDING','Move to collection pending']");
    expect(html).toContain('<option value="COD_PENDING">COD pending</option>');
    expect(readFileSync("apps/api/wrangler.jsonc", "utf8")).toContain('"COD_V1_ENABLED": "false"');
  });

  it("stores only keyed hashes for explicitly enabled courier policy references", async () => {
    const session = await csrf();
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 150, collectionPolicyReference: "SYNTHETIC-COURIER-POLICY", remittancePolicyReference: "SYNTHETIC-REMITTANCE-POLICY", expectedRevision: "unconfigured" }) }), env());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: true, feePkr: 150, collectionPolicyConfigured: true, remittancePolicyConfigured: true });
    const config = sqlite.prepare("SELECT enabled,fee_pkr,collection_policy_hash,remittance_policy_hash FROM cod_configuration WHERE id='default'").get() as { enabled: number; fee_pkr: number; collection_policy_hash: string; remittance_policy_hash: string };
    expect(config).toEqual({ enabled: 1, fee_pkr: 150, collection_policy_hash: await codReferenceHmac("SYNTHETIC-COURIER-POLICY", hmacKey), remittance_policy_hash: await codReferenceHmac("SYNTHETIC-REMITTANCE-POLICY", hmacKey) });
    const audits = JSON.stringify(sqlite.prepare("SELECT metadata_json FROM audit_log").all());
    expect(audits).not.toContain("SYNTHETIC-COURIER-POLICY");
    expect(audits).not.toContain("SYNTHETIC-REMITTANCE-POLICY");
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
