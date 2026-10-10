# Resource Registry

Staging and non-secret production resources are provisioned in the dedicated clean account; production compute/secrets/integration remain gated.

## Active WhatsApp Authority (GFS-60)

- State: `META_ASSETS_PENDING`
- Authorized sender: `+923044429933`
- Phone Number ID: `1323932417479627`
- Historical only: `+923328883383` / `1429127796940691`

## Active Meta Form Launch Authority (GFS-68)

- Launch mode: `META_FORM_LAUNCH_FIRST`
- Canonical Page: `101192938541236`
- Canonical Form: `1093015800183328` / `Free Seeds 05-10-2026`
- Canonical form list verification: active form visible under Page `101192938541236`; a newer `Free Seeds 05-10-2026` form is also visible and is not substituted without verified ID/field review.
- Native Leads Center: permitted temporary capture surface.
- Payment configuration: all three staging D1 methods disabled; recipient/amount/instructions/QR values absent. No payment value is recorded here.
- WhatsApp API: `WHATSAPP_API_ENHANCEMENT_PENDING`, not a form-launch dependency.

## GFS-69 Launch Preparation Findings

- Canonical form field set: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number. Email is not part of the verified set.
- Payment ending copy is prepared as an internal, unpublished template only; no amount, recipient, QR, or account placeholder was exposed to customers.
- Receipt route: Messenger is the preferred path, but current customer-side CTA opening is not freshly proven. The previously observed WhatsApp CTA was noncanonical and remains prohibited.
- Draft campaign `120255495379100054` / ad set `120255495379110054` / ad `120255495379120054` is visible as an unpublished draft. Meta UI showed Rs2,625 daily draft budget; exact canonical Form attachment was not verified.

## GFS-70 Payment Path Authority

- D1 source: staging `payment_configuration.advance_amount_pkr` (positive integer PKR, singleton row); current value absent.
- Admin edit surface: Access-protected `/payment-amount`; method details remain in `/payment-settings` and D1 `payment_methods`.
- A method can be enabled only when complete recipient name and customer-visible instructions are present; method-specific account/TILL details and optional private QR are managed by the existing fields.
- No payment recipient, amount, QR, or customer-facing instruction value is recorded here until Garden Shop verifies it.

## GFS-71 WhatsApp Flow Commerce Authority

- Flow mode: `WHATSAPP_FLOW_CTWA_LAUNCH_FIRST`; customer-initiated Click-to-WhatsApp entry only.
- Flow endpoint: `POST /webhooks/whatsapp/flows`; encrypted Meta protocol implemented, health/ping smoke passes.
- Catalog source: verified workbook required; current result `PRODUCT_WORKBOOK_NOT_FOUND`. No production catalog values are recorded.
- Delivery source: D1 `province_delivery_rates`, admin-managed; no rates currently configured.
- Quote formula: enabled catalog product + optional enabled fertilizer + enabled province delivery fee; server-side only.
- Order source of truth: D1 orders/order_items with persisted dynamic `total_payable`; payment selection does not overwrite dynamic totals from the legacy global amount.
- Flow secret: `FLOW_PRIVATE_KEY` required in Cloudflare secret storage before Meta encrypted traffic; value is intentionally absent from this registry.

## GFS-72 Authoritative Tariff Registry

- Product `FREE_5_PACK_VEGETABLE_SEEDS`: active, 5 packs, Rs. 0.
- Product `MICRO_NUTRIENTS_FERTILIZER`: active, 1 pack, Rs. 250.
- Delivery rates: Punjab/Islamabad 250; Sindh/KPK 300; Balochistan/AJK/Gilgit Baltistan 350 PKR; all active.
- Source label: `AUTHORITATIVE_FREE_SEEDS_TARIFF_2026`; no workbook import is required for these launch rows.
- Formula: `seed_price + fertilizer_fee + province_delivery_fee`; seed price is zero and fertilizer is optional.
- Flow key state: Cloudflare secret `FLOW_PRIVATE_KEY` present by name; Meta public-key registration remains pending. No key material is recorded.

## GFS-74 Meta Runtime Gate

- Canonical Flow Manager WABA selected: `2616648355452496`; no existing Flow listed.
- Exact publication requirements shown: improve message quality and complete business verification.
- App setup exact additional blocker: missing valid payment method; App review incomplete.
- Phone status: `Pending`; display name: `Get Free Seeds` / `In Review`; quality rating not displayed.
- Flow publication and messaging runtime are separate gates. Public key registration remains pending; private key is Cloudflare secret-only.

## GFS-75 Graph/Identity Registry

- Graph activation authority: supported Meta Graph/WhatsApp Business Tools state only; no dashboard banner is treated as activation proof.
- BSUID storage: D1 `customers.bsuid` + `customers.bsuid_business_id` + `customers.whatsapp_username`; no observed customer BSUID and no fabricated business/user ID.
- Canonical business scope for future BSUID association: Business `568026370701542`, WABA `2616648355452496`. A separate Garden Shop scope is supported by scoped storage but not configured.

## GFS-76 Registration State

- Registration authority: official Graph/WhatsApp Business Tools only; current Chrome UI is observation-only for this action.
- Name review remains separate from registration. Current phone remains Pending/In Review; no claim of approval or activation is made.
- Payment methods remain absent and are not used as a reason to delay protected phone registration.

## GFS-73 Tariff Governance

