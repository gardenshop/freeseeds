# Garden Shop Label Printer Release Notes

## GFS-LP-041 — LP-040 Static Staging Deployment

**Status:** Static deployment **PASS**. Live feature/audit acceptance **BLOCKED at Cloudflare Access**. No code changes were required.

### Preflight and deployment

- Published source: `880736940168eccb0b2e2de4cd4ee35e25fa7781` (commission feature commit `a1aeca5311154af7dc27eaffe05f564c82ce2a92`). Wrangler 4.149.0 `whoami` immediately before upload confirmed Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- Account-pinned Pages inventory confirmed the existing `garden-shop-label-printer-staging` project. Production branch is `main`; immediately prior production was `aae85a83-663d-449f-a20c-52418ed5b5e3`, rollback target.
- Rebuilt published source with `VITE_MONITOR_URL=https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev` and `VITE_ADMIN_URL=https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/`. The verified output contains only `index.html`, `label.css`, `_headers`, and static assets; `dist/` has no `wrangler.jsonc` or Worker entry.
- From `dist/` as Wrangler's working directory, uploaded only static Pages assets and `_headers` to the existing project, explicitly pinning account, project, `main`, and source SHA. Wrangler reported five uploaded files/eight reused; it warned that the ancestor monitor `wrangler.jsonc` lacked `pages_build_output_dir` and explicitly ignored it. No Worker/D1/Access deployment or configuration change was made.
- New Pages deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931`, Production/main, source `8807369`, unique URL `https://13081dbe.garden-shop-label-printer-staging.pages.dev`. Wrangler's production history now lists this deployment first. Stable URL: `https://garden-shop-label-printer-staging.pages.dev`. It returns an anonymous HTTP 302 Access challenge, proving the Access gate remains active; without an authenticated session, the served asset hash/active Dashboard marker could not be inspected.
- Existing policy's last Dashboard-verified configuration was Super-Admin-only; this task made no Access changes. Exact policy/allowed identity was **NOT reread** because Wrangler OAuth lacks Access-policy read scope (`CLOUDFLARE_API_TOKEN` is absent) and Chrome DevTools MCP is unavailable. Do not represent the prior policy snapshot as a fresh Dashboard read.
- Latest read-only Monitor Worker history remains version `89a245c0-2532-4b02-8def-4cd675f9a845` at 100%. The Pages upload made no D1 writes and no audit rows. The previous Pages deployment `aae85a83-663d-449f-a20c-52418ed5b5e3` remains available as the rollback target. Before rollback, freshly verify account and active version, then use Cloudflare Pages deployment history to restore that version only; do not touch Worker, D1, Access, Admin/API/WhatsApp or production resources.

### Live checks still required

- **BLOCKED:** stable URL challenge prevented live synthetic RGL/UMS/VPL/VPP import, live screenshots, Image Print/Save PDF comparison, `PDF_GENERATED`, audit-chain `VERIFIED`, and served-asset marker comparison. No live records/events were submitted. Prior 82/82 unit tests, local browser suite, and local visual examples remain PASS but are not live acceptance.
- Access enforcement is rechecked; exact Super-Admin-only policy and active Dashboard version are **NOT TESTED** in this session. Physical HP calibration is **NOT TESTED**.
- Single owner action: in a fresh isolated Chrome tab, authenticate to `https://garden-shop-label-printer-staging.pages.dev` as the already-authorized Super Admin and leave the blank import page open. Never use populated tabs, copy cookies, or bypass Access. Then verify served assets, run synthetic feature/print/PDF checks, and confirm the PDF event/audit chain.

## GFS-LP-040 — VPL/VPP Commission and Prefix-Aware Labels

**Status:** Local implementation and regression tests PASS. Committed and pushed. **Not deployed.**

### Behavior

- Prefix classification uses normalized case/whitespace for `RGL`, `UMS`, `VPL`, and `VPP`; Code 128 continues to receive the original tracking value.
- RGL/UMS have no amount capsule or commission; destination city/province uses the freed top-right label area. Source amount text is ignored for these prefixes.
- VPL/VPP display the corresponding heading and the declared amount plus calculated commission on one line. The main amount is large/bold; commission is 30% of its fitted font size and lighter.
- Unknown prefix, missing/zero/negative/invalid declared amount, and declared value above Rs. 100,000 block generation and remain editable. Only whole rupees are accepted; comma grouping and existing Rs/COD/VPL/VPP/`/-` input notations are normalized for calculation, never written back to the source row.
- The fee changes label display only; it does not change COD, payment, or source order data.

### Commission boundary results

| Declared amount (Rs.) | Commission (Rs.) |
|---:|---:|
| 5,000 | 75 |
| 9,999 | 75 |
| 10,000 | 100 |
| 15,000 | 100 |
| 20,000 | 100 |
| 20,001 | 175 |
| 25,000 | 175 |
| 40,000 | 200 |
| 45,000 | 275 (200 + 75) |
| 60,000 | 300 |
| 65,000 | 375 (300 + 75) |
| 80,000 | 400 |
| 85,000 | 475 |
| 90,000 | 500 |
| 95,000 | 500 |
| 100,000 | 500 |
| 100,001 | **REJECT** |

