# Garden Shop Label Printer

Independent browser-based spreadsheet import, label preview, A4/custom print/PDF, and privacy-minimized operational monitoring. This application does not connect to the existing Garden Shop order systems. Excel parsing uses `read-excel-file` in-browser; files are not sent to the monitoring service.

## GFS-LP-040 Tracking Prefix and Commission Rules

- Tracking classification trims and normalizes case/whitespace for the prefixes `RGL`, `UMS`, `VPL`, and `VPP`. It never changes the actual tracking value passed to Code 128. Unsupported prefixes fail closed with an editable error; they never get an assumed VPL fee.
- RGL/UMS omit the whole amount box and use its top-right space to show destination city/province prominently. They do not calculate commission; any declared amount in the source is ignored for label display.
- VPL/VPP use their own heading and display `declaredAmount+commission` on one line: the declared value is bold/prominent and the fee is lighter at 30% of the fitted main font. The fee is label display only and must not modify order payment/COD amounts.
- VPL/VPP require an entered, positive whole-rupee amount no higher than Rs. 100,000. Plain digits, standard comma grouping, and legacy `Rs`, `COD`, `VPL`/`VPP`, `/-` notation are accepted; missing, zero, negative, decimal, malformed and over-limit inputs block output with a clear correction path. No silent amount cap or amount rewrite.
- Exact commission in integer rupees: add Rs. 100 per complete Rs. 20,000. A zero remainder adds Rs. 0; a positive remainder below Rs. 10,000 adds Rs. 75; Rs. 10,000 to below Rs. 20,000 adds Rs. 100. Maximum Rs. 500. The same validated display model drives Image Print and Save PDF.
- Preserve the expanded LP-039 label layout and outer sheet/cell geometry below. HP P2055dn protection is page-edge-aware (5.233 mm target), affects only content at sheet edges, and is not borderless printing. Do not reduce all labels or fields to accommodate commission.

## MO-51 Local Preview and PDF Packet (I2/I3/LP-047)

- `MO Print` is a separate paired preview, blank manual-completion PDF packet, and visibly marked user-confirmed DRAFT packet for selected valid VPL/VPP records. It uses the uploaded blank two-sided MO-51 artwork, locally bundled Noto Naskh Arabic, I1 cut-and-stack pairing and the same renderer for PDF raster content. Existing label data and label output are unchanged. RGL/UMS/unknown/invalid rows are excluded with reasons.
- The form source declares 148 × 220 mm despite its A5 title. I2 uniformly scales each complete source face into a 148.5 × 210 mm half of A4 landscape. The original uploaded file remains unchanged. I3 adds a blank manual-completion packet; LP-047 adds MO-session candidate review. All mapping fields default blank and a user must explicitly confirm candidates/manual text. Any populated DRAFT PDF is prominently marked `USER-CONFIRMED DRAFT · NOT POSTAL VERIFIED`; it is not an official completed order. No print action is enabled.
- Sender CNIC # is optional and volatile within the MO Print session. Accept 13 digits with optional hyphens, preserve leading zeroes, and display in 5-7-1 groups. Blank is allowed; invalid nonblank input withholds the paired preview/export. The app never persists, logs, transmits, imports it, adds it to labels, or copies it into another party's form fields. It appears in an explicitly downloaded MO PDF only when entered by the user. Tests use synthetic identity values only.
- LP-046's authoritative mapping is original HTML section 1 = FRONT (Month Stamp, VP/service, amount, sender/receiver and intimation; optional sender CNIC) and section 2 = BACK (M.O.-51 Revised title, Pakistan Money Order, office, stamps and signatures). PDF page 1 is front, page 2 back, repeated per sheet. This visual face mapping does not approve a physical duplex flip/rotation. Unresolved postal roles and unknown MO fields remain blank; local preview/PDF is not official-form, staging, audit, payment, postal or physical-printer acceptance.
- Official Pakistan Post public pages confirm VPL/VPP article-side service descriptions and fees, but not mapping parcel sender/receiver to MO remitter/payee or whether COD declared principal belongs in MO “For Rs.”. The 48-field unresolved register is `docs/MO51_LP047_FIELD_REGISTER.md`; the blank manual-completion packet remains separate.
- LP-047 candidate controls are explicitly user-confirmed for that MO session only. They do not certify legal roles or which fields are mandatory. Manual amount words, MO number, offices, postcodes, dates, stamps and signatures remain blank. Field provenance and official-document blockers are recorded in `docs/MO51_LP047_DECISIONS.md`.

