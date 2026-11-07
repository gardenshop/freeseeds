import test from "node:test";
import assert from "node:assert/strict";
import {
  createIsolatedWatchdog,
  HARD_DEADLINE_MS,
  ISOLATED_BASELINE,
  ISOLATED_CANDIDATE,
  ISOLATED_TARGET,
  RESTORE_START_MS
} from "./gfs462-isolated-watchdog.mjs";

function request(canaryId = "gfs462-proof-1", startedAt = 0) {
  return {
    canaryId,
    target: ISOLATED_TARGET,
    baseline: ISOLATED_BASELINE,
    candidate: ISOLATED_CANDIDATE,
    startedAt,
    restoreAt: startedAt + RESTORE_START_MS,
    deadlineAt: startedAt + HARD_DEADLINE_MS
  };
}

function harness() {
  let current = { target: ISOLATED_TARGET, baseline: ISOLATED_BASELINE, candidate: ISOLATED_CANDIDATE, baselinePercent: 90, candidatePercent: 10 };
  let clock = 0;
  let restores = 0;
  const watchdog = createIsolatedWatchdog({
    now: () => clock,
    readTarget: async () => current,
    restoreTarget: async ({ target, baseline, candidate }) => {
      assert.equal(target, ISOLATED_TARGET);
      assert.equal(baseline, ISOLATED_BASELINE);
      assert.equal(candidate, ISOLATED_CANDIDATE);
      restores += 1;
      current = { target, baseline, candidate, baselinePercent: 100, candidatePercent: 0 };
    }
  });
  return { watchdog, setTime: (value) => { clock = value; }, getRestores: () => restores };
}

test("arms one immutable isolated canary and restores at the six-minute boundary", async () => {
  const h = harness();
  assert.equal((await h.watchdog.arm(request())).code, "armed");
  assert.equal((await h.watchdog.arm(request())).code, "already_armed");
  h.setTime(RESTORE_START_MS - 1);
  assert.equal((await h.watchdog.restoreIfDue()).code, "not_due");
  h.setTime(RESTORE_START_MS);
  const result = await h.watchdog.restoreIfDue();
  assert.equal(result.code, "restored");
  assert.equal(result.state.restoredAt, RESTORE_START_MS);
  assert.equal(h.getRestores(), 1);
  assert.equal((await h.watchdog.restoreIfDue()).code, "already_restored");
  assert.equal(h.getRestores(), 1);
});

test("rejects stale, production, and allowlist-conflicting requests", async () => {
  const h = harness();
  await assert.rejects(() => h.watchdog.arm({ ...request("bad target"), target: "getfreeseeds-admin-staging" }), { code: "isolated_target_required" });
  await assert.rejects(() => h.watchdog.arm({ ...request("bad versions"), candidate: "e44703c3" }), { code: "version_allowlist_mismatch" });
  await h.watchdog.arm(request("gfs462-proof-1"));
  await assert.rejects(() => h.watchdog.arm(request("gfs462-proof-2")), { code: "immutable_canary_conflict" });
});

test("fails closed when independent readback does not prove baseline", async () => {
  let clock = RESTORE_START_MS;
  const watchdog = createIsolatedWatchdog({
    now: () => clock,
    readTarget: async () => ({ target: ISOLATED_TARGET, baseline: ISOLATED_BASELINE, candidate: ISOLATED_CANDIDATE, baselinePercent: 90, candidatePercent: 10 }),
    restoreTarget: async () => {}
  });
  await watchdog.arm(request());
  const result = await watchdog.restoreIfDue("readback-test");
  assert.equal(result.ok, false);
  assert.equal(result.code, "restore_readback_mismatch");
  assert.equal(result.state.status, "failed");
  assert.equal(clock <= HARD_DEADLINE_MS, true);
});

