# Get Free Seeds Binding Rules

## GFS-386 diagnostic repair and canary gate (2026-10-31 UTC)

- No live exposure is authorized under GFS-386. Frozen routing remains API `b426ba47`100% / `d603f077`0% and Admin `ceb3e680`100% / `72cff93f`0%; preserve the new-number WhatsApp lock and Hoja/ThanNow zero-connection rule.
- Added an allowlisted diagnostic taxonomy and bounded NDJSON persistence for controller/adapter/observability failures. GraphQL HTTP200 errors, empty rows, invalid JSON, HTTP failure, timeout/network, Wrangler auth/timeout/readback, unknown routing, health, cancellation, retry exhaustion, controller exception and watchdog restoration failures now retain safe code, stage, operation, class, status/attempt/elapsed fields and correlation ID only. No raw bodies, secrets, cookies, customer or payment data are retained.
- Fail-closed behavior and rollback deadlines remain unchanged. Focused adapter8/8, observability5/5, controller18/18, full339/339, build, lint and offline audit0 pass.
- Read-only baseline qualification ran8 checks over105 seconds:7 success,1 `monitor_retry_exhausted` caused by `graphql_http200_errors`, then recovery on the next check. Final readback was API/Admin100%/0%, health HTTP200 and GraphQL errors0. This is classified and safely recoverable but **monitoring reliability is not yet PASS**; no fresh API canary approval is prepared or requested and no live exposure may be repeated.

## GFS-385 API canary disposition (2026-10-31 UTC)

- Approval L authorized one API-only `d603f077-cc44-4882-af9b-9985adb53424` canary at1% for8 minutes with restoration byminute6. Preflight used the protected Windows Credential Manager bridge; API `b426ba47`/candidate and Admin `ceb3e680`/rollback were read back100%/0%, health was HTTP200 and GraphQL errors were0. Candidate version119 metadata identifies the approved GFS-383 corrected acknowledgement repair and no API source was changed.
- A detached watchdog was armed before exposure with a 6.5-minute deadline. The controller observed the candidate at1% after13.9s, then encountered an unrecoverable monitoring/controller read failure at109.7s and fail-closed. It restored API baseline100%/candidate0% and verified restoration at123.5s. Watchdog was disarmed only after independent API/Admin baseline, health and metrics readback.
- This is **FAIL-SAFE / INCONCLUSIVE**, not a canary PASS: the exact underlying failing Cloudflare call/response is unavailable because the controller emitted only sanitized `controller_error` and no raw error is permitted. No customer test event was generated; candidate-attributed customer traffic and business-flow acceptance are UNKNOWN. Do not repeat exposure until the monitor records a safe diagnostic classification and passes isolated transient/persistent failure tests.
- Final verified routing is API `b426ba47`100% / `d603f077`0%, Admin `ceb3e680`100% / `72cff93f`0%. No promotion, source/API candidate change, customer message/order/payment, Meta, migration, flag, Queue/Cron or manual D1 mutation occurred. Preserve the new-number lock and Hoja/ThanNow zero-connection rule.

## GFS-372 Admin canary disposition (2026-10-31)

- Fresh Approval D exposed candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec` at10% beside bridge `3bbf5cf6`90% for approximately53 seconds, then restored before minute6. Restoration deployment `e907d94f-45e0-4f59-98dc-2f1fb3f7a685` is bridge100% + candidate0%; API remains `b426ba47`100%.
- Canary monitoring passed: health200, missing/invalid403, Service Auth isolation, GraphQL errors0, Orders/payment settings200, D1/Admin parity and COD PKR125. Candidate-only Analytics/Conversations responses were observed through the authorized Admin monitor.
- Candidate-specific customer-flow evidence is INCONCLUSIVE: the observed candidate requests were controlled read-only monitoring probes, not attributable customer traffic. Do not promote Admin based on this canary alone.
- Watchdog restoration was armed before exposure, mandatory restoration was independently read back, and watchdog was disarmed afterward. No source, API, customer, payment, Meta, migration, flag, Queue or Cron mutation was made.

## GFS-371 health-compatible Admin baseline (2026-10-31)

- Approval F activated Admin deployment `5587e7cb-3546-4ac0-834f-b0484f78574d`: health bridge `3bbf5cf6-87d7-47ee-9a2b-17e0165af1e1`100% and combined candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`0%. API remains `b426ba47-1ead-4c4a-85ba-0a0b85d3e415`100%.
- The bridge has the same runtime date and binding manifest as the legacy baseline/candidate. Serving acceptance without override is health200 x3, missing/invalid403, Service Auth denied from Orders/Analytics/Conversations, human Orders/payment settings200, GraphQL errors0 and exact routing readback.
- Preserve rollback target `494a3dce-5d52-4b66-b3ff-bef64b31b406`100% + candidate0%. The interruption watchdog was armed before replacement and disarmed only after all gates passed. No rollback was required.
- Pre/post D1 payment/COD/order aggregates matched; Admin active401, review13, approved2 and COD pending198 matched D1. COD fee remains PKR125. No Admin audit write occurred; inbound continued. No customer, payment, API, Access, token, Meta, migration, flag, Queue or Cron mutation.
- Analytics and Conversations remain absent on the bridge exactly as on the legacy baseline; they remain isolated in candidate0%. A fresh Approval D is required for a maximum10%/8-minute canary, restoring bridge100% beginning by minute6.

## GFS-370 validated Admin health bridge (2026-10-31)

- Approval E covered only temporary deployment `f99ec808-48c7-4f60-ab83-de535749034e`: Admin baseline `494a3dce-5d52-4b66-b3ff-bef64b31b406`100% plus health bridge `3bbf5cf6-87d7-47ee-9a2b-17e0165af1e1`0%. The combined candidate remained uploaded and received no traffic.
- Structured version override proved the bridge executed: authenticated `GET /health` returned HTTP200 three times (544–609ms); missing/invalid credentials returned403; the monitor was denied from Orders, Analytics and Conversations. Existing human Admin `/orders` remained HTTP200.
- Restoration is mandatory. Deployment `ef31f177-d0ef-446e-93c8-2b39d244b50b` restored `494a3dce`100% + `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`0%; API remains `b426ba47`100% + candidate0%.
- No Access, token, API, WhatsApp, customer, payment, Meta, D1, migration, Queue, Cron or flag mutation was authorized or made. Aggregate readback observed active WhatsApp processing and new orders; customer identifiers and payloads remain prohibited.
- The next mutation requires separate owner approval for baseline replacement only: bridge `3bbf5cf6`100% + combined candidate `4fe564a6`0%, with rollback to `494a3dce`100% + `4fe564a6`0%. A new Approval D is required afterward for any canary.

## GFS-369 Admin baseline health bridge gate (2026-10-31)

- The actual serving Admin baseline `494a3dce-5d52-4b66-b3ff-bef64b31b406` remains100% and cannot authenticate the existing Service Auth monitor: its `/health` response remains `ADMIN_ACCESS_REQUIRED`. Do not reinterpret that 403 or GraphQL0 as healthy.
- Versions `7e0b0549-ceaa-4b67-83cb-4e96a41c6bee` and `4fe564a6-bcd7-4106-82ee-00f7b14c4bec` have the same script etag and therefore are not a minimal baseline-only repair. Do not promote `7e0b0549` as if it were isolated from Analytics/Conversations.
- A distinct health-only bridge was built from exact baseline source `901f3f6fbde01adc8ef48b13f70eebdeba5baa4f` with only the audited `ctx.access` authorization for `GET /health`; all other paths retain owner-email authorization. Uploaded version `3bbf5cf6-87d7-47ee-9a2b-17e0165af1e1` has no traffic and is not in the active deployment.
- Local bridge gates pass: focused33/33, baseline full321/321, build/lint; current PR full335/335, build/lint/audit0, controller17/17, adapter6/6, observability4/4 and rollback4/4. Live Access-context health is unverified because Cloudflare version overrides apply only to versions in the current deployment.
- **Approval E required before any deployment mutation:** temporarily deploy Admin `494a3dce`100% + bridge `3bbf5cf6`0%, replacing only the current 0% combined-candidate slot. API remains `b426ba47`100%. This routes zero ordinary traffic to the bridge and permits exact override testing. Immediate rollback is the current Admin deployment `494a3dce`100% + `4fe564a6`0%.
- Do not replace the serving baseline, run a canary, change Access, or change the canary rollback target until the 0% bridge passes real health, denial, isolation, telemetry, latency and version-readback tests and the owner grants a separate baseline-replacement approval. WhatsApp and GFS-368 findings remain untouched.

## GFS-368 WhatsApp ordering incident (2026-10-31)

- Read-only diagnosis: ordering did not stop after 14:17 PKT. From 14:17:00–15:49:18 PKT, D1 recorded 103 inbound customer events (62 INTERACTIVE, 38 MESSAGE, 3 MEDIA), all RECEIVED, with 32 unique-contact snapshots; latest inbound observed was 15:49:50 PKT. No webhook-rejection audit rows were found in the bounded window.
- D1/Admin active-view parity is PASS: D1 has 400 total orders including one archived row, 399 active; Admin returned total399 and the same latest order timestamp, 14:17:21 PKT. The identifier is intentionally withheld from chat and documentation. This is not an Admin count defect.
- Runtime evidence is PASS read-only: outbound replies were DELIVERED/READ, payment choice was READ, +15/+210 recovery remained protected, Cloudflare GraphQL reported API/Admin errors0, and API/Admin routing remained100% baseline with candidates0%.
- Classification is **E / INCONCLUSIVE for cause**, not a confirmed webhook, queue, order-write, or Admin defect. The interval had one new COD_PENDING order versus three in the equal preceding window and 26 over seven matching-hour prior-day windows; state snapshots show active checkout progress, but historical transitions and Meta hourly attribution are unavailable.
- Keep API `b426ba47`100%, Admin `494a3dce`100%, candidates0%; no repair, replay, customer message, payment, Meta, migration, flag, Queue, Cron, or canary mutation is authorized by this diagnosis. GFS-367 baseline Admin `/health` remains separate.

## GFS-363 secure monitoring gate (2026-10-31)

- Approval C is granted. The native Windows Credential Manager bridge uses `CredRead` in the authorized host context, keeps Client ID/Secret in process memory, injects only the two Cloudflare Access headers into the child controller, and restores the process environment. No credential value is recorded.
- Focused bridge/observability, adapter, deadline, and rollback tests pass; full334/334, build, and lint pass. The restricted sandbox identity cannot read the host credential, so host-context execution is required.
- Live read-only Access Applications readback shows `GFS-Admin-Health-Monitoring` with the exact `getfreeseeds-admin-staging.get-free-seeds.workers.dev/health` destination but Policies `--`. Three credential-backed `/health` requests returned HTTP403. Secure monitoring is BLOCKED; do not request Approval D or run a canary.
- Do not recreate the token, policy, application, or credential. Reconcile the live missing policy only through the official Cloudflare UI and a fresh identity check; until then preserve API `b426ba47`100%, Admin `494a3dce`100%, candidates0%, WhatsApp protections, migration0043, and Hoja/ThanNow isolation.

## GFS-357 Access setup and Admin monitoring gate (2026-10-31)

- **Approval A PASS (read-only):** Cloudflare One is visibly authenticated as `Get Free Seeds` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Reusable policy `GFS-Admin-Health-Monitor` has action `Service Auth` and exactly one Include rule: Service Token `GFS-Admin-Health-Monitor`. The Service Tokens page shows exactly one enabled token with that name; no token was created, rotated, displayed, copied, or logged. Existing `Get Free Seeds Admin Operator` remains `Allow` and unchanged.
- **Approval B pending:** prepare, but do not save, one dedicated Self-hosted Access application named `GFS-Admin-Health-Monitoring` for the actual staging Admin host `getfreeseeds-admin-staging.get-free-seeds.workers.dev` and exact path `/health` only, with only policy `GFS-Admin-Health-Monitor` attached. The existing Admin application, login policy, API, all other Admin endpoints, API `b426ba47`, Admin `494a3dce`, and candidate routes remain untouched.
- No Access application was created or modified in this gate. Do not create another token, broaden the Include rule, attach the policy to the existing Admin application, or save the dedicated application until the owner explicitly grants Approval B after reviewing the exact host, path, and policy above.
- After Approval B, every Cloudflare mutation requires a fresh visible `gisupp@gmail.com` / Get Free Seeds identity check and a recorded result. Approval C remains separate and is required before any secure host credential connection; credentials must stay in approved host secret storage and never appear in chat, Git, logs, or screenshots.

## GFS-342 Analytics + Conversations release readiness (2026-10-30)

- Verified Cloudflare mutation identity `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` immediately before upload. API remains `b426ba47`100% / `6ef27f02`0%; frozen Admin remains `494a3dce`100%; the combined Admin candidate is `19188b21-60da-4b03-bd89-72cb49468100`0% in deployment `00566a27-064e-4bd0-b3e2-079efe69cffd`.
- Candidate version-targeted acceptance passed authenticated Analytics, aggregate CSV, Conversations, masked exact-order search, metadata-only detail, Orders, payment configuration and COD PKR125. No raw WhatsApp/provider ID or historical body was returned. Migrations0044/0045 are not required and remain unapplied.
- Current aggregate health at `2026-10-30T17:43:59.762Z`: inbound2576/24h, unique-contact snapshot451, submitted orders70 (orders/inbound2.72%), payment-choice failures0, recovery overdue pending0. Historical conversation-reply failures are29 with zero in24h; receipt-ingestion blocks remain2. CAPI pending361 and failed/dead-letter2 are separate from WhatsApp delivery and were not replayed.
- Restricted-context readback failure is execution-context isolation: restricted sockets/credential store are unavailable, while the supported Windows host context authenticated and read exact routing. Shell-free adapter5/5 and deadline controller10/10 pass. No live canary is authorized; a future traffic test still requires a new scoped owner approval.
- Focused release tests201/201, full334/334, build/lint, offline audit0, Admin dry-run and validated rollback4/4 pass. No API deployment, D1 migration/write, live traffic exposure, customer/Meta/payment/flag/message mutation, or Hoja/ThanNow connection occurred.

## GFS-341 customer conversation viewer (2026-10-30)

- The new Admin `/conversations` page and GET APIs are protected by the existing Admin Access identity check, read-only, paginated, bounded, and privacy-safe. Customer WhatsApp IDs, provider IDs, raw payloads, payment references, credentials, and private media are not returned.
- Legacy `whatsapp_events` and `outbound_messages` retain metadata but not message bodies. The viewer reports `LEGACY_METADATA_ONLY` and never reconstructs historical text or interactive labels. STATUS callbacks and CAPI events remain outside customer-inbound history.
- Proposed `migrations/0045_admin_message_history.sql` is local and unapplied. It is additive, idempotency-indexed, status-monotonic, text-bounded, and requires separately authorized encrypted/protected capture, retention, access audit, and acknowledgement handling before activation.
- Focused viewer tests pass4/4; full suite334/334; build and lint pass. No Worker, D1, migration, Meta, payment, customer, flag, traffic, Queue, Cron, or reminder mutation occurred. API/Admin production routing and +15/+210 recovery remain unchanged.

## GFS-340 analytics accuracy and Admin-only 0% staging (2026-10-30)

- Corrected Admin analytics semantics: contacts are explicitly `SNAPSHOT_ESTIMATE`; conversion is submitted orders divided by distinct non-STATUS inbound messages, not unique-lead conversion; paid/fulfilled and COD lifecycle values are named separately; reminder `SENT`, `DELIVERED`, and `READ` are separate counters.
- Corrected abandonment classification so PRE_ORDER/ACTIVE exclude any customer with a submitted order and POST_ORDER excludes cancelled, paid, packing, dispatched, and delivered orders. Historical stage transitions remain unavailable; a same-day zero is not proof of zero drop-off and lifecycle snapshots are not mutually exclusive.
- Added real `node:sqlite` D1-compatible fixtures covering duplicate provider callbacks, pre/post/active, Advance pending, COD, PAID, cancelled, later activity, UTC boundaries, and reminder status separation. Full330/330, build, lint, offline audit0, diff check, and validated legacy rollback4/4 pass.
- Read-only D1 evidence under verified `gisupp@gmail.com` / Get Free Seeds account: today events2059/24692 rows/10.5666ms, contacts368/2004/1.4008ms, orders53/347/0.5633ms; 7-day events11081/24692/12.0104ms, contacts1822/2004/1.1254ms, orders303/347/0.4167ms; 31-day event table read24677 rows. Current event/contact plans scan their tables because proposed0044 is unapplied; no daily saving claim is made.
- Reviewed local migration0044: event, conversation, and order indexes remain only a proposal; the unused leads index was removed to avoid write overhead. Migration0043 marker and ten indexes are live; D1 quick_check is `ok` and foreign_key_check is empty. No migration0044 or D1 write occurred.
- After final identity recheck, authorized Admin-only staging upload created `c7e984d1-74a8-47d8-9277-fd7c8b41e329` (version103) and deployment `6e1a3016-a4d1-4674-be82-0f4109603ccd` routes frozen Admin `494a3dce`100% / analytics candidate0%. API remains `b426ba47`100% with `6ef27f02`0% and rollback `9af8991d`; no API, Meta, payment, reminder, customer, Queue, Cron, or traffic promotion occurred.

## GFS-339 inbound analytics and abandoned checkout reporting (2026-10-30)

- Added a protected, read-only Admin `/analytics` page and `/api/analytics` plus privacy-safe summary CSV. It reports UTC windows, Today/Yesterday/Last7 presets, checkout status filters, inbound event classes, contact snapshots, submitted/completed orders, Advance/COD state, recovery-stage delivery, definitions, and D1 `rows_read` metadata when supplied.
- Exact staging D1 reconciliation for 2026-10-30 UTC: customer inbound `1,970` (`MESSAGE`933 + `INTERACTIVE`1,029 + `MEDIA`8); STATUS callbacks `1,954` excluded; latest-inbound contact snapshot `356` (`315` new / `41` returning); submitted orders `49`; completed `0`; Advance-selected `6`; COD-confirmed `32`; Advance-pending `6`; inbound-to-order `2.49%`.
- Abandonment is conservative: PRE_ORDER and POST_ORDER require a reliable current snapshot and 24 hours of inactivity; ADVANCE_PENDING is never called abandoned; COD, PAID, cancelled and active states are excluded. Historical sender attribution is unavailable because `whatsapp_events` stores no `wa_id`; contact metrics are snapshot-based.
- The first classification shape read `11,099` rows; the bounded order/customer/conversation shape read `5,857` rows (`6.485ms` to `4.3702ms`). Event aggregate read `28,442` rows, contacts `1,992`, orders `424`, recovery stages `188`; all writes were zero. Proposed migration0044 is local only and unapplied.
- No API runtime, WhatsApp journey, payment/COD, webhook, Queue/DLQ, Cron, reminder, Meta, customer state, traffic, or migration was changed. GFS-338 remains blocked; no canary was attempted in GFS-339.

## GFS-338 API-only acknowledgement candidate gate (2026-10-30)

- Owner-scoped candidate upload completed read-only identity checks under `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`: API candidate `b0e883cd-16b8-4f8e-8fd8-c12bd46c4428` (version118), based on frozen source `901f3f6`, contains only the tested post-provider D1 acknowledgement repair. Recovery remained enabled; five-stage Advance, Automation V2 and utility templates remained disabled.
- Candidate preview health returned HTTP200/`PRODUCTION_INTEGRATION_READY`; D1 binding, Queue, R2, scheduled handler and flags matched the protected API configuration. No Admin candidate, migration replay, flag change, customer send, payment mutation or Meta change occurred.
- The first controller invocation failed closed during restricted-agent Wrangler readback before route exposure. Host-context readback then confirmed API `b426ba47`100% / old candidate `6ef27f02`0% and Admin `494a3dce`100% / old candidate `c2321eab`0%. The safety gate blocked a host-context retry; no canary PASS, candidate exposure or live savings claim is recorded.
- API-only scope is implemented and locally tested in the deadline controller/Cloudflare adapter. Keep all live routing frozen; do not treat the uploaded candidate as released until a separately permitted host-context canary completes with verified restoration.

## GFS-337 payment-choice incident ruling and acknowledgement safeguard (2026-10-30)

- Fresh read-only identity/routing is `gisupp@gmail.com` / Get Free Seeds account: API `b426ba47` 100% and `6ef27f02` 0%; Admin `494a3dce` 100% and `c2321eab` 0%. Recovery +15/+210 is true; five-stage Advance reminders, Automation V2 and utility templates are false. Marker0043, all ten indexes and `quick_check=ok` remain intact. No live write, resend, deployment, migration, flag or traffic mutation occurred.
- The owner-reported order did not stop after save: submission audit exists, conversation reached `PAYMENT_METHOD`, original `PAYMENT_CHOICE` is provider-backed `READ`, +15 recovery is `DELIVERED`, and no Advance/COD callback followed. `payment_instruction_status=NOT_SENT` is expected before a method is selected.
- In the newest 30 no-method orders, all 30 original choices were provider-accepted; zero were failed, missing or unresolved. Since frozen API deployment, all 150 `PAYMENT_CHOICE` rows are provider-backed (`READ`142, `DELIVERED`8). Do not classify no-method alone as a send failure or resend.
- A separate local fault is proven in deployed-source lineage and PR source: a successful Meta send followed by a D1 acknowledgement-write error was caught as provider failure and rolled the conversation back. The source now separates the irreversible provider-acceptance boundary, retries only the D1 acknowledgement three times, preserves `PAYMENT_METHOD`, and fails closed against duplicate resend when persistence remains unavailable.
- Safety readback is zero overdue eligible recovery, zero duplicate recovery idempotency keys, zero PAID rows without independent approval and zero malformed PKR125 COD quotes. Regression is fault-focused4/4 and full326/326; build/lint/audit0 and validated legacy rollback4/4 pass.
- This source repair is not deployed. Keep frozen Workers and all reminder/customer/payment state unchanged until a separately scoped production deployment authorization.

## GFS-336 benchmark correction and D1 regression ruling (2026-10-30)

- Supersede the GFS-335 local slowdown claim. The original harness divided completions by the time of the last completion, used one-second tiny quotas, omitted real baseline indexes such as `orders_archived_created_idx` and `payment_choice_recovery_stage_order_idx`, and added a non-production opt-out index. Its 50k post0043 recovery p50 of about 1665ms was a harness artifact.
- The corrected harness uses the real baseline index shapes, identical deterministic snapshots, `ANALYZE`, randomized repeated A/B order, fixed offered-rate windows, 300ms warmup, 1s measurement windows in the recorded run, 25 query samples, separate read-only/mixed modes, four workers, 50ms busy timeout, CPU metadata, lock/error counts, and a 300ms late-work cutoff. Offered RPS is scheduled requests/window; achieved RPS is completed/window. Dropped work is reported, not hidden in an extended completion time.
- Corrected 50k repeated A/B: recovery p50 pre0043 `5.23–8.18ms`, post0043 `5.81–6.33ms`; post counts p50 `519.76–532.40ms` versus pre `814.89–954.77ms`; post delta p50 `37.57–38.92ms` versus pre `81.39–99.23ms`. Migration0043 production regression is not proven.
- Production read-only failure evidence is now aged: 16 failed conversation replies (1 on Oct24, 3 Oct27, 10 Oct28, 2 Oct29); 19 payment-instruction dead letters (12 Oct23, 6 Oct24, 1 Oct25); 305 CAPI rows/outbox jobs remain PENDING, oldest Oct23. No provider trace correlates these to customer impact. Do not resend or mutate.

## GFS-335 D1 audit and isolated capacity benchmark (2026-10-30)

- The stress harness is local SQLite only: synthetic data, isolated files, deterministic clocks/IDs, mocked provider behavior, no Wrangler bindings, no Cloudflare endpoints, no Meta/JazzCash/Easypaisa credentials, and no customer data. Local throughput is not production capacity.
- Current authorized D1 read-only audit: `quick_check=ok`, foreign-key rows `0`, migration0043 marker `1`, ten expected indexes, bounded recovery query `21` rows / `2.385ms` / `574` rows read, and bounded delta query `101` rows / `8.553ms` / `14,538` rows read. All writes were zero.
- Actual production recovery EXPLAIN uses `orders_archived_created_idx` and scans `payment_reminder_v2_opt_outs` for the correlated opt-out anti-join. The migration index is not proven to be the production bottleneck. Do not add or remove indexes without a fresh measured workload and scoped authorization.
- Isolated 50k mixed read/write stress found post-0043 local SQLite contention and index overhead: at a 100-RPS target, pre-0043 achieved `38.58` RPS with p95 `124.292ms`; post-0043 achieved `2.12` RPS with p95 `1704.837ms` and p99 `5703.024ms`. This is a capacity warning, not proof of a live D1 defect; no production remediation is authorized from it.
- Current 7-day failure aggregates remain sanitized: 16 outbound conversation failures, 19 payment-instruction dead letters, 304 pending CAPI outbox/events, two receipt-ingestion blocked audit rows, and 16,224 runtime-observation rows. Do not resend or mutate customer/payment state.

## GFS-334 order-health investigation and controller repair (2026-10-30)

- Read-only 7-day evidence shows inbound activity and submitted orders declined after the migration window, but no exact stage-funnel attribution is permitted: historical offer/fertilizer/province/review transitions are not stored. Report the decline as observed, not as a proven customer-flow defect.
- Equal 24-hour UTC windows around migration0043: inbound events 3991 to 2525 (-36.7%), new conversations 627 to 403 (-35.7%), submitted orders 113 to 60 (-46.9%), payment-method selections 20 to 9 (-55.0%), and submitted/inbound conversion 2.83% to 2.38% (-0.45 percentage points; about -15.8% relative). Acquisition decline is the larger measured component; causation remains unverified.
- Last-7-day operational evidence is sanitized: 16 failed outbound conversation replies classified as Meta/provider failures; 19 payment-instruction dead letters occurred only before migration on 2026-10-23 through 2026-10-25; none occurred in the post window. No unexpected WhatsApp event statuses, duplicate-send proof, or lost-order proof was found. CAPI has 302 pending rows and needs authorized provider-log follow-up; customer impact is unverified.
- The GFS-333 live adapter defect is proven locally: Windows `shell:true` split a spaced Wrangler message into positional arguments, producing invalid version paths ending in `/versions/API` and `/versions/authorized`. The adapter now invokes Wrangler's JavaScript entrypoint through `process.execPath` with `shell:false`, preserves one message argument, validates exact Worker identities, and remains fail-closed. No canary is retried in GFS-334.
- Fresh read-only routing remains API `b426ba47` 100% / candidate `6ef27f02` 0% and Admin `494a3dce` 100% / candidate `c2321eab` 0%. +15/+210 recovery stays ON; five-stage Advance, Automation V2 and utility templates stay OFF. No live mutation or customer test is allowed.

## GFS-333 canary fail-closed stop (2026-10-30)

- Owner authorization was limited to API `getfreeseeds-api-staging` candidate `6ef27f02` and Admin `getfreeseeds-admin-staging` candidate `c2321eab`, at most 1% for 15 minutes, with at least a 60-second restoration margin. No 100% promotion, flag, migration, Meta, payment or customer action was authorized.
- Identity, exact scripts/versions, bindings, flags, migration0043 marker, ten indexes, quick check and FK check passed read-only. Focused local checks passed 64/64 and controller safety remained 9/9.
- The live controller attempt failed closed before any candidate deployment became active: the first Windows `.cmd` read adapter returned `EINVAL`; after a shell-safe adapter fix, Wrangler returned exit code1 during the route operation and the compensating command also failed. Final readback remains API `b426ba47` 100% / `6ef27f02` 0% and Admin `494a3dce` 100% / `c2321eab` 0%, with original deployment IDs unchanged.
- Do not retry traffic mutation through a workaround. GFS-333 is BLOCKED pending owner-approved remediation of the Cloudflare control-plane invocation/rollback path and a fresh explicit canary approval if the scope or controller changes.

## GFS-332 Cloudflare resource discovery (2026-10-30)

- Read-only official Wrangler/dashboard verification confirmed `gisupp@gmail.com` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Configured `getfreeseeds-api` and `getfreeseeds-admin` are absent; API10007 is a stale/wrong resource-name lookup, not permission evidence.
- Actual deployed scripts are `getfreeseeds-api-staging` and `getfreeseeds-admin-staging`, each dashboard `Production`, workers.dev-only, with no custom routes. V2 staging scripts have no active route. No rename, replacement, binding, route, deployment or traffic mutation occurred.
- Actual-name readback: API `b426ba47` 100%, candidate `6ef27f02` 0%, rollback `9af8991d`; Admin `494a3dce` 100%, candidate `c2321eab` 0%, rollback `76e33a3d`. API has minute Cron, staging D1/R2/Queue consumer; Admin has staging D1/R2/Queue producer and no Cron/consumer.
- Deployed API flags read-only: payment-choice recovery true (+15/+210 retained), five-stage/payment-reminder V2 false, automation V2 false, utility templates false, COD public, guided WhatsApp and Meta provider enabled. No customer, Meta, payment, D1, flag or production mutation occurred.
- Release remains NO-GO until the owner accepts the discovered names and grants a new scoped canary authorization naming versions, exposure/window, deadline/margin, stop thresholds, final 100%/0% readback and rollback/promotion limits. Do not claim 24-hour D1 savings from historical query evidence.

## GFS-331 push and final release-gate verification (2026-10-30)

