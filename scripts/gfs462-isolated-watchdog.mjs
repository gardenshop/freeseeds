/**
 * GFS-462 isolated rollback proof.
 *
 * This module is intentionally limited to the named test target.  It is not a
 * production Admin/API controller and contains no production credentials.
 */

export const ISOLATED_TARGET = "gfs462-isolated-target";
export const ISOLATED_BASELINE = "gfs462-isolated-baseline-v1";
export const ISOLATED_CANDIDATE = "gfs462-isolated-candidate-v1";
export const RESTORE_START_MS = 6 * 60 * 1000;
export const HARD_DEADLINE_MS = 8 * 60 * 1000;

const PROTECTED_TARGETS = new Set([
  "getfreeseeds-api-staging",
  "getfreeseeds-admin-staging",
  "getfreeseeds-v2-api-staging",
  "getfreeseeds-v2-admin-staging"
]);

function safeState(state) {
  return {
    canaryId: state.canaryId,
    target: state.target,
    baseline: state.baseline,
    candidate: state.candidate,
    startedAt: state.startedAt,
    restoreAt: state.restoreAt,
    deadlineAt: state.deadlineAt,
    status: state.status,
    restoreAttempts: state.restoreAttempts,
    restoredAt: state.restoredAt ?? null
  };
}

function reject(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validateRequest(request) {
  if (!request || request.target !== ISOLATED_TARGET) throw reject("isolated_target_required");
  if (PROTECTED_TARGETS.has(request.target)) throw reject("production_target_forbidden");
  if (request.baseline !== ISOLATED_BASELINE || request.candidate !== ISOLATED_CANDIDATE) {
    throw reject("version_allowlist_mismatch");
  }
  if (!request.canaryId || !/^[a-z0-9][a-z0-9-:-]{2,63}$/i.test(request.canaryId)) {
    throw reject("invalid_canary_id");
  }
  if (!Number.isFinite(request.startedAt) || !Number.isFinite(request.restoreAt) || !Number.isFinite(request.deadlineAt)) {
    throw reject("invalid_deadline");
  }
  if (request.restoreAt !== request.startedAt + RESTORE_START_MS ||
      request.deadlineAt !== request.startedAt + HARD_DEADLINE_MS ||
      request.restoreAt >= request.deadlineAt) {
    throw reject("deadline_policy_mismatch");
  }
}

export function createIsolatedWatchdog({
  now = () => Date.now(),
  readTarget,
  restoreTarget,
  audit = () => {},
  initialState
} = {}) {
  if (typeof readTarget !== "function" || typeof restoreTarget !== "function") {
    throw new TypeError("readTarget and restoreTarget are required");
  }
  let state = initialState ? structuredClone(initialState) : null;

  const writeAudit = (event, extra = {}) => {
    try { audit({ event, ...extra }); } catch { /* audit cannot block safety */ }
  };

  async function arm(request) {
    validateRequest(request);
    if (state) {
      if (state.canaryId !== request.canaryId) throw reject("immutable_canary_conflict");
      return { ok: true, code: "already_armed", state: safeState(state) };
    }
    state = {
      ...request,
      status: "armed",
      restoreAttempts: 0,
      restoredAt: null
    };
    writeAudit("armed", { canaryId: state.canaryId });
    return { ok: true, code: "armed", state: safeState(state) };
  }

  async function restoreIfDue(reason = "scheduled") {
    if (!state) throw reject("not_armed");
    if (state.status === "restored") return { ok: true, code: "already_restored", state: safeState(state) };
    if (state.status === "failed") return { ok: false, code: "restore_failed_closed", state: safeState(state) };
    if (now() < state.restoreAt) return { ok: true, code: "not_due", state: safeState(state) };

    state.restoreAttempts += 1;
    writeAudit("restore_started", { canaryId: state.canaryId, reason });
    try {
      await restoreTarget({
        target: state.target,
        baseline: state.baseline,
        candidate: state.candidate,
        canaryId: state.canaryId
      });
      const readback = await readTarget();
      if (readback?.target !== state.target || readback?.baseline !== state.baseline ||
          readback?.candidate !== state.candidate || readback?.baselinePercent !== 100 ||
          readback?.candidatePercent !== 0) {
        throw reject("restore_readback_mismatch");
      }
      state.status = "restored";
      state.restoredAt = now();
      writeAudit("restore_verified", { canaryId: state.canaryId });
      return { ok: true, code: "restored", state: safeState(state) };
    } catch (error) {
      state.status = "failed";
      writeAudit("restore_failed", { canaryId: state.canaryId, code: error?.code ?? "restore_error" });
      return { ok: false, code: error?.code ?? "restore_error", state: safeState(state) };
    }
  }

  return {
    arm,
    status: () => state ? safeState(state) : { status: "unarmed" },
    restoreIfDue
  };
}

