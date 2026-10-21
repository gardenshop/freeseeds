# Test Matrix

## GFS-187 Payment Save and Real E2E

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Branch/accounts | PASS | Starting HEAD7bbea9d; GitHub gardenshop; Cloudflare/Admin gisupp@gmail.com |
| Chrome list_pages/tester/Admin | BLOCKED | Chrome DevTools MCP absent; no alternate browser/debug-port use |
| Copy-only settings save | PASS LOCAL | Verified enabled synthetic method retains qr_owner_verified, enabled and asset evidence |
| Recipient/till change | PASS LOCAL | Method disabled before identity save; migration0024 clears owner/evidence; audited re-verification |
| Existing QR integrity | PASS read-only reused | All three active method-specific hashes/decoder/payload/scan pass |
| QR upload/R2/D1 pipeline | PASS existing implementation/tests; not live re-uploaded | No R2/D1 mutation; preserve originals/derivatives |
| Current real eligibility | BLOCKED safely | All three enabled0/owner0, independent refs absent, amount config0 |
| Provider verification | BLOCKED | No new authenticated merchant/bank document available |
| Actual WhatsApp EN/UR checkout | BLOCKED | No eligible method and Chrome MCP unavailable; no transfer authorization |
| Receipt/PAID/fulfillment | BLOCKED correctly | No funds/reference/approval; no financial mutation |
| Historical hold | PASS | FS-261019-000001 unchanged |
| Sensitive D1 output incident | INCIDENT | First read returned raw recipient identifiers; omitted from repo/docs; owner review required |
| Quality | PASS | npm ci;138/138; build/lint/audit0; both Wrangler dry-runs |
| Deployment | NOT PERFORMED | Chrome retest absent; staging versions unchanged |

## GFS-187 Payment Setup and Real E2E

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Branch, accounts, protected docs | PASS | Starting HEAD7bbea9d fetched; GitHub gardenshop, Cloudflare/Admin gisupp@gmail.com |
| Chrome `list_pages`/tester profiles | BLOCKED | Chrome DevTools MCP unavailable; no substitute browser/debug port used |
| QR integrity/provenance | PASS reused/read-only | Existing three assets active and decoder/payload/scan pass; independent ownership/ref absent |
| Copy-only Admin save | PASS LOCAL integration | Synthetic verified enabled fixture retains enabled/owner/evidence; real Admin Worker unchanged |
| Recipient/account change | PASS LOCAL integration | Synthetic change disables before save; D1 trigger clears owner evidence and creates reverify audits |
| R2 upload/original/derivative synchronization | PASS existing / no new upload | Existing code/tests retained; no QR upload or private storage mutation |
| Authentic provider evidence | BLOCKED | No authenticated merchant/bank evidence; all real methods disabled |
| Real WhatsApp payment flow | BLOCKED | No qualifying method and no Chrome MCP; no message/order created |
| Receipt/PAID/fulfillment | BLOCKED safely | No genuine funds/reference/authorized approval; no receipt or financial mutation |
| Security/incident hold | PASS containment | `FS-261019-000001` unchanged; no CAPI/payment/DLQ replay |
| D1 data disclosure | INCIDENT | Initial broad read returned raw recipient identifiers; not copied to repo; owner review required |
| Local quality | PASS | npmci;138/138; build/lint/audit0; API/Admin Wrangler dry-runs |
| CI | BLOCKED external | Run39500843883 failed before steps under billing lock; no bypass |
| Post-push CI | BLOCKED external | Run39558420776 job had zero steps; existing billing lock; no bypass |
| Live deploy | NOT PERFORMED | No Chrome retest; staging stays API5151e081/Admin6fb34f89 |

## GFS-186 Full Browser Fixture Matrix

| Requirement | Result | Evidence / scope |
|---|---|---|
| Token-free Meta incident check | PARTIAL | Hoja + four unrelated entries confirmed Removed, no restore controls; bearer invalidation still needs owner confirmation |
| No asset churn | PASS in GFS-186 | No remove/reconnect, CAPI token generation, message, payment, or deployment |
| Real staging method guard | PASS fail-closed | Three disabled, owner false; paymentConfigured and amount config false |
| Existing real WhatsApp lead journey | PASS reused | GFS-183 order/WAMIDs/screenshots same API; no repeat/new order |
| Isolated harness network boundary | PASS | Loopback-only HTTP; CSP connect-src none; browser requests only local file, data/blob images and installed Chrome extension; no external endpoint |
| Isolated storage | PASS | `File` object held in memory; image blob preview; object URL revoked on reset; local/session storage0; reload clears NP order |
| English complete visual flow | PASS SIMULATED | Welcome/language/add fertilizer/Test South/five fields/review/back/place/selector/details/upload/status/Admin/reject |
| Urdu complete visual flow | PASS SIMULATED | Welcome/language/Seeds Only/Test North/five fields/review/back/place/selector/details/upload/status/Admin/sim approval/fulfillment |
| All three method fixtures | PASS SIMULATED | Unique TEST JC/EP/IBAN details and QR-like hashes350099772/909545255/2699088081; correct amount; no cross-mix; not scannable |
| Receipt upload and Admin preview | PASS SIMULATED | Actual synthetic SVG browser file upload, visible memory-only blob preview, no R2/D1 |
| Invalid receipt handling | PASS SIMULATED | Invalid MIME produces error; valid SVG clears it; max2MiB guard present |
| Duplicate/rejection | PASS SIMULATED | Duplicate suppressed/one in-memory ID; Admin rejection is TEST REJECTED, no payment |
| Approval/fulfillment | PASS SIMULATED ONLY | Explicit NOT PAID / NOT DISPATCHED, in-memory audit only; no real PAID state |
| Real receipt/PAID/fulfillment | BLOCKED correctly | No method eligible, funds/reference/approval absent |
| Full local quality | PASS | npmci; 137/137; build/lint/audit0; both Wrangler dry-runs |
| Remote CI | BLOCKED external | Post-push39500604300 explicitly billing-locked before all steps; no bypass |

