# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Test Matrix

## LIVE-TEST-001 (2026-11-27)

Live controlled test safely stopped before initiation:0 outbound/10; no test window. Current API old Worker has per-minute Cron and Queue consumer without verified recipient-specific cap. CTWA/FEP/pricing, expiry, English/Urdu rendering, localized buttons, payment/COD content and Utility routing are NOT TESTED. No source change and no regression run. Reused baseline full499 passed/1 skipped, focused143, Node52/52, build/lint PASS, production audit0. No export or restore; candidate D1 metrics were read-only only. Protected Label Printer hashes verified:923 identical,0 changed,0 missing. See `GFS_ORDERFLOW_LIVE_TEST_001.md`.

## FINAL-VERIFICATION-001 (2026-11-27)

No source changed, so prior accepted results are reused rather than rerun: full Vitest499 passed/1 skipped, focused143, Node52/52, TypeScript/build/lint PASS, production audit0, six registered moderate development findings retained. Recovery/quarantine,0049→unchanged0050→0051 and synthetic restore checks are local-only evidence. This task rechecked protected Label Printer hashes:923 identical,0 changed,0 missing. Live WhatsApp/FEP/pricing/rendering, export/restore, remote migration and candidate acceptance are NOT RUN; owner approved test count/window but private number is outstanding. Proposed F:\GFS-Backups failed encryption/ACL preflight; no encrypted destination is approved. Current Workers predate the candidate. No production changes. See `GFS_ORDERFLOW_FINAL_VERIFICATION_001.md`.

Executed2026-11-25 in the approved checkout with locked dependencies and synthetic fixtures. Master project is GFS ORDERFLOW. No live send/payment/settlement/media/migration/release test.

## Executed baseline

| Gate | Actual command/evidence | Result |
|---|---|---|
| Dependencies | `npm.cmd ci --no-audit --no-fund` | PASS183 packages; exact Hono4.13.16 lock updated; esbuild/workerd install-script approval warnings not overridden |
| Final full suite after FIN-ATOMIC | `npm.cmd test -- --reporter=dot --maxWorkers=2` | PASS34 files,410 passed,1 skipped,411 total |
| Types | `npm.cmd run build` | PASS; tsc/noEmit, not deployed bundle build |
| Lint | `npm.cmd run lint` | PASS |
| Safety/controller/capacity mocks | `node --test scripts/test-canary-deadline-controller.mjs scripts/test-cloudflare-canary-adapter.mjs scripts/test-cloudflare-observability.mjs scripts/test-cloudflare-graphql-probe.mjs scripts/test-cloudflare-token-verify.mjs scripts/test-gfs462-isolated-watchdog.mjs scripts/test-gfs464-isolated-watchdog-worker.mjs scripts/test-d1-capacity-stress.mjs` | PASS52/52; not a live rollback exercise |
| Production dependencies | `npm.cmd audit --omit=dev`; official GHSA pages; package-lock Hono4.13.16 | PASS:0 production vulnerabilities; all five Hono advisories absent |
| Full dependency audit | `npm.cmd audit --json` | OPEN OUT-OF-SCOPE:6 moderate dev-tool dependency findings through minimatch GHSA-g3hv-75wg-m249; no unrelated upgrade |
| GitHub identity/permission | Existing authenticated GitHub settings; `git credential-manager github list`; dry-run push | Verified account gardenshop and private noreply author identity; write dry-run passed, no refs changed. No Git config changed. |
| PowerShell | `npm` resolved policy-blocked npm.ps1; normal npm.cmd worked | No policy bypass; PS test scripts NOT RUN |
| Protected files | Existing923-entry checksum manifest compared after final docs | PASS923 identical,0 changed,0 missing |
| Runtime source | Scoped final diff | Admin SQL/guards changed; additive migration0049 prepared; test-only D1 adapter hooks and route tests changed. No CAPI config, postal amount, provider call or Worker deployment change. |
| Initial financial model | Node24 `node:sqlite`, in-memory synthetic data | Initial source-shaped approval/MO partial states and separate-ledger digest acceptance reproduced before route tests were added. Superseded by actual Admin HTTP evidence below. |
| Actual Admin financial routes | `npm.cmd test -- tests/cod-admin.test.ts --reporter=dot` | PASS50/50 focused final: stale approval/settlement races, unauthorized/wrong amount, approval/TID/MO concurrency, provider method scope, same-order replay, audit/outbox rollback and history/incident guards. |
| Migration0049 preflight/compatibility | Synthetic SQLite only | PASS: backfill/reapply, historical cross-ledger conflict abort without changing legacy rows, old-style ledger insert auto-claim and duplicate insert rejection. Never applied to production. |
| Hono router security | Node local Hono4.13.13 synthetic `app.use(path,auth)` and parameterized route | REPRODUCED middleware skip for two advisory scoped patterns; actual source global `app.use("*")` sample with an encoded line terminator stayed401. Exact production app exploit NOT reproduced. |
| Final docs acceptance | Local assertions over GFS audit/contract/security documents | PASS9 lifecycle documents +2 security reports,25 relative links,23 O-requirements,14 REV.2 additions,18 sections,8 completed S0 units; whitespace/conflict markers clear |
| Final protected hashes | SHA256 manifest recheck after all local edits | PASS923 identical,0 changed,0 missing at17:21UTC; post-commit recheck does not change this project baseline |
| Protected project boundaries | Parent/working-directory scope and runtime diff | No edits outside approved checkout; no live data or production mutation; only Admin SQL guards, migration candidate and synthetic route tests; standalone MO/Hoja/Label Printer remain separate |

