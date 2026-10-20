# Decisions

## 2026-10-20: GFS-182 Final Lead Readiness Boundary

The only source repair in GFS-182 is monotonic WhatsApp delivery status handling. `SENT`, `DELIVERED`, and `READ` are ordered; duplicate provider IDs remain idempotent; delayed or reordered callbacks cannot downgrade a successful outbound record. Focused and full local tests prove this with synthetic SQLite/D1 behavior. No live callback, message, order, or payment record was replayed.

Queue handling remains bounded and fail-closed: retry/backoff and terminal DLQ behavior are covered, but there is no automatic DLQ recovery. A future replay requires an authorized operator, provider-health evidence, deterministic key review, and an audited non-financial replay. Historical CAPI, payment, receipt, and incident jobs must never be replayed merely to clear a dashboard.

Read-only Events Manager evidence identifies the clean `Free Seeds` dataset `1210750267244729`; it has no integrations and no event activity. The Hoja dataset was visible but prohibited and untouched. Because the API has `META_CAPI_ENABLED=false`, no dataset/token permission is configured, no Test Events code was used, and no Meta acknowledgement exists, Lead CAPI remains disabled. Pending D1 Lead rows are not delivery proof. No consent or public release authorization is inferred from controlled tester evidence.

No runtime rate-limit control was found. This is a public release blocker, not a reason to add an unsafe in-memory substitute. Add and verify an authorized Cloudflare edge or durable per-sender limiter, then prove abuse/error recovery before public launch. The active callback Worker was not deployed because current tester/activity/payment/CAPI/rollback preconditions were not re-established in this execution. Staging versions and all protected financial state remain unchanged.

## 2026-10-20: GFS-181 Payment Evidence Boundary and Launch Split

GFS-181 reuses the already-proven GFS-178/GFS-180 live EN/UR lead-only evidence instead of replaying completed work. The authenticated browser inventory was collected with `list_pages` first. GitHub and Cloudflare/Admin identities were verified; existing Meta/Admin/WhatsApp pages were inspected read-only and no unrelated conversation, ad, payment, or production asset was changed.

The three owner-uploaded QR files are accepted as private draft assets. D1/R2 evidence passes method linkage, hashes, decoder agreement, payload equality, and derivative scan. This is intentionally separate from the owner statement, destination comparison, and independent beneficiary verification. JazzCash has only an identifier match; Easypaisa has a D1 mismatch with a printed alias candidate; Bank Transfer has no exact match to the configured IBAN or printed alternate. No authenticated merchant/bank proof was accessible, so the exact external dependency is recorded once: provide a provider/bank record linking each decoded destination to Garden Shop. Until then every method remains disabled, unselected, and non-payable.

No recipient fields were altered to force a match. No ownership flag, amount, payment state, receipt, approval, PAID/CAPI, fulfillment, incident, or historical order was mutated. The missing evidence is not replaced by a visual label, owner attestation, QR checksum, simulated fixture, or prior WAMID.

The launch decision is intentionally split: controlled lead-only staging and Admin draft/read-only validation are GO; public leads remain NO-GO pending name/release authorization, Lead CAPI, and live concurrency/reordering evidence; customer payments remain NO-GO pending independent beneficiary proof and an explicitly authorized real transaction. The remote CI billing lock is recorded as non-blocking under the existing policy. No payment transfer, paid advertisement, public promotion, production deployment, or Meta name submission was attempted.

## 2026-10-20: GFS-178 Name Status Is Not Messaging Eligibility

Official Graph confirms VERIFIED/GREEN registered phone, granted messaging/management permissions and WABA subscription while name_status remains DECLINED. A profile-verified tester actually sent inbound and received Graph-delivered/read replies; prior name-only/API-deployment blockers were overbroad. Username @FreeSeeds remains separate and unchanged. No alternate name or blind name resubmission is authorized. Canonical Support lists no eligible issue and disables Request Review; no appeal was submitted.

Controlled staging deployment was permitted after local gates, verified account, only-tester recent activity, unchanged financial/Meta bindings and recorded rollback. Real EN/UR lead-only journeys created only unpaid synthetic-data test orders 000008/000009. No payment method is enabled; no receipt/approval/PAID/fulfillment or CAPI replay was attempted. Tests found and repaired returning-customer identity collision without rewriting historical delivery snapshots; Urdu review/status leakage and replay/stale-field defects were also repaired and retested.

CMS smoke: the harmless Validation EN/UR retry copy was published and observed in actual tester replies, then rolled back to published version 1; the archived test version remains audit-only and draft version 3 matches version 1. Confirmation's English `Total ayable` typo was corrected to `Total payable` and verified on a separate unpaid tester order; Urdu and amount placeholders were unchanged.

Public launch remains NO-GO: name recovery and public release sign-off, beneficiary proof, broader concurrent/reordered callback evidence, and disabled Lead CAPI remain unresolved. Controlled lead-only staging is GO. Do not use pending Lead records as evidence of successful CAPI delivery or test receipts as real payment.

## 2026-10-20: GFS-177 Admin Deploy / API Inbound Hold

Admin staging is deployed and all saved EN/UR payment previews pass after reload. The D1-driven province LIST selector is pushed as `0e12c623b37aafca7a2382ed697fcdea272d2535` and passes local tests, but the API is not deployed because Meta `messages` webhook is actively subscribed to the staging API, the sender display name is Rejected, and no authorized WhatsApp Web tester session is available. Deployment could change real inbound behavior.

The phone is Connected/High quality in the authorized WABA, but no Meta display-name or webhook changes were made. The existing tester/order remains read-only. Payment methods stay disabled until independent beneficiary verification; the Purchase CAPI remains disabled/unreplayed. Rules permit local gates for Admin staging despite remote CI failure, but this does not authorize an API deploy or public release. Latest CI `39419025641` still failed before runner assignment.

Read-only D1 inspection found twelve pending, zero-attempt `WHATSAPP_PAYMENT_INSTRUCTIONS` jobs while all methods were disabled. To prevent the currently deployed old API from sending stale payment text, these jobs were terminally marked `PERMANENT_FAILURE` and audited after Cloudflare identity verification. The one previously SENT job, all orders, payments, receipts, and CAPI records remain unchanged.

## 2026-10-20: GFS-176 QR/Locale Release Gate

The user attested that all three codes belong to Garden Shop. This is stored separately as `USER_ASSERTION_GFS-176`; it is not independent evidence. All independent ownership flags remain false. QR pixels were extracted without regeneration; jsQR and ZBar independently decoded source and derivative to identical payloads. The current JazzCash QR identifier matches D1. Easypaisa's encoded identifier is an alternate to D1 and matches the printed candidate alias; Bank's encoded payload matches neither D1 IBAN nor printed alternate. Neither alternate is declared legitimate or fraudulent without bank/wallet evidence.

