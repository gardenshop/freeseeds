# Label Printer MVP Plan and Status

The repository-wide architecture discovery and full implementation history remain in `../LABEL_PRINTER_PLAN.md`. This file tracks the standalone project's current gaps and launch boundary.

## Launch Flow

1. Upload `.xlsx`/`.csv` locally; choose worksheet/header and confirm field mapping.
2. Review, edit, search, select, and resolve duplicate or ambiguous rows.
3. Preview exact 65 × 44 mm labels on an A4 3 × 6 sheet.
4. Generate PDF or print via the same label layout; report actual-size setting and printer calibration requirements.
5. If approved, emit privacy-minimized activity to the dedicated, Access-protected monitoring Worker. Staff and Super Admin roles remain separate.

## Required Final Label

- A4 portrait 210 × 297 mm; 3 columns × 6 rows; label 65 × 44 mm. Column x positions are 6.5, 72.5, 138.5 mm and row y positions 14, 59, 104, 149, 194, 239 mm; horizontal/vertical gaps are exactly 1/1 mm and the grid is centered.
- Outer outline: x=0.4, y=0.4, w=64.2, h=43.2 mm; 1 mm corner radius; 0.20 mm black stroke.
- Barcode/VPL band occupies y=1.0..18.2 mm. Vector Code 128 is on the left x=1.7..33.2 with 10X quiet zones and no readable tracking value. The right VPL capsule at x=44.4,y=1.1,w=19.4,h=7.5 stacks `VPL` above the prominent amount. City/province are directly below the amount; no location pin is rendered.
- Order ID/contact share one bordered horizontal block (1.3,18.5,62.4,5.2 mm) with a divider at x=32.5. The left value is the separate printed `FS-YYMM-XXXXX` reference; the original source ID remains in Review. The TO frame (1.3,24.1,62.4,12.2 mm) contains the bold To/name, full wrapped address and `Near by:` immediately after the address. Product occupies a compact row y=36.6..39.1 before FROM.
- Footer region y=39.4..43.3 mm is one row: `From: Garden Shop | C/o City Post Office, Sahiwal`. Black-and-white is default; Garden Shop green is optional for color printing.
- Preview, browser print and PDF derive from the same millimeter boxes and active-font fitting model. Urdu shaping uses Noto Naskh Arabic. Code 128 auto-switches B/C, preserves 10X quiet zones, uses a minimum 0.19 mm module, remains vector in PDF, and is checked by exact-source decode.
- Printed references use secure random `FS-YYMM-XXXXX` values. IndexedDB collision-checks and persists the source Order ID/tracking/reference mapping locally so re-imports/reprints retain it. Original source IDs are not changed. Offline cross-device global uniqueness cannot be guaranteed; the UI explicitly warns and site data must be retained.
- Normalize valid Pakistani mobiles to exactly 11 digits beginning `03`; flag invalid/incomplete values, never invent digits, block PDF/print, and keep the original address while removing only an exact duplicate phone token from the display copy.

## Audit Findings and Remaining Limits

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

- Standalone premium design/unit/browser/build: **100% software-verified**. Phone normalization, exact geometry, per-label fitting/overflow warnings, preview/print geometry, screenshot golden and all 500 synthetic Code 128 decodes pass.
- V2 staging deployment: **PENDING**; current Page `330217eb-763d-45ac-8a87-ad7437a055a7` is the prior version. The isolated acceptance context requires a manual Super-Admin Access login, and the shared browser tab contained pre-existing rows that were not touched. Use only `test-evidence/staging-acceptance-18.csv` after login. Physical printer/stock calibration remains **0% / NOT TESTED**.
- Staff authorization: **0%**; no authorized staff roster/group exists. Current staging Access deliberately allows only the verified Super Admin.
- Admin integration: **not part of this design-repair task**. Existing card/redirect source remains separate and inactive; the active Cloudflare Admin version `3e4b7c26...` stays at 100% and was not changed.
- Production release: **0%**. No Pages production hostname, Admin Worker traffic shift, or production order binding was changed.
- Physical printer/stock: **0% / NOT TESTED**. No ruler measurement, scanner test on paper, or pre-cut label stock was used.
- GitHub identity/repository and Wrangler account identity are recorded in `RULES.md`. HEAD `412a30f` and its three commits were pushed to `origin/codex/garden-shop-label-printer-mvp`; GitHub and Wrangler authentication checks passed. Existing unrelated dirty worktree files remain unstaged and unchanged.
- The older Admin card/redirect proposal and active baseline mismatch are historical context only; this repair explicitly made no Admin changes. Staff email/group roster is unavailable, so staging remains Super-Admin-only. No Admin tile is live, and the active version remains `3e4b...` pending a separate authorized Admin task.
- Rollback: if needed, roll Pages back to `434ea52f-780c-47c1-bf72-1ac013187006` using Cloudflare Dashboard after re-verifying the account. Preserve the monitor Worker, Access policy and dedicated audit D1. Do not modify existing Admin navigation unless the separate integration proposal is approved and passes review.