## MO-51 Mapped Layout and Batch Output (LP-048/049)

- The separate MO-51 layout editor lets the user drop imported source fields onto either face, move/resize/align/wrap text and adjust its font. The origin is the top-left of one 148.5 × 210 mm half in millimetres. The editor supports paired front/back, front-only, back-only PDFs and the local `Print MO Batch` browser-print flow. The blank manual-completion packet and LP-047 user-confirmed DRAFT path remain separate. A mapped layout does not assert official postal meaning or acceptance.
- Cut-and-stack uses `S = ceil(N/2)`: sheet `i` places eligible row `i` left and `i+S` right when present, on matching front/back slots. Each paired sheet emits front then back. An odd final right half is blank on both faces. The supplied form's section 1 is FRONT and section 2 is BACK; physical duplex rotation remains configurable but uncalibrated.
- Layout persistence contains only field/source IDs and geometry. Import mapping persistence contains only source header names. Customer rows and Sender CNIC are not stored with either definition. Sender CNIC remains optional, front-only, pinned and volatile to the MO session. Record values are incorporated only in a PDF the user deliberately downloads/prints.
- The user-tested workbook header mapping is recorded without customer values in `docs/MO51_LP049_DECISIONS.md`. `Order Date` numeric Excel serials use the workbook date system and the user-selected `DD-MM-YY` Month Stamp format. Phone text cells preserve their leading zeroes. Addresses retain a raw-source restore copy; display normalization collapses layout whitespace and standardizes only a fixed list of common English address terms while preserving other text/Urdu.
- `COD` maps only to validated declared principal; commission/fees remain separate. Missing source data and overflow block the mapped batch rather than being invented, silently dropped or truncated. The reusable source mapping is not legal role/field verification; unknown official roles, date semantics, postal-required fields and signatures remain unverified.
- Mapped MO PDF generation records `PDF_GENERATED` through the existing monitor path only after a PDF blob is produced. The audit payload contains eligible row and page counts only; no source values, names, phone numbers, addresses or CNIC are sent. A monitor error never cancels or fabricates the local PDF.
- Permanent decision, local actual-workbook verification and synthetic regression evidence: `docs/MO51_LP048_DECISIONS.md` and `docs/MO51_LP049_DECISIONS.md`. The browser suite tests N=1,2,3,5,50,99,100,101,500; paired/front/back output; the N=100 1/51 and 50/100 cut-stack boundaries; N=500 populated PDF performance/cancellation; print popup; and preview/PDF MediaBox parity. All committed test data remains synthetic.
- Local PASS is not authenticated staging/audit/served-asset acceptance, physical printer/duplex calibration or official postal acceptance. Chrome DevTools MCP availability, authorized account/Access and physical printing remain distinct release gates. Verify the exact account in CLI and Dashboard before any Cloudflare mutation; preserve Access and never upload the real workbook/customer data.

## MO-51 Layout Editor Improvements (LP-051)

- The mapped-layout editor fits both A5-half previews within its available workspace on narrow and wide screens. Fit-to-width and zoom are screen-only; they do not alter saved millimetre geometry or PDF/printer dimensions. Source/property panels remain reachable, and the canvas may scroll when zoomed beyond fit.
- Palette fields can be dragged or selected then placed by clicking a face. Placed fields support pointer move and corner resize. The editor shows the selected sample value separately from its source-binding label; duplicate same-source placements at the same location select the existing field.
- Font-size +/- and numeric controls, wrap/alignment, and bold styling apply to the shared layout. Existing saved definitions without `bold` remain compatible and load as non-bold. Layout persistence contains only definitions, source IDs and geometry; it never stores sample/customer values or Sender CNIC.
- **Preview Final MO** opens a clean rendered front/back preview without editor controls, binding badges, or handles. It supports sample/sheet navigation, selected-field formatting, PDF download and print. Opening the preview does not automatically invoke the browser print dialog.
- Before mapped output, validation blocks missing sources, overflow, or geometric intersections between mapped fields and the pinned session-only Sender CNIC. Correct the layout rather than relying on clipped, overlapping or invented values. Blank/manual-completion and explicitly user-confirmed DRAFT paths remain separate; no official postal role or acceptance is implied.
- LP-051 decisions and synthetic local regression evidence are recorded in `docs/MO51_LP051_DECISIONS.md`. Local tests/build/browser checks do not establish staging acceptance, audit-chain acceptance, physical duplex/printer calibration, or official postal acceptance. Do not deploy LP-051 while the recorded Access-session and audit-contract blockers remain unresolved.

