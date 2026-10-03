# Decisions

## 2026-09-27: New WhatsApp Number Required

Historical record: the earlier assumption to use an existing Garden Shop WhatsApp number was superseded by the later explicit authorization recorded below. No existing, test, Hoja Seeds, Garden Shop, or other number may be searched for, migrated, registered, connected, or used. The prior expected state was `WHATSAPP_NUMBER_PENDING`.

## 2026-09-28: Authorized Production Number and Identity

The user explicitly authorized `+923328883383` for Get Free Seeds / Free Seeds In Pakistan WhatsApp Business Platform/Cloud API onboarding and controlled integration testing. This supersedes the prior pending-number assumption. The state is now `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING`; no Meta registration, OTP entry, WABA linkage, token, or runtime enablement is implied until clean ownership is visibly verified. The Free Seeds In Pakistan Page ID is `101192938541236`. Hoja portfolio/WABA/app/dataset/system-user/ad-account/credentials and old Garden Shop WhatsApp assets remain forbidden, and the Page must be isolated without modifying unrelated Hoja assets.

## 2026-09-28: External Dashboard Evidence Gate

This execution environment does not expose the required Chrome DevTools MCP. Therefore no Meta, Cloudflare, or GitHub dashboard mutation, OTP attempt, support case, webhook registration, or real WhatsApp E2E result is recorded as complete. Documentation may record authorization, but only authenticated visible dashboard evidence can promote the state.

## 2026-09-28: GFS-14 MCP Recovery

Local recovery confirmed the MCP configuration and package are present: Codex `D:\AI-Tools\Codex\home\config.toml` registers `chrome_devtools` with `chrome-devtools-mcp@1.7.0 --autoConnect --channel=stable`, and the Kilo config registers the enabled latest-package bridge. Chrome stable is already running on the existing Default profile; `DevToolsActivePort` reports port `9222`, and the Default profile preferences identify `gisupp@gmail.com`. Direct MCP initialization and a fresh Codex execution both successfully called `list_pages`, exposing the existing WhatsApp and Meta tabs. No new profile or duplicate tab was created. The active session's static tool namespace still does not expose MCP, so Meta mutations remain deferred to a fresh MCP-enabled execution rather than being falsely claimed here.

The fresh MCP-enabled execution completed a read-only Meta audit only. It observed prohibited Garden Shop portfolio `568026370701542` and ad account `1198439777611633`, did not add/query/migrate `+923328883383`, and made no Meta mutation. Staging challenge returned `Forbidden` and health returned the deployed old `WHATSAPP_NUMBER_PENDING` / `disabled-until-new-number` gate. The clean portfolio limit remains unresolved; no OTP/CAPTCHA gate was reached.

## 2026-09-28: GFS-15 Creeper Seeds Context Audit

The user's designated `Creeper Seeds` context was audited read-only through the authenticated MCP session. The only visible matching asset was ad account `creeper seeds` (`1198439777611633`) under `Garden Shop` portfolio `568026370701542`, whose legal business name is `Hoja Seeds`; visible Pages also included Hoja Seeds, Dutch Seeds Export, Free Seeds In Pakistan - www.gardenshop.pk, and Garden Shop. Because the binding zero-Hoja rule remains in force, this context is prohibited for runtime use despite the user naming Creeper Seeds. No App/WABA/system-user/token/number mutation or deeper Hoja asset inspection was performed. A clean Creeper Seeds business context or explicit non-Hoja asset boundary is required before onboarding can continue.

The GFS-15 Cloudflare pre-mutation check found no existing Cloudflare tab; one new service tab redirected to login showing `nazimsaeed@gmail.com`, not the required `gisupp@gmail.com`. Because visible account identity did not match the mandated profile, the current staging Worker was not deployed and no Cloudflare secret was touched.

## 2026-09-28: GFS-16 Service-Specific Account Separation

Meta/Facebook ownership must use `ayesha.butt55@hotmail.com`; Cloudflare, GitHub, and Get Free Seeds admin must use `gisupp@gmail.com`. The existing Meta session was logged out from Saeed A Nazim/Garden Shop without touching business assets. Facebook accepted the Ayesha email and stopped at the password field; no password, OTP, 2FA, CAPTCHA, or business mutation occurred. The Cloudflare/GitHub sessions were not touched. The contaminated `creeper seeds` ad account and Hoja portfolio remain prohibited.

## 2026-10-01: GFS-17 Account Authentication and Staging Redeploy

The Cloudflare dashboard was visibly authenticated as `gisupp@gmail.com` in clean Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; the current staging API Worker was deployed as version `8daa6dc6-6f56-45a2-b7b9-734a146a6156`. Public health returned the new authorized-onboarding state. Webhook challenge returned 403 because no verify secret is configured and POST returned the expected 503 while Meta remains disabled; no Meta secret, WABA, number, or callback mutation occurred. Meta remains blocked at the Ayesha Facebook password gate.

