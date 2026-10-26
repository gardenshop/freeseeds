# Resource Registry

## GFS-236 Non-Traffic Version Smoke / Restore

| Worker | Candidate version / ETag | Active deployment after restore |
|---|---|---|
| API | v91 `6db59e0d-0ab5-4535-8937-f7cf9100032b` / `cc6a6ebf6e97de0c5b55edd09f10732fe98796ccb99308e8e846a1835515a219` | v90 `21a3d74c-3979-432c-9190-1848362592a4` alone100%, deployment `9cc279f1-dc6d-463b-9047-8311d1229945` |
| Admin | v83 `d9eff614-00a8-4ea7-a9f0-45f7c9df6b4e` / `9a218d21e06fb7e6d4e6f9d4cd13d5e112331807b6106b8b9d7265901a4db5b1` | v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` alone100%, deployment `cbc4233d-9100-45cf-aa8e-7f42eb44e982` |

- Explicit zero-traffic approval. API v91 COD false; Admin/ API used original staging bindings; no user traffic was promoted. Dashboard Version URLs disabled on both Workers; ordinary workers.dev kept enabled; Admin Access remains. Candidate metadata still carries `has_preview` marker, but no preview URL was opened/shared.
- API candidate health200, unsigned webhook403; Admin candidate Access health200/`paymentConfigured:false`. This is an aggregate only, no recipient/order/payment rows. Last active v90 source still has no SHA; v91/v83 ETags are candidate-only.
- GFS-236 current deployment state restored to v90/v82; candidate artifacts remain in account version history. Original D1 and synthetic diagnostic resource unchanged; migration0030 unapplied; diagnostic cleanup review remains Oct28.

## GFS-235 Active Worker Source/Binding Evidence (2026-10-26)

| Worker | Active version / traffic | Deployed at | Script ETag | Source SHA |
|---|---|---|---|---|
| `getfreeseeds-api-staging` | `21a3d74c-3979-432c-9190-1848362592a4` /100% | `2026-10-24T12:47:42Z` | `0a306eaaeb2b40b236cec7cfdbab4ae07baee5abb9aaaf47f73f040d9995bb02` | Not exposed |
| `getfreeseeds-admin-staging` | `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` /100% | `2026-10-24T12:55:05Z` | `ba0f365047e5e3568260b4b6d25f15ad4cc032f1b2962b16c8c11134e0ed1c43` | Not exposed |

- API binding metadata matches staging D1/R2/Queue and canonical GFS Meta IDs; secret names only. Active API v90 binding inventory has no `COD_V1_ENABLED`; its runtime behavior is unknown without source. Candidate dry-run has the flag false. Binding metadata does not prove Meta operator or current phone review.
- Both deployment times precede PR10 commit cf01f44 (17:54:21Z); source may still have been deployed from an uncommitted tree, so exact parity remains UNKNOWN. Dashboard code view provided no script/hash; no edit/deploy. Callback remains untouched.
- Original D1 unchanged, COD0030 unapplied. GFS234 isolated synthetic DB unbound; retained for cleanup review Oct28. No active Worker/binding/Meta/customer mutation.

## GFS-234 Explicitly Approved Disposable Diagnostic D1 (2026-10-26)

| Field | Verified record |
|---|---|
| Name / ID | `getfreeseeds-cod-compat-check` / `b29df6ba-e5c3-47bd-ac59-f6b0d47861a1` |
| Owner/account | Get Free Seeds, `gisupp@gmail.com`, `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; browser identity matched and Wrangler rechecked before synthetic mutations |
| Authority/purpose | User explicitly approved this one <=5MB synthetic-only DB, <=10k reads/1k writes, no paid plan, traffic, active binding or customer copying; independent of prior V2 permission |
| Created / size | `2026-10-26T20:39:38.852Z`;569344 bytes;38 tables;account now5 DBs |
| Schema/data |63 V1 schema definitions only (from compatibility0001–0029), one synthetic fixture, exact0030; normal NEW ledger3. No real customer/receipt/payment-method records exported; config COD disabled125. Synthetic SQL order `SIM-GFS234-DO-NOT-SHIP`,250+125=375,COD_PENDING/hold1; no outbox/receipt |
| Dependencies | No Worker, Meta callback, Queue, R2 or Access binding; not a production/rollback DB. Temporary config/artifacts only in `D:\Temp\kilo\gfs234-rehearsal`; never deploy the failed C3 scaffold under `D:\Temp\kilo\getfreeseeds-api-staging` |
| Cost/quota | Before creation UI:4/10 DBs,4.56MB/5GB,88k/5M daily reads,29/100k writes,$0 observed billable usage. Final D1 info:33 read queries/77 write queries,546 rows read/223 written in24h,within approved caps; no new plan,Cron or consumers. Post-change invoice not inspected; do not guarantee future zero charges |
| Cleanup | Retained only for test evidence. Review/delete by2026-10-28 after dependency/no-real-data checks. Wakeup scheduled2026-10-28T12:00Z; no automated blind deletion. All four original DBs retained |

- Original D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`: metadata3,055,616 bytes. Explicitly approved bounded SELECT1/metadata preflight PASS, quick_check ok,FK0, all63 V1 objects match, legacy ledger0. No original schema/data write; COD0030 remains unapplied. List API's `num_tables:0` is not a reliable schema-empty signal; schema preflight establishes actual objects. D1 `version:production` is storage metadata, not a production traffic promotion.
- Time Travel bookmark original `0000026d-00000000-00005110-fef2d3498b8cc0fbb06b6df66727b08d`; diagnostic `00000002-00000000-00005110-f5e6931b1cdda1c7644203b7753afe30`. No restore. COD file SHA256 `72d1c00c4c3bfeabc391f538530c2bc974a60d37ab33f01b5ba672253ec052db`; schema-only SHA256 `4bf7ca14aad2f69423ee92ab50afc5d556f3620408a70c5cb1c59ccc04265221`.
- API v90 `21a3d74c-3979-432c-9190-1848362592a4` and Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` remain at100%; no deploy/secret/Meta/canonical routing or binding change. Active flag unknown; candidate API false. Admin Access matches; Test Controls recovered; current exact WhatsApp tester MISMATCH, no send.

## GFS-233 Verified Support/Deployment State (2026-10-26)

- Wrangler principal/account confirmed immediately before Support: `gisupp@gmail.com`, expected GFS account, `d1:write`. This does not grant proven D1 query permission.
- One approved Chrome MCP execution called `list_pages` then reached Support. Cloudflare Free Support classified API7403 for staging D1 as ineligible (Free case topics only billing/account/registrar); no case ID/submission. A later fresh execution lost `list_pages` again. No D1 query/retry or cloud change.
- Latest 100% Worker history remains API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`; source SHA absent. API/Admin dry-runs pass with expected bindings, candidate `COD_V1_ENABLED=false`. Active flag/bindings unqueried.

## GFS-232 Current Access/Runtime State (2026-10-26)

- Wrangler confirms expected GFS account/email and `d1:write`; this grants no proven D1 query authorization. No D1 query, support case/reference, scope/identity change or hosted mutation occurred.
- Codex `D:\AI-Tools\Codex\home` v0.164.0: official `chrome-devtools` entry enabled; `codex doctor` reports valid config/MCP/network, Chrome processes are active, but the approved invocation did not expose callable `list_pages`. No new page inventory; no tab navigation/message in GFS-232.
- API v90 `21a3d74c-3979-432c-9190-1848362592a4` and Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` remain latest known metadata, no source SHA. No deploy, active flag/bindings or D1 schema refresh. Migration0030 unapplied; candidate COD false.

## GFS-231 Owner/Tester Gate Attempt (2026-10-26)

- Cloudflare account/Wrangler identity remains known, but existing dashboard UI did not expose visible email or account ID at pre-submission check. No support ticket or reference; no account switch, OAuth change, or direct Wrangler/raw D1 query. Admin Test Controls' auto-loaded exemptions list returned UNAVAILABLE; no subsequent read or mutation.
- Official Chrome inventory completed after one timeout; Orders snapshot was rejected for customer-data exposure risk. With explicit user approval, reused Admin tab navigated to same-origin `/test-controls`; scoped tester/exemptions read returned UNAVAILABLE. Stopped before WhatsApp Profile; no customer/order data, chat or message read. Last own Profile mismatch remains.
- API v90/Admin v82 latest history unchanged, no source SHA. No active bindings, flags or D1 schema were refreshed. No resource changed.

## GFS-230 Read-Only Staging Inventory (2026-10-26)

- No Cloudflare/Meta/GitHub resource or configuration changed. Fresh official Chrome MCP inventory lists11 existing page IDs/origins; no additional navigation or content change.
- Latest Wrangler API history: `getfreeseeds-api-staging`, v90 `21a3d74c-3979-432c-9190-1848362592a4`; Admin: `getfreeseeds-admin-staging`, v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. Both history records date 2026-10-24 and have no source commit annotation. Active source parity unproven.
- D1 `getfreeseeds-staging` was not queried or mutated; API7403 diagnosis via account-owner/support is pending. Migration0030 remains unapplied; no backup or integrity result is newly claimed.
- API/Admin dry-runs use expected configured D1/R2/Queue; API candidate has `COD_V1_ENABLED=false`. Dry-run is not evidence of live bindings or flag state. No deployment or test resources created.

## GFS-229 Read-Only Tool/Account Check (2026-10-26)

- No hosted resource, binding, account, secret, route, D1 row, Worker, Meta asset or customer state changed. Candidate source remains PR #11 `codex/gfs221-cod-compat-001`; API/Admin dry-runs only.
- Codex host `D:\AI-Tools\Codex\home`, version 0.164.0; one enabled official `chrome-devtools` stdio MCP. Existing tabs were inspected narrowly: Admin Access matched; Cloudflare account ID visible/email unavailable; GitHub browser absent, CLI gardenshop; Meta operator unavailable; canonical WABA/sender evidenced in WhatsApp Manager; WhatsApp tester mismatch. No screenshot, chat, message, or WAMID.
- `wrangler whoami`: `gisupp@gmail.com`, Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; permission summary includes `d1:write`. Prior D1 API7403 not retried; resource-level authorization remains unresolved. No scope or account change.
- Candidate API dry-run reports `COD_V1_ENABLED=false`; this is source config, not a fresh active Worker state. Existing active API v90/Admin v82 and D1/migration evidence remain historical, not refreshed.

## GFS-228 COD Scope/Resource State (2026-10-26)

- No resource/binding/account changed. Source commit `046426e` changes only Admin/API COD intake logic and tests; PR #11 branch receives it. Existing D1/API/Admin/Meta/callback IDs and rollback remain unchanged.
- COD settings use audited revision and fee125 with no HMAC/references for intake. Optional settlement still requires independent cash evidence/HMAC. Runtime COD remains off; active Worker versions unchanged.
- Remote D1 API7403 and Chrome `list_pages` failure left tester, source parity and staging bindings unverified this run. No D1 write, secret, Meta action, test order, WAMID or screenshot.

## GFS-227 Permission and Resource Status (2026-10-26)

- Cloudflare account/Access identity and GitHub CLI identity remain verified from prior same-session evidence. Current Wrangler D1 query returned API7403; no scope/account changes. Remote D1 state is not refreshed this run.
- Existing API v90/Admin v82 IDs unchanged; source parity unverified. No service version deployed or secret provisioned. Candidate COD remains false.
- D1 migration 0030 remains unapplied; empty legacy ledger is preserved. No remote clone, customer-data export, backup restore, Meta callback, tester order, WAMID or screenshot created.
- Official Chrome MCP page listing failed twice in approved review; no tester/Admin Test Controls or Meta operator inspection completed. Stop until supported session/permission restoration; no account switch or message.

## GFS-226 Access/Runtime Follow-up (2026-10-26)

- Admin Access identity verified through exact staging origin's same-origin identity endpoint: email and hostname matched. No JWT, cookie, claim JSON or token saved. Admin Test Controls not read after MCP `list_pages` failed twice.
- Last verified tester Profile mismatch remains; no profile change/chat/message. Meta operator and actual WABA phone association not verified. No new resource/secret or callback.
- Active API v90/Admin v82 IDs unchanged; no source SHA. API health returned only service/200. D1 remains healthy/read-only, ledger empty and all Wrangler migrations pending; 0030 unapplied. No backup clone, data export or resource mutation.

## GFS-225 Final Runtime/Identity Snapshot (2026-10-26)

- Cloudflare UI `gisupp@gmail.com` and expected account ID route verified. GitHub CLI `gardenshop`; browser PR session unauthenticated. Staging Admin host/API loads, but Access identity not visible in header attributes. No identity change.
- Meta existing tabs show allowed GFS business/WABA links; operator Saeed and phone asset identity unverified. Authorized WhatsApp tester profile mismatches approved record. Do not message or use Hoja assets.
- API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`; no Git SHA metadata. Chrome health GET returned HTTP200/service-only. Candidate COD flag false; active HMAC binding absent.
- D1 still populated, ledger empty, COD tables absent; quick/FK clean, Time Travel bookmark available. No official clone/fork or schema-only export; do not copy customer data. Migration blob `05e7c0012ad3ed6677bc691a3f937f15b7d20c50` remains unapplied. No secret, D1 row, Worker, callback, order, WAMID, screenshot or spend change.

## GFS-224 Current Runtime/Backup Inventory (2026-10-26)

- Verified Cloudflare browser user-menu identity `gisupp@gmail.com`; exact account ID present in route/link, expected GFS ID. Wrangler CLI agrees. GitHub CLI authenticated `gardenshop`; GitHub UI is unauthenticated. Staging Admin Access page did not expose expected email; no order rows inspected.
- Read-only active versions remain API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`; source commit IDs unavailable. API version predates PR #10 source `cf01f44`; don't infer parity. Config IDs: account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, D1 `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, WABA `2616648355452496`, phone asset `1323932417479627`. Meta current operator and WABA association not authenticated; asset IDs are configuration references only.
- D1 `quick_check=ok`, FK clean, `d1_migrations` exists empty, no COD sidecar tables; Time Travel bookmark available at 2026-10-26T11:45Z. This bookmark token is not saved in Git. Official D1 cloning unsupported. Schema-only export failed auth; no customer rows or database file were copied. `0030` source commit `217e2a0`, Git blob `05e7c0012ad3ed6677bc691a3f937f15b7d20c50`, idempotent sidecar marker only tested locally, unapplied.
- Candidate COD `false`; active API lacks COD HMAC binding/name, no secret provisioned. No courier record, WAMID, test order, screenshot, migration, deployment, restored D1, or Cloudflare write. Only this Git branch/PR was written.