Private staging R2 now stores three method-specific 800×800 PNG derivatives. D1 retains original source keys/checksums, links each derivative and payload hash, records tool/decoder versions, scan/payload match, and the separate owner attestation. Active Admin QR pointers use the derivative. Originals were re-read and remained byte-identical. `qr_owner_verified=0` for all three; the staged methods were disabled and audited because EN/UR templates and independent account authorization are incomplete. Recipient/account fields were not changed.

The Admin Urdu field suffix defect was fixed locally. Through the authenticated Admin API, each method's generic instruction/reference/receipt copy was saved as distinct EN/UR text using D1 placeholders; no recipient/account data was altered and no aliases were authorized. The old deployed preview still omits Urdu heading/receipt copy until the fixed UI is deployed. Selectors, stale payment actions, Admin enablement, pending outbox retries, text sends, and QR sends all require a current order and an active matching asset with exact decode/scan evidence and independent ownership evidence.

Chrome MCP `list_pages` was restored through the installed bridge. The authorized WhatsApp tester conversation was not present in the existing WhatsApp Web search, and the active WhatsApp account number was not verified; no customer message was sent. GitHub required CI still has no assigned runner and organization billing requires missing `admin:org` access. No Worker deployment, Meta mutation, or production action is claimed. Release is **NO-GO**.

All three staging EN/UR payment text records were later saved through the authenticated Admin API; recipient/account fields and method flags were unchanged. Staging D1 triggers now prevent the legacy Admin checkbox from self-verifying a QR and stop new tracking/confirmation/transition audit actions on the held incident. New local Admin UI/code guards and tests pass, but the old deployed Admin preview and fulfillment UI remain until required CI runs and deployment is authorized.

## 2026-10-20: GFS-175 Immutable QR Source and Ownership Gate

The requested QR-only extraction cannot be proven or executed without the three original private R2 objects and the authenticated Admin/customer browser surfaces. Do not substitute stale screenshots, locally generated QR content, mocked scans, or decoded values inferred from labels. No derivative or ownership authorization is claimed. The user-recorded Easypaisa merchant mismatch and Bank `BIO TECH - 5038` mismatch remain blocked; JazzCash remains independently unverified.

Local code audit found that the existing Admin save API exposed a `qrOwnerVerified` input and upload replaced/deleted the previous R2 object. The local repair removes the UI control, rejects attempts to set the ownership flag through ordinary Payment Settings, clears it on ordinary settings saves, uses a method-scoped content-addressed key for originals, reuses identical source uploads, and retains previous objects for rollback. This does not create extraction, payload-decode, scan, derivative linkage, or independent authorization capability and has not been deployed.

The current Chrome DevTools MCP namespace is absent. Local diagnostics found Chrome on the existing profile, DevTools port `9222`, package `chrome-devtools-mcp@1.10.1`, and a stale Codex WebSocket UUID. The Codex endpoint was updated to the live `DevToolsActivePort` UUID; this active session still cannot call `list_pages`, so reconnection must be verified in a fresh MCP-enabled session. No dashboard access, identity check, external mutation, live WhatsApp test, or tab inventory is claimed. Preserve the canonical new-number lock, Hoja zero-connection rule, paid-order hold, and CI/branch-protection requirements. Release remains **NO-GO**.

## 2026-10-20: GFS-174 Guided Journey and Launch Gate

GFS-174 keeps the existing guided WhatsApp journey as the launch path and leaves native Flow OFF. Local inspection found and repaired invalid delivery-field acceptance, missing Meta `wa_id` persistence, positional interactive fallback, failed outbound retry, legacy PAYMENT action contamination, missing canonical callback Phone ID enforcement, QR metadata fail-open, missing receipt audit/status action, locale-stale payment idempotency, and unsafe legacy Flow POST acceptance. The repairs passed 105/105 tests, build, lint, and high-severity audit.

The active MCP namespace did not expose Chrome DevTools `list_pages`. Chrome and the packaged bridge were diagnosed, but no MCP initialization result was obtained; no live WhatsApp/Admin claims are made. Cloudflare identity was independently verified as `gisupp@gmail.com` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; controlled staging API/Admin deployments succeeded, while production/config/payment mutations were withheld.

Payment and fulfillment remain fail-closed. QR delivery now requires exact R2 metadata and independent ownership. Approval requires a receipt plus transaction reference. `FS-261019-000001` is explicitly held from confirmation/fulfillment because independent bank verification and Purchase CAPI evidence remain absent. This is a NO-GO, not a request to bypass or repair evidence artificially.

## 2026-10-10: GFS-68 Meta Form Launch First

The temporary customer acquisition launch is separated from WhatsApp API activation. `META_FORM_LAUNCH_FIRST` permits native Meta Form submission and Leads Center capture without a WhatsApp system-user token, phone `/register`, `subscribed_apps`, WhatsApp webhook, or Lead→D1 realtime integration. WhatsApp remains `WHATSAPP_API_ENHANCEMENT_PENDING`.

The canonical Page form list visibly contains active `Free Seeds 04-10-2026` and `Free Seeds 05-10-2026` entries. Existing authority is Form ID `1093015800183328` / `Free Seeds 05-10-2026`; the older `Free Seeds 04-10-2026` is separate. No replacement or duplicate form was created. Remote staging D1 read-only presence checks show JazzCash, Easypaisa, and Bank Transfer all disabled with recipient/instruction/QR fields absent, so payment launch data is gated by `PAYMENT_VALUES_REQUIRED`.

## 2026-10-10: GFS-70 Initial Launch Payment Path

The payment path is now represented by a minimal backend/admin source of truth: staging D1 `payment_configuration.advance_amount_pkr`, positive-integer validation, Access-protected `/payment-amount`, audit action `PAYMENT_CONFIGURATION_UPDATED`, and an invariant that at least one complete enabled payment method is required before saving an amount. The migration and staging admin/API deployments succeeded under the verified Cloudflare account. The amount remains unset and all methods remain disabled, so no customer-facing Meta ending update was attempted.

## 2026-10-10: GFS-71 CTWA Flow Commerce Path

WhatsApp commerce is modeled as customer-initiated CTWA → encrypted Flow → server quote → optional fertilizer decision → order summary → configured payment method details → same-chat receipt. Customer identity fields remain the fixed five; product/province/fertilizer/payment fields are separate commerce fields. Prices and delivery are D1/admin authority, not Flow/client authority. No workbook was found, so catalog/rate rows remain unseeded and the Flow cannot produce a live quote until verified values exist.

