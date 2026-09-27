# Decisions

## 2026-09-27: New WhatsApp Number Required

The earlier assumption to use an existing Garden Shop WhatsApp number is superseded. Production number is **NEW NUMBER TO BE PROVIDED LATER BY USER**. No existing, test, Hoja Seeds, Garden Shop, or other number may be searched for, migrated, registered, connected, or used. Expected deployment state is `WHATSAPP_NUMBER_PENDING`.

## 2026-09-27: Provider Boundary

All WhatsApp behavior is implemented behind `WhatsAppProvider`. `MockWhatsAppProvider` powers local and simulated staging tests. `MetaWhatsAppProvider` is disabled and unconfigured until the new number, clean WABA, approved assets, and secrets exist.

## 2026-09-27: Meta Isolation

The inspected Meta portfolio `568026370701542` is legally Hoja Seeds and is excluded. The supplied Page remains documented input only until independently isolated. No ownership-changing Page action is performed without immediate explicit authorization.

## 2026-09-27: Platform Version

Meta Graph API `v26.0` was visible in official documentation on 2026-09-27. Re-check and update before live CAPI/WhatsApp integration. Cloudflare D1 transactional batches, private R2, Queues retry/DLQ, and Worker-level Access are the selected platform primitives.

## 2026-09-27: Data and Idempotency

D1 is authoritative. Approval, order numbering, webhook replay, CAPI, outbound WhatsApp, and queue work use conditional writes and deterministic keys. External sends are driven by a transactional outbox and scheduled relay.

## 2026-09-27: Dedicated Cloudflare Account

The Cloudflare account `Get Free Seeds` was created and visually verified as separate from the Hoja-linked account. Account ID `cb5066a6d71ecdee0bd7ed8aacb4d3c2` is locked in `rules.md` and the resource registry.

## 2026-09-27: Staging Resources

Created only in the clean account: D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, private R2 `getfreeseeds-receipts-staging`, Queue `getfreeseeds-events-staging`, and DLQ `getfreeseeds-events-staging-dlq`. R2 onboarding was explicitly authorized; current usage is $0.00 and public access remains disabled.

## 2026-09-27: Staging Workers and Access

Deployed public API `getfreeseeds-api-staging` at `https://getfreeseeds-api-staging.get-free-seeds.workers.dev` and admin `getfreeseeds-admin-staging` at `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev`. The admin is protected by Access application `ea91b1bf-02c1-46d3-921a-ea2f507fb150` with email allow policy `b3acdd4f-9767-4d28-a55d-0a8e771d476c`; browser verification returned the admin health response. API health returned `WHATSAPP_NUMBER_PENDING` and Meta provider remains disabled.

## 2026-09-27: GitHub and Infrastructure Re-verification

The incorrect `ai-photo-studio` GitHub credential was removed and browser-confirmed `gardenshop` authentication was completed. Branch `codex/gfs-bootstrap-001` and `main` are pushed to `https://github.com/gardenshop/freeseeds`; PR #1 targets `main`. Cloudflare UI re-confirmed only the clean account, D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, private R2, Queue `7cf7cec60e0d4bd4a0a1e5af41f00dbd`, DLQ `4e0ec3246cc048c8be71cc37ff48f0a7`, and `get-free-seeds.workers.dev` resources.

## 2026-09-27: Backend Hardening

Added production-capable but disabled Meta WhatsApp/CAPI clients, HMAC verification, referral parsing, private receipt R2 storage, admin configuration/rejection/clearer-receipt/receipt-preview paths, atomic approval guards, bounded queue retry/DLQ logic, and focused safeguards. Payment methods remain disabled without verified recipient values.

## 2026-09-27: CI Billing Gate

The requested minimal GitHub Actions workflow is committed and valid. GitHub created the `verify` jobs but did not start them because the account is locked due to a billing issue. Preserve the workflow and do not bypass, alter billing, or weaken required checks; rerun after the external account gate is resolved.

## 2026-09-27: Backend-Managed Payment Configuration

Customer-visible JazzCash, Easypaisa, and Bank Transfer values are controlled by D1 `payment_methods`, edited only through the Access-protected admin Worker and audited. QR binaries are private R2 objects under `payment-qr/`; methods seed disabled and incomplete. No recipient, TILL/TIL, QR, or instruction values are stored in source, Worker variables, Flow JSON, templates, or frontend strings.

## 2026-09-27: Production Resource Preparation

Created only non-secret isolated production D1/R2/Queue/DLQ resources in the clean Get Free Seeds account, applied migrations 0001/0002, and committed separate Wrangler bindings. Production Worker deployment, Access application, secrets, callbacks, and Meta/WhatsApp integration remain intentionally gated by the new number and clean asset approvals.

## 2026-09-27: Browser and Remote CI Protocol

Dashboard automation uses Chrome DevTools MCP with the authenticated `gisupp@gmail.com` profile, reuses same-task tabs, avoids duplicate service tabs, and verifies account identity before mutations. GitHub Actions billing is optional and not a launch blocker; local release checks remain authoritative while remote CI is unavailable (`REMOTE_CI_UNAVAILABLE_NON_BLOCKING`).

## 2026-09-27: Clean WABA Staging Test Allowed

`STAGING_WABA_TEST_ALLOWED` is now permitted by explicit user decision. A Meta-provided clean test WABA/test number may connect only to staging for synthetic webhook, Flow, message, media, and CAPI test events after visible ownership verification. Hoja-linked, old Garden Shop, Meta test `+1 555-897-9372`, production, real-customer, real-payment, and ad use remain forbidden. Production stays `WHATSAPP_NUMBER_PENDING`.

## 2026-09-27: Clean WABA Portfolio Gate

Meta UI verification showed the active `Hoja Seeds` portfolio and existing apps/WABAs linked to the Hoja business. Creating `Get Free Seeds Test` was blocked by Meta's business-portfolio limit. Existing `Garden Shop`/`Garden Shop OK` portfolios were not selected because clean ownership could not be proven. No existing or prohibited Meta asset was mutated.

Read-only follow-up proved `Garden Shop OK` (`1154400188565490`) is also unsuitable: its visible business overview contains `Hoja Seeds` ad account `120233855869140541`. Other available portfolios are unrelated and not a clean Get Free Seeds context.
