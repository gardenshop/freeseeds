# Get Free Seeds Plan

## GFS-476 immutable API candidate (2026-11-03 PKT)

The single approved upload-only mutation completed once using Wrangler `versions upload --keep-vars --strict` for `getfreeseeds-api-staging`, producing immutable version `9f6a4ecf-bf7f-43ff-abe0-e0d67e53bfd3`, tag `gfs476-api-51e1e89`. Cloudflare readback showed it Ready, while API baseline `b426ba47` stayed100% and existing `e8018f3f` stayed0%; no attachment, deployment or traffic test occurred. The isolated preview `/health` GET returned `ok=true`, `PRODUCTION_INTEGRATION_READY`, WhatsApp enabled.

The upload did not preserve the verified runtime value `PAYMENT_CHOICE_RECOVERY_ENABLED=true`; post-upload settings read `false`. Encrypted secrets and bindings remained present, but this is a release-blocking configuration-preservation defect. The dashboard correctly rejected the attempted restore as a separate setting mutation. No bypass or second upload is allowed; separately approve restoration of this exact variable, then re-read settings and routing.

## GFS-475 safe API resume acceptance (2026-11-03 PKT)

Local synthetic acceptance reuses the real API state machine and migrations with a SQLite fixture, mocked Meta provider, mocked Queue and synthetic-only identities. EN/UR OFFER, FERTILIZER, PROVINCE and REVIEW resume on inbound only; state preservation, invalid input rejection, dynamic province pricing, COD PKR125, all three Advance methods and duplicate suppression are covered without a production sender, customer database or outbound Queue.

The release artifact is prepared but not uploaded: source `51e1e8939cbdacd85cae58249051a9f3d78ea8ce`, bundled `index.js` SHA-256 `468C26830E2B1BCECE289A893A1284E88D97FD8449ECD2D2C28D860F2F5272BA`. The only API source delta from existing0% candidate source `ffa9eb4a8a16eb475584812367e53966469fa0d2` is `apps/api/src/index.ts`. A future separately approved upload must preserve live variables/secrets with `--keep-vars --strict`, remain unattached until separately approved, and receive independent version/config readback.

## GFS-474 incomplete WhatsApp order recovery (2026-11-03 PKT)

The bounded UTC `2026-10-28..2026-11-03` aggregate splits no-order pre-submit conversations into active under24h and inactive over24h. Current inactive stage totals are OFFER1079, LANGUAGE325, FULL_NAME260, PROVINCE251, FERTILIZER179, ADDRESS160, REVIEW61, CONTACT50, NEARBY47, CITY28, NEW9 and PRODUCT0 (total2449). Age buckets are 24–72h996 and 3–7d1453; languages are UR1702, EN413 and unknown-before-language334. These are recoverable inactivity snapshots, not proven intent to abandon.

The minimal local repair reuses the state machine: any new inbound at OFFER/FERTILIZER/PROVINCE/REVIEW re-presents that state’s current controls while preserving validated fields. No order is created until normal confirmation, and duplicate provider events remain suppressed. Existing +15/+210 no-method recovery remains unchanged because no duplicate, opt-out, failed-outbound or blocked-window defect was proven. No deployment is authorized.

## GFS-473 order funnel and fulfillment readiness (2026-11-03 PKT)

Use the existing read-only UTC analytics window to separate inbound events, snapshot contacts, submitted orders and current lifecycle states. Investigate `paid/fulfilled=0` as a report-window definition before treating it as an operational backlog. Top verified current snapshot bottlenecks are inactive pre-order conversations (2447), COD-confirmed lifecycle rows (374), and post-order/no-method rows (134); advance-pending (73) is tracked separately and classes may overlap.

COD remains locally fail-closed and live settlement remains blocked by missing genuine courier policy/evidence. Meta activity is not order conversion: the campaign denominator and safe persisted attributed-order aggregate are unavailable live, so campaign conversion stays UNKNOWN. Public launch remains NO-GO while the sender display name is In Review and settlement evidence is missing. No watchdog, deployment, customer, payment, Meta or CAPI mutation is in scope.

## GFS-472 COD settlement and attribution (2026-11-03 PKT)

COD work reuses the existing Admin/D1 settlement controls. Local code already requires exact quoted totals, tracking before dispatch, delivery/collection lifecycle, distinct HMACed opaque collection/remittance evidence, authorized operator identity, idempotence and fail-closed PAID guards. No live status transition is authorized until genuine courier contract/evidence and owner verification are available.

The local attribution report aggregates existing `meta_attribution`, `lead_sources`, `leads`, `orders` and WhatsApp conversation snapshots without returning identifiers or raw referral values. It reports persisted attribution and daily buckets, but intentionally leaves campaign-to-order conversion UNKNOWN because Meta campaign lead/conversation denominator data is not in D1. It is not deployed under this task.

