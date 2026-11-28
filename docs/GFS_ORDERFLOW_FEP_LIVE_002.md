# GFS-ORDERFLOW-FEP-LIVE-002

> **Superseded policy note (2026-11-28):** this is a historical read-only checkpoint. Do not use its isolated-test mobile-attestation instructions or require Android/iOS webhook fields. The current ordinary opening policy uses authenticated signed `source_type=ad`, hashed `ctwa_clid`, provider timestamp and actual CSW; see `GFS_ORDERFLOW_ZERO_MISSED_LEADS_001.md`. Monthly service allowance is disabled until exact shared quota accounting is available. Owner reports `Free Seeds In Pakistan` is already under review and directs no resubmission. Chrome DevTools MCP timed out during refresh, so current review/registration state could not be re-read.

## Outcome (2026-11-27)

**Policy/source and historical checks complete; no live test message; WhatsApp leads remains NO-GO.** The previously approved private contact and 10-attempt/30-minute bound were reused and are not repeated here. Outbound count remains **0/10**, timer not started. Chrome DevTools `list_pages` was called first. All Meta/Cloudflare checks below were read-only; no account setting, callback, Worker, order, payment, campaign or D1 was changed.

## Current Meta Policy

Read the current official developer pricing page on 2026-11-27: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ . The old public 72-hour FEP guidance is historical and superseded. Current Meta developer documentation states a qualifying FEP can remain open **up to seven days**, not that every customer receives seven days. Actual per-contact `conversation.expiration_timestamp` is authoritative; never calculate or fabricate an expiry.

- A genuine qualifying Click-to-WhatsApp ad referral must arrive through a signed provider webhook. The ordinary opening response uses the documented ad referral without an OS field or test attestation. A business response within the existing 24-hour customer-service window opens FEP; it does not require a previous FEP expiry/pricing receipt. Non-template messages still require an open customer-service window. Later FEP sends require actual provider expiry and matching free-pricing evidence.
- Ordinary wa.me links, QR codes and manual chats do not prove ad-originated FEP. A Facebook Page CTA is a distinct entry point and its FEP eligibility is not verified here. No ad/campaign was opened, edited or activated in this task.
- Monthly service allowance is a separate free basis but is disabled in the current candidate: approximate aggregate allowance headroom is not an authoritative pre-send quota across all senders and cannot authorize a particular message.
- Custom Get Free Seeds Cloud API chatbot is not Meta Business Agent. Meta Business Agent is a distinct AI-managed messaging category and remains unused/disabled for Free Seeds.

### Actual Webhook Semantics

The read-only Meta Activation endpoint made its Graph request with **v26.0**. The active API Worker has no `META_GRAPH_VERSION` override and current source defaults to v26.0, but Cloudflare does not expose the legacy `b426ba47` bundle's exact URL version through its read-only settings. Therefore v26.0 is verified for Meta Activation and is the API source default; the legacy API wire version is not independently attested. That Worker is at100% traffic, so local code changes are not live behavior.

The current Meta webhook reference has signed referral source/`ctwa_clid`, but does **not** document an Android/iOS device field in the referral object. Do not map `source_platform` to device OS and do not require that undocumented field. `conversation.id` and `conversation.expiration_timestamp` are optional on relevant statuses, and `pricing` can appear on SENT or DELIVERED/READ. The code now merges only statuses matching the first-response provider-message hash; it hashes an observed `conversation.id`, requires the actual origin/expiry/pricing classification, and leaves incomplete evidence pending. `pricing.billable` is deprecated in future API versions: missing is accepted only when `pricing.type=free_entry_point`, `pricing.category=referral_conversion`, and `pricing_model=PMP` prove the FEP classification; explicit `billable=true` blocks.

The previous draft's `WHATSAPP_TEST_MOBILE_ATTESTED` flag is retired and must not be set. No undocumented platform field or isolated test attestation qualifies an ordinary lead or candidate. A controlled test must still be separately authorized and must use an authentic signed referral if it is intended to validate CTWA.

## Meta and WABA Readback

Meta Business Suite identified the current Get Free Seeds WABA. The read-only Meta Activation status call reports WABA subscription active, `whatsapp_business_management` and `whatsapp_business_messaging` granted, phone quality GREEN, display-name status **DECLINED**, and registration status **EXPIRED**. These current values supersede the older November25 `In Review`/Connected snapshot. No name resubmission or registration action was attempted. The phone cannot be treated as send-ready until the owner/operator separately resolves these Meta statuses.

