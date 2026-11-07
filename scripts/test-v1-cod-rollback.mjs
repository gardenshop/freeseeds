import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";

// Local synthetic acceptance of the actual rollback SOURCE, not a remote Worker rollback.
// Pass an unchanged detached checkout of this exact baseline. Never point this at a live DB.
const baseline = "cf01f444500415b1f22a64730674caca1c286006";
const root = process.env.GFS_LEGACY_ROOT;
if (!root) throw new Error("GFS_LEGACY_ROOT must name an unchanged local V1 checkout");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), baseline);
assert.equal(execFileSync("git", ["diff", "HEAD", "--name-only"], { cwd: root, encoding: "utf8" }).trim(), "");
globalThis.crypto ??= webcrypto;

async function legacyApp(service) {
  const result = await build({ absWorkingDir: root, entryPoints: [`apps/${service}/src/index.ts`], bundle: true, format: "esm", platform: "neutral", write: false });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`)).default;
}
const [api, admin] = await Promise.all([legacyApp("api"), legacyApp("admin")]);
const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync(path.join(root, "migrations")).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
  sqlite.exec(readFileSync(path.join(root, "migrations", file), "utf8"));
}
const now = new Date().toISOString();
const sender = "923000000000";
const phoneId = "synthetic-canonical-phone-id";
const secret = "synthetic-webhook-secret";
sqlite.prepare(`INSERT INTO customers(id,wa_id,full_name,delivery_address,nearby_place,city,contact_number,normalized_phone,normalized_address_hash,created_at,updated_at)
  VALUES('synthetic-customer',?,'SYNTHETIC DO NOT SHIP','Synthetic test lane','Synthetic park','Synthetic city','03000000000','923000000000','synthetic-hash',?,?)`).run(sender, now, now);
for (const [id, state, paymentStatus, reviewState] of [["legacy", "PAYMENT_PENDING", "PENDING", "PENDING"], ["cod", "COD_PENDING", "COD_PENDING", "COD_PENDING"]]) {
  sqlite.prepare(`INSERT INTO orders(id,order_number,customer_id,offer_code,pack_quantity,seed_price,delivery_fee,total_payable,state,payment_status,created_at,updated_at)
    VALUES(?,?,'synthetic-customer','SYNTHETIC',5,0,250,250,?,?,?,?)`).run(id, `SYNTHETIC-${id}`, state, paymentStatus, now, now);
  sqlite.prepare(`INSERT INTO payments(id,order_id,expected_amount,review_state,created_at,updated_at) VALUES(?,?,250,?,?,?)`).run(`payment-${id}`, id, reviewState, now, now);
}
sqlite.exec(readFileSync("migrations/0030_cod_v1_compat.sql", "utf8"));
sqlite.prepare(`INSERT INTO cod_order_details(order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,status,created_at,updated_at)
  VALUES('cod',250,125,375,'COD_PENDING',?,?)`).run(now, now);
sqlite.prepare(`INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,created_at,updated_at)
  VALUES('synthetic-conversation',?,'COD_PENDING','{"orderId":"cod","orderNumber":"SYNTHETIC-cod","language":"en"}',?,?)`).run(sender, now, now);

function prepare(sql, args = []) {
  return {
    bind: (...values) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } })
  };
}
const DB = { prepare, batch: async (statements) => {
  sqlite.exec("BEGIN");
  try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
  catch (error) { sqlite.exec("ROLLBACK"); throw error; }
} };
const env = { DB, ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL", WHATSAPP_CHECKOUT_MODE: "guided", WHATSAPP_PROVIDER: "meta", META_PROVIDER_ENABLED: "true", META_PHONE_NUMBER_ID: phoneId, META_APP_SECRET: secret, META_ACCESS_TOKEN: "synthetic-token", META_CAPI_ENABLED: "false" };
const identity = { "cf-access-authenticated-user-email": env.ADMIN_EMAIL };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Local rollback test must never make network requests"); };
try {
  await test("actual V1 Admin can still read legacy advance orders with additive schema", async () => {
    const response = await admin.fetch(new Request("https://admin.example.test/api/orders?tab=all", { headers: identity }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.orders.some((order) => order.id === "legacy" && order.totalPayablePkr === 250 && order.paymentStatus === "PENDING"));
  });
  await test("actual V1 Admin cannot dispatch, assign tracking, or label a held COD_PENDING order", async () => {
    const csrf = await admin.fetch(new Request("https://admin.example.test/api/csrf", { headers: identity }), env);
    const { csrfToken } = await csrf.json();
    const headers = { ...identity, origin: "https://admin.example.test", "content-type": "application/json", cookie: `__Host-gfs_admin_csrf=${csrfToken}`, "x-csrf-token": csrfToken };
    for (const [route, body] of [["transition", { from: "COD_PENDING", to: "PACKING", confirmation: "SYNTHETIC-cod" }], ["tracking", { trackingNumber: "SYNTHETIC-TRACK", confirmation: "SYNTHETIC-cod" }]]) {
      const response = await admin.fetch(new Request(`https://admin.example.test/api/orders/cod/${route}`, { method: "POST", headers, body: JSON.stringify(body) }), env);
      assert.ok([400, 409].includes(response.status));
    }
    const label = await admin.fetch(new Request("https://admin.example.test/api/orders/cod/shipping-label?format=4x6", { headers: identity }), env);
    assert.equal(label.status, 409);
    assert.equal(sqlite.prepare("SELECT state FROM orders WHERE id='cod'").get().state, "COD_PENDING");
  });
  await test("actual V1 signed receipt handler cannot attach an advance receipt to retained COD", async () => {
    // Isolate COD association from the separate legacy unpaid fixture without deleting either order.
    sqlite.prepare("UPDATE orders SET state='CANCELLED' WHERE id='legacy'").run();
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages: [{ from: sender, id: "synthetic-cod-image", type: "image", image: { id: "synthetic-media", mime_type: "image/png" } }] } }] }] });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))).toString("hex");
    const response = await api.fetch(new Request("https://api.example.test/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` }, body: payload }), env);
    assert.equal(response.status, 200);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_receipts WHERE order_id='cod'").get().count, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM outbox_jobs WHERE entity_id='cod'").get().count, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM outbound_messages WHERE order_id='cod'").get().count, 0);
  });
  await test("retained schema remains valid after old-source requests", () => {
    assert.deepEqual(sqlite.prepare("PRAGMA quick_check").all().map((row) => ({ ...row })), [{ quick_check: "ok" }]);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  });
} finally {
  globalThis.fetch = originalFetch;
  sqlite.close();
}
console.log("LOCAL ONLY: legacy financial/hold guards tested; V1 cannot render COD-specific totals/reconciliation. Use a COD-compatible intake-OFF version for rollback after COD intake.");
