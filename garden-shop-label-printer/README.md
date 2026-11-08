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

The repository-wide regression suite also passed 269 tests and the root build passed. Focused ESLint passed for the changed Admin source/helper/tests. The repository-wide lint command still fails while traversing unrelated dirty agent worktrees; those files were not changed or staged. Root `npm audit` reports six moderate development-tool advisories; `npm audit --omit=dev` reports zero. No existing WhatsApp/API/Admin Worker was deployed or changed.

## Staging Deployment Status

The owner authorized an isolated staging canary. Current resources and identities are inventoried in `RULES.md`: staging D1 and migration, Pages project/deployment, dedicated Access app for the Pages/Worker hosts, monitor Worker, and encrypted audit/Admin secrets. The Access policy currently permits only the verified Super Admin because no staff roster/group was supplied. Before **each next** Cloudflare mutation, run `npx wrangler whoami`, confirm the `Get Free Seeds` account ID in the Dashboard, and record the timestamp/resource/action. Never use Hoja Seeds or existing production/V2 bindings.

Staging smoke verified the actual `.pages.dev` app, browser XLSX import with a zero-formatted numeric phone, Urdu name/address rendering and PDF generation, Access-authenticated report access, remote D1 aggregate events, and a verified audit chain. A pre-fix synthetic 55-row PDF error remains in append-only audit history; after the Unicode fallback, one-row Urdu PDF generation succeeded and the local 500-row PDF test passed. No physical printer test or Admin Worker deployment was performed.

Local migration/schema smoke also passed against Wrangler's local emulator. This is separate from the remote staging D1. Roll back only isolated Pages/Worker versions; preserve audit history and the D1 database.

## Print calibration

Select A4 portrait, actual size/100%, and disable browser headers/footers. Validate a calibration page with the intended printer and label stock before operational use. A browser print request and a staff confirmation are separate audit records; neither is printer telemetry or independently verified physical output.

## Privacy and integration

Excel data stays in browser memory. Only event category, counts, batch ID, template version, staff pseudonym and bounded error code reach monitoring. No addresses, contact values, order/customer/product names, workbook or PDF content are transmitted. The `/labels-printing` Admin redirect and Operations-card injector are committed and unit-tested but not in the active Admin Worker. The live Admin home still has no Label Printer card. Its active version is `3e4b7c26...` at 100%; the checked-out legacy Admin template/source differs, and unrelated dirty Admin changes are preserved. No Admin version was uploaded or promoted. See `ADMIN_INTEGRATION_PROPOSAL.md`.

## Current Verification Evidence

- `test-evidence/label-preview-synthetic.png`: 3 synthetic labels on the A4 preview.
- `test-evidence/label-preview-500.png`: first 18 positions of a synthetic 500-order batch, including a flagged overlong address.
- `test-evidence/label-preview-mobile.png`: narrow viewport review.
- `test-evidence/browser-print-sheet.png`: headless browser print DOM with shared label CSS and measured 210×297 mm sheet/65×44 mm labels.
- `test-evidence/pdf-sample-page.png` and `test-evidence/pdf-500-first-page.png`: PDF.js raster comparisons from generated PDFs.
- `test-evidence/staging-label-preview.png`: the live Access-protected staging Page with synthetic rows.
- `test-evidence/staging-label-preview-xlsx-urdu.png`: browser rendering of the imported synthetic `.xlsx` with zero-format phone and Urdu text.
- `test-evidence/staging-label-preview-xlsx-urdu.png`: the live Page rendering a synthetic `.xlsx` with zero-formatted phone and Urdu address text.
- `test-evidence/admin-home-live-no-label-card.png`: the actual active Admin Operations home confirming the tile is not live.
- Latest staging Page deployment: `3afcfd90-6fbe-41c4-b005-814a1fe83ac1` at `garden-shop-label-printer-staging.pages.dev`. Monitor Worker version: `89a245c0-2532-4b02-8def-4cd675f9a845`; Access App and D1 identities are in `RULES.md`.
- The 15 historical orders were not present in authorized project fixtures; protected root `images/` was not inspected. Physical printer/stock calibration is not tested.
- The task's latest attached reference image was not available in the active message context, so pixel-perfect image comparison remains outstanding.
