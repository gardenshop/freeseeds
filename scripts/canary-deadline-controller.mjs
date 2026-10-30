import { open, readFile, unlink } from "node:fs/promises";
import process from "node:process";

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
  for (const key of ["elapsedMs", "remainingMs", "reason", "code"]) {
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
    (traffic.api5xx ?? 0) === 0 && (traffic.admin5xx ?? 0) === 0;
}

function trafficHasCandidate(traffic, target, scope = "all") {
  const apiCandidate = traffic.apiCandidatePercent >= target && traffic.apiBaselinePercent <= 100 - target;
  const adminFrozen = traffic.adminCandidatePercent === 0 && traffic.adminBaselinePercent === 100;
  return (scope === "api" ? apiCandidate && adminFrozen : apiCandidate && traffic.adminCandidatePercent >= target) &&
    traffic.api5xx === 0 && traffic.admin5xx === 0;
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
  if (config.scope !== "all" && config.scope !== "api") throw new TypeError("invalid canary scope");
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

  async function restore(reason) {
    rollbackAttempted = true;
    safeAudit(audit, "restore_started", { reason, elapsedMs: now() - startedAt, remainingMs: hardDeadline - now() });
    try {
      // A cancellation must stop exposure but never cancel the compensating rollback.
      await invoke("restore_baseline", hardDeadline, null);
    } catch (error) {
      safeAudit(audit, "restore_failed", { reason: "command", code: error?.code ?? "restore_error" });
      throw new ControllerError("rollback_failed");
    }
    while (now() <= hardDeadline) {
      let traffic;
      try {
        traffic = await read(hardDeadline, null);
      } catch (error) {
        safeAudit(audit, "restore_failed", { reason: "readback", code: error?.code ?? "readback_error" });
        throw new ControllerError("rollback_unverified");
      }
      if (trafficIsBaseline(traffic)) {
        rollbackVerified = true;
        safeAudit(audit, "restore_verified", { elapsedMs: now() - startedAt, remainingMs: hardDeadline - now() });
        return;
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
    const initial = await read(restoreDeadline);
    if (!trafficIsBaseline(initial, config.scope)) throw new ControllerError("initial_readback_failed");
    safeAudit(audit, "route_started", { remainingMs: restoreDeadline - now() });
    await invoke("expose_candidate", restoreDeadline);
    if (now() >= restoreDeadline) {
      safeAudit(audit, "deadline_reached", { reason: "route_timeout", elapsedMs: now() - startedAt });
      throw new ControllerError("deadline_missed");
    }

    let candidateObserved = false;
    while (now() < restoreDeadline) {
      const traffic = await read(restoreDeadline);
      if ((traffic.api5xx ?? 0) > 0 || (traffic.admin5xx ?? 0) > 0) {
        safeAudit(audit, "monitor_failed", { reason: "provider_5xx", code: "provider_5xx" });
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
    const code = error?.code ?? "controller_error";
    if (lockRejected) {
      safeAudit(audit, "release_failed", { reason: "lock", code });
      return result(false, code, { rollbackVerified, rollbackAttempted });
    }
    if (!rollbackVerified) {
      try {
        await restore(code);
      } catch (rollbackError) {
        safeAudit(audit, "release_failed", { reason: "rollback", code: rollbackError?.code ?? "rollback_failed" });
        return result(false, rollbackError?.code ?? "rollback_failed", { rollbackVerified, rollbackAttempted });
      }
    }
    safeAudit(audit, "release_failed", { reason: "guard", code });
    return result(false, code, { rollbackVerified, rollbackAttempted });
  } finally {
    if (lockHeld) {
      try {
        await unlink(lockPath);
      } catch {
        // Keeping an unreadable lock is safer than deleting another owner's lock.
      }
    }
  }
}

export { ControllerError, trafficIsBaseline };
