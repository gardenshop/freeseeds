# Changelog

## Unreleased - 2026-09-28 (GFS-14)

- Added a permanent Chrome DevTools MCP self-recovery protocol covering configuration, process/log/port diagnostics, bridge restart, existing-profile preservation, and proof requirements.
- Recovered and verified the local MCP bridge: Codex/Kilo configuration is present, Chrome `DevToolsActivePort` is live, the existing Default profile is `gisupp@gmail.com`, and fresh Codex MCP `list_pages` returned the existing WhatsApp/Meta tabs.
- Recorded that the active session's static tool registry still requires a fresh MCP-enabled Codex execution; no Meta mutation, secret, OTP, or live integration claim was made.
- Fresh MCP audit completed read-only: existing WhatsApp/Meta tabs were inspected, prohibited Garden Shop context `568026370701542` / ad account `1198439777611633` was confirmed, staging challenge was `Forbidden`, and no number or asset was mutated.
- GFS-15 read-only Creeper Seeds audit found the matching `creeper seeds` ad account (`1198439777611633`) inside prohibited Garden Shop/Hoja portfolio `568026370701542`; the context was excluded and no Meta asset or number was mutated.
- GFS-15 Cloudflare identity check redirected to login as `nazimsaeed@gmail.com` instead of required `gisupp@gmail.com`; deployment and secrets remained untouched.
- GFS-16 enforced service-specific identities: Meta login uses `ayesha.butt55@hotmail.com`; Cloudflare/GitHub/admin remain `gisupp@gmail.com`. Meta email was accepted after logout, but password authentication is pending; no asset mutation occurred.
- GFS-17 authenticated Cloudflare visibly as `gisupp@gmail.com` in clean account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, redeployed staging API version `8daa6dc6-6f56-45a2-b7b9-734a146a6156`, and verified new health gating. Webhook challenge/POST remain intentionally gated until Meta secrets and clean WABA exist.
- GFS-19 verified the Meta blocker without retrying unchanged login: visible Facebook identity is Saeed A Nazim, Ayesha authentication remains `META_AUTH_PASSWORD_REQUIRED`, browser autofill supplied no credential, and no Meta asset changed.
- GFS-20 repaired the dependency audit gate by refreshing locked Wrangler/Miniflare/Undici resolutions; post-repair tests (18/18), build, lint, and audit pass with 0 vulnerabilities.
- GFS-20 merged PR #4 into main at `c46ea1f` after local validation and created fresh branch `codex/gfs-meta-live-005` for any future Meta work.
- GFS-21 reused the current Facebook/Meta session for read-only Creeper Seeds discovery. It confirmed `creeper seeds` ad account `1198439777611633` is inside prohibited Hoja/Garden Shop portfolio `568026370701542`; no logout, new session, or Meta mutation occurred.
- GFS-22 preserved the Saeed session while checking existing profiles/tabs and account chooser state; no Ayesha context or saved credential was available, and no login/session/business mutation occurred.

## Unreleased - 2026-09-28 (GFS-13)

- Audited Git facts: origin/main `aa673e7`, active branch `codex/gfs-whatsapp-prod-004` at `0a52ef3`, PR #4 open and mergeable.
- Corrected stale documentation that said the authorized number was not provided.
- Verified Chrome DevTools MCP is unavailable in the exposed tool set; no Meta/Cloudflare mutation, OTP attempt, secret change, or live integration claim was made.

## Unreleased - 2026-09-28

- Recorded explicit authorization of `+923328883383` for Get Free Seeds / Free Seeds In Pakistan WhatsApp Business Platform onboarding and controlled integration testing.
- Replaced the old `WHATSAPP_NUMBER_PENDING` governance state with `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING` while retaining zero Hoja runtime dependency and payment safety locks.
- Recorded Page ID `101192938541236`, clean-asset onboarding requirements, and the unavailable Chrome DevTools MCP external-evidence gate; no Meta mutation or secret was performed.

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
- Recorded Meta portfolio-limit support case as not created; no existing asset was modified or repurposed.
- Fixed ESLint to ignore managed `.kilo/worktrees` and `.wrangler` directories; final sequential local quality gate is green.
- Merged PR #2 into `main` at `d8b0511`; clean WABA remains the only Meta integration gate.
