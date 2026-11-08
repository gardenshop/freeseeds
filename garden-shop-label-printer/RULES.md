# Garden Shop Label Printer Rules

## Verified Project Identity (Read-Only, 2026-11-08)

- GitHub CLI identity: `gardenshop`.
- Git remote: `https://github.com/gardenshop/freeseeds.git` (verified with `git remote -v`).
- Checkout at inspection: `codex/gfs-v2-payments-reminders-001`; this is the existing payments branch, not the Label Printer target. `origin` is configured as `https://github.com/gardenshop/freeseeds.git`; `gh repo view` confirms `gardenshop/freeseeds` (default branch `codex/gfs-bootstrap-001`). The intended isolated push branch is `codex/garden-shop-label-printer-mvp`; it was absent from local and remote branch listings at inspection. Recheck immediately before creating/pushing it.
- Wrangler identity: `gisupp@gmail.com`; selected Cloudflare account `Get Free Seeds`, account ID `cb5066a6d71ecdee0bd7ed8aacb4d3c2` (`npx --no-install wrangler whoami`, read-only).
- No Label Printer Pages project, Worker, D1, Access application, secret, binding, route, deployment or Cloudflare staging resource is recorded or approved. Wrangler also lists another account; it was not selected or used. Never access/use Hoja Seeds.
- No secrets, customer data, real phone numbers, addresses, tokens or private keys belong in this file, Git, application telemetry, screenshots or test fixtures.

## Protected Invariants

- This project is an independent local-first label tool. It must not edit or bind existing production Admin/API, WhatsApp, COD, Advance Payment, payment, order, routing, Meta, D1, R2, Queue, Access or deployment resources.
- Preserve the new-number WhatsApp lock. Hoja Seeds must have zero runtime connection and must not be accessed for this application.
- Workbook data, generated labels, phone numbers, addresses, Order IDs, tracking references, product names and PDF bytes stay in the browser. Monitoring events may contain only allowlisted event types, aggregate counts, random batch ID, template version, server-derived pseudonymous actor, timestamp and bounded error codes.
- A print request is not proof of physical printing. Staff confirmation is a separate event and is not printer telemetry.
- Never fabricate Order IDs, destinations, landmark data, contact details, products, COD amounts or tracking values. Flag missing/ambiguous values; preserve source values. Only remove an exact contact-number token from the displayed address, retain the source address in memory, and provide a restore/edit path.
- All label outputs use the same 65 × 44 mm layout model on A4 210 × 297 mm, 3 × 6 grid. Keep print at actual size, preserve barcode quiet zones and never silently clip text.

## Mutation and Release Gates

- Cloudflare identity verification above is historical, read-only evidence, not authorization to mutate. Immediately before every future Cloudflare dashboard/CLI mutation, run the approved identity check, confirm account name/ID and intended new resource in the authenticated account UI, record timestamp/identity/resource/action, and stop if the identity differs. Never select Hoja Seeds.
- Use only newly provisioned and explicitly approved Label Printer Pages/Worker/D1/Access resources. Do not reuse existing GFS bindings, production databases, routes, secrets or Access audiences. Do not create resources, apply migrations, attach Access, set secrets or deploy without owner/security approval and resource-registry approval.
- Apply only `garden-shop-label-printer/migrations` to its dedicated D1. Never run root migrations or point the Worker at an existing database.
- No live production deployment without explicit release approval. Keep the existing Garden Shop systems unchanged. No Meta changes are needed or allowed for the label app.
- Before each push, confirm the GitHub owner/repository and branch. Stage only this standalone project and its label-specific plan/evidence files; never include unrelated dirty files. No force push.
- No physical print-accuracy claim until a ruler-checked test on the intended printer and stock. Keep rollback limited to this standalone Pages/Worker version; do not drop audit data automatically.
