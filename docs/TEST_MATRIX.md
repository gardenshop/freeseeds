# Test Matrix

## GFS-292 live export release and summary hold (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Account/version/binding verification | PASS | Cloudflare `gisupp@gmail.com`; Admin `b4c45278`100%/`c2e87231` rollback; API `8e670de8`100%/`d808a31c`0%; staging D1 UUID recorded. |
| CMS REVIEW v8 | PASS | Authenticated readback confirmed EN/UR published content and `{orderSummaryItems}`, `{deliveryFee}`, `{orderTotal}`. |
| Live export UI/download | PASS | Authenticated `/orders` button visible; export HTTP200, CSV attachment, private/no-store; 145 quote-aware parsed records and 18 columns. |
| Export filter completeness | PASS | All active total 145 matched export; REVIEW10, PENDING79 and PACKING1 matched filtered API totals; embedded newlines were parsed correctly and export is not page-limited. |
| Export safety/coverage | PASS | Five delivery fields, province/items/quantities/fees/total/payment/fulfillment/hold columns; no sensitive fields; local tests cover Unicode, leading-zero, formula and access control. |
| API summary live acceptance | BLOCKED SAFELY | Candidate health passed, but no genuine authorized inbound/outbound Meta proof or WAMID; API stayed on healthy version. |
| Reminder/payment safety | PASS PAUSED | All three flags false; no sends, backfill, payment, order, receipt, COD or schema mutation. |
| Regression/build/security/rollback | PASS | Focused18/18 after fix, full314/314, TypeScript build, ESLint, audit0, rollback4/4. |


## GFS-291 Admin export and staged summary release (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Healthy production preserved | PASS | API `8e670de8`100%, Admin `c2e87231`100%, faulty API `7b662e0d`0%; reminders false/false/false. |
| Existing dynamic summary reused | PASS LOCAL | Existing published `REVIEW` CMS key, dynamic quote/config placeholders, fallback and separate COD confirmation preserved; no second engine. |
| Protected Orders export | PASS | `/api/orders/export`, existing Admin authorization, same tab/payment-stage/payment/date/search/archive filters, private/no-store response. |
| Complete filtered export | PASS | 101 synthetic matching rows returned once through two bounded 100-row keyset reads; no duplicate references. |
| Required data safety | PASS | Exactly five customer-delivery fields; item/fee/total fields are persisted quote values; no receipts, QR, WAMIDs, secrets, or settlement credentials. |
| CSV safety/locale | PASS | UTF-8 BOM, quoted cells, formula-prefix neutralization, Urdu-safe text and leading-zero contact preservation. |
| Unauthorized export | PASS | Unauthenticated request returns HTTP403 `ADMIN_ACCESS_REQUIRED`. |
| UI path | PASS LOCAL | Orders page includes `Download Excel (CSV)` and exports current filter state; no duplicate customer summary content changed. |
| Candidate staging | PASS | Admin `2b1609d5` and API `d808a31c` at0%; healthy versions remain100%; API health HTTP200. |
| Genuine WhatsApp acceptance | BLOCKED SAFELY | No authorized device inbound/outbound proof; no WAMID, delivery or customer screenshot claimed. |
| Regression/build/security/rollback | PASS | Focused9/9, full314/314, TypeScript build, ESLint, npm audit0, rollback4/4. |

## GFS-290 Admin-editable order summary (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Protected healthy production | PASS | API `8e670de8`100%, API `7b662e0d`0%, Admin `c2e87231`100%; no traffic/schema/payment/reminder mutation. |
| REVIEW CMS draft/save/readback | PASS | Authenticated Admin candidate saved EN/UR draft; published version8 read back via `/api/whatsapp-content/REVIEW`. |
| CMS safety | PASS | Placeholder allowlist includes only summary item/delivery/total fields; unknown placeholders and raw HTML are rejected. |
| Dynamic summary source path | PASS LOCAL | CONTACT→REVIEW uses quote item rows and persisted delivery/total values; seeds-only and fertilizer expectations pass; no duplicate payment totals or COD fee in the first message. |
| API zero-traffic candidate | PASS LIMITED | `e914f77e-8f68-44aa-b0c4-7276742b4c75` at0%; supported override `/health` HTTP200. |
| Admin zero-traffic candidate | PASS LIMITED | `783a9480-daa4-4e86-91e4-903044edcd77` at0%; supported override `/health` HTTP200 with `paymentConfigured:true`. |
| Genuine device CONTACT→summary proof | BLOCKED | No new authorized tester inbound was available; no WAMID, delivery, or customer screenshot was claimed. |
| Reminders | PASS PAUSED | All three flags false; no activation, historical send, template, or WAMID mutation. |
| Regression/build/lint/rollback | PASS | 312/312 tests, TypeScript build, ESLint, and verified gfs273-v1 rollback4/4. |

## GFS-278 Orders and Reminder Audit (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Correct branch and protected identity | PASS / PUSH BLOCKED | PR #11 checkout `codex/gfs221-cod-compat-001` at `ba65684`; Cloudflare `gisupp@gmail.com` / Get Free Seeds and canonical Meta WABA verified read-only; GitHub browser logged out and CLI token invalid. |
| Orders root cause | PASS | Historical D1 code7500 row-read exhaustion against the old full-detail list projection; live `orders` schema contains both private-sequence columns. |
| Orders live smoke | PASS | List/detail, all four tabs, payment/fulfillment/archive filters, search, page sizes 25/50/100 and pagination returned JSON HTTP200; no console errors. |
| Live audit | PASS READ-ONLY | 19 unpaid Advance/no receipt; 6 REVIEW/receipt; 37 no method; 16 COD; 2 paid; 1 cancelled/archived. Aggregates only; no PII. |
| Reminder safety | PASS / NO SEND | No reminder engine/outbox rows/template path in PR #11; no reminder, WAMID, delivery, read or failure was fabricated or sent. |
| Regression | PASS LIMITED | Focused84/84, full292/292, build, lint, offline audit0 and rollback4/4; registry audit endpoint unavailable without authorized external metadata upload. |

## GFS-276 Final E2E Acceptance (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Genuine JazzCash order association | PASS/PENDING | HTTP200 list/detail; PKR250, REVIEW/PENDING, reference present, no PAID; five unique receipts linked to one payment, private previews 200 JPEG. Prior three-receipt note requires reconciliation. |
| Public COD persistence | PASS | Natural order detail HTTP200; random reference format, two items, PKR625, one PKR125 fee, COD_PENDING/dispatched, `testHold=false`, one COD confirmation, zero PAID audits. |
| Duplicate protection | PASS | Target order match count 1; receipt IDs unique; new COD order has one confirmation audit and no PAID audit. |
| Advance methods | PASS/PENDING | JazzCash, Easypaisa and Bank Transfer enabled with instructions/QR references; fresh device/two-tap proof unavailable. |
| Post-0038 outbound cost | PENDING | 1,776 / 3.08M / ~1.76K aggregate; period-separated natural after-metric unavailable. |
| Launch safety | PASS | No approval, fulfillment mutation, customer message, migration, deployment or billing change. |

## GFS-275 Final Live Acceptance (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Release and migrations preserved | PASS | Paid D1 and migration0037/0038 preserved; no redeploy or replay. |
| Orders/Admin availability | PASS | Sanitized Admin readback: HTTP200 JSON, 68 total, queues 6/2/11; list/detail requests HTTP200. |
| Payment Settings | PASS | Page HTTP200; `/api/payment-methods` HTTP200. |
| Outbound post-index cost | PENDING | 1,776 / 3.08M / ~1.76K aggregate; dashboard cannot isolate post-0038 execution period. |
| Provider-status index | PASS | Migration0038 and prior live EXPLAIN evidence identify `outbound_messages_provider_status_idx`; no speculative repair. |
| Customer device / receipt acceptance | PENDING | No authorized genuine device evidence; no synthetic order, receipt, payment or message used. |
| Worker errors | PASS LIMITED | Admin dashboard last-24-hour errors 0; API chart remained loading. |
| Regression | PASS PRESERVED | Prior 292/292 and rollback4/4 remain valid; no code change this turn. |

## GFS-274 Post-Launch Evidence (2026-10-28)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Paid D1 capacity/account | PASS | `gisupp@gmail.com` / Get Free Seeds verified; 8.51M/25B reads, 19.12K/50M writes, $0 displayed billable usage. |
| Query Insights cost | PASS/PENDING | Last-24-hour aggregate recorded; outbound 1,771 / 3.08M / approximately 1.75K rows per execution. Exact post-index period comparison unavailable. |
| Authenticated Admin smoke | PASS | Health 200 JSON; Orders 200 JSON, 68 total, page size 25; payment methods 200 JSON; Payment Settings 200; detail 200. |
| Runtime mutation safety | PASS | No migration replay, deployment, billing, payment, customer, receipt, PAID, fulfillment, or WhatsApp mutation. |
| Genuine customer acceptance | PENDING | No new customer-device or receipt evidence in this session; no synthetic substitute used. |

## GFS-270 Local Query-Cost Gate (2026-10-27)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Existing repair preservation/push | PASS | `fca32a3` and `834744e` pushed via authenticated Git Credential Manager as `gardenshop`; remote now `834744e`. |
| Orders EXPLAIN | PASS LOCAL | Before temp B-tree sort; after `orders_archived_created_idx`, no temp sort in local plan. |
| Customer/webhook lookup EXPLAIN | PASS LOCAL | Before Orders scan; after indexed customer multi-index OR plus `orders_customer_created_idx` and receipt index. |
| Payment/receipt plans | PASS LOCAL | Payment-method/QR and receipt primary/entity indexes used; projections remain bounded. |
| D1 rows_read AFTER | BLOCKED | Production candidate remains0% and quota is 8.06M/5M; no unsafe probe. |
| Live restore/migration | BLOCKED | Reset, recovery bookmark, migration application and runtime smoke pending. |

## GFS-269 Recovery Checkpoint (2026-10-27)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Quota verification | PASS / OUTAGE | Cloudflare analytics read-only: 8.06M/5M rows read; no production SQL or repeated Admin refresh. |
| GFS-268 recovery | PASS | `fca32a3` clean and exactly one commit ahead of remote `7724e7a`; no duplicate repair. |
| Migration0037 rehearsal | PASS LOCAL | In-memory all-migration rehearsal: `quick_check=ok`; audit, receipt, and outbox indexes present. Not applied live. |
| Focused regression | PASS | 53/53 Admin/payment/COD/fulfillment tests. |
| Full regression/build/lint | PASS | 292/292; TypeScript build; ESLint. |
| Rollback | PASS | Protected V1 rollback4/4 against unchanged baseline. |
| Production AFTER rows_read | BLOCKED | Candidate is not deployed and quota is exhausted; measure only after reset and 0%-traffic smoke. |
| GitHub push | BLOCKED | Stored `gardenshop` CLI token invalid; no reauthentication or push attempted. |

## GFS-268 D1/Admin Quota Repair (2026-10-27)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Actual blocker | PASS | Cloudflare D1 readback: 8M/5M rows read today; old Admin detail query about 3.29M rows-read/77 calls. No repeated SQL probe while exhausted. |
| Orders exact counts / pagination | PASS LOCAL | One aggregate count scan plus bounded 25/50/100-row list projection; no fake zero fallback; quota failure is JSON503. |
| Detail / receipts | PASS LOCAL | Authoritative detail remains fresh; quota rejection returns JSON503; private receipt path remains no-store. |
| Payment Settings / approval | PASS LOCAL | Settings reads fail closed on quota; approval state is not cached or inferred from stale data. |
| API order/payment safety | PASS LOCAL | Quota errors return JSON503 and do not report confirmation, payment, receipt, or PAID success. |
| Index plan | PASS LOCAL / NOT APPLIED | Additive migration `0037_quota_safe_admin_reads.sql` covers audit, receipt, and outbox entity lookups; live application is blocked pending quota/owner gate. |
| Focused tests | PASS | 53/53 Admin/payment/COD/fulfillment tests. |
| Full tests/build/lint | PASS | 292/292; TypeScript build; ESLint. |
| Rollback | PASS | Protected local V1 rollback harness 4/4 against unchanged baseline `cf01f444…`. |
| Live Admin restore | BLOCKED | Active Admin remains100%; candidate remains0%; Orders currently HTTP500 and D1 quota is exhausted. |

## GFS-261 Mobile Validation and Receipt Media (2026-10-27)

| Requirement | Result | Evidence |
|---|---|---|
| New contact format | PASS | Strict regex coverage for local and hyphenated forms, rejection of spaces/+92/wrong length/letters, EN/UR guided behavior, CONTACT retention, and 11-digit normalization. |
| Meta identity/history preservation | PASS | Shared Meta `wa_id` normalization and historical persistence paths unchanged. |
| Receipt input variants | PASS LOCAL | Standalone, payment-reply, unrelated-reply unique fallback, forwarded/shared, and supported image-document fixtures pass. |
| Receipt association safety | PASS LOCAL | Trusted reply or unique eligible sender only; ambiguous, COD, paid and unrelated cases fail closed. |
| Receipt storage/dedup/Admin state | PASS LOCAL | Type/size validation, private R2 path, provider media-id deduplication, Admin mapping, REVIEW/PENDING preservation and localized acknowledgement pass. |
| Full regression | PASS | 287/287 tests; build, lint, audit0; rollback4/4. |
| Runtime deployment | PASS | API `428defd5-e7aa-4800-b001-976f403c735e` active100%; Admin `615e1156-2747-457a-8623-11d1e967f911` active100%; health200; unsigned webhook403. |
| Genuine receipt E2E | BLOCKED | No authorized customer device action; no fake inbound, WAMID, receipt or PAID state. Remaining action: one standalone and one reply receipt from an authorized device. |

