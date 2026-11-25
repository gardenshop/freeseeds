# GFS-LP-074 MO PDF Optimization Decision

## Preflight

- Repository `gardenshop/freeseeds`, branch `codex/garden-shop-label-printer-mvp`, starting HEAD `36217cbbc0015f8d5c996bfb7cff5f93bf5b5fb0`; the 51 unrelated pending Git paths were preserved.
- Wrangler read-only identity is `gisupp@gmail.com`, Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Active Pages deployment remains `5b0fdf8b-a0a2-410d-ae99-2208b209d125`; rollback remains `3a683220-964b-4eaa-b624-433f6263c620`. No external deployment was made.
- Local tests used a fresh localhost origin and the sanitized 16-field layout with synthetic VPL/VPP records only. Populated staging/Admin/WhatsApp tabs and customer values were not inspected.

## Baseline and Resources

- Owner-reported staging N76 baseline: **22.1 MB / approximately 233 s** for 76 PDFs pages / 38 A4-landscape sheets. Phase measurements supplied: validation 3.206 s, DOM ready 14.924 s, html2canvas 31.905 s, PNG encoding 106.421 s, PDF assembly 34.558 s, PDF save 39.402 s.
- Local same-layout legacy N76: **3,612,406 bytes**, 76 A4-landscape pages, 78 unique image objects (two cached 3507×2480 static forms plus 76 1494×1679 overlays, each with an alpha mask). Local output does not explain the larger staging baseline; the discrepancy remains unresolved.
- Source inspection confirms the legacy PDF pipeline PNG-encodes each 300-DPI overlay, then `pdf-lib` decodes/splits RGB and alpha and Flate-encodes the channels again. Static artwork is reused; record overlays are not shared.

## Measured Experiments

- N2 legacy: 599,858 bytes / 3.496 s. N2 direct-overlay candidate: 599,821 bytes / 4.007 s. PDF.js raster comparison matched both A4 pages exactly; no useful size or speed gain.
- N10 legacy: 917,339 bytes / 8.167 s. Direct-overlay candidate: 917,164 bytes / 8.048 s. The change is negligible.
- N76 warm legacy: 3,612,406 bytes / 142.7 s, peak observed JS heap ~948 MB. Direct-overlay output was 3,610,998 bytes and one warmed PDF.js comparison matched all 76 pages (38,139,232 raster pixels, zero differing pixels), but separate runs measured 66.6–240.3 s. Timing is too variable to approve the mode; size improvement is only 0.04%.
- N100 local direct-overlay PDF: 4,577,399 bytes, 100 A4-landscape pages / 50 sheets. The visible local run took 159.9 s; a background-throttled run took 597.8 s and is excluded from performance claims. Raster screenshots verified page 1 pair 1/51, page 99 pair 50/100, and page 100 back artwork.
- Predictor-15 was rejected: N2 increased 27% in size and N76 increased 29.4%. Grouped PNG crops were also rejected on N2 (+3.1% size, 2.7× slower). No lossy codec, reduced DPI, font substitution or artwork change was accepted.
- The grouped-crop N76 run was stopped after failing to make timely progress; no N76 grouped result is claimed. Direct raw mode’s observed N76 timing variation (66.6–240.3 s) is why it remains disabled by default.

## Decision

- `legacy-png` is restored as the default. `raw-overlays` remains opt-in only for future same-environment benchmarking. It is not an approved release optimization because full-batch timing is unstable and the size reduction is negligible.
- The actual staging N76 target (≤5 MB and ≤45 s) remains **UNVERIFIED**; the user-provided 22.1 MB staging baseline does not match the local 3.61 MB synthetic PDF. Do not claim the target met or deploy the experiment.
- Final unit suite: **157/157 PASS**; staging-configured build: **PASS**. Full local PDF.js raster comparison confirms N2 and N76 legacy/raw images match exactly; N100 page/pair screenshots and N3 odd-page blank-half check pass. Existing label/barcode tests pass and no label source changed. Live staging download/Print MO and the actual 22.1 MB stage baseline were not re-run; no staging update or physical print occurred.
- Source/docs changes are committed and pushed after local verification; current active deployment remains the legacy release below. No new Pages deployment was made because no optimization candidate met the consistent size/time gate.
- Monitor `PDF_GENERATED` HTTP 400 remains separate. No Worker, D1, Access policy, Admin/API, WhatsApp, COD/payment, Meta, production-routing or Hoja Seeds changes occurred. Physical duplex calibration remains pending.
