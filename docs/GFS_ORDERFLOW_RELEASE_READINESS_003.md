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

The existing authorized Chrome DevTools MCP session is responsive; `list_pages` was called first and the existing profile/account context was retained. Phone Numbers shows an **In Review** name label; Profile shows active `Get Free Seeds` as **Rejected**. The owner says `Free Seeds In Pakistan` is already under review and explicitly says **do not resubmit or change it**. Phone status is **Connected**, quality **High**. Messaging Limits is marked **Current**, but neither that nor Connected proves registration expiry or Graph API scopes. The prior Graph `EXPIRED`/WABA-subscription data remains unreconciled; the current Phone Manager view exposes no separate registration-expiry or Graph-scope field. Business Agent remains at **Set up**/disabled. No Meta or Cloudflare setting was changed.

If review status must be read again, use the same authenticated Chrome DevTools profile and read Phone Numbers → Profile; do not use Edit, submit, re-register or switch profiles. For an authorized Graph scope/registration read, use the existing secure Graph client and keep its token private. If a future authorized read confirms registration is expired or scopes are absent, follow Meta's official existing-number repair/grant flow only after the owner approves that specific action. Never request/share OTPs. The pending name is not to be resubmitted.

## Backup, Restore and Candidate Gates

- Encrypted backup vault: `%LOCALAPPDATA%\GFS-Orderflow-D1Vault`; previous AES-256-GCM/DPAPI/recovery-envelope self-tests and ACL checks passed. No production export was performed. Export must use a fresh Time Travel reference, verify source account/D1, stream directly to ciphertext, validate checksum by decrypting only to memory, and retain no plaintext SQL. The recovery passphrase is entered privately through the process environment; it is never provided in chat.
- Existing `getfreeseeds-v2-restore-check` is **not empty**: it contains schema/migrations/static configuration even though customer tables were empty in the prior aggregate read. Never reset or overwrite it.
- Proposed empty isolated target `getfreeseeds-v2-restore-fep-002` is not yet created. Create/read it only after owner approval and quota/cost approval. Verify account identity and empty state before restore; no production binding is permitted.
- The API isolated-test Wrangler config exists and dry-run passes; the Admin dry-run used the ordinary staging config and is **not** evidence of an isolated Admin deployment (it binds the staging queue/R2 and Meta-enabled flags). No worker was uploaded. An isolated Admin config still must be prepared with provider/automation disabled and only the authorized isolated D1; the API config must bind to the approved restored target. Any approved candidate upload remains workers.dev-only with production routes/callback unchanged and Cron/Queue/R2/automation closed.
- The owner-approved contact and 10-attempt/30-minute test bound are reused; they are not being re-requested. No live send is authorized by this report. Restore, candidate deployment and relay setup require the consolidated owner approval below; the display-name review is explicitly excluded from any such approval.

### Consolidated Approval Request

Only these preparation actions remain for owner approval; selecting any does **not** authorize a production migration, live message, campaign, callback/route change, or display-name change:

1. **Encrypted backup/export:** approve a one-time production D1 export using the fresh Time Travel reference and the existing encrypted vault, after source identity verification; no plaintext artifact/log.
2. **Isolated restore:** approve creation/use of `getfreeseeds-v2-restore-fep-002` and restore/validation there; explicitly do not reset `getfreeseeds-v2-restore-check`.
3. **Candidate API/Admin deploy and selective relay setup:** approve preparing the isolated Admin config, binding the existing API test config to the approved restored target, and applying `0052` only to that isolated target; then upload only the workers.dev candidate with production routing/Meta callback unchanged and Cron/Queue/R2/automation off. The selective relay remains disabled until sender/registration/permission and owner approval gates pass. The existing test contact and 10-attempt/30-minute scope are reused; they are not re-confirmed here.

The requested action is scoped to one-time backup, isolated restore and isolated candidate preparation. A separately authorized live send remains blocked by sender registration/review and release checks.

## Migration and Preserved Controls

The candidate sequence is `0049 → unchanged 0050 → 0051 → 0052`. `0049` remains forward-only; verify markers/checksums/schema and `RECOVERY_MODE` compatibility before applying anything. Migration `0052` is source-only and unapplied. API returns 503 if its required lead/billing ledger is absent; Admin shows an explicit unavailable state. Existing migration history, backup, isolated restore and COD-compatible rollback are not proven by dry-run. Preserve payment methods, COD Rs.125, financial atomicity, historical holds, six held COD records, O01–O23, REV.2, FIN-MO-002, Access, CAPI OFF, standalone MO and Hoja Seeds zero-connection rule. No postal automation is in this release scope.

## Validation and Gate Status

- Vitest **533 passed, 1 skipped** across44 files; Node safety **52/52**; credential-scope test with dummy values PASS; TypeScript/lint PASS.
- API/Admin Wrangler dry-run PASS (no upload); production dependency audit0; full dependency audit retains the six registered development findings unchanged.
- Protected Label Printer manifest **923/923 identical**; no file in that sibling was modified. Inherited dirty reports and `.audit-local/` remain preserved/uncommitted.
- Branch/local/remote SHA is verified in the final task closeout. No migration, export, restore, Worker upload, message or campaign occurred.
- S0 remains80% (8/10); S1/S3 locally accepted; S2/S4–S9 operational exits not accepted. Overall2/10 stage exits (20%). Launch remains **NO-GO** until backup/restore, migration, deployment, sender/review, registration/permissions and rollback gates are authorized and verified.