## GFS-260 Post-Launch Verification (2026-10-27)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| PUBLIC deployment preserved | PASS | API `089f5671…`100%; no redeploy or traffic change. |
| API/Admin health | PASS | API200; Admin200 with `paymentConfigured=true`. |
| D1/COD safety | PASS | `quick_check=ok`; COD rows remain `COD_PENDING`; no PAID mutation. |
| Webhook/outbox safety | PASS limited | Recent webhook records received/sent; no post-launch outbox failure. Earlier Meta400 failures predate PUBLIC. |
| Post-launch public menu | PENDING | No legitimate post-promotion customer interaction exists; no unsolicited message created. |

## GFS-259 Authorized PUBLIC COD Release (2026-10-27)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Genuine latest COD acceptance | PASS | Admin/D1: one COD_PENDING order, PKR675 quoted total, base PKR550, PKR125 once, one confirmation, zero receipts, DO NOT SHIP. |
| Advance eligibility | PASS | Admin payment health `paymentConfigured=true`; JazzCash, Easypaisa, and Bank Transfer enabled with protected QR/instruction surfaces. |
| Signed callback / event evidence | PASS | Genuine inbound/outbound provider records verified privately; identifiers not recorded. |
| D1 integrity / rollback | PASS | `quick_check=ok`; protected rollback4/4. |
| PUBLIC candidate smoke | PASS | `089f5671…` at0% returned health200 and unsigned webhook403. |
| PUBLIC traffic | PASS | `089f5671…` active100%; prior TESTER_ONLY API0%; rollout mode PUBLIC. |
| Post-switch eligible menu | NOT OBSERVED | No unsolicited or unauthorized customer interaction was created after promotion; deployment/configuration is verified. |
| Regression | PASS | Full283/283, build, lint, audit0 vulnerabilities. |

## GFS-258 Live Retry Gate (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Preserved pending order | PASS | Admin readback shows the same single unpaid, methodless, receipt-free order; no reset or duplicate. |
| Repaired API boundary | PASS | Active health200; unsigned webhook request rejected; API remains TESTER_ONLY at100%. |
| Genuine repaired payment menu | BLOCKED | No new tester-originated inbound after repair. |
| COD/Advance live regression | BLOCKED | Requires the genuine repaired menu and one pre-confirmation switch. |
| PUBLIC promotion | BLOCKED | Conditional promotion cannot proceed without live P1/P2 evidence. |

## GFS-257 Review-to-Payment Repair (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Fresh Place Order trace | PASS | Signed inbound was received and persisted as one pending order; outbound reply failed with Meta HTTP400. |
| Meta reply-button constraint | PASS | COD button is now `Cash on Delivery` (valid short label); payment notice retains `(COD)` and PKR125 wording. |
| Duplicate-safe retry | PASS | Focused test proves a distinct retry reuses one matching pending order and reaches payment-method state. |
| Review EN/UR copy | PASS | Published Admin content version 6 uses Place Order consistently for text and actions. |
| Candidate boundary smoke | PASS | API `4d218abf…` at0% returned health200 and unsigned webhook403. |
| Controlled runtime | PASS limited | API `4d218abf…` active100% TESTER_ONLY; Admin `615e1156…`100%; PUBLIC unchanged. |
| Fresh genuine payment menu | BLOCKED | Awaiting one authenticated approved-tester tap on the existing Place Order button; no fabricated inbound permitted. |
| Public promotion | BLOCKED | Depends on genuine repaired menu, COD-to-Advance, Advance methods, and public-eligible verification. |
| Regression gates | PASS | Focused79/79, full283/283, build, lint, audit0, rollback4/4. |

## GFS-254 Final Public Gate (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Cloudflare identity/runtime | PASS | Wrangler confirms `gisupp@gmail.com` / Get Free Seeds; API health200/unsigned403; Admin health200/`paymentConfigured=true`; COD PKR125 policy enabled. |
| Post-deploy genuine tester inbound | BLOCKED | No newer tester-originated inbound after GFS-253 deployment. |
| New EN/UR copy visible in WhatsApp | NOT PROVEN | Code and active version contain the copy, but no post-deploy customer observation exists. |
| Advance methods and instructions | BLOCKED | Existing JazzCash receipt-review evidence predates copy deployment; all-method post-deploy proof is absent. |
| COD-to-Advance before confirmation | BLOCKED | Requires fresh authenticated tester journey; no state mutation was fabricated. |
| PUBLIC promotion | NOT RUN | TESTER_ONLY remains active and no public menu evidence exists. |

## GFS-253 Payment-Choice Copy / Live Gate (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Required EN/UR copy | PASS LOCAL | Exact requested copy added to the payment-choice branch; no business logic changed. |
| Exactly two buttons | PASS LOCAL | Advance Payment and Cash on Delivery (COD); Urdu button is localized with `(COD)`. |
| Focused/full quality | PASS | Focused78/78; full282/282; build, lint, offline audit and rollback4/4. |
| Candidate runtime | PASS | `a5722925-650c-42db-bc75-a8c3242e8a4b` health200/unsigned403 at0% before activation. |
| Active controlled runtime | PASS | `a5722925-650c-42db-bc75-a8c3242e8a4b`100% TESTER_ONLY; prior `ba15b8ba-e3b3-4581-9b23-c2e688797132`0%; COD-OFF rollback retained. |
| New genuine Advance evidence | PASS LIMITED | Fresh tester interaction reached PAYMENT_REVIEW/PENDING with JazzCash and one receipt, no PAID; it predates this copy deployment. |
| Post-deploy live copy / all Advance methods | BLOCKED | Requires a fresh authorized tester interaction; no fake inbound or unrelated profile used. |
| PUBLIC release | NOT RUN | Post-deploy live gate is incomplete; PUBLIC remains disabled. |

## GFS-252 Final Advance Gate (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Newer genuine tester inbound | NOT OBSERVED | Admin Test Controls remains at the previously confirmed `COD_PENDING` state; no newer continuation exists. |
| Approved authenticated tester session | BLOCKED | No authorized device/session is exposed; unrelated WhatsApp Web remains prohibited. |
| Advance methods/instructions | BLOCKED | Requires genuine fresh journey; no QR, instruction, receipt or PAID evidence was fabricated. |
| COD-to-Advance before confirmation | BLOCKED | Requires the same fresh authenticated journey; no state mutation attempted. |
| Admin/D1/runtime preflight | PASS | Admin health200, `paymentConfigured=true`, audited COD enabled/PKR125, TESTER_ONLY traffic preserved. |
| PUBLIC activation | NOT RUN | P1 is not PASS; no PUBLIC traffic or rollout mutation occurred. |

## GFS-251 Public Launch Gate (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Official MCP and Cloudflare identity | PASS | `list_pages` and authenticated snapshots work; Cloudflare shows `gisupp@gmail.com` on the GFS account. |
| API/Admin runtime preflight | PASS | API health200, unsigned webhook403; Admin health200 with `paymentConfigured=true`; COD policy enabled with audited PKR125. |
| Current traffic safety | PASS | API `ba15b8ba-e3b3-4581-9b23-c2e688797132`100% TESTER_ONLY; prior TESTER_ONLY0%; COD-OFF rollback retained; Admin `615e1156-2747-457a-8623-11d1e967f911`100%. |
| Fresh genuine Advance journey | BLOCKED | No approved tester-device session is exposed to this execution; no inbound messages were fabricated and unrelated WhatsApp Web was not used. |
| COD-to-Advance before confirmation | BLOCKED | Requires the same fresh authenticated tester journey; no state mutation was attempted. |
| PUBLIC activation | NOT RUN | P1 is not PASS; public traffic and rollout mode remain unchanged. |

## GFS-250 Polished COD Acceptance (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Independent target verification | PASS | Original D1/Admin read-only check found one target order (identifier masked), `COD_PENDING`, one COD detail and one confirmation audit; no duplicate. |
| Amount and fee | PASS PRIVATE | Audited PKR125 fee was applied once and the exact customer-order total was verified privately; it is not persisted in repository documentation. |
| No premature payment artifacts | PASS | Test hold/DO NOT SHIP; no receipt row, advance approval or PAID transition; historical records preserved. |
| Genuine WAMIDs | PASS PRIVATE | Inbound/outbound WAMIDs verified privately and masked; no raw customer identifiers recorded. |
| Seeds-first dynamic summary | PASS | EN/UR code and focused/full tests verify free seeds first, dynamic item/D1 fees, audited COD fee and prominent total; misleading Advance wording removed. |
| Stale Advance action | PASS | Focused test proves the exact safe response and unchanged `COD_PENDING`/single COD row. |
| Customer status copy | PASS | Focused status test removes courier/remittance internals and renders order number, COD method, status and total due. |
| Runtime deployment | PASS | API `ba15b8ba-e3b3-4581-9b23-c2e688797132` 100% TESTER_ONLY; prior `64594da5-6a97-4167-835f-cbd5987bd876` 0%; COD-OFF `2500e268-8985-4fd4-a141-68633f16315d` retained for rollback. |
| Runtime smoke/Admin | PASS | API health200, unsigned callback403; authenticated Admin health200, `paymentConfigured=true`, target found `COD_PENDING`. |
| Quality gates | PASS | Full 282/282, build, lint, offline audit, rollback4/4 and `git diff --check`. |
| Live post-polish Advance/public check | BLOCKED | No duplicate order was created; live Advance regression and any final public promotion verification remain before PUBLIC. |

## GFS-249 Controlled TESTER_ONLY Runtime (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Official MCP and dashboard identity | PASS | Same-session `list_pages`, authenticated Admin, Cloudflare account route and visible `gisupp@gmail.com`; no raw CDP or account switch. |
| Protected secret and bindings | PASS LIMITED | Secret name is present on active API version with original secrets; value is not exposed. D1, Queue, R2 and signed Meta bindings preserved. |
| COD-OFF compatibility candidate | PASS | API health200, unsigned WhatsApp callback403, Admin health200/`paymentConfigured=true`; COD-OFF rollback retained at0%. |
| Audited D1 policy | PASS | Policy enabled, fixed PKR125, audited revision; 53 orders/payments preserved; zero COD rows and COD_PENDING orders before live acceptance. |
| TESTER_ONLY admission | PASS DEPLOYED / E2E INCOMPLETE | Active API version contains enabled flag and TESTER_ONLY mode; exact protected identity gate is fail-closed. Genuine START reached `LANGUAGE`; customer continuation is pending. |
| Genuine signed callback | PASS INITIAL | Active callback persisted a new inbound WAMID and advanced the authorized tester conversation; raw identifier remains private. |
| Exact COD journey | BLOCKED | Tester must reply with language, then complete fields and select COD from their authenticated device; no synthetic messages permitted. |
| COD_PENDING / PKR125 / no duplicate | NOT YET RUN | No new order or COD sidecar row exists yet. |
| Advance regression / public activation | BLOCKED | Must follow completed tester COD acceptance and rollback checks; PUBLIC mode remains disabled. |

## GFS-248 Three-State Rollout (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| OFF / TESTER_ONLY / PUBLIC | PASS LOCAL | OFF denies all; TESTER_ONLY requires normalized protected identity; PUBLIC admits eligible customers; unknown/missing modes fail closed. |
| Quality gates | PASS | Focused78/78, full281/281, build, lint, offline audit0. |
| Fresh API 0% smoke | PASS | `83e82edf…` at0% beside v90 at100%; health200, unsigned webhook403; COD flag false/mode OFF. |
| Fresh Admin 0% smoke | PASS | `615e1156…` at0% beside v82 at100%; authenticated health200/`paymentConfigured=true`; COD disabled/fee125. |
| D1 integrity | PASS READ-ONLY | COD0030; 53 orders/payments; zero COD rows; quick-check ok; FK0. |
| Protected tester secret | BLOCKED | Safe execution rejected clipboard transfer of customer identity; two exemption records prevent positional inference. No secret mutation. |
| Genuine tester E2E/public activation | NOT RUN | Exact inbound identity unproven; no WAMIDs, order, Admin COD_PENDING or PUBLIC mode. |

## GFS-247 Tester-Only COD Admission (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Normalized tester gate | PASS LOCAL | `COD_TESTER_WA_ID` is normalized with the inbound identity before admission; formatted equivalent matches in focused test. |
| Non-tester isolation | PASS LOCAL | Non-matching identity remains Advance-only and cannot create COD sidecar rows while the global flag/policy are enabled. |
| Missing protected configuration | PASS LOCAL | Empty/missing tester secret fails closed and leaves Advance checkout unchanged. |
| EN/UR, fee, same-order and idempotency behavior | PASS PRIOR + REGRESSION | Existing guided COD tests retained; no migration, D1 or payment-history change. |
| Full regression | PASS | Focused 76/76; full 279/279; build, lint and offline audit pass. |
| Controlled staging activation | BLOCKED | Requires precise owner authorization, protected secret provisioning, live signed tester START, running Advance and rollback gates. |
| Genuine acceptance | NOT RUN | No fabricated inbound, WAMID, order, Admin COD_PENDING or screenshot. |

