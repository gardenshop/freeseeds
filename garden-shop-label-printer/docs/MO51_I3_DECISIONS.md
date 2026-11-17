# GFS-LP-045: MO-51 I3 PDF Packet

Status: local blank manual-completion PDF packet only. Not an official completed money order, staging acceptance, postal/legal approval, printer calibration, or deployment.

## Data Gate and Field Evidence

- The only supplied postal artifact is `MO 51/VP_Money_Order_Form_A5.html`: 322 lines, two unlabelled sides, no fillable fields, no scan/official PDF, and a remote Nastaliq font reference. Its `@page` dimension is 148 x 220 mm despite its A5 title.
- LP-042 inventory maps 48 printed/blank/manual areas. That inventory is useful for field protection, but it does not establish authoritative party roles, legal requiredness, current revision/tariffs, or which blanks may be completed from a parcel label.
- LP-043/044 deliberately did not map parcel `name`/`address`/`phone`, `tracking`, or `cod` into MO sender/recipient/remitter/payee/office/amount fields. The inspected source files still do not authorize those mappings. I3 therefore does not transfer those imported values to any form field and does not claim one PDF form is associated with one order.
- VPL/VPP validated rows determine blank-copy quantity only. RGL/UMS/unknown/duplicate/invalid rows stay excluded per I1. Commission and declared amount remain untouched and neither is printed.
- The Sender CNIC is the one separately approved optional field. Blank remains blank; invalid nonblank input blocks export; a valid supplied value is rendered only in the MO sender identity position. The raster is embedded in an explicitly user-requested local download; it is absent from metadata, searchable PDF text, logs, network requests, analytics and app-managed storage.
- The packet/export UI explicitly names the missing/unresolved fields: MO number/date, article number/type, amount figures/words; remitter/payee/addressee identity/name/address/telephone; other CNICs/relationships/income/reason; issuing/delivery/paying office, postcode and operational dates; stamps, witness/clerk, thumb impression, signatures and payment fields. Their required/manual status is not inferred.

## PDF Design

- `src/mo/pdf.ts` uses the I1 frozen eligible sequence and imposition, and obtains every face from I2 `renderMoPreviewDocuments()`. No second form layout implementation exists.
- Each landscape page has MediaBox 297 x 210 mm = approximately 841.8898 x 595.2756 pt, `Rotate=0`. Pages are appended front then back for every cut-and-stack sheet. Count is `2*ceil(N/2)`. For N=100, sheet 1 is slots 1/51 and the last is 50/100. Odd final right halves are full-page white on both faces.
- I2's scriptless same-origin form preview is rasterized locally by bundled `html2canvas` at 300-DPI target, yielding 3507 x 2480 pixels (approximately 299.9 DPI due integer pixel bounds), then embedded as PNG in `pdf-lib`. Same visible artwork/fonts/rotation option are reused; no Google font or runtime external resource is fetched. PDF faces are image-only, so Urdu shaping matches the preview pixels but text is not selectable/searchable.
- Current fields are identical across candidate copies except the shared optional CNIC; at most four visual assets are cached (front/back with full/odd-right-empty layout). Candidate identifiers are not drawn. The PDF `Title`/`Subject` and filename identify blank manual-completion forms; no CNIC or order values enter PDF metadata.
- Page progress yields to the UI. Cancel/error aborts before download, removes temporary iframes, zeroes canvas backing dimensions, and emits no PDF. Successful object URLs are revoked after download handoff. No monitoring/audit event or storage write occurs.
- A back-preview/PDF option supports upright (default) or rotating each back form 180 degrees independently. Both options are marked UNVERIFIED. PDF page rotation remains zero, records retain their slots, and the renderer assumes no universal physical driver orientation.

## Verification Record

- Targeted PDF contract tests cover A4 point geometry, 300-DPI target, empty-candidate rejection, invalid CNIC rejection and pre-cancel abort.
- Final local unit suite: 125/125 PASS across 8 files.
- Final production build: application TypeScript, Worker TypeScript and Vite PASS. `html2canvas` is a runtime dependency imported only by the MO PDF chunk; `pdf-lib` is likewise used only by MO export. `npm audit --omit=dev`: zero production advisories. Full `npm audit` still reports five high advisories in the existing dev chain `Vite/Vitest -> fdir/tinyglobby -> picomatch`; npm's suggested fix forces a Vite 6.2 downgrade, so no unrelated dev/toolchain changes were made.
- Full `npm.cmd run test:browser`: original label regression PASS with zero browser errors, barcode decodes `[3,18,500,500]`, 1-page and 28-page A4/custom label PDFs. I3 generated PDFs for N=1,2,3,5,50,99,100,101 and a mixed VPL/VPP/RGL/UMS batch; all page counts and A4 MediaBoxes passed. PDF.js raster checks confirmed odd blank-right regions on both final pages, N=100 first/final preview parity and PDF/preview image difference below the test ceiling. Cancellation produced no download and left no temporary rasterizer frame.
- The I2 Sender CNIC browser tests remain in the same suite: blank/valid/invalid, leading zeroes/canonical form, no app storage or request, no recipient/front-face copy, and session reset. N=2 PDF is image-only (`pdf.js` text extraction empty) and its rendered back matches the sender-CNIC preview.
- Repair history: fixed an ArrayBuffer/Blob typing error; initial SVG `foreignObject` rasterization tainted canvas and was replaced by DOM-to-canvas `html2canvas`; fixed a temporary iframe initial-blank `load` race; aligned integer raster bounds with html2canvas's floor behavior; changed browser helpers to surface export failures promptly; preserved all original label assertions. Final full regression passed after fixes.
- Evidence PDFs/screenshots were written only below `D:\Temp\kilo\gfs-lp045-tmp` and `D:\Temp\kilo\gfs-lp045-evidence`; no generated PDF/test output was added to the repository. Tests used synthetic rows and CNIC only.

## Unresolved and Rollback

- The source does not identify official form revision, physical front/back order, approved party mappings, amount/remittance semantics, article kind, mandatory-vs-manual field policy, legal Urdu text/tariff validity, or the local Naskh-versus-original-Nastaliq fidelity. I3 outputs deliberately blank manual-completion forms and makes no completed-record, postal, legal or financial claim.
- Physical duplex flip/registration, stamp/handwriting comfort, actual paper/driver behavior and delivery-office requirements are unverified. Per-face rotation is configurable only as an unverified visual choice.
- LP-041 authenticated Dashboard account/active Pages/access policy, served asset, live import/print/PDF, `PDF_GENERATED`, audit-chain `VERIFIED`, remote audit acceptance and physical printer acceptance remain unresolved. No browser MCP action was available, and no staging/Access bypass was used.
- Local rollback: disable/remove only the MO PDF download control and `src/mo/pdf.ts` dependency path or revert the I3 commit. No database, audit or reference cleanup is required. Do not modify existing label print/PDF code. A previously downloaded file remains under user control; do not attempt silent deletion or remote recall. No Cloudflare/Meta/API/Admin/WhatsApp/COD/payment/Worker/D1/Access/production mutation occurred.
