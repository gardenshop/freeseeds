# Get Free Seeds Plan

## Current Scope and Audit

The repository was empty and had no Git history, source, branch, remote, or legacy architecture at bootstrap. GitHub repository `gardenshop/freeseeds` is the target. The known Cloudflare account `85f6a6181b4653c2a45e69cb7ce8a474` is Hoja-linked and prohibited. The supplied Free Seeds Page is currently connected to a prohibited Meta portfolio and is documented only as a future isolation task.

Production WhatsApp number: **+923328883383**, explicitly authorized by the user and pending clean Meta onboarding.

No existing, test, Hoja Seeds, Garden Shop, or other phone number may be used. The authorized number must not be registered, migrated, connected, or enabled until clean ownership, OTP/verification, WABA linkage, and least-privilege credentials are visibly verified.

## Architecture

- `getfreeseeds-api[-staging]`: public webhook/Flow endpoint, inbound routing, provider boundary, receipt orchestration, CAPI/outbox queue producer/consumer.
- `getfreeseeds-admin[-staging]`: Access-protected internal dashboard/API, payment review, receipt preview, fulfillment, audit and status views.
- TypeScript, Hono, Zod, strict typechecking, Vitest, Wrangler.
- D1 is the CRM and sole operational source of truth.
- R2 stores private receipt objects only.
- Queues and DLQs deliver retryable CAPI and outbound work.
- Mock provider powers local/simulated E2E. Meta provider exists behind an interface but is disabled and unconfigured.
- No customer website, customer web form, custom domain, Google Sheets, or paid ad launch.

## Deployment States

`LOCAL`, `STAGING_INFRA_READY`, `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING`, `WHATSAPP_PHONE_VERIFICATION_PENDING`, `META_ASSETS_PENDING`, `PRODUCTION_INTEGRATION_READY`, `PRODUCTION_READY`.

Expected state: `WHATSAPP_PHONE_VERIFICATION_PENDING`. This does not block independent backend, infrastructure, test, or documentation work.

## Cloudflare Resources

Staging first: `getfreeseeds-api-staging`, `getfreeseeds-admin-staging`, D1 `getfreeseeds-staging`, R2 `getfreeseeds-receipts-staging`, Queue `getfreeseeds-events-staging`, and DLQ `getfreeseeds-events-staging-dlq`.

Production later: `getfreeseeds-api`, `getfreeseeds-admin`, D1 `getfreeseeds-prod`, R2 `getfreeseeds-receipts-prod`, Queue `getfreeseeds-events-prod`, and DLQ `getfreeseeds-events-prod-dlq`.

All resources must be created only in the dedicated clean Get Free Seeds Cloudflare account. Admin Workers use Cloudflare Access and public API Workers remain reachable by Meta callbacks. Record actual IDs in `docs/RESOURCE_REGISTRY.md`; never use fake IDs.

## Data Model and Workflow

Migrations support customers, leads, orders, payments, payment_receipts, meta_attribution, capi_events, whatsapp_events, outbound_messages, audit_log, configuration, duplicate_flags, order_counters, and transactional outbox jobs. Order numbering is concurrency-safe with `FS-100001` format. State transitions are validated and idempotent:

`NEW -> DETAILS_COMPLETED -> PAYMENT_PENDING -> RECEIPT_SUBMITTED -> PAYMENT_REVIEW -> PAID -> PACKING -> DISPATCHED -> DELIVERED`, with rejection, correction, cancellation, and audited fulfillment transitions.

Successful Flow submission validates exactly five fields, normalizes contact number, stores customer/lead/order/attribution durably, calculates configured delivery fee, then creates deterministic Lead work. Payment instructions support JazzCash, Easypaisa, and Bank Transfer but remain disabled until verified Garden Shop recipient details exist. Receipts are retrieved through the future provider boundary, validated, hashed, stored privately in R2, and reviewed manually. Approval atomically creates deterministic Purchase and confirmation outbox jobs; rejection never creates Purchase.

## Provider Boundary

`WhatsAppProvider` exposes verification, signature validation, inbound parsing, text/interactive/template/Flow sends, media download, payment instructions, and confirmation. `MockWhatsAppProvider` is used in all current tests and simulated E2E. `MetaWhatsAppProvider` is production-capable code only, disabled by configuration, and cannot run without the registered authorized sender, canonical App↔WABA subscription, approved assets, and secrets.

The Flow definition is versioned at `whatsapp/flows/get-free-seeds.json` and has exactly five required fields. It is not published to any WABA in this phase.

## CAPI

Implement current official Meta Business Messaging CAPI code with Lead event `lead_<FS_ORDER_ID>` and Purchase event `purchase_<FS_ORDER_ID>`, PKR, and actual approved delivery payment. Keep live sending disabled, do not use any prohibited dataset, and preserve real attribution only when received. Synthetic referral/`ctwa_clid` fixtures are permitted in tests.

## Security, Observability, and Rollback

Use Cloudflare secrets, raw-body HMAC verification, Flow validation, Access identity enforcement, CSRF protections, private receipt responses, redacted structured logs, correlation IDs, immutable audits, unique provider event IDs, deterministic outbox keys, bounded queue retries, and DLQs. No secrets, tokens, real receipts, or real customer data enter Git or fixtures. Roll back Workers without deleting D1/outbox evidence; pause queues and replay deterministic jobs after provider incidents.

## Future WhatsApp Gate

For the authorized number, follow `docs/WHATSAPP_NUMBER_ONBOARDING.md`: verify clean Meta portfolio, create/select clean WABA, verify no Hoja relationship, add number, OTP verify, configure Get Free Seeds display name and approvals, create least-privilege token, set secrets, register callback/public key, publish Flow/templates, record IDs, run live WhatsApp/CAPI/E2E tests, and only then consider campaign activation. Do not claim completion without authenticated dashboard evidence.

## Ordered Implementation

1. Governance and corrected docs.
2. Git baseline and implementation branch.
3. Dedicated Cloudflare account and staging infrastructure.
4. TypeScript Workers scaffold and D1 migrations.
5. Domain services, state machine, numbering, duplicate controls, audit and outbox.
6. Provider interfaces, Mock provider, disabled Meta provider, Flow JSON/backend/tests.
7. Payment configuration/workflows, receipt storage, admin, CAPI and queue retries.
8. Simulated E2E for referral, Flow, five fields, all payment methods, receipt, approval, CAPI, confirmation and fulfillment.
9. Isolation scans, deployment verification, status and final report.

## Corrected Plan Self-Review

| Check | Result |
| --- | --- |
| No existing WhatsApp number used | PASS |
| Hoja test number excluded | PASS |
| Existing Garden Shop number migration not planned | PASS |
| Meta test number excluded | PASS |
| New production number remains pending | PASS |
| Backend implementation can proceed independently | PASS |
| Provider abstraction supports later clean onboarding | PASS |
| Hoja Seeds zero connection | PASS |
| No customer website or form | PASS |
| Exactly five fields | PASS |
| D1 authoritative/private R2 | PASS |
| Manual approval before Purchase | PASS |
| No Google Sheets or paid ad spend | PASS |

Self-review result: **PASS**.