- GitHub host verification succeeded as `gardenshop` with repository push permission true. The branch advanced fast-forward only from remote `9682e2a` to `64023f1c72b70786432b14fca0589d302b0d3498`; no force-push or history replacement occurred. Controller, test, migration0043 and Admin source paths were read back at that SHA.
- Cloudflare read-only identity is `gisupp@gmail.com` in Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Remote staging D1 readback returned marker0043=1, ten indexes, `quick_check=ok`, and zero foreign-key rows; no D1 write occurred.
- The configured production Worker deployment lookups for `getfreeseeds-api` and `getfreeseeds-admin` both returned Cloudflare API10007, `Worker does not exist on your account`. Do not infer current production traffic or versions from the prior record while this control-plane/resource mismatch remains unresolved.
- Local controller9/9 and targeted Admin/recovery/payment/COD tests56/56 pass; prior full324/324, focused121/121, build/lint/audit0 and rollback4/4 remain valid because no source changed after `64023f1`.
- Keep the release NO-GO until the correct production Worker resource names/account scope are read-only verified and a separate owner authorization names candidate versions, exposure, deadline, thresholds and rollback.

## GFS-330 canary deadline controller implementation (2026-10-30)

- Added only a local release-controller module and synthetic Node test harness under `scripts/`; no customer-facing Worker, Cloudflare, D1, Meta, flag, traffic, payment, Queue, Cron or reminder code was changed.
- The controller uses a monotonic absolute deadline, restores before the owner cap by a safety margin, bounds route/readback/poll commands, fails closed on timeout/5xx/interruption/overlap, and requires a final baseline100%/candidate0% readback. A failed or unverified rollback is an explicit failure; no timer-only strict-compliance claim is permitted.
- The lock is exclusive and interruption-safe: a live overlap is rejected; an interrupted lock is not silently removed. Audit events are allowlisted and sanitized to timing/reason/code fields only. Rollback ignores the cancelled monitoring signal so an interruption cannot cancel compensation.
- Synthetic deadline suite passes 9/9: normal restore, slow routing, command timeout, failed rollback, interruption, provider 5xx, delayed routing, overlap and sanitized audit. Full suite remains 324/324; build, lint and offline audit remain clean; validated legacy rollback is 4/4 against `cf01f444`.
- No live canary was rerun. Frozen API/Admin, candidates0%, migration0043 integrity, +15/+210 recovery, payment/COD, signed webhook, Queue/DLQ, new-number lock and Hoja zero-connection remain binding. Exact platform exposure compliance remains unproven until a newly authorized live run uses this controller and readback.

## GFS-331 remaining blocker resolution (2026-10-30)

- GitHub identity was read-only verified against `gardenshop/freeseeds` PR #11 and branch `codex/gfs221-cod-compat-001`; remote head remained `9682e2a` before and after the supported push attempt. The exact local commit `6b22c7254259ee5348b41012087191341a3b66b8` is a direct fast-forward candidate, but GitHub MCP `update_ref` returned `FORBIDDEN: Resource not accessible by integration`. No force-push, merge, unrelated ref, or credential exposure occurred.
- Chrome DevTools MCP `list_pages` was unavailable in this execution context. Do not substitute raw CDP, direct dashboard HTTP, another profile, or manual MFA/owner-device work. Meta eligibility and Business ancestry remain the GFS-330 **UNVERIFIED** result; the candidate number prohibition and Hoja zero-connection remain unchanged.
- No new production, Cloudflare, Meta, D1, migration, message, flag, or traffic action was taken. Preserve frozen API/Admin at 100%, optimized candidates at 0%, rollback, signed webhook, payment/COD PKR125, Advance methods, and PUBLIC leads.

## GFS-330 coexistence and release audit (2026-10-30)

- The read-only audit of candidate WhatsApp Business App number `+923124093162` is **UNVERIFIED**, not eligible or ineligible. The official Meta coexistence documentation describes Embedded Signup, supported app version/country, Solution Partner or Tech Provider status, Cloud API/webhook readiness, session logging, history synchronization, and linked-device effects; no candidate-specific Business App, country, provider, WABA, Phone Number ID, or permission evidence was available without starting the prohibited flow. No registration, migration, QR/OTP, subscription change, message, or production switch occurred.
- This request authorizes research only. `+923124093162` remains prohibited as a runtime sender, CTA, onboarding target, migration target, or replacement for canonical `+923044429933`. The new-number lock is unchanged.
- Business `568026370701542` remains ancestry-sensitive. The existing Ads Manager tab showed the specified GFS ad-account context, while the existing Business Suite tab was known to contain a Hoja-linked asset and was not opened or inspected. Clean current ownership/ancestry is therefore **UNVERIFIED**; the Meta-only exception does not permit Hoja connection or asset reuse.
- Browser evidence was collected through the official Chrome DevTools MCP `list_pages` and existing authenticated tabs only. Cloudflare account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` and the GFS resource context were read-only verified; no dashboard mutation was made. The Hoja zero-connection rule, signed webhook, payment/COD PKR125, D1/R2, queue, and rollback protections remain binding.
- GFS-330 is documentation-only: frozen API/Admin remain 100%, optimized candidates remain 0%, migration0043 and its integrity evidence remain accepted, and the two uncorrelated Meta 500s remain deferred. No source defect was proven and no source repair, migration replay, traffic change, resend, or deployment is authorized by this audit.

## GFS-329 post-canary acceptance and Meta 5xx triage (2026-10-29)

- Post-canary readback confirms API `b426ba47` and Admin `494a3dce` at 100%, candidates `6ef27f02` and `c2321eab` at 0%, and the retained rollback versions available. Recovery +15/+210 remains ON; five-stage Advance reminders, automation V2 and utility templates remain OFF.
- Migration0043 is verified through the project ledger `cod_schema_migrations` (not the legacy empty `d1_migrations` table): marker `0043` is present, all ten new indexes exist, `quick_check=ok`, and foreign-key check is empty. Never infer migration state from `d1_migrations` for this legacy-compatible binding.
- Cloudflare shows exactly two `500` subrequests to `graph.facebook.com` in the current 24-hour aggregate, alongside approximately 6k 2xx subrequests. Worker invocation errors are zero for the frozen API and candidate. Workers Observability is disabled, so timestamps, route, Meta error code, and request trace cannot be correlated; do not invent them or enable Observability as part of this audit.
- D1 delivery correlation in the canary window found no outbound FAILED rows, no outbox RETRY/DEAD_LETTER rows, no failure/error audit action, and provider-backed outbound rows in READ/DELIVERED/SENT states. Classify the two 5xx as transient/nonurgent with no proven lost message, defer exact attribution, and do not force-resend.
- Intentional synthetic/customer mutation was not used, but read-only post-canary audit found natural activity during the window: two WhatsApp submissions and one COD confirmation. Aggregate resulting states were one COD_PENDING/COD_PENDING and one DETAILS_COMPLETED/PENDING; no PAID or approval transition was observed. Audit records do not attribute these events to baseline versus candidate, so do not claim candidate causality or a zero-activity canary.
- The control-plane timing deviation is operational: the split/monitor/restore sequence had wall-time and one monitor transport failure. Future canaries require an absolute monotonic deadline, a safety margin before the owner cap, bounded poll timeouts, immediate restore on missed/failed monitoring, and final split verification. This is a release-controller safeguard design only; no new canary or source repair is authorized by GFS-329.
- The measured unchanged Refresh remains 25 D1 rows versus the current legacy count fingerprint average of approximately 1.71M rows/call. This is query-level evidence only; candidates remain at 0%, so no daily savings claim is permitted.

## GFS-328 controlled D1 optimization release (2026-10-29)

- Owner scope covered migration0043 on D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, exact PR #11 source `4e0055148842756d1c2df601aea9919578338457`, 0% staging, and at most 1% API/Admin canaries. It did not authorize 100% promotion, flag changes, Meta/customer actions, or five-stage reminders.
- Mutation identities were verified as GitHub `gardenshop`, Cloudflare `gisupp@gmail.com` / Get Free Seeds account, and canonical GFS Meta. Hoja/ThanNow stayed isolated. Before and after release, API `b426ba47` and Admin `494a3dce` are 100%; candidates API `6ef27f02` and Admin `c2321eab` are 0%; rollback versions remain retained.
- Migration0043 was applied once. It wrote the `0043` marker and created all ten expected additive indexes. Post-apply `quick_check=ok`, foreign-key violations are zero, and old Workers remained healthy. Never try to remove these indexes as an application rollback; Worker rollback and additive schema recovery are separate.
- Recovery remains ON from its existing cutoff. Five-stage Advance reminders, automation V2, and utility templates remain OFF. The +15/+210 scheduler and Cron reconciliation must not be disabled to reduce reads.
- Candidate acceptance was read-only: API health 200, unsigned webhook 403, authenticated Admin initial/delta/concurrent/filter/cursor/CSV checks passed, and unchanged delta returned zero changes. No order, payment, COD, customer, Meta, or synthetic message mutation was used.
- Cloudflare metrics recorded API candidate 40 invocations/zero errors and Admin candidate 14 invocations/zero errors. API 1% exposure lasted about 15m40s and cumulative Admin 1% exposure about 15m03s because monitor/control-plane work extended wall time beyond the 15-minute limit. Treat this as a procedural deviation even though health, D1 invariants, and customer state remained clean; do not continue or promote automatically.
- Measured direct D1 evidence is bounded: unchanged Refresh used 25 rows read versus a current Admin count fingerprint averaging about 1,710,265 rows/call (at least 99.9985% fewer on the repeated unchanged path). Indexed recovery SQL read 127 rows; the same post-index legacy shape read 145 rows (12.41% fewer). Cross-window comparison with the pre-migration recovery fingerprint suggests about 99.91% fewer rows/call, but is preliminary and must not be reported as full-traffic or 24-hour savings.
- Full/initial Admin count aggregates remain authoritative and expensive. Rolling 24-hour totals changed while the window moved and are not attributable to the brief canaries. A separately scoped promotion and observation window is required before claiming total live savings.

## GFS-325 final production preflight (2026-10-29)

- Read-only Cloudflare identity is verified as `gisupp@gmail.com` in the Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Staging D1 is `getfreeseeds-staging`, UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; canonical GFS Meta is the only Meta scope and Hoja/ThanNow remain isolated.
- Read-only deployment history confirms API `b426ba47` at 100% with `9af8991d` at 0%, and Admin `494a3dce` at 100% with `76e33a3d` at 0%. Recovery +15/+210 remains ON by the protected baseline; five-stage Advance reminders, automation and utility templates remain OFF. No live migration, Worker, traffic, flag, Meta, payment, COD, Queue, Cron or customer mutation was made.
- Migration0043 is additive and compatible with the existing 0037–0042 schema: every index name is new, `IF NOT EXISTS` is used, and only an idempotent `0043` marker insert is present. New indexes add write-maintenance cost on affected tables; that cost is not quantified here. Local EXPLAIN evidence shows the repaired cursor/reconciliation paths use indexed range searches instead of the prior source scans, with bounded grouping/order work remaining.
- The two Admin count aggregates remain the largest measured live source (345.06M rows of the 494M staging 24-hour baseline). Unchanged Refresh avoids rerunning them; initial/full reload still performs authoritative counts. No cross-isolate count cache was added because payment, COD, fulfillment, archive and concurrent Worker updates could make it stale. Live after `meta.rows_read` remains unmeasured until authorized migration/deployment.
- Final preflight checks: remote source commit `1df681e` is verified on PR #11; focused 121/121 and rollback4/4 pass; prior full324/324, build/lint/audit0, migration integrity and source regression evidence remain valid. Release sequence is migration after backup/integrity gate → candidate at 0% → health/signed-webhook/Admin acceptance → attributable canary → before/after rows-read monitor → promote or immediate rollback. Separate scoped owner authorization is mandatory for every live step.

## GFS-319 zero-regression release gate (2026-10-29)

- Protected baseline remains API `b426ba47` and Admin `494a3dce` at 100%, with `9af8991d` and `76e33a3d` retained for rollback. Recovery remains ON for the existing +15/+210 path; five-stage Advance reminders, automation and utility templates remain OFF. No external D1, Worker, traffic, flag, Meta, payment, COD, Queue, Cron or customer mutation was made.
- Official GitHub MCP readback confirms authenticated login `ai-photo-studio`, target `gardenshop/freeseeds`, PR #11 head `04d06bc`, and repository `push=false`. The collaborator-permission endpoint returned integration HTTP403; do not infer write access, cross accounts or retry authentication. The tested source commit is `e198e50`; subsequent local documentation records remain unpushed.
- Frozen remote baseline passed 24 files/321 tests, build and lint. Optimized local HEAD passed 24 files/324 tests, build and lint. The three-test delta is new Admin/Cron/recovery coverage; source review found no checkout message rendering, signed-webhook, payment method, receipt, COD confirmation, Queue/DLQ or customer-state path change. Recovery lookup/Cron delivery reconciliation changes are independently tested.
- Migration0043 remains additive and locally rehearsed only. It adds indexes and a migration marker; no existing rows are rewritten. Index write overhead and live rows-read savings remain unmeasured until an authorized staging release.
- The exact remaining owner action is one GitHub permission/connection repair: authorize the `gardenshop` identity or an approved write-enabled integration for `gardenshop/freeseeds`, then push and independently verify the remote SHA and migration/API files.

## GFS-318 guarded release checkpoint (2026-10-29)

- The frozen production pair remains API `b426ba47` at 100% with `9af8991d` retained for rollback, and Admin `494a3dce` at 100% with `76e33a3d` retained for rollback. Recovery remains the existing +15/+210 path; five-stage Advance reminders, automation and utility templates remain OFF. No external dashboard, D1, Worker, traffic, flag, Meta, payment, COD, Queue, Cron or customer mutation was made for GFS-318.
- Official Cloudflare read-only identity remains `gisupp@gmail.com` in the Get Free Seeds account; the measured staging D1 is `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. The connected GitHub identity is `ai-photo-studio`, and `gardenshop/freeseeds` reports `push=false`; do not cross accounts, loop authentication, force-push, reset or discard changes.
- The completed local repair is preserved for owner-authorized release: Admin unchanged Refresh uses a bounded indexed multi-source change probe, full reload is explicit, equal timestamp/id ordering is keyset-safe, and Cron delivery reconciliation/recovery remain independently gated. Migration0043 is additive, locally rehearsed and unapplied remotely.
- Measured staging evidence is attribution only: 494M rows read in the last 24 hours; top visible fingerprints include Admin count aggregates at 135.42M and 209.64M, recovery candidate scanning at 68.91M, and the old Admin list projection at 33.3M. No live after-deployment rows-read, duration or percentage saving may be claimed.
- Local gates pass: focused 121/121, full 324/324, build, lint, offline audit with zero vulnerabilities, migration `quick_check=ok`/zero foreign-key violations, rollback4/4 and diff check. The exact external blocker is one owner action: grant the authorized `gardenshop` GitHub identity write access to `gardenshop/freeseeds` (or reconnect an approved GitHub integration as that identity with contents write), then push the preserved local commit.

## GFS-317 authenticated read-cost evidence (2026-10-29)

- Read-only Cloudflare browser identity was verified as `gisupp@gmail.com` in the Get Free Seeds account, with staging D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. No dashboard mutation, SQL execution, migration, deployment, traffic, flag, billing, Meta, Queue, Cron, payment, COD or customer mutation was made.
- The current billing-period dashboard shows 534.3M rows read across five D1 databases. In the last-24-hour staging view, `getfreeseeds-staging` shows 494M rows read and 286.12k queries; the other four databases show 100 rows read on `getfreeseeds-prod` and zero on the three compatibility/restore databases. These windows must not be added as if identical periods.
- The authenticated Admin/API release remains API `b426ba47` at 100% with `9af8991d` rollback and Admin `494a3dce` at 100% with `76e33a3d` rollback. The live Admin page does not contain the local Full reload/delta UI, so GFS-316 is not deployed.
- Query Insights exposes SQL fingerprints, counts and rows-read but no query IDs in the visible table. Record fingerprints and exact dashboard windows instead of inventing IDs. Never record customer names, phone numbers, order numbers, WAMIDs, tokens, receipts or raw payloads.
- The new-number WhatsApp lock, Hoja Seeds zero-connection rule, COD PKR125, Advance flow, +15/+210 recovery, Queue/webhook safeguards and five-stage Advance reminders OFF remain binding. Do not apply migration0043 or promote traffic without separate scoped authorization.

## GFS-316 read-cost optimization protocol (2026-10-29)

- This work is local-only unless a separately approved, identity-verified release is performed. No Cloudflare dashboard, D1, Worker, traffic, flag, reminder, Meta, billing or customer mutation was made in this run; the official authenticated Cloudflare/Chrome diagnostic connections were not available here, so no live 534.3M attribution or savings claim is permitted.
- Local EXPLAIN evidence supports additive migration `0043_admin_cron_read_paths.sql`: indexed `(updated_at,id)` order cursors, outbound reconciliation keys, outbox due/status claims and recovery-stage due/status lookups. Never apply it remotely without the existing backup, identity, rollback and D1 integrity gates.
- Admin order data remains Access-protected and private/no-store. Unchanged Refresh may use only the bounded indexed change probe; detected changes require an authoritative reload. Full reload remains explicit. No global PII/payment caching, synthetic customer data, N+1 detail loading, or hidden polling is allowed.
- Cron delivery-status reconciliation must remain flag-gated and no-op aware. Recovery remains independently gated; +15/+210 accuracy, the new-number WhatsApp lock, Hoja Seeds zero-connection rule, payment/COD safeguards and five-stage Advance reminders OFF are unchanged.
- Report local query plans as local evidence only. Do not convert EXPLAIN output into Cloudflare `meta.rows_read`, account-wide TOP10 attribution, duration, or percentage savings without authenticated Analytics/Query Insights evidence.

## GFS-305 canary result (2026-10-29)

- The owner-authorized bounded canary used supported Cloudflare version splitting: API candidate `17598945`/baseline `45b01d86` at 1%/99%, then restored to 0%/100%; Admin candidate `76e33a3d`/baseline `f0212429` followed the same split and was restored to 0%/100%.
- The canary was sends-off. Health returned HTTP200, Admin CSV returned HTTP200, no errors were exposed, and D1 recovery counts remained stages 0/outbox 0/sent 0. No customer message, payment, order, COD or reminder mutation occurred.
- No candidate-attributed webhook, natural inbound, outbound WAMID or customer-visible reply was available. Cloudflare Workers Logs are disabled, so health cannot substitute for version attribution.
- Recovery activation remains prohibited: `PAYMENT_CHOICE_RECOVERY_ENABLED=false`, no start time, five-stage Advance flags false, and utility templates false. The single remaining owner action is to connect the previously authorized tester profile to the authenticated browser through the supported path for one attributable nonfinancial smoke.

## GFS-304 two-follow-up release decision (2026-10-29)

- Owner scope remains limited to the existing +15/+210 payment-choice recovery stages for new confirmed-but-no-method orders. Five-stage Advance reminders, general automation and utility templates remain disabled.
- The authenticated WhatsApp profile was searched for the previously authorized tester identity and matching conversation; none was available. The open chat is the GFS business-sender account. No inbound was sent, spoofed or inferred from display names.
- No Cloudflare traffic or flag mutation was performed. Frozen API `45b01d86` and Admin `f0212429` remain 100%; sends-off candidates remain 0%; recovery start time is unset.
- GFS-304 gates pass locally and read-only: four published internal EN/UR templates, real-state eligibility/idempotency, D1 integrity, full 318/318, build/lint, audit0 and rollback4/4. Live candidate acceptance and activation remain NO-GO pending the exact tester session.

## GFS-303 frozen baseline and two-stage recovery gate (2026-10-29)

- Read-only identity and binding verification: GitHub `gardenshop`, Cloudflare Get Free Seeds account `gisupp@gmail.com`, canonical GFS Meta, and D1 `getfreeseeds-staging` UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. Hoja/ThanNow resources were not accessed.
- Frozen production remains API `45b01d86-65ff-4573-b384-f6be433a83d7` at 100% with API rollback `8e670de8-4d89-427b-9fec-dad29dc33f3f`; Admin `f0212429-ead7-4653-aea9-2ef714c6b4b8` at 100% with Admin rollback `b4c45278-c7d6-49c5-824c-005afc991ffe`. Sends-off candidates remain API `17598945-4601-4068-bf8c-9c3223cc8dd8` and Admin `76e33a3d-e96a-4942-a4ec-31910c688c16`, both 0%.
- Production traffic, flags, D1, orders, payments, COD, Meta state and reminders were not mutated. All recovery flags remain false, including `PAYMENT_CHOICE_RECOVERY_ENABLED`; no activation start time is set. Five-stage Advance reminders remain paused and utility templates remain false.
- D1 read-only integrity after 0041/0042: `quick_check=ok`, zero foreign-key violations, recovery tables present, four PUBLISHED internal EN/UR stage rows, and zero recovery stage/outbox/outbound rows. No historical backlog was scheduled or sent.
- The authenticated WhatsApp browser is the GFS business-sender session, not the authorized tester profile. Do not use it as inbound test traffic. Candidate promotion and recovery activation remain blocked until the existing tester profile/connection is re-established or separately authorized through the supported path.
- Local full suite is 318/318, build/lint pass, rollback4/4 pass, and the timezone-sensitive order-date assertion now uses the canonical Karachi order-date helper. No customer data, WAMID, secret or raw provider payload is recorded.

## GFS-297 live routing release (2026-10-28)

- Root cause of GFS-296 live mismatch: CMS v9 was shared by both API versions, but the old API `d808a31c` remained at 100% and still generated legacy Advance/COD buttons. Corrected source was at 0%, so a health check and CMS text could not prove button logic.
- After identity verification and all local gates, candidate `45b01d86-65ff-4573-b384-f6be433a83d7` was promoted to 100%; `d808a31c` is retained at 0% rollback. The genuine authorized tester received the corrected `Confirm Order`/`Cancel Order` buttons and `CANCEL_ORDER` safely returned the no-order/no-payment response.
- No Confirm Order, payment method, COD confirmation, receipt, settlement, dispatch, or customer charge was performed. Production `COD_ROLLOUT_MODE=PUBLIC` has no protected test/hold path; live payment/COD acceptance must remain a separately authorized boundary.
- Automated full flow coverage remains authoritative for EN/UR, fertilizer variants, province quotes, payment methods, receipts, COD consent, retries, stale callbacks, Check Order, and idempotency. Reminders stay false/false/false; migrations0039/0040, signed webhook, Admin export, and financial safeguards remain protected.

## GFS-296 current operational state (2026-10-28)

- Cloudflare identity was reverified as `gisupp@gmail.com` in Get Free Seeds before the traffic restore. The authenticated GitHub/Meta accounts remain `gardenshop` and canonical GFS only; Hoja remains isolated.
- Source commit `6a70d52` separates REVIEW confirmation from payment choice, accepts `CONFIRM_ORDER`/`CANCEL_ORDER`, preserves legacy callbacks, and prevents Advance-method selection from rendering the Advance/COD choice again. Local full suite is 316/316, build/lint pass, and rollback4/4 pass against the verified existing legacy root.
- API candidate `45b01d86-65ff-4573-b384-f6be433a83d7` was staged and briefly canaried only through supported version splitting. The genuine tester reached the published CMS v9 one-total summary, but the observed button pair was the baseline `Advance Payment`/`Cash on Delivery` pair; candidate-specific `Confirm Order`/`Cancel Order` proof was not obtained.
- The canary was ended safely: API `d808a31c-ba40-4a02-b3c6-8c6de4cffecf` is restored to 100% and candidate `45b01d86` is 0%; Admin `b4c45278` remains 100%. No order, payment, COD conversion, dispatch, schema, or reminder mutation occurred.
- CMS REVIEW v9 remains published with confirmation/cancellation wording. Reminders remain `false/false/false`; no Meta templates, historical replay, or reminder WAMID/delivery claim is permitted. Do not promote the candidate until a new controlled canary proves the exact button sequence and inbound-to-reply correlation.

## GFS-295 verified summary release (2026-10-28)

- Exact phone-number checks confirmed the connected WhatsApp Web account is the previously authorized tester and the target conversation is the canonical GFS business sender. Keep both numbers and full WAMIDs out of source, tests, screenshots and documentation.
- Cloudflare `gisupp@gmail.com` / Get Free Seeds account was verified before each traffic mutation. API `d808a31c-ba40-4a02-b3c6-8c6de4cffecf` is active100%; prior healthy API `8e670de8-4d89-427b-9fec-dad29dc33f3f` is retained0% rollback. Admin `b4c45278-c7d6-49c5-824c-005afc991ffe` remains100%.
- A 25%, then 33%, reversible canary proved the version split behavior: candidate CONTACT rendered the new CMS summary while healthy-version CONTACT rendered the known old format. After promotion, both English and Urdu genuine tester journeys rendered one PKR500 total, dynamic fertilizer/delivery lines, Advance/COD buttons and no PKR125 in the initial message. Final Meta WAMIDs were persisted and READ.
- The test reused prior legitimate delivery responses, used only the customer-authorized unsubmitted CANCEL/START path, and created zero orders and zero payments. Do not click payment-method buttons in acceptance tests unless an order/payment mutation is separately authorized. Reminders remain false/false/false; qualified reconciliation remains Cron-only.
- Live Admin CSV remains HTTP200 with 18 columns and 154 quote-aware parsed active records at final verification. Preserve the export, migrations0039/0040, signed webhook, COD PKR125 consent and rollback.

## GFS-294 real WhatsApp test gate (2026-10-28)

- Preserve healthy API `8e670de8-4d89-427b-9fec-dad29dc33f3f`100%, candidate `d808a31c-ba40-4a02-b3c6-8c6de4cffecf`0%, Admin `b4c45278-c7d6-49c5-824c-005afc991ffe`100%, and export behavior. Reminder flags remain false/false/false.
- Cloudflare identity was reverified as `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; repository API config confirms staging D1 UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. No external mutation was performed.
- Candidate and active health both returned HTTP200. CMS REVIEW v8 readback remains bilingual with `{orderSummaryItems}`, `{deliveryFee}`, `{orderTotal}` and no raw HTML. Qualified reminder reconciliation remains Cron-only.
- WhatsApp Web is logged in with an app shell and composer, and canonical Meta Activity Log is authenticated, but the session has no identifiable GFS/tester conversation or authorized recipient. Do not guess a recipient, send fabricated traffic, canary blindly, or claim WAMID/rendered-summary acceptance. The exact remaining requirement is an owner-authorized tester identity/conversation or an authenticated test device opened to the GFS WhatsApp number.

## GFS-293 summary candidate acceptance hold (2026-10-28)

- Preserve Admin `b4c45278-c7d6-49c5-824c-005afc991ffe` at100% and its export contract; preserve healthy API `8e670de8-4d89-427b-9fec-dad29dc33f3f` at100% and candidate `d808a31c-ba40-4a02-b3c6-8c6de4cffecf` at0%. Reminders remain `false/false/false`.
- Candidate health returned HTTP200. Authenticated CMS readback confirmed `REVIEW` published version8 in EN/UR with only `{orderSummaryItems}`, `{deliveryFee}`, and `{orderTotal}` used by the summary path; no raw HTML was present. The source renders the dynamic quote/config summary and native payment buttons, with separate PKR125 COD consent.
- `syncPaymentReminderDeliveryStatuses()` uses qualified `m.status` and is called only by the scheduled handler; inbound webhook processing does not call reconciliation. Do not move it back onto customer webhooks.
- WhatsApp Web and canonical Meta Manager sessions were present, but no authorized tester interaction or genuine inbound-to-outbound Meta event was available. Do not canary, promote, fabricate WAMIDs, or claim the new summary is live. A supported guarded canary remains the only blocker.

## GFS-292 live export release and summary hold (2026-10-28)

- Cloudflare identity was reverified as `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` before each Admin upload/traffic mutation. Admin `b4c45278-c7d6-49c5-824c-005afc991ffe` is active100%; rollback `c2e87231-9d51-444e-b283-7ab18379280f` is0%. API healthy `8e670de8-4d89-427b-9fec-dad29dc33f3f` remains100%; candidate `d808a31c-ba40-4a02-b3c6-8c6de4cffecf` remains0%.
- Both Worker configs bind staging D1 `getfreeseeds-staging`, UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; CMS `REVIEW` published version8 read back bilingual with the three approved dynamic placeholders. No D1, payment, order, receipt, COD, Meta, or reminder mutation occurred.
- Live authenticated Admin `/orders` showed `Download Excel (CSV)`. `/api/orders/export` returned HTTP200 private CSV with 145 quote-aware parsed rows matching the unpaged filtered API total and 18 approved columns; filtered REVIEW/PENDING/PACKING totals 10/79/1 also matched. Embedded CSV newlines were parsed correctly rather than counted as records. Export remains authorization-protected and excludes secrets, receipts, QR data, WAMIDs and settlement evidence.
- The actual production Orders template was missing the button; the smallest template correction was promoted as Admin `b4c45278`. Do not promote the API summary candidate or claim new WhatsApp rendering without genuine authorized inbound-to-outbound Meta evidence/WAMID. Reminders remain `false/false/false`.

## GFS-291 Admin export and staged summary release (2026-10-28)

- Preserve healthy production: API `8e670de8-4d89-427b-9fec-dad29dc33f3f` and Admin `c2e87231-9d51-444e-b283-7ab18379280f` remain at100%; faulty API `7b662e0d-38ad-4f23-80b2-5c54e4ca64e6` remains0%. Reminders remain `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_AUTOMATION_V2_ENABLED=false`, and `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`.
- The existing CMS-backed Order Summary and dynamic quote/config rendering remain unchanged and are included in the staged API `d808a31c-ba40-4a02-b3c6-8c6de4cffecf` at0%. No CONTACT→REVIEW device proof, WAMID, customer message, order, payment, receipt, COD, or reminder mutation may be inferred from local tests.
- Admin `2b1609d5-588f-4bd0-97c3-50a8b6e1be03` adds only a protected Excel-compatible UTF-8 CSV export on `/api/orders/export` and a matching Orders button. It inherits Admin authorization and the exact Orders filters, uses keyset pagination in bounded 100-row reads, exports all matching rows once, and never includes secrets, receipts, QR data, WAMIDs, or settlement credentials.
- Export fields contain exactly the five customer-delivery fields (name, address, landmark, city, contact) plus the approved operational columns. CSV cells are quoted, formula-prefixed text is neutralized, Urdu and Pakistani leading-zero contacts are preserved, and responses are private/no-store.
- Cloudflare identity was verified as `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; both staged Workers bind only `getfreeseeds-staging` D1 UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. No live D1 migration or write was performed. Do not promote either candidate until authenticated genuine WhatsApp CONTACT→REVIEW acceptance and rollback proof are available.

