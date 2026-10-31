import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const MAX_RECORDS = 64;
const SAFE_CODE = /^[a-z0-9_:-]{1,48}$/i;
const SAFE_CLASS = /^[A-Za-z0-9_.$:-]{1,48}$/;

export const DIAGNOSTIC_CODES = Object.freeze([
  "graphql_http200_errors", "graphql_empty_rows", "graphql_invalid_response", "graphql_http_failure",
  "graphql_timeout", "graphql_network_error", "metrics_auth_unavailable", "health_unavailable",
  "wrangler_authentication", "wrangler_timeout", "wrangler_invalid_response", "unknown_routing_version",
  "monitor_retry_exhausted", "cancellation", "controller_exception", "watchdog_restoration_failed",
  "command_timeout", "provider_5xx", "initial_readback_failed", "overlap_lock", "deadline_missed",
  "rollback_unverified", "routing_not_observed", "health_unknown", "unknown_action", "interrupted"
]);

export function newCorrelationId(prefix = "gfs-canary") {
  return `${prefix}-${randomUUID()}`;
}

export class CanaryDiagnosticError extends Error {
  constructor(code, message = "canary diagnostic failure", details = {}) {
    super(message);
    this.name = "CanaryDiagnosticError";
    this.code = DIAGNOSTIC_CODES.includes(code) ? code : "controller_exception";
    this.diagnostic = { code: this.code, ...details };
  }
}

export function diagnosticError(code, details = {}) {
  return new CanaryDiagnosticError(code, `canary:${code}`, details);
}

export function errorCode(error, fallback = "controller_exception") {
  return DIAGNOSTIC_CODES.includes(String(error?.code ?? "")) ? String(error.code) : fallback;
}

export function diagnosticRecord(error, details = {}) {
  const source = error?.diagnostic ?? {};
  const code = errorCode(error, errorCode(source, "controller_exception"));
  const record = {
    ts: new Date().toISOString(),
    code,
    stage: SAFE_CODE.test(String(details.stage ?? source.stage ?? "unknown")) ? String(details.stage ?? source.stage) : "unknown",
    operation: SAFE_CODE.test(String(details.operation ?? source.operation ?? "unknown")) ? String(details.operation ?? source.operation) : "unknown",
    errorClass: SAFE_CLASS.test(String(details.errorClass ?? source.errorClass ?? error?.name ?? "Error")) ? String(details.errorClass ?? source.errorClass ?? error?.name) : "Error",
    correlationId: SAFE_CODE.test(String(details.correlationId ?? source.correlationId ?? "unknown")) ? String(details.correlationId ?? source.correlationId) : "unknown"
  };
  for (const key of ["httpStatus", "attempt", "elapsedMs"]) {
    const value = details[key] ?? source[key];
    if (Number.isFinite(value)) record[key] = Math.max(0, Math.round(value));
  }
  const causeCode = details.causeCode ?? source.causeCode;
  if (SAFE_CODE.test(String(causeCode ?? ""))) record.causeCode = String(causeCode);
  return record;
}

export async function appendDiagnostic(filePath, record) {
  if (!filePath) return;
  let prior = [];
  try { prior = (await readFile(filePath, "utf8")).split(/\r?\n/).filter(Boolean).slice(-(MAX_RECORDS - 1)); } catch {}
  prior.push(JSON.stringify(diagnosticRecord(record.error ?? record, record.details ?? record)));
  await writeFile(filePath, `${prior.slice(-MAX_RECORDS).join("\n")}\n`, "utf8");
}

export { MAX_RECORDS };
