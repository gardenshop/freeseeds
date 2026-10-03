# Test Matrix

| Area | Required coverage | Status |
| --- | --- | --- |
| Governance | authorized number lock, no existing number | PASS |
| Webhook | challenge, signature, replay boundary, message/media/status classification and hashed D1 persistence | PASS (live callback deferred) |
| Flow | exactly five fields, validation, persistence contract | PASS |
| Orders | FS numbering, concurrency contract, state transitions | PASS |
| Payments | JazzCash, Easypaisa, Bank Transfer, disabled-safe config, D1 methods | PASS (synthetic; recipient values pending) |
| Receipts | mock retrieval, invalid media, private R2, checksum, payment review | PASS |
| Admin | Access, configuration, QR upload/replacement, approve, reject, clearer receipt, fulfillment | PASS (staging routes) |
| CAPI | Lead/Purchase IDs, approval timing, deduplication, queue delivery/retries | PASS (live send deferred) |
| WhatsApp | provider boundary, authorized number not yet live-enabled | PASS (external onboarding pending) |
| Isolation | Hoja/Google Sheets/secrets/public receipt scans | PASS |
| E2E | synthetic referral through delivered | PASS |
| Real WhatsApp production E2E | clean Meta onboarding, webhook/Flow/media/CAPI | BLOCKED: prohibited/limited Meta portfolio; no prohibited asset used |
| MCP recovery | config/process/Chrome/profile/fresh MCP `list_pages` proof | PASS locally; active session namespace requires fresh MCP-enabled execution |
| Fresh MCP staging probe | challenge and health against deployed staging Worker | BLOCKED: challenge `Forbidden`; deployed Worker remains old number gate |
| Creeper Seeds asset audit | exact business/ad account/Page ownership and Hoja isolation | BLOCKED: matching ad account is nested under Hoja/Garden Shop portfolio; no mutation |
| Cloudflare pre-deploy identity | visible clean account/profile before Worker mutation | BLOCKED: login showed `nazimsaeed@gmail.com`, not required `gisupp@gmail.com` |
| Meta identity separation | Ayesha Facebook login and no cross-use of Gisupp | BLOCKED: Ayesha password gate; no Meta asset mutation |
| GFS-17 staging redeploy | clean-account Worker deploy and health verification | PASS: version `8daa6dc6-6f56-45a2-b7b9-734a146a6156`; challenge 403/POST 503 expected until Meta secrets/provider enablement |
| GFS-19 Meta auth status | visible Ayesha identity before Meta mutation | BLOCKED: `META_AUTH_PASSWORD_REQUIRED`; visible account remains Saeed A Nazim |
| GFS-20 dependency gate | clean install, tests, build, lint, audit | PASS after `npm audit fix`: 18/18 tests and 0 vulnerabilities |
| GFS-21 current-session Meta discovery | Creeper Seeds asset search without logout/account switch | BLOCKED: only Hoja-contaminated ad account/chain exposed; no clean asset verified |
| GFS-22 parallel session discovery | preserve Saeed while locating authenticated Ayesha context | BLOCKED: no Ayesha profile/tab/saved account; `META_AUTH_PASSWORD_REQUIRED` |
| GFS-25 existing Meta tab inventory | `list_pages` first and inspect all open Meta tabs | BLOCKED: only Hoja-contaminated Business Suite/Ads context; `CLEAN_META_ASSET_NOT_ACCESSIBLE` |
| GFS-26 clean Business creation | create independent Creeper Seeds portfolio and support fallback | BLOCKED: Meta portfolio limit; support assistant produced no case/reference ID (`META_SUPPORT_REQUIRED`) |
| GFS-27 canonical Meta root trace | verify root, ad account, target Page, and exclude unrelated Hoja App | PASS read-only: root/ad account/Page verified; Hoja App excluded; WABA/dataset pending |
| GFS-27 App/WABA setup gate | create only new canonical-root App/WABA and check number | BLOCKED: Meta reauthentication required; Hoja App/WABA excluded; no mutation |
| GFS-29 Page-first linkage | inspect Page Connected Assets and WhatsApp accounts before setup | BLOCKED: no connected assets; visible accounts Hoja/Garden Shop; `META_REAUTH_PASSWORD_REQUIRED` |
| GFS-30 new App creation | create GFS App under canonical root, exclude Hoja App/WABA | PASS App `2354726831735899`; WABA flow blocked by Meta tab control timeout |
| GFS-31 WABA form gate | resume WABA creation with repaired MCP and normal reCAPTCHA | BLOCKED: checkbox completed but Continue disabled; `META_RECAPTCHA_REQUIRED` |
| GFS-32 display-name-only | select `Free Seeds`, avoid number onboarding, inventory capacity safely | BLOCKED: Meta number limit/additional review; only active Hoja number visible; no deletion |
| GFS-33 existing GFS WABA | verify quota resolution, approval, Page/App linkage, and phone slots | PARTIAL: WABA `2616648355452496` approved/verified; Page/App unlinked; safe connector UID unavailable |
| GFS-34 canonical linkage | reacquire Page/App Connect controls and link only canonical assets | BLOCKED: choosers lack canonical Page/WABA/App assets; no mutation |
| GFS-35 App/WABA supported relationship | inspect App WhatsApp API Setup/WABA subscription and WABA assigned apps | BLOCKED: active MCP bridge stopped responding after initial read-only inventory; no dashboard mutation claimed |
| GFS-35 staging code path | persist signed webhook records, enqueue Lead/Purchase CAPI, preserve media provider config | PASS: deployed staging API/admin versions `a93e0d64-7562-4979-aaba-a54acc9cf6af` / `07709470-34ee-4de1-b81e-8896257627c9`; provider remains disabled |
| GFS-36 MCP stability | live endpoint, package version, list_pages, two consecutive Meta read-only calls | PASS: `1.10.1`, live DevToolsActivePort, `list_pages` + `select_page` + `take_snapshot` succeeded |
| GFS-36 App/WABA relationship | canonical App API console and WABA assigned-app/settings surfaces | FAIL/UNVERIFIED: App console exposes test WABA `1932075647340454` / test phone `870701809469791`; canonical WABA `2616648355452496` has no assigned App evidence |
| GFS-36 sender onboarding | authorized number only, no Hoja/test number, OTP boundary | PARTIAL/BLOCKED: Phone Number ID `1429127796940691` is In Review/Unverified; no OTP prompt exposed |
