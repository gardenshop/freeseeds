import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const access = { "cf-access-authenticated-user-email": "admin@example.test" };
let sqlite: DatabaseSync;

function makeDb(): D1Database {
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
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    }
  } as unknown as D1Database;
}

async function headers(env: Parameters<typeof app.fetch>[1]) {
  const response = await app.fetch(new Request("https://admin.example.test/api/csrf", { headers: access }), env);
  const { csrfToken } = await response.json() as { csrfToken: string };
  return { ...access, "content-type": "application/json", origin: "https://admin.example.test", cookie: `__Host-gfs_admin_csrf=${csrfToken}`, "x-csrf-token": csrfToken };
}

async function save(env: Parameters<typeof app.fetch>[1], body: Record<string, unknown>) {
  return app.fetch(new Request("https://admin.example.test/api/payment-methods/JAZZCASH", { method: "POST", headers: await headers(env), body: JSON.stringify(body) }), env);
}

describe("payment copy saves preserve verified ownership until recipient changes", () => {
  afterEach(() => sqlite?.close());

  it("preserves a verified method on copy-only save and revokes it on recipient change", async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE payment_methods (
        id TEXT, method TEXT PRIMARY KEY, display_name TEXT, recipient_name TEXT, till_id TEXT,
        instructions TEXT, instructions_ur TEXT, reference_instruction TEXT, reference_instruction_ur TEXT,
        heading TEXT, heading_ur TEXT, qr_caption TEXT, qr_caption_ur TEXT, short_instructions TEXT, short_instructions_ur TEXT,
        receipt_instructions TEXT, receipt_instructions_ur TEXT, payment_help_copy TEXT, payment_help_copy_ur TEXT,
        status_copy TEXT, status_copy_ur TEXT, enabled INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 10,
        updated_at TEXT, updated_by TEXT, qr_owner_verified INTEGER NOT NULL DEFAULT 0,
        qr_r2_key TEXT, qr_sha256 TEXT, qr_mime_type TEXT, qr_size_bytes INTEGER
      );
      CREATE TABLE payment_qr_assets (
        method TEXT, derivative_r2_key TEXT, derivative_sha256 TEXT, derivative_mime_type TEXT, derivative_size_bytes INTEGER,
        active INTEGER, decoder_agreement INTEGER, payload_match INTEGER, scan_pass INTEGER,
        independent_ownership_verified INTEGER, independent_evidence_ref TEXT
      );
      CREATE TABLE audit_log (
        id TEXT, action TEXT, actor_type TEXT, actor_id TEXT, entity_type TEXT, entity_id TEXT,
        correlation_id TEXT, metadata_json TEXT, created_at TEXT
      );
    `);
    sqlite.exec(readFileSync("migrations/0022_payment_qr_owner_guard.sql", "utf8"));
    sqlite.exec(readFileSync("migrations/0024_reverify_qr_on_recipient_change.sql", "utf8"));
    sqlite.prepare("INSERT INTO payment_qr_assets VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("JAZZCASH", "synthetic/JAZZCASH.png", "synthetic-hash", "image/png", 64, 1, 1, 1, 1, 1, "SYNTHETIC_TEST_EVIDENCE");
    sqlite.prepare(`INSERT INTO payment_methods
      (id,method,display_name,recipient_name,till_id,instructions,instructions_ur,reference_instruction,reference_instruction_ur,
       heading,heading_ur,qr_caption,qr_caption_ur,short_instructions,short_instructions_ur,receipt_instructions,receipt_instructions_ur,
       payment_help_copy,payment_help_copy_ur,status_copy,status_copy_ur,enabled,sort_order,qr_owner_verified,qr_r2_key,qr_sha256,qr_mime_type,qr_size_bytes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      "synthetic-jc", "JAZZCASH", "JazzCash", "SYNTHETIC BENEFICIARY", "TEST-TILL-001",
      "Pay {amount} to {recipientName}, TILL {tillId}, order {orderNumber}.", "{recipientName} کو PKR {amount} TILL {tillId} پر ادا کریں، آرڈر {orderNumber}۔",
      "Reference {orderNumber}", "حوالہ {orderNumber}", "JazzCash Payment", "جاز کیش ادائیگی", "Test QR", "ٹیسٹ کیو آر",
      "Test instruction", "ٹیسٹ ہدایت", "Send test receipt", "ٹیسٹ رسید بھیجیں", "Test help", "ٹیسٹ مدد", "Test pending", "ٹیسٹ زیر التوا",
      1, 10, 1, "synthetic/JAZZCASH.png", "synthetic-hash", "image/png", 64
    );
    expect(sqlite.prepare(`SELECT EXISTS(SELECT 1 FROM payment_qr_assets qa JOIN payment_methods pm ON qa.method=pm.method
      WHERE qa.method='JAZZCASH' AND qa.derivative_r2_key=pm.qr_r2_key AND qa.derivative_sha256=pm.qr_sha256
      AND qa.derivative_mime_type=pm.qr_mime_type AND qa.derivative_size_bytes=pm.qr_size_bytes AND qa.active=1
      AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1
      AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'') AS valid`).get()).toEqual({ valid: 1 });
    expect(sqlite.prepare("SELECT qr_owner_verified,qr_r2_key FROM payment_methods WHERE method='JAZZCASH'").get()).toEqual({ qr_owner_verified: 1, qr_r2_key: "synthetic/JAZZCASH.png" });
    const env = { DB: makeDb(), ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as Parameters<typeof app.fetch>[1];

    const copySave = await save(env, { heading: "JazzCash Revised Heading" });
    expect(copySave.status).toBe(200);
    expect(await copySave.json()).toMatchObject({ ok: true, configured: true, enabled: true, qrOwnerVerified: true });
    expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods WHERE method='JAZZCASH'").get()).toEqual({ enabled: 1, qr_owner_verified: 1 });
    expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets WHERE method='JAZZCASH'").get()).toEqual({ independent_ownership_verified: 1, independent_evidence_ref: "SYNTHETIC_TEST_EVIDENCE" });

    const recipientChange = await save(env, { tillId: "TEST-TILL-CHANGED" });
    expect(recipientChange.status).toBe(200);
    expect(await recipientChange.json()).toMatchObject({ ok: true, configured: false, enabled: false, qrOwnerVerified: false, reverificationRequired: true });
    expect(sqlite.prepare("SELECT enabled,qr_owner_verified,till_id FROM payment_methods WHERE method='JAZZCASH'").get()).toEqual({ enabled: 0, qr_owner_verified: 0, till_id: "TEST-TILL-CHANGED" });
    expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets WHERE method='JAZZCASH'").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_RECIPIENT_CHANGED_REVERIFICATION_REQUIRED'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_RECIPIENT_CHANGE_REVERIFICATION_STARTED'").get()).toEqual({ count: 1 });
  });
});