## GFS-290 Admin-editable order summary (2026-10-28)

- Preserve the verified production baseline: API `8e670de8-4d89-427b-9fec-dad29dc33f3f` at100%, faulty `7b662e0d-38ad-4f23-80b2-5c54e4ca64e6` at0%, Admin `c2e87231-9d51-444e-b283-7ab18379280f` at100%, and reminder flags `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_AUTOMATION_V2_ENABLED=false`, `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`. Do not change traffic, schema, payments, webhooks, or reminder state without a new gate.
- Reuse the existing `REVIEW` CMS key. Published version8 is the bilingual dynamic Order Summary; only `{orderSummaryItems}`, `{deliveryFee}`, and `{orderTotal}` are permitted for this screen. Reject unknown placeholders and raw HTML before persistence.
- The API candidate `e914f77e-8f68-44aa-b0c4-7276742b4c75` and Admin candidate `783a9480-daa4-4e86-91e4-903044edcd77` were uploaded and assigned0% beside the healthy versions. Candidate health passed through the supported version override; no candidate promotion or customer message was performed without genuine device evidence.
- The first CONTACT→REVIEW message is one CMS-rendered summary with quote/config-derived item rows, delivery fee, and total, plus the existing Advance/COD buttons. COD confirmation remains a separate consent screen with the existing PKR125 safeguards. No reminders were enabled or sent.

## GFS-278 Orders and Reminder Audit Gate (2026-10-28)

- The authoritative checkout is `codex/gfs221-cod-compat-001` at the PR #11 line ending at `ba65684`; preserve unrelated V2 worktrees and the separate `internal_sequence` compatibility patch.
- The historical Orders failure was the D1 row-read limit against the old full-detail list projection, not missing `internal_sequence`. Keep the narrow indexed list projection, authoritative detail reads, structured JSON503 failure path, migrations0035-0038, and the existing Admin/API releases.
- Read-only identity was verified in the official Cloudflare dashboard as `gisupp@gmail.com` in the Get Free Seeds account and in Meta WhatsApp Manager as the canonical Get Free Seeds WABA. Hoja and ThanNow resources remain out of scope.
- This V1-compatible PR has no payment-reminder engine, reminder outbox kind, Cron schedule, or approved out-of-window reminder template. Do not send reminders through WhatsApp Web, fabricate WAMIDs, or enable/broadcast automation; only a supported, independently authorized implementation may do so.
- GitHub browser access is logged out and the stored `gardenshop` CLI token is invalid. Do not push or mutate PR state until `gardenshop` authentication is restored through a supported path.

## GFS-270 Local EXPLAIN Gate (2026-10-27)

- Migration0037 remains additive and local until post-reset recovery bookmark, integrity, identity, and 0%-traffic gates pass. It now covers audit, receipt, outbox, order pagination, customer WhatsApp lookup, and customer-order ordering indexes.
- Local EXPLAIN must show bounded/indexed plans before deployment. Production rows_read AFTER remains unclaimed until the optimized Worker is live; do not substitute local plans for live D1 metadata.
- Preserve the existing GFS-268/269 repair and push history. No duplicated query rewrite, bulk migration replay, payment/customer mutation, test-hold release, Meta action, or Hoja resource is permitted.

## GFS-269 D1 Recovery and Query Optimization Gate (2026-10-27)

- Cloudflare D1 remains over the Free-tier daily read budget: 8.06M/5M rows read. Do not run production SQL, repeatedly refresh Admin, replay migrations, delete/recreate databases, change billing, or promote traffic until reset or explicit owner-approved capacity action.
- GFS-268 commit `fca32a3` is the complete local repair and is exactly one commit ahead of remote `7724e7a`; do not duplicate or overwrite it. Migration `0037` is additive and must be rehearsed and applied only as a targeted migration after a recovery bookmark and identity gate.
- After reset, require authenticated 0%-traffic smoke for Orders real counts/pagination, Payment Settings, detail/receipts, payment review and COD fulfillment before any Admin promotion. Keep financial approval state fresh; quota errors must remain structured JSON503 and never become zero counts or success.
- GitHub push requires authenticated `gardenshop/freeseeds` credentials. An invalid stored CLI token or logged-out browser is not authorization; request owner reauthentication only and never expose or bypass credentials.

## GFS-268 D1 Quota and Admin Restore Rules (2026-10-27)

- Cloudflare D1 is currently over the Free-tier daily row-read limit: 8M/5M rows read today. Do not repeat live D1 probes until the 00:00 UTC reset or an owner-approved capacity change.
- The measured hot query is the old Admin full-detail order projection: about 3.29M rows read across 77 calls, about 1.71k rows read per returned row. Admin list reads must use a narrow projection, one aggregate count scan, bounded pagination, and indexed entity lookups; financial detail remains fresh and authoritative.
- Any D1 quota/read failure must fail closed with structured JSON HTTP503. Never return zero counts, an empty order list, a fake receipt, stale approval state, false PAID, duplicate confirmation, or a successful customer-order response.
- GFS-268 local candidate `92955132-6917-4cad-895e-d2b89e56d9dd` remains staged at0% until quota recovery and authenticated list/detail/receipt/Payment Settings/approval/COD smoke pass. Active Admin `cd155f20-c848-4e4e-9fde-970e62b0a4ea` remains100%; API `24d72438-...` remains100% until its own gate is complete.
- No Cloudflare billing, D1 database, schema application, traffic, customer, payment, receipt, COD hold, Meta, or secret mutation is permitted while the quota blocker is unresolved. Verify visible `gisupp@gmail.com` / Get Free Seeds identity before every future external mutation and record the result.

## GFS-261 Mobile Validation and Receipt Media Protocol (2026-10-27)

- The protected release preserves PUBLIC COD, audited PKR125, all three Advance methods, signed callback, D1/R2/Queue bindings, history, and COD-off rollback. No migration was run.
- New delivery contact input accepts only `03XXXXXXXXX` or `03XX-XXXXXXX` via `^03[0-9]{2}-?[0-9]{7}$`; accepted values store as 11 digits. Meta `wa_id` and historical contacts are unchanged.
- Receipt media supports standalone, payment-reply, unrelated-reply, forwarded/shared, and supported image-document inputs. Association is trusted-reply or unique eligible sender only; ambiguity fails closed. Media is type/size checked, private, deduplicated by provider media ID, and remains REVIEW/PENDING until Admin verifies credit. COD, paid, and unrelated orders are excluded.
- Official Chrome DevTools MCP and authenticated GFS dashboard identity were verified before deployment. Do not use unrelated WhatsApp Web, fabricate inbound events, expose secrets, or print customer identifiers.
- API `428defd5-e7aa-4800-b001-976f403c735e` is active100%; Admin `615e1156-2747-457a-8623-11d1e967f911` remains active100%; rollback `2500e268-8985-4fd4-a141-68633f16315d` remains retained. `COD_V1_ENABLED=true`, `COD_ROLLOUT_MODE=PUBLIC`.
- Gates pass: 287/287 tests, build, lint, audit0, rollback4/4; API health200, unsigned webhook403, Admin health200 with `paymentConfigured=true`.
- A real receipt upload was not performed because no authorized customer-device action was available. Keep PUBLIC COD healthy; do not claim live receipt acceptance or create synthetic WAMIDs/orders. Remaining action: one authorized standalone receipt and one authorized replied receipt.

## GFS-260 Post-Launch Verification (2026-10-27)

- Read-only post-launch inspection found no new non-tester or other customer interaction after PUBLIC promotion. Do not solicit one, reset state, or disable the healthy release; public customer observation remains pending.
- Active API `089f5671-2c2b-48cb-8373-b273e28f4177` remains100%; API health200; Admin health200 with `paymentConfigured=true`; prior TESTER_ONLY API remains0%; COD-OFF rollback remains protected.
- D1 `quick_check=ok`; COD rows remain `COD_PENDING`; recent webhook records are received/sent. Recent outbox failures are pre-launch known Meta400 events; no post-launch outbox failure was observed.

## GFS-259 Authorized PUBLIC COD Release (2026-10-27)

- New genuine tester evidence is independently confirmed in Admin/D1: one latest order is `COD_PENDING` with quoted total PKR675, base PKR550, exactly one PKR125 COD fee, one confirmation audit, zero receipts, no approved amount, and `test_hold=1`. Historical orders remain preserved.
- Admin payment health is HTTP200 with `paymentConfigured=true`; JazzCash, Easypaisa, and Bank Transfer are enabled with protected QR/instruction surfaces. COD intake is enabled in D1 and confirmation never marks COD paid.
- Fresh PUBLIC-mode API `089f5671-2c2b-48cb-8373-b273e28f4177` passed 0%-traffic health200/unsigned403 smoke and is active100%. Repaired TESTER_ONLY API `4d218abf-7262-4d04-b8a3-3baa6fae1879` is0%; Admin `615e1156-2747-457a-8623-11d1e967f911` remains100%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback.
- Owner-authorized PUBLIC promotion is complete with `COD_V1_ENABLED=true`, rollout `PUBLIC`, audited PKR125, original signed callback/bindings, and no migration replay. The genuine acceptance evidence predates the final traffic switch; no unsolicited post-switch customer message was sent.

## GFS-258 Live Retry Gate (2026-10-27)

- Official MCP/Admin readback found no new tester-originated inbound after the repaired deployment. The preserved conversation remains `REVIEW` with the same single unpaid, receipt-free pending order; no reset or replacement order is permitted.
- API `4d218abf-7262-4d04-b8a3-3baa6fae1879` remains100% TESTER_ONLY; Admin `615e1156-2747-457a-8623-11d1e967f911` remains100%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback. Active API health is200 and unsigned webhook rejection remains enforced.
- PUBLIC remains fail-closed. The only missing evidence is one genuine tap of the existing Place Order button by the approved tester from the authenticated device; do not use unrelated WhatsApp Web or fabricate inbound events.

## GFS-257 Review-to-Payment Repair (2026-10-27)

- The fresh Place Order inbound was genuine and signed: it was received at the reported time, persisted as one new `DETAILS_COMPLETED`/`PENDING` order, and left the conversation in `REVIEW` after the outbound reply failed. The provider response was Meta HTTP400 (`META_MESSAGE_SEND_400`), not a missing inbound.
- Root cause was the COD reply-button title exceeding Meta's 20-character reply-button limit. The payment notice still contains the bilingual PKR125 COD text; the actual reply button is the valid short label `Cash on Delivery`.
- Added a narrow retry path that reuses the exact matching recent unpaid, receipt-free pending order on a genuine second Place Order tap. It fails closed on identity, form, province, quote, state, age, or payment mismatches and cannot reuse paid/COD/receipt orders.
- Published Review content is version 6 with English and Urdu text/actions consistently saying Place Order. No migration or payment-history mutation occurred.
- Fresh API `4d218abf-7262-4d04-b8a3-3baa6fae1879` passed 0%-traffic health200/unsigned-webhook403 smoke, then became active at100% in TESTER_ONLY. API `a5722925-650c-42db-bc75-a8c3242e8a4b` is0%; Admin `615e1156-2747-457a-8623-11d1e967f911` remains100%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback.
- Official Admin Test Controls still shows the same single pending order and `REVIEW`; no duplicate, receipt, method, or PAID state exists. PUBLIC was not changed. The sole remaining live action is one tap by the approved tester on the existing Place Order button from the authenticated device; never fabricate or replay the inbound.

## GFS-254 Final Public Gate (2026-10-27)

- Current Admin Test Controls still shows the prior genuine Advance interaction in `PAYMENT_REFERENCE`; its latest order is `PAYMENT_REVIEW`/`PENDING` with JazzCash, one receipt and no approval/PAID. No newer tester-originated inbound exists after the GFS-253 copy deployment.
- Read-only identity/runtime checks pass: Wrangler is `gisupp@gmail.com` on Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; API health200/unsigned403; Admin health200/`paymentConfigured=true`; audited COD enabled with PKR125.
- Active API `a5722925-650c-42db-bc75-a8c3242e8a4b` remains100% TESTER_ONLY; Admin `615e1156-2747-457a-8623-11d1e967f911` remains100%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback. PUBLIC was not mutated.
- Do not claim the new EN/UR copy visually live, all three Advance methods, or COD-to-Advance post-deploy acceptance until the approved tester performs one fresh authenticated journey. No fabricated inbound, receipt, funds, PAID state or public customer order is allowed.

## GFS-253 Payment-Choice Copy / Controlled Runtime (2026-10-27)

- Payment-selection copy now uses the required short EN/UR wording and exactly two COD-capable buttons: Advance Payment and Cash on Delivery (COD). Business logic, order flow, fee policy and receipts were unchanged.
- Focused78/78 and full282/282 pass; build, lint, offline audit and rollback4/4 pass. The text-only API candidate `a5722925-650c-42db-bc75-a8c3242e8a4b` passed health200/unsigned403 at0% and is active100% in TESTER_ONLY. Prior API `ba15b8ba-e3b3-4581-9b23-c2e688797132` is0%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback.
- A newer genuine tester Advance interaction is privately evidenced at PAYMENT_REVIEW/PENDING with JazzCash and one submitted receipt; no approval or PAID transition occurred. It predates the new copy deployment, so it is not claimed as post-deploy text proof or all-method post-deploy acceptance.
- PUBLIC remains fail-closed until the authorized tester produces a fresh post-deploy payment-selection observation, confirms the three Advance methods/instructions and tests COD-to-Advance before confirmation. Do not fabricate messages or use an unrelated Web profile.

## GFS-252 Final Advance Gate (2026-10-27)

- Official Chrome MCP and authenticated Admin/Cloudflare access remain callable. Test Controls shows the approved conversation still in `COD_PENDING` with no newer tester continuation; no unrelated WhatsApp Web profile was used.
- Read-only runtime checks pass: Admin health200 with `paymentConfigured=true`; audited COD enabled with PKR125; active staged API `ba15b8ba-e3b3-4581-9b23-c2e688797132` remains100% `TESTER_ONLY`; Admin `615e1156-2747-457a-8623-11d1e967f911` remains100%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` remains rollback.
- PUBLIC is still fail-closed. Do not switch rollout mode until a genuine fresh authenticated tester journey verifies all three Advance methods/instructions and COD-to-Advance before confirmation. No inbound, payment, receipt, PAID or order was fabricated.
- Required owner/tester action is one new authenticated-device journey; after it, rerun the existing public eligibility, signed callback, D1 integrity and rollback gates. Preserve all prior COD evidence and customer history.

## GFS-251 Public Launch Gate (2026-10-27)

- Read-only identity/runtime verification PASS: official Chrome MCP is callable; Cloudflare shows `gisupp@gmail.com` on the GFS account; authenticated Admin health is200 with `paymentConfigured=true`; COD policy is enabled with audited PKR125; API health is200 and unsigned webhook rejection is403.
- Current controlled staging remains API `ba15b8ba-e3b3-4581-9b23-c2e688797132` at100% in `TESTER_ONLY`, prior TESTER_ONLY at0%, Admin `615e1156-2747-457a-8623-11d1e967f911` at100%, and COD-OFF version `2500e268-8985-4fd4-a141-68633f16315d` retained for rollback. No PUBLIC mutation occurred.
- P1 is blocked only on a fresh genuine authorized tester Advance journey and pre-confirmation COD-to-Advance switch from the tester's authenticated WhatsApp device. Do not simulate inbound messages, use the unrelated Web profile, or promote PUBLIC without that evidence.
- Required tester action: initiate a new authenticated WhatsApp journey, verify the seeds-first EN/UR quote and all three existing Advance methods/instructions without fabricating payment, test COD-to-Advance before confirmation, and provide the private runtime evidence. Then re-run the final public eligibility check.

## GFS-250 Polished COD Acceptance (2026-10-27)

- Independent read-only D1/Admin verification confirms one target order (identifier masked) in `COD_PENDING`, one COD detail row and one confirmation audit. The audited COD fee is PKR125 once; exact customer-order amounts are retained only in private evidence and are not persisted here.
- Genuine inbound/outbound WhatsApp WAMIDs were verified privately for the authorized tester and are intentionally masked and excluded from source, logs and documentation. No duplicate order was created for evidence; historical records remain preserved.
- Polished API `ba15b8ba-e3b3-4581-9b23-c2e688797132` is active100% in `TESTER_ONLY`; prior API `64594da5-6a97-4167-835f-cbd5987bd876` is0%. COD-OFF API `2500e268-8985-4fd4-a141-68633f16315d` remains a protected versioned rollback target. Admin `615e1156-2747-457a-8623-11d1e967f911` remains active100%; Admin v82 is retained.
- COD summaries are dynamic, seeds-first and contain item price, D1 delivery fee, PKR125 COD fee and prominent total. COD status text is customer-facing only; stale Advance buttons cannot mutate a confirmed COD order. Local 282/282, build, lint, offline audit and rollback4/4 pass.
- TESTER_ONLY acceptance is not public acceptance. PUBLIC remains disabled until a live polished Advance regression, security/rollback gates and the owner-authorized public promotion are verified. Keep DO NOT SHIP and do not collect cash.

## GFS-249 Controlled TESTER_ONLY Activation (2026-10-27)

- Cloudflare identity was reverified in the official dashboard as `gisupp@gmail.com` on the GFS account before each Worker mutation. No Hoja resource, raw CDP, account switch, Version URL, or public-production change was used.
- The protected tester secret was entered through supported Wrangler secret controls. Its value is never recorded. Wrangler unexpectedly auto-promoted the secret-update version once; it was immediately restored to0% and a fresh current-HEAD version was uploaded with the secret inherited and all original secrets/bindings preserved.
- Current staging API `64594da5-6a97-4167-835f-cbd5987bd876` is active100% in `TESTER_ONLY` mode with the independent COD flag enabled; COD-OFF API `2500e268-8985-4fd4-a141-68633f16315d` remains0% as rollback. Admin `615e1156-2747-457a-8623-11d1e967f911` is active100%; Admin v82 remains retained as rollback. Public mode is untouched.
- Audited D1 COD policy is enabled with fixed fee PKR125 and a revision. Read-only verification shows 53 historical orders/payments preserved, zero COD sidecar rows before acceptance, and the latest conversation has a genuine inbound event in `LANGUAGE` state. Do not fabricate the next reply or access an unrelated WhatsApp Web profile.
- TESTER_ONLY acceptance is not public acceptance. Keep DO NOT SHIP enforced. Public mode requires the complete new journey, same-order COD_PENDING evidence, Advance regression, rollback and separate public-release authorization.

## GFS-248 Three-State COD Rollout and Protected-Secret Stop (2026-10-27)

- COD admission is now explicitly `OFF`, `TESTER_ONLY`, or `PUBLIC`. `COD_V1_ENABLED=true` is still required. Unknown/missing modes fail closed; `TESTER_ONLY` additionally requires an exact normalized match to protected `COD_TESTER_WA_ID`; `PUBLIC` is permitted only after genuine tester acceptance and release gates pass.
- Fresh current-HEAD versions were uploaded and staged at0% only: API `83e82edf-1921-4180-b10d-da5ca83f807e` with COD flag false/mode OFF beside v90 at100%; Admin `615e1156-2747-457a-8623-11d1e967f911` beside v82 at100%. Never promote stale API `48d4c590…`.
- Version-targeted smoke passes API health200/unsigned webhook403 and authenticated Admin health200/`paymentConfigured=true`; Admin candidate reads COD disabled/fee125. Original D1 remains healthy with COD0030, 53 orders/payments, zero COD rows, quick-check ok and FK0.
- Protected tester-secret provisioning stopped because copying a real customer identifier through system clipboard was rejected by the execution safety boundary. Do not bypass it or select among the two historical cooldown exemptions. Owner must enter the approved value directly in supported Cloudflare secret controls or provide an approved secure-input path.
- Keep originals100%, candidates0%, D1 COD disabled/unconfigured, Worker COD OFF and public release blocked. A privacy-preserving aggregate saw one recent inbound across two exemption records, but this does not prove the approved replacement tester; no WAMID/order acceptance claim.

## GFS-247 Tester-Only COD Admission (2026-10-27)

- COD admission now requires all of: `COD_V1_ENABLED=true`, the audited D1 COD policy, and an exact normalized match between the inbound WhatsApp identity and the protected runtime secret `COD_TESTER_WA_ID`. A missing or malformed secret fails closed. `ADMIN_TEST_EXEMPTION` remains cooldown-only and is not an admission grant.
- The tester identity is intentionally absent from source, tests, logs and documentation. Provisioning the protected secret requires the owner-authorized identity check and supported Cloudflare secret controls; do not expose or print its value.
- Local focused coverage passes normalization, non-tester Advance-only behavior and missing-secret fail-closed behavior. Full regression/build/lint/offline audit pass. No live flag, secret, traffic, D1, Meta, customer, WAMID or order mutation was made.
- Preserve API v90/Admin v82 at100%, candidates at0%, COD OFF and DO NOT SHIP until exact controlled staging-promotion/COD activation authorization, live signed callback, running Advance checkout and tester-originated inbound are complete. Public production remains separately unauthorized.

## GFS-246 Final Staging Readiness / Real COD Test (2026-10-27)

- Preserve GFS-245: the approved tester already exists as `ADMIN_TEST_EXEMPTION`; do not register/reset again. The customer's own authenticated WhatsApp device must initiate the next real inbound. Never use the unrelated WhatsApp Web owner profile or fabricate a customer WAMID.
- Read-only Wrangler confirms the GFS account `gisupp@gmail.com` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; candidate dry-runs resolve the existing staging D1/R2/Queue bindings. Deployment history still shows API v90 at100% with candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` at0%, and Admin v82 at100% with candidate `091f1a3f-595b-4530-b54a-d7253af60664` at0%. This is CLI evidence, not authenticated browser identity/release approval.
- Full local276/276, focused signed-webhook/Advance/COD100/100, build, lint, production audit0, and actual unchanged V1-source COD-compatible rollback harness4/4 pass. The focused signed event is synthetic local HMAC coverage, not live callback acceptance. Existing GFS-242 D1 `quick_check=ok`/FK0/COD0030 evidence is reused; no repeat migration or D1 write.
- Static review confirms COD admission is **not tester-restricted**: `COD_V1_ENABLED` plus global audited COD configuration and enabled province eligibility govern all customers. `ADMIN_TEST_EXEMPTION` is only an order-cooldown exception. Do not enable COD globally until required runtime gates are complete and explicit staging-traffic authorization is confirmed.
- The current execution has no callable official Chrome DevTools MCP actions or approved tester messaging channel. No browser dashboard mutation, signed live callback, running Advance customer checkout, traffic promotion, COD flag change, message, order, WAMID or screenshot occurred. Keep API/Admin originals at100%, candidates at0%, COD OFF and DO NOT SHIP. Production/public promotion requires separate authorization.

## GFS-245 Approved Tester Registration (2026-10-27)

- Owner explicitly approved the replacement customer tester. Admin Test Controls already contains the exact normalized customer entry as an `ADMIN_TEST_EXEMPTION`; no duplicate add or registration mutation was needed. Existing order/history remains untouched.
- Canonical Meta Phone Manager remains the source of truth for the GFS business sender. The unrelated WhatsApp Web owner profile remains excluded; no QR relink, account switch, OTP handling or impersonation.
- The tester's own authenticated WhatsApp device must initiate the first inbound message. Do not simulate inbound activity. COD activation, promotion and live acceptance remain held until that message and the remaining signed/Advance gates are observed.

## GFS-244 Tester Resolution Stop (2026-10-27)

- Official Chrome DevTools MCP, Admin Test Controls, canonical Meta Phone Manager and Cloudflare identity remained available. Cloudflare showed `gisupp@gmail.com` on the GFS account; no mutation was made.
- Admin still matches the supplied customer to the registered tester and Meta still shows the supplied receiver as the connected canonical GFS sender. The only available WhatsApp Web owner profile matches neither. Do not account-switch, substitute, register, message or reset.
- API candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` and Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` remain0%; API v90/Admin v82 remain100%; COD remains disabled. Live signed/Advance/COD gates cannot be honestly completed without the registered tester device or explicit owner-approved replacement identity.

## GFS-243 Tester Verification Gate (2026-10-27)

- Official Chrome DevTools MCP remained callable in the authenticated native session. Cloudflare identity was verified as `gisupp@gmail.com` on the GFS account before any prospective mutation; none was made.
- Admin Test Controls privately matched the supplied customer to the existing registered tester entry. Meta Phone Manager privately matched the supplied receiver to the connected canonical GFS sender asset. No phone identifiers are recorded here.
- The available WhatsApp Web owner profile matched neither supplied identity. Do not substitute it, switch accounts, alter registration, or send. COD activation and candidate promotion remain held.
- API candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` and Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` remain at0%; original API v90/Admin v82 remain100%. Candidate health remains API200 and Admin200/`paymentConfigured=true`.

## GFS-242 Authorized COD0030 Migration and Tester Gate (2026-10-27)

- Owner authorized staging-only application of exactly `migrations/0030_cod_v1_compat.sql`. Checksum `72d1c00c4c3bfeabc391f538530c2bc974a60d37ab33f01b5ba672253ec052db` matched. Fresh Time Travel bookmark was recorded before mutation; preflight schema/integrity passed. Remote execution wrote only the reviewed sidecar objects/marker and never invoked legacy migration apply.
- Post-migration checks pass: marker `0030`, default COD fee `125`, COD disabled, zero COD orders, unchanged 52 orders/payments, `quick_check=ok`, no foreign-key violations. Latest post-migration bookmark is `00000273-0000000a-00005110-25b2fce4a4bba26a177e0f2fadd7a452`.
- The first post-migration Admin health request returned false because the existing Admin candidate was no longer in the current deployment after its prior original-only restore; payment eligibility itself remained valid for all three methods. Repair: re-staged existing Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` at0% beside v82 at100%; version-override health then returned HTTP200 `paymentConfigured=true`.
- API candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` remains COD-OFF at0% beside API v90 at100%, with health200 and unsigned webhook403. Do not promote or enable COD until verified running Advance/signed callback/rollback gates and private tester identity pass.
- Owner-controlled tester identity remains unresolved. Do not infer a replacement, edit registration, switch accounts or message the mismatched profile. Preserve DO NOT SHIP and all existing orders/history.

## GFS-241 COD-OFF Staging and Authorization Stop (2026-10-27)

- Native official Chrome MCP remains callable in the approved session. Cloudflare dashboard identity is verified as `gisupp@gmail.com` on GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; canonical GFS Meta assets only. No Hoja resource, account switch, raw CDP or tester substitution.
- API candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` is staged at0% beside API v90 `21a3d74c-3979-432c-9190-1848362592a4` at100%, with `COD_V1_ENABLED=false`. Candidate health HTTP200 and unsigned webhook HTTP403 passed through the supported version override. Existing Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` remains0% beside Admin v82 at100%; no real customer traffic was routed to candidates.
- Full276/276, build, lint, offline audit, targeted COD/recovery checks and intake-OFF rollback4/4 pass. No code repair was required. Original D1, customers, receipts, callback, advance methods and history remain protected.
- The reviewed `0030_cod_v1_compat.sql` checksum/evidence is ready but remains unapplied. Do not run Wrangler's legacy ledger or replay 0001–0030. Before any remote 0030 mutation, obtain explicit approval for exactly that single original-D1 migration plus its backup/recovery protocol. Before any candidate promotion or `COD_V1_ENABLED=true`, obtain explicit staging traffic approval. P4 still requires the registered tester session or explicit authorization and identity for a genuine owner-controlled replacement tester.

## GFS-240 Chrome Bridge Recovery and Admin Health Smoke (2026-10-27)

- The native approved Codex session recovered the official `chrome-devtools` MCP after the earlier transport-closed state. In that same session, `list_pages` succeeded and authenticated snapshots succeeded for Admin Test Controls and the Cloudflare Worker dashboard. Cloudflare showed `gisupp@gmail.com`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, the Get Free Seeds Admin Worker and its existing Access protection. No raw CDP, Kilo host, account switch, alternate profile or security bypass was used.
- Before the approved mutation, Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` was uploaded and deployed at `0%` with original Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` at `100%`. The supported Cloudflare `Cloudflare-Workers-Version-Overrides` header was used from the authenticated Admin tab; `/health` returned HTTP200 and aggregate `paymentConfigured=true`. Version URLs remained disabled and no D1/customer/payment write occurred.
- Cloudflare identity was reverified immediately before restoration. Admin v82 was restored alone at100%; read-only deployment history confirms the candidate remains at0% and original-only is active. Preserve this protocol: inventory and identity first, candidate at0%, version override only, no customer-path writes, immediate original-only restore and deployment verification.
- P2/P4 remain gated: original D1/COD0030 evidence and local behavior checks pass, but no live signed customer callback, Advance customer checkout, COD enablement, registered tester match, WAMID, COD_PENDING order or production promotion is claimed. COD remains disabled and the original D1 migration ledger remains untouched.

## GFS-238 Admin Smoke Platform Stop (2026-10-27)

