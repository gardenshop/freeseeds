import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runCanary } from "./canary-deadline-controller.mjs";

function fakeClock() {
  let value = 0;
  return {
    now: () => value,
    sleep: async (ms) => { value += ms; },
    advance: (ms) => { value += ms; }
  };
}

function traffic(kind = "baseline") {
  if (kind === "candidate") return { apiCandidatePercent: 1, adminCandidatePercent: 1, apiBaselinePercent: 99, adminBaselinePercent: 99, api5xx: 0, admin5xx: 0 };
  return { apiCandidatePercent: 0, adminCandidatePercent: 0, apiBaselinePercent: 100, adminBaselinePercent: 100, api5xx: 0, admin5xx: 0 };
}

async function withLock(testBody) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gfs-canary-"));
  try {
    return await testBody(path.join(directory, "controller.lock"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function baseOptions(clock, lockPath, overrides = {}) {
  let exposed = false;
  const events = [];
  return {
    durationMs: 100,
    restoreMarginMs: 20,
    pollIntervalMs: 10,
    pollTimeoutMs: 20,
    commandTimeoutMs: 20,
    lockPath,
    now: clock.now,
    sleep: clock.sleep,
    audit: (event) => events.push(event),
    execute: async (action) => {
      if (action === "expose_candidate") exposed = true;
      if (action === "restore_baseline") exposed = false;
    },
    readTraffic: async () => exposed ? traffic("candidate") : traffic(),
    ...overrides,
    _events: events
  };
}

test("normal run restores before the absolute cap and verifies final routing", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const options = baseOptions(clock, lockPath);
  const result = await runCanary(options);
  assert.equal(result.ok, true);
  assert.equal(result.strictCapCompliant, true);
  assert.ok(result.verifiedAtMs <= result.hardDeadlineMs);
  assert.ok(options._events.some((event) => event.event === "restore_verified"));
}));

test("slow routing fails closed and still attempts rollback", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const options = baseOptions(clock, lockPath, {
    execute: async (action) => {
      if (action === "expose_candidate") await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  const result = await runCanary(options);
  assert.equal(result.ok, false);
  assert.equal(result.code, "command_timeout");
  assert.equal(result.rollbackVerified, true);
}));

test("command timeout rolls back and does not leave the lock", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const result = await runCanary(baseOptions(clock, lockPath, {
    execute: async (action) => {
      if (action === "expose_candidate") await new Promise(() => {});
    }
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "command_timeout");
  const second = await runCanary(baseOptions(clock, lockPath));
  assert.equal(second.ok, true);
}));

test("failed rollback is surfaced as a fail-closed result", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  let reads = 0;
  const result = await runCanary(baseOptions(clock, lockPath, {
    readTraffic: async () => {
      reads += 1;
      return reads === 1 ? traffic("baseline") : { ...traffic("baseline"), apiCandidatePercent: 1 };
    },
    execute: async (action) => {
      if (action === "restore_baseline") throw new Error("synthetic rollback failure");
    }
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "rollback_failed");
}));

test("process interruption invokes bounded rollback and verifies it", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const interruption = new AbortController();
  const options = baseOptions(clock, lockPath, {
    signal: interruption.signal,
    sleep: async (ms) => {
      interruption.abort(new Error("synthetic interruption"));
      clock.advance(ms);
    }
  });
  const result = await runCanary(options);
  assert.equal(result.ok, false);
  assert.equal(result.code, "interrupted");
  assert.equal(result.rollbackVerified, true);
}));

test("a monitored provider 5xx triggers immediate restore", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  let reads = 0;
  let restored = false;
  const result = await runCanary(baseOptions(clock, lockPath, {
    execute: async (action) => {
      if (action === "restore_baseline") restored = true;
    },
    readTraffic: async () => {
      reads += 1;
      if (restored) return traffic("baseline");
      if (reads === 1) return traffic("baseline");
      if (reads === 2) return traffic("candidate");
      return { ...traffic("candidate"), admin5xx: 1 };
    }
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "provider_5xx");
  assert.equal(result.rollbackVerified, true);
}));

test("delayed routing is bounded and cannot claim a canary after the margin", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const result = await runCanary(baseOptions(clock, lockPath, {
    readTraffic: async () => traffic("baseline")
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "routing_not_observed");
  assert.equal(result.rollbackVerified, true);
}));

test("overlapping execution fails closed without touching the existing lock", async () => withLock(async (lockPath) => {
  const firstAbort = new AbortController();
  const first = runCanary({
    ...baseOptions(fakeClock(), lockPath),
    signal: firstAbort.signal,
    execute: async (action) => {
      if (action === "expose_candidate") await new Promise(() => {});
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await runCanary(baseOptions(fakeClock(), lockPath));
  assert.equal(second.ok, false);
  assert.equal(second.code, "overlap_lock");
  firstAbort.abort(new Error("synthetic cleanup"));
  const firstResult = await first;
  assert.equal(firstResult.rollbackVerified, true);
}));

test("audit output is allowlisted and contains no command or customer data", async () => withLock(async (lockPath) => {
  const clock = fakeClock();
  const events = [];
  const result = await runCanary(baseOptions(clock, lockPath, { audit: (event) => events.push(event) }));
  assert.equal(result.ok, true);
  for (const event of events) {
    assert.deepEqual(Object.keys(event).filter((key) => key !== "event").sort(), Object.keys(event).filter((key) => key !== "event").sort());
    assert.equal("command" in event, false);
    assert.equal("customer" in event, false);
    assert.equal("token" in event, false);
  }
}));