Skipped test is not passed. Legacy rollback script requires a separately authorized external source fixture and was NOT RUN. An accidental `node --test --experimental-sqlite` with no explicit paths auto-discovered the Vitest suite under the wrong Node test runner and produced harness failures (plus one timing-sensitive lock test); it is a FAILED, unsupported invocation, not the repository test command. Final Vitest410/1 skipped and documented Node52/52 passed. No files or fixtures were changed by the invalid invocation. These tests do not claim the revised order workflow is implemented.

## INTENT-030 closeout acceptance (2026-11-26)

| Gate | Actual command/evidence | Result |
|---|---|---|
| Focused lifecycle/free gate/activation | `npm.cmd test -- --run tests/order-intent.test.ts tests/free-messaging.test.ts tests/meta-activation.test.ts` | 36 synthetic tests covering bilingual stages/buttons, immutable locale in delayed worker, dynamic remaining time, duplicate/delayed/missing status callbacks, no invented T0, 0049→0050→0051, COD/expiry/cancel/payment/receipt/TID races, late-TID non-reopen, duplicate jobs/retry-after-FEP-expiry, old schedule isolation, unconfirmed-dispatch exclusion, opt-out, free pricing, service-window, CTWA/mobile/expiry and template gates. |
| Full suite after INTENT-030 | `npm.cmd test -- --reporter=dot --maxWorkers=2` | PASS436 passed,1 skipped. |
| Full API journey fixture | `npm.cmd test -- --run tests/guided-lead-only.test.ts` | PASS104,1 skipped with synthetic verified CTWA/pricing evidence in the D1 fixture; no live provider. |
| Documented Node suites | Explicit eight-script `node --test` command in the closeout | PASS52/52. |
| Types/lint | `npm.cmd run build`; `npm.cmd run lint` | PASS. |
| Production dependency audit | `npm.cmd audit --omit=dev` | PASS0 production vulnerabilities. Full dev audit later confirms the existing six moderate dev-tool findings; no unrelated upgrade. |
| Migration compatibility | Synthetic SQLite executes migration0049, unchanged `0050_order_confirmation_intents.sql`, then local `0051_order_confirmation_intent_state_guards.sql`; full guided harness also executes sorted migrations | PASS for local schema/state/lock paths only. None applied remotely. `0050` SHA-256 recorded in the report. |
| Protected checkout | 923-file Label Printer before-manifest compared SHA-256 against current files | PASS923/923 unchanged; no protected workspace edits. |
| External/release boundary | Scoped local source/test changes only; browser `list_pages` used first | No account mutation, hosted D1 write, migration apply, message, payment/order update, deployment or traffic action. No page navigation/identity assertion. New-number WhatsApp lock and Hoja Seeds zero-connection preserved. |