- PR #11 remains `codex/gfs221-cod-compat-001` at `ed657d538721029c1e49541e5799166a8d62003f`; source fix `2221f0c` is present. The official Codex 0.164.0 host config under `CODEX_HOME=D:\AI-Tools\Codex\home` has one enabled `chrome-devtools` registration, but this Kilo session exposes no callable Chrome MCP tools. A requested `gpt-5.6` Codex CLI launch was rejected by the ChatGPT-backed host before MCP initialization; a configured-model approved session did not reach `list_pages` and was stopped without browser/cloud action. Do not claim inventory, identity, or Admin health evidence from this.
- The already approved Admin 0%-traffic test is blocked before upload. Do not deploy a version, change Version URL settings, or request `/health` until an approved Codex session exposes official `list_pages`, reuses the existing authenticated tabs, and visibly verifies `gisupp@gmail.com` plus GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` and the existing Admin Access protection. Then run only the narrowly approved Admin test, keep v82 at100%, require aggregate `paymentConfigured=true`, and restore/verify old-only v82 at100%. No API/D1/Meta/WhatsApp/customer/payment mutation is included.
- GFS-237's independently verified stored eligible payment configuration and diagnostic-only health repair remain authoritative. Do not restore or edit recipient, QR, fixed advance, ownership, or payment settings because live health has not yet been rechecked. COD0030 remains unapplied to original D1; COD remains unenabled; no genuine WhatsApp order/WAMID is evidenced. Preserve the registered-tester mismatch stop and production separate authorization.

## GFS-237 Payment Health Repair and Approved Compatibility Alternative (2026-10-26)

- **Correct GFS-236's inference:** `paymentConfigured=false` did NOT establish broken destinations or a need to restore a fixed advance. Boolean-only original-D1 diagnostics: fixed row present, positive fixed amount0, old health predicate0; all three JAZZCASH/EASYPAISA/BANK_TRANSFER enabled, recipient present, QR-owner approved, current independently approved provenance, EN/UR copy and required placeholders pass. No recipient, QR payload/key/hash/evidence reference, amount, customer or receipt data was output. No payment settings or ownership changed.
- The faulty health predicate is identical at PR10 `cf01f44` and PR11, introduced in `8c882a4` before PR11. It incorrectly couples configuration readiness to legacy fixed `advance_amount_pkr`, while guided checkout uses persisted positive order totals. It also misses blank strings, QR provenance and locale requirements. Considered absent recipients/disabled methods, ownership/QR, locale/placeholders, wrong binding/version and PR11 regression; stored eligibility and Git history support a pre-existing diagnostic bug, not PR11 payment regression. Current active HTTP health comparison could not run because approved MCP lacked callable `list_pages`; do not claim otherwise.
- User confirmed the minimal repair. Source commit `2221f0c52886a45c2610e50c129ac470616fb5e7`: Admin health calls existing verified method helper for both EN/UR without a fixed amount; helper's existing callers retain English-default behavior and explicit per-order amount validation. `paymentConfigured` means at least ONE same-method bilingual eligible configuration, NOT all three, R2 integrity/delivery, funds, PAID, or public readiness. Checkout/recipient/QR/receipt/ownership gates unchanged.
- New32 synthetic in-memory tests reproduced26 failures before repair and all pass after;145 focused/full276/build/lint/audit0/V1 harness4 pass. Tests include missing/stale provenance, ownership/evidence, same-method locale completeness, fixed NULL/absent row, ANY-method semantics, invalid explicit amounts, DB-unbound false, Access-before-query, aggregate-only response and no writes/R2 access. No genuine payment/receipt was fabricated.
- **Explicit user-approved replacement for GFS-235 exact-SHA gate:** staging-only compatibility may use pinned v90/v82 IDs/ETags, preserved bindings/secrets/callback/history, current D1 integrity/recovery/reviewed COD checksum, full and protected-path tests, isolated COD proof, version-specific0% smoke, running Advance/valid signed callback and COD-compatible intake-OFF rollback before admission. Historical source SHA remains unknown, but is no longer a standalone blocker if all equivalent checks pass. This does not waive tester/ownership/financial checks or promote traffic/apply schema by itself. Production still separate.
- Separately approved repaired Admin0% smoke required official MCP inventory + exact Access identity + preview safety BEFORE upload. It stopped at unavailable `list_pages`; no upload, deployment, setting or browser action. No new candidate version exists. Keep API v90 `21a3d74c-3979-432c-9190-1848362592a4` and Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` sole100%; existing v91/v83 remain prior unpromoted artifacts. Repaired health is not deployed.
- Original D1 current quick_check ok/FK0; historical ledger0; COD schema absent; reviewed0030 unchanged. Time Travel bookmark available, no restore. Diagnostics issue SELECT only: file mode first returned execution-summary only (rows_written0; Wrangler import metadata reported changed_db true), then command mode returned redacted booleans with changed_db false/rows_written0. No application row/schema, financial history or migration-marker write. Do not use file-import summaries as query results.
- Prior exact WhatsApp tester mismatch remains; not retried, no substitute/relink/registration edit, chat or message. Required owner action is the existing registered tester-controlled session; official MCP tool exposure is also required for private verification/runtime smoke. No WAMID/live order/Admin COD_PENDING/screenshot/shipment/cash/PAID.
- Diagnostic D1 remains unbound; approved cleanup review2026-10-28T12:00Z is still scheduled, dependency checks mandatory. No Hoja, active callback, customer history, frozen V1, PR#9/#10 or image change. Keep live acceptance NO-GO until remaining gates pass.

## GFS-236 Authorized 0%-Traffic Version Smoke (2026-10-26)

- User explicitly approved a no-traffic PR11 version smoke: upload API/Admin COD-off candidates, deploy each at0% with original v90/v82 at100%, disable only public Version URLs, test existing URLs via version override, no D1/order/payment/customer writes, no Meta changes, then restore original-only deployments. Before each mutation `wrangler whoami` verified `gisupp@gmail.com` / GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- Uploaded API v91 `6db59e0d-0ab5-4535-8937-f7cf9100032b` ETag `cc6a6ebf6e97de0c5b55edd09f10732fe98796ccb99308e8e846a1835515a219`, `COD_V1_ENABLED=false`; Admin v83 `d9eff614-00a8-4ea7-a9f0-45f7c9df6b4e` ETag `9a218d21e06fb7e6d4e6f9d4cd13d5e112331807b6106b8b9d7265901a4db5b1`. Version URLs were disabled in Cloudflare UI for both; ordinary workers.dev stayed enabled and Admin Access policy remained present. A version metadata `has_preview:true` marker remains, but the Dashboard route toggle was off; no preview URL was visited.
- 0%-traffic version override smoke: API v91 `/health` HTTP200 (`getfreeseeds-api`, WhatsApp enabled); unsigned `/webhooks/whatsapp` POST HTTP403 `Forbidden`. Admin v83 was reached only on existing Access-protected URL after `list_pages`; Access email matched. `/health` returned HTTP200, `ok:true`, `paymentConfigured:false` (aggregate only). No customer/payment details. This means candidate cannot yet verify the required three Advance methods/amount; do not promote it or enable COD until verified config is restored.
- Restored API v90 `21a3d74c-3979-432c-9190-1848362592a4` alone at100%, deployment `9cc279f1-dc6d-463b-9047-8311d1229945`; Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` alone at100%, deployment `cbc4233d-9100-45cf-aa8e-7f42eb44e982`. Candidate v91/v83 remain in history but no current traffic; version URLs off. Public API health200. No source/D1/Meta/secret/schema write; COD0030 unapplied.
- One later fresh Admin identity-only check did not match, so no health request followed; no switch/retry. Prior successful v83 Access health check stands. Prior own WhatsApp Profile/tester mismatch remains; no sender, chat, message, order, WAMID or screenshot. Stop live acceptance.
- Full244, targeted128, build/lint/audit0, old-source harness4/4. This is runtime smoke, not valid signed callback, Advance checkout, D1 order persistence, COD activation, source-parity proof, or rollback after COD obligations. Keep current release NO-GO.

## GFS-235 Source Provenance and Live Tester Gate (2026-10-26)

- GFS-234 D1 evidence remains current: bounded original SELECT/schema/quick/FK pass; COD0030 remains unapplied there. Clean synthetic DB remains unbound and scheduled for review Oct28. Do not reopen historical API7403 investigation absent a new failure.
- Active Cloudflare history: API v90 `21a3d74c-3979-432c-9190-1848362592a4` (etag `0a306eaaeb2b40b236cec7cfdbab4ae07baee5abb9aaaf47f73f040d9995bb02`) 100% since `2026-10-24T12:47:42Z`; Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` (etag `ba0f365047e5e3568260b4b6d25f15ad4cc032f1b2962b16c8c11134e0ed1c43`) 100% since `12:55:05Z`. Both dates precede PR10 base commit `cf01f444500415b1f22a64730674caca1c286006` at `17:54:21Z`; author `gisupp@gmail.com`. This proves chronology/config only, NOT exact source SHA or incompatibility (source could have been deployed from an uncommitted tree).
- Wrangler `versions view` yielded binding metadata/ETags but no Git/source SHA. Supported `wrangler init --from-dash` previously failed with C3/Windows assertion and left a Hello World scaffold; not repeated. Official Cloudflare UI confirmed exact GFS account/100% API version, but read-only code view returned source status unavailable/hash null. No Save/Deploy/source edit. Exact parity gap: no authoritative active bundle/checksum to compare with PR10/11. Do not deploy until parity gate is proven.
- Candidate source is based on PR10 branch and changes payment outbox/idempotency plus COD logic. Candidate diff leaves signed webhook verification route unchanged; 122 targeted payment/receipt/webhook/guided tests, full244/244, build/lint/audit0, V1 harness4/4 pass. Candidate API `COD_V1_ENABLED=false`; dry-runs pass expected bindings. This is local validation, not live Worker behavior.
- Compatible rollback artifact is same PR11 code/config with COD intake flag off, retaining additive schema/holds/obligations. Bare V1 protects legacy reads/receipt/hold but cannot render COD totals; never roll COD orders back onto bare V1. No runtime rollback/deploy occurred.
- User-authorized Test Controls/WhatsApp comparison in GFS-234 found exact tester Profile **MISMATCH**. Do not repeat the unchanged profile or message. Exact owner action: tester owner provides the existing tester-controlled WhatsApp profile matching the unchanged Admin registration; no profile switch, substitute number or registration edit by agent.
- Active API v90 binding inventory contains no `COD_V1_ENABLED`; because the deployed source is unavailable, current runtime menu/flag semantics are **unknown**. Candidate dry-run uses false. No migration/deployment/flag/payment/Meta/webhook/customer mutation in GFS-235. No live WhatsApp order/WAMIDs/Admin evidence. Keep staging NO-GO and production separately gated.

## GFS-234 D1 Recovery Evidence and Isolated Rehearsal (2026-10-26)

- This section supersedes GFS-227–233's unresolved-D1 diagnosis **only for the explicitly approved bounded comparison performed here**. Same GFS principal/account and existing OAuth grant: new isolated D1 SELECT1 passed; the user then expressly authorized one original-D1 SELECT1 and conditional metadata-only preflight. Original SELECT1 passed, `quick_check=ok`, FK violations0, and all63 expected V1 schema objects matched (no missing/different definitions). Only `_cf_KV`/empty `d1_migrations` were extra. No original rows/schema were written. Historical API7403 (“The given account is not valid or is not authorized to access this service”) is not reproduced; its original cause is unknown. Free Support eligibility is not database corruption, authorization restoration, or a reason to purchase a plan.
- User separately approved `getfreeseeds-cod-compat-check`, ID `b29df6ba-e5c3-47bd-ac59-f6b0d47861a1`, same GFS account, synthetic-only <=5MB/10k reads/1k writes, no active binding/Meta changes. Created2026-10-26T20:39:38.852Z; current569344 bytes. All4 preexisting DBs preserved. Never repurpose the V2 migration34 primary or migration33 recovery; incompatible `cod_order_details` definitions share a name.
- Isolated normal migration ledger contains only schema-only V1 snapshot, synthetic fixture, and exact COD0030; no customer rows/bootstrap tester/payment settings exported. COD SHA256 `72d1c00c4c3bfeabc391f538530c2bc974a60d37ab33f01b5ba672253ec052db`. Local schema generation initially used an incorrect synthetic province column; repaired to actual `delivery_fee_pkr` and validated before any remote application. Original ledger remains0 and COD0030 is **unapplied there**. Never replay its 0001–0030 or invent history.
- Remote isolated SQL-only fixture `SIM-GFS234-DO-NOT-SHIP`: one original order/payment, base250 + fee125 = due375, COD_PENDING, hold1, one audit, receipts0/outbox0. Confirmation replay and exact0030 replay each wrote0 rows. `quick_check=ok`, FK violations0. Intentional PACKING probe rejected `COD_TEST_HOLD_DO_NOT_SHIP`/SQLITE_CONSTRAINT_TRIGGER code7500, distinct from auth7403. Follow-up state stayed held/unpaid. This is NOT Worker, Admin or WhatsApp acceptance; synthetic rates must never be used as live tariffs.
- Original and isolated Time Travel bookmarks are available, but no restore was performed. A bookmark is not a tested restore or permission to overwrite later history. After COD intake rollback must use COD-compatible intake-OFF code, retaining all additive schema/obligations.
- Approved Chrome MCP listed pages and verified Cloudflare email/account, Admin Access MATCH, and restored Test Controls AVAILABLE. After an initial own-Profile lookup timeout, the user explicitly opened Profile and approved one private recheck: exact Admin tester/own Profile comparison **MISMATCH**. No sender chat, message, account switch, reset or screenshot. Stop active callback rollout/live send until the tester owner makes the exact registered test identity available; never substitute a number or change registration to manufacture a match.
- Prefer the original single-D1 Approach A now reads work. Reject cross-DB COD sidecar: no atomic order/payment/fee/audit transaction across DBs, no enforced cross-DB FK, and inconsistent retries/rollback. No new API/Admin deployment or traffic switch is selected/authorized by the diagnostic approval. Supported `wrangler init --from-dash` failed via C3/Windows assertion and left only a local Hello World scaffold, NOT deployed-source evidence; never deploy that scaffold. Active source parity remains an independent engineering gate.
- Active API v90 `21a3d74c-3979-432c-9190-1848362592a4` / Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` unchanged. API candidate COD false; diagnostic config disabled/125; active flag unknown. Focused27/full244/V1 harness4, build/lint/audit0 and both dry-runs pass. Public health200 (`whatsapp:enabled`), unsigned WhatsApp POST403, unauthenticated Admin302; these prove service/negative-auth boundaries only, not signed-event/Advance acceptance. Preserve frozen V1, PR #9/#10, images and all financial history.
- Diagnostic DB has no Worker/Meta/queue binding, no private data and no live role. Retain solely for evidence; review/delete by2026-10-28 after dependency checks (scheduled12:00Z). No paid feature/plan or support case was created. Public Community/Discord/Workers-SDK routes are recorded, not used to bypass access or publish identifiers/secrets. Production remains separately gated.

## GFS-233 Approved Session and Support Gate (2026-10-26)

- Same-root approved Codex0.164.0 execution (`CODEX_HOME=D:\AI-Tools\Codex\home`, cwd `D:\free seeds`, `--approve-for-me`) called official `chrome-devtools/list_pages` successfully, then used that SAME execution to reach Cloudflare Support. A later separate fresh execution again lacked callable `list_pages`; exposure is intermittent. Do not repeat MCP retries in this run; use one MCP-enabled session from inventory through browser actions.
- Wrangler principal/account verified immediately before support flow: `gisupp@gmail.com`, GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, `d1:write`. Cloudflare's Free-plan UI states cases are limited to billing/account/registrar and the D1 API7403 issue on `getfreeseeds-staging` is ineligible. No case was submitted and no case ID exists. Do not reclassify to evade eligibility or buy/upgrade support without separate approval. Exact owner action: escalate this account-level D1 authorization through an eligible Cloudflare account-support channel or an explicitly authorized paid support plan; no scope/account changes.
- No D1 query/retry, migration, backup/integrity/Time Travel, or direct/indirect Admin read in GFS-233. Prior `/test-controls` exemptions read remains UNAVAILABLE; D1 access was not restored, so do not retry. Prior tester Profile mismatch remains; no sender/operator/tester recheck or WhatsApp message.
- Read-only Wrangler deployment histories show API v90 `21a3d74c-3979-432c-9190-1848362592a4` and Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` at 100%, source SHA unknown. Both candidate dry-runs pass; API candidate `COD_V1_ENABLED=false`. Dry-run is not live evidence. No migration/deploy/rollback/flag change.
- Local checks pass focused27/27, full244/244, retained V1 harness4/4, build/lint/audit0. No order, WAMID, screenshot, customer/payment mutation. Preserve frozen V1, PR #9/#10, `images/`, all financial history, and signed webhook.
- Keep staging/live acceptance NO-GO. Production remains separately gated.

## GFS-232 Approved MCP Exposure Gate (2026-10-26)

- Fresh `wrangler whoami` authoritatively reconfirmed `gisupp@gmail.com`, Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, with `d1:write`. This is not D1 query authorization. Do not retry D1 or change scopes/accounts.
- Official Codex0.164.0 `CODEX_HOME=D:\AI-Tools\Codex\home` is configured: `codex mcp list` shows `chrome-devtools` enabled; `codex doctor` reports valid config/MCP/network; Chrome processes are active. However the approved Codex execution did not expose callable `list_pages`, so no Cloudflare Support UI action/case was possible. The stdio row's `Auth Unsupported` is not proof of an auth failure. Do not use raw CDP, another identity, or bypass. Exact platform/session action: reinitialize/expose the already-registered official Chrome MCP in an approved Codex session until `list_pages` is callable.
- No support case/reference was created. Once the approved UI is callable, use the verified Wrangler principal/account and existing Cloudflare tab to submit one no-cost least-privilege D1 API7403 case; no permission/identity changes. Prior Admin `/test-controls` exemptions read returned UNAVAILABLE; do not retry until authorized D1 access is restored. The prior WhatsApp own-Profile mismatch remains a no-send stop; no current tester/Meta/WABA check is claimed.
- PR #11 source is unchanged. Latest test run: focused27/27, full244/244, V1 old-source rollback harness4/4, build/lint/audit0. API v90/Admin v82 IDs remain historical latest known; no source SHA. Candidate COD off; active flag unknown. No migration, backup/integrity query, Worker deployment/rollback, order, WAMID, screenshot, message or payment mutation.
- Keep staging/public launch NO-GO until MCP, D1, tester, active source parity and rollback gates pass. Preserve V1, PR #9/#10, `images/`, all orders/payments and signed webhook.

## GFS-231 Support/Tester Identity Stop (2026-10-26)

- Fresh approved-review official MCP returned the existing page inventory after one initial `list_pages` timeout; no page was changed. Cloudflare existing tab's visible UI exposed neither signed-in email nor account ID. Stop before support navigation/submission; do not click Switch Account, change identity, or file under an unverifiable account. No case/reference exists. Required owner action: authenticate the existing Cloudflare dashboard as the already-authorized `gisupp@gmail.com` principal and make its expected account ID visibly verifiable in the existing tab; then file one no-cost support diagnosis for D1 API7403/minimum existing-principal query access only. No OAuth scope or identity change.
- Admin/Test Controls ↔ WhatsApp own Profile comparison remains BLOCKED. After the user explicitly approved the safer route, the existing Admin tab was navigated same-origin to `/test-controls`; the narrowly scoped `#exemptions` read returned UNAVAILABLE. Because the authorized tester record could not be established, the agent stopped before WhatsApp Profile access. The earlier broad Orders snapshot remains prohibited; no chat, reset, message or unrelated-tab action. Last verified own-Profile result remains MISMATCH. Do not message until exact match.
- Do not use raw CDP, direct APIs, or another UI/API route to bypass the unavailable Test Controls record or prior snapshot rejection. No further Admin/D1 reads; the present live test remains blocked.
- Wrangler shows latest API v90 `21a3d74c-3979-432c-9190-1848362592a4` and Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`, no source SHA. The scoped Admin Test Controls page auto-loaded its exemptions list, which returned UNAVAILABLE; no direct Wrangler/raw D1 query or subsequent read was made. No migration, deploy, rollback, flag, order, payment, Meta or WhatsApp mutation occurred. PR #11 source unchanged; local tests remain the last GFS-230 27/27, 244/244, rollback4/4, build/lint/audit0.

## GFS-230 COD Staging Stop (2026-10-26)

- Fresh official Chrome MCP `list_pages` succeeded in Codex 0.164.0 at the configured `CODEX_HOME` and returned the existing 11 page IDs/origins. This restores page inventory, not tester identity. The last targeted own-WhatsApp-Profile check mismatched the approved tester; do not message or switch identities.
- Read-only Wrangler deployment history currently ends at API `21a3d74c-3979-432c-9190-1848362592a4` (v90) and Admin `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` (v82), both 2026-10-24; metadata has no source commit. Do not infer source parity or deploy the candidate to the active signed callback without the D1/schema and rollback gates.
- Do not retry D1 API7403 from Wrangler or an indirect Admin/D1 route. The user-approved next step remains account-owner/Cloudflare-support diagnosis of the existing principal's minimum query authorization; no support ticket/grant was performed here and no OAuth scope or identity was changed.
- PR #11 source remains local/reviewable: focused27/27, full244/244, unchanged V1-source rollback harness4/4, build/lint/audit0, and API/Admin dry-runs pass. Candidate flag is false. No D1 read/write/migration, Worker deployment, Meta change, order, message, WAMID, or screenshot occurred in GFS-230.
- Do not enable COD or claim staging acceptance until the D1 authorization/rehearsal/rollback and tester identity gates pass. Preserve V1, PR #9/#10, `images/`, all financial history, and the signed webhook.

## GFS-229 MCP and D1 Authorization Diagnosis (2026-10-26)

- A fresh approved-review Codex 0.164.0 exec using `CODEX_HOME=D:\AI-Tools\Codex\home` listed existing pages through official Chrome MCP and completed narrowly scoped identity checks. Cloudflare account ID was visible but email unavailable; exact staging Admin Access identity matched; GitHub UI page was absent (CLI identity remains `gardenshop`); Meta operator was unavailable; canonical GFS WABA/sender was evidenced only in WhatsApp Manager; WhatsApp own Profile mismatched the authorized tester. No chat/message, navigation, screenshot, or mutation occurred. Stop WhatsApp work until tester profile matches; never switch identities.
- The selected Codex config contains one enabled official `chrome-devtools` stdio registration (`npx -y chrome-devtools-mcp@latest --autoConnect`). No configuration repair, profile change, or browser mutation was made.
- `npx --no-install wrangler whoami` confirms `gisupp@gmail.com` / Get Free Seeds / account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; Wrangler reports `d1:write`. The prior API7403 is therefore not explained by a wrong account or absent top-level D1 scope. Its resource/API authorization cause remains unresolved. Per the existing GFS-227/228 stop rule, do not retry D1, switch accounts, or alter scopes; the Cloudflare account owner must diagnose/restore the existing principal's least-privilege D1 query access via an approved support channel.
- Local PR #11 validation: focused COD/Admin/migration 27/27, full 244/244, V1 compatibility rollback harness 4/4 against clean `cf01f44`, build, lint, production audit (0 vulnerabilities), API/Admin dry-runs, and diff check pass. Dry-runs are not deployment evidence. No D1, Worker, secret, policy, customer, order, payment, screenshot, or WAMID was changed; COD remains disabled.
- Do not deploy or enable COD based on this diagnostic. Resume only after authorized account access and all existing GFS-228 gates pass.

## GFS-228 Simple COD Checkout Scope (2026-10-26)

- User-authorized staging scope is a minimal cash-on-delivery customer path, not courier accounting. COD intake requires the runtime flag, audited Admin toggle, authorized province tariff, fixed PKR125 fee, and exact confirmation/idempotency checks. It does **not** require `COD_REFERENCE_HMAC_KEY`, collection/remittance references, courier onboarding automation, packing, or dispatch to create a COD_PENDING order.
- Keep the existing single V1 order and advance payment row/history; COD-specific detail remains tied to that same order and snapshots base amount, fee, final due total, policy revision and DO NOT SHIP hold. No QR, receipt, advance outbox/reminder or duplicate. Switching to Advance before confirmation removes the fee. Existing Advance methods and signed webhook remain unchanged.
- COD confirmation never marks PAID. The optional Admin settlement path remains separate and may mark COD PAID only after exact actual cash collection is independently verified; it still fails closed without the required evidence/HMAC. No COD test cash, shipment or manual payment approval.
- Admin COD settings UI is simplified to audited enable/disable with a fixed PKR125 fee; no collection/remittance reference inputs. The API accepts a null policy hash snapshot for COD_PENDING only. Keep the `COD_V1_ENABLED` staging flag false until release gates pass.
- D1 and deployment gates still control staging: populated D1's empty `d1_migrations`, API7403, missing backup clone/equivalent, source parity, and Chrome MCP `list_pages` failure are unresolved. Do not apply/deploy, change scopes/accounts, or contact WhatsApp until those gates and authorized tester/Meta identity pass.
- GFS-228 source commit `046426e` is local candidate code pushed to PR #11. Tests/dry-runs are not live acceptance. Production promotion remains separate.

## GFS-227 D1 Permission and Tester Stop (2026-10-26)

- GFS-226 same-origin Admin Cloudflare Access identity check remains valid for email/host. A new official Chrome MCP session failed `list_pages` twice; stop and do not retry in this execution. Admin Test Controls/WhatsApp Profile not cross-matched. Last observed tester mismatch remains a hard stop; Meta operator remains unverified. No messages or account switching.
- Official Wrangler D1 query against the already verified GFS account/database returned Cloudflare API **7403 (not authorized)**. Do not switch accounts, broaden scopes, retry under another identity, or treat past `quick_check` success as current authorization. Use only the already verified redacted/synthetic local fixtures until the Cloudflare account owner restores least-privileged D1 read access through approved support; any required permission change needs account-owner approval.
- The populated shared D1 still has an empty `d1_migrations` ledger; never bulk apply or fabricate entries. Do not directly execute 0030 on production/staging while schema/parity/backup checks are blocked. Local synthetic 0030 remains idempotent and separately marks `cod_schema_migrations`.
- Deployed API v90/Admin v82 source parity remains unproven; version metadata lacks commit annotations. No Worker, Admin, D1, HMAC, Meta, courier-policy, callback, or order mutation. Keep COD intake false. Production remains separately authorized.

## GFS-226 Admin Access Claim and Tester Gate (2026-10-26)

- Admin identity is now verified through its exact staging origin's same-origin Cloudflare Access `get-identity` response: HTTP succeeded, hostname matched, and email claim matched the authorized GFS identity. No JWT, cookie, header or identity JSON was output; issuer/audience were not exposed by the endpoint. This supersedes GFS-225's “identity not visible in header” only for Admin Access email verification.
- The next approved-review MCP session failed `list_pages` twice. Do not retry again in this execution or use direct APIs/CDP. Therefore Admin Test Controls and current WhatsApp own Profile could not be compared. The last verified tester Profile mismatch remains a stop; do not send, switch numbers, impersonate, or open unrelated chats. Meta operator remains unverified; no WABA changes.
- Current PR #11 HEAD at start `b993d596`; PR #10 base `cf01f44`; PR #9 and frozen V1 `d816ba1` remain protected. No source change in GFS-226.
- Active API v90/Admin v82 and exact source parity unchanged/unproven. Active API health GET returns HTTP200 but service only; it does not report COD/runtime/D1 state. Do not interpret a successful health response or `PRODUCTION_INTEGRATION_READY` config string as source/release verification.
- D1 remains populated with empty migration ledger. Do not replay migrations. Idempotent 0030 remains local-only, with separate marker and no legacy ledger writes. No approved isolated clone/equivalent rehearsal or active-source parity, so do not apply/deploy.
- No HMAC/collection verification, D1/Worker/Meta/CMS/customer/payment mutation, tester order, WAMID, screenshot, or production launch occurred. Preserve signed webhook, advance path, all history and rollback.

## GFS-225 Identity, Artifact and Acceptance Stop (2026-10-26)

- Current UI/CLI findings supersede neither GFS-224's hard gates nor the tester lock. Cloudflare UI `gisupp@gmail.com` and expected account route ID match; GitHub CLI `gardenshop`, but browser PR page remains logged out. Admin Orders host returns content but expected Access identity is not exposed in header/banner or link labels; do not assume identity. Meta Business links include authorized business/WABA IDs but no profile control identifies Saeed and phone ID link was absent. WhatsApp Profile remains a mismatch to the authorized tester. No identity switch, impersonation, unrelated chat, or message.
- Active API v90 and Admin v82 remain unchanged. API health endpoint returned HTTP 200 and only service `getfreeseeds-api`; no deployment state, COD flag, or D1 health field was returned. Treat those values as unknown, not enabled/healthy. Candidate COD flag remains false; active API secret list lacks `COD_REFERENCE_HMAC_KEY`.
- Exact deployed source parity is still unavailable: version metadata has no Git commit annotation and API v90 predates PR #10 commit `cf01f44`. No remote code editor/source artifact exposed a source checksum. Do not deploy PR #11 onto the active signed callback until actual parity is independently proven.
- D1 is populated; `d1_migrations` has zero entries, Wrangler would replay 0001–0030. Preserve this ledger. Reviewed COD-only 0030 is idempotent and writes a separate marker, but is unapplied. Remote quick/FK checks and Time Travel availability do not substitute for a safe isolated rehearsal/rollback. Official D1 clone/fork is unsupported; do not export customer data to manufacture a clone.
- Do not change API/Admin/Meta/secret/D1 state. Existing advance, receipt/webhook paths remain as deployed; they were not changed, but no live advance regression was run. No live COD tester order, WAMID, screenshot, or Admin COD_PENDING proof exists. Public production remains separately authorized and NO-GO.

## GFS-224 Verified Browser / D1 Ledger Gates (2026-10-26)

- Codex MCP repair: CLI `0.147.0` lacked stable tool exposure; update the official Codex CLI to `0.164.0`. The earlier cancellation also came from exec `approval_policy=never` paired with Chrome `evaluate_script` `read_only_hint:false`. For supported read-only DOM inspection use the normal approved-review path; never use bypass flags. Never inspect broad Meta/Ads/WhatsApp page bodies, leads, customer/payment rows, tokens, storage, or unrelated chats. Inspect exact elements/headers only.
- GFS-224 Chrome findings: existing Cloudflare page user menu = `gisupp@gmail.com`; exact account ID appears in the account route/link. GitHub CLI = `gardenshop`, but browser PR page is not authenticated as that user. Admin host opens Orders UI, but expected email is not visible in header. Meta Business pages link canonical GFS business/WABA/phone IDs, but operator Saeed is not visible; do not enter the WABA or mutate Meta. Authorized WhatsApp tester Profile did not match the approved tester; never switch identities or send.
- Active Workers from read-only Cloudflare metadata remain API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. No source annotation proves parity. API version predates PR #10 commit `cf01f44`; do not assume PR #11 source is the deployed source. Configured `DEPLOYMENT_STATE=PRODUCTION_INTEGRATION_READY` is not actual release approval; no deployment or production mutation.
- Remote `d1_migrations` exists with zero records while populated V1 schema/data exists; Wrangler shows all 0001–0030 pending. **Never bulk apply or fabricate ledger rows.** Remote schema-only metadata matched legacy table fields and is not customer-row data. Remote `quick_check=ok`, FK check empty, COD tables absent, and D1 Time Travel bookmark available. Cloudflare officially documents D1 clone/fork as unsupported; it is not safe to call restore a backup clone. `wrangler d1 export --no-data` returned authentication error; no export/customer data file exists.
- Fallback schema code in PR #11 now uses idempotent COD-only `0030_cod_v1_compat.sql`, writes a separate `cod_schema_migrations` marker, and does not touch `d1_migrations`. This is a reviewed local proposal only. Direct remote execution remains blocked until a verified clone or formally accepted equivalent, deployed-source parity, authorized operations/collector/tester, and rollback gates pass. Migration hash is recorded in the report; never edit an applied version in place.
- COD HMAC secret name is absent from active API secret list; candidate flag is false. No secret, D1, Worker, Admin, Meta, callback, policy, tester order or payment was changed. Keep COD disabled and all existing financial/rollback history.

## GFS-223 Current Staging Preflight Findings (2026-10-26)

- Official Chrome bridge is enabled. The earlier `user cancelled MCP tool call` was caused by a Codex exec started `-s read-only` (`approval_policy=never`) while the DOM evaluator was declared `read_only_hint:false`; the evaluator had no approved execution path. The fresh approved review-mode session succeeded without bypass and was read-only. It listed only two Meta business tabs and WhatsApp Web; no Cloudflare/GitHub/Admin tab. Current visible Meta checks: GFS sender identity visible, canonical WABA not visible, approved tester match false. Do not navigate/open a different tab without required host approval.
- GitHub CLI account `gardenshop` and Wrangler OAuth identity `gisupp@gmail.com` / account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` were read-only verified. Wrangler configs, remote Worker version metadata, and actual shared D1 ID agree. No authenticated dashboard UI was available; CLI evidence does not replace UI verification before mutation.
- Active API version v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. API version metadata timestamp precedes PR #10 source commit `cf01f44`; Cloudflare provides no Git commit annotation, so parity is unverified. Current API metadata has no COD enable var or COD HMAC secret binding; API secret listing has no `COD_REFERENCE_HMAC_KEY`. Values were never read.
- Remote `d1_migrations` exists but has zero rows; Wrangler consequently lists every migration 0001–0030 pending despite populated V1 schema/history. **Never run Wrangler migration apply**. Remote COD tables do not exist. `quick_check=ok`, `foreign_key_check` empty, and a Time Travel bookmark was returned at 2026-10-26T11:45Z. These read-only checks made zero writes. Do not apply 0030 until the migration-ledger discrepancy is safely resolved, deployed-source parity is proven, and authenticated operations/collector gates pass.
- Source candidate remains COD disabled; no secret, migration, Worker, callback, payment, customer, audit, Meta, courier-policy, or production change occurred. Local tests are not live acceptance. Preserve current backup/rollback, and never restore over new order history.

