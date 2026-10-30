import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createCloudflareObservability, sumMetricRows } from "./cloudflare-observability.mjs";

const worker = { name: "getfreeseeds-admin-staging", healthUrl: "https://admin.example.test" };

test("aggregates genuine GraphQL rows and preserves zero errors as measured", () => {
  assert.deepEqual(sumMetricRows([
    { dimensions: { datetime: "2026-10-30T20:00:00Z" }, sum: { requests: 3, errors: 0 } },
    { dimensions: { datetime: "2026-10-30T20:01:00Z" }, sum: { requests: 4, errors: 1 } }
  ]), { source: "cloudflare_graphql", requests: 7, errors: 1, latestAt: "2026-10-30T20:01:00Z" });
});

test("empty or malformed metrics are unavailable, never fabricated as zero", () => {
  assert.throws(() => sumMetricRows([]), /metrics_unavailable/);
  assert.throws(() => sumMetricRows([{ sum: { requests: 1, errors: null } }]), /metrics_unavailable/);
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
      now: () => new Date("2026-10-30T20:02:00Z"),
      fetchImpl: async (url, options) => {
        calls.push({ url, authorization: options?.headers?.Authorization });
        if (url.endsWith("/health")) return { status: 200 };
        return { ok: true, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ dimensions: { datetime: "2026-10-30T20:01:00Z" }, sum: { requests: 2, errors: 0 } }] }] } } }) };
      }
    });
    const health = await observability.readHealth(worker);
    const metrics = await observability.readMetrics(worker);
    assert.equal(health.httpStatus, 200);
    assert.deepEqual(metrics, { source: "cloudflare_graphql", requests: 2, errors: 0, latestAt: "2026-10-30T20:01:00Z" });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].authorization, "Bearer synthetic-secret-not-logged");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
