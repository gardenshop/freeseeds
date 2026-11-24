# GFS-LP-072 City Ink-Bounds Fix and MO Acceptance

## Reproduced root cause

- The saved City layout definition is a 10 pt, left-aligned, wrapped field at `x=78.65, y=95.38, w=29.72, h=4.8 mm`. Only source binding and geometry were read from staging storage; no staging row values were inspected.
- A synthetic Urdu City value produced `47.72×14.85 px` Canvas ink in a `112.33×18.14 px` field. Chrome's Range rectangle began 4 px above the text element's CSS line box. The old calculation used `Range.top + fontBoundingBoxAscent - actualBoundingBoxAscent`, yielding an ink top `0.85 px` above the field even though the CSS-baseline calculation placed the glyph ink inside. A second synthetic Urdu value passed, reproducing the reported row-dependent false blocker.
- `glyphInkTopFromLineBox` now positions ink from the text element's line-box top, CSS line-height and Canvas font/actual metrics. Range top is used only to identify wrapped-line indexes. No tolerance was widened or diagnostic suppressed; transformed text retains the prior conservative path.

## Local synthetic verification

- N2 with distinct synthetic VPL/VPP rows, saved 16-field layout and affected Urdu City shapes: **PASS**, both records eligible; Download MO PDF and Print MO Batch enabled.
- 76 distinct synthetic records, 38 sheets, including seven Urdu-script Cities at source rows 3, 14, 21, 22, 53, 63 and 73: **PASS**, 76 records/76 rendered face documents. Validation: 7.13 s.
- Negative control with City width reduced to 4 mm: **BLOCKED** with City printable-bounds diagnostics and City/province collision; both outputs disabled. Restoring the saved 29.72 mm field returned the full N2 to **PASS**.
- N100 synthetic batch: **PASS**, 100 eligible records, 50 sheets and 100 paired pages. The actual generated `application/pdf` blob was parsed as 100 pages, each A4 landscape (`841.89×595.28 pt`). PDF viewer raster confirmed the first front pair 1/51 (page 1) and final front pair 50/100 (page 99); page 100 is the matching blank back artwork. PDF generation: 267.8 s; validation: 9.277 s.
- Synthetic N2 Print MO Batch resolved to its generated local `application/pdf` blob. The print call was canceled with Escape; no physical printing occurred. The 100-page download was exercised separately from Print MO Batch.
- Complete unit suite: **155/155** tests, including MO imposition/collision and existing barcode tests. Staging-configured static build passed. Synthetic N76 label preview and downloaded label PDF passed: 76 Code 128 labels, five A4 portrait pages; no label source was changed.

## Staging release and live acceptance

- Pre-fix Git HEAD: `84e215c1cfab5af42bcb0a935bf00045faa8a494`. Active Pages deployment before LP-072: `3a683220-964b-4eaa-b624-433f6263c620` (source `e2b2df8`); if the candidate is deployed, this pre-release active deployment is the immediate rollback target.
- No LP-072 commit or deployment is claimed here. This record contains only verified local synthetic results; final Git/deployment/live evidence will be reported after those gates complete.
- Monitor `PDF_GENERATED` HTTP 400 remains a separate Worker-contract blocker. No Worker, D1, Access policy, Admin/API, WhatsApp, COD, payments, Meta, production routing or Hoja Seeds change is authorized. Physical duplex calibration remains pending; no printer was run.
