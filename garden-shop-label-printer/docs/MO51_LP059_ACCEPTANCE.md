# GFS-LP-059 — MO PDF popup lifecycle repair

## Baseline and protected scope

- Work began from branch `codex/garden-shop-label-printer-mvp`, baseline `6864a271345c8391de280de706bdb439ea4b1c0e`. The worktree contains unrelated dirty files; only `garden-shop-label-printer/src/main.ts`, `garden-shop-label-printer/tests/browser-smoke.mjs`, and this project's LP-059 documentation are in scope. Preserve all other changes and evidence.
- Last recorded deployed repair before the current local changes is source commit `948df20fd781f49ab983af16a93f00cf9443ff2b`, Pages deployment `0efcbfc6-1de1-43a1-8aff-01b460f3c4d1`; prior deployment `0e27536b-630d-4910-ab95-3ec55d2e870b`. Immediate successful rollback remains `5307cf95-851e-4757-b341-becfeaae1788`. These are historical records, not freshly verified active Dashboard state.
- No Worker, D1, Access, Admin/API, WhatsApp, COD/payment, Meta, production route, customer record, or physical printer state was changed. Keep the new-number WhatsApp lock and Hoja Seeds zero-connection rule intact.

## Synthetic staging observation

- The staging N42 acceptance used synthetic rows only. The first paired record was 1/22 and the final pair was 21/42; the generated PDF contained 42 pages. The print popup opened the PDF viewer. No physical printing occurred.
- While the viewer remained open, a subsequent fetch of its generated blob URL failed. This was observed on the prior deployed build; the cause was not conclusively isolated from staging timing, but the source's `popup.closed` polling was unsafe because Chrome may replace the popup target with its built-in PDF viewer. Early URL revocation through that signal is the leading diagnosis, not a proven browser-internal trace.
- The source repair removes popup-close polling and keeps the verified blob URL alive until the bounded 30-minute fallback. A local browser regression checks that the PDF remains fetchable and parseable after the viewer opens. This does not yet prove the deployed staging fix.
- Existing browser-local layout/mapping values were backed up during staging checks. Save actions were not used; after the tab was closed, storage equality/restoration could not be verified. Do not claim it was restored or altered.
- No populated customer records were inspected or used for the acceptance result. Sender CNIC was left blank. The independent monitor `PDF_GENERATED` HTTP 400 for `gfs-paper-presets-v4` remains blocked; no Worker/D1 change or template-version spoofing is permitted.

## Local verification at the LP-059 checkpoint

- `npm.cmd test`: **151/151 pass**.
- `npm.cmd run build`: **PASS** (TypeScript, Worker typecheck, Vite static build).
- `npm.cmd run test:browser`: first attempt stopped when Playwright could not write a pre-existing project evidence path. Rerun with `LP_TEST_EVIDENCE_DIR` pointed to an isolated temporary directory completed **PASS**, reported `browserErrors: []`, verified the PDF blob remained readable after the viewer opened, and retained the N42 42-page pairing checks plus existing label/PDF regressions.
- `git diff --check`: **PASS** after the final documentation update.
- At the LP-059 checkpoint, source/test edits were uncommitted and undeployed. LP-060's current implementation, verification and release state are recorded in `docs/MO51_LP060_DECISIONS.md`.

## Release gates

- The owner confirmed the leading diagnosis and authorized a static `dist/` staging deployment plus synthetic-only retest. Wrangler read-only identity currently confirms `gisupp@gmail.com` / Get Free Seeds / account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, and the Pages project list contains `garden-shop-label-printer-staging`. The command's attempted `--account-id` option was unsupported and made no change; the unqualified read-only project list then succeeded.
- Deployment is **on hold**: Chrome DevTools `list_pages` timed out twice, so the authenticated Dashboard identity, active deployment and rollback have not been freshly verified. The local Kilo config has the enabled official Chrome DevTools MCP command, matching bridge processes and Chrome/DevTools endpoint are present, but the page-list tool remains unavailable. No Pages deployment or Dashboard mutation occurred. Restore the supported Chrome DevTools MCP page-list path, then redo the Dashboard identity and active/rollback preflight before deploying.
- Before any Pages mutation, verify the authenticated Get Free Seeds account identity in both approved CLI and Dashboard surfaces, verify the exact `garden-shop-label-printer-staging` project and active/rollback versions, and record the result. Deploy static `dist/` only; no Worker/D1/Access changes.
- After deployment, use a fresh authenticated-profile tab and structurally verify that the app is empty before any interaction. Stop if real records are present. Use synthetic rows only, leave CNIC blank, and do not save mapping/layout. Recheck blob readability while the PDF viewer is open. No physical print is part of this acceptance.
- Keep audit acceptance separate: `PDF_GENERATED` HTTP 400 is unresolved. Physical duplex calibration and official postal acceptance remain **NOT TESTED**.
