# Resource Registry

Staging and non-secret production resources are provisioned in the dedicated clean account; production compute/secrets/integration remain gated.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Main: `aa673e7` (origin/main, verified 2026-09-28)
- Main: `a4ac98c` (origin/main, current GFS branch base)
- Active execution branch: `codex/gfs-meta-clean-007` at `45b2bc3`; PR #7 open and mergeable
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
- Staging API version: `73e0d310-da94-43d0-819a-4e86c4ace794` (GFS-37 phone-verification-pending redeploy; clean account verified as `gisupp@gmail.com`)
- Staging admin version: `f0135e82-b28d-453b-a5af-e9b12d2d34d7`
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
- Page ID: `101192938541236` / `Free Seeds In Pakistan - www.gardenshop.pk`; visible under canonical Meta root with Saeed Nazim full access and 0 partners
- Canonical Meta Business Portfolio (explicit Meta-only exception): `568026370701542` / UI name `Garden Shop`; unrelated Hoja assets remain excluded
- Canonical Creeper Seeds Ad Account (explicit Meta-only exception): `1198439777611633` / UI name `creeper seeds`
- Canonical App: `2354726831735899` / `Get Free Seeds` (WhatsApp customer-connection use case)
- Canonical WABA: `2616648355452496` / `Get Free Seeds` (Approved; business verified; 2,000 new conversations/day)
- Authorized WhatsApp number: `+923328883383`
- Number registration status: **In Review / Unverified** in canonical WABA phone-number settings; no SMS/voice verification method was exposed
- Phone Number ID: `1429127796940691`
- Clean staging WABA test: not configured; no separate staging WABA/test number is used
- Clean staging test Phone Number ID: not yet configured; no ID placeholder is recorded
- Clean staging test recipient: not configured; synthetic-only use required
- App↔WABA subscription: **FAIL / not subscribed**. App API console still exposes only Meta test WABA `1932075647340454` and test Phone Number ID `870701809469791`; canonical WABA settings expose no assigned-app relationship. Generic Connect-assets chooser remains excluded.
- Instant Form: canonical Page `101192938541236` editor configured; no saved form ID due incomplete Meta privacy/ending sections. No campaign/ad set/ad draft and no spend.
- Lead ingestion: staging D1 `lead_sources` table verified; `/webhooks/meta/instant-form` is deployed but `META_INSTANT_FORM_ENABLED=false` until a published form, Page webhook subscription, and least-privilege lead token exist.
- Excluded candidate portfolio: `Garden Shop OK` / `1154400188565490`; visible business overview contains Hoja Seeds ad account `120233855869140541`, so it is not clean and is not used
- GFS-14 read-only Meta audit: visible Ads Manager context was prohibited Garden Shop portfolio `568026370701542` with ad account `1198439777611633`; no clean Get Free Seeds ownership was verified and no asset was mutated
- Designated Meta context per user: `Creeper Seeds`; clean ownership status: **NOT VERIFIED / PROHIBITED CONTEXT OBSERVED**
- GFS-15 historical classification: `creeper seeds` / `1198439777611633` was excluded under the then-current zero-Hoja rule; GFS-27 explicitly supersedes this for Meta-only use of the canonical root, while unrelated Hoja assets remain excluded
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
- GFS-25 `list_pages` inventory: 8 tabs; only Meta Business Suite and Ads Manager were open among Meta services. Visible Meta identity was Saeed A Nazim. Business Suite asset `200402333163427` and ad account `1198439777611633` were HOJA-CONTAMINATED under portfolio `568026370701542`; no clean Meta context, WABA/App/dataset IDs, or target Page linkage was verified.
- GFS-26 clean Business creation: not provisioned; Meta portfolio-creation limit blocked creation under current Saeed session. Support Home was reached but generated no case/reference ID or response. No existing asset was mutated.
- GFS-27 existing App `1065866162865361` / `Hoja Lead Integration`: excluded; no WABA, dataset, or event-source ID was safely verified.
- GFS-27 existing WABA `810731151319635` / Hoja Seeds: excluded; no new App/WABA/Phone Number ID was created because Meta required reauthentication.
- GFS-29 Page linkage: target Page `101192938541236` Connected Assets panel showed none. Visible WhatsApp account list contained only Hoja/Garden Shop entries; no clean WABA or Page-to-WhatsApp connection was available. No Page, WABA, number, App, or token mutation occurred.
- GFS-30 new App: `2354726831735899` / `Get Free Seeds`, owned under canonical Portfolio `568026370701542`, WhatsApp customer-connection use case; no WABA/Phone Number ID yet.
- GFS-31 WABA creation: form `Get Free Seeds` / Food and Grocery reached; reCAPTCHA checkbox completed, Continue remained disabled, no WABA ID/Phone Number ID generated. STOP_GATE=`META_RECAPTCHA_REQUIRED`.
- GFS-32 display-name-only: Meta selected path but returned maximum allowed WhatsApp Number limit and additional business/display-name review. No new WABA/display name/Phone Number ID.
- GFS-32 existing Hoja WABA inventory: `810731151319635` / Hoja Seeds / Garden Shop; visible number `+92 313 4799681`, display name Hoja Seeds, Connected, High quality. Active Hoja asset; never delete. No unused/unknown numbers visible.
- GFS-33 canonical GFS WABA: `2616648355452496` / Get Free Seeds; Approved, business verified, 2,000 new conversations/day, no phone numbers, no partners, display name shown upon approval. App `2354726831735899` is canonical; App↔WABA subscription remains unverified.
- GFS-34 linkage verification: Page Connect assets chooser exposed only Instagram; App Connect assets chooser exposed only Other business assets; canonical Page/WABA/App options were absent. The chooser is not treated as the WhatsApp integration mechanism; App API Setup/WABA subscription remains the required verification surface.
- GFS-26 branch: `codex/gfs-meta-clean-007` from `origin/main` `a4ac98c`; pending evidence PR.
- Meta support case: not created; no case ID available
- Flow ID: not published; repository definition only
- Dataset/event source ID: not provisioned
- Graph API version: `v26.0` observed 2026-09-27; re-verify before live integration
- Public callback URL (staging only): `https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp`

No secrets are stored in this registry.
