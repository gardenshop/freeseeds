# COD Settlement SOP

## GFS-COD-MO-88 isolated preview gate (2026-11-07 PKT)

The historical MO candidate must be built from the live-compatible Admin baseline plus only the guarded historical MO UI/route and its required dependencies. Do not upload the auto-update-only candidate or broad PR11. Migration 0048 is already applied once; do not rerun it. The approved host runner must recheck identity, token validity and the exact artifact digest, then use `VERSIONS_UPLOAD_ONLY`; this does not deploy or alter routing. CAPI remains OFF and a real MO settlement still requires genuine evidence and separate authorization.

## Private watchdog boundary (2026-11-06 PKT)

The MO rollback watchdog artifact is private and fail-closed: workers.dev and preview URLs are disabled, no routes or Cron are configured before credential verification, HTTP is deny-all, and the default state is DISARMED. External creation, scoped credential provisioning, secret injection and independent Cron proof remain separate gates. Never substitute a public Hello World deployment or the Admin recovery credential for the new Worker-only deployment credential.

## Deployment-readiness boundary (2026-11-06 PKT)

The final Admin deployment credential is Worker-scoped and verified for read-only deployment access. Aggregate Analytics is supporting evidence only; candidate-specific live telemetry is required before any Admin canary. Never treat aggregate zero errors as candidate zero errors. Bootstrap credentials are retired only after final verification, with secret values excluded from all records.

## GFS-COD-MO-25 migration 0048 completion (2026-11-05 PKT)

Migration 0048 is applied once under the documented one-time alternative gate. The historical ledger starts empty; unique HMAC, immutable receipt controls and the exact historical amount guard are verified. Normal Service Auth health remains unverified and must not be represented as HTTP200. No real MO settlement is implied; candidate release and settlement require separate authorization.

## GFS-COD-MO-24 bridge invocation gate (2026-11-05 PKT)

The approved host-side bridge must be invoked in its authorized Windows context and may return only sanitized HTTP status and health fields. Chrome DevTools MCP/dashboard access does not substitute for the bridge. A visible system process without an approved invocation interface must not be impersonated, elevated, or invoked blindly. This was the pre-migration gate; migration0048 is now applied exactly once. Keep protected `/health` status separately recorded as unverified.

## GFS-COD-MO-23 health-monitor bridge gate (2026-11-05 PKT)

Historical pre-migration gate: the `/health` qualification must use the existing approved Service Auth bridge. If its credential target is unavailable, record `credential_read_failed` and stop. Never print, copy, export, rotate, regenerate, or bypass the credential. Browser/invalid HTTP403 is a security-boundary result, not application health evidence. Migration0048 was subsequently applied once under the authorized alternative gate; do not rerun it.

## GFS-COD-MO-22 readiness gate (2026-11-05 PKT)

Historical routing/readiness note. `/health` remains intentionally Service Auth-protected and its protected HTTP200 remains separately unverified. Migration0048 is already applied exactly once; never apply it again merely to satisfy this superseded gate.

## GFS-COD-MO-21 routing gate (2026-11-05 PKT)

Historical pre-execution rule: do not apply migration0048 while Admin active provisioning or Access health conflicts with the approved baseline. The authorized migration window completed once; resolve any future routing or `/health` question through a separate read-only audit and do not rerun the migration.

## GFS-COD-MO-20 release boundary (2026-11-05 PKT)

Historical pre-execution record: the original 0048 migration omitted its exact-once schema marker. The repaired marker and cross-ledger duplicate protections were reviewed, targeted execution was authorized, and 0048 was applied once. Do not rerun the migration or settle real orders without separate authorization.

## Historical Pakistan Post MO

This SOP is source-ready but not released until migration 0048 and the Admin candidate are separately authorized.

1. Match the exact order in authenticated Admin. A phone match alone is insufficient.
2. Confirm the order is unpaid, unarchived, not cancelled or held, has delivered state and assigned tracking, and has no COD sidecar.
3. Preserve the original payment method, quote, Advance receipts and review history. Do not add the PKR125 COD fee to a historical order.
4. Verify the genuine Pakistan Post MO and private company-receipt evidence. Record only HMACs and the operator-entered reason/reference; never store the raw MO number in Git, logs or reports.
5. Submit the guarded historical form with the exact original payable, receipt date, evidence reference, reason and exact order-number confirmation.
6. The atomic path writes one immutable historical ledger row, marks the order PAID, and writes one audit entry. It does not rewrite the payment row or queue CAPI.
7. Stop on missing evidence, amount mismatch, pending Advance receipt, verified Advance payment, duplicate MO, concurrency conflict, or any state/hold mismatch. Do not force PAID or use direct D1 SQL.

Current status: local implementation and tests PASS; migration 0048, candidate upload, deployment and genuine settlement remain pending separate authorization and evidence.

## GFS-COD-MO-65 watchdog rollback protocol

The isolated watchdog is route-free and DISARMED by default. An approved arm requires protected runtime values for the exact account, Admin Worker, baseline/candidate versions, UTC start/deadline, and recovery-token expiry with safety margin. At deadline, recovery submits only the exact baseline version at 100%; the 0% candidate is omitted. Readback must confirm the baseline-only state or the prior validated 100/0 state. Unknown drift, expired configuration, insufficient token window, or failed readback fails closed. Scheduled execution evidence does not prove real rollback; disposable restoration must be separately authorized and proven before any live Admin canary.

For disposable rollback proof, use a separate private Worker and target-only Editor credential. Keep the production `ADMIN_RECOVERY_TOKEN` out of the disposable target. Verify zero routes/bindings/Cron before uploading harmless A/B versions; restore only the disposable baseline, confirm readback, then clean up the test resource. A missing target credential blocks the proof and must not be replaced with a broad account token.