## GFS-471 WhatsApp lead launch decision (2026-11-03 PKT)

Path A is the current priority: keep existing WhatsApp lead activity under read-only observation and prepare launch only after Meta display-name/sender eligibility and COD settlement controls are approved. No campaign, message, order, payment, or CAPI mutation is included.

Path B is deferred: a separately approved, supervised Admin canary may use supported Cloudflare rollback/readback, but this plan makes no automatic six-minute/eight-minute watchdog claim. The isolated watchdog and target are frozen and GFS-470 remains DEFERRED.

Current release gate: Meta business `568026370701542` and ad account `1198439777611633` are verified; Get Free Seeds WABA is linked, sender is connected/high quality but display name remains **In Review**. COD is enabled at PKR125, while collection/remittance policy references are absent. Therefore public launch is NO-GO pending those gates.

## GFS-405 monitoring qualification and release-readiness boundary (2026-11-01 UTC)

The dedicated monitoring application is correctly configured in the verified Get Free Seeds account: exact staging `/health` destination plus the existing `GFS-Admin-Health-Monitor` Service Auth policy. No Access mutation is required. The actual reproducible qualification defect was local harness ambiguity (two accounts without explicit selection and a stale Admin baseline); the harness now selects account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` and baseline `e8c96c96`. Three read-only cycles passed health/security/GraphQL/routing checks. GFS-403 remains source-ready but production migration, retention execution and API/Admin release require a separate approval; no production action is authorized here.

## GFS-404 retention readiness boundary (2026-11-01 UTC)

The cancellation feedback source is release-ready locally, but production remains frozen. Migration0046 and its indexed 90-day suggestion expiry are local-only until separate migration, retention execution, monitoring and coordinated API/Admin approvals exist. The retention path is dry-run-by-default, bounded, idempotent and not connected to a route, queue or Cron. It deletes only expired free-text suggestion events; cancellation facts, reasons, stage/date aggregates, orders, payments and WhatsApp state are outside its write set. The next scoped approval must independently cover migration0046, one controlled retention run, monitoring Access-policy repair, API candidate provenance, Admin candidate compatibility, rollback and live acceptance.

## Current Scope and Audit

The repository was empty and had no Git history, source, branch, remote, or legacy architecture at bootstrap. GitHub repository `gardenshop/freeseeds` is the target. The known Cloudflare account `85f6a6181b4653c2a45e69cb7ce8a474` is Hoja-linked and prohibited. The supplied Free Seeds Page is currently connected to a prohibited Meta portfolio and is documented only as a future isolation task.

Production WhatsApp number: **+923044429933**, explicitly authorized by the user and pending clean Meta onboarding; old `+923328883383` is superseded.

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

Migrations support customers, leads, orders, payments, payment_receipts, meta_attribution, capi_events, whatsapp_events, outbound_messages, audit_log, configuration, duplicate_flags, per-date order counters, idempotent order requests, and transactional outbox jobs. New orders use a concurrency-safe `FS-YYMMDD-######` format based on the Asia/Karachi order date; historical order numbers are never renamed. State transitions are validated and idempotent:

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

## GFS-286 completion state - 2026-10-28

1. **Completed:** bounded live audit, payment-stage/Admin repair, migration rehearsal and one-time 0039/0040 apply on verified active D1, integrity readback, 0%-override smoke, sends-off promotion, and API trigger attachment.
2. **Held safely:** reminder flags remain false because there are zero post-promotion orders and zero legitimate eligible recipients. No historical schedule or send is allowed.
3. **Next authorized action:** when a genuinely new opted-in unpaid Advance order has a persisted inbound message identity/timestamp inside 24 hours, request/record the narrow activation authorization, then verify real Meta acceptance and status transitions. Keep utility-template approval false.

## GFS-477 recovery-flag drift

Read-only Cloudflare version/deployment evidence is complete. API baseline `b426ba47` is serving at100% with recovery enabled; `e8018f3f` remains0% with recovery enabled; unattached `9f6a4ecf-bf7f-43ff-abe0-e0d67e53bfd3` alone contains recovery disabled. The explicit false in the API manifest was corrected locally to true and guarded by a manifest test. No upload or routing mutation was performed. Next milestone is one separately approved immutable corrected upload, followed by independent readback only.

## GFS-478 corrected candidate

The separately authorized single upload completed as version `d683ec45-1df2-4777-878e-4915fe55d1f4`/122. Readback passed recovery, bindings, protected flags and secret-presence checks. Routing remains unchanged at API100%/0%; no attachment, deployment, override, customer webhook or live acceptance was performed. Scheduled and Queue handlers exist in the artifact, but the unattached version receives no production trigger execution. Next decision is whether to separately approve a controlled 0% attachment and isolated acceptance.