## GFS-185 Launch Blocker Audit

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Current accounts/branch | PASS | GitHub gardenshop, Cloudflare/Admin gisupp@gmail.com, current branch fetched |
| WhatsApp sender/display name | PARTIAL | Correct connected GFS sender, High quality; display name remains DECLINED, no authorized review result |
| Ads-to-WhatsApp CTA | BLOCKED | All nine campaigns off; no active/draft preview CTA; no publish/spend |
| Clean dataset ownership | PASS | Dataset1210750267244729 owner Garden Shop, business connected, Web-only |
| Dataset website boundary | PASS after repair | Fresh reload confirms only Garden Shop domain allowlisted; pixel details/cookies/advanced matching ON, consent not established |
| Dataset token/system-user permission | BLOCKED | GFS WhatsApp token perms lack Marketing/dataset access; no clean system-user token evidence |
| Lead Test Event/ack | BLOCKED | Dataset last received174 days ago; none sent; CAPI off |
| Hoja isolation | PASS after repair | Both Hoja website domains removed from clean GFS dataset allowlist; only Garden Shop domain remains |
| Display name review | BLOCKED | Name remains declined; no new supported approval decision; no blind retry |
| Payment recipients | BLOCKED | JazzCash till/Easypaisa alias/Bank QR-to-IBAN-Raast independent evidence absent; all methods disabled |
| Existing real Chrome E2E | PASS reused | GFS-183 order, 19 READ WAMIDs, 19 screenshots; no repeat needed |
| Real payment/PAID | BLOCKED | No eligible method/funds/reference/approval; no financial mutation |
| Token leak containment | PARTIAL | Explorer closed; Hoja integration removed and token not reused; bearer invalidation cannot be tested without token use; owner confirmation/revocation required |
| Unrelated Meta integrations | BLOCKED recovery | Wix, Daraz Seller Center, WooCommerce by Meta, Zapier also show Removed; UI has no Restore action; owner/provider reauth required |
| Worker/local quality | PASS carried forward | No code change/deploy; GFS-183 135 tests/build/lint/audit/Wrangler evidence retained |
| CI | BLOCKED external | Post-push39491350447 has zero steps and explicit account billing-lock annotation; no bypass |

## GFS-184 Payment Journey Comparison and Fixture Coverage (2026-10-20)

| Requirement | Result | Evidence / limit |
|---|---|---|
| Historical/current comparison | PASS | `8f1c2da` docs only; `c57c252` guided hardening present; no wholesale rollback |
| Live payment selector gate | PASS fail-closed | Independent ownership + complete locale + active method-linked provenance required; actual three methods reject |
| No-method UI | PASS REAL carried forward | GFS-183 order received no-payment notice and distinct Check Order; no legacy help/support selector buttons |
| D1/Admin sources | PASS read-only | Payment copy/private method QR previews load; all three disabled/unverified; no amount configuration |
| NON-PAYABLE method separation | PASS LOCAL | Fixture method, recipient and labels are synthetic; no real configuration/QR loaded |
| JazzCash EN/UR composition | PASS LOCAL | Amount, order, unique method fixture details compose; mock image call only |
| Easypaisa EN/UR composition | PASS LOCAL | Separate method fixture details; mock image call only |
| Bank EN/UR composition | PASS LOCAL | Separate method fixture details; mock image call only |
| Private receipt + Admin rejection | PASS LOCAL | Synthetic no-store receipt, actual Admin reject route against SQLite fixture; status REJECTED |
| Real receipt/PAID/fulfillment | BLOCKED correctly | No verified method/funds/reference/approval; no mutation |
| Real Chrome journey | PASS carried forward | GFS-183 `FS-261020-000011`, 19 READ WAMIDs, 19 screenshots, Admin/D1 reconciliation |
| Full quality gate | PASS | 135/135 tests, build/lint/audit0, Wrangler dry-runs; no source change this run |
| Remote CI | BLOCKED external | Post-push run39477757383, zero steps, explicit billing lock; no bypass |

## GFS-183 Requirement Comparison (2026-10-20)

