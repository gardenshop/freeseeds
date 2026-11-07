import { open, readFile, unlink } from "node:fs/promises";
import process from "node:process";
import { appendDiagnostic, errorCode, newCorrelationId } from "./canary-diagnostics.mjs";

const DEFAULTS = Object.freeze({
  scope: "all",
  durationMs: 15 * 60 * 1000,
  restoreMarginMs: 60 * 1000,
  pollIntervalMs: 1000,
  pollTimeoutMs: 5000,
  commandTimeoutMs: 5000,
  targetCandidatePercent: 1
});

const CONTROL_EVENTS = new Set([
  "lock_acquired",
  "lock_rejected",
  "route_started",
  "route_failed",
  "candidate_observed",
  "monitor_failed",
  "restore_started",
  "restore_failed",
  "restore_verified",
  "health_unknown",
  "deadline_reached",
  "release_complete",
  "release_failed"
]);

class ControllerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function monotonicMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function safeAudit(audit, event, fields = {}) {
  if (!CONTROL_EVENTS.has(event)) return;
  const safe = { event };
  for (const key of ["elapsedMs", "remainingMs", "reason", "code", "stage", "operation", "errorClass", "httpStatus", "attempt", "correlationId"]) {
    if (key in fields) {
      if (typeof fields[key] === "number") safe[key] = Math.max(0, Math.round(fields[key]));
      else safe[key] = /^[a-z0-9_:-]{1,40}$/i.test(String(fields[key])) ? String(fields[key]) : "unclassified";
    }
  }
  try {
    audit(safe);
  } catch {
    // Audit sinks must never prevent a safety rollback.
  }
}

function abortError(signal) {
  return signal?.reason instanceof ControllerError ? signal.reason : new ControllerError("interrupted");
}

async function bounded(operation, timeoutMs, parentSignal) {
  if (parentSignal?.aborted) throw abortError(parentSignal);
  const controller = new AbortController();
  let rejectParent;
  const parentAbort = new Promise((_, reject) => { rejectParent = reject; });
  const onAbort = () => {
    controller.abort(parentSignal.reason);
    rejectParent(abortError(parentSignal));
  };
  parentSignal?.addEventListener("abort", onAbort, { once: true });
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort(new ControllerError("command_timeout"));
        reject(new ControllerError("command_timeout"));
      }, Math.max(1, timeoutMs));
    });
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout, parentAbort]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

function trafficIsBaseline(traffic, scope = "all") {
  const apiBaseline = traffic.apiCandidatePercent === 0 && traffic.apiBaselinePercent === 100;
  const adminBaseline = traffic.adminCandidatePercent === 0 && traffic.adminBaselinePercent === 100;
  return apiBaseline && adminBaseline &&
    healthIsSafe(traffic);
}

function trafficHasCandidate(traffic, target, scope = "all") {
  const apiCandidate = traffic.apiCandidatePercent >= target && traffic.apiBaselinePercent <= 100 - target;
  const adminFrozen = traffic.adminCandidatePercent === 0 && traffic.adminBaselinePercent === 100;
  const adminCandidate = traffic.adminCandidatePercent >= target && traffic.adminBaselinePercent <= 100 - target;
  const apiFrozen = traffic.apiCandidatePercent === 0 && traffic.apiBaselinePercent === 100;
  return (scope === "api" ? apiCandidate && adminFrozen : scope === "admin" ? adminCandidate && apiFrozen : apiCandidate && adminCandidate) &&
    healthIsSafe(traffic);
}

function healthIsSafe(traffic) {
  const health = traffic?.health;
  const api = health?.api;
  const admin = health?.admin;
  return health?.source === "cloudflare_graphql_http" &&
    api?.httpStatus === 200 && admin?.httpStatus === 200 &&
    Number.isInteger(api.errors) && api.errors >= 0 &&
    Number.isInteger(admin.errors) && admin.errors >= 0 &&
    Number.isInteger(api.requests) && api.requests >= 0 &&
    Number.isInteger(admin.requests) && admin.requests >= 0 &&
    Number.isFinite(api.latencyMs) && api.latencyMs >= 0 &&
    Number.isFinite(admin.latencyMs) && admin.latencyMs >= 0 &&
    api.errors === 0 && admin.errors === 0;
}

async function acquireLock(lockPath, metadata, audit) {
  try {
    const handle = await open(lockPath, "wx");
    await handle.writeFile(JSON.stringify(metadata));
    await handle.close();
    safeAudit(audit, "lock_acquired");
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(lockPath, "utf8"));
    } catch {
      throw new ControllerError("overlap_lock");
    }
    // A live owner always wins. An interrupted owner leaves a lock and fails closed;
    // an operator may remove it after verifying that the recorded PID is gone.
    if (existing?.pid && existing.pid !== process.pid) {
      try {
        process.kill(existing.pid, 0);
      } catch (probeError) {
        if (probeError?.code === "ESRCH") throw new ControllerError("stale_lock_manual_clear");
      }
    }
    safeAudit(audit, "lock_rejected", { reason: "overlap" });
    throw new ControllerError("overlap_lock");
  }
}

