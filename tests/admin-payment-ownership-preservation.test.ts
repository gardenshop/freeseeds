import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const access = { "cf-access-authenticated-user-email": "admin@example.test" };
let sqlite: DatabaseSync;

function makeDb(beforeBatch?: () => void | Promise<void>): D1Database {
  let batchQueue = Promise.resolve<unknown>(undefined);
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
      await beforeBatch?.();
      const result = batchQueue.then(async () => {
        sqlite.exec("BEGIN");
        try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
        catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      });
      batchQueue = result.catch(() => undefined);
      return result;
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

async function review(env: Parameters<typeof app.fetch>[1]) {
  const response = await app.fetch(new Request("https://admin.example.test/api/payment-methods", { headers: access }), env);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const data = await response.json() as { paymentMethods: Array<{ method: string; reviewSnapshot: string }> };
  return data.paymentMethods.find((method) => method.method === "JAZZCASH")!.reviewSnapshot;
}

async function approve(env: Parameters<typeof app.fetch>[1], body: Record<string, unknown>) {
  const reviewSnapshot = Object.hasOwn(body, "reviewSnapshot") ? body.reviewSnapshot : await review(env);
  return app.fetch(new Request("https://admin.example.test/api/payment-methods/JAZZCASH/beneficiary-approval", { method: "POST", headers: await headers(env), body: JSON.stringify({ ...body, reviewSnapshot }) }), env);
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

  describe("synthetic NON-PAYABLE beneficiary approval", () => {
    let env: Parameters<typeof app.fetch>[1] & { DB: D1Database };
    const hash = "a".repeat(64);
    beforeEach(() => {
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
    sqlite.prepare("INSERT INTO payment_qr_assets VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("JAZZCASH", "synthetic/JAZZCASH.png", hash, "image/png", 64, 1, 1, 1, 1, 0, null);
    sqlite.prepare(`INSERT INTO payment_methods
      (id,method,display_name,recipient_name,till_id,instructions,instructions_ur,reference_instruction,reference_instruction_ur,
       heading,heading_ur,qr_caption,qr_caption_ur,short_instructions,short_instructions_ur,receipt_instructions,receipt_instructions_ur,
       payment_help_copy,payment_help_copy_ur,status_copy,status_copy_ur,enabled,sort_order,qr_owner_verified,qr_r2_key,qr_sha256,qr_mime_type,qr_size_bytes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      "synthetic-jc", "JAZZCASH", "JazzCash", "SYNTHETIC BENEFICIARY", "TEST-TILL-001",
      "Pay {amount} to {recipientName}, TILL {tillId}, order {orderNumber}.", "{recipientName} کو PKR {amount} TILL {tillId} پر ادا کریں، آرڈر {orderNumber}۔",
      "Reference {orderNumber}", "حوالہ {orderNumber}", "JazzCash Payment", "جاز کیش ادائیگی", "Test QR", "ٹیسٹ کیو آر",
      "Test instruction", "ٹیسٹ ہدایت", "Send test receipt", "ٹیسٹ رسید بھیجیں", "Test help", "ٹیسٹ مدد", "Test pending", "ٹیسٹ زیر التوا",
      0, 10, 0, "synthetic/JAZZCASH.png", hash, "image/png", 64
    );
    env = { DB: makeDb(), ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as typeof env;
    });

    it("records one explicit evidence review for the current QR and enables only that method", async () => {
    const rejected = await approve(env, { evidenceRef: "PROVIDER-RECORD-SYNTHETIC-001" });
    expect(rejected.status).toBe(400);
    expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0 });

    const reviewSnapshot = await review(env);
    const approved = await approve(env, { evidenceRef: "PROVIDER-RECORD-SYNTHETIC-001", confirmed: true, reviewSnapshot });
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ ok: true, method: "JAZZCASH", enabled: true, reviewer: "admin@example.test", qrSha256: hash });
    expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 1, qr_owner_verified: 1 });
    expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 1, independent_evidence_ref: "PROVIDER-RECORD-SYNTHETIC-001" });
    const audit = sqlite.prepare("SELECT action,actor_id,metadata_json,created_at FROM audit_log WHERE action='PAYMENT_BENEFICIARY_APPROVED_AND_ENABLED'").get() as { action: string; actor_id: string; metadata_json: string; created_at: string };
    expect(audit).toMatchObject({ action: "PAYMENT_BENEFICIARY_APPROVED_AND_ENABLED", actor_id: "admin@example.test" });
    expect(JSON.parse(audit.metadata_json)).toMatchObject({ method: "JAZZCASH", evidenceRef: "PROVIDER-RECORD-SYNTHETIC-001", qrSha256: hash, reviewSnapshot, enabledAfterApproval: true });
    expect(audit.created_at).toBeTruthy();

    const duplicate = await approve(env, { evidenceRef: "PROVIDER-RECORD-SYNTHETIC-002", confirmed: true });
    expect(duplicate.status).toBe(409);
    const changed = await save(env, { tillId: "TEST-TILL-002" });
    expect(changed.status).toBe(200);
    expect(sqlite.prepare("SELECT enabled,qr_owner_verified,till_id FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0, till_id: "TEST-TILL-002" });
    expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
    });

    it.each(["recipient_name", "till_id", "qr_sha256", "qr_r2_key"])("rejects a stale reviewed %s before approval", async (column) => {
      const reviewSnapshot = await review(env);
      const value = column === "qr_sha256" ? "b".repeat(64) : "SYNTHETIC-CHANGED";
      sqlite.prepare(`UPDATE payment_methods SET ${column}=?`).run(value);
      if (column === "qr_sha256") sqlite.prepare("UPDATE payment_qr_assets SET derivative_sha256=?").run(value);
      if (column === "qr_r2_key") sqlite.prepare("UPDATE payment_qr_assets SET derivative_r2_key=?").run(value);
      const response = await approve(env, { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true, reviewSnapshot });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "PAYMENT_BENEFICIARY_REVIEW_STALE" });
      expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0 });
      expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_BENEFICIARY_APPROVED_AND_ENABLED'").get()).toEqual({ count: 0 });
    });

    it.each(["recipient", "copy", "metadata", "asset"])("rejects a %s change between preflight and transactional approval", async (change) => {
      env.DB = makeDb(() => {
        if (change === "recipient") sqlite.exec("UPDATE payment_methods SET till_id='SYNTHETIC-CHANGED'");
        if (change === "copy") sqlite.exec("UPDATE payment_methods SET instructions_ur=NULL");
        if (change === "metadata") sqlite.exec("UPDATE payment_methods SET qr_size_bytes=65; UPDATE payment_qr_assets SET derivative_size_bytes=65");
        if (change === "asset") sqlite.exec("UPDATE payment_qr_assets SET scan_pass=0");
      });
      const response = await approve(env, { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true });
      expect(response.status).toBe(409);
      expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0 });
      expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='PAYMENT_BENEFICIARY_APPROVED_AND_ENABLED'").get()).toEqual({ count: 0 });
    });

    it.each([true, false])("allows exactly one concurrent review and success audit (same reference: %s)", async (sameReference) => {
      let arrivals = 0;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => { release = resolve; });
      env.DB = makeDb(async () => { if (++arrivals === 2) release(); await ready; });
      const reviewSnapshot = await review(env);
      const responses = await Promise.all([
        approve(env, { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true, reviewSnapshot }),
        approve(env, { evidenceRef: sameReference ? "SYNTHETIC-PROVIDER-001" : "SYNTHETIC-PROVIDER-002", confirmed: true, reviewSnapshot })
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 1, qr_owner_verified: 1 });
      const audits = sqlite.prepare("SELECT metadata_json FROM audit_log WHERE action='PAYMENT_BENEFICIARY_APPROVED_AND_ENABLED'").all();
      expect(audits).toHaveLength(1);
      const asset = sqlite.prepare("SELECT independent_evidence_ref FROM payment_qr_assets").get();
      expect(JSON.parse(String(audits[0].metadata_json)).evidenceRef).toBe(asset!.independent_evidence_ref);
    });

    it("rolls back evidence when enabling changes zero rows", async () => {
      sqlite.exec("CREATE TRIGGER synthetic_ignore_enable BEFORE UPDATE OF enabled ON payment_methods WHEN NEW.enabled=1 BEGIN SELECT RAISE(IGNORE); END");
      const response = await approve(env, { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true });
      expect(response.status).toBe(409);
      expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0 });
      expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    });

    it("rolls back evidence and enablement when the audit insert fails", async () => {
      sqlite.exec("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END");
      const response = await approve(env, { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true });
      expect(response.status).toBe(409);
      expect(sqlite.prepare("SELECT enabled,qr_owner_verified FROM payment_methods").get()).toEqual({ enabled: 0, qr_owner_verified: 0 });
      expect(sqlite.prepare("SELECT independent_ownership_verified,independent_evidence_ref FROM payment_qr_assets").get()).toEqual({ independent_ownership_verified: 0, independent_evidence_ref: null });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    });

    it("requires a snapshot, independent confirmation, Access identity and CSRF", async () => {
      const body = { evidenceRef: "SYNTHETIC-PROVIDER-001", confirmed: true, reviewSnapshot: await review(env) };
      expect((await approve(env, { ...body, reviewSnapshot: undefined })).status).toBe(409);
      expect((await approve(env, { ...body, confirmed: false })).status).toBe(400);
      for (const requestHeaders of [{}, access]) {
        const response = await app.fetch(new Request("https://admin.example.test/api/payment-methods/JAZZCASH/beneficiary-approval", { method: "POST", headers: requestHeaders, body: JSON.stringify(body) }), env);
        expect(response.status).toBe(403);
      }
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    });

    it("renders reviewed destination details and sends the loaded snapshot in valid JavaScript", async () => {
      const response = await app.fetch(new Request("https://admin.example.test/payment-beneficiary-review", { headers: access }), env);
      const html = await response.text();
      const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
      expect(() => new Function(script)).not.toThrow();
      expect(script).toContain("esc(m.recipientName)");
      expect(script).toContain("esc(m.tillId)");
      expect(script).toContain("reviewSnapshot:reviewed.reviewSnapshot");
      expect(script).toContain("[data-confirm]').checked=false");
    });
  });
});
