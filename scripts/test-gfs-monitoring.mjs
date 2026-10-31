import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { accessHeaders, readAccessCredentials } from "./cloudflare-access-credentials.mjs";
import { createCloudflareObservability } from "./cloudflare-observability.mjs";

const execFileAsync = promisify(execFile);
const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const ADMIN = "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev";
const EXPECTED = {
  api: { name: "getfreeseeds-api-staging", baseline: "b426ba47-1ead-4c4a-85ba-0a0b85d3e415" },
  admin: { name: "getfreeseeds-admin-staging", baseline: "494a3dce-5d52-4b66-b3ff-bef64b31b406" }
};

async function request(url, headers, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, { headers, redirect: "manual", signal: controller.signal });
    return { status: response.status, latencyMs: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

function denied(status) {
  return status === 401 || status === 403 || (status >= 300 && status < 400);
}

async function routing(worker) {
  const { stdout } = await execFileAsync(process.execPath, [WRANGLER, "deployments", "status", "--name", worker.name, "--json"], { windowsHide: true, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  const state = JSON.parse(stdout);
  const versions = Array.isArray(state.versions) ? state.versions : [];
  const baseline = versions.find((version) => version.version_id === worker.baseline);
  assert.ok(baseline, `${worker.name}:baseline_missing`);
  const nonBaselinePercent = versions.filter((version) => version.version_id !== worker.baseline).reduce((total, version) => total + Number(version.percentage || 0), 0);
  return { worker: worker.name, baselineVersion: worker.baseline, baselinePercent: Number(baseline.percentage), nonBaselinePercent };
}

const credentials = readAccessCredentials(process.env, { required: true });
const headers = accessHeaders(credentials);
const versionOverride = process.env.GFS_ADMIN_VERSION_OVERRIDE;
const adminHeaders = versionOverride ? { ...headers, "Cloudflare-Workers-Version-Overrides": `getfreeseeds-admin-staging="${versionOverride}"` } : headers;
const health = await Promise.all([1, 2, 3].map(() => request(`${ADMIN}/health`, adminHeaders)));
assert.ok(health.every((result) => result.status === 200), "authenticated_health_not_200");
const unauthenticated = await request(`${ADMIN}/health`);
const invalid = await request(`${ADMIN}/health`, { "CF-Access-Client-Id": "invalid", "CF-Access-Client-Secret": "invalid" });
assert.ok(denied(unauthenticated.status), "unauthenticated_health_not_denied");
assert.ok(denied(invalid.status), "invalid_health_not_denied");

const isolatedPaths = await Promise.all(["/orders", "/analytics", "/conversations"].map((path) => request(`${ADMIN}${path}`, adminHeaders)));
assert.ok(isolatedPaths.every((result) => denied(result.status)), "monitoring_token_reached_admin_path");

const observability = createCloudflareObservability({ accountTag: "cb5066a6d71ecdee0bd7ed8aacb4d3c2", accessCredentials: credentials });
const [apiMetrics, adminMetrics, apiRouting, adminRouting] = await Promise.all([
  observability.readMetrics(EXPECTED.api),
  observability.readMetrics(EXPECTED.admin),
  routing(EXPECTED.api),
  routing(EXPECTED.admin)
]);
assert.equal(apiRouting.baselinePercent, 100, "api_baseline_not_100");
assert.equal(apiRouting.nonBaselinePercent, 0, "api_candidate_not_0");
assert.equal(adminRouting.baselinePercent, 100, "admin_baseline_not_100");
assert.equal(adminRouting.nonBaselinePercent, 0, "admin_candidate_not_0");

console.log(JSON.stringify({
  authenticatedHealth: health,
  unauthenticated: { status: unauthenticated.status, denied: denied(unauthenticated.status) },
  invalid: { status: invalid.status, denied: denied(invalid.status) },
  isolatedPaths: isolatedPaths.map((result, index) => ({ path: ["/orders", "/analytics", "/conversations"][index], ...result, denied: denied(result.status) })),
  graphql: { api: apiMetrics, admin: adminMetrics },
  routing: { api: apiRouting, admin: adminRouting }
}));
