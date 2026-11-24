# GFS-LP-068 Release Evidence

## Static deployment

- Source branch: `codex/garden-shop-label-printer-mvp`; deployed source SHA: `e2b2df8bf79d0de5a584a07a37aa334067e42eda` (HEAD matched `origin` before release).
- Before the Pages mutation, Wrangler `whoami` reported `gisupp@gmail.com`, Get Free Seeds, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. The authenticated Dashboard URL and project header showed the same account ID/name and the existing `garden-shop-label-printer-staging` project.
- Pre-deploy active deployment `f5f40d5f-4d68-4693-9da6-0024ca249f19` reported Success. The preceding successful deployment was `4fe92786-94b7-43e5-aca6-4a337bf98648`. The immediate rollback target after release is the verified pre-deploy active `f5f40d5f-4d68-4693-9da6-0024ca249f19`.
- Staging build passed with Monitor `https://garden-shop-label-printer-monitor-staging.get-free-seeds.workers.dev` and Admin `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/` origins.
- From the config-free `dist/` working directory, Wrangler Pages deploy targeted only project `garden-shop-label-printer-staging`, branch `main`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, with commit hash `e2b2df8bf79d0de5a584a07a37aa334067e42eda`.
- Dashboard reports deployment `3a683220-964b-4eaa-b624-433f6263c620` as Production/main/Success at `https://3a683220.garden-shop-label-printer-staging.pages.dev`. It lists 15 uploaded static assets, including `index-DptfyBDf.js` and `index-wDIAteq1.css`. The deployment command uploaded five files and reused ten.
- No Worker, D1, Access policy, Admin/API, WhatsApp, COD, payment, Meta, or production route change was made. The unrelated 51 pending Git paths were preserved.

## Live acceptance gates

- A new isolated Chrome DevTools context reached the normal Cloudflare Access sign-in challenge before the staging app loaded. No populated shared tab was inspected or used, no Access bypass was attempted, and no synthetic data was submitted.
- Live N2 alignment/amount-once/preview/PDF/print acceptance: **BLOCKED / NOT TESTED**. LP-065 local N2 verification is recorded PASS in `MO51_LP065_DECISIONS.md`; it is not live evidence.
- Live N100 PDF download, 100 A4-landscape pages, first/final pair identities, and Print MO Batch PDF-target acceptance: **BLOCKED / NOT TESTED**. Live PDF generation time: **N/A** (no live PDF generated). No physical printing occurred.
- LP-065 local unit, staging build, browser/PDF and existing-label regressions are recorded PASS in `MO51_LP065_DECISIONS.md`; existing-label live staging comparison remains **NOT TESTED**.
- Monitor `PDF_GENERATED` HTTP 400 for `gfs-paper-presets-v4` remains a separate Worker-contract blocker; no Worker/D1 change or synthetic audit event was made. Physical duplex calibration and official postal acceptance remain **NOT TESTED**.

## Remaining action

- An authorized operator must complete normal Cloudflare Access sign-in in a fresh isolated Chrome context and leave the staging app on its blank import screen. Then run only the synthetic N2/N100 acceptance and existing-label regression. Do not use a populated shared tab or copy session credentials.
