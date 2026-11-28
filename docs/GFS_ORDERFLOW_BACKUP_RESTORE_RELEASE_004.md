# GFS-ORDERFLOW-BACKUP-RESTORE-RELEASE-004

**Date:** 2026-11-28

**Repository:** `gardenshop/freeseeds`
**Branch:** `codex/gfs-order-001-rev2`
**Verified base HEAD/remote before this closeout:** `60e611a8575eaf98bfcc37f8166e18876676414c`

**Release decision:** source/test/report package pushed; live WhatsApp remains **NO-GO**. Backup export is not complete because the owner recovery passphrase is absent from the local process environment. No restore, isolated migration, Worker upload, relay activation, production migration/deployment, or live message occurred.

## Exact Previous Fixture Disposition

The same sanitized b426-vs-candidate comparison now has8 inbound event IDs across7 recipient-hash leads:

- Five new contacts have signed, authenticated CTWA ad-referral evidence and no device/OS field. All five qualify for the one-time CSW opening reply.
- A new, structurally valid text inquiry lacks referral and prior pricing evidence. It is not malformed, but its origin cannot be classified as CTWA or ordinary; it remains `UNRESOLVED_FREE_ELIGIBILITY` / `FREE_BILLING_UNKNOWN_OR_MISMATCHED` and receives no send.
- A returning lead without prior persisted referral/FEP evidence is not deemed free merely because it is returning; it remains unresolved.
- A subsequent message with no new referral from a contact whose earlier signed CTWA and matched provider FEP status established actual `referral_conversion`, expiry and PMP/free-entry-point pricing reuses that persisted evidence and is replied to. A referral is not required on every subsequent webhook event while retained evidence remains valid.

Legacy `b426ba47` (source commit `901f3f6`) attempts all8 CSW-open replies. Candidate makes6 eligible/attempted/provider-accepted/delivered replies (6/6 eligible events, 5/5 eligible contacts), 2 inbound events/leads remain unresolved, 0 failed, 0 suppressed, 2 read and 0 duplicate accepted replies. This is synthetic provider coverage only; it is not live delivery or a production lead count. The old baseline's accepted/delivered rate is unavailable.

## Billing, Quota, and Agent Controls

- A provider callback with explicit `pricing.billable=true` and DELIVERED/READ now creates a hash-only incident. It adds a recipient block if a valid recipient identifier is supplied and a WABA-wide circuit-breaker pause even if recipient/timestamp fields are missing. The shared free-only guard covers API/Admin/Cron/Queue; Admin alerts. No auto-resume, paid fallback or subscription bypass is implemented. Internal payment/order/COD/fulfillment states continue.
- The monthly free-service allowance remains disabled. WAM dashboards are approximate and cannot prove an exact phone/month balance across human/external senders. Do not count the one-per-customer FEP basis as monthly quota.
- Meta Business Agent remains **Set up**/disabled.

## Meta Status and Restricted Action

The authenticated Meta Phone Manager read shows a Phone Numbers row with an **In Review** name label, active Profile name `Get Free Seeds` **Rejected**, phone **Connected**, quality **High**, and Messaging Limits **Current**. The owner says `Free Seeds In Pakistan` is already under review and explicitly says **do not resubmit/change it**. No display-name submission occurred.

A read-only Graph v26 status call through the existing Admin-configured token reports `registrationStatus=EXPIRED`, `name_status=DECLINED`, quality GREEN, WABA subscribed, and `whatsapp_business_management`/`whatsapp_business_messaging` granted. This is the Admin token context; `META_ACCESS_TOKEN` secret names exist on both API and Admin, but values were never read and production API token parity is **not proven**. Phone Manager Connected is a link/availability state, not evidence that Graph registration is current. No Graph permissions/messaging scopes should be inferred from the phone quality or Messaging Limits page.

The owner authorized one existing-number SMS-code attempt. The protected Admin Meta Activation action returned `META_GRAPH_REQUEST_FAILED`/HTTP400 and was not applied. **No SMS/OTP was issued or entered.** Do not retry until Meta support/owner confirms the existing-number recovery requirement and grants one narrowly scoped retry authorization. If later authorized: Request SMS code once → owner enters the OTP privately in the protected form → Verify code → owner enters the existing two-step PIN privately → Register phone → reread Graph status. WABA is already subscribed; do not resubscribe. Never place OTP/PIN/credentials in chat. Meta Business Agent stays unconfigured.

## Backup and Restore State

- Before external D1 actions, Cloudflare dashboard identity and `wrangler whoami` matched the authorized Get Free Seeds account. The owner had already authorized all nonproduction preparation.
- The approved empty isolated target `getfreeseeds-v2-restore-fep-002` exists. Read-only `PRAGMA quick_check` returned `ok`; application-table count is0. Cloudflare `_cf_KV` is internal metadata and is excluded by the vault target-emptiness check. The pre-existing nonempty `getfreeseeds-v2-restore-check` was never reset or written.
- A current-state Time Travel bookmark was generated after account re-verification. Its reference was not written to source/docs or set in the export process environment; regenerate it immediately before export if it is older than30 minutes.
- Vault `%LOCALAPPDATA%\GFS-Orderflow-D1Vault` ACL, AES-256-GCM, DPAPI, synthetic recovery-wrap, SQL-memory restore and tamper-detection tests pass. The export helper now verifies the actual exported container by decrypting with both DPAPI and the supplied recovery passphrase and comparing plaintext buffers only in memory, then zeroing them. It streams Wrangler export directly through a named pipe into ciphertext; no plaintext SQL file is retained.
- No export exists: `GFS_D1_VAULT_RECOVERY_PASSPHRASE` is absent from this session's local process environment. The production source is the currently active `getfreeseeds-staging` D1 binding. A fresh Time Travel reference and the owner's password-manager passphrase must be supplied locally to the helper; neither may be pasted into chat. Until then, restore/migration/deploy are blocked.
- A read-only production migration-ledger query reports `cod_schema_migrations` maximum `0048` (11 rows) and `d1_migrations` 0 rows. Production has no marker for0049–0052. Preserve the required `0049 → unchanged0050 → 0051 → 0052` order; `0049` is forward-only. Local migration compatibility and `RECOVERY_MODE` tests pass; no production migration was run.