MO-66B evidence: disposable A90/B10 and A100 single-version restore were proven through official deployment readback; a guarded repeat performed no write. This validates the deployment API path only, not automatic production watchdog recovery.
## GFS-COD-MO-62 watchdog activation boundary (2026-11-06 PKT)

The isolated watchdog may have its protected secret and one-minute Cron configured while remaining DISARMED. Secret injection must use separate process-only inputs: the scoped Worker credential authorizes the API request, and the Admin recovery credential is the secret value. A schedule readback is not proof of execution; require fresh official telemetry and disposable recovery proof before any live canary. If temporary token revocation returns HTTP 403, retain the credential and stop for owner-authorized token-management access.

## GFS-COD-MO-67B dry-run boundary (2026-11-07 PKT)

The watchdog `DRY_RUN` state requires `WATCHDOG_DRY_RUN_EXPIRES_AT` no more than five minutes after start and before the recovery deadline. It may perform the authenticated Admin deployment GET and return `already_restored`, but must never issue a deployment POST. Missing, expired, overlong, or drifted windows fail closed. If official telemetry cannot expose the sanitized scheduled outcome, disarm immediately and classify runtime proof INCONCLUSIVE.

The watchdog `DRY_RUN` state is the only permitted pre-canary runtime probe. At its fixed deadline it performs an authenticated GET of the exact Admin deployment and returns `already_restored` only for baseline100%; it must never submit a deployment POST. Runtime logging is sanitized to status/code/wrote/timestamp. If official tail or version-labelled telemetry cannot expose that outcome, classify the probe INCONCLUSIVE, disarm immediately, and do not run an Admin canary.
## GFS-COD-MO-67C observability boundary

Enable Workers Logs only on the private watchdog when authorized; keep Traces, Issues and Logpush off unless separately approved. Configuration and a generic scheduled invocation do not prove the DRY_RUN result. Require a version-attributed scheduled event plus the sanitized application result `status=DRY_RUN`, `code=already_restored`, `wrote=false`, and timestamp. If the official event view exposes only the invocation envelope, classify the DRY_RUN INCONCLUSIVE and disarm immediately. The final disarmed readback must show 100% watchdog routing, no arm variables, the named recovery-secret binding, and unchanged Admin 100/0 routing.
## GFS-COD-MO-67D query limitation

The supported dashboard Query Builder must return the sanitized application record for the exact DRY_RUN version before runtime proof is accepted. A successful query response with zero rows, or a Live invocation envelope without application fields, is insufficient. Do not inspect browser request headers/cookies or bypass the dashboard query path; if the version-indexed query returns zero for known scheduled records, stop without another DRY_RUN and report the ingestion/indexing blocker.

## GFS-COD-MO-68 Cloudflare escalation boundary (2026-11-07 PKT)

Cloudflare Support case [#02421284](https://www.support.cloudflare.com/s/case/500j2000000tULdAAM) is the private escalation for missing scheduled application-log delivery. Logs, invocation logs, dashboard persistence and 100% sampling were verified enabled on the isolated watchdog before submission. The case does not authorize a setting change, DRY_RUN, Admin canary or settlement action. Resume runtime proof only after Cloudflare supplies a supported correction and a separately authorized release gate is confirmed.

## GFS-COD-MO-69 support and lead-readiness boundary (2026-11-07 PKT)

Check case #02421284 once per authorized task; a **New/Pending** case is not runtime evidence and freezes MO logging, DRY_RUN and canary work. Read-only API health, authenticated Orders/Conversations, payment methods, COD PKR125 and province-rate reads may establish existing operational health only. Meta campaign visibility does not prove sender eligibility or readiness to scale. Queue/DLQ counters must remain explicitly UNVERIFIED when unavailable. Do not alter Admin auto-update, campaigns, sender, CAPI, payments or customer state without separate authorization.

## Lead operations protection during MO freeze

Queue counters may be recorded read-only but do not substitute for a verified consumer binding. Meta campaign visibility does not establish sender or click-to-WhatsApp eligibility. No MO, CAPI, payment, customer-message or advertising mutation is allowed while the support gate is pending.

## Admin auto-update release boundary

The Orders auto-update repair must be released from a source-isolated Admin candidate based on the live-compatible baseline. Do not upload a broad tree that adds frozen historical-MO behavior. Keep Admin baseline 100%, candidate 0%, API unchanged, and require authenticated 0% preview plus rollback readback before any exposure.

## GFS-COD-MO-73 final MO/CAPI settlement gate

Historical MO confirmation requires genuine delivered status with assigned tracking, exact original payable, private evidence and operator confirmation. The guarded transaction records the immutable receipt, marks the correct order PAID, and—only when CAPI is enabled—creates one idempotent durable `CAPI_PURCHASE` outbox record after PAID. Queue or Meta failure must not undo PAID; the outbox remains authoritative. CAPI is OFF in production. Never claim live settlement or Meta acknowledgement without approved deployment, genuine evidence and provider acknowledgement.

## GFS-COD-MO-74 deployment bridge gate

The health/analytics Credential Manager wrapper is not a Worker deployment bridge. Do not pass deployment credentials through it, the browser, MCP output or a guessed Wrangler command. Require the approved host-side `bi\\nazim` deployment runner to inject the scoped Admin credential process-only and return sanitized version/deployment readback before any isolated MO preview.

The Cloudflare dashboard `Edit code` control is not accepted as a zero-traffic upload path unless the supported operation and exact routing effect are independently read back. If MCP safety blocks the control, stop; do not use DOM/CDP/API workarounds.
