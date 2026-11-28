# RELEASE-BLOCKER-CLOSE-001

## Outcome

**Local technical blockers closed; external acceptance remains PARTIAL / WhatsApp NO-GO.** Based on `0630c17b82a2e912e6669cf542b97b4d69314579`, this candidate adds a COD-compatible recovery mode and closes fulfillment quarantine gaps. No production deployment, migration, account change, backup export, message, payment or order mutation occurred. Existing production counts/versions in the MCP report were reused, not re-audited or presented as newly measured.

| Previous blocker | Disposition |
|---|---|
| MCP unavailable | RESOLVED previously; `list_pages` succeeded first in this task. Existing profile reused. |
| Historical paid-state conflicts | LOCAL ISOLATION RESOLVED; owner independently verified each actual bank credit in separate answers. The two records remain unchanged; machine-readable settlement/TID audit is still absent and the per-order hold is not released. No new audit/dispatch authorization was given. Production enforcement is not claimed until separately deployed. |
| Six test-held COD sidecars | PRESERVED. Synthetic six-held cohort remains blocked while unrelated confirmed COD can pack/dispatch exactly once. |
| V1 cannot display COD totals | LOCAL ROLLBACK CANDIDATE RESOLVED. Use this current-schema API/Admin with `RECOVERY_MODE=true`, not V1. Exact V1 4/4 remains historical compatibility evidence only. |
| Empty Wrangler migration ledger | PROCEDURE RESOLVED; historical provenance remains PARTIAL. Required live dependency DDL was read, matches the tested 0048 shapes, and custom marker mechanism is identified. No fake markers or old-migration replay. |
| Secure backup/restore | Synthetic restore PASS; production export/restore NOT AUTHORIZED/NOT EXECUTED. Existing automatic Time Travel reference is not an export backup. |
| Quality-pending templates called unavailable | CORRECTED. Current Manager tooltip explicitly says these templates can be sent to obtain a quality rating. Quality pending is not rejection. Matching exact locale/content and free pricing still gate use. |
| Sender, operator and contact-level FEP | PARTIAL. Owner confirmed operator authorization; current self-row reports Full control/Everything. Sender Connected/High, display name In Review; no observed send error establishes a platform restriction. Contact/send scope and live CTWA/rendering evidence are still pending. |
| Canonical production resources | RESOLVED BY OWNER CONFIRMATION. Owner explicitly confirmed the staging-named Worker/D1/R2/Queues currently serving Production are canonical; no binding changed. |

## Quarantine Contract

`fulfillmentEvidenceSql` is the common per-order evidence predicate for confirmation, tracking, label readiness, UI hold and CSV HOLD marking. Advance requires PAID, APPROVED, exact expected/approved/order totals, approval time, a persisted receipt and a matched immutable Admin settlement-reference/TID-hash audit. COD requires the exact customer quote-confirmation audit, matched sidecar state and no test hold. Existing exact historical MO evidence remains recognized. The incident hold is unchanged.

State-transition updates retain compare-and-set and exact evidence. Confirmation/tracking audit writes now recheck evidence, order state and archive status in the same SQL statement, preventing a precheck/write race. Both label aliases reject missing evidence. Export still supports ordinary operational records but marks quarantined ones HOLD; it is not a dispatch instruction. Reconciliation export remains disabled.

Synthetic tests exercise PAID and PACKING conflicts alongside unrelated valid Advance records through actual confirm/tracking/transition/label/detail/export routes, preserving all conflict payment/order rows and producing no operational audit for them. Concurrent audit-evidence removal fails closed. Six test-held COD records remain held; a seventh explicitly confirmed COD progresses and stale duplicate transitions fail. No hardcoded customer IDs, historical evidence creation, reverse payment or data migration is used.

**Isolation permits unrelated verified orders to proceed technically**, once the candidate is authorized/deployed. The two conflicts alone need not globally block unrelated orders. This does not close independent production identity, FEP, template mapping, backup or rollout gates, and does not assert the current older production handlers already enforce these new paths.