## GFS-246 Final Staging Readiness (2026-10-27)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Approved tester registration | PASS LIMITED | Existing owner-approved Admin `ADMIN_TEST_EXEMPTION` retained; no duplicate registration/reset. GFS-245 identity evidence reused. |
| Staging binding inventory | PASS DRY-RUN / READ-ONLY | API/Admin bundles resolve existing staging D1, receipt R2 and Queue/DLQ; Wrangler account is the authorized GFS principal. Dry-run is not deployment/runtime acceptance. |
| Worker traffic | PASS READ-ONLY | API v90 `21a3d74c-3979-432c-9190-1848362592a4`100%, candidate `48d4c590-5a2a-4447-a0c8-b163c0ae93fe`0%; Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`100%, candidate `091f1a3f-595b-4530-b54a-d7253af60664`0%. COD flag false. |
| Signed callback | PASS LOCAL SYNTHETIC / LIVE BLOCKED | Focused tests exercise valid HMAC callbacks and negative signature handling; no authorized non-customer live signed-event facility was exposed. Synthetic test is not live acceptance/WAMID. |
| Advance regression | PASS LOCAL SYNTHETIC / LIVE BLOCKED | Focused guided tests retain advance payment selection and callback behavior; no real customer Advance checkout was run. |
| D1 | PASS PRIOR VERIFIED / NOT REPEATED | Reuse GFS-242: COD0030 marker, `quick_check=ok`, FK0, default fee125/COD disabled, 52 historical orders/payments preserved. No migration/read/write repeated. |
| COD-compatible intake-OFF rollback | PASS LOCAL 4/4 / REMOTE NOT RUN | Actual unchanged PR10/V1 source harness against synthetic retained COD schema. Remote rollback not executed; old V1 cannot represent COD totals, so rollback after obligations must be COD-compatible intake-OFF. |
| COD admission scope | BLOCKED FOR ENABLEMENT | Static source review: global flag/policy/province gate, not a tester allowlist. `ADMIN_TEST_EXEMPTION` is cooldown-only. Keep globally disabled until required gates and staging-traffic authorization pass. |
| Exact customer COD | NOT RUN | No genuine inbound, WAMIDs, order number/amount, `COD_PENDING`, Admin evidence or screenshot. Tester device is the remaining human action. |
| Regression/security | PASS LOCAL | Full276/276, focused100/100, rollback4/4, build, lint, production audit0, both Worker dry-runs. |

## GFS-245 Approved Tester Registration (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| Supported tester registration | PASS LIMITED | Exact approved customer already exists in Admin Test Controls as an `ADMIN_TEST_EXEMPTION`; no duplicate mutation. |
| History protection | PASS | Existing order/payment history was inspected only and not reset, reused or modified. |
| Canonical sender | PASS LIMITED | Meta Phone Manager remains authoritative for the connected GFS sender; unrelated Web profile excluded. |
| Tester-initiated inbound | BLOCKED | Customer device has not initiated a real message; no synthetic inbound allowed. |
| Activation/live COD | NOT RUN | Signed/Advance/rollback gates and live acceptance require the tester-initiated inbound. |

## GFS-244 Tester Resolution (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| Registered tester | PASS LIMITED | Admin Test Controls still matches the supplied customer; no identifier recorded. |
| Canonical sender | PASS LIMITED | Meta Phone Manager still shows the supplied receiver as connected canonical GFS sender. |
| Authorized WhatsApp session | BLOCKED | Available Web owner profile matches neither; no account switch or message. |
| Staging activation | BLOCKED | COD remains OFF; candidates0%, originals100%; signed/Advance/live rollback gates not completed. |
| Genuine COD acceptance | NOT RUN | No WAMIDs, new order, amount or Admin COD_PENDING evidence. |

## GFS-243 Tester and Sender Verification (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| Admin registered tester | PASS LIMITED | Supplied customer matched the existing Test Controls tester entry; identifier withheld. |
| Canonical GFS sender | PASS LIMITED | Supplied receiver matched the connected canonical Meta Phone Manager asset; no Meta mutation. |
| WhatsApp owner profile | BLOCKED | Available WhatsApp Web profile matched neither supplied identity; no chat/message/account switch. |
| Candidate runtime health | PASS | API override HTTP200; Admin override HTTP200/`paymentConfigured=true`. |
| COD activation/live acceptance | BLOCKED | No authorized usable tester session; COD remains OFF and no WAMID/order evidence exists. |

## GFS-242 Authorized Migration and Candidate Repair (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| COD0030 checksum and preflight | PASS | SHA256 matched reviewed file; fresh Time Travel bookmark; bounded schema, ledger, aggregate-history, quick-check and FK checks passed. |
| Remote migration | PASS | Only `0030_cod_v1_compat.sql` applied; marker `0030`; no legacy migration replay; COD disabled and fee default PKR125. |
| Post-migration preservation | PASS | Orders/payments remained 52/52; COD sidecar rows 0; `quick_check=ok`; FK violations 0. |
| Admin candidate post-migration repair | PASS | Existing candidate re-staged at0% beside v82 at100%; supported override health HTTP200 with `paymentConfigured=true`. |
| API COD-OFF candidate | PASS | API candidate at0% beside v90 at100%; health HTTP200; unsigned webhook HTTP403; flag false. |
| Full regressions/rollback | PASS | 276/276, build, lint, offline audit, rollback4/4. |
| Running Advance and valid signed callback | BLOCKED | Requires authorized tester-controlled session and live runtime acceptance. |
| Genuine COD journey | NOT RUN | No tester identity confirmation; no WAMID/order/Admin COD_PENDING evidence. |

## GFS-241 COD-OFF Staging (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| API COD-OFF candidate | PASS | `48d4c590-5a2a-4447-a0c8-b163c0ae93fe` at0%; API v90 at100%; config upload confirms `COD_V1_ENABLED=false`. |
| API candidate runtime boundary | PASS | Supported version override `/health` HTTP200; unsigned WhatsApp webhook HTTP403. No valid signed event or D1 write. |
| Admin compatible candidate | PASS PRESERVED | GFS-240 Admin candidate `091f1a3f-595b-4530-b54a-d7253af60664` at0%; v82 at100%; repaired health already HTTP200/`paymentConfigured=true`. |
| Local protected regressions | PASS | Full276/276, build, lint, offline audit, targeted COD behavior and rollback4/4. |
| Remote reviewed COD0030 | BLOCKED | Checksum/rehearsal ready; original D1 migration ledger untouched. Explicit single-migration/backup approval is missing. |
| Candidate promotion / COD flag | BLOCKED | `COD_V1_ENABLED` remains false; precise staging traffic approval is missing. |
| Genuine tester journey | BLOCKED | Registered tester mismatch remains; no send, WAMID, order or Admin COD_PENDING result. |

## GFS-240 Chrome Bridge and Admin Health Smoke (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| Official MCP same-session proof | PASS | Native approved session: `list_pages`, authenticated Admin snapshot and authenticated Cloudflare snapshot all succeeded. No raw CDP/Kilo/account switch. |
| Cloudflare identity and Access | PASS | Dashboard showed `gisupp@gmail.com`, GFS account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`, Admin Worker and existing Access protection before mutation and restoration. |
| Admin candidate split | PASS | Candidate `091f1a3f-595b-4530-b54a-d7253af60664` at0%; original v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64` at100%; Version URLs stayed disabled. |
| Repaired Admin `/health` | PASS | Authenticated existing Admin origin plus supported `Cloudflare-Workers-Version-Overrides` header: HTTP200, `ok:true`, `paymentConfigured:true`. No D1/customer/payment write. |
| Restore | PASS | v82 restored as the sole100% deployment; read-only Wrangler deployment history confirms candidate0%. |
| Signed webhook / Advance / COD recovery checks | PASS LOCAL | Targeted124/124 and rollback4/4; prior full276/276, build/lint/offline audit and D1/COD0030/recovery evidence. No live signed callback or customer checkout. |
| Genuine WhatsApp COD acceptance | BLOCKED | Registered tester mismatch remains; no substitute authorization, send, WAMID, order or Admin COD_PENDING evidence. |

## GFS-238 Repaired Admin Health Smoke (2026-10-27)

| Check | Result | Evidence / scope |
|---|---|---|
| Official MCP host | BLOCKED | Codex0.164.0/configured `chrome-devtools` registration verified; current Kilo turn exposes no callable Chrome tools. Requested GPT-5.6 was rejected by host; one configured-model attempt stopped before `list_pages`. No browser action or host config change. |
| Access identity / page inventory | NOT VERIFIED | No `list_pages`, visible account identity, Admin Access check, or tab mutation. |
| Admin 0%-traffic candidate | NOT RUN | No dry-run upload, version creation/deploy, endpoint override, or health request. v82 remains last known100%; no new candidate. |
| Repaired predicate | PASS LOCAL | Focused32/32 and full276/276; synthetic tests exercise the health fix and eligibility/privacy guards. Not live Admin evidence. |
| API/Admin dry-runs | PASS CONFIG ONLY | Existing staging D1/R2/Queue bindings render; API COD flag remains false in candidate config. No live binding validation. |
| Rollback compatibility | PASS LOCAL | Harness4/4 against unchanged PR10 baseline `cf01f444500415b1f22a64730674caca1c286006`, including advance read, COD hold, receipt blocking and schema integrity. Not a running Worker rollback. |
| Build/security | PASS LOCAL | TypeScript build, ESLint, `npm audit --audit-level=high` (0 vulnerabilities). |
| D1/WhatsApp/COD | NOT RUN | Original D1 unchanged; COD0030 unapplied; no tester match, live signed event, Advance journey, COD order, WAMID or Admin evidence. |

## GFS-237 Health Repair / Payment Readiness (2026-10-26)

| Check | Result | Evidence / scope |
|---|---|---|
| Regression classification | PASS | PR10/candidate identical fixed-advance health predicate, originated8c882a4 before PR11. Guided amount authority remains orders.total_payable. Not a demonstrated checkout regression. |
| Redacted original config | PASS CONFIG ONLY | All3 enabled/recipient present/QR ownership+current provenance/ENURcopy/placeholders true; legacy amount positive false,old health false. No raw destinations/evidence/QR/customer data, no config changes. Not a bank/R2/provider/delivery proof. |
| Health red/green | PASS | New32 synthetic real-SQLite tests:26 fail before repair;32 pass after. NULL/absent fixed config allowed when same method has both locales; ANY-method meaning retained. |
| Fail-closed regressions | PASS | Missing/stale method-key asset, decoder/payload/scan/ownership/evidence, empty recipient/copy/placeholders/UR, cross-method locale mismatch reject; no DB false; Access403 before query; no writes/R2 calls/sensitive response. Default English helper/explicit amount validation unchanged. |
| Focused/full/build | PASS LOCAL |145 focused,276 full across23 files,build/lint,audit0,V1 harness4/4; API/Admin COD-off dry-runs. |
| Original D1 safety | PASS |quick_check ok,FK0,legacy ledger0,COD schema absent,reviewed0030 unchanged; current recovery bookmark,no restore. SELECT file-mode returned summary rows_written0/platform import metadata changed; command-mode results no changes. No application data/schema writes. |
| Alternative release gate | APPROVED CONDITIONAL | User approved exact-SHA replacement only for staged behavior evidence; runtime/financial/tester checks not waived. |
| Repaired Admin0% | BLOCKED BEFORE UPLOAD | Explicitly approved preflight-first test stopped at official MCP list_pages unavailable. No browser request/upload/manifest or preview setting change; no new version. |
| Current public boundaries | PASS LIMITED |health200,unsigned webhook403,unauthenticated Admin302; no valid signed-event/Advance/COD journey. |
| Live tester | BLOCKED | Last private Profile mismatch unchanged, not retried. No message/WAMID/order/Admin COD_PENDING/screenshot/PAID. |

## GFS-236 Zero-Traffic Candidate Runtime Checks (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| API candidate v91 | PASS LIMITED | At0% only; COD flag false. Version override `/health`200; unsigned WhatsApp POST403. No valid signature or D1 write. |
| Admin candidate v83 | PASS LIMITED / ADVANCE FAIL | At0% only, existing Access identity MATCH. `/health`200, `ok:true`, `paymentConfigured:false`. No payment data/rows read. |
| Version URL safety | PASS | Dashboard Version URLs disabled on API/Admin; ordinary workers.dev stays enabled; Access application remains. Version IDs only tested through existing URLs/override. |
| Traffic restoration | PASS | API v90 sole100%, deployment `9cc279f1-dc6d-463b-9047-8311d1229945`; Admin v82 sole100%, deployment `cbc4233d-9100-45cf-aa8e-7f42eb44e982`. Candidate v91/v83 remain uploaded history only. |
| Original D1/migration | PASS PRESERVED | No D1 write/migration. One explicitly authorized Admin `/health` aggregate read returned `paymentConfigured:false`; no payment recipient, order or customer rows read. COD0030 remains unapplied; GFS-234 schema/integrity evidence retained. |
| Tester/live COD | BLOCKED | Last registered Profile mismatch; no same-session retry/message/order/WAMID/Admin screenshot. Later Admin identity-only mismatch stopped before health; earlier candidate Access check matched. |
| Regression/build | PASS LOCAL | Focused128/128, full244/244, V1 rollback harness4/4, build/lint/audit0. |

## GFS-235 Provenance and Compatibility Checks (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Active versions | PASS READ-ONLY | API v90 `21a3d74c…`/etag `0a306eaa…`100%; Admin v82 `b840f5a4…`/etag `ba0f3650…`100%. No SHA; both predate cf01f44 commit. |
| Source artifact | BLOCKED | Wrangler metadata lacks source; prior init C3 failure not repeated. Official UI view returned unavailable/null hash. No save/deploy. |
| Candidate vs PR10 | PASS STATIC REVIEW ONLY | COD/payment outbox/idempotency differences; webhook signature verification route unchanged. Timestamp does not establish active-source parity. |
| Targeted receipt/payment/webhook | PASS | 5 test files,122/122. |
| Full/build/security | PASS LOCAL | 244/244; build/lint; audit0. |
| Rollback | PASS LOCAL ONLY | V1 harness4/4; bare V1 cannot render COD totals. Candidate flag-off build dry-runs; no runtime rollback. |
| Runtime smoke | PASS LIMITED | Prior health200,unsigned webhook403,unauthenticated Admin302. No valid signed event/customer journey. |
| Tester/WhatsApp | BLOCKED | Prior exact profile mismatch unchanged; no retry/send/WAMID/order/Admin screenshot. |

## GFS-234 Permitted Alternative and Original Comparison (2026-10-26)

| Check | Result | Actual evidence / boundary |
|---|---|---|
| Official Chrome identity/quota | PASS | Same approved execution listed pages, reused Cloudflare tab7, email/account match. Usage before creation:4/10 DBs,88k/5M reads,29/100k writes,4.56MB/5GB,$0 billable usage shown. Help-created tabs closed; unrelated tabs untouched. |
| Clean remote D1 | PASS | Explicit user approval; new ID `b29df6ba-e5c3-47bd-ac59-f6b0d47861a1`; SELECT1 succeeds under unchanged principal/grant; no active binding. |
| V1 schema rehearsal | PASS | Schema-only63 definitions from compatibility migrations0001–0029, no exported seed/customer/payment rows; local fixture column error fixed before remote. New normal ledger:0001_v1_schema_only,0002_synthetic_fixture,0030_cod_v1_compat. |
| Isolated confirmation/idempotency | PASS SQL-ONLY | Synthetic original order250, fee125, due375, COD_PENDING/hold1; one detail/payment/audit; receipt/outbox0. Confirmation replay writes0; exact0030 replay writes0. Not application/browser confirmation. |
| Hold enforcement | PASS | Intentional synthetic PACKING rejected `COD_TEST_HOLD_DO_NOT_SHIP`,7500/SQLITE_CONSTRAINT_TRIGGER; final state unchanged. CLI emitted a Windows assertion after this expected error; next independent read passed. Not API7403. |
| Original bounded comparison | PASS READ-ONLY | User expressly overrode prior no-retry rule for one SELECT1; PASS. One conditional metadata preflight:quick_check ok,FK0; all63 V1 definitions exact; only `_cf_KV`/ledger extra; ledger0. No original write/data export. |
| Recovery | BOOKMARKS ONLY | Both D1s return Time Travel bookmarks. No actual restore or runtime rollback. V1 old-source harness4/4 remains local-only; COD-compatible intake-OFF version still required after intake. |
| Admin/tester | BLOCKED | Admin Access MATCH; Test Controls AVAILABLE. Initial own Profile lookup timeout; user-approved recheck from opened own Profile=MISMATCH. No chat/message/reset/number substitution/screenshot. |
| Source artifact | FAILED RETRIEVAL | Supported `wrangler init --from-dash` delegated C3 and failed with Windows assertion; generated Hello World scaffold is NOT active source. Never deploy it. |
| Regression/build/security | PASS LOCAL | Focused27/27; full244/244; build/lint/audit0; API/Admin COD-off dry-runs. No live signed webhook/Advance evidence. |
| Public runtime negative boundaries | PASS LIMITED | `/health`200, service getfreeseeds-api, whatsapp enabled; unsigned `/webhooks/whatsapp`POST403; unauthenticated Admin302. No signed valid event, customer journey or COD flag evidence. |
| Live acceptance | BLOCKED | No real order/WAMID/Admin COD_PENDING/screenshot; no Worker or Meta route change. |

## GFS-233 Support/MCP and Release Checks (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Official Chrome MCP | PASS PARTIAL | Same approved execution: `list_pages` PASS, then Cloudflare Support UI reached. A later separate execution lost the tool; intermittent. |
| D1 support case | BLOCKED / NONE | Verified principal/account and `d1:write`; Free plan says API7403 D1 case ineligible (only billing/account/registrar topics). No case ID/submission; no D1 query. |
| D1/Test Controls | NOT RUN | No D1 query. Prior Test Controls exemptions read UNAVAILABLE; not retried. No migration/backup/integrity/Time Travel. |
| Active Worker metadata | PASS READ-ONLY | API v90 `21a3d74c-3979-432c-9190-1848362592a4`; Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`, both 100%; source SHA unknown. |
| API/Admin dry-runs | PASS CONFIG ONLY | Both bundles pass with expected staging D1/R2/Queue; candidate API `COD_V1_ENABLED=false`. No deployment/live flag proof. |
| Regression/security | PASS LOCAL | Focused27/27; full244/244; V1 harness4/4; build/lint/audit0. |
| Live COD/Advance | NOT RUN | No tester/message/order/WAMID/Admin evidence/screenshot; no real runtime verification. |

