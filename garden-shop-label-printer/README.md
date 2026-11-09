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

`test:browser` starts an isolated Vite server, imports synthetic `.xlsx` and `.csv` files, verifies the exact A4 grid and preview/print geometry, decodes all 500 Code 128 values over every sheet, creates/rasterizes 1- and 28-page PDFs, and saves synthetic screenshots under `test-evidence/`. PDFs there are git-ignored. No customer fixture is used.

## Staging Build

The default build is intentionally local-only. Before building assets for the authorized staging Pages project, configure the public monitor and Admin URLs in the build environment; do not set `VITE_MONITOR_URL` to an empty value or the deployed app will disable monitoring:

```powershell
$env:VITE_MONITOR_URL = "https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev"
$env:VITE_ADMIN_URL = "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/"
npm run build
npx --no-install wrangler whoami
# Confirm Get Free Seeds / cb5066a6d71ecdee0bd7ed8aacb4d3c2 in the Dashboard.
npx --no-install wrangler --cwd "D:\Temp\kilo" pages deploy "D:\free seeds\garden-shop-label-printer\dist" --project-name garden-shop-label-printer-staging --branch main
Remove-Item Env:VITE_MONITOR_URL
Remove-Item Env:VITE_ADMIN_URL
```

Recheck account identity and the Dashboard before each Cloudflare mutation. Confirm the new production deployment and perform a fresh-cache browser check for `Audit service configured` before treating the deployment as ready.

## Approved Geometry and Content Rules

- A4 portrait is 210 × 297 mm. Labels are 65 × 44 mm; the centered 3 × 6 grid starts at x=6.5, 72.5, 138.5 mm and y=14, 59, 104, 149, 194, 239 mm with exactly 1 mm horizontal and vertical gutters.
- Each label uses a 0.4,0.4 mm inset 64.2 × 43.2 mm outer border. `src/layout.ts` is the millimeter source of truth for the tracking/destination/VPL band, TO block, Order ID/Product block between TO and FROM, contact row, and one-line footer.
- Preview, browser print, and PDF share that geometry. Text is measured with the active font per label; short text retains larger sizes, longer text wraps/resizes, and exceptional overflow stays in the source/editor while the output is visibly flagged.
- VPL is formatted as a heavy `VPL amount/-` capsule, never the old small `VPL COD Rs` line. The province is white text on a black badge; Garden Shop uses a green footer accent. The location pin and phone icon are intentionally absent. The footer ends at `Sahiwal`.
- Accepted phone forms normalize to exactly 11 digits beginning `03`: 10 digits beginning `3` receive a leading zero, and `+92`/`92` plus a valid 10-digit mobile become local form. Invalid/incomplete phones are flagged and block print/PDF until corrected. Exact duplicate contact tokens are removed only from the displayed address; source address is retained. Test fixtures use synthetic digits only; never store real order phones in tests or evidence.
- Code 128 auto-switches between B/C sets, includes ≥10X horizontal quiet zones, remains vector in PDF, and is proportionally fit only while module width stays at least 0.19 mm. Unusable values are flagged instead of silently shrinking or clipping.

Latest local verification: `npm test` (35 tests), configured `npm run build`, and full `npm run test:browser` (3/18/500 browser/PDF barcode decodes; unit barcode/import batches cover 18/19/55/100/500; one- and 28-page PDFs; real XLSX/CSV; exact centered 1 mm grid and preview/print geometry; screenshot baseline) all passed. The latest `npm audit --audit-level=moderate` rerun was blocked by registry connectivity; the earlier audit result is recorded in the prior verification history. The final Pages deployment is recorded below. A fresh staging session loaded matching JS/CSS hashes and confirmed `Audit service configured`; the final synthetic import and two-label PDF events returned HTTP 201, the downloaded PDF was inspected, and the protected report showed `Audit chain: VERIFIED`. No physical print is claimed.

The repository-wide regression suite also passed 269 tests and the root build passed. Focused ESLint passed for the changed Admin source/helper/tests. The repository-wide lint command still fails while traversing unrelated dirty agent worktrees; those files were not changed or staged. Root `npm audit` reports six moderate development-tool advisories; `npm audit --omit=dev` reports zero. No existing WhatsApp/API/Admin Worker was deployed or changed.

## Staging Deployment Status

The owner authorized an isolated staging canary. Current resources and identities are inventoried in `RULES.md`: staging D1 and migration, Pages project/deployment, dedicated Access app for the Pages/Worker hosts, monitor Worker, and encrypted audit/Admin secrets. The Access policy currently permits only the verified Super Admin because no staff roster/group was supplied. Before **each next** Cloudflare mutation, run `npx wrangler whoami`, confirm the `Get Free Seeds` account ID in the Dashboard, and record the timestamp/resource/action. Never use Hoja Seeds or existing production/V2 bindings.

