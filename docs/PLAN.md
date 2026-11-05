# Get Free Seeds Plan

## GFS-COD-MO-25 migration 0048 completion (2026-11-05 PKT)

- One-time owner-approved alternative preflight passed. Targeted `migrations/0048_historical_cod_mo.sql` executed once; no blanket migration, order/payment DML, deployment, Access, Meta or CAPI action occurred.
- Read-only verification passed: `0047=1`, `0048=1`; historical table/unique HMAC/immutable triggers/amount guard present; historical and normal MO ledgers empty; orders/payments remained 888/888; post-read metadata wrote zero rows. Recovery bookmarks were captured without restore.
- Fresh Admin GETs and API health passed. Protected Admin Service Auth `/health` remains unverified (browser 403); the one-time alternative does not change future health/release gates.
- Next exact action: separately authorize Admin candidate 0% upload/preview only; no canary, promotion, payment or settlement.

## GFS-COD-MO-24 health bridge restoration (2026-11-05 PKT)

- **BLOCKED safely:** existing Chrome DevTools MCP is available, but no callable authorized desktop/host bridge is exposed. A system-session `AdminService` process is observable without an approved invocation contract; no elevation or impersonation was attempted.
- Fresh routing/D1 readback remains safe: Admin `3e4b7c26`100%, API `b426ba47`100% / `d683ec45`0%, `0047=1`, `0048=0`, no partial objects, zero D1 writes. Authorized Admin `/health` HTTP200 is not claimed.
- Next exact action: owner/operator runs the existing bridge in its approved Windows context and returns only sanitized HTTP status/health fields; then separately request migration0048 authorization.

## GFS-COD-MO-23 protected health verification (2026-11-05 PKT)

- **BLOCKED safely:** the existing credential bridge cannot access its approved Windows Credential Manager target in the current execution context (`BI\\CodexSandboxOffline`; `cmdkey /list` reports no stored credentials). No alternate identity, token value, rotation, or bypass was used.
- Access policy/configuration remains PASS and unauthenticated/invalid `/health` remains HTTP403. Authorized HTTP200 is not claimed. Admin/API routing and D1 preflight remain unchanged; 0048 is not applied.
- Next exact action: make the already-approved credential available to the existing bridge execution context, then run one read-only `/health` GET. Do not send the secret in chat or create a new credential.

## GFS-COD-MO-22 Admin routing and health reconciliation (2026-11-05 PKT)

- Official deployment status reconciles Admin to `7aacd65b-fe1d-4c47-9f92-5ba3bf791dc5`: candidate `3e4b7c26`100%. Dashboard 94.5/5.5 is last-24-hour observed traffic (768/45), not configured split. API remains `b426ba47`100% / `d683ec45`0%.
- Access readback confirms `/health` has its own Service Auth application/policy. Browser and invalid credentials return expected 403; the existing credential-manager bridge is unavailable in this context, so authorized health 200 is not claimed.
- D1 preflight is ready (`0047=1`, `0048=0`, no partial objects, Time Travel available), but overall migration readiness remains blocked until approved service-auth health is verified.
- Next exact action: authorize only a read-only service-auth `/health` check using the existing approved bridge; no migration or routing change.

## GFS-COD-MO-21 repaired 0048 preflight (2026-11-05 PKT)

- Repaired migration/source SHA matches the authorized commit and remote D1 has no partial 0048 state. No D1 write occurred.
- Blocked before execution because authenticated Cloudflare active provisioning showed Admin `e8c96c96` 94.5% / `3e4b7c26` 5.5%, not the authorized baseline. CLI history did not safely reconcile the discrepancy; Admin `/health` also returned 403.
- Next exact action: separately authorize a read-only routing/Access reconciliation; do not include a D1 migration, traffic change or payment action.

## GFS-COD-MO-20 migration 0048 preflight (2026-11-05 PKT)

- Read-only identity/D1 preflight passed, but the exact migration was blocked before write because it omitted the required `0048` schema marker. Production remains unchanged: `0047` once, `0048` absent, historical table absent, normal MO rows zero, and SELECT metadata showed zero writes.
- Local repair adds marker tracking and cross-ledger duplicate rejection in both MO endpoints. Focused 34/34, full 385/1, build/lint PASS. No repaired source is deployed.
- Next exact action: owner reviews the repaired migration and separately authorizes one targeted execution of the repaired `0048`; no candidate upload or settlement is included.

## GFS-COD-MO-19 historical COD settlement fix (2026-11-05 PKT)