## GFS-232 Local/Access Recheck (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Cloudflare identity | PASS | Fresh Wrangler identity/email/account ID match; `d1:write`. Not evidence of D1 query grant. |
| Official Chrome MCP | BLOCKED | Codex0.164.0 config registered/enabled; doctor reports config/MCP/network healthy and Chrome process active. Approved exec did not expose callable `list_pages`; no support UI/case. No raw CDP/bypass. |
| D1/support/Test Controls | BLOCKED / NOT RETRIED | No D1 query. No support case/reference. Last scoped Admin exemptions read remains UNAVAILABLE; not retried pending restored access. |
| Staging/WhatsApp | NOT RUN | No deployment, migration, rollback, flag change, tester match, WAMID, COD_PENDING, screenshot or live advance check. |
| Local regression | PASS | Focused27/27; full244/244; rollback4/4; build/lint/audit0. |

## GFS-231 Identity/Support Gate (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Official Chrome MCP inventory | PASS PARTIAL | First list timed out; same official list operation succeeded on retry; 11 existing page IDs/origins. No page mutation. |
| Cloudflare support identity | BLOCKED | Existing dashboard UI did not expose expected email or account ID. Stopped before navigation/ticket. No support case/reference. No D1 retry or scope change. |
| Tester verification | BLOCKED | Broad Orders snapshot rejected for potential PII exposure. After explicit user approval, same Admin tab navigated to `/test-controls`; narrowly scoped `#exemptions` read returned UNAVAILABLE. Stopped before WhatsApp Profile, no chat/message; prior own-Profile mismatch remains. |
| D1/deploy/live COD | BLOCKED | Admin Test Controls auto-loaded exemptions and returned UNAVAILABLE; no direct Wrangler/raw D1 query or subsequent retry. No schema/integrity/backup/migration/deployment/rollback/flag or customer interaction. |
| Local regression | LAST PASS GFS-230 | Focused27/27; full244/244; rollback4/4; build/lint/audit0; dry-runs. No code changed in GFS-231. |

## GFS-230 Staging Gate Recheck (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Chrome MCP inventory | PASS | Codex0.164.0 official MCP listed11 existing page IDs/origins. No additional page inspection, navigation, chat or mutation. Prior authorized tester Profile mismatch remains the no-send gate. |
| Active API/Admin | PASS METADATA ONLY | Latest histories API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. No source annotation; no deployment. |
| D1 API7403/schema | BLOCKED / NOT RETRIED | No D1 query, backup, integrity or migration. Empty legacy ledger and populated schema remain historical evidence; no ledger rewrite. |
| COD / advance tests | PASS LOCAL ONLY | Focused27/27; full244/244; V1 old-source rollback harness4/4. No running Worker or live advance test. |
| Build/security/dry-runs | PASS CONFIG ONLY | Build/lint pass; audit0; API/Admin bundles dry-run with candidate COD false and expected configured bindings. Not live bindings/deploy. |
| Live COD / Admin / WAMIDs | NOT RUN | No matching tester, message, COD_PENDING order, amount, screenshot or WAMID. |

## GFS-229 Local Revalidation and Access Diagnosis (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Official Chrome MCP/identity | PASS PARTIAL | Official MCP exposed existing tabs; Admin Access identity matched; Cloudflare account ID visible/email unavailable; GitHub page absent (CLI gardenshop); Meta operator unavailable; canonical WABA/sender evidenced in WhatsApp Manager; tester Profile mismatched. No message, navigation or mutation. |
| Cloudflare identity/scope | PASS CLI identity only | `wrangler whoami` = expected GFS account; reports `d1:write`. Does not establish D1 resource authorization; prior API7403 unresolved. No query retry/scope change. |
| Focused COD/Admin/migration | PASS | 27/27 tests in `cod-admin.test.ts` and `cod-migration-compat.test.ts`. |
| Full PR #11 suite | PASS | 244/244 across22 files. |
| V1 rollback source | PASS LOCAL ONLY | 4/4 checks against clean, unchanged `cf01f44`; in-memory synthetic SQLite, no live Worker rollback. |
| Build/lint/audit | PASS | TypeScript build and ESLint pass; `npm audit --omit=dev` reports 0 vulnerabilities. |
| API/Admin dry-run | PASS CONFIGURATION ONLY | Bundles build with expected staging names/bindings; API `COD_V1_ENABLED=false`. No live binding/version/secret verification. |
| D1/migration/deploy/live E2E | NOT RUN | Do not retry API7403 or mutate due GFS-228 stop rule. No migration, deploy, tester identity, order, WAMID or screenshot. |

## GFS-228 Minimal COD Checkout Regression (2026-10-26)

| Requirement | Result | Evidence |
|---|---|---|
| Minimal audited enable | PASS LOCAL | Fixed PKR125 toggle enables with no collection/remittance references or COD HMAC; wrong fee is rejected; stale revision conflicts. |
| COD quote/confirm | PASS LOCAL | EN/UR existing-order quote adds PKR125 once; same order becomes COD_PENDING with exact total and DO NOT SHIP; final message is order number/total, no remittance prose. |
| No advance work | PASS LOCAL | COD path creates no receipt, QR, payment-instruction outbox or reminder; COD→Advance removes fee and original methods continue. |
| COD PAID security | PASS LOCAL | Optional settlement still returns HMAC-required error without key and cannot set paid early; no COD confirmation marks PAID. |
| Existing advance regression | PASS LOCAL ONLY | Full244/22, focused100, baseline176, rollback4; build/lint/audit0. Active Worker not retested. |
| Staging gates | BLOCKED | D1 API7403/empty ledger; Chrome MCP page inventory unavailable; tester/Meta operator unresolved; Worker source parity not proven. No migration/deploy/live order. |

## GFS-227 Final Verification (2026-10-26)

| Check | Result | Evidence |
|---|---|---|
| Admin Access identity | PASS from GFS-226 | Same-origin Access identity email/hostname matched; no JWT/claims retained. |
| Approved tester/Meta operator | BLOCKED | Fresh official MCP `list_pages` failed twice; Admin Test Controls/Profile not cross-matched. Last tester mismatch remains. No message. |
| Remote D1 authorization | BLOCKED | Current official Wrangler schema query returned API7403 for expected account/database. No scope change/account switch/retry. No schema data disclosed. |
| Migration fallback | PASS LOCAL / NOT APPLIED | COD-only 0030 is idempotent, sidecar-marked and keeps legacy ledger untouched; synthetic populated-schema/replay/rollback tests pass. No remote rehearsal or migration. |
| Deployed-source parity | BLOCKED | API v90/Admin v82 version metadata has no Git source hash; API predates PR #10 source. No deploy. |
| Regression/security | PASS LOCAL | Focused100/100, full244/244, build/lint/audit0. API/Admin Wrangler dry-runs pass with COD false. |
| Live COD/Advance acceptance | NOT RUN | No browser buttons, authorized tester, order, WAMID, Admin COD_PENDING or screenshot; no live advance path/receipt retest. |

## GFS-226 Access Claim and Release Gate (2026-10-26)

| Check | Result | Evidence / boundary |
|---|---|---|
| Admin Access identity | PASS email/host only | Official MCP same-origin Access identity endpoint returned HTTP success; exact staging hostname and expected email match. Issuer/audience not exposed. No token/claim JSON retained. |
| Chrome MCP / tester | BLOCKED | Fresh approved-review session failed list_pages twice; stopped. No Admin Test Controls read or WhatsApp Profile match. Last verified tester remains mismatched. |
| Meta identity | BLOCKED | No current operator identity; no callback/WABA change or message. |
| API behavior | PASS HEALTH ONLY | API health GET 200/service-only. No version/flag/database-state fields; not a flow/webhook test. |
| Source parity/D1 | BLOCKED | API v90 source annotation absent; predates cf01f44. D1 ledger empty/pending all30; idempotent 0030 unapplied; no clone/equivalent. |
| Regression | PASS LOCAL | Full244/22, focused100, V1 baseline176, old-source rollback4; build/lint/audit0; Wrangler dryruns. No live staging checkout/admin/rollback acceptance. |
| Live COD | NOT RUN | No tester match/order/amount/Admin state/WAMID/screenshot; no secret, deployment or migration. |

## GFS-225 Final Identity and Artifact Checks (2026-10-26)

