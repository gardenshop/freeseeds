# GFS-ORDERFLOW-RELEASE-READINESS-003

**Date:** 2026-11-28

**Repo:** `gardenshop/freeseeds`

**Branch:** `codex/gfs-order-001-rev2`

**Last published before this follow-up:** `0930daa90e4ad1ddd56a7bb6f3749cd9f1b645d3`

**Result:** candidate engineering locally verified; live release **NO-GO**.

## Disposition of Prior Events

The comparison now has eight synthetic inbound events across seven recipient-hash leads:

- Five new leads carry a valid authenticated signed `source_type=ad` referral and hashed `ctwa_clid`, all without device/platform fields. Each receives the first free opening response.
- One structurally valid new inquiry has no referral or prior verified context. It may be ordinary inquiry or a CTWA event whose referral was not supplied; the event is not malformed. No free basis can be proven, so it remains `UNRESOLVED_FREE_ELIGIBILITY` / `FREE_BILLING_UNKNOWN_OR_MISMATCHED` and is not sent.
- One returning contact has no referral on the new message and no retained signed referral/FEP evidence. Returning status alone does not prove free eligibility, so it remains unresolved and is not sent.
- A further message from one of the verified CTWA contacts also has no new referral. The conversation retains that contact's earlier authenticated referral plus the matched sent/delivered `referral_conversion`, actual provider expiry and `PMP/free_entry_point/referral_conversion` pricing evidence. That returning response is eligible and delivered without requiring a repeated referral.

The two prior unresolved cases therefore do **not** become free sends merely because one may have been CTWA or one is a returning customer. One remains an unknown-origin new lead; the other remains unsupported because the earlier conversation has no verified evidence. The expanded returning fixture with real retained proof succeeds. Follow-up webhook messages need not repeat the referral while the persisted evidence is valid; no source/device field is inferred.

## Coverage Comparison

Production Worker version `b426ba47` maps to source commit `901f3f6`. Its pre-existing send path makes the reply attempt based on the CSW; the old source contains no matching per-contact FEP/pricing gate. The comparison reuses the same sanitized in-window messages and validates the old predicate against the candidate Worker with a mocked provider. This measures attempts, not historical provider acceptance/delivery.

| Metric | Legacy b426 attempt rule | Candidate synthetic result |
|---|---:|---:|
| Inbound provider events | 8 | 8 |
| Unique recipient-hash leads | Not measured by legacy rule | 7 |
| Attemptable messages inside CSW | 8 | 6 provably free-eligible events |
| Free-eligible distinct leads | Not classified by legacy rule | 5 |
| Attempted / accepted / delivered messages | 8 attempts; historical acceptance unknown | 6 / 6 / 6 |
| Accepted / delivered eligible leads | Historical values unavailable | 5 / 5 (100% eligible-lead coverage) |
| Read leads | Historical value unavailable | 2 |
| Failed / suppressed leads | Not classified | 0 / 0 |
| Unresolved leads / inbound events | Not classified | 2 / 2 |
| Duplicate accepted replies | Not measured | 0; replay of an accepted event sends no second response |

The one returning message with retained evidence is eligible; the two remaining no-evidence events are not. Candidate coverage is 6/6 eligible inbound response events and 5/5 eligible distinct leads. These outcomes are synthetic and do not establish live production delivery/coverage. Admin reports distinct recipient-hash leads separately from event counts and keeps event-level unresolved outcomes visible.

## Permanent Protections

- `GFS-ZERO-MISSED-LEADS-001`: account for unique inbound events once, associate them to recipient-hash leads where a sender ID exists, retain exact outcomes/reasons, and never count unknown acceptance as success. Missing evidence is unresolved, not silent loss.
- `GFS-FREE-ONLY-001`: initial signed CTWA opening needs only documented ad-referral evidence and the real CSW; later FEP needs the matching provider evidence and actual expiry. Monthly service allowance is disabled because there is no exact shared account-level pre-send quota across senders. No dashboard aggregate authorizes a send, no paid fallback, no Admin bypass.
- `GFS-NO-META-AGENT-001`: the current Meta Business Agent page offers **Set up**; it remains unconfigured. No agent was enabled or used.
- A confirmed `pricing.billable=true` DELIVERED/READ status creates a hash-only incident and WABA-wide circuit-breaker pause atomically. A recipient-specific block is added when a valid recipient ID is present; if the recipient/timestamp is absent, the global pause still fires without persisting a raw ID. API/Admin/Cron/Queue all use the shared guard. Admin alerts. There is no auto-resume or paid fallback; internal payment/order/COD/fulfillment processing is unaffected.

## Meta Read-Only Status

The existing authorized Chrome DevTools MCP session is responsive; `list_pages` was called first and the existing profile/account retained. Phone Numbers shows an **In Review** name label; Profile shows active `Get Free Seeds` as **Rejected**. The owner says `Free Seeds In Pakistan` is already under review and explicitly says **do not resubmit or change it**. Phone status is **Connected**, quality **High**; Messaging Limits is **Current**. A read-only Graph v26 status call through the existing authenticated Admin context returned `name_status=DECLINED`, `registrationStatus=EXPIRED`, quality GREEN, WABA subscribed=true, and `whatsapp_business_management`/`whatsapp_business_messaging` permissions granted. This reconciles Connected as a phone link state, not registration proof. Production API token parity and production webhook secret bindings were not inferred from the Admin staging response; callback/routes remain unchanged. Business Agent remains at **Set up**/disabled. No Meta setting was changed.