## MO-51 Sender/Receiver Front Positions (LP-052)

- On MO FRONT / HTML section 1, the complete Receiver block (Urdu caption, receiver name/address/phone lines and its postcode boxes) is upper; the complete Sender block (Urdu caption, sender name/address/contact lines, optional Sender CNIC line and postcode boxes) is lower. The form's BACK / HTML section 2, stamps, and imported sender/receiver values are unchanged. The renderer moves presentation blocks only; mapping sources are never exchanged.
- Sender CNIC is still optional, Sender-only, MO-only and volatile to the current session; it is pinned into the lower Sender identity block and never added to saved layout bindings, customer records, logs or monitoring.
- New layouts use schema v2 with explicit current party-position version. Pre-LP-052 schema-v1 layouts load without loss and show a one-click **Correct Sender/Receiver Positions** action when old placements are detected. The correction translates only Sender fields still in the old upper region and Receiver fields still in the old lower region by the existing 27 mm block offset; it preserves field IDs, bindings, dimensions, font, weight, alignment, wrapping, all other front fields and the entire back layout. Out-of-bounds correction fails without changing the saved input. PDF and print are blocked until the correction succeeds.
- The mapped A4 sheet remains 297 × 210 mm landscape, two 148.5 × 210 mm halves, paired by the existing cut-and-stack `ceil(N/2)` rule. Fit/zoom are view-only; mapping, principal, exact tracking and row identity are unchanged. No commission is added and no postal field is invented or claimed to be officially verified.
- LP-052 tests and synthetic raster evidence are recorded in `docs/MO51_LP052_DECISIONS.md`. They do not verify staging, physical duplex alignment or official postal acceptance.

## LP-050 protected staging state

- Static LP-050 source `b0671eddaacff76cb67f82ebff2a56319ccb128a` is deployed to the existing staging Pages project as deployment `f2141840-4291-496d-909f-93131b0fb9de` (15 static assets, no Worker). The pre-release successful deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931` is the immediate rollback target; Access and the stable URL are unchanged.
- Synthetic staging N=42 import, per-batch source mapping, field binding/preview and a 42-page paired PDF passed. The existing browser-local saved mapping profile was left unchanged; synthetic batch mapping selected `Order Reference/ID` instead of a prefilled `Order Date` for Order ID. The reusable 11-field layout remains saved as definitions-only (source IDs/geometry); update and save the import header map after reauthentication before future imports.
- **Staging acceptance is blocked:** the existing monitor Worker rejects the actual mapped-PDF `PDF_GENERATED` event with HTTP 400 because its allowed template versions are `gfs-a4-18-v2`/`v3`, while this app emits `gfs-paper-presets-v4`. The event is not appended; the audit summary was `VERIFIED` before the synthetic run only. Do not change the Worker/Access or relabel the MO form to force acceptance. Stage Print MO Batch, existing label flow and post-event audit-chain verification remain untested.
- The staged synthetic batch had a pre-existing device mapping preset that assigned `Order Date` to `Order ID`; the test corrected that column for the current batch without saving over the user's preset. Correct the saved source map in the Import screen before relying on it for future batches.

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
# From dist only: use Wrangler CWD=dist (no Worker config is present there).
Set-Location "D:\free seeds\garden-shop-label-printer\dist"
$env:CLOUDFLARE_ACCOUNT_ID = "cb5066a6d71ecdee0bd7ed8aacb4d3c2"
npx.cmd --no-install wrangler whoami
npx.cmd --no-install wrangler pages deploy . --project-name garden-shop-label-printer-staging --branch main --commit-hash 880736940168eccb0b2e2de4cd4ee35e25fa7781 --commit-message "GFS-LP-040 VPL VPP commission layouts" --commit-dirty false
Set-Location "D:\free seeds\garden-shop-label-printer"
Remove-Item Env:CLOUDFLARE_ACCOUNT_ID
Remove-Item Env:VITE_MONITOR_URL
Remove-Item Env:VITE_ADMIN_URL
```

