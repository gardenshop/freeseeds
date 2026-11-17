# Garden Shop Label Printer

Independent browser-based spreadsheet import, label preview, A4/custom print/PDF, and privacy-minimized operational monitoring. This application does not connect to the existing Garden Shop order systems. Excel parsing uses `read-excel-file` in-browser; files are not sent to the monitoring service.

## Local development

Requires Node.js 20.19+ and npm. The automated browser/PDF screenshot smoke also requires Node.js 22.13+ and Google Chrome (or set `CHROME_PATH` to a compatible Chrome binary).

```powershell
cd "D:\free seeds\garden-shop-label-printer"
npm.cmd ci
npm.cmd run dev
```

Open the loopback URL shown by Vite. The default local mode has no monitoring backend configured; imports, previews, printing and PDF generation remain local. The app does not retain customer rows after the tab closes.

## Build and tests

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

`test:browser` starts an isolated Vite server, imports synthetic `.xlsx` and `.csv` files, verifies A4 and custom grids, compares preview/browser-print/PDF geometry, checks both PDF MediaBoxes, decodes all 500 A4 and all 500 custom Code 128 values over every sheet, creates/rasterizes 1- and 28-page PDFs for both presets, and saves synthetic screenshots under `test-evidence/`. PDFs there are git-ignored. No customer fixture is used.

## Reinstalled Windows Toolchain (2026-11-16)

- Node.js 24.22.3, npm/npx 11.19.1 already existed portably at `E:\DevTools\Node\node-v24.22.3-win-x64`; no reinstall was needed. That directory was appended to USER PATH, retaining `F:\Git\cmd`. New PowerShell resolves `node`; use `npm.cmd`/`npx.cmd` because execution policy remains `Restricted` and was not changed.
- npm cache is `F:\npm-cache`; npm prefix remains with the existing portable Node install on E:. No global package was installed. Git 2.56.1 and Git Credential Manager 2.9.1 are on F:; GCM verified `gardenshop`.
- Chrome 157.0.8103.79 and Edge 157.0.4341.60 are already installed on C:. Project lockfile, node_modules, Vitest, Playwright and ZXing are present; no `npm ci` or browser download was needed. The project-local Wrangler is 4.149.0; no global Wrangler install was made.
- Fresh-environment validation: 42/42 unit tests, TypeScript/Worker/Vite build, and the complete Playwright browser/PDF suite PASS, including A4/custom 500-label barcode decoding and 28-page PDF pagination. Wrangler `whoami` now confirms `Get Free Seeds` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; explicit-account read-only inventory confirms the existing Pages project, monitor Worker, and audit D1. Dashboard identity/Access were not freshly inspected because Chrome DevTools MCP is not exposed. No Cloudflare mutation/deploy occurred.
- Kilo Code 7.8.27 has an additive USER-level `C:\Users\nazim\.config\kilo\kilo.json` registration pinned to official `chrome-devtools-mcp@1.13.0`, launched with the absolute Node/npx path and F: npm cache. The current VS Code/Kilo host started before this config was added; `KILO_EXPERIMENTAL_DISABLE_FILEWATCHER=true`, and a fresh Agent Manager local session still did not expose `chrome_devtools.list_pages`. A full Kilo window reload is needed. The DevToolsActivePort marker exists, but its contents and the Chrome remote-debugging permission UI were not inspected.

## Staging Build

The default build is intentionally local-only. Before building assets for the authorized staging Pages project, configure the public monitor and Admin URLs in the build environment; do not set `VITE_MONITOR_URL` to an empty value or the deployed app will disable monitoring:

```powershell
$env:VITE_MONITOR_URL = "https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev"
$env:VITE_ADMIN_URL = "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/"
npm.cmd run build
# Verify Wrangler and Dashboard identity before any mutation.
npx.cmd --no-install wrangler whoami
# Deploy only static assets from a config-free directory; never run Worker deploy detection here.
npx.cmd --no-install wrangler --cwd "D:\free seeds\garden-shop-label-printer\dist" pages deploy "D:\free seeds\garden-shop-label-printer\dist" --project-name garden-shop-label-printer-staging --branch main
Remove-Item Env:VITE_MONITOR_URL
Remove-Item Env:VITE_ADMIN_URL
```

Recheck account identity and the Dashboard before each Cloudflare mutation. Confirm the new production deployment and perform a fresh-cache browser check for `Audit service configured` before treating the deployment as ready.

## Approved Geometry and Content Rules

