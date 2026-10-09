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
| GFS-37 phone status | canonical WABA phone settings, display name, registration, quality, verification action | PASS evidence: `1429127796940691`, `Get Free Seeds`, In Review, Unverified; no SMS/voice OTP action exposed |
| GFS-37 current launch state | display-name-only deprecation and sender lock | PASS: `WHATSAPP_PHONE_VERIFICATION_PENDING`; `+923328883383` is required sender; Meta/test/Hoja senders excluded |
| GFS-38 phone verification | canonical sender SMS/voice verification action | PASS/STOP: one SMS code requested; six-digit entry shown; no code entered or resent (`WHATSAPP_OTP_REQUIRED`) |
| GFS-38 Instant Form editor | canonical Page, More volume, offer, exact data categories, no email | PARTIAL: editor draft configured; Meta blocked save/create on incomplete privacy/ending; no form ID or publication |
| GFS-38 lead ingestion | source enum, normalized five fields, dedupe schema, shared admin/CAPI path | PASS: 20 tests, D1 `lead_sources` verified in staging; live endpoint intentionally disabled without form/token |
| GFS-39 exact form audit | name, Form ID, Page, status, fields, privacy/ending, no duplicate form | PASS: `Free Seeds 04-10-2026`, `2816887225374285`, Page `101192938541236`, Active, 0 leads; no new form created |
| GFS-39 Page/Form allowlist | reject unrelated page/form webhook events before Graph retrieval and after retrieval | PASS unit coverage; staging env locks canonical Page/Form; live endpoint disabled pending token/subscription |
| GFS-39 leadgen subscription | App page leadgen webhook + Page subscription | BLOCKED: no authorized lead token/subscription mutation performed |
| GFS-40 lead App support | canonical App use cases and dedicated supported creation wizard | BLOCKED: canonical App exposes WhatsApp only; dedicated Marketing API wizard stalls at Business pending/disabled before App creation |
| GFS-40 active Meta operator | authenticated session/recovery docs | PASS: existing Saeed Meta session reused; Ayesha is historical; no logout/new profile |
| GFS-41 form switch | active Page/Form allowlist and superseded-form rejection | PASS code/config: Page `101192938541236` + Form `1093015800183328`; old `2816887225374285` rejected |
| GFS-41 MCP permissions | routine Meta navigation vs protected actions | PASS policy: safe routine navigation only; OTP/password/CAPTCHA/spend/destructive prompts remain protected |
| GFS-42 Business blocker | Business access, verification, legal identity, 2FA, app wizard status | PASS diagnosis: Verified/full access/2FA; legal identity Hoja Seeds and Business step disabled; no mutation |
| GFS-42 existing draft safety | canonical ad account draft IDs and publication/spend state | PASS read-only: campaign `120255495379100054`, ad set `120255495379110054`, ad `120255495379120054`; unpublished/no spend |
| GFS-43 draft launch readiness | existing draft objective/Form attachment/preview/creative | PARTIAL: Leads/Form-oriented draft exists and remains unpublished; edit surface Loading prevented exact Form/preview verification; no mutation |
| GFS-43 native fallback | canonical Page Leads Center availability and lead count | PASS native surface accessible; 0 leads; backend realtime sync blocked |
| GFS-44 Form→Messenger | native continuation/session and automatic Page message | BLOCKED/UNAVAILABLE: no leads, no native session/message evidence; no unsupported claim |
| GFS-44 order/payment notification | order number, details, valid amount, Garden Shop instructions, receipt path | BLOCKED: payment methods disabled/recipient values absent; `PAYMENT_AMOUNT_NOT_CONFIGURED` |
| GFS-45 native Form test | canonical Form preview submission, Leads Center record, Messenger/WhatsApp options | PASS native lead: 1 Intake lead, Form ID verified; Messenger conversation claim/Chat pane visible; customer-side message unverified; noncanonical WhatsApp CTA not used |
| GFS-45 order/payment | native lead to D1/order/payment notification | BLOCKED: custom lead sync unavailable and payment config absent; no fake order/request |
| GFS-46 customer phone | Meta phone/WhatsApp field to normalized customer recipient | PASS: `03034901810`, `923034901810`, `+923034901810` all normalize to `+923034901810`; sender remains separate |
| GFS-46 deferred follow-up | safe WhatsApp recipient outbox and OTP/provider deferral | PASS code path: `WHATSAPP_ORDER_CONFIRMATION` references order/customer/recipient only; no send while gates active |
| GFS-47 two-number model | entered contact vs Meta WhatsApp, normalization, priority, dedupe, sender/old CTA rejection | PASS: 22 tests; separate D1 columns and resolver deployed |
| GFS-49 Payment Settings UI | Access, three methods, validation, save/restore, QR privacy | PASS: Access protected; 3 methods visible; incomplete enable 400; synthetic restore 200; QR endpoints 404/unconfigured |
| GFS-51 sender switch | old sender prohibition and new WABA onboarding/OTP boundary | BLOCKED: old number remains In Review; Add number disabled by pending Business profile; no new ID/OTP |
| GFS-53 active slot state | rules/status/runtime consistency | PASS: `WHATSAPP_NUMBER_SLOT_BLOCKED`; no OTP request or old-number deletion |
| GFS-54 support escalation | canonical WABA Help/Business Support case path | BLOCKED: support/category surface available, no case form or reference ID |
| GFS-54 runtime state | API/admin active deployment variables | PASS dry-run: `WHATSAPP_NUMBER_SLOT_BLOCKED`, Meta providers disabled |
| GFS-55 new sender asset | WABA phone, Phone ID, display/quality status | PASS asset evidence: `+923044429933`, `1323932417479627`; Meta review Pending/In Review |
| GFS-55 App↔WABA | canonical App API Setup From/WABA selection | FAIL: only test/Hoja WABA `1932075647340454` and Hoja/test numbers visible |
| GFS-55 disabled-safe runtime | Cloudflare identity/secrets/state/health/webhook gate | PASS: no secrets, provider disabled, `META_ASSETS_PENDING`, health 200, webhook POST 503 |
| GFS-56 system-user assets | clean system user, exact canonical App/WABA, partial permissions, no Hoja | PASS: Automation `61595003169877`, 2 canonical assets assigned |
| GFS-56 App↔WABA subscription | system-user assignment vs `subscribed_apps` / App API Setup | FAIL/BLOCKED: assignments present, App still shows test WABA only; token required for Graph verification |
| GFS-56 credential/webhook | token generation and Cloudflare secret readiness | BLOCKED: generation reveals secret; no token generated, no Cloudflare secrets/provider enablement |
| GFS-57 phone/App-WABA authoritative check | new Phone ID, WABA status, system-user assignments, subscribed_apps | PARTIAL: Phone ID/asset and assignments PASS; review Pending and subscribed_apps unverified |
| GFS-57 credential safety | OAuth/MCP/token exposure boundary | PASS policy: no token generated/displayed/copied; provider disabled |
| GFS-58 canonical assignment | system user exact App/WABA asset permissions | PASS: Automation has canonical App/WABA only; no Hoja assets/token |
| GFS-58 Graph credential gate | official OAuth/Graph subscribed_apps and token safety | BLOCKED: remote MCP/OAuth unavailable; token requires protected secret handoff |
| GFS-51 toolchain audit | dependency vulnerabilities and safe remediation | BLOCKED NON-RUNTIME: Wrangler/Miniflare/sharp advisory; forced fix is breaking downgrade; no runtime dependency exposure |
| GFS-52 sender migration | exact old-phone confirmation, deletion authorization, new-number slot/OTP | BLOCKED: old number remains In Review; Add Phone disabled by Business profile pending; no destructive deletion performed |
| GFS-50 pricing authority | form text vs authoritative Garden Shop rules/recipient values | BLOCKED: no authoritative pricing/recipient configuration; payment gate remains active |
| GFS-50 launch blockers | Messenger ack, D1 lead sync, payment guard | BLOCKED safely: no ack sent, D1 sync external gate, no payment message |