The encrypted Flow endpoint and tests are implemented, but live Meta traffic remains gated by Cloudflare `FLOW_PRIVATE_KEY` provisioning and Meta Flow Manager callback/publication. No Meta token, campaign, budget, or paid spend mutation was performed.

## 2026-10-10: GFS-72 Authoritative Launch Tariff

The user-provided tariff is authoritative for the Free Seeds launch and was bootstrapped into staging D1/admin: free five-pack vegetable seeds at Rs. 0, optional Micro Nutrients Fertilizer at Rs. 250, and delivery rates Punjab/Islamabad 250, Sindh/KPK 300, Balochistan/AJK/Gilgit Baltistan 350 PKR. All 14 quote combinations pass live staging smoke checks. Province aliases normalize to canonical customer labels. Payment recipients remain unconfigured and no payment method was enabled.

The staging Flow private key was generated in memory and stored directly as Cloudflare secret `FLOW_PRIVATE_KEY`; the value was never printed or read back. Meta public-key registration and Flow publication remain protected external actions.

## 2026-10-10: GFS-73 Admin Tariff Authority

All dynamic WhatsApp prices/rates are now governed by `ADMIN_TARIFF_SOURCE_OF_TRUTH`: Access-protected `/tariff` edits D1 products/province rates, and the quote endpoint reads D1 on every request. Product price validation accepts zero; delivery fees remain positive. The old fixed `/payment-amount` page is explicitly legacy and cannot overwrite dynamic order totals. Temporary staging edits proved quote propagation without redeploy and were restored.

## 2026-10-10: GFS-74 Meta Flow Gate Audit

Read-only canonical Meta audit found no existing Flow under WABA `2616648355452496`. Flow Manager explicitly requires improved message quality and completed business verification for publication. App WhatsApp setup separately reports missing valid payment method and incomplete App Review; phone status is Pending with display name In Review and no displayed quality rating. The API runtime remains disabled and App↔WABA/durable credential are unverified. No protected credential or Meta mutation was attempted.

## 2026-10-10: GFS-75 Graph Authority and BSUID Readiness

No opaque official WhatsApp Business Tools MCP was available to this agent, so no raw Graph credential path was substituted. Phone/quality/name/runtime claims remain blocked until supported Graph-backed state is available. BSUID is modeled as a scoped customer identity, not a business identifier; `wa_id`, entered/contact numbers, auto WhatsApp number, BSUID, and username remain separate and BSUID absence preserves existing routing.

## 2026-10-10: GFS-76 Registration Does Not Wait on Name Review

The registration attempt was correctly prioritized independently of `name_status=In Review`, but the supported phone UI exposed no register/verify control and the official opaque WhatsApp Business Tools MCP was unavailable. The exact remaining gate is protected Graph credential/official-MCP access; no raw token or PIN path was substituted.

## 2026-10-10: GFS-77 Activation Console and Protected Handoff

Added and deployed an Access-protected activation console with secret-only Graph action support, transient OTP/PIN fields, sanitized status/errors, and canonical asset bindings. Since `META_ACCESS_TOKEN` is absent, no Graph registration/subscription/message mutation was attempted. The secure Meta token-generation and Cloudflare secret surfaces are prepared for direct user entry; execution must continue after the secret name becomes present.

## 2026-10-10: GFS-79 Console Diagnostics and Registration Gate

The token is now present as a Cloudflare secret on both staging Workers and Graph phone reads succeed. The console was corrected to send `locale` for request-code and to expose sanitized failure reason/code/status. Ownership/code verification is already `VERIFIED`; no SMS was requested. `/register` returned Meta `(#133010) The account is not registered`, so the next safe action is direct owner entry of the new six-digit registration PIN.

## 2026-10-10: GFS-80 Connected Phone and Flow Permission

Current Meta state reconciles to a connected phone and canonical App↔WABA subscription. A public-key registration retry now reaches Graph but returns `(#10) Application does not have permission for this action`, proving the remaining Flow-key gate is App/token permission rather than name review or phone registration. Webhook signed verification remains gated by absent App Secret/provider enablement.

## 2026-10-10: GFS-85 App Secret and Single E2E Attempt

`META_APP_SECRET` is now present as an API Worker secret and the API is deployed with provider enabled. The webhook challenge passes and invalid signatures return 403. One authorized send to `+923354299783` returned HTTP 400 with no message ID; no duplicate retry was made. This is a real send failure, not an accepted/delivered claim.

## 2026-10-11: GFS-86 Inbound-First Recovery

The restricted send action was improved to retain safe Meta error diagnostics, but no second send was issued. The remaining runtime dependency is a recipient-initiated customer-service window or an existing approved template; the recipient must send `TEST GFS` before another outbound attempt is safe.

## 2026-10-11: GFS-87 Inbound Webhook Auto-Reply

Meta reports two received messages, while D1 has zero `whatsapp_events`; the first failure is therefore callback delivery/configuration, not message parsing. The API now persists signed inbound events and sends one idempotent welcome reply keyed by message ID. No synthetic callback or fabricated customer reply was created.

## 2026-10-11: GFS-88 Permanent Tab Inventory

Every MCP execution now begins with `list_pages`, reuses the matching existing service tab, and records unrelated-tab changes. The canonical phone list confirms the connected sender, but individual historical sender/message details remain unavailable; no sender identity was invented. The Developer App Webhooks surface remained in loading state, so no callback mutation was attempted.

## 2026-10-11: GFS-89 Meta Production Callback Repair

The first failed hop was Meta App publication: production webhook data was blocked while the App was unpublished. After publication and `messages` subscription, a Meta sample event reached D1. The first auto-reply attempt then exposed a separate deployment defect—missing API `META_PHONE_NUMBER_ID`—which is now fixed and deployed. Sample callback success is not treated as real-customer success; no fabricated sender or reply evidence is accepted.

## 2026-10-11: GFS-90 Real Inbound and Token Failure

The customer message from `+923034901810` is real inbound evidence: two WAMIDs persisted as signed `MESSAGE`/`RECEIVED` events. The idempotent welcome reply attempted once per event but Graph returned `META_MESSAGE_SEND_401`, proving the remaining failure is the API Worker's Meta token runtime, not callback delivery. No duplicate send was attempted.

## 2026-10-12: GFS-99 START Content Boundary

The existing privacy-preserving webhook schema deliberately does not store raw message bodies. Therefore the persisted event IDs cannot prove or replay the customer's START text, and no customer identity/order answers may be invented. A future guided-chat state machine must receive a fresh real message after the content/state contract is implemented.

