# Resource Registry

Staging and non-secret production resources are provisioned in the dedicated clean account; production compute/secrets/integration remain gated.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Main: `aa673e7` (origin/main, verified 2026-09-28)
- Main: `c46ea1f` (PR #4 merged, origin/main verified 2026-10-01)
- Active execution branch: `codex/gfs-meta-live-005` at `fb3d25c` from merged main; PR #5 open and mergeable
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
- Staging API version: `8daa6dc6-6f56-45a2-b7b9-734a146a6156` (GFS-17 redeploy; clean account verified as `gisupp@gmail.com`)
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
- GFS-16 Meta identity: `ayesha.butt55@hotmail.com` email accepted on Facebook login; password authentication pending; no Meta asset mutation
- GFS-16 Cloudflare/GitHub identity: required `gisupp@gmail.com` session not changed or reauthenticated
- GFS-17 Cloudflare identity: `gisupp@gmail.com` visibly authenticated in Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; staging API redeployed, no secret mutation
- GFS-19 Meta identity: visible Facebook session remains Saeed A Nazim; Ayesha authentication failed at password gate `META_AUTH_PASSWORD_REQUIRED`; no Meta asset was touched
- GFS-21 current-session discovery: visible `creeper seeds` ad account `1198439777611633` is HOJA-CONTAMINATED under Garden Shop portfolio `568026370701542`, legal business Hoja Seeds; visible Meta Business Suite business is Hoja Seeds, exposed Facebook asset ID `200402333163427`, and Instagram `hojaseeds`. `Free Seeds In Pakistan - www.gardenshop.pk` was visible in that chain, but target Page ID `101192938541236` was not independently verified.
- GFS-21 clean Creeper Seeds assets: none verified; WABA/App/dataset/system-user links intentionally not inspected inside prohibited chain.
- GFS-22 Ayesha context discovery: no existing Chrome profile, tab, account chooser entry, or saved account visibly associated with `ayesha.butt55@hotmail.com`; current Saeed session preserved and no credential/session mutation performed.
- Meta support case: not created; no case ID available
- Flow ID: not published; repository definition only
- Dataset/event source ID: not provisioned
- Graph API version: `v26.0` observed 2026-09-27; re-verify before live integration
- Public callback URL (staging only): `https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp`

No secrets are stored in this registry.