| Check | Result | Evidence |
|---|---|---|
| Chrome MCP approved-review | PASS | Codex 0.164.0; list_pages and narrow supported browser actions work. No bypass. |
| Cloudflare / GitHub | PASS PARTIAL | Cloudflare user menu/account route match expected GFS account; GitHub CLI `gardenshop`, browser session not authenticated. |
| Admin / Meta / tester | BLOCKED | Admin host loads but no expected identity visible in header labels. Meta has GFS business/WABA links but Saeed/operator and canonical phone link not established. WhatsApp Profile mismatch; no sending. |
| Active API behavior | PASS HEALTH ONLY | Chrome GET `/health` returned 200 and `service=getfreeseeds-api`; no deployment/COD/D1 state fields present. No flow POST or webhook received. |
| Source parity | BLOCKED | API v90/Admin v82 metadata contains no Git commit annotation; API version predates PR #10 source `cf01f44`. |
| D1 safe change | BLOCKED REMOTELY | Populated legacy schema, empty `d1_migrations`; all 30 Wrangler migrations pending. Quick/FK checks pass, Time Travel available, but D1 clone unsupported. 0030 is idempotent/separately marked and local tested; no clone/rehearsal on live data and no application. |
| COD/HMAC state | NOT ENABLED | Candidate `COD_V1_ENABLED=false`; active health does not report state and HMAC binding/name absent. No secret values read or written. |
| Tester E2E | NOT RUN | No authorized profile match, WAMID, COD order/total/Admin status/screenshot or advance live regression. |
| Local regression | PASS | Focused100, full244, V1 baseline176, old-source retained-schema4; build/lint/audit0; both Wrangler dry-runs. |

## GFS-224 Cloudflare / Schema / Release Gates (2026-10-26)