| Prompt requirement | Result | Real evidence / scope boundary |
|---|---|---|
| Chrome first, own Profile Phone, GFS Contact Info | PASS | Existing tabs; both authorized numbers verified before sending; no unrelated chat activity |
| GitHub/Cloudflare/Admin identities | PASS | gardenshop; gisupp@gmail.com; clean GFS account; correct branch/PR |
| Active callback/bindings/flags/rollback inspection | PASS | Tester-only recent traffic, no pending payment job, flags OFF, previous Worker retained |
| Clean install/full local gate | PASS | npm ci, 135/135, build, lint, audit 0, both Wrangler dry-runs |
| Staging deployment/live signatures | PASS | API 5151e081 at 17:51:49Z; health200/unsigned401; 19 genuine signed callbacks and READ WAMIDs |
| Fresh EN START/language/fertilizer | PASS REAL | Welcome, English, Seeds Only actual taps/responses; screenshots 01-02 |
| Province LIST/D1 fee | PASS REAL | Seven options, Punjab PKR250; screenshot03 |
| Exactly five delivery fields | PASS REAL | Synthetic name/address/landmark/city/authorized contact; screenshots04-09 and Admin16 |
| Review/Back/Place Order | PASS REAL | Back reopens contact; re-review then one confirmed order; screenshots09-11 |
| Payment selection and order status | PASS REAL fail-closed | No verified methods, no-payment notice, separate Check Order; screenshots11-12 |
| Duplicate/stale action safety | PASS REAL scoped | Repeated PLACE_ORDER rejected and one new order remains; arbitrary simultaneous confirmation is local-only evidence |
| Same-version Urdu | PASS REAL safe branch | Fertilizer, localized fees/LIST, name prompt, existing-order status; screenshots13-15, no duplicate order |
| Per-step provider/D1/Admin evidence | PASS REAL | Nineteen READ WAMIDs; order fields/amount/state/audit and exact mapping in FINAL_REPORT |
| Private masked screenshots | PASS | 19 local files D:/Temp/kilo/gfs183-*.png; no QR/recipient secrets or unrelated conversations in evidence |
| Admin method-linked QR/EN/UR editable previews | PASS REAL read-only | Three private200 PNGs render800x800; editable preview restored without save |
| Isolated NON-PAYABLE payment tail | PASS LOCAL / NOT LIVE PAYABLE | Selection rejection, six formatter/mock-image calls, private mocked R2 receipt and actual Admin rejection route on synthetic SQLite |
| Beneficiary/real PAID/fulfillment | BLOCKED | Three methods disabled/unverified; no new beneficiary proof or authorized funds; incident held |
| Durable sender rate limit | PASS | Atomic D1 trigger; 30/60s; duplicates/status exempt; 429+Retry-After; local concurrent/isolation/cleanup tests |
| Deployed limit overflow | PASS isolated staging storage | 31 synthetic admissions rejected atomically, zero residual rows; not a live 31-message customer flood |
| Duplicate/concurrent/delayed/reordered callbacks | PASS LOCAL / REAL ordinary callbacks | Signed/SQLite tests and live READ states; no forged or replayed provider callback |
| Queue retry/DLQ isolation | PASS LOCAL / preserved live | DEAD_LETTER terminal fix; bounded retries; historical jobs unchanged/no financial replay |
| Clean CAPI permissions/Test Event | BLOCKED | Test code available, but Explorer is Hoja app/token; no permitted token used, no acknowledgement; CAPI OFF |
| Display name/public consent | BLOCKED release | Name DECLINED; public authorization absent; inbound tester consent/window is not public release approval |
| Privacy/security | PASS scoped | Live privacy/data deletion200, unsigned401, Admin Access302; local CSRF/signature/privacy regressions |
| Remote CI | BLOCKED external | Baseline39467663972; post-push39474453497 has zero steps and explicit account billing-lock annotation; no protections bypassed |
| Protected records/push | PASS on completion | Seven required records updated; source commits retained; images untouched |

