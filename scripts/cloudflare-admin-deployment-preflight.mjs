import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { inspectAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";

const execFileAsync = promisify(execFile);
const API_BASE = "https://api.cloudflare.com/client/v4";
const ACCOUNT_ID = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const WORKER_NAME = "getfreeseeds-admin-staging";
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;
const VERSION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function errorCode(value, fallback = "cloudflare_request_failed") {
  const code = Number.isSafeInteger(value) ? `cf_${value}` : String(value ?? "");
  return SAFE_CODE.test(code) ? code : fallback;
}

function safeResult(result) {
  return {
    result,
    account: ACCOUNT_ID,
    worker: WORKER_NAME
  };
}

async function jsonRequest({ token, path, fetchImpl = fetch, method = "GET" }) {
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  let body = null;
  try { body = await response.json(); } catch { return { response, body: null }; }
  return { response, body };
}

function resourceLeaves(value, prefix = "") {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object" || Array.isArray(value)) return [{ path: prefix, value: String(value) }];
  return Object.entries(value).flatMap(([key, child]) => resourceLeaves(child, prefix ? `${prefix}.${key}` : key));
}

function exactWorkerScope(policies) {
  if (!Array.isArray(policies) || policies.length === 0) return false;
  if (policies.length !== 1 || policies[0]?.effect !== "allow") return false;
  const leaves = resourceLeaves(policies[0]?.resources);
  return leaves.length === 1 && leaves[0].path === `com.cloudflare.api.account.worker.script.${WORKER_NAME}` && leaves[0].value === "*";
}

export async function verifyDeploymentCredential({ token, fetchImpl = fetch, now = new Date(), linkageVerified = false } = {}) {
  const shape = inspectAnalyticsToken(token);
  if (shape.malformedHeaderValue) return { ...safeResult("FAIL"), code: "credential_shape_invalid" };

  const verified = await jsonRequest({ token, path: `/accounts/${ACCOUNT_ID}/tokens/verify`, fetchImpl });
  const status = String(verified.body?.result?.status ?? "").toUpperCase();
  const expiresOn = verified.body?.result?.expires_on ?? null;
  const expiry = expiresOn ? new Date(expiresOn) : null;
  if (verified.response.status !== 200 || verified.body?.success !== true || status !== "ACTIVE") {
    return { ...safeResult("FAIL"), code: "token_verify_failed", httpStatus: verified.response.status, tokenStatus: status || "UNKNOWN" };
  }
  if (!expiry || Number.isNaN(expiry.valueOf()) || expiry <= now) {
    return { ...safeResult("FAIL"), code: "token_expired_or_missing_expiry", tokenStatus: status };
  }

  const tokenId = verified.body?.result?.id;
  if (!/^[a-f0-9]{32}$/i.test(String(tokenId ?? ""))) return { ...safeResult("FAIL"), code: "token_identity_missing" };
  if (!linkageVerified) return { ...safeResult("FAIL"), code: "token_scope_unverified" };

  const worker = await jsonRequest({ token, path: `/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/deployments`, fetchImpl });
  if (worker.response.status !== 200 || worker.body?.success !== true) {
    return { ...safeResult("FAIL"), code: "worker_readback_failed", httpStatus: worker.response.status };
  }
  return {
    ...safeResult("PASS"),
    tokenStatus: status,
    expiresOn,
    scope: "PREVERIFIED_BY_HOST_LINKAGE",
    workerReadback: "PASS"
  };
}

function versionRecord(version) {
  const id = String(version?.id ?? "");
  const metadata = version?.metadata;
  if (!VERSION_ID.test(id) || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return {
    id,
    message: typeof metadata.message === "string" ? metadata.message : null,
    createdOn: typeof metadata.created_on === "string" ? metadata.created_on : null,
    source: typeof metadata.source === "string" ? metadata.source : null
  };
}

export async function listWorkerVersions({ token, fetchImpl = fetch } = {}) {
  const listed = await jsonRequest({ token, path: `/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/versions?per_page=100`, fetchImpl });
  const versions = listed.body?.result?.versions;
  if (listed.response.status !== 200 || listed.body?.success !== true || !Array.isArray(versions)) {
    return { ...safeResult("FAIL"), code: "worker_versions_readback_failed", httpStatus: listed.response.status };
  }
  return { ...safeResult("PASS"), versions: versions.map(versionRecord).filter(Boolean) };
}

export async function deploymentSnapshot({ token, fetchImpl = fetch } = {}) {
  const listed = await jsonRequest({ token, path: `/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/deployments`, fetchImpl });
  const deployments = listed.body?.result?.deployments;
  const latest = Array.isArray(deployments) ? deployments[0] : null;
  const versions = Array.isArray(latest?.versions) ? latest.versions : null;
  const deploymentId = String(latest?.id ?? "");
  if (listed.response.status !== 200 || listed.body?.success !== true || !latest || !deploymentId || !versions) {
    return { ...safeResult("FAIL"), code: "worker_deployment_readback_failed", httpStatus: listed.response.status };
  }
  const normalized = versions.map((version) => ({
    versionId: String(version?.version_id ?? ""),
    percentage: Number(version?.percentage)
  })).sort((left, right) => left.versionId.localeCompare(right.versionId));
  if (normalized.some((version) => !VERSION_ID.test(version.versionId) || !Number.isFinite(version.percentage))) {
    return { ...safeResult("FAIL"), code: "worker_deployment_shape_invalid" };
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({ deploymentId, versions: normalized })).digest("hex");
  return { ...safeResult("PASS"), fingerprint, activeVersionCount: normalized.length };
}

async function trackedFiles(repoRoot, configPath) {
  const configRelative = relative(repoRoot, resolve(repoRoot, configPath)).replaceAll("\\", "/");
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, "ls-files", "apps/admin/src", configRelative], { windowsHide: true });
  const files = [...new Set(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort();
  if (!files.includes(configRelative)) throw new Error("approved_config_not_tracked");
  if (!files.some((file) => file.startsWith("apps/admin/src/"))) throw new Error("approved_source_not_tracked");
  return files;
}

export async function artifactDigest({ repoRoot, configPath = "apps/admin/wrangler.jsonc" }) {
  const root = resolve(repoRoot);
  const files = await trackedFiles(root, configPath);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(await readFile(join(root, file)));
    hash.update(Buffer.from([0]));
  }
  return { sha256: hash.digest("hex"), files: files.length, config: configPath.replaceAll("\\", "/") };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const repoIndex = process.argv.indexOf("--repo-root");
  const configIndex = process.argv.indexOf("--config");
  const repoRoot = repoIndex >= 0 ? process.argv[repoIndex + 1] : process.cwd();
  const configPath = configIndex >= 0 ? process.argv[configIndex + 1] : "apps/admin/wrangler.jsonc";
  if (args.has("--artifact-digest")) {
    console.log(JSON.stringify(await artifactDigest({ repoRoot, configPath })));
    return;
  }
  if (args.has("--versions-snapshot")) {
    const result = await listWorkerVersions({ token: process.env.CLOUDFLARE_API_TOKEN });
    console.log(JSON.stringify(result));
    if (result.result !== "PASS") process.exitCode = 1;
    return;
  }
  if (args.has("--deployment-snapshot")) {
    const result = await deploymentSnapshot({ token: process.env.CLOUDFLARE_API_TOKEN });
    console.log(JSON.stringify(result));
    if (result.result !== "PASS") process.exitCode = 1;
    return;
  }
  const result = await verifyDeploymentCredential({
    token: process.env.CLOUDFLARE_API_TOKEN,
    linkageVerified: args.has("--linkage-verified")
  });
  console.log(JSON.stringify(result));
  if (result.result !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = SAFE_CODE.test(String(error?.message ?? "")) ? error.message : "preflight_failed";
    console.log(JSON.stringify({ ...safeResult("FAIL"), code }));
    process.exitCode = 1;
  });
}

export { ACCOUNT_ID, WORKER_NAME, VERSION_ID, exactWorkerScope, resourceLeaves };
