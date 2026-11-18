# GFS-LP-043: MO-51 I1 Core Decisions

Status: I1 local core only. Not an official MO form, renderer, PDF, UI, staging, or operational acceptance.

## Boundaries

- I1 adds only `src/mo/adapter.ts`, `src/mo/imposition.ts`, and `tests/mo-core.test.ts`.
- It does not import into or mutate `Order`, alter label/import/barcode/print/PDF logic, generate FS references, call Admin/API/monitoring, persist supplements, or apply duplex rotation.
- `projectMoRecords()` traverses the original imported array and uses the optional selection set as membership only. Returned candidate/exclusion sequences therefore stay in source order regardless of selection-set insertion order. Tracking duplicates are detected across all imported rows, including unselected rows.
- The result keeps the original `sourceRecord` object identity and original tracking/amount strings alongside separate normalized tracking and parsed rupee values. Wrapper results are frozen; source records/supplements are neither frozen nor modified.
- Each projected row also carries a frozen value snapshot (including a copied/frozen warnings array) so later reads can remain stable if the original mutable `Order` changes. `sourceRecord` is identity-only; later I1 consumers should use the snapshot and the explicitly named raw/derived candidate fields.
- Imposition sorts a copied eligible list by original `sourceIndex`, rejects duplicate/invalid source indices, and uses `S=ceil(N/2)`, L=i, R=i+S if available. Each sheet has logical `front`/`back` slots referencing the same records. It makes no claim about face order, flip edge, mirror, or rotation. Odd right slots are null on both logical sides.
- Commission is separately named `labelCommissionRupees`; the candidate principal is the existing validated `declaredAmount`. `sourceAmount` is preserved. No MO tariff, words conversion, amount rewrite, or MO output is implemented.
- The tracking identifier grammar beyond existing prefix/whitespace/case classification is unknown. I1 uses the existing classifier and duplicate normalization; it rejects missing/non-string values and unknown prefixes but does not invent a tracking regex. A prefix-only string inherits existing classifier semantics and is not independently declared a valid postal article number.
- RGL/UMS are excluded; VPL/VPP only can become I1 candidates. Existing `calculateCommission()` remains the single positive whole-rupee 1..100,000 amount validator. Invalid amounts fail closed without changing `Order.cod`.
- `requiredFields` is a mandatory option. Only the caller-supplied explicit required field list is enforced against ephemeral `supplements`; no legal/postal requiredness is guessed. The default export/UI is absent, and an empty explicit required list does not mean an official form is complete.
- Required-field inventory is kept explicit: article kind; remitter name/address/phone/CNIC/relationship; source of income; remittance reason; payee name/address/phone/CNIC/relationship; money-order number/date; declaration date; issuing-office name/postcode; destination postcode; paying-office name; delivery-office name; journal-entry date; article date.

## Unresolved and Carried Forward

- Official template identity/revision, front/back side order, party roles and required-vs-manual postal fields remain unresolved.
- Declared amount's authoritative placement in postal MO-51 remains unverified. I1 only preserves the existing label declared amount as a candidate principal and never adds commission.
- Postcodes, money-order number, office names, dates, CNIC, article kind, relationship/income/reason and handwritten/stamp marks are not derived or invented.
- The 148 x 220 mm HTML versus 148.5 x 210 mm form-area sizing, font/readability/stamp clearance and any physical duplex rotation remain unapproved. Short-edge swapped-slot mode conflicts with odd right-half blank on both PDF pages and is not represented.
- LP-041 authenticated staging/account/Access/served asset/import/PDF/audit-chain acceptance and physical calibration remain unresolved. No browser or remote action was required or attempted for I1.
- Preserve the new-number WhatsApp lock, Hoja Seeds zero-connection rule, and all Admin/API/COD/payment/Meta/D1/Access/production boundaries.

## Local Verification Record

- Targeted MO suite: `npm.cmd test -- --run tests/mo-core.test.ts` -> **30/30 PASS**.
- Full unit regression: `npm.cmd test` -> **112/112 PASS** across 6 test files.
- Build: `npm.cmd run build` -> application TypeScript, Worker TypeScript and Vite production build **PASS**.
- Existing browser/PDF regression: `npm.cmd run test:browser` with `LP_TEST_EVIDENCE_DIR=D:\Temp\kilo\gfs-lp043-evidence` and `LP_TEST_TMP_DIR=D:\Temp\kilo\gfs-lp043-tmp` -> **PASS**, no browser errors; A4 geometry, `[3,18,500,500]` barcode decodes, RGL/UMS/VPL/VPP commission parity, 1-page sample and 28-page A4/custom batches passed. Evidence and fixtures were redirected out of the worktree to preserve pre-existing dirty screenshots.
- During the first targeted run, three test rows had incomplete expected-position tuples (N=1, 2, 5); corrected the test vectors and reran. Snapshot hardening and the explicit large-integer overflow case each received targeted and full unit reruns. Final build/browser gates above passed before the last test-only overflow fixture; no production source or existing label assertion changed in that follow-up. No production test assertion or existing label baseline was weakened or refreshed.
- Existing label source/output path comparison: no change in `src/main.ts`, `src/layout.ts`, `src/label.css`, `src/engine.ts`, `src/types.ts`, or `src/tracking-rules.ts`. No package, app integration, Worker, print/PDF, import, monitoring, or external resource change.
- Local regressions do not prove MO-51 official field semantics, Urdu rendering, staging/LP-041 acceptance, physical duplex behavior, postal/payment acceptance, or deployment.

## GFS-LP-046 Authoritative Face-Mapping Addendum

- The owner correction supersedes I1's then-unresolved source-face ordering: uploaded HTML section 1 is FRONT (Month Stamp, VPL/VPP, amount, sender/receiver details and intimation); section 2 is BACK (M.O.-51 Revised title, PAKISTAN MONEY ORDER, postal office, stamps and signatures).
- This is a face-content mapping only. I1 left/right slot pairing, selected order, cut-and-stack, and odd blank-half rules do not change. No physical duplex edge, mirror, or 180-degree turn is approved by this correction.
