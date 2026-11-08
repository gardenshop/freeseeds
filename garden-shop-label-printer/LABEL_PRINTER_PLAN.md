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
- Wrangler applied this project's migration to a dedicated staging D1 (ID recorded in `RULES.md`). A Super Admin-authenticated synthetic import/labels/PDF event round-tripped through the deployed Worker/D1; the report returned `Audit chain: VERIFIED`. Worker/JWT edge cases remain unit-tested with mocked JWKS/D1.
- No authorized 15-order historical fixture was located/used. Do not inspect the protected root `images/` collection or use real customer fixtures without specific authorization.
- No open label-printer-specific GitHub issue was returned by the read-only repository query.
- The latest label reference image is not present as an attachment in the current task context. Written specifications were implemented; pixel-for-pixel comparison to the missing image remains unverified.

## Verification Gates

- Generate synthetic 18/19/100/500 row batches; assert every row position and output page count. Test long names/addresses/landmarks, missing values, duplicate tracking, and phone leading-zero formats.
- Generate and decode every synthetic barcode against its exact tracking source. Exercise actual `.xlsx` parsing (including phone cells stored as text and zero-formatted numbers) and CSV parsing.
- Compare A4 browser preview with the generated PDF at matching dimensions. Assert page MediaBox 210 × 297 mm and every label 65 × 44 mm. Physical printer accuracy remains untested until paper calibration.
- Run Worker authorization/schema/rate-limit/hash-chain tests, local D1 smoke and isolated staging Access/D1 event round-trip. Staff-specific Access remains untested until an approved group/roster is available. Monitoring failure must not discard labels.
- Run the full standalone tests/build/audit and ensure no existing production path is included in the staged diff.

## Deployment State

- Standalone MVP code/unit/browser tests/build: **100% locally verified**. Synthetic XLSX, phone zero-padding, 18/19/100/500 batches, all generated Code 128 values, Unicode PDF fallback and overflow warnings are covered.
- Staging Pages/monitor/D1/Access: **100% for the Super Admin canary**. Remote import/labels/PDF audit events and hash-chain verification passed; no physical printer test was performed.
- Staff authorization: **0%**; no authorized staff roster/group exists. Current staging Access deliberately allows only the verified Super Admin.
- Admin integration: **source implementation 100%, active Admin rollout 0%**. The card/redirect code and route tests are pushed; active Cloudflare Admin version `3e4b7c26...` is still at 100% and does not yet contain the tile. The Admin source baseline does not match the checkout, so promotion is blocked pending source reconciliation.
- Production release: **0%**. No Pages production hostname, Admin Worker traffic shift, or production order binding was changed.
- GitHub identity/repository and Wrangler account identity are recorded in `RULES.md`. The standalone branch is `origin/codex/garden-shop-label-printer-mvp`; recent commits include `16cc9d2` (Admin integration source), `04b155c` (Unicode PDF fix), and the staged follow-up documentation/tests. Existing unrelated dirty worktree files remain unstaged and unchanged.
- Owner authorized an Admin-only staging canary; free-tier/account inventory, Pages deployment, D1 ID, Worker version and Access App ID are recorded in `RULES.md`. Staff email/group roster is unavailable, so staging is Super-Admin-only. The checked-out Admin template does not match the active Operations home/source; do not deploy it over active version `3e4b`. The Admin tile/redirect code is locally implemented/tested and pushed, but not live. This is the Admin launch blocker.
- Rollback: restore the last approved standalone Pages/Worker versions; preserve the dedicated audit D1. Do not modify existing Admin navigation unless the separate integration proposal is approved and passes review.
