import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Synthetic SQLite migration checks only; not a remote D1 backup or Worker rollback test.
const now = "2026-01-01T00:00:00.000Z";
const migration = readFileSync("migrations/0030_cod_v1_compat.sql", "utf8");
let db: DatabaseSync;

function seedLegacyOrder(id: string, state: string, review: string) {
  db.prepare(`INSERT INTO orders(id,order_number,customer_id,offer_code,pack_quantity,
    seed_price,delivery_fee,fertilizer_fee,total_payable,state,payment_status,created_at,updated_at)
    VALUES(?,?,'synthetic-customer','SYNTHETIC',5,0,250,0,250,?,?,?,?)`)
    .run(id, `SYNTHETIC-${id}`, state, state === "PAID" ? "PAID" : "PENDING", now, now);
  db.prepare(`INSERT INTO payments(id,order_id,expected_amount,review_state,created_at,updated_at)
    VALUES(?,?,250,?,?,?)`).run(`payment-${id}`, id, review, now, now);
}

function legacySnapshot() {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'cod_%' ORDER BY name").all();
  return Object.fromEntries(tables.map(({ name }) => [String(name), db.prepare(`SELECT * FROM "${String(name).replaceAll('"', '""')}" ORDER BY rowid`).all()]));
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").filter((name) => /^00(?:0[1-9]|[12]\d)_.*\.sql$/.test(name)).sort()) {
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  // Wrangler's legacy ledger exists remotely but has no applied rows; model that exact anomaly.
  db.exec("CREATE TABLE d1_migrations (name TEXT PRIMARY KEY)");
  db.exec("PRAGMA foreign_keys=ON");
  db.prepare(`INSERT INTO customers(id,full_name,delivery_address,nearby_place,city,contact_number,
    normalized_phone,normalized_address_hash,created_at,updated_at)
    VALUES('synthetic-customer','SYNTHETIC NON-PAYABLE','Synthetic test lane','Synthetic park',
    'Synthetic city','03000000000','923000000000','synthetic-address-hash',?,?)`).run(now, now);
  seedLegacyOrder("pending", "PAYMENT_PENDING", "PENDING");
  seedLegacyOrder("review", "PAYMENT_REVIEW", "REVIEW");
  seedLegacyOrder("paid", "PAID", "APPROVED");
  db.prepare(`INSERT INTO payment_receipts(id,payment_id,order_id,provider_media_id,r2_object_key,
    sha256,mime_type,size_bytes,submitted_at,created_at)
    VALUES('synthetic-receipt','payment-review','review','synthetic-media','synthetic-private-key',
    'synthetic-hash','image/png',100,?,?)`).run(now, now);
  db.prepare(`INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
    VALUES('synthetic-audit','SYNTHETIC_HISTORY','TEST','ORDER','review','synthetic-correlation','{}',?)`).run(now);
});

afterEach(() => db.close());

describe("additive COD migration against populated legacy schema", () => {
  it("preserves every legacy row, receipt, audit, table and index, and starts intake disabled", () => {
    const before = legacySnapshot();
    const schema = db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    db.exec(migration);
    expect(legacySnapshot()).toEqual(before);
    const afterSchema = db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    for (const definition of schema) expect(afterSchema).toContainEqual(definition);
    expect(db.prepare("SELECT enabled,fee_pkr,collection_policy_hash,remittance_policy_hash FROM cod_configuration").get())
      .toEqual({ enabled: 0, fee_pkr: 125, collection_policy_hash: null, remittance_policy_hash: null });
    expect(db.prepare("SELECT version FROM cod_schema_migrations").all()).toEqual([{ version: "0030" }]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM d1_migrations").get()).toEqual({ count: 0 });
    expect(db.prepare("PRAGMA quick_check").all()).toEqual([{ quick_check: "ok" }]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("leaves legacy receipt/review and fulfillment writes functional after migration", () => {
    db.exec(migration);
    db.prepare("UPDATE payments SET review_state='REVIEW',submitted_at=? WHERE id='payment-pending'").run(now);
    db.prepare("UPDATE orders SET state='PAYMENT_REVIEW' WHERE id='pending'").run();
    db.prepare("UPDATE orders SET state='PACKING' WHERE id='paid' AND payment_status='PAID'").run();
    expect(db.prepare("SELECT state FROM orders WHERE id='paid'").get()).toEqual({ state: "PACKING" });
    expect(db.prepare("SELECT state FROM orders WHERE id='pending'").get()).toEqual({ state: "PAYMENT_REVIEW" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id='review'").get()).toEqual({ count: 1 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("is idempotent and separately tracks only COD without inventing the legacy ledger", () => {
    db.exec(migration);
    const before = legacySnapshot();
    const sidecarSchema = db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'cod_%' ORDER BY type,name").all();
    const marker = db.prepare("SELECT * FROM cod_schema_migrations WHERE version='0030'").get();
    db.exec(migration);
    expect(legacySnapshot()).toEqual(before);
    expect(db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'cod_%' ORDER BY type,name").all()).toEqual(sidecarSchema);
    expect(db.prepare("SELECT * FROM cod_schema_migrations WHERE version='0030'").get()).toEqual(marker);
    expect(db.prepare("SELECT COUNT(*) AS count FROM d1_migrations").get()).toEqual({ count: 0 });
  });

  it("rolls back all additive schema when a local migration transaction fails", () => {
    const before = legacySnapshot();
    db.exec("BEGIN");
    try {
      db.exec(migration);
      db.exec("INSERT INTO cod_configuration(id,enabled,fee_pkr,updated_at) VALUES('invalid',0,125,'synthetic')");
      throw new Error("expected constraint failure");
    } catch {
      db.exec("ROLLBACK");
    }
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'cod_%'").all()).toEqual([]);
    expect(legacySnapshot()).toEqual(before);
    expect(db.prepare("PRAGMA quick_check").all()).toEqual([{ quick_check: "ok" }]);
  });
});