- **A4 preset:** portrait 210 × 297 mm; 65 × 44 mm labels; 3 × 6; 1 mm gutters; x starts 6.5, 72.5, 138.5 mm and y starts 14, 59, 104, 149, 194, 239 mm. The PDF MediaBox is 595.2756 × 841.8898 pt.
- **Custom preset:** portrait 190.5 × 254 mm; 63 × 42 mm labels; exactly 18 per sheet; horizontal gap 0.5 mm and vertical gap 0.333 mm. Nominal x starts are 0.25, 63.75, 127.25 mm; y starts are 0.1675, 42.5005, 84.8335, 127.1665, 169.4995, 211.8325 mm. The PDF MediaBox is 540.9449 × 720 pt. Browser CSS grid measurements may vary by less than 0.03 mm from nominal due to subpixel layout; PDF coordinates use exact millimeter constants.
- The custom sheet has only 0.25 mm side and 0.1675 mm top/bottom margins. The UI warns that many printers/drivers will clip it; use compatible near-edge hardware and calibrate on plain paper before label stock. Preset switching changes layout only, never imported orders or reserved tracking references.
- Each label uses a 0.4 mm inset 64.2 × 43.2 mm outer border. `src/layout.ts` is the millimeter source of truth. Tracking text is x=1.7, y=0.8, w=31.5, h=2.0 mm; vector Code 128 is x=1.7, y=3.0, w=31.5, h=8.4 mm. The top barcode/VPL region ends at y=14.5 mm and is shorter than the 15.8 mm TO frame. VPL is x=44.4, y=0.5, w=19.4, h=7.0 mm; destination starts below at y=7.7 mm. Order/contact share y=14.8..19.5 mm; TO is x=1.3, y=19.8, w=62.4, h=15.8 mm; Product is y=35.9..39.0; the one-line footer is y=39.2..43.4 mm.
- Preview, browser print, and PDF share preset-derived geometry. Names, addresses, nearby, city, province and Urdu are measured using active fonts. Unfit rows are outlined and marked non-printable in preview; they remain editable with original imported text and are excluded from PDF/print, while other valid rows continue. Noncritical optional-field warnings do not block a batch.
- VPL is a bordered two-line block (`VPL` then heavy `amount/-`), never the old small `VPL COD Rs` line. City sits below the amount, with no location pin. The province is white on black. Printing defaults to black-and-white; Garden Shop can optionally use green. Footer text is `From: Garden Shop | C/o City Post Office, Sahiwal` on one row.
- Printed references use `FS-YYMM-XXXXX`; YYMM is the browser-local calendar month at first reservation and XXXXX is generated with Web Crypto, never a counter. IndexedDB collision-checks and maps source Order ID/tracking to the reference. Re-imports/reprints in that browser profile retain it. Offline cross-device uniqueness cannot be guaranteed and is called out in the UI; retain site data for reprints.
- Address normalization standardizes only common unambiguous English terms, preserves source text and Urdu, and supports multiline editing. Printed references remain separate from original Order IDs; source IDs are not modified. IndexedDB maps source Order ID + tracking to the stable printed reference; the offline cross-device uniqueness limitation is disclosed in-app.
- Accepted phone forms normalize to exactly 11 digits beginning `03`: 10 digits beginning `3` receive a leading zero, and `+92`/`92` plus a valid 10-digit mobile become local form. Invalid/incomplete phones are flagged and block print/PDF until corrected. Exact duplicate contact tokens are removed only from the displayed address; source address is retained. Test fixtures use synthetic digits only; never store real order phones in tests or evidence.
- Order ID uses normal weight; the contact number is bold in the divided row. Product remains present. Footer is exactly `From: Garden Shop | C/o City Post Office, Sahiwal`. Code 128 auto-switches between B/C sets, includes ≥10X horizontal quiet zones, remains vector in PDF, and is proportionally fit only while module width stays at least 0.19 mm. Unusable values are flagged instead of silently shrinking or clipping.

V4 local verification (2026-11-16): 42 unit tests, TypeScript/Worker checks plus Vite build, and the complete Playwright browser/PDF regression passed on the reinstalled Windows environment. Browser evidence verifies both page sizes, custom print/preview alignment, exact MediaBoxes across all 28 pages, stable references, and 500 Code 128 decodes for each preset. The overlong-address row remains editable and is explicitly excluded from output. The screenshot baseline was deliberately refreshed after visual inspection to reflect the requested TO hierarchy and final V4 geometry. No physical print is claimed. Wrangler CLI identity and explicit-account resource inventory pass; Dashboard identity/Access and live deployment acceptance remain unverified because Chrome DevTools MCP is not exposed. No Pages upload or other remote mutation occurred.

