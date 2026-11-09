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
- Each label uses a 0.4,0.4 mm inset 64.2 × 43.2 mm outer border. `src/layout.ts` is the millimeter source of truth: vector Code 128 x=1.7..33.2, y=1..18.2 with no readable tracking text; right VPL capsule x=44.4, y=1.1, w=19.4, h=7.5, city/province directly below; Order ID/contact block y=18.5..23.7; TO frame y=24.1..36.3; Product y=36.6..39.1; FROM y=39.4..43.3.
- Preview, browser print, and PDF share that geometry. Text is measured with the active font per label; short text retains larger sizes, longer text wraps/resizes, and exceptional overflow stays in the source/editor while print/PDF is blocked.
- VPL is a bordered two-line block (`VPL` then heavy `amount/-`), never the old small `VPL COD Rs` line. City sits below the amount, with no location pin. The province is white on black. Printing defaults to black-and-white; Garden Shop can optionally use green. Footer text is `From: Garden Shop | C/o City Post Office, Sahiwal` on one row.
- Printed references use `FS-YYMM-XXXXX`; YYMM is the browser-local calendar month at first reservation and XXXXX is generated with Web Crypto, never a counter. IndexedDB collision-checks and maps source Order ID/tracking to the reference. Re-imports/reprints in that browser profile retain it. Offline cross-device uniqueness cannot be guaranteed and is called out in the UI; retain site data for reprints.
- Address normalization standardizes only common unambiguous English terms, preserves source text and Urdu, and supports multiline editing. Printed references remain separate from original Order IDs; source IDs are not modified. IndexedDB maps source Order ID + tracking to the stable printed reference; the offline cross-device uniqueness limitation is disclosed in-app.
- Accepted phone forms normalize to exactly 11 digits beginning `03`: 10 digits beginning `3` receive a leading zero, and `+92`/`92` plus a valid 10-digit mobile become local form. Invalid/incomplete phones are flagged and block print/PDF until corrected. Exact duplicate contact tokens are removed only from the displayed address; source address is retained. Test fixtures use synthetic digits only; never store real order phones in tests or evidence.
- Code 128 auto-switches between B/C sets, includes ≥10X horizontal quiet zones, remains vector in PDF, and is proportionally fit only while module width stays at least 0.19 mm. Unusable values are flagged instead of silently shrinking or clipping.

Latest V2 local verification: 40 unit tests, configured build, and browser/PDF screenshot regression passed. The browser run decoded all 500 synthetic barcodes, verified stable FS references across re-import, validated the 1 mm A4 grid and print/PDF geometry, and blocked an overlong address until correction. `npm audit --audit-level=moderate` returned 0 vulnerabilities. Pages `3b9404e3` is directly uploaded from verified HEAD after account/Dashboard identity checks. The isolated-session asset/preview/PDF acceptance is BLOCKED at Cloudflare Access sign-in. No physical print is claimed.

The repository-wide regression suite also passed 269 tests and the root build passed. Focused ESLint passed for the changed Admin source/helper/tests. The repository-wide lint command still fails while traversing unrelated dirty agent worktrees; those files were not changed or staged. Root `npm audit` reports six moderate development-tool advisories; `npm audit --omit=dev` reports zero. No existing WhatsApp/API/Admin Worker was deployed or changed.

## Staging Deployment Status

The owner authorized an isolated staging canary. Current resources and identities are inventoried in `RULES.md`: staging D1 and migration, Pages project/deployment, dedicated Access app for the Pages/Worker hosts, monitor Worker, and encrypted audit/Admin secrets. The Access policy currently permits only the verified Super Admin because no staff roster/group was supplied. Before **each next** Cloudflare mutation, run `npx wrangler whoami`, confirm the `Get Free Seeds` account ID in the Dashboard, and record the timestamp/resource/action. Never use Hoja Seeds or existing production/V2 bindings.

The current Pages deployment is `3b9404e3-92a5-4e02-9bd4-b626f96eb833`. A shared/default Chrome tab contained a pre-populated order batch and was not interacted with, screenshotted, exported, or processed. A clean isolated browser context reached Cloudflare Access sign-in (`auth_status=NONE`), so no V2 acceptance import or PDF event was generated. Earlier synthetic audit errors remain in append-only history. No physical printer test or Admin Worker deployment was performed.

