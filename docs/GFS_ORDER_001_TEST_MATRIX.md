# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Test Matrix

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

## Required staged acceptance

All below **NOT TESTED for REV.2**. Existing related tests are reusable, not proof of new cases. Per stage: baseline -> focused failing reproduction -> minimal change -> focused/full regression -> repair/retest -> document -> scoped commit. Use synthetic real SQLite for transaction semantics, fake clocks and mocked providers.

| IDs/stage | Required cases | Reuse |
|---|---|---|
| INT01-04/S1 | Successful actionable presentation starts one fixed timer; failed/unknown presentation; incomplete details no start; English/Urdu totals/options | guided-lead-only.test.ts; conversation acknowledgement |
| INT05-08/S1 | +10/+25 once; no24/48h reminders; delayed/stale job suppression; +30 dispatch exclusion | recovery/V2 tests and ledgers |
| INT09-12/S1 | Method switches preserve deadline; selection unresolved; explicitCOD gross/no-advance copy; cancel/restart | payment-flow/COD tests |
| INT13-18/S1 | TimelyreceiptORstandaloneTID protects review; evidence upload race; expiry/COD/approval concurrency; late reconciliation; duplicate webhook/retry | guided/COD SQLite harnesses |
| INT19-21/S1 | Actual stock authority/reservation/release once; no false scarcity; household lock not stock | stock currently missing |
| HIST01-06/S2 | DisjointA-G with evidence/precedence; F/conflict protection; only eligibleA/B; C review; D one authorized sequence; E excluded/no bulk rewrite | cod-admin history tests |
| HIST07-08/S2 | Event-denominated abandonment/confirmation; verifiedRTO/failure rates or UNKNOWN | outcome history absent |
| PAY01-05/S3 | All advance methods; textualTID/leadingzeros; provider scope; authorized duplicate warning/conflicting order; rejection audit | payment-reference.test.ts; migrations0027/0029 |
| PAY06-10/S3 | Same-order replay; concurrent duplicate/approval; verifiedfunds; exact amounts/receipt;Access/CSRF/HMAC | admin-payment/guided tests |
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
| ADM01-05/S1-S8 | ExistingUI intent/time/expiry/review/COD/ready,TIDwarnings,verifiedtracking/label/notification/FEP;noordinarycommission;grossexport;auth | existingAdmin tests |
| SEC01-06/S9 | Hoja/newnumber;Access/API/Queue/DLQ/privateR2;noCAPI;historyIDs/MO;zeroLabelPrinterdiff/dependency;accounts/rollback | sourcediff/freshreadbacks/regression |
| REL01-04/S9 | Source/build/liveparity;approvedstagingvisual/integration;authorizedcontrolledtests;boundedrollback/no failinggate release | NOT RUN; old approvals not reusable |

## Hono and financial security corrections

Verified advisory set: GHSA-h7mg-cq63-vhpq/CVE-2026-126358 (RegExpRouter wildcard middleware), GHSA-4m76-xfj5-7975/CVE-2026-126357 (mount), GHSA-46wx-v44x-9hh2/CVE-2026-126355 (CSRF helper), GHSA-4h7h-rv7c-7m2v/CVE-2026-126356 (form validator), GHSA-3gg2-335m-rxc6/CVE-2026-126359 (CSS helper). Hono is exactly4.13.16 in package/lock; the five no longer appear in audit. Before-fix wildcard bypass failed tests reproduced two200 responses; after-fix security file9/9 pass, full Vitest395/1 skipped, documented Node52/52, TypeScript/lint pass, production dependency audit0. Full audit retains6 moderate development-tool dependency findings via minimatch GHSA-g3hv-75wg-m249; no unrelated upgrades were made under the bounded scope. Exact routes, edge cases, Git/production boundaries and security invariants are in [SEC-HONO report](GFS_ORDERFLOW_SEC_HONO_001.md).

Hono SEC-HONO-001 and financial atomicity FIN-ATOMIC-001 are complete locally. Actual Admin route tests cover financial state races and migration0049 preparation; no production migration was applied. FIN-MO-002 remains a hard prerequisite before postal settlement. Next product task **GFS-ORDERFLOW-INTENT-030**.

## Open release gates

Account identity, sender, Page, WABA, ad account and aggregate pricing are read-only verified. Per-contact FEP origin/response/expiry remains unavailable; do not automate free-only sends until captured and tested. Display name remains In Review; two utility templates Active - Quality pending; no transactional shipment templates. Pakistan Post API/permission and self-issued VPL/RGL acceptance are absent; registered official IDs/direct link/authorized manual status entry are the only present fallback. COD gross export625 while MO handler requires gross rather than principal550; correction planned, no history changed. No tariff or physical PDF verified. Full release rollback parity remains unproven. These gates keep lead launch/release NO-GO.

S0 accepted units8/10=80%,20% remaining; A06 per-contact FEP evidence and A10 release-specific rollback readiness remain partial. Original23 and notification-number crosswalk are resolved/documented. FIN-ATOMIC is complete locally without production migration; next task GFS-ORDERFLOW-INTENT-030. FIN-MO-002 is required before postal settlement activation. Skipped, blocked, inspected or unsupported runner results are not PASS.
