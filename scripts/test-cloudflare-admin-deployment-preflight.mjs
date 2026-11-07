import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { artifactDigest, deploymentSnapshot, exactWorkerScope, listWorkerVersions, resourceLeaves, verifyDeploymentCredential, WORKER_NAME } from "./cloudflare-admin-deployment-preflight.mjs";

const account = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const token = "synthetic-admin-token";
const tokenId = "0123456789abcdef0123456789abcdef";
const uuid = "01234567-89ab-cdef-0123-456789abcdef";
const response = (body, status = 200) => ({ status, json: async () => body });
const execFile = promisify(execFileCallback);

function apiFetch(calls, { workerStatus = 200 } = {}) {
  return async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    calls.push(url);
    if (url.endsWith("/tokens/verify")) return response({ success: true, result: { id: tokenId, status: "active", expires_on: "2099-01-01T00:00:00Z" } });
    if (url.endsWith(`/scripts/${WORKER_NAME}/deployments`)) return response({ success: true, result: [{ id: uuid }] }, workerStatus);
    throw new Error("unexpected_request");
  };
}

test("passes active exact Worker scope and target readback without returning a secret", async () => {
  const calls = [];
  const result = await verifyDeploymentCredential({ token, fetchImpl: apiFetch(calls), now: new Date("2026-11-07T00:00:00Z"), linkageVerified: true });
  assert.equal(result.result, "PASS");
  assert.equal(result.scope, "PREVERIFIED_BY_HOST_LINKAGE");
  assert.ok(!JSON.stringify(result).includes(token));
  assert.deepEqual(calls, [`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`, `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER_NAME}/deployments`]);
});

test("requires integrated host linkage proof", async () => {
  const unlinked = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([]) });
  assert.equal(unlinked.code, "token_scope_unverified");
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
  const denied = await verifyDeploymentCredential({ token, fetchImpl: apiFetch([], { workerStatus: 403 }), linkageVerified: true });
  assert.equal(denied.code, "worker_readback_failed");
});

test("uses structured official version and deployment readback", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    calls.push(url);
    if (url.includes(`/scripts/${WORKER_NAME}/versions?`)) return response({ success: true, result: { versions: [
      { id: uuid, metadata: { message: "GFS-COD-MO-89 synthetic", created_on: "2026-11-07T18:00:00Z", source: "wrangler" } }
    ] } });
    if (url.endsWith(`/scripts/${WORKER_NAME}/deployments`)) return response({ success: true, result: { deployments: [
      { id: "deployment-synthetic", versions: [{ version_id: uuid, percentage: 100 }] }
    ] } });
    throw new Error("unexpected_request");
  };
  const versions = await listWorkerVersions({ token, fetchImpl });
  assert.equal(versions.result, "PASS");
  assert.equal(versions.versions[0].message, "GFS-COD-MO-89 synthetic");
  const deployment = await deploymentSnapshot({ token, fetchImpl });
  assert.equal(deployment.result, "PASS");
  assert.match(deployment.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(calls, [
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER_NAME}/versions?per_page=100`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER_NAME}/deployments`
  ]);
});

test("rejects malformed official version/deployment shapes", async () => {
  const versions = await listWorkerVersions({ token, fetchImpl: async () => response({ success: true, result: { versions: [{ id: "not-a-version", metadata: {} }] } }) });
  assert.equal(versions.result, "PASS");
  assert.deepEqual(versions.versions, []);
  const deployment = await deploymentSnapshot({ token, fetchImpl: async () => response({ success: true, result: { deployments: [{ id: "deployment-synthetic", versions: [{ version_id: "not-a-version", percentage: 100 }] }] } }) });
  assert.equal(deployment.code, "worker_deployment_shape_invalid");
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
