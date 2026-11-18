# GFS-LP-047: MO-51 Candidate Mapping Review

Status: per-row candidate review, user-confirmed DRAFT and blank manual-completion PDF only. No completed postal-order export, staging acceptance, or deployment.

## Authoritative Evidence

Read-only public evidence reviewed on 2026-11-18:

- Pakistan Post VPL tariff: <https://www.pakpost.gov.pk/value_payable_letter.php> describes VPL service/fees effective 2026-10-01; it does not define MO-51 party roles or amount field semantics.
- Pakistan Post VPP tariff: <https://www.pakpost.gov.pk/value_payable_parcel.php> describes postage, registration and VP fees; it does not authorize combining these with COD or MO principal.
- Pakistan Post Value Payable Post overview: <https://www.pakpost.gov.pk/value_payable.php> says the article recipient pays at delivery and traders recover the supplied article's value through the Post Office. This supports article-side service flow only, not MO-51 “sender/receiver” or remitter/payee roles.
- Pakistan Post Postal Forms index: <https://www.pakpost.gov.pk/postal_forms.php> did not expose a current MO-51 scan or completed example.
- Pakistan Post Office Manuals index: <https://www.pakpost.gov.pk/office_manuals.php> links 94-133 MB archives hosted on Drive. Webfetch returned large-file virus-scan warnings; archives were not downloaded or opened.
- The only MO-51 form inspected is the user-supplied blank `MO 51/VP_Money_Order_Form_A5.html`. It has no revision date, semantic field hooks or required-vs-manual policy.

Conclusion: no authoritative field-role/requiredness document was found. The exact missing evidence is a current official MO-51 revision or Post Office Manual instruction specifying remitter/payee/sender/receiver roles, MO `For Rs.` versus VPL/VPP value/fee semantics, field requiredness/manual completion, and applicable postal offices/dates/postcodes.

## Candidate Mapping Policy

- All mappings start blank; no imported value is auto-populated into the form. The I1 frozen snapshot is read-only and preserves source Order identity, exact tracking, source amount, current/normalized address provenance and default sender values.
- Per-row source choices are explicit user confirmations for this MO session only: exact tracking as V.P. article-number candidate; validated declared principal from `cod` (label commission remains separate); parcel sender/receiver name/address/phone candidates; or manual MO-session entries. These are not official postal mappings.
- UI shows parcel sender defaults as unverified; receiver address and original `sourceAddress` are distinct. `city`, `province`, `landmark`, email, Facebook name, product and order/FS identifiers are not silently composed into MO fields. FS Order ID is never offered as MO number.
- Manual article number is preserved as entered. Manual principal must be a positive safe whole-rupee digit/comma-grouped value. Amount-in-words is never synthesized. The current amount candidate is user-confirmed only, and no COD fee, postage, delivery fee or label commission is added.
- Sender CNIC remains the single explicitly approved optional identity field and is only inserted on section 1/front's sender CNIC line. It is not copied to other party fields and is not stored/transmitted/logged.
- Candidate choices/manual values live in volatile in-memory MO state only and reset on leaving MO Print or starting a new batch. No Order/import/shared-profile change, localStorage/sessionStorage/IndexedDB write, monitoring/audit event, API or Worker change is made.

## Output Gates

- The blank manual-completion PDF is a separate option and ignores every mapping. It remains usable even if a DRAFT candidate overflows.
- Any mapped/manual values appear in preview and a separate user-confirmed DRAFT PDF with a visible per-form `USER-CONFIRMED DRAFT · NOT POSTAL VERIFIED` mark and incomplete-order metadata. The product exposes no completed-order export while requiredness and legal roles remain unresolved. UI lists the missing/unknown postal fields.
- The article number is required before a draft containing any other mapped value, preserving a user-confirmed record reference. This is a UI consistency rule, not a postal-law claim.
- Text is measured in the actual loaded local-font form DOM. No auto-shrink/truncation; field-specific overflow blocks DRAFT PDF.

## Hoja Seeds Sample Request

The requested `Hoja Seeds 14-11-2026.xlsx` was not accessed. Inherited `D:\free seeds\rules.md` protected invariants prohibit using, importing or referencing Hoja Seeds data for this application. LP-047 unit/browser fixtures use only synthetic records and synthetic identity text.

## Rollback

- Disable LP-047 by removing only the MO candidate-review controls and user-confirmed DRAFT action; retain the I1/I2 core, corrected LP-046 face mapping and I3 blank manual-completion PDF. Reverting only the LP-047 commit requires no database or storage cleanup.
- Files explicitly downloaded by a user are outside app control; do not silently delete, mutate, transmit or recall them. LP-041 staging/audit/Access and physical duplex gates remain separate.

## Remaining Blockers

- No official MO-51 party-role/requiredness/amount-mapping evidence. A user selection is not equivalent to official verification.
- M.O. number, article kind, amount-in-words, additional CNICs, relations/income/reason, offices/postcodes/dates, stamps/signatures and witness/clerk/payment fields remain blank/manual.
- Original form revision and Nastaliq fidelity are unapproved; physical duplex calibration remains undone.
- LP-041 authenticated staging account/Access, served assets, PDF_GENERATED, audit-chain VERIFIED, remote audit and physical printer acceptance remain unresolved. No deployment occurred.

## Local Verification Record

- `npm.cmd test`: **132/132 PASS** across 9 files, including MO mapping provenance, exact tracking, commission separation, manual amount validation, candidate immutability and CNIC tests.
- `npm.cmd run build`: application TypeScript, Worker TypeScript and Vite production build **PASS**. `npm.cmd audit --omit=dev`: zero production advisories.
- Full `npm.cmd run test:browser`: **PASS**, zero browser errors. Existing labels retain `[3,18,500,500]` barcode decode counts, A4/custom geometries and 28-page PDFs. MO checks exercise VPL/VPP/RGL/UMS, N=1/2/3/5/50/99/100/101, face-content assertions, optional sender CNIC, mapped/blank PDFs, Arabic manual text, provenance, no request/storage leakage, and long-address no-truncation blocking.
- Synthetic user-confirmed DRAFT front/back preview and actual PDF raster evidence: `D:\Temp\kilo\gfs-lp047-evidence\mo51-lp047-populated-draft-preview-front-synthetic.png`, `mo51-lp047-populated-draft-preview-back-synthetic.png`, `mo51-lp047-populated-draft-pdf-page1-front-synthetic.png`, `mo51-lp047-populated-draft-pdf-page2-back-synthetic.png`. PDF rasters are compared to the same mapped preview; the blank manual packet after mapping is pixel-equal to the original unmapped blank packet.
- A mixed populated/unmapped N=101 DRAFT produced 102 PDF pages; the final odd right half remained blank on both last faces. Cancellation produced no download and temporary rasterizer frames were removed.
- All import rows and manual Urdu/name/address values in tests are synthetic. The protected Hoja Seeds workbook was not opened; its use is blocked by inherited project policy.