## GFS-223 Authenticated Resource Preflight (2026-10-26)

- CLI identity: GitHub `gardenshop`; Wrangler `gisupp@gmail.com`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Existing MCP tabs lacked Cloudflare/GitHub/Admin UIs. No current dashboard session identity verified through browser.
- Cloudflare metadata: API `getfreeseeds-api-staging` v90 `21a3d74c-3979-432c-9190-1848362592a4`; Admin `getfreeseeds-admin-staging` v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. Shared D1 `getfreeseeds-staging` / `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; R2 and Queue match candidate config. Versions have no source Git commit annotation; active-source parity unverified. API has no COD HMAC binding; candidate flag false.
- Remote D1 `d1_migrations` has zero entries while legacy schema/data exists; all local migrations show pending. Remote `quick_check` ok, FK check empty, 0 rows written. No COD sidecar tables. Time Travel bookmark available at 2026-10-26T11:45Z (opaque bookmark not recorded here). No backup restore exercised. No migration applied.
- Meta current tabs exposed sender identity but not canonical WABA; approved tester profile did not match. No authenticated courier/remittance evidence found. HMAC secret value never read. No WAMID/screenshot/test order or external mutation.

## GFS-222 Local Resources and Protected Runtime (2026-10-26)

- Target remains PR #11 branch `codex/gfs221-cod-compat-001`, stacked on PR #10 `cf01f44`. No change to frozen V1 tag, PR #9, primary checkout or `images/`.
- No remote Worker/version, D1 migration/bookmark/backup, R2 object, Queue, secret, policy, Meta callback, WhatsApp message, tester order, WAMID or screenshot was created. Configured staging binding IDs remain source observations, not fresh dashboard verification. Active API/Admin versions and current remote COD state remain unverified; candidate COD flag stays false.
- Added then removed a clean detached local rollback-source checkout at `D:\Temp\kilo\gfs222-rollback-v1`, exactly `cf01f444500415b1f22a64730674caca1c286006`, after baseline176 and old-source rollback4 acceptance. No customer/receipt export or credentials were used; no cloud resource created. Recreate from preserved Git commit and set `GFS_LEGACY_ROOT` to rerun `npm run test:rollback:v1`.
- GitHub CLI identity verified `gardenshop`; remote is `https://github.com/gardenshop/freeseeds.git`. Tested source `bf3a231c585982badcf55b43dece351f92c8d60d` pushed to PR #11 branch. Reviewed migration Git blob `4993557afd135c7cb778f565b95ca95eb4431ffd` remains unapplied.
- API/Admin source configurations both name shared D1 `getfreeseeds-staging` ID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, R2 `getfreeseeds-receipts-staging`, Queue `getfreeseeds-events-staging`, WABA `2616648355452496`, phone asset `1323932417479627` and existing signed staging callback. Dry-run confirms configured bundles only; no actual bindings/versions/callback were checked in authenticated dashboards.
- Existing collector/remittance arrangement remains user-reported but unverified through an authenticated record. No policy evidence is fabricated, no HMAC secret is provisioned, no account switched, and no paid resource/spend action occurred. Cloud billing was not inspected, so no new cost observation is claimed.

## GFS-221 Candidate Resources / Non-Mutation Record (2026-10-25)

- Git branch `codex/gfs221-cod-compat-001` is based on V1 source commit `cf01f44`; tested source and GFS-221 docs were pushed to the new remote branch and stacked review PR #11 targets PR #10's V1 branch. Active Worker byte identity was not verified. PR #9/V2, frozen V1 tag, primary checkout, `images/`, and prior rollback versions were not changed.
- API/Admin Wrangler configs list staging resource names and canonical GFS IDs. Local Wrangler dry-runs resolved the configured API and Admin bundles and show API `COD_V1_ENABLED=false`; these are **config observations only**, not authenticated live account/binding verification.
- Migration `0030_cod_v1_compat.sql` is locally tested against synthetic V1 schema. It creates COD-specific configuration/detail tables and guards. It has not been applied to D1; existing shared customer/payment/order history is unchanged.
- No new Cloudflare resource, binding, queue, R2 object, secret, Meta callback, policy, D1 row, WhatsApp message, tester order, screenshot, or WAMID was created. No backup, rollback execution, active version check or remote integrity result is claimed.
- Protected HMAC key and actual courier collection/remittance contract evidence remain unverified/unprovisioned. The user reports an existing contract; no authorized details were retrieved. COD remains disabled.

## GFS-209 Live Receipt E2E (2026-10-24)

- PR #10 branch `codex/gfs206-v1-receipt-hotfix`, latest code head `d6ca1a5`. V1-only staging Worker `getfreeseeds-api-staging` deployed as `76084318-69c7-46b3-bfa0-886610971133`; immediate rollback `7b957406-c869-4461-b184-da230f4d29e3`. PR #9/V2 reminder runtime untouched.
- Existing bindings only: D1 `getfreeseeds-staging`, private R2 `getfreeseeds-receipts-staging`, Queue `getfreeseeds-events-staging`, canonical Meta Phone/WABA. No migration, new binding, secret change, queue purchase or new resource.
- Live target receipt `4f8e2e7c-b5f8-4fdb-a85e-a88687a8af6e`, MIME `image/jpeg`, 79,863 bytes. D1 event type `MEDIA`/`RECEIVED`; Admin preview endpoint returned the private R2 image. Order remains `PAYMENT_REVIEW`/payment `PENDING`.
- Real outbound acknowledgement WAMID is privately retained, SHA-256 prefix `7a14232e1692916d`, D1 status `READ`; inbound WAMID prefix `bf0c88050136fbe3`. Raw IDs and image bytes remain outside Git. Sanitized screenshots are under `D:\Temp\kilo\gfs209-admin-e2e.png` and `D:\Temp\kilo\gfs209-admin-preview.png`.
- Meta: canonical number connected/quality High; permissions granted; WABA and `messages` callback subscription active. `EXPIRED` is code-verification status. One request-code attempt returned HTTP400; no retry/re-registration, known charge, or state mutation.
- D1 preflight quick/FK/schema checks read 8,943 rows; exact indexed lookups show one event/receipt/ack. No broad D1 scan. Zero resource purchases; `images/` and Hoja isolation preserved.

## GFS-208 Receipt Hotfix Resources (2026-10-24, historical snapshot superseded by GFS-209)

- GitHub PR #10 branch `codex/gfs206-v1-receipt-hotfix`, including GFS-208 code commit `2822de7`; candidate is V1-compatible and has no schema changes. PR remains open; no branch protection/ruleset is configured, but no merge or CI bypass occurred.
- Active API `getfreeseeds-api-staging` version `9b5f13ae`; immediate rollback `8da54b28`. Dry-run retains canonical staging D1 `getfreeseeds-staging`, private receipts R2 `getfreeseeds-receipts-staging`, event Queue, and canonical Meta Phone/WABA bindings. No binding/secret changes.
- Cloudflare/Admin identity verified against the GFS account. D1 supported preflight: `quick_check=ok`, FK check empty, `customers.wa_id` and `normalized_whatsapp_number` present. 9,267 rows read by checks; no broad event/order scan. No migration, D1 write, R2 object, queue job, purchased resource, or additional cost.
- Existing browser Meta Developer app is the canonical Get Free Seeds app/business. `messages` is subscribed to the staging `/webhooks/whatsapp` callback. Admin Graph status reports WABA subscribed, canonical phone configured, and registration status `EXPIRED`; owner-side Meta revalidation is required before a real outbound acknowledgement retest.
- Target order remains pending with no receipt; private R2 object and D1 receipt count are zero. Inbound WAMID SHA-256 fingerprint prefix is `2ef787841e6d07e0`; raw ID remains private. No screenshots/customer identifiers/receipt bytes are retained in the repository. Existing `images/` remains untouched; Hoja assets were not opened or used.

## GFS-199 Current Runtime (2026-10-23)

- API `9b5f13ae-f023-4fa8-befe-2085bb24cbda`; rollback `8da54b28-4bec-45b2-9a3f-672225dba843`. Admin unchanged `9482bd56-ca4c-4d81-b2e3-6bfe59162ac0`; request queue flagfalse.
- CMS published OFFER5,RECEIPT2,PAYMENT2,FERTILIZER7. Rollback OFFER4/RECEIPT1/FERTILIZER6 coordinated with old API. No ledger replay; predeployment bookmark `0000018e-00000000-0000510d-cc9254c7e25248832583f2ac94a5dd1e`.
- Own tester exact match via You > View Profile; canonical sender Contact Info match; Admin/Cloudflare correct. Canonical Graph permissions/subscription passed; separate Meta browser operator residual not reverified. No Meta settings or unrelated tabs operated.
- Agent-driven safe order FS-261023-000001,PKR500;0 receipts,PENDING. Later read-only D1 shows all3 READ text/QR pairs but3 DEAD_LETTER instruction jobs; pause activity is not attributed to the resumed agent. No replay or financial mutation.
- Fresh full WAMIDs/private screenshots under `D:\Temp\kilo\gfs199-*`, outside Git.169 tests/lint/build/audit0/dry-runs/live OFFER pass. Held incident remains held.

## GFS-197 Runtime/CMS Gate (2026-10-23)

- PR #8 start head `8af1a877`; current Admin `9482bd56`, API `8da54b28`. Admin identity `gisupp@gmail.com` verified. Current authorized tester Profile does not match; no API deploy, profile change or message.
- OFFER v5 and RECEIPT v2 drafts remain unpublished; OFFER draft has the bilingual advance-payment/no-COD notice and two stable action labels. Active PAYMENT v2 and published OFFER/RECEIPT remain intact. No CMS publication in GFS-197.
- Live Admin reference/settlement gate remains deployed; REVIEW ref absent, window closed, request queue disabled. All3 methods remain enabled/QR-audited; no settings or R2 change. No new order/message.
- D1 API7403 remains on direct Wrangler read; same-origin Admin GET is available. Ledger remains empty; migrations0027-0029 were already applied. Do not replay history or change scopes/accounts.
- GFS-197 records commit `b022bb94ec5974f124c283a7cefa801f2ec25506` is on PR #8; CI `39907703609` had no steps because of the billing lock.

## GFS-196 Current Release Gate (2026-10-23)

- PR #8 start head `8af1a877`; GitHub gardenshop, Cloudflare/Admin `gisupp@gmail.com` verified. Existing Admin Test Controls page and WhatsApp Web tab reused. Own WhatsApp Profile does not match the authorized tester; no new account/phone.
- Admin `9482bd56-ca4c-4d81-b2e3-6bfe59162ac0` and baseline rollback `132f5ea9-324f-482d-b350-f52bc6907758`. API `8da54b28-4bec-45b2-9a3f-672225dba843` remains active with rollback `5151e081-98ab-45c4-a57f-3ba43c4e6983`; GFS-196 did not deploy.
- Admin reads show OFFER v5/RECEIPT v2 drafts; published versions are OFFER v4/RECEIPT v1 and PAYMENT v2. No publication because current API does not implement the draft callbacks/reference prompt.
- Direct Wrangler D1 reads API7403; same-origin Admin GETs work. No scope/account change or D1 mutation. Migration ledger history remains empty and no replay is allowed.
- One receipt-backed REVIEW payment lacks reference; service window closed. Request Reference flag remains false. No reference, settlement evidence, message, order or payment state changed.
- Local validation168 tests/lint/build/audit0/dry-runs PASS; CI lock not bypassed. No new WAMIDs or screenshots. Existing methods and current QR audits unchanged.

## GFS-195 Current PAYMENT Review State (2026-10-22)

- Starting PR head `2f0316d`; GitHub gardenshop, Cloudflare/Admin gisupp account and canonical Meta Graph sender verified. Authorized tester own WhatsApp Profile mismatched; no profile/number change and no send.
- D1 quick/FK health clean. Migrations0027/0028/0029 applied; method-scoped reference uniqueness now matches case/ASCII-whitespace normalization and OFFER action-label schema. Normalized duplicate groups0; existing43 action-label rows retained; legacy ledger0 not fabricated/replayed. Retain the current Time Travel recovery procedure.
- Admin live version `9482bd56-ca4c-4d81-b2e3-6bfe59162ac0`; previous rollback `132f5ea9-324f-482d-b350-f52bc6907758`. Admin Save Reference/Request Reference/settlement evidence controls live; Request Reference queue disabled until API rollout. API remains `8da54b28-4bec-45b2-9a3f-672225dba843`, rollback `5151e081-98ab-45c4-a57f-3ba43c4e6983`.
- Methods remain3 enabled and one-time approved with current QR hashes matching protected audits. No method changes. PAYMENT CMS v2 remains live; OFFER v5 and RECEIPT v2 drafts saved but not published. Actual runtime still uses previous API.
- Current review pool1, receipt1, reference missing, amount consistent, service window closed. Aggregate pending22/balanced22. No customer identifier/reference or receipt content copied to logs/docs; no Save Reference value, settlement evidence, outbox message, PAID or fulfillment was created.
- Local suite168/168,lint,build,audit0,Wrangler dry-runs and live Admin retest pass. API/webhook/Offer runtime is blocked until the already authorized tester profile is restored; no CI bypass.
- GFS-195 source/tests/docs pushed to open PR #8 as `8b193aa7e8851d005372580d238002a65f25fd01`. CI `39812621109` failed before steps with the explicit GitHub account billing lock.