| Requirement | Result | Evidence |
|---|---|---|
| Chrome MCP | PASS | Official Codex CLI updated to 0.164.0; `list_pages` and narrowly scoped approved DOM reads work. Never use `approval_policy=never` for evaluator or bypass host review. |
| Cloudflare identity | PASS PARTIAL UI | Cloudflare header/account menu has `gisupp@gmail.com`; account route/link contains exact expected account ID. No mutation. D1 dashboard route rendered no D1 content. |
| GitHub identity | PASS CLI / UI BLOCKED | `gh api user` `gardenshop`; browser PR page unauthenticated. PR #11 branch/head checked via GitHub CLI. |
| Admin/Meta/tester identity | BLOCKED | Admin Orders host opened but expected email not in header; Meta operator Saeed not visible. GFS resource links present, but no WABA route interaction. WhatsApp tester profile mismatches approved record; no chat/message. |
| Active Worker/source parity | BLOCKED | API v90 `21a3d74c-3979-432c-9190-1848362592a4`, Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`. No Git SHA annotations; API version predates PR #10 `cf01f44`. No deployment. |
| Remote migration ledger | FAIL/STOP | `d1_migrations` is present but empty; all 0001–0030 pending while populated legacy schema exists. Wrangler bulk apply prohibited. No ledger repair/fabrication. |
| D1 integrity/backup | PASS READ ONLY / CLONE UNAVAILABLE | `quick_check=ok`, foreign-key check empty, COD tables absent. Time Travel bookmark available. Official Cloudflare docs say clone/fork unsupported; Time Travel restore is in-place. `d1 export --no-data` failed Authentication 10000; no file/data exported. |
| COD-only fallback | PASS LOCAL DESIGN / NOT APPLIED | Revised 0030 is idempotent, records only `cod_schema_migrations`, preserves empty `d1_migrations`. Must wait for verified clone/equivalent and source parity; not run remotely. |
| Local regression/build | PASS | Focused 100/100; full 244/244; legacy baseline176; retained-schema old-source4; build/lint/audit0; API/Admin Wrangler dry-runs pass, COD false. |
| Staging activation/live E2E | NOT RUN | No HMAC, migration, deploy, flag, tester journey, order, WAMID or screenshot. No regression claim for running staging checkout. |

GFS-224 source commit `217e2a0dfb6d445fab205115f2121ce6277bbb61`; migration Git blob `05e7c0012ad3ed6677bc691a3f937f15b7d20c50`. No test contains real customer data; live schema inspection returned DDL only. The Git blob identifies code only; migration is unapplied.

## GFS-223 Remote Staging Preflight (2026-10-26; read-only)

| Check | Result | Evidence |
|---|---|---|
| Browser tool/cancellation | PASS partial | Fresh approved-review Codex session listed pages and ran sanitized visible-DOM checks. Root cause: former `-s read-only` invocation had `approval_policy=never`; `evaluate_script` declared `read_only_hint:false`, producing runtime cancellation. No bypass used. |
| Existing authenticated tabs | BLOCKED | Two Meta business pages + WhatsApp Web; no Cloudflare/GitHub/Admin tab. Sender identity visible; canonical WABA not visible; authorized tester match false. No navigation, new tab, screenshot, conversation or mutation. |
| CLI identities | PASS CLI ONLY | `gh api user` = `gardenshop`; `wrangler whoami` = `gisupp@gmail.com`, expected account. Not dashboard UI verification. |
| Live Workers/bindings | PASS METADATA / SOURCE PARITY BLOCKED | API v90 `21a3d74c-3979-432c-9190-1848362592a4`; Admin v82 `b840f5a4-f3c7-4d36-8b66-38a43b5e2d64`; both bind the expected shared staging D1 ID. No Git commit annotation; API version predates PR #10 source commit timestamp. |
| D1 migration ledger | BLOCKED RELEASE | `d1_migrations` exists with zero rows; Wrangler lists all migrations 0001–0030 pending while populated V1 schema/history exists. Do not use Wrangler migrations apply. COD tables absent; migration 0030 unapplied. |
| D1 integrity | PASS READ ONLY | `PRAGMA quick_check` = `ok`; `foreign_key_check` = no rows; metadata reports zero writes. |
| Backup / Time Travel | PASS AVAILABILITY | Wrangler returned a Time Travel bookmark for 2026-10-26T11:45Z; bookmark token kept out of Git. No backup restore/write tested. |
| HMAC/runtime | FAIL ENABLE GATE | Active API metadata has no COD flag or COD HMAC binding; secret list has no COD HMAC name. Candidate flag false. No secret values accessed/provisioned. |
| Collection/Meta/tester | BLOCKED | No authenticated current WABA/courier record; WABA absent in existing tabs; tester profile does not match authorized tester. |
| Remote migration/deploy/live | NOT RUN | No migration, Worker, secret, policy, callback or order mutation; no WAMID/screenshot/live order. |

## GFS-222 Release-Defect Regression and Acceptance (2026-10-26)

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Diagnosis before source repair | PASS LOCAL | Two tests initially failed: changed fee was confirmed without being displayed; disabled province still admitted COD. Targeted repairs follow those reproductions. |
| Quote/availability races | PASS LOCAL | Persisted base/fee/total + exact audited revision; final INSERT rechecks province/config; concurrent advance/back/confirm and duplicate audit guards. No authorized D1 tariff is altered. |
| Configuration/reconciliation | PASS LOCAL | Revision CAS, stale-save conflict, immutable per-order policies, intake disable preserves evidence, exact persisted collection/remittance metadata, winner-only audit and audit-failure rollback. All evidence is synthetic/HMAC-only. |
| Test fulfillment hold | PASS LOCAL | New COD defaults immutable DO NOT SHIP; UI and server deny transition/tracking/labels/reconciliation; retained SQL guards protect old-Worker writes. No hold-clearing endpoint. |
| Advance/receipt regression | PASS LOCAL ONLY | Original three methods and receipt flow retained; SENT/DELIVERED/READ and completed QR retries corrected; no losing callback outbox or conversation overwrite. Running staging Worker not tested. |
| Additive migration | PASS LOCAL ONLY | Populated V1 rows/schema/receipts/audit remain identical; default disabled; local quick_check/FK pass; replay fails without rewriting history; local transaction failure rolls back schema. No remote backup/ledger/integrity result. |
| Actual legacy source against retained schema | PASS LIMITED LOCAL | `npm run test:rollback:v1` with exact unchanged `cf01f44` checkout exercises old API/Admin; four checks cover legacy reads, held COD fulfillment/labels and signed receipt suppression, local quick/FK. Not an actual Worker rollback. Old V1 remains unsuitable for full post-intake COD presentation/reconciliation. |
| MCP/authenticated/live acceptance | BLOCKED / NOT RUN | Official page listing succeeds; protected read-only inspections canceled. No account/bindings, Meta sender/tester/callback, collector/remittance, migration/deploy, real order, WAMID or screenshots verified. |

Final validated source: `bf3a231c585982badcf55b43dece351f92c8d60d`; migration Git blob `4993557afd135c7cb778f565b95ca95eb4431ffd` (not applied remotely).

| Executed command / evidence | Result |
|---|---|
| `npm ci` | Clean install; zero vulnerabilities |
| `npm test -- --run tests/guided-lead-only.test.ts tests/cod-admin.test.ts tests/cod-migration-compat.test.ts tests/product-readiness.test.ts` | 124/124 pass, four files |
| `npm test` | 244/244 pass, 22 files |
| `npm run build`; `npm run lint`; `npm audit` | PASS / PASS / zero vulnerabilities |
| `npx wrangler deploy --dry-run --config apps/api/wrangler.jsonc`; Admin equivalent | Both bundles PASS; API COD flag false. No deployment/version creation. |
| `npm run test:rollback:v1` with `GFS_LEGACY_ROOT` set to clean detached `cf01f44` | Four local actual-source checks pass. Temporary checkout removed after acceptance; recreate from exact commit to rerun. |
| Baseline `npm test` at unchanged `cf01f44` | 176/176 pass, 20 files |
| Failed-confirmation recovery diagnostic then retest | Four original failures reproduced, then 4/4 pass (EN/UR × intake ON/OFF); exact original-event retry recovers stored confirmation without new order/fee/audit. |
| `git diff --check` | PASS; informational LF/CRLF warnings only, no Git configuration changed |

## GFS-221 V1-Compatible COD Candidate (2026-10-25)

| Requirement | Result | Evidence / remaining scope |
|---|---|---|
| Candidate baseline / V1 preservation | PASS LOCAL | Isolated branch `codex/gfs221-cod-compat-001` starts at `cf01f44`; deployed-byte identity remains unverified. Frozen tag and PR #9 unchanged. |
| Additive migration compatibility | PASS SYNTHETIC | `0030_cod_v1_compat.sql` runs against synthetic V1 schema/history; only COD tables/triggers are added. Not applied to shared D1; backup, ledger, quick/FK checks remain operational gates. |
| EN/UR COD pricing | PASS SYNTHETIC | Both locales show item lines, original advance total, PKR125 COD fee once, final collection total. Advance selection before confirmation creates no COD record/fee. |
| COD confirmation/idempotency | PASS SYNTHETIC | One pre-existing order becomes COD_PENDING; webhook retry does not duplicate record; no advance receipt, QR/payment instruction or reminder. |
| Admin COD lifecycle | PASS SYNTHETIC | COD status and final amount visible; audited COD fulfillment requires tracking before dispatch; exact collection and remittance required before COD_PAID/PAID. Ordinary approval/rejection and receipt guards reject COD. |
| Advance regression | PASS LOCAL | Existing V1 payment/receipt regression suite passes; full suite 186/186, focused COD/advance 42/42. Running staging Worker not tested. |
| Build/security | PASS LOCAL | Typecheck/build, lint, offline `npm audit` zero vulnerabilities, `git diff --check` pass. |
| API/Admin Wrangler | PASS DRY-RUN ONLY | Configured staging bindings bundle; API reports `COD_V1_ENABLED=false`. Dry-run does not verify actual account/bindings, secrets, deployment or callback. |
| MCP/account/Meta/courier preflight | BLOCKED | Official MCP config/doctor healthy; fresh CLI exposes `list_pages`; Cloudflare navigation was canceled. No current account/sender/tester/contract record verified. |
| Remote migration/deploy/rollback/live tester | NOT RUN | No backup, D1 migration, Worker deploy, rollback, genuine tester E2E, screenshot, WAMID or test order. |

## GFS-209 Real Receipt E2E (2026-10-24)

| Requirement | Result | Evidence / remaining scope |
|---|---|---|
| Tester, receiver, Admin/Cloudflare identity | PASS REAL | Own WhatsApp Profile matches approved tester; Contact Info is canonical GFS sender; Admin/Cloudflare identity verified |
| Meta registration, permissions, webhook | PASS REAL | WhatsApp Manager `Connected`/`High`; code-verification field alone is `EXPIRED`; permissions granted; canonical callback `messages` subscription active. One SMS request rejected HTTP400; no repeat/re-registration |
| First fresh event | FAIL SAFE | Sticker event persisted as `MESSAGE`, not media; no receipt or state change; not counted as acceptance and not resent |
| Accepted fresh JPEG | PASS REAL | Distinct Photos & videos JPEG replied to exact Easypaisa payment message; visible non-payment label/caption; WAMID hash prefix `bf0c88050136fbe3`; D1 `MEDIA`/`RECEIVED` at `11:13:14.710Z` |
| Order association | PASS REAL | Exact `FS-261024-000005`; `wa_id=NULL`, normalized column NULL, stored WhatsApp number matches authenticated sender; exact payment-message reply; strict NULL-only/mismatch/ambiguity guards |
| R2 / D1 receipt / Admin | PASS REAL | Receipt `4f8e2e7c-b5f8-4fdb-a85e-a88687a8af6e`, `image/jpeg`, 79,863 bytes; private Admin preview opened; screenshot `D:\Temp\kilo\gfs209-admin-e2e.png` and `gfs209-admin-preview.png` outside Git |
| Payment state | PASS REAL | Order `PAYMENT_REVIEW`, payment `PENDING`; reference missing, approval disabled; no funds check, `PAID`, CAPI Purchase or fulfillment |
| Customer acknowledgement | PASS REAL | Exact required English copy visible in WhatsApp; outbound WAMID SHA-256 prefix `7a14232e1692916d`, D1 status `READ` at `11:13:22.229Z` |
| Duplicate suppression | PASS SYNTHETIC + LIVE COUNTS | Focused duplicate-webhook test passes; exact D1 counts are one event, one receipt, one acknowledgement. No live duplicate retry was forced |
| Dependency/security | PASS | Zod 4.6.7 plus Undici 7.30.1 with Zod `partialRecord` compatibility; `npm audit` 0 advisories; 172 tests, lint/build/dry-run pass |
| Deployment / rollback / V2 | PASS V1 ONLY | Worker `76084318-69c7-46b3-bfa0-886610971133`; rollback `7b957406-c869-4461-b184-da230f4d29e3`; V2 PR #9/reminders unchanged |

Full inbound/outbound WAMIDs are stored only in private local evidence files outside Git; hashes are reported above. No synthetic test is substituted for the accepted photo E2E.

## GFS-208 Live Receipt Fix (2026-10-24, historical snapshot superseded by GFS-209)

| Requirement | Result | Evidence / remaining scope |
|---|---|---|
| Authorized sender/receiver | PASS | Own Profile matches approved tester; canonical GFS Contact Info, Admin identity, Cloudflare identity verified; no unrelated chat used |
| Inbound transport/webhook | PASS (inbound) | Image visible delivered at 13:43; signed/canonical conversation timestamp `08:43:10.493Z`; WAMID SHA-256 prefix `2ef787841e6d07e0`; callback `/webhooks/whatsapp`, `messages` subscribed |
| Root cause | PASS diagnosis | Target customer `wa_id` is NULL while stored WhatsApp number matches verified sender; active receipt query requires `wa_id`; no receipt/preview/ack |
| PR #10 V1 repair | PASS local | NULL-only exact normalized-number fallback; exact payment WAMID reply or unique eligible order required; mismatched non-NULL and ambiguous orders fail closed |
| Focused regression | PASS | 28 receipt/media tests; synthetic missing-`wa_id` Easypaisa exact-payment-reply path, EN/UR exact acknowledgement and duplicate webhook do not duplicate receipt/ack |
| Full regression | PASS local | `npm ci`, 172 tests, lint, build, Wrangler dry-run pass; `npm audit` reports 4 existing findings including high severity |
| D1 / bindings / rollback | PASS preflight | `quick_check=ok`, FK check empty, identity columns present; canonical staging bindings; active API `9b5f13ae`, rollback `8da54b28`; no migration |
| R2 / Admin / payment state | NOT CREATED | No private receipt object or D1 row; Admin says no receipts; order remains `PAYMENT_PENDING`, payment `PENDING`; no PAID/funds claim |
| Outbound acknowledgement / WAMID | NOT SENT | Meta status reports phone registration `EXPIRED`; API candidate not deployed. No historical/synthetic WAMID substituted |
| Deployment / PR protection | BLOCKED | PR #10 has no review/check result; no ruleset exists, but high audit findings and Meta registration gate remain; no bypass/deploy |
| Fresh real E2E | BLOCKED | Requires owner-side Meta registration revalidation, release/security clearance, deploy, then a fresh clearly non-payment image replying to the exact payment message and real Admin/R2/D1/DELIVERED checks |

No funds, transaction reference, customer acknowledgement, or receipt record was created. No cost-bearing resource was purchased; existing `images/`, payment history, Hoja isolation, and order state were preserved.

## GFS-199 New Real OFFER Acceptance (2026-10-23)

| Requirement | Result | Evidence / remaining scope |
|---|---|---|
| Own tester phone / sender | PASS | You > View Profile exact approved own phone; Contact Info canonical sender separately; no switch |
| Cloudflare/Admin/Meta | PASS runtime / UI operator partial | Correct GFS Access/Cloudflare, canonical Graph permissions/subscription; separate browser operator not visibly reverified; no Meta mutation |
| D1/deploy preflight | PASS | quick_check/FK,traffic,bindings,Time Travel,169 tests; ledger0 untouched |
| API deployment | PASS | 9b5f13ae,rollback8da54b28; OFFER/FERTILIZER media mapping repaired |
| CMS publication | PASS | OFFER5,RECEIPT2,PAYMENT2,FERTILIZER7 survive reload/API readback |
| EN/UR OFFER | PASS REAL | New READ WAMIDs,image,advance/no-COD,two exact labels; private cropped screenshots |
| Continue/Cancel/START | PASS REAL | Both locales Continue -> FERTILIZER; EN Cancel no order,START -> LANGUAGE; stale Cancel rejected |
| Five fields/fees/Review/Back | PASS REAL EN | Seven D1 fee rows,five synthetic fields,Back -> CONTACT -> REVIEW |
| Place Order | PASS REAL | FS-261023-000001,PKR500; no simulated funds |
| Three text/QR deliveries | READ evidence / queue FAIL | New text+QR READ pairs for all3; read-only reconciliation of pause activity, not agent-driven clicks; instruction jobs DEAD_LETTER/PAYMENT_TEXT_DELIVERY_FAILED |
| Receipt/reference/review/PAID/fulfillment | BLOCKED / NOT PERFORMED | No genuine reference,account-credit evidence,transfer authorization or payment approval;0 receipts on test order |
| Regression/isolation | PASS local | ci,169 tests,lint,build,audit0,both dry-runs; private evidence/images/history preserved |

## GFS-197 OFFER Rollout Gate (2026-10-23)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Admin/GitHub identity | PASS | Admin `gisupp@gmail.com`; PR #8 current head `8af1a877` |
| WhatsApp tester identity | BLOCKED | Current own Profile fails/misses approved tester match; no switch or send |
| OFFER API source | PASS local / NOT DEPLOYED | Source carries stable Continue/Cancel route; active API `8da54b28` is older |
| OFFER/RECEIPT CMS | BLOCKED publication | Drafts v5/v2; published v4/v1 preserved to avoid incompatibility |
| OFFER content | PASS draft only | Draft v5 states advance-payment/no-COD in EN/UR and contains the two required action labels |
| Admin reference guard | PASS deployed | Reference/settlement controls live; current REVIEW missing reference; Request action disabled |
| Financial E2E | NOT PERFORMED | No new order, WAMID, QR, receipt, settlement, PAID or fulfillment |
| Regression | PASS | clean npm ci,168 tests,lint,build,audit0,Wrangler dry-runs |

## GFS-196 OFFER Release Gate (2026-10-23)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| GitHub/Cloudflare/Admin identity | PASS | gardenshop/GFS Access match; current PR head `8af1a877` |
| Chrome inventory | PASS | `list_pages` first; Admin and WhatsApp tabs reused; no new tab or unrelated chat/Meta mutation |
| Authorized WhatsApp tester | BLOCKED | Own Profile does not match/does not expose rules-approved tester; no account switch |
| Admin reference Save/settlement UI | PASS deployed | Reference field, Request Reference, credit-evidence confirmation and PAID gate visible |
| Current reference/customer request | BLOCKED safely | One receipt-backed REVIEW order lacks a ref; API queue dispatch is disabled, window is closed, and no approved utility template exists |
| OFFER/RECEIPT CMS | PASS draft / publication BLOCKED | OFFER v5 and RECEIPT v2 drafts exist; published v4/v1 unchanged because API is older |
| API deployment/live callbacks | BLOCKED | API `8da54b28`; tester lock prevents deployment; no outbound WAMID/order/QR/receipt in GFS-196 |
| D1 access | BLOCKED for direct query | Wrangler/API7403 despite correct account; no account/scope change. Same-origin Admin reads work |
| Regression | PASS | clean install,168 tests,lint,build,audit0,Wrangler dry-runs |
| PR CI | BLOCKED external | Run `39813633938` failed before steps; billing lock remains enforced and was not bypassed |
| Payment/settlement/PAID | BLOCKED | No actual receipt reference, account-credit evidence, transfer, or Admin approval |

## GFS-195 Reference and Offer Repair (2026-10-22)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| PAYMENT_TRANSACTION_REFERENCE_REQUIRED root | PASS diagnosis/fix | Live masked Orders GET showed one REVIEW+receipt+amount match with no ref; deployed Admin adds Save Reference and clear review actions |
| Reference persistence/duplicates | PASS local | Migrations0027/0029 use case/ASCII-whitespace normalization; synthetic API/Admin tests verify association, hash audit, exact duplicate and legacy internal-space collision |
| Settlement/PAID gate | PASS fail-closed | Admin requires receipt, reference, method owner/QR state, matching total, settlement evidence reference and explicit reviewer confirmation; no live PAID tested |
| Request Reference | BLOCKED safely | Window closed, no approved utility template; Admin/API config gate false, no outbox/email/message |
| OFFER Continue/Cancel | PASS local | Stable IDs, bilingual CMS labels, cancel creates no order/payment/CAPI/outbox; START restart; stale/callback duplicates covered |
| OFFER CMS/receipt CMS | PASS draft only | OFFER v5 EN/UR labels and RECEIPT v2 ref prompt saved; published versions unchanged pending API/tester |
| API / active WhatsApp | BLOCKED | Own WhatsApp Profile mismatches authorized tester; no deployment, no new WAMID/order/receipt |
| D1 migrations | PASS applied | Narrow0027/28/29 applied; quick_check ok,FK violations0,normalized duplicate refs0,43 old labels preserved; ledger0 untouched |
| Regression | PASS | clean `npm ci`,168/168,lint,build,audit0,API/Admin dry-runs; Admin live retest PASS |
| Funds/receipt/PAID/fulfillment | BLOCKED | No actual provider-account credit/evidence or transfer authorization; no financial simulation in live D1 |

## GFS-193 Owner-Supplied QR Review (2026-10-22)

| Requirement | Result | Actual evidence / blocker |
|---|---|---|
| Chrome MCP/page inventory | PASS | `list_pages` first,10-page inventory; Admin/WA tabs reused; one D1 tab became unavailable; no Meta write |
| Admin identity/live methods | PASS read-only | GFS Access identity; three methods disabled/owner=false/QR not ready; hashes/review snapshots/previews present |
| Owner QR screenshots | PASS supporting only | Names/payloads for JazzCash/Easypaisa and ALFH destination reviewed; screenshot is not provider proof |
| JazzCash | BLOCKED safely | Draft QR identifier matches previous masked D1 comparison; official till ownership record absent |
| Easypaisa | BLOCKED safely | Official alias-to-Garden-Shop mapping absent; previous destination mismatch unresolved |
| Bank Alfalah | BLOCKED safely | Payload lacks Garden Shop payee name; exact destination-to-account/bank confirmation absent |
| Approval workflow | NOT USED | Deployed snapshot-bound workflow is available; no authenticated evidence reference/settlement supplied |
| Payment/CMS | PAYMENT BLOCKED | CMS v2 placeholders pass; no qualifying method, so actual payment introduction/QR not delivered |
| Pending orders | PASS aggregate / follow-up BLOCKED | 21 pending, totals balanced21, receipts0; zero enabled/verified methods; no messaging |
| Regression | PASS | clean npm ci,159/159,lint,build,audit0,Wrangler dry-runs |
| Final financial state | BLOCKED | No transfer authorization,receipt,confirmed funds,PAID or fulfillment |

## GFS-192 Actual Deployment and Transport (2026-10-22)

| Requirement | Result | Actual evidence / dependency |
|---|---|---|
| Chrome / GFS identities | PASS, Meta operator partial | Admin Access, Wrangler and tester own Profile verified; canonical sender contact/Graph match; separate Meta browser operator not reverified |
| D1/API7403 | PASS this session | Direct queries, supported quick_check=ok, no FK violations; no permission/account change |
| Migration0026 | PASS application / ledger unresolved | Direct schema proved absent; exact additive file applied once,33 null timestamps/no backfill; ledger0, no fabricated entries |
| API/Admin deploy | PASS | API8da54b28; Admin26ac1162; canonical bindings, health and live signed webhook/status transport |
| One-time beneficiary workflow | PASS local / live render | 16 synthetic tests cover stale recipient/QR, race, audit rollback, duplicate, Access/CSRF;3 private previews load; no live approval without proof |
| All3 method activation | BLOCKED safely | Independent provider records absent,0 verified/enabled; owner statement not substituted |
| GFS-187 copy-save | PASS live | Unchanged JazzCash draft save returned safe-draft success; reload preserves disabled/owner=false and complete locale copy |
| EN/UR PAYMENT CMS | PASS publication / output BLOCKED | v2 Save/Publish/Reload, both placeholders; no eligible method so actual payment intro not sent |
| EN real lead journey | PASS lead-only | New test FS-261022-000002, PKR500; full five-field lead/review/Place Order; fail-closed payment notice and separate Check Order |
| UR real regression | PASS partial | Locale ur, Seeds Only, seven localized province fees, FULL_NAME; no second order |
| New transport evidence | PASS | 15 new READ WAMIDs and2 private cropped screenshots; external JSON only, no historical evidence reused |
| Per-method QR, switching, receipt association/privacy | BLOCKED live | No approved method/QR may be delivered; local coverage is not live acceptance |
| Funds / review / PAID / fulfillment | BLOCKED, not simulated | No method/amount transfer authorization, funds, unique reference or Admin payment approval |
| Existing orders | PASS reconciliation / follow-up BLOCKED | 21 pending incl1 test; all totals balance,zero receipts; incident held; no customer messaging/replay |
| Regression | PASS | clean install,159 tests,lint,build,audit0,both dry-runs,real Chrome retests |


## GFS-191 Urgent Payment Activation (2026-10-22)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Chrome MCP / Admin identity | PASS | `list_pages` works; same-origin Access identity matched configured GFS Admin account; no tokens recorded |
| D1 reads | PARTIAL | Admin Orders/payment/CMS GETs succeed; direct Wrangler D1 execute API7403; do not switch account |
| Migration0026 schema | PASS / ledger BLOCKED | Orders API selects `last_inbound_at`; Wrangler tracker lists all 26 pending, so full replay is unsafe |
| Current payment methods | BLOCKED safely | All disabled, owner false, QR reference/hash present, QR delivery blocked; EN/UR method copy/placeholders complete |
| JazzCash beneficiary | BLOCKED | Provider till ownership link absent |
| Easypaisa beneficiary | BLOCKED | Authenticated merchant alias-to-Garden-Shop link absent; destination mismatch unresolved |
| Bank Alfalah beneficiary | BLOCKED | Authenticated QR destination-to-IBAN/Raast link absent; mismatch unresolved |
| PAYMENT CMS | BLOCKED | Published v1 EN/UR have `{orderNumber}`, lack `{amount}`; not published against old runtime |
| Payment-selection actions | PASS source check | PAYMENT template action IDs empty; dynamic options use verified enabled methods; Check Order stays in order-status branch |
| One-time beneficiary approval workflow | PASS local | Protected route requires Access identity, CSRF, opaque reference and explicit confirmation; binds evidence to unchanged QR hash, audits, enables only that method, rejects duplicate, recipient change revokes; not deployed/used |
| Pending orders | PASS audit / BLOCKED contact | 20 pending, zero receipts, no inbound timestamp; no eligible method/window |
| New real WhatsApp E2E | NOT PERFORMED | No verified enabled method, tester/Meta identity not reverified |
| Regression | PASS | clean `npm ci`, focused payment workflow tests, full 145/145, lint, build, audit0, API/Admin dry-runs |
| Deployment/CI | BLOCKED | No deployment without D1 integrity/ledger reconciliation; existing billing lock not bypassed |

## GFS-190 Emergency Checkout Recovery (2026-10-22)

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Supported Chrome DevTools MCP | PASS | `list_pages` succeeded twice; first inventory contained 10 existing pages; same Admin tab reused |
| Admin identity and settings | PARTIAL | Payment Settings rendered, all methods `Draft / incomplete`; active Admin identity not visible; no mutation |
| Cloudflare identity | PASS | Wrangler `gisupp@gmail.com`, canonical GFS account ID; GitHub `gardenshop` |
| D1 API7403 | PARTIAL | `SELECT 1` and masked remote queries succeed via Wrangler; dashboard/API7403 not reproduced there; Access/consent surface unresolved |
| Payment methods | BLOCKED safely | All three disabled/owner false; QR integrity flags pass, independent beneficiary proof and refs absent; amount unset |
| Screenshot-referenced pending order | PASS audit / BLOCKED payment | DETAILS_COMPLETED/PENDING; total matches supplied screenshot; no method/receipt (amount omitted) |
| Other pending orders | PASS audit / BLOCKED contact | 20 total pending, 14 no method, 6 historical selections, zero receipts; no current authenticated inbound window |
| Migration0026 | BLOCKED | Remote schema lacks `last_inbound_at`; remote PRAGMA returns SQLITE_AUTH and Wrangler migration directory is mislocated; no write |
| CMS / Admin GFS-187 fix | BLOCKED | No active Admin identity; no Save/Publish/deploy or browser retest |
| Fresh WhatsApp journey/WAMIDs/QR media | NOT PERFORMED | No method qualifies; tester identity not reverified; no new message/order |
| Receipt / review / PAID / fulfillment | NOT PERFORMED | No receipt/funds/unique reference/authorized approval; no financial state mutation |
| Quality after lockfile security fix | PASS | Clean install,143/143,build,lint,audit0,API/Admin dry-runs; Chrome list_pages retest PASS |
| Release decisions | NO-GO | Public leads and customer payments remain NO-GO; no deployment or CI bypass |

## GFS-189 Timestamp and Service-Window Matrix

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Chrome MCP/list_pages | BLOCKED | MCP namespace absent; Chrome has no DevTools endpoint/bridge; no raw CDP |
| Migration | PASS LOCAL | 0026 adds nullable last_inbound_at; existing conversations remain NULL |
| Inbound timestamp provenance | PASS LOCAL | HMAC/Phone ID validated route persists first server receipt time from unique inbound event |
| Duplicate/delayed callback | PASS LOCAL | Existing provider event created_at retained; stale duplicate at25h doesn't move last_inbound_at |
| Status/outbound isolation | PASS LOCAL | Status-only callback produces no inbound timestamp write |
| 24h boundary | PASS LOCAL | Fresh and 23h59m59s accepted; exactly24h, future, null and invalid rejected |
| Free-form stale retry | PASS LOCAL | Failed reply at25h set PERMANENT_FAILURE; provider mock not called |
| Queued payment outside window | PASS LOCAL | Job permanently blocked/audited/acked; no retry/provider call |
| Payment request idempotency | PASS LOCAL | Same inbound/Flow ID hashes to same key; a fresh selection gets a distinct request key; text/QR parts are scoped to request |
| Historical/new order activity | BLOCKED live messaging | GFS-188 order totals remain D1 audit; no CMS/provider/Chrome send |
| Real-time service eligibility for old orders | BLOCKED | No backfill; last inbound time unknown until next authenticated message |
| Full local regression | PASS | npmci;143/143;build/lint/audit0;API/Admin Wrangler dry-runs |
| Staging deploy/Chrome | NOT PERFORMED | No MCP; GFS-187 Admin fix and migration not live |

## GFS-189 Inbound Window and Release Gates

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Chrome MCP/list_pages | BLOCKED | Kilo config enabled; Chrome no DevTools endpoint, no bridge/tool namespace; no raw CDP |
| Migration/no backfill | PASS LOCAL | 0026 adds nullable last_inbound_at; existing values stay NULL |
| Admin Orders lastInboundAt | PASS LOCAL | Orders API exposes timestamp for authenticated reconciliation; synthetic API assertion passes |
| Admin Orders visual timestamp | BLOCKED | Chrome MCP unavailable; no rendered mobile/desktop Admin verification |
| Signed inbound timestamp | PASS LOCAL | Uses original whatsapp_events.created_at after signature/Phone ID checks |
| Status/outbound isolation | PASS LOCAL | Only parsed inbound messages invoke timestamp persistence |
| Duplicate/delayed webhook | PASS LOCAL | INSERT OR IGNORE preserves first receipt time; replay at25h cannot extend |
| 24-hour boundary | PASS LOCAL | <24h accepted; exactly24h/null/invalid/future rejected |
| Free-form stale retry | PASS LOCAL | Outbound reply becomes terminal PERMANENT_FAILURE; provider not called |
| Queued payment retry | PASS LOCAL | Expired window terminalizes job/acks; no provider send/retry |
| Payment selection idempotency | PASS LOCAL | Same inbound/Flow ID reuses hashed key; new authorized selection gets a distinct key |
| Payment request idempotency | PASS LOCAL | Same inbound/Flow request hash reuses one key; a later authorized selection gets a distinct key; text/QR parts are per-request |
| New orders1-4 | PASS last-known / BLOCKED current | GFS-188 D1 audit totals2000/2750/6250/1000; final GFS-189 read returned API7403 |
| Pending customer sends | BLOCKED safely | No verified method; inbound time unavailable for historical records; no send/replay |
| CMS intro/mobile Admin | BLOCKED | PAYMENT v1 lacks required text; Chrome/Admin UI unavailable; mobile issue unreproduced |
| New number coexistence | BLOCKED | Owner/embedded signup/Pakistan eligibility unavailable; no migration |
| Ads-to-WhatsApp | BLOCKED | No current Chrome/Meta draft preview; no publish/spend |
| Full local quality | PASS | Focused52/52; full143/143;build/lint/audit0;API/Admin Wrangler dry-runs |
| Current order read | BLOCKED | Cloudflare API7403 despite correct account identity; no retry/account switch |
| Post-push CI | BLOCKED | Run39578100146 completed with zero steps under known billing lock |
| Staging deploy/live test | NOT PERFORMED | No Chrome MCP; rollback and current versions preserved |

## GFS-188 Order/Payment/Coexistence Audit

| Requirement | Result | Evidence / blocker |
|---|---|---|
| Branch/protected records | PASS | HEAD9aa63af fetched; required rules/status/test/decision/resource docs read |
| Chrome MCP/list_pages | BLOCKED | Namespace unavailable; Kilo config enabled, Chrome running without DevTools endpoint, no MCP bridge process; no raw CDP |
| New orders1-4 | PASS audit / BLOCKED action | Four orders details-complete/payment pending; totals2000/2750/6250/1000; no method/receipt/ref |
| All other pending | PASS audit | Eleven no-method details-complete; six historical selected-method pending; zero receipts; no replay/message |
| Outbound/WAMID | BLOCKED | Zero outbound-message rows for four new orders; CAPI lead outbox only; no fresh WAMID |
| Service window | BLOCKED | No persisted `last_inbound_at`; `conversation.updated_at` is not an exact inbound timestamp; no messages sent |
| Payment methods | BLOCKED safely | Three disabled/unverified; QR integrity reused; provider evidence absent |
| CMS intro | BLOCKED | Published PAYMENT v1 does not contain supplied EN/UR intro; no Chrome/Admin workflow, no direct D1 write |
| Admin mobile blank space | NOT REPRODUCED | Screenshot/Admin browser unavailable; no CSS guess |
| Second-number coexistence | BLOCKED | Candidate ownership/age/provider/Embedded Signup status unavailable; no migration/OTP/WABA change |
| Manual handoff | BLOCKED | No validated second contact or Coexistence route; no bot/human state change |
| Ads CTA/draft | BLOCKED | No Meta browser; no draft, publish or spend |
| Security/hold | PASS containment | No Hoja/token/integration use; FS-261019-000001 unchanged |
| Local release gates | PASS | npmci;138/138; build/lint/audit0; Wrangler API/Admin dry-runs |
| Deployment/CI | NOT PERFORMED / BLOCKED | No source change; current staging versions unchanged; run39558601305 failed under billing lock before steps |

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

| GFS-264 random reference format | Secure randomness, Crockford alphabet, date/sequence independence | PASS: local tests assert `FS-XXXX-XXXX-XXXX`, no date derivation, private Karachi sequence |
| GFS-264 collision/idempotency | bounded retry, concurrent allocation, duplicate callback/order suppression | PASS: focused/full tests; no duplicate provisional order in two-choice COD path |
| GFS-264 COD classification | PUBLIC unheld, registered TESTER_ONLY held, unknown fail closed | PASS locally; live config/database mutation not performed |
| GFS-264 hold release | authenticated Admin, CSRF, provenance, audit, one-order authorization, test protection | PASS locally; live cited order release pending authorization/provenance mutation gate |
| GFS-264 fulfillment/financial guard | COD_PENDING to PACKING; no upfront payment; PAID requires verified collection/remittance | PASS locally; no live fulfillment or PAID mutation |
| GFS-264 rollback/integrity | unchanged baseline rollback, D1 quick/foreign-key checks, historical references | PASS 4/4 local rollback; full synthetic migration integrity pass |
| GFS-264 external gates | Chrome read-only identity, 0% smoke, deployment, audit endpoint | PARTIAL: read-only identity/0% observation PASS; deploy/audit endpoint BLOCKED |
| GFS-265 source preservation | PUBLIC vars, stale assertions, Hoja isolation | PASS: API config PUBLIC; no unrelated assets |
| GFS-265 isolated migration | Targeted 0035/0036, fail-closed trigger, single-use release | PASS: rehearsal only; live schema unchanged |
| GFS-265 live preflight | D1 counts/config, quick/FK checks, target hold | PASS read-only: 65/65, PKR125, 3 methods, quick ok, FK0, target held |
| GFS-265 deployment gate | Authenticated Wrangler, recovery bookmark, 0% smoke, promotion | BLOCKED: expired/unreachable OAuth and no current bookmark exposed |
| GFS-265 customer acceptance | New random ref, two-tap COD, receipt images | BLOCKED/PENDING: no authorized customer device or live deployment |
| GFS-266 payment-review inspection | Three stored receipts, saved reference, independent settlement proof | PASS read-only for stored artifacts; BLOCKED for settlement proof, order remains REVIEW |
| GFS-266 Confirm PAID UI | Single non-COD action, saved reference reuse, disabled without settlement proof | PASS local/source; secure endpoint and COD exclusion retained |
| GFS-266 approval idempotency | Conditional payment/order/audit writes and duplicate-click behavior | PASS local regression; no live approval attempted |
| GFS-266 live release | OAuth, D1 recovery bookmark, targeted migration, version consolidation | BLOCKED: OAuth expired/unreachable and supported recovery bookmark/backup unavailable |
| GFS-266 live migration | Bookmark before write; targeted 0035/0036; no legacy replay | PASS: schema/index/triggers present; 0036 marker present; integrity PASS |
| GFS-266 live Worker/Admin promotion | 0%-traffic smoke then 100% promotion with rollback versions | PASS: API `24d72438…` 100%, Admin `cd155f20…` 100%, prior versions 0% |
| GFS-266 public COD hold repair | One authenticated provenance release; no bulk/test release; unpaid fulfillment path | PASS: one public row unheld/COD_PENDING/Mark packing; six rows remain held |
| GFS-266 final Admin response | Committed release cannot return false conflict | PASS: authoritative re-read repair live; idempotent already-released path retained |

| GFS-267 HTTP500/root cause | PASS | Chrome reproduction; D1 code7500 daily row-read limit; live 0035/0036 structures present |
| GFS-267 list repair | PASS local | Narrow list SELECT, JSON503 on D1 read failure; focused6/6 and full291/291 |
| GFS-267 active Orders smoke | PASS | HTTP200; counts67/6/2/10; total67; 25-row page; opaque-shaped references/private sequence observed |
| GFS-267 candidate/detail smoke | BLOCKED | Candidate JSON503 and detail acceptance pending D1 quota recovery; no mutation |
| GFS-267 rollback/audit/integrity | PARTIAL | Rollback4/4 PASS; npm audit and current D1 integrity rerun blocked by service/registry limits |

| GFS-271 usage identity/period | **PASS read-only** | Official Chrome MCP; Get Free Seeds; daily 8.06M/5M; cumulative 44.23k vs last-24h 27k |
| GFS-271 top-query investigation | **PASS read-only** | Redacted Query Insights counts, total rows_read, averages, and code call-site mapping |
| GFS-271 migration0037/EXPLAIN | **PASS local** | Additive rehearsal; indexed list/count/detail/customer plans; integrity rehearsal passed |
| GFS-271 fixture benchmark | **PASS local** | Synthetic 20/50/100/1,000 orders; bounded list/detail/settings/lookup and checkout writes |
| GFS-271 live rows_read after | **BLOCKED** | Daily D1 cap exhausted; no post-deploy metric invented |
| GFS-271 live Admin release | **BLOCKED safely** | Requires quota recovery/capacity, bookmark, 0% JSON200 smoke, then promotion |

| GFS-273 Paid entitlement/account | **PASS** | Wrangler identity `gisupp@gmail.com` / Get Free Seeds; 25B reads and 50M writes |
| GFS-273 version override provenance | **PASS** | Full candidate UUID recorded by Wrangler tail for authenticated requests; no HTTP-only assumption |
| GFS-273 optimized Admin smoke | **PASS** | Candidate Orders, Payment Settings, payment-methods and detail HTTP200; counts 68/6/2/11, page 1/3 |
| GFS-273 migration0038/index/integrity | **PASS** | Additive provider/status index; marker present; EXPLAIN uses index; quick/FK checks pass |
| GFS-273 query-cost after | **PASS/PENDING** | Orders 300/6 (~50/request) vs historical 3.43M/80; outbound post-index natural-traffic metric pending |
| GFS-273 promotion/rollback | **PASS** | Admin `66426d2a` 100%, `cd155f20` 0%; rollback4/4 PASS |
| GFS-273 customer/financial mutation safety | **PASS** | No approval, receipt, COD hold, fulfillment, order creation, webhook replay, or customer message |

| GFS-279 recovered schedule | **PASS local** | Exactly +15/+30/+60/+210/+240; anchored to Advance selection; idempotent; no +270 stage |
| GFS-279 eligibility and suppression | **PASS local** | Paid/opt-out suppression, no-method separation, receipt/review/COD/terminal guards |
| GFS-279 COD fallback | **PASS local** | Confirm/keep/cancel; existing order/reference; PKR125 exactly once; reminder stop and consent audit |
| GFS-279 duplicate/clock behavior | **PASS local** | Duplicate schedule/queue/confirmation paths remain idempotent; stage boundary tests pass |
| GFS-279 worker/template delivery | **PASS source/build** | Queue retry/dead-letter, published-template, locale/window, WAMID/status paths compile and lint; live delivery not run |
| GFS-279 live release and WAMIDs | **BLOCKED safely** | No authenticated template verification, migration, staged deployment, or customer send; no WAMIDs fabricated |

| GFS-280 provider locale and consent payload | **PASS** | Meta payload test verifies deterministic `en_US`/`ur` selection, body parameters, and `CONFIRM_COD`/`KEEP_ADVANCE`/`CANCEL_ORDER` quick replies |
| GFS-280 focused reminder regression | **PASS** | 30/30 after provider repair; stage, suppression, consent, duplicate, retry, locale, and boundary coverage |
| GFS-280 full regression/build/lint/audit | **PASS** | 303/303, build, lint, offline audit 0 vulnerabilities |
| GFS-280 rollback and Worker dry-runs | **PASS local** | rollback4/4; API/Admin dry-runs preserve D1/R2/Queue bindings and all reminder flags false |
| GFS-280 live D1 migration0039/0040 | **BLOCKED safely** | Over-quota safety gate rejected bounded SQL preflight; no live write or integrity claim |
| GFS-280 Meta templates and WAMID | **BLOCKED safely** | Two Utility templates In review, no approved template, remaining variants absent; no customer message or WAMID |

| GFS-281 schedule creation window gate | **PASS** | Rejects null, invalid, future, expired, missing-message-identity, opted-out, and invalid-recipient schedules |
| GFS-281 due claim window gate | **PASS** | Due stages require the latest persisted inbound identity/timestamp; expired schedules become permanently `BLOCKED_WINDOW` |
| GFS-281 queue/send window gate | **PASS local** | Queue rechecks the latest window immediately before send; closed-window jobs stop the schedule and cannot use a template fallback |
| GFS-281 no Meta template path | **PASS source/build** | Worker sends only local CMS text or +240 interactive buttons inside the verified window; utility approval flag is not used to authorize sending |
| GFS-281 live D1/Paid verification | **PARTIAL/BLOCKED** | Workers Paid and account identity verified; production schema visible, but bounded SQL marker/integrity read rejected by safety gate |

| GFS-282 D1 rejection layer | **PARTIAL/BLOCKED** | Paid entitlement, account, production binding, and Studio access verified; bounded marker read rejected before execution by the local/tool quota safety reviewer |
| GFS-282 migration0039/0040 | **BLOCKED safely** | No marker/FK/quick-check/recovery read; no D1 write, replay, backfill, or live migration |
| GFS-282 strict 24-hour policy | **PASS local** | Identity/timestamp checked at schedule, claim, and send; expired/unknown windows permanently block; no Meta template fallback |
| GFS-282 release/activation | **BLOCKED safely** | No candidate deployment, flag change, Cron/Queue activation, live send, WAMID, delivery, or COD conversion |
| GFS-282 regression gates | **PASS local** | Full 309/309, build, lint, offline audit 0 vulnerabilities, rollback4/4, diff check |

| GFS-284 owner-approved D1 identity | **PASS read-only** | `gisupp@gmail.com` / Get Free Seeds / `getfreeseeds-prod` / production database ID verified; canonical GFS WABA rechecked |
| GFS-284 schema/markers/triggers | **PASS read-only / mismatch** | No reminder/COD sidecar/ledger objects and zero trigger rows; pre-reminder schema only |
| GFS-284 integrity/recovery | **PASS read-only** | `quick_check=ok`, FK result empty, existing Time Travel bookmark returned without creating/changing one |
| GFS-284 migration readiness | **BLOCKED safely** | 0039/0040 local rehearsal passes, but verified production schema lacks required COD lifecycle objects; no live apply authorized |

| GFS-285 active Worker binding | **PASS read-only** | API/Admin production environments both bind staging D1 UUID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`; production-name UUID `02b707df-a10c-4645-9516-a2a4541f6fab` is not active |
| GFS-285 Admin payment approval guard | **PASS** | Live route exposes settlement-gated Confirm PAID only; local legacy approval button is disabled and settlement payload requires both confirmation and evidence reference |
| GFS-285 current order aggregate | **PASS read-only** | Admin API returned 125 total, 8 REVIEW, 2 APPROVED/PAID, 45 fulfillment; bounded classification did not persist customer fields |
| GFS-285 reminder deployment truthfulness | **PASS local / BLOCKED live** | Deployed reminder route is 404; local missing-schema API returns `REMINDERS_NOT_DEPLOYED` 503 instead of an empty success |
| GFS-285 focused regression | **PASS** | Admin payment, reminder, and guided payment tests 105/105 |
| GFS-285 full quality gates | **PASS local** | Full 310/310, build, lint, offline audit 0 vulnerabilities, rollback4/4, diff check |