WhatsApp Manager's Business Agent page shows **Set up**, not enabled; its Message Pricing view shows **0 AI Provider** messages. No Business Agent was enabled. The custom Cloud API path remains the only Free Seeds responder; no paid third-party AI dependency is introduced.

Read-only WABA Message Pricing analytics, with one listed business phone in the All phone numbers view:

| Period | Free Entry Point delivered | Free Customer Service delivered | Paid delivered | Approximate charges |
|---|---:|---:|---:|---:|
| Last30 days, Oct29-Nov27 |66,349|981|0|$0.00 USD|
| Calendar MTD, Nov1-Nov27 |57,489|892|0|$0.00 USD|

The dashboard says insights are approximate and may differ from invoices. The earlier owner-supplied 30-day snapshot (61,254 FEP/924 free service) is a different earlier read; the refreshed figures are recorded separately, not merged. MTD free-service deliveries are approximately892 of the1,000 service allowance, but this does not authorize another service-tier message and is not used for the FEP test. FEP deliveries do not establish future per-contact pricing.

## Historical FEP Evidence

The canonical production D1 was read through aggregate-only SQL; no customer row or raw webhook was selected. Across12,304 `whatsapp_conversations` rows, structured opening-response, CTWA click-hash, first-response, active FEP, verified-expiry and FEP-pricing evidence counts were all0; verified durations above72 hours were0. The `whatsapp_events` schema retains provider event ID/type, payload hash, status, correlation ID and timestamp, not raw referral/`ctwa_clid`/pricing/expiry payloads. These historical events cannot reconstruct individual FEP start, duration or expiry. No historical per-contact FEP gate can be credited. The aggregate Meta analytics above are only account-level delivery/billing totals.

## Test Isolation and Live Gate

The local implementation reuses the prior isolated selective relay and atomic10/30 budget. The API/Admin outbound guards share an anchored D1 window, include all provider message types and Admin direct Graph send, block only the test recipient on production while relay mode is active, and leave ordinary recipients on existing automation. Cron/Queue are disabled in the candidate; ordinary production automation is not globally paused. The candidate accepts only signed CTWA openings and EN/UR locale actions and cannot create orders, approve payments, create COD/dispatch, or send CAPI. No new number/service/migration was created.

The existing Meta callback remains the production API. A second Worker will not receive WABA callbacks automatically. Candidate config `apps/api/wrangler.whatsapp-test.jsonc` was dry-run validated only; test/provider/mobile-attestation flags are false, no secrets/recipient are set, and it has no route/Cron/Queue/R2. The production relay and Admin test-recipient block remain off. Current production Worker b426ba47 still has its old per-minute Cron/Queue behavior. No live test was started and no candidate acceptance is claimed.

### Separate Authorization Procedure

1. Resolve the sender's declined name/expired registration through the authorized Meta owner workflow; no changes are made by this task.
2. After separate candidate-upload approval, from the verified Free Seeds checkout run `npm.cmd exec -- wrangler deploy --config apps/api/wrangler.whatsapp-test.jsonc`. This creates only the candidate Worker with the existing v2 staging D1 binding and no route/Cron/Queue/R2. It defaults test mode and provider sending off; no mobile-attestation variable exists or may be added.
3. Through protected Cloudflare secret entry, set only separately approved candidate bindings/vars. `WHATSAPP_TEST_MOBILE_ATTESTED` is removed and must not be configured. Do not place any secret value/contact in CLI args or files. Verify candidate service name/version, D1 binding, absent Cron/Queue/R2 and runtime window/readback.
4. Separately authorize deployment of the updated Production API and Admin code and set `WHATSAPP_TEST_RELAY_ENABLED=true`, the fixed candidate URL above, and the private recipient secret in both services. Keep Meta's current callback untouched. Read back the expected account, Worker versions, production D1/Queue/Cron bindings, relay flag/URL and recipient-block guard before the owner initiates. Ordinary recipients remain on the existing path; only the test recipient is split and blocked from production sends.
5. The already-approved manual action is to use the owner-controlled contact on the owner's own mobile Facebook session, open an already-running Get Free Seeds Click-to-WhatsApp ad, tap **WhatsApp / Send message**, and send only its prefilled greeting. Never create/boost/activate/edit an ad. Start30 minutes at initiation; stop at10 attempts, unknown status/free eligibility, or deadline.
6. On ambiguity, set candidate provider sending off while retaining the isolated input restriction and keep the production recipient block/relay active until Meta retries and test outbox state are settled. Then, only with separate authorization, disable the relay/block and read back normal production bindings. Do not disable ordinary Cron/Queue or redirect the Meta callback.