## GFS-193 Payment Evidence Status (2026-10-22)

- Branch `codex/gfs-launch-next-001` fetched at `de512fb` (origin matched); no GFS-193 source/runtime/deployment change. GitHub `gardenshop`, Cloudflare/Admin `gisupp@gmail.com` verified.
- Reused existing Admin/WhatsApp tabs after `list_pages`. One D1 dashboard tab was opened because none existed and later became unavailable; unrelated pages were not operated. Supplied scanner images were reviewed as owner-supported payload evidence only; no decoding or QR extraction repeated.
- Live payment API, redacted: three methods disabled, ownership0, QR refs/hashes/snapshots present, previews3/3, ready0. Published CMS v2 unchanged. No review API submitted.
- JazzCash: decoded Garden Shop label and prior masked configured-destination match are supporting only; authenticated merchant/till ownership link absent. Easypaisa: name in QR is supporting only; merchant alias-to-Garden-Shop record absent. Bank Alfalah: bank route/destination code only; authenticated exact beneficiary link absent.
- No raw merchant identifiers/provider app data copied. No account/recipient/QR change, approval, enablement, outbound payment message, or transfer. Pending aggregate21 balanced, receipts0, enabled0, approvals0. Test order from GFS-192 unchanged; no new order.
- GFS-192 active API/Admin versions and migration0026 remain in service. Legacy migration ledger0 untouched. A read-only Admin Orders GET freshly confirms the protected incident remains held. A separate D1 check with a wrong hold-column name failed without mutation.
- GFS-193 records are pushed to PR #8 in commits `930bf66` and `2f0316d`; CI runs `39783561808`/`39784012412` did not start steps because of the explicit billing-lock annotation.
- `npm ci`,159 tests,lint,build,audit0,Wrangler dry-runs pass. Current branch has no GFS-193 commit yet; PR CI lock issue unchanged.

## GFS-192 Current Live Resources (2026-10-22)

- Canonical GFS account/operator and approved tester verified; same Admin/WhatsApp tabs reused. One canonical Cloudflare D1 tab was opened when none existed, later externally closed. Meta tab/selected WhatsApp chat changed externally; destination was rechecked before every test send. No unrelated message or Meta integration mutation.
- D1 SQL restored without account/scope changes. quick_check=ok; FK violations0. Direct schema corrected GFS-191: last_inbound_at was absent until exact migration0026 applied in this execution.33 old conversation rows remained null. Ledger0 remains an explicit maintenance issue; never replay all pending files or invent entries.
- Pre-migration recovery bookmark `0000015a-00000000-0000510c-897d4839155526e3b003252d4168724a`; post `0000015d-00000006-0000510c-3b3f10432e4257c11517ac8dc4d51e82`. Recovery only; do not restore over subsequent orders without approved incident procedure.
- API live `8da54b28-4bec-45b2-9a3f-672225dba843`; Admin live `26ac1162-ef03-41c2-bd47-9472d325b690`; baseline rollback API5151e081/Admin6fb34f89 (full IDs in STATUS). Canonical D1/R2/Queue/Phone/WABA retained; CAPI and Instant Form false.
- Approval workflow hardened/deployed from source `3c837ed`; no live approval. All3 QR private previews load and integrity flags remain passing, but provider proof/owner/enabled remain0. Missing links: authenticated JazzCash till ownership, Easypaisa merchant alias mapping, Bank Alfalah exact QR-destination-to-Garden-Shop bank mapping.
- PAYMENT CMS v2 is published EN/UR with order and authoritative amount placeholders; previous v1 available for rollback. Method localized copy complete; safe no-op draft save/reload works. No fixed checkout amount configured.
- Real lead-only test FS-261022-000002/PENDING/PKR500/no method/no receipt.15 new READ outbound WAMIDs; private evidence JSON and2 cropped PNGs under `D:\Temp\kilo\gfs192-*`, outside Git. Urdu test stopped at FULL_NAME without duplicate order.
- Current pending21 (20 pre-existing +1 safe test),balanced totals21,receipts0; held incident unchanged. No payment instructions,QR media,receipt upload,funds,PAID or fulfillment.

## GFS-191 Payment Activation (2026-10-22)

- Start/refreshed branch head `76b08d1`; GitHub `gardenshop`; Cloudflare Wrangler and same-origin Access identity verified for the configured GFS operator. Tokens and raw beneficiary identifiers are not recorded.
- Chrome DevTools MCP works; existing Admin tab reused. Admin GETs return current payment/CMS/order state. Direct Wrangler D1 execute API7403; configured migration path is now `../../migrations`. Remote migration tracking reports all26 pending despite live `last_inbound_at` being selectable through Orders; never replay the full set or fabricate migration records.
- Method states (redacted): all three disabled and ownership false; R2 reference and QR hash exist; QR readiness blocked on independent ownership. EN/UR settings and placeholder checks complete; sort orders unchanged; global payment amount unset. No QR bytes or raw keys read.
- Exact missing evidence: JazzCash provider link from decoded till to Garden Shop; Easypaisa authenticated merchant alias-to-destination mapping; Bank Alfalah bank confirmation of QR destination to Garden Shop IBAN/Raast. Owner statement alone does not satisfy independent proof. No enablement or settlement.
- Published PAYMENT CMS v1 in EN/UR has order placeholder, not amount; draft v1, no action IDs. No CMS write. Payment method buttons remain runtime-generated; Check Order remains under order status.
- `last_inbound_at` column exists, but all20 current pending orders have null/missing inbound timestamps and no receipts. No contact. Held incident remains held.
- Source/records pushed to PR #8 as `4aed0e800e7c42f14c633e64a41e7843952d350f`: root Wrangler migrations directory; safe `{amount}` placeholder and persisted-order amount injection; bilingual fallback; protected one-time beneficiary approval UI/API with audit, duplicate protection, and recipient-change revocation. Validation:145 tests, lint, build, audit0, clean install, API/Admin dry-runs, Chrome list/GET PASS. Approval workflow is not deployed or used; no D1 write. CI `39756357140` failed before steps.

## GFS-190 Emergency Payment Recovery (2026-10-22)

- Fetched PR #8 branch `codex/gfs-launch-next-001` at `e17684c`; GitHub identity `gardenshop`; Wrangler identity `gisupp@gmail.com` / canonical GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- Chrome MCP `list_pages` works in this session (10 existing pages, same Admin tab reused). Payment Settings renders three `Draft / incomplete` methods; active Admin identity is not visible. No Admin, Meta, WhatsApp, payment, or order mutation.
- Wrangler D1 `SELECT 1` and explicitly masked reads succeed on staging `getfreeseeds-staging` (`17b7e9f6-e08b-4bff-a756-10de30b49ab1`). Dashboard/API7403 is not reproduced through Wrangler. Do not switch accounts/scopes. Cloudflare Access/consent state must be restored by the authorized account operator before Admin mutation.
- Current API `5151e081-98ab-45c4-a57f-3ba43c4e6983`; rollback `8a045e16-17c5-4663-bc65-f8c815712ce9`; Admin last deployed `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`. Dry-run bindings remain canonical GFS; CAPI and Instant Form are false; guided mode and canonical Phone/WABA IDs unchanged.
- D1 schema confirms `whatsapp_conversations` has no `last_inbound_at`; migration0026 remains unapplied. Latest event receipt is `2026-10-22T07:41:17.998Z`; recent aggregate is not an inbound eligibility proof. No staging mutation/deploy; R2 binaries not freshly fetched.
- Redacted method flags: all three `enabled=0`, `qr_owner_verified=0`, active QR provenance and decoder/payload/scan flags pass, independent evidence absent, amount configuration absent, localized copy completeness false. Keep non-payable.
- Screenshot-referenced pending order's total matches the supplied screenshot; state is DETAILS_COMPLETED/PENDING with no selected method/receipt. Current pending pool:20, zero receipts; 14 no method and six historical selections. No messages/replays.
- Exact missing evidence: JazzCash authenticated till ownership record; Easypaisa authenticated alias/destination mapping; Bank Alfalah authenticated QR-to-IBAN/Raast beneficiary mapping. No owner/provider proof or enablement.
- `npm audit fix` updated lockfile only; clean install/full143/build/lint/audit0/API+Admin dry-runs pass. No deploy, WAMID, receipt, payment, PAID, fulfillment, or customer follow-up.

## GFS-189 Inbound-Time Migration

- New migration `0026_whatsapp_last_inbound_at.sql`; API route persists `last_inbound_at` from first unique signed inbound event receipt timestamp. No historic backfill. Core `isInsideWhatsAppServiceWindow` enforces a strict24h boundary.
- Stale synchronous replies set outbound PERMANENT_FAILURE. Expired direct/queued payment instructions are skipped/terminalized, audited, and never sent/retried absent an approved utility template. Status/outbound callbacks don't advance time; duplicate provider message IDs keep original `created_at`.
- Admin conversation/test-controls include lastInboundAt; tester reset clears it without deleting history. Existing GFS188 orders were not backfilled or messaged.
- Tests143/143, build/lint/audit0, API/Admin dry-runs pass. Migration/API/Admin changes not deployed due missing Chrome MCP/live retest. Current staging versions API5151e081/Admin6fb34f89; rollback8a045e16.
- User-facing CMS intro, recipients, amounts, new-number eligibility and ads remain unchanged/unverified. No messages/payments/Meta ads/number changes.

## GFS-189 Inbound Service-Window Migration

- Source commits `41d94b061bb4830aeefa3eb8ed7d5248ad541c6a`, `fcc41c97cb10d0291a3654a2512df570746efc2d`, and `80a09908562d2198f02e837b8a893e8f5bf83d1b` (baseline `86c1cc8`); additive migration `0026_whatsapp_last_inbound_at.sql`; API helper `persistInboundConversationActivity`, pure 24h validator `isInsideWhatsAppServiceWindow`; Admin Orders/conversation endpoints include lastInboundAt and reset clears it.
- Timestamp derives from first signed/canonical inbound webhook event's `whatsapp_events.created_at`, not Meta client data/order creation/conversation.updated_at. Unique provider event ID preserves original timestamp on duplicate; no backfill.
- Direct free-form retries and queued payment instructions require <24h. Missing/expired window terminalizes with reason/audit, ACKs and does not send. No approved utility template or historical replay.
- Payment instruction outbox/text/QR keys use a hash of the signed inbound message/Flow request ID. Same-event retries deduplicate; a later authorized customer selection gets a fresh key without persisting raw WAMID/token.
- GFS-188 four new orders remain pending and unchanged; existing old conversation timestamp nulls remain null until next authenticated inbound. No provider message, receipt or paid transition.
- Final remote D1 query returned Cloudflare API7403 with the correct GFS identity; no retry/account switch. Current orders remain unverified pending owner access restoration.
- Chrome MCP remains unavailable; migration/API/Admin changes not deployed. API5151e081/Admin6fb34f89; rollback8a045e16. Local npmci/focused52/full143/build/lint/audit0/Wrangler dry-runs pass. Post-push CI39578100146 ran zero steps under known billing lock; no bypass.

## GFS-188 New Orders and Release Boundary

- Branch `codex/gfs-launch-next-001`, PR8, baseline9aa63af. Chrome MCP config enabled globally but namespace absent in current agent; Chrome process lacks remote-debug flag/DevToolsActivePort and bridge process absent. No raw CDP; host/session reconnect is required.
- New D1 orders `FS-261021-000001`–`000004`: state DETAILS_COMPLETED, payment PENDING, totals PKR2000/2750/6250/1000; method, receipt and transaction reference absent. There is no outbound_message for these orders; one CAPI_LEAD pending job per order, no Meta delivery proof.
- Pending pool: 11 details-completed/no method, six older PAYMENT_PENDING with five historical JazzCash and one Easypaisa selection, all receipts0. Methods now disabled; no resend/replay.
- Last inbound message ID exists but no exact `last_inbound_at`; conversation `updated_at` is not a reliable service-window timestamp.
- Payment CMS template `PAYMENT` published version1; boolean search confirms requested EN/UR introduction absent. No authenticated CMS UI/publish. Amount configuration unset; methods disabled and independent evidence false.
- Existing Worker versions API5151e081/Admin6fb34f89; rollback8a045e16. No GFS188 deploy, config edit, payment, ads, or Meta call.
- Latest CI run `39558601305` failed before steps under known account billing lock; no bypass.

## GFS-187 Admin Payment Save Fix

- Starting source `7bbea9d`; modified Admin payment-copy save only. Copy branch no longer writes recipient/till/enabled/QR/owner columns; DB recipient-change guard remains authoritative. Identity changes disable + clear verification and trigger the audited 0024 asset evidence reset. Response reads persisted enabled/owner state.
- Focused synthetic SQLite test: verified enabled method retains enabled/verified/evidence on copy-only edit; recipient change returns disabled/unverified and records re-verification. No authentic data in fixture.
- CI run `39500843883` at baseline `7bbea9d` failed before steps under existing billing lock; no protection bypass.
- Fix/docs commit `ebb10a9637245317c517ed3ccbb230fc9cac10a1` pushed to PR #8; CI run `39558420776` has an empty steps array, consistent with billing lock.
- Current staging versions unchanged: Admin `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`; API `5151e081-98ab-45c4-a57f-3ba43c4e6983`; API rollback `8a045e16-17c5-4663-bc65-f8c815712ce9`; prior Admin deployment listed by Wrangler. No staging deploy.
- QR assets unchanged; prior integrity passes reused. All three method owner flags false/evidence refs absent, enabled false. No payment configuration/transfer/receipt/PAID.
- Chrome DevTools MCP unavailable in GFS-187; no list_pages/profile/admin/provider UI, live E2E or WAMID. Existing GFS-183 actual E2E remains separate historical evidence.
- Sensitive-output incident: broad D1 query in this run included unmasked payment recipient identifiers. No values copied into repo docs/code or used. Owner security review/possible rotation required; future D1 payment reads must mask values.