INT01-21 local acceptance is **complete**. Live per-contact FEP expiry/pricing evidence, sender display/template quality, A10 rollback rehearsal and production parity remain release gates, not local-development blockers. Physical stock management/reservation is not required; the household eligibility lock is only a cooldown. No inventory table/counter/warehouse dependency exists. All live customer sends fail closed until authoritative free evidence is supplied; no paid fallback.

## TID-001 closeout acceptance (2026-11-26)

| Gate | Actual command/evidence | Result |
|---|---|---|
| Focused TID/Admin/formatting | `npm.cmd test -- --run tests/admin-payment.test.ts tests/cod-admin.test.ts tests/payment-confirmation.test.ts tests/whatsapp-formatting.test.ts tests/order-intent.test.ts tests/meta-activation.test.ts` | PASS101/101. |
| Full Vitest after TID-001 | `npm.cmd test -- --reporter=dot --maxWorkers=2` | PASS447/1 skipped across38 files. |
| Node / build / lint / audit | Eight documented `node --test` scripts; `npm.cmd run build`; `npm.cmd run lint`; `npm.cmd audit --omit=dev` | Node52/52; build/lint pass; production audit0. Full audit has six moderate dev-tool findings; no unrelated upgrade. |
| One-action Admin approval | `tests/admin-payment.test.ts`; actual Hono Admin routes in `tests/cod-admin.test.ts` | PASS: typed TID/leading zeros; order/method/Total Payable auto-loaded; receipt, exact amount, verified QR/method, actual-credit evidence, Access/CSRF/HMAC and atomic APPROVED/PAID required. No TID-only approval. |
| Provider-scoped duplicates | Synthetic SQLite/Admin concurrency | PASS: same-method duplicates reject with conflicting order and audit; same-order replay is idempotent; cross-method references warn with order/method and require explicit operator acknowledgement. Provider-specific uniqueness preserved. |
| Reminder stop/notification | Admin approval + actual API Queue | PASS: pending reminder jobs become terminal; locale-pinned Payment Received outbox is queued; unknown free eligibility suppresses notice but preserves PAID state. No CAPI or parcel dispatch. |
| Bilingual direction | `tests/payment-confirmation.test.ts`, `tests/whatsapp-formatting.test.ts` | PASS: paragraph order, blank lines, LTR/RTL isolation, Total Payable, TID/order/tracking IDs, phone and URLs; no HTML/CSS. Live-client visual confirmation remains a release gate. |
| Migration compatibility/protected trees | Synthetic 0049→unchanged0050→0051 + full guided migration harness;923 Label Printer hashes | PASS locally only;0050 unchanged; no remote apply;923/923 hashes unchanged. |

## PENDING-001 closeout acceptance (2026-11-26)

| Gate | Actual command/evidence | Result |
|---|---|---|
| Focused PENDING/Admin/fulfillment | `npm.cmd test -- --run tests/order-reconciliation.test.ts tests/admin-orders.test.ts tests/cod-admin.test.ts tests/admin-fulfillment.test.ts tests/admin-payment.test.ts tests/guided-lead-only.test.ts tests/admin-controls.test.ts tests/admin-layout.test.ts` | PASS218/1 skipped across8 files. |
| Focused FEP/intent/service-window regression | `npm.cmd test -- --run tests/free-messaging.test.ts tests/order-intent.test.ts tests/guided-lead-only.test.ts tests/service-window.test.ts` | PASS136/1 skipped across4 files. |
| Final full regression | `npm.cmd test -- --run` | PASS465/1 skipped across39 files. |
| TypeScript/lint | `npm.cmd run build`; `npm.cmd run lint` | PASS. |
| Node safety scripts | Explicit eight-script `node --test` command above | PASS52/52. |
| Production dependency audit | `npm.cmd audit --omit=dev` | PASS0 production vulnerabilities; six existing moderate dev-tool findings remain. |
| Real Admin/D1 route semantics | `guided-lead-only.test.ts`, `cod-admin.test.ts`; test SQLite only | PASS: per-order/audit query, active+archived reconciliation counts, intent schema unavailable handling, exact COD consent and Advance proof enforced in state update. No live provider/account/customer data. |
| Reporting side effects | `admin-orders.test.ts`, `guided-lead-only.test.ts` | PASS: report has no DML, no message enqueue, no historical intent creation/backfill, and reconciliation CSV export returns409 before row reads. |
| Migrations and protected source | `0050` SHA check; existing923-entry Label Printer hash manifest | PASS local: `0050` unchanged;923 identical,0 changed,0 missing; no migration apply. |
| Live data/release | No authenticated browser/Admin connector available in this execution | NOT REFRESHED: no current historical row decisions/denominators claimed; WhatsApp remains NO-GO. |

