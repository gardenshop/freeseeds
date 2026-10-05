# Get Free Seeds Binding Rules

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

- Temporary primary acquisition channel is Meta Instant Form; target primary after approval is WhatsApp; Facebook Messenger is secondary support and Instagram DM automation is deferred.
- Native Instant Form Messenger continuation is available when the customer selects Meta's checked Messenger consent option and Meta creates the messaging context. Form completion alone still does not prove a customer-side message was received; verify the native session/message separately.
- An Instant Form customer WhatsApp/contact number is a recipient value (`CUSTOMER_WHATSAPP_NUMBER`), never the GFS business sender. The only business sender is `+923328883383`; the old CTA target `923124093162` is prohibited.
- Any customer WhatsApp follow-up requires an eligible Meta messaging context/consent and a verified sender; a phone field alone does not authorize proactive WhatsApp automation.
- Meta Instant Form is the sole authorized temporary customer web form; no additional website form or custom domain is introduced.
- All allowed channel sources (`META_INSTANT_FORM`, `WHATSAPP`, `FACEBOOK_MESSENGER`, `INSTAGRAM_DM`) feed the same D1 customer/lead/order/payment workflow. Do not create a separate CRM or channel-specific business logic.
- Meta advertising, when explicitly authorized, uses the Instant Form until WhatsApp production sender approval.
- Offer: Get 5 Seed Packs FREE; seed price Rs. 0; coverage approximately 2 to 3 marla depending on crop, spacing and growing method; one promotional set per household per campaign.
- Required WhatsApp Flow fields are exactly: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number.
- Payment methods are JazzCash, Easypaisa, and Bank Transfer. Garden Shop recipient values must be verified before activation; never guess account numbers, IBANs, wallet numbers, merchant IDs, or credentials.
- Customer-visible payment configuration is backend-managed in D1 `payment_methods`; QR binaries are private R2 objects. Do not hardcode recipient values, TILL/TIL IDs, QR keys, or payment instructions in source, Worker environment variables, Flow JSON, templates, or frontend strings.
- Payment credentials and provider secrets remain Cloudflare secrets and are never stored in customer-visible configuration.
- Do not send a payment request when payable amount or Garden Shop recipient configuration is absent. Exact gate: `PAYMENT_AMOUNT_NOT_CONFIGURED`; never send a Rs. 0 request or guess payment values.
- Creeper Seeds is not the customer payment recipient. JazzCash, Easypaisa, and Bank QR/TILL payment recipients remain Garden Shop, backend-controlled, manually reviewed, and disabled until verified values are supplied.

## WhatsApp Number Lock

- Customer-facing WhatsApp identity: Get Free Seeds.
- Authorized production sender: `+923328883383`; Phone Number ID `1429127796940691`; canonical WABA status is In Review/Unverified.
- Current state: `WHATSAPP_OTP_REQUIRED` (Meta displayed a six-digit SMS verification dialog; no code was entered or resent).
- Production must not use any existing, Hoja Seeds, Garden Shop, temporary, or other phone number.
- Do not locate, migrate, register, connect, or use any existing, Hoja-linked, or old Garden Shop number or WABA.
- The known Meta test number `+1 555-897-9372` and every Hoja-linked test asset remain prohibited.
- `STAGING_WABA_TEST_ALLOWED`: a Meta-provided test WABA/test number may be used only when its visible ownership is independently verified as clean Get Free Seeds, only for staging synthetic data, staging webhook/Flow/messages, and Meta test events. It must never receive real customers, real payments, production events, or ad spend.
- Cloud API production messaging requires the registered business phone sender. The display name `Free Seeds` is not a standalone sender; continue only through Meta's supported phone verification/registration flow.
- Display-name-only runtime is not available on the verified App console: the canonical App/WABA exist, but the App currently exposes only Meta's separate test WABA/phone. Live runtime still requires canonical App↔WABA subscription, least-privilege credentials, approved Flow/templates, registered callbacks, and verified CAPI before real traffic.
- Creeper Seeds may be used only for the authorized Free Seeds In Pakistan Page/number integration. Unrelated Hoja assets visible inside that context remain excluded and must not become runtime dependencies.
- Canonical Meta assets for this phase are Business `568026370701542`, Ad Account `1198439777611633`, Page `101192938541236`, App `2354726831735899`, and approved WABA `2616648355452496`; Hoja App `1065866162865361`, Hoja WABA `810731151319635`, and all Hoja numbers remain excluded.
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

`LOCAL` -> `STAGING_INFRA_READY` -> `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING` -> `WHATSAPP_PHONE_VERIFICATION_PENDING` -> `META_ASSETS_PENDING` -> `PRODUCTION_INTEGRATION_READY` -> `PRODUCTION_READY`

Expected state for this phase: `WHATSAPP_PHONE_VERIFICATION_PENDING`.

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
