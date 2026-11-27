# GFS-ORDERFLOW-LIVE-TEST-001

## Outcome (2026-11-27)

**STOPPED BEFORE TEST START. Outbound count 0/10; no 30-minute window started; no live acceptance claimed.** The owner authorized the private one-contact test, count/window and free-only/no-retry constraints. The supplied contact is intentionally omitted from this permanent record. No message, campaign, Worker, routing, D1, payment or Meta setting was changed. No FEP, pricing, rendering, button, payment/COD or template evidence was generated.

Verified repo `gardenshop/freeseeds`, branch `codex/gfs-order-001-rev2`, local and origin HEAD `ba9effb6bbc036e0388d62d65fb6977104af66b2`. Chrome DevTools `list_pages` was first. Cloudflare visible identity was Get Free Seeds / account ID `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. No customer rows, WhatsApp chat snapshots, message payloads, WAMIDs, private test number or ad click data were collected. The Cloudflare dashboard displayed an overdue account-balance warning; no billing action was taken.

## Safety Gate: Existing Production Jobs

Read-only Cloudflare Workers Production settings showed the existing API Worker `getfreeseeds-api-staging` at 100% traffic on deployed version `b426ba47` (old source, deployed Nov 4). Its settings include `PAYMENT_CHOICE_RECOVERY_ENABLED=true`, a configured Cron trigger scheduled every minute (next displayed 12:46 UTC at observation), and an EVENTS queue binding/consumer. `META_PROVIDER_ENABLED=true`; `PAYMENT_AUTOMATION_V2_ENABLED=false`, `PAYMENT_REMINDERS_V2_ENABLED=false`, `PAYMENT_UTILITY_TEMPLATES_APPROVED=false`. There is no observed per-contact outbound cap of10/30 minutes. This Worker can process existing work independently of the controlled contact and the test authorization cannot bound it or prevent unrelated queued/Cron sends. Therefore initiating CTWA now could violate both the test cap and no-other-customer-messages boundary. Test stopped before owner action or provider send.

The Admin Production Worker is also the older deployed service and binds the current staging-named D1, Queue and receipt R2; no Cron/Queue consumer was configured for that Admin service. This does not remove the API Cron/consumer risk. The account was not mutated to disable jobs because production flag/trigger/routing changes are out of scope and would affect normal operations. No new-number lock or production routing was changed.

### Manual CTWA instruction (deferred)

Do **not** initiate while the cap gate is open. Once a separately authorized test endpoint has a verified per-contact counter, suppresses every unrelated recipient, and has all Cron/Queue sends disabled for that isolated test, the owner should use their own mobile Facebook session, open an already-running Get Free Seeds Click-to-WhatsApp ad, tap **WhatsApp / Send message**, then send only the ad's prefilled single test greeting in the opened business chat. Do not create, boost, activate or edit an ad/campaign. If no already-running approved ad is available, stop; do not substitute an ordinary WhatsApp chat because it lacks genuine mobile CTWA referral evidence. The 30-minute window starts only when the owner initiates the approved test. Count every outbound business message; stop at10, on unknown eligibility/acceptance, or at30 minutes, with no retry.

## Current vs Candidate Acceptance

Current API version `b426ba47` is old and does not establish candidate behavior. No candidate deployment or candidate acceptance occurred. Existing account-level or tooltip evidence is not contact-level evidence. The following are all **NOT TESTED**: signed mobile CTWA referral, initial business response, FEP start and actual expiry/duration, per-contact free/non-billable pricing, English LTR and Urdu RTL paragraph order/spacing, localized buttons, payment/COD formatting, Utility template category/locale routing, and free-only eligibility. A 30-minute window cannot prove seven-day behavior; a service-window test cannot prove template routing after24 hours. Any follow-up after24 hours requires its own separately approved bounded test and must use exact provider expiry/pricing evidence; never assume168 hours.

Candidate testing needs a separately authorized isolated endpoint. Minimal safe future procedure: use an isolated Worker/D1 with no production route, and bind an explicit test-recipient allowlist,10-message/30-minute durable cap, free-only guard and one-way stop controls; leave Cron/Queue triggers disabled and all other recipients rejected. Genuine CTWA webhook delivery requires a Meta callback/phone configuration decision; do not retarget the current production callback. If no isolated Meta callback/test number and isolated D1 are available, candidate live acceptance stays blocked. This task authorized no deployment, binding, callback, flag or test-infrastructure mutation.

## Restore Target and Backup Readiness

Read-only inventory of the existing D1 `getfreeseeds-v2-restore-check` confirmed it exists in the verified account and showed zero queries/rows read/rows written in its last-24-hour metrics window. Its current name is the proposed restore target. Its database was not queried or changed. Production API and Admin both bind `getfreeseeds-staging`, not this target. Other inspected GFS services `getfreeseeds-v2-api-staging`, `gfs462-isolated-target` and `gfs464-isolated-watchdog` showed no target binding; `getfreeseeds-v2-admin-staging` binds `getfreeseeds-v2-staging`, has no Cron or queue consumer and Meta provider is disabled. These observed bindings indicate the named target is isolated from the inspected GFS Workers; no restore was performed. Schema/count/constraint readiness still requires post-approval preflight.

No compliant backup destination is verified. `F:\GFS-Backups` exists and has approximately456GiB free, but ACL grants `Authenticated Users` Modify and EFS reports new files there are not encrypted. `manage-bde -status` was denied for lack of administrative rights, so BitLocker state cannot be verified. No local `7z`, `age` or `gpg` encryption executable was available. Do not use this folder or create a plaintext staging export. Do not change the shared F: root or ACL: it contains other project backups and standalone MO must remain protected.

**Destination recommendation for owner/admin decision:** provision or designate a dedicated owner-only encrypted vault outside shared project backup roots; confirm encryption-at-rest, access/audit ACLs and capacity before export. No exact existing vault path was discoverable or verified, so there is no destination ready for approval/export. The D1 target candidate is `getfreeseeds-v2-restore-check`; owner can approve this exact target conditionally on a final current isolation/identity readback. One consolidated approval should identify the exact compliant destination and target, attest encryption/access/capacity/isolation readback, and explicitly authorize production export plus isolated restore. After approval only: fresh Time Travel recovery reference, export directly into the verified encrypted destination without plaintext temp retention, private checksum/integrity verification, restore only into that isolated D1, compare schema/tables/constraints/aggregate counts and financial invariants, and verify migration compatibility. No production restore.

## Release, Tests and Remaining Gates

No source changed. Reuse baseline full499 passed/1 skipped, focused143, Node52/52, build/lint PASS, production dependency audit0; retain six registered development dependency findings. No unrelated audit rerun. Reverify protected Label Printer hashes before publication; preserve its code/data/config, standalone MO Printing, and Hoja zero-connection.

No migration or deployment occurred. Preserve targeted0049→unchanged0050→0051,0049 forward-only, RECOVERY_MODE COD financial evidence/receipt behavior, machine-evidence holds, six test-held COD records, financial records and DLQ. Preserve existing payment methods, COD Rs.125, bilingual formatting, Access and CAPI. No LAUNCH-001-RELEASE prepared.

| Gate | Status |
|---|---|
| Owner test authorization | Approved; contact omitted here |
| Existing job count isolation | FAIL/CLOSED: old API Cron+Queue active; no enforceable cap |
| Outbound messages | 0/10; none sent |
| CTWA/FEP/pricing/rendering/templates | Not tested; no evidence fabricated |
| Backup destination | Not ready: F: rejected; BitLocker unknown; no approved encrypted path |
| Restore D1 | `getfreeseeds-v2-restore-check` observed; isolated from inspected GFS Worker bindings; schema/restore not tested |
| Production mutations | None |
| Release | NO-GO |

S0 remains80% complete (20% open; A06/A10 partial); S1/S3 remain100% locally accepted; S2 and S4-S9 remain0% accepted exit. Overall2/10 exits accepted (20%),8/10 remaining. Preserve O01-O23/REV.2, FIN-MO-002, historical fresh-intent recovery, postal integration, and six development dependency findings. Inherited dirty files and `.audit-local/` remain untouched and excluded from scoped publication.
