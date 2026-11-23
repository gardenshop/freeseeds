# GFS-LP-063 — Final MO print unblock

## Preflight and release baseline

- Initial repo root `D:\free seeds`, branch `codex/garden-shop-label-printer-mvp`, HEAD/remote `98241c073a6ee2b6a75f6be707fc1c5bb5c082c6`. Preserve the **51** unrelated pending paths (25 modified tracked + 26 untracked); do not clean, reset, stash, or stage them.
- Dashboard confirmed Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, project `garden-shop-label-printer-staging`, active successful deployment `5fc8e73c-cd12-4cff-bd52-d94e25ed1f5a`, and successful rollback candidate `0efcbfc6-1de1-43a1-8aff-01b460f3c4d1`. The current active assets predate the LP-063 working-tree refinements.
- The build uses Dashboard-listed staging origins `https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev` and `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/`; the current local `dist/` contains static files only. The refreshed bundle is locally built but has not yet been deployed.

## Saved-layout diagnosis and approved repair

- A fresh same-profile staging tab was structurally empty before a synthetic N100 import. Its `gfs-mo51-layout-v1` contained **17 layout definitions and no customer-value fields**. No existing shared populated tab was opened; no row values or CNIC were inspected.
- The saved definitions show the real blockers: Tracking crosses its printed label; declared principal is 27 pt bold in a small field; Sender/Receiver names and address/contact/City/Province fields have stale geometry; lower Intimation amount/date/tracking/name/contact rectangles intersect.
- LP-063’s Repair proposal preserves IDs, sources, custom fields, Bold and values. It previews readable font-size changes (before/after), moves `sourceAmount` to the separate lower Price Payable line, keeps declared principal separate, and checks every selected record/face. Nothing is stored until Apply.
- One field is not safely auto-repairable: the saved lower-Intimation SenderName duplicate overlaps protected stamp artwork while the SenderName source is already mapped in the lower Sender block. Repair leaves it unchanged, identifies it and exposes a direct-select control; **no removal/rebind was made to the actual saved staging layout**. An owner-selected direct correction is needed before that exact saved layout can pass.

## Local verification

- Unit suite: **153/153 pass**; focused MO layout/render/PDF suite: **22/22 pass**; staging-configured TypeScript/Worker/Vite build: **PASS**.
- `npm run test:mo-repair`: **PASS** on a synthetic copy of all 17 saved field definitions. It first observed blockers and unchanged storage during the proposal; the fixture then explicitly removed only its duplicate lower Intimation SenderName field, while retaining the primary lower-Sender binding. All 100 selected records then passed across 50 sheets / 100 front/back face documents.
- The resulting synthetic N100 download is a 100-page A4-landscape PDF. First/front 1/51 and final/front 50/100 rasters were visually checked. Print MO Batch opened the generated `blob:` `application/pdf`; the popup PDF parsed as 100 pages, the print call followed verification, the URL remained readable after close, and cleanup was bounded to 30 minutes. This direct removal happened **only in the synthetic test fixture**, not the owner’s saved layout.
- Full browser/label/PDF suite: **PASS**, `browserErrors: []`; N42 pairs 1/22 through 21/42, N100 pairs 1/51 and 50/100, and N500 pairs 1/251, 125/375, 250/500. N500 was 500 pages / 1,725,189 bytes / 71,307 ms; barcode decode counts 3/18/500/500. Evidence was stored under `C:\Users\nazim\AppData\Local\Temp\kilo\lp063-exact17-final` and `...\lp063-final3-browser`; tracked baselines were not overwritten.

## Live acceptance and blockers

- The new static upload is not yet performed. The staged bundle currently remains deployment `5fc8e73c-cd12-4cff-bd52-d94e25ed1f5a`; rollback `0efcbfc6-1de1-43a1-8aff-01b460f3c4d1` remains available. Do not claim the refreshed LP-063 bundle is live until the next deployment is confirmed in Dashboard and its JS/CSS markers are served.
- The fresh same-profile staging app POST to Monitor `/api/events` redirected to Cloudflare Access and the browser CSP blocked that redirect. No credentials/cookies were extracted, no Access policy changed, and no Worker/D1 changed. If the Monitor Access session is required for the live output gate, request the authorized owner login in that same profile.
- Before applying to the actual saved layout, resolve the lower-Intimation SenderName duplicate via the direct correction control or an owner-approved printable slot. Until then, mapped output must remain blocked for that layout. The separate Monitor `PDF_GENERATED` HTTP 400 remains a Worker-contract issue; do not spoof a template version or change Worker/D1.
- No physical printer/duplex or postal acceptance was performed. No WhatsApp, Admin/API, COD/payment, Meta or production-routing changes were made. Hoja Seeds remains unconnected.