- Ten-contact read-only trace found ten unique matches: six no-method unpaid, two unpaid Advance, and two existing COD records. No MO, company-receipt or collection evidence was verified; no production order was changed.
- Implemented locally: additive immutable historical-MO ledger, Admin form, exact-original-amount guard, delivery/tracking guard, Advance-receipt protection, duplicate/idempotent/concurrency protection and audited atomic PAID transition without changing the original payment row.
- Validation: focused 31/31, full 382 passed/1 skipped, build/lint PASS. The remote migration is not applied and no candidate/canary was released because the source requires the new table.
- Next exact action: separately authorize and apply only migration 0048 after schema review, then upload the tested Admin candidate at 0% and independently preview it. No real settlement is authorized by this evidence.

## GFS-COD-MO-18 first real COD settlement discovery (2026-11-05 PKT)

- Read-only identity, routing, Admin/API health, D1 schema, payment configuration and binding checks passed. Admin is candidate `3e4b7c26` at 100% in deployment `7aacd65b`; API is `b426ba47` 100% / `d683ec45` 0%.
- Admin returned 461 active COD_PENDING rows and zero collection-pending rows. D1 returned 459 COD_PENDING, one DISPATCHED and one PACKING sidecar; the MO ledger and collection/remittance evidence remain empty.
- No genuine Pakistan Post or beneficiary/remittance evidence, eligible order, or order-specific approval was available. PAID was not attempted. First-five pilot readiness is 0/5 and remains read-only.
- Next exact action: obtain owner-authorized Pakistan Post/courier account or agreement evidence and one real delivered/collection/remittance-backed `COLLECTION_PENDING` order, then separately authorize exactly one authenticated MO confirmation. No deployment, migration, API/Meta/CAPI, customer or payment action.

## GFS-COD-MO-17 final visible MO Admin release (2026-11-05 PKT)

- GFS-COD-MO-16 baseline blocker is resolved: actual baseline `e8c96c96` promoted directly to candidate `3e4b7c26`; historical `92c81e60` was not restored.
- Final deployment `7aacd65b-fe1d-4c47-9f92-5ba3bf791dc5` serves candidate100%. Monitoring ran15m56s; candidate metrics19→45, errors0 and final candidate CPU2.47 ms.
- Live COD_PENDING read-only acceptance, Orders/Conversations, API/WhatsApp, Advance3/3, COD PKR125 and D1 integrity all pass. Rollback target remains `e8c96c96`100% / candidate0%.
- Admin release is complete. Genuine MO settlement acceptance remains separately gated; API/CAPI releases remain deferred.

## GFS-COD-MO-16 permanent promotion preflight (2026-11-05 PKT)

- Promotion stopped before mutation because actual Admin routing is `e8c96c96`100% / `3e4b7c26`0% in deployment `ed9754ad-da6e-406c-aea3-d0bd86960ce8`, while the authorization identifies `92c81e60` as the stable100% baseline.
- API remains `b426ba47`100% / `d683ec45`0%. No Admin promotion, API change, D1/payment action or monitoring window occurred.
- Next exact action: resolve the baseline identity and authorize the exact 100% promotion plus matching rollback target.

## GFS-COD-MO-15 final 10% canary and rollback (2026-11-05 PKT)

- Authorized Admin canary passed technically: deployment `61708672-1d37-4784-b7a3-bc74801c723a` used baseline90% / candidate10% for219.45 seconds; candidate telemetry advanced15→18 with0 errors.
- Twenty ordinary authenticated Orders GETs were all HTTP200; two selected the candidate-only MO panel. No override request was counted as ordinary canary evidence and no write endpoint was called.
- Mandatory rollback `ed9754ad-da6e-406c-aea3-d0bd86960ce8` restored100%/0%; API stayed100%/0%. D1 and payment configuration remained read-only and unchanged.
- **Release status:** technical canary PASS, permanent promotion still pending separate authorization. Genuine MO/PAID acceptance remains unperformed.

## GFS-COD-MO-14 observability repair (2026-11-05 PKT)

- Read-only verification now passes: authenticated Cloudflare Key figures rendered version-separated candidate telemetry for `3e4b7c26` (14 invocations, 0 errors, 1.05 ms average CPU) in the current 24-hour window.
- The prior blocker was dashboard data not rendering during GFS-COD-MO-13, not a Worker deployment defect. The safe procedure is to open the Admin metrics route, wait for the data view, and require version-labelled records before any canary.
- Current routing remains Admin `e8c96c96` 100% / `3e4b7c26` 0%; API remains `b426ba47` 100% / `d683ec45` 0%. No new canary or promotion is authorized by this task.
- Next exact action: separately authorize one bounded Admin canary using the now-proven version metrics and mandatory rollback.

