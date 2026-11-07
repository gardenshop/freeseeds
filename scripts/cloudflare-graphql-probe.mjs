import { pathToFileURL } from "node:url";
import { readAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";
import { GRAPHQL_URL, WORKERS_QUERY, summarizeGraphqlErrors } from "./cloudflare-observability.mjs";

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,48}$/;
const DEFAULT_ACCOUNT = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const DEFAULT_WORKER = "getfreeseeds-api-staging";

const PROBES = Object.freeze([
  {
    name: "A_viewer",
    query: "query ProbeViewer { viewer { __typename } }",
    variables: () => ({}),
    valid: (body) => typeof body?.data?.viewer?.__typename === "string"
  },
  {
    name: "B_account",
    query: "query ProbeAccount($accountTag: string!) { viewer { accounts(filter: { accountTag: $accountTag }) { __typename } } }",
    variables: ({ accountTag }) => ({ accountTag }),
    valid: (body) => Array.isArray(body?.data?.viewer?.accounts) && body.data.viewer.accounts.length === 1
  },
  {
    name: "C_worker_minimal",
    query: "query ProbeWorker($accountTag: string!, $start: Time!, $end: Time!, $scriptName: string!) { viewer { accounts(filter: { accountTag: $accountTag }) { workersInvocationsAdaptive(limit: 1, filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }) { sum { requests errors } } } } }",
    variables: ({ accountTag, start, end, scriptName }) => ({ accountTag, start, end, scriptName }),
    valid: (body) => Array.isArray(body?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive)
  },
  {
    name: "D_monitoring_full",
    query: WORKERS_QUERY,
    variables: ({ accountTag, start, end, scriptName }) => ({ accountTag, start, end, scriptName }),
    valid: (body) => Array.isArray(body?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive)
  }
]);

function safeProviderCode(body) {
  const first = Array.isArray(body?.errors) ? body.errors[0] : null;
  const value = first?.extensions?.code ?? first?.code;
  if (Number.isSafeInteger(value)) return `cf_${value}`;
  return SAFE_CODE.test(String(value ?? "")) ? String(value) : "none";
}

export function classifyGraphqlResponse(body, parsed) {
  if (!parsed) return "non_json";
  if (!body || typeof body !== "object" || Array.isArray(body)) return "json_non_object";
  if (Array.isArray(body.errors) && body.errors.length > 0) return "graphql_errors";
  if (body.data && typeof body.data === "object") return "graphql_data";
  if (typeof body.success === "boolean") return "api_envelope";
  return "json_object";
}

async function runProbe(probe, context, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${context.token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ query: probe.query, variables: probe.variables(context) })
    });
  } catch {
    return { probe: probe.name, httpStatus: 0, graphqlErrorCount: null, category: "network", code: "none", structure: "none", result: "FAIL" };
  }

  let body;
  let parsed = true;
  try { body = await response.json(); } catch { parsed = false; }
  const errors = parsed ? summarizeGraphqlErrors(body) : { count: null, categories: [] };
  const structure = classifyGraphqlResponse(body, parsed);
  const pass = response.status === 200 && errors.count === 0 && structure === "graphql_data" && probe.valid(body);
  return {
    probe: probe.name,
    httpStatus: Number(response.status) || 0,
    graphqlErrorCount: errors.count,
    category: errors.categories[0] ?? (parsed ? "none" : "invalid_json"),
    code: parsed ? safeProviderCode(body) : "none",
    structure,
    result: pass ? "PASS" : "FAIL"
  };
}

export async function runCloudflareGraphqlProbes({
  accountTag = DEFAULT_ACCOUNT,
  scriptName = DEFAULT_WORKER,
  token = readAnalyticsToken(process.env, { required: true }),
  fetchImpl = fetch,
  now = new Date()
} = {}) {
  if (!/^[a-f0-9]{32}$/.test(accountTag)) throw new Error("invalid_account_id");
  const end = new Date(now).toISOString();
  const start = new Date(new Date(now).getTime() - 10 * 60 * 1000).toISOString();
  const context = { accountTag, scriptName, token, start, end };
  const results = [];
  for (const probe of PROBES) {
    const result = await runProbe(probe, context, fetchImpl);
    results.push(result);
    if (result.result !== "PASS") break;
  }
  return results;
}

async function main() {
  const results = await runCloudflareGraphqlProbes({ accountTag: process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT });
  console.log(JSON.stringify(results));
  if (results.at(-1)?.result !== "PASS" || results.length !== PROBES.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = SAFE_CODE.test(String(error?.message ?? "")) ? String(error.message) : "probe_failed";
    console.error(JSON.stringify([{ probe: "bootstrap", httpStatus: 0, graphqlErrorCount: null, category: "local", code, structure: "none", result: "FAIL" }]));
    process.exitCode = 1;
  });
}

export { PROBES };
