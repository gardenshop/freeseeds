# GFS-LP-050 — Protected MO-51 Staging Release

## Release gates (read-only preflight)

- Source before the LP-050 audit repair: `3874e72a3ab92af00899d5883df5ab3042f90735`. The LP-050 repair commit is `b0671eddaacff76cb67f82ebff2a56319ccb128a` on `codex/garden-shop-label-printer-mvp`, origin `gardenshop/freeseeds`.
- Cloudflare CLI `whoami` and the Dashboard account selector both identified `Get Free Seeds / cb5066a6d71ecdee0bd7ed8aacb4d3c2`. The authorized current account member is active and marked Super Admin.
- The account's existing Pages project is `garden-shop-label-printer-staging`, stable URL `https://garden-shop-label-printer-staging.pages.dev/`.
- Existing Access application ID `ed474c4d-2dcf-4f48-8e53-c321b8d2723d` includes the Pages host and the staging monitor Worker destination. It has the existing single-identity `Get Free Seeds Admin Operator` Allow policy (`b3acdd4f-9767-4d28-a55d-0a8e771d476c`), matching the authorized active Super Admin session. No Access policy or permission was changed.
- Before LP-050, the Dashboard showed Production deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931` (successful, LP-040, 13 static assets); `aae85a83-663d-449f-a20c-52418ed5b5e3` is its preceding successful history entry. Both Dashboard and account-pinned Wrangler read-only listings agreed.

## Audit repair

Pre-release tracing found the LP-048/049 mapped MO PDF path generated/downloaded/printed a PDF but did not emit the application's existing `PDF_GENERATED` event; the existing label-PDF path already used it. LP-050 adds the existing event only after successful MO blob generation, with `rows` and `pages` counts only. No record values, source fields, layout text, phone/address or CNIC are included. The event uses the existing `logEvent` function and configured monitor URL; worker, D1, audit schema and monitoring configuration are not changed. Monitor failure does not block the local PDF and is not recorded as audit success.

The local browser regression captures only synthetic `PDF_GENERATED` events, checks `{ rows: 100, pages: 100 }`, and rejects a payload containing synthetic record values. This verifies client emission only; it is not proof of staging ingestion or audit-chain integrity.

## Deployment record

- Status: **STATIC DEPLOYMENT PASS; ACCEPTANCE BLOCKED.** The repair commit was pushed and `dist` was deployed to the existing Pages project on Production branch `main`.
- New deployment: `f2141840-4291-496d-909f-93131b0fb9de`, source SHA `b0671eddaacff76cb67f82ebff2a56319ccb128a`, commit message `fix: audit mapped MO PDF generation`, stable URL `https://garden-shop-label-printer-staging.pages.dev/`. Dashboard reports success, 15 static assets and zero environment variables; Pages deploy was run from `dist`, which contains no Wrangler config or `_worker.js`. No Worker/function, D1, Meta, API, Admin, COD/payment, Access or production-routing deployment/change occurred.
- Immediate rollback target is the previously active, Dashboard-verified successful Production deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931`. Earlier history `aae85a83-663d-449f-a20c-52418ed5b5e3` remains available but is not the immediate rollback target. Rollback is a normal Pages rollback only; do not modify Access or roll back other services.
- Authenticated staging used a synthetic 42-row spreadsheet-compatible CSV through the normal import UI. Per-batch Order ID was corrected to `Order Reference/ID` because the existing device mapping preset prefilled `Order Date`; “save mapping” remained off and that existing preset was not overwritten. Update that saved profile in the UI before future imports if the operator wants it persisted. Selection toggled 42→41→42. An 11-field layout was saved/reloaded, and staging preview values matched 462 expected synthetic field values with 42 matched front/back row pairs. First/last pairs were 1/22 and 21/42. The UI generated/downloaded a 42-page paired synthetic PDF. No real workbook/customer values or local real-data PDF were uploaded.
- Staging PDF bytes were not independently parsed for MediaBox; local PDF-lib tests on the same source build verify page count/geometry. `chrome-devtools_drag` reported success but did not add a field; a direct synthetic `DataTransfer` drop exercised the same application handler. A separate local native Playwright drag/drop succeeded, but a staging-native drag gesture remains unverified. `Print MO Batch` and the existing label workflow were not tested on staging; physical print was not attempted.
- A synthetic layout definition remains saved in this Chrome profile after the test (source IDs/geometry only, no row values/CNIC). Reset it through the app before the next staging use; the saved import mapping preset was left unchanged.
- No real workbook/customer values or local real-data PDFs were uploaded, staged, committed or included in browser evidence. Staging tests used synthetic records only.

## Final acceptance (fill only from post-deploy evidence)

- Deployment ID / source SHA / static asset count / stable URL: `f2141840-4291-496d-909f-93131b0fb9de` / `b0671eddaacff76cb67f82ebff2a56319ccb128a` / 15 / `garden-shop-label-printer-staging.pages.dev` — **PASS**.
- Dashboard account, active identity, existing Pages project, active/previous deployment, and Access policy: **PASS**. Access policy was not modified.
- Fresh-cache staging app load and synthetic import: **PASS**. N=42 front/back source pairs and 462 field checks: **PASS**. N=42 PDF download/status: **PASS**. N=100 staging, staging label PDF and `Print MO Batch`: **NOT TESTED**; local N=100/label/print regressions pass.
- Staging `PDF_GENERATED` ingestion: **BLOCKED**. The authenticated synthetic POST returned HTTP 400. `worker/index.ts` confirms its template-version allowlist contains `gfs-a4-18-v2` and `gfs-a4-18-v3`, while the app reports `gfs-paper-presets-v4`; event `counts` (`rows`,`pages`), event type and batch ID meet the existing schema, so the version mismatch causes schema rejection. The pre-test audit summary was `VERIFIED` with zero recent events; the rejected event was not appended. Post-test audit-chain verification was not performed. Do not mislabel the local event stub or the pre-test summary as staging audit acceptance. Per LP-050 scope, no Worker/D1/monitor change was made to force acceptance.
- Chrome DevTools native drag/drop staging test: **BLOCKED/NOT VERIFIED**; the Chrome MCP drag action returned success but did not add a field. Direct staging `DataTransfer` drop and local native Playwright drag pass.
- Physical duplex alignment, official postal semantics/acceptance: **NOT TESTED / NOT VERIFIED**.
