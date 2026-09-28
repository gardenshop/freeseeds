# Resource Registry

Staging and non-secret production resources are provisioned in the dedicated clean account; production compute/secrets/integration remain gated.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Main: `aa673e7` (origin/main, verified 2026-09-28)
- Active execution branch: `codex/gfs-whatsapp-prod-004` at `828da04`; PR #4 open and mergeable
- Prior branch `codex/gfs-waba-test-002` retained remotely for provenance

## Cloudflare

- Account name: Get Free Seeds (dedicated clean account)
- Account ID: `cb5066a6d71ecdee0bd7ed8aacb4d3c2`
- Prohibited account: `85f6a6181b4653c2a45e69cb7ce8a474` (not used)
- Staging D1: `getfreeseeds-staging` / `17b7e9f6-e08b-4bff-a756-10de30b49ab1`
- Staging D1 migrations: `0001_initial.sql`, `0002_payment_methods.sql` applied and verified
- Staging R2: `getfreeseeds-receipts-staging` (private; public access not enabled)
- Staging Queue: `getfreeseeds-events-staging`
- Staging DLQ: `getfreeseeds-events-staging-dlq`
- Staging Queue ID: `7cf7cec60e0d4bd4a0a1e5af41f00dbd`
- Staging DLQ ID: `4e0ec3246cc048c8be71cc37ff48f0a7`
- workers.dev subdomain: `get-free-seeds.workers.dev`
- Staging public Worker: `getfreeseeds-api-staging` / `https://getfreeseeds-api-staging.get-free-seeds.workers.dev`
- Staging admin Worker: `getfreeseeds-admin-staging` / `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev`
- Staging API version: `d4aff2d9-1c27-41f5-a01c-22208a37eb78`
- Staging admin version: `46efab4b-796f-4422-b4bf-639930b11904`
- Cloudflare Access application: `Get Free Seeds Admin Staging` / `ea91b1bf-02c1-46d3-921a-ea2f507fb150`
- Cloudflare Access allow policy: `Get Free Seeds Admin Operator` / `b3acdd4f-9767-4d28-a55d-0a8e771d476c`
- Production compute/secrets: not provisioned
- Production Access application: not provisioned
- Production D1: `getfreeseeds-prod` / `02b707df-a10c-4645-9516-a2a4541f6fab` (created; migrations 0001/0002 applied; Workers not deployed)
- Production R2: `getfreeseeds-receipts-prod` (created; private, no public access)
- Production Queue: `getfreeseeds-events-prod` (created)
- Production DLQ: `getfreeseeds-events-prod-dlq` (created)
- Production Queue ID: `9b1852f6976343de8bec95ef2cf152a4`
- Production DLQ ID: `0313fc16837d41bdb8370cf8fe31c969`
- Production Workers: not deployed; production Wrangler bindings committed

## Meta and WhatsApp

- Customer identity: `Get Free Seeds / Free Seeds In Pakistan`
- Customer-facing Page input: `https://www.facebook.com/FreeSeedsPK/`
- Page ID: `101192938541236` (previously documented as Hoja-linked; isolation is authorized but not yet verified)
- Clean Meta Business ID: not provisioned
- Clean WABA ID: not provisioned
- Authorized WhatsApp number: `+923328883383`
- Number registration status: authorized; onboarding/OTP/ownership verification pending
- Phone Number ID: not yet returned by Meta
- Clean staging WABA test: not yet configured; no ID placeholder is recorded
- Clean staging test Phone Number ID: not yet configured; no ID placeholder is recorded
- Clean staging test recipient: not configured; synthetic-only use required
- Clean staging Meta gate: authenticated Meta UI exposes Hoja-linked active portfolio/assets and reports the business portfolio creation limit; no existing portfolio/WABA/app was selected
- Excluded candidate portfolio: `Garden Shop OK` / `1154400188565490`; visible business overview contains Hoja Seeds ad account `120233855869140541`, so it is not clean and is not used
- GFS-14 read-only Meta audit: visible Ads Manager context was prohibited Garden Shop portfolio `568026370701542` with ad account `1198439777611633`; no clean Get Free Seeds ownership was verified and no asset was mutated
- Designated Meta context per user: `Creeper Seeds`; clean ownership status: **NOT VERIFIED / PROHIBITED CONTEXT OBSERVED**
- GFS-15 visible ad account: `creeper seeds` / `1198439777611633`, nested under `Garden Shop` portfolio `568026370701542`, legal business name `Hoja Seeds`; excluded under the zero-Hoja rule
- GFS-15 visible Page names in that prohibited context: Hoja Seeds; Dutch Seeds Export; Free Seeds In Pakistan - www.gardenshop.pk; Garden Shop. Target Page `101192938541236` was not independently verified.
- GFS-15 App/WABA/dataset/event-source/system-user IDs: not inspected because entering the proven Hoja portfolio's deeper asset views would violate the isolation lock
- GFS-15 Cloudflare pre-mutation identity: not verified; dashboard redirected to login showing `nazimsaeed@gmail.com`, not required `gisupp@gmail.com`; no Worker deploy or secret mutation performed
- Meta support case: not created; no case ID available
- Flow ID: not published; repository definition only
- Dataset/event source ID: not provisioned
- Graph API version: `v26.0` observed 2026-09-27; re-verify before live integration
- Public callback URL (staging only): `https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp`

No secrets are stored in this registry.
