# Get Free Seeds Binding Rules

## GFS-181 Payment Resolution and Launch Completion (2026-10-20)

- Existing owner-uploaded JazzCash, Easypaisa, and Bank Transfer QR files are accepted as private draft assets when R2 integrity, method linkage, decoder agreement, payload equality, scan, MIME, size, and D1 hash evidence pass. Draft acceptance is not beneficiary verification and never enables a method.
- Keep QR integrity, owner attestation, destination matching, and independent beneficiary verification as separate evidence fields. `USER_ASSERTION_GFS-176` remains an owner statement only; it cannot set either ownership flag or authorize delivery.
- Current staging evidence passes QR integrity for all three methods, but no authenticated merchant/bank record was accessible in the inspected browser session. JazzCash has a D1 identifier match without independent wallet proof; Easypaisa has a decoded identifier/D1 mismatch with a printed alias candidate but no alias proof; Bank Transfer has no exact decoded match to the configured IBAN or printed alternate. All three remain disabled and non-payable.
- If provider evidence is inaccessible after one authenticated inspection, record the exact blocker and required evidence once, then continue local, simulated, lead-only, and documentation work. Do not loop, guess a beneficiary, alter recipient fields, or enable a method.
- GFS-181 reuses GFS-178/GFS-180 real EN/UR lead-only evidence and WAMIDs. Payment-tail, receipt, approval, PAID, and fulfillment results are not inferred from lead-only or simulated tests. Simulated disabled-method fixtures must remain clearly labeled and cannot change financial state.
- Public lead-only readiness is assessed separately from payment readiness: identity/consent, privacy-safe persistence, signed webhook/canonical sender checks, idempotent retries, concurrent/reordered callback acceptance, Lead CAPI delivery, and release authorization each require their own evidence. No paid spend, public promotion, or production payment launch is implied.

## GFS-174 Final Guided Journey Lock (2026-10-20)

- Guided WhatsApp checkout remains the only launch path; `WHATSAPP_CHECKOUT_MODE=guided` is required and the legacy `/flows/get-free-seeds` POST is disabled while guided mode is active. Native Meta Flow remains OFF for launch.
- New payment selectors may contain only complete, enabled, locale-complete D1 payment methods. `PAYMENT_HELP`, `SUPPORT`, and `CHECK_ORDER` are never selector actions; historical taps receive safe localized handling without mutating payment state.
- Interactive actions require stable semantic IDs. Numbered text fallback is state-aware for language, fertilizer, and review controls; no positional button IDs are synthesized.
- Webhook callbacks fail closed unless every callback carries the configured canonical `META_PHONE_NUMBER_ID`; rejected callbacks write only a sanitized audit reason. The new-number WhatsApp lock is never bypassed.
- QR delivery requires exact R2 content type, image signature, method metadata, and D1 SHA-256 metadata in addition to independent `qr_owner_verified`; missing metadata is blocked, not inferred.
- Payment approval requires a receipt and a customer transaction reference. Incident `FS-261019-000001` is hard-blocked from confirmation/fulfillment transitions until independent verification and incident review are recorded. No reversal, CAPI replay, dispatch, or artificial approval is permitted.
- GFS-174 evidence is strictly separated: local tests/build/lint/audit are not live WhatsApp/Admin evidence. Missing Chrome DevTools MCP, WAMIDs, screenshots, or third-party authorization must be reported as `BLOCKED`, never inferred.

## Identity and Isolation

