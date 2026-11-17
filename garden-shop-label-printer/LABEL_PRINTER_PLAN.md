# Label Printer MVP Plan and Status

The repository-wide architecture discovery and full implementation history remain in `../LABEL_PRINTER_PLAN.md`. This file tracks the standalone project's current gaps and launch boundary.

## Launch Flow

1. Upload `.xlsx`/`.csv` locally; choose worksheet/header and confirm field mapping.
2. Review, edit, search, select, and resolve duplicate or ambiguous rows.
3. Select A4 (65 × 44 mm labels) or custom (63 × 42 mm labels) and preview the exact 3 × 6 sheet.
4. Generate PDF or print via the same label layout; report actual-size setting and printer calibration requirements.
5. If approved, emit privacy-minimized activity to the dedicated, Access-protected monitoring Worker. Staff and Super Admin roles remain separate.

## V4 Local Status (2026-11-16)

### GFS-LP-037 Unified Geometry Repair

- Confirmed root cause: HP P2055 safe content insets existed only in the Image Print popup; `makePdf()` still used un-inset label boxes. Label/page dimensions were already correct. Screen mode also added a 12 mm popup body margin; print mode body margin was zero. The shared `label.css` A4 page rule was removed from popup composition; the popup now has one dynamic page-size rule.
- Both renderers now share `labelContentTransform()` and the same safe-zone geometry. P2055 safe edge is 4.233 mm hardware + 1 mm practical = 5.233 mm. Cell boundaries and physical positions stay unchanged. First-column content offset (4.983 mm from cell edge) and first-row offset (5.0655 mm) are documented physical tradeoffs. Save PDF vectors now align barcode quiet zones with Image Print Canvas geometry.
- Before: label 1 Order ID x=5.447 mm Image Print / 1.510 mm Save PDF; column 2 x=65.001 / 65.010 mm. After: shared field-box anchors agree within 0.02 mm. Page sizes stay 190.5 × 254 mm / 540 × 720 pt; A4 unchanged within 0.25 mm. Font renderer differences remain, but text stays within safe bounds.
- Tests: 43 unit tests/build PASS; paired synthetic 18-label Image Print/Save PDF page and cell geometry PASS; 18/18 Code 128 decodes in both, quiet-zone edge bounds match within0.25 mm. Full browser regression `[3,18,500,500]` and 28-page A4/custom PDFs PASS. Current owner four screenshots were unavailable; fresh temp-only synthetic paired renders/diff used instead.
- Physical calibration: **NOT TESTED**; driver defaults to Letter/Simplex and was not changed. Require one plain-paper P2055dn sheet with custom form 190.5 × 254 mm portrait, Actual Size/100%, Fit/Shrink off, headers/footers off, duplex off, Tray 1/manual feed. Pre-cut stock remains blocked until four edge offsets pass.
- Deployment PASS: source `0e64a6fd45e1e65e6fe92cd398b3b2445da9ccb1`, active Pages `aae85a83-663d-449f-a20c-52418ed5b5e3` at the existing project, Production/main. Immediate rollback is prior active `a8287aa3-31dc-4446-a6be-c3127fac0e80`. Only `dist/` assets/_headers were uploaded; Worker config ignored.
- Wrangler and Dashboard account/Access checks PASS. Monitor Worker/D1 unchanged. Live acceptance BLOCKED: isolated tab reached Super Admin Access challenge; no synthetic import/PDF/event or audit verification. Don't inspect populated tabs. Next owner action is one Access sign-in, then resume synthetic acceptance. No physical calibration.

### GFS-LP-036 Staging Release

