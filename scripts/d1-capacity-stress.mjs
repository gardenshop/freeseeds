import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";

const DATASETS = [245, 1_000, 10_000, 50_000];
const LOAD_LEVELS = [1, 5, 10, 25, 50, 100];
const LOAD_MS = 1_000;
const SYNTHETIC_NOW = "2026-10-30T12:00:00.000Z";
const MIGRATION_INDEXES = [
  "CREATE INDEX IF NOT EXISTS orders_updated_id_idx ON orders(updated_at DESC,id DESC)",
  "CREATE INDEX IF NOT EXISTS orders_recovery_candidate_idx ON orders(archived_at,payment_status,state,created_at,id)",
  "CREATE INDEX IF NOT EXISTS outbound_messages_order_kind_status_idx ON outbound_messages(order_id,kind,status,updated_at DESC,id)",
  "CREATE INDEX IF NOT EXISTS outbound_messages_updated_order_idx ON outbound_messages(updated_at DESC,order_id,id)",
  "CREATE INDEX IF NOT EXISTS outbound_messages_kind_status_key_idx ON outbound_messages(kind,status,idempotency_key)",
  "CREATE INDEX IF NOT EXISTS outbox_jobs_kind_status_available_idx ON outbox_jobs(kind,status,available_at,id)",
  "CREATE INDEX IF NOT EXISTS outbox_jobs_updated_entity_kind_idx ON outbox_jobs(updated_at DESC,entity_id,kind,id)",
  "CREATE INDEX IF NOT EXISTS payments_updated_order_idx ON payments(updated_at DESC,order_id,id)",
  "CREATE INDEX IF NOT EXISTS cod_order_details_updated_order_idx ON cod_order_details(updated_at DESC,order_id)",
  "CREATE INDEX IF NOT EXISTS payment_reminder_v2_stage_schedule_status_due_idx ON payment_reminder_v2_stages(schedule_id,status,due_at,stage_minutes)"
];

const SCHEMA = `
PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=250;
CREATE TABLE orders(id TEXT PRIMARY KEY,order_number TEXT NOT NULL,customer_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archived_at TEXT,state TEXT NOT NULL,payment_status TEXT NOT NULL);
CREATE TABLE payments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,method TEXT,review_state TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE customers(id TEXT PRIMARY KEY,wa_id TEXT NOT NULL);
CREATE TABLE whatsapp_conversations(wa_id TEXT PRIMARY KEY,state TEXT NOT NULL,last_inbound_message_id TEXT,last_inbound_at TEXT);
CREATE TABLE cod_order_details(order_id TEXT PRIMARY KEY,updated_at TEXT NOT NULL,status TEXT NOT NULL);
CREATE TABLE outbound_messages(id TEXT PRIMARY KEY,order_id TEXT,kind TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL,idempotency_key TEXT NOT NULL);
CREATE TABLE outbox_jobs(id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,entity_id TEXT,kind TEXT NOT NULL,status TEXT NOT NULL,payload_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,available_at TEXT NOT NULL,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE payment_choice_recovery_stages(order_id TEXT NOT NULL,stage_minutes INTEGER NOT NULL,status TEXT NOT NULL,due_at TEXT NOT NULL,PRIMARY KEY(order_id,stage_minutes));
CREATE TABLE payment_receipts(order_id TEXT NOT NULL,payment_id TEXT NOT NULL,PRIMARY KEY(order_id,payment_id));
CREATE TABLE payment_reminder_v2_opt_outs(customer_id TEXT,wa_id TEXT);
CREATE TABLE payment_reminder_v2_stages(schedule_id TEXT NOT NULL,status TEXT NOT NULL,due_at TEXT NOT NULL,stage_minutes INTEGER NOT NULL);
CREATE INDEX payment_choice_recovery_stage_due_idx ON payment_choice_recovery_stages(status,due_at,order_id);
CREATE INDEX orders_created_id_idx ON orders(created_at DESC,id DESC);
CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX customers_wa_idx ON customers(wa_id);
CREATE INDEX cod_order_idx ON cod_order_details(order_id);
CREATE INDEX receipts_order_idx ON payment_receipts(order_id,payment_id);
CREATE INDEX opts_customer_wa_idx ON payment_reminder_v2_opt_outs(customer_id,wa_id);
CREATE TABLE cod_schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
`;