## Candidate Isolation and Approval

- API test config binds to the approved empty restore target, has provider/test sends off, and has no Cron/Queue/R2 or production routes. Its workers.dev URL is only a preview; it was not uploaded.
- Admin test config uses the same target, a disabled dummy allowlist identity, Meta/payment automation off, no Queue/R2 binding and `workers_dev=false` to avoid public exposure/Access bypass. It was not uploaded. Admin analytics/API tests pass locally. A read-only Admin preview requires an existing Access-protected host; no Access route or policy was changed.
- The existing selective relay remains off. The prior test contact and 10-attempt/30-minute bound are reused, not re-confirmed.
- The consolidated owner approval for encrypted export/restore and nonproduction candidate preparation was already granted. The only current manual prerequisite is the private local export passphrase and a fresh Time Travel reference; the failed SMS-code attempt is a separate registration gate. No further owner confirmation for the contact/window is requested.

### Local Passphrase/Export Procedure

Run the following in a **local interactive PowerShell session** after generating a fresh D1 Time Travel bookmark. Do not paste the passphrase here or put it in command history/arguments. `Get Free Seeds` is verified before the export helper runs.

```powershell
$secure = Read-Host 'Enter the vault recovery passphrase from the password manager' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:GFS_D1_VAULT_RECOVERY_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:GFS_D1_TIME_TRAVEL_REFERENCE = Read-Host 'Enter the fresh Time Travel bookmark ID'
  $env:GFS_D1_TIME_TRAVEL_REFERENCE_CREATED_AT = [DateTimeOffset]::UtcNow.ToString('o')
  $target = Get-Content -LiteralPath 'apps/api/wrangler.whatsapp-test.jsonc' -Raw | ConvertFrom-Json
  if ($target.d1_databases[0].database_name -ne 'getfreeseeds-v2-restore-fep-002') { throw 'Unexpected restore target' }
  $env:GFS_D1_RESTORE_TARGET_NAME = $target.d1_databases[0].database_name
  $env:GFS_D1_RESTORE_TARGET_ID = $target.d1_databases[0].database_id
  $env:GFS_D1_APPROVED_VAULT_PATH = Join-Path $env:LOCALAPPDATA 'GFS-Orderflow-D1Vault'
  $env:GFS_D1_PRODUCTION_EXPORT_AUTHORIZED = 'YES'
  $env:GFS_D1_DESTINATION_APPROVED = 'YES'
  $env:GFS_D1_RESTORE_TARGET_APPROVED = 'YES'
  $env:GFS_D1_RESTORE_ISOLATION_VERIFIED = 'YES'
  $name = 'gfs-orderflow-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.gfsenc'
  node .\scripts\gfs-d1-encrypted-vault.mjs export-wrangler $env:GFS_D1_APPROVED_VAULT_PATH $name
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted D1 export failed closed' }
  node .\scripts\gfs-d1-encrypted-vault.mjs verify $env:GFS_D1_APPROVED_VAULT_PATH $name
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted D1 artifact verification failed' }
}
finally {
  'GFS_D1_VAULT_RECOVERY_PASSPHRASE','GFS_D1_TIME_TRAVEL_REFERENCE','GFS_D1_TIME_TRAVEL_REFERENCE_CREATED_AT','GFS_D1_RESTORE_TARGET_NAME','GFS_D1_RESTORE_TARGET_ID','GFS_D1_APPROVED_VAULT_PATH','GFS_D1_PRODUCTION_EXPORT_AUTHORIZED','GFS_D1_DESTINATION_APPROVED','GFS_D1_RESTORE_TARGET_APPROVED','GFS_D1_RESTORE_ISOLATION_VERIFIED' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  $secure.Dispose()
}
exit
```

The helper fails closed unless source account/D1, target ID/emptiness, vault ACL/capacity, approval flags and fresh Time Travel age all match. It emits only encrypted-file hash/size. Stop if any check fails. After a successful export, verify checksum and the recovery-wrap with the private passphrase, restore only to `getfreeseeds-v2-restore-fep-002`, verify schema/financial invariants, then apply `0052` only on that isolated target. Never reset `getfreeseeds-v2-restore-check` or restore/deploy to production.

**EXECUTION-CLOSE-006:** this automation session cannot open a visible owner-private prompt. The procedure above is the required manual step; recovery passphrase and fresh bookmark were not exposed or supplied. Do not continue restore/migration/candidate upload until its verified export output is available.

## Final Verification

- Vitest **534 passed, 1 skipped** across44 files; Node safety **52/52**; credential-scope dummy test PASS; TypeScript/lint PASS.
- API/Admin isolated-worker dry-runs and vault helper self-test PASS; production dependency audit0; six registered development findings remain unchanged; 923/923 protected Label Printer hashes identical.
- The candidate remains **NO-GO for live send** until the encrypted export/restore/0052 chain is verified, a safe Access-protected Admin preview is available if needed, and the Graph registration `EXPIRED`/name review/API-token-parity gates are resolved. No live message, migration, Worker upload, relay activation or campaign occurred.
- S0 **80%** (8/10), S1/S3 local exits **100%**, S2 and S4–S9 operational exits **0%**; overall stage exits **2/10 (20%)**.