Local migration/schema smoke also passed against Wrangler's local emulator. This is separate from the remote staging D1. Roll back only isolated Pages/Worker versions; preserve audit history and the D1 database.

## Print calibration

1. Verify `Get Free Seeds` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2` in the Dashboard. In the isolated Chrome context, sign in through Cloudflare Access using the authorized Super Admin account; do not reuse a tab with existing order rows.
2. Confirm the isolated session returns to the blank staging import screen and says `Audit service configured`. Upload only `test-evidence/staging-acceptance-18.csv`; confirm 18 rows and no warnings/placeholders before exporting.
3. Use the intended printer/driver with plain A4 paper first. Select A4 portrait and Actual size/100%; disable browser headers/footers and do not select label stock yet.
4. Measure the printed label outline and A4 origin/grid with a ruler: each label must be 65 × 44 mm, with the documented 6.5/72.5/138.5 mm x starts and 14/59/104/149/194/239 mm y starts.
5. Scan every printed Code 128 tracking value and verify the 10X side quiet zones, VPL box, full address/contact row, and one-line footer are not clipped.
6. If scale/offset is wrong, correct only printer-driver scaling/margins, then print and measure a new plain-paper sheet. Do not compensate by changing the approved app geometry.
7. Use approved pre-cut stock only after the plain-paper measurements pass and the owner confirms the printer/stock pair.

A browser print request and a staff confirmation are separate audit records; neither is printer telemetry or independently verified physical output.

## Privacy and integration

Excel data stays in browser memory. Only event category, counts, batch ID, template version, staff pseudonym and bounded error code reach monitoring. No addresses, contact values, order/customer/product names, workbook or PDF content are transmitted. The `/labels-printing` Admin redirect and Operations-card injector are historical, committed source but are not in the active Admin Worker. This premium-design repair changed no Admin/API/WhatsApp/COD/payment/production resources. The live Admin home still has no Label Printer card; active Admin version `3e4b7c26...` remains at 100% because its source baseline is unreconciled. See `ADMIN_INTEGRATION_PROPOSAL.md`.

## Current Verification Evidence

- `test-evidence/staging-label-preview.png`: prior compact-layout defect screenshot.
- `test-evidence/label-preview-synthetic.png`, `label-preview-500-v2.png`, `label-preview-overflow.png`, and `label-preview-mobile.png`: local synthetic content and narrow-screen previews.
- `test-evidence/approved-label-layout.png`: fixed single-label screenshot baseline checked against a 1.5% pixel-difference ceiling plus exact geometry.
- `test-evidence/browser-print-sheet.png`, `pdf-sample-page.png`, and `pdf-500-first-page.png`: local browser-print/PDF comparisons, including the 28-page synthetic batch.
- `test-evidence/staging-premium-preview.png`, `staging-premium-print.png`, and `staging-label-preview-xlsx-urdu.png` are historical synthetic screenshots from Pages `434ea52f`/`f80abfe1`; they are not acceptance evidence for current Page `3b9404e3`.
- `test-evidence/staging-acceptance-18.csv`: synthetic 18-row CSV for final isolated-session acceptance; it has not yet been uploaded to staging.
- `test-evidence/admin-home-live-no-label-card.png`: historical Admin state only; this task made no Admin changes.
- Latest staging Pages deployment is `3b9404e3-92a5-4e02-9bd4-b626f96eb833` at `garden-shop-label-printer-staging.pages.dev`. Monitor Worker is `89a245c0-2532-4b02-8def-4cd675f9a845`; Access App and D1 identities are in `RULES.md`.
- A shared browser tab exposed pre-existing rows; no screenshot, edit or export was taken from it. The isolated Access context is awaiting authorized login. The 15 historical orders were not present in fixtures; protected root `images/` was not inspected. Printer/stock calibration is not tested.
- The owner reference was checked visually and the local screenshot baseline protects the implementation; an automated pixel diff against the original attachment is not available. Physical printer, stock, and ruler calibration remain untested.