## COD-Compatible Recovery Candidate

The candidate is the source commit containing this report and the hashed source/artifacts below. API/Admin share `RECOVERY_MODE`: omitted or exact string `false` is normal; every other supplied value fails closed to recovery.

- API returns503/Retry-After300 for new POST intake/Flows/payment-choice/instant-form operations. Signed canonical WhatsApp webhooks still persist monotonic delivery statuses and existing receipt/reference evidence, but do not start/progress checkout or reply. Recovery-suppressed inputs are marked and cannot create a checkout when replayed after resumption. Receipts remain review, never automatic PAID.
- API scheduled handler is a no-op even if automation flags are on. Queue messages call retry with300-second delay without changing durable outbox attempt/state or sending/acking work. This is bounded by Cloudflare Queue max retries/retention: existing config has5 retries then DLQ. Recovery is not indefinite in-queue storage. Monitor DLQ; do not purge or auto-redrive.
- Admin retains protected order/COD/payment/receipt reads and guarded financial review/approval logic. It pauses confirmation, state transitions, tracking, both label aliases, direct Meta actions and reference/clearer-receipt message requests. No live sends can escape through the Admin test actions. Approval notifications queued by legitimate reviews remain subject to the paused API consumer, ordinary idempotency and free guard; existing duplicate-approval safeguards are unchanged.
- COD base/quote, fee125, consent, held records, normal/historical MO claims and receipt data are unchanged. This source is tested against both 0048 and migrated0051 schemas in recovery; it is not a binary downgrade to V1. After0049, retain its financial claims/triggers during every Worker rollback.
- Resume only after investigating the failure, verifying both Workers/settings, quarantining stale jobs and validating remaining CSW/FEP evidence. Do not replay recovery-suppressed inbound checkout events, bulk-create historical intents, blindly redrive DLQ or resend provider-accepted jobs. Existing INTENT idempotency/expiry/legacy isolation tests still pass. Unknown provider acceptance or free eligibility stops retry. Already-due reminders/expiry notices require individual state/window review before redrive. No universal resumption/replay is promised.

## Migration Readiness

This task refreshed only necessary release-dependency DDL in the already verified Cloudflare D1 Console: `orders`, `payments`, `payment_receipts`, conversations/eligibility locks, COD sidecar/config, normal/historical MO receipts and the two migration ledgers. Live required columns, unique constraints, amount/fee checks and references agree with the synthetic source-through0048 representation. Previously verified custom markers end0048 and Wrangler ledger is empty. Custom migration files self-record specific versions;0050 deliberately has **no custom marker**. These two ledgers are not interchangeable and absence of Wrangler rows is not evidence that0001-0048 need replaying. Complete historical execution provenance cannot be reconstructed from schema alone; do not fabricate it.

`tests/release-migration-compat.test.ts` applies only0049→0050→0051 on a synthetic0048 baseline, pins bytes, verifies old rows/schema definitions, no historical-intent backfill, MO auto-claims for old INSERT shapes, cross-ledger duplicate denial, immutable financial history, state/locale/lock guards and recovery handlers on both schema versions. It also restores a synthetic SQLite file and checks row/schema equality, foreign keys, claims immutability and intent triggers. SQLite explicit-transaction failure tests are **not proof of remote D1/Wrangler file-import atomicity**: raw multi-statement execution can leave preceding DDL after failure. Stop and inspect on every remote error; never continue/re-run blindly or drop global claims.

### Exact Future Procedure (NOT EXECUTED)

Run from the GFS root only after separate owner authorization, confirmed account/data plane, secure backup destination and a tested recovery path. `$env:GFS_D1_BACKUP_FILE` must point to an owner-approved access-restricted/encrypted destination outside Git. Do not output SQL/customer data to the terminal. No backup file is created by this task.