## GFS-186 Offline Payment Lab

- Source starting baseline `164c33d`; changes are fixture-only + test + package-lock peer security update. Harness `tests/fixtures/nonpayable-checkout.html`; synthetic receipt `tests/fixtures/receipt-nonpayable.svg`; test `tests/nonpayable-harness.test.ts`.
- Serve safely with CWD `tests/fixtures`, `python -m http.server 5178 --bind 127.0.0.1`; stop server after use. CSP `connect-src 'none'`; no API calls, no customer messaging, no D1/R2, no persistence; receipt File stays in memory/blob URL and object URL is revoked on reset. Three unique synthetic QR-like assets are NOT SCANNABLE.
- Chrome private screenshots in `D:/Temp/kilo/gfs186-*.png`; no screenshot or test file is uploaded to R2/Meta or a real order. Test order `NP-TEST-000001` exists only in memory and resets on reload; remote D1 NP-test count is0.
- EN test total PKR900 TEST (fertilizer250 + Test South fee150 + fixture base500). UR PKR600 TEST (Seeds Only + Test North fee100 + fixture base500). No relationship to Garden Shop catalog/fees.
- Methods: JazzCash TEST-JC-001 synthetic recipient QR-like hash350099772; Easypaisa TEST-EP-002 hash909545255; Bank TEST-IBAN-003 hash2699088081. All synthetic, non-scannable, unique, locale-aware and crossed checks pass.
- Browser Admin rejection, simulated approval and fulfillment are memory state only, explicitly `NOT PAID` and `NOT DISPATCHED`. No D1 `PAID`, receipt object, Purchase, transfer, or fulfillment record.
- Meta state: clean dataset allowlist verified Garden Shop only in GFS-185; GFS-185 security incident remains. Removed list token-free confirms Hoja, Wix, Daraz, WooCommerce and Zapier all Removed; no Restore UI. Bearer invalidation needs owner confirmation.
- Real staging unchanged: API5151e081, Admin6fb34f89, rollback8a045e16; all payment methods disabled; CAPI/Purchase OFF; incident FS-261019-000001 held.
- Quality: npm ci;137 tests/build/lint/audit0/Wrangler dry-runs PASS. package-lock updates Vite peer8.3.4 and transitive fixes.
- GFS-186 commit `c94b17874fdf6a33ea4cfad02a8cb963d423bca3` is pushed to PR #8. CI `39500604300` explicitly failed before steps because the account is billing-locked.

## GFS-185 Meta/Payment State (2026-10-20)

- Branch start `3060e9c`; no source/Worker changes. API `5151e081-98ab-45c4-a57f-3ba43c4e6983`, Admin `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`, rollback `8a045e16-17c5-4663-bc65-f8c815712ce9`.
- Meta clean business `568026370701542`; Free Seeds dataset `1210750267244729`, owner Garden Shop, business-connected, Web-only, no activity174 days. After exact removal and fresh reload, website allowlist contains only `gardenshopfreeseeds.netlify.app`; `hojaseeds.pk` and `hojaseeds.pages.dev` are absent. Pixel detail expansion, first-party cookies and automatic advanced matching are On; consent scope is not established.
- GFS token secret exists in Cloudflare by name only. Sanitized Admin graph permissions are WhatsApp management/messaging/public profile; not dataset/Marketing API. `META_CAPI_ENABLED=false`, dataset ID unset, Purchase off. The separate Graph Explorer token exposure is documented below; no value was copied into repo records or used for an API request. No CAPI event was sent. Dataset Quality API token generation was declined because Meta states existing tokens also gain permission.
- WhatsApp Manager account remained correct GFS phone, High quality; name remains declined. Ads account showed nine campaigns Off. No campaign/CTA live preview available and nothing published/spent.
- Token handling incident: Hoja Graph Explorer token appeared in snapshot; Explorer closed, Hoja Business Integration now Removed, no API submission. Bearer invalidation is not independently confirmed without prohibited token use; account owner must confirm/revoke through Meta security controls. Meta Business Integrations also reports Wix Marketing Tools, Daraz Seller Center, WooCommerce by Meta, Zapier as Removed. Removed UI has no Restore control. Provider-owner reauthorization required for those four; do not restore Hoja.
- Post-push CI `39491350447` has zero steps and explicit account billing-lock annotation. No CI protection bypass.
- Provider evidence remains unavailable; payment methods disabled; financial incident/order history protected. GFS-183 real Chrome report remains source for order/WAMIDs/screenshots.

## GFS-184 Payment Journey State (2026-10-20)

- Start `492e1a49676930b5d24a571cb2b23f1fd48f2c54`; no source/Worker changes in GFS-184. Current runtime API `5151e081-98ab-45c4-a57f-3ba43c4e6983`, Admin `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`, rollback `8a045e16-17c5-4663-bc65-f8c815712ce9` unchanged.
- Historical `8f1c2da` is documentation only; `c57c252` locale/QR/idempotency/signed sender/receipt hardening is present. Current active provenance + independent ownership constraints retained.
- Authenticated Admin identity `gisupp@gmail.com`; JazzCash/Easypaisa/Bank Transfer each have a private method-matched PNG and complete localized text; all `enabled=0`, owner false, amount/payment config absent. QR assets were only read/rendered, never delivered to WhatsApp or changed.
- Current live order is GFS-183 `FS-261020-000011`, DETAILS_COMPLETED/PENDING, Punjab250, no method/receipt. Historical incident FS-261019-000001 remains under hold. No payment, PAID, fulfillment, order reset or CMS/payment setting mutation.
- GFS-184 local synthetic payment-tail tests cover three distinct method copy/QR mock paths, amount/order text, private no-store receipt fixture, and Admin rejection status. No staged fixture/config or real provider message exists.
- Post-push CI run `39477757383` for commit `2b919b0` ran zero steps and explicitly reports account locked due to billing issue; local gates pass and repository protections were not bypassed.

## GFS-183 Deployed Real Chrome Evidence (2026-10-20)

- Baseline `0413a20`; runtime source `79b503397af73e4836b389314407cbcd8fc2d86c`; isolated test coverage `d052ca3`; branch `codex/gfs-launch-next-001`, PR8. Preserved `images/` untouched.
- API deployed `5151e081-98ab-45c4-a57f-3ba43c4e6983` at17:51:49Z; author gisupp@gmail.com; unchanged clean GFS D1/R2/Queue bindings. Admin remains `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`. Immediate API rollback `8a045e16-17c5-4663-bc65-f8c815712ce9`; older `c3fa866b` retained. No rollback executed.
- Additive staging schema `0025_whatsapp_sender_rate_limit.sql`: hashed admission table/index/atomic trigger. No raw sender, payload or real delivery data in the new table. Real admission count19/hash length64; isolated overflow probe rejected31 and left0 rows.
- Fresh real order `FS-261020-000011`, UUID `5a1d6e64-12d9-410b-8fe1-f56b3c1eb12d`, created17:58:07.660Z. English/Seeds Only/Punjab; total250/delivery250/fertilizer0; DETAILS_COMPLETED/PENDING; no method, receipt, transaction, approval or fulfillment. Admin WHATSAPP_SUBMITTED audit and all five synthetic fields reconcile. One new order remains after repeated confirmation and Urdu status.
- Nineteen outbound WAMIDs created17:52:39Z-18:03:52Z all READ. Exact per-step IDs and expected/actual results in FINAL_REPORT. Nineteen masked private screenshots `D:/Temp/kilo/gfs183-01-welcome.png` through `gfs183-19-urdu-name.png`; files are local only, not Git/R2/public assets.
- Authenticated private drafts: JazzCash299742 bytes, Easypaisa82555 bytes, Bank Transfer22963 bytes; each PNG renders800x800, cache private,no-store. All disabled, owner flagsfalse. No QR re-extraction or beneficiary field change.
- Clean dataset1210750267244729 exposes Test Events; no authorized clean token. Explorer selected Hoja Lead Integration; its existing token was not used/exported/submitted. No event acknowledgement; CAPI false and new lead event PENDING/0.
- Local tests135/135 plus npmci/build/lint/audit0/API+Admin dry-runs. Live health/privacy/data deletion200, unsigned callback401, unauthenticated Admin302 to Access. CI39474453497 on source/evidence tip89128d1 has zero steps and explicit account billing-lock annotation, matching baseline39467663972; protected policy unchanged.
- Historical Purchase DLQs2 and payment failures remain unchanged; held incident FS-261019-000001 unchanged. No Purchase replay, payment, approval, PAID, dispatch or production release.

## GFS-182 Final Launch Readiness (2026-10-20)

- Fetched baseline `72fd50e356bf39467e821cd73afcd0406b955029`; GFS-182 source commit is `b4e3f861a63afef3cdd1553a332e693072e18f39` (monotonic webhook status guard and synthetic regression test). PR #8 remains open on `codex/gfs-launch-next-001`; `images/` is preserved and untracked.
- Chrome evidence: initial `list_pages` returned 11 existing tabs; one dedicated Events Manager tab was opened for the new CAPI task, total 12. Meta developer tabs remained DNS errors; Ads/Forms, Events Manager, Admin, and WhatsApp surfaces were read-only. No unrelated tab/message/ad/payment/brand mutation.
- CAPI dataset evidence: clean `Free Seeds` dataset ID `1210750267244729` is visible in the authorized Meta Events Manager under the current business context, with `No Integrations`, zero event activity, and a Test Events tab. No test code, token, permission, event, or acknowledgement was created. Hoja dataset visibility was not used.
- Runtime CAPI state: `META_CAPI_ENABLED=false`; no `META_DATASET_ID` or token value is configured in Wrangler vars. Staging D1 has 14 pending Lead events at attempt 0/no provider response and historical Purchase dead-letter groups at five attempts. No replay.
- Reliability change: `whatsapp_events.provider_event_id` remains unique and inbound payloads remain hashed only; outbound status updates now use monotonic rank `SENT=1`, `DELIVERED=2`, `READ=3`. Synthetic concurrent/duplicate/delayed/reordered coverage passes.
- Queue/DLQ: five-attempt retry/backoff and terminal dead-letter states are covered. No automatic DLQ replay route is registered; any future recovery requires authorized operator evidence and audit.
- Public gates: privacy/data deletion, signed/canonical callback, Admin Access/CSRF, eligibility, idempotency and local error handling pass; no runtime rate-limit control or public consent/CAPI acknowledgement is evidenced.
- Staging Workers unchanged: API `8a045e16-17c5-4663-bc65-f8c815712ce9`, Admin `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`; rollback `c3fa866b-2751-4eea-83ed-5ef4d0667de1` retained. No GFS-182 deployment.
- Quality: focused `63/63`, full `132/132`, build/lint/audit and API/Admin dry-runs PASS. GitHub verifies `39465975146` and post-push `39467542844` failed with no runner/steps under billing lock; no bypass.
- Financial protection: all three payment methods remain disabled/unverified; `FS-261019-000001` remains held; no receipt, transfer, approval, PAID, Purchase replay, dispatch, or tracking mutation.

## GFS-181 Payment Resolution and Launch Completion (2026-10-20)

- Fetched baseline `420f2b49dacc1320a49a3b94168f14b81c03fc96`; final GFS-181 commit `ba7376e` is pushed to `origin/codex/gfs-launch-next-001`; PR #8 remains open. Preserved `images/` is untracked and untouched. Hono lockfile was updated to the audited non-vulnerable patch release; no Worker deploy followed.
- Identity evidence: GitHub `gardenshop`; Wrangler/Cloudflare/Admin `gisupp@gmail.com` in account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. No secret, token, cookie, full recipient value, receipt, or real customer export is recorded here.
- Browser evidence: Chrome `list_pages` first returned 11 existing pages. Meta tabs were inspected read-only; two returned `DNS_PROBE_FINISHED_NO_INTERNET`. Admin Payment Settings, WhatsApp CMS, and WhatsApp tabs were reused. No unrelated tab/message/action was changed.
- Payment methods: JazzCash, Easypaisa, and Bank Transfer each have a private R2 QR, D1 hash metadata, complete saved EN/UR copy, and draft configuration. Current D1 state is `enabled=0`, `qr_owner_verified=0`, `paymentConfigured=false` for all three.
- QR asset state: each active method-linked provenance row has decoder agreement, payload match, scan pass, and source/derivative/payload hashes. Each lacks `independent_ownership_verified` and an independent evidence reference. Owner statement remains `USER_ASSERTION_GFS-176` only.
- Beneficiary evidence: JazzCash decoded identifier equals configured D1 identifier but has no independent wallet proof. Easypaisa decoded identifier differs from D1 and matches a printed alias candidate, with no independent alias proof. Bank Transfer decoded destination matches neither configured D1 IBAN nor printed alternate. No provider/bank record was accessible in this run; methods stay disabled.
- Current staged Workers are unchanged: API `8a045e16-17c5-4663-bc65-f8c815712ce9`, Admin `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`. API rollback `c3fa866b-2751-4eea-83ed-5ef4d0667de1` remains recorded and unused. No D1/order/financial rollback.
- Quality evidence: targeted affected tests `53/53`; full suite `131/131`; build/lint/audit and API/Admin dry-runs PASS. GitHub verify `39448956004` stopped before steps with no assigned runner; no bypass.
- Financial protection: `FS-261019-000001` remains under fulfillment hold with missing customer transaction reference. No receipt, transfer, approval, PAID transition, Purchase replay, dispatch, or tracking mutation.

