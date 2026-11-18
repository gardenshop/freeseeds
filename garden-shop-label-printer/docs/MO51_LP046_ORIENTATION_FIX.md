# GFS-LP-046: MO-51 Face-Order Correction

Status: corrected and locally verified. No deployment or physical duplex calibration.

## Authoritative Mapping

- Original HTML section 1 is **FRONT**: Month Stamp, VPL/VPP, amount, sender and receiver details, optional Sender CNIC, and intimation.
- Original HTML section 2 is **BACK**: M.O.-51 (Revised), Pakistan Money Order title/branding, postal office, stamps and signatures.
- PDF page 1 is section 1/front; page 2 is section 2/back, repeated as front/back for each I1 imposition sheet. Existing `S=ceil(N/2)`, left=i, right=i+S pairing and odd blank right halves do not change.
- This correction changes visual source-section selection only. It does not swap records or apply a physical duplex flip. The selectable 180-degree per-form back rendering remains explicitly uncalibrated.

## Root Cause

`src/mo/renderer.ts` treated `sourcePages[1]` (title/payment artwork) as front and `sourcePages[0]` (sender/intimation artwork) as back. I3 already emitted the `front` document on PDF page 1, so the loop/page order was correct while the source faces inside those named documents were reversed. CNIC and unverified back rotation were keyed to source index 0, and prior browser tests asserted pairing/CNIC position without asserting the defining artwork text; PDF-vs-preview parity therefore repeated, rather than detected, the wrong mapping.

## Repair and Regression

- Map source index 0 to front; source index 1 to back. Keep sender CNIC on section 1 only and apply configurable unverified rotation only to section 2's individual form slots.
- UI labels now name each section. Browser tests assert Month Stamp/V.P.L./V.P.P. on every front and M.O.-51 (Revised)/PAKISTAN MONEY ORDER on every back, plus CNIC only on front sender lines.
- Generated separate actual preview PNGs and PDF-raster PNGs at N=2/3/5/100. Direct PDF evidence includes N=2 pages 1/2, N=3 pages 3/4, N=5 pages 5/6, and N=100 pages 1/2 and 99/100 with explicit front/back filenames. Those pages are raster-compared with the corresponding corrected previews. Odd N=3/5 blanks remain white on both faces. Pixel proof filenames explicitly say front/back.
- The older `mo51-pdf-n2-front.png` and LP-044/045 face-labelled evidence captured the reversed mapping and is superseded; use only the new LP-046 evidence directory for corrected proof. No old/user evidence file was deleted or overwritten outside the test's isolated evidence path.
- Sender CNIC, blank-manual-completion output, I1 candidate selection, commission separation, PDF geometry, local fonts, and all label code remain unchanged.

## Verification

- Targeted MO core/render/PDF tests: 43/43 PASS.
- Full unit suite: 125/125 PASS.
- TypeScript/Worker/Vite build: PASS.
- Full browser label/PDF regression: PASS, 0 browser errors; `[3,18,500,500]` barcode decodes and 28-page label PDFs remain unchanged. Corrected MO visual assertions and all seven separate front/back preview proof pairs were generated under `D:\Temp\kilo\gfs-lp046-evidence\`.
- I3 page count/media box, preview/PDF raster comparison, odd blank pixels, CNIC isolation, cancellation and cleanup checks remain passing.

## Still Unapproved

This resolves visual face identity only. It does not establish official revision/legal field roles, populated customer-field semantics, Nastaliq fidelity, physical duplex turn edge/rotation, printer registration, LP-041 authenticated staging/served asset/PDF_GENERATED/audit-chain verification, or operational postal acceptance.
