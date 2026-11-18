# MO-51 Field Register / GFS-LP-047

Status checked 2026-11-18: source roles remain unverified. This register distinguishes label-domain candidates from verified MO-51 mappings. Selecting a candidate in MO Print is an explicit, volatile user confirmation only; it does not make that mapping official or satisfy unknown mandatory-field policy.

## Official Source Evidence

- Pakistan Post Value Payable Letter: <https://www.pakpost.gov.pk/value_payable_letter.php>. Page describes VPL service and lists charges effective 2026-10-01. It does not map MO-51 sender/receiver or money-order remitter/payee fields.
- Pakistan Post Value Payable Parcel: <https://www.pakpost.gov.pk/value_payable_parcel.php>. Page lists the VPP postage, registration and VP fee schedule effective 2026-10-01. Fees do not establish which amount belongs in MO-51 “For Rs.” and do not authorize adding label commission.
- Pakistan Post Value Payable Post overview: <https://www.pakpost.gov.pk/value_payable.php>. It says a person pays for articles sent to them at receipt and traders recover supplied article value through the Post Office. This establishes article-side service mechanics only, not MO-51 party roles or amount-field semantics.
- Pakistan Post Postal Forms index: <https://www.pakpost.gov.pk/postal_forms.php>. The inspected public list did not expose MO-51 or an authoritative completed/blank MO-51 scan.
- Pakistan Post Office Manuals index: <https://www.pakpost.gov.pk/office_manuals.php>. It links several 94-133 MB ZIP archives hosted on Google Drive. Fetch returned a large-file virus-scan warning; those archives were not downloaded/opened. No manual role/requiredness rule is claimed from them.
- The only form artifact actually inspected is the supplied blank `MO 51/VP_Money_Order_Form_A5.html` (322 lines). It is 148 x 220 mm, has no semantic fill controls, and does not specify legal role mapping, mandatory-vs-manual policy, or a revision date.

## Source Contract

The existing I1 snapshot exposes: `tracking` (exact imported string), `cod` (source amount string), `name`, `address`, `sourceAddress`, `phone`, `city`, `province`, `landmark`, `senderName`, `senderAddress`, `product`, `email`, `facebookName`, `orderId`, `rowNumber`, and warning data. Existing I1 validation calls the centralized VPL/VPP declared-amount parser (positive whole rupees, current application limit Rs.100,000) and calculates a separate label-only commission. `sourceAddress` is the original address provenance; `address` is the normalized label display value. Sender defaults such as “Garden Shop” / “C/o City Post Office, Sahiwal” are label defaults, not verified legal MO identities.

No workbook/order fields exist for MO number, office/postcode, issue/article/journal/declaration/payment dates, other CNICs, relationship, income source, remittance reason, article kind, amount-in-words, stamps, signatures or witness/clerk data.

## All 48 Template Fields

`BLANK/MANUAL` means the app leaves the original field untouched; staff/postal completion may be needed, but the app cannot assert its legal requiredness. `CANDIDATE` means only an explicit MO-session selection can put that value into a visible, watermarked draft. Nothing in this table is an implicit mapping.

The B/F identifiers preserve LP-042's inventory names, not the corrected face names: **B01-B36 belong to original HTML section 1 / LP-046 FRONT**, and **F01-F12 belong to original HTML section 2 / LP-046 BACK**.