## 2026-10-12: GFS-100 Privacy-Safe START Routing

Implemented the guided-chat state machine and deployed it with migration `0011_whatsapp_conversations.sql`. START and subsequent answers are parsed in memory; durable state and validated fields are stored without raw message bodies, and responses are idempotent by inbound message ID. Historical START remains unrecoverable, so one genuine START after deployment is the only remaining interaction dependency.

## 2026-10-12: GFS-101 Draft Payment Save

Payment method draft persistence is independent from legacy `payment_configuration.advance_amount_pkr`. Incomplete/disabled drafts may be saved; enabling still requires complete recipient/instruction fields. JazzCash staging presence is confirmed without exposing values, but the displayed QR payee mismatch means it remains disabled pending ownership verification.

## 2026-10-12: GFS-102 Payment Status and Live Order Gate

Payment UX now distinguishes Saved—Disabled from Enabled and Configured; JazzCash cannot be enabled until Garden Shop payee/QR ownership is verified. The privacy-safe START handler is deployed, but no fresh START/state row exists, so no order or customer answer was fabricated.

## 2026-10-12: GFS-103 Order Payment Handoff

The guided-chat CONFIRM transition now persists a dynamic FS order, reports its order number/total and complete enabled method names, and supports JazzCash selection through the existing payment selector. It never marks PAID or emits Purchase CAPI before genuine admin approval. Live testing remains dependent on a fresh customer START and verified JazzCash ownership.

## 2026-10-12: GFS-104 Karachi Atomic Order Numbers

All new creation paths now allocate `FS-YYMMDD-######` using the Asia/Karachi date and atomic D1 sequence allocation. Meta Flow, WhatsApp, and Instant Form replays map to the original order through idempotency keys. Staging migration is applied; no historical order identifier was changed. No WhatsApp Web message was sent because the displayed Web session was not independently proven to belong to the authorized customer.

## 2026-10-12: GFS-105 Live Commerce Boundary

The guided-chat and order-number infrastructure is ready, but no authorized customer-controlled session or fresh START was available. We do not impersonate the customer or invent five field answers; live FS order/payment/fulfillment remains an external customer interaction gate.

## 2026-10-12: GFS-106 Live Order Reconciliation

Staging D1 now contains the owner-reported live order `FS-261012-000001` in `PAYMENT_PENDING` with dynamic Punjab total PKR 250, seed-only items, and JazzCash expected amount PKR 250. This is real order evidence; no payment receipt, approval, PAID transition, Purchase CAPI, or fulfillment claim is made.

## 2026-10-12: GFS-107 Interactive Router and Cooldown

Interactive and text inputs now share normalized semantic routing, preventing repeated welcomes and positional button drift. Order creation enforces the 14-day server-side cooldown using submitted timestamps; only the verified E2E sender is exempt. Native client coverage remains untested outside the available environment.

## 2026-10-12: GFS-109 Protected Admin Reset and Order Controls

Cooldown exemption and conversation reset are separate D1/admin concepts. `/test-controls` manages verified Meta wa_id exemptions and scoped resets; `/orders` provides search/details and only allows audited cancel/archive for eligible unpaid, receipt-free orders. The authorized E2E conversation was reset to NEW while preserving `FS-261012-000001` and all payment history.

## 2026-10-12: GFS-111 Admin Content and Live Guided Chat

Customer messaging copy is now versioned in D1 and managed by protected Admin rather than code deployment. Private content media is referenced only by constrained R2 keys. Current D1 evidence shows a subsequent real guided-chat order `FS-261012-000003` at PKR 500 for Punjab with fertilizer selected and payment-method selection pending. This is guided-chat evidence, not native Meta Flow publication evidence.

## 2026-10-13: GFS-113 Native Flow Boundary

Local Flow schema/encryption validation cannot substitute for Meta publication. The canonical Flow Manager surface was loading without a safely readable Flow ID/status, so no upload/publish mutation was attempted. Guided chat remains the safe launch path.

## 2026-10-13: GFS-116 Flow/Coexistence

Graph-backed Flow asset validation passed for `1133458765899784`, but Meta publish returned `#139002/4233014` Endpoint not available after endpoint health deployment. Canonical phone coexistence read returned `is_on_biz_app=false`, `platform_type=CLOUD_API`; no migration was attempted.

## 2026-10-13: GFS-119 Language-First CTA

START now presents English/Urdu choices and invokes the published Flow after selection. The existing guided backend remains the fallback; no duplicate Flow or customer answer was invented.

## 2026-10-13: GFS-120 Live UI Boundary

The authenticated Admin CMS now renders correctly with paired EN/UR rows and private gallery controls. Native Flow remains published by Graph but no authorized customer-device interaction was available for live CTA evidence; no tap or customer answer was fabricated.

## 2026-10-13: GFS-121 CMS Publish Guard

Already-published CMS versions now return an explicit up-to-date result; publish remains protected until a fresh draft exists. This prevents stale gallery clicks from producing a generic requires-draft error. Native Flow remains published, but device/customer E2E is a separate evidence gate.

## 2026-10-13: GFS-122 Universal Welcome

Any ordinary NEW/idle inbound text now produces the published bilingual welcome and language buttons. Locale choice is persisted by verified wa_id before Flow CTA dispatch; active order/payment/status states are not reset.

## 2026-10-14: GFS-124 Flow First-Screen Repair

Native Flow preview reported unsupported Dropdown `code` properties and an empty first-screen selector. Runtime catalog data and schema are now constrained to `id`/`title`; catalog errors are explicit protocol failures instead of silent empty lists. Live preview/device confirmation remains required.

## 2026-10-14: GFS-125 Replacement Flow v2

Because the original published Flow is immutable and its OFFER selector remained unusable, exactly one replacement Flow was created. v2 removes the redundant product dropdown, begins with fertilizer selection, requires data_exchange INIT, and uses the same D1/order backend. Runtime uses v2; the original remains documented rollback only.

## 2026-10-14: GFS-128 Live Flow Boundary

The deployed v2 first-screen/data contract addresses the Continue failure. Remaining acceptance is customer-device Flow interaction; available WhatsApp Web tabs were not verified as the authorized customer, so no impersonation or fabricated tap occurred.

## 2026-10-14: GFS-130 Continue/OAuth Boundary

The FERTILIZER→PROVINCE contract remains server-catalog/D1-driven and passes local encrypted tests. The available Cloudflare consent tab is a stale/replayed OAuth callback; bypassing or replaying it is prohibited. Live customer Flow acceptance remains a device-session dependency.