```powershell
# Authorized backup only; do not run with an unset or public destination.
if (-not $env:GFS_D1_BACKUP_FILE) { throw 'Owner-approved private backup destination required' }
if (-not (Test-Path -LiteralPath (Split-Path -Parent $env:GFS_D1_BACKUP_FILE))) { throw 'Verify protected parent directory first' }
if (Test-Path -LiteralPath $env:GFS_D1_BACKUP_FILE) { throw 'Refusing to overwrite an existing backup' }
npm.cmd exec -- wrangler d1 export getfreeseeds-staging --remote --config apps/api/wrangler.jsonc --output "$env:GFS_D1_BACKUP_FILE"
Get-FileHash -Algorithm SHA256 -LiteralPath "$env:GFS_D1_BACKUP_FILE"
```

Verify encrypted storage/read permissions and backup completeness privately. Retrieve the current automatic Time Travel bookmark in the verified account immediately before changes; keep it and backup checksum in the restricted incident record, not Git. Restore an authorized backup into a separately authorized isolated D1 target with no Workers/Queues/traffic; run `quick_check`, aggregate `foreign_key_check`, exact schema/index/trigger comparisons and private aggregate financial/receipt/claim totals before accepting recovery. The synthetic restore test is not a production restore rehearsal. Production Time Travel restore is destructive to later writes and needs explicit incident approval and reconciliation of all writes since its timestamp.

Stop new intake/automation through the approved recovery candidate, while continuing safe receipt/status capture. Recheck0049 duplicate counts (prior result0 is reused here), foreign keys and exact live dependency DDL immediately before applying. Verify no concurrent financial ledger writes can invalidate preflight;0049's own guard must remain in its file. Run these **targeted files**, checking successful readback after each. Never use `wrangler d1 migrations apply` on the empty legacy ledger:

```powershell
npm.cmd exec -- wrangler d1 execute getfreeseeds-staging --remote --config apps/api/wrangler.jsonc --file migrations/0049_cod_mo_global_reference_claims.sql
# STOP on any error. Verify0049 marker, complete global claim/backfill and triggers.
npm.cmd exec -- wrangler d1 execute getfreeseeds-staging --remote --config apps/api/wrangler.jsonc --file migrations/0050_order_confirmation_intents.sql
# Verify exact objects/constraints/preferences/stages and zero history backfill; no invented0050 marker.
npm.cmd exec -- wrangler d1 execute getfreeseeds-staging --remote --config apps/api/wrangler.jsonc --file migrations/0051_order_confirmation_intent_state_guards.sql
# Verify0051 marker/state triggers, financial/receipt totals and foreign keys.
```

0049 is forward-only once applied: preserve claim rows, triggers and receipts in Worker rollback. Never delete intent/order/payment state or down-migrate as a Worker rollback. A failed partial file requires schema/readback assessment and a separately authorized repair/recovery plan. FIN-MO-002 remains required before gross625/VPL550+75/MO550 settlement; this task does not implement or activate it.

## Candidate Manifest and Commands

Source base: `0630c17b82a2e912e6669cf542b97b4d69314579`; exact candidate commit is the scoped commit containing this report (recorded in final publication). API source SHA-256 `f22a08f832c236b5dcc774f8b1d4eefebd3d565d8b8ac42bc1079ff39ca31a1a`; Admin source `9382b4c2e05ddfb9cb2c3eb6bc21bfa931ec3aaff3fb03d68860f378145e636b`.

Wrangler4.149.0 local recovery `--dry-run --var RECOVERY_MODE:true` bundles: API SHA-256 `bc06cefabf519ecebe66966211b74c99fca3abbdeba7a92eb83a8b0081236b8c`; Admin `1f7e8ae8de39a4a8dfe4ccc85f92c643ac6836be01e0f95140b9cff24d18abe8`. Output is local Temp only, never uploaded. Migration hashes0049 `01fd20cb7294c9401efa3773f5ecb05f4373972969c86de74493e546df34fec6`,0050 **unchanged** `d3aad32271a7988fd44d34fc36e03486c68d4551237dc68c696bb3bafba4e5b4`,0051 `900c4410796cb0de20da568088a7563f670be758454f129d38fd28207606a47a`.

