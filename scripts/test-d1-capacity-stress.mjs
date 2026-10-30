import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("local stress harness is isolated and emits deterministic safety metadata", () => {
  const raw = execFileSync(process.execPath, ["scripts/d1-capacity-stress.mjs"], { env: { ...process.env, GFS335_DATASET: "245" }, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const report = JSON.parse(raw);
  assert.equal(report.remoteBindings, false);
  assert.equal(report.realProviders, false);
  assert.deepEqual(report.datasets.map((entry) => [entry.dataset, entry.variant]), [[245, "pre0043"], [245, "post0043"]]);
  for (const entry of report.datasets) {
    assert.equal(entry.safety.orderCountStable, true);
    assert.equal(entry.safety.syntheticStateUpdate, true);
    assert.equal(entry.load.length, 6);
    assert.equal(entry.load.at(-1).targetRps, 100);
  }
});
