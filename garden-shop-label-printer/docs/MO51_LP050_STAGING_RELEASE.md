# GFS-LP-050 — Protected MO-51 Staging Release

## Release gates (read-only preflight)

- Expected source prior to the LP-050 audit repair: `3874e72a3ab92af00899d5883df5ab3042f90735` on `codex/garden-shop-label-printer-mvp`, origin `gardenshop/freeseeds`.
- Cloudflare CLI `whoami` and the Dashboard account selector both identified `Get Free Seeds / cb5066a6d71ecdee0bd7ed8aacb4d3c2`. The authorized current account member is active and marked Super Admin.
- The account's existing Pages project is `garden-shop-label-printer-staging`, stable URL `https://garden-shop-label-printer-staging.pages.dev/`.
- Existing Access application ID `ed474c4d-2dcf-4f48-8e53-c321b8d2723d` includes the Pages host and the staging monitor Worker destination. It has the existing single-identity `Get Free Seeds Admin Operator` Allow policy (`b3acdd4f-9767-4d28-a55d-0a8e771d476c`), matching the authorized active Super Admin session. No Access policy or permission was changed.
- Before LP-050, the Dashboard showed Production deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931` (successful, LP-040, 13 static assets) and the preceding successful Production deployment `aae85a83-663d-449f-a20c-52418ed5b5e3` (LP-037). The latter is the verified pre-release rollback candidate. Both Dashboard and account-pinned Wrangler read-only listings agreed.

## Audit repair

Pre-release tracing found the LP-048/049 mapped MO PDF path generated/downloaded/printed a PDF but did not emit the application's existing `PDF_GENERATED` event; the existing label-PDF path already used it. LP-050 adds the existing event only after successful MO blob generation, with `rows` and `pages` counts only. No record values, source fields, layout text, phone/address or CNIC are included. The event uses the existing `logEvent` function and configured monitor URL; worker, D1, audit schema and monitoring configuration are not changed. Monitor failure does not block the local PDF and is not recorded as audit success.

The local browser regression captures only synthetic `PDF_GENERATED` events, checks `{ rows: 100, pages: 100 }`, and rejects a payload containing synthetic record values. This verifies client emission only; it is not proof of staging ingestion or audit-chain integrity.

## Deployment record

- Status: **PENDING** until the LP-050 repair is committed/pushed, complete local tests pass, and the static-only `dist` build is produced with the documented existing staging monitor/Admin URLs.
- Deployment method: `wrangler pages deploy` from the project's `dist` directory to this existing Pages project on production branch `main`, with the exact LP-050 source commit hash supplied. This publishes static files only; no Worker, D1, Meta, API, Admin, COD/payment, Access or production-routing change is authorized.
- Rollback: Dashboard-verified preceding successful Production deployment `aae85a83-663d-449f-a20c-52418ed5b5e3`. Rollback is a normal Pages rollback to that deployment only; do not modify Access. Do not roll back any other service.
- No real workbook/customer values or local real-data PDFs may be uploaded, staged, committed or included in browser evidence. Staging import/PDF tests use synthetic XLSX only.

## Final acceptance (fill only from post-deploy evidence)

- Deployment ID / source SHA / asset count / stable URL: pending.
- Chrome DevTools MCP authenticated access and fresh-cache app load: pending.
- Synthetic import, layout save/reload/reset, field selection, N=42 and N=100 pairing, PDF/page geometry and Print MO Batch: pending.
- Existing label workflow on staging: pending.
- Monitor `PDF_GENERATED` event for a synthetic batch and audit summary `VERIFIED`: pending. Do not insert events manually. If unavailable, record **BLOCKED** and preserve the evidence.
- Physical duplex alignment, official postal semantics/acceptance: **NOT TESTED / NOT VERIFIED**.
