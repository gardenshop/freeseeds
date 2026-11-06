/**
 * Private, fail-closed rollback watchdog artifact.
 *
 * This Worker has no public control surface. It is DISARMED by default and
 * must not be deployed until the private Worker, scoped credential, and
 * secret binding have been separately verified.
 */

export const ACCOUNT_ID = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
export const TARGET_SCRIPT = "getfreeseeds-admin-staging";
export const BASELINE_VERSION = "3e4b7c26-c36d-4d1c-baeb-d26629a9b4a1";
export const CANDIDATE_VERSION = "ce023b54-4d38-43e5-842e-faa706e7606c";
export const DEFAULT_STATE = "DISARMED";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function validateTarget({ accountId, scriptName, baseline, candidate }) {
  if (accountId !== ACCOUNT_ID || scriptName !== TARGET_SCRIPT) throw fail("target_not_allowlisted");
  if (baseline !== BASELINE_VERSION || candidate !== CANDIDATE_VERSION) throw fail("version_not_allowlisted");
  if (!UUID.test(baseline) || !UUID.test(candidate) || baseline === candidate) throw fail("version_invalid");
}

export function validateArm({ accountId, scriptName, baseline, candidate, startedAt, deadlineAt }, now) {
  validateTarget({ accountId, scriptName, baseline, candidate });
  if (!Number.isFinite(startedAt) || !Number.isFinite(deadlineAt) || deadlineAt <= startedAt || startedAt < now - 30_000) {
    throw fail("deadline_invalid");
  }
}

function deploymentVersions(body) {
  const versions = body?.result?.[0]?.versions ?? body?.result?.versions ?? body?.versions;
  return Array.isArray(versions) ? versions.map((v) => ({ versionId: v?.version_id, percentage: v?.percentage })) : null;
}

function isBaseline(versions) {
  if (!Array.isArray(versions) || versions.length !== 2) return false;
  return versions.some((v) => v.versionId === BASELINE_VERSION && v.percentage === 100)
    && versions.some((v) => v.versionId === CANDIDATE_VERSION && v.percentage === 0);
}

function isKnownDeployment(versions) {
  return Array.isArray(versions) && versions.length === 2
    && versions.some((v) => v.versionId === BASELINE_VERSION)
    && versions.some((v) => v.versionId === CANDIDATE_VERSION);
}

export async function restoreDeployment({ fetchImpl = fetch, token } = {}) {
  if (!token) throw fail("recovery_secret_missing");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${TARGET_SCRIPT}/deployments`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "content-type": "application/json" };
  const read = async () => {
    const response = await fetchImpl(endpoint, { headers });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) throw fail("deployment_readback_rejected");
    const versions = deploymentVersions(body);
    if (!isKnownDeployment(versions)) throw fail("routing_not_allowlisted");
    return versions;
  };
  const before = await read();
  if (isBaseline(before)) return { code: "already_restored", wrote: false };

  const response = await fetchImpl(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ strategy: "percentage", versions: [
      { version_id: BASELINE_VERSION, percentage: 100 },
      { version_id: CANDIDATE_VERSION, percentage: 0 }
    ] })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw fail("deployment_restore_rejected");
  if (!isBaseline(await read())) throw fail("restore_readback_mismatch");
  return { code: "restored", wrote: true };
}

export function createRecoveryController({ fetchImpl = fetch, now = () => Date.now(), token = "test-only" } = {}) {
  let state = { status: DEFAULT_STATE, restoreAttempts: 0 };

  return {
    getState() { return { ...state }; },
    arm(input) {
      if (state.status !== DEFAULT_STATE) throw fail("already_armed");
      validateArm(input, now());
      state = { ...input, status: "ARMED", restoreAttempts: 0 };
      return { ...state };
    },
    async tick() {
      if (state.status !== "ARMED") return { status: state.status, wrote: false };
      if (now() < state.deadlineAt) return { status: state.status, wrote: false };
      state = { ...state, status: "RESTORING", restoreAttempts: state.restoreAttempts + 1 };
      try {
        const result = await restoreDeployment({ fetchImpl, token });
        state = { ...state, status: "RESTORED", restoredAt: now() };
        return { status: state.status, ...result };
      } catch (error) {
        state = { ...state, status: "FAILED", failureCode: error?.code ?? "recovery_failed" };
        return { status: state.status, wrote: false, code: state.failureCode };
      }
    }
  };
}

export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
  async scheduled() {
    // Deliberately inert until a separately approved, secured deployment.
    return { status: DEFAULT_STATE, wrote: false };
  }
};