Recheck account identity and the Dashboard before each Cloudflare mutation. Confirm the new production deployment and perform a fresh-cache browser check for `Audit service configured` before treating the deployment as ready.

## Approved Geometry and Content Rules

- **HP P2055dn content protection:** custom-sheet content transforms are calculated per slot against the complete sheet's printable bounds. Only the outer rows/columns need the 5.233 mm safe-edge adjustment (4.233 mm driver-reported non-imageable edge + 1 mm allowance); interior labels retain the full content layout. Image Print and Save PDF use the same slot transform. This protects content from the measured hardware margin but does not make the printer borderless; keep the exact sheet and cell geometry below unchanged.
- **A4 preset:** portrait 210 × 297 mm; 65 × 44 mm labels; 3 × 6; 1 mm gutters; x starts 6.5, 72.5, 138.5 mm and y starts 14, 59, 104, 149, 194, 239 mm. The PDF MediaBox is 595.2756 × 841.8898 pt.
- **Custom preset:** portrait 190.5 × 254 mm; 63 × 42 mm labels; exactly 18 per sheet; horizontal gap 0.5 mm and vertical gap 0.333 mm. Nominal x starts are 0.25, 63.75, 127.25 mm; y starts are 0.1675, 42.5005, 84.8335, 127.1665, 169.4995, 211.8325 mm. The PDF MediaBox is 540 × 720 pt. Browser CSS grid measurements may vary by less than 0.03 mm from nominal due to subpixel layout; PDF coordinates use exact millimeter constants.
- The custom sheet has only 0.25 mm side and 0.1675 mm top/bottom margins. The UI warns that many printers/drivers will clip it; use compatible near-edge hardware and calibrate on plain paper before label stock. Preset switching changes layout only, never imported orders or reserved tracking references.
- Each label uses a 0.4 mm inset 64.2 × 43.2 mm outer border. `src/layout.ts` is the millimeter source of truth. Tracking text is x=1.7, y=0.8, w=31.5, h=2.0 mm; vector Code 128 is x=1.7, y=3.0, w=31.5, h=8.4 mm. The top barcode/VPL region ends at y=14.5 mm and is shorter than the 15.8 mm TO frame. VPL is x=44.4, y=0.5, w=19.4, h=7.0 mm; destination starts below at y=7.7 mm. Order/contact share y=14.8..19.5 mm; TO is x=1.3, y=19.8, w=62.4, h=15.8 mm; Product is y=35.9..39.0; the one-line footer is y=39.2..43.4 mm.
- Preview, browser print, and PDF share preset-derived geometry. Names, addresses, nearby, city, province and Urdu are measured using active fonts. Unfit rows are outlined and marked non-printable in preview; they remain editable with original imported text and are excluded from PDF/print, while other valid rows continue. Noncritical optional-field warnings do not block a batch.
- VPL/VPP use a bordered amount block with the prefix heading and a fitted one-line declared-value/commission pair. RGL/UMS have no amount block and expand the city/province display into the freed top-right area. The province is white on black. Printing defaults to black-and-white; Garden Shop can optionally use green. Footer text is `From: Garden Shop | C/o City Post Office, Sahiwal` on one row.
- Printed references use `FS-YYMM-XXXXX`; YYMM is the browser-local calendar month at first reservation and XXXXX is generated with Web Crypto, never a counter. IndexedDB collision-checks and maps source Order ID/tracking to the reference. Re-imports/reprints in that browser profile retain it. Offline cross-device uniqueness cannot be guaranteed and is called out in the UI; retain site data for reprints.
- Address normalization standardizes only common unambiguous English terms, preserves source text and Urdu, and supports multiline editing. Printed references remain separate from original Order IDs; source IDs are not modified. IndexedDB maps source Order ID + tracking to the stable printed reference; the offline cross-device uniqueness limitation is disclosed in-app.
- Accepted phone forms normalize to exactly 11 digits beginning `03`: 10 digits beginning `3` receive a leading zero, and `+92`/`92` plus a valid 10-digit mobile become local form. Invalid/incomplete phones are flagged and block print/PDF until corrected. Exact duplicate contact tokens are removed only from the displayed address; source address is retained. Test fixtures use synthetic digits only; never store real order phones in tests or evidence.
- Order ID uses normal weight; the contact number is bold in the divided row. Product remains present. Footer is exactly `From: Garden Shop | C/o City Post Office, Sahiwal`. Code 128 auto-switches between B/C sets, includes ≥10X horizontal quiet zones, remains vector in PDF, and is proportionally fit only while module width stays at least 0.19 mm. Unusable values are flagged instead of silently shrinking or clipping.