## GFS-COD-MO-13 preview, canary and rollback (2026-11-05 PKT)

- Authenticated candidate override passed with the full Structured Header value and showed the new read-only COD MO panel; normal Admin remained baseline. Candidate binding/readback and genuine COD_PENDING classification passed without payment mutation.
- Deployment `83adbeee-2c8d-417d-8a9d-2d857b58c4ec` exposed Admin baseline90% / candidate10% for129.6 seconds. Rollback deployment `48194013-f0fb-4eab-9a92-307c38ee7baa` restored100% / 0%; API remained unchanged.
- **Release status: NO-GO / monitoring inconclusive.** Cloudflare version-specific metrics/dashboard did not load reliably. Do not retry or promote until candidate metrics and rollback monitoring are available.

## GFS-COD-MO-12 visible COD MO action (2026-11-05 PKT)

- Source/UI acceptance is complete: all COD detail states show MO amount, settlement status and an eligibility explanation; only eligible `COLLECTION_PENDING` orders expose the existing secure submission path.
- Candidate `3e4b7c26-c36d-4d1c-baeb-d26629a9b4a1` uploaded once with preserved HMAC/D1/R2/Queue bindings and remains unattached at 0%. Candidate preview evidence is blocked by TLS/404 preview failures; do not attach, canary or promote until a supported authenticated preview passes.
- Next exact action: provide or authorize a supported candidate-preview verification path, then independently verify it before any Admin-only canary. API/CAPI, D1, payment and WhatsApp changes remain out of scope.

## GFS-COD-MO-11 first real MO settlement discovery (2026-11-05 PKT)

- Read-only live Admin and aggregate D1 verification found no eligible unpaid `COLLECTION_PENDING` COD order and no recorded MO receipt. MO-12 subsequently made the action visible as read-only on the viewed `COD_PENDING` state; no payment workaround or source-guard weakening is warranted.
- Settlement remains blocked until an eligible order has genuine Pakistan Post MO/remittance and actual company-receipt evidence matching its immutable COD quote, followed by separately authorized authenticated Admin confirmation. No state or payment mutation occurred.

## GFS-COD-MO-10 final Admin MO release (2026-11-05 PKT)

- Final Admin deployment `bbe4c470-e331-4c7e-9ac9-525c266c52c3` serves immutable MO candidate `92c81e60` at100%. API remains `b426ba47`100% / `d683ec45`0%; no settings sync or unrelated deployment occurred.
- Fifteen-minute monitored PASS: candidate metrics5→41, errors0; repeated Admin/API GET health passed, UI/assets and exact-amount MO controls passed, D1/payment configuration stayed protected and CAPI remained OFF.
- Keep the rollback target `e8c96c96`100% / `92c81e60`0% available for a proven regression. Real payment acceptance was intentionally not performed and remains separately gated.

## GFS-COD-MO-09 Admin 25% canary and mandatory rollback (2026-11-05 PKT)

- Deployment `ca322c04-2244-4ed0-b98f-987cd9aa6533` ran baseline `e8c96c96`75% / candidate `92c81e60`25% for166 seconds, then rollback `da825e47-2358-4b63-a18c-ce7022582f37` restored100%/0%. No non-versioned settings sync occurred.
- Candidate metrics rose3→5 with zero errors; GET-only candidate/normal navigation, assets, API/WhatsApp health, Admin reads and D1/payment aggregates remained healthy.
- This is technical-canary evidence only; permanent promotion and real payment acceptance remain NO-GO without new authorization.

## GFS-COD-MO-08 Admin 10% canary and mandatory rollback (2026-11-05 PKT)

- Admin-only baseline `e8c96c96`90% / candidate `92c81e60`10% ran for 73 seconds, then restored exactly to baseline100%/candidate0%; no non-versioned settings sync occurred.
- Candidate invocations rose1→3 with zero errors; the two new requests were GET-only checks. API/WhatsApp health, normal Admin reads and D1/payment aggregates remained unchanged with zero verification writes.
- Permanent promotion remains NO-GO; API, D1, Meta, CAPI and payments remain outside scope.

## GFS-COD-MO-07 Admin candidate attached at 0% (2026-11-05 PKT)

- Deployment `872f0a53-d9e1-4daa-b441-caf599c74d0a` now serves only Admin baseline `e8c96c96` at100% and MO candidate `92c81e60` at0%; former inactive `e44703c3` was replaced. No non-versioned setting sync occurred.
- Candidate retains its verified HMAC/D1/R2/Queue/runtime configuration footprint. Candidate-only GET override proves the MO UI/required-number/exact-amount code is selected; no mutation endpoint was called.
- Fresh baseline Admin reads and API health/WhatsApp enabled pass. API routing, Advance 3/3, COD PKR125, recovery ON and CAPI OFF remain unchanged.
- Next authorization, if any: a separately approved bounded positive-traffic Admin canary with explicit rollback; no API/CAPI/D1 action.

