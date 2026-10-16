# Test Matrix

| Area | Required coverage | Status |
| --- | --- | --- |
| GFS-68 launch separation | Meta Form/Leads Center independent of WhatsApp API | PASS: `META_FORM_LAUNCH_FIRST`; WhatsApp is enhancement-pending and non-blocking |
| GFS-68 canonical form inventory | Page `101192938541236`, Form `1093015800183328`, no duplicate substitution | PASS authority mapping: Form `1093015800183328` is active `Free Seeds 05-10-2026`; separate `Free Seeds 04-10-2026` also active |
| GFS-68 payment source | authoritative amount and Garden Shop recipient configuration | BLOCKED: all three staging D1 methods disabled; recipient/instructions/QR fields absent (`PAYMENT_VALUES_REQUIRED`) |
| GFS-69 five-field contract | canonical Form ID and customer-entered fields, no Email | PASS from existing canonical preview evidence; live Page inventory confirms Form `1093015800183328` / `Free Seeds 05-10-2026` |
| GFS-69 payment ending | immediate verified amount/method details after submission | READY_PENDING_VALUES: copy prepared internally; publication blocked by `PAYMENT_VALUES_REQUIRED` |
| GFS-69 receipt CTA | customer-side Messenger or canonical WhatsApp destination | BLOCKED/UNVERIFIED: prior WhatsApp CTA was prohibited; Messenger customer-side open not freshly proven |
| GFS-69 campaign attachment | exact Form `1093015800183328` on campaign/ad set/ad | BLOCKED/UNVERIFIED; draft visible, no edit/publish mutation |
| GFS-70 payment amount source | D1 singleton, positive PKR validation, Access-protected admin edit, audit | PASS implementation/deployment; current value absent by design |
| GFS-70 payment method gate | complete enabled method required; incomplete methods rejected | PASS tests; staging methods remain disabled/incomplete |
| GFS-70 customer ending | real amount/method details shown immediately after submit | BLOCKED by `PAYMENT_VALUES_REQUIRED`; Meta form was not edited |
| GFS-71 catalog source | verified seed/fertilizer workbook content | BLOCKED: `PRODUCT_WORKBOOK_NOT_FOUND`; no production values inserted |
| GFS-71 quote engine | server product + fertilizer + province delivery calculation | PASS implementation/tests; staging quote data absent until verified catalog/rates |
| GFS-71 encrypted Flow | health, INIT, data exchange/navigation, encrypted response/errors | PASS unit/protocol tests and plaintext health smoke; live secret/publication pending |
| GFS-71 dynamic payment total | payment selection uses persisted order total, not global fixed amount | PASS regression tests |
| GFS-71 receipt path | same-chat receipt to private R2/PAYMENT_REVIEW | BLOCKED until canonical runtime credential and catalog/payment data exist |
| GFS-72 product bootstrap | authoritative seed/fertilizer rows, pack quantities, active status | PASS: 2 staging D1 products loaded |
| GFS-72 province tariff | seven active province rates and aliases | PASS: seven rows loaded; aliases KPK/AJK/GB normalize |
| GFS-72 quote matrix | 14 province × fertilizer combinations | PASS live staging: Punjab 250/500; Islamabad 250/500; Sindh/KPK 300/550; Balochistan/AJK/GB 350/600 |
| GFS-72 payment separation | quote works while payment methods incomplete; no fake payment details | PASS pricing; payment selection remains gated |
| GFS-73 tariff page | Access-protected `/tariff`, dynamic D1 rows, Save/audit path | PASS deployed; unauthenticated smoke correctly returns Access 302 |
| GFS-73 zero-price | seed/fertilizer price zero accepted by API/UI/quote | PASS tests and `/tariff` input min 0 |
| GFS-73 change proof | temporary fee/price edits alter quote without deploy and restore | PASS: Punjab 251→250; fertilizer 501→500 |
| GFS-73 hardcode audit | no permanent tariff constants in runtime/Flow/Worker vars | PASS; remaining numeric values are labeled tests/history |
| GFS-74 Meta Flow gate audit | canonical WABA, Flow inventory, exact publication text, phone/app setup | PASS read-only; publication requires message-quality/business-verification conditions, App Review incomplete, payment method missing |
| GFS-74 runtime readiness | canonical phone, App↔WABA, credential, provider/webhook | BLOCKED: phone Pending/In Review, subscription/credential unverified, provider disabled |
| GFS-75 BSUID schema | scoped BSUID/business fields, username, no collision across scopes | PASS migration/tests; no real BSUID observed |
| GFS-75 BSUID absence | no BSUID preserves current recipient resolver and phone fields | PASS implementation/regression |
| GFS-75 Graph activation | authoritative phone/register/subscription state | BLOCKED: official opaque MCP unavailable; raw credential handling prohibited |
| GFS-76 registration ordering | ownership → `/register` independent of name review | PASS policy/documentation; execution blocked at protected official path |
| GFS-76 payment audit | enabled complete payment method status | BLOCKED: all three methods disabled/incomplete |
| GFS-77 activation console | Access protection, secret absence, sanitized Graph status/actions, transient OTP/PIN | PASS: 46 tests; staging route returns Access 302 |
| GFS-77 protected handoff | token never exposed; secret name check only | BLOCKED until direct user handoff populates `META_ACCESS_TOKEN` |
| GFS-79 request-code payload | official `locale`, not `language` | PASS unit test |
| GFS-79 activation diagnostics | sanitized reason/error code/HTTP status | PASS 46-test suite; no credential/PIN exposure |
| GFS-79 registration | verified ownership → protected `/register` PIN | BLOCKED at Meta `(#133010) The account is not registered` pending secure PIN entry |
| GFS-80 connected phone | UI Connected + Graph verified + canonical subscription | PASS: phone code verification `VERIFIED`; App `2354726831735899` observed subscribed |
| GFS-80 Flow key permission | public-key registration after phone connection | BLOCKED: Meta `(#10) Application does not have permission for this action` |
| GFS-80 webhook/message | signed callback and controlled send | BLOCKED: App Secret absent/provider disabled |
| GFS-85 secret/deployment | App Secret name, active API version, provider enablement | PASS: API secret present; `PRODUCTION_INTEGRATION_READY` deployed |
| GFS-85 webhook signatures | challenge and invalid signature rejection | PASS: challenge PASS; invalid POST 403; valid Meta callback pending |
| GFS-85 authorized send | one fixed recipient, message ID/status | FAIL/UNPROVEN: HTTP 400, no wamid; no retry issued |
| GFS-86 safe outbound diagnostics | code/subcode/message/fbtrace/status without credentials | PASS implementation/deployment; no duplicate send |
| GFS-86 inbound-first runtime | recipient reply opens service context and enables approved outbound | BLOCKED/WAITING for authorized recipient interaction |
| GFS-87 webhook persistence | signed inbound event stored once; replay safe | PASS implementation/deployment; live callback absent (`whatsapp_events=0`) |
| GFS-87 automatic welcome reply | one reply per inbound Meta message ID | PASS implementation/tests; live send pending callback/window |
| GFS-88 tab governance | list pages first, matching tab reuse, unrelated tab isolation | PASS: list_pages; existing tabs reused; unrelated changes 0 |
| GFS-88 historical sender evidence | sender/message/timestamp/Phone ID correlation | BLOCKED: individual Meta conversation evidence unavailable; `HISTORICAL_SENDER_UNVERIFIABLE` |
| GFS-89 Meta production callback | App published, messages subscribed, canonical callback, D1 event | PASS sample transport: `MESSAGE`/`RECEIVED`; real customer callback pending |
| GFS-89 auto-reply binding | API phone ID present before provider send | PASS deployed fix; sample failed before fix and was not replayed |
| GFS-90 real inbound | actual sender WAMID/event persisted and deduplicated | PASS: two WAMIDs from `+923034901810`; no BSUID supplied |
| GFS-90 live auto-reply | Graph send accepted with wamid/status | BLOCKED: API Worker Meta token rejected with HTTP 401; no retry |
| GFS-99 START trace | persisted event identifies exact START text and advances state | BLOCKED by privacy schema: message body not stored; no invented customer answers |
| GFS-99 order state | five fields → quote → FS order → summary | BLOCKED pending real message content/customer interaction |
| GFS-100 privacy-safe START | START parser, state transitions, raw-body exclusion, response idempotency | PASS implementation/build/tests; live START pending |
| GFS-100 order conversation | fields → quote → review → FS order → summary | READY_PENDING real customer answers; payment request remains disabled |
| GFS-101 payment draft save | incomplete/disabled Save, exact error feedback, values persist | PASS: 50 tests; JazzCash D1 presence verified, disabled |
| GFS-101 enable gate | incomplete method cannot enable; complete method can | PASS validation; no method enabled without ownership proof |
| GFS-102 JazzCash enablement | safe persisted draft vs verified enabled collection | READY_PENDING ownership proof; currently disabled |
| GFS-102 live order | fresh START through fields/quote/FS order/summary | BLOCKED pending genuine customer START |
| GFS-103 order summary/payment handoff | dynamic total, method names, JazzCash selection, no auto-PAID | PASS implementation/tests; live customer interaction/payment ownership pending |
| GFS-104 order format | Karachi date, atomic sequence, six digits, historical preservation | PASS 54 tests; staging migration applied |
| GFS-104 replay/concurrency | multi-channel idempotency and no duplicate sequence/order | PASS unit coverage |
| GFS-104 live guided chat | START → fields → quote → order → summary | BLOCKED pending verified customer-controlled START |
| GFS-105 live commerce | real customer START, answers, order, JazzCash handoff | BLOCKED: no authorized customer session/fresh START; no fabricated interaction |
| GFS-106 live order | real START → fields → quote → FS order → payment pending | PASS: `FS-261012-000001`, Punjab total PKR 250, JazzCash pending |
| GFS-106 payment approval | receipt/R2/admin approval/PAID/CAPI/fulfillment | BLOCKED: no verified receipt or approval evidence |
| GFS-107 interactive routing | stable button/list IDs, template/Flow/text normalization, PAYMENT_PENDING handling | PASS 54-test suite and deployed code; physical clients untested |
| GFS-107 cooldown | 14-day boundary, concurrency/replay, test exemption, cross-channel enforcement | PASS order-number/cooldown test coverage; live repeat not run |
| GFS-109 admin security | Access ACL, CSRF, confirmation, validation, audit | PASS 66 tests and deployed routes |
| GFS-109 conversation reset | selected wa_id reset, history/cooldown preserved | PASS live admin reset and D1 audit |
| GFS-109 order management | search/detail/cancel/archive financial safety | PASS implementation/tests; no destructive live order mutation |
| GFS-109 Check Order | actual payment/receipt/fulfillment status | PASS implementation/tests; live tap pending |
| GFS-111 content CMS | versioned EN/UR draft/publish/rollback, private media, audit/CSRF | PASS 70 tests and staging deployment |
| GFS-111 live guided chat | real inbound/outbound WAMIDs, dynamic order/quote | PASS D1 evidence: `FS-261012-000003`, PKR 500, PAYMENT_METHOD |
| GFS-111 native Flow | published Flow CTA/screen/device E2E | DRAFT/UNTESTED |
| GFS-113 Meta publication | validated canonical Flow ID/status and publish evidence | BLOCKED: Meta Flow Manager object/status unavailable from loading surface |
| GFS-113 guided launch | deployed tap/text guided backend and D1 order path | PASS implementation; native Flow separate |
| GFS-114 Graph Flow discovery | WABA enumeration and exact Flow ownership | PASS: one canonical draft created, ID recorded |
| GFS-114 asset upload | exact `flow.json` asset validation | BLOCKED at Meta `#195/2498084`; correction prepared, publish not claimed |
| GFS-116 coexistence | read-only phone platform/Business App eligibility | PASS read-only: `false` / `CLOUD_API`; no migration |
| GFS-116 Flow publish | endpoint health/validation/publish status | BLOCKED: Meta `#139002/4233014` Endpoint not available |
| GFS-117 media gallery | private R2 keys, validation, ordering, rotation/session selection | PASS implementation/tests; live image delivery untested |
| GFS-117 encrypted Flow | Meta request/decrypt/encrypt round trip | BLOCKED live: `FLOW_INITIAL_VECTOR_INVALID` observed; local tests pass |
| GFS-118 Flow publication | corrected schema, key pair, asset upload, Graph publish/status | PASS: Flow `1133458765899784` PUBLISHED; validation errors empty |
| GFS-118 native device E2E | published CTA/screens/order/payment | UNTESTED: authorized device interaction unavailable |
| GFS-119 language routing | LANG_EN/LANG_UR state persistence and published Flow CTA | PASS implementation/deployment; live device session pending |
| GFS-120 CMS live render | ordered bilingual rows, gallery controls, published/draft status | PASS browser snapshot; image send/publish mutation not performed |
| GFS-120 native Flow device | CTA → screens → order/payment | UNTESTED: authorized device/customer interaction unavailable |
| GFS-121 CMS publish guard | already-published up-to-date response; fresh draft required for publish | PASS deployed/tests |
| GFS-122 universal welcome | hi/hello/Salam/START/arbitrary text → CMS EN/UR + language buttons | PASS implementation/tests/deployment; live device pending |
| GFS-124 Flow OFFER | strict D1 `id`/`title` options; explicit empty-catalog error | PASS implementation/tests; Meta preview/device retest pending |
| GFS-125 Flow v2 | data_exchange CTA, simplified first screen, validation/publish/health | PASS Graph: `28410343535328014` PUBLISHED/AVAILABLE; live open pending |
| GFS-125 Flow token binding | HMAC wa_id/session binding, expiry, replay/order idempotency | PASS implementation/tests; live completion pending |
| GFS-128 first screen | v2 fertilizer/offer screen progresses with server data | PASS implementation/deployed; live client interaction pending |
| GFS-128 native E2E | customer tap through Flow/order/payment | BLOCKED: no verified customer-controlled session |
| GFS-130 fertilizer/province exchange | encrypted action, catalog, province response | PASS local Flow contract tests; live client rendering pending |
| GFS-130 OAuth recovery | stale callback handling | PASS safety: no replay/bypass; Wrangler access remains valid |
| GFS-132 Flow ID authority | old Manager tab vs runtime CTA/config ID | PASS reconciliation: old `1133458765899784` is rollback; runtime `28410343535328014` is active |
| GFS-132 live device | active v2 screen/tap/order evidence | BLOCKED: no verified customer device session |
| GFS-133 guided-first mode | runtime flag disables native CTA and keeps guided chat functional | PASS deployed; native Flow preserved |
| GFS-134 Admin UI/live audit | Orders/test controls and authorized device inspection | BLOCKED by local MCP `pkce-challenge` dependency; backend unchanged |
| GFS-135 real order audit | order/payment/receipt D1 evidence and Admin UI | PASS D1: PAYMENT_REVIEW/PKR300/one receipt; Admin UI blocked by ERR_QUIC_PROTOCOL_ERROR |
| GFS-136 Orders UI | query hydration, exact search, order totals/detail/payment actions | PASS tests/deployment; browser row rendered before detail transport interruption |
| GFS-139 professional dashboard | tabs/counts/pagination/filters/autoselect/details/receipt/actions | PASS 87 tests/deployment; post-deploy browser blocked by MCP response hang |
| GFS-139 rejected order audit | actor/timestamp/reason history preserved, no reversal | PASS D1 read-only evidence |
| GFS-140 browser dashboard | four tabs, four orders, auto-details, receipt link, actions | PASS real Chrome snapshot after MCP dependency recovery |
| GFS-141 shipping labels | escaped A6/4×6 label, tracking assignment, order safety | PASS 91 tests; no real order mutation |
| GFS-141 operational actions | confirm/clearer/review/fulfillment guards and audit | PASS implementation/tests; real rejected order untouched |
| GFS-143 media migration | schema tables, gallery constraints, private R2 path | PASS migration applied; browser upload/delivery pending |
| GFS-144 CMS media delivery | approved upload, R2/D1 gallery, published WhatsApp image WAMID | BLOCKED/unverified: no browser media evidence captured |
| GFS-92 token ladder | active `/me` → permissions → phone → WABA | FAIL: all Graph-backed reads return HTTP 401; secret values not inspected |
| GFS-98 token recovery | owner-installed secret → Graph ladder → API/Admin readiness | PASS fresh token; no token value inspected |
| GFS-98 atomic reply | one failed event retry, outbound ID, status webhook, no duplicate | PASS: WAMID persisted, SENT status persisted, duplicate count 0 |
| GFS-98 delivery | delivered status and Flow/order completion | BLOCKED/PENDING customer interaction and delivery callback |
| GFS-96 token recovery | revoke exposed token before replacement | BLOCKED: Meta revoke control unavailable in loading system-user tabs |
| GFS-60 active sender authority | current state, sender, Phone Number ID, historical sender exclusion | PASS: `META_ASSETS_PENDING`, `+923044429933`, `1323932417479627` |
| GFS-60 MCP recovery | existing profile, DevToolsActivePort, package, registration, namespace exposure | BLOCKED: local prerequisites present; Codex registration has stale WebSocket UUID and active namespace is unavailable |
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
