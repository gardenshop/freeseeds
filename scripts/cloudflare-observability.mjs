import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { accessHeaders, readAccessCredentials } from "./cloudflare-access-credentials.mjs";
import { diagnosticError } from "./canary-diagnostics.mjs";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const WORKERS_QUERY = `query Workers($accountTag: String!, $start: Time!, $end: Time!, $scriptName: String!) {
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

function sumMetricRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw diagnosticError("graphql_empty_rows");
  let requests = 0;
  let errors = 0;
  let latestAt = null;
  for (const row of rows) {
    if (!Number.isInteger(row?.sum?.requests) || !Number.isInteger(row?.sum?.errors)) throw diagnosticError("graphql_invalid_response");
    requests += row.sum.requests;
    errors += row.sum.errors;
    const at = row?.dimensions?.datetime;
    if (typeof at === "string" && (!latestAt || at > latestAt)) latestAt = at;
  }
  return { source: "cloudflare_graphql", requests, errors, latestAt };
}

export function createCloudflareObservability({ accountTag, tokenPath = defaultTokenPath(), fetchImpl = fetch, now = () => new Date(), windowMs = 10 * 60 * 1000, accessCredentials = readAccessCredentials() } = {}) {
  if (!accountTag) throw new TypeError("accountTag is required");
  const readMetrics = async (worker, { signal } = {}) => {
    let token;
    try { token = await readOAuthToken(tokenPath); } catch { throw diagnosticError("metrics_auth_unavailable", { stage: "metrics", operation: "oauth_read" }); }
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
    const rows = body?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
    try { return sumMetricRows(rows); } catch (error) { throw diagnosticError(error?.code ?? "graphql_invalid_response", { stage: "metrics", operation: "graphql_rows", httpStatus: Number(response.status) || 200 }); }
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

export { GRAPHQL_URL, WORKERS_QUERY, sumMetricRows };