## GFS-182 Final Launch Readiness (2026-10-20)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Baseline/protocol reuse | PASS | Fetched `72fd50e`; GFS-178/GFS-181 QR/live lead evidence reused; no unrelated replay |
| Callback duplicate/idempotency | PASS synthetic | Provider event unique key plus `INSERT OR IGNORE`; concurrent duplicate status writes leave one event |
| Delayed/reordered callbacks | PASS synthetic | Monotonic `SENT <= DELIVERED <= READ`; delayed `DELIVERED`/`SENT` cannot regress `READ` |
| Order isolation/replay | PASS | Existing multi-channel idempotency/order-number/cooldown tests; historical orders untouched |
| Queue retry/backoff | PASS synthetic | Bounded retry delay and max-five attempt behavior covered; payment stale job remains blocked |
| DLQ recovery | PARTIAL/BLOCKED | Terminal DLQ and ack behavior pass; no automatic replay route exists, and no authorized provider recovery/replay was attempted |
| Consent/customer eligibility | PARTIAL | Inbound/customer-service boundaries and controlled tester evidence pass; public consent/release evidence unavailable |
| Privacy/data deletion | PASS local | Raw message bodies excluded; privacy/data-deletion routes and normalized persistence covered |
| Signed webhooks/canonical sender | PASS local | HMAC, canonical Phone ID, stale/forged callback rejection and sanitized audit covered |
| Rate limits | BLOCKED | No edge/durable per-sender rate-limit control is configured or evidenced |
| Correct CAPI dataset | PASS identification | Events Manager clean `Free Seeds` dataset `1210750267244729` observed read-only; Hoja dataset untouched |
| CAPI integration/token permissions | BLOCKED | Dataset reports `No Integrations`; no configured dataset/token permission evidence |
| CAPI test events/acknowledgement | BLOCKED | Test Events surface exists but no authorized test code/event was sent; no provider acknowledgement |
| Lead event deduplication | PASS local / pending live | Deterministic `lead_<FS_ORDER_ID>`, D1 uniqueness and outbox idempotency; staging rows remain `PENDING/0` |
| Meta name/release route | BLOCKED | Name remains DECLINED; no eligible review/support path appeared |
| Payment methods | BLOCKED safely | All three private QR drafts remain disabled/unverified; no new beneficiary proof |
| Incident hold | PASS containment | `FS-261019-000001` preserved; no replay, receipt, approval, PAID, dispatch, or tracking mutation |
| Local quality | PASS | Full `132/132`, build, lint, audit 0 vulnerabilities, API/Admin dry-runs |
| Remote CI | BLOCKED external | Runs `39465975146` and post-push `39467542844` failed before steps with no runner; billing policy followed |
| Worker deployment | NOT PERFORMED | Active callback deployment preconditions were not re-established; versions/rollback unchanged |
| Release | SPLIT | Controlled staging readiness GO; public leads and payments NO-GO |

## GFS-181 Payment Resolution and Launch Completion (2026-10-20)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Required identity checks | PASS | GitHub `gardenshop`; Cloudflare/Admin `gisupp@gmail.com`; no external mutation |
| Chrome inventory and isolation | PASS read-only | `list_pages` first, 11 existing pages inspected/reused; Meta network errors recorded; no unrelated navigation/message |
| Owner QR draft acceptance | PASS | All three private method-specific QR assets present in Admin/R2/D1; draft state preserved |
| QR integrity/provenance | PASS | Active method linkage, hashes, decoder agreement, payload match, scan pass for all three |
| Owner attestation separation | PASS | `USER_ASSERTION_GFS-176` remains separate; ownership flags/evidence refs are false/empty |
| JazzCash beneficiary | BLOCKED | Decoded identifier matches D1; independent wallet record linking it to Garden Shop unavailable |
| Easypaisa beneficiary | BLOCKED | Decoded identifier differs from D1 and matches printed alias candidate; independent alias ownership unavailable |
| Bank Transfer beneficiary | BLOCKED | Decoded destination matches neither configured IBAN nor printed alternate; independent bank linkage unavailable |
| Method enablement | PASS fail-closed | All three `enabled=0`; no selector method; no amount/payment configuration |
| Admin EN/UR save/publish/reload | PASS carried forward | GFS-178 CMS publish/rollback and current Payment Settings EN/UR reload evidence; no new copy mutation |
| Payment selector exclusions | PASS local/staging read-only | Only verified complete methods can appear; Help/Support/Check Order are not selector actions |
| Real EN/UR customer journey | PASS lead-only | GFS-178/GFS-180 WELCOME through order, WAMIDs, screenshots, Admin/D1 matching unpaid orders |
| Real payment tail | BLOCKED | No verified method, authorized transaction, receipt, PAID, Purchase CAPI, or fulfillment evidence |
| Simulated blocked-method transport | PASS | Affected synthetic NON-PAYABLE fixtures: 53/53; no financial mutation |
| Incident hold | PASS containment | `FS-261019-000001` unchanged and held; no replay/reversal/dispatch |
| Public lead-only requirements | PARTIAL | Identity/privacy/webhook/retry gates pass locally; concurrency/reordering, Lead CAPI, name/release approval remain open |
| Local quality | PASS | Full 131/131 tests, build, lint, audit 0 vulnerabilities, API/Admin dry-runs |
| Remote CI | BLOCKED external | Verify run `39448956004` had no runner/steps; billing policy remains non-blocking for permitted staging work |
| Release | SPLIT | Controlled staging lead-only GO; public leads and payments NO-GO |

## GFS-178 Real Versus Simulated Evidence (2026-10-20)