- Wrangler OAuth `whoami` PASS at `2026-11-17T12:36:40.354+05:00`: `gisupp@gmail.com`, Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Source checkout branch `codex/garden-shop-label-printer-mvp`, SHA `cb52289fc7287d05f2ec1ebc182bd108d9120731`.
- Dashboard PASS pre-deploy: Super Admin, existing Pages `garden-shop-label-printer-staging`, existing Access app/domain with only Super Admin Allow. Active rollback before deployment `2420ee42-08ac-4d0d-a620-caa7197f0966`; prior successful version `f80abfe1-52fc-4f03-b6f1-a35388c01d7f`.
- Static-only Pages deployment PASS: `a8287aa3-31dc-4446-a6be-c3127fac0e80`, `https://a8287aa3.garden-shop-label-printer-staging.pages.dev`, source `cb52289`, Production/main. Wrangler ignored the app Worker config and uploaded only dist assets/_headers. Stable Pages URL loaded the app. Rollback remains `2420ee42`.
- Monitor Worker/D1 were only read before deploy and remain as registered; no Worker, D1, Access or production mutation.
- Live acceptance BLOCKED: an isolated unauthenticated staging tab reached the Super Admin Access challenge. The shared populated tab was not used. No XLSX/CSV imports, live PDF download, PDF_GENERATED/audit VERIFIED, or served hash assertion occurred. Next owner action: sign in as `gisupp@gmail.com` in the isolated tab, return to blank import, then run synthetic live acceptance. Physical printer calibration remains NOT TESTED.

### GFS-LP-035 Image Print Repair

- Root cause: `preparePrintLayout()` appended a second `/label.css` after the inline custom `@page`, so that later stylesheet reset the print MediaBox to A4 although the DOM/grid was 190.5 × 254 mm. Removed the duplicate load and wait on the original stylesheet. Download PDF implementation/geometry remains unchanged; A4 unaffected.
- Added a custom-only, opt-out HP P2055dn safe-content profile. Driver default is Letter/Simplex; no named 190.5 × 254 mm form is registered. Driver accepts dynamic custom sizes including the required sheet. In-memory custom PrintSettings reports 4.233 mm non-imageable edges / 182.033 × 245.533 mm printable area. The profile repositions/scales only the content layer in the first/last rows and columns; physical label cells and gaps stay fixed.
- Full print regression PASS: 18 labels/slots, locked x/y positions within 0.03 mm, all content boxes within driver-reported area, 18 Code 128 decodes at 4× raster density, 190.5 × 254 mm one-page browser print PDF. Full browser output retained 28-page A4/custom batch PDFs and `[3, 18, 500, 500]` barcode decode counts; 42 unit tests/build pass. This is not physical print proof.
- Driver remains unchanged, with current Letter default. Operator must choose/define Custom 190.5 × 254 mm portrait, Actual Size/100%, no Fit/Shrink, browser headers/footers off, duplex off, Tray 1/manual. HP is non-borderless.
- Physical calibration: **NOT TESTED**. Next gate is one synthetic sheet on plain paper; owner returns that sheet or four edge measurements. Pre-cut stock remains blocked.
- Deployment is **BLOCKED** pending fresh authorization: read-only CLI history lists prior `2420ee42-08ac-4d0d-a620-caa7197f0966` / source `c7dc3fb`, but the Dashboard active version was not reverified. Current `wrangler whoami` reports no API token; the final Kilo CLI Dashboard `list_pages` call timed out. No Pages/Worker/D1/Access/production mutation occurred. Reauthorize Wrangler, verify account/Access/rollback through working Dashboard MCP, then static-only deploy and document the new ID.

### LP-034 Release Update (Supersedes Historical Blockers)

- Correct source checkout/branch/SHA verified: `D:\free seeds`, `codex/garden-shop-label-printer-mvp`, `c7dc3fbb150b7a8b10807d89afb49a052dda04de`. No source changes or repeated expensive tests.
- MCP and fresh GFS Dashboard/OAuth identity PASS; Super Admin-only Access policy PASS. No config repair required. Monitor Worker/D1 unchanged by post-upload readback.
- Fresh configured build and static-only staging deploy PASS: `2420ee42-08ac-4d0d-a620-caa7197f0966`, active on `garden-shop-label-printer-staging.pages.dev`. Rollback is verified prior active `2db928f2-0ccd-4f7a-aa9a-19db2bfc29d4`. See RULES.md for identity/time/resource evidence.
- Isolated anonymous staging request challenged by Access PASS. Owner login in context `gfs-lp034-synthetic` / tab 10 is the next dependency. Shared populated tab is preserved. Live import/PDF/barcode/audit acceptance remains BLOCKED, not inferred from local evidence.
- Stage completion/remaining: source/local quality 100%/0%; MCP/identity/Access preflight 100%/0%; static deployment 100%/0%; fresh live application/PDF/audit acceptance 0%/100%; physical printer/stock 0%/100%. Overall software release estimate 75%/25% (four equally weighted software stages, hardware excluded).