Previously observed production API `b426ba47` and Admin `3e4b7c26` are not automatically safe quarantine rollback versions. Use the reviewed current-schema candidate with recovery on. Binding contract remains API D1 `DB`, R2 `RECEIPTS`, `EVENTS` producer/consumer with DLQ/max5 retries, version metadata, one-minute Cron; Admin D1/R2 and Queue producer. Checked-in names are staging-named. Verify full active binding IDs, secrets presence (not values), Access, routes and all runtime vars against the existing snapshot before future commands; do not overwrite an independently confirmed production binding with an assumed staging one.

Only after separate deployment authorization and parity validation, these are the exact candidate recovery commands; **not run here**:

```powershell
npm.cmd exec -- wrangler deploy --config apps/api/wrangler.jsonc --keep-vars --var RECOVERY_MODE:true --var ORDER_INTENT_AUTOMATION_ENABLED:false --var PAYMENT_CHOICE_RECOVERY_ENABLED:false --var PAYMENT_REMINDERS_V2_ENABLED:false --var PAYMENT_AUTOMATION_V2_ENABLED:false
npm.cmd exec -- wrangler deploy --config apps/admin/wrangler.jsonc --keep-vars --var RECOVERY_MODE:true
```

Confirm100% recovery API then100% recovery Admin and read back version/config/health before any action. Old Worker versions do not implement this flag; adding a flag to an old binary is not rollback. A mixed canary cannot guarantee quarantine if any old Admin traffic remains. Start with no public acquisition; keep new INTENT automation false, CAPI/routing/payment methods/fee unchanged. For a separately authorized initial candidate canary, use at most1% API for5min after independent recovery/monitoring readiness; Admin evidence enforcement must cover100% of operational requests, not a partial percentage. Any code/version promotion needs approved pinned full version IDs and the project watchdog, not placeholder IDs in a script.

On any duplicate send/approval, inconsistent amounts/state, unexpected price/charge, unknown eligibility, failure/error-rate increase, Access issue, invalid runtime config or DLQ anomaly: stop acquisition, pin100% of each Worker to the tested recovery candidate, keep data/schema and DLQ intact, record private incident evidence and reconcile before resumption. A D1 failure is not solved by force-dropping claims or retrying a partial migration. Rollback source is now local-test ready; no remote candidate version exists yet.

### Normal Resumption (NOT AUTHORIZED)

Redeploy the **same accepted current-schema source** with `RECOVERY_MODE:false` only after failure resolution and Queue/DLQ review. Keep every reminder/INTENT automation flag false initially. Verify a new synthetic inbound request, unchanged COD/Advance records, zero duplicate sends and independent metrics before separately enabling INTENT-030. For eligible new intents the existing legacy-isolation guard prevents +15/+210 scheduling when +10/+25/+30 is used; existing tests cover isolation and duplicate stage/retry handling. No bulk historical fresh-intent recovery or unreviewed DLQ redrive. Do not enable revised postal settlement.

```powershell
# Future separately authorized normal-source promotion/resumption; do not run now.
npm.cmd exec -- wrangler deploy --config apps/api/wrangler.jsonc --keep-vars --var RECOVERY_MODE:false --var ORDER_INTENT_AUTOMATION_ENABLED:false --var PAYMENT_CHOICE_RECOVERY_ENABLED:false --var PAYMENT_REMINDERS_V2_ENABLED:false --var PAYMENT_AUTOMATION_V2_ENABLED:false
npm.cmd exec -- wrangler deploy --config apps/admin/wrangler.jsonc --keep-vars --var RECOVERY_MODE:false
```

## Outstanding Meta/FEP Test

Narrow live reads only: Manager self-row reports Full control/Everything; phone is Connected/High with display name In Review. No new account setting was opened for edit. Both exact existing EN15m/UR30m Utility statuses remain Active–Quality pending. The live status tooltip says templates can be sent and get a quality rating afterward. This corrects the earlier assertion that quality-pending itself prevents sending; it is neither rejection nor proof that our specific message/locale/window route is eligible. No actual send restriction/error was observed. No new templates were submitted or messages sent.

