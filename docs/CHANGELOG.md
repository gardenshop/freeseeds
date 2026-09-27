# Changelog

## Unreleased - 2026-09-27

- Superseded existing-number assumption with a mandatory new WhatsApp number supplied later by the user.
- Added `WHATSAPP_NUMBER_PENDING` deployment state.
- Prohibited all existing, test, Hoja Seeds, Garden Shop, and other numbers/WABAs until explicit onboarding.
- Added Mock/Meta WhatsApp provider boundary requirement.
- Added versioned five-field Flow and future onboarding runbook requirement.
- Created and locked the dedicated clean Cloudflare account ID `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- Provisioned isolated staging D1, private R2, Queue, and DLQ; recorded real IDs.
- Deployed staging API/admin Workers and verified public API plus Access-protected admin health endpoints.
- Recorded GitHub push blocker: target repository denied the authenticated `ai-photo-studio` identity with HTTP 403; no access controls were bypassed.
- Repaired GitHub authentication to `gardenshop`, pushed both branches, opened PR #1, and re-verified clean Cloudflare resources and Access behavior.
- Hardened provider, receipt, admin approval/rejection, queue retry, and CAPI boundaries; expanded automated coverage to 16 passing tests.
- Added minimal GitHub Actions CI for install, test, build, and lint; confirmed PR #1 is currently mergeable and clean.
- Upgraded Vitest to 5.0.2 to remove the dev-only audit advisory; full dependency audit is clean with no test/build/lint regression.
- GitHub CI was triggered successfully but blocked before job start by the account billing lock; recorded as an external gate without bypassing billing controls.
- Added D1/R2 backend-managed payment configuration, private QR upload/replacement, TILL/instruction controls, audited admin updates, payment selection, and receipt-request outbox behavior. All methods remain disabled until verified values are supplied.
- Applied payment configuration migration to clean staging D1 and deployed payment-aware API/admin Workers; remote methods verified disabled with null recipient/TILL/QR values.
- Redeployed latest payment-aware API/admin versions after provider and payment-selection hardening; staging bindings remain isolated to the clean account.
- Locked authenticated browser profile/tab-reuse protocol and reclassified GitHub Actions billing as `REMOTE_CI_UNAVAILABLE_NON_BLOCKING`; local quality checks remain active.
- Created isolated production D1/R2/Queue/DLQ resources and committed production-only Wrangler bindings without deploying Workers or connecting Meta/WhatsApp.
- Applied production D1 migrations 0001/0002 and verified all payment methods remain disabled with no recipient values.
- Recorded verified production Queue/DLQ IDs in the resource registry.
- Added `STAGING_WABA_TEST_ALLOWED`: clean Meta-provided WABA/test number is permitted only for synthetic staging tests; production number and all prohibited assets remain locked.
- Audited Meta developer/business UI without mutation; clean staging portfolio creation is blocked by Meta business-portfolio limit, and all existing Hoja-linked assets remain excluded.
- Ran deployed synthetic staging smoke through Flow, all payment methods, receipt request, mock media, private R2, and `PAYMENT_REVIEW`; repaired two audit SQL placeholder defects and restored test data/configuration.
- Pushed `codex/gfs-waba-test-002` from merged main and opened PR #2; real clean WABA E2E remains blocked by Meta portfolio limit.
- Verified `Garden Shop OK` is not clean because its visible assets include a Hoja Seeds ad account; no existing Meta portfolio was selected.