| Requirement / State | Actual Result | Evidence / Limit |
|---|---|---|
| Canonical Meta / Graph | PASS eligibility; name FAIL | Phone VERIFIED/GREEN, permissions granted, WABA subscribed; name DECLINED; live READ/DELIVERED outbound proves messaging works |
| Name appeal / username | BLOCKED appeal; PASS preservation | Support Request Review disabled/no eligible issue; only replacement-name dialog. No submission/reference, no alternate name; @FreeSeeds unchanged |
| Tester account | PASS actual profile | Own Profile Phone matches tester; recipient Contact Info matches GFS sender; not a chat-list assumption |
| CMS save/publish/rollback | PASS | Validation v2 EN/UR copy produced real tester replies; rolled back to approved v1; archived v2 and draft v3 matches v1 |
| Confirmation total wording | PASS EN | Repaired `Total ayable` typo to `Total payable`; live confirmation verified on unpaid test order 000010; Urdu/D1 placeholders unchanged |
| WELCOME / LANG_EN / LANG_UR | PASS live | Real inbound/outbound; Urdu initial Graph 500 recovered after rollback/retry |
| Seeds Only / Add Fertilizer | PASS live | EN seeds-only 250; UR fertilizer 500; amounts cross-checked D1 |
| Seven province LIST rows | PASS live EN/UR | Actual Meta LIST with title/fee descriptions; Punjab selection; UR LIST screenshot verified. No tariff edit attempted |
| Exactly five fields | PASS live both locales | Synthetic name/address/landmark/city; authorized tester contact; no sixth field |
| Invalid input / Back | PASS live | Invalid EN contact has no Place Order buttons; Back returns contact; quote preserved. Generic validation text remains CMS-controlled |
| Review / Place Order | PASS after live repairs | Returning wa_id collision and Urdu catalog leakage reproduced/repaired/retested; real orders 000008/000009 |
| No eligible payments | PASS live fail-closed | No selector, QR, payment invitation or payment job; clear localized unavailable notice; Check Order only post-order |
| Status / START / disabled-method text | PASS live | Same unpaid order/reference retained; UR status labels localized |
| Webhook replay / forged callbacks / queue | PASS simulated | Signed requests/SQLite/Graph mock regression; delivered sequential replays and disabled jobs safe; arbitrary concurrency/reordering NOT proven live |
| D1 / authenticated Admin | PASS live | UI and API show test orders 000008/000009/000010 PENDING, totals 250/500/250, zero receipts, null method, no confirmation/label actions |
| Receipt / rejection / approval / PAID | BLOCKED live | No beneficiary proof or real transaction authorization; no fabricated receipt/payment; financial guard regressions simulated only |
| Financial incident / CAPI | PASS containment, BLOCKED closure | Held order unchanged; Purchase FAILED/5/DISABLED; new Lead events pending, no Purchase |
| CI | FAIL billing, not code | Official annotation: account locked due to billing issue; nonblocking staging rule used; no billing/protection bypass |
| Regression / deployment | PASS local/staging | 131 tests, build/lint/audit, final API 8a045e16; rollback versions retained. No production release |

## GFS-177 Active Staging Evidence (2026-10-20)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Admin EN/UR payment settings | PASS staging | Admin Worker `6fb34f89-dc19-4cec-9347-ec1ce6bf299d`; fresh reload confirms all D1 EN/UR fields/receipt copy render correctly; all methods remain disabled |
| Province selector | PASS local / BLOCKED live | Seven enabled D1 rates and bilingual CMS list labels; commit `0e12c62` passes LIST payload/title/description/row-cap tests; API Worker not deployed |
| Meta sender | BLOCKED for sends | Canonical WABA context matches rules; sender Connected/High but display name Rejected; `messages` webhook is subscribed to staging API callback |
| Tester E2E | BLOCKED | Admin has authorized tester record and existing pending order; WhatsApp Web account/chat not verified; no message/WAMID/screenshot |
| Payment safety | PASS fail-closed | All three methods disabled/unverified; stale/legacy payment actions filtered in local source; no receipt/approval/send performed |
| Queued payment instructions | PASS blocked | 12 pending/zero-attempt instruction jobs marked terminal `PERMANENT_FAILURE` with audit; previously SENT records unchanged; no payment order state changed |
| Incident/CAPI | BLOCKED resolution | Incident unchanged PAID/PACKING/APPROVED/reference missing; Purchase CAPI FAILED/5/DISABLED/no provider id; Lead PENDING/0; no replay |
| Local quality | PASS | 14 files/114 tests, build/lint, 0 high audit findings, API/Admin Wrangler dry-runs PASS |
| Release | BLOCKED | Admin-only staging deployment done; API is active Meta webhook and sender display name is Rejected; CI run `39419025641` has no runner/steps; no production action |

## GFS-176 Evidence (2026-10-20)

