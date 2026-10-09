# Changelog

## Unreleased - 2026-10-02 (GFS-25)

- Added the current-session Meta protocol: call `list_pages` first, inspect all existing Meta tabs read-only, preserve useful sessions, and do not force Ayesha login when a clean authenticated asset is accessible.
- Inventoried all open Meta tabs: only Business Suite and Ads Manager were present, both in prohibited Hoja/Garden Shop context. No logout, new session, credential, or Meta mutation occurred.
- GFS-26 attempted clean Business Portfolio creation through the current authenticated Saeed session; Meta's portfolio limit blocked creation. Authenticated Business Support Home was reached but produced no support case/reference ID or response; no assets were mutated.
- GFS-27 recorded the explicit Meta-only exception: canonical Portfolio `568026370701542`, Ad Account `1198439777611633`, and verified Page `101192938541236`. Existing Hoja App `1065866162865361` was excluded; no Meta mutation occurred.
- GFS-27 setup reached the canonical Meta root but stopped at `META_REAUTH_PASSWORD_REQUIRED` before creating App/WABA/number; existing Hoja WABA `810731151319635` was excluded.
- GFS-29 inspected the verified Free Seeds Page first: Connected Assets was empty and all visible WhatsApp accounts were Hoja/Garden Shop entries. No clean linkage or mutation occurred; Meta reauth remains required for new GFS App/WABA setup.
- GFS-30 created new App `2354726831735899` / `Get Free Seeds` with WhatsApp use case under canonical root. WABA creation did not complete because Meta tab control became unresponsive; Hoja App/WABA remained untouched.
- GFS-31 restored Meta tab control with MCP 1.10.1; WABA form/reCAPTCHA was attempted safely, but Continue remained disabled after checkbox completion. No WABA/number or prohibited asset changed.
- GFS-32 selected display-name-only `Free Seeds` without adding a number; Meta returned the explicit WhatsApp Number limit and additional review requirement. Inventory found only active connected Hoja Seeds number `+92 313 4799681`; no deletion performed.
- GFS-33 resolved the quota diagnosis: existing GFS WABA `2616648355452496` is Approved/business verified with 2,000 new conversations/day and no phone numbers. Page/App Connect assets remained unlinked because connector UIDs were unavailable for safe MCP mutation; no Hoja asset changed.
- GFS-34 repaired MCP targeting and reacquired live Page/App Connect controls. Choosers lacked canonical Page/WABA/App assets, so no linkage or Hoja mutation occurred.
- GFS-35 recorded canonical App `2354726831735899` and approved WABA `2616648355452496` as the App/WABA pair; the generic Connect-assets chooser is not treated as the WhatsApp integration mechanism. App API Setup/WABA subscription remains unverified because the active bridge stopped responding after the required initial page inventory.
- GFS-35 hardened the safe runtime path: signed webhook message/media/status records are persisted as hashed D1 events, Flow attribution is retained, media ingestion preserves the configured provider, and durable Lead/Purchase outbox jobs can send through the guarded Meta CAPI provider. No secrets or live credentials were added.
- GFS-35 deployed only disabled-safe staging code after `wrangler whoami` verified `gisupp@gmail.com` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; final API/admin versions are `a93e0d64-7562-4979-aaba-a54acc9cf6af` / `07709470-34ee-4de1-b81e-8896257627c9`. Queue delivery failures now report deferred delivery without falsely rejecting durable Flow/payment commits.
- GFS-36 repaired the local Chrome DevTools MCP bridge by upgrading `1.8.0` to `1.10.1` and using the live DevToolsActivePort endpoint. Required `list_pages` plus two consecutive Meta read-only calls passed without logging out or creating a profile.
- GFS-36 verified the supported App Developer WhatsApp surface and canonical WABA phone settings. The App console still points to Meta test WABA `1932075647340454` / test phone `870701809469791`, while canonical WABA `2616648355452496` now shows authorized Phone Number ID `1429127796940691` as In Review/Unverified. No App↔WABA subscription or live token was available.
- GFS-36 stopped safely before OTP, Graph mutation, webhook secret configuration, or provider enablement. Meta and CAPI remain disabled; no test or Hoja number was used.
- GFS-37 corrected the sender model: Cloud API production messaging requires the registered business phone; `Free Seeds` is display name only. Canonical sender is `+923328883383` / Phone Number ID `1429127796940691`.
- GFS-37 rechecked the canonical WABA phone settings through MCP: status `In Review`, quality/status `Unverified`, display name `Get Free Seeds`; no SMS/voice verification option was exposed. Current gate is `WHATSAPP_PHONE_VERIFICATION_PENDING`, not `WHATSAPP_OTP_REQUIRED`.
- GFS-37 confirmed App API still resolves to Meta test WABA `1932075647340454`, so canonical App↔WABA subscription remains unresolved. No token, Graph mutation, webhook secret, provider enablement, or prohibited sender was used.
- GFS-37 aligned Wrangler/runtime state to `WHATSAPP_PHONE_VERIFICATION_PENDING` and deployed disabled-safe staging API/admin versions `73e0d310-da94-43d0-819a-4e86c4ace794` / `f0135e82-b28d-453b-a5af-e9b12d2d34d7`. Health passed; challenge 403 and webhook POST 503 remain intentional until Meta verification, subscription, and secrets exist.
- GFS-38 added the Meta Instant Form fallback architecture and shared D1 lead-source model. The signed lead webhook, Graph retrieval, dedupe, attribution, Lead CAPI outbox, and shared admin lead endpoint are deployed disabled-safe; no second CRM or payment workflow was added.
- GFS-38 opened the canonical Page Instant Form editor, configured More volume, 5 free seed packs/Rs. 0 offer text, removed email, and added Complete Delivery Address, Nearby Famous Place, and City alongside Meta standard Full name/Phone number. Meta blocked save/create on incomplete privacy/ending, so no form/campaign/spend was created.
- GFS-38 requested one SMS verification code for canonical phone `+923328883383`; the code prompt is visible, no code was entered or resent, and no test/Hoja asset was touched.
- GFS-39 audited the existing `Free Seeds 04-10-2026` form only: Form ID `2816887225374285`, canonical Page `101192938541236`, Active, created Oct 4 2026, 0 leads. No duplicate form was created.
- GFS-39 locked leadgen ingestion to the exact Page/Form pair, persisted Page ID attribution, and added allowlist tests. API staging version `1c9e42ca-ad13-4e4a-8fbc-e01300cfebc3` remains disabled-safe; no token, leadgen subscription, real lead, ad draft, or spend was used.
- GFS-40 confirmed canonical App `2354726831735899` exposes only WhatsApp and cannot add Page Lead Ads/Webhooks through Add use cases. The supported dedicated Marketing API app wizard stalled at Business pending/disabled before creation; no second App, token, Page subscription, lead, ad draft, or spend was created.
- GFS-40 corrected recovery language to identify the existing Saeed Meta session as operator; Ayesha remains historical only.
- GFS-41 switched the active Instant Form allowlist from superseded `2816887225374285` to canonical Form `1093015800183328` on Page `101192938541236`; old-form events are rejected.
- GFS-41 recorded safe MCP permission policy: routine Meta same-site navigation may persist, while password/OTP/CAPTCHA/spend/publication/payment/destructive prompts remain protected. No new App was created; Meta lead app Business step remains blocked.
- GFS-42 diagnosed the lead-app blocker without repeating the wizard: Business `568026370701542` is Verified with Saeed full access/2FA, but legal identity is Hoja Seeds and Business assignment remains disabled. No App/token/Page subscription mutation was attempted.
- GFS-42 recorded the existing unpublished Ads Manager draft IDs in canonical Ad Account `1198439777611633`; no publish, spend, duplicate draft, or form-link edit was made.
- GFS-43 switched the active WhatsApp state to `WHATSAPP_OTP_REQUIRED` based on the visible six-digit SMS dialog; no code/resend was attempted.
- GFS-43 audited the existing unpublished Leads/Form-oriented draft and native Leads Center. Campaign/adset/ad IDs remain `120255495379100054` / `120255495379110054` / `120255495379120054`; exact Form attachment could not be verified because Ads Manager edit stayed Loading. No publish/spend/mutation.
- GFS-43 checked Business Support Home; no supported case form or Case ID was exposed. Lead realtime sync remains blocked while native Leads Center is available with 0 leads.
- GFS-43 aligned deployed staging `DEPLOYMENT_STATE` to `WHATSAPP_OTP_REQUIRED`; API version `abaef4e0-b477-463d-a998-50810f5bcb43`, health PASS, providers still disabled.
- GFS-44 proved no Form→Messenger continuation or automatic Page message from available native surfaces; Leads Center has 0 leads and Ads Manager draft edit remains Loading.
- GFS-44 preserved payment safety: Garden Shop payment methods/recipient values are unconfigured, so no order/payment notification or Rs. 0 request was sent (`PAYMENT_AMOUNT_NOT_CONFIGURED`).
- GFS-45 verified the canonical form's checked Messenger/WhatsApp options and ran a supported synthetic preview submission. Leads Center now has one Intake lead for Form `1093015800183328` with actual field answers; native ending claims a Messenger conversation and exposes Chat, but customer-side message receipt was not observed. The WhatsApp CTA target was noncanonical and not used.
- GFS-45 kept payment safe: form displays advance/fertilizer amounts, but backend Garden Shop payment methods/recipients remain unconfigured; no D1 order, notification, or payment request was fabricated.

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
- GFS-48 reverified the native lead detail: manual contact `03001234567`, Meta WhatsApp `+923034901810`, Form `1093015800183328`, and actual product/province/amount answers. No D1/order/payment was fabricated; active release state is explicitly `WHATSAPP_OTP_REQUIRED`.
- GFS-49 added Access-protected `/payment-settings` using existing D1/R2 APIs, deployed admin `c236589e-760a-4190-95b9-285fc29b3518`. Synthetic incomplete-enable validation and disabled save/restore passed; no real payment values or QR were stored.
- GFS-49 merged PR #7 into main at `7794b686e942901fc549c1c25a97a4175d9fa663` after local tests/build/lint/audit/Wrangler/admin payment smoke passed. Created fresh branch `codex/gfs-launch-next-001` for remaining external launch work.
- GFS-50 confirmed form pricing text is not authoritative Garden Shop configuration; kept `PAYMENT_AMOUNT_NOT_CONFIGURED`, Messenger acknowledgement unsent, and D1 sync blocked by Meta lead App/token/Page gates. No new external resource or manual import was introduced.
- GFS-50 applied targeted dev dependency security update `source-map-js` `1.2.1` → `1.2.2`; audit is clean with no test/build/lint regression.
- GFS-51 switched active sender governance to authorized `+923044429933`, prohibited old sender/Phone ID, and inspected canonical WABA. Meta Add Phone is blocked by existing Business profile pending/Add number disabled; no new Phone ID or OTP mutation occurred.
- GFS-51 recorded transitive Wrangler/Miniflare/sharp audit advisories; no breaking forced downgrade was applied.
- GFS-52 inspected the explicitly authorized old-phone deletion path. Meta's Business profile pending/Add Phone disabled gate prevented a safe delete/add/OTP sequence; no old number deletion or new-number mutation was forced.
- GFS-53 aligned active state to `WHATSAPP_NUMBER_SLOT_BLOCKED`; pending Business profile/Add Phone disabled remains the exact gate before deletion/add/OTP.
- GFS-54 inspected canonical WABA Help once; Business Support Home/category updates were available but no case creation UI/reference ID was exposed. No repeated Add Phone/delete loop.
- GFS-54 aligned API/admin active Wrangler variables to `WHATSAPP_NUMBER_SLOT_BLOCKED`; no old Phone ID is active.
- GFS-55 verified new sender `+923044429933` in canonical WABA with Phone Number ID `1323932417479627`; Meta status remains In Review/Pending display-name review.
- GFS-55 confirmed canonical App API Setup still exposes only test/Hoja WABA/numbers, so App↔WABA remains absent. Deployed disabled-safe `META_ASSETS_PENDING` API/admin versions `c62d6606-9b38-4dde-abfb-ca2ef92e6deb` / `7053221d-8e53-457f-b780-ed43905fc7d6`; no secrets/provider enablement.
- GFS-56 created clean Employee system user `Automation` (`61595003169877`) and assigned only canonical App/WABA with partial development/management/messages permissions. No Hoja asset or token used.
- GFS-56 documented that asset assignment is not `subscribed_apps`; App API Setup still exposes test WABA only. Credential generation is the protected next step. Updated Wrangler to `4.149.0`; audit is clean.
- GFS-46 verified native customer WhatsApp data `+923034901810` from the canonical Form lead and added E.164 normalization tests. It remains recipient data, never the GFS sender `+923328883383`.
- GFS-46 added a safe deferred `WHATSAPP_ORDER_CONFIRMATION` outbox reference after durable lead/order persistence; OTP/App-WABA/provider gates defer it, and payment remains blocked without Garden Shop configuration.
- GFS-47 separated customer-entered contact and Meta auto-fetched WhatsApp numbers in D1, added E.164 normalization/priority/fallback tests, rejected sender/old CTA recipients, and deployed API `97c038d1-6382-4a3e-9509-2ad2005472b9`. No WhatsApp send was attempted.