| GFS-286 bounded funnel audit | **PASS read-only** | Durable aggregate buckets: 48 stopped before method, 11 instruction failures, 20 delivered/read without receipt, 4 unclassified; no customer fields retained |
| GFS-286 payment-stage Admin filters | **PASS** | New no-method/instructions-not-sent/delivery-failed/unpaid-after-delivery filters and counts; truthful `NOT_SENT`/`FAILED`/delivery status; protected settlement panel retained |
| GFS-286 migrations0039/0040 | **PASS live** | Rehearsed and applied once to active D1; markers 0037–0040, reminder tables, `quick_check=ok`, empty FK check; no backfill/reset/replay |
| GFS-286 version-override smoke | **PASS** | API health, Admin Orders/filter/settlement, and reminder CMS/timeline passed through 0%-traffic candidate overrides |
| GFS-286 promoted Worker/trigger state | **PASS sends-off** | API `8e670de8` / Admin `c2e87231` at 100%; prior versions at 0%; minute Cron and Queue producer/consumer attached; flags false |
| GFS-286 live reminder activation | **PENDING safely** | Zero post-promotion orders and zero eligible recipients; no schedule, send, WAMID, delivery, or retry was fabricated or attempted |
| GFS-286 full quality/rollback | **PASS** | Full 310/310, build, lint, offline audit 0 vulnerabilities, rollback4/4 |

