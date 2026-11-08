# Garden Shop Label Printer

Independent browser-based spreadsheet import, label preview, A4 print/PDF, and privacy-minimized operational monitoring. This application does not connect to the existing Garden Shop order systems. Excel parsing uses `read-excel-file` in-browser; files are not sent to the monitoring service.

## Local development

Requires Node.js 20.19+ and npm. The automated browser/PDF screenshot smoke also requires Node.js 22.13+ and Google Chrome (or set `CHROME_PATH` to a compatible Chrome binary).

```powershell
cd "D:\free seeds\garden-shop-label-printer"
npm install
npm run dev
```

Open the loopback URL shown by Vite. The default local mode has no monitoring backend configured; imports, previews, printing and PDF generation remain local. The app does not retain customer rows after the tab closes.

## Build and tests

```powershell
npm test
npm run build
npm run test:browser
```

`test:browser` starts an isolated Vite server, uses local Chrome, imports a synthetic `.xlsx`, verifies the A4/label measurements and every visible barcode, creates/rasterizes sample and 500-order PDFs, and saves synthetic screenshots under `test-evidence/`. PDFs there are git-ignored. No customer fixture is used.

Latest local verification: 27/27 unit/security tests passed; browser smoke passed XLSX/text-zero import, monitoring-outage resilience, 3- and 18-barcode decode checks, 500-order/28-page PDF generation, preview/print/PDF geometry, mobile overflow, and long-address warning bounds; production build passed; `npm audit --audit-level=moderate` reported 0 advisories. Wrangler local D1 schema migration and synthetic insert/read passed. Worker D1 and Access integration use mocked identity/D1 in automated tests; no remote Access/D1 deployment was made.

## Separate monitoring deployment preparation

Deployment is not authorized or performed. Before **each** Cloudflare mutation, run `npx wrangler whoami`, confirm the visible account name and account ID are the approved Garden Shop account (never Hoja Seeds), and record the timestamp, identity, resource name and change in the approved operations record. Stop if the account is unexpected. Get owner approval, cost/quota review and resource-registry approval before provisioning. Never bind existing production/V2 Workers, D1, queues, or Access apps.

After approvals and account identity confirmation, the deployment sequence is:

1. Create a new D1 database with `npx wrangler d1 create garden-shop-label-printer-audit`. Copy its **new** ID into `wrangler.jsonc`; do not use a database ID from the existing repo.
2. Set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`, exact `APP_ORIGIN`, and approved staff/Super Admin allowlists in the standalone config. Configure a dedicated Cloudflare Access app/policies for the new UI/Worker. The Worker validates the signed Access JWT and independently checks role allowlists.
3. Provision fresh random `AUDIT_ACTOR_KEY` and `AUDIT_CHAIN_KEY` secrets using `npx wrangler secret put AUDIT_ACTOR_KEY` and `npx wrangler secret put AUDIT_CHAIN_KEY`. Do not reuse existing secrets or put values in Vite config/source.
4. Apply only this project's migration with `npx wrangler d1 migrations apply garden-shop-label-printer-audit --remote` and deploy only the standalone Worker using `npx wrangler deploy --config wrangler.jsonc`.
5. Set `VITE_MONITOR_URL` to the new Worker URL. Replace the `connect-src` host placeholder in `public/_headers` with that exact host. Build via `npm run build`.
6. Create a separate Pages project with `npx wrangler pages project create garden-shop-label-printer` and deploy only `dist` using `npx wrangler pages deploy dist --project-name garden-shop-label-printer`. Apply Access before sharing the URL.
7. Verify unauthenticated/staff/admin policy, correct audit-chain status, aggregate-only requests, event rate limiting, PDF geometry and rollback version. Keep production usage paused until printer calibration and release approvals are complete.

Every command that creates/changes a Cloudflare resource is an example for a separately approved future operation; none was run in this task. Cross-origin requests use exact `APP_ORIGIN` CORS, never wildcard credentials. Current Worker rejects unauthenticated and non-allowlisted identities. Roll back Pages/Worker to the last approved versions; do not drop the audit database as a rollback step.

For local migration/schema smoke only, the D1 migration was applied to Wrangler's local emulator and a synthetic row was inserted/read back with `npx wrangler d1 migrations apply garden-shop-label-printer-audit --local --config wrangler.jsonc`. This is not a live Worker-to-D1 or Cloudflare Access test. Local emulator state is ignored under `.wrangler/`.

## Print calibration

Select A4 portrait, actual size/100%, and disable browser headers/footers. Validate a calibration page with the intended printer and label stock before operational use. A browser print request and a staff confirmation are separate audit records; neither is printer telemetry or independently verified physical output.

## Privacy and integration

Excel data stays in browser memory. Only event category, counts, batch ID, template version, staff pseudonym and bounded error code reach monitoring. No addresses, contact values, order/customer/product names, workbook or PDF content are transmitted. The proposed existing-Admin integration is a future protected navigation link only and requires separate review/approval; see `ADMIN_INTEGRATION_PROPOSAL.md`. Existing Admin and production systems are not modified by this project.

## Current Verification Evidence

- `test-evidence/label-preview-synthetic.png`: 3 synthetic labels on the A4 preview.
- `test-evidence/label-preview-500.png`: first 18 positions of a synthetic 500-order batch, including a flagged overlong address.
- `test-evidence/label-preview-mobile.png`: narrow viewport review.
- `test-evidence/browser-print-sheet.png`: headless browser print DOM with shared label CSS and measured 210×297 mm sheet/65×44 mm labels.
- `test-evidence/pdf-sample-page.png` and `test-evidence/pdf-500-first-page.png`: PDF.js raster comparisons from generated PDFs.
- The 15 historical orders were not present in authorized project fixtures; protected root `images/` was not inspected. Physical printer/stock calibration is not tested.
- The task's latest attached reference image was not available in the active message context, so pixel-perfect image comparison remains outstanding.