- Single runtime source: Access-protected `/tariff` → D1 `products` and `province_delivery_rates`.
- Legacy `/payment-amount` remains separate and is not used by dynamic WhatsApp quotes.
- Product price may be zero; delivery fee must be positive. All runtime quote values are fetched at request time.
- Change proof passed without Worker redeploy and values were restored. No tariff values are embedded in Flow JSON or Worker variables.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Main: `aa673e7` (origin/main, verified 2026-09-28)
- Main: `7794b686e942901fc549c1c25a97a4175d9fa663` (PR #7 merged)
- Active execution branch: `codex/gfs-launch-next-001` from merged main; remaining launch gates are external Meta/payment gates
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
- Authorized WhatsApp number: `+923044429933` (Pakistan local `03044429933`)
- Number registration status: new number exists in canonical WABA; Meta UI status **In Review**, quality/status **Pending**, display-name review pending
- Phone Number ID: `1323932417479627`; old `1429127796940691` for `+923328883383` is superseded and prohibited
- GFS-51 onboarding gate: canonical WABA phone surface still displays old `+923328883383` In Review/Unverified and a pending Business profile with Add number disabled; new sender `+923044429933` has no Phone ID yet.
- GFS-52 deletion gate: old `+923328883383` / Phone ID `1429127796940691` was not deleted because Add Phone onboarding is blocked before a safe slot action; explicit authorization remains recorded, no deletion mutation attempted.
- GFS-53 current state: `WHATSAPP_NUMBER_SLOT_BLOCKED`; new sender has no Phone ID and no OTP requested.
- GFS-54 support: canonical WABA Help exposes Business Support Home/category updates only; no support case UI or case ID available.
- GFS-54 active vars: API/admin deployments are configured for `WHATSAPP_NUMBER_SLOT_BLOCKED`; no active old Phone ID.
- GFS-55 active vars: API/admin deployments now use `META_ASSETS_PENDING`; API/admin versions `c62d6606-9b38-4dde-abfb-ca2ef92e6deb` / `7053221d-8e53-457f-b780-ed43905fc7d6`; no WhatsApp secrets, provider disabled.
- GFS-56 system user: `Automation` ID `61595003169877`, Employee, assigned only canonical App `2354726831735899` and WABA `2616648355452496`; assignment verified; no token generated.
- GFS-58 assignment verified: canonical App/WABA assigned to `Automation`; Graph subscription and credentials remain pending.
- GFS-56 toolchain: Wrangler `4.149.0`, audit 0 vulnerabilities.
- GFS-57 official MCP/Graph: no remote WhatsApp Business Tools MCP namespace/OAuth handoff is exposed in this execution; no token or Graph mutation performed. Canonical system-user assignments remain verified.
- Clean staging WABA test: not configured; no separate staging WABA/test number is used
- Clean staging test Phone Number ID: not yet configured; no ID placeholder is recorded
- Clean staging test recipient: not configured; synthetic-only use required
- App↔WABA subscription: **FAIL / not subscribed**. App API console still exposes only Meta test WABA `1932075647340454` and test Phone Number ID `870701809469791`; canonical WABA settings expose no assigned-app relationship. Generic Connect-assets chooser remains excluded.
- Instant Form: `Free Seeds 05-10-2026` / Form ID `1093015800183328`, canonical Page `101192938541236`; current GFS-41 canonical form. The separate older `Free Seeds 04-10-2026` remains distinct. Superseded Form `2816887225374285` is inactive in backend allowlists. No campaign/ad set/ad draft and no spend.
- Instant Form audit: More volume, verified privacy/ending required by Meta; expected five customer categories are Full name/`full_name`, Phone number/`phone_number`, Complete Delivery Address/`complete_delivery_address`, Nearby Famous Place/`nearby_famous_place`, City/`city`; Email absent.
- Lead ingestion: staging D1 `lead_sources` table with `page_id` verified; `/webhooks/meta/instant-form` is deployed but `META_INSTANT_FORM_ENABLED=false` until Page leadgen subscription and least-privilege lead token exist.
- GFS-40 lead app: no dedicated App created; canonical App supports only WhatsApp use case. Marketing API dedicated-app wizard stalled at Business pending/disabled before creation.
- GFS-42 Business restriction: Business `568026370701542` is Meta Verified with Saeed full access/2FA, but legal identity is `Hoja Seeds` / `hojaseeds.pk`; dedicated lead-app Business assignment remains disabled.
- GFS-42 existing ad draft: campaign `120255495379100054`, ad set `120255495379110054`, ad `120255495379120054`, unpublished/no-spend; linkage to Form `1093015800183328` not changed.
- GFS-43 staging API version: `abaef4e0-b477-463d-a998-50810f5bcb43`; `DEPLOYMENT_STATE=WHATSAPP_OTP_REQUIRED`, Meta providers remain disabled.
- GFS-44 payment/Messenger state: no enabled Garden Shop payment method or recipient values are configured; native Form→Messenger continuation is unverified/unavailable; no customer notification/order/payment was sent.
- GFS-45 native lead: synthetic supported preview created one Intake lead in Leads Center for Form `1093015800183328`; backend realtime sync remains blocked. The form's WhatsApp CTA target was noncanonical and was not used.
- GFS-46 customer contact: test lead exposes customer WhatsApp `+923034901810`; this is recipient data only, never the GFS sender. Business sender remains `+923328883383`; old CTA `923124093162` remains prohibited.
- GFS-47 customer-number schema: staging D1 preserves entered contact and Meta WhatsApp fields separately; API version `97c038d1-6382-4a3e-9509-2ad2005472b9`; no sender credential or recipient validation API used.
- GFS-49 admin Worker: `c236589e-760a-4190-95b9-285fc29b3518`; Payment Settings uses existing D1/R2 payment APIs, Access-protected for `gisupp@gmail.com`, no real values/QR configured.
- GFS-50 launch branch: `codex/gfs-launch-next-001` from merged main `7794b686e942901fc549c1c25a97a4175d9fa663`; no new external resource created.
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