V4 local verification (2026-11-16): 42 unit tests, TypeScript/Worker checks plus Vite build, and the complete Playwright browser/PDF regression passed on the reinstalled Windows environment. Browser evidence verifies both page sizes, custom print/preview alignment, exact MediaBoxes across all 28 pages, stable references, and 500 Code 128 decodes for each preset. The overlong-address row remains editable and is explicitly excluded from output. The screenshot baseline was deliberately refreshed after visual inspection to reflect the requested TO hierarchy and final V4 geometry. No physical print is claimed. Wrangler CLI identity and explicit-account resource inventory pass; Dashboard identity/Access and live deployment acceptance remain unverified because Chrome DevTools MCP is not exposed. No Pages upload or other remote mutation occurred.

The repository-wide regression suite also passed 269 tests and the root build passed. Focused ESLint passed for the changed Admin source/helper/tests. The repository-wide lint command still fails while traversing unrelated dirty agent worktrees; those files were not changed or staged. Root `npm audit` reports six moderate development-tool advisories; `npm audit --omit=dev` reports zero. No existing WhatsApp/API/Admin Worker was deployed or changed.

## Staging Deployment Status

### GFS-LP-037 Unified Print/PDF Geometry

Both `#printNow` and `#savePdf` now use one canonical custom content transform, derived from the HP P2055dn's 4.233 mm non-imageable edge plus a 1 mm safety allowance (5.233 mm safe page edge). The paper, 63 × 42 mm cells, 18 positions and 0.5/0.333 mm gaps do not move. The first column's content inset is deliberately about 4.983 mm relative to that label edge, and the top row inset is about 5.0655 mm; these are hardware-protection insets, not misalignment. The custom print popup has a single preset-specific `@page` rule. Its custom **screen-only** top margin is now zero; print body margins remain zero. A4 is unchanged.

Root cause confirmed by paired synthetic output: before repair, Image Print applied the HP insets only in CSS; Save PDF used the original un-inset boxes. Label 1 Order ID x was 5.447 mm in Image Print vs 1.510 mm in PDF; column 2 was 65.001 vs 65.010 mm. Both page MediaBoxes were already 540 × 720 pt, so the reported 15 mm right margin was not an internal PDF page margin. The former 12 mm `@media screen` popup margin plus the HP top inset explained the screen preview's apparent ~15–16 mm top gap. The current P2055dn Windows default remains Letter/Simplex: select the 190.5 × 254 mm custom portrait form in the browser and driver, Actual Size/100%, no Fit/Shrink, headers/footers off, duplex off, and Tray 1/manual feed where supported.

Vector PDF bar placement now matches the browser Canvas quiet-zone origin; the paired raster comparison is within 0.25 mm and all 18 barcodes decode in both outputs. Text glyph rasterization still differs between Chromium/Arial and the PDF font renderer; field boxes share geometry, do not clip, and are not claimed pixel-identical. A4 browser print remains within 0.25 mm of nominal 210 × 297 mm, and the downloaded A4/custom PDF regression remains unchanged.

Validation: **43 unit tests PASS**, TypeScript/Worker build PASS, and the full browser suite PASS with `[3, 18, 500, 500]` barcode counts and 28-page A4/custom PDFs. Current owner screenshots were not attached or found in the project; fresh synthetic paired renders/diff were generated only under the approved temp directory. Physical HP calibration is still **NOT TESTED**; request one plain-paper sheet after deployment and measure four edges. Do not use pre-cut stock until it passes.

### GFS-LP-037 Staging Deployment