Use prior aggregate FEP/free-service/paid totals only as account history, never as per-recipient quota or next-send proof. A future separately approved test requires one genuine signed CTWA ad referral and the actual provider timestamp; no device/OS field or test attestation. Permit only the one free-guarded opening response inside CSW. Require matched provider status, `referral_conversion`, actual expiry and explicit free-entry-point/PMP pricing before follow-up. Monthly service allowance remains disabled. If referral/pricing/expiry is absent, stop and expose unresolved; do not infer seven days or use paid fallback. Outside CSW use only an exact approved locale/template mapping. Existing EN/UR templates do not establish mappings for all INTENT stages.

For bilingual rendering use an owner-controlled test device with consent for both locale journeys; verify English LTR, Urdu RTL, paragraph order, isolated numbers/amounts/URLs, button labels, synthetic order and tracking IDs. Do not create a live parcel, real payment or customer checkout. Record sanitized PASS/failure labels only; no phone, referral ID, receipt or screenshot of customer data. Exact permitted test sends/contact/time window must be separately approved first; no permission is inferred here.

## Validation and Remaining Owner Actions

### Owner Answers Obtained

On2026-11-27 the owner separately confirmed the canonical production resources, authorized Meta operator, PAID historical credit and PACKING historical credit. These are explicit owner attestations, not a new automated bank query or immutable historical audit. No account/order/dispatch/payment/migration/deployment action follows from these answers. Existing per-order holds remain pending a separately authorized genuine evidence-recording/reconciliation step; no historical approval evidence is fabricated.

Owner also selected **Test scope to be supplied** and **Destination to be supplied**. A contact/send count/time window and private encrypted backup/isolated restore target have not actually been supplied, so no live message/export/restore is authorized or attempted. Do not ask again for the four completed confirmations unless evidence changes.

Focused recovery/quarantine/migration/financial/FEP/intent/security:143 passed across8 files. Full regression:499 passed/1 skipped across41 files. Node safety52/52; TypeScript/build and lint PASS; production audit0. Six registered moderate dev-tool findings remain. Protected Label Printer923/923; inherited three MO documents and `.audit-local` untouched. Test-only type/schema fixtures were repaired and focused/full/build checks rerun. A final recovery fix preserves delivered intent timing receipts when0050 is installed without scheduling new work, and still works on0048 without intent tables. No production customer data was exported or stored in Git.

The four confirmations are complete. The only remaining promised private execution inputs are:

1. One owner-controlled contact and explicit mobile CTWA/English-Urdu send count, time window and sanitized rendering scope. No real customer or campaign activation. No send until these details and separate approval are available.
2. A private encrypted D1 export destination and isolated restore-test target with explicit export/restore authorization. No backup/customer data or recovery IDs in Git; migration/deployment still needs subsequent authorization.

The bank checks already completed by the owner matched each original receiving account/provider, credited amount, reference/date and receipt privately. Those details are not reproduced here. Keep the two holds until a separately authorized genuine evidence-recording step; do not request the same credit verification again or fabricate a historical audit.

S0 remains80%/20% open (A06/A10 partial); S1/S3 remain100% local/0% local remaining. S2 operational exit0% accepted/100% open pending authorized machine-evidence reconciliation and final A-G acceptance; both actual bank credits are now owner-verified and do not require repeat confirmation. S4 local controls pass/live acceptance partial,0% full exit accepted; S5-S9 remain0%/100% open. Overall stage exits2/10 complete,8/10 open. This measures accepted exits, not engineering effort. All O01-O23/REV.2, historical fresh-intent recovery, FIN-MO-002, authorized Pakistan Post integration and project-isolation rules remain registered. **NO-GO; LAUNCH-001-RELEASE is not prepared or activated.** Next single task: obtain the promised private controlled-test scope and secure backup/isolated restore details, then perform only separately authorized verification; no general audit restart.