## GFS-178 Verified Context / Versions (2026-10-20)

- Admin `VALIDATION` CMS smoke: version 2 added a harmless EN/UR retry suffix, was published and observed on real tester replies, then rolled back to approved version 1. Version 2 is archived. Draft version 3 matches published version 1 exactly.
- Admin `CONFIRMATION` typo `Total ayable` was corrected to `Total payable` in EN; Urdu and D1 placeholders were unchanged. Published version 3 was verified using real unpaid test order `FS-261020-000010`.
- CMS validation WAMIDs: EN temp `wamid.HBgMOTIzMDM0OTAxODEwFQIAERgSREVGMUY3RDFDRTdFRkM5ODEwAA==` READ; UR temp `wamid.HBgMOTIzMDM0OTAxODEwFQIAERgSMEM4QTJGRjk3RkZGMUVFOURDAA==` DELIVERED; restored UR `wamid.HBgMOTIzMDM0OTAxODEwFQIAERgSMDM2MjIwNEJDOUI1QjczMDc3AA==` DELIVERED. Order `FS-261020-000010` remains DETAILS_COMPLETED/PENDING, null method, zero receipt.
- Git baseline `c9cfdbc7e403bbeae476f4cf9ce0a0624af172cd`; source commits `8699d67`, `78b1de8`, `d2082e4`. Authorized GitHub gardenshop, Cloudflare gisupp@gmail.com / cb5066a6d71ecdee0bd7ed8aacb4d3c2, Admin Access identity verified before mutations. No Hoja interaction.
- Canonical Meta phone/WABA verified through secret-safe Admin Graph status and authenticated Phone Manager: verified phone GREEN, name DECLINED, both permissions granted, subscribed. Tester own WhatsApp Profile Phone was checked against authorized number, and GFS contact details against canonical sender. Real messaging succeeded. Username unchanged.
- Name review evidence: only generic guideline rejection. Edit dialog has replacement-name input; canonical WABA Support Request Review is disabled with zero eligible issues. No appeal/resubmission, reference, profile/username/number/webhook change.
- Deployed API final `8a045e16-17c5-4663-bc65-f8c815712ce9` from d2082e4; intermediate `1e3d43e5-f6fe-45b4-b959-0376e5197bc9`, `c3fa866b-2751-4eea-83ed-5ef4d0667de1`; Admin unchanged `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`. API is active webhook; no production promotion/ads/spend.
- Rollback: after identity verification, `npx wrangler rollback c3fa866b-2751-4eea-83ed-5ef4d0667de1 --config apps/api/wrangler.jsonc` restores the prior compatible fix; baseline `4779d60b-6f93-41d4-b1e3-1c37bdfcf599` predates safeguards and must not be restored without evaluating stale payment risks. Do not roll back D1/order/financial data. Versions recorded, rollback not executed.
- Actual synthetic-data lead-only orders: EN FS-261020-000008 (250 delivery/0 fertilizer/250 total), UR FS-261020-000009 (250/250/500). Both DETAILS_COMPLETED/PENDING, null method, zero receipts, no Purchase. Authenticated Admin UI and API match; historical customers/orders preserved. Tester conversation resets audited; existing tester cooldown exemption reused, not changed.
- Each new order has an idempotent `AUTHORIZED_SYNTHETIC_DATA_TEST_ORDER` audit label identifying real WhatsApp transport but synthetic delivery data and no payment/fulfillment authorization. Order/payment states were not altered by labeling.
- Private screenshots verified by image read: D:\Temp\kilo\gfs178-en-status.png; gfs178-ur-province.png; gfs178-ur-status.png. History/unrelated UI masked. EN province screenshot blank and discarded as evidence. No screenshot/source QR/customer body committed.
- Representative exact live WAMIDs and inbound correlations are in FINAL_REPORT. Source of truth: outbound_messages + whatsapp_events with provider READ/DELIVERED status; no simulated ID is listed as real.
- CI check annotation for run 39420605812: account locked due to billing issue. No runner/steps; no paid change. Actual branch protection/rulesets absent; current nonblocking-CI staging rule used.
- QR originals/derivatives untouched; methods disabled/unverified; no bank/wallet authenticated ownership record available. Incident PAID/PACKING/reference missing unchanged; Purchase FAILED/5/DISABLED. New Lead events remain pending (CAPI disabled); no replay.

## GFS-177 Active Staging/Meta Context (2026-10-20)

- Admin staging Worker deployed: `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`. Fresh authenticated UI reload verifies all three EN/UR payment previews against D1, no Urdu contamination in English, method-specific QR paths, and `enabled=0` / `qr_owner_verified=0`.
- Province selector code is pushed as `0e12c623b37aafca7a2382ed697fcdea272d2535`; it builds LIST rows from seven enabled staging D1 rates and the bilingual published CMS list-button label. Each row uses the D1 province title and formatted D1 fee, with Meta title/description/10-row validation. The API code is tested locally but not deployed.
- Canonical Meta Business/WABA context matches current rules. Phone Manager shows the authorized sender Connected/High quality but display name `Get Free Seeds` Rejected. Developer Webhooks shows the WABA `messages` field subscribed to the staging API callback. No Meta display-name, callback, WABA, ad, or app mutation.
- Admin Test Controls identifies the authorized tester and an existing pending order; no reset or order change. WhatsApp Web has no chat for the tester and the logged-in account number did not match/was not visible. No test message/WAMID/screenshot.
- Outbox audit found 12 `WHATSAPP_PAYMENT_INSTRUCTIONS` jobs PENDING with zero attempts. After verifying the GFS Cloudflare account, all 12 were marked `PERMANENT_FAILURE` with `GFS177_PAYMENT_METHODS_DISABLED` audit entries. Existing SENT outbox/message records and all order/payment state remain unchanged.
- API staging is `getfreeseeds-api-staging` and currently serves the active WABA callback. No API deployment was made because new code could affect live inbound users; the display name and tester path are unresolved. Admin-only deployment was made after local gates.
- Current source commit is `0e12c623b37aafca7a2382ed697fcdea272d2535` on PR #8 branch `codex/gfs-launch-next-001`. The only untracked project data is the preserved `images/` directory.

## GFS-176 Continued Execution (2026-10-20)

- Read-only identities verified: GitHub `gardenshop`; Cloudflare `gisupp@gmail.com` / account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; canonical Admin Cloudflare Access `gisupp@gmail.com`. No Meta identity/asset mutation was made.
- Chrome MCP was restored with the existing Chrome profile; `list_pages` returned the existing 10-page inventory. No tabs were opened/navigated/closed. A contact-info panel in the unrelated WhatsApp chat was briefly opened and closed; no messages/contact data changed.
- Authorized test contact lookup: exact recorded tester number returned zero existing WhatsApp chats. The active WhatsApp account number could not be verified. No outbound message, test order, WAMID, or screenshot.
- Admin saves: JazzCash, Easypaisa, and Bank Transfer EN/UR heading/instructions/reference/receipt fields were saved via authenticated same-origin Admin API with `{amount}`, `{recipientName}`, `{tillId}`, and `{orderNumber}` placeholders. Each request returned HTTP 200. Account/recipient/QR values were not submitted or altered. D1 reflects complete localized fields; all methods remain disabled and QR ownership flags remain false.
- Old deployed Payment Settings preview still omits Urdu heading and receipt guidance because its form mapping uses the old Urdu suffix. Urdu instruction/reference appear; local PR code fixes the mapping but remains undeployed. Shared CMS was not edited.
- D1 migrations `0022_payment_qr_owner_guard.sql`, `0023_incident_fulfillment_audit_hold.sql`, and `0024_reverify_qr_on_recipient_change.sql` were applied to staging after verifying account identity. The QR guard requires exact active asset provenance, scan/decode flags, independent evidence ref, and owner flag before enablement/self-verification; recipient/account changes clear QR verification and disable the method. The incident trigger blocks new state-confirmation/tracking audit inserts for the held order. Existing flags/order state were not changed.
- Meta authority remains `META_ASSETS_PENDING` per this registry, and no authorized staging/test WABA/phone identity was established. The staging Wrangler config reports Meta provider enabled, but that config value is not external identity/authorization evidence; do not send until canonical assets/session are verified.
- `FS-261019-000001` remains PAID/PACKING/APPROVED with missing transaction reference. Purchase CAPI is FAILED with 5 attempts, error class DISABLED and no provider response ID; the Lead event is PENDING with 0 attempts because `META_CAPI_ENABLED=false`. No replay or payment/receipt/fulfillment/order mutation.
- GitHub Actions checks `39403272414` for source commit `85977d7` and `39403788146` for docs commit `603331d` both failed in 2 seconds with `runner_id=0`, no runner name, and `steps=[]`. Repo Actions are enabled and workflow uses `ubuntu-latest`; billing diagnostics require `admin:org`, absent from the verified token. No bypass/deploy.
- Local code changes for fulfillment hold, QR self-verification, and account-change revalidation are committed/pushed as `85977d77601306a13c7bcd2f7e1934047732128c` to PR #8. Clean-install local gates pass 14 files / 112 tests, build, lint, audit, and API/Admin Wrangler dry-runs. CI/deploy remain blocked.

## GFS-176 QR Assets and External State (2026-10-20)

- Starting HEAD: `df07ce54d6746842b8205fc523e9a5d14722b337`, branch `codex/gfs-launch-next-001`, PR #8 open. `images/` preserved and excluded from source changes.
- Cloudflare identity was verified as `gisupp@gmail.com`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2` immediately before each staging R2/D1 mutation. No production, GitHub merge, or Meta mutation.
- Three original staging R2 objects were independently re-read after processing; source SHA-256 unchanged. Each row in `payment_qr_assets` stores source key/hash, derivative key/hash/MIME/bytes/dimensions, exact payload hash, decoder agreement, payload match, scan result, tool versions, owner-attestation source/time, and independent verification=false. Original keys are not duplicated in this shared report.
- JazzCash: source SHA-256 `9aa906dac069e5715ad41df56ba052e50e4ddcfc6c64ac2dd4fa5b58d64fe2e2`; derivative SHA-256 `e5df57cadaba4b0c861e2ad776aed437c9c449fcba4e2c5604e846d163a93d20`; payload SHA-256 `32839f7e195de95076024eeeeb44cee856831cd4a1073858f5cbe813621e99a0`; image/png, 800×800, 299742 bytes; exact D1 identifier match; ownership BLOCKED.
- Easypaisa: source SHA-256 `33d99fe2b20981a266feff352e7a9fdf833fd7889a326c07e97cd8c715906e87`; derivative SHA-256 `2c99c5f4653050f1a1d87a690e066dfdbc0addccaba2b3b820c593c5e2b1e3af`; payload SHA-256 `092ba2aa83dda255f9495ce072456b3b5b458c3aa10e6fa7109ab664ae3b1e30`; image/png, 800×800, 82555 bytes; D1 identifier absent, printed alternate identifier exact; alias ownership BLOCKED.
- Bank Transfer: source SHA-256 `684dd8809d5bef894567142595a257086f5eb7a45d6793c51979be7f64153e18`; derivative SHA-256 `27ecfd39904082bd97aee90173cfb35509863d1b7f3e41c47bf6c1b5710578da`; payload SHA-256 `70fad5c42f711a88b513b5c962517ab3e4360228f1ba3230b89e34a7ca4b29b8`; image/png, 800×800, 22963 bytes; neither D1 IBAN nor printed alternate exact; ownership BLOCKED.
- Both decoders: `jsqr@1.4.0` and `@undecaf/zbar-wasm@0.11.0`; extractor `gfs-176-v1`. All originals and derivatives had exact decoder agreement, payload equality, and scan PASS.
- Staging D1 active QR keys point to method-specific derivatives. All three `enabled=0`, `qr_owner_verified=0`; disable action audited. The three recipient/account fields were not changed. At the initial GFS-176 extraction checkpoint, bilingual D1 content had not yet been changed; see the continuation entry above.
- Chrome `list_pages`: BLOCKED; active tool namespace absent and direct MCP initialization timed out after endpoint repair. No tabs navigated or changed; inventory unknown. No WAMID or screenshot.
- Financial recheck: `FS-261019-000001` remains PAID/PACKING with review already APPROVED, missing transaction reference; Purchase CAPI event has five attempts including dead-letter failure. No mutation/replay/dispatch.
- Existing D1 migration tracker had an empty history and showed all legacy migrations pending. Added asset schema was applied directly to staging D1; historical migrations were not replayed. Record this tracker inconsistency before future migration automation.
- Local validation after clean `npm ci`: 14 test files / 109 tests PASS; TypeScript build, lint, 0 high-severity audit findings, and API/Admin Wrangler dry-runs PASS. PR #8 prior CI failed before steps; no bypass or deploy.
- Pushed source commit `dec4f1a74b8a50111b514c3a8978f4519e2fd825` to PR #8. Required check run `39395258112` concluded FAILURE after 2 seconds with `steps=[]`; GitHub provided no job logs/reason. No bypass, merge or deploy; staging versions remain unchanged.

## GFS-175 QR Extraction Audit (2026-10-20)

- Git start SHA: `df07ce54d6746842b8205fc523e9a5d14722b337`; branch `codex/gfs-launch-next-001`. `images/` was preserved. No external mutation/deploy/push occurred.
- Chrome DevTools MCP `list_pages`: **BLOCKED**, tool namespace not exposed to this session. Local repair updated stale Codex endpoint to the current `DevToolsActivePort` UUID; reconnect not verifiable here. No tabs were inspected, navigated, or changed; unrelated tabs changed `0`, inventory unknown.
- Original QR R2 keys/checksums and recipient values were not read or copied in this run. No source identifiers, decoded payment payloads, or customer data are recorded.
- JazzCash: original **NOT INSPECTED**; QR-only derivative **NONE**; payload compare/scan **NOT RUN**; ownership **UNVERIFIED/BLOCKED**; new live WAMID/screenshot **NONE**.
- Easypaisa: original **NOT INSPECTED**; QR-only derivative **NONE**; payload compare/scan **NOT RUN**; ownership **FAIL/BLOCKED** because prior evidence records a merchant identifier mismatch; new live WAMID/screenshot **NONE**.
- Bank Transfer: original **NOT INSPECTED**; QR-only derivative **NONE**; payload compare/scan **NOT RUN**; ownership **FAIL/BLOCKED** because prior evidence records `BIO TECH - 5038`; historical unsafe QR delivery is an incident; no new WAMID/screenshot.
- Local source change only: immutable method-scoped content-addressed original keys and duplicate-byte reuse; prior R2 objects are retained. General settings cannot grant `qr_owner_verified`; ordinary saves force false. No migration/deployment or R2 write was performed.
- Local validation: `npm ci` PASS; `npm test` 14 files/106 tests PASS; build PASS; lint PASS; audit PASS with 0 vulnerabilities; API/Admin Wrangler dry-runs PASS. No remote CI was queried.
- `FS-261019-000001` remains PAID/PACKING; missing independent bank verification/reference and failed/dead-lettered Purchase CAPI history require continued fulfillment hold.

## GFS-174 Execution Record (2026-10-20)

- Git baseline: `8f1c2da`; source repair `c57c252`, documentation `8f0ab7d`/`a5d115f`; all pushed to PR #8; untracked `images/` preserved.
- Cloudflare identity verified before any mutation: `gisupp@gmail.com`, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`.
- API staging binding: `getfreeseeds-api-staging`, D1 `getfreeseeds-staging`, R2 `getfreeseeds-receipts-staging`, Queue `getfreeseeds-events-staging`, guided mode, canonical Phone ID `1323932417479627`.
- API production binding: `getfreeseeds-api`, D1 `getfreeseeds-prod`, R2 `getfreeseeds-receipts-prod`, Queue `getfreeseeds-events-prod`, `META_ASSETS_PENDING`, Meta provider disabled. No production version was deployed in this execution.
- Chrome evidence: DevToolsActivePort and bridge package were present, but this active session exposed no MCP namespace and the recovery client did not complete `list_pages`; live pages, WAMIDs, screenshots, and Admin mutations are unavailable. Staging API/Admin deployments: `4779d60b-6f93-41d4-b1e3-1c37bdfcf599` / `2cb3d3ec-9104-41d9-a3d9-45cb6b1cf8ab`.
- Financial registry: `FS-261019-000001` remains under audited fulfillment hold; no new QR ownership or payment recipient authorization was recorded.

