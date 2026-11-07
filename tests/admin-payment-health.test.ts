import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../apps/admin/src/index";
import { configuredPaymentMethodNames } from "../packages/core/src/payments";

type Method = "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER";
const access = { "cf-access-authenticated-user-email": "admin@example.test" };
let sqlite: DatabaseSync;
let db: D1Database;
let prepare: ReturnType<typeof vi.fn>;
let env: Parameters<typeof app.fetch>[1];
const getQr = vi.fn(() => { throw new Error("Health must not retrieve private QR objects"); });

function enableSynthetic(method: Method = "JAZZCASH") {
  const key = `synthetic-nonpayable/${method}.png`;
  const hash = "a".repeat(64);
  sqlite.prepare(`UPDATE payment_methods SET recipient_name=?,till_id=?,qr_r2_key=?,qr_sha256=?,qr_mime_type='image/png',qr_size_bytes=8,
    instructions=?,instructions_ur=?,reference_instruction=?,reference_instruction_ur=?,heading_ur=?,receipt_instructions=?,receipt_instructions_ur=? WHERE method=?`)
    .run(`NON-PAYABLE ${method}`, `TEST-ONLY-${method}`, key, hash,
      "NON-PAYABLE {amount} {recipientName} {tillId}", "صرف ٹیسٹ {amount} {recipientName} {tillId}",
      "SYNTHETIC {orderNumber}", "ٹیسٹ {orderNumber}", "صرف ٹیسٹ", "NON-PAYABLE TEST RECEIPT", "صرف ٹیسٹ رسید", method);
  sqlite.prepare(`INSERT INTO payment_qr_assets(id,method,source_r2_key,source_sha256,source_mime_type,source_size_bytes,
    derivative_r2_key,derivative_sha256,derivative_mime_type,derivative_size_bytes,derivative_width,derivative_height,payload_sha256,
    decoder_agreement,payload_match,scan_pass,decoder_versions,extractor_version,independent_ownership_verified,independent_evidence_ref,created_at,created_by)
    VALUES(?,?,?,?,'image/png',8,?,?,'image/png',8,1,1,?,1,1,1,'SYNTHETIC-NOT-SCANNABLE','SYNTHETIC',1,'SYNTHETIC-NON-PAYABLE','2026-10-26','TEST_FIXTURE')`)
    .run(`synthetic-${method}`, method, key, hash, key, hash, hash);
  sqlite.prepare("UPDATE payment_methods SET qr_owner_verified=1,enabled=1 WHERE method=?").run(method);
}

async function health(expected: boolean) {
  const before = sqlite.prepare("SELECT total_changes() AS n").get()!.n;
  const response = await app.fetch(new Request("https://admin.example.test/health", { headers: access }), env);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, service: "getfreeseeds-admin", state: "LOCAL", paymentConfigured: expected });
  expect(sqlite.prepare("SELECT total_changes() AS n").get()!.n).toBe(before);
  expect(getQr).not.toHaveBeenCalled();
}