After separate deployment/relay authorization, the exact owner action is: using the supplied owner-controlled contact on the owner's own mobile Facebook session, open an already-running Get Free Seeds Click-to-WhatsApp ad, tap **WhatsApp / Send message**, and send only the prefilled greeting. Do not create, boost, activate or edit an ad. Start the approved30-minute window at initiation; hard-stop at10 outbound attempts,30 minutes, or unknown free eligibility/acceptance. No retries, ordinary customer messages, paid fallback or campaign activation. At present, the sender's declined name/expired registration and the undeployed relay/candidate prevent this step.

A 30-minute run cannot prove seven-day delivery behavior or post-24-hour template routing. Historical data has no per-contact expiry to replace those tests. If later required, prepare a separately authorized limited follow-up; do not extend the current window or infer expiry.

## Backup and Restore

The prepared encrypted vault is `%LOCALAPPDATA%\GFS-Orderflow-D1Vault` (actual local C: profile path). It is empty after tests, with inherited ACL disabled and verified owner/SYSTEM/Administrators-only access. File encryption is AES-256-GCM; the random key is wrapped by CurrentUser DPAPI and a scrypt-AES-GCM recovery envelope. The recovery phrase must come from the owner's password manager through a hidden process-only prompt and must never be sent in chat/Git/logs. No elevation/software install is needed. EFS is unsupported on this host and BitLocker status is unavailable without admin; the active file-level encryption does not rely on either. The shared F: tree was not used or changed.

The encrypted Wrangler export tool is guarded by exact export/destination/target approvals, current Cloudflare identity and D1 ID readback, a fresh Time Travel reference younger than30 minutes, the approved vault path and the owner recovery phrase. It streams Wrangler's file-only export through a Windows named pipe directly into AES-GCM, suppresses Wrangler output, verifies the encrypted artifact and returns a SHA-256. No production export was run.

`getfreeseeds-v2-restore-check` passes `PRAGMA quick_check` but is **not blank**: it contains schema/migrations and static configuration/content. It was not cleared or restored. Per RELEASE-READINESS-003, the owner-approved `getfreeseeds-v2-restore-fep-002` target now exists; read-only `quick_check` is `ok` and application-table count is0 (Cloudflare `_cf_KV` is platform metadata). No data restore, migration or Worker binding occurred. The encrypted production export is blocked until the recovery passphrase is supplied locally from the password manager and the fresh Time Travel bookmark reference is placed in the process environment. Do not expose either value in chat/logs.

## Validation, Protection and Release

Focused local tests cover signed CTWA opening without platform/attestation; split SENT/DELIVERED status fields; actual synthetic expiry; missing `billable` with explicit free classification; EN/UR rendering; duplicate delivery events; isolated budget/deadline/concurrency; unknown acceptance; and zero order/payment/CAPI side effects. These are synthetic only.

Final full Vitest **524 passed,1 skipped**; safe Node regression **72 passed** plus credential bridge **1 passed** with dummy values; TypeScript build/lint PASS; production dependency audit0. The Owner DPAPI/AES/recovery-wrap synthetic SQL restore and named-pipe tests PASS. Label Printer hashes **923 identical,0 changed,0 missing**. Live production monitoring, legacy V1 rollback (`GFS_LEGACY_ROOT` unavailable), and temporary Git-staging preflight harness were not run. Six development dependency findings remain registered.

No production message, export, restore, migration, Worker, callback, Meta setting, CAPI, payment, campaign or routing change. Preserve migration0049→unchanged0050→0051,0049 forward-only, RECOVERY_MODE, machine-evidence holds, six held COD records, financial atomicity, COD Rs.125, no physical stock dependency, Access/CAPI, and no unauthorized postal polling. Optional postal tracking does not delay WhatsApp; FIN-MO-002 remains mandatory before revised postal settlement.

S0 remains80% complete; S1/S3 remain100% locally accepted; S2/S4-S9 remain0% accepted exit; overall2/10 accepted (20%),8/10 remaining. `LAUNCH-001-RELEASE` and WhatsApp leads remain **NO-GO**. Inherited dirty files and `.audit-local/` remain untouched/excluded. The final published Git SHA is recorded in task closeout.
