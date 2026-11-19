# GFS-LP-048 — MO-51 Drag & Drop Field Editor and Batch Printing

## Decisions

- LP-048 adds a separate user-defined layout path inside MO Print. It does not replace the LP-047 per-row user-confirmed DRAFT controls or the blank manual-completion PDF. The layout path applies the user's selected source bindings to every eligible row without a confirmation prompt per row.
- Layout coordinates are millimetres from the top-left of one 148.5 × 210 mm A5 half. Two halves compose a 297 × 210 mm landscape A4 sheet. Layout persistence is limited to field IDs, source IDs, face, geometry, font size, alignment and wrap setting. Record values, CNIC values and workbook contents are never serialized with the layout.
- Section 1 of the supplied artwork is FRONT; section 2 is BACK. For `N` eligible rows, `S = ceil(N/2)`, sheet `i` places eligible record `i` on the left and `i+S` on the right when present. The same source-row slots are used for the paired back. An odd final sheet leaves the unused half blank on both faces.
- The configurable front-only, back-only and paired PDF modes use A4 landscape MediaBoxes. The `Print MO Batch` action opens the generated local PDF in a browser print tab. The separate blank manual-completion PDF remains available. Sender CNIC remains optional, front-only, pinned to the artwork's sender identity line, volatile to the MO session, and never persisted.
- Static artwork is cached separately from per-record transparent field overlays. This keeps 300-DPI raster output and form/preview geometry while avoiding repeated rasterization of the full artwork for each unique sheet. Temporary iframes and canvases are removed on completion, cancellation and failure.
- These are user-defined source/position choices only. They do not establish official field semantics, remitter/payee roles, post-office acceptance, or a verified physical duplex rotation. Physical back rotation remains configurable and uncalibrated.

## Verification Record

- `npm.cmd test`: 137 tests PASS. `npm.cmd run build`: application TypeScript, Worker TypeScript and Vite build PASS.
- Full synthetic browser/PDF regression: PASS with no browser errors. Layout behavior covers drag/drop, editable geometry, persistence/reload/reset, missing/overflow blocking, odd blank halves, paired/front-only/back-only PDFs, print popup, and cancellation cleanup.
- Synthetic cut-and-stack layout PDF at N=100: 100 pages; first sheet records 1/51; final sheet records 50/100; first and last front/back PDF pages match their corresponding preview. Tracking, declared principal, receiver name and Month Stamp values are independently checked for each pair.
- Synthetic populated layout PDF at N=500: 500 paired pages, 1,792,649 bytes, 65,144 ms. Renderer JavaScript heap was 49,029,820 bytes before, peaked at 104,701,336 bytes, and ended at 69,201,872 bytes. This is renderer JS heap, not total browser/native canvas memory. First/middle/final pairs are 1/251, 125/375 and 250/500; PDF pages 1,249,250,499,500 match preview. Cancellation removes temporary rasterizer frames and does not download a partial PDF.
- Independent visual review of synthetic N=100 front/back PDF rasters confirmed the original front Month Stamp, VPL/VPP and article/amount form sections, the back M.O.-51 Revised/Pakistan Money Order heading, Urdu form artwork, and no clipped sections. This is a visual source-artwork check in addition to the separate pixel-parity assertions; no customer-data screenshot was used.
- Existing synthetic MO counts include N=1,2,3,5,50,99,100,101,500. Mixed prefixes, duplicate/missing data, long addresses, Unicode/Urdu, CNIC constraints, overflow, both faces, PDF MediaBoxes and label regressions are covered by synthetic tests. No real workbook values or customer screenshots are fixtures or browser evidence.

## Release Gates

- **Local implementation/tests: PASS.**
- **Official postal field/party semantics: NOT VERIFIED** and intentionally not researched for this change. Do not claim official postal acceptance.
- **Physical printer/duplex calibration: NOT TESTED.**
- **Authenticated staging/served-asset/audit acceptance: BLOCKED** until authorized account/Dashboard identity and Access are verified using the authorized Chrome DevTools MCP. The local browser suite is not staging acceptance.
- Rollback is limited to reverting the scoped LP-048 source/test commit. Do not reset the shared checkout or revert unrelated root work. Do not delete or alter PDFs already downloaded by a user.
