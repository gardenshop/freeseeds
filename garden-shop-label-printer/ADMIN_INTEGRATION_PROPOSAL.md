# Existing-Admin Integration (Staging Code; Not Live)

## Scope

The scoped Operations card/redirect code is committed and its Hono test passes. No Admin Worker deployment has been made. The active Cloudflare Admin (`getfreeseeds-admin-staging`, version `3e4b7c26...`, 100%) renders a newer Operations-module home than the checked-out Admin source; the checkout also has unrelated dirty Admin changes. Do not deploy the checkout over the active Worker. The staging Label Printer Page/monitor is live and Access-protected; the Admin tile is not live.

## Minimal Change

The branch adds `Labels & Printing` through the existing Operations card structure and a protected `/labels-printing` redirect:

```html
<a href="/labels-printing" rel="noopener noreferrer">
  Labels &amp; Printing
</a>
```

The real active Admin source baseline must be reconciled first; adapt the same card to that template without replacing its current module list. The redirect checks the existing Admin Access guard and sends the user to the dedicated staging Pages URL with no tokens or customer data in the URL. The Pages/Worker Access app independently validates the signed JWT; the Worker enforces Super Admin reports.

## Required Approval and Preflight

- Staging Pages/Worker/D1/Access resource names and Free-plan canary are owner-authorized and recorded in `RULES.md`. Staff role roster/group, privacy notice, retention and staff-confirmation semantics remain to be approved. The current Access policy is Super Admin-only; do not guess staff identities.
- Verify Cloudflare account identity with `wrangler whoami` immediately before each resource mutation and record timestamp/account/resource/change in the approved operations record. The account must be the authorized Garden Shop account, not Hoja Seeds.
- The live Worker reports active version `3e4b7c26...` at 100%, but its deployed source commit is not present in the current checkout. Confirm the exact Git commit/branch used to build that active version or authorize a specific candidate baseline. Do not infer that the unassigned GFS-90/GFS-91 branch is active.
- Preserve rollback to `3e4b7c26...`; do not include the unrelated dirty Admin/API/migration changes. Do not proxy existing Admin APIs or bind/reuse any existing production database, Worker secret, queue or Access audience.
- Set the Page redirect destination only in the reconciled Admin canary, test actual Admin Operations navigation and preview, then use an Admin-only version preview/canary and obtain the applicable production-promotion approval. General staff launch also needs an approved Access group/roster.

## Rollback

Rollback the Admin canary to the active version `3e4b7c26...` (100%) and remove only the `LABEL_PRINTER_URL` variable/route from the canary. Roll the independent staging Pages/monitor Worker to their recorded prior versions if needed; preserve the audit D1. Do not modify other GFS or Hoja Seeds systems.