## GFS-222 Compatibility and Staging-Only Release Protocol (2026-10-26)

- GFS-220 staging Approach A authorization remains valid; do not ask for it again or treat it as production promotion. Continue only on PR #11's compatibility branch. Frozen V1, PR #9, customer/payment/receipt/audit history, `images/`, Meta config, and existing secret values are protected.
- New COD admission must bind the displayed base amount, PKR125 fee, final total and exact audited policy revision. Revalidate enabled order province and exact enabled policy in the winning database statement; a changed fee/policy requires a fresh quote/confirmation. Never silently change the delivery snapshot or confirmed fee.
- Configuration uses an explicit revision/audit ID and compare-and-swap, not timestamp ordering. Confirmed orders retain immutable policy evidence hashes and price snapshots; disabling new intake must not strand existing obligations. Reconciliation uses each order's historical policy, exact collection and exact remittance; PAID is not implied by a receipt, reference or checkbox.
- This staging candidate defaults every new COD order to persisted **DO NOT SHIP** hold. No hold-clearing control is introduced. Enforce the hold on server fulfillment/tracking/labels/reconciliation and in retained SQL guards; UI copy alone is not protection. Separate synthetic local fixtures may explicitly model unheld fulfillment without any shipment or real funds.
- Race losers must not enqueue advance work, overwrite a winning COD conversation, or create success audits. Final success audit metadata must be selected from persisted transactional state. Completed payment children with provider IDs in SENT/DELIVERED/READ are success; do not re-read QR storage or resend completed children.
- Failed COD confirmation transport must be recoverable only for the original event hash and matching persisted held COD order/audit snapshot. Reconstruct its order number/amount from storage, even with intake OFF; do not re-finalize or trust stale conversation display fields. Arbitrary new events are not confirmation retries.
- Tested GFS-222 source is `bf3a231c585982badcf55b43dece351f92c8d60d`; reviewed migration Git blob is `4993557afd135c7cb778f565b95ca95eb4431ffd`. This identifies source bytes, not a remotely applied migration or deployed Worker version.
- The revised `0030_cod_v1_compat.sql` is still local/unapplied. Review its exact bytes/checksum before any application. Apply only that migration, only after authenticated account/bindings, actual deployed-source parity, ledger, backup/Time Travel, quick/FK, clean regression and rollback checks. Do not replay unrelated migrations or synthesize ledger history.
- Old-source rollback tests use the actual unchanged `cf01f44` API/Admin source with synthetic retained schema. They prove only the tested local legacy-read/receipt/hold protections, not a live Worker rollback. After COD obligations exist, rollback to a verified **COD-compatible intake-OFF version**, not old V1 that cannot represent COD totals/reconciliation. Retain additive schema/history; never restore over later data without separate incident authorization.
- Browser preflight in GFS-222 exposed official `list_pages`, but subsequent read-only snapshot/DOM inspection was canceled, including after explicit user reauthorization. A resumed CLI also reported a non-callable `list_pages` function. No current authenticated account, Worker/D1/Meta/tester/collector record or live acceptance was verified. No canceled navigation or action is retried without new explicit permission; no raw CDP, alternate profile, HTTP/dashboard bypass or secret copying.
- COD flag remains false and no migration, deployment, secret, operational policy, WhatsApp message, test order or financial mutation is authorized to skip those missing checks. WAMIDs/screenshots must be genuine, private and sanitized; no current GFS-222 live evidence exists.

## GFS-221 Staging Compatibility Release Gate (2026-10-25)

- User authorized staging-only Approach A. Implementation belongs on separate branch `codex/gfs221-cod-compat-001`, based on V1 PR #10 source commit `cf01f44`; this is **not verified as byte-for-byte the active staging Worker source**. Check live version and bindings before rollout. Never merge PR #9/V2 into frozen V1 or promote production under staging authorization.
- Candidate source commit `0ce3dac` backports a narrow V1 COD flow and Admin controls. It adds only a COD-specific additive migration `0030_cod_v1_compat.sql` (new tables/triggers; no existing rows rewritten) and sets `COD_V1_ENABLED=false`. Do not apply the migration via broad ledger replay. First verify active Cloudflare identity, bindings, exact migration ledger, backup/Time Travel, `quick_check`, `foreign_key_check`, compatibility, and immediate Worker rollback through authorized UI; only then apply exactly `0030` and stage the Worker.
- COD remains fail-closed unless runtime flag, enabled audited policy, valid >=32-character protected HMAC key, and independent verified collection/remittance policy all pass. Do not treat entered references or an owner assertion as evidence. Store only HMACs. Preserve original V1 advance `orders.total_payable` and existing payment/receipt history. COD fee is snapshotted separately, shown exactly once; switching to advance before confirmation applies no fee.
- COD confirmation uses the existing order and moves it to `COD_PENDING`; no QR, advance receipt, payment-instruction outbox item, or payment reminder. Admin fulfillment is separately gated and tracked; dispatch requires tracking. `PAID` is permitted only after independently evidenced exact cash collection and exact remittance, with audit. COD never goes through advance settlement approval. Never ship a live test order.
- Preserve the signed existing WhatsApp webhook, canonical GFS Meta config, approved tester lock, EN/UR, audit, and idempotency. Capture genuine tester evidence only via authorized Chrome MCP; screenshots/full WAMIDs remain in private evidence outside Git. Do not message other chats or use Hoja resources.
- MCP diagnostic: configured official `chrome-devtools-mcp@1.12.0` and `codex doctor` passed; a fresh Codex CLI exec exposed `list_pages`. Subsequent authenticated Cloudflare navigation was canceled, so no dashboard account/sender/tester identity or live binding verification is claimed. Do not retry that canceled navigation or substitute raw CDP/HTTP.
- GFS-221 tests and Wrangler dry-runs are local/synthetic only. No migration, secret provisioning, deployment, rollback, or real WhatsApp order occurred. Keep COD disabled; no public or production-readiness claim.

## GFS-209 Real Receipt E2E (2026-10-24)

- Verified the authorized tester through WhatsApp **You > View Profile** and the canonical GFS sender through **Contact Info**; Admin Access and Cloudflare account matched the authorized GFS identity. The target order's `wa_id` and `normalized_whatsapp_number` are NULL; `whatsapp_number` matches the authenticated tester. Association may use that stored number only when `wa_id IS NULL`, and must be anchored by the exact payment-message WAMID reply or a unique eligible order. A non-NULL mismatch or ambiguous order always fails closed.
- The first fresh attachment was a Sticker/`MESSAGE`, not receipt media; it created no receipt. Do not treat stickers, text, screenshots or synthetic delivery as receipt proof. The accepted retest was a distinct JPEG selected as a photo and replied directly to the target Easypaisa instructions.
- Current V1 receipt flow is deployed. Exact acknowledgement is EN: `Receipt received for order {orderNumber}. Your payment is under Admin review. We will notify you after verification.` Receipt upload is transport evidence only; keep order `PAYMENT_REVIEW` and payment `PENDING`. Never inspect/authenticate payment contents, infer wallet credit or mark `PAID` without the independent authorized settlement process.
- WhatsApp Manager reports the canonical phone `Connected` with `High` quality; messaging permissions are granted and the `messages` callback is subscribed. Admin's `registrationStatus=EXPIRED` reflects expired code-verification status, not disconnected phone registration. One official SMS-code request returned HTTP 400; do not retry, change number/WABA, or re-register a connected phone.
- Preserve V1 journey, the new-number lock, zero-Hoja runtime isolation, private R2, all financial history and `images/`. Full WAMIDs and screenshots stay in private evidence outside Git; do not put raw IDs, phone numbers, receipt bytes or customer data in logs/docs.

## GFS-208 Receipt Upload Gate (2026-10-24)

- The target non-payment image is test input only. Do not authenticate financial contents, infer wallet credit, store a manual receipt, approve, or mark `PAID`.
- The verified test account's own WhatsApp Profile matches the authorized tester and the canonical GFS contact was verified separately. The target order's customer `wa_id` is NULL even though its stored WhatsApp number matches that verified sender. Never fill or overwrite `wa_id` from a display name or guess.
- At the GFS-208 snapshot, receipt association used a NULL-only normalized-number fallback. GFS-209 records the live schema gap and the final fallback to the exact stored `whatsapp_number`; both are allowed only with the exact payment-text/QR WAMID reply or exactly one eligible order. Non-NULL mismatch and multiple candidates fail closed.
- Keep receipt state at `PAYMENT_REVIEW` and payment status `PENDING`. A receipt acknowledgement is transport confirmation only, not funds verification. EN: `Receipt received for order {orderNumber}. Your payment is under Admin review. We will notify you after verification.` UR: `آپ کے آرڈر {orderNumber} کی رسید موصول ہو گئی ہے۔ آپ کی ادائیگی ایڈمن کے جائزے میں ہے۔ تصدیق کے بعد ہم آپ کو مطلع کریں گے۔`
- Historical GFS-208 finding: Meta `messages` was subscribed and the inbound event persisted, but the candidate had not yet deployed. GFS-209 supersedes its release status; phone Manager is connected even though code verification reports `EXPIRED`.
- Preserve the new-number WhatsApp lock, the zero-Hoja runtime rule, all payment/order history, private R2, and `images/`. Never run broad shared-D1 scans or copy raw WAMIDs, phone numbers, receipt bytes, or customer data to logs/docs.

## GFS-199 Verified OFFER Protocol (2026-10-23)

- Verify the tester through **You > View Profile**, where the own phone is visible. You/Settings/Account alone may hide it; missing digits there are not proof of a different account. Compare the exact own phone and separately confirm the canonical GFS phone through Contact Info. Never switch/relink accounts to satisfy a check.
- API `9b5f13ae-f023-4fa8-befe-2085bb24cbda` implements LANGUAGE -> OFFER -> CONTINUE_ORDER -> FERTILIZER. OFFER owns its text/image and exactly CONTINUE_ORDER/CANCEL_ORDER. FERTILIZER owns its own media; never attach OFFER media as a substitute for OFFER state.
- Published CMS is OFFER v5, RECEIPT v2, PAYMENT v2, FERTILIZER v7. English fertilizer labels are Add Fertilizer / Seeds Only; preserve approved Urdu copy and dynamic D1 prices/fees.
- CANCEL_ORDER is accepted only in OFFER and creates no order/payment; START after cancellation returns LANGUAGE. A stale OFFER Cancel after Continue must not cancel a later state or existing order. Test resets remain authenticated, tester-only and history-preserving.
- GFS-199 proves new real EN/UR OFFER and pre-payment checkout, not confirmed funds. Keep complete WAMIDs/cropped screenshots privately outside Git. No receipt/reference/funds/PAID/fulfillment may be inferred from a delivered QR.
- At close, all three test payment text/QR parts were READ but instruction queue jobs were DEAD_LETTER/PAYMENT_TEXT_DELIVERY_FAILED. Preserve terminal jobs; do not replay or claim full payment acceptance until this reconciliation defect is independently repaired/retested.
- Immediate API rollback is `8da54b28-4bec-45b2-9a3f-672225dba843`; CMS rollback OFFER v4/RECEIPT v1/FERTILIZER v6. Coordinate rollback because the old API lacks OFFER/reference callbacks; retain additive D1 schema and all financial history.

## GFS-197 OFFER API Deployment Gate (2026-10-23)

- The authenticated Admin profile does not substitute for the approved WhatsApp tester. Before any callback/API deployment or real outbound E2E, verify the tester's OWN WhatsApp Profile Phone against the authorized tester in these rules and verify the GFS sender via Contact Info. If either fails, stop; never switch/relink/create a number/profile or send to another contact.
- Active API `8da54b28` predates the OFFER action/state flow and new receipt-reference handling. Keep OFFER/RECEIPT v5/v2 as drafts and do not publish incompatible content until the matching API is deployed and retested.
- The current receipt-backed REVIEW has no transaction reference, a closed service window and no approved utility template. Admin Request Reference remains disabled; do not send or mark PAID. Await a genuine reference, actual receiving-account credit and authorized evidence.
- Preserve the three approved methods and recipient-bound QR evidence; no screenshots/old WAMIDs are substitutes for a new live test. Payment transfer/PAID/fulfillment remain separate authorization gates.

## GFS-196 OFFER Release and Tester Lock (2026-10-23)

- The current deployed API predates the stable OFFER Continue/Cancel flow and customer transaction-reference capture. Never publish OFFER/RECEIPT drafts or expose new customer-facing callbacks on that API version.
- API/webhook rollout requires the authorized tester's OWN WhatsApp Profile Phone to match the tester in these rules. A different/hidden Profile is a hard stop; do not switch, relink, create a Profile, or message a different contact to create a superficial PASS.
- Keep the GFS-195 Admin reference/settlement gate deployed and fail-closed. Reference requests require a proven open 24-hour window or an approved utility template; an Admin button must not imply dispatch when the queue is disabled.
- Saved CMS drafts are not published. Do not publish EN/UR OFFER/RECEIPT action labels or copy until matching API code is deployed and authenticated real Chrome output can be retested.
- Preserve the three previously audited/approved method configurations, their current QR hashes, enabled state, settlement proof requirements, and all payment/incident history. No transfer, PAID or fulfillment without genuine provider-credit evidence and authorized review.

## GFS-196 OFFER Release and Tester Lock (2026-10-23)

- The current deployed API predates the stable OFFER Continue/Cancel flow and customer transaction-reference capture. Never publish OFFER/RECEIPT drafts or expose new customer-facing callbacks on that API version.
- API/webhook rollout requires the authorized tester's OWN WhatsApp Profile Phone to match the tester in these rules. A different/hidden Profile is a hard stop; do not switch, relink, create a Profile, or message a different contact to create a superficial PASS.
- Keep the GFS-195 Admin reference/settlement gate deployed and fail-closed. Reference requests require a verified open 24-hour window or an approved utility template; an Admin button must not imply dispatch when the queue is disabled.
- Saved CMS drafts are not published. Do not publish EN/UR OFFER/RECEIPT action labels or copy until matching API code is deployed and authenticated real Chrome output can be retested.
- Preserve the three previously audited/approved method configurations, their current QR hashes, enabled state, settlement proof requirements, and all payment/incident history. No transfer, PAID or fulfillment without genuine provider-credit evidence and authorized review.

## GFS-195 Reference and OFFER Safeguards (2026-10-22)

- Admin may store a normalized customer transaction reference only on its receipt-backed PAYMENT_REVIEW payment, bound to the matching order, method and exact persisted total. Database uniqueness, Admin checks and customer normalization must use the same case/ASCII-whitespace canonical form, including legacy values with internal spaces. Audit stores a hash, actor, time and order/payment association; do not log the raw reference.
- A reference is not settlement proof. PAID requires the associated receipt, saved genuine reference, persisted order amount, currently approved receiving destination, authenticated Admin review of actual account credit, and a non-sensitive settlement evidence reference. The API must atomically record payment/order/audit state. CAPI remains disabled unless explicitly configured.
- Request Reference may send only inside a proven open service window or via an approved utility template. Admin shows a clear closed-window/API-not-deployed blocker and must not enqueue a request when either condition fails. Historical age and conversation.updated_at never open a window.
- On receipt, keep order/payment at PAYMENT_REVIEW while requesting the genuine reference in the customer's language. Do not mark paid from media, reference alone, or an Admin checkbox without provider-account credit verification.
- OFFER quick replies are exactly stable `CONTINUE_ORDER` and `CANCEL_ORDER`. Continue alone opens FERTILIZER; cancel clears only the unsubmitted entry, creates no order/payment/CAPI/dispatch, and START restarts. Preserve the payment selector allowlist and separate Check Order status action.
- Do not deploy webhook/offer changes or publish changed customer-facing copy until the authorized tester profile matches the project rule. Never switch numbers/create profiles to bypass this lock. Drafts are safe; publication is not.
- Directly apply only the narrow versioned migrations after duplicate/reference and D1 backup/integrity preflight. Never replay the empty legacy ledger or invent history.

## GFS-193 Owner-Supplied QR Evidence Limit (2026-10-22)

- Generic QR-scanner screenshots are supporting evidence of encoded payload only. They do not independently authenticate the destination or prove that the encoded merchant/wallet/bank account belongs to Garden Shop. Never approve from an owner-uploaded scanner screen alone.
- For each method, approve once only after an authenticated provider/bank record or a separately authorized and independently confirmed settlement links the exact decoded destination to Garden Shop. The one-time workflow is available, but keep all methods disabled until that evidence is reviewed against the current recipient-bound QR snapshot.
- JazzCash still needs an official till-ownership link even when the displayed Garden Shop payload matches the configured draft. Easypaisa still needs the official alias-to-Garden-Shop destination mapping. A Bank Alfalah/ALFH payload or partial identifier without the beneficiary name needs an authenticated bank payee record matching the exact QR/Raast/IBAN destination.
- Do not rescan, re-upload, replace a QR, expose raw payment identifiers, accept a mismatched destination, or repeat provider searches. When the account portal/record is absent, report the exact missing provider record once; no transfer or account switch to create synthetic verification.
- GFS-193 reused CMS v2 and deployed Workers from GFS-192. Current new scan evidence does not qualify any method, so no payment selector/QR/receipt stage can be newly accepted. Keep previous lead-only WAMIDs/screenshots separate from financial acceptance.

## GFS-192 Live Staging Protocol (2026-10-22)

- Current deployed state supersedes GFS-191: migration0026 was applied once after direct `PRAGMA table_info` proved the column absent. Do not infer schema from an old Admin JSON response. Never replay the 26 pending migrations or fabricate historical ledger rows; the legacy `d1_migrations` table remains empty.
- Use Cloudflare-supported `PRAGMA quick_check` and `PRAGMA foreign_key_check` for D1 preflight. `PRAGMA integrity_check` is not in D1's supported list; its SQLITE_AUTH failure does not by itself prove missing account permissions. API7403 was not reproduced in GFS-192; do not change accounts or widen scopes on transient errors.
- Migration0026 is nullable/no-backfill. Fresh signed tester messages now populate last_inbound_at; historical timestamps must remain unknown. Preserve existing orders and held incident. Never infer customer windows from aggregate traffic or changed conversation state.
- The deployed beneficiary-review UI/API binds the reviewed recipient/account/copy/QR state to a SHA-256 snapshot. Stale snapshots, concurrent losing reviews and failed audit/enablement must roll back; one approval records opaque provider reference, authenticated reviewer, server time, QR hash and recipient-bound snapshot. Do not repeat approval for an unchanged approved destination. Never approve from owner confirmation alone.
- PAYMENT CMS v2 is published in EN/UR with `{orderNumber}` and authoritative `{amount}`. Runtime must use persisted order totals; a global fixed advance is not checkout evidence. Zero verified enabled methods must show no payable buttons or QR and no payment request. Check Order remains separately available under order status.
- GFS-192 live evidence is lead-only: one English test order and partial Urdu regression, not a payment checkout. No receipt, transfer, PAID or fulfillment is authorized by this evidence. Keep full WAMIDs and cropped screenshots in private external evidence storage, never source control.
- Roll back Workers/CMS through supported version controls; retain the additive timestamp column. Time Travel bookmark is recovery evidence, not approval to restore over subsequent orders. Database restoration requires an independently approved incident procedure with writes quiesced.

## GFS-191 Payment Activation and Checkout (2026-10-22)

- An owner's statement that an account/QR belongs to Garden Shop is not independent proof of the QR's decoded beneficiary. Reconcile each exact destination to an authenticated provider/bank record, or a separately authorized and confirmed settlement. Never infer an alias or IBAN/Raast mismatch is harmless.
- Approve once per unchanged payment destination only after the independent source is reviewed. Record method, non-sensitive evidence reference, authenticated reviewer, server time, and current QR hash in the protected audit path. A changed recipient/account/QR automatically invalidates approval. Never write verification flags directly or invent references.
- Keep each method disabled until recipient, both-language copy, required identifiers/placeholders, and current private QR integrity/ownership all pass. Enable a qualifying method immediately after approval; do not wait for other methods.
- `{amount}` in the PAYMENT introduction must be rendered from the persisted order summary, never from user input, a global hardcoded amount, or a mutable preview.
- Wrangler may report every migration pending when its D1 migration ledger is absent even though application schema exists. Confirm field presence through a read path and do not replay a full pending migration list against a populated database. Do not repair migration history by blind inserts or direct SQL bypass.
- Before Worker deployment, verify authenticated GFS identity, active bindings, application/D1 health, rollback version, and a clean regression. When direct D1 integrity/query access returns API7403, do not switch accounts or widen scopes; use existing authorized read-only Admin APIs for diagnosis and stop before writes/deploys if integrity cannot be established.
- Do not send payment instructions without a verified enabled method and a proven open 24-hour window or approved template. Never claim simulation as live WhatsApp evidence; PAID still requires real funds, unique reference, and authorized approval.

## GFS-190 Emergency Payment Recovery (2026-10-22)

- A successful supported `chrome_devtools.list_pages` call proves the Chrome MCP tool path is available for this session; it does not prove authenticated identity on every already-open service page. Reuse matching tabs, verify the active account before mutations, and stop if the Admin/Cloudflare Access identity is not visible.
- Cloudflare Wrangler identity and dashboard/API identity are separate checks. Do not switch accounts or broaden scopes on API7403; test the authorized account through a read-only staging D1 query and record which surface succeeds. Never infer dashboard authorization from `wrangler whoami` alone.
- D1 staging still requires independently verified Garden Shop beneficiary evidence and a complete, published payment configuration. QR integrity flags, active D1 provenance, owner attestation, and a visible QR are not beneficiary proof. Keep all methods disabled until the protected evidence-review workflow records independent proof and audit.
- Existing pending orders must not be contacted based on order age, a recent aggregate webhook timestamp, or `conversation.updated_at`. Migration0026 is not applied in the recorded GFS-190 execution; no inbound service window is established for historical orders. Require a proven signed inbound timestamp or an approved utility template.
- An additive migration or Worker deployment affecting the active WhatsApp callback still requires verified bindings, D1 integrity/rollback, clean local regression, authenticated Admin/Meta/tester identity, and a real Chrome retest. Do not deploy or claim live recovery when any of these prerequisites is unavailable.
- Never record raw D1 payment identifiers, customer data, QR bytes, Access/OAuth challenges, or credentials in logs, screenshots, tests, or documentation.

## GFS-189 Service-Window and Messaging Controls

- Migration0026 adds nullable `whatsapp_conversations.last_inbound_at`, with no historical backfill. Populate only after HMAC signature and canonical callback Phone ID validation, from the first unique `whatsapp_events.created_at` server receipt timestamp. Duplicate provider IDs keep their original time; status/outbound events never extend the service window.
- Before any free-form reply/payment text, compare the source inbound event against the strict 24-hour boundary. Direct and queued payment instructions also require a current conversation timestamp. Missing/invalid/future/expired timestamp is closed. If no approved utility template is configured, permanently block and audit; never retry terminal history or send stale details.
- A later authentic customer inbound opens a new window. Order creation, `conversation.updated_at`, order ID, owner statement or outbound delivery is not proof of inbound time/consent. Old conversations remain NULL until new authenticated inbound activity.
- WhatsApp payment outbox keys include a hash of the triggering message ID; the same inbound retry keeps the same key, while a new authorized customer method-selection message creates a distinct key. Text and QR parts derive from that request key. Never clear/rearm a terminal job to resend.
- Preserve service-window error/terminal status behavior on D1 deployment. Apply migration before the Worker, then verify signed webhook message updates, duplicate replay doesn't extend, status callbacks don't update, and the outbox doesn't send outside the window.

## GFS-189 Trusted Inbound Time and Service Window

- Migration0026 adds nullable `whatsapp_conversations.last_inbound_at` with no historic backfill. Set it only after the signed WhatsApp webhook and canonical callback Phone ID pass. Use the first `whatsapp_events.created_at` server receipt time for the unique `message:<provider-id>`; `INSERT OR IGNORE` preserves that original time on duplicate delivery. Status/outbound/Flow-server callbacks alone never advance the timestamp.
- Do not infer historic inbound time from order creation, message ID, or conversation `updated_at`. Null/invalid/future/age>=24h means the free-form service window is closed.
- Before free-form replies, QR/payment messages, or queued payment-instruction retries, validate the exact persisted inbound timestamp. Outside the 24-hour window, use only an explicitly approved utility template. No approved template means permanently block/terminalize the outbox job with a safe reason and audit; never retry terminal history or send details without customer service eligibility.
- A new signed inbound message can open a fresh window. A duplicate old message cannot extend it. Message retries use the original event timestamp, not retry time. Historical rows remain null until a new authenticated inbound event; do not backfill.

## GFS-188 Pending Orders, Service Window, and Coexistence

- Before sending any payment details, publish the exact approved localized PAYMENT CMS introduction and then expose only enabled independently verified methods. Never bypass versioned Admin CMS with direct production D1 edits.
- Pending orders with no verified method receive no payment instructions. Do not infer a WhatsApp 24-hour service window from order age or conversation `updated_at`; current schema has `last_inbound_message_id` but no dedicated `last_inbound_at`. If the window cannot be proven, do not send free-form messages. Outside the window require an approved utility template. Never replay terminalized outbox jobs.
- Use each order's authoritative `total_payable`; never invent a fixed advance. A real transfer needs explicit method and amount authorization, independently confirmed funds, transaction reference, and authorized Admin approval before PAID/fulfillment.
- Do not register or migrate a second WhatsApp number until its owner, Business App age, country/provider Embedded Signup eligibility, and coexistence status are verified through supported Meta workflow. Preserve all app history. Manual support is a separate optional contact only after ownership verification and never a payment-selection button.
- Advertising verification must stay draft/preview-only. No campaign activation/spend without explicit budget and release approval.

## GFS-187 Admin Ownership Preservation and Redacted D1 Reads