describe("Admin payment health uses bilingual verified dynamic configuration", () => {
  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync("migrations").filter((file) => /^00(?:0[1-9]|[12]\d)_.*\.sql$/.test(file)).sort()) {
      sqlite.exec(readFileSync(`migrations/${name}`, "utf8"));
    }
    sqlite.exec("UPDATE payment_configuration SET advance_amount_pkr=NULL WHERE id=1");
    prepare = vi.fn((sql: string) => {
      if (!/^SELECT\b/i.test(sql.trim())) throw new Error("Health must issue SELECT statements only");
      let values: SQLInputValue[] = [];
      const statement = {
        bind: (...args: SQLInputValue[]) => { values = args; return statement; },
        first: async <T>() => sqlite.prepare(sql).get(...values) as T | undefined,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] })
      };
      return statement;
    });
    db = { prepare } as unknown as D1Database;
    env = { DB: db, RECEIPTS: { get: getQr }, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as unknown as Parameters<typeof app.fetch>[1];
    getQr.mockClear();
  });
  afterEach(() => sqlite.close());

  it.each<Method>(["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"])("accepts %s without a fixed advance", async (method) => {
    enableSynthetic(method);
    await health(true);
  });

  it("accepts an eligible method when the fixed-amount row is absent", async () => {
    enableSynthetic();
    sqlite.exec("DELETE FROM payment_configuration");
    await health(true);
  });

  it("keeps ANY-method semantics instead of requiring all three", async () => {
    enableSynthetic("EASYPAISA");
    expect(sqlite.prepare("SELECT count(*) AS n FROM payment_methods WHERE enabled=1").get()!.n).toBe(1);
    await health(true);
  });

  it("does not use a positive fixed amount to make disabled methods eligible", async () => {
    sqlite.exec("UPDATE payment_configuration SET advance_amount_pkr=999 WHERE id=1");
    await health(false);
  });

  it.each([
    "DELETE FROM payment_qr_assets",
    "UPDATE payment_qr_assets SET active=0",
    "UPDATE payment_qr_assets SET method='EASYPAISA'",
    "UPDATE payment_qr_assets SET derivative_r2_key='synthetic-wrong-key'",
    "UPDATE payment_qr_assets SET decoder_agreement=0",
    "UPDATE payment_qr_assets SET payload_match=0",
    "UPDATE payment_qr_assets SET scan_pass=0",
    "UPDATE payment_qr_assets SET independent_ownership_verified=0",
    "UPDATE payment_qr_assets SET independent_evidence_ref=NULL",
    "UPDATE payment_qr_assets SET independent_evidence_ref='   '",
    "UPDATE payment_methods SET qr_owner_verified=0,enabled=0 WHERE method='JAZZCASH'"
  ])("rejects stale/unverified eligibility: %s", async (invalidate) => {
    enableSynthetic();
    sqlite.exec("UPDATE payment_configuration SET advance_amount_pkr=999 WHERE id=1");
    sqlite.exec(invalidate);
    await health(false);
  });

  it.each([
    ["recipient_name", "   "], ["instructions", "   "], ["receipt_instructions", "   "],
    ["instructions", "NON-PAYABLE {recipientName} {tillId}"], ["reference_instruction", "MISSING ORDER PLACEHOLDER"],
    ["heading_ur", "   "], ["instructions_ur", "   "], ["reference_instruction_ur", "   "],
    ["receipt_instructions_ur", "   "], ["instructions_ur", "NON-PAYABLE {recipientName} {tillId}"],
    ["reference_instruction_ur", "MISSING ORDER PLACEHOLDER"]
  ])("rejects incomplete bilingual %s", async (column, value) => {
    enableSynthetic();
    sqlite.exec("UPDATE payment_configuration SET advance_amount_pkr=999 WHERE id=1");
    sqlite.prepare(`UPDATE payment_methods SET ${column}=? WHERE method='JAZZCASH'`).run(value);
    await health(false);
  });

  it("does not combine English from one method with Urdu from another", async () => {
    enableSynthetic("JAZZCASH");
    enableSynthetic("EASYPAISA");
    sqlite.exec("UPDATE payment_configuration SET advance_amount_pkr=999 WHERE id=1; UPDATE payment_methods SET heading_ur='' WHERE method='JAZZCASH'; UPDATE payment_methods SET receipt_instructions='' WHERE method='EASYPAISA'");
    await health(false);
  });

  it("preserves the helper's English-default behavior and explicit amount validation", async () => {
    enableSynthetic();
    sqlite.exec("UPDATE payment_methods SET heading_ur='' WHERE method='JAZZCASH'");
    expect(await configuredPaymentMethodNames(db)).toHaveLength(1);
    expect(await configuredPaymentMethodNames(db, 250)).toHaveLength(1);
    for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await configuredPaymentMethodNames(db, amount)).toEqual([]);
    }
  });

  it("reports false without a DB binding", async () => {
    env = { ...env, DB: undefined } as unknown as typeof env;
    await health(false);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests before any database query", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/health"), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
    expect(prepare).not.toHaveBeenCalled();
    expect(getQr).not.toHaveBeenCalled();
  });

  it("allows Cloudflare Service Auth only for GET health and not Admin paths", async () => {
    const accessExecution = { access: { getIdentity: async () => ({}) } } as unknown as ExecutionContext;
    const healthResponse = await app.fetch(new Request("https://admin.example.test/health"), env, accessExecution);
    expect(healthResponse.status).toBe(200);
    const ordersResponse = await app.fetch(new Request("https://admin.example.test/orders"), env, accessExecution);
    expect(ordersResponse.status).toBe(403);
    expect(await ordersResponse.json()).toEqual({ error: "ADMIN_ACCESS_REQUIRED" });
  });
});