Staging and non-secret production resources are provisioned in the dedicated clean account; production compute/secrets/integration remain gated.

## Active WhatsApp Authority (GFS-60)

- State: `META_ASSETS_PENDING`
- Authorized sender: `+923044429933`
- Phone Number ID: `1323932417479627`
- Historical only: `+923328883383` / `1429127796940691`

## Active Meta Form Launch Authority (GFS-68)

- Launch mode: `META_FORM_LAUNCH_FIRST`
- Canonical Page: `101192938541236`
- Canonical Form: `1093015800183328` / `Free Seeds 05-10-2026`
- Canonical form list verification: active form visible under Page `101192938541236`; a newer `Free Seeds 05-10-2026` form is also visible and is not substituted without verified ID/field review.
- Native Leads Center: permitted temporary capture surface.
- Payment configuration: all three staging D1 methods disabled; recipient/amount/instructions/QR values absent. No payment value is recorded here.
- WhatsApp API: `WHATSAPP_API_ENHANCEMENT_PENDING`, not a form-launch dependency.

## GFS-69 Launch Preparation Findings

- Canonical form field set: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number. Email is not part of the verified set.
- Payment ending copy is prepared as an internal, unpublished template only; no amount, recipient, QR, or account placeholder was exposed to customers.
- Receipt route: Messenger is the preferred path, but current customer-side CTA opening is not freshly proven. The previously observed WhatsApp CTA was noncanonical and remains prohibited.
- Draft campaign `120255495379100054` / ad set `120255495379110054` / ad `120255495379120054` is visible as an unpublished draft. Meta UI showed Rs2,625 daily draft budget; exact canonical Form attachment was not verified.

## GFS-70 Payment Path Authority

- D1 source: staging `payment_configuration.advance_amount_pkr` (positive integer PKR, singleton row); current value absent.
- Admin edit surface: Access-protected `/payment-amount`; method details remain in `/payment-settings` and D1 `payment_methods`.
- A method can be enabled only when complete recipient name and customer-visible instructions are present; method-specific account/TILL details and optional private QR are managed by the existing fields.
- No payment recipient, amount, QR, or customer-facing instruction value is recorded here until Garden Shop verifies it.

## GFS-71 WhatsApp Flow Commerce Authority

- Flow mode: `WHATSAPP_FLOW_CTWA_LAUNCH_FIRST`; customer-initiated Click-to-WhatsApp entry only.
- Flow endpoint: `POST /webhooks/whatsapp/flows`; encrypted Meta protocol implemented, health/ping smoke passes.
- Catalog source: verified workbook required; current result `PRODUCT_WORKBOOK_NOT_FOUND`. No production catalog values are recorded.
- Delivery source: D1 `province_delivery_rates`, admin-managed; no rates currently configured.
- Quote formula: enabled catalog product + optional enabled fertilizer + enabled province delivery fee; server-side only.
- Order source of truth: D1 orders/order_items with persisted dynamic `total_payable`; payment selection does not overwrite dynamic totals from the legacy global amount.
- Flow secret: `FLOW_PRIVATE_KEY` required in Cloudflare secret storage before Meta encrypted traffic; value is intentionally absent from this registry.

## GFS-72 Authoritative Tariff Registry

- Product `FREE_5_PACK_VEGETABLE_SEEDS`: active, 5 packs, Rs. 0.
- Product `MICRO_NUTRIENTS_FERTILIZER`: active, 1 pack, Rs. 250.
- Delivery rates: Punjab/Islamabad 250; Sindh/KPK 300; Balochistan/AJK/Gilgit Baltistan 350 PKR; all active.
- Source label: `AUTHORITATIVE_FREE_SEEDS_TARIFF_2026`; no workbook import is required for these launch rows.
- Formula: `seed_price + fertilizer_fee + province_delivery_fee`; seed price is zero and fertilizer is optional.
- Flow key state: Cloudflare secret `FLOW_PRIVATE_KEY` present by name; Meta public-key registration remains pending. No key material is recorded.

## GFS-74 Meta Runtime Gate

- Canonical Flow Manager WABA selected: `2616648355452496`; no existing Flow listed.
- Exact publication requirements shown: improve message quality and complete business verification.
- App setup exact additional blocker: missing valid payment method; App review incomplete.
- Phone status: `Pending`; display name: `Get Free Seeds` / `In Review`; quality rating not displayed.
- Flow publication and messaging runtime are separate gates. Public key registration remains pending; private key is Cloudflare secret-only.

## GFS-75 Graph/Identity Registry

- Graph activation authority: supported Meta Graph/WhatsApp Business Tools state only; no dashboard banner is treated as activation proof.
- BSUID storage: D1 `customers.bsuid` + `customers.bsuid_business_id` + `customers.whatsapp_username`; no observed customer BSUID and no fabricated business/user ID.
- Canonical business scope for future BSUID association: Business `568026370701542`, WABA `2616648355452496`. A separate Garden Shop scope is supported by scoped storage but not configured.

## GFS-85 Signed Runtime State

- API Worker secret names: `META_ACCESS_TOKEN`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN` present; values never recorded.
- API deployment state: `PRODUCTION_INTEGRATION_READY`; Meta provider enabled.
- Webhook GET challenge passes; invalid signature is rejected. Valid signed event and real message delivery remain unproven.

## GFS-86 Outbound Test State

- Authorized recipient: `+923354299783`; exactly one send attempt, HTTP 400, no `wamid`.
- No duplicate sends or payment messages. Next supported path is recipient-initiated inbound context or an approved template.

## GFS-87 Inbound Runtime

- Public callback: `POST /webhooks/whatsapp`; signature validation and idempotent event persistence are deployed.
- Auto-reply: inbound text message ID → `WELCOME_REPLY` idempotency key → one welcome text, subject to Meta service-window rules.
- Current D1 evidence: `whatsapp_events=0`, `outbound_messages=0`; Meta dashboard message counts are not callback proof.

## GFS-88 Browser Evidence

- `list_pages` PASS; matching Meta/Cloudflare tabs reused; unrelated tabs changed: 0.
- Canonical phone list confirms connected `+923044429933`; no individual sender/message evidence was available from the accessible list.

## GFS-89 Webhook State

- Meta App: Published; `messages` webhook field Subscribed; callback URL canonical.
- API: `META_PHONE_NUMBER_ID=1323932417479627` binding deployed; health reports provider enabled.
- D1 sample transport evidence: one `MESSAGE`/`RECEIVED` event, provider ID recorded; no real sender identity inferred.

## GFS-90 Real Inbound Evidence

- Verified sender: `+923034901810` (masked in public reporting); two WAMIDs persisted in D1 with `MESSAGE`/`RECEIVED` status.
- Auto-reply records are idempotent by WAMID and show `FAILED` with safe error `META_MESSAGE_SEND_401`; no credentials or customer content are recorded.

## GFS-99 Conversation Trace

- D1 event privacy model stores provider event ID, type, status, payload hash, and correlation ID—not raw WhatsApp message text.
- Existing real inbound metadata is sufficient for delivery/idempotency proof but not for replaying START or deriving customer field answers.

## GFS-100 Conversation State

- D1 `whatsapp_conversations` stores normalized state/data, `wa_id`, last inbound message ID, and timestamps; raw WhatsApp bodies remain excluded.
- State responses use `conversation_reply:<message_id>` idempotency keys and existing Admin/D1 tariff quote authority.

## GFS-101 Payment Configuration

- `/payment-settings` draft saves no longer depend on legacy fixed advance amount; incomplete drafts remain disabled.
- JazzCash staging row has non-secret configuration presence and QR object by D1 flags, but payee ownership is not verified and it remains disabled.
- Easypaisa/Bank remain unconfigured. Dynamic WhatsApp totals remain tariff/D1 authoritative.

## GFS-102 Commerce Readiness

- JazzCash configuration is present by safe D1 flags but disabled pending payee/QR ownership verification.
- No live order or real payment request has been created; guided chat awaits a fresh customer START.

## GFS-103 Commerce Handoff

- Confirmed order confirmation/payment selection path uses dynamic persisted total and complete enabled methods only.
- JazzCash configuration is present but disabled pending ownership verification; no recipient values are recorded here.

## GFS-104 Order Number Authority

- D1 `order_number_sequences` provides atomic per-Karachi-date allocations for new `FS-YYMMDD-######` orders.
- D1 `order_requests` preserves source idempotency mappings. Existing historical order numbers are not migrated.

## GFS-105 Live Commerce

- No live conversation/order state exists for the authorized customer; no customer data was fabricated.

## GFS-106 Live Order

- Existing live order authority: `FS-261012-000001`, state `PAYMENT_PENDING`, dynamic total PKR 250, Punjab seed-only path.
- JazzCash expected payment amount is PKR 250 and review state is `PENDING`; no receipt or approval exists.

## GFS-107 Interaction Governance

- Stable interactive IDs are server-recognized and client fallbacks use numbered text mapped to the same intents.
- Cooldown is server/D1 enforced across supported order paths; exact E2E sender exemption is scoped to `923034901810`.

## GFS-109 Admin Operations

- Admin URLs: `/orders` and `/test-controls`, Cloudflare Access protected for `gisupp@gmail.com`.
- D1 `cooldown_exemptions` is the allowlist authority; only `923034901810` is initially seeded.
- Reset preserves orders/payments/receipts/cooldown locks/audit; cancellation/archive never hard-deletes financial history.

## GFS-111 WhatsApp Content Authority

- `/whatsapp-content`: Access-protected D1 versioned template CMS; English/Urdu, private R2 media key only, draft/publish/rollback/audit.
- `whatsapp_content_templates`/`whatsapp_content_template_versions` are the customer-copy source of truth. Action IDs and dynamic tariff/payment logic are excluded from free-text editing.
- Live guided-chat evidence: `FS-261012-000003`, Punjab, fertilizer selected, PKR 500, awaiting JazzCash method selection.

## GFS-113 Native Flow Registry

- Canonical WABA `2616648355452496`; Flow object ID/status not safely available from the loading Meta Manager surface.
- Local Flow definition and encrypted endpoint remain repository/runtime assets only; publication is not claimed.

## GFS-118 Published Flow

- Flow `1133458765899784`: Graph status `PUBLISHED`, validation errors empty.
- Flow schema uses only `id`/`title` dropdown item properties; runtime catalog payload matches.
- Encryption key pair was rotated and registered; private key remains Cloudflare secret-only.

## GFS-119 Language Routing

- `LANG_EN`/`LANG_UR` are stable conversation intents; selected language is stored in conversation state and does not alter tariffs/order logic.
- Flow CTA uses published Flow `1133458765899784` with a session-scoped token; no credential is stored.

## GFS-120 Live CMS/Flow

- Admin CMS page renders ordered bilingual templates and private media gallery.
- Native Flow `1133458765899784` remains Graph PUBLISHED; live device rendering/e2e is unverified.

## GFS-121 Closeout

