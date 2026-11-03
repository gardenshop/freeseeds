import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createCloudflareObservability, sumMetricRows, summarizeGraphqlErrors, validateMetricSnapshot } from "./cloudflare-observability.mjs";
import { accessHeaders, readAccessCredentials } from "./cloudflare-access-credentials.mjs";
import { readAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";

const worker = { name: "getfreeseeds-admin-staging", healthUrl: "https://admin.example.test" };

test("aggregates genuine GraphQL rows and preserves zero errors as measured", () => {
  assert.deepEqual(sumMetricRows([
    { dimensions: { datetime: "2026-10-30T20:00:00Z" }, sum: { requests: 3, errors: 0 } },
    { dimensions: { datetime: "2026-10-30T20:01:00Z" }, sum: { requests: 4, errors: 1 } }
  ]), { source: "cloudflare_graphql", requests: 7, errors: 1, latestAt: "2026-10-30T20:01:00Z" });
});

test("empty or malformed metrics are unavailable, never fabricated as zero", () => {
  assert.throws(() => sumMetricRows([]), (error) => error.code === "graphql_empty_rows");
  assert.throws(() => sumMetricRows([{ sum: { requests: 1, errors: null } }]), (error) => error.code === "graphql_invalid_response");
});

test("fails closed for missing, malformed, stale and nonzero-error metric snapshots", () => {
  const valid = { source: "cloudflare_graphql", accountTag: "account", worker: "worker", requests: 1, errors: 0, latestAt: "2026-11-02T20:00:00Z" };
  const options = { accountTag: "account", workerName: "worker", now: new Date("2026-11-02T20:01:00Z") };
  assert.throws(() => validateMetricSnapshot({ ...valid, latestAt: null }, options), (error) => error.code === "graphql_timestamp_missing");
  assert.throws(() => validateMetricSnapshot({ ...valid, latestAt: "not-a-timestamp" }, options), (error) => error.code === "graphql_timestamp_invalid");
  assert.throws(() => validateMetricSnapshot({ ...valid, latestAt: "2026-11-02T19:00:00Z" }, options), (error) => error.code === "graphql_metrics_stale");
  assert.throws(() => validateMetricSnapshot({ ...valid, latestAt: "2026-11-02T20:02:01Z" }, options), (error) => error.code === "graphql_metrics_future");
  assert.throws(() => validateMetricSnapshot({ ...valid, errors: 1 }, options), (error) => error.code === "graphql_metrics_errors");
  assert.throws(() => validateMetricSnapshot({ ...valid, accountTag: "other" }, options), (error) => error.code === "graphql_account_mismatch");
  assert.throws(() => validateMetricSnapshot({ ...valid, worker: "other" }, options), (error) => error.code === "graphql_worker_mismatch");
});

test("classifies GraphQL HTTP200 errors, HTTP failures, invalid JSON and timeouts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gfs-observability-errors-"));
  const tokenPath = path.join(directory, "wrangler.toml");
  try {
    await writeFile(tokenPath, 'oauth_token = "synthetic-token"\n');
    const cases = [
      [{ ok: true, status: 200, json: async () => ({ errors: [{ message: "redacted" }] }) }, "graphql_http200_errors"],
      [{ ok: false, status: 429, json: async () => ({}) }, "graphql_http_failure"],
      [{ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }, "graphql_invalid_response"],
      [new DOMException("aborted", "AbortError"), "graphql_timeout"]
    ];
    for (const [responseOrError, code] of cases) {
      const observability = createCloudflareObservability({ accountTag: "account", tokenPath, fetchImpl: async () => {
        if (responseOrError instanceof Error || responseOrError?.name === "AbortError") throw responseOrError;
        return responseOrError;
      } });
      await assert.rejects(() => observability.readMetrics(worker), (error) => error.code === code);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("classifies HTTP400 GraphQL causes without retaining response text", () => {
  assert.deepEqual(summarizeGraphqlErrors({ errors: [{ message: "Variable $start of type string used where Time is required" }] }), {
    count: 1,
    categories: ["schema_variable_type"]
  });
  assert.deepEqual(summarizeGraphqlErrors({ errors: [{ message: "forbidden account analytics" }, { message: "query cost exceeded" }] }), {
    count: 2,
    categories: ["authorization", "query_limit"]
  });
  assert.deepEqual(summarizeGraphqlErrors({ errors: [{ message: "contains-token-shaped-text-that-is-not-retained" }] }), {
    count: 1,
    categories: ["unknown"]
  });
});

test("retains only a sanitized cause category for HTTP400", async () => {
  const observability = createCloudflareObservability({
    accountTag: "account",
    analyticsToken: "synthetic-token",
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ errors: [{ message: "Variable $start of type string used where Time is required" }] }) })
  });
  await assert.rejects(() => observability.readMetrics(worker), (error) => error.code === "graphql_http_failure" && error.diagnostic.causeCode === "schema_variable_type" && !JSON.stringify(error).includes("Time is required"));
});