| Method | QR-only image | Two-decoder/source-payload match | Derivative scan | Beneficiary validation | EN/UR data | Live delivery/WAMID/screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| JazzCash | PASS, private 800×800 PNG | PASS: jsQR/ZBar agree; derivative exact payload hash | PASS, both decoders | D1 identifier exact match; independent owner proof BLOCKED | PASS D1 copy/placeholder fields; old deployed preview still misses Urdu heading/receipt | BLOCKED: no authorized tester chat/WAMID/screenshot |
| Easypaisa | PASS, private 800×800 PNG | PASS: jsQR/ZBar agree; derivative exact payload hash | PASS, both decoders | BLOCKED: QR identifier differs from D1 but matches printed candidate alias; alias ownership evidence absent | PASS D1 copy/placeholder fields; old deployed preview still misses Urdu heading/receipt | BLOCKED: no authorized tester chat/WAMID/screenshot |
| Bank Transfer | PASS, private 800×800 PNG | PASS: jsQR/ZBar agree; derivative exact payload hash | PASS, both decoders | BLOCKED: payload has no exact D1 IBAN or printed alternate match; owner alias evidence absent | PASS D1 copy/placeholder fields; old deployed preview still misses Urdu heading/receipt | BLOCKED: no authorized tester chat/WAMID/screenshot |
| Original retention and linkage | PASS: R2 source checksums unchanged after extraction | PASS: source/derivative/payload hashes, MIME, dimensions, decoder versions and attestation stored in D1 | PASS | Independent verification remains false for all | N/A | N/A |
| Staging method eligibility | All three derivative keys associated in Admin D1 | N/A | N/A | All `qr_owner_verified=0` | All three methods disabled; original recipient/account fields unchanged | Current customer selector not live-tested |
| Legacy QR self-verification protection | N/A | N/A | N/A | D1 triggers 0022/0024 block enable/self-verify absent matching independent evidence and revoke evidence on recipient/account change | Existing deployed Admin shows old checkbox, but D1 write guard is present; no true flag attempted | No customer method selected |
| EN/UR payment formatter | N/A | N/A | N/A | N/A | PASS staging D1 saves; local formatter/tests use separate templates/placeholders; deployed UI preview remains stale until PR code deploy | BLOCKED customer rendering |
| Guided customer buttons | N/A | N/A | N/A | N/A | N/A | BLOCKED individually: `LANG_EN`, `LANG_UR`, `ADD_FERTILIZER`, `SEEDS_ONLY`, each province, five fields, `PLACE_ORDER`, `BACK`, payment selection, receipt, `CHECK_ORDER`, stale/expired actions, Admin Orders; no WAMID/screenshots |
| Incident | N/A | N/A | N/A | N/A | N/A | `FS-261019-000001` remains PAID/PACKING/APPROVED, reference missing; Purchase CAPI FAILED/5 attempts/error class DISABLED/no provider ID; Lead PENDING/0 attempts; D1 trigger 0023 blocks new fulfillment/confirmation/tracking audit entries; no replay |
| Local release gates | N/A | N/A | N/A | N/A | N/A | 112/112 tests, build, lint, 0 high-severity audit findings, API/Admin dry-runs PASS; PR runs `39403272414` and `39403788146` have no runner/steps; no deployment |

## GFS-175 QR Extraction and Launch Evidence (2026-10-20)

| Area | Required coverage | Status |
| --- | --- | --- |
| Chrome MCP | `list_pages` first; reuse authenticated Admin/customer tabs; unrelated-tab count | PARTIAL/BLOCKED: stale Codex endpoint corrected to current DevToolsActivePort; active session still exposes no MCP tools, so `list_pages` and browser inspection remain unavailable; tabs changed 0 |
| JazzCash QR | immutable original → QR-only derivative → exact decoded payload match → scan PASS → authorized recipient | BLOCKED: private R2 source unavailable; ownership unverified; no derivative or live evidence |
| Easypaisa QR | immutable original → QR-only derivative → exact decoded payload match → scan PASS → authorized recipient | BLOCKED extraction/scan; ownership FAIL/BLOCKED due recorded merchant/account mismatch |
| Bank Transfer QR | immutable original → QR-only derivative → exact decoded payload match → scan PASS → authorized recipient | BLOCKED extraction/scan; ownership FAIL/BLOCKED due recorded `BIO TECH - 5038` mismatch |
| QR integrity/rollback | source preservation, deterministic repeat upload, derivative linkage/hash/MIME, rollback | PASS local deterministic source-object implementation; derivative/linkage/rollback evidence BLOCKED |
| Ownership authorization | reject ordinary UI/API self-verification; preserve independent evidence gate | PASS local source change; no account authorization recorded |
| Payment methods/WhatsApp | Admin→QR→payload→recipient→method-specific customer render→WAMID/status/screenshot, each method | BLOCKED: no MCP pages, customer session, fresh method delivery, WAMID or screenshot |
| Journey EN/UR | `LANG_EN`, `LANG_UR`, `ADD_FERTILIZER`, `SEEDS_ONLY`, each D1 province, five delivery fields, `PLACE_ORDER`, `BACK`, three payment IDs, receipt/status, `CHECK_ORDER`, stale/expired actions, Admin Orders | BLOCKED live for each action; selector exclusions and localized stale-action fallback remain source-level only |
| Financial incident | `FS-261019-000001`, independent bank verification, reference, hold, failed Purchase CAPI | Incident remains unresolved and held; no mutation/replay/dispatch |
| Regression | tests, build, lint, dependency audit, Wrangler, PR CI | PASS local: `npm ci`, 106/106 tests, build, lint, audit 0 vulnerabilities, API/Admin Wrangler dry-runs; remote CI/deploy not run |