The repository-wide regression suite also passed 269 tests and the root build passed. Focused ESLint passed for the changed Admin source/helper/tests. The repository-wide lint command still fails while traversing unrelated dirty agent worktrees; those files were not changed or staged. Root `npm audit` reports six moderate development-tool advisories; `npm audit --omit=dev` reports zero. No existing WhatsApp/API/Admin Worker was deployed or changed.

## Staging Deployment Status

### GFS-LP-035 HP P2055dn Image Print

The Image Print popup previously loaded `/label.css` twice. The second load followed the popup's custom `@page` rule and its A4 rule won the CSS cascade: browser print output was A4 (210 × 297 mm) while the label sheet remained 190.5 × 254 mm. The popup now reuses its already loaded stylesheet. Browser print-to-PDF confirms the Image Print MediaBox is 540 × 720 pt (190.5 × 254 mm), one page for 18 labels. Download PDF is unchanged.

On custom preset, **HP LaserJet P2055dn safe-area content inset** is enabled by default. It adjusts only the label-content layer in Image Print; the cut cells remain 63 × 42 mm at the same 3 × 6 positions, with 0.5/0.333 mm gutters. The optional profile is device-specific; disable it only for hardware with a verified larger/borderless imageable area. A4 and downloadable PDFs are unaffected.

Windows' currently installed `HP LaserJet P205X series PCL6 Class Driver` defaults to Letter and Simplex. The driver lists Tray 1/Manual Feed and permits custom paper dimensions in a range that contains 190.5 × 254 mm, but no matching named form is currently listed. A non-persisting in-memory custom-form query reports a 182.033 × 245.533 mm imageable region, 4.233 mm from each sheet edge. This is a driver capability report, not a physical measurement; the HP P2055dn is not borderless.

Before printing: define/select **190.5 × 254 mm portrait** in both browser and HP driver; select **Actual size / 100%**, not Fit/Shrink; turn browser headers/footers and duplex off; choose Tray 1/manual feed where supported. The exact sheet origin/cell positions remain locked and are not a software alignment knob.

Validation: 18-label custom Image Print page size/positions and all 18 post-inset Code 128 canvases pass at 4× browser raster density; print content boxes fit the driver-reported imageable area. The full browser suite also decoded `[3, 18, 500, 500]` barcode batches and retained 28-page A4/custom PDFs. All 42 unit tests, TypeScript checks and Vite build pass. These are software/browser results, **not physical printer calibration**.

**Physical gate NOT TESTED:** request exactly one synthetic 18-label custom calibration sheet on plain paper, with the P2055dn profile enabled and settings above. Return the sheet or four measured edge offsets; do not waste stock or claim print-ready until checked. Do not use pre-cut stock yet.

**LP-035 staging deployment BLOCKED:** only read-only CLI history was available, with prior deployment `2420ee42-08ac-4d0d-a620-caa7197f0966` / source `c7dc3fb`; its active Dashboard status was not freshly verified. Current `wrangler whoami` returned `No API token found`, and the final Kilo CLI Dashboard `list_pages` preflight timed out. No Cloudflare mutation/deploy was attempted. Restore official Wrangler OAuth, verify the GFS Dashboard identity and Access in a working Kilo Code session, then deploy only this standalone app's `dist/` and record the new ID/rollback.

### GFS-LP-034 Current V4 Release

V4 source `c7dc3fbb150b7a8b10807d89afb49a052dda04de` from `D:\free seeds`, branch `codex/garden-shop-label-printer-mvp`, was built with the documented monitor/Admin URLs and uploaded starting `2026-11-16T22:48:53Z`. New Pages deployment: **`2420ee42-08ac-4d0d-a620-caa7197f0966`** at `https://2420ee42.garden-shop-label-printer-staging.pages.dev`. Dashboard confirms it active on `https://garden-shop-label-printer-staging.pages.dev`. Static `dist/` assets/_headers only were uploaded; Wrangler ignored the ancestor Worker config. Verified pre-upload active rollback: **`2db928f2-0ccd-4f7a-aa9a-19db2bfc29d4`**. These observations supersede historical status below.

Fresh OAuth and Dashboard verified Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, with active Super Admin authorization. Chrome MCP listing/snapshots worked directly; the Kilo CLI tool is `chrome-devtools_list_pages`. No MCP/Chrome configuration was changed. Access retains the Super Admin-only email allow policy. Monitor `89a245c0-2532-4b02-8def-4cd675f9a845` remains at 100%; audit D1 `e2f5c4e0-d86a-48ea-af65-9786a58a70c7` retains 2 tables / 94.2 kB. Neither was mutated.

