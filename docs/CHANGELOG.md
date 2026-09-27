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