export async function runCanary(options = {}) {
  const config = { ...DEFAULTS, ...options };
  if (config.scope !== "all" && config.scope !== "api" && config.scope !== "admin") throw new TypeError("invalid canary scope");
  const now = config.now ?? monotonicMs;
  const sleep = config.sleep ?? ((ms, signal) => bounded((sleepSignal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    sleepSignal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError(sleepSignal));
    }, { once: true });
  }), ms + 1, signal));
  const execute = config.execute;
  const readTraffic = config.readTraffic;
  const audit = config.audit ?? (() => {});
  const signal = config.signal;
  const correlationId = config.correlationId ?? newCorrelationId();
  const diagnosticPath = config.diagnosticPath;
  if (typeof execute !== "function" || typeof readTraffic !== "function") throw new TypeError("execute and readTraffic are required");
  if (config.durationMs <= config.restoreMarginMs || config.restoreMarginMs < 1) throw new TypeError("invalid deadline margin");
  if (config.targetCandidatePercent <= 0 || config.targetCandidatePercent >= 100) throw new TypeError("invalid candidate percentage");

  const lockPath = config.lockPath;
  const startedAt = now();
  const hardDeadline = startedAt + config.durationMs;
  const restoreDeadline = hardDeadline - config.restoreMarginMs;
  let lockHeld = false;
  let lockRejected = false;
  let rollbackVerified = false;
  let rollbackAttempted = false;
  let routeMayHaveChanged = false;

  const result = (ok, code, extra = {}) => ({
    ok,
    code,
    startedAtMs: startedAt,
    hardDeadlineMs: hardDeadline,
    restoreDeadlineMs: restoreDeadline,
    ...extra
  });
  const remaining = (limit) => Math.max(1, Math.floor(limit - now()));
  const invoke = (action, limit, parentSignal = signal) => bounded((actionSignal) => execute(action, { signal: actionSignal }), Math.min(config.commandTimeoutMs, remaining(limit)), parentSignal);
  const read = (limit, parentSignal = signal) => bounded((readSignal) => readTraffic({ signal: readSignal }), Math.min(config.pollTimeoutMs, remaining(limit)), parentSignal);
  const recordDiagnostic = async (error, details = {}) => {
    try {
      await appendDiagnostic(diagnosticPath, { error, details: { correlationId, elapsedMs: now() - startedAt, ...details } });
    } catch {
      // Diagnostics must never prevent a safety rollback.
    }
  };

  async function restore(reason) {
    rollbackAttempted = true;
    safeAudit(audit, "restore_started", { reason, elapsedMs: now() - startedAt, remainingMs: hardDeadline - now() });
    let commandError = null;
    try {
      // A cancellation must stop exposure but never cancel the compensating rollback.
      await invoke("restore_baseline", hardDeadline, null);
    } catch (error) {
      commandError = error;
      await recordDiagnostic(error, { stage: "rollback", operation: "restore_command" });
      safeAudit(audit, "restore_failed", { reason: "command", code: errorCode(error, "watchdog_restoration_failed"), stage: "rollback", operation: "restore_command", correlationId });
    }
    let retryIssued = false;
    while (now() <= hardDeadline) {
      let traffic;
      try {
        traffic = await read(hardDeadline, null);
      } catch (error) {
        await recordDiagnostic(error, { stage: "rollback", operation: "restore_readback" });
        safeAudit(audit, "restore_failed", { reason: "readback", code: errorCode(error, "watchdog_restoration_failed"), stage: "rollback", operation: "restore_readback", correlationId });
        if (now() >= hardDeadline) break;
        await sleep(Math.min(config.pollIntervalMs, remaining(hardDeadline)), null);
        continue;
      }
      if (trafficIsBaseline(traffic)) {
        rollbackVerified = true;
        safeAudit(audit, "restore_verified", { elapsedMs: now() - startedAt, remainingMs: hardDeadline - now() });
        return;
      }
      if (commandError && !retryIssued) {
        retryIssued = true;
        commandError = null;
        try {
          await invoke("restore_baseline", hardDeadline, null);
        } catch (error) {
          commandError = error;
          await recordDiagnostic(error, { stage: "rollback", operation: "restore_retry" });
          safeAudit(audit, "restore_failed", { reason: "retry_command", code: errorCode(error, "watchdog_restoration_failed"), stage: "rollback", operation: "restore_retry", correlationId });
        }
      }
      if (now() >= hardDeadline) break;
      await sleep(Math.min(config.pollIntervalMs, remaining(hardDeadline)), null);
    }
    safeAudit(audit, "restore_failed", { reason: "deadline", code: "rollback_unverified" });
    throw new ControllerError("rollback_unverified");
  }

  try {
    if (lockPath) {
      try {
        await acquireLock(lockPath, { pid: process.pid, startedAt: Date.now(), maxDurationMs: config.durationMs }, audit);
      } catch (error) {
        lockRejected = true;
        throw error;
      }
      lockHeld = true;
    }
    let initial;
    try { initial = await read(restoreDeadline); }
    catch (error) {
      await recordDiagnostic(error, { stage: "preflight", operation: "initial_readback" });
      throw error;
    }
    if (!trafficIsBaseline(initial, config.scope)) {
      safeAudit(audit, "health_unknown", { reason: initial?.health ? "unhealthy" : "unavailable", code: "initial_readback_failed" });
      throw new ControllerError(initial?.health ? "initial_readback_failed" : "health_unavailable");
    }
    safeAudit(audit, "route_started", { remainingMs: restoreDeadline - now(), correlationId });
    routeMayHaveChanged = true;
    await invoke("expose_candidate", restoreDeadline);
    if (now() >= restoreDeadline) {
      safeAudit(audit, "deadline_reached", { reason: "route_timeout", elapsedMs: now() - startedAt });
      throw new ControllerError("deadline_missed");
    }

    let candidateObserved = false;
    while (now() < restoreDeadline) {
      let traffic;
      try { traffic = await read(restoreDeadline); }
      catch (error) {
        await recordDiagnostic(error, { stage: "monitor", operation: "candidate_readback" });
        safeAudit(audit, "monitor_failed", { reason: "readback", code: errorCode(error), stage: "monitor", operation: "candidate_readback", correlationId });
        throw error;
      }
      if (!healthIsSafe(traffic)) {
        safeAudit(audit, "health_unknown", { reason: traffic?.health ? "unhealthy" : "unavailable", code: "health_unavailable", stage: "monitor", operation: "health_validate", correlationId });
        throw new ControllerError(traffic?.health ? "provider_5xx" : "health_unavailable");
      }
      if (traffic.health.api.errors > 0 || traffic.health.admin.errors > 0) {
        safeAudit(audit, "monitor_failed", { reason: "provider_5xx", code: "provider_5xx", stage: "monitor", operation: "metrics_validate", correlationId });
        throw new ControllerError("provider_5xx");
      }
      if (trafficHasCandidate(traffic, config.targetCandidatePercent, config.scope)) {
        if (!candidateObserved) safeAudit(audit, "candidate_observed", { elapsedMs: now() - startedAt });
        candidateObserved = true;
      }
      if (candidateObserved && now() >= restoreDeadline - config.pollIntervalMs) break;
      await sleep(Math.min(config.pollIntervalMs, remaining(restoreDeadline)), signal);
    }
    if (!candidateObserved) throw new ControllerError("routing_not_observed");
    safeAudit(audit, "deadline_reached", { reason: "restore_margin", elapsedMs: now() - startedAt });
    await restore("scheduled_restore");
    const verifiedAt = now();
    if (verifiedAt > hardDeadline) return result(false, "deadline_missed", { rollbackVerified, rollbackAttempted });
    safeAudit(audit, "release_complete", { elapsedMs: verifiedAt - startedAt });
    return result(true, "complete", { rollbackVerified, rollbackAttempted, verifiedAtMs: verifiedAt, strictCapCompliant: true });
  } catch (error) {
    const code = errorCode(error);
    await recordDiagnostic(error, { stage: routeMayHaveChanged ? "canary" : "preflight", operation: "controller" });
    if (lockRejected) {
      safeAudit(audit, "release_failed", { reason: "lock", code, stage: "controller", operation: "lock", correlationId });
      return result(false, code, { rollbackVerified, rollbackAttempted });
    }
    if (routeMayHaveChanged && !rollbackVerified) {
      try {
        await restore(code);
      } catch (rollbackError) {
        const rollbackCode = errorCode(rollbackError, "watchdog_restoration_failed");
        await recordDiagnostic(rollbackError, { stage: "rollback", operation: "rollback_final" });
        safeAudit(audit, "release_failed", { reason: "rollback", code: rollbackCode, stage: "rollback", operation: "rollback_final", correlationId });
        return result(false, rollbackCode, { rollbackVerified, rollbackAttempted });
      }
    }
    safeAudit(audit, "release_failed", { reason: "guard", code, stage: "controller", operation: "guard", correlationId });
    return result(false, code, { rollbackVerified, rollbackAttempted });
  } finally {
    if (lockHeld && (rollbackVerified || !routeMayHaveChanged)) {
      try {
        await unlink(lockPath);
      } catch {
        // Keeping an unreadable lock is safer than deleting another owner's lock.
      }
    }
  }
}

export { ControllerError, trafficIsBaseline };