| ID | Printed field/area | Existing source candidate | LP-047 status and safeguard |
|---|---|---|---|
| B01 | Month stamp | None | BLANK/MANUAL; postal stamp only. |
| B02 | Oblong MO stamp on issue | None | BLANK/MANUAL; postal stamp only. |
| B03 | VPL/VPP selector | Existing tracking-prefix classifier | Classification is verified for filtering only; UI shows service prefix, but no postal selector is auto-marked. |
| B04 | M.O. number | None | BLANK/MANUAL; never use `orderId`, `rowNumber`, FS reference or generated counter. |
| B05 | MO date | None | BLANK/MANUAL; never use import/print/current date. |
| B06 | `For / Rs.` | Validated declared principal candidate from `cod` | CANDIDATE only after explicit per-record selection; no commission/fee is added. MO field semantics remain unverified. |
| B07 | No. of V.P. Article | Exact `tracking` candidate | CANDIDATE only after explicit selection; preserve exact string. No normalization and no Order ID substitution. |
| B08 | Amount in words | None | BLANK/MANUAL; no language or legal number wording inferred. |
| B09 | Letter/parcel | None | BLANK/MANUAL; product text and VPL/VPP prefix do not establish article kind. |
| B10 | Remittance rupees/paisa | `cod` amount is only a candidate principal | BLANK unless explicitly selected into B06 draft; remittance/receiver semantics and paisa policy unresolved. |
| B11 | Remittance in words | None | BLANK/MANUAL; no automatic amount-in-words conversion. |
| B12 | Sender name | `senderName` candidate | CANDIDATE only via explicit form-sender party selection. Sender defaults are visibly identified as unverified label-profile values. |
| B13 | Sender full address | `senderAddress` candidate | CANDIDATE only via explicit form-sender selection; do not equate to remitter/payee/office. |
| B14 | Sender telephone | No sender phone in import contract | BLANK unless manually entered in MO session or a user selects the article-receiver phone as form-sender source. |
| B15 | Sender CNIC | Dedicated MO-session input only | Optional, 13 digits with optional 5-7-1 hyphens; blank is allowed; never copied to another party. |
| B16 | Sender relationship/connection | None | BLANK/MANUAL; never inferred. |
| B17 | Sender source of income | None | BLANK/MANUAL; never inferred from order/product. |
| B18 | Reason for remittance | None | BLANK/MANUAL; fixed article declaration is not proof of demand. |
| B19 | Unlabelled six cells after sender | None | BLANK; do not assume postcode or pad digits. |
| B20 | Recipient name | `name` / `senderName` candidates | CANDIDATE only after explicit per-record party-source choice; article receiver is not automatically MO payee/recipient. |
| B21 | Recipient full address | `address` and original `sourceAddress`; `senderAddress` alternative | CANDIDATE only after explicit party-source choice. Candidate display shows original address provenance when it differs. |
| B22 | Recipient phone | `phone` candidate | CANDIDATE only after explicit party-source choice. |
| B23 | Recipient CNIC | None | BLANK/MANUAL; sender CNIC is never copied. |
| B24 | Recipient relationship | None | BLANK/MANUAL; never inferred. |
| B25 | Unlabelled six cells after recipient | None | BLANK; do not assume postcode or pad digits. |
| B26 | Sender declaration date | None | BLANK/MANUAL; no current/import date substitution. |
| B27 | Sender signature | None | BLANK/MANUAL; handwritten signature only. |
| B28 | Intimation rupees/paisa | None/amount candidate only | BLANK/MANUAL; not duplicated from B06 without authoritative semantics. |
| B29 | Issuing office name | None | BLANK/MANUAL; never infer from merchant/city/address. |
| B30 | Issuing-office postcode | None | BLANK/MANUAL; no six-digit padding. |
| B31 | VP article kind | None | BLANK/MANUAL; letter/parcel/packet selector and footnote differ. |
| B32 | Article/intimation date | None | BLANK/MANUAL; distinct operation date unavailable. |
| B33 | Article/item number | Exact `tracking` candidate | CANDIDATE only after explicit selection of the B07-compatible value; no Order ID substitution. |
| B34 | “In the name of” addressee | `name` / `senderName` candidates | CANDIDATE only after explicit choice; addressee/payee equivalence unresolved. |
| B35 | Destination postcode | None | BLANK/MANUAL; city/province are not postcodes. |
| B36 | Issue-office date stamp | None | BLANK/MANUAL; postal stamp only. |
| F01 | Paying post-office name | None | BLANK/MANUAL; no office source. |
| F02 | VP delivery-office name | None | BLANK/MANUAL; customer city is not a verified delivery office. |
| F03 | VP journal-entry date | None | BLANK/MANUAL; postal journal operation. |
| F04 | Witness signature | None | BLANK/MANUAL; human witness only. |
| F05 | Registration/parcel clerk initials | None | BLANK/MANUAL; postal clerk only. |
| F06 | Receipt acknowledgement text | Fixed template text | Retain source artwork; it is not evidence of payment. |
| F07 | Thumb impression | None | BLANK/MANUAL; actual human impression only. |
| F08 | VP sender/payee signature in ink | None | BLANK/MANUAL; role/caption unresolved; no digital signature. |
| F09 | “I paid” text | Fixed template text | Retain source artwork; it is not an app payment state. |
| F10 | Paying official signature/date/designation | None | BLANK/MANUAL; official action only. |
| F11 | Round authorizing MO stamp | None | BLANK/MANUAL; preserve stamp area. |
| F12 | Oblong payment stamp | None | BLANK/MANUAL; preserve stamp area. |

## Output Gate

- All mappings default blank. Source-choice buttons explicitly confirm a candidate for this MO session; manual text stays pending until the user confirms it. Neither is a verified Pakistan Post mapping. Injected candidate/manual text is tagged with provenance and the affected form receives a visible `USER-CONFIRMED DRAFT · NOT POSTAL VERIFIED` mark.
- Populated DRAFT PDFs are not completed-order exports. Remaining mandatory status is unknown and displayed; the UI explicitly states there is no completed official order export. The separate blank manual-completion PDF ignores all mapping selections and includes only optional Sender CNIC.
- The validated `cod` principal candidate is numerically distinct from label commission. User must explicitly choose whether that principal is intended for MO `For / Rs.`. Amount in words, remittance amount repetitions and fees are not generated.
- Text is never silently truncated. Any mapped value exceeding its writing line fails the preview fit check and blocks DRAFT PDF export; the user can shorten/clear the session value. The blank manual PDF remains available.
- All mapping state is an in-memory `Map` and is cleared on leaving MO Print or starting a new batch. No new import/Order field, persistence, API, Worker, monitoring, analytics or label change is introduced.