- Published CMS content is the welcome/locale source of truth; already-published versions are up-to-date and cannot be republished without a draft.
- Native Flow `1133458765899784` is Graph PUBLISHED; customer-device E2E is not recorded.

## GFS-122 Welcome Routing

- Published WELCOME EN/UR CMS entries are the universal first-message source; session language is stored by trusted wa_id.
- `LANG_UR` and `LANG_EN` route to the published Flow session token; no hardcoded welcome copy remains in the first-message path.

## GFS-124 Flow Data Contract

- OFFER/PROVINCE dynamic options are strict `{id,title}` D1 values; unsupported schema properties are excluded.
- Empty/missing D1 catalogs yield a protocol error, not an empty native dropdown.

## GFS-125 Canonical Flow Version

- Active runtime Flow: `28410343535328014`, PUBLISHED, validation errors empty, health available.
- Rollback Flow: `1133458765899784`, PUBLISHED but first-screen selector was unusable; runtime CTA switched only after v2 publication.
- Flow session tokens are HMAC-bound to trusted wa_id and expire after one hour; order creation still uses server D1/cooldown/idempotency.

## GFS-128 Live Flow Gate

- Flow v2 `28410343535328014` first-screen contract and token binding are deployed.
- Live CTA/device evidence remains unavailable without a verified customer-controlled WhatsApp session.

## GFS-130 Flow Runtime

- FERTILIZER→PROVINCE data exchange uses D1 catalog/province data and explicit protocol errors; local contract tests pass.
- Cloudflare consent callback is stale/replayed and is not a runtime dependency for the deployed API; no callback URL was revisited.

## GFS-132 Flow ID Authority

- Rollback/published historical Flow: `1133458765899784` (old OFFER dropdown; not runtime target).
- Active runtime Flow: `28410343535328014` (published v2); CTA/config should use this ID only.

## GFS-133 Checkout Mode

- Runtime checkout mode: `guided` (API Worker environment), native Flow preserved as published fallback/opt-in.

## GFS-134 Audit

- Admin order/test-control backend remains canonical; browser inspection is currently blocked by local MCP dependency error (`pkce-challenge` missing).

## GFS-135 Order Evidence

- Existing order `FS-261015-000001` is present in D1 as `PAYMENT_REVIEW`, PKR 300, KPK, JazzCash, one receipt.
- Admin UI transport currently fails in Chrome with `ERR_QUIC_PROTOCOL_ERROR`; no real payment state mutation occurred.

## GFS-139 Admin Operations

- `/orders` professional dashboard version `9e36ce18-c5d2-4702-9388-c1f4e4d23921` deployed to canonical Admin Worker/D1.
- Real rejected order and one private receipt remain preserved; financial history unchanged.

## GFS-143 CMS Media Recovery

- Staging D1 media schema now exists after safely applying migration `0017_whatsapp_content_media.sql`.
- Private R2 media remains authoritative; no public URL or customer-facing image success is claimed without browser/WAMID evidence.

## GFS-155 Published Welcome

- WELCOME published version: 6; media ID `b99ba6e6-c5b0-4ee0-b819-b470083ab78d`; private R2 variant verified.
- Action labels are version-scoped in `whatsapp_content_version_action_labels`; stable IDs remain code-controlled.

## GFS-156 Fertilizer Labels

- FERTILIZER draft labels are schema-valid and within Meta button limits; published labels remain valid.

## GFS-157 Province Menu

- Province menu options are generated from enabled D1 `province_delivery_rates`; IDs are stable province names and descriptions include current PKR fee.

## GFS-158 Payment Settings

- Canonical route: `/payment-settings`; duplicate legacy route removed.
- Payment method values and QR storage remain D1/private R2 authoritative.

## GFS-159 Payment Presentation

- `formatPaymentMessage` consumes locale-specific Admin payment copy and injects only persisted order amount/order number/method/recipient values.
- No duplicate reference/instruction assembly remains in the API payment handoff.

## GFS-166 Payment Selector

- Eligible payment buttons are read from enabled complete D1 `payment_methods` at runtime; no legacy JazzCash-only selector remains.
- Selected method details use persisted `orders.total_payable`, locale copy and method-specific protected values.

## GFS-144 Media Evidence

- Migration 0017 tables are present in canonical staging D1; live R2 gallery upload and WhatsApp image delivery remain unverified.

## GFS-141 Shipping/Operations

- Shipping labels render from D1 order/customer/address data with no public R2 URL and optional tracking only when assigned.
- Confirm Order is separate from payment approval; PAID/CAPI remains evidence/approval gated.

## GFS-114 Flow Graph Evidence

- Canonical WABA Flow ID created via Graph-backed Admin route: `1133458765899784`.

## GFS-116 Coexistence Registry

- Canonical API-first phone read-only fields: `is_on_biz_app=false`, `platform_type=CLOUD_API`.
- Support-number/business-app coexistence remains **NO-GO/UNVERIFIED** for in-place enrollment; no phone migration or deregistration was attempted.

## GFS-117 Flow/Media Registry

- Flow `1133458765899784`: asset JSON validated; publish blocked by Meta endpoint health gate.
- Content media: `whatsapp-content/images/{screen}/...` private R2 namespace, gallery metadata in D1 `whatsapp_content_media`, no public URLs.
- Current Meta asset upload blocker was exact `#195` / `2498084`: asset filename must be `flow.json`; no token/error credential data recorded.

## GFS-92 Token Runtime Gate

- API/admin secret names remain present, but current server-side Graph ladder returns HTTP 401; values are never read or recorded.
- Phone/WABA state cannot be reread until the API Worker receives a valid canonical Meta token.

## GFS-98 Token and Reply Evidence

- Fresh canonical token validated by sanitized Graph ladder; no token value recorded.
- One failed welcome reply was retried atomically; outbound `wamid` persisted with `SENT` and matching status event. No duplicate accepted send exists.
- Delivery status remains pending/unknown; Flow/order state remains unproven.

## GFS-96 Security Recovery

- Token material was unexpectedly rendered by Meta UI; no value is recorded here.
- Revocation status: **UNPROVEN**. Replacement generation remains prohibited until the affected token is revoked through a visible Meta control.

## GFS-77 Activation Authority

- Admin console: `/meta-activation` on staging, Access-protected for `gisupp@gmail.com`.
- Graph credential: `META_ACCESS_TOKEN` is a Cloudflare secret name only; currently absent. No credential material is recorded.
- Canonical action scope: Phone `1323932417479627`, WABA `2616648355452496`, App `2354726831735899`.

## GFS-79 Activation Runtime

- `META_ACCESS_TOKEN` secret is present by name on both staging Workers; values are never read back.
- Graph phone read is available and code verification is `VERIFIED`; registration is separate and still requires the protected two-step PIN.
- Graph error `(#133010) The account is not registered` is recorded as the current register gate; no credential material is recorded.

## GFS-80 Connected Phone State

- Phone `1323932417479627`: UI Connected; Graph code verification `VERIFIED`; registration runtime inferred connected, name review still pending.
- WABA `2616648355452496` subscribed App IDs include canonical `2354726831735899`.
- Flow public-key Graph operation exact error: `(#10) Application does not have permission for this action`; no token material recorded.

## GFS-76 Registration State

- Registration authority: official Graph/WhatsApp Business Tools only; current Chrome UI is observation-only for this action.
- Name review remains separate from registration. Current phone remains Pending/In Review; no claim of approval or activation is made.
- Payment methods remain absent and are not used as a reason to delay protected phone registration.

## GFS-73 Tariff Governance

- Single runtime source: Access-protected `/tariff` → D1 `products` and `province_delivery_rates`.
- Legacy `/payment-amount` remains separate and is not used by dynamic WhatsApp quotes.
- Product price may be zero; delivery fee must be positive. All runtime quote values are fetched at request time.
- Change proof passed without Worker redeploy and values were restored. No tariff values are embedded in Flow JSON or Worker variables.

## GitHub

