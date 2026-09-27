# Resource Registry

Staging resources are provisioned in the dedicated clean account; production remains unprovisioned.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Branch: `codex/gfs-bootstrap-001` (to be created after governance baseline)

## Cloudflare

- Account name: Get Free Seeds (dedicated clean account)
- Account ID: `cb5066a6d71ecdee0bd7ed8aacb4d3c2`
- Prohibited account: `85f6a6181b4653c2a45e69cb7ce8a474` (not used)
- Staging D1: `getfreeseeds-staging` / `17b7e9f6-e08b-4bff-a756-10de30b49ab1`
- Staging R2: `getfreeseeds-receipts-staging` (private; public access not enabled)
- Staging Queue: `getfreeseeds-events-staging`
- Staging DLQ: `getfreeseeds-events-staging-dlq`
- workers.dev subdomain: `get-free-seeds.workers.dev`
- Staging public Worker: `getfreeseeds-api-staging` / `https://getfreeseeds-api-staging.get-free-seeds.workers.dev`
- Staging admin Worker: `getfreeseeds-admin-staging` / `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev`
- Staging API version: `37a03178-9683-4506-bf47-895ebc71dbf2`
- Staging admin version: `3b66b672-3056-4282-965b-6a2dae97b99a`
- Cloudflare Access application: `Get Free Seeds Admin Staging` / `ea91b1bf-02c1-46d3-921a-ea2f507fb150`
- Cloudflare Access allow policy: `Get Free Seeds Admin Operator` / `b3acdd4f-9767-4d28-a55d-0a8e771d476c`
- Production resources: not provisioned
- Production Access application: not provisioned

## Meta and WhatsApp

- Customer-facing Page input: `https://www.facebook.com/FreeSeedsPK/`
- Page ID: `101192938541236` (currently Hoja-linked; not a runtime dependency)
- Clean Meta Business ID: not provisioned
- Clean WABA ID: not provisioned
- Phone Number ID: intentionally unassigned; new number pending user supply
- Flow ID: not published; repository definition only
- Dataset/event source ID: not provisioned
- Graph API version: `v26.0` observed 2026-09-27; re-verify before live integration
- Public callback URL (staging only): `https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp`

No secrets are stored in this registry.