- Admin Payment Settings copy-only updates change only localized copy/sort fields; they never touch recipient, till/account, enabled, QR metadata, or ownership evidence. This preserves independent QR verification and avoids firing financial triggers for unchanged state.
- If recipient name or identifier changes, force method disabled and owner flag false first in an audited fail-closed operation, save the new recipient details, and let migration0024 clear independent asset ownership/evidence. Return persisted state and indicate re-verification required. QR upload remains the only asset replacement path and resets ownership; preserve original/derivative/hash/provenance/private-preview synchronization.
- Never select or print raw payment identifiers in D1 diagnostics. Query only booleans, aggregate counts, or explicitly masked data. GFS-187's first broad D1 diagnostic output raw payment identifiers; they were not copied to source/docs, but owner review is required. Do not repeat or post the values.
- No new method may be enabled without an authenticated independent provider/bank record. Owner statement and QR integrity are not beneficiary proof. Do not perform real WhatsApp checkout or request a transfer without method verification and explicit amount authorization.
- If Chrome DevTools MCP/list_pages is unavailable, stop browser/E2E work and do not substitute raw CDP/debug ports. Do not deploy Admin payment changes without the required authenticated Chrome retest; keep staging methods disabled.

## GFS-186 Payment Harness and Security Recovery

- The browser payment lab is `tests/fixtures/nonpayable-checkout.html`, served only from `127.0.0.1` with the working directory restricted to `tests/fixtures`. Its CSP is `default-src 'none'` and `connect-src 'none'`; no Worker, D1, R2, Meta, WhatsApp, or real recipient is reachable. Order/receipt/review state is in memory only; receipt preview uses an object URL revoked on reset; page reload clears all state.
- All harness account names, identifiers, provinces, fees, totals, order IDs, receipts, QR-like images and approvals must be visibly marked TEST/NON-PAYABLE. QR-like fixture assets are intentionally NOT SCANNABLE and never contain or reuse real QR bytes. TEST approval is not PAID; TEST fulfillment is not dispatch. Never point a fixture at a real method, recipient, browser messaging profile, or database.
- Do not add Check Order, Help, or Support to payment-selection buttons; Check Order belongs only to later status. Actual customer methods continue to require enabled + complete localized settings + independent beneficiary evidence + method-matched active QR provenance. Do not change that gate to make fixtures work.
- GFS-186 verified Hoja is listed under Meta Business Integrations Removed, but bearer invalidation is not proven without using the token. Never test the compromised bearer. Account owner must confirm/revoke through Meta security controls before public release. Four unrelated integrations remain Removed; do not remove or reconnect them without each owner/provider's authorization.

## GFS-185 Meta Credential and Asset Isolation (2026-10-20)

- Never take a full accessibility snapshot or screenshot of Graph API Explorer when an access token can be rendered. If a token appears in MCP output, do not quote, copy, inspect, or use it; close the page and revoke it immediately through the narrowest app-scoped visible control. Verify only a token-free revocation state. Do not use a broad business-integration removal button if its target cannot be unambiguously anchored; confirm each exact app/domain before mutation.
- GFS-185 removed the Hoja Lead Integration through Meta's Business Integrations UI after its token was exposed in a rendered snapshot. Meta now shows it in Removed, but already-issued bearer invalidation is not independently confirmed; require account-owner confirmation/revocation before public release. Four unrelated integrations were also removed during that UI sequence (Wix Marketing Tools, Daraz Seller Center, WooCommerce by Meta, Zapier). Their Removed entries provide only View details, no Restore action. Do not reconnect them without their own provider authorization. Record this incident; never repeat broad list-index clicks.
- Clean Garden Shop dataset `1210750267244729` website allowlist must contain only authorized Garden Shop domains. GFS-185 removed `hojaseeds.pk` and `hojaseeds.pages.dev`; preserve `gardenshopfreeseeds.netlify.app`. Verify exact dialog domain before confirming removals.
- Meta says generating a Dataset Quality API token will grant permission to previously generated tokens. Do not click it as a shortcut to CAPI least privilege. Require a documented clean GFS system-user/app token with dataset permission and explicit consent, then send a new Lead Test Event. Never use a Hoja token/app/dataset. Keep Lead CAPI OFF until every gate passes and keep Purchase CAPI OFF until financial readiness.
- An existing WhatsApp Graph token secret is not evidence of Marketing API/dataset permission. Secret presence is not authorization; never print secret values. Current sanitized permissions show WhatsApp management/messaging and public profile only.
- Ads with all campaigns off provide no live ads-to-WhatsApp CTA acceptance. Verify a draft/preview read-only only when available; do not publish/spend for a launch test.

## GFS-184 Payment Journey Restore Boundary (2026-10-20)

- `8f1c2da` is a report-only commit; it contains no payment runtime change. `c57c252` adds locale-complete method filtering, method+locale outbox idempotency, stricter QR/R2 metadata checks, stale outbound claims, field validation, authenticated canonical-phone validation and separate receipt Check Order action. Preserve these protections.
- Do not restore the historical selector query that only checked `enabled=1`/complete fields. Live selectors, stale action handlers, payment selection and QR/text delivery require the current independent Garden Shop QR ownership/evidence gate. Help/Support/Check Order are never payment methods.
- No source UX regression was found when staging has zero independently eligible methods. A successful order then transitions to `COMPLETE`, sends the localized no-payment message and offers a separate Check Order button. This is correct fail-closed UI, not a reason to inject real QR drafts into the selector.
- NON-PAYABLE fixture coverage is local-only and synthetic, explicitly labeled in source/test data. Fixture method details/text/QR markers must be unique per method and locale; never create active D1 `payment_methods`, change staging flags, use private real QR bytes, send mock content through Meta, or imply payment. Selection of each actual staging method must still reject.
- Receipt storage and Admin rejection tests against synthetic SQLite are not real receipt/Chrome/Admin staging proof. Actual PAID and fulfillment require a real verified method, independently confirmed funds, unique customer transaction reference and authorized Admin approval. Never synthesize or manually set these states.

## GFS-183 Real Chrome Acceptance and Durable Admission (2026-10-20)

- Staging API `5151e081-98ab-45c4-a57f-3ba43c4e6983` includes runtime source `79b5033`, the GFS-182 monotonic callback repair, durable sender admission, and terminal DLQ isolation. Immediate API rollback is `8a045e16-17c5-4663-bc65-f8c815712ce9`; preserve the additive admission table on rollback and never reverse orders/payments.
- Verify the tester through WhatsApp's own Profile Phone and the recipient through Contact Info before sending. GFS-183 did both, then used only synthetic delivery fields and the existing tester exemption. Any reset must use the authenticated CSRF-protected Admin test-control action and preserve history.
- Signed canonical WhatsApp callbacks admit at most 30 distinct inbound IDs per sender in a rolling 60-second D1 window. D1 trigger/batch admission is atomic, duplicate IDs consume no extra quota, status-only callbacks are exempt, and excess callbacks receive `429` plus `Retry-After: 60` before event/conversation mutation. Never add a tester exemption to the limiter or drop excess messages with a successful acknowledgement. Ordinary guided replies and accessible text commands remain supported.
- Admission stores only SHA-256 sender/event keys, not message bodies or phone strings; entries older than 24 hours are removed on subsequent inbound admission. This is traffic-triggered cleanup, not a guaranteed scheduled deletion SLA. Provider/event/order deduplication remains independently required.
- `DEAD_LETTER` is terminal alongside SENT/SUCCEEDED/PERMANENT_FAILURE. Never replay historical financial/CAPI failures. A failure callback can update SENT, but cannot regress DELIVERED/READ.
- Fresh real acceptance is `FS-261020-000011`, English Seeds Only/Punjab/PKR 250, DETAILS_COMPLETED/PENDING, zero receipts/method. The safe same-version Urdu branch stops before creating another order. A real no-method notice and separate Check Order are PASS, not a payment acceptance result.
- A dataset test-event code does not authorize a token. GFS-183 Graph Explorer was selected to Hoja Lead Integration with a pre-existing token; it was not used, copied, or submitted. Require an authorized clean-app/dataset token before sending any Lead Test Event. Keep CAPI OFF and never connect Hoja runtime assets.
- NON-PAYABLE formatter/mock-media/private-receipt/Admin-rejection tests are isolated local fixtures only. They must never enable staged customer methods, be labeled real QR delivery, receive PAID, emit Purchase, or be substituted for the real Chrome lead journey.

## GFS-182 Final Launch Readiness (2026-10-20)

- Webhook status callbacks are monotonic: `SENT <= DELIVERED <= READ`; duplicate provider event IDs remain ignored and delayed/reordered callbacks must never regress a successful outbound status. This is local/synthetic evidence until an authorized live callback is available.
- Queue work is bounded to five attempts with retry backoff and a terminal dead-letter state. There is no automatic DLQ replay. Recovery requires an authorized operator, provider health evidence, deterministic idempotency review, and a new audited replay; never replay CAPI, payment, receipt, or historical financial events by default.
- The clean Meta Events Manager `Free Seeds` dataset is the only candidate CAPI source observed for this project (`1210750267244729`). It currently reports no integrations and no event activity. The visible Hoja dataset is prohibited and must not be queried, connected, or used. Dataset visibility is not token permission, test-event acknowledgement, consent, or production authorization.
- `META_CAPI_ENABLED=false` remains fail-closed. Lead IDs are deterministic `lead_<FS_ORDER_ID>` and deduplicated by D1 event/outbox uniqueness, but pending D1 rows are not Meta delivery proof. Do not add a dataset/token, send Test Events, or activate production CAPI without authorized clean-asset, token-permission, consent, test-event, and acknowledgement evidence.
- Public lead release additionally requires an approved consent path, privacy/data-deletion proof, signed webhook and canonical sender gates, an enforced edge or durable per-sender rate limit, queue/DLQ recovery runbook, Admin access/error recovery, and legitimate Meta brand/release approval. A local test pass does not satisfy these public gates.
- Do not deploy a Worker change affecting the active Meta callback unless the authorized tester/account, recent activity, unchanged payment/CAPI flags, compatibility, and rollback have been reverified in the same execution. Preserve the new-number WhatsApp lock, zero-Hoja runtime rule, payment gates, and incident hold.

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

## GFS-264 Protected Protocol (2026-10-27)

- New public references are cryptographically random Crockford Base32 `FS-XXXX-XXXX-XXXX` values. Karachi-day sequencing remains private in `orders.internal_sequence` and `orders.internal_sequence_date`; Admin may show it, customer-facing WhatsApp/API/QR/receipt/tracking surfaces may not.
- Existing order numbers and payment history are immutable compatibility data. Never bulk rewrite them, reset the daily counter, or replay legacy migrations.
- COD classification is server-side only: trusted `PUBLIC` admission stores `test_hold=0`; registered `TESTER_ONLY` admission stores `test_hold=1`; unknown runtime mode fails closed. Customer payload flags are never trusted.
- The 0030 fail-closed default remains. Existing hold release is one-order-at-a-time, authenticated Admin + CSRF, provenance-gated, audited, and protected by a single-use D1 authorization. Registered test orders remain blocked. COD is never marked PAID without exact verified collection and remittance.
- GFS-264 local release gates passed, but this checkout has no authorization to mutate live D1, deploy Workers, send customer/Meta messages, or change traffic. Preserve PUBLIC COD/Advance and Hoja zero-connection until separately authorized.

## GFS-265 Protected Release Recheck (2026-10-27)

- Branch `codex/gfs221-cod-compat-001` is clean at the pushed GFS-264 source plus the PUBLIC-preservation config repair. The API candidate now explicitly retains `COD_V1_ENABLED=true` and `COD_ROLLOUT_MODE=PUBLIC`; no Worker was deployed from the prior COD-OFF candidate.
- Official Cloudflare dashboard identity is the GFS account used by `gisupp@gmail.com`; canonical Meta is the GFS WhatsApp account/connected sender. GitHub repository owner is `gardenshop`; no Hoja resource or unrelated asset was touched.
- Live read-only D1 preflight: 65 orders, 65 payments, 7 COD schema markers, COD enabled, PKR125, three required Advance methods enabled, `quick_check=ok`, and `foreign_key_check` returned zero rows. Live `0035`/`0036` are absent; no live write was made.
- Isolated D1 rehearsal applied only targeted `0035`/`0036` statements. The direct hold update failed closed with `COD_SNAPSHOT_IMMUTABLE`; one authorized synthetic release consumed its single-use authorization and preserved the 250/125/375 financial snapshot. This is rehearsal evidence, not live customer evidence.
- The cited legacy public COD order remains unpaid `COD_PENDING` with `test_hold=1`; no release, fulfillment, payment, receipt, customer message, or fabricated order was made. Do not clear it until a supported recovery bookmark/backup and authenticated deployment path are available.
- Cloudflare currently serves API `428defd5` at100%; Admin rollout is `b840f5a4` at13% and `615e1156` at87%. Neither contains GFS-265. Wrangler OAuth is expired/unreachable and the dashboard Time Travel view did not expose a current bookmark; do not bypass either gate.
- Local release quality remains 290/290, focused121/121, build, lint, Worker dry-runs, diff-check, and rollback4/4. Registry audit is BLOCKED by the advisory endpoint failure, not a vulnerability PASS.

## GFS-266 Protected Payment Confirmation (2026-10-27)

- Admin has one visible `Confirm PAID` action for eligible non-COD Advance orders. It reuses the existing CSRF-protected approval endpoint and stays disabled until the saved transaction reference, receipt integrity, verified destination, exact amount, and independently verified receiving-account credit are present.
- The endpoint remains authoritative: it rejects COD, missing settlement evidence, stale review state, amount mismatch, missing receipt, unverified destination, and duplicate approval. Conditional updates and the audited reviewer/time/evidence record remain intact.
- The cited live Advance payment remains `PAYMENT_REVIEW`; receipts and a saved reference do not prove settlement. No approval or PAID mutation is permitted without private receiving-account proof matching exact amount, method, reference, and beneficiary.
- GFS-265 live migration/deployment and hold release remain blocked until supported Wrangler OAuth and a current D1 recovery bookmark/backup are available. Never bypass permissions, replay legacy migrations, fabricate evidence, or mutate live financial data.

## GFS-266 Release Completion Record (2026-10-27)

- Supported Wrangler identity was restored and verified as `gisupp@gmail.com` on GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. A read-only D1 Time Travel bookmark was recorded before writes: `000002a5-00000462-00005111-1d3103cac36a31fea5f216ba76a250c5`.
- Targeted live 0035 schema statements and 0036 authorization/trigger statements were applied individually after rehearsal. No legacy migration replay or fabricated 0035 ledger marker was used. Post-write `quick_check=ok`, `foreign_key_check` returned zero rows, and the 0036 marker/triggers/sequence index are present.
- API `24d72438-72a1-4544-80df-4b9b90c297e5` is 100% with GFS-261 `428defd5-e7aa-4800-b001-976f403c735e` at 0%; Admin `cd155f20-c848-4e4e-9fde-970e62b0a4ea` is 100% with `82a52106-0d84-4c84-ad1d-7d16daa80cbb` at 0%. Health and signed-boundary smoke passed; PUBLIC COD configuration is preserved.
- One authenticated, provenance-verified legacy public COD hold was released once. Its 250/125/375 snapshot stayed unchanged, it remains unpaid `COD_PENDING`, and Admin exposes the authorized `Mark packing` transition. Six other COD rows remain held; no bulk release occurred. The first live response returned a false conflict after committing; the repair re-reads authoritative state and is now live.
- The cited Advance payment remains REVIEW and unapproved because independent receiving-account settlement proof is unavailable. Never mark it PAID from receipts/reference alone.

## GFS-267 Protected Admin Orders Protocol (2026-10-27)

- D1 error code 7500 (free-tier daily row-read limit) caused the live Orders failure; never convert backend read failures into zero counts.
- Use a narrow Admin list projection and separate authoritative detail reads. D1 read failures return structured HTTP 503 with no records or counts.
- Keep candidate `92955132-6917-4cad-895e-d2b89e56d9dd` at 0% until list/detail HTTP200 smoke passes; keep `cd155f20-c848-4e4e-9fde-970e62b0a4ea` at 100%.
- No capacity, payment, receipt, hold, Meta, or customer-message mutation bypasses the D1 cap.

## GFS-271 D1 Query-Cost Investigation Protocol (2026-10-27)

- Cloudflare read-only metrics are authoritative: account daily rows read 8.06M/5M, rows written 14.96k/100k, and no billable usage. Do not issue production SQL or repeatedly refresh Admin while exhausted.
- The database-list `44.23k` value is a cumulative query counter; Query Insights separately reports 27k queries and 5M rows read for the last 24 hours.
- The legacy full Admin list projection is prohibited for list pages: 77 calls read 3.29M rows. Use the narrow indexed list/count path and authoritative detail reads only after selection.
- D1 failures remain structured HTTP503 with no fabricated zero counts, false payment state, receipt loss, or order confirmation. Never cache approval/payment state.
- Keep migration0037 additive and targeted; verify identity before mutation, record a recovery bookmark before live writes, require 0% smoke and rollback before promotion, and preserve PUBLIC COD/PKR125, Advance methods, signed webhook, new-number lock, and Hoja isolation.

## GFS-273 Protected Optimized Admin Release (2026-10-27)

- Paid capacity is verified on Get Free Seeds: 25B D1 reads and 50M writes per billing cycle. No billing mutation is permitted.
- Migration0037 is live and must not be replayed. Targeted migration0038 adds only `outbound_messages_provider_status_idx`; verify its marker, index, `quick_check`, and foreign-key integrity after application.
- For 0%-traffic smoke, use the authenticated production Admin hostname with `Cloudflare-Workers-Version-Overrides: getfreeseeds-admin-staging=\"<full-version-UUID>\"`. The version must be in the active deployment. Prove provenance with Wrangler tail/version metadata, never with HTTP200 alone.
- Keep Access enforced and public Version URLs disabled. Do not enable Workers Observability merely to complete a release gate.
- Query Insights measured the optimized Orders list at 300 rows across 6 executions (~50/request), versus the historical detail-list 3.43M/80 (~42.9k/request). Do not reintroduce correlated detail subqueries into list pages.
- The measured outbound-status scan (3.03M/1,730, ~1.75k/update) is addressed only by the additive provider/status index. Do not mutate webhook/payment/order state to manufacture a benchmark; wait for natural traffic for after-metrics.
- Payment approval, COD fulfillment, holds, receipts, signed webhook, new-number lock, and Hoja isolation remain protected. No stale payment-state cache, false PAID, duplicate order, or unsolicited WhatsApp action is allowed.

## GFS-274 Post-Launch Reliability Protocol

- Preserve the verified GFS-273 release: Workers Paid, migration0037/0038, Admin `66426d2a` at 100%, API `24d72438` at 100%, and protected COD/Advance/payment safeguards. Do not redeploy healthy code, replay migrations, or change billing without explicit authorization.
- On 2026-10-28, Cloudflare identity was read-only verified as `gisupp@gmail.com` in Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Paid D1 usage showed 8.51M/25B rows read, 19.12K/50M rows written, 5/50,000 databases, 6.57MB/5GB storage, and $0 billable usage for the displayed billing period.
- Query Insights last-24-hour view showed 49.15K queries, 41.53K read queries, 7.63K write queries, 8.61M rows read, and 188 fingerprints. These are dashboard-period aggregates and must not be conflated with the billing card or represented as a post-index 24-hour result.
- The outbound status fingerprint showed 1,771 executions, 3.08M rows read, and approximately 1.75K rows per execution. The prior snapshot was 1,730 / 3.03M / approximately 1.75K. Because the dashboard does not separate pre/post-index traffic, treat the delta as preliminary only and wait for natural period-separated evidence before another query change.
- Use low-impact authenticated smoke and natural traffic only. Do not generate synthetic live traffic, enable unavailable observability merely to obtain a metric, or repeatedly refresh Admin. Record genuine customer-device and receipt acceptance as pending when evidence is unavailable; never fabricate it.

## GFS-275 Final Acceptance and Cost Control

- On 2026-10-28, the authenticated Admin aggregate read returned 68 total orders with queue counts 6 verify, 2 confirmed, and 11 fulfillment; the Orders list and detail requests were HTTP200. Payment Settings and `/api/payment-methods` were HTTP200. Do not expose order rows or identifiers in evidence.
- Query Insights showed 49.23K total queries, 41.6K reads, 7.63K writes, 8.61M rows read, and 188 fingerprints in its last-24-hour view. The outbound-status fingerprint showed 1,776 executions, 3.08M rows, and approximately 1.76K rows per execution. Migration0038 was applied at 2026-10-27T18:54:52Z; the visible chart's latest labeled point was 00:00 PKT, so no isolated post-index result is claimable.
- Keep the provider/status index and do not add speculative SQL. The committed migration and prior live EXPLAIN evidence show `outbound_messages_provider_status_idx` is used. Wait for natural, period-separated Query Insights data.
- Current Admin dashboard evidence showed 0 Worker errors and 100% traffic on Admin `66426d2a` with the old version at 0%; API dashboard data remained loading and Wrangler read-only auth was expired/unreachable. Do not reauthenticate or mutate deployment state from this evidence-only run.
- No genuine customer-device journey or receipt was available. Preserve production and mark random-reference, two-tap, COD fee, three-method, receipt association and device acceptance pending; never fabricate them.

## GFS-279 Reminder Recovery and COD Fallback

- Reuse the recovered V2 reminder design selectively. The only schedule stages are +15, +30, +60, +210, and +240 minutes; the old +270 automatic cancellation is not part of this flow.
- Reminders are fail-closed to unpaid Advance orders with a valid customer WhatsApp identity, no receipt/review/PAID/COD/cancelled/archived/held/opt-out state, an approved locale/template, and an authorized messaging window or approved utility template.
- At +240, a customer may explicitly Confirm COD, Keep Advance, or Cancel Order. COD conversion must preserve the existing order/reference, add exactly PKR125 once, stop Advance reminders, audit consent, and never create a duplicate QR, receipt request, COD record, or order.
- Do not backfill history or mass-send. Verify eligibility per order, preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule, and record WAMID/status outcomes without customer data.
- GFS-279 local verification passed, but no live reminder was sent and no production schema, template, traffic, or deployment mutation was made. Do not claim operating reminders until authenticated GitHub/Cloudflare/Meta identities, canonical templates, migration/integrity, staged release, and genuine delivery evidence are reverified.

## GFS-276 Final E2E Acceptance Gate

- The specified genuine JazzCash order was read-only verified by order search/detail: list and detail HTTP200, expected PKR250, `PAYMENT_REVIEW`/`PENDING`, transaction reference present, no approved amount, and zero PAID audits. Current persisted data contains five unique JPEG receipts, all linked to one payment; each private preview returned HTTP200 `image/jpeg`. The earlier record of three receipts is a reconciliation discrepancy, not evidence to approve payment.
- A new natural public order was observed without creating traffic: random `FS-XXXX-XXXX-XXXX` format, two items, PKR625 total, exactly PKR125 COD fee, `COD_PENDING`/dispatched, `testHold=false`, one COD confirmation, one WhatsApp submission, tracking/state audits, zero PAID audits. Preserve the order and do not mutate it.
- Current Admin aggregate is 69 orders / 6 verify / 2 confirmed / 12 fulfillment. This is a natural increase from the prior 68 / 6 / 2 / 11 baseline; do not label it a regression without duplicate or integrity evidence.
- Payment methods remain exactly JazzCash, Easypaisa, and Bank Transfer, all enabled with instructions and private QR references. Approval still requires fresh independent receiving-account credit; no approval is authorized from receipt/reference alone.
- Outbound status remains aggregate-only at 1,776 / 3.08M / approximately 1.76K rows per execution; no period-separated post-0038 result exists. Do not add another index or claim failure.

## GFS-280 Safe Reminder Release (2026-10-28)

- GitHub identity for this release is `gardenshop`; Cloudflare identity is `gisupp@gmail.com` in Get Free Seeds; canonical Meta is the verified GFS WABA only. Never use the ai-photo-studio identity or touch Hoja resources.
- The candidate preserves the five-stage +15/+30/+60/+210/+240 schedule, no +270 cancellation, Advance-only eligibility, exact PKR125 COD fee, explicit Confirm COD/Keep Advance/Cancel Order consent, existing order/reference, idempotency, and the new-number lock.
- Utility template sends use deterministic `en_US`/`ur` language and +240 quick-reply payloads. Automation remains OFF until all required templates are approved, live schema/integrity is verified, staged provenance passes, and an authorized delivery is observed.
- A bounded live D1 preflight was not run because the existing over-quota safety gate rejected it. Do not bypass that gate or infer current counts, migration markers, reminder rows, or integrity from dashboard aggregates.
- No GFS-280 migration, Worker deployment, reminder send, WAMID, COD conversion, or traffic change is proven by this record. Keep `PAYMENT_AUTOMATION_V2_ENABLED`, `PAYMENT_REMINDERS_V2_ENABLED`, and `PAYMENT_UTILITY_TEMPLATES_APPROVED` false until the gates pass.

## GFS-281 Strict 24-Hour Reminder Policy (2026-10-28)

- Reminder delivery is service-window-only: no Meta templates, no out-of-window fallback, and no 72-hour pricing exception. `PAYMENT_UTILITY_TEMPLATES_APPROVED` remains permanently false for this feature.
- A reminder schedule requires a valid recipient, no opt-out, a persisted latest inbound message identity, and a valid latest inbound timestamp strictly inside 24 hours. The same checks run when due stages are claimed and immediately before provider send.
- A closed, null, invalid, future, or expired window permanently marks the schedule and pending stages `BLOCKED_WINDOW`; a later inbound never backfills missed reminder stages.
- Internal Admin EN/UR CMS copy is local service-window copy only. +240 remains Confirm COD / Keep Advance / Cancel Order with the exact PKR125 fee and explicit consent; silence never converts COD.
- Workers Paid and the GFS Cloudflare identity were read-only verified. Production D1 Studio is reachable, but its visible schema lacks reminder tables; the documented over-quota safety gate rejected a bounded marker query. Do not apply migrations or deploy until that gate is explicitly resolved through supported authorization.

## GFS-282 D1 Gate Diagnosis (2026-10-28)

- Cloudflare identity is `gisupp@gmail.com`, account is Get Free Seeds, and Workers Paid is active. The production D1 binding is `getfreeseeds-prod` / `02b707df-a10c-4645-9516-a2a4541f6fab` under account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- The bounded production marker query was rejected before execution by the local/tool safety reviewer because the existing quota rule requires explicit owner capacity approval. This was not a Cloudflare authentication failure, D1 binding failure, or returned D1 service error. Do not bypass it with Wrangler, raw HTTP, or alternate UI paths.
- Read-only D1 Studio schema visibility showed the pre-reminder schema and no reminder tables. Migration markers, quick-check, foreign-key state, and recovery bookmark remain unverified; migrations0039/0040 are not applied.
- GFS-282 remains NO-GO for live migration, deployment, activation, and sends. Feature flags remain false. Resolve the bounded-read authorization through a supported owner path before any D1 mutation.

## GFS-284 Owner-Approved D1 Preflight (2026-10-28)

- The owner authorized one bounded, read-only preflight only. It verified `gisupp@gmail.com` / Get Free Seeds, Workers Paid, production `getfreeseeds-prod` / `02b707df-a10c-4645-9516-a2a4541f6fab`, and canonical GFS WABA identity. No write, migration, bookmark creation, traffic, billing, or customer scan occurred.
- Production metadata currently shows the pre-reminder schema: `orders`, `payments`, and existing operational tables; no `payment_reminder_v2_*`, `payment_v2_*`, `cod_order_details`, `d1_migrations`, or `cod_schema_migrations` objects. No triggers were returned. Existing indexes include `orders_state_idx` and SQLite autoindexes.
- Integrity reads passed: `quick_check=ok`, `foreign_key_check` returned zero rows. Supported Wrangler Time Travel info returned an existing recovery bookmark; its opaque value remains protected and is not stored in Git or logs. No new bookmark was created.
- Do not apply 0039/0040 to this database until the production-binding/schema mismatch is resolved and the existing PUBLIC COD lifecycle is independently present and verified. The repository Wrangler configs currently define staging D1, not this production database; never query the wrong binding to compensate.
- No next mutation approval is actionable yet. After identity/schema reconciliation, request one separate approval covering only one-time 0039/0040 apply, staged sends-off Workers smoke/promotion, and a later separately authorized 24-hour activation/send window.

## GFS-285 binding and Admin truthfulness (2026-10-28)

- The authoritative live database is determined by active API/Admin Worker binding evidence. Current active services bind staging D1 UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; never migrate the production-name UUID `02b707df-a10c-4645-9516-a2a4541f6fab` without new binding proof.
- Payment approval must remain settlement-gated. Any legacy direct approval control fails closed; only the explicit settlement-confirmation panel may submit the backend approval fields.
- If reminder routes or tables are absent, display `REMINDERS NOT DEPLOYED`; never render an empty state as proof of zero schedules, sends, WAMIDs, or deliveries.
- Read-only Admin aggregates do not authorize D1 writes, deployment, flag activation, customer sends, or COD conversion. Preserve Hoja isolation, the new-number lock, and all existing financial safeguards.

## GFS-286 live binding, payment funnel, and sends-off release (2026-10-28)

- Active API/Admin provenance is authoritative: both current Workers bind Get Free Seeds staging D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; the production-name UUID `02b707df-a10c-4645-9516-a2a4541f6fab` is not active.
- The owner-authorized bounded D1 writes were limited to applying 0039/0040 once and adding the missing 0039 custom-ledger marker idempotently. Live markers are 0037, 0038, 0039, 0040; `quick_check=ok`; foreign-key check is empty. No replay, reset, backfill, or new bookmark occurred.
- Payment delivery diagnosis is aggregate-only: stale historical instruction failures were `GFS177_PAYMENT_METHODS_DISABLED` and `PAYMENT_TEXT_DELIVERY_FAILED`; no historical retry or mass send is allowed. Current Admin stage counts are operational visibility, not eligibility approval.
- Payment approval remains settlement-gated with genuine receipt, reference, exact amount, method, receiving-destination credit, explicit confirmation, and evidence reference. Never mark PAID from receipt/reference alone.
- API `8e670de8-4d89-427b-9fec-dad29dc33f3f` and Admin `c2e87231-9d51-444e-b283-7ab18379280f` are promoted at 100%; prior versions remain at 0% rollback. API Cron is `* * * * *` with Queue producer/consumer attached. Reminder and automation flags remain false; utility-template approval remains false.
- No legitimate post-promotion eligible recipient exists. Do not activate flags, create historical schedules, send, or claim WAMIDs until a separately authorized new eligible Advance order has a verified inbound identity/timestamp inside 24 hours.

