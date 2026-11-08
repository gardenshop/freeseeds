# Garden Shop Label Printer: Architecture and Implementation Plan

Last reviewed: 2026-11-08

## Purpose and Safety Boundary

Build an independent label-preparation and print application for Garden Shop staff. It imports customer-provided workbooks in the browser, keeps customer rows in browser memory, and submits only aggregate activity/error metadata to a separately hosted monitoring service. It is not an order, payment, dispatch, WhatsApp, or CRM system. No code in the existing production applications, Workers, D1 databases, or deployment configurations is to be changed by this project.

## Existing Architecture Findings

- This repository is not empty: it is the Get Free Seeds TypeScript monorepo, with `apps/api`, `apps/admin`, `packages/core`, `migrations`, and a root npm workspace-like package. The root package defines Hono/TypeScript/Vitest/Wrangler and production commands.
- Existing API Workers support public WhatsApp callbacks and bind the shared `getfreeseeds-staging` D1, receipts R2, and event queue. Their configuration is not an appropriate label service boundary.
- Existing Admin Workers use Cloudflare Access, signed Access JWT validation in the isolated V2 path, an Admin email check, CSRF protections for mutations, shared/isolated D1 and private receipt R2. The verified local implementation checks JWT signature, issuer, expiration, key ID and email. A request header alone is not trusted in the signed V2 path.
- Existing production Admin has operational shipping-label HTML for eligible individual orders, as well as order/payment/fulfillment logic. That output is not the requested spreadsheet-based A4 label app and must not be refactored or extended here.
- Existing root, production and V2 Worker configurations and databases are distinct but bound to operational Get Free Seeds data. They are explicitly excluded from this application. No historical 15-order fixture was located or opened; protected `images/` and unrelated fixtures were not used.
- Existing repository rules require preservation of the new-number WhatsApp lock, zero Hoja Seeds runtime connection, no secret/customer data in source/logs, and identity verification before every external mutation. This implementation makes no external mutation, account operation, resource creation or deployment.
- Existing worktree has pre-existing production/docs modifications and private/unrelated untracked files. They are preserved and excluded from the Label Printer branch/commit.

## Recommended Standalone Architecture

### New structure

`garden-shop-label-printer/`

- `index.html`, `src/`, `public/`: Vite + TypeScript staff/admin UI and local processing engine.
- `worker/`: separate Cloudflare Worker for authenticated audit event ingestion and Super Admin reports.
- `migrations/`: standalone label-audit D1 schema, never applied to any existing database.
- `wrangler.jsonc`: placeholder binding for a new, dedicated database; deployment is blocked until separately provisioned/authorized.
- `tests/`: unit tests for parsing, normalization, sheet pagination, event privacy and authorization.

### Stack

- Vite + TypeScript for a lightweight responsive single-page application without a larger framework dependency.
- `read-excel-file` for in-browser `.xlsx` reading (selected instead of the npm `xlsx` package because the latter has unresolved advisories); CSV is parsed locally with a standards-aware parser.
- `jsbarcode` for compact Code 128 rendering and `@zxing/library` for browser-side decode verification.
- `pdf-lib` for text/vector A4 PDFs with Code 128 bars drawn as vector rectangles from the shared barcode SVG and exact millimeter-derived page/label coordinates. Browser print and screen preview share one label HTML/CSS layout.
- Native Cloudflare Worker TypeScript + a small strict manual event schema + a new D1 binding for monitoring only. This avoids a framework for the narrow endpoint surface. The Worker accepts no workbook, address, phone, product/customer text, barcode payload, or label content.
- Cloudflare Access in front of the dedicated service, with server-side cryptographic validation of signed Access JWTs. Staff identity/role mapping is server configuration; Super Admin report access is separately allowlisted. Do not reuse the existing Admin as an auth proxy.

## User Workflow and Screens

1. **Upload:** choose `.xlsx`/`.csv`; download a blank template; load visibly synthetic sample records. The implementation reads the first worksheet and treats its first non-empty row as headers. Parsing and all customer data remain local.
2. **Column mapping:** map known headers (`Sr. no`, `Name`, `consigneeEmail`, `Cell #`, `Address`, `Facebook Name`, `COD`, `Product`) plus optional fields. Mapping preset is saved in local storage only. `Facebook Name` is not used as tracking unless the user explicitly maps it to Tracking Number.
3. **Review:** searchable/editable rows, selection, validation details and duplicates. Never infer an Order ID. Phone values are read as text and leading zeroes retained. Remove a phone fragment from the displayed address only on an exact token match; retain the imported source address in memory and show an explicit warning/editor restore option. Never rewrite destination/amount implicitly.
4. **Label Preview:** paginated 3×6 A4 sheet, zoom controls, selected label detail, and warnings. Every field remains editable in Review and preview.
5. **Print/Export:** all/selected labels, one label, starting position 1-18, count, PDF, browser print, and separate explicit staff confirmation of physical completion. Empty cells remain blank on the last page. Browser print requests and confirmations are distinct audit events.
6. **Super Admin:** restricted dashboard with period aggregates, print/reprint request/confirmed counts, staff activity, batches, warning/error counts and exportable privacy-safe CSV summary.