const DELTA_SQL = `SELECT id,MAX(updated_at) AS updated_at FROM (
  SELECT id,updated_at FROM orders WHERE updated_at>? OR (updated_at=? AND id>?)
  UNION ALL SELECT order_id AS id,updated_at FROM payments WHERE updated_at>? OR (updated_at=? AND order_id>?)
  UNION ALL SELECT order_id AS id,updated_at FROM cod_order_details WHERE updated_at>? OR (updated_at=? AND order_id>?)
  UNION ALL SELECT order_id AS id,updated_at FROM outbound_messages WHERE order_id IS NOT NULL AND (updated_at>? OR (updated_at=? AND order_id>?))
  UNION ALL SELECT entity_id AS id,updated_at FROM outbox_jobs WHERE entity_id IS NOT NULL AND (updated_at>? OR (updated_at=? AND entity_id>?))
) sync_events GROUP BY id ORDER BY updated_at ASC,id ASC LIMIT 101`;

const COUNT_SQL = `SELECT COUNT(*) AS all_count,
  SUM(CASE WHEN o.state IN ('PAYMENT_PENDING','PAYMENT_REVIEW') THEN 1 ELSE 0 END) AS payment_count,
  SUM(CASE WHEN o.payment_status='PENDING' AND p.method IS NULL THEN 1 ELSE 0 END) AS no_method_count,
  SUM(CASE WHEN o.state='COD_PENDING' THEN 1 ELSE 0 END) AS cod_count
  FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.archived_at IS NULL`;

const RECOVERY_SQL = `SELECT o.id,o.created_at,p.id AS payment_id,c.wa_id,wc.last_inbound_message_id
  FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id
  JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id
  WHERE o.created_at>=? AND o.created_at<=? AND o.archived_at IS NULL
    AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND o.payment_status='PENDING'
    AND p.method IS NULL AND p.review_state='PENDING' AND wc.state IN ('PAYMENT_METHOD','PAYMENT_PENDING')
    AND wc.last_inbound_message_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id)
    AND NOT EXISTS(SELECT 1 FROM payment_choice_recovery_stages s WHERE s.order_id=o.id)
  ORDER BY o.created_at,o.id LIMIT 100`;

const PAGE_SQL = "SELECT id,order_number,state,payment_status,updated_at FROM orders WHERE archived_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 50";
const FILTER_SQL = "SELECT id,order_number,state,payment_status FROM orders WHERE state=? AND payment_status=? ORDER BY updated_at DESC,id DESC LIMIT 100";
const EXPORT_SQL = "SELECT id,order_number,state,payment_status,created_at FROM orders ORDER BY created_at DESC,id DESC LIMIT 100";

function dbOpen(path) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