- Repository: `https://github.com/gardenshop/freeseeds.git`
- Main: `aa673e7` (origin/main, verified 2026-09-28)
- Main: `7794b686e942901fc549c1c25a97a4175d9fa663` (PR #7 merged)
- Active execution branch: `codex/gfs-launch-next-001` from merged main; remaining launch gates are external Meta/payment gates
- Prior branch `codex/gfs-waba-test-002` retained remotely for provenance

## Cloudflare

- Account name: Get Free Seeds (dedicated clean account)
- Account ID: `cb5066a6d71ecdee0bd7ed8aacb4d3c2`
- Prohibited account: `85f6a6181b4653c2a45e69cb7ce8a474` (not used)
- Staging D1: `getfreeseeds-staging` / `17b7e9f6-e08b-4bff-a756-10de30b49ab1`
- Staging D1 migrations: `0001_initial.sql`, `0002_payment_methods.sql` applied and verified
- Staging R2: `getfreeseeds-receipts-staging` (private; public access not enabled)
- Staging Queue: `getfreeseeds-events-staging`
- Staging DLQ: `getfreeseeds-events-staging-dlq`
- Staging Queue ID: `7cf7cec60e0d4bd4a0a1e5af41f00dbd`
- Staging DLQ ID: `4e0ec3246cc048c8be71cc37ff48f0a7`
- workers.dev subdomain: `get-free-seeds.workers.dev`
- Staging public Worker: `getfreeseeds-api-staging` / `https://getfreeseeds-api-staging.get-free-seeds.workers.dev`
- Staging admin Worker: `getfreeseeds-admin-staging` / `https://getfreeseeds-admin-staging.get-free-seeds.workers.dev`
- Staging API version: `73e0d310-da94-43d0-819a-4e86c4ace794` (GFS-37 phone-verification-pending redeploy; clean account verified as `gisupp@gmail.com`)
- Staging admin version: `f0135e82-b28d-453b-a5af-e9b12d2d34d7`
- Cloudflare Access application: `Get Free Seeds Admin Staging` / `ea91b1bf-02c1-46d3-921a-ea2f507fb150`
- Cloudflare Access allow policy: `Get Free Seeds Admin Operator` / `b3acdd4f-9767-4d28-a55d-0a8e771d476c`
- Production compute/secrets: not provisioned
- Production Access application: not provisioned
- Production D1: `getfreeseeds-prod` / `02b707df-a10c-4645-9516-a2a4541f6fab` (created; migrations 0001/0002 applied; Workers not deployed)
- Production R2: `getfreeseeds-receipts-prod` (created; private, no public access)
- Production Queue: `getfreeseeds-events-prod` (created)
- Production DLQ: `getfreeseeds-events-prod-dlq` (created)
- Production Queue ID: `9b1852f6976343de8bec95ef2cf152a4`
- Production DLQ ID: `0313fc16837d41bdb8370cf8fe31c969`
- Production Workers: not deployed; production Wrangler bindings committed

## Meta and WhatsApp

- Customer identity: `Get Free Seeds / Free Seeds In Pakistan`
- Customer-facing Page input: `https://www.facebook.com/FreeSeedsPK/`
- Page ID: `101192938541236` / `Free Seeds In Pakistan - www.gardenshop.pk`; visible under canonical Meta root with Saeed Nazim full access and 0 partners
- Canonical Meta Business Portfolio (explicit Meta-only exception): `568026370701542` / UI name `Garden Shop`; unrelated Hoja assets remain excluded
- Canonical Creeper Seeds Ad Account (explicit Meta-only exception): `1198439777611633` / UI name `creeper seeds`
- Canonical App: `2354726831735899` / `Get Free Seeds` (WhatsApp customer-connection use case)
- Canonical WABA: `2616648355452496` / `Get Free Seeds` (Approved; business verified; 2,000 new conversations/day)
- Authorized WhatsApp number: `+923044429933` (Pakistan local `03044429933`)
- Number registration status: new number exists in canonical WABA; Meta UI status **In Review**, quality/status **Pending**, display-name review pending
- Phone Number ID: `1323932417479627`; old `1429127796940691` for `+923328883383` is superseded and prohibited
- GFS-51 onboarding gate: canonical WABA phone surface still displays old `+923328883383` In Review/Unverified and a pending Business profile with Add number disabled; new sender `+923044429933` has no Phone ID yet.
- GFS-52 deletion gate: old `+923328883383` / Phone ID `1429127796940691` was not deleted because Add Phone onboarding is blocked before a safe slot action; explicit authorization remains recorded, no deletion mutation attempted.
- GFS-53 current state: `WHATSAPP_NUMBER_SLOT_BLOCKED`; new sender has no Phone ID and no OTP requested.
- GFS-54 support: canonical WABA Help exposes Business Support Home/category updates only; no support case UI or case ID available.
- GFS-54 active vars: API/admin deployments are configured for `WHATSAPP_NUMBER_SLOT_BLOCKED`; no active old Phone ID.
- GFS-55 active vars: API/admin deployments now use `META_ASSETS_PENDING`; API/admin versions `c62d6606-9b38-4dde-abfb-ca2ef92e6deb` / `7053221d-8e53-457f-b780-ed43905fc7d6`; no WhatsApp secrets, provider disabled.
- GFS-56 system user: `Automation` ID `61595003169877`, Employee, assigned only canonical App `2354726831735899` and WABA `2616648355452496`; assignment verified; no token generated.
- GFS-58 assignment verified: canonical App/WABA assigned to `Automation`; Graph subscription and credentials remain pending.
- GFS-56 toolchain: Wrangler `4.149.0`, audit 0 vulnerabilities.
- GFS-57 official MCP/Graph: no remote WhatsApp Business Tools MCP namespace/OAuth handoff is exposed in this execution; no token or Graph mutation performed. Canonical system-user assignments remain verified.
- Clean staging WABA test: not configured; no separate staging WABA/test number is used
- Clean staging test Phone Number ID: not yet configured; no ID placeholder is recorded
- Clean staging test recipient: not configured; synthetic-only use required
- App↔WABA subscription: **FAIL / not subscribed**. App API console still exposes only Meta test WABA `1932075647340454` and test Phone Number ID `870701809469791`; canonical WABA settings expose no assigned-app relationship. Generic Connect-assets chooser remains excluded.
- Instant Form: `Free Seeds 05-10-2026` / Form ID `1093015800183328`, canonical Page `101192938541236`; current GFS-41 canonical form. The separate older `Free Seeds 04-10-2026` remains distinct. Superseded Form `2816887225374285` is inactive in backend allowlists. No campaign/ad set/ad draft and no spend.
- Instant Form audit: More volume, verified privacy/ending required by Meta; expected five customer categories are Full name/`full_name`, Phone number/`phone_number`, Complete Delivery Address/`complete_delivery_address`, Nearby Famous Place/`nearby_famous_place`, City/`city`; Email absent.
- Lead ingestion: staging D1 `lead_sources` table with `page_id` verified; `/webhooks/meta/instant-form` is deployed but `META_INSTANT_FORM_ENABLED=false` until Page leadgen subscription and least-privilege lead token exist.
- GFS-40 lead app: no dedicated App created; canonical App supports only WhatsApp use case. Marketing API dedicated-app wizard stalled at Business pending/disabled before creation.
- GFS-42 Business restriction: Business `568026370701542` is Meta Verified with Saeed full access/2FA, but legal identity is `Hoja Seeds` / `hojaseeds.pk`; dedicated lead-app Business assignment remains disabled.
- GFS-42 existing ad draft: campaign `120255495379100054`, ad set `120255495379110054`, ad `120255495379120054`, unpublished/no-spend; linkage to Form `1093015800183328` not changed.
- GFS-43 staging API version: `abaef4e0-b477-463d-a998-50810f5bcb43`; `DEPLOYMENT_STATE=WHATSAPP_OTP_REQUIRED`, Meta providers remain disabled.
- GFS-44 payment/Messenger state: no enabled Garden Shop payment method or recipient values are configured; native Form→Messenger continuation is unverified/unavailable; no customer notification/order/payment was sent.
- GFS-45 native lead: synthetic supported preview created one Intake lead in Leads Center for Form `1093015800183328`; backend realtime sync remains blocked. The form's WhatsApp CTA target was noncanonical and was not used.
- GFS-46 customer contact: test lead exposes customer WhatsApp `+923034901810`; this is recipient data only, never the GFS sender. Business sender remains `+923328883383`; old CTA `923124093162` remains prohibited.
- GFS-47 customer-number schema: staging D1 preserves entered contact and Meta WhatsApp fields separately; API version `97c038d1-6382-4a3e-9509-2ad2005472b9`; no sender credential or recipient validation API used.
- GFS-49 admin Worker: `c236589e-760a-4190-95b9-285fc29b3518`; Payment Settings uses existing D1/R2 payment APIs, Access-protected for `gisupp@gmail.com`, no real values/QR configured.
- GFS-50 launch branch: `codex/gfs-launch-next-001` from merged main `7794b686e942901fc549c1c25a97a4175d9fa663`; no new external resource created.
- Excluded candidate portfolio: `Garden Shop OK` / `1154400188565490`; visible business overview contains Hoja Seeds ad account `120233855869140541`, so it is not clean and is not used
- GFS-14 read-only Meta audit: visible Ads Manager context was prohibited Garden Shop portfolio `568026370701542` with ad account `1198439777611633`; no clean Get Free Seeds ownership was verified and no asset was mutated
- Designated Meta context per user: `Creeper Seeds`; clean ownership status: **NOT VERIFIED / PROHIBITED CONTEXT OBSERVED**
- GFS-15 historical classification: `creeper seeds` / `1198439777611633` was excluded under the then-current zero-Hoja rule; GFS-27 explicitly supersedes this for Meta-only use of the canonical root, while unrelated Hoja assets remain excluded
- GFS-15 visible Page names in that prohibited context: Hoja Seeds; Dutch Seeds Export; Free Seeds In Pakistan - www.gardenshop.pk; Garden Shop. Target Page `101192938541236` was not independently verified.
- GFS-15 App/WABA/dataset/event-source/system-user IDs: not inspected because entering the proven Hoja portfolio's deeper asset views would violate the isolation lock
- GFS-15 Cloudflare pre-mutation identity: not verified; dashboard redirected to login showing `nazimsaeed@gmail.com`, not required `gisupp@gmail.com`; no Worker deploy or secret mutation performed
- GFS-16 Meta identity: `ayesha.butt55@hotmail.com` email accepted on Facebook login; password authentication pending; no Meta asset mutation
- GFS-16 Cloudflare/GitHub identity: required `gisupp@gmail.com` session not changed or reauthenticated
- GFS-17 Cloudflare identity: `gisupp@gmail.com` visibly authenticated in Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; staging API redeployed, no secret mutation
- GFS-19 Meta identity: visible Facebook session remains Saeed A Nazim; Ayesha authentication failed at password gate `META_AUTH_PASSWORD_REQUIRED`; no Meta asset was touched
- GFS-21 current-session discovery: visible `creeper seeds` ad account `1198439777611633` is HOJA-CONTAMINATED under Garden Shop portfolio `568026370701542`, legal business Hoja Seeds; visible Meta Business Suite business is Hoja Seeds, exposed Facebook asset ID `200402333163427`, and Instagram `hojaseeds`. `Free Seeds In Pakistan - www.gardenshop.pk` was visible in that chain, but target Page ID `101192938541236` was not independently verified.
- GFS-21 clean Creeper Seeds assets: none verified; WABA/App/dataset/system-user links intentionally not inspected inside prohibited chain.
- GFS-22 Ayesha context discovery: no existing Chrome profile, tab, account chooser entry, or saved account visibly associated with `ayesha.butt55@hotmail.com`; current Saeed session preserved and no credential/session mutation performed.
- GFS-25 `list_pages` inventory: 8 tabs; only Meta Business Suite and Ads Manager were open among Meta services. Visible Meta identity was Saeed A Nazim. Business Suite asset `200402333163427` and ad account `1198439777611633` were HOJA-CONTAMINATED under portfolio `568026370701542`; no clean Meta context, WABA/App/dataset IDs, or target Page linkage was verified.
- GFS-26 clean Business creation: not provisioned; Meta portfolio-creation limit blocked creation under current Saeed session. Support Home was reached but generated no case/reference ID or response. No existing asset was mutated.
- GFS-27 existing App `1065866162865361` / `Hoja Lead Integration`: excluded; no WABA, dataset, or event-source ID was safely verified.
- GFS-27 existing WABA `810731151319635` / Hoja Seeds: excluded; no new App/WABA/Phone Number ID was created because Meta required reauthentication.
- GFS-29 Page linkage: target Page `101192938541236` Connected Assets panel showed none. Visible WhatsApp account list contained only Hoja/Garden Shop entries; no clean WABA or Page-to-WhatsApp connection was available. No Page, WABA, number, App, or token mutation occurred.
- GFS-30 new App: `2354726831735899` / `Get Free Seeds`, owned under canonical Portfolio `568026370701542`, WhatsApp customer-connection use case; no WABA/Phone Number ID yet.
- GFS-31 WABA creation: form `Get Free Seeds` / Food and Grocery reached; reCAPTCHA checkbox completed, Continue remained disabled, no WABA ID/Phone Number ID generated. STOP_GATE=`META_RECAPTCHA_REQUIRED`.
- GFS-32 display-name-only: Meta selected path but returned maximum allowed WhatsApp Number limit and additional business/display-name review. No new WABA/display name/Phone Number ID.
- GFS-32 existing Hoja WABA inventory: `810731151319635` / Hoja Seeds / Garden Shop; visible number `+92 313 4799681`, display name Hoja Seeds, Connected, High quality. Active Hoja asset; never delete. No unused/unknown numbers visible.
- GFS-33 canonical GFS WABA: `2616648355452496` / Get Free Seeds; Approved, business verified, 2,000 new conversations/day, no phone numbers, no partners, display name shown upon approval. App `2354726831735899` is canonical; App↔WABA subscription remains unverified.
- GFS-34 linkage verification: Page Connect assets chooser exposed only Instagram; App Connect assets chooser exposed only Other business assets; canonical Page/WABA/App options were absent. The chooser is not treated as the WhatsApp integration mechanism; App API Setup/WABA subscription remains the required verification surface.
- GFS-26 branch: `codex/gfs-meta-clean-007` from `origin/main` `a4ac98c`; pending evidence PR.
- Meta support case: not created; no case ID available
- Flow ID: not published; repository definition only
- Dataset/event source ID: not provisioned
- Graph API version: `v26.0` observed 2026-09-27; re-verify before live integration
- Public callback URL (staging only): `https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp`

No secrets are stored in this registry.

## GFS-169 Live Evidence Registry

- Authorized tester: project-registered WhatsApp profile, wa_id suffix `9810`; authorization verified in WhatsApp Profile Settings before the live mutation.
- Live GFS sender conversation: `+923044429933`; no unrelated WhatsApp chat was used or changed.
- Live order: `FS-261019-000001`; Admin/D1 state `PAYMENT_PENDING`; payable total PKR 500; no receipt or approval.
- Payment rendering mapping, masked: JazzCash `...2511`, Easypaisa `...9783`, Bank Transfer `...8547`. Full recipient values are intentionally excluded.
- Screenshot evidence: private temporary file `D:\Temp\kilo\gfs169-whatsapp-welcome.png`; not committed and not published.
- WAMIDs: unavailable from WhatsApp Web/Admin surfaces; no browser request ID is recorded as a WAMID.
- Current read-only Worker versions: API `2c0335e7-0914-42eb-9501-b207bbe9752b`; Admin `f7acf3f3-4e5e-498e-bdd5-697eb30cd0de`.

## GFS-170 QR Delivery Registry

- Staging API Worker: `2fd41947-036d-407c-8b4e-b753aaa86bdc`.
- Staging Admin Worker: `a00bb9ab-d9dc-43e1-896c-efe2bdbc9718`.
- Staging D1: QR ownership column applied; no payment recipient/account values recorded.
- JazzCash: enabled/complete, private JPEG QR present, ownership verification `0`, customer QR delivery blocked.
- Easypaisa: enabled/complete, no QR configured; permitted fallback is text-only.
- Bank Transfer: enabled/complete, no QR configured; permitted fallback is text-only.
- Live evidence: Chrome DevTools MCP unavailable; no customer screenshot, WAMID, Meta status callback, or payee/QR ownership verification recorded.

## GFS-171 Live QR Evidence

- Current live QR rows: JazzCash, Easypaisa, Bank Transfer all enabled/complete; private JPEG object HTTP 200; D1/R2 byte and SHA-256 matches; ownership flags all `0`.
- Private screenshots (not committed): `D:\Temp\kilo\gfs171-jazzcash-qr.png`, `D:\Temp\kilo\gfs171-easypaisa-qr.png`, `D:\Temp\kilo\gfs171-bank-qr.png`.
- Fresh order: `FS-261019-000002`, PKR 500, `PENDING`; JazzCash text WAMID recorded in STATUS, status `READ`; QR status `SKIPPED` due ownership gate.
- Historical order: `FS-261019-000001` is now `PAID/APPROVED` with receipt; preserved and not mutated.
- API post-repair version: `0817b3ea-7a26-4bc6-a211-9db447de9046`; Easypaisa/Bank post-deploy browser retest blocked by intermittent MCP failure.

## GFS-172 Launch Audit

- Current QR screenshots: `D:\Temp\kilo\gfs172-easypaisa-qr.png`, `D:\Temp\kilo\gfs172-bank-qr.png`, `D:\Temp\kilo\gfs172-customer-payment-methods.png`; private and uncommitted.
- Live WAMIDs on `FS-261019-000002`: JazzCash text `...RDg5MDlBRDVEAA==`, Bank text `...ODIwREE0Njg0AA==`, Bank QR `...Nzc4RjFFAA==`, Easypaisa text `...MTU1M0NERjc4AA==`; all recorded as `READ`.
- Final QR ownership state: JazzCash `0`, Easypaisa `0`, Bank Transfer `0`; no QR is authorized for customer delivery.
- Incident order: `FS-261019-000001`, Admin approval by `gisupp@gmail.com`, receipt present, no customer transaction reference, `PACKING`, CAPI dead-lettered, fulfillment hold required.
- Launch status: **NO-GO** until Bank QR incident, Check Order regression, and independent payee ownership are resolved.

## GFS-173 Locale and Action Repair

- Source repair adds migration `0020_payment_locale_and_action_cleanup.sql` with dedicated payment `instructions_ur` and `reference_instruction_ur` columns. No recipient, account, QR, secret, customer, receipt, or financial identifier is recorded here.
- Runtime action authority: payment buttons are generated from complete enabled D1 methods only; current semantic IDs are `PAY_JAZZCASH`, `PAY_EASYPAISA`, and `PAY_BANK_TRANSFER` at runtime. `CHECK_ORDER` is status-only; `PAYMENT_HELP` is legacy and no longer a CMS/runtime button.
- Live evidence for GFS-173: **BLOCKED**. Chrome DevTools MCP was not exposed to this session; no list-pages inventory, tab mutation, account verification, screenshot, WAMID, Admin save/publish/reload, or external deployment is claimed.
- Staging deployment after identity verification: API `4375a7b7-463e-4373-8156-bfb6e1344f49`; Admin `2ab5c27f-30c7-4614-ac89-7ef51d6b73cf`. API `/health` returned `ok` and D1 `payment_methods` exposes `instructions_ur` and `reference_instruction_ur`.
- Financial incident remains `FS-261019-000001` paid/approved/packing with no independent bank verification; five Purchase CAPI attempts are dead-lettered. Fulfillment hold is required. `FS-261019-000002` remains preserved.