## 2026-10-01: GFS-19 Meta Authentication Gate

Read-only MCP verification confirmed the visible Facebook session is still Saeed A Nazim, not `ayesha.butt55@hotmail.com`. The safe existing-session/password-manager path did not supply an Ayesha credential. The exact gate is `META_AUTH_PASSWORD_REQUIRED`; no password was read, entered, logged, or stored, and no Meta asset was touched. Do not retry unchanged login until the authorized credential is supplied through the browser.

## 2026-10-01: GFS-20 Dependency Audit Repair

The required clean install initially reported three Wrangler/Miniflare/Undici vulnerabilities. `npm audit fix` updated only the lockfile dependency resolutions; tests (18/18), build, lint, and a second audit then passed with zero vulnerabilities. No application source or runtime behavior changed.

PR #4 was merged after the local quality gate passed and remote main was verified at `c46ea1f`. Development must continue only on fresh branch `codex/gfs-meta-live-005`, created from that merged main; the merged branch is closed for further development.

## 2026-10-01: GFS-21 Current Meta Session Discovery

The existing Facebook/Meta tabs were reused read-only without logout, account switching, new profile, or a new Facebook session. Visible identity is Saeed A Nazim. The exact `creeper seeds` ad account (`1198439777611633`) is owned through Garden Shop portfolio `568026370701542`, whose legal business is Hoja Seeds; visible Meta Business Suite is Hoja Seeds, exposed Facebook asset ID is `200402333163427`, and Instagram is `hojaseeds`. `Free Seeds In Pakistan - www.gardenshop.pk` was visible in that chain, but target Page ID `101192938541236` was not independently verified. All exposed results are HOJA-CONTAMINATED and prohibited. No clean Creeper Seeds asset was verified, and no asset was mutated. Ayesha authentication remains the next gate.

## 2026-10-01: GFS-22 Preserve Saeed / Discover Ayesha Context

The current Saeed A Nazim Facebook session was preserved exactly. Existing tabs and Chrome profiles were inspected read-only; profiles included `gisupp@gmail.com`, `hafizasadkk7@gmail.com`, `wpaistudio@gmail.com`, and `nazimsaeed@gmail.com`, but no authenticated or saved Ayesha context (`ayesha.butt55@hotmail.com`) was found. No account chooser entry, logout, account switch, new profile, credential entry, or business mutation occurred.

## 2026-10-02: GFS-25 Working Meta Session Discovery Rule

The existing authenticated Meta session is the primary discovery surface. Chrome DevTools MCP `list_pages` must be called first, every open Facebook/Meta/Business Suite/Ads Manager/WhatsApp Manager/Developer tab must be inspected read-only, and useful sessions must not be logged out or replaced. `ayesha.butt55@hotmail.com` remains the intended clean Meta owner, but authentication is not a prerequisite when the current session visibly exposes a clean, non-Hoja asset with required authority. Only after all accessible Meta tabs are inspected may execution stop with `CLEAN_META_ASSET_NOT_ACCESSIBLE`.

GFS-25 inspected all existing Meta tabs exposed by `list_pages`: Meta Business Suite and Ads Manager. Business Suite asset `200402333163427` and Creeper Seeds ad account `1198439777611633` were both under prohibited portfolio `568026370701542`; no separate Facebook, WhatsApp Manager, or Developer tab was open, and target Page `101192938541236` was not independently displayed. Exact gate: `CLEAN_META_ASSET_NOT_ACCESSIBLE`. No session or asset mutation occurred.

## 2026-10-02: GFS-26 Current Meta Operator Authorization

The current authenticated Saeed A Nazim Meta session is authorized to create/manage a new independent Creeper Seeds Business context. Ayesha authentication is not a prerequisite when this working session has the required clean authority. The session must remain intact; do not logout, clear cookies, or force a new login. The contaminated portfolio `568026370701542`, ad account `1198439777611633`, and all Hoja-linked assets remain prohibited.

The supported creation UI returned the exact portfolio limit message and created no Business ID. Meta Business Support Home was then reached in the same authenticated session; no standalone form was available, the built-in assistant produced no response, and no case/reference ID was generated. Exact stop gate: `META_SUPPORT_REQUIRED`. No existing Portfolio, Page, App, WABA, number, ad account, or other asset was mutated.

## 2026-10-02: GFS-27 Explicit Meta-Only Root Exception