Calculation uses exact integer currency operations. Each complete Rs. 20,000 block adds Rs. 100; a positive remainder below Rs. 10,000 adds Rs. 75; Rs. 10,000 to below Rs. 20,000 adds Rs. 100; zero remainder adds nothing; final commission cannot exceed Rs. 500.

### Synthetic visual and output checks

- **RGL / UMS:** amount-box count 0 in browser preview and Image Print; expanded destination boxes measured from y=0.5 mm for 14 mm. City/province remain visible. Deliberately supplied RGL/UMS amounts do not appear in the PDF.
- **VPL:** `VPL` / `25000+175`.
- **VPP:** `VPP` / `65000+375`.
- Image Print and Save PDF carry the same VPL/VPP display values. The fee stays on the same line as the main amount, at 30% font size. Source tracking values are unchanged; all tested Code 128 barcodes decode.
- Synthetic screenshots visually inspected: `prefix-layout-samples.png`, `prefixes-image-print.png`, `prefixes-pdf-page.png`, and `label-output-synthetic.png` under `C:\Users\nazim\AppData\Local\Temp\kilo\gfs-lp040-evidence`. These files are intentionally not committed. The tracked one-label screenshot baseline was refreshed for the approved commission presentation.

### Verification and protected scope

- **82/82 unit tests PASS**, including every table entry above, invalid and over-limit amounts, normalized prefix classification, RGL/UMS fee suppression, expanded destination geometry and amount/fee sizing. TypeScript/Worker/Vite production build PASS.
- Full browser/PDF suite PASS with zero browser errors. Coverage includes prefix-specific previews, Image Print and Save PDF, unsupported/over-limit correction path, 18-position custom sheet, A4, browser batch barcode decode counts `[3, 18, 500, 500]`, and 28-page 500-label A4/custom PDFs. Unit tests exercise import/pagination counts for 18, 19, 55 and 500 rows; browser suite renders 18 and 500-label batches.
- Locked custom geometry unchanged: 190.5 × 254 mm paper, 63 × 42 mm labels, 3 × 6 / 18 labels, 0.5 mm horizontal and 0.333 mm vertical gaps, x starts 0.25 / 63.75 / 127.25 mm, y starts 0.1675 / 42.5005 / 84.8335 / 127.1665 / 169.4995 / 211.8325 mm, 540 × 720 pt PDF MediaBox. A4 geometry unchanged.
- LP-039 expanded layout and HP P2055dn sheet-relative 5.233 mm safe-edge content protection remain in place. This is not borderless printing. Physical printer calibration is **NOT TESTED**.
- No Admin, API, WhatsApp, COD/payment, Meta, production D1, Worker, Access, or production routing changes.

### Release gate

- Starting checkout was `D:\free seeds`, repository `gardenshop/freeseeds`, branch `codex/garden-shop-label-printer-mvp`, starting HEAD `f806aee62a72803f10ba77d9065400cfb6cef7f2`; LP-039 and other pre-existing working-tree changes were retained.
- Commit `a1aeca5311154af7dc27eaffe05f564c82ce2a92` (`feat: add tracking prefix commission layouts`) was pushed to `origin/codex/garden-shop-label-printer-mvp`. Git Credential Manager reports GitHub account `gardenshop`; the configured remote is `https://github.com/gardenshop/freeseeds.git`, and remote branch readback matches the pushed SHA. All root-level Admin/API/core/worktree changes and non-baseline generated evidence remain unstaged and untouched.
- Wrangler `whoami` confirmed `Get Free Seeds` / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Account-pinned read-only Pages queries returned only the existing `garden-shop-label-printer-staging` project. The latest listed Production deployment is `aae85a83-663d-449f-a20c-52418ed5b5e3` (source `0e64a6f`); the prior list entry is `a8287aa3-31dc-4446-a6be-c3127fac0e80`. This CLI history is not Dashboard confirmation of the active version or rollback target. The current tool session exposes no Chrome DevTools MCP, so Dashboard identity/Access, live serve checks and synthetic live prints were not performed; no Pages/Worker/D1/Access mutation occurred and there is no LP-040 deployment ID.
- Next release action: in an isolated Label Printer staging tab, reload VS Code/Kilo if needed to expose the authorized Chrome DevTools MCP, verify the Dashboard selector is Get Free Seeds / `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, confirm the active deployment/rollback target, and complete the existing authorized Access sign-in if challenged. Then deploy only `dist/` to the existing Pages project and verify live synthetic Image Print/Save PDF. Do not inspect or alter shared order tabs; preserve Access, Worker, D1, Admin/API and production resources.
