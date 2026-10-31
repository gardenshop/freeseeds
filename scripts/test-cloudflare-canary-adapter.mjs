import assert from "node:assert/strict";
import { test } from "node:test";
import { createCloudflareCanaryAdapter } from "./cloudflare-canary-adapter.mjs";

const workers = {
  api: { name: "api", baseline: "api-base", candidate: "api-candidate" },
  admin: { name: "admin", baseline: "admin-base", candidate: "admin-candidate" }
};

function status(worker, baseline, candidate) {
  return JSON.stringify({ versions: [
    { version_id: worker.baseline, percentage: baseline },
    { version_id: worker.candidate, percentage: candidate }
  ] });
}

const measured = {
  readHealth: async () => ({ httpStatus: 200, latencyMs: 12 }),
  readMetrics: async () => ({ source: "cloudflare_graphql", requests: 10, errors: 0 })
};

test("uses shell-free argv and preserves spaced deployment messages", async () => {
  const calls = [];
  const adapter = createCloudflareCanaryAdapter({ ...measured, workers, runCommand: async (args) => {
    calls.push(args);
    if (args[0] === "deployments") return status(args[3] === "api" ? workers.api : workers.admin, 100, 0);
    return "";
  } });
  await adapter.execute("expose_candidate");
  assert.deepEqual(calls[0], ["versions", "deploy", "api-base@99", "api-candidate@1", "--name", "api", "--message", "GFS-334 api 1 percent canary", "--yes"]);
  assert.equal(calls[1][5], "admin");
  assert.equal(calls[1][7], "GFS-334 admin 1 percent canary");
});

test("deploys API then Admin sequentially for expose and restore", async () => {
  const order = [];
  const adapter = createCloudflareCanaryAdapter({ ...measured, workers, runCommand: async (args) => {
    if (args[0] === "versions") order.push(`${args[5]}:${args[3]}`);
    return args[0] === "deployments" ? status(args[3] === "api" ? workers.api : workers.admin, 100, 0) : "";
  } });
  await adapter.execute("expose_candidate");
  await adapter.execute("restore_baseline");
  assert.deepEqual(order, ["api:api-candidate@1", "admin:admin-candidate@1", "api:api-candidate@0", "admin:admin-candidate@0"]);
});

test("API scope deploys only API while retaining Admin readback", async () => {
  const calls = [];
  const adapter = createCloudflareCanaryAdapter({ ...measured, scope: "api", workers, runCommand: async (args) => {
    calls.push(args);
    if (args[0] === "deployments") return status(args[3] === "api" ? workers.api : workers.admin, args[3] === "api" ? 99 : 100, 0);
    return "";
  } });
  await adapter.execute("expose_candidate");
  assert.equal(calls.filter((args) => args[0] === "versions").length, 1);
  assert.equal(calls[0][5], "api");
  const traffic = await adapter.readTraffic();
  assert.equal(traffic.apiBaselinePercent, 99);
  assert.equal(traffic.adminBaselinePercent, 100);
});

test("Admin scope supports a bounded 10 percent canary while retaining API frozen", async () => {
  const calls = [];
  const adapter = createCloudflareCanaryAdapter({ ...measured, scope: "admin", targetCandidatePercent: 10, workers, runCommand: async (args) => {
    calls.push(args);
    if (args[0] === "deployments") return status(args[3] === "api" ? workers.api : workers.admin, args[3] === "api" ? 100 : 90, args[3] === "api" ? 0 : 10);
    return "";
  } });
  await adapter.execute("expose_candidate");
  assert.deepEqual(calls[0], ["versions", "deploy", "admin-base@90", "admin-candidate@10", "--name", "admin", "--message", "GFS-334 admin 10 percent canary", "--yes"]);
  const traffic = await adapter.readTraffic();
  assert.equal(traffic.apiCandidatePercent, 0);
  assert.equal(traffic.adminCandidatePercent, 10);
});

test("reads exact version percentages and keeps health fields fail-closed", async () => {
  const adapter = createCloudflareCanaryAdapter({ ...measured, workers, runCommand: async (args) => {
    if (args[0] !== "deployments") return "";
    return status(args[3] === "api" ? workers.api : workers.admin, 99, 1);
  } });
  await assert.doesNotReject(async () => {
    const traffic = await adapter.readTraffic();
    assert.deepEqual(traffic, { apiBaselinePercent: 99, apiCandidatePercent: 1, adminBaselinePercent: 99, adminCandidatePercent: 1, health: { source: "cloudflare_graphql_http", api: { httpStatus: 200, latencyMs: 12, requests: 10, errors: 0 }, admin: { httpStatus: 200, latencyMs: 12, requests: 10, errors: 0 } } });
  });
});

test("rejects unknown deployed versions", async () => {
  const adapter = createCloudflareCanaryAdapter({ ...measured, workers, runCommand: async (args) => {
    if (args[0] !== "deployments") return "";
    return JSON.stringify({ versions: [{ version_id: "unknown", percentage: 100 }] });
  } });
  await assert.rejects(() => adapter.readTraffic(), (error) => error.code === "monitor_retry_exhausted" && error.diagnostic.causeCode === "unknown_routing_version");
});

test("retries one transient monitoring read without using stale data", async () => {
  let metricReads = 0;
  const adapter = createCloudflareCanaryAdapter({
    ...measured,
    workers,
    monitorRetryDelayMs: 0,
    readMetrics: async () => {
      metricReads += 1;
      if (metricReads === 1) throw new Error("transient_graphql_error");
      return { source: "cloudflare_graphql", requests: 11, errors: 0 };
    },
    runCommand: async (args) => args[0] === "deployments" ? status(args[3] === "api" ? workers.api : workers.admin, 100, 0) : ""
  });
  const traffic = await adapter.readTraffic();
  assert.equal(metricReads, 4);
  assert.equal(traffic.health.api.requests, 11);
  assert.equal(traffic.health.admin.requests, 11);
});

test("fails closed after bounded monitoring retries are exhausted", async () => {
  let reads = 0;
  const adapter = createCloudflareCanaryAdapter({
    ...measured,
    workers,
    monitorRetryDelayMs: 0,
    readMetrics: async () => { reads += 1; throw new Error("persistent_graphql_error"); },
    runCommand: async (args) => args[0] === "deployments" ? status(args[3] === "api" ? workers.api : workers.admin, 100, 0) : ""
  });
  await assert.rejects(() => adapter.readTraffic(), (error) => error.code === "monitor_retry_exhausted" && error.diagnostic.causeCode === "controller_exception");
  assert.equal(reads, 4);
});
