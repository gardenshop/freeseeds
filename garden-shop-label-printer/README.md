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

Latest verification: 27/27 unit/security tests passed; browser smoke passed XLSX/leading-zero import, monitoring-outage resilience, 3- and 18-barcode decode checks, 500-order/28-page PDF generation, preview/print/PDF geometry, mobile overflow and long-address bounds; build passed; `npm audit --audit-level=moderate` reported 0 advisories. The staging Page and Super-Admin-only Worker/D1/Access are deployed. A synthetic authenticated import/labels/PDF event round-tripped through remote D1; the dashboard reported `Audit chain: VERIFIED`. No physical print was performed.

## Separate monitoring deployment preparation

The owner authorized an isolated staging canary. Its D1, Pages project/assets, Admin-only Access app, monitor Worker and encrypted HMAC/Super Admin secrets are provisioned. Before **each next** Cloudflare mutation, run `npx wrangler whoami`, confirm the visible account name and account ID are the approved Garden Shop account (never Hoja Seeds), and record the timestamp, identity, resource name and change. Stop if the account is unexpected. Never bind existing production/V2 Workers, D1, queues, or Access apps.

After approvals and account identity confirmation, the deployment sequence is:

1. The dedicated staging D1 `garden-shop-label-printer-audit-staging` has already been created as `e2f5c4e0-d86a-48ea-af65-9786a58a70c7`; its only migration was applied to that new database. Do not use an ID from an existing repo database.
2. Set the full `ACCESS_TEAM_DOMAIN` (for example `team.cloudflareaccess.com`), `ACCESS_AUDIENCE`, exact `APP_ORIGIN`, and approved staff/Super Admin allowlists in the standalone config. Configure a dedicated Cloudflare Access app/policies for the new UI/Worker. The Worker validates the signed Access JWT and independently checks role allowlists.
3. Provision fresh random `AUDIT_ACTOR_KEY` and `AUDIT_CHAIN_KEY` secrets using `npx wrangler secret put AUDIT_ACTOR_KEY` and `npx wrangler secret put AUDIT_CHAIN_KEY`. Do not reuse existing secrets or put values in Vite config/source.
4. The D1 migration, Worker deployment, Access destination/audience and encrypted Worker secrets are already configured for the Admin-only canary.
5. Build with `VITE_MONITOR_URL=https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev` and `VITE_ADMIN_URL=https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/`. CSP in `public/_headers` allowlists only the monitor origin.
6. The built static `dist` assets are deployed to `garden-shop-label-printer-staging.pages.dev` on its `main` environment, protected by the dedicated Access app.
7. Super Admin reports, audit integrity, synthetic events, PDF geometry and rollback identities were verified. Staff onboarding and physical printer calibration remain outstanding. Production use remains paused.

Staging operations to date: dedicated D1 create/migration, Pages project/assets deployment, Access app restricted to the existing Admin Operator/Super Admin policy, monitor Worker deployment, encrypted actor/chain/Super Admin secrets, and Access CORS-preflight configuration. An unintended fail-closed Worker from the root-directory Pages command was deleted. An anonymous report request received an Access redirect; authenticated synthetic import/label/PDF events appeared in the dashboard and the audit chain verified. Roll back only the isolated Pages/Worker versions; preserve the audit database.

For local migration/schema smoke, the migration was also applied to Wrangler's local emulator and a synthetic row was inserted/read back. This is not a live Worker-to-D1 or Cloudflare Access test. Local emulator state is ignored under `.wrangler/`.

## Print calibration

Select A4 portrait, actual size/100%, and disable browser headers/footers. Validate a calibration page with the intended printer and label stock before operational use. A browser print request and a staff confirmation are separate audit records; neither is printer telemetry or independently verified physical output.

## Privacy and integration

Excel data stays in browser memory. Only event category, counts, batch ID, template version, staff pseudonym and bounded error code reach monitoring. No addresses, contact values, order/customer/product names, workbook or PDF content are transmitted. A minimal `/labels-printing` Admin redirect and Operations-card injector are implemented and unit-tested; neither is deployed to the live Admin. The active Admin source baseline differs from this checkout and contains unrelated dirty changes, so rollout is blocked to prevent regression. See `ADMIN_INTEGRATION_PROPOSAL.md`.

## Current Verification Evidence

- `test-evidence/label-preview-synthetic.png`: 3 synthetic labels on the A4 preview.
- `test-evidence/label-preview-500.png`: first 18 positions of a synthetic 500-order batch, including a flagged overlong address.
- `test-evidence/label-preview-mobile.png`: narrow viewport review.
- `test-evidence/browser-print-sheet.png`: headless browser print DOM with shared label CSS and measured 210×297 mm sheet/65×44 mm labels.
- `test-evidence/pdf-sample-page.png` and `test-evidence/pdf-500-first-page.png`: PDF.js raster comparisons from generated PDFs.
- `test-evidence/staging-label-preview.png`: the live Access-protected staging Page with synthetic rows.
- `test-evidence/admin-home-live-no-label-card.png`: the actual active Admin Operations home confirming the tile is not live.
- Staging Page deployment host: `0b504d51.garden-shop-label-printer-staging.pages.dev` (canonical `garden-shop-label-printer-staging.pages.dev`). Monitor Worker version: `89a245c0-2532-4b02-8def-4cd675f9a845`; Access App and D1 identities are in `RULES.md`.
- The 15 historical orders were not present in authorized project fixtures; protected root `images/` was not inspected. Physical printer/stock calibration is not tested.
- The task's latest attached reference image was not available in the active message context, so pixel-perfect image comparison remains outstanding.