- Windows repair used the existing portable Node 24.22.3 at `E:\DevTools\Node\node-v24.22.3-win-x64`, not a reinstall. USER PATH now includes it while retaining `F:\Git\cmd`; npm/npx use `.cmd` due to the unchanged Restricted execution policy. npm cache is `F:\npm-cache`; local Wrangler 4.149.0, lockfile, project dependencies, Chrome/Edge and Playwright were already installed.
- Correct existing worktree was recovered at `D:\free seeds`, on `codex/garden-shop-label-printer-mvp`; no worktree creation or switch was needed. The project remains isolated under `garden-shop-label-printer/`. Do not stage unrelated dirty files or `.kilo/`.
- A4 geometry remains 210 × 297 mm, 65 × 44 mm labels, 3 × 6, 1 mm gutters, x=6.5/72.5/138.5 mm and y=14/59/104/149/194/239 mm. The new custom preset is 190.5 × 254 mm, 63 × 42 mm, 3 × 6 (18 labels), 0.5/0.333 mm gutters, x=0.25/63.75/127.25 mm and y=0.1675/42.5005/84.8335/127.1665/169.4995/211.8325 mm. Its narrow 0.25 mm side and 0.1675 mm top/bottom margins are warned in the UI.
- Repaired V3 `measureLabels()` runtime failure (undefined active `preset`), which prevented dynamic fitting. Final V4 top barcode/VPL region ends at y=14.5 mm, shorter than the TO frame (15.8 mm). Source geometry, dynamic English/Urdu fitting, explicit clipped-row preview warning, stable FS references, and row-level print exclusion are documented in project `README.md` and `RULES.md`.
- Verified locally on the reinstalled OS: `npm test` 42/42; `npm run build` TypeScript checks and Vite build PASS; `npm run test:browser` PASS twice after fixing the PDF test to wait for the real Playwright download event. It decoded all 500 Code 128 values for both A4 and custom, verified 28-page PDFs for both, exact custom MediaBoxes on every page, stable references across preset switches, and preview/print geometry. Overlong source data remains editable and is excluded only from output. No physical printer calibration is claimed. No lint script exists in the package.
- The approved single-label screenshot baseline was intentionally refreshed after visual review for the requested V4 geometry; generated synthetic A4/custom preview, browser print, and PDF renders are in `test-evidence/`.
- GitHub GCM identity `gardenshop` was verified and published. Wrangler `whoami` confirms the intended Cloudflare account; explicit-account read-only inventory confirmed the existing Pages, monitor Worker and audit D1. Kilo 7.8.27 now has an additive USER-level Chrome DevTools MCP 1.13.0 registration, but the current host has not reloaded it and a fresh local session still lacked `list_pages`; Dashboard selector/Access remain unverified. No deployment or remote mutation occurred. `f80abfe1` is the latest CLI-listed Pages entry; confirm it is active in Dashboard before designating rollback, with `3b9404e3` the older entry.
- Completion: toolchain/path recovery 100%; implementation/local layout 100%; A4/custom browser/PDF matrix including custom 500 100%; scoped Git synchronization 100%; Wrangler CLI authentication/account 100%; Dashboard identity/Access 0%; staging deployment/monitoring 0% pending authenticated browser verification; physical printer/stock calibration 0%.
- Cloudflare gate action: owner uses VS Code/Kilo **Developer: Reload Window** to reload the USER-level MCP registration, then verifies `chrome_devtools.list_pages` is exposed and calls it first. Expected read-only inventory confirms the Dashboard selector `Get Free Seeds` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2` and the staging/Access page. If Chrome requests remote-debugging permission, explicitly allow the official MCP for the approved testing profile. Do not expose tokens, cookies, auth codes or unrelated tabs; do not deploy until the visible identity/Access check passes.
- Rollback only a future standalone Pages version through the authenticated Pages history after fresh account and active-version verification. Preserve the monitor Worker, Access policy, audit D1 and chain. Never revert unrelated project data or alter existing Admin/API/WhatsApp/COD/Advance/production/Meta resources.

## Required Final Label (V3 History)

Historical V3 layout notes below are superseded by the V4 geometry and fit rules in `README.md` and the V4 status above.

- A4 portrait 210 × 297 mm; 3 columns × 6 rows; label 65 × 44 mm. Column x positions are 6.5, 72.5, 138.5 mm and row y positions 14, 59, 104, 149, 194, 239 mm; horizontal/vertical gaps are exactly 1/1 mm and the grid is centered.
- Outer outline: x=0.4, y=0.4, w=64.2, h=43.2 mm; 1 mm corner radius; 0.20 mm black stroke.
- Barcode/VPL band occupies y=1.0..18.2 mm. Vector Code 128 is on the left x=1.7..33.2 with 10X quiet zones and no readable tracking value. The right VPL capsule at x=44.4,y=1.1,w=19.4,h=7.5 stacks `VPL` above the prominent amount. City/province are directly below the amount; no location pin is rendered.
- Order ID/contact share one bordered horizontal block (1.3,18.5,62.4,5.2 mm) with a divider at x=32.5. The left value is the separate printed `FS-YYMM-XXXXX` reference; the original source ID remains in Review. The TO frame (1.3,24.1,62.4,12.2 mm) contains the bold To/name, full wrapped address and `Near by:` immediately after the address. Product occupies a compact row y=36.6..39.1 before FROM.
- Footer region y=39.4..43.3 mm is one row: `From: Garden Shop | C/o City Post Office, Sahiwal`. Black-and-white is default; Garden Shop green is optional for color printing.
- Preview, browser print and PDF derive from the same millimeter boxes and active-font fitting model. Urdu shaping uses Noto Naskh Arabic. Code 128 auto-switches B/C, preserves 10X quiet zones, uses a minimum 0.19 mm module, remains vector in PDF, and is checked by exact-source decode.
- Printed references use secure random `FS-YYMM-XXXXX` values. IndexedDB collision-checks and persists the source Order ID/tracking/reference mapping locally so re-imports/reprints retain it. Original source IDs are not changed. Offline cross-device global uniqueness cannot be guaranteed; the UI explicitly warns and site data must be retained.
- Normalize valid Pakistani mobiles to exactly 11 digits beginning `03`; flag invalid/incomplete values, never invent digits, block PDF/print, and keep the original address while removing only an exact duplicate phone token from the display copy.

## Audit Findings and Remaining Limits

## V3 Final Polish (2026-11-09)

- Tracking text is the actual tracking ID at x=1.7..33.2/y=0.8..3.0 mm, directly above vector Code 128 bars at y=3.2..17.4. The VPL capsule remains stacked and bordered; the city/province band is directly below it.
- Order/contact is now y=17.6..22.4; the enlarged TO frame is y=22.7..36.7 with a full-width Near by row at y=33.9..36.4; Product is y=37.0..39.1 and the footer remains y=39.4..43.3.
- Missing Order ID/Product/Near by remain Review warnings. The printed FS reference is locally reserved from tracking when source Order ID is absent; original source fields remain unchanged and offline cross-device uniqueness is not claimed.
- Long text is measured with the active font. Impossible rows remain editable and are excluded individually from print/PDF while valid selected rows continue. No CHECK, TEXT TOO LONG, EDIT REQUIRED or fabricated Not provided text is emitted on labels.

- Previous mismatched output layouts are replaced by one label HTML/CSS model for preview and browser print and a shared millimeter geometry model for vector PDF text/barcode bars.
- An in-memory real `.xlsx` fixture exercises the browser parser and zero-padded numeric phone recovery. Browser smoke also imports a real synthetic XLSX and verifies a leading-zero contact.
- Barcode tests generate and decode exact synthetic tracking values for 18/19/100/500 batches. Browser smoke decodes all 500 labels across all sheets and compares preview/print field boxes against each other, in addition to fixed A4/label geometry and screenshot evidence.
- Wrangler applied this project's migration to a dedicated staging D1 (ID recorded in `RULES.md`). A Super Admin-authenticated synthetic import/labels/PDF event round-tripped through the deployed Worker/D1; the report returned `Audit chain: VERIFIED`. Worker/JWT edge cases remain unit-tested with mocked JWKS/D1.
- No authorized 15-order historical fixture was located/used. Do not inspect the protected root `images/` collection or use real customer fixtures without specific authorization.
- No open label-printer-specific GitHub issue was returned by the read-only repository query.
- The owner supplied the approved premium reference for this repair; its hierarchy is visually checked against new preview and generated-PDF screenshots. Physical print/stock measurement is not represented by screenshot comparison.

## Verification Gates

- Generate synthetic 18/19/100/500 row batches; assert every row position and output page count. Test long names/addresses/landmarks, missing values, duplicate tracking, and phone leading-zero formats.
- Generate and decode every synthetic barcode against its exact tracking source. Exercise actual `.xlsx` parsing (including phone cells stored as text and zero-formatted numbers) and CSV parsing.
- Compare A4 browser preview with the generated PDF at matching dimensions. Assert page MediaBox 210 × 297 mm and every label 65 × 44 mm. Physical printer accuracy remains untested until paper calibration.
- Run Worker authorization/schema/rate-limit/hash-chain tests, local D1 smoke and isolated staging Access/D1 event round-trip. Staff-specific Access remains untested until an approved group/roster is available. Monitoring failure must not discard labels.
- Run the full standalone tests/build/audit and ensure no existing production path is included in the staged diff.

## Deployment State

- Historical V3 design/unit/browser/build: **100% software-verified** at the time recorded. Current V4 local verification is summarized above; custom 500-row browser decoding is not tested.
- Prior V2 staging deployment: **historical only** at Page `3b9404e3-92a5-4e02-9bd4-b626f96eb833`. Wrangler CLI authentication and GFS account identity now PASS; V4 deployment and isolated live PDF acceptance remain **BLOCKED** pending a visible Dashboard account/Access verification because no Chrome MCP actions are exposed. The shared browser tab was not inspected or used. After browser authorization, use only `test-evidence/staging-acceptance-18.csv`. Physical printer/stock calibration remains **0% / NOT TESTED**.
- Staff authorization: **0%**; no authorized staff roster/group exists. Current staging Access deliberately allows only the verified Super Admin.
- Admin integration: **not part of this design-repair task**. Existing card/redirect source remains separate and inactive; the active Cloudflare Admin version `3e4b7c26...` stays at 100% and was not changed.
- Production release: **0%**. No Pages production hostname, Admin Worker traffic shift, or production order binding was changed.
- Physical printer/stock: **0% / NOT TESTED**. No ruler measurement, scanner test on paper, or pre-cut label stock was used.
- GitHub GCM identity `gardenshop` and the published V4 branch were reverified; standalone updates are pushed separately. Cloudflare Wrangler CLI identity passes, but browser Dashboard/Access verification is blocked. Existing unrelated dirty worktree files remain unstaged and unchanged.
- The older Admin card/redirect proposal and active baseline mismatch are historical context only; this repair explicitly made no Admin changes. Staff email/group roster is unavailable, so staging remains Super-Admin-only. No Admin tile is live, and the active version remains `3e4b...` pending a separate authorized Admin task.
- Rollback: V2 Page `3b9404e3-92a5-4e02-9bd4-b626f96eb833` can be rolled back to prior Pages version `330217eb-763d-45ac-8a87-ad7437a055a7` through the authenticated Pages Deployments view after fresh account identity verification. Preserve the monitor Worker, Access policy and dedicated audit D1. Do not modify existing Admin navigation.
