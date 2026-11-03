/**
 * GFS-464 isolated Cloudflare watchdog Worker.
 *
 * The target script name is hard-coded to prevent scope expansion. Secrets are
 * runtime bindings only. This Worker has no production API/Admin bindings.
 */

export const WATCHDOG_NAME = "gfs464-isolated-watchdog";
export const TARGET_SCRIPT = "gfs462-isolated-target";
export const RESTORE_START_MS = 6 * 60 * 1000;
export const HARD_DEADLINE_MS = 8 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANARY_ID = /^[a-z0-9][a-z0-9:-]{2,63}$/i;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function safeState(state) {
  return state ? {
    canaryId: state.canaryId,
    target: TARGET_SCRIPT,
    baseline: state.baseline,
    candidate: state.candidate,
    startedAt: state.startedAt,
    restoreAt: state.restoreAt,
    deadlineAt: state.deadlineAt,
    status: state.status,
    restoreAttempts: state.restoreAttempts,
    restoredAt: state.restoredAt ?? null
  } : { status: "unarmed", target: TARGET_SCRIPT };
}

function validateArm(body, now) {
  if (!body || body.target !== TARGET_SCRIPT || !CANARY_ID.test(body.canaryId ?? "")) throw fail("isolated_allowlist_rejected");
  if (!UUID.test(body.baseline ?? "") || !UUID.test(body.candidate ?? "") || body.baseline === body.candidate) throw fail("version_allowlist_rejected");
  if (![body.startedAt, body.restoreAt, body.deadlineAt].every(Number.isFinite)) throw fail("deadline_invalid");
  if (body.restoreAt !== body.startedAt + RESTORE_START_MS || body.deadlineAt !== body.startedAt + HARD_DEADLINE_MS || body.restoreAt >= body.deadlineAt) throw fail("deadline_policy_rejected");
  if (body.startedAt < now - 30_000 || body.startedAt > now + 30_000) throw fail("stale_arm_rejected");
}

function deploymentVersions(deployment) {
  const versions = deployment?.versions ?? deployment?.result?.versions;
  return Array.isArray(versions) ? versions.map((v) => ({ versionId: v?.version_id, percentage: v?.percentage })) : null;
}

function matchesBaseline(versions, state) {
  if (!Array.isArray(versions)) return false;
  const baseline = versions.find((v) => v.versionId === state.baseline);
  const candidate = versions.find((v) => v.versionId === state.candidate);
  return baseline?.percentage === 100 && candidate?.percentage === 0 && versions.length === 2;
}

export function createWatchdogWorker({ fetchImpl = fetch, now = () => Date.now() } = {}) {
  return {
    async restore(state, env) {
      if (!env?.CLOUDFLARE_ACCOUNT_ID || !env?.TARGET_API_TOKEN) throw fail("watchdog_secret_missing");
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${TARGET_SCRIPT}/deployments`;
      const headers = { Authorization: `Bearer ${env.TARGET_API_TOKEN}`, "content-type": "application/json" };
      const before = await fetchImpl(endpoint, { headers });
      const beforeJson = await before.json().catch(() => null);
      const beforeVersions = deploymentVersions(beforeJson?.result?.[0] ?? beforeJson);
      if (!before.ok || !beforeVersions?.some((v) => v.versionId === state.baseline) || !beforeVersions.some((v) => v.versionId === state.candidate)) throw fail("target_readback_rejected");
      const response = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify({
        strategy: "percentage",
        versions: [{ version_id: state.baseline, percentage: 100 }, { version_id: state.candidate, percentage: 0 }],
        annotations: { "workers/message": "GFS-464 isolated restore" }
      }) });
      if (!response.ok) throw fail("target_restore_rejected");
      const after = await fetchImpl(endpoint, { headers });
      const afterJson = await after.json().catch(() => null);
      const afterVersions = deploymentVersions(afterJson?.result?.[0] ?? afterJson);
      if (!after.ok || !matchesBaseline(afterVersions, state)) throw fail("restore_readback_mismatch");
      return { ok: true, code: "restored" };
    }
  };
}

export class WatchdogState {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") return Response.json(safeState(await this.state.storage.get("state")));
    if (request.method !== "POST" || url.pathname !== "/arm") return new Response("Not found", { status: 404 });
    if (!this.env.ARM_SECRET || request.headers.get("x-gfs-arm-secret") !== this.env.ARM_SECRET) return new Response("Forbidden", { status: 403 });
    const body = await request.json().catch(() => null);
    const now = Date.now();
    validateArm(body, now);
    const current = await this.state.storage.get("state");
    if (current) {
      if (current.canaryId !== body.canaryId) throw fail("immutable_canary_conflict");
      return Response.json(safeState(current));
    }
    const state = { ...body, status: "armed", restoreAttempts: 0, restoredAt: null };
    await this.state.storage.put("state", state);
    await this.state.storage.setAlarm(state.restoreAt);
    return Response.json(safeState(state));
  }

  async alarm() {
    const state = await this.state.storage.get("state");
    if (!state || state.status === "restored" || state.status === "failed") return;
    if (Date.now() < state.restoreAt) return this.state.storage.setAlarm(state.restoreAt);
    if (Date.now() > state.deadlineAt) {
      await this.state.storage.put("state", { ...state, status: "failed", failureCode: "deadline_missed" });
      return;
    }
    const next = { ...state, restoreAttempts: state.restoreAttempts + 1 };
    await this.state.storage.put("state", next);
    try {
      const result = await createWatchdogWorker().restore(next, this.env);
      await this.state.storage.put("state", { ...next, ...result, status: "restored", restoredAt: Date.now() });
    } catch (error) {
      await this.state.storage.put("state", { ...next, status: "failed", failureCode: error?.code ?? "restore_failed" });
    }
  }
}

export default {
  async fetch(request, env) {
    const id = env.WATCHDOG_STATE.idFromName("gfs464-isolated-target");
    return env.WATCHDOG_STATE.get(id).fetch(request);
  }
};
