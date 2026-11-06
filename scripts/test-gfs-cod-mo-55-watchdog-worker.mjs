import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_ID, TARGET_SCRIPT, BASELINE_VERSION, CANDIDATE_VERSION,
  createRecoveryController, validateTarget
} from "./gfs-cod-mo-55-watchdog-worker.mjs";

const input = {
  accountId: ACCOUNT_ID,
  scriptName: TARGET_SCRIPT,
  baseline: BASELINE_VERSION,
  candidate: CANDIDATE_VERSION,
  startedAt: 1_000,
  deadlineAt: 2_000
};

test("HTTP surface is private and default schedule is disarmed", async () => {
  assert.equal((await (await import("./gfs-cod-mo-55-watchdog-worker.mjs")).default.fetch()).status, 404);
  assert.deepEqual(await (await import("./gfs-cod-mo-55-watchdog-worker.mjs")).default.scheduled(), { status: "DISARMED", wrote: false });
});

test("wrong account, worker, or version is rejected", () => {
  assert.throws(() => validateTarget({ ...input, accountId: "other" }), /target_not_allowlisted/);
  assert.throws(() => validateTarget({ ...input, scriptName: "gfs462-isolated-target" }), /target_not_allowlisted/);
  assert.throws(() => validateTarget({ ...input, baseline: "11111111-1111-4111-8111-111111111111" }), /version_not_allowlisted/);
});

test("disarmed state performs no writes", async () => {
  let calls = 0;
  const controller = createRecoveryController({ fetchImpl: async () => { calls += 1; } });
  assert.deepEqual(await controller.tick(), { status: "DISARMED", wrote: false });
  assert.equal(calls, 0);
});

test("deadline restores the exact baseline and is idempotent", async () => {
  let now = 1_000;
  let calls = 0;
  let writes = 0;
  const controller = createRecoveryController({ now: () => now, fetchImpl: async (_url, options = {}) => {
    calls += 1;
    if (options.method === "POST") writes += 1;
    const finalVersions = options.method === "POST" || calls >= 3 ? [
      { version_id: BASELINE_VERSION, percentage: 100 },
      { version_id: CANDIDATE_VERSION, percentage: 0 }
    ] : [
      { version_id: BASELINE_VERSION, percentage: 90 },
      { version_id: CANDIDATE_VERSION, percentage: 10 }
    ];
    return { ok: true, json: async () => ({ success: true, result: [{ versions: finalVersions }] }) };
  } });
  controller.arm(input);
  now = 2_000;
  assert.deepEqual(await controller.tick(), { status: "RESTORED", wrote: true, code: "restored" });
  assert.equal(calls, 3);
  assert.equal(writes, 1);
  assert.deepEqual(await controller.tick(), { status: "RESTORED", wrote: false });
  assert.equal(calls, 3);
});

test("failed readback is surfaced without a deployment write", async () => {
  const controller = createRecoveryController({ now: () => 2_000, fetchImpl: async () => ({ ok: false, json: async () => ({}) }) });
  controller.arm(input);
  assert.deepEqual(await controller.tick(), { status: "FAILED", wrote: false, code: "deployment_readback_rejected" });
});