- Public brand: Get Free Seeds.
- Operational merchant and payment recipient: Garden Shop.
- Customer identity: Get Free Seeds / Free Seeds In Pakistan.
- Current WhatsApp launch display name: `Free Seeds` (Meta's verified App console requires an authorized phone sender; display-name-only is not treated as runnable).
- Customer-facing Page: `https://www.facebook.com/FreeSeedsPK/` (Page ID `101192938541236`); it is not a runtime dependency until clean Meta ownership is verified.
- Designated Meta/advertising/WhatsApp ownership context: `Creeper Seeds`.
- Current authenticated Saeed A Nazim Meta session is authorized as the operator for creating/managing the new clean Creeper Seeds context. `ayesha.butt55@hotmail.com` remains historical/intended ownership context, but Ayesha authentication is not a prerequisite when the working Meta session exposes the required clean, non-Hoja authority. Do not force logout/login solely to match the intended email.
- Cloudflare, GitHub, and Get Free Seeds admin account: `gisupp@gmail.com` only.
- Never use `ayesha.butt55@hotmail.com` for Cloudflare/GitHub, and never use `gisupp@gmail.com` as the intended Meta owner for this new clean setup.
- Creeper Seeds is authorized for Get Free Seeds advertising, Click-to-WhatsApp campaigns, WhatsApp Business Platform/WABA, Meta App, system user/token ownership, Page/WhatsApp linkage, and CAPI/event-source integration.
- Hoja Seeds has zero runtime/backend connection. Do not use, import, reference, share, or depend on any Hoja Seeds repository, source, database, Cloudflare resource, domain, DNS, API, secret, payment credential, customer record, CRM data, analytics, webhook, campaign, deployment, or configuration. The only explicit exception is the Meta-only root authorized below; it must never cross into GFS backend/payment/runtime resources.
- The known Hoja-linked Cloudflare account ID `85f6a6181b4653c2a45e69cb7ce8a474` is prohibited.
- Hoja portfolio, WABA, app, dataset, system user, ad account, credentials, and old Garden Shop WhatsApp assets remain prohibited except for the explicit Meta-only root below; unrelated Hoja assets inside that root remain excluded.
- Explicit Meta-only exception authorized by the user: Business Portfolio `568026370701542` and existing Creeper Seeds Ad Account `1198439777611633` may be used for Get Free Seeds Meta advertising/CTWA/WhatsApp/App/WABA/CAPI only. Do not create another Business Portfolio, and do not share this root with Cloudflare, GitHub, D1, R2, payment, or other backend resources.
- Google Sheets is not an operational dependency. Cloudflare D1 is authoritative.

## Customer Journey

- `META_FORM_LAUNCH_FIRST`: temporary lead/order-request launch uses the canonical Meta Instant Form and native Leads Center; it does not depend on the WhatsApp system-user token, `/register`, `subscribed_apps`, WhatsApp webhook, or Lead→D1 realtime integration. The separate WhatsApp API track remains `WHATSAPP_API_ENHANCEMENT_PENDING`.
- `INITIAL_LAUNCH_PAYMENT_FIRST`: the first customer launch gate is authoritative Garden Shop payment configuration and immediate post-submit payment/receipt instructions. It does not authorize campaign/ad edits, paid spend, WhatsApp API work, or Lead→D1 realtime work. Payment amount and at least one complete enabled method must come from D1/admin; never use placeholders, synthetic values, zero-value requests, or Hoja values.
- `WHATSAPP_FLOW_CTWA_LAUNCH_FIRST`: the WhatsApp order path begins from a customer-initiated Click-to-WhatsApp conversation. Use the encrypted Flow endpoint, server-side catalog/province quote, optional fertilizer upsell, order summary, configured payment buttons/details, and same-chat receipt. Do not rely on Instant Form phone capture as WhatsApp consent or a proactive messaging window.
- Flow publication is not messaging runtime readiness: public encryption keys are non-secret and may be registered in Meta; the matching private key remains Cloudflare secret-only. Never read/export raw Meta credentials, private keys, passwords, OTPs, or 2FA PINs.
- `WHATSAPP_CHECKOUT_MODE=guided` is the safe fast-launch default; native Flow remains published/rollback-capable but opt-in until live client acceptance is proven.
- When Flow Manager is unavailable, Graph-backed Flow discovery/upload is authoritative. Flow assets must use multipart `asset_type=FLOW_JSON`, field `name=flow.json`, and file filename `flow.json`; publish only after Graph validation succeeds.
- Published Flow structures are immutable: use one validated replacement Flow, keep the prior ID as rollback, and switch runtime CTA through `META_FLOW_ID` only after publish/health PASS. Flow session tokens are expiring HMAC bindings to trusted Meta wa_id.
- `GRAPH_ACTIVATION_AUTHORITY`: current supported Meta Graph/WhatsApp Business Tools state is authoritative for phone registration, quality/name status, App↔WABA subscription, and runtime readiness; dashboard banners are not proof of activation.
- `INITIAL_PHONE_REGISTRATION_DOES_NOT_WAIT_ON_NAME_REVIEW`: ownership verification precedes `/register`; do not wait for `name_status` approval unless Meta explicitly requires it for the registration case or Graph returns that exact blocker. Track name review separately.
- Meta phone verification request payloads use the official `locale` field; OTP verification is distinct from the six-digit registration PIN. Activation-console failures must expose only sanitized `reason`, error code, and HTTP status.
- `BSUID_USER_IDENTITY_NOT_BUSINESS_ID`: a Meta BSUID is a customer/user-scoped identity, never a Business ID. Store it separately with its business scope when Meta supplies it; never invent or route by it without current official support.
- `BSUID_READY`: preserve `CUSTOMER_CONTACT_NUMBER`, `CUSTOMER_WHATSAPP_NUMBER`, and `META_WA_ID` independently. BSUID absence leaves existing recipient resolution unchanged, and different business scopes must never collide.
- `META_ACTIVATION_CONSOLE`: all Meta activation actions use the Access-protected admin console and secret-only `META_ACCESS_TOKEN`; OTP/PIN fields are transient password inputs, never persisted or logged. Public status is sanitized and never includes credentials.
- If a Meta token ever appears in an MCP-rendered page snapshot, treat it as compromised: stop generation, close the token surface without rereading it, revoke the affected token through Meta's visible revoke control, and do not create a replacement until revocation is proven.
- Webhook challenge and signed POST are separate gates: `WEBHOOK_VERIFY_TOKEN` authenticates the GET challenge; `META_APP_SECRET` validates `X-Hub-Signature-256` POSTs. A challenge pass never proves signed-event readiness.
- Inbound text events receive one idempotent welcome reply keyed by the Meta message ID; replayed callbacks must not duplicate the reply. Outbound replies remain subject to Meta's customer-service window/template rules.
- Conversation commands/answers are parsed in memory, then only normalized intent/state and validated order/customer fields are persisted in D1. Raw WhatsApp message bodies are not stored. Every transition is keyed by the real inbound message ID and queues one response after durable state update.
- Interactive WhatsApp replies use stable semantic IDs, not positional `button_0`/`button_1`; text/button/list/Flow replies normalize into one dispatcher, with numbered text fallback when a client lacks interactive support.
- New customer orders are blocked for fourteen 24-hour days from the last submitted order, except the verified E2E sender `+923034901810`; UI/input changes cannot bypass the server/D1 rule.
- Cooldown exemptions are D1/admin managed by verified Meta `wa_id`; only `923034901810` is initially exempt. Conversation reset is a separate explicit audited action and never deletes historical orders, payments, receipts, or audit records.
- Admin order cancellation/archive is Access-protected, CSRF-confirmed, audited, and limited to eligible unpaid orders; PAID orders, real receipts, and financial history are never hard-deleted.
- Shipping labels are operational documents only: generated from authoritative order/customer D1 data, escaped for print, and never used to imply dispatch or payment approval. Tracking IDs are recorded only when assigned.
- Admin Orders opens all active orders newest-first with server pagination/counts; payment approval requires a receipt plus independently verified funds, payee, amount and unique reference. Client-supplied financial authority is never accepted.
- Payment Settings saves are draft-safe: incomplete/disabled method values may be persisted for later verification, but enabling a method requires complete recipient and instruction fields. Legacy fixed advance configuration never blocks dynamic WhatsApp order totals.
- New orders use a Karachi-dated, atomic `FS-YYMMDD-######` identifier. Historical order numbers are immutable; replay/idempotency returns the original order without consuming a second sequence.
- After FS order confirmation, only complete enabled payment methods may be offered; selected method details must use persisted `orders.total_payable`, and PAID/CAPI Purchase requires genuine admin approval.
- Customer-facing WhatsApp copy is versioned, bilingual, Access-protected Admin/D1 content. Only allowlisted placeholders and private `whatsapp-content/` R2 media references may be published; action IDs, pricing, payment logic, and security rules remain code-controlled.
- Gallery-only changes create a new immutable published CMS version. Cached media selections must match the current published version, enabled media and snapshot membership or be safely reselected.
- `ADMIN_TARIFF_SOURCE_OF_TRUTH`: all product prices, fertilizer prices, pack quantities, and province delivery fees live only in Access-protected admin/D1 and are editable without deployment. Flow/runtime code and Flow JSON must never embed permanent tariff values; tests may use clearly labeled fixtures only.
- Temporary primary acquisition channel is Meta Instant Form; target primary after approval is WhatsApp; Facebook Messenger is secondary support and Instagram DM automation is deferred.
- Native Instant Form Messenger continuation is available when the customer selects Meta's checked Messenger consent option and Meta creates the messaging context. Form completion alone still does not prove a customer-side message was received; verify the native session/message separately.
- An Instant Form customer WhatsApp/contact number is a recipient value (`CUSTOMER_WHATSAPP_NUMBER`), never the GFS business sender. The current business sender is `+923044429933`; superseded `+923328883383`, old Phone ID `1429127796940691`, and CTA target `923124093162` are prohibited for runtime.
- `CUSTOMER_CONTACT_NUMBER` is the number manually entered in the form; `CUSTOMER_WHATSAPP_NUMBER` is Meta's auto-fetched WhatsApp number. Persist both separately and never overwrite either.
- WhatsApp recipient priority is Meta `wa_id` when actually supplied, then `CUSTOMER_WHATSAPP_NUMBER`, then `CUSTOMER_CONTACT_NUMBER`; deduplicate identical candidates and reject the business sender/old CTA target.
- Any customer WhatsApp follow-up requires an eligible Meta messaging context/consent and a verified sender; a phone field alone does not authorize proactive WhatsApp automation.
- Meta Instant Form is the sole authorized temporary customer web form; no additional website form or custom domain is introduced.
- All allowed channel sources (`META_INSTANT_FORM`, `WHATSAPP`, `FACEBOOK_MESSENGER`, `INSTAGRAM_DM`) feed the same D1 customer/lead/order/payment workflow. Do not create a separate CRM or channel-specific business logic.
- Meta advertising, when explicitly authorized, uses the Instant Form until WhatsApp production sender approval.
- Offer: Get 5 Seed Packs FREE; coverage approximately 2 to 3 marla depending on crop, spacing and growing method; one promotional set per household per campaign. Product price is admin/D1 data.
- Required WhatsApp Flow customer data fields remain exactly: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number. Separate commerce fields may be added for product, province, fertilizer choice, quote, payment method, and receipt workflow; these are not customer-identity fields.
- Payment methods are JazzCash, Easypaisa, and Bank Transfer. Garden Shop recipient values must be verified before activation; never guess account numbers, IBANs, wallet numbers, merchant IDs, or credentials.
- Customer-visible payment configuration is backend-managed in D1 `payment_methods`; QR binaries are private R2 objects. Do not hardcode recipient values, TILL/TIL IDs, QR keys, or payment instructions in source, Worker environment variables, Flow JSON, templates, or frontend strings.
- Admin payment settings are managed only through the existing `/payment-settings` UI and payment-method APIs; incomplete methods remain disabled, synthetic test values are restored, and private QR previews never become public.
- Payment credentials and provider secrets remain Cloudflare secrets and are never stored in customer-visible configuration.
- Payment message formatting is CMS/payment-settings controlled: locale chooses the published language copy, server injects only allowlisted amount/order/method/recipient placeholders, and each order reference appears exactly once.
- Do not send a payment request when payable amount or Garden Shop recipient configuration is absent. Exact gate: `PAYMENT_AMOUNT_NOT_CONFIGURED`; never send a zero-value request or guess payment values.
- Dynamic WhatsApp quotes are server-authoritative: catalog product price + optional fertilizer price + selected province delivery fee = total payable. Never trust client-supplied price or total. Catalog and province rates are D1/admin-managed; workbook imports require verified source content.
- CTWA customer-initiated messages use the normal 24-hour service window; qualifying CTWA entry points may provide Meta's free-entry-point window. Instant Form leads do not authorize automatic WhatsApp messages without supported consent/template rules.
- Creeper Seeds is not the customer payment recipient. JazzCash, Easypaisa, and Bank QR/TILL payment recipients remain Garden Shop, backend-controlled, manually reviewed, and disabled until verified values are supplied.

## WhatsApp Number Lock

- Customer-facing WhatsApp identity: Get Free Seeds.
- Authorized production sender: `+923044429933`; Phone Number ID `1323932417479627`; superseded sender `+923328883383` / Phone ID `1429127796940691` is historical only.
- Current state (2026-10-20): canonical phone is `CONNECTED`, Graph `VERIFIED`/GREEN, both messaging permissions granted, and WABA `messages` subscription is active at `getfreeseeds-api-staging`. Meta name status is `DECLINED` and the display name `Get Free Seeds` is rejected under guidelines. This name status does not itself block API messaging; GFS-178/179 delivered/read controlled test replies with the name still declined. It remains a public brand/release gate.
- Production must not use any existing, Hoja Seeds, Garden Shop, temporary, or other phone number.
- Do not locate, migrate, register, connect, or use any existing, Hoja-linked, or old Garden Shop number or WABA.
- The known Meta test number `+1 555-897-9372` and every Hoja-linked test asset remain prohibited.
- `STAGING_WABA_TEST_ALLOWED`: a Meta-provided test WABA/test number may be used only when its visible ownership is independently verified as clean Get Free Seeds, only for staging synthetic data, staging webhook/Flow/messages, and Meta test events. It must never receive real customers, real payments, production events, or ad spend.
- GFS-178/179 explicitly authorized tester exception: the Admin Test Controls number may use the canonical sender only after its own WhatsApp Profile Phone and GFS Contact Info have been verified. Restrict it to synthetic lead data and disabled payment methods; preserve existing orders. This does not authorize using a random Web conversation or public/paid traffic.
- Cloud API production messaging requires the registered business phone sender. The display name `Free Seeds` is not a standalone sender; continue only through Meta's supported phone verification/registration flow.
- Display-name-only readiness is not sufficient for public launch: production still requires compliant public identity/release approval, registered callbacks, approved templates/Flows where used, and verified CAPI. Do not treat a staging test WAMID as production approval.
- Creeper Seeds may be used only for the authorized Free Seeds In Pakistan Page/number integration. Unrelated Hoja assets visible inside that context remain excluded and must not become runtime dependencies.
- Canonical Meta assets for this phase are Business `568026370701542`, Ad Account `1198439777611633`, Page `101192938541236`, App `2354726831735899`, and approved WABA `2616648355452496`; Hoja App `1065866162865361`, Hoja WABA `810731151319635`, and all Hoja numbers remain excluded.
- Clean WhatsApp system user `Automation` (`61595003169877`) is assigned only canonical App `2354726831735899` and WABA `2616648355452496`. Token generation is a protected credential step; never display, copy, log, or commit the token.
- The generic Page/App `Connect assets` chooser is not assumed to be the WhatsApp integration mechanism. Verify App WhatsApp API Setup/WABA subscription and WABA assigned-app surfaces before mutating assets.

## Platform

- Cloudflare Workers hosts backend services.
- Cloudflare D1 is the operational source of truth.
- Cloudflare R2 stores receipt images privately; public access is forbidden.
- Cloudflare Queues handles retryable asynchronous work and DLQs.
- Public API and private admin Workers use `workers.dev`; no custom domain.
- Internal admin is protected by Cloudflare Access for `gisupp@gmail.com`; public WhatsApp callbacks must remain reachable.

## Payments and Events

- Payment is manually reviewed by Garden Shop.
- Meta Lead is created only after durable storage of all five fields, customer, lead, and order.
- Meta Purchase is created only after manual payment approval, with event ID `purchase_<FS_ORDER_ID>`, currency PKR, and actual approved amount.
- Lead event ID is `lead_<FS_ORDER_ID>`.
- Financial approval, rejection, state transitions, retries, outbound messages, CAPI, and receipt association are idempotent and audited.

## Secrets and Git

- Never commit tokens, secrets, payment credentials, private keys, production receipts, customer exports, or real personal data.
- Use Cloudflare secrets for runtime secrets and placeholders only in examples/tests.
- Never force-push or rewrite unrelated history.

## Bootstrap Lock

- Cloudflare Account ID: `cb5066a6d71ecdee0bd7ed8aacb4d3c2`
- workers.dev subdomain: `get-free-seeds.workers.dev`
- All real resource IDs are recorded in `docs/RESOURCE_REGISTRY.md` and become immutable after bootstrap.
- Account or resource migration requires explicit user authorization, migration and rollback plans, registry update, decision record, and changelog entry.

## Release States

`LOCAL` -> `STAGING_INFRA_READY` -> `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING` -> `WHATSAPP_PHONE_VERIFICATION_PENDING` -> `WHATSAPP_OTP_REQUIRED` -> `META_ASSETS_PENDING` -> `PRODUCTION_INTEGRATION_READY` -> `PRODUCTION_READY`

Expected state for this phase: `META_ASSETS_PENDING`.

## Spend Safety

- Never publish a paid Meta campaign, increase budget, charge a card, or start delivery without explicit authorization containing the intended spend/publication decision.

## Browser Automation Protocol

- Always use Chrome DevTools MCP with the current authenticated Meta/Facebook session for Meta work (currently Saeed A Nazim), and `gisupp@gmail.com` for Cloudflare, GitHub, and Get Free Seeds admin. The same human operator may administer multiple businesses, but GFS must share zero Hoja runtime/business assets.
- Never cross-use the Meta identity for Cloudflare/GitHub or the Cloudflare/GitHub identity for intended Meta ownership.
- Verify the visible active account/profile before every external mutation and record the result.
- First call Chrome DevTools MCP `list_pages`, then inspect every already-open Facebook/Meta/Business Suite/Ads Manager/WhatsApp Manager/Developer tab before navigating to login or creating a context.
- Authentication is established by the working authenticated page and actual clean asset access; do not treat a forced email login screen as a prerequisite when the current session has verified clean authority.
- Never log out an already authenticated useful Meta session merely to switch accounts; use the current authenticated session for read-only asset discovery first.
- Switch/login only when the required clean asset cannot be accessed from the current session, and stop at the exact permission/authentication gate rather than repeatedly retrying.
- Reuse the already-open tab for the same service, task, or page. Do not open a new tab for every sub-step.
- Open one separate tab only when beginning a genuinely new service, task, or context that should remain separate.
- Same-task tab reuse is mandatory. Avoid duplicate Cloudflare, Meta, GitHub, or admin tabs. Do not close useful authenticated tabs unless necessary.
- `CHROME_LIST_PAGES_FIRST`: every browser automation execution or MCP reconnection must begin with `chrome_devtools.list_pages`; build a page-ID, URL, and service inventory before navigation or clicking.
- `REUSE_EXISTING_MATCHING_TAB`: reuse the exact existing Meta, Cloudflare, GitHub, or Admin page when it matches the task; open exactly one new tab only when no same-service tab exists.
- `NEVER_CHANGE_UNRELATED_TABS`: never navigate, refresh, close, overwrite, or repurpose an unrelated-origin/task tab. Verify page ID, URL, authenticated identity, and asset before every mutation. Record list-pages result, tab reuse/new-tab result, and unrelated-tab changes in every report.

## Chrome DevTools MCP Recovery Protocol

- Chrome DevTools MCP is mandatory for dashboard automation; do not substitute unauthenticated HTTP/API guesses or claim browser evidence from mocks.
- If the MCP namespace disappears, diagnose before declaring a blocker: inspect the loaded Kilo/Codex MCP configuration, package/command, process state, logs, Chrome process, DevToolsActivePort/endpoint, and existing profile.
- Repair locally where possible by restarting/reconnecting only the MCP bridge or required browser component; test with MCP initialization, page listing, and a read-only page inspection after every repair.
- Preserve the existing authenticated Saeed Chrome profile/session for Meta and `gisupp@gmail.com` for Cloudflare/GitHub/admin. Ayesha is historical, not the active Meta profile; never create a fresh profile merely to bypass recovery.
- Reuse existing service tabs; create a tab only for a genuinely new task/context, and verify the visible account before every mutation.
- Declare `PLATFORM_BLOCKED` only when the MCP server works locally but its tools cannot be exposed to the active agent because of an external Codex/platform restriction, with the exact diagnostics recorded in `STATUS.md`, `DECISIONS.md`, and `CHANGELOG.md`.

## Quality Gate Availability

- `REMOTE_CI_UNAVAILABLE_NON_BLOCKING`: GitHub Actions may remain unavailable because of account billing state. Do not add billing, payment methods, or spend money to enable it.
- Local `npm ci`, `npm test`, `npm run build`, `npm run lint`, dependency audit, and simulated E2E are the active release quality gate while remote CI is unavailable.

## GFS-169 Authorized Live E2E Protocol

- The verified E2E tester is authorized only when WhatsApp Profile/Account Settings visibly identify the signed-in account as the project-approved tester; chat-list names, historical message content, or assumptions are not identity proof.
- After identity proof, use only the Get Free Seeds conversation with the authorized GFS sender. Do not open, search, inspect, forward, reply to, or capture unrelated personal chats.
- `/test-controls` may register or reset only the verified test `wa_id`. Reset is explicit, CSRF-protected, audited, and history-preserving; it must not delete or alter orders, receipts, payment history, or audit records.
- A real live E2E requires an actual tester-controlled inbound interaction and matching Admin/D1 order evidence. Backend/API, Admin preview, or synthetic-provider results must be labeled SIMULATED or API-ONLY and never reported as customer completion.
- Payment rendering coverage may select multiple methods on one existing test order only when the endpoint is idempotent and no receipt, approval, PAID, CAPI, or fulfillment mutation is made. Never create duplicate orders solely to render another method.
- Payment selector evidence must contain only complete enabled methods. Help, Support, Check Order, or other legacy controls are not valid payment-method selector buttons; do not hide incomplete methods by label alone.
- WAMIDs must come from authenticated Meta/D1 evidence. WhatsApp Web timestamps or internal browser request IDs are not WAMIDs and must be reported as unavailable.
- Live evidence records must mask customer phone numbers, payment account/TILL/IBAN values, receipts, tokens, cookies, and other secrets. Screenshots remain private and uncommitted.

## GFS-170 Protected Payment QR Protocol

- A payment QR is a private R2 asset, never a public URL and never a CMS WhatsApp-content gallery image. Guided payment delivery must load the selected method's `qr_r2_key` only.
- QR delivery requires independent Garden Shop verification of the payee/account and QR ownership. A QR that merely has a key, MIME type, size, or checksum is not ownership proof. The `qr_owner_verified` gate defaults false and every replacement upload resets it.
- Before Meta delivery, verify R2 object existence, method metadata, HTTP content type, allowed image type/signature, exact byte size, and SHA-256 against D1. A mismatch is fail-closed and must create an Admin-visible warning/audit event.
- Payment text and QR are separate idempotent outbound records with separate provider IDs and callback statuses. A retry may resend only the failed part; a successful text or QR part must never be duplicated.
- Missing QR is a valid text-only fallback with an explicit `SKIPPED` QR status. Ownership-unverified, corrupted, mismatched, or otherwise unverified QR assets are `FAILED`/blocked and must not reach Meta.
- QR reconciliation must compare current Admin/D1 rows, private R2 HTTP/hash evidence, and the visible QR payee/account identifier; an upload appearing in Admin does not prove ownership. Any visual/configured-recipient mismatch remains blocked until authorized ownership evidence is recorded.
- A pending test order may switch payment methods idempotently for rendering coverage. A paid, approved, receipt-bearing, review, or fulfilled order must never be reset or method-switched.
- Paid-order forensic review is read-only: record receipt time/hash, actor, approval time, amount, payment method, order transitions, CAPI status, and fulfillment events. Missing external verification or a null customer transaction reference is an incident; place a fulfillment hold and never auto-reverse or auto-approve.

## GFS-175 QR Extraction and Immutable Source Lock

- Uploaded payment QR originals are immutable private R2 source objects. Never overwrite/delete them when a replacement or derivative is uploaded; retain prior versions for audit and rollback. Identical source bytes for the same method must resolve to one content-addressed source object, not duplicate assets.
- Extraction must be automatic from the original pixels and may remove only surrounding non-QR content. Preserve every QR module and at least the required white quiet zone; do not synthesize, redraw, or alter the encoded payload. The extraction record must link source key/hash to derivative key/hash, MIME, dimensions, method, tool/version, timestamp, and actor.
- Before accepting a derivative, independently decode both source and derivative and require byte-for-byte identical decoded payloads plus a successful scan of the derivative. A decoder/scan failure, ambiguous QR boundary, or payload mismatch blocks activation and delivery.
- Cropping or visual cleanup is never payee/ownership evidence. Decode and compare the destination against independently authorized Garden Shop account records. Do not set `qr_owner_verified=1` through ordinary Payment Settings saves, upload, cropping, OCR, checksum, visual similarity, or a customer scan; only a separate evidence-backed authorization may establish it.
- Customer delivery uses only the verified method-specific derivative. Original and derivative remain private, checksummed, MIME/signature validated, method-linked, auditable, idempotent, and rollback-capable. Missing or mismatched evidence fails closed and must not reveal another method's image.
- Payment-method enablement, customer selectors, stale button handling, and payment initiation all require a matching active `payment_qr_assets` provenance row with decoder agreement, payload equality, scan PASS, `qr_owner_verified=1`, `independent_ownership_verified=1`, and a non-empty independent evidence reference. Text fallback must not make an unverified recipient payable.
- Any change to a payment method's recipient name or account/TILL identifier invalidates its independent QR ownership evidence and disables the method; re-verification is required before enabling it again.
- The owner statement stored as `USER_ASSERTION_GFS-176` is not independent evidence. Until provider/bank evidence links the decoded destination to Garden Shop, keep every unmatched or unverified method disabled and leave both ownership flags false.
- For unresolved `FS-261019-000001`, retain the server-side hold across confirmation, fulfillment transitions, shipping labels, and tracking. The Admin UI must not present active fulfillment controls for this order. Do not modify its payment, receipt, fulfillment, or CAPI history without evidence and authorization.
- WhatsApp Web may only send test messages from the verified GFS staging/test account to a specifically authorized tester number. A random currently selected conversation is unrelated; do not message it. If the authorized conversation/session cannot be confirmed, do not send.
- The user has attested that all three payment QR codes belong to Garden Shop. Record this as an owner attestation only; it is not independent ownership verification and never sets `qr_owner_verified=1`.
- Treat a visual label, alternate till/merchant identifier, alias (including `BIO TECH`), account suffix, or previous QR incident as a discrepancy candidate, not a final beneficiary verdict. Decode the actual source payload and compare it with authoritative D1 account records and independent bank/wallet ownership evidence. An alias may be legitimate only when that independent evidence links it to the authorized Garden Shop account.
- Current staging originals visibly show JazzCash/TILL branding, an Easypaisa merchant number different from its configured D1 number, and Bank Alfalah / `GARDEN SHOP - 2039` while the D1 IBAN ends differently. These visible labels are not a decode or ownership proof. All QR delivery remains blocked until exact payloads, recipient mapping, and independent ownership evidence pass.

## GFS-173 Locale and Action Protection

- Selected WhatsApp locale is persisted after the bilingual Welcome and controls every later customer-facing template, payment message, receipt acknowledgement, and status response. Missing Urdu payment copy raises `PAYMENT_TRANSLATION_MISSING` and never falls back field-by-field to English; Admin exposes `PAYMENT_URDU_TRANSLATION_MISSING` until corrected and published.
- Payment Settings separates shared financial identifiers from localized customer copy. English payment fields reject Urdu-script contamination; Urdu delivery requires dedicated heading, instruction, reference, and receipt fields. Amount, order reference, method eligibility, recipient/account values, QR key, and payment state remain server/D1 authoritative.
- Payment-selection buttons are generated only from complete enabled D1 methods. `CHECK_ORDER`, `SUPPORT`, `PAYMENT_HELP`, and legacy payment labels are never included in the payment selector. `CHECK_ORDER` remains a separate status action; stale/invalid taps receive a safe localized response and cannot mutate order/payment state.
- CMS action labels are allowlisted by current runtime actions. Historical unknown action rows are ignored safely during load/publish and cannot reintroduce obsolete buttons. CMS publish remains the source for journey copy; payment method details remain Payment Settings/D1 source.
- The paid/packing incident `FS-261019-000001` remains read-only under fulfillment hold until independent payment verification and incident review are recorded. No reversal, fabricated evidence, Purchase replay, or dispatch is permitted.

## GFS-178 Verified Sender and Lead-Only Recovery

- Display-name review and API messaging eligibility are separate. Graph `name_status=DECLINED` alone is not a messaging prohibition: check registered phone verification, messaging permissions, WABA subscription, actual delivery status, and the authorized tester's own WhatsApp Profile Phone before a controlled send.
- On 2026-10-20 the canonical phone was verified with GREEN quality, both WhatsApp permissions granted, subscribed WABA, and actual delivered/read replies while its display name remained declined. `@FreeSeeds` is a separate username and remains unchanged. Do not change display name, username, number, WABA, or webhook to manufacture a PASS.
- A display-name resubmission must have genuine brand evidence and a supported review path. The present Meta dialog offers only a replacement-name input; canonical Support has no eligible issues and Request Review is disabled. Do not submit a blind repeat or choose an alternative name without explicit authorization. No appeal/case reference exists from GFS-178.
- Controlled GFS-178 E2E uses only the profile-verified authorized tester and synthetic delivery fields. Admin conversation resets preserve historical orders; all payment methods remain disabled. Real lead-only results must be labeled separately from simulated receipts/approvals and never marked PAID.
- Returning order delivery data is immutable per order: preserve earlier customer/order snapshots and associate later snapshots with the trusted normalized WhatsApp number rather than overwriting old delivery data or duplicating unique `wa_id`. Ownership checks must accept only that trusted association.
- No eligible method means clear localized payment unavailability, no payment-selector/media or payment request, and a separate post-order Check Order action. Delivered webhook replays and stale structured callbacks must not advance fields or create extra orders.
- API staging is the active Meta webhook. Before a controlled deploy verify account, recent traffic, local regression, unchanged payment/CAPI flags, version compatibility, and record rollback. GFS-178 checked only the authorized tester active in the preceding 24 hours. This grants no ads/spend/production or public launch permission.

## GFS-177 Active Staging and Province Selector Guard (Historical)

- The authorized GFS WABA is connected to `getfreeseeds-api-staging` for its `messages` webhook. A deployment of that Worker can change responses for real inbound traffic; do not deploy API/customer-message changes until an authorized tester/account is confirmed and the active sender identity/status is safe.
- The currently connected phone row reports quality `High`, but Meta marks the `Get Free Seeds` display name `Rejected`. Do not change/re-submit the name or send a new customer message without verified display-name authorization. The canonical Business/WABA route is authorized; Hoja-associated assets remain excluded.
- The authorized tester record exists in Admin Test Controls and has an existing pending order. Preserve that order. WhatsApp Web must be verified as the tester account before using it; a missing chat or unrelated selected contact is not test authorization.
- Province rows come only from enabled Admin D1 `province_delivery_rates`. Send a WhatsApp interactive LIST with `title` from the D1 province and localized `Delivery Fee: Rs. {fee}` / `ڈلیوری فیس: {fee} روپے` descriptions. Enforce Meta row title 24-character, description 72-character, and 10-row limits. Do not hardcode province names or prices.
- `REMOTE_CI_UNAVAILABLE_NON_BLOCKING` allows controlled staging work only when local tests/build/lint/audit/Wrangler pass and no actual repository protection rule forbids it. Never bypass a protection rule. Staging-only authorization does not authorize production or Meta mutations.