The user explicitly authorized existing Meta Business Portfolio `568026370701542` (UI name `Garden Shop`) and Ad Account `1198439777611633` (UI name `creeper seeds`) as the canonical Meta root for Get Free Seeds. Read-only settings verified Page `Free Seeds In Pakistan - www.gardenshop.pk`, ID `101192938541236`, under that root with Saeed Nazim full access and 0 partners. Existing App `1065866162865361` / `Hoja Lead Integration` is excluded and must not be reused. No WABA/dataset was confirmed and no mutation occurred. This exception is Meta-only; Cloudflare, GitHub, D1, R2, payment, customer, and other backend resources remain independent with zero Hoja cross-use.

Meta then required Saeed password re-entry before App/WABA creation. The existing Hoja Seeds WABA `810731151319635` was visible but excluded. No password, OTP, App, WABA, number, token, or other asset mutation occurred. Exact gate: `META_REAUTH_PASSWORD_REQUIRED`.

## 2026-10-02: GFS-29 Page-First WhatsApp Check

The canonical Page `Free Seeds In Pakistan - www.gardenshop.pk` (`101192938541236`) was inspected first in the existing Meta session. Its Connected Assets panel showed none. The WhatsApp accounts view exposed only Hoja/Garden Shop entries, including excluded WABA `810731151319635`; no clean WABA or Page-to-WhatsApp linkage was available. Reauth is required before creating a new GFS App/WABA or connecting `+923328883383`; no mutation occurred.

## 2026-10-02: GFS-30 New App and WABA Control Gate

Meta created new App `2354726831735899` / `Get Free Seeds` under canonical Portfolio `568026370701542` with WhatsApp customer-connection use case, without password reauth. The WABA Add menu was opened and existing Hoja WABA remained excluded, but Meta tab control became unresponsive before the new WABA flow completed. No WABA, number, token, or Cloudflare mutation occurred; continuation requires restoring Meta tab control.

GFS-31 restored Meta control using the direct WebSocket MCP bridge. The new WABA form accepted `Get Free Seeds` / Food and Grocery; the normal reCAPTCHA checkbox completed without an image challenge, but Continue remained disabled and no WABA was created. Exact user gate: `META_RECAPTCHA_REQUIRED`. No OTP, number, token, Cloudflare, or prohibited asset mutation occurred.

## 2026-10-02: GFS-34 Canonical Asset Connection Chooser

MCP targeting was repaired by reacquiring fresh Page/App snapshots and live Connect assets controls. The canonical Page chooser contained only Instagram; the canonical App chooser contained only Other business assets. Neither offered the canonical Page/WABA/App relationship, so no link was performed. Exact technical gate: `META_ASSET_CONNECTION_CHOOSER_MISSING_CANONICAL_ASSETS`. Hoja assets remained untouched.

## 2026-10-02: GFS-32 Display-Name-Only Capacity Gate

The supported display-name-only path was selected with display name `Free Seeds`; `Add a new number` was not selected. Meta explicitly returned `Business reached maximum allowed WhatsApp Number limit` and required additional business/display-name review. Inventory of excluded Hoja WABA `810731151319635` showed only active connected Hoja Seeds number `+92 313 4799681` with High quality; no unused/unknown number was safe to delete. No WABA/display name/number/Page/App mutation occurred. Exact gate: `META_WHATSAPP_NUMBER_LIMIT_REACHED`; cleanup would require destructive confirmation and is not authorized.

## 2026-10-02: GFS-33 Quota Resolution and Existing WABA

Read-only WhatsApp Manager inspection proved the new GFS WABA `2616648355452496` already exists as `Get Free Seeds`, Approved, business verified, with 2,000 new conversations/day, no phone numbers, no partners, and display name shown upon approval. The canonical Page `101192938541236` and App `2354726831735899` each showed Connect assets but no existing Page↔WABA or App↔WABA linkage. The MCP browser bridge did not retain the connector button UIDs, so no indirect/workaround click was attempted. Existing Hoja WABA/number remained untouched. Exact technical gate: `META_ASSET_CONNECTION_UNVERIFIED`.

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

Deployed public API `getfreeseeds-api-staging` at `https://getfreeseeds-api-staging.get-free-seeds.workers.dev` and admin `getfreeseeds-admin-staging` at `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev`. The admin is protected by Access application `ea91b1bf-02c1-46d3-921a-ea2f507fb150` with email allow policy `b3acdd4f-9767-4d28-a55d-0a8e771d476c`; browser verification returned the admin health response. API health returned the then-current `WHATSAPP_NUMBER_PENDING` state and Meta provider remained disabled.

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

Dashboard automation uses Chrome DevTools MCP with service-specific identities: `ayesha.butt55@hotmail.com` for Meta/Facebook and `gisupp@gmail.com` for Cloudflare/GitHub/admin. It reuses same-task tabs, avoids duplicate service tabs, and verifies account identity before mutations. GitHub Actions billing is optional and not a launch blocker; local release checks remain authoritative while remote CI is unavailable (`REMOTE_CI_UNAVAILABLE_NON_BLOCKING`).