The active name is rejected while the owner-reported alternate is in review; do not use Edit, submit or switch profiles. For a new registration review, the supported existing-number flow is Request SMS code once → owner enters OTP privately → Verify code → owner enters the existing two-step PIN privately → Register phone → re-read status. This is **not authorized yet**; never request/share OTP/PIN in chat. The WABA is already subscribed; do not click Subscribe. If the name review later rejects the pending alternate, request owner direction before any resubmission. Production API Graph scope/secret parity also needs a read-only check before a live test.

## Backup, Restore and Candidate Gates

- Encrypted backup vault: `%LOCALAPPDATA%\GFS-Orderflow-D1Vault`; AES-256-GCM/DPAPI/recovery-envelope self-tests and ACL checks passed. A current-state D1 Time Travel bookmark was generated after re-verifying the account; its reference was not copied to chat/docs and is not set in the export process environment. Recreate/populate a bookmark immediately before export if more than30 minutes old. No production export was performed because `GFS_D1_VAULT_RECOVERY_PASSPHRASE` is absent from the local process environment; the owner must enter it privately from the password manager. The backup utility streams directly to ciphertext, validates by decrypting only in memory and retains no plaintext SQL.
- Existing `getfreeseeds-v2-restore-check` is **not empty**: it contains schema/migrations/static configuration even though customer tables were empty in the prior aggregate read. Never reset or overwrite it.
- The owner-approved isolated target `getfreeseeds-v2-restore-fep-002` exists (account identity reverified before target preparation). Read-only `PRAGMA quick_check` returned `ok`; application-table count is0. Cloudflare's internal `_cf_KV` metadata table is excluded from the restore emptiness check. Existing `getfreeseeds-v2-restore-check` was not reset or written. No data was restored and no migration applied.
- The API isolated-test Wrangler config now binds to the empty target, with provider/test sends off and no Cron/Queue/R2 or production routes; `workers_dev` is only a preview URL. An isolated Admin config is prepared with the same target, provider/automation disabled, no Queue/R2, `workers_dev=false`, and a dummy disabled identity so it cannot bypass Access. API/Admin candidate dry-runs pass; no Worker was uploaded. The Admin candidate still needs an Access-protected read-only preview; do not add an Access policy/route without approval.
- The owner-approved contact and 10-attempt/30-minute test bound are reused; they are not being re-requested. No live send is authorized by this report. The earlier consolidated owner authorization covers nonproduction backup/restore and isolated candidate/relay preparation only; the display-name review, registration mutation, production callback and live send are excluded.

### Consolidated Owner Authorization (Granted)

The owner selected **All nonprod prep**. This authorization covers these preparation actions only; it does **not** authorize a production migration, live message, campaign, callback/route change, display-name change or Access policy mutation:

1. **Encrypted backup/export:** one-time production D1 export to the existing encrypted vault, after the source identity and fresh Time Travel reference are verified; no plaintext artifact/log.
2. **Isolated restore:** restore/validate only into `getfreeseeds-v2-restore-fep-002`; explicitly do not reset `getfreeseeds-v2-restore-check`.
3. **Candidate API/Admin deploy and selective relay setup:** bind candidate API to the isolated target, apply `0052` only there, prepare/deploy workers.dev-only candidates with production routes/Meta callback unchanged and Cron/Queue/R2/provider sending off. Admin preview remains blocked until an already-authorized Access-protected preview exists. The selective relay remains disabled until sender/registration/permission and live-test gates pass. The existing test contact and 10-attempt/30-minute scope are reused; they are not re-confirmed here.

The nonproduction preparation authorization is recorded. Export is blocked by the absent local recovery passphrase and the bookmark reference not being present in the process environment; the owner must privately source the passphrase and a fresh reference immediately before export, never in chat. Restore, `0052` and candidate API deployment remain dependent on the encrypted export. Admin deployment additionally requires an Access-protected isolated preview. A live send remains blocked by sender registration/permission review and release checks.

## Migration and Preserved Controls

The required sequence is `0049 → unchanged 0050 → 0051 → 0052`; `0049` remains forward-only. A read-only production D1 marker query returned 11 custom markers with maximum `0048` and0 entries in native `d1_migrations`; therefore none of0049–0052 is recorded on production. The candidate migration hash/sequence and `RECOVERY_MODE` compatibility pass locally, but production `0052` is **not applied**. API returns503 if its required ledger is absent; Admin shows an explicit unavailable state. Backup/restore and COD-compatible rollback remain unproven until the authorized encrypted export/restore. Preserve payment methods, COD Rs.125, financial atomicity, historical holds, six held COD records, O01–O23, REV.2, FIN-MO-002, Access, CAPI OFF, standalone MO and Hoja Seeds zero-connection rule. No postal automation is in this release scope.

## Validation and Gate Status

- Vitest **534 passed, 1 skipped** across44 files; Node safety **52/52**; credential-scope test with dummy values PASS; TypeScript/lint PASS.
- API/Admin Wrangler dry-run PASS (no upload); production dependency audit0; full dependency audit retains the six registered development findings unchanged.
- Protected Label Printer manifest **923/923 identical**; no file in that sibling was modified. Inherited dirty reports and `.audit-local/` remain preserved/uncommitted.
- Branch/local/remote SHA is verified in the final task closeout. No migration, export, restore, Worker upload, message or campaign occurred.
- S0 remains80% (8/10); S1/S3 locally accepted; S2/S4–S9 operational exits not accepted. Overall2/10 stage exits (20%). Launch remains **NO-GO** until backup/restore, migration, deployment, sender/review, registration/permissions and rollback gates are authorized and verified.
