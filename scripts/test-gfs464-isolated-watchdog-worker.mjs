import test from "node:test";
import assert from "node:assert/strict";
import {
  createWatchdogWorker,
  HARD_DEADLINE_MS,
  RESTORE_START_MS,
  RETRY_DELAYS_MS,
  TARGET_SCRIPT,
  WatchdogState
} from "./gfs464-isolated-watchdog-worker.mjs";

const state = {
  canaryId: "gfs464-proof-1",
  target: TARGET_SCRIPT,
  baseline: "11111111-1111-4111-8111-111111111111",
  candidate: "22222222-2222-4222-8222-222222222222",
  startedAt: 1000,
  restoreAt: 1000 + RESTORE_START_MS,
  deadlineAt: 1000 + HARD_DEADLINE_MS
};
const env = { CLOUDFLARE_ACCOUNT_ID: "account", TARGET_API_TOKEN: "secret" };
const deployment = (versions) => new Response(JSON.stringify({ result: [{ versions }] }), { status: 200 });

test("restores only the allowlisted isolated target, uses the deployment API, and is idempotent", async () => {
  const calls = [];
  let current = [{ version_id: state.baseline, percentage: 90 }, { version_id: state.candidate, percentage: 10 }];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "POST") current = [{ version_id: state.baseline, percentage: 100 }, { version_id: state.candidate, percentage: 0 }];
    return deployment(current);
  };
  const worker = createWatchdogWorker({ fetchImpl });
  assert.equal((await worker.restore(state, env)).code, "restored");
  assert.equal((await worker.restore(state, env)).code, "already_restored");
  assert.deepEqual(calls.map(({ options }) => options.method ?? "GET"), ["GET", "POST", "GET", "GET"]);
  assert.match(calls[1].options.body, /"strategy":"percentage"/);
  assert.match(calls[1].options.body, /11111111-1111-4111-8111-111111111111/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret");
  assert.match(calls[0].url, /scripts\/gfs462-isolated-target\/deployments$/);
});

test("fails closed before any write when target readback is not allowlisted", async () => {
  let writes = 0;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "POST") writes += 1;
    return deployment([{ version_id: state.baseline, percentage: 100 }]);
  };
  await assert.rejects(() => createWatchdogWorker({ fetchImpl }).restore(state, env), { code: "target_readback_rejected" });
  assert.equal(writes, 0);
});

function storageHarness(initial) {
  let value = initial;
  const alarms = [];
  return {
    storage: {
      async get() { return value; },
      async put(_key, next) { value = structuredClone(next); },
      async setAlarm(at) { alarms.push(at); }
    },
    get value() { return value; },
    alarms
  };
}

test("retries recoverable restore failures and then proves completion", async () => {
  let now = state.restoreAt;
  let attempts = 0;
  const h = storageHarness({ ...state, status: "armed", restoreAttempts: 0 });
  const watchdog = new WatchdogState(h, env, {
    now: () => now,
    restoreWorker: { async restore() { attempts += 1; if (attempts === 1) { const e = new Error("temporary"); e.code = "target_readback_unavailable"; e.retryable = true; throw e; } return { ok: true, code: "restored" }; } }
  });
  await watchdog.alarm();
  assert.equal(h.value.status, "armed");
  assert.equal(h.value.nextRetryAt, state.restoreAt + RETRY_DELAYS_MS[0]);
  assert.deepEqual(h.alarms, [state.restoreAt + RETRY_DELAYS_MS[0]]);
  now = h.value.nextRetryAt;
  await watchdog.alarm();
  assert.equal(h.value.status, "restored");
  assert.equal(h.value.restoreAttempts, 2);
});

test("fails at the hard deadline and does not retry non-recoverable failures", async () => {
  let now = state.deadlineAt;
  const h = storageHarness({ ...state, status: "armed", restoreAttempts: 1 });
  const watchdog = new WatchdogState(h, env, { now: () => now, restoreWorker: { async restore() { throw Object.assign(new Error("bad"), { code: "target_restore_rejected", retryable: false }); } } });
  await watchdog.alarm();
  assert.equal(h.value.status, "failed");
  assert.equal(h.value.failureCode, "deadline_missed");
  assert.equal(h.alarms.length, 0);

  now = state.restoreAt;
  const retryH = storageHarness({ ...state, status: "armed", restoreAttempts: 0 });
  const retryWatchdog = new WatchdogState(retryH, env, { now: () => now, restoreWorker: { async restore() { throw Object.assign(new Error("bad"), { code: "target_restore_rejected", retryable: false }); } } });
  await retryWatchdog.alarm();
  assert.equal(retryH.value.status, "failed");
  assert.equal(retryH.alarms.length, 0);
});