## 2026-09-27: Clean WABA Staging Test Allowed

`STAGING_WABA_TEST_ALLOWED` is now permitted by explicit user decision. A Meta-provided clean test WABA/test number may connect only to staging for synthetic webhook, Flow, message, media, and CAPI test events after visible ownership verification. Hoja-linked, old Garden Shop, Meta test `+1 555-897-9372`, production, real-customer, real-payment, and ad use remain forbidden. This historical decision predates the authorized-number state recorded on 2026-09-28.

## 2026-09-27: Clean WABA Portfolio Gate

Meta UI verification showed the active `Hoja Seeds` portfolio and existing apps/WABAs linked to the Hoja business. Creating `Get Free Seeds Test` was blocked by Meta's business-portfolio limit. Existing `Garden Shop`/`Garden Shop OK` portfolios were not selected because clean ownership could not be proven. No existing or prohibited Meta asset was mutated.

Read-only follow-up proved `Garden Shop OK` (`1154400188565490`) is also unsuitable: its visible business overview contains `Hoja Seeds` ad account `120233855869140541`. Other available portfolios are unrelated and not a clean Get Free Seeds context.

No clean support case ID exists yet. Do not delete, transfer, disconnect, or repurpose existing portfolios/assets to work around Meta's limit.

## 2026-10-02: GFS-35 App-to-WABA Verification Boundary

The canonical App `2354726831735899` / Get Free Seeds and approved WABA `2616648355452496` / Get Free Seeds are the only GFS App/WABA pair. The generic Page/App Connect-assets chooser is not treated as the WhatsApp integration mechanism; the supported verification surface is App WhatsApp API Setup/WABA subscription plus WABA assigned/subscribed apps. The initial Chrome DevTools MCP `list_pages` inventory succeeded and exposed the WhatsApp Manager WABA surface and App settings surface, but subsequent read-only tool calls stopped responding in this active session. No Meta mutation, token, phone onboarding, OTP, or Hoja asset action was performed.

Cloudflare identity was verified through `wrangler whoami` as `gisupp@gmail.com` in clean account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` immediately before deploying disabled-safe staging API/admin updates. No secrets were set; `META_PROVIDER_ENABLED` and `META_CAPI_ENABLED` remain false.

## 2026-10-03: GFS-36 MCP Recovery, Sender Gate, and App/WABA Truth

The local Chrome DevTools MCP bridge was repaired by upgrading the installed package from `1.8.0` to `1.10.1` and using the live `DevToolsActivePort` endpoint `ws://127.0.0.1:9222/devtools/browser/0a6fd083-d7b2-425b-8687-b585977a1cbc`; the existing Chrome profile/session was preserved. `list_pages`, `select_page`, and `take_snapshot` then succeeded consecutively. The canonical App Developer surface was inspected through the official Connect on WhatsApp API Setup/Configuration pages, not the generic Connect-assets chooser.

The canonical WABA `2616648355452496` showed Get Free Seeds Approved and no phone numbers. Because the App console explicitly requires a verified business phone and does not provide a runnable display-name-only sender, the authorized `+923328883383` was submitted only through the canonical WABA phone-number form. Meta created Phone Number ID `1429127796940691` with status **In Review / Unverified**; no OTP prompt was shown, so no verification code was entered. The App API console still displays Meta's separate test WABA `1932075647340454` and test Phone Number ID `870701809469791`, proving the canonical App `2354726831735899` is not yet subscribed to canonical WABA `2616648355452496`. No test, Hoja, token, or secret was used.

App↔WABA subscription remains **FAIL/UNVERIFIED**. No authorized access token exists in clean Cloudflare secret storage (`wrangler secret list` returned no secrets), so Graph/API subscription mutation and live callback configuration are deferred. Meta provider and CAPI remain disabled.

## 2026-10-03: GFS-37 Phone Verification State

Cloud API production messaging requires a registered business phone sender; the display name `Free Seeds` is not a standalone sender. The canonical sender is `+923328883383`, Phone Number ID `1429127796940691`, under WABA `2616648355452496`. MCP inspection showed display name `Get Free Seeds`, registration status **In Review**, and quality/status **Unverified**. No SMS/voice verification control was exposed, so the exact gate is `WHATSAPP_PHONE_VERIFICATION_PENDING`; do not label it OTP-required or retry codes.

The App `2354726831735899` still resolves in API Setup to Meta test WABA `1932075647340454` / test phone `870701809469791`. Canonical App↔WABA subscription is therefore **FAIL/UNVERIFIED**. No Graph subscription mutation was attempted because Cloudflare secret storage has no authorized token, and Meta provider/CAPI remain disabled.