function seed(db, count) {
  const insertOrder = db.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)");
  const insertPayment = db.prepare("INSERT INTO payments VALUES(?,?,?,?,?)");
  const insertCustomer = db.prepare("INSERT INTO customers VALUES(?,?)");
  const insertConversation = db.prepare("INSERT INTO whatsapp_conversations VALUES(?,?,?,?)");
  const insertCod = db.prepare("INSERT INTO cod_order_details VALUES(?,?,?)");
  const insertOutbound = db.prepare("INSERT INTO outbound_messages VALUES(?,?,?,?,?,?)");
  const insertOutbox = db.prepare("INSERT INTO outbox_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  const insertStage = db.prepare("INSERT INTO payment_choice_recovery_stages VALUES(?,?,?,?)");
  const insertReminder = db.prepare("INSERT INTO payment_reminder_v2_stages VALUES(?,?,?,?)");
  db.exec("BEGIN");
  for (let i = 0; i < count; i += 1) {
    const n = String(i).padStart(6, "0");
    const id = `order-${n}`;
    const customer = `customer-${n}`;
    const wa = `synthetic-wa-${n}`;
    const created = `2026-10-${String((i % 29) + 1).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00.000Z`;
    const updated = i % 7 === 0 ? SYNTHETIC_NOW : created;
    const state = i % 11 === 0 ? "COD_PENDING" : i % 3 === 0 ? "PAYMENT_PENDING" : "DETAILS_COMPLETED";
    const paymentStatus = state === "COD_PENDING" ? "COD_PENDING" : "PENDING";
    insertCustomer.run(customer, wa);
    insertConversation.run(wa, state === "DETAILS_COMPLETED" ? "PAYMENT_METHOD" : "PAYMENT_PENDING", `inbound-${n}`, created);
    insertOrder.run(id, `SYNTH-${n}`, customer, created, updated, i % 97 === 0 ? created : null, state, paymentStatus);
    insertPayment.run(`payment-${n}`, id, i % 11 === 0 ? "COD" : null, state === "COD_PENDING" ? "COD_PENDING" : "PENDING", updated);
    if (state === "COD_PENDING") insertCod.run(id, updated, "PENDING");
    insertOutbound.run(`outbound-${n}`, id, "CONVERSATION_REPLY", i % 13 === 0 ? "DELIVERED" : "SENT", updated, `reply-${n}`);
    insertOutbox.run(`outbox-${n}`, `job-${n}`, id, "WHATSAPP_PAYMENT_CHOICE_RECOVERY", i % 17 === 0 ? "SENT" : "PENDING", "{}", 0, created, null, created, updated);
    if (i % 5 === 0 && state !== "COD_PENDING") insertStage.run(id, 15, "PENDING", "2026-10-30T11:00:00.000Z");
    insertReminder.run(`schedule-${n}`, "PENDING", "2026-10-30T11:00:00.000Z", 15);
  }
  db.exec("COMMIT");
}

function addMigration0043(db) {
  for (const sql of MIGRATION_INDEXES) db.exec(sql);
  db.prepare("INSERT INTO cod_schema_migrations VALUES('0043',?)").run(SYNTHETIC_NOW);
}

function timed(db, sql, args = []) {
  const start = performance.now();
  const rows = db.prepare(sql).all(...args);
  return { ms: performance.now() - start, rows: rows.length };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

function planDetails(db, sql) {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row) => String(row.detail));
}

