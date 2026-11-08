# Label Printer MVP Plan and Status

The repository-wide architecture discovery and full implementation history remain in `../LABEL_PRINTER_PLAN.md`. This file tracks the standalone project's current gaps and launch boundary.

## Launch Flow

1. Upload `.xlsx`/`.csv` locally; choose worksheet/header and confirm field mapping.
2. Review, edit, search, select, and resolve duplicate or ambiguous rows.
3. Preview exact 65 × 44 mm labels on an A4 3 × 6 sheet.
4. Generate PDF or print via the same label layout; report actual-size setting and printer calibration requirements.
5. If approved, emit privacy-minimized activity to the dedicated, Access-protected monitoring Worker. Staff and Super Admin roles remain separate.

## Required Final Label

- A4 portrait 210 × 297 mm; 3 columns × 6 rows; label 65 × 44 mm.
- Top row: Order ID and Product in one ruled block; VPL COD amount aligned right.
- Middle row: tracking reference above Code 128 barcode, with destination city/province prominent alongside.
- `TO` bordered area: bold receiver name, complete measured/wrapped address, `Near by:` landmark line, bold/prominent contact number.
- One-line footer exactly: `From: Garden Shop | C/o City Post Office, Sahiwal, Punjab`.
- All screen, print and PDF positions/text derive from a common layout model. Use vector PDF text and vector barcode bars where supported. Flag minimum-font overflow rather than clipping.

## Audit Findings and Remaining Limits

- Previous mismatched output layouts are replaced by one label HTML/CSS model for preview and browser print and a shared millimeter geometry model for vector PDF text/barcode bars.
- An in-memory real `.xlsx` fixture exercises the browser parser and zero-padded numeric phone recovery. Browser smoke also imports a real synthetic XLSX and verifies a leading-zero contact.
- Barcode tests generate and decode every synthetic value for 18/19/100/500 batches. Browser smoke decodes every barcode rendered on both the 3-label and 18-label sheets and checks shared page/label dimensions.
- Wrangler applied this migration and synthetic SQL insert/read in the local-only D1 emulator. Worker auth/event tests still use mocked D1; no dedicated cloud D1/Worker/Access resources are approved or deployed. Do not claim live monitoring.
- No authorized 15-order historical fixture was located/used. Do not inspect the protected root `images/` collection or use real customer fixtures without specific authorization.
- No open label-printer-specific GitHub issue was returned by the read-only repository query.
- The latest label reference image is not present as an attachment in the current task context. Written specifications were implemented; pixel-for-pixel comparison to the missing image remains unverified.

## Verification Gates

- Generate synthetic 18/19/100/500 row batches; assert every row position and output page count. Test long names/addresses/landmarks, missing values, duplicate tracking, and phone leading-zero formats.
- Generate and decode every synthetic barcode against its exact tracking source. Exercise actual `.xlsx` parsing (including phone cells stored as text and zero-formatted numbers) and CSV parsing.
- Compare A4 browser preview with the generated PDF at matching dimensions. Assert page MediaBox 210 × 297 mm and every label 65 × 44 mm. Physical printer accuracy remains untested until paper calibration.
- Run Worker authorization/schema/rate-limit/hash-chain tests and local D1 migration/SQL smoke. A true Worker-to-D1 test and role tests against dedicated Access require approved isolated remote resources. Monitoring failure must not discard labels.
- Run the full standalone tests/build/audit and ensure no existing production path is included in the staged diff.

## Deployment State

- Status: standalone MVP locally built/tested; migration and SQL smoke ran against Wrangler local D1 only. No Pages/Worker/D1/Access resources provisioned; no production deployment.
- GitHub identity/repository and Wrangler account identity are recorded in `RULES.md`. The current checkout is an unrelated GFS payments branch. Push only from a cleanly verified Label Printer branch with label-specific files staged.
- Cloudflare staging is blocked on explicit owner/security/resource approval and a dedicated resource registry entry. After approval, verify identity immediately before each mutation, create only new named resources, configure a dedicated Access audience and staff/admin allowlists, apply this project's D1 migration, and smoke-test denial/report roles before use.
- Rollback: restore the last approved standalone Pages/Worker versions; preserve the dedicated audit D1. Do not modify existing Admin navigation unless the separate integration proposal is approved and passes review.