PENDING-001 local implementation/test acceptance is complete; S2's operational exit remains partial until an authorized read-only live Admin refresh and evidence-backed A-G review. Do not use these overlapping local counts as customer conversion or bank settlement metrics. LAUNCH-001 preflight is in progress but blocked on live access.

## LAUNCH-001-PREFLIGHT closeout (2026-11-27)

| Gate | Actual command/evidence | Result |
|---|---|---|
| Focused release/FEP/intent/payment/fulfillment/auth/migration suite | Fourteen synthetic Vitest files covering `free-messaging`, `order-intent`, `service-window`, guided API, payment/TID/COD, fulfillment, orders, Hono security, migration compatibility and UI. | PASS263/1 skipped. |
| Focused FEP/intent subset | `npm.cmd test -- --run tests/free-messaging.test.ts tests/order-intent.test.ts tests/guided-lead-only.test.ts tests/service-window.test.ts` | PASS136/1 skipped across4 files. |
| Full regression | `npm.cmd test -- --run` | PASS465/1 skipped across39 files. |
| Node, TypeScript, build and lint | Documented eight-script `node --test`; `npm.cmd run build`; `npm.cmd run lint` | PASS52/52, PASS, PASS. |
| Dependency audits | `npm.cmd audit`; `npm.cmd audit --omit=dev` | Full audit retains six registered moderate dev-tool advisories; production-only audit0. No unrelated upgrade. |
| Worker dry-run manifest | Wrangler4.149.0 `deploy --dry-run --outdir` using the checked-in API/Admin configs | PASS local only; bundles are staging-targeted, never uploaded. API 1,279,447 bytes, SHA-256 `8c86c9734b08bf2a0e5d7b9869234ff181fbdb99533572b4b59ed3109a16242b`; Admin 1,386,988 bytes, SHA-256 `0cfdaa382a98fdbbbcc6bc7a04d7e7a3ad8e1bd0832c84864ecc79041cee45a2`. |
| Migration integrity/protection | SHA check of `0050`; current D1 marker/duplicate SELECT; existing923-entry Label Printer manifest | PASS subset: `0050` unchanged;923 identical,0 changed,0 missing; current D1 marker ends0048, Wrangler ledger empty,0049 conflict groups0, no0049-0051 applied. |
| Live Admin/identity/release state | Chrome DevTools MCP `list_pages`; Admin/Cloudflare/Meta UI; authenticated D1 metadata SELECT | PARTIAL: Cloudflare account and Meta business/Page/WABA/ad assets match; visible Meta user principal is not matched to owner-reported profile. Aggregate counts and current Worker settings read. Row-level order reconciliation, individual FEP, complete migration tracker, separate backup export and COD-safe rollback target remain open. No API bypass or app-data mutation. |
| D1 forward-only preflight | Authenticated Cloudflare D1 Console, SELECT only | PASS subset: custom marker last0048; Wrangler ledger empty; 0049/0050/0051 absent; combined normal/historical MO duplicate-group count0. One Time Travel bookmark captured; no restore/export/migration. |
| Rollback source test | `GFS_LEGACY_ROOT=...; npm.cmd run test:rollback:v1` on exact clean V1 worktree | PASS4/4 synthetic, temp legacy checkout at `cf01f444500415b1f22a64730674caca1c286006`. V1 still cannot render COD-specific totals; COD-compatible intake-off rollback target unresolved. |

Local/source baseline `90cb57d9e13e87d6778f028e7f1fbbf4ba4ec93e` and remote branch matched. Active Cloudflare Workers use staging-named resources in the Production environment; new source commit90cb is not deployed. No Worker, migration, Meta, order, payment or messaging change occurred; the existing D1 Time Travel bookmark was retrieved read-only. LAUNCH-001 is **PARTIAL/NO-GO**, A06/A10 remain partial, PENDING row-level acceptance is partial, and WhatsApp remains NO-GO. See [LAUNCH-001 preflight](GFS_ORDERFLOW_LAUNCH_001_PREFLIGHT.md) and [MCP recovery](GFS_ORDERFLOW_MCP_RECOVERY_001.md).

