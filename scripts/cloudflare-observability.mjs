import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { accessHeaders, readAccessCredentials } from "./cloudflare-access-credentials.mjs";
import { readAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";
import { diagnosticError } from "./canary-diagnostics.mjs";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const DEFAULT_METRICS_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_INGESTION_LATENCY_MS = 5 * 60 * 1000;
const DEFAULT_FUTURE_SKEW_MS = 60 * 1000;
const WORKERS_QUERY = `query Workers($accountTag: string!, $start: Time!, $end: Time!, $scriptName: string!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    workersInvocationsAdaptive(limit: 100, filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }) {
      dimensions { datetime scriptName status }
      sum { requests errors }
    }
  } }
}`;

function defaultTokenPath() {
  return process.env.WRANGLER_CONFIG_FILE ?? path.join(os.homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml");
}

async function readOAuthToken(filePath) {
  let source;
  try { source = await readFile(filePath, "utf8"); } catch { throw new Error("metrics_auth_unavailable"); }
  const match = source.match(/^oauth_token\s*=\s*"([^"]+)"\s*$/m);
  if (!match?.[1]) throw new Error("metrics_auth_unavailable");
  return match[1];
}

function sumMetricRows(rows, { expectedScriptName } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw diagnosticError("graphql_empty_rows");
  let requests = 0;
  let errors = 0;
  let latestAt = null;
  for (const row of rows) {
    if (!Number.isInteger(row?.sum?.requests) || !Number.isInteger(row?.sum?.errors)) throw diagnosticError("graphql_invalid_response");
    if (expectedScriptName && row?.dimensions?.scriptName !== expectedScriptName) throw diagnosticError("graphql_worker_mismatch");
    requests += row.sum.requests;
    errors += row.sum.errors;
    const at = row?.dimensions?.datetime;
    if (typeof at === "string" && (!latestAt || at > latestAt)) latestAt = at;
  }
  return { source: "cloudflare_graphql", requests, errors, latestAt };
}

export function validateMetricSnapshot(metrics, { accountTag, workerName, now = new Date(), maxAgeMs = DEFAULT_METRICS_WINDOW_MS + DEFAULT_INGESTION_LATENCY_MS, maxFutureSkewMs = DEFAULT_FUTURE_SKEW_MS } = {}) {
  if (!metrics || metrics.source !== "cloudflare_graphql" || !Number.isInteger(metrics.requests) || metrics.requests < 0 || !Number.isInteger(metrics.errors) || metrics.errors < 0) {
    throw diagnosticError("graphql_invalid_response");
  }
  if (!accountTag || metrics.accountTag !== accountTag) throw diagnosticError("graphql_account_mismatch");
  if (!workerName || metrics.worker !== workerName) throw diagnosticError("graphql_worker_mismatch");
  if (metrics.errors !== 0) throw diagnosticError("graphql_metrics_errors");
  if (typeof metrics.latestAt !== "string" || !metrics.latestAt) throw diagnosticError("graphql_timestamp_missing");
  const latestMs = Date.parse(metrics.latestAt);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(latestMs) || !Number.isFinite(nowMs)) throw diagnosticError("graphql_timestamp_invalid");
  const ageMs = nowMs - latestMs;
  if (ageMs < -maxFutureSkewMs) throw diagnosticError("graphql_metrics_future");
  if (ageMs > maxAgeMs) throw diagnosticError("graphql_metrics_stale");
  return { ...metrics, freshnessMs: Math.max(0, ageMs) };
}

export function createCloudflareObservability({ accountTag, tokenPath = defaultTokenPath(), analyticsToken = readAnalyticsToken(), fetchImpl = fetch, now = () => new Date(), windowMs = DEFAULT_METRICS_WINDOW_MS, ingestionLatencyMs = DEFAULT_INGESTION_LATENCY_MS, maxFutureSkewMs = DEFAULT_FUTURE_SKEW_MS, accessCredentials = readAccessCredentials() } = {}) {
  if (!accountTag) throw new TypeError("accountTag is required");
  const readMetrics = async (worker, { signal } = {}) => {
    let token = analyticsToken;
    if (!token) {
      try { token = await readOAuthToken(tokenPath); } catch { throw diagnosticError("metrics_auth_unavailable", { stage: "metrics", operation: "token_read" }); }
    }
    const end = now();
    const start = new Date(end.getTime() - windowMs);
    let response;
    try {
      response = await fetchImpl(GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ query: WORKERS_QUERY, variables: { accountTag, start: start.toISOString(), end: end.toISOString(), scriptName: worker.name } }),
        signal
      });
    } catch (error) {
      const code = signal?.aborted || error?.name === "AbortError" || error?.name === "TimeoutError" ? "graphql_timeout" : "graphql_network_error";
      throw diagnosticError(code, { stage: "metrics", operation: "graphql_fetch", errorClass: error?.name ?? "Error" });
    }
    if (!response?.ok) throw diagnosticError("graphql_http_failure", { stage: "metrics", operation: "graphql_fetch", httpStatus: Number(response?.status) || 0 });
    let body;
    try { body = await response.json(); } catch { throw diagnosticError("graphql_invalid_response", { stage: "metrics", operation: "graphql_json", httpStatus: Number(response.status) || 0 }); }
    if (Array.isArray(body?.errors) && body.errors.length > 0) throw diagnosticError("graphql_http200_errors", { stage: "metrics", operation: "graphql_response", httpStatus: Number(response.status) || 200 });
    const accounts = body?.data?.viewer?.accounts;
    if (!Array.isArray(accounts) || accounts.length !== 1) throw diagnosticError("graphql_account_mismatch", { stage: "metrics", operation: "graphql_account", httpStatus: Number(response.status) || 200 });
    const rows = accounts[0]?.workersInvocationsAdaptive;
    try {
      const metrics = sumMetricRows(rows, { expectedScriptName: worker.name });
      return validateMetricSnapshot({ ...metrics, accountTag, worker: worker.name }, { accountTag, workerName: worker.name, now: now(), maxAgeMs: windowMs + ingestionLatencyMs, maxFutureSkewMs });
    } catch (error) { throw diagnosticError(error?.code ?? "graphql_invalid_response", { stage: "metrics", operation: "graphql_rows", httpStatus: Number(response.status) || 200 }); }
  };
  const readHealth = async (worker, { signal } = {}) => {
    const started = performance.now();
    let response;
    try { response = await fetchImpl(`${worker.healthUrl}/health`, { redirect: "manual", headers: accessCredentials ? accessHeaders(accessCredentials) : undefined, signal }); }
    catch (error) { throw diagnosticError(signal?.aborted || error?.name === "AbortError" ? "graphql_timeout" : "health_unavailable", { stage: "health", operation: "health_fetch", errorClass: error?.name ?? "Error" }); }
    return { httpStatus: response.status, latencyMs: performance.now() - started };
  };
  return { readHealth, readMetrics };
}

export { DEFAULT_FUTURE_SKEW_MS, DEFAULT_INGESTION_LATENCY_MS, DEFAULT_METRICS_WINDOW_MS, GRAPHQL_URL, WORKERS_QUERY, sumMetricRows };
