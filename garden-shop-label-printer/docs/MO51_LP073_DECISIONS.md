# GFS-LP-073 MO PDF Raster Optimization

## User-provided staging baseline

- N76: 76 Money Orders / 38 A4 sheets / 76 PDF pages; **22.1 MB**.
- Validation **3.206 s**, DOM ready **14.924 s**, html2canvas **31.905 s**, PNG encoding **106.421 s**, PDF assembly **34.558 s**, PDF save **39.402 s**; reported stage total approximately **233 s**.

## Source-level size root cause

- `src/mo/pdf.ts` creates one 300-DPI transparent union crop for every populated front slot. The saved 16-field layout spans approximately `126.51×142.18 mm`, or `1494×1679 px` per overlay. N76 therefore rasterizes 76 dynamic overlays plus cached static face artwork; those overlays represent approximately 190 million RGBA samples before compression. This count/dimension estimate is derived from the renderer and sanitized saved layout, not from parsing the unavailable staging PDF.
- The legacy path calls `canvas.toBlob("image/png")`, reads the full PNG bytes, then `pdf-lib`'s `PngEmbedder` (`@pdf-lib/upng`) decodes PNG back to RGBA, splits RGB/alpha and deflates both streams again. This matches the dominant measured PNG-encode and PDF-assembly phases; an actual image-object dump could not be captured in this turn.

## Implemented lossless image path

- The MO-only predictor path reads the same 300-DPI Canvas RGBA samples and stores them as standard PDF RGB XObjects plus an alpha soft mask. Rows use PNG Sub prediction with PDF `/FlateDecode` and `/DecodeParms` (`Predictor 15`); no JPEG, resizing, color reduction, font substitution or artwork change is applied.
- PNG encoding/decoding is avoided. `PDFPage` draws the same image bounds/matrix; static art remains cached only within the export and dynamic values are never cached across records. `legacy-png` remains selectable as a rollback/fallback path.
- Final PDF Blob construction reuses the exact `Uint8Array.buffer` when it spans the full result, avoiding the prior extra ArrayBuffer copy. Raster row processing yields in bounded chunks and checks cancellation.

## Local synthetic evidence

- A synthetic 256×192 transparent raster produced **2,886 bytes / 92.6 ms** via the legacy PNG/embed path and **2,477 bytes / 22.1 ms** via predictor streams: **14.2% smaller** and **76.1% faster** for this image-pipeline microbenchmark. PDF.js rendered both PDFs pixel-identically; A4 landscape MediaBox, RGB image predictor and alpha-mask predictor were verified.
- This is a small component benchmark, not an N2/N76/N100 full-form result. The complete unit suite passed **157/157**, including existing barcode/label tests, and the staging-configured TypeScript/Vite build passed. Full synthetic baseline PDFs, image/resource counts, actual 22.1 MB comparison, memory peak, visual Urdu/stamp comparison and print compatibility remain unverified until the official Chrome MCP is available.

## Release gate

- Pre-change Git HEAD: `1f76e5bf320b5bba2dad20dd41e093a1e237dd4f`. Branch/remote: `codex/garden-shop-label-printer-mvp` / `https://github.com/gardenshop/freeseeds.git`. The 51 unrelated pending paths must remain unchanged.
- Read-only Wrangler preflight reports `gisupp@gmail.com`, Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; current Pages deployment `5b0fdf8b-a0a2-410d-ae99-2208b209d125`, prior rollback `3a683220-964b-4eaa-b624-433f6263c620`.
- The tested source/docs candidate is committed and pushed after local PASS; no Cloudflare deployment was performed. Official `chrome_devtools.list_pages` timed out twice and no reconnect action is exposed. No raw CDP or alternate browser was used. Dashboard identity, N2/N76/N100 full PDF/image/print acceptance, existing-label browser regression and actual staging size/timings remain **BLOCKED / NOT TESTED**.
- Monitor `PDF_GENERATED` HTTP 400 remains separate. No Worker, D1, Access-policy, Admin/API, WhatsApp, COD/payment, Meta, production-routing or Hoja Seeds change. Physical duplex calibration remains **NOT TESTED**.