## GFS-174 Evidence Gate (2026-10-20)

| Area | Required coverage | Status |
| --- | --- | --- |
| Guided state/validation | WELCOME → language → fertilizer → D1 province/tariff → five fields → review → payment | PASS local implementation/tests; live customer evidence BLOCKED by MCP |
| Payment selector | Only eligible JazzCash/Easypaisa/Bank Transfer; no Help/Support/Check Order | PASS static/runtime repair; live buttons/WAMIDs BLOCKED |
| Locale/CMS | EN/UR published content, locale-complete methods, legacy action filtering | PASS local implementation/tests; Admin publish/reload BLOCKED |
| Receipt/status | Receipt audit and localized Check Order after upload | PASS local implementation; live receipt/status BLOCKED |
| QR/financial safety | Exact R2 metadata, independent ownership, transaction reference, incident hold | PASS fail-closed guards; ownership/incident authorization BLOCKED |
| Browser/Admin | `/whatsapp-content`, `/payment-settings`, `/tariff`, `/orders` authenticated workflows | BLOCKED: active MCP `list_pages` unavailable; no mutation claimed |
| Quality | Tests/build/lint/audit | PASS: 105/105, build, lint, 0 high-severity audit findings |
| Deploy/CI | Canonical production deploy and legitimate PR CI | BLOCKED/NOT RUN: no deploy mutation; PR/CI/merge status requires remote verification |

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
| GFS-151 Orders loading | timeout, non-JSON, retry, stale request, URL hydration | PASS 92 tests/deployment; browser post-deploy retest pending |
| GFS-152 Orders script | generated JS parse/startup, four tabs/counts, timeout/retry, auto-select | PASS 93 tests/deployment; browser retest pending MCP response |
| GFS-153 browser Orders | four orders/counts/details/receipt/payment tabs after reload | PASS actual Chrome snapshot with four orders and selected detail panel |
| GFS-155 CMS action mapping | versioned EN/UR stable labels across guided actions | PASS 100 tests and Admin preview evidence |
| GFS-155 media publication | gallery-only clone, stale selection invalidation, R2 snapshot | PASS D1/R2/WAMID sent evidence; customer rendering unverified |
| GFS-156 Fertilizer CMS | overlength label validation, EN/UR correction, publish compatibility | PASS D1 correction/audit; real customer button rendering pending |
| GFS-157 live province fees | enabled D1 rates → list options/descriptions → quote | PASS implementation/deployment; real customer tap pending |
| GFS-158 payment settings | single route, bilingual fields, QR/enable controls | PASS tests/deployment; live browser evidence pending |
| GFS-159 payment messages | EN/UR copy, one reference, server amount/recipient placeholders | PASS 100 tests/deployment; live customer rendering pending |
| GFS-166 payment selector | three enabled methods, stable IDs, selected details/locale | PASS 102 tests/deployment; live customer method taps pending |
| GFS-160 payment settings browser | three methods, JazzCash enabled/QR, generated JS | PASS live authenticated snapshot; save/reload mutation not performed |
| GFS-161 live Admin | Payment Settings and CMS browser snapshots, bilingual/media state | PASS actual authenticated snapshots; customer image WAMID pending |
| GFS-169 tester authorization | WhatsApp Profile Settings identity, registered wa_id, protected reset | PASS: project-authorized tester verified; reset returned 200/history preserved; unrelated tabs changed 0 |
| GFS-169 live guided checkout | START → Welcome image → EN → fertilizer → province fee → five fields → review → order | PASS: real order `FS-261019-000001`, PKR 500, Admin/D1 `PAYMENT_PENDING` |
| GFS-169 payment selector | complete enabled methods only; no Help/Support/Check Order selector control | PASS: JazzCash, Easypaisa, Bank Transfer only |
| GFS-169 payment details | same-order JazzCash/Easypaisa/Bank Transfer rendering; persisted amount/reference; no duplicate order | PASS API HTTP 200 for all three, PKR 500; final Admin method BANK_TRANSFER; no receipt/approval |
| GFS-169 WAMID evidence | authenticated Meta/D1 WAMIDs for live journey | BLOCKED/UNAVAILABLE: WhatsApp Web/Admin surfaces exposed no WAMID; no ID inferred |
| GFS-169 payment safety | no fake receipt, PAID, CAPI, fulfillment, or financial approval | PASS: order remains PAYMENT_PENDING with no receipt |
| GFS-169 deployment identity | Wrangler account and active API/Admin versions | PASS: `gisupp@gmail.com`, clean account; API `2c0335e7-0914-42eb-9501-b207bbe9752b`, Admin `f7acf3f3-4e5e-498e-bdd5-697eb30cd0de` |
| GFS-170 QR root cause | guided payment branch loads selected method QR rather than CMS gallery | PASS implementation: private R2 method lookup and dedicated QR provider send |
| GFS-170 QR integrity | ownership gate, R2 MIME/signature, size, checksum, method metadata | PASS local tests; live JazzCash QR remains blocked because `qr_owner_verified=0` and payee ownership is unverified |
| GFS-170 outbound idempotency | independent text/QR rows, provider IDs, retry only failed part | PASS implementation/tests; live Meta WAMIDs/status callbacks pending browser access |
| GFS-170 JazzCash | enabled, complete, private JPEG QR, ownership verified, live image/WAMID/customer screenshot | BLOCKED: QR present but ownership gate false; browser MCP unavailable; no image/WAMID claimed |
| GFS-170 Easypaisa | enabled, complete, no QR fallback, live text/WAMID/customer screenshot | BLOCKED: text-only configuration known from masked D1; browser MCP unavailable |
| GFS-170 Bank Transfer | enabled, complete, no QR fallback, live text/WAMID/customer screenshot | BLOCKED: text-only configuration known from masked D1; browser MCP unavailable |
| GFS-170 payment safety | no duplicate order, receipt, approval, PAID, CAPI, fulfillment | PASS: no live customer mutation performed in this execution |
| GFS-171 QR reconciliation | all three Admin rows, private R2 HTTP/MIME/size/SHA, timestamps and ownership flags | PASS: three current JPEG objects match D1; all ownership flags false |
| GFS-171 JazzCash ownership | visible QR payee/account matches Admin recipient and independent ownership evidence | BLOCKED: visual Garden Shop/TILL consistency; independent authorization not recorded |
| GFS-171 Easypaisa ownership | visible QR payee/account matches Admin recipient | FAIL/BLOCKED: visible merchant identifier differs from configured account; QR delivery remains blocked |
| GFS-171 Bank ownership | visible QR payee/account matches Admin recipient | FAIL/BLOCKED: visible BIO TECH - 5038 differs from configured Garden Shop; QR delivery remains blocked |
| GFS-171 JazzCash live | fresh order method text, WAMID/status, QR safety, Admin/D1 match | PASS text WAMID READ and PKR 500; QR correctly SKIPPED/unverified |
| GFS-171 Easypaisa live | post-repair customer text/QR/WAMID/status | BLOCKED: pre-repair click had no response; MCP unavailable for post-deploy retest |
| GFS-171 Bank Transfer live | customer text/QR/WAMID/status | BLOCKED: MCP unavailable before selection |
| GFS-171 protected order history | preserve paid historical order and avoid unsafe reset | PASS: `FS-261019-000001` untouched; new pending order `FS-261019-000002` used |
| GFS-172 MCP recovery | authenticated list_pages and reuse protected tabs | PASS intermittent; no Chrome restart; later bridge instability remains |
| GFS-172 QR authority correction | clear unsafe ownership flags only after visible recipient mismatch and identity verification | PASS: Easypaisa and Bank flags cleared; JazzCash remains blocked |
| GFS-172 JazzCash live | text, amount/reference, WAMID/status, QR safety | PASS text `READ`; QR `SKIPPED` unverified |
| GFS-172 Easypaisa live | text, amount/reference, WAMID/status, QR safety | PASS text `READ`; QR `SKIPPED` unverified |
| GFS-172 Bank live | text, amount/reference, WAMID/status, QR safety | FAIL/INCIDENT: text and QR `READ`, but delivered QR mismatched configured payee before flag clear |
| GFS-172 Check Order | authorized pending-order status response | PASS after space-to-underscore normalization repair; returned order, payment, amount, receipt and fulfillment state |
| GFS-172 paid-order forensics | actor, receipt, amount, transitions, CAPI, fulfillment | PASS evidence collected; INCIDENT/HOLD required due missing external verification/reference and `PACKING` transition |
| GFS-172 release gate | launch only with all QR ownership and critical regressions resolved | NO-GO |
| GFS-173 payment locale fields | EN/UR Payment Settings fields are isolated; English rejects Urdu contamination; Urdu fields are explicit | PASS local implementation/tests; live save/publish/reload not available without Chrome MCP |
| GFS-173 payment formatter | selected locale uses only its own localized customer copy; missing Urdu copy fails closed | PASS 105 local tests; live WhatsApp output BLOCKED |
| GFS-173 CMS fallback | missing translation emits safe locale-specific fallback and Admin warning without silent mixed-language output | PASS implementation; live Admin publish/reload BLOCKED |
| GFS-173 payment buttons | selector contains only complete enabled D1 methods; no Help/Support/Check Order selector actions | PASS implementation/tests; live button taps BLOCKED |
| GFS-173 stale actions | legacy payment-help/action rows are ignored; invalid taps return localized safe responses | PASS implementation/tests; live old-tap evidence BLOCKED |
| GFS-173 complete live bilingual journey | Welcome/image/language through receipt/status in EN and UR | BLOCKED: Chrome DevTools MCP unavailable in this execution |
| GFS-173 financial incident hold | paid/packing order forensic hold, no replay/reversal/dispatch | BLOCKED external Admin mutation; incident remains NO-GO and preserved |
| GFS-155 PR CI | GitHub required verify check | BLOCKED externally: workflow not started due account billing lock |
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
