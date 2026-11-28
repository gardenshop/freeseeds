# GFS-ORDERFLOW-EXECUTION-CLOSE-006

**Date:** 2026-11-28

**Repository:** `gardenshop/freeseeds`

**Branch:** `codex/gfs-order-001-rev2`

## Requirement Results

| Requirement | Status | Evidence |
|---|---|---|
| Free Seeds identity and branch baseline | PASS | Local/remote matched `2acf7f7aaefe74d2930f26a82ec262649af540a6` before this closeout. Inherited dirty reports and `.audit-local/` are excluded. |
| Encrypted production export | BLOCKED | No visible owner-private PowerShell prompt can be launched by this session. Recovery passphrase is absent from the process; no secret requested or exposed. Exact ready-to-run procedure remains in BACKUP-RESTORE-RELEASE-004. |
| Isolated target safety | PASS | `getfreeseeds-v2-restore-fep-002`: account verified, `quick_check=ok`,0 application tables. Existing nonempty restore-check was untouched. |
| Restore / isolated0049-0052 | BLOCKED | Dependent on verified encrypted export. Production marker ledger remains through0048; no restore or migration ran. |
| Candidate upload | BLOCKED | Dependent on encrypted restore and no public/Access-safe Admin preview. API/Admin isolated configs dry-run only; no worker upload. |
| Meta HTTP400 diagnosis | PARTIAL | Existing error lost code/subcode because the former sanitizer discarded them. Endpoint is `POST /v26.0/{phone-id}/request_code`, JSON `{code_method:"SMS",locale:"en_US"}`. Local code now retains numeric code/subcode, sanitized provider type and trace ID without free-form message/token. Synthetic regression passes. No SMS retry. |
| Meta registration / display name | BLOCKED | Admin-token Graph read: `registrationStatus=EXPIRED`, `name_status=DECLINED`, WABA subscribed, permissions granted. Phone Manager Connected/High is not registration proof. Name label is In Review and active profile rejected. Owner said do not resubmit. One authorized request-code attempt returned HTTP400/not applied; no OTP issued/entered. |
| Production API token parity | BLOCKED | API/Admin both have token secret bindings by name; values were not read. Only Admin-token Graph capabilities are known. |
| Lead/accounting/billing protections | PASS local | Previous synthetic coverage remains6/6 eligible events and5/5 eligible leads; two no-evidence leads unresolved; explicit billable status pauses recipient/WABA-wide. No live claim. |

## Meta Failure Repair

`packages/core/src/meta-activation.ts` previously converted every Graph action failure into a generic code, retaining only HTTP status. The already failed request cannot be diagnosed beyond HTTP400 because its code/subcode/trace were discarded at that time.

The corrected boundary now returns only safe diagnostics for a future authorized action:

- numeric Graph `code` and `error_subcode`;
- allowlisted Graph `type` as `GRAPH_<type>`;
- allowlisted `fbtrace_id`;
- HTTP status and endpoint/action already known to the operator.

It never returns the provider's free-form error text, token, OTP, PIN, recipient or customer data. Synthetic test simulates `code=100`, `error_subcode=2388006`, a trace ID and a secret-bearing provider message; safe metadata is returned while secret/message are absent.

Do not retry `request_code` until Meta support or the owner verifies why the current asset rejects it and explicitly authorizes one retry. The WABA is already subscribed. Do not resubscribe, create another number, edit/resubmit the name, change callback/routes or activate Business Agent.

## Exact Owner-Local Export Step

The backup-dependent chain stops here. This session cannot launch a visible owner-private PowerShell window. Run the `Local Passphrase/Export Procedure` in `GFS_ORDERFLOW_BACKUP_RESTORE_RELEASE_004.md` locally after creating a fresh Time Travel bookmark. It uses `Read-Host -AsSecureString`, loads target ID/name from the approved API test config, streams export through the encrypted named-pipe helper, verifies both DPAPI and recovery-key unwraps in memory, runs artifact verification, then clears all temporary environment variables. Do not paste the passphrase or bookmark in chat. On successful export, resume with isolated restore only; do not restore/migrate production.

## Validation

- Vitest **535 passed, 1 skipped** across44 files.
- Meta activation focused suite: **15 passed**.
- TypeScript/lint PASS; Node safety **52/52**; credential-scope dummy test PASS; production dependency audit0.
- Protected Label Printer manifest **923/923 identical**. Six registered development findings remain unchanged.
- No production migration, restore, export, deployment, relay activation, campaign or live message occurred.

## Launch Gate

**NO-GO.** S0 remains80% (8/10), S1/S3 local exits100%, S2/S4-S9 operational exits0%; overall2/10 stage exits (20%). Exact blockers: private encrypted export input and verified artifact, isolated restore/financial/migration validation, production API-token capability parity, Graph registration recovery after Meta cause confirmation, Access-protected Admin preview if used, then separately authorized candidate upload and later live test. Display-name review remains untouched.