## GFS-COD-MO-06 Admin candidate ready (2026-11-05 PKT)

- Uploaded exactly one immutable nondeployed Admin MO candidate: `92c81e60-3ec3-40b6-b912-ea81f94ee8af`, tag `gfs-cod-mo-06-4865999`, from tested source SHA `48659993ce713978a3202b19265a6a6938922636`.
- Candidate configuration fingerprint exactly matches the prior HMAC-bearing version, including `COD_REFERENCE_HMAC_KEY`, D1/R2/Queue bindings and runtime variables. It is not in a deployment; Admin remains `e8c96c96`100% / `e44703c3`0% and API remains `b426ba47`100% / `d683ec45`0%.
- Focused MO/guided 131 passed/1 skipped, full 378 passed/1 skipped, build/lint PASS. Header-scoped authenticated candidate preview passed Orders/Conversations reads and was cleared immediately afterward. CAPI remains OFF; recovery ON.
- Next authorization: attach only candidate `92c81e60-3ec3-40b6-b912-ea81f94ee8af` at controlled 0% traffic and repeat read-only verification. No promotion or API action.

## GFS-COD-MO-05 controlled release preparation (2026-11-05 PKT)

- Completed the authorized D1 step: exact migration `0047_cod_pakistan_post_mo.sql` applied once to `getfreeseeds-staging`. Remote readback shows marker `0047` once, empty `cod_mo_receipts`, two immutable receipt guards and eight retained historical COD/payment guards; Advance remains 3/3 enabled and COD is PKR125 enabled.
- Created the cryptographic `COD_REFERENCE_HMAC_KEY` only on nondeployed Admin version `05dedc81-7386-4289-82d1-15f7831bb4b7` (`gfs-cod-mo-05-hmac`). Active Admin remains `e8c96c96`100% / `e44703c3`0%; API remains `b426ba47`100% / `d683ec45`0% with CAPI OFF/recovery ON.
- Current Time Travel bookmark is retained as the recovery boundary; no automatic restore is permitted because live order intake continues. Fresh API health (WhatsApp enabled) and Admin Orders/Conversations reads pass.
- Next and only release action: separately authorize creation and controlled validation of an Admin MO Received candidate that retains the HMAC binding. The current version is binding-only and must not be deployed as the MO release. API default-COD remains deferred.

## GFS-COD-MO-04 final D1 verification (2026-11-05 PKT)