## Required staged acceptance

Rows below S2-S9 are **not yet accepted in full for REV.2**. INT01-21/S1 acceptance evidence is recorded above. Existing related tests are reusable, not proof of remaining stages. Per stage: baseline -> focused failing reproduction -> minimal change -> focused/full regression -> repair/retest -> document -> scoped commit. Use synthetic real SQLite for transaction semantics, fake clocks and mocked providers.

| IDs/stage | Required cases | Reuse |
|---|---|---|
| INT01-04/S1 | Successful actionable presentation starts one fixed timer; failed/unknown presentation; incomplete details no start; English/Urdu totals/options | guided-lead-only.test.ts; conversation acknowledgement |
| INT05-08/S1 | +10/+25 once; no24/48h reminders; delayed/stale job suppression; +30 dispatch exclusion | recovery/V2 tests and ledgers |
| INT09-12/S1 | Method switches preserve deadline; selection unresolved; explicitCOD gross/no-advance copy; cancel/restart | payment-flow/COD tests |
| INT13-18/S1 | TimelyreceiptORstandaloneTID protects review; evidence upload race; expiry/COD/approval concurrency; late reconciliation; duplicate webhook/retry | guided/COD SQLite harnesses |
| INT19-21/S1 | Expiry/cancellation release only the matching household cooldown lock; no physical stock claim/dependency; no historic-order mutation | PASS local; no inventory/stock/warehouse schema or service |
| HIST01-06/S2 | DisjointA-G with evidence/precedence; F/conflict protection; only eligibleA/B; C review; D one authorized sequence; E excluded/no bulk rewrite | cod-admin history tests |
| HIST07-08/S2 | Event-denominated abandonment/confirmation; verifiedRTO/failure rates or UNKNOWN | outcome history absent |
| PAY01-05/S3 | All advance methods; textual TID/leading zeros; provider scope; authorized duplicate warning/conflicting order; rejection audit | payment-reference.test.ts; migrations0027/0029; TID synthetic Admin tests |
| PAY06-10/S3 | Same-order replay; concurrent duplicate/approval; verified funds; exact amounts/receipt; Access/CSRF/HMAC; one-action UI | admin-payment/cod-admin tests |
| PAY11-14/S3 | Later zero-row write rolls back approval/MO; normal/historical cross-ledger race; stalehold/receipt checks; existingMO Received | cod-admin real SQLite transaction adapter |
| FIN01-08/FIN-ATOMIC | Advance stale order/payment races; COD amount-state race; concurrent approval/TID/MO; audit/outbox rollback; same-order replay; protected history | `tests/cod-admin.test.ts` actual Admin routes; migration0049 synthetic preflight/triggers |
| FEP01-05/S4 | Qualifying mobile referral/first response; guided attribution; noad/unknown suppression; no artificialrenewal; duplicate/reordered timestamps | provider/webhook/window tests |
| FEP06-10/S4 |24h boundary; actualshorterFEP; unknownduration; expiry/margin; delayedsend/retry | fake clocks, no168h assumption |
| FEP11-15/S4 | OutsideCSW approvedutility/category/locale/media; no paidfallback; every send guarded; shared-phone monthlyallowance uncertainty | mocked policy/provider |
| FEP16-19/S4 | Actualpricing/category/billable retention; dedupedmetrics; analyticsreconciliation; accepted not free-delivered | mockwebhooks; controlledlive separately gated |
| ALLOC01-07/S5 | VPL/RGL separate months; Karachi rollover; concurrency;collision;replay;9999 exhaustion; historypreserved | order-number patterns, not its namespace |
| ALLOC08-09/S5 | No unresolved/held/incomplete/review allocation; internalreference not booking | shared eligibility predicate |
| AMT01-08/S6 |625gross/550+75VPL/550MO;125 unchanged; tariff integerboundaries/no-solution;RGL noamount;grossexport/history;atomicsettlement | AMOUNT_CONTRACT;cod-admin/quote tests |
| LABEL01-06/S6 | IndividualPDF/image/fields/barcode;privateR2/auth/ownership;no cross-customer/batch/publicURL;prepared/booked distinct;physical/visualprint | admin-fulfillment HTML tests |
| POST01-07/S7 | Authorizedaccess;4-6h capacity/lease/backoff;unknownfailures;mappings;dedupe/reorder;freshness;terminalstop | mocked provider until external gate |
| MSG01-07/S8 | ElevenEN/UR variants;ownlabel utilitymedia;coalesceevents;norepetition;opt-out/blocked;grossCOD/advance no payable;expiry/internaltracking | MESSAGE_SEQUENCE;Queue/outbox |
| ADM01-05/S1-S8 | Existing UI intent/time/expiry/review/COD/ready, TID warnings/approval, verified tracking/label/notification/FEP; no ordinary commission; Total Payable; auth | existing Admin tests + TID-001 |
| SEC01-06/S9 | Hoja/newnumber;Access/API/Queue/DLQ/privateR2;noCAPI;historyIDs/MO;zeroLabelPrinterdiff/dependency;accounts/rollback | sourcediff/freshreadbacks/regression |
| REL01-04/S9 | Source/build/liveparity;approvedstagingvisual/integration;authorizedcontrolledtests;boundedrollback/no failinggate release | NOT RUN; old approvals not reusable |