## 2026-10-14: GFS-132 Active Flow Authority

The authenticated Manager screenshot was confirmed to be rollback Flow `1133458765899784`, not the active runtime Flow. It retains the old OFFER dropdown and explains the observed Continue failure. Runtime v2 `28410343535328014` remains the configured published Flow; no old Flow mutation was made.

## 2026-10-14: GFS-133 Guided-First Launch

Native Flow live client acceptance remains unverified, so the API runtime is explicitly configured for guided checkout. Published Flow v2 is preserved without deletion or mutation; switching back requires a verified customer-device E2E gate.

## 2026-10-14: GFS-134 MCP/Admin Boundary

The latest Chrome MCP reconnect failed before the Admin Orders snapshot because its transient package installation lacks `pkce-challenge`. No unrelated tabs/accounts were changed and no financial mutation was attempted. Backend controls remain deployed; UI/device verification is a genuine tooling/customer dependency.

## 2026-10-15: GFS-135 Real Order Audit

D1 confirms `FS-261015-000001` exists in `PAYMENT_REVIEW` for PKR 300 with a JazzCash payment record and one receipt. Admin UI navigation now reaches the exact order URL but Chrome returns `ERR_QUIC_PROTOCOL_ERROR`; the mismatch receipt remains unapproved and no financial mutation is allowed.

## 2026-10-16: GFS-139 Professional Orders Console

Orders are managed through four operational queues with server-side counts/pagination and complete D1-backed details. Real order `FS-261015-000001` is PAYMENT_REJECTED by audited staff action and remains unchanged. Approval controls remain receipt/state/CSRF guarded and cannot derive authority from client financial values.

## 2026-10-16: GFS-143 CMS Migration Recovery

Cloudflare 7403 was resolved using the canonical authorized account. Staging D1 lacked migration 0017 media tables; the existing migration was applied once without reset/destruction. Image upload/publish remains unclaimed until authenticated browser evidence exists.

## 2026-10-17: GFS-155 Universal CMS Contract

All editable guided-chat text/button/list labels resolve from published EN/UR CMS versions. Gallery-only publication clones an immutable version and snapshots enabled media. Cached selections are invalidated when version/media membership changes. WELCOME v6 and its private image were published and sent once to the authorized test customer with Meta WAMID/sent evidence.

## 2026-10-17: GFS-156 Fertilizer CMS Validation

The reported `WHATSAPP_CONTENT_INVALID` was caused by an overlength draft action label, not the schema limit. Draft `ADD_FERTILIZER` labels were corrected to valid localized text and audited; no permanent limit was loosened.

## 2026-10-17: GFS-157 Live Tariff Menu

Province delivery menus must not embed prices. The guided router now queries enabled D1 rates per request and displays the current fee in list descriptions; the next quote re-reads D1 and preserves existing order totals.

## 2026-10-17: GFS-158 Payment Route Consolidation

Removed the duplicate `/payment-settings` route that could shadow the canonical bilingual form. Existing payment fields, enable safeguards and QR preview remain intact.

## 2026-10-18: GFS-159 Payment CMS Authority

Payment messages now use the selected conversation locale and Admin payment copy fields; order amount and reference remain server-owned. The API no longer appends a second reference or forces English payment wording.

## 2026-10-18: GFS-166 Dynamic Payment Buttons

Payment method selection now enumerates complete enabled D1 methods in stable order and routes each semantic ID through the existing selector. Payment Help/Support/Check Order are not payment-selection buttons; payment/receipt approval remains gated.

## 2026-10-16: GFS-144 CMS Media Evidence Boundary

Migration and backend prerequisites are repaired, but no approved image upload/WAMID evidence was captured in the current MCP run. We do not claim customer-facing media success.

## 2026-10-16: GFS-141 Operations Controls

Added audited Confirm Order, clearer-receipt and stateful Packing/Dispatched/Delivered controls plus escaped printable labels. These controls never approve payment, assign tracking without an input, or emit Purchase CAPI without verified approval.

## 2026-10-13: GFS-117 Flow/Media Boundary

Flow asset validation succeeds, but Meta publish still rejects the endpoint as unavailable. The API observed an invalid-initial-vector result for live encrypted requests; no customer Flow success is claimed. Media gallery work remains private-R2/D1 controlled and does not alter pricing/order logic.

## 2026-10-13: GFS-118 Flow Publication

Removed the unsupported dropdown `code` property, repaired RSA Flow request/response IV handling and re-paired public/private keys. Meta accepted the existing Flow asset and publish request; Graph now reports `PUBLISHED` with no validation errors. Native device E2E remains a separate evidence gate.

## 2026-10-13: GFS-114 Graph Flow Creation

Graph-first recovery found no existing Flow and created exactly one canonical draft `1133458765899784`. Meta returned actionable asset-upload errors (`#100` then `#195/2498084` requiring `flow.json`); publication remains blocked until the corrected asset upload is accepted.

## 2026-10-11: GFS-92 Token Validation Order

The activation console server-side ladder now returns HTTP 401 for `/me`, permissions, phone, and WABA reads. This is an authoritative runtime token rejection despite secret-name/deployment presence. No blind rotation or duplicate customer message was performed; the only remaining protected action is canonical token replacement.

## 2026-10-11: GFS-98 Fresh Token and Atomic Reply

The owner-installed canonical token now passes the sanitized Graph ladder. Exactly one previously failed welcome reply was atomically retried; Meta accepted it and D1 recorded the outbound WAMID and `sent` status webhook. A later inbound MESSAGE event arrived, but its content was not available from D1 metadata; no order/Flow answers were fabricated.

## 2026-10-11: GFS-96 Token Snapshot Incident

Meta rendered token material in an MCP page snapshot during system-user inspection. The value was not intentionally copied or stored, and no replacement token was generated. Because a token-specific revoke control could not be reached safely in the loading UI, execution stops at `TOKEN_REVOCATION_UI_REQUIRED` rather than risk further credential exposure.

Meta Form read-only inventory remains separate from WhatsApp commerce: historical canonical evidence includes customer fields plus product/province/fertilizer/amount answers, while this Flow owns server-authoritative product/rate/quote data. No Form or campaign mutation occurred.

## 2026-10-10: GFS-69 Final Meta Form Preparation

The canonical form's verified five-field contract remains Full Name, Complete Delivery Address, Nearby Famous Place, City, and Contact Number, with no Email. The customer-facing completion copy is prepared but cannot be published until authoritative Garden Shop payment amount and recipient details exist. The draft campaign is visible and remains unpublished; its Rs2,625 daily budget is not authorization to spend, and exact Form attachment was not verified.

