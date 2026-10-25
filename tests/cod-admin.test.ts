import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codReferenceHmac } from "@gfs/core";
import app from "../apps/admin/src/index";

const hmacKey = "synthetic-admin-cod-hmac-key-v1-2026-synthetic";
const auth = { "cf-access-authenticated-user-email": "admin@example.test" };

class D1Adapter {
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

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const statement of statements) results.push({ meta: (await (statement as unknown as { run(): Promise<{ meta: { changes: number } }> }).run()).meta } as D1Result<T>);
    return results;
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

afterEach(() => sqlite.close());

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
    expect(await response.json()).toMatchObject({ enabled: false, feePkr: 125, collectionPolicyConfigured: false, remittancePolicyConfigured: false });
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
    const response = await app.fetch(new Request("https://admin.example.test/api/cod-configuration", { method: "POST", headers: mutationHeaders(session), body: JSON.stringify({ enabled: true, feePkr: 150, collectionPolicyReference: "SYNTHETIC-COURIER-POLICY", remittancePolicyReference: "SYNTHETIC-REMITTANCE-POLICY" }) }), env());
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
    sqlite.prepare("INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,created_at,updated_at) VALUES('order-1',200,125,325,'COD_PENDING',?,?)").run(now, now);
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
