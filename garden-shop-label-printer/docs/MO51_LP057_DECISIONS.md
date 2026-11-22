# GFS-LP-057 — MO layout and print-safety decisions

## Decisions and root causes

- **Sender CNIC is semantic, not coordinate-bound.** The prior editor helper selected the first party block after the renderer reordered the form, while the PDF renderer independently pinned CNIC to the Sender block. The editor and PDF could therefore disagree. Section 1 now marks the Sender block and CNIC writing line; the editor overlay follows that marker on each A5 half. CNIC position/size controls are disabled, legacy migration treats CNIC as a Sender field, and font/alignment remain adjustable. CNIC remains optional, MO-only and in-memory; its formatted string is never included in layout storage, request/event payloads, or labels.
- **Rendered text must fit both its field and the printed artwork.** Previous checks compared layout boxes with each other but not glyphs with static form labels. The new validator uses rendered text ranges, field bounds, and static artwork glyph bounds; it never shrinks or truncates text. Output fails closed with source-row/face/field names and a direct field-selection action. The synthetic legacy tracking layout was moved after the printed article label; the test verifies the issue, selects the field, repairs it, and then exports.
- **VPL/VPP duplication in Edit mode is intentional.** Edit mode uses the selected sample for both halves to preview one reusable layout. Final preview/PDF uses the independent `MoSheet` candidates. Regression tests assert N42 `1/22 … 21/42`, N100 `1/51 … 50/100`, and N500 pairings. The base printed VPL/VPP labels remain static; the full prefix remains in each tracking value rather than overprinting the label.
- **Print targets are fail-closed.** The print handler polls the newly opened target and calls `window.print()` only after its URL exactly matches the generated blob and its document type is `application/pdf`. A wrong, inaccessible, blank-timeout, or non-PDF target is closed without printing. The initial `about:blank` navigation is not used for object-URL cleanup. A local browser regression confirms the new target is a distinct PDF blob and that print is invoked only after validation.
- The original Section 2 source artwork is unchanged. Label generation, Workers, D1, Access policy, Admin/API, WhatsApp, COD, payments, Meta and production routing were not changed.

## Changed project files

- `src/main.ts`, `src/mo/layout.ts`, `src/mo/renderer.ts`, `src/mo/view.ts`, `src/mo/print-target.ts`
- `tests/browser-smoke.mjs`, `tests/mo-core.test.ts`, `tests/mo-layout.test.ts`, `tests/mo-print-target.test.ts`
- `README.md`, `RULES.md`, and this record

No generated screenshot, PDF, workbook, customer record or test-evidence directory was committed.

## Local validation

- `npm.cmd test`: **151/151 pass**.
- Staging-configured `npm.cmd run build`: **PASS** with the authorized staging Monitor and Admin URLs. `dist/` is static-only; no `_worker.js` is present. Built JS/CSS include the verified staging endpoints.
- Final isolated `npm.cmd run test:browser` completed successfully with the per-row-distinct synthetic MO fixtures. It covered N1, N2, N3, N5, N42, N100, N123, N124 and N500 imposition, odd blanks, mixed prefixes, legacy migration, CNIC privacy, editor controls, static-artwork collision/select/repair, preview/PDF parity and existing label/barcode/print/PDF regression. The completed run reported `browserErrors: []`; the managed process continued after its first 600-second log window and exited after the full summary.
- Actual local PDF raster pages from the final distinct-value run were visually inspected in a synthetic-only browser context. N42 pages 1/2 and 41/42 and N100 pages 1/2 and 99/100 matched preview; two A5 halves remain on A4 landscape without right clipping. The rasters show distinct N42/N100 tracking, principal, receiver name/address, phone and date values; CNIC raster evidence shows the synthetic value on the lower Sender identity line. Generated evidence is in ignored `node_modules/.cache`, not source or Git.
- The test HTML explicitly labels the duplicate Edit-mode sample as intentional; final batch records remain distinct. The VPL/VPP prefix is preserved in tracking. The base printed VPL/VPP labels are not overprinted by the default test layout.
- Three new screenshot attachments were not present in the task payload; only prior synthetic project screenshots and LP-057 synthetic PDF rasters were inspected.

## Staging deployment and rollback

- Application-source commit deployed: **`b09769198aaecee33cdc35ba80b9c1657ea6ccf4`** on `codex/garden-shop-label-printer-mvp`; remote HEAD matched at deployment. A later test-only fixture/documentation follow-up is committed on the same branch. Wrangler identity and Dashboard showed Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, signed in as `gisupp@gmail.com`. The existing Pages project and Access app/policy were verified; the Allow policy remains limited to that identity. No token was revoked again.
- Static `dist/` only was uploaded to the existing `garden-shop-label-printer-staging` Pages project on `main`. Deployment **`0e27536b-630d-4910-ab95-3ec55d2e870b`** reports Success with 15 assets, source `b097691`; stable URL serves `index-G8FwsYL1.js` and `index-blXQKzvc.css`. Wrangler ignored the unrelated `wrangler.jsonc`; no Worker was deployed.
- Immediate successful rollback reference: **`5307cf95-851e-4757-b341-becfeaae1788`** (LP-056). The older successful `f2141840-4291-496d-909f-93131b0fb9de` remains historical. No rollback was invoked.

## Staging acceptance, privacy incident and blockers

- **Authenticated staging acceptance is BLOCKED; no synthetic data was imported on staging.** The isolated Chrome DevTools context reached Cloudflare Access sign-in and was closed without using its challenge URL. The previously open shared staging app restored a populated profile after reload. A single snapshot inadvertently exposed existing customer values in the session/tool output. I stopped immediately; no row was edited, printed, exported, uploaded or copied into project files. No CNIC value was entered into the shared profile, and no local-storage/session-storage value was changed by this check. The tool output is sensitive and must not be shared; this record contains no customer values.
- A short-lived signed Access challenge query also appeared in the page-list tool output for the isolated context. That tab was closed; the query was not reused and no cookies/headers were read. Do not revoke the owner-confirmed Access token again or alter policy.
- Because no fresh isolated authorized staging context is available, LP-057 deployed features, served staging preview/PDF, staging pair data, staging original-label regression, and staging Print MO Batch target are **NOT VERIFIED**. The next safe action is to complete Cloudflare Access sign-in in a fresh isolated browser context and leave it on the blank staging import screen; do not use the populated shared page.
- Audit remains separately **BLOCKED**: Worker `PDF_GENERATED` HTTP 400 for `gfs-paper-presets-v4` is not repaired or retested. No template version was spoofed; Worker/D1 and audit-chain data were untouched.
- Physical duplex calibration and official postal acceptance remain **NOT TESTED**. Do not print paper/stock until staging acceptance passes and the synthetic PDF has been visually checked in the authorized isolated context.