## 2026-10-09: GFS-60 MCP and Active Sender Authority

The active launch state is `META_ASSETS_PENDING` for sender `+923044429933`, Phone Number ID `1323932417479627`. The former sender `+923328883383` / Phone Number ID `1429127796940691` remains historical only and must not be runtime configuration.

Local diagnostics found Chrome stable running with the existing profile, `DevToolsActivePort` at port `9222`, and `chrome-devtools-mcp` `1.10.1` available. The Codex MCP registration still contains a stale WebSocket UUID, while this agent session does not expose the Chrome DevTools MCP namespace. No browser, Meta, Cloudflare, credential, or secret mutation was performed.

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

## 2026-10-03: GFS-38 Instant Form Fallback

Meta Instant Form is the temporary primary acquisition channel while WhatsApp phone verification and canonical App↔WABA subscription remain pending. WhatsApp remains the target primary channel; Facebook Messenger is support-only and Instagram DM automation is deferred. All allowed source values (`META_INSTANT_FORM`, `WHATSAPP`, `FACEBOOK_MESSENGER`, `INSTAGRAM_DM`) share the existing D1 customer/lead/order/payment workflow.

The canonical Page `101192938541236` Instant Form editor was configured with More volume, the offer “Get 5 Seed Packs FREE,” delivery/payment disclosure, and five data categories: Full name, Phone number, Complete Delivery Address, Nearby Famous Place, and City. Email was removed. Meta blocked saving/publishing because privacy/ending are incomplete after the policy-link field interaction failed. No form ID, campaign draft, publication, spend, or lead was created.

The backend now has an additive `lead_sources` table and a disabled-by-default signed Meta Instant Form webhook pipeline. It retrieves Graph lead data only after a separate authorized lead token exists, normalizes the five fields, deduplicates by provider lead ID, persists source/form/ad attribution, and emits one `lead_<FS_ORDER_ID>` event after durable D1 storage. Purchase stays locked behind Garden Shop manual approval.

## 2026-10-04: GFS-39 Existing Form and Allowlist Lock

The only canonical Instant Form is `Free Seeds 04-10-2026`, Form ID `2816887225374285`, owned by Page `101192938541236`, status **Active**, created Oct 4 2026, currently 0 leads. No second form is created or edited. Backend leadgen accepts only matching `page_id` and `form_id`; it ignores unrelated events before queueing and rechecks the same allowlist after Graph retrieval. `lead_sources.page_id` stores the verified Page attribution.

Actual Meta leadgen subscription and real test lead remain blocked because the canonical App/Page subscription and least-privilege lead token are not available. Instant Form and WhatsApp ingress paths remain separate while sharing the normalized D1/order pipeline. No campaign draft or spend is allowed until a real lead passes end to end.

## 2026-10-04: GFS-40 Leadgen App Gate

The canonical WhatsApp App `2354726831735899` was inspected through its Add use cases surface. It exposes only the WhatsApp use case and no Lead Ads/Page Webhooks option. The supported Meta Create an App wizard was opened for a dedicated GFS lead app under the same Garden Shop root; Marketing API was selectable, but the Business step remained disabled/stalled before any App ID or business assignment was created. No second App mutation was completed, no token was generated, and no Hoja asset was touched.

The exact unavoidable gate is `META_LEAD_APP_CREATION_BUSINESS_STEP_STALLED` plus missing least-privilege lead token/Page subscription. Instant Form remains disabled-safe and WhatsApp remains independent.

## 2026-10-04: GFS-41 Canonical Form Switch and Permission Safety

The canonical Instant Form is now Form ID `1093015800183328` on Page `101192938541236`. Form `2816887225374285` is superseded and must be rejected by the backend. The active Cloudflare variables and exact Page/Form allowlist are switched to the new ID; no second form was created.

Chrome DevTools MCP continues to reuse the authenticated Saeed session. Routine same-site Meta navigation may use the existing session permission state; password/reauth, OTP/2FA, CAPTCHA, spend/publication, payment, deletion, deregistration, and destructive actions remain explicit approvals and are never globally auto-approved.

## 2026-10-04: GFS-42 Business Restriction Diagnosis

Business `568026370701542` was inspected read-only through Business Info and app creation. It is Meta Verified, Saeed Nazim has Full access, and two-factor authentication is on; however, legal business identity is `Hoja Seeds`, website `https://hojaseeds.pk/`, phone `+923034901810`, with no primary business location. The lead-app wizard's Business step remains disabled, so no dedicated App was created and no token/Page subscription was attempted. This is the exact supported-path blocker, not a permission-loop guess.

Ads Manager showed an existing unpublished Leads draft (`120255495379100054` / `120255495379110054` / `120255495379120054`) in the canonical ad account. It was not published, spent, duplicated, or edited while lead integration is blocked.

## 2026-10-04: GFS-43 Campaign Readiness and Support Boundary

The existing Ads Manager draft `120255495379100054` / `120255495379110054` / `120255495379120054` remains the single draft. It is visibly unpublished and Leads/Form-oriented, but the edit surface remained Loading, so exact attachment to Form `1093015800183328`, creative, placement, audience, and preview were not claimed. No publish/spend/edit occurred.

Native Meta Leads Center for Page `101192938541236` is accessible and currently shows zero leads. Realtime backend sync remains blocked by the missing lead-capable App/token/Page subscription. Business Support Home exposed no supported case form or case ID; no support mutation was forced.

## 2026-10-05: GFS-44 Messenger and Payment Boundary

An Instant Form submission is not treated as a Messenger conversation. The canonical Leads Center showed zero leads, and no native continuation/session or automatic Page message was exposed. Ads Manager's existing draft edit surface remained Loading, so no unsupported Messenger option was invented or configured.

Payment automation is blocked by configuration: all bootstrap Garden Shop payment methods are disabled and recipient values are absent. No order number, payment instructions, receipt request, or customer notification was sent. Exact gate: `PAYMENT_AMOUNT_NOT_CONFIGURED`; a Rs. 0 request is prohibited.

## 2026-10-05: GFS-45 Native Messenger and Lead Proof

The existing canonical Form `1093015800183328` visibly includes checked Messenger consent and WhatsApp options. A supported synthetic preview submission produced one native Leads Center Intake lead with Form ID `1093015800183328` and actual submitted answers. The ending screen states a Messenger conversation was created and Leads Center exposes a Chat pane; because the session is the operator account and no new customer-side message appeared, customer receipt/automation is not claimed.