## GFS-287 — 2026-10-28

| Area | Result | Evidence |
|---|---|---|
| Clean checkout summary | PASS | Dynamic item/free/PKR lines, delivery, one total, payment choice, bilingual output, and no initial COD total duplication covered in guided tests |
| COD confirmation | PASS | Short base/fee/total-on-delivery copy, exact PKR125 policy fixture, explicit confirmation, Advance fallback, duplicate callback and one-record invariants |
| Existing reminder engine | PASS | Five stages +15/+30/+60/+210/+240; no +270; strict window, opt-out, state exclusion, idempotency, retry and COD-consent tests retained |
| Focused suites | PASS | 104/104 guided/reminder/COD compatibility tests |
| Full suite | PASS | 310/310 tests |
| Build/lint/audit | PASS | TypeScript build, ESLint, offline audit 0 vulnerabilities |
| D1 integrity | PASS | Active binding markers 0037–0040, `quick_check=ok`, empty FK check; no write in final verification |
| Release/rollback | PASS | API candidate preview and health 200; activated version promoted 100%, prior API 0%; rollback4/4 |
| Live delivery | PENDING | No post-activation eligible order; schedules/outbox/WAMIDs/delivery events all 0; no synthetic recipient used |

## GFS-288 Emergency WhatsApp Restore — 2026-10-28

| Area | Result | Evidence |
|---|---|---|
| Runtime health/rollback decision | PASS / no rollback | Active API health HTTP200; API `7b662e0d` 100%, rollback `8e670de8` 0%, Admin `c2e87231` 100%; no production mutation |
| Incident D1 correlation | PARTIAL | 25 inbound MESSAGE, 5 INTERACTIVE, 5 sent-status, 1 delivered-status, 1 read-status, 9 outbound READ; no customer correlation/WAMID claim |
| Admin reminder visibility | PASS | All five stages visible; timeline truthfully reports no schedules or deliveries |
| COD_CONFIRM START guard | PASS local / not causal | Invalid action receives validation reply; incident conversation was NEW, not COD_CONFIRM |
| Focused webhook/reminder/window tests | PASS | 102/102 |
| Full regression | PASS | 310/310 |
| Build/lint | PASS | TypeScript build and ESLint |
| Audit | BLOCKED | npm advisory endpoint unavailable; no vulnerability result claimed |
| Rollback4/4 | BLOCKED | `GFS_LEGACY_ROOT` is not configured in this worktree |
| Genuine tester acceptance | PENDING | Admin reset overlapped incident; no correlated inbound→outbound device evidence |

## GFS-289 Emergency WhatsApp Restoration — 2026-10-28

| Area | Result | Evidence |
|---|---|---|
| Version compatibility | PASS | `8e670de8` and `7b662e0d` share D1/R2/Queue/Meta/COD bindings and fetch/scheduled/queue handlers |
| Emergency rollback | PASS | `8e670de8` 100%; `7b662e0d` 0%; Admin unchanged; public health HTTP200 |
| Exact regression | PASS | Live D1 parser returns `ambiguous column name: status` for old reminder reconciliation SQL |
| Fault-window correlation | PASS | 34 persisted inbound events; 4 pre-rollback replies; 3 delayed post-rollback replies; 27 without direct reply |
| Genuine post-rollback replies | PASS | Real provider WAMIDs present; final post-push checkpoint 56 READ, 4 DELIVERED, 2 SENT; identifiers not stored in docs |
| Conversation progression | PASS restoration | LANGUAGE/OFFER/PROVINCE/FULL_NAME observed; zero new orders |
| Customer-webhook isolation | PASS | Forced reminder-sync failure cannot block signed START/welcome HTTP200 or state progression |
| Qualified Cron reconciliation | PASS | Corrected SQL executes from scheduled handler; live D1 EXPLAIN accepted with indexed stage lookup |
| Reminder/Admin state | PASS PAUSED | Flags false/false/false; authenticated five-stage Admin; 10 published internal copies; 0/0/0/0 reminder rows |
| Focused regression | PASS | 104/104 |
| Full regression | PASS | 312/312 |
| Build/lint/audit | PASS | TypeScript, ESLint, online audit 0 vulnerabilities |
| Rollback4/4 | PASS | Existing clean `gfs273-v1` worktree at exact `cf01f44` |