function benchmark(db, count) {
  const start = "2026-10-01T00:00:00.000Z";
  const end = SYNTHETIC_NOW;
  const deltaArgs = Array(5).fill(["2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "order-"]).flat();
  const cases = {
    adminPage: [PAGE_SQL, []],
    adminCounts: [COUNT_SQL, []],
    adminFilter: [FILTER_SQL, ["PAYMENT_PENDING", "PENDING"]],
    adminExport: [EXPORT_SQL, []],
    orderChanges: [DELTA_SQL, deltaArgs],
    recoveryCandidates: [RECOVERY_SQL, [start, end]]
  };
  const results = {};
  for (const [name, [sql, args]] of Object.entries(cases)) {
    const samples = [];
    let rows = 0;
    for (let i = 0; i < (count >= 50_000 ? 5 : 10); i += 1) {
      const result = timed(db, sql, args);
      samples.push(result.ms);
      rows = result.rows;
    }
    results[name] = { p50Ms: percentile(samples, 0.50), p95Ms: percentile(samples, 0.95), rows, samples: samples.length };
  }
  results.plans = { orderChanges: planDetails(db, DELTA_SQL.replaceAll("?", "'2026-10-29T00:00:00Z'")), recoveryCandidates: planDetails(db, RECOVERY_SQL.replaceAll("?", "'2026-10-30T12:00:00Z'")) };
  return results;
}

function runLocalSafetyChecks(db) {
  const before = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
  const tx = db.prepare("UPDATE orders SET updated_at=? WHERE id=?");
  const payment = db.prepare("UPDATE payments SET updated_at=? WHERE order_id=?");
  db.exec("BEGIN");
  tx.run(SYNTHETIC_NOW, "order-000000");
  payment.run(SYNTHETIC_NOW, "order-000000");
  db.exec("COMMIT");
  const after = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
  return { orderCountStable: Number(before) === Number(after), syntheticStateUpdate: true };
}

async function loadWorker() {
  const db = new DatabaseSync(workerData.path);
  db.exec("PRAGMA busy_timeout=250; PRAGMA journal_mode=WAL;");
  const latencies = [];
  let errors = 0;
  const started = performance.now();
  for (let i = 0; i < workerData.quota; i += 1) {
    const due = workerData.startedAt + (i / Math.max(1, workerData.quota)) * workerData.durationMs;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const t = performance.now();
    try {
      if (i % 4 === 0) db.prepare(COUNT_SQL).all();
      else if (i % 4 === 1) db.prepare(DELTA_SQL).all(...Array(5).fill(["2026-10-29T00:00:00.000Z", "2026-10-29T00:00:00.000Z", "order-"]).flat());
      else if (i % 4 === 2) db.prepare(RECOVERY_SQL).all("2026-10-01T00:00:00.000Z", SYNTHETIC_NOW);
      else {
        db.exec("BEGIN");
        db.prepare("UPDATE orders SET updated_at=? WHERE id=?").run(SYNTHETIC_NOW, `order-${String(i % workerData.orderCount).padStart(6, "0")}`);
        db.prepare("UPDATE payments SET updated_at=? WHERE order_id=?").run(SYNTHETIC_NOW, `order-${String(i % workerData.orderCount).padStart(6, "0")}`);
        db.exec("COMMIT");
      }
      latencies.push(performance.now() - t);
    } catch {
      errors += 1;
    }
  }
  db.close();
  parentPort.postMessage({ latencies, errors, elapsedMs: performance.now() - started });
}

async function loadRamp(path, orderCount, targetRps) {
  const workers = Math.min(4, Math.max(1, targetRps));
  const quota = Math.ceil((targetRps * LOAD_MS / 1_000) / workers);
  const startedAt = performance.now() + 25;
  const results = await Promise.all(Array.from({ length: workers }, () => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { path, orderCount, quota, startedAt, durationMs: LOAD_MS } });
    worker.once("message", resolve);
    worker.once("error", reject);
  })));
  const latencies = results.flatMap((r) => r.latencies);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const elapsedMs = Math.max(1, performance.now() - startedAt);
  return { targetRps, concurrency: workers, attempted: latencies.length + errors, achievedRps: Number(((latencies.length / elapsedMs) * 1_000).toFixed(2)), p50Ms: Number(percentile(latencies, 0.50).toFixed(3)), p95Ms: Number(percentile(latencies, 0.95).toFixed(3)), p99Ms: Number(percentile(latencies, 0.99).toFixed(3)), errors, errorRate: Number((errors / Math.max(1, latencies.length + errors)).toFixed(4)) };
}

async function runVariant(count, indexed) {
  const path = join(tmpdir(), `gfs335-${process.pid}-${randomUUID()}.sqlite`);
  const db = dbOpen(path);
  seed(db, count);
  if (indexed) addMigration0043(db);
  const benchmarkResult = benchmark(db, count);
  const safety = runLocalSafetyChecks(db);
  db.close();
  const load = [];
  for (const target of LOAD_LEVELS) load.push(await loadRamp(path, count, target));
  const cleanup = new DatabaseSync(path);
  cleanup.close();
  try { unlinkSync(path); } catch {}
  return { dataset: count, variant: indexed ? "post0043" : "pre0043", benchmark: benchmarkResult, safety, load };
}

async function main() {
  const requested = Number(process.env.GFS335_DATASET || 0);
  const datasets = requested && DATASETS.includes(requested) ? [requested] : DATASETS;
  const output = { harness: "local-sqlite-only", remoteBindings: false, realProviders: false, generatedAt: new Date().toISOString(), datasets: [] };
  for (const count of datasets) {
    output.datasets.push(await runVariant(count, false));
    output.datasets.push(await runVariant(count, true));
  }
  console.log(JSON.stringify(output, null, 2));
}

if (isMainThread) main().catch((error) => { console.error(error); process.exitCode = 1; });
else loadWorker();