The form's WhatsApp CTA exposed a noncanonical phone target (`923124093162`) and was not clicked. This does not change the canonical WhatsApp sender. The custom backend still has no lead token/Page subscription, and Garden Shop payment methods remain disabled/unconfigured, so no D1 order or payment request was fabricated.

## 2026-10-05: GFS-46 Customer Recipient and Deferred Follow-up

The native test lead proves customer contact data is separate from the business sender: Form `1093015800183328` submitted phone `03034901810`, normalized to `+923034901810`, and Leads Center also shows WhatsApp number `+923034901810`. This is `CUSTOMER_WHATSAPP_NUMBER`; it must never overwrite sender `+923328883383`. The legacy CTA target `923124093162` remains prohibited.

The backend now prepares `WHATSAPP_ORDER_CONFIRMATION` only after durable Form lead/order persistence, with order/customer/recipient references and no full PII. Queue processing defers it while `WHATSAPP_OTP_REQUIRED`, App↔WABA is absent, or provider is disabled. Payment instructions remain blocked by `PAYMENT_AMOUNT_NOT_CONFIGURED`.

## 2026-10-05: GFS-47 Two Customer Numbers

Customer contact and Meta auto-fetched WhatsApp numbers are separate fields. The entered number is stored as `contact_number`/`normalized_contact_number`; the Meta WhatsApp number is stored as `whatsapp_number`/`normalized_whatsapp_number`. Existing `normalized_phone` rows are preserved and backfilled into normalized contact values. `wa_id` is used only if Meta actually supplies it.

Recipient resolution is deterministic: valid Meta `wa_id`, then auto WhatsApp number, then entered contact number; identical candidates collapse to one, the business sender `+923328883383` and old CTA `923124093162` are rejected. `WHATSAPP_ORDER_CONFIRMATION` stores only order/customer references and remains deferred while OTP/App-WABA/provider gates are active.

## 2026-10-05: GFS-48 Real Lead Verification and Payment Gate

Leads Center read-only detail confirms the native test lead carries two separate customer numbers: manual contact `03001234567` and Meta auto-fetched WhatsApp `+923034901810`. It also exposes Form ID `1093015800183328`, synthetic name/address/place, Punjab, product selection, and text amounts (Rs. 500 total / Rs. 250 advance + fertilizer). These form answers are not authoritative Garden Shop payment configuration; no order/payment request was created.

Current state is `WHATSAPP_OTP_REQUIRED`; sender activation, App↔WABA, custom lead sync, and payment recipient configuration remain independent gates.

## 2026-10-05: GFS-49 Payment Settings Admin

Admin `/payment-settings` was added using existing payment-method/D1/R2 APIs only. Access is restricted to `gisupp@gmail.com`; all three methods render incomplete/disabled. Synthetic validation returned 400 for an incomplete enabled method, synthetic disabled save/restore returned 200, and QR retrieval returned 404 for all methods because no real QR is configured. No real Garden Shop payment value was invented or stored.

## 2026-10-08: GFS-51 WhatsApp Sender Switch

The authorized business sender is now `+923044429933` (`03044429933`). Former sender `+923328883383` and Phone Number ID `1429127796940691` are superseded and must not be runtime recipients or sender config. The new Phone Number ID is unknown until Meta adds/verifies the new number; OTP must target only the new number. No old-number deletion/deregistration is authorized.

## 2026-10-08: GFS-51 New Sender Onboarding Gate

Canonical WABA `2616648355452496` still shows old `+923328883383` In Review/Unverified. The supported Add Phone flow for authorized `+923044429933` reaches an existing Business profile pending state with Add number disabled; Meta has not displayed a new Phone Number ID or OTP action. Exact gate: `WHATSAPP_NUMBER_SLOT_BLOCKED` / pending Business profile. No old number deletion or deregistration was attempted.

Toolchain audit currently reports Wrangler 4.145.0's transitive Miniflare/sharp librsvg advisory; the only automated fix is a breaking `wrangler@4.15.2` downgrade. Do not force it during sender onboarding; track as a dev-toolchain security update.

## 2026-10-08: GFS-52 Old Sender Deletion Gate

User explicitly authorized deletion of old `+923328883383` / Phone ID `1429127796940691`, but canonical WABA Add Phone is blocked by an existing Business profile pending state with Add number disabled. No safe deletion confirmation was available in the supported flow, so the old phone was not deleted/deregistered. New `+923044429933` was not added and no OTP was requested.

## 2026-10-08: GFS-53 Current Slot State

Active governance state is `WHATSAPP_NUMBER_SLOT_BLOCKED`. No OTP is available until Meta resolves the pending Business profile/Add Phone disabled gate. Old-phone deletion remains explicitly authorized but is not forced without a phone-specific supported confirmation; no WABA/App/Business/Page deletion is permitted.

## 2026-10-08: GFS-54 Support Escalation Boundary

Canonical WABA Help was inspected once. It routes to Business Support Home/category updates but exposes no supported case form or reference-ID creation control. No duplicate support attempt, phone deletion, or Add Phone retry was made.

## 2026-10-08: GFS-55 New Sender Asset Verified

Canonical WABA `2616648355452496` now contains `+923044429933` with Phone Number ID `1323932417479627`. Meta UI shows display name `Get Free Seeds`, status `In Review`, quality/status `Pending`, and pending display-name review. The number asset exists, so active state advances to `META_ASSETS_PENDING`; Meta review is not claimed complete.

Canonical App `2354726831735899` API Setup still exposes only test/Hoja WABA `1932075647340454` and Hoja/test numbers. The canonical WABA/new phone is absent, proving App↔WABA is not connected. Cloudflare has no WhatsApp secrets; provider remains disabled. Old sender remains visible in WABA but is prohibited from runtime.

## 2026-10-09: GFS-56 Canonical System User Assignment

A clean Employee system user `Automation` (`61595003169877`) was created under the authorized Business. It is assigned exactly canonical App `2354726831735899` with Develop app/View insights/Test app access and canonical WABA `2616648355452496` with management/messages partial access. No Hoja asset was selected.

This assignment enables the supported credential path but does not itself prove `/{waba-id}/subscribed_apps`. App API Setup still displays only test WABA `1932075647340454`; canonical WABA/new phone remains absent. `Generate token` would populate and expose a secret token, so execution stops at `META_CREDENTIAL_PROVISIONING_REQUIRED`. Cloudflare secrets remain empty and provider disabled.

## 2026-10-09: GFS-58 Assignment Verified, Credential Gate Remains