Source `0e64a6fd45e1e65e6fe92cd398b3b2445da9ccb1` is active in the existing staging Pages project as **`aae85a83-663d-449f-a20c-52418ed5b5e3`**, `https://aae85a83.garden-shop-label-printer-staging.pages.dev`. The stable URL is `https://garden-shop-label-printer-staging.pages.dev`; Dashboard confirms Production/Success and rollback to prior active **`a8287aa3-31dc-4446-a6be-c3127fac0e80`**. Only standalone `dist/` files and `_headers` were uploaded; the Worker config was ignored.

Fresh Wrangler/Dashboard preflight confirmed Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, active Super Admin, and the existing Super-Admin-only staging Access rule. Monitor Worker and audit D1 remain unchanged. **Live acceptance is BLOCKED** at a new isolated tab's Access challenge; no synthetic XLSX/CSV, print/PDF, `PDF_GENERATED`, or audit-chain query was performed. Do not use the two populated tabs. One owner action: sign in as the authorized Super Admin in the isolated staging tab and return to the blank import page. Physical HP calibration remains NOT TESTED and requires one later plain-paper sheet.

### GFS-LP-036 Staging Deployment

**PASS — static V4 deployed** to the existing `garden-shop-label-printer-staging` Pages project from branch `codex/garden-shop-label-printer-mvp`, source `cb52289fc7287d05f2ec1ebc182bd108d9120731`. Deployment ID: **`a8287aa3-31dc-4446-a6be-c3127fac0e80`** at `https://a8287aa3.garden-shop-label-printer-staging.pages.dev`; stable URL: `https://garden-shop-label-printer-staging.pages.dev`. Wrangler lists it first in Production with source `cb52289`; the stable URL loaded the Label Printer blank screen. The verified pre-deploy active rollback is **`2420ee42-08ac-4d0d-a620-caa7197f0966`** (the earlier successful deployment `f80abfe1` precedes it).

Fresh Wrangler 4.149.0 `whoami` at `2026-11-17T12:36:40.354+05:00` verified `gisupp@gmail.com`, Get Free Seeds, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Dashboard verified Super Admin and the existing Access app `ed474c4d-2dcf-4f48-8e53-c321b8d2723d` with Allow restricted to that Super Admin identity. A clean isolated request reached Access sign-in. No Access policy changes.

Upload used the staging-configured standalone Vite `dist/` and only five static files plus `_headers` (eight assets reused). Wrangler explicitly ignored the project Worker config because it lacks `pages_build_output_dir`; no Worker deploy occurred. Monitor Worker remains `89a245c0-2532-4b02-8def-4cd675f9a845`; audit D1 remains `e2f5c4e0-d86a-48ea-af65-9786a58a70c7` (2 tables, 94.2 kB); neither was mutated.

**Live acceptance BLOCKED at fresh-context Access sign-in:** the new isolated browser tab is challenged. The existing shared populated Label Printer tab was not inspected or touched. No synthetic XLSX/CSV, live print/PDF, `PDF_GENERATED`, audit-chain `VERIFIED`, or served-marker assertion was performed in this run. Complete Super Admin Access sign-in in the isolated tab and return to the blank import screen; then perform only synthetic acceptance and report checks. Physical HP calibration remains NOT TESTED and still requires one later plain-paper sheet.

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

GFS-LP-040 local verification: 82/82 unit tests and TypeScript/Worker/Vite build PASS. Browser/PDF tests pass for all four synthetic prefix types, unknown prefix/over-limit amount blocking and correction path, same commission values in Image Print and Save PDF, `[3, 18, 500, 500]` Code 128 decodes, 28-page A4/custom batch PDFs, and unchanged paper geometry. Boundary table and visual evidence are recorded in `RELEASE_NOTES.md`; four-prefix Image Print/PDF and preview screenshots were visually inspected in the isolated temporary evidence directory. The approved single-label screenshot baseline was refreshed to the intentionally changed commission layout. Commit `a1aeca5311154af7dc27eaffe05f564c82ce2a92` is pushed to the required branch. Wrangler confirms the expected Cloudflare CLI account and the existing Pages project; Dashboard identity/active deployment and live acceptance remain blocked on authorized Chrome DevTools. No Pages deploy or physical HP printer test is claimed.

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
