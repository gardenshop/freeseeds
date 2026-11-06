# COD Settlement SOP

## Private watchdog boundary (2026-11-06 PKT)

The MO rollback watchdog artifact is private and fail-closed: workers.dev and preview URLs are disabled, no routes or Cron are configured before credential verification, HTTP is deny-all, and the default state is DISARMED. External creation, scoped credential provisioning, secret injection and independent Cron proof remain separate gates. Never substitute a public Hello World deployment or the Admin recovery credential for the new Worker-only deployment credential.

## Deployment-readiness boundary (2026-11-06 PKT)

The final Admin deployment credential is Worker-scoped and verified for read-only deployment access. Aggregate Analytics is supporting evidence only; candidate-specific live telemetry is required before any Admin canary. Never treat aggregate zero errors as candidate zero errors. Bootstrap credentials are retired only after final verification, with secret values excluded from all records.

## GFS-COD-MO-25 migration 0048 completion (2026-11-05 PKT)

Migration 0048 is applied once under the documented one-time alternative gate. The historical ledger starts empty; unique HMAC, immutable receipt controls and the exact historical amount guard are verified. Normal Service Auth health remains unverified and must not be represented as HTTP200. No real MO settlement is implied; candidate release and settlement require separate authorization.

## GFS-COD-MO-24 bridge invocation gate (2026-11-05 PKT)

The approved host-side bridge must be invoked in its authorized Windows context and may return only sanitized HTTP status and health fields. Chrome DevTools MCP/dashboard access does not substitute for the bridge. A visible system process without an approved invocation interface must not be impersonated, elevated, or invoked blindly. Keep migration0048 blocked until authorized Admin `/health` HTTP200 is independently evidenced.

## GFS-COD-MO-23 health-monitor bridge gate (2026-11-05 PKT)

The `/health` qualification must use the existing approved Service Auth bridge. If its credential target is unavailable, record `credential_read_failed` and stop. Never print, copy, export, rotate, regenerate, or bypass the credential. Browser/invalid HTTP403 is a security-boundary result, not application health evidence. Migration 0048 remains blocked until an authorized HTTP200 is obtained through the approved bridge.

## GFS-COD-MO-22 readiness gate (2026-11-05 PKT)

Configured Admin routing is reconciled to candidate 100%; the dashboard 94.5/5.5 display is historical observed traffic. `/health` remains intentionally Service Auth-protected. Do not apply migration 0048 until an authorized service-auth health 200 is verified through the existing approved bridge.

## GFS-COD-MO-21 routing gate (2026-11-05 PKT)

Do not apply migration 0048 while Admin active provisioning or Access health conflicts with the approved baseline. Resolve routing and `/health` evidence through a separately authorized read-only audit before requesting a new migration window.

## GFS-COD-MO-20 release boundary (2026-11-05 PKT)

The original 0048 migration is blocked before remote execution because it omitted its exact-once schema marker. The marker and cross-ledger duplicate protections are repaired and tested locally only; do not settle real orders or release the repaired source until the repaired migration is separately reviewed and targeted execution is authorized.

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
## GFS-COD-MO-62 watchdog activation boundary (2026-11-06 PKT)

The isolated watchdog may have its protected secret and one-minute Cron configured while remaining DISARMED. Secret injection must use separate process-only inputs: the scoped Worker credential authorizes the API request, and the Admin recovery credential is the secret value. A schedule readback is not proof of execution; require fresh official telemetry and disposable recovery proof before any live canary. If temporary token revocation returns HTTP 403, retain the credential and stop for owner-authorized token-management access.