## Import, Mapping and Validation

- Accept `.xlsx` and `.csv`; check the file size before parsing and enforce a row limit after local parsing. Parse in browser memory; do not upload workbook content or persist rows by default.
- Match normalized headers case-insensitively against known aliases, but require user review of mapping. Mapping selections and presets stay in local storage; no row data goes into browser local/session storage.
- Preserve row provenance and original address before the permitted display-only exact contact removal. Store phone strings when supplied as text; if the spreadsheet cell is numeric, stringify it and warn staff to verify leading zeroes against the source.
- Recognize duplicate phones/tracking numbers and missing optional/order data as warnings. Do not synthesize missing Order IDs or tracking IDs.
- Escape text in rendered HTML and CSV export; prevent formula injection by prefixing cells whose first meaningful character is `=`, `+`, `-`, or `@` when exporting CSV.
- A label-generation event contains event type, pseudonymous staff ID, batch UUID, timestamp, template version, counts, and bounded error codes only. It never contains raw values or file names.

## Label Layout

- A4 portrait: 210 × 297 mm; 3 columns × 6 rows; 18 slots per page. Label boxes: 65 × 44 mm with shared, unit-tested geometry and PDF point conversion.
- Top block: Order ID and Product are separated inside one ruled block; VPL COD amount is on the right. Missing IDs are flagged, never invented.
- Middle block: exact mapped tracking value immediately above Code 128; destination city/province are prominent in the adjacent right block. Missing destination parts are flagged, never invented.
- Bordered `TO:` box uses bold receiver name, complete measured address, exact `Near by:` label and bold contact. Footer is exactly `From: Garden Shop | C/o City Post Office, Sahiwal, Punjab`.
- Dynamic measurement wraps against available box dimensions and reduces font size to configured readable floors. Overflow is a visible validation warning, never an ellipsis in source values; staff can edit or restore the source address. An individual-label print is also available.
- Barcode verification decodes every synthetic Code 128 in the 18/19/100/500 test sets and checks equality to its tracking source; browser smoke verifies every visible barcode on each rendered sheet.

## PDF and Physical Printing

- Build PDFs locally using 210×297 mm pages, vector text and vector Code 128 bars; page and label coordinates use the shared millimeter-to-point model and are unit-tested.
- Every output selection computes pages and starting slot deterministically; unfilled final slots are blank. Print settings disable headers/footers and set page scale to 100%; UI explains that printer-driver margins and hardware tolerances must be verified with a physical test sheet.
- Provide live in-app sheet preview and browser-print rendering. Do not claim physical accuracy until tested on the target printer and stock.

## Monitoring Service and Secure Integration Contract

- New Worker: authenticated endpoints only; Access JWT signature/issuer/audience/expiry validation with cached Access certs, explicit staff allowlist and distinct Super Admin allowlist. Fail closed when auth config/JWKS unavailable. Do not trust an email header by itself.
- New D1: append-only event rows with typed event allowlist, bounded aggregate counts, batch UUID, pseudonymous actor, timestamp and template version. Apply per-actor rate limits. Reject extra/unrecognized payload fields and any customer-like data. Enforce report endpoints as Super Admin only.
- Protect audit integrity using a serialized D1 write strategy and hash-linked event records (previous hash + canonical event hash); expose verification status in reports. Restrict database access to the Worker binding and retain a documented retention/export policy.
- Event submission failure is displayed as “monitoring unavailable”; it cannot discard or block locally generated labels. The client does not automatically retry events to avoid duplicate records without an idempotency contract. No customer fields are persisted for retry.
- Browser print is logged as `PRINT_REQUESTED`; a distinct user confirmation emits `PRINT_CONFIRMED`. Neither event represents printer telemetry or independently proven physical printing. Reprints are explicit and separately counted.
- **Integration contract:** standalone dashboard exposes a future signed-link/SSO or approved Access-protected navigation contract and read-only aggregate report endpoint. Existing Admin integration is a separate proposal only: add one link in the existing protected Admin navigation to the dedicated service. Do not proxy customer records or bind existing Admin D1. This repository implementation must not alter existing Admin. Required approvals: product owner/security approval of URL and staff role roster; Cloudflare account identity and isolated-resource/cost/quota preflight; explicit deployment approval; production smoke/rollback approval. Verify the visible Get Free Seeds account and record it immediately before each eventual dashboard mutation.