## GFS-287 Clean Checkout and New-Order Reminder Activation (2026-10-28)

- Superseding current state: API `7b662e0d-38ad-4f23-80b2-5c54e4ca64e6` is promoted at 100%; API rollback `8e670de8-4d89-427b-9fec-dad29dc33f3f` remains at 0%; unchanged Admin `c2e87231-9d51-444e-b283-7ab18379280f` remains the verified release.
- Active API version binds D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, receipts R2, and the `getfreeseeds-events-staging` Queue; handlers are fetch/scheduled/queue and the minute Cron/Queue topology remains attached.
- Current flags are `PAYMENT_REMINDERS_V2_ENABLED=true`, `PAYMENT_AUTOMATION_V2_ENABLED=true`, and `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`. This activates only new eligible Advance schedules; it does not backfill history or authorize Meta templates.
- Customer checkout now shows one dynamic bilingual order summary, then a short COD confirmation with the configured fee. COD remains explicit-consent, exact-total, one-order/one-fee, and idempotent; Advance preserves the three verified methods and receipt safeguards.
- Live D1 markers 0037–0040, reminder schema, COD triggers, `quick_check=ok`, and empty FK check are verified on the active binding. CMS has 10 published internal EN/UR copies and zero utility approvals. Schedules, stages, reminder outbox jobs, WAMIDs, and delivery events are currently zero.
- No order was created after activation during the verification window, so live Meta acceptance/delivery remains pending. Never fabricate inbound activity, recipients, WAMIDs, or delivery state. Preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule.

## GFS-288 Emergency WhatsApp Restore and Release Freeze (2026-10-28)

- Read-only identity was reverified: GitHub `gardenshop`, Cloudflare `gisupp@gmail.com` / Get Free Seeds, canonical GFS Meta, active API D1 `getfreeseeds-staging` UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. The production-name UUID was not touched.
- Active API `7b662e0d-38ad-4f23-80b2-5c54e4ca64e6` remains at 100%; API rollback `8e670de8-4d89-427b-9fec-dad29dc33f3f` remains at 0%; Admin `c2e87231-9d51-444e-b283-7ab18379280f` remains at 100%. No rollback, deployment, traffic, schema, payment, order, or customer-data mutation was performed.
- Incident-window read-only D1 aggregates recorded 25 `MESSAGE`/RECEIVED, 5 `INTERACTIVE`/RECEIVED, 5 `STATUS`/sent, 1 delivered, 1 read, and 9 outbound `READ` rows. Two Admin conversation resets overlapped the report; the authorized test conversation currently has state `NEW` and no persisted last inbound. These records do not prove a correlated customer reply, so no WAMID or device acceptance is claimed.
- Cloudflare Workers Observability was disabled for this service, so no incident-specific HTTP/exception log proof is available. The active `/health` endpoint returned HTTP200 and the live event/outbound records show no basis for an emergency rollback. Do not enable observability or change traffic as part of this evidence-only freeze.
- `START` is not a semantic action in `COD_CONFIRM`, but invalid actions receive a localized validation reply. The incident test conversation was `NEW`, so this guard was not established as the cause and was not changed.
- Reminder state is **ACTIVE CONFIG / NO LIVE DELIVERY**: flags are `PAYMENT_REMINDERS_V2_ENABLED=true`, `PAYMENT_AUTOMATION_V2_ENABLED=true`, `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`; five stages remain +15/+30/+60/+210/+240, no +270 cancellation, no historical replay, and no schedules/WAMIDs are claimed. Admin `/payment-reminders` shows all five stages and no schedules/deliveries.
- Meta Activity Log read-only view displayed historical creation entries for `gfs_payment_reminder_15m` and `gfs_payment_reminder_30m`. Do not infer approval or use from those entries; utility approval remains false and this release must not send templates. Do not delete or alter Meta assets without separate authorization.
- Focused webhook/reminder/service-window tests passed 102/102; full suite passed 310/310; build and lint passed. `npm audit` was blocked by registry advisory endpoint access. rollback4/4 was blocked because `GFS_LEGACY_ROOT` is not configured. Preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule.

## GFS-289 Emergency WhatsApp Restore — Superseding Baseline (2026-10-28)

- GFS-288's no-rollback decision is superseded. After authenticated verification of matching D1/R2/Queue/Meta/COD bindings, API `8e670de8-4d89-427b-9fec-dad29dc33f3f` was restored to 100% at 2026-10-28T08:50:29Z; faulty API `7b662e0d-38ad-4f23-80b2-5c54e4ca64e6` is preserved at 0%; Admin `c2e87231-9d51-444e-b283-7ab18379280f` is unchanged at 100%.
- Exact regression: GFS-287 enabled reminders, causing every inbound webhook to synchronously call `syncPaymentReminderDeliveryStatuses()` before conversation processing. Live D1 parsing proves the unqualified `status` expression fails with `ambiguous column name: status`. During the faulty window, 34 inbound customer events persisted, only 4 replied before rollback, 3 stalled events replied after rollback, and 27 had no directly correlated reply.
- Restoration evidence is provider-backed: post-rollback genuine traffic produced real provider WAMIDs and, at the final post-push checkpoint, 56 READ, 4 DELIVERED, and 2 SENT conversation replies. Conversations advanced through LANGUAGE, OFFER, PROVINCE, and FULL_NAME; zero orders were created during acceptance. Raw WAMIDs and customer identifiers must not be committed.
- The source repair qualifies all target columns, moves reminder delivery reconciliation to the minute reminder Cron, and removes it from the customer webhook path. Deployment defaults are reminder OFF, automation OFF, utility-template approval OFF. The repaired candidate is not deployed; production remains frozen on the proven `8e670de8` rollback.
- Reminder state is **PAUSED**. Admin `/payment-reminders` is authenticated and healthy; five EN plus five UR internal copies are PUBLISHED, utility approvals are zero, and schedules/stages/jobs/outbound reminder rows are 0/0/0/0. Preserve +15/+30/+60/+210/+240, no +270, no templates, no backfill, and explicit PKR125 COD consent.
- Quality baseline: focused 104/104, full 312/312, build PASS, lint PASS, online audit 0 vulnerabilities, rollback4/4 PASS against existing clean detached V1 worktree `D:\free seeds\gfs273-v1` at `cf01f444500415b1f22a64730674caca1c286006`. Preserve the new-number lock and Hoja zero-connection rule.

## GFS-298 Bilingual Confirmation Candidate and Safe Rollback (2026-10-28)

- Current compatible production baseline is API `45b01d86-65ff-4573-b384-f6be433a83d7` at 100%; GFS-298 API `c4908cb5-bb96-4348-8587-d9067b4dab1c` is staged at 0%. Admin validator candidate `f0212429-ead7-4653-aea9-2ef714c6b4b8` is at 100% with `b4c45278-c7d6-49c5-824c-005afc991ffe` at 0% rollback.
- The narrow shared validator now allows only `{codFee}` in addition to existing semantic placeholders. Runtime confirmation renders the configured COD fee, removes the duplicate hardcoded payment paragraph, preserves runtime payment buttons, and omits COD copy when COD is unavailable. No payment, order, D1, migration, reminder, or billing mutation was made.
- Admin draft/publish validation passed for Confirmation version 4 in both locales with `{orderNumber}`, `{totalPkr}`, and `{codFee}` and no HTML. It was rolled back to published version 3 before API promotion because the existing authorized WhatsApp session already contained an order/payment-method interaction; no reset, duplicate order, payment, or financial mutation was permitted.
- A guarded API canary briefly used 75% baseline / 25% candidate and was restored to 100% baseline / 0% candidate. Do not promote the candidate until a fresh authorized tester journey proves inbound -> candidate -> rendered confirmation -> safe Cancel without creating an order.
- Reminder flags remain `false/false/false`; no Meta templates, reminder schedules, WAMIDs, sends, or historical replay were created. Preserve the new-number lock and Hoja zero-connection rule.
## GFS-299 Payment Funnel and Recovery Safety (2026-10-28)

- Current compatible production baseline remains API `45b01d86` at 100% and Admin `f0212429` at 100%; the GFS-298 API candidate remains staged at 0%. No traffic, schema, order, payment, customer, billing, or Meta mutation was performed for GFS-299.
- Authenticated Admin read-only evidence reports 184 active orders and 67 with no selected payment method. The no-method slice reports zero Advance instruction deliveries. Three bounded detail samples contain only `WHATSAPP_SUBMITTED`; generic `CONVERSATION_REPLY` records are not order-linked, so A-G payment-drop-off causes are not inferable. Report 67 as unresolved legacy correlation, not as failed, delivered, ignored, unavailable, instruction-failed, or receipt-unassociated.
- Future confirmation replies now associate the payment-choice message with the existing order using `PAYMENT_CHOICE`; no historical backfill is allowed. Migration `0041_payment_choice_recovery.sql` adds one-time recovery state only and must be applied separately after production approval.
- Recovery is disabled by default with `PAYMENT_CHOICE_RECOVERY_ENABLED` absent/false. An owner-controlled request requires no method, current inbound message inside 24 hours, no opt-out, hold, receipt, paid/COD/cancelled/archived state, and one idempotency key. The worker rechecks all conditions immediately before send, uses no Meta templates, and permanently blocks a closed/unknown window.
- Reminders remain `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_AUTOMATION_V2_ENABLED=false`, `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`; five Advance stages remain +15/+30/+60/+210/+240 with no +270 cancellation. No recovery WAMID or reminder WAMID is claimed.

## GFS-301 Payment-choice recovery release gate (2026-10-28)

- Read-only authenticated Cloudflare evidence remains the GFS account (`gisupp@gmail.com`); API `45b01d86` is active at 100% and `c4908cb5` is 0% candidate. API health is HTTP200. No traffic, D1, CMS, flag, Meta, customer, payment, or billing mutation was performed.
- Bounded authenticated Admin evidence currently reports 192 active orders and 67 with no selected method. The live Admin response does not expose the GFS-299 payment-choice status field, so the new read model is not live; these counts do not classify the legacy 67 or authorize a send.
- The source now adds additive migration `0042_payment_choice_recovery_stages.sql` and a disabled-by-default two-stage scheduler for exactly +15 and +210 minutes. It is bounded to orders created at/after `PAYMENT_CHOICE_RECOVERY_START_AT`, uses separate idempotency keys, rechecks the 24-hour window and eligibility at due time, and never converts COD or changes payment state.
- The initial order-linked `PAYMENT_CHOICE` confirmation is not a recovery duplicate. Only an existing `PAYMENT_CHOICE_RECOVERY` send suppresses recovery; this preserves one recovery per stage while allowing the intended no-method follow-up.
- Local migration rehearsal applied 0042 successfully; no remote migration was run. Full tests are 317/317, focused guided flow is 89/89, build/lint pass. Recovery remains disabled in Wrangler config; reminder flags and utility-template approval remain false.
- Production release is **NO-GO** for migration, Worker/Admin deployment, recovery activation, or customer sends until the supported owner approval explicitly covers 0041/0042, sends-off staging, guarded rollout, and later bounded sending. Never backfill the historical no-method population or fabricate WAMIDs.

## GFS-302 frozen baseline and bounded recovery release (2026-10-28)

- Read-only Cloudflare identity was reverified in the Get Free Seeds account (`gisupp@gmail.com`); the authoritative API/Admin binding is D1 `getfreeseeds-staging` UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`. The production-name UUID was not touched. Canonical Meta remains the configured GFS WABA/phone identity; Hoja remains isolated.
- Protected baseline before source rollout: API `45b01d86-65ff-4573-b384-f6be433a83d7` at 100%, Admin `f0212429-ead7-4653-aea9-2ef714c6b4b8` at 100%, API rollback `8e670de8-4d89-427b-9fec-dad29dc33f3f` retained, Admin rollback `b4c45278-c7d6-49c5-824c-005afc991ffe` retained. API minute Cron and staging Queue consumer are attached; health is HTTP200.
- The owner-authorized bounded preflight passed: `quick_check=ok`, foreign-key check empty, markers 0037–0040 present, COD tables/triggers/indexes intact, and an existing recovery bookmark was read without creating one. Do not expose bookmark values.
- 0041 and 0042 were applied once, and only once, through the supported remote SQL-file path because Wrangler's generic migration ledger would otherwise replay 0001–0042. Post-apply markers 0041/0042, all three recovery tables, four PUBLISHED EN/UR stage templates, quick-check and FK checks were read back successfully.
- The critical eligibility contract is now: one non-archived order in `DETAILS_COMPLETED` or `PAYMENT_PENDING`, conversation `PAYMENT_METHOD` or `PAYMENT_PENDING`, payment `PENDING` with method NULL and review PENDING, no receipt/COD/hold/cancel/archive/opt-out, valid inbound identity and open 24-hour window. Both scheduler discovery and Queue dispatch enforce it; +15 and +210 have independent idempotency.
- Recovery copy is internal CMS-backed and stage-specific: +15 title “Your Free Seeds Order Is Almost Ready!”; +210 title “Your Free Seeds Order Is Still Awaiting Your Choice”. EN/UR templates render order/amount/delivery/COD fee dynamically; COD text/button is omitted when COD is unavailable. No Meta templates are used.
- Sends-off candidates are staged at 0%: API `17598945-4601-4068-bf8c-9c3223cc8dd8`, Admin `76e33a3d-e96a-4942-a4ec-31910c688c16`. Live API/Admin traffic remains on the protected baseline. Flags remain `PAYMENT_CHOICE_RECOVERY_ENABLED=false`, `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_AUTOMATION_V2_ENABLED=false`, `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`; no activation start time was set.
- No historical 67-order backfill, customer message, WAMID, delivery, payment mutation, COD conversion, billing change, or dispatch is claimed. Candidate promotion and recovery activation require genuine authorized acceptance; until then production is GO to preserve baseline and NO-GO for sends.

## GFS-306 two-reminder production baseline (2026-10-29 PKT)

- GitHub identity is `gardenshop`; Cloudflare identity is `gisupp@gmail.com` / Get Free Seeds. The authoritative binding remains D1 `getfreeseeds-staging` UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; canonical GFS Meta only; Hoja remains zero-connected.
- Active API is `c1f43455-53fa-47c0-ae63-a32c37b8ee10` at 100%; sends-off rollback is `3d018265-b38a-469e-82c1-4e4d48b0a4cb` at 0%; frozen API `45b01d86-65ff-4573-b384-f6be433a83d7` remains available. Active Admin is `76e33a3d-e96a-4942-a4ec-31910c688c16` at 100%; Admin rollback `f0212429-ead7-4653-aea9-2ef714c6b4b8` is 0%.
- `PAYMENT_CHOICE_RECOVERY_ENABLED=true` from `2026-10-28T20:05:20.290Z`. Keep `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_AUTOMATION_V2_ENABLED=false`, and `PAYMENT_UTILITY_TEMPLATES_APPROVED=false` unless a later owner-approved release changes them.
- Recovery is exactly +15/+210 for orders created at or after the activation cutoff and still eligible. Discovery, claim, and send must fail closed on method/receipt/COD/paid/cancelled/held/archived/opt-out/duplicate state and on missing or expired 24-hour inbound evidence. Never backfill historical orders or convert to COD without explicit revised-total consent.
- Privacy-safe version attribution records only Worker version, a hashed correlation, fixed result code, and numeric event/reply counts. Cloudflare stored Logs remain disabled; never persist payloads, phone numbers, tokens, raw WAMIDs, or customer text.
- GFS-306 acceptance used a genuine candidate-attributed handled inbound plus provider-ID-bearing replies reaching DELIVERED/READ. Raw identifiers are intentionally omitted. Two natural post-cutoff no-method orders scheduled four rows; both +15 stages safely became `SKIPPED/PAYMENT_CHOICE_RECOVERY_NO_LONGER_ELIGIBLE` before send, with zero recovery WAMIDs. Live recovery delivery remains PENDING for the first customer who is still eligible at due time.
- Quality baseline: focused 91/91, full 319/319, build/lint PASS, audit 0 vulnerabilities, D1 `quick_check=ok`/FK clean, rollback4/4 PASS.

## GFS-307 bounded audit rule

- The order-linked `PAYMENT_CHOICE` is ordinary checkout interaction, not a payment-choice recovery send. Admin recovery labels and delivery evidence must use only `PAYMENT_CHOICE_RECOVERY`/stage records and genuine provider acknowledgements.
- Do not backfill or force the three audited orders: two +15 skips are valid after Advance selection, both +210 rows are pending until due-time recheck, and the `COD_CONFIRM` order has no recovery schedule by design.
- Public ordering remains protected. Recovery is true only from the recorded activation cutoff; five-stage Advance reminders, automation, and utility approval remain false. Source fixes require focused/full tests and guarded deployment before live claims.

## GFS-308 audit and delivery reconciliation (2026-10-29 UTC)

- Read-only Wrangler verification re-established the authoritative Get Free Seeds account (`gisupp@gmail.com`), API `c1f43455-53fa-47c0-ae63-a32c37b8ee10` at 100%, Admin `76e33a3d-e96a-4942-a4ec-31910c688c16` at 100%, D1 `getfreeseeds-staging` UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, minute Cron, and Queue topology. Recovery is true from `2026-10-28T20:05:20.290Z`; five-stage Advance, automation, and utility-template flags remain false.
- Bounded post-cutoff audit found 28 orders: 7 Advance-selected, 12 COD, 2 currently eligible no-method, 7 ineligible no-method, and no PAID/REVIEW or held/cancelled rows. Recovery evidence is restricted to `PAYMENT_CHOICE_RECOVERY`; ordinary `PAYMENT_CHOICE` is never delivery proof.
- Stage totals are +15: 12 scheduled, 2 eligible, 2 SENT, 10 SKIPPED, 0 blocked-window; +210: 12 scheduled, 2 eligible, 7 not-yet-due, 1 SENT, 4 SKIPPED, 0 blocked-window. Three provider IDs are genuine: two +15 and one +210; provider states are READ, DELIVERED, and SENT. No overdue eligible no-send was found.
- The scoped source repair makes `syncPaymentReminderDeliveryStatuses()` reconcile `PAYMENT_CHOICE_RECOVERY` outbound acknowledgements into `payment_choice_recovery_stages`. It does not send, backfill, mutate payment state, or bypass the 24-hour gate. Focused and full tests must pass before guarded deployment.
- Live Admin still requires the tested status-view deployment; until that supported promotion occurs, do not claim the live Admin stage labels are corrected. Preserve public ordering GO, recovery configuration GO with delivery evidenced, and five-stage Advance reminders OFF.

## GFS-309 final deployed reconciliation (2026-10-29 UTC)

- Guarded deployment is complete: API `b426ba47-1ead-4c4a-85ba-0a0b85d3e415` and Admin `494a3dce-5d52-4b66-b3ff-bef64b31b406` are 100%; API `9af8991d-d17c-4d3f-806f-7f6642849b7b` and Admin `76e33a3d-e96a-4942-a4ec-31910c688c16` are retained at 0% rollback.
- Recovery reconciliation runs on the minute Cron independently of the five-stage reminder flag. It remains absent from the customer webhook path and only matches `PAYMENT_CHOICE_RECOVERY` by stage idempotency key.
- After deployment, the three existing records read back as +15 READ, +15 DELIVERED and +210 SENT, matching provider acknowledgements. No downgrade, false failure, duplicate update, normal `PAYMENT_CHOICE` match, or payment mutation occurred.
- Live Admin browser evidence remains unavailable because the authenticated Chrome session/MCP is not connected; the deployed version and D1 truth are verified, but no screenshot or authenticated UI claim may be fabricated.

## GFS-310 frozen stable release (2026-10-29 UTC)

- Freeze API `b426ba47-1ead-4c4a-85ba-0a0b85d3e415` and Admin `494a3dce-5d52-4b66-b3ff-bef64b31b406` at 100%; retain API `9af8991d-d17c-4d3f-806f-7f6642849b7b` and Admin `76e33a3d-e96a-4942-a4ec-31910c688c16` at 0% rollback.
- Current read-only audit: 29 post-cutoff orders, 7 Advance-selected, 13 COD, 9 no-method ineligible, and zero currently eligible, PAID/REVIEW, or held/cancelled. No recovery-attributed payment conversion is proven.
- Recovery stage truth remains +15 READ 1/DELIVERED 1/SKIPPED 10 and +210 SENT 1/PENDING 4/SKIPPED 7; all skips are `PAYMENT_CHOICE_RECOVERY_NO_LONGER_ELIGIBLE`, with no failed, queued, or blocked-window rows.
- Admin deployment is frozen, but authenticated UI screenshot/readback is PENDING because Chrome DevTools MCP/Access session is unavailable. D1 is authoritative; never infer UI evidence.

## GFS-311 final acceptance and conversion audit (2026-10-29 UTC)

- Current bounded D1 audit contains 32 post-cutoff orders: 8 Advance-selected, 14 COD, 10 no-method ineligible, and zero currently eligible, PAID/REVIEW, or held/cancelled.
- Five genuine `PAYMENT_CHOICE_RECOVERY` recipients are present: +15 has 3 recipients (READ 1, DELIVERED 2); +210 has 2 recipients (SENT 1, DELIVERED 1). Ordinary `PAYMENT_CHOICE` remains excluded.
- No order-linked payment selection, COD selection, receipt, or PAID transition was observed after either recovery stage: +15 conversion 0/3; +210 conversion 0/2. This is an observed non-conversion result, not a causal claim.
- Admin visual verification remains PENDING because live routes return Cloudflare Access sign-in without the authenticated Chrome session. No screenshot or UI label is inferred from D1.
- **GFS-312 payment-conversion investigation (2026-10-29):** Preserve the frozen API `b426ba47` and Admin `494a3dce` at 100%, with `9af8991d` and `76e33a3d` retained as rollback. Recovery remains enabled from `2026-10-28T20:05:20.290Z`; five-stage Advance reminders, automation, and utility-template approval remain false. D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1` returned `quick_check=ok` and an empty foreign-key check on the bounded read.
- Fresh bounded evidence contains 32 post-activation orders: 8 Advance-selected, 14 COD, and 10 no-method/ineligible. Recovery evidence is limited to five `PAYMENT_CHOICE_RECOVERY` recipients: +15 READ 1/DELIVERED 2 and +210 SENT 1/DELIVERED 1. Ordinary `PAYMENT_CHOICE` rows are excluded. No recovery recipient has an order-linked payment selection, COD confirmation, receipt, or independently verified PAID transition after the reminder: observed conversion is +15 0/3 and +210 0/2, not a causal claim.
- No recovery outbound failure, retry exhaustion, callback error, or missing provider acknowledgement was proven. The stored event schema has hashes/status/correlation only and does not preserve an order-linked interactive payload, so callback-click attribution is unavailable from D1. Source/tests verify `ADVANCE_PAYMENT` and `COD`; Advance routes directly to the verified methods, while COD requires `CONFIRM_COD_ORDER` and the PKR125 consent flow. Do not publish wording changes, add stages, force sends, or backfill.
- The live Admin routes remain Cloudflare Access-protected in this session, and Chrome DevTools MCP is unavailable. The current Wrangler OAuth identity is `gisupp@gmail.com`, but its token lacks the `d1` scope and the API returns Cloudflare error 10000; do not loop, bypass Access, or claim visual Admin evidence. Reopen the audit only with the supported authenticated Access/Chrome session or a least-privilege D1 token.
- **GFS-313 access and rollback checkpoint (2026-10-29):** Cloudflare deployment readback reconfirmed API `b426ba47` at 100% with `9af8991d` rollback and Admin `494a3dce` at 100% with `76e33a3d` rollback under the GFS account. The trusted local V1 checkout `D:\free seeds\gfs273-v1` was validated clean at `cf01f444500415b1f22a64730674caca1c286006`; rollback harness passed 4/4 without editing it. Focused recovery/interactive suites passed 109/109.
- No Chrome DevTools MCP/browser connector is available in this session. The supported Admin routes cannot be visually authenticated here. Wrangler identity remains `gisupp@gmail.com`, but the token has no `d1` scope and live D1 calls return Cloudflare authentication error 10000. The exact owner action for the D1 branch is one official Cloudflare reauthentication granting least-privilege D1 read scope; the exact Admin action is to connect the existing authenticated Cloudflare Access Chrome profile to MCP. Do not bypass Access, expose credentials, or loop login attempts.
- Until those supported sessions exist, the 32-order / five-recipient GFS-312 evidence remains the latest authoritative audit; exact scheduler-join no-method reasons and live Admin rendering remain unverified. Recovery, five-stage, automation, and utility-template policy is unchanged.
- **GFS-314 final access attempt (2026-10-29):** One official `wrangler login` attempt was made for the verified GFS account and timed out without consent or scope change; no repeated login loop was performed. Read-only `whoami` still identifies `gisupp@gmail.com` with only `user`, `offline_access`, and `workers_scripts`; D1 scope remains unavailable. Worker readback still shows API `b426ba47`/Admin `494a3dce` at 100% with `9af8991d`/`76e33a3d` rollback. No Chrome DevTools/Cloudflare Access connector is present.
- Trusted `D:\free seeds\gfs273-v1` remains clean at `cf01f444`; rollback4/4 passes. Current full suite is 321/321, build/lint pass, and offline audit reports 0 vulnerabilities. Do not claim exact live D1 eligibility or Admin visual acceptance until the owner completes the supported consent and connects the authorized Access browser profile. All production flags and protected checkout policy remain unchanged.
- **GFS-315 final D1 audit (2026-10-29):** Official Wrangler access now succeeds for `gisupp@gmail.com` / Get Free Seeds account with D1 scope. Bounded scheduler-join audit of post-activation orders found 44 records: 9 Advance-selected, 15 COD, 2 receipt/review, 7 currently eligible no-method, and 11 no-method ineligible. The 33 method-null records resolve by scheduler-first exclusion reason to 15 `ORDER_STATE_COD_PENDING`, 11 `CONVERSATION_STATE_COD_CONFIRM`, and 7 eligible now; no no-method opt-outs were found. The receipt/review count is an overlay within the state groups, not an additional category.
- Recovery stage truth is +15: DELIVERED 3, READ 4, PENDING 1, SKIPPED 15; +210: DELIVERED 1, READ 1, PENDING 11, SKIPPED 10. All pending rows are not yet due; all skipped rows carry `PAYMENT_CHOICE_RECOVERY_NO_LONGER_ELIGIBLE`; FAILED/QUEUED/BLOCKED_WINDOW are zero. Provider acknowledgements exist for 7 +15 and 2 +210 rows; ordinary `PAYMENT_CHOICE` remains excluded. No overdue eligible no-send exists. D1 `quick_check=ok`, FK check empty, markers 0037–0042 present, and four recovery templates are PUBLISHED.
- Admin visual proof remains pending because no Chrome DevTools MCP/browser connector or authenticated Access session is available. Runtime flag policy remains the last verified `PAYMENT_CHOICE_RECOVERY_ENABLED=true` with the five-stage, automation, and utility-template flags false; no flag mutation was made.

## GFS-343 Admin-only release gate (2026-10-30 UTC)