System user `Automation` (`61595003169877`) visibly owns exactly canonical App `2354726831735899` and WABA `2616648355452496`, with partial App development and WhatsApp management/messages permissions. This is not `subscribed_apps`; official remote WhatsApp Business Tools OAuth is unavailable to this active agent, and token generation would expose a secret. Provider/webhook/send remain disabled.

## 2026-10-09: GFS-57 OAuth/Graph Credential Boundary

Phone ID `1323932417479627` is authoritative in the WABA phone surface, but display-name/quality review remains Pending. Canonical App/WABA assets are assigned to system user `Automation`; this is not `subscribed_apps`. The official WhatsApp Business Tools remote MCP/OAuth handoff is unavailable to the active agent, and Meta token generation would expose a secret, so the exact gate is `META_CREDENTIAL_PROVISIONING_REQUIRED`. Provider/webhook/send remain disabled.

## 2026-10-06: GFS-50 MVP Blocker Closure Boundary

The canonical Form's product/province/fertilizer/delivery answers are customer/form data, not authoritative Garden Shop pricing configuration. No deterministic server-side pricing rule or real recipient values are available, so `PAYMENT_AMOUNT_NOT_CONFIGURED` remains active and no payment message is permitted.

Native Messenger Chat context remains observable from the synthetic lead, but no acknowledgement was sent because customer-side delivery was not independently observable. Automated lead→D1 sync remains blocked by the missing lead-capable App/token/Page subscription; no recurring manual import is introduced.

## 2026-10-19: GFS-169 Authorized Tester and One-Order Payment Coverage

The WhatsApp Profile Settings surface visibly identified the signed-in account as the project-authorized E2E tester (wa_id suffix `9810`). This authorization was accepted because it is the explicitly registered test identity, not because it matched an old historical assumption. Only the GFS sender chat was used; unrelated personal conversations were not inspected or changed. The existing protected test-controls registration was reused and one audited, history-preserving reset was performed.

One real guided checkout created `FS-261019-000001` at PKR 500 (fertilizer plus Punjab delivery). All three complete enabled methods were rendered against this same order through the canonical payment-selection endpoint; no duplicate order, receipt, approval, PAID, CAPI, or fulfillment action was created. The final Admin state is `PAYMENT_PENDING` with `BANK_TRANSFER`, PKR 500 expected, no receipt, and seven method-selection audit events caused by the one live selection plus safe same-order rendering checks. The extra audit events are acceptable and financial history is preserved.

WAMIDs were not exposed by WhatsApp Web or Admin evidence. Browser timestamps and internal WhatsApp request IDs are explicitly not accepted as WAMIDs, so the evidence is recorded as WAMID-unavailable rather than guessed. Payment recipient/account values remain masked and protected from documentation.

The current API/Admin deployment versions were read-only verified under `gisupp@gmail.com` in clean Cloudflare account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`: API `2c0335e7-0914-42eb-9501-b207bbe9752b`, Admin `f7acf3f3-4e5e-498e-bdd5-697eb30cd0de`. No Worker deployment, secret, Meta, billing, or payment approval mutation was performed.

## 2026-10-19: GFS-170 Payment QR Delivery Safety Gate

The guided payment branch must not reuse CMS `PAYMENT` gallery media. It now resolves the selected D1 payment method, verifies the private R2 object and ownership gate, sends text and QR independently, and persists separate outbound provider IDs/statuses. Missing QR is text-only; any unverified or corrupted QR is blocked and audited.

The live staging configuration has JazzCash QR bytes but no independent payee/QR ownership verification (`qr_owner_verified=0`), while Easypaisa and Bank Transfer are complete text-only methods. No existing financial data was replaced and no QR was marked verified. Because Chrome DevTools MCP was unavailable, no live customer branch was exercised and no WAMID or screenshot was claimed.

## 2026-10-19: GFS-171 Three-QR Reconciliation

The earlier “no Easypaisa/Bank QR” result was stale D1 data: current Admin/D1/R2 evidence shows all three private JPEG objects exist and hash/size/MIME match. That does not authorize delivery. JazzCash is visually consistent with Garden Shop/TILL, while Easypaisa and Bank visibly identify different merchant/account information; all three remain ownership-unverified and QR-blocked.

The historical GFS-169 order changed externally to `PAID/APPROVED` and was preserved. A fresh authorized pending order was used. A state-machine defect that ignored payment-method actions after entering `PAYMENT_PENDING` was repaired and deployed. Browser retest after deployment is required; no raw API or fabricated customer evidence substitutes for it.

## 2026-10-19: GFS-172 Launch Gate and Payment Incident

All three QR objects are present and cryptographically consistent, but ownership is not established by upload, hash, or an Admin checkbox. Easypaisa and Bank verification flags were cleared after current QR visuals contradicted configured recipients. JazzCash remains blocked pending independent ownership evidence.

The fresh pending order successfully delivered all three text branches with separate `READ` WAMIDs and matching PKR 500/reference data. Bank QR delivery occurred before the unsafe flag was cleared and is recorded as an incident; no reversal or automatic financial mutation is permitted.

The historical paid order has receipt/actor/timestamp/audit evidence but no external transaction reference or independent bank verification. Its transition to `PACKING` and dead-lettered Purchase CAPI require an explicit fulfillment hold and manual incident review. Check Order was repaired by canonicalizing whitespace commands and then returned the pending order state; launch remains NO-GO for the financial/QR incident.

## 2026-10-19: GFS-173 Locale and Action Safety

The payment-language defects were caused by shared English fields being rendered in the Urdu preview and by `formatPaymentMessage()` falling back per field. Dedicated Urdu instruction/reference columns and a fail-closed `PAYMENT_TRANSLATION_MISSING` path are now the authority. English copy containing Urdu script is rejected; Admin reports missing Urdu translation before customer delivery. Locale-specific CMS fallbacks are explicit and never silently mix languages.

Payment selection is now strictly method-only: complete enabled D1 methods generate the buttons, while `CHECK_ORDER` is status-only and Help/Support/Payment Help are not selector controls. Legacy action rows are ignored during CMS load/publish rather than crashing or recreating obsolete actions. Invalid and stale taps return a localized safe response without state mutation.

No live browser or external dashboard evidence was claimed because the active session did not expose Chrome DevTools MCP. No Cloudflare, Meta, GitHub, payment, QR ownership, fulfillment, or financial mutation was attempted in this execution. Local gates passed with 105 tests, build, lint, and zero high-severity audit findings. Launch remains NO-GO for unresolved QR ownership and the paid/packing incident.

PR #8 required CI run `39262725184` was triggered after the push and failed before any recorded job step or downloadable log. This is an external CI failure, not a local test failure; the branch is not mergeable on this evidence and no bypass is permitted.
