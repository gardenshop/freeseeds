# Existing-Admin Integration (Staging Code; Not Live)

## Scope

The scoped redirect/card code is implemented in the working Admin source and has a focused Hono test. No Admin Worker deployment has been made. The active Cloudflare Admin (`getfreeseeds-admin-staging`, version `3e4b7c26...`, 100%) renders a newer Operations-card template than the checked-out Admin source; the checkout also has unrelated dirty Admin changes. Do not deploy the checkout over the active Worker. The staging Label Printer Page/monitor is live and Access-protected, but the Admin tile is not live.

## Minimal Change

The branch adds this logical link through the existing Admin Operations card structure and `/labels-printing` protected redirect:

```html
<a href="https://APPROVED-LABEL-APP-ORIGIN" rel="noopener noreferrer">
  Label printer
</a>
```

The real active Admin source baseline must be reconciled first; adapt the same card to that template without replacing its current module list. The redirect checks the existing Admin Access guard and sends the user to the dedicated Pages URL with no tokens or customer data in the URL. The Pages/Worker Access app then independently validates the signed JWT and Super Admin role.

## Required Approval and Preflight

- Product/security owners approve the staff role roster, privacy notice, retention and staff-confirmation semantics. The current canary Access policy is Super Admin only; staff identities were not provided.
- Verify Cloudflare account identity with `wrangler whoami` immediately before each resource mutation and record timestamp/account/resource/change in the approved operations record. The account must be the authorized Garden Shop account, not Hoja Seeds.
- Approve new Pages/Worker/D1 resource names, billing/quota impact, Access policy, CORS origin and rollback versions; register resources independently of existing production D1 and Worker entries.
- Reconcile the exact active Admin source/version before preparing the canary; preserve the 3e4b rollback and do not include pre-existing dirty Admin changes. Do not proxy existing Admin APIs or bind/reuse any production database, Worker secret, queue, or Access audience.
- Add the Pages URL to the Admin Worker environment only in the reviewed canary version, test denied/approved roles, confirm monitoring reports are Super Admin-only, and obtain production smoke/rollback approval before promotion.

## Rollback

Rollback the Admin canary to the active version `3e4b7c26...` (100%) and remove only the `LABEL_PRINTER_URL` variable/route from the canary. Roll the independent staging Pages/monitor Worker to their recorded prior versions if needed; preserve the audit D1. Do not modify other GFS or Hoja Seeds systems.
