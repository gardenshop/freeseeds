import test from "node:test";
import assert from "node:assert/strict";
import { createWatchdogWorker, RESTORE_START_MS, HARD_DEADLINE_MS, TARGET_SCRIPT } from "./gfs464-isolated-watchdog-worker.mjs";

const state = { canaryId: "gfs464-proof-1", target: TARGET_SCRIPT, baseline: "11111111-1111-4111-8111-111111111111", candidate: "22222222-2222-4222-8222-222222222222", startedAt: 1000, restoreAt: 1000 + RESTORE_START_MS, deadlineAt: 1000 + HARD_DEADLINE_MS };

test("restores only the allowlisted isolated target and verifies readback", async () => {
  const calls = [];
  const current = [{ version_id: state.baseline, percentage: 90 }, { version_id: state.candidate, percentage: 10 }];
  const fetchImpl = async (_url, options = {}) => {
    calls.push(options.method ?? "GET");
    if (options.method === "POST") current.splice(0, current.length, { version_id: state.baseline, percentage: 100 }, { version_id: state.candidate, percentage: 0 });
    return new Response(JSON.stringify({ result: [{ versions: current }] }), { status: 200 });
  };
  const result = await createWatchdogWorker({ fetchImpl }).restore(state, { CLOUDFLARE_ACCOUNT_ID: "account", TARGET_API_TOKEN: "secret" });
  assert.equal(result.code, "restored");
  assert.deepEqual(calls, ["GET", "POST", "GET"]);
});

test("fails closed before any write when the target readback is not allowlisted", async () => {
  let writes = 0;
  const fetchImpl = async (_url, options = {}) => { if (options.method === "POST") writes += 1; return new Response(JSON.stringify({ result: [{ versions: [{ version_id: state.baseline, percentage: 100 }] }] }), { status: 200 }); };
  await assert.rejects(() => createWatchdogWorker({ fetchImpl }).restore(state, { CLOUDFLARE_ACCOUNT_ID: "account", TARGET_API_TOKEN: "secret" }), { code: "target_readback_rejected" });
  assert.equal(writes, 0);
});