test("uses Cloudflare lowercase string scalars and avoids the schema HTTP400", async () => {
  const now = new Date("2026-11-03T10:01:00Z");
  const observability = createCloudflareObservability({
    accountTag: "account",
    analyticsToken: "synthetic-token",
    now: () => now,
    fetchImpl: async (_url, options) => {
      const { query } = JSON.parse(options.body);
      if (/\$accountTag: String!|\$scriptName: String!/.test(query)) {
        return { ok: false, status: 400, json: async () => ({ errors: [{ message: "schema validation failed" }] }) };
      }
      assert.match(query, /\$accountTag: string!/);
      assert.match(query, /\$scriptName: string!/);
      return { ok: true, status: 200, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ dimensions: { datetime: "2026-11-03T10:00:00Z", scriptName: worker.name }, sum: { requests: 1, errors: 0 } }] }] } } }) };
    }
  });
  const metrics = await observability.readMetrics(worker);
  assert.equal(metrics.errors, 0);
  assert.equal(metrics.worker, worker.name);
});

test("credential bridge validates both values and creates only Access headers", () => {
  assert.equal(readAccessCredentials({}), null);
  assert.throws(() => readAccessCredentials({ GFS_ACCESS_CLIENT_ID: "id" }, { required: true }), /access_credentials_unavailable/);
  assert.deepEqual(accessHeaders({ clientId: "id", clientSecret: "secret" }), {
    "CF-Access-Client-Id": "id",
    "CF-Access-Client-Secret": "secret"
  });
});

test("dedicated Analytics token is process-scoped and preferred over Wrangler OAuth", async () => {
  assert.equal(readAnalyticsToken({}), null);
  assert.throws(() => readAnalyticsToken({}, { required: true }), /analytics_credentials_unavailable/);
  assert.equal(readAnalyticsToken({ GFS_ANALYTICS_API_TOKEN: " dedicated-token " }), "dedicated-token");

  let authorization = null;
  const observability = createCloudflareObservability({
    accountTag: "verified-account",
    analyticsToken: "dedicated-token",
    tokenPath: "missing-wrangler-config",
    now: () => new Date("2026-11-02T13:01:00Z"),
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return { ok: true, status: 200, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ dimensions: { datetime: "2026-11-02T13:00:00Z", scriptName: "getfreeseeds-admin-staging" }, sum: { requests: 1, errors: 0 } }] }] } } }) };
    }
  });
  const metrics = await observability.readMetrics(worker);
  assert.equal(authorization, "Bearer dedicated-token");
  assert.deepEqual(metrics, { source: "cloudflare_graphql", requests: 1, errors: 0, latestAt: "2026-11-02T13:00:00Z", accountTag: "verified-account", worker: "getfreeseeds-admin-staging", freshnessMs: 60000 });
});

test("reads HTTP health and authenticated GraphQL metrics without exposing the token", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gfs-observability-"));
  const tokenPath = path.join(directory, "wrangler.toml");
  try {
    await writeFile(tokenPath, 'oauth_token = "synthetic-secret-not-logged"\n');
    const calls = [];
    const observability = createCloudflareObservability({
      accountTag: "account",
      tokenPath,
      accessCredentials: { clientId: "access-id", clientSecret: "access-secret" },
      now: () => new Date("2026-10-30T20:02:00Z"),
      fetchImpl: async (url, options) => {
        calls.push({ url, authorization: options?.headers?.Authorization, accessId: options?.headers?.["CF-Access-Client-Id"], accessSecret: options?.headers?.["CF-Access-Client-Secret"] });
        if (url.endsWith("/health")) return { status: 200 };
        return { ok: true, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ dimensions: { datetime: "2026-10-30T20:01:00Z", scriptName: "getfreeseeds-admin-staging" }, sum: { requests: 2, errors: 0 } }] }] } } }) };
      }
    });
    const health = await observability.readHealth(worker);
    const metrics = await observability.readMetrics(worker);
    assert.equal(health.httpStatus, 200);
    assert.deepEqual(metrics, { source: "cloudflare_graphql", requests: 2, errors: 0, latestAt: "2026-10-30T20:01:00Z", accountTag: "account", worker: "getfreeseeds-admin-staging", freshnessMs: 60000 });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].authorization, "Bearer synthetic-secret-not-logged");
    assert.equal(calls[0].accessId, "access-id");
    assert.equal(calls[0].accessSecret, "access-secret");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
