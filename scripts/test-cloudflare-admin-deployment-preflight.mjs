import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { artifactDigest, exactWorkerScope, resourceLeaves, verifyDeploymentCredential, WORKER_NAME } from "./cloudflare-admin-deployment-preflight.mjs";

const account = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const token = "synthetic-admin-token";
const tokenId = "0123456789abcdef0123456789abcdef";
const uuid = "01234567-89ab-cdef-0123-456789abcdef";
const response = (body, status = 200) => ({ status, json: async () => body });
const execFile = promisify(execFileCallback);

function apiFetch(calls, { scope = true, workerStatus = 200, detailsStatus = 200, detailsErrors = [] } = {}) {
  return async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    calls.push(url);
    if (url.endsWith("/tokens/verify")) return response({ success: true, result: { id: tokenId, status: "active", expires_on: "2099-01-01T00:00:00Z" } });
    if (url.endsWith(`/tokens/${tokenId}`)) return response(detailsStatus === 200 ? { success: true, result: { policies: scope ? [{ effect: "allow", resources: { [`com.cloudflare.api.account.worker.script.${WORKER_NAME}`]: "*" }, permission_groups: [{ id: "workers-editor" }] }] : [{ effect: "allow", resources: { "com.cloudflare.api.account": "*" } }] } } : { success: false, errors: detailsErrors }, detailsStatus);
    if (url.endsWith(`/scripts/${WORKER_NAME}/deployments`)) return response({ success: true, result: [{ id: uuid }] }, workerStatus);
    throw new Error("unexpected_request");
  };
}

test("passes active exact Worker scope and target readback without returning a secret", async () => {
  const calls = [];
  const result = await verifyDeploymentCredential({ token, fetchImpl: apiFetch(calls), now: new Date("2026-11-07T00:00:00Z") });
  assert.equal(result.result, "PASS");
  assert.equal(result.scope, `ONLY:${WORKER_NAME}`);
  assert.ok(!JSON.stringify(result).includes(token));
  assert.deepEqual(calls, [`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`, `https://api.cloudflare.com/client/v4/accounts/${account}/tokens/${tokenId}`, `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER_NAME}/deployments`]);
});

test("fails closed when policy is broad or missing", async () => {
  const broad = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([], { scope: false }) });
  assert.equal(broad.code, "token_scope_mismatch");
  assert.equal(exactWorkerScope([]), false);
});

test("accepts documented nested resource maps only for the exact Worker", () => {
  const nested = { "com.cloudflare.api.account": { worker: { script: { [WORKER_NAME]: "*" } } } };
  assert.equal(exactWorkerScope([{ effect: "allow", resources: nested }]), true);
  assert.equal(resourceLeaves(nested).length, 1);
  assert.equal(exactWorkerScope([{ effect: "allow", resources: { "com.cloudflare.api.account": { worker: { script: "*" } } } }]), false);
  assert.equal(exactWorkerScope([{ effect: "allow", resources: { "com.cloudflare.api.account.worker.script.other": "*" } }]), false);
  assert.equal(exactWorkerScope([{ effect: "allow", resources: { [`com.cloudflare.api.account.worker.script.${WORKER_NAME}`]: "*", "com.cloudflare.api.account.worker.script.other": "*" } }]), false);
});

test("fails closed on inactive token and worker readback", async () => {
  const inactive = await verifyDeploymentCredential({ token: "", fetchImpl: async () => { throw new Error("must_not_call"); } });
  assert.equal(inactive.code, "credential_shape_invalid");
  const denied = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([], { workerStatus: 403 }) });
  assert.equal(denied.code, "worker_readback_failed");
});

test("reports sanitized scope-detail denial without weakening the gate", async () => {
  const denied = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([], { detailsStatus: 403, detailsErrors: [{ code: 9109, message: "hidden" }] }) });
  assert.equal(denied.code, "token_scope_unverified");
  assert.equal(denied.httpStatus, 403);
  assert.deepEqual(denied.providerCodes, ["cf_9109"]);
  const missing = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([], { detailsStatus: 404, detailsErrors: [{ code: 9109 }] }) });
  assert.equal(missing.code, "token_scope_unverified");
  assert.deepEqual(missing.providerCodes, ["cf_9109"]);
  assert.ok(!JSON.stringify(denied).includes("hidden"));
});

test("artifact digest is deterministic and includes tracked source/config", async () => {
  const root = await mkdtemp(join(tmpdir(), "gfs-admin-runner-"));
  await mkdir(join(root, "apps", "admin", "src"), { recursive: true });
  await writeFile(join(root, "apps", "admin", "wrangler.jsonc"), '{"name":"getfreeseeds-admin-staging"}');
  await writeFile(join(root, "apps", "admin", "src", "index.ts"), "export default {};\n");
  await execFile("git", ["-C", root, "init", "--quiet"]);
  await execFile("git", ["-C", root, "add", "apps/admin/wrangler.jsonc", "apps/admin/src/index.ts"]);
  const digest = await artifactDigest({ repoRoot: root });
  assert.equal(digest.files, 2);
  assert.match(digest.sha256, /^[a-f0-9]{64}$/);
});