Fresh TypeScript/Worker/Vite build PASS. Prior 42 local tests and A4/custom 500-label decoding/PDF results remain local evidence, not live acceptance. Protected presets are unchanged: A4 210 x 297 mm / labels 65 x 44 mm / 18 per page / 1 mm gaps; custom 190.5 x 254 mm / labels 63 x 42 mm / 18 per page / 0.5 x 0.333 mm gaps.

**Live acceptance BLOCKED at owner login:** isolated context `gfs-lp034-synthetic`, tab 10, reached Cloudflare Access sign-in. Sign in there as the authorized Super Admin and return to the blank import screen before synthetic import. Do not use the populated shared tab or copy authentication state. Fresh served-asset inspection, live XLSX/CSV import, both downloaded PDFs/previews, fit/contact/reference/barcode checks, `PDF_GENERATED` and audit-chain VERIFIED are not yet tested. Physical printer/ruler/stock and approved staff roster remain separate gates. Production and unrelated dirty files were not changed.

The owner authorized an isolated staging canary. Current resources and identities are inventoried in `RULES.md`: staging D1 and migration, Pages project/deployment, dedicated Access app for the Pages/Worker hosts, monitor Worker, and encrypted audit/Admin secrets. The Access policy currently permits only the verified Super Admin because no staff roster/group was supplied. Before **each next** Cloudflare mutation, run `npx wrangler whoami`, confirm the `Get Free Seeds` account ID in the Dashboard, and record the timestamp/resource/action. Never use Hoja Seeds or existing production/V2 bindings.

The latest read-only Pages history entry is `f80abfe1-52fc-4f03-b6f1-a35388c01d7f` on `garden-shop-label-printer-staging.pages.dev`; `3b9404e3-92a5-4e02-9bd4-b626f96eb833` is the older entry. Wrangler 4.149.0 confirms the expected account by CLI, but Dashboard selector/Access and the active-version indicator are not verified in the current agent. If staging is later deployed, confirm `f80abfe1` remains active before designating it as rollback target. No new Pages upload, Worker/D1/Access change, or production mutation occurred. A shared/default Chrome tab was not interacted with. No physical printer test or Admin Worker deployment was performed.

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

V4 has local synthetic screenshots for the custom preset and custom 500-row acceptance; these generated image files remain local and are not published. `test-evidence/pdf-overflow-filtered.png` shows a valid selected row exporting while an impossible overlong row is excluded.

- `test-evidence/staging-label-preview.png`: prior compact-layout defect screenshot.
- `test-evidence/label-preview-synthetic.png`, `label-preview-500-v2.png`, `label-preview-overflow.png`, and `label-preview-mobile.png`: local synthetic content and narrow-screen previews.
- `test-evidence/approved-label-layout.png`: fixed single-label screenshot baseline checked against a 1.5% pixel-difference ceiling plus exact geometry.
- `test-evidence/browser-print-sheet.png`, `pdf-sample-page.png`, and `pdf-500-first-page.png`: local browser-print/PDF comparisons, including the 28-page synthetic batch.
- `test-evidence/staging-premium-preview.png`, `staging-premium-print.png`, and `staging-label-preview-xlsx-urdu.png` are historical synthetic screenshots from Pages `434ea52f`/`f80abfe1`; they are not acceptance evidence for current Page `3b9404e3`.
- `test-evidence/staging-acceptance-18.csv`: synthetic 18-row CSV for final isolated-session acceptance; it has not yet been uploaded to staging.
- `test-evidence/admin-home-live-no-label-card.png`: historical Admin state only; this task made no Admin changes.
- Latest read-only Pages deployment entry is `f80abfe1-52fc-4f03-b6f1-a35388c01d7f` at `garden-shop-label-printer-staging.pages.dev`; `3b9404e3-92a5-4e02-9bd4-b626f96eb833` is the older version. Monitor Worker `89a245c0-2532-4b02-8def-4cd675f9a845` and audit D1 `e2f5c4e0-d86a-48ea-af65-9786a58a70c7` were read-only verified; Access identity remains historical until Dashboard inspection. Confirm the active Pages version in Dashboard before assigning a rollback target.
- A shared browser tab exposed pre-existing rows; no screenshot, edit or export was taken from it. The isolated Access context is awaiting authorized login. The 15 historical orders were not present in fixtures; protected root `images/` was not inspected. Printer/stock calibration is not tested.
- The owner reference was checked visually and the local screenshot baseline protects the implementation; an automated pixel diff against the original attachment is not available. Physical printer, stock, and ruler calibration remain untested.