## Privacy, Security and Audit

- Local-only workbook parsing and document generation. No third-party telemetry, cloud workbook storage, remote fonts or external barcode service.
- Monitoring payload schemas reject direct identifiers and include no customer data; no raw addresses, contacts, rows, barcode values, spreadsheet names or PDF bytes are logged or persisted.
- Access JWT signatures, issuer, audience, validity interval and key ID are checked server-side. Role and staff mapping are allowlisted on Worker, with deny-by-default. Mutating authenticated events are rate-limited, schema-validated, size-limited, and append-only.
- Use strict CSP, no inline user-controlled HTML, output escaping, security headers, CSRF/same-origin controls for cookie-authenticated actions, and no secrets in Vite assets. Secrets are provisioned only as Worker secrets after approval.
- Audit export contains aggregate activity and pseudonymous actors only. Retention period, privacy notice and lawful staff identity mapping must be approved before deployment.
- No production database, production Worker, payment, WhatsApp, or existing Admin dependency. Hoja Seeds remains fully disconnected.

## Tests and Acceptance Criteria

- Unit coverage: headers/aliases, CSV quoting, spreadsheet-safe cell handling, text phones and leading zeros, safe address contact dedupe, explicit Facebook tracking mapping, no invented order ID, duplicates, COD values, field escaping, address wrapping/overflow, exact dimensions, page navigation/start positions, and event payload privacy.
- Synthetic batches of 18, 19, 100 and 500 orders; include long fields, missing IDs/phones, duplicate tracking, differing COD and products. Every row is accounted for and no item silently disappears.
- Barcode generated and decoded values match exactly. PDF page/media-box dimensions and label grid geometry are asserted programmatically.
- Worker tests: unauthenticated/malformed JWT rejection, staff report denial, Super Admin report access, forged headers rejection, overlarge/unknown/PII payload rejection, event rate limiting, distinct print/confirm/reprint event records, and audit-chain tamper detection. Wrangler local D1 migration plus synthetic insert/read passed; Worker authorization tests still use mocked D1.
- Browser verification covers CSV/XLSX upload, review/edit/preview, print/PDF, mobile layout, all visible barcode decodes, PDF raster comparison and safe print behavior. Screenshots and fixtures are synthetic only.
- Verify existing production files were not changed by this implementation. No physical printer test is claimed unless performed.

## Deployment and Rollback

- Local development only by default. Provision a separate Cloudflare Pages (or static Vite) project and a separately named Worker and D1 only after owner authorization, account/identity verification, billing/quota review and resource registry entry. Never point Wrangler at existing GFS Worker/D1 bindings or the prohibited Hoja account.
- Prepare a new database from only `garden-shop-label-printer/migrations`; do not apply migrations at repository root or to existing resources. Keep the report dashboard behind Access with independent roles.
- Deploy static UI and monitoring Worker as separate, versioned resources. Verify Access denial, staff workflow, Super Admin authorization, audit-chain status, aggregate-only payload, generated PDF geometry, and rollback version before any operational adoption.
- Rollback is a static site/Worker version rollback; do not drop D1 or erase append-only audit evidence automatically. Disable the integration link first if introduced later. No deployment was authorized or performed in this task.

## Phases and Completion Status

| Phase | Work | Status |
| --- | --- | --- |
| 1. Discovery and planning | Read all project rules and required architecture documents; inspect current Workers, bindings, authentication, labels and worktree isolation; save this plan | Complete |
| 2. Independent application | Scaffold isolated Vite/TypeScript staff app and separate monitoring Worker/D1 config | Complete locally |
| 3. Excel and label engine | XLSX/CSV import and mapping, Code 128 generation/decode, dynamic fit, shared A4 preview/print/vector PDF | Complete locally; first worksheet only |
| 4. Staff interface | Upload, review/edit, preview and print workflow | Complete locally; physical printer untested |
| 5. Monitoring | Independent protected dashboard, authenticated append-only event API and audit integrity | Worker/dashboard tests and local D1 smoke complete; no cloud resources deployed |
| 6. Testing | Synthetic-volume, actual XLSX, barcode, unit/security and browser/PDF checks | Complete locally; historical fixture/reference image unavailable |
| 7. Deployment readiness | Separate configuration, authorization gates, rollback and local run instructions | Prepared; deployment not authorized/performed |
