# Proposed Existing-Admin Integration (Not Applied)

## Scope

This is a proposal only, prepared after local unit, browser/PDF and authorization tests passed. No existing Admin, API, payment, WhatsApp, Worker, D1, queue, or deployment file was modified. The label app works independently; this navigation link is not required for its operation. Remote Access/D1 resources are not approved or deployed, so the proposal is not yet executable.

## Minimal Change

After the separate application is deployed and its dedicated Cloudflare Access policy has been verified, add one normal external link in the existing authenticated Admin navigation:

```html
<a href="https://APPROVED-LABEL-APP-ORIGIN" rel="noopener noreferrer">
  Label printer
</a>
```

Use the repository's existing Admin navigation convention rather than pasting this HTML literally if that screen is rendered by a typed template. Do not pass order IDs, customer details, payment data, auth tokens, or a reusable signed token in the link. The label app must require its own Cloudflare Access session and its Worker must independently validate the signed Access JWT and role allowlist.

## Required Approval and Preflight

- Product and security owners approve the standalone hostname, label workflow, role roster, privacy notice, retention and staff-confirmation semantics.
- Verify Cloudflare account identity with `wrangler whoami` immediately before each resource mutation and record timestamp/account/resource/change in the approved operations record. The account must be the authorized Garden Shop account, not Hoja Seeds.
- Approve new Pages/Worker/D1 resource names, billing/quota impact, Access policy, CORS origin and rollback versions; register resources independently of existing production D1 and Worker entries.
- Review the exact one-link diff in the existing Admin as a separate change request. Do not proxy existing Admin APIs or bind/reuse any production database, Worker secret, queue, or Access audience.
- Test denied and approved roles in staging, confirm monitoring reports are Super Admin-only, and obtain production smoke/rollback approval before release.

## Rollback

Remove or disable only the new navigation link if it was separately merged. Roll the independent Pages site and monitoring Worker to their approved prior versions. Preserve the audit D1 and do not modify existing GFS or Hoja Seeds systems.