- Verified GFS Cloudflare identity `gisupp@gmail.com` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` and GitHub `gardenshop`. The Admin-only controller fix is pushed at `10527d589ad8c5545a4a50be3c2704b951a0ce47`; no Worker customer-flow source changed.
- Authorized Admin candidate `19188b21-60da-4b03-bd89-72cb49468100` reached 10% while API `b426ba47` remained 100% and its candidate remained 0%. Read-only candidate acceptance passed for analytics/API/CSV, conversations, Orders, payment configuration, and COD PKR125. No write, customer, payment, Meta, migration, or API-routing action occurred.
- The controller failed closed on `command_timeout` at approximately `2026-10-30T18:07:10Z` after about 6m15s routed exposure and verified restoration at `18:07:21Z`; final Admin is `494a3dce` 100% / candidate 0%. Do not retry or promote until a fresh owner authorization covers a host-context timeout/readback fix and new bounded run.
- Candidate analytics sample rows_read was 48,128 + 9,157 + 848 + 48,156 + 2,050 + 328 = 108,667 for one request. This is request-level evidence only, not daily savings or production-wide D1 reduction. +15/+210 recovery and all protected reminder flags remain unchanged.
-
## GFS-344 controller repair and safe canary gate (2026-10-30 UTC)

- GFS-343's live failure is classified as a Cloudflare deployment-status readback command timeout during monitoring: the controller's 15-second poll bound was exceeded. Fresh host readback normally measured 2,733ms API and 2,503ms Admin, so the failure was transient control-plane latency, not a customer Worker defect.
- Commit bd8e59e hardens the controller and adapter: HTTP health and Cloudflare GraphQL metrics are required; missing health is UNKNOWN and never fabricated as zero; rollback tolerates late remote completion and retries verification within the absolute deadline; an unverified rollback preserves the exclusive lock.
- Local fault gates pass: controller13/13, adapter6/6, observability3/3, full334/334, build/lint/audit0, rollback4/4. Remote branch is pushed and verified at bd8e59e.
- Current read-only Cloudflare GraphQL evidence (10-minute window) is API94 requests/0 errors across75 rows and Admin22 requests/0 errors across9 rows, with zero GraphQL errors. API HTTP health is200; host Admin HTTP health is302 because Access authentication is not present. Authenticated Chrome Admin /health is200.
- The GFS-344 canary was not exposed. The controller correctly fails closed until a supported host-side authenticated Admin health path exists. API b426ba47 remains100%; Admin 494a3dce remains100%; candidates remain0%; all WhatsApp/payment/Cron/reminder policy is unchanged.

## GFS-345 evening order-decline audit (2026-10-30 UTC / PKT)

- Read-only identity/freeze: GitHub `gardenshop`; Cloudflare `gisupp@gmail.com` / Get Free Seeds; canonical GFS Meta Ads Manager; API `b426ba47` 100% / `6ef27f02` 0%; Admin `494a3dce` 100% / `19188b21` 0%; D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; 0043 marker plus ten indexes; 0044/0045 absent; `quick_check=ok`; FK empty.
- First abnormal interval: 17:30Z/22:30 PKT. Inbound fell 67→29 and orders 5→1 versus the prior 15-minute bucket; next buckets were 24/0 and 9/0. Full windows: 874 inbound/30 orders before 22:30 (3.43%) and 90/2 after (2.22%). Prior-seven-day aggregate: 1,727/43 (2.49%) and 282/10 (3.55%). Contact figures are snapshot estimates because `whatsapp_events` has no sender ID.
- No target-window failed payment-choice row, webhook rejection, rate-limit audit action, WhatsApp outbox failure, or recovery-stage failure. Cloudflare API was 3,131/0 errors then 401/0; Admin 155/0 then 155/0; GraphQL errors0. D1/Admin full-date count parity was 68/68.
- The 0%-traffic Admin upload at 17:47Z and GFS-343 canary/restore at 18:01Z/18:07Z followed the break; API stayed frozen. No code/runtime cause was proven. Meta showed active campaign/day delivery, but hourly delivery fields and reporting timezone were unavailable; Meta causation is BLOCKED.
- Decision: A (inbound/acquisition decline) is the leading measured explanation, not a proven ad cause. B/D/Worker/D1 failure are unsupported. No source repair or production action was made. Public bot and +15/+210 recovery remain GO; no Admin canary under GFS-345.

## GFS-346 Meta attribution and Admin monitoring gate (2026-10-31 UTC)

- Read-only identity/freeze reverified: GitHub `gardenshop`; Cloudflare `gisupp@gmail.com`; Meta Ads Manager account `1198439777611633` in business `568026370701542`; API `b426ba47` 100% / `6ef27f02` 0%; Admin `494a3dce` 100% / `19188b21` 0%; migration0043 retained and 0044/0045 unapplied. No mutation occurred.
- Meta Ads Reporting returned a genuine hourly breakdown labeled `Time of day (ad account time zone)`. On 30-Oct the visible 22:00-23:00 row had 581 impressions, Rs30.46 spend, 28 link clicks and 24 attributed messaging conversations; total was 12,604 impressions, Rs751.14, 659 clicks and 392 conversations. The prior 23-29 Oct aggregate had 75,070 impressions, Rs8,584.40, 3,386 clicks and 1,581 conversations.
- The report date control displays `Etc/UTC`, while the hourly breakdown is labeled advertiser account time zone; the authoritative account timezone value was not exposed. Meta causation is PARTIAL, not CONFIRMED. Delivery continued through the displayed hour; do not infer UTC alignment.
- Fresh observability: API health200/211ms, GraphQL28 requests/0 errors; Admin host health302/110ms because Access is unauthenticated, GraphQL9 requests/0 errors. Authenticated Chrome Admin `/health` returned200. No supported host-side Access bridge is available; live Admin canary remains blocked.
- Bounded D1 health window `2026-10-30T18:00Z`–`2026-10-31T19:00Z` returned counts only: MESSAGE41, INTERACTIVE39, status sent81/delivered1/read2; no payment-choice/recovery failure rows; recovery 210-minute delivered2/sent2/skipped2; CAPI pending1; unique inbound conversation snapshots19. Aggregate query reads were 26,094, 188 and 4,341; investigation costs only.
- Controller13/13, adapter6/6 and observability3/3 pass unchanged. No source repair is justified. Public bot and +15/+210 recovery remain GO; Admin canary, ad edit and deployment remain NO-GO.

## GFS-347 Admin monitoring unblock (2026-10-31 UTC)

- P0 read-only routing remains API `b426ba47` 100% / candidate0% and Admin `494a3dce` 100% / candidate `19188b21` 0%; GitHub `gardenshop`, Cloudflare `gisupp@gmail.com`, migration0043 and protected flags remain unchanged.
- The precise blocker is host-side Cloudflare Access authentication: Admin `/health` is302 without Access, Chrome’s existing authenticated session is200, but no approved service-token environment binding or Worker Access credential exists. Worker secret names are only `FLOW_PUBLIC_KEY` and `META_ACCESS_TOKEN`. Do not inspect secret-bearing Access pages, copy cookies, bypass policy or change Access configuration.
- GFS-347 canary was not exposed because monitoring P1 failed. Final traffic remains frozen; no rollback, customer, payment, Meta, D1, migration or flag mutation occurred. Public bot and +15/+210 recovery remain GO; Admin release remains NO-GO.
- Meta account overview still does not expose the authoritative timezone. Keep attribution PARTIAL and do not remap the 22:30 PKT decline or edit ads.

## GFS-348 Access monitoring gate (2026-10-31 UTC)

- Read-only Zero Trust inventory confirmed staging Admin app `ea91b1bf-02c1-46d3-921a-ea2f507fb150`, policy `b3acdd4f-9767-4d28-a55d-0a8e771d476c`, destinations `getfreeseeds-admin-staging` and `getfreeseeds-v2-admin-staging`, and the sole owner-email allow rule. Cloudflare One Client auth is off.
- No approved machine-authenticated Access credential or host bridge was available. No token, cookie, policy, Worker, route, flag, traffic, D1, Meta, customer, payment, or reminder mutation occurred.
- Host Admin health remains HTTP302 without Access while the existing authenticated browser health is HTTP200. Admin canary remains blocked; owner must provision a short-lived least-privilege Access Service Auth credential in approved host storage or provide a supported authenticated Windows monitoring bridge.

## GFS-350 Access provisioning gate (2026-10-31 UTC)

- Fresh read-only checks confirm remote PR HEAD `d952611dcb584cd13e13616a118ddc5285af4bc4`, GitHub `gardenshop`, Cloudflare `gisupp@gmail.com`, Admin `494a3dce`100% / `19188b21`0%, and API `b426ba47`100% / candidate0%.
- P1 remains BLOCKED: no official Chrome DevTools/Zero Trust connector or secure Access-management path is available here; Wrangler OAuth lacks Access-management scope and no Access credential environment is present. Do not create an unrestricted token or repeat 302 checks.
- No Access, Worker, route, D1, Meta, payment, customer, flag, reminder, or traffic mutation occurred. Keep Admin canary NO-GO and the public bot/recovery GO.

## GFS-351 Access permission gate (2026-10-31 UTC)

- The available MCP registry still has no Cloudflare Zero Trust or Chrome DevTools connector. Plugin discovery found an unconnected cloud-browser option, but it is not connected and cannot be used or treated as authorization.
- No Access-management permission grant, service token, policy, secret transfer, Worker, route, D1, Meta, payment, customer, flag, reminder, or traffic mutation occurred. Keep the Admin canary blocked and production frozen.
- Exact external dependency: connect an approved browser/Zero Trust integration or grant the authorized operator Access Service Tokens Write and Apps/Policies Write through official Cloudflare controls, with least-privilege path isolation.

## GFS-349 Access resolution gate (2026-10-31 UTC)

- P0 identity/read-only checks PASS: GitHub `gardenshop`, Cloudflare `gisupp@gmail.com` / account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; frozen API/Admin remain 100% and candidates0%; migration0043 and protected flags remain unchanged.
- P1 BLOCKED: no Chrome DevTools/Cloudflare Zero Trust connector is available in this execution context, and Wrangler OAuth has no Access-management scope. Do not create a token, inspect secret-bearing credential metadata, extract browser cookies, or weaken the existing owner-email policy.
- The host Admin health remains HTTP302 without Access; the existing browser session is HTTP200. No canary, Access, Worker, route, D1, Meta, payment, customer, or reminder mutation occurred. Keep the public bot and +15/+210 recovery GO; Admin release NO-GO.

## GFS-364 verified Access monitoring repair (2026-10-31 UTC)

- Cloudflare readback: `GFS-Admin-Health-Monitoring` is limited to the staging Admin `/health` destination and has the existing `GFS-Admin-Health-Monitor` Service Auth policy; the existing Admin Operator policy was not changed. The token is enabled; no token or secret value is recorded.
- Proven 403 cause: the smoke test's version-override header used JSON instead of Cloudflare's required structured-dictionary syntax, so the 0%-traffic repair was not invoked and the baseline Worker returned `ADMIN_ACCESS_REQUIRED`.
- Repair: the Admin Worker permits Cloudflare's authenticated `ctx.access` only for `GET /health`; human Admin email authorization and all other Admin paths remain unchanged. The corrected version is deployed at 0% beside baseline `494a3dce`100%. API remains `b426ba47`100%; canary remains 0%.
- Real acceptance: protected controller returned three HTTP200 health responses; missing/invalid credentials returned403; Orders, Analytics and Conversations returned302/denied; GraphQL readback returned API/Admin requests with0 errors. No customer, payment, Meta, D1, Queue, Cron, reminder, or WhatsApp mutation occurred.
- Never log, export, screenshot, or commit Access credentials. Do not simulate revocation by disabling the active token; use fail-closed invalid/missing-credential tests and documented rollback only.
## GFS-365 safety and canary-readiness gate (2026-10-31 UTC)

- Credential expiry, revocation, and unavailable states are tested only with isolated synthetic controller responses. They fail closed before candidate exposure, emit allowlisted health-failure evidence, and recover with valid monitoring after verified restoration. Never disable, rotate, delete, or expire the active provider token for testing.
- Exact combined Admin candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec` contains the current Analytics, Conversations, and `/health` Service Auth repair. It is staged at0% beside Admin baseline `494a3dce`100%; API `b426ba47` remains100%.
- Approval D must name this exact tested candidate and authorize only10% for8 minutes, with restoration beginning by minute6. No automatic promotion or customer/payment/Meta mutation.
## GFS-366 Admin canary disposition (2026-10-31 UTC)

- Approval D was explicit for candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec` at10% for8 minutes. The supported controller failed closed before exposure because baseline `494a3dce` authenticated `/health` was unhealthy for the Service Auth monitor.
- No candidate traffic, rollback, customer request, payment, Meta, D1, Queue, Cron, or flag mutation occurred. Do not bypass the baseline monitoring failure or treat candidate-only HTTP200 as a canary PASS.
- Final readback remains API `b426ba47`100%, Admin `494a3dce`100%, combined candidate0%. Next action requires a separate scoped decision to make baseline monitoring compatible or provide an equivalent approved baseline monitor, then fresh canary approval.
## GFS-367 baseline monitoring diagnosis (2026-10-31 UTC)

- Baseline version `494a3dce` with the existing Service Auth headers returns HTTP403 and the exact allowlisted Worker body classification `ADMIN_ACCESS_REQUIRED`. This proves the legacy owner-email authorization gate, not a Worker failure; Service Auth has no human email claim.
- The dedicated `/health` Access application also returns Cloudflare Access403 to the existing browser session, so no trustworthy operator-authenticated baseline monitor is available through that app. Do not accept GraphQL zero errors alone or treat the protected403 as application-health PASS.
- Do not alter routing, Access policy, token, Worker, API, WhatsApp, D1, Meta, payment, Queue, Cron, migration, or flags without a new scoped approval. Keep the canary blocked and fail closed.

## GFS-373 authenticated Admin operator acceptance (2026-10-31 UTC)

- Frozen state remains API `b426ba47` 100%, Admin bridge `3bbf5cf6` 100%, combined candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec` 0%. No deployment, routing, customer, payment, Meta, D1, Queue, Cron, migration, flag, or Access mutation was made.
- The authorized Chrome session invoked the exact candidate only through Cloudflare's structured version-override header. Candidate Analytics, Conversations, Orders, Payment Settings, read-only APIs, and CSV returned authenticated success; the same candidate-only Analytics/Conversations routes returned 404 on the frozen bridge without the override. No cookies or secrets were extracted.
- Operator acceptance PASS for UI/API availability, read-only privacy masking, CSV shape, payment-settings readback, responsive Analytics/Conversations layouts, latency, and zero-write scope. Candidate-only data was aggregate or masked; no customer identifiers, message bodies, receipts, credentials, or tokens were recorded.
- Direct fresh D1/Cloudflare control-plane readback was not completed because Wrangler OAuth was expired/unreachable and GitHub network readback was unavailable. Do not describe this as an independent fresh D1 or account-identity proof; retain prior verified identity/routing evidence and require fresh control-plane authentication before any mutation.
- Do not promote Admin under GFS-373. The next gate is a separate owner approval for staged promotion of the exact tested candidate, with bridge `3bbf5cf6` as the 100% rollback baseline, explicit stop thresholds, and independent readback.

## GFS-374 Approval G staged-promotion gate (2026-10-31 UTC)

- Fresh Wrangler identity PASS: `gisupp@gmail.com`, Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; HEAD `fb04d8a` was verified. Current readback remains Admin bridge100% / candidate0% and API `b426ba47`100% / candidate0%.
- Approval G was **not executed**. The exact candidate serves Analytics/Conversations, while the bridge returns404 for those candidate-only routes. Wrangler's supported percentage deployment has no session-affinity or path-routing control. A 10/25/50% split can therefore produce authenticated 404s or broken mixed-version sessions.
- Stop before mutation. Do not add routing rules, silently change the bridge, or expose staged traffic. Request one scoped correction: an owner-approved release method that prevents mixed-version 404s (for example a supported affinity/path mechanism or an explicitly approved direct candidate cutover with watchdog rollback).
- API, WhatsApp, customer, payment, Meta, D1, migration, Queue, Cron, flag, Access, and Worker routing remain unchanged.

## GFS-375 Approval H direct Admin cutover (2026-10-31 UTC)

- Approval H was executed only after fresh identity/routing, candidate health, operator acceptance, D1 parity, and rollback dry-run gates passed. Cloudflare identity is `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; API remained `b426ba47`100%.
- Admin deployment `a98d5e55-3d95-4f9a-b687-ffbc617fd4d1` serves candidate `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`100% and bridge `3bbf5cf6-87d7-47ee-9a2b-17e0165af1e1`0%. No gradual split or unrelated mutation occurred.
- A detached Windows watchdog armed a five-minute rollback deadline before cutover. It was independently disarmed only after final candidate/API routing readback and acceptance; result was `disarmed`, not a fabricated rollback.
- Acceptance measured health200 with valid Service Auth, invalid health403, protected Admin routes302 for the monitoring credential, GraphQL45 requests/0 errors, Analytics/CSV/Conversations/Orders/Payment Settings HTTP200, D1/Admin aggregate parity, `changed_db=false`, and `rows_written=0`. No customer identifiers, payloads, secrets, cookies, or payment data were recorded.
- WhatsApp read-only aggregates remained valid: inbound states were RECEIVED/sent/delivered/read only, recovery FAILED=0, +15/+210 rows remained known, and the API deployment stayed frozen100%. Do not claim absolute zero regression; measured coverage is the recorded evidence.

## GFS-376 API acknowledgement release gate (2026-10-31 UTC)

- Production is frozen: API `b426ba47-1ead-4c4a-85ba-0a0b85d3e415`100% + `6ef27f02-23ac-46c0-a291-157e246a8dbc`0%; Admin `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`100% + bridge `3bbf5cf6-87d7-47ee-9a2b-17e0165af1e1`0%. No upload, attachment, traffic, flag, migration, D1, Meta, payment, Queue, Cron or customer mutation occurred.
- Do not release prepared API version `b0e883cd-16b8-4f8e-8fd8-c12bd46c4428`. Its acknowledgement boundary is correct and its 27 versioned bindings match the serving version, but its frozen source omits the GFS-309 Cron-only recovery reconciliation. With five-stage reminders OFF it would stop reconciling +15/+210 delivery status.
- The replacement source is local-only in `gfs338-api-candidate`: base `901f3f6`, exact GFS-309 runtime patch `bb52f1d`, and exact acknowledgement patch `b9d52c4`; no Wrangler config change. Runtime source SHA-256 is `462e6f6ecc70d592ce7da38e7df2ce6f8c03e2628776436ff7693dcbdfde4c50`.
- Release requires explicit owner approval to upload that exact source, attach the assigned version at0% in place of `6ef27f02` without deleting any upload, pass targeted override checks, and only then run one1%/8-minute API canary with restoration beginning by minute6 to `b426ba47`100%. Admin must remain `4fe564a6`100%.
- The public canary can execute real WhatsApp/webhook/Queue/Cron requests and replies for up to1% of API traffic. Fail closed and restore immediately on duplicate send, acknowledgement mismatch, 5xx, webhook/Queue/Cron/recovery fault, order/payment drift, monitoring loss or rollback uncertainty. No automatic API promotion.

## GFS-377 Admin desktop view (2026-10-31 UTC)

- Production remains frozen: Admin `4fe564a6`100% / bridge `3bbf5cf6`0%; API `b426ba47`100% / old API slot `6ef27f02`0%. No Cloudflare, API, WhatsApp, Meta, payment, D1, Queue, Cron, migration, flag, Access, or customer mutation was made.
- Authorized live browser evidence showed Admin Orders, Analytics, Conversations, and Payment Settings had no horizontal overflow and no console errors at 1440x900, 1280x800, 768x1024, and 390x844 emulations. Orders retained its desktop split pane and mobile stacked layout. The live root before deployment remains the known plain page; do not call the new home live until separately deployed and rechecked.
- Source-only repair: the root Admin route is now a static, data-free, responsive operations home with existing authorized module links and 4/2/1-column breakpoints. It performs no data reads, adds no auth path, and does not change Orders or customer-flow logic.
- Source acceptance: focused Admin checks 3/3, full suite 337/337, build, lint, and offline audit with 0 high vulnerabilities passed. Prior controller17/17, adapter6/6, observability4/4, and rollback4/4 evidence remains carried forward; no API source was changed here.
- Local Wrangler preview was not valid after-deployment browser proof because the process did not remain reachable under host permissions. Never fabricate an after screenshot. Production deployment requires separate authorization and fresh identity/routing readback.
- Preserve GFS-376 API correction boundary: exact replacement source SHA-256 `462e6f6ecc70d592ce7da38e7df2ce6f8c03e2628776436ff7693dcbdfde4c50` remains local-only; upload, 0% attachment, and 1% canary require the specified owner approval.

## GFS-378 Admin Orders layout and Refresh (2026-10-31 UTC)

- Production remains frozen: Admin `4fe564a6`100% / bridge `3bbf5cf6`0%; API `b426ba47`100%. No deployment, API upload, customer message, payment, Meta, D1, Queue, Cron, migration, flag, or WhatsApp mutation occurred.
- Live Chrome diagnosis at 1675x900 found the first Orders card stretched to 472.5 CSS px by `grid-template-rows:minmax(280px,42vh)`; the workspace expanded to 3509px. Body/client widths matched, so the right blank area was a centered max-width gutter, not horizontal overflow.
- Source-only fix bounds the desktop workspace to the viewport, changes the order list to a scrollable flex column with content-sized cards, caps the mobile list, and widens the desktop shell to 1700px. Existing filters, pagination, selected order, authorization, and detail behavior are preserved.
- Live Refresh click reached `/api/orders/changes` with HTTP200 and preserved the current aggregate/list state. The source now adds a guarded single-flight wrapper with visible Checking, Checked/No changes, Updated, and error feedback; Full reload remains explicit.
- Focused Admin tests, full suite338/338, build, lint, and offline audit0 passed. No post-fix live browser PASS is claimed because deployment is prohibited; after-source visual screenshots were not captured because Chrome rejected unsanitized live order capture containing customer data.

## GFS-379 Admin UI deployment (2026-10-31 UTC)

- Approval I authorized one Admin-only release of the tested GFS-377/378 UI source at commit `e1b56a890a15cb2e88658b8dddf6c826cfe0c6ac`. Cloudflare identity was `gisupp@gmail.com`, account `Get Free Seeds` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; API was not mutated.
- Uploaded Admin version `72cff93f-d589-4046-9bce-45477f53f829` and validated it at0% before exposure. A detached Windows watchdog was armed before cutover, with a five-minute rollback to Admin `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`100% / candidate0%; it was disarmed only after independent readback.
- Final Admin routing is `72cff93f-d589-4046-9bce-45477f53f829`100% and rollback version `4fe564a6-bcd7-4106-82ee-00f7b14c4bec`0%. API remains `b426ba47-1ead-4c4a-85ba-0a0b85d3e415`100% with old slot `6ef27f02-23ac-46c0-a291-157e246a8dbc`0%.
- Protected monitoring through the existing Windows Credential Manager bridge returned authenticated health200 three times; missing/invalid credentials403; monitoring credentials were redirected on Orders, Analytics, and Conversations. No values were logged. The repository monitoring assertion still expects the pre-GFS-379 legacy Admin baseline and is not evidence against this deployment.
- Real authorized Chrome acceptance used aggregate DOM/network evidence only: requested desktop/tablet/mobile layouts had no horizontal overflow or console errors; Orders used bounded scrolling/content-sized cards; Refresh visibly reported its check and `/api/orders/changes` returned200. No customer-bearing screenshot or private field was recorded. Do not expose credentials, cookies, customer data, or order identifiers.
- GFS-376 API repair remains approval-gated and must not be bundled with Admin UI releases. Preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule.

## GFS-380 Chrome viewport/layout diagnosis (2026-10-31 UTC)

- The owner-reported narrow desktop homepage was caused by stale Chrome DevTools device metrics plus host DPR `0.8`, not the Admin homepage CSS. Clearing emulation restored a clean authorized desktop (`innerWidth`1920, four 300px columns, 1320px shell); `Control+0` was also issued in the test page.
- Compensated DevTools checks verified the intended CSS widths: 4 columns at1920/1675/1440/1280, 2 columns at768, and1 column at390/360/320. All12 modules and the footer were reachable at the bottom; homepage document/client widths had no horizontal overflow.
- The existing production Admin UI was not changed or redeployed. Final routing remains Admin `72cff93f`100% / rollback `4fe564a6`0% and API `b426ba47`100%.
- Read-only route checks loaded Orders, Analytics, Conversations, and Payment Settings without console errors. A pre-existing Analytics daily table is wider than the true CSS390px content area; it is outside the homepage/emulation repair and remains a separate source/deployment decision. Do not claim it repaired here.
- No customer, API, WhatsApp, payment, Meta, D1, migration, flag, Queue, or Cron mutation occurred. Preserve protected protocols and never record customer data or credentials.

## GFS-381 Analytics mobile overflow fix (2026-10-31 UTC)

- Proven defect: the Analytics `#daily` and `#abandoned` tables exceeded the true CSS390px content width. The minimal source fix makes their existing containers max-width, touch-scrollable, keyboard-focusable regions; table data, CSV, filters, metrics, SQL, auth, and desktop presentation are unchanged.
- Source/test gates PASS: focused16/16, full339/339, build, lint, and offline audit0. Chrome DOM acceptance at CSS1920/1440/1280/768/430/390/360/320 found no page overflow; mobile tables scroll independently and desktop/tablet tables do not need scrolling. ArrowRight advanced the focused daily table scroll position.
- This is source-only. Do not alter live routing without separate scoped approval. Planned Admin deployment must use the new version with rollback to `72cff93f-d589-4046-9bce-45477f53f829`100% / candidate0%; API remains `b426ba47`100%.
- No API, customer, WhatsApp, payment, Meta, D1, migration, flag, Queue, Cron, or production deployment mutation occurred. Preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule.

## GFS-382 Admin mobile release (2026-10-31 UTC)

- Approval J was applied only to tested Analytics mobile UI source at HEAD `7ab2addfc2d9722ec4a7351d18daad2b81e76084`; Cloudflare identity was `gisupp@gmail.com`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- Admin `ceb3e680-96f6-4218-b5a5-cadfca20a629` was uploaded, validated at 0%, then cut over to 100%. Previous Admin `72cff93f-d589-4046-9bce-45477f53f829` remains rollback at 0%. API `b426ba47-1ead-4c4a-85ba-0a0b85d3e415` remained 100%.
- A detached five-minute rollback watchdog was armed before exposure and stopped only after independent final routing readback. No rollback was needed.
- Protected monitor evidence: authenticated `/health` returned 200 three times; missing and invalid credentials returned 403; monitoring credentials redirected on `/orders`, `/analytics`, and `/conversations` (302). No secrets were recorded.
- Official Chrome aggregate acceptance at CSS widths 1920/1440/1280/768/430/390/360/320 found no whole-page overflow. Daily and abandoned tables were independently scrollable on mobile, keyboard-focusable, and desktop/tablet presentation remained non-scrolling. Today, Refresh, CSV, routes, auth, and console-error checks passed without private data capture.
- No API, WhatsApp, customer, payment, Meta, D1, migration, flag, Queue, or Cron mutation occurred. Preserve the new-number WhatsApp lock, Hoja Seeds zero-connection rule, and separate API repair approval boundary.

## GFS-383 corrected API repair and bounded canary (2026-10-31 UTC)

- Approval K authorized only the corrected API candidate. The exact detached source hash `462e6f6ecc70d592ce7da38e7df2ce6f8c03e2628776436ff7693dcbdfde4c50` was verified; it contains baseline `901f3f6`, GFS-309 Cron reconciliation `bb52f1d`, and acknowledgement repair `b9d52c4`. Unsafe `b0e883cd` was not released.
- Cloudflare identity before mutation was `gisupp@gmail.com` / Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Candidate API version `d603f077-cc44-4882-af9b-9985adb53424` was uploaded and attached at0% beside API `b426ba47`100%; Admin `ceb3e680`100% remained unchanged.
- Candidate 0% override acceptance passed: exact version health was HTTP200 three times with `PRODUCTION_INTEGRATION_READY` and WhatsApp enabled; unsigned webhook denial was HTTP403. Focused96/96, full324/324, build, lint, audit0, controller17/17, adapter6/6, observability4/4, and legacy rollback4/4 passed. Bindings, Queue, Cron, flags, D1/R2 names, and secret names matched without values being recorded.
- The one approved API canary was exposed at1% with an independent detached controller. Candidate routing was observed, but the controller encountered a monitoring/readback error after approximately154 seconds and fail-closed restoration began immediately. Restoration was independently verified at approximately176 seconds; no customer event was generated or replayed, so customer-attributable candidate acceptance is INCONCLUSIVE, not PASS.
- Final readback: API `b426ba47`100% / `d603f077`0%; Admin `ceb3e680`100% / `72cff93f`0%. Post-restore read-only observability returned API health200/0 errors and Admin health200/0 errors. No API100% promotion, WhatsApp/customer/payment/Meta/D1/migration/flag/Queue/Cron mutation occurred.
- Preserve the new-number WhatsApp lock, Hoja Seeds zero-connection rule, and separate API full-promotion approval. The exact transient readback cause remains UNKNOWN; do not repeat the canary without a diagnosed monitoring repair and fresh approval.

## GFS-384 API canary monitoring repair (2026-10-31 UTC)

- Frozen state reverified under the GFS Cloudflare account: API `b426ba47`100% / `d603f077`0%; Admin `ceb3e680`100% / `72cff93f`0%. No canary or production deployment was run in GFS-384.
- Reconstructable GFS-383 evidence: Cloudflare retained the API 1% deployment at `16:36:53.946Z` and restoration at `16:39:25.329Z`. The original controller output was removed after restoration, so the exact original exception text and millisecond timestamp are unavailable and remain UNKNOWN.
- Bounded historical GraphQL evidence identifies the failure class: the API `workersInvocationsAdaptive` read returned HTTP200 with a GraphQL error/empty rows on one read in the canary interval, while Admin rows were successful; an immediate identical read succeeded for both. No Worker error was observed in the successful rows. This distinguishes monitoring/control-plane read failure from API runtime failure, but does not recover the deleted original error text.
- Minimal repair: `scripts/cloudflare-canary-adapter.mjs` retries the complete routing + health + GraphQL read once after250ms, never uses cached/stale data, respects cancellation, and still fails closed when retries are exhausted or versions are unknown. The API candidate `d603f077` was not changed.
- Repair gates PASS: adapter8/8, controller17/17, observability4/4, legacy rollback4/4, full339/339, build, lint, audit0. Runtime read-only checks: API/Admin health200, GraphQL errors0, Admin no/invalid Access403, monitoring paths302; D1 aggregate read had `changed_db=false`, `rows_written=0`.
- Do not execute another API canary under this gate. Prepare fresh owner Approval L for one API-only `d603f077` canary at maximum1% for maximum8 minutes, restoration by minute6 to `b426ba47`100%, with Admin unchanged; no automatic promotion.

## GFS-387 Orders network resilience (2026-10-31 UTC)

- Read-only Chrome evidence on the authorized Admin Orders page found `/api/orders`, order detail, and `/api/orders/changes` HTTP200, including a sanitized Refresh click and full reload. No `/api/orders*` failure occurred; one unrelated 404 resource remained outside the Orders API. DOM evidence had no Orders/network failure text and body width 1901px within the 1920px viewport.
- Proven source risk: a transient list failure cleared the last successful order cards and rendered the generic failure state. The minimal fix keeps visible cards, labels `Refresh failed; showing the last successful orders.`, and retains the existing bounded retry/cancellation behavior; no SQL, business, auth, payment, API, or WhatsApp logic changed.
- Gates PASS: focused Admin controls12/12, full339/339, build, lint, dependency audit0 vulnerabilities, controller18/18, adapter8/8, observability5/5. Cloudflare readback remained API `b426ba47`100% / `d603f077`0% and Admin `ceb3e680`100% / `72cff93f`0%; aggregate D1 read reported `changed_db=false`, `rows_written=0`.
- No production deployment, customer message, order/payment write, Meta, migration, flag, Queue, Cron, or D1 mutation occurred. Preserve the new-number WhatsApp lock and Hoja Seeds zero-connection rule. GFS-386 API monitoring release remains blocked; no API canary is authorized.