- Chrome MCP and official Cloudflare UI access passed for `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; no auth renewal or mutation occurred.
- Current `getfreeseeds-staging` D1 is pre-0047: 831 orders, 831 payments, 45 receipts, 432 COD rows (431 pending, 1 dispatched), markers through `0043`, no `cod_mo_receipts`; COD is enabled at PKR125 but both settlement policy hashes are absent.
- Time Travel is available for 30 days; no bookmark or restore was performed. Admin `e8c96c96`100% / `e44703c3`0% lacks the `COD_REFERENCE_HMAC_KEY` production secret binding. API `b426ba47`100% / `d683ec45`0% remains CAPI OFF/recovery ON.
- Local 0047 full-schema probe passed quick/FK checks and marker/table/trigger creation. Release remains **NO-GO**. Next action is one exact authorization to apply 0047 and bind the Admin HMAC secret through the official controlled release path, followed by read-only rollback/routing/configuration verification; do not authorize API default-COD changes.

## GFS-COD-MO release handoff (2026-11-04 PKT)

- Apply migration `0047_cod_pakistan_post_mo.sql` only through the separately authorized release process, then verify the Admin `MO Received` path against a synthetic/read-only-safe fixture before live use.
- Keep CAPI OFF, API/Admin allocations frozen, and do not mark historical no-method orders or receipts as paid. The remaining release action is owner approval for migration/deployment, not further source development.

## GFS-P0-REVENUE operational conversion snapshot (2026-11-04 PKT)

Use the existing Admin read-only filters to prioritize 21 payment-review orders, 407 COD_PENDING orders requiring genuine courier/tracking evidence, and the three confirmed fulfillment states. Prioritize the 1,479 OFFER-stage snapshot contacts as the highest drop-off worklist, but only apply existing inbound-only resume when a customer returns. No source repair or deployment is justified by this snapshot.

## GFS-LAUNCH-P0 Meta launch gate (2026-11-04 PKT)

The read-only Meta gate confirms the GFS business, ad account, WABA and canonical sender. Keep existing WhatsApp operations under observation/maintenance. Do not expand advertising while the sender display name is In Review and official advertising eligibility is not visibly established. COD settlement and the deferred resume candidate retain their independent blockers.

## GFS-ADMIN-P0 completed recovery (2026-11-04 PKT)

Restore normal Admin operator access by renewing the expired Cloudflare Access session in the existing authorized Chrome profile; do not change Access policy or deploy code. Acceptance is complete: two consecutive manual refreshes passed for Conversations and Orders, including list/summary/detail reads with no stale warning. Continue normal operations on frozen API/Admin allocations; no follow-up deployment or source work is required.

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

## GFS-479 controlled 0% acceptance

The approved deployment was applied as baseline `b426ba47`100% plus corrected `d683ec45`0%, replacing only `e8018f3f`. Post-attach readback, GET-only health, Cron dry-run, Queue consumer readback and protected configuration comparison passed. No customer traffic allocation or live business test was performed. Keep the prior exact 100%/0% deployment as the authorized restore target if regression evidence appears.

## GFS-480 release decision

Final preflight remains safe but not sufficient for a live release: the override GET health passed, while version identity and aggregate error/payment/recovery monitoring were unavailable. No canary approval was present, so candidate traffic remains0% and live acceptance is INCONCLUSIVE.

## GFS-481 closure

Engineering is closed as **READY FOR BUSINESS GATES**. Local resume repair and regression are complete; API live release remains deferred at0%. Business launch is externally blocked pending official Meta display-name verification/approval and genuine courier collection/remittance evidence. No GFS-482 or further development loop is created.

## GFS-OPS final business verification

No official Chrome UI was available. The connected read-only Meta tool returned zero consented portfolios and cannot establish Meta/WABA/ad eligibility. Courier contract and settlement records remain unavailable. Close as existing operations GO/MAINTAIN, public expansion and COD settlement NO-GO/BLOCKED EXTERNALLY.

## GFS-COD-MO-26

The authorized 0% Admin candidate upload and attachment are complete. Candidate-specific Orders GET evidence is available, but detail UI preview is INCONCLUSIVE after the existing Access session redirected to sign-in; do not retry credentials or increase traffic. English dashboard language change also remains unverified/failed at the normal UI save boundary. Next action requires one separately authorized, authenticated candidate detail preview and bounded canary approval; no promotion is implied.

## GFS-COD-MO-27

The existing session was reused successfully, but the live dataset has no DELIVERED/tracked eligible historical record. COD_PENDING read-only MO UI passed; eligible historical form acceptance and candidate version attribution remain INCONCLUSIVE. Preserve Admin 100%/0% and request only version-attributed authenticated preview evidence before any canary authorization.

## GFS-COD-MO-28

Candidate attribution is now PASS through the corrected quoted header and candidate-only historical UI markers on the same no-method order. Eligible-form behavior remains isolated-test evidence only because production has no eligible DELIVERED/tracked record. Keep candidate at0%; canary and settlement remain separately gated.

## GFS-COD-MO-29

Do not run the canary. Monitoring preflight is BLOCKED because fresh candidate-specific Cloudflare telemetry and rollback observation cannot be proven. Preserve Admin100%/0% and API100%/0% until the approved monitoring session is restored.

## GFS-COD-MO-30

Monitoring restoration is BLOCKED at access/session readiness. Restore the approved Cloudflare Key Figures/version-separated route or equivalent official candidate-attributed telemetry before requesting a canary. No routing change is permitted.

## GFS-COD-MO-31

The approved alternative P0 checks are complete: fresh API health, Admin Orders/Conversations and privacy-safe funnel/reminder aggregates were read. Candidate-specific telemetry is still unavailable, so no canary or traffic change is permitted. Next executable task is business review of the aggregate funnel/reminder evidence; telemetry restoration remains a separate prerequisite for any canary.

## GFS-COD-MO-32

Official Key Figures access is partially restored, but the candidate probe was not reflected as fresh telemetry and rollback execution access is unavailable because Wrangler OAuth is expired/unreachable and the dashboard traffic action cannot be safely operated in this session. Keep Admin100%/0%; do not canary. Next MO-specific task: provide a supported deployment-control session or restore Wrangler OAuth, then recheck fresh candidate ingestion before one canary.

## GFS-COD-MO-33

No additional canary attempt is permitted. Account identity is reconciled, but fresh version telemetry and Worker Editor/rollback access remain blocked. Restore one supported deployment-control identity and fresh version-filtered observation before any positive traffic.