The prior `434ea52f` `.pages.dev` build was loaded in a fresh authenticated tab and confirmed `Audit service configured`; an isolated unauthenticated browser context was redirected to Cloudflare Access. This final geometry repair is locally verified but not yet deployed: the fresh Wrangler identity gate on 2026-11-09 found an expired token and could not refresh because Cloudflare was unreachable. No Pages mutation was attempted. Earlier synthetic audit errors remain in append-only history. No physical printer test or Admin Worker deployment was performed.

Local migration/schema smoke also passed against Wrangler's local emulator. This is separate from the remote staging D1. Roll back only isolated Pages/Worker versions; preserve audit history and the D1 database.

## Print calibration

1. Use the intended printer/driver with plain A4 paper first. Select A4 portrait and Actual size/100%; disable browser headers/footers and do not select label stock yet.
2. Measure the printed label outline and A4 origin/grid with a ruler: each label must be 65 × 44 mm, with the documented 6.5/72.5/138.5 mm x starts and 14/59/104/149/194/239 mm y starts.
3. Scan the printed Code 128 tracking value and verify the 10X side quiet zones, VPL box, full address/contact row, and one-line footer are not clipped.
4. If scale/offset is wrong, correct only printer-driver scaling/margins, then print and measure a new plain-paper sheet. Do not compensate by changing the approved app geometry.
5. Use approved pre-cut stock only after the plain-paper measurements pass and the owner confirms the printer/stock pair.

A browser print request and a staff confirmation are separate audit records; neither is printer telemetry or independently verified physical output.

## Privacy and integration

Excel data stays in browser memory. Only event category, counts, batch ID, template version, staff pseudonym and bounded error code reach monitoring. No addresses, contact values, order/customer/product names, workbook or PDF content are transmitted. The `/labels-printing` Admin redirect and Operations-card injector are historical, committed source but are not in the active Admin Worker. This premium-design repair changed no Admin/API/WhatsApp/COD/payment/production resources. The live Admin home still has no Label Printer card; active Admin version `3e4b7c26...` remains at 100% because its source baseline is unreconciled. See `ADMIN_INTEGRATION_PROPOSAL.md`.

## Current Verification Evidence

- `test-evidence/label-preview-synthetic.png`: 3 synthetic labels on the A4 preview.
- `test-evidence/label-preview-500.png`: first 18 positions of a synthetic 500-order batch, including a flagged overlong address.
- `test-evidence/label-preview-mobile.png`: narrow viewport review.
- `test-evidence/browser-print-sheet.png`: headless browser print DOM with shared label CSS and measured 210×297 mm sheet/65×44 mm labels.
- `test-evidence/pdf-sample-page.png` and `test-evidence/pdf-500-first-page.png`: PDF.js raster comparisons from generated PDFs.
- `test-evidence/staging-label-preview.png`: prior defect/compact layout.
- `test-evidence/staging-label-preview-xlsx-urdu.png`: the live Page rendering a synthetic `.xlsx` with zero-formatted phone and Urdu address text.
- `test-evidence/label-preview-synthetic.png` and `test-evidence/staging-premium-preview.png`: new local and Access-protected staging premium previews.
- `test-evidence/staging-premium-print.png`: staging Print & Export setup with the two-label synthetic batch; it is not physical print proof.
- `test-evidence/approved-label-layout.png`: fixed synthetic single-label screenshot baseline checked by the browser regression suite with a 1.5% pixel-difference ceiling plus exact box geometry.
- `test-evidence/browser-print-sheet.png`, `test-evidence/pdf-sample-page.png`, and `test-evidence/pdf-500-first-page.png`: matching print/PDF output, including a 28-page 500-label batch.
- `test-evidence/admin-home-live-no-label-card.png`: the actual active Admin Operations home confirming the tile is not live.
- Latest staging Page deployment: `434ea52f-780c-47c1-bf72-1ac013187006` at `garden-shop-label-printer-staging.pages.dev`. Monitor Worker version: `89a245c0-2532-4b02-8def-4cd675f9a845`; Access App and D1 identities are in `RULES.md`.
- The 15 historical orders were not present in authorized project fixtures; protected root `images/` was not inspected. Physical printer/stock calibration is not tested.
- The owner reference was available for this repair; visual hierarchy and CSS/PDF geometry were checked against it. Physical printer, stock, and ruler calibration remain untested.
