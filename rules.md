# Get Free Seeds Binding Rules

## Identity and Isolation

- Public brand: Get Free Seeds.
- Operational merchant and payment recipient: Garden Shop.
- Customer-facing Page input: `https://www.facebook.com/FreeSeedsPK/`; it is not a runtime dependency until clean Meta ownership is verified.
- Hoja Seeds has zero connection. Do not use, import, reference, share, or depend on any Hoja Seeds repository, source, database, Cloudflare resource, domain, DNS, API, secret, Meta asset, WhatsApp asset, payment credential, customer record, CRM data, analytics, webhook, campaign, deployment, or configuration.
- The known Hoja-linked Cloudflare account ID `85f6a6181b4653c2a45e69cb7ce8a474` is prohibited.
- Google Sheets is not an operational dependency. Cloudflare D1 is authoritative.

## Customer Journey

- Customer journey remains entirely inside WhatsApp.
- No customer website, customer web form, or custom domain.
- Meta advertising, when authorized, goes directly to WhatsApp.
- Offer: Get 5 Seed Packs FREE; seed price Rs. 0; coverage approximately 2 to 3 marla depending on crop, spacing and growing method; one promotional set per household per campaign.
- Required WhatsApp Flow fields are exactly: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number.
- Payment methods are JazzCash, Easypaisa, and Bank Transfer. Garden Shop recipient values must be verified before activation; never guess account numbers, IBANs, wallet numbers, merchant IDs, or credentials.

## WhatsApp Number Lock

- Customer-facing WhatsApp identity: Get Free Seeds.
- Production number: NEW NUMBER TO BE PROVIDED LATER BY USER.
- Current state: UNASSIGNED / `WHATSAPP_NUMBER_PENDING`.
- No existing, test, Hoja Seeds, Garden Shop, or other phone number may be used in the meantime.
- Do not locate, migrate, register, connect, or use any existing number or WABA.
- Do not use Meta test number `+1 555-897-9372`.
- Do not create live templates, publish a Flow, register callbacks against an existing account, send real WhatsApp messages, or create/reuse an existing WhatsApp token.

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

- Cloudflare Account ID: `TO_BE_FILLED_ONCE`
- workers.dev subdomain: `TO_BE_FILLED_ONCE`
- All real resource IDs are recorded in `docs/RESOURCE_REGISTRY.md` and become immutable after bootstrap.
- Account or resource migration requires explicit user authorization, migration and rollback plans, registry update, decision record, and changelog entry.

## Release States

`LOCAL` -> `STAGING_INFRA_READY` -> `WHATSAPP_NUMBER_PENDING` -> `META_ASSETS_PENDING` -> `PRODUCTION_INTEGRATION_READY` -> `PRODUCTION_READY`

Expected state for this phase: `WHATSAPP_NUMBER_PENDING`.

## Spend Safety

- Never publish a paid Meta campaign, increase budget, charge a card, or start delivery without explicit authorization containing the intended spend/publication decision.