## Hono and financial security corrections

Verified advisory set: GHSA-h7mg-cq63-vhpq/CVE-2026-126358 (RegExpRouter wildcard middleware), GHSA-4m76-xfj5-7975/CVE-2026-126357 (mount), GHSA-46wx-v44x-9hh2/CVE-2026-126355 (CSRF helper), GHSA-4h7h-rv7c-7m2v/CVE-2026-126356 (form validator), GHSA-3gg2-335m-rxc6/CVE-2026-126359 (CSS helper). Hono is exactly4.13.16 in package/lock; the five no longer appear in audit. Before-fix wildcard bypass failed tests reproduced two200 responses; after-fix security file9/9 pass, full Vitest395/1 skipped, documented Node52/52, TypeScript/lint pass, production dependency audit0. Full audit retains6 moderate development-tool dependency findings via minimatch GHSA-g3hv-75wg-m249; no unrelated upgrades were made under the bounded scope. Exact routes, edge cases, Git/production boundaries and security invariants are in [SEC-HONO report](GFS_ORDERFLOW_SEC_HONO_001.md).

Hono SEC-HONO-001, FIN-ATOMIC-001, INTENT-030, TID-001 and FEP-001 are complete locally. PENDING-001 report/guards pass synthetic acceptance but live row classification remains unrefreshed and S2 remains partial. Actual Admin route tests cover financial/TID/COD dispatch races; migrations0049/0050/0051 remain unapplied. FIN-MO-002 remains a hard prerequisite before postal settlement. LAUNCH-001 preflight is in progress and blocked on supported live read-only evidence; do not deploy from this matrix.

## Open release gates

The last recorded read-only account/sender/Page/WABA/ad-account/aggregate evidence is dated2026-11-25 and was **not refreshed in LAUNCH-001**; current identities/restrictions remain unverified. At that time the display name was `In Review`, two utility templates were `Active - Quality pending`, and no transactional shipment templates were observed. Per-contact FEP origin/response/expiry remains unavailable; do not automate free-only sends until captured and tested. Pakistan Post API/permission and self-issued VPL/RGL acceptance are absent; registered official IDs/direct link/authorized manual status entry were the documented fallback. COD gross export625 while MO handler requires gross rather than principal550; correction planned, no history changed. No tariff or physical PDF verified. Full release rollback parity remains unproven. These gates keep lead launch/release NO-GO.

S0 accepted units8/10=80%,20% remaining; A06 per-contact FEP evidence and A10 release-specific rollback readiness remain partial. Original23 and notification-number crosswalk are resolved/documented. INTENT-030/S1 and TID-001/S3 are complete locally without production migration; PENDING-001 local acceptance is complete but S2 live reconciliation is not. LAUNCH-001 preflight is PARTIAL/BLOCKED; next single owner action is restore the existing authorized Chrome DevTools MCP and call `list_pages` first. FIN-MO-002 is required before postal settlement activation. Skipped, blocked, inspected or unsupported runner results are not PASS.
