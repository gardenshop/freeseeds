# GFS-LP-044: MO-51 I2 Decisions and Evidence

Status: local screen preview only. No MO PDF, print job, physical calibration, postal approval, staging acceptance, or deployment.

## I2 Boundaries

- New navigation entry `MO Print` follows `Print & export`. It is a separate preview and does not modify existing label actions/renderers.
- I2 calls the I1 projection on the current selected/count-limited `Order` rows, preserving row order and I1 fail-closed VPL/VPP/amount/duplicate semantics. RGL/UMS/unknown rows are excluded with reason counts. Existing `Order` objects are not edited.
- The uploaded `MO 51/VP_Money_Order_Form_A5.html` is consumed as raw source artwork. Runtime removes all links, scripts and source styles; the new sandboxed iframe document runs no scripts, loads no external resources, and receives only the optional Sender CNIC. Existing source file contents are not changed.
- Historical I2 assumption: source section 2 (`M.O.-51 (Revised)`, Pakistan Post heading) was provisionally shown as “front” and section 1 as “back”. This was incorrect and is superseded by the owner-authoritative GFS-LP-046 mapping below.
- Both previews show A4 landscape (297 x 210 mm) with two 148.5 x 210 mm logical slots. Each source artboard (148 x 220 mm) is uniformly scaled by `min(148.5/148,210/220)=0.95454545…`, centered horizontally (3.613636 mm each side) and flush vertically. No independent-axis scale or source edit/crop is applied. The full source section is overflow-visible inside a half-area clip; actual browser geometry checks are required to ensure all contents remain within the master artboard.
- The mobile preview retains the full 1123 px sheet canvas inside a horizontally scrollable face region rather than shrinking/clipping the paired artwork to the phone viewport.
- The source references remote Noto Nastaliq Urdu. The preview removes that link and uses the already-installed local `@fontsource/noto-naskh-arabic` regular/medium/bold WOFF2 files. This is a deterministic readable local-script fallback, NOT typography-identical to Nastaliq and NOT postal-authority acceptance. Browser screenshot/readability evidence and the exact substitution are recorded; an official Nastaliq match remains unresolved.
- Only synthetic no-PII records are used in browser proofs. No label data, customer fields, addresses, tracking, declared value, COD, commission, dates, offices, postcodes, identity values or signatures are injected. Those postal roles/semantics remain unresolved. Imported name/address/phone/tracking are explicitly tested absent from both form documents. Stamps and signature/manual areas remain source artwork and blank.
- No duplex rotation is applied. A renderer-only back preview rotation option can draw a per-half 180-degree visual for diagnostics, but the UI uses `none` and marks physical rotation unapproved. The I2 view has no print/PDF/download button or `window.print` call.

## Optional Sender CNIC

- Input exists only within the separate `MO Print` sender-details section.
- Blank (also whitespace-only) is optional and inserts no CNIC node, preserving the source blank line.
- Accepted values are exactly 13 ASCII digits, either plain or `5-7-1` hyphenated. The source string remains in volatile view-module state only. The sender line displays canonical `XXXXX-XXXXXXX-X`, preserving leading zeroes.
- Invalid nonblank input displays an inline error, removes the paired preview, and cannot be emitted by the renderer. No number is generated.
- The renderer inserts escaped `textContent` only into the third line of the source sender block. It never inserts to recipient/remitter/payee, imports, Order, shared sender profile, label, barcode, URL, log, localStorage, sessionStorage, IndexedDB, monitor, API or network payload. Leaving the MO view or starting a new batch clears the volatile input.
- Test CNIC `0000012345678` is synthetic only. Browser tests inspect the existing label-reference IndexedDB store and browser storage for absence, check no request on input, and confirm reset after navigation.

## Decisions Still Open

