/**
 * GFS-464 isolated Cloudflare watchdog Worker.
 *
 * This is a deployable ES module. The target and deployment API are fixed so
 * this Worker cannot be repurposed for production Admin/API resources.
 */

export const WATCHDOG_NAME = "gfs464-isolated-watchdog";
export const TARGET_SCRIPT = "gfs462-isolated-target";
export const RESTORE_START_MS = 6 * 60 * 1000;
export const HARD_DEADLINE_MS = 8 * 60 * 1000;
export const RETRY_DELAYS_MS = [30_000, 60_000, 90_000];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANARY_ID = /^[a-z0-9][a-z0-9:-]{2,63}$/i;

function fail(code, { retryable = false } = {}) {
  const error = new Error(code);
  error.code = code;
  error.retryable = retryable;
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
    nextRetryAt: state.nextRetryAt ?? null,
    failureCode: state.failureCode ?? null,
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

function validateRestoreState(state) {
  if (!state || state.target !== TARGET_SCRIPT) throw fail("isolated_allowlist_rejected");
  if (!UUID.test(state.baseline ?? "") || !UUID.test(state.candidate ?? "") || state.baseline === state.candidate) throw fail("version_allowlist_rejected");
}

function deploymentVersions(deployment) {
  const versions = deployment?.versions ?? deployment?.result?.versions;
  return Array.isArray(versions) ? versions.map((v) => ({ versionId: v?.version_id, percentage: v?.percentage })) : null;
}

function matchesBaseline(versions, state) {
  if (!Array.isArray(versions) || versions.length !== 2) return false;
  const baseline = versions.find((v) => v.versionId === state.baseline);
  const candidate = versions.find((v) => v.versionId === state.candidate);
  return baseline?.percentage === 100 && candidate?.percentage === 0;
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function responseJson(response, code) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw fail(code, { retryable: retryableStatus(response.status) });
  return body;
}

export function createWatchdogWorker({ fetchImpl = fetch } = {}) {
  return {
    async restore(state, env) {
      validateRestoreState(state);
      if (!env?.CLOUDFLARE_ACCOUNT_ID || !env?.TARGET_API_TOKEN) throw fail("watchdog_secret_missing");
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${TARGET_SCRIPT}/deployments`;
      const headers = { Authorization: `Bearer ${env.TARGET_API_TOKEN}`, "content-type": "application/json" };
      let beforeResponse;
      try {
        beforeResponse = await fetchImpl(endpoint, { headers });
      } catch {
        throw fail("target_readback_unavailable", { retryable: true });
      }
      const beforeJson = await responseJson(beforeResponse, "target_readback_rejected");
      const beforeVersions = deploymentVersions(beforeJson?.result?.[0] ?? beforeJson);
      if (!beforeVersions?.some((v) => v.versionId === state.baseline) || !beforeVersions.some((v) => v.versionId === state.candidate)) throw fail("target_readback_rejected");
      if (matchesBaseline(beforeVersions, state)) return { ok: true, code: "already_restored" };

      let response;
      try {
        response = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify({
          strategy: "percentage",
          versions: [{ version_id: state.baseline, percentage: 100 }, { version_id: state.candidate, percentage: 0 }],
          annotations: { "workers/message": "GFS-464 isolated restore" }
        }) });
      } catch {
        throw fail("target_restore_unavailable", { retryable: true });
      }
      await responseJson(response, "target_restore_rejected");

      let afterResponse;
      try {
        afterResponse = await fetchImpl(endpoint, { headers });
      } catch {
        throw fail("restore_readback_unavailable", { retryable: true });
      }
      const afterJson = await responseJson(afterResponse, "restore_readback_rejected");
      const afterVersions = deploymentVersions(afterJson?.result?.[0] ?? afterJson);
      if (!matchesBaseline(afterVersions, state)) throw fail("restore_readback_mismatch");
      return { ok: true, code: "restored" };
    }
  };
}

export class WatchdogState {
  constructor(state, env, { now = () => Date.now(), restoreWorker = createWatchdogWorker() } = {}) {
    this.state = state;
    this.env = env;
    this.now = now;
    this.restoreWorker = restoreWorker;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") return Response.json(safeState(await this.state.storage.get("state")));
    if (request.method !== "POST" || url.pathname !== "/arm") return new Response("Not found", { status: 404 });
    if (!this.env.ARM_SECRET || request.headers.get("x-gfs-arm-secret") !== this.env.ARM_SECRET) return Response.json({ error: "forbidden" }, { status: 403 });
    const body = await request.json().catch(() => null);
    try {
      validateArm(body, this.now());
      const current = await this.state.storage.get("state");
      if (current) {
        if (current.canaryId !== body.canaryId) return Response.json({ error: "immutable_canary_conflict" }, { status: 409 });
        return Response.json(safeState(current));
      }
      const state = { ...body, status: "armed", restoreAttempts: 0, nextRetryAt: null, failureCode: null, restoredAt: null };
      await this.state.storage.put("state", state);
      await this.state.storage.setAlarm(state.restoreAt);
      return Response.json(safeState(state));
    } catch (error) {
      return Response.json({ error: error?.code ?? "invalid_arm" }, { status: 400 });
    }
  }

  async alarm() {
    const state = await this.state.storage.get("state");
    if (!state || state.status === "restored" || state.status === "failed" || state.status === "restoring") return;
    const now = this.now();
    if (now < state.restoreAt) return this.state.storage.setAlarm(state.restoreAt);
    if (now >= state.deadlineAt) {
      await this.state.storage.put("state", { ...state, status: "failed", failureCode: "deadline_missed", nextRetryAt: null });
      return;
    }
    const next = { ...state, status: "restoring", restoreAttempts: state.restoreAttempts + 1, nextRetryAt: null, failureCode: null };
    await this.state.storage.put("state", next);
    try {
      const result = await this.restoreWorker.restore(next, this.env);
      await this.state.storage.put("state", { ...next, ...result, status: "restored", restoredAt: this.now(), nextRetryAt: null });
    } catch (error) {
      const retryAt = this.now() + (RETRY_DELAYS_MS[Math.min(next.restoreAttempts - 1, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS.at(-1));
      if (error?.retryable === true && retryAt < state.deadlineAt) {
        await this.state.storage.put("state", { ...next, status: "armed", failureCode: error?.code ?? "restore_failed", nextRetryAt: retryAt });
        await this.state.storage.setAlarm(retryAt);
      } else {
        await this.state.storage.put("state", { ...next, status: "failed", failureCode: error?.code ?? "restore_failed", nextRetryAt: null });
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const id = env.WATCHDOG_STATE.idFromName("gfs464-isolated-target");
    return env.WATCHDOG_STATE.get(id).fetch(request);
  }
};