- Actual official source revision and authoritative physical front/back order.
- Whether current declared `COD` and exact tracking are legally appropriate for any printed MO fields. They remain blank in I2.
- Sender/remitter/payee/addressee roles, required/manual blanks, article kind, CNIC role beyond the specifically approved sender CNIC position, office/date/postcode sources, relationship/income/reason and legal copy/tariff validity.
- Source-faithful Nastaliq font availability/licensing and official minimum readability/stamp/writing clearance.
- Physical duplex, driver, turn edge, sheet registration and print acceptance. No physical printer action was performed.
- LP-041 authenticated Dashboard/Access, served assets, live import/print/PDF and audit-chain acceptance. No Chrome DevTools MCP actions were exposed; local browser tests used the isolated headless Chromium harness, not staging.

## I2 Local Evidence

- `npm.cmd test -- --run tests/mo-render.test.ts`: 9/9 CNIC and geometry tests PASS. `npm.cmd test`: 121/121 across 7 files PASS.
- `npm.cmd run build`: application TypeScript, Worker TypeScript and Vite production bundle PASS. Bundle uses locally bundled 400/500/700 Arabic WOFF2 subsets; no Google font request.
- Full `npm.cmd run test:browser`: original label/PDF regression PASS, zero `pageerror`s, barcode decode counts `[3,18,500,500]`, one-page and 28-page A4/custom PDFs, plus synthetic actual-art previews at N=2/3/5/100.
- Visual proof screenshots were written only to `D:\Temp\kilo\gfs-lp044-evidence\`: `mo51-proof-n2-sheet1-cnic-synthetic.png`, `mo51-proof-n3-sheet1.png`, `mo51-proof-n3-sheet2-odd-blank.png`, `mo51-proof-n5-sheet1.png`, `mo51-proof-n5-sheet3-odd-blank.png`, `mo51-proof-n100-sheet1.png`, `mo51-proof-n100-sheet50.png`. N=3/5 show a completely blank right half on both faces. N=100 first/last verify 1/51 and 50/100 on matching faces. Screenshots contain only synthetic rows and synthetic Sender CNIC.
- Browser assertions across all proof counts verified landscape dimensions 297 x 210 mm, two 148.5 x 210 mm slots, uniformly fitted source pages no wider than 148.5 mm and exactly 210 mm high, zero template descendant bounds outside either artboard, stamp circles/boxes within page bounds, local Urdu font check, and minimum effective source text size at least 6.4 pt after fit (the 8 px Urdu logo was enlarged to 9 px only in the isolated clone). The source itself remains unchanged.
- Synthetic browser checks verified bare/hyphenated/blank/invalid CNIC behavior, leading zero/canonical form, CNIC only in the sender identity line, no order name/address/phone/tracking in either template, no localStorage/sessionStorage/IndexedDB occurrence, no request generated by CNIC input, and clearing on navigation. The I2 screenshot label called the sender face “back”; LP-046 corrects that face label to front/section 1.
- Repair history: initial integration exposed a form-anchor selector mismatch; changed to the source sender label width and its third ruled sender line. Browser testing then identified a test locator ambiguity for two forms per face and a sheet selector label/value mismatch; corrected the test selector to sheet label 50. Visual review identified 8 px source Urdu logo text as too small; raised only that clone-local text to 9 px and retested. Final full browser suite passes.
- All screenshots/fixtures were isolated under the approved temporary directory to preserve pre-existing dirty project evidence. No screenshot, local preview, or software gate proves official postal approval, exact Nastaliq fidelity, staging/Access/audit acceptance, printer calibration, payment or a completed print.

## GFS-LP-046 Authoritative Face-Mapping Correction

- The prior I2 assumption that source section 2 was front because it carried the title was reversed and is superseded. The owner confirms source section 1 is FRONT: Month Stamp, VPL/VPP, value area, sender/receiver and optional Sender CNIC. Source section 2 is BACK: M.O.-51 Revised, PAKISTAN MONEY ORDER, office, stamp and signature areas.
- Current renderer mapping and regenerated proofs follow this authority. Sender CNIC stays in section 1 only. The correction does not swap logical left/right record slots or imply physical duplex rotation; that remains uncalibrated.
