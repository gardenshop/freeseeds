# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Current Audit

## Local INTENT-030 follow-up (2026-11-26)

This section adds local source/test evidence after the 2026-11-25 read-only audit; it does not refresh external identity, routing, Meta, D1, customer or payment state. INTENT-030 local acceptance covers exact-message provider-time T0, immutable locale, dynamic T+10/T+25 countdown/buttons, conditional T+30 internal expiry, receipt/TID/approval/COD/cancel races, legacy schedule isolation, duplicate/retry suppression, and matching cooldown-lock release. The reusable free-only guard is integrated across API/Admin automatic sends/retries; unknown service-window, mobile-CTWA, account-verified FEP-expiry, pricing, template, locale or opt-out state fails closed. Synthetic SQLite/fake-clock tests validate these rules. Full Vitest436 passed/1 skipped; documented Node suites52/52; build/TypeScript/lint pass; production dependency audit0. Migrations0049/0050/0051 were tested in order only in local SQLite; no remote apply. Physical stock management is not required; locks are cooldowns, not stock reservations. S0-A06 live evidence and A10 rollback readiness remain release gates. No live message, payment/order write, migration, deployment or external mutation occurred. New-number WhatsApp and Hoja Seeds boundaries remain unchanged.

## Local TID-001 follow-up (2026-11-26)

This section records only local source/test evidence and does not revise the 2026-11-25 Meta/Cloudflare audit. Admin now has one text-TID→Confirm Payment interaction that retains Access/CSRF/HMAC, receipt, QR/method ownership, exact amount, actual-credit evidence, D1 CAS and immutable hashed audit. Same-method duplicates return the conflicting order and reject; cross-method references warn and require explicit operator acknowledgement. Leading zeros and same-order replay are preserved. Successful PAID approval cancels pending reminder jobs and queues an immutable-locale Payment Received notice. The API sends it only through the shared bidi formatter and free-only guard; unknown per-contact FEP/pricing is suppressed without undoing PAID. Focused TID suite101/101, guided API104/1 skipped, full Vitest447/1 skipped, Node52/52, TypeScript/lint pass, production audit0; full audit retains six moderate development-tool findings. No CAPI, live message, payment, order, Meta, routing, migration or deployment mutation occurred. Remaining external gates are A06, A10, template/display-name clearance, PENDING-001, FIN-MO-002 before S5/S6, and authorized Pakistan Post integration.

Master reference: **GFS ORDERFLOW**, covering this REV.2 work, S0-S9, historical decisions and future subtasks. Audit refreshed2026-11-25. S0 PARTIAL. No runtime/schema/Meta/Cloudflare/production mutation, customer message, real payment test, push or deployment. VERIFIED means observed in authorized UI/aggregate or executed synthetic test; PARTIAL means only a subset/evidence is established; MISSING means absent in inspected source/schema; BLOCKED means a required external condition is unavailable; NOT TESTED means behavior not executed. Inspection is not a behavior PASS.

## Identity and provenance

| Item | Fresh evidence | Disposition |
|---|---|---|
| Approved checkout | `D:\free seeds\gfs-order-001-rev2`; owner approved this existing checkout during session | VERIFIED |
| Branch / starting HEAD for INTENT-030 closeout | `codex/gfs-order-001-rev2`; `dda2ddec93c22189d89cefa29f133e30a9c467d6` | VERIFIED at task start; working tree preserved |
| Origin | `https://github.com/gardenshop/freeseeds.git` | VERIFIED |
| Remote heads | isolated MO branch `ad956563f2187e6a5c830fbd3a64691192681802`; PR11 branch `5e4aa7530910368465942828bcd495fd0fbf3aab`; lifecycle branch absent | Read-only public ref query |
| Lineage | Isolated MO source, not proven identical to complete PR11/current live API | PARTIAL; do not broadly merge/deploy |
| Initial dirt | Nine tracked files already modified: rules, CHANGELOG, COD_SETTLEMENT_SOP, DECISIONS, FINAL_REPORT, PLAN, RESOURCE_REGISTRY, STATUS, TEST_MATRIX; untracked `.audit-local/` | Preserved, not all authored by S0 |
| Parent checkout | Protected `codex/garden-shop-label-printer-mvp` at `426b76f`; no switch/edit | Protected |
| GitHub writer | Existing authenticated GitHub settings profile: `gardenshop`, verified primary address/private no-reply identity; GCM account matches; non-mutating push dry-run accepted | Commit author identity is verified. Use per-command `git -c user.name=... -c user.email=<verified private no-reply>`; do not change repo/global Git config or print the address. Remote ref still absent until authorized push. |
| Chrome | First `list_pages` timeout; second recovered existing authorized profile | VERIFIED; no config/profile alteration |
| Owner Facebook profile contact | Owner says working profile uses `ayesha.butt55@hotmail.com` | Owner-provided context for future owner-run identity checks; Meta displayed “Saeed Nazim (You)” and did not expose a matching email. Address-to-session match is NOT independently verified. Not a credential/authentication factor. |
| Cloudflare | Visible Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; Admin Access identity matched configured operator | VERIFIED read-only context |
| Live Admin | Active `3e4b7c26`100%, `ce023b54`0%; `bd242216` Ready/uploaded. Rollout history: latest GFS-COD-MO-17 (Nov5 07:25UTC) kept3e4b7c26 at100%. | Fresh read-only current routing/prefix; no approval or mutation |
| Live API | Active `b426ba47`100%, `d683ec45`0%. Latest GFS-479 rollout (Nov4 05:45UTC) retained baseline at100%. | Fresh read-only current routing/prefix |
| Rollback references | Admin historical pre-release candidate `e8c96c96` was100% before GFS-COD-MO-15 canary. API rollout history contains older baseline restores; current `b426ba47` is active. | Full active version UUID/config/build parity and an independently safe release-specific rollback were NOT verified; reverting Admin to e8c96c96 may remove newer MO behavior. Do not select rollback automatically. |
| Operational D1 | `getfreeseeds-staging`, ID `17b7e9f6-e08b-4bff-a756-10de30b49ab1`, matching manifests | VERIFIED; staging name does not authorize writes |
| Meta business | Garden Shop portfolio568026370701542 | VERIFIED in current authorized profile |
| Free Seeds Page | `Free Seeds In Pakistan - www.gardenshop.pk`, ID101192938541236, owned by Garden Shop; Saeed Nazim (You) has full access | VERIFIED, read-only; no Hoja asset touched |
| WhatsApp account | `Get Free Seeds`, WABA2616648355452496, owned by Garden Shop, timezone Asia/Karachi; account/API connection displayed Connected | VERIFIED in current profile |
| Pakistan sender | +923044429933, phoneID1323932417479627, displayed Connected and High quality; display name **In Review** and a page notice says prior display names were not approved | Identity/connection VERIFIED; approved display-name gate NOT VERIFIED |
| Ad account | `creeper seeds`, ID1198439777611633, owned by Garden Shop | VERIFIED read-only; no campaigns activated |
| Meta authenticity | Existing session now opens the exact authorized assets without an authenticity dialog | Current read access VERIFIED; owner-supplied email not matched to browser principal |
| Meta pricing insights | Last90d Aug28-Nov25: FEP68,214; free customer service1,715; category total free69,929; paid0; approximate charges$0; separate overall-delivered summary69,923 | Account aggregate only; approximate and six-message mismatch; not per-user invoice/eligibility |
| Meta pricing latest week | Nov19-Nov25: FEP12,696; free customer service257; category free12,953; paid0; approximate charges$0; overall summary12,944 | Read-only account aggregate; approximate nine-message discrepancy; no individual expiry |
| Meta templates | Exactly two WABA Utility templates: `gfs_payment_reminder_15m` English and `gfs_payment_reminder_30m` Urdu, Active - Quality pending, usage/opens0 in displayed template period | Status/content/locale read-only verified; no COD/label/tracking templates; no release clearance |

No protected Label Printer page, deployment, monitor or database was operated on. Existing unrelated tabs were left alone. Its checksum manifest:923 files identical,0 changed,0 missing at verification. No source/runtime dependency introduced.

## Aggregate methodology

Fixed cohort cutoff **2026-11-25T12:47:00Z** (17:47 PKT). Each window includes `created_at` at/before cutoff and inclusive lower bound minus24h/7d/30d; current stored state was read during the audit, not historical state at creation. Archived orders included. Payment join cardinality matched order totals. Dashboard SELECT-only console in the verified account/D1 was used; no customer rows, identifiers, TID values, receipts or media exported. Conversation/notification cohorts use their own creation dates and are not conversion denominators.

One combined audit-log/consent query exceeded D1 CPU limit and was reset by provider; it supplied **no evidence**, was not retried, and was replaced only by narrower ledger queries (5.90ms reported). Exact consent-level classification remains unverified. A seven-branch schema UNION exceeded compound-SELECT limit; one JSON schema query succeeded instead. No business-record mutation. Do not repeat unbounded/nested audit scans.

## Fresh order counts

| Stored order state | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| Total | 2129 | 56 | 421 | 2078 |
| COD_PENDING | 1149 | 32 | 222 | 1149 |
| DETAILS_COMPLETED | 724 | 19 | 154 | 698 |
| PAYMENT_PENDING | 191 | 4 | 35 | 174 |
| PAYMENT_REVIEW | 54 | 1 | 10 | 50 |
| PAYMENT_REJECTED | 5 | 0 | 0 | 3 |
| PAID | 1 | 0 | 0 | 0 |
| PACKING | 4 | 0 | 0 | 3 |
| DISPATCHED | 1 | 0 | 0 | 1 |
| DELIVERED | 0 | 0 | 0 | 0 |
| COLLECTION_PENDING | 0 | 0 | 0 | 0 |
| CANCELLED / EXPIRED | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Literal PENDING order state | 0 | 0 | 0 | 0 |

| Financial / combination metric | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| Payment PENDING | 969 | 24 | 199 | 922 |
| Payment COD_PENDING | 1153 | 32 | 222 | 1153 |
| Payment PAID / review APPROVED | 2 | 0 | 0 | 0 |
| Payment REJECTED | 5 | 0 | 0 | 3 |
| No method, excluding COD sidecar | 724 | 19 | 154 | 698 |
| Selected advance, not PAID (includes review/rejected) | 250 | 5 | 45 | 227 |
| Evidence-bearing REVIEW | 54 | 1 | 10 | 50 |
| Missing TID, including COD/no-method | 2105 | 56 | 418 | 2056 |
| REVIEW with missing TID | 31 | 1 | 7 | 28 |
| Instruction NOT_SENT, excluding COD | 724 | 19 | 154 | 698 |
| No tracking assignment audit | 2126 | 56 | 421 | 2075 |
| Tracking assigned, no stored dispatch/delivery | 2 | 0 | 0 | 2 |
| Cancelled/expired orders | 0 | 0 | 0 | 0 |

Global normalized duplicate TID groups **0**, within existing method+ASCII-whitespace-stripped, uppercase reference scope. This is not proof for a future account-scoped namespace. TID absence on COD/no-method orders is not a payment defect. Missing prepared PDF/image label count **UNKNOWN**, not0: there is no issuance/availability ledger. A private renderer does not prove generation/storage/delivery.

Exact all-time combinations: COD pending order/sidecar1149, COD packing3, COD dispatched1; paid Advance packing1 and statePAID1; pending Advance Bank12/Easypaisa80/JazzCash99; review Bank3/Easypaisa21/JazzCash30; rejected Easypaisa2/JazzCash3; no-method DETAILS_COMPLETED724.

All-time financial classification aggregates: **1,153 explicit COD confirmations** (existing COD sidecars have customer `COD_ORDER_CONFIRMED` audit); **2 advance payments APPROVED/paid**; **724 no-method**; **245 selected advance PENDING/REVIEW**, plus **5 rejected advance**. Therefore **974 candidate records (724+250)** have neither explicit confirmed COD nor verified paid advance. This is an aggregate cohort, not an individual shipment authorization list. All COD sidecars have a confirmation audit; dispatch eligibility still requires separate checks. No personal reconciliation export was created.

## Separate entity states

| Entity total | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| Orders / payments | 2129 | 56 | 421 | 2078 |
| Conversations | 11671 | 332 | 2389 | 11468 |
| Outbound message records | 70006 | 1911 | 13926 | 68567 |
| Outbox job records | 3166 | 83 | 644 | 3079 |

| Outbound status | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| READ | 63291 | 1665 | 12352 | 62129 |
| DELIVERED | 6469 | 242 | 1556 | 6360 |
| SENT | 199 | 4 | 17 | 50 |
| FAILED | 39 | 0 | 1 | 22 |
| SKIPPED | 8 | 0 | 0 | 6 |

| Outbox status | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| PENDING | 2130 | 56 | 421 | 2079 |
| SENT | 999 | 27 | 223 | 997 |
| DEAD_LETTER | 25 | 0 | 0 | 3 |
| PERMANENT_FAILURE | 12 | 0 | 0 | 0 |

These are heterogeneous job kinds; PENDING does not necessarily mean failed notification, nor SENT/free nor WhatsApp DELIVERED/parcel delivered. Message pricing is separately UNKNOWN/uninstrumented.

| Conversation state | All | 24h | 7d | 30d |
|---|---:|---:|---:|---:|
| OFFER | 3960 | 107 | 862 | 3911 |
| CANCELLED | 1569 | 51 | 313 | 1536 |
| LANGUAGE | 1149 | 52 | 279 | 1121 |
| COD_PENDING | 1146 | 30 | 213 | 1144 |
| PROVINCE | 646 | 22 | 121 | 629 |
| FULL_NAME | 631 | 13 | 93 | 617 |
| FERTILIZER | 570 | 9 | 120 | 561 |
| ADDRESS | 472 | 9 | 89 | 458 |
| PAYMENT_METHOD | 354 | 8 | 71 | 343 |
| COD_CONFIRM | 343 | 11 | 72 | 343 |
| REVIEW | 177 | 7 | 35 | 174 |
| PAYMENT_PENDING | 175 | 3 | 32 | 169 |
| CONTACT | 173 | 5 | 32 | 166 |
| NEARBY | 137 | 3 | 29 | 136 |
| CITY | 67 | 1 | 10 | 66 |
| NEW | 43 | 0 | 8 | 42 |
| PAYMENT_REFERENCE | 34 | 1 | 7 | 33 |
| PAYMENT_REVIEW | 19 | 0 | 3 | 19 |
| COMPLETE | 6 | 0 | 0 | 0 |

Conversation COD_CONFIRM343 is not343 confirmed orders. Conversation CANCELLED1569 is not1569 cancelled orders. Financial REVIEW54 is not conversation PAYMENT_REVIEW19. Shipment evidence is separate.

## Abandonment findings

Observed stopping points: OFFER3960 conversations, COD_CONFIRM343, no-method724 orders, Advance pending191, evidence REVIEW54. No-method share724/2129=34.01%; Advance-pending share191/2129=8.97%. These stock-state proportions are **not longitudinal abandonment rates**. Repeat/interrupted conversations cannot be divided by order cohorts for funnel conversion.

Admin aggregate readback: all2129, active2128, verify54, confirmed2, fulfillment1155, noMethod724, paymentNotSent0, deliveryFailed24, unpaidAfterDelivery242. Admin source1942-1948 defines the last two as **WhatsApp instruction failure/delivered-read while unpaid**, not parcel failure/debt. `payment-not-sent` excludes no-method orders, while raw NOT_SENT includes them;0 versus724 is not contradictory.

Possible causes, not established causation: selection friction at OFFER/COD_CONFIRM, interruptions/instruction failures, receipt/TID incompleteness. Actual affordability, intent, connectivity and pricing/provider cause are **UNKNOWN** without linked events/feedback. Return-to-origin and postal delivery-failure rates **UNKNOWN**: no verified postal event ledger. Actual cohort abandonment/confirmation requires event denominators and privacy-safe linkage.

## Notifications2 and5

The owner's numeric labels cannot be cross-referenced to Free Seeds source, schema, current Admin or inspected decisions. **No mapping is asserted.** The exact candidate systems and replacement decision below close the audit question without leaving an unexplained blocker:

| System | Source/purpose | Schedule/conditions | Fresh evidence |
|---|---|---|---|
| Two-stage no-method candidate | `apps/api/src/payment-choice-recovery.ts:60-145`; re-presents order choices | order-created+15/+210; flag plus valid activation boundary; no method/receipt/COD/opt-out; eligible conversation/open24h | stage15 delivered70/read325/sent17/skipped688; stage210 delivered78/read244/sent30/skipped746/pending2 |
| Five-stage Advance V2 candidate | `apps/api/src/payment-reminders-v2.ts:28-68,112-142,163-211`; advance reminders/grace | order-created+15/+30/+60/+210/+240; final grace offers explicit choices; no automatic expiry | zero V2 schedules; V2 source flags false |
| Live `gfs_payment_reminder_15m` candidate | Meta WABA template list; English Utility; pending amount, choose enabled advance method or upload receipt after payment | Active - Quality pending; usage0/open0; edited Oct28,2026 | Read-only; no send |
| Live `gfs_payment_reminder_30m` candidate | Meta WABA template list; Urdu Utility; pending amount and receipt wording; no COD/cancel option in shown body | Active - Quality pending; usage0/open0; edited Oct28,2026 | Read-only; no send |
| Manual Admin recovery | `apps/admin/src/index.ts:2188-2220`; explicit one-shot | Separate dedupe/window/receipt/opt-out checks | No action performed |

API manifest `apps/api/wrangler.jsonc:9-17`: minuteCron, recovery flagtrue, V2flagsfalse, utility-template-approvedfalse, CAPIfalse. Activation boundary absent in manifest. D1 stage rows are historical outcomes, not current live flags or pricing. Meta shows only two active Utility reminder templates, both Quality pending; no COD confirmation, label or shipment-event template exists in that WABA list.

**Local INTENT-030 replacement:** one versioned workflow supersedes both legacy decision-reminder purposes for new-feature orders: exact provider-time T0, +10/+25, conditional +30 internal expiry; no24/48h reminders or automatic COD conversion. Locale is pinned. Legacy histories remain unchanged. The central free-only guard is integrated and synthetic-tested; outside-CSW templates require verified approval/evidence and are not used as fallback. Do not reinterpret the15m/30m template names or map owner numeric labels without the original owner screen/text. No production activation.

## Reuse and material gaps

| Requirement / extension point | Source evidence | Status |
|---|---|---|
| Bilingual checkout/methods/province rates/explicitCOD | Existing journey and local INTENT-030 localized copy/buttons, immutable locale, explicit COD confirmation | VERIFIED local; release remains gated |
| Fixed30min/+10/+25/expiry/cooldown lock | Migration0050 plus state/locale guard0051; synthetic status, timer, stale-job and exact-lock tests | VERIFIED local; no physical-stock logic |
| Receipt protected review | API receipt association and synthetic receipt/TID-versus-expiry races; approval remains Admin-authorized | VERIFIED local controls; real funds remain manual |
| Secure approval/reference/duplicates | Admin TID-001 single-action path; core/payment-reference.ts; migrations0027/0029; actual route races | VERIFIED local text/leading-zero/idempotency/method-scope/audit/evidence behavior; account funds remain operator-verified |
| Central free-only/FEP/pricing | `core/free-messaging.ts` reusable guard integrated into API/Admin automatic send/retry paths; no authoritative per-contact evidence writer | PARTIAL: missing live evidence fails closed; production gate remains |
| Native label | Admin97-135,2485-2501; private individual A6/4x6 HTML, auth/no-store | PARTIAL generatedPDF/image/barcode/postal issuance absent |
| Tracking/provider history | Admin2464-2482 manual audit assignment; core/order-number.ts allocates unrelated orderIDs | MISSING postal sequences/status events |
| Gross/MO | Admin795-905; migrations0030/0047/0048 | PARTIAL/conflict: normalMO expects gross, not principal |
| Historical preservation | Separate immutableMO ledger, original payments preserved | PARTIAL finalized classifier/dispatch guards absent |
| Event shipment notifications | ExistingCron/Queue/outbox/provider | MISSING provider-event automation/free-only route |

## Synthetic financial/security reproductions

Using Node24 in-memory SQLite and synthetic order/payment/MO IDs only, a source-shaped transaction reproduced:

| Case | Result | Classification |
|---|---|---|
| Payment approval: first payment update changes1; later guarded order update changes0; SQL transaction commits | Payment became APPROVED while order remained PAYMENT_REVIEW | REPRODUCED commit-model hazard. Mirrors Admin2591-2601's post-batch change-count checks; the actual authenticated Admin HTTP route was not invoked. |
| COD MO: synthetic gross625 / principal-bearing payment550; receipt and COD state updates succeed; payment update's expected-amount predicate changes0; batch commits | Receipt persisted and COD sidecar became PAID while payment remained COD_PENDING | REPRODUCED commit-model hazard. Mirrors Admin830-842 partial-write shape; actual Admin endpoint was not invoked. |
| Same HMAC digest inserted in normal and historical MO tables, each with its own unique index | Both rows accepted | REPRODUCED per-ledger namespace gap. Actual concurrent network requests were not raced. |
| Same-method TID differing only by normalized whitespace | Second insert rejected by SQLite uniqueness and audited with conflict order | PASS in actual Admin concurrent save tests; provider method scope retained. |

Application source independently confirmed cross-ledger MO prechecks were outside settlement batch, expected amount was not consistently revalidated before all later writes, and changed-row assertions happened after `DB.batch()`. This initial source-shaped reproduction motivated the actual-route work in `docs/GFS_ORDERFLOW_FIN_ATOMIC_001.md`; the corrected route regressions now cover these cases, and synthetic cross-ledger preflight conflicts are explicitly detected before migration0049. Initial SQLite probes are not the final endpoint evidence.

Other source-level hazards remain outside FIN-ATOMIC and were not changed: recovery claim/outbox crash gap; dormant V2 READ reconciliation vs stage CHECK/completion predicate; payment-part send+DB acknowledgement retry after provider acceptance. Retain these as separate reminder/outbound tasks; no dormant scheduler was enabled.

## FIN-ATOMIC actual-route resolution (2026-11-25)

Implemented locally after the initial source-shaped reproductions. Test evidence uses `tests/cod-admin.test.ts`, invokes the actual Admin app's Hono financial POST routes, and backs them with synthetic Node SQLite D1-compatible transactions/fault hooks:

| Actual route case | Corrected result |
|---|---|
| Advance approval order cancelled between preflight and batch | HTTP409; payment remains REVIEW, order remains CANCELLED, no approval audit |
| COD MO expected amount changed between preflight and batch | HTTP409; no MO receipt, COD sidecar remains COLLECTION_PENDING, payment/order remain COD_PENDING/COLLECTION_PENDING |
| Concurrent payment approvals for same Advance order | One200/one409; one PAID state, one PAYMENT_APPROVED audit, one CAPI Purchase event and one durable outbox job when test CAPI env is enabled |
| Concurrent same-method TID saves to different orders | One200/one409; one reference/audit, no paid/dispatch state change |
| Same reference text in BANK vs EASYPAISA | Save returns warning with conflicting order/method; approval requires explicit operator acknowledgement and actual receiving-account verification; no global TID namespace introduced |
| Concurrent normal vs historical settlement with same MO digest | One200/one409; one ledger receipt, one shared claim and one financial audit |
| Concurrent/replayed exact same-order MO | Idempotent200 response only if saved HMAC, exact amount and final PAID state match; no duplicate audit/outbox |
| Injected approval/MO audit or Purchase-outbox statement failure | HTTP error; SQLite transaction rolls back all prior financial, ledger, audit and event writes |
| Historical delivered/tracking/Advance-receipt/incident guards | Stale or protected state rejected; no MO or PAID write |

Migration candidate `migrations/0049_cod_mo_global_reference_claims.sql` adds a count-only legacy conflict preflight, backfills existing HMACs, enforces one global claim via database triggers, and captures older-Worker inserts to preserve rollback compatibility. Tests verify clean backfill, reapplication, duplicate historical conflict stops without changing either legacy receipt, and normal/historical trigger claims. This migration was applied **only to synthetic test databases**; no production schema marker was written.

`GFS-ORDERFLOW-FIN-ATOMIC-001` closes the two transaction hazards in this audit with actual route tests; the initial generic/source-shaped reproductions remain as history. S0 A06 (per-contact FEP evidence) and A10 (release-specific rollback readiness) remain partial. Postal amount logic is separate `GFS-ORDERFLOW-FIN-MO-002`.

Final validation after the correction: cod-admin actual-route/migration suite50/50; full Vitest34 files410 passed/1 skipped; Node52/52; TypeScript/lint passed; production dependency audit0 vulnerabilities. Cloudflare read-only recheck shows Admin3e4b7c26 100%/ce023b54 0% and APIb426ba47 100%/d683ec45 0%, with no new deployment. Full npm audit still has six moderate dev-tool findings; no unrelated dependency upgrade was performed.

## Hono dependency security

Before this authorized correction, root package range was `^4.7.11` and lock/runtime were **4.13.13**. The task pins Hono4.13.16 in package.json/package-lock.json. Five advisories were verified and are absent from the patched production dependency audit:

| GHSA / CVE | Affected feature and local use | Assessment |
|---|---|---|
| GHSA-h7mg-cq63-vhpq / CVE-2026-126358 | RegExpRouter wildcard middleware skip for certain pattern combinations | Pre-fix synthetic regressions reproduced two advisory patterns (200, middlewareCalls0, protected handler1). Real Admin uses global Access middleware; source-shaped global/parameter edge returned401 pre-fix. No direct production-app bypass proven. Post-fix both vulnerable patterns are denied. |
| GHSA-4m76-xfj5-7975 / CVE-2026-126357 | Hono mount middleware behavior | `app.mount()` not used; no direct vulnerable local route. Patched dependency removes advisory. |
| GHSA-46wx-v44x-9hh2 / CVE-2026-126355 | Hono CSRF helper | Hono `csrf()` not used; project uses existing CSRF controls. Patched dependency removes advisory. |
| GHSA-4h7h-rv7c-7m2v / CVE-2026-126356 | Hono form validator | `validator("form")` not used. Patched dependency removes advisory. |
| GHSA-3gg2-335m-rxc6 / CVE-2026-126359 | Hono CSS helper | Hono CSS helper/import not used. Patched dependency removes advisory. |

The registry lists4.13.22, but4.13.16 is the minimum verified compatible fixed release. It meets the existing Node engine floor and passes project tests. Exact4.13.16 was pinned to minimize unrelated change. Actual route regressions in `tests/hono-security.test.ts` cover encoded line terminators, Access mismatch, financial POST denial, authorized Admin access and API HMAC. Full results: Vitest34 files/395 passed/1 skipped; Node52/52; build/lint pass; `npm audit --omit=dev`0 vulnerabilities.

Full `npm audit --json` still returns6 moderate development-tool findings via `minimatch` GHSA-g3hv-75wg-m249 in the pre-existing `@typescript-eslint` dependency chain. No dev dependency was changed because the task explicitly prohibits unrelated upgrades. This is separate from the now-clean production dependency tree and must remain visible until a separately scoped toolchain task.

## Pakistan Post fallback

Official `https://ep.gov.pk/track.asp` exposes an `ArticleIDz` iframe/result route and `textfieldz` manual input. Candidate customer deep link is `https://ep.gov.pk/emtts/EPTrack_Live.aspx?ArticleIDz=[OFFICIAL_REGISTERED_ID]`. The format/parameter is visible, but whether postal authorities accept internally allocated VPL/RGL numbers without booking/registration is **not verified**. No API/documented automated integration or written permission was found. Official Terms `https://ep.gov.pk/termsofuse.asp` say the site visitor must access information manually by request and not programmatically by macro/other automated means; commercial reuse needs permission.

Current compliant fallback: allocate/use only a postal-office-registered official article number; retain the booking evidence and official ID; manually validate the official result URL; give the customer that direct link; use Free Seeds Admin's guarded manual tracking/status input with audited operator and actual postal evidence. No crawler, scheduled endpoint request, CAPTCHA bypass or invented tracking event. Optional automated polling is blocked but does not block separate safe WhatsApp lifecycle work.

Fresh COD markers0030,0036,0037,0038,0039,0040,0041,0042,0043,0047,0048. Normal/historicalMO ledgers each **0** rows. Markers do not prove exact triggers or authorize migration replay. Never replay the legacy chain on production.

## Historical reconciliation (read-only)

| Class | Candidate evidence | Safe disposition |
|---|---|---|
| A Verified paid | 2 database-approved payments; funds not reverified | Candidates only; not fulfillment authorization |
| B ExplicitCOD | 1153 sidecars:1149pending/3packing/1dispatched; source requires explicit confirmation | Reconcile consent audit, holds/details/shipment first; COD_PENDING is not mere selection |
| C Evidence awaiting verification |54receipt-bearing review,31missingTID | Protect review, no expiry/conversion |
| D Unconfirmed verified-free | No persistedFEP evidence; countUNKNOWN | No sequence authorized/enqueued |
| E Unconfirmed unreachable/expired | Cannot classify from age alone | Exclude pending reconciliation, not bulk cancel |
| F Dispatched/delivered/settled |1storeddispatched/0delivered;MOledgers0 | Preserve/no redispatch; provider resultsUNKNOWN |
| G Conflicts |CountUNKNOWN;2tracking-without-dispatch are review candidates only | Quarantine after evidence review, no financial rewrite |

This is not a fabricated disjoint customer-level A-G partition. Evidence precedence and completeness must be checked before final classification. No customer reconciliation export created.

## Original owner requirement register O01-O23

The owner supplied the verbatim numbered register in the GFS ORDERFLOW instruction on2026-11-25. REV.2 corrections supersede it where specified. Each item is individually mapped; the original-list-missing blocker is closed. Status describes current implementation/evidence, not future intent.

| ID | Owner requirement (concise faithful statement) | Existing evidence / gap | Status |
|---|---|---|---|
| O01 | Audit COD_PENDING, DETAILS_COMPLETED, PENDING and instruction NOT_SENT | Fresh all/24h/7d/30d order states and separate payment/outbox/notification states above; PENDING order state0 | VERIFIED audit; requirement implementation is audit-only |
| O02 | Identify customers with neither confirmedCOD nor paid Advance | Aggregate1,153 explicit COD audit confirmations;2 approved Advance;974 candidate neither-confirmed-nor-paid (724 no-method+250 unpaid/rejected Advance). Not a dispatch list; 4 other COD-payment records separately flagged for reconciliation. | PARTIAL classification; do not bulk act |
| O03 | Investigate pending orders/chat abandonment/potential returns | OFFER3960, COD_CONFIRM343, no-method724, advance pending191; lifetime/state denominators do not establish causal abandonment. Postal events absent; RTO/return rates UNKNOWN. | PARTIAL |
| O04 | Send order-decision reminders within30 minutes | Local exact-message delivery-anchored T0, dynamic +10/+25 prompts, conditional T+30 expiry, locale snapshot and send/retry free-only guard have synthetic coverage. Per-contact live FEP/pricing proof is unavailable; sends fail closed. | VERIFIED local / launch gated |
| O05 | Within30 minutes allow advance pay, explicit COD confirmation, cancel | Local bilingual choices/actions, unchanged deadline on switches, explicit COD gross confirmation, cancellation, review and expiry races have SQLite/fake-clock coverage. No automatic COD conversion/dispatch. | VERIFIED local / no rollout |
| O06 | Safely resolve unclear historical orders and prevent unconfirmed dispatch | Read-only A-G candidate classes and no-bulk-mutation rule. COD requires confirmation/fulfillment guards; historical per-order evidence and conflicts incomplete. | PARTIAL |
| O07 | Audit/revise notifications identified as2 and5 | Exact source-number crosswalk unavailable. Audited +15/+210 no-method recovery; separate Advance V2 five stages; explicit Meta templates and proposed one-system replacement above. No number mapping invented. | AUDIT/PROPOSAL COMPLETE; implementation NOT DONE |
| O08 | Generate COD VPLYYMMXXXX monthly0001-9999 | Manual generic tracking only; no VPL allocator/schema/counter. | MISSING |
| O09 | Generate verified paid-Advance RGLYYMMXXXX monthly0001-9999 | No RGL allocator; paid state alone is not postal eligibility/booking. | MISSING |
| O10 | Individual label after tracking; send customer's own via WhatsApp | Native private Admin individual HTML label exists; generated PDF/image, barcode, issuance ledger and guarded own-label WhatsApp delivery absent. | PARTIAL |
| O11 | Preserve COD customer gross product+fertilizer+delivery+125 | Existing COD quote snapshots use existing base plus Rs125 and retain gross. Sample arithmetic0+250+250+125=625. | VERIFIED existing gross rule; revised settlement application pending |
| O12 | Gross export; VPL principal+commission, MO principal only | Existing exports use gross amount. Normal/historical MO settlement currently requires/stores quoted gross, so principal split550+75 and MO550 are unsupported. | PARTIAL; critical settlement design gap |
| O13 | Advance shipment label has no amount section | Existing generic renderer has no explicit RGL-specific amount contract or generated/postal RGL label. | MISSING revised RGL acceptance |
| O14 | Send COD label with VPL and verified link | No VPL/registered-link issuance/send. Existing manual tracking field is not registration evidence. | MISSING |
| O15 | Send Advance label with RGL and verified link | No RGL/registered-link issuance/send. | MISSING |
| O16 | Inspect `ep.gov.pk/track.asp`, one-click result URL | Official manual tracker and candidate `ArticleIDz` parameter observed; site's current Terms prohibit automated querying and commercial reuse without written permission. It does not prove self-issued format registration. | PARTIAL; registered IDs only, no polling |
| O17 | Send WhatsApp only within verified free eligibility | Reusable centralized fail-closed guard is implemented/tested for service window, mobile CTWA, verified expiry, form/template, opt-out and matching free-pricing proof. Live per-contact evidence remains unavailable; no paid fallback. | PARTIAL / launch gated |
| O18 | Audit paid-order confirmation development | Payment Received copy is now locale-pinned and queued only after verified PAID; shared bidi/free guard suppresses unknown eligibility without reverting financial state. No CAPI change. | VERIFIED local / live free gate |
| O19 | Simplify Admin approval to manual TID then confirm, after funds verified | One Confirm Payment UI action saves/replays textual TID then calls existing approval only with bound receipt, verified method, exact amount, operator-confirmed credit and non-sensitive settlement evidence. | VERIFIED local; actual funds remain human-verified |
| O20 | Save TID; atomically reject same reference across different orders | Same-method normalized unique index and race guard reject/audit with conflicting order; cross-method match warns and requires explicit provider review, retaining existing method scope. | VERIFIED local |
| O21 | Audit existing functionality/reuse | Complete source/schema/UI audit and extension points recorded. | VERIFIED audit |
| O22 | Permanent Markdown task register | `docs/GFS_ORDER_001_TASK_REGISTER.md` exists and is being updated under master reference. | VERIFIED |
| O23 | Step-by-step plan/handover/protected protocols/zero regression | Master plan, test matrix, handover and protections exist; new features not implemented, and one unsupported unfiltered Node test invocation failed while authoritative suites passed. | PARTIAL; no zero-regression claim for REV.2 implementation |

## Additional binding REV.2 additions

| ID | Addition beyond O01-O23 | Current evidence/status |
|---|---|---|
| R01 | T0 starts only after successful complete actionable options presentation | Exact message ID/provider DELIVERED/READ parsing, provider-time ordering for delayed callbacks, duplicate idempotence and missing-callback no-T0 are covered synthetically. Live callback remains unverified. **VERIFIED local / live unknown** |
| R02 | +10/+25 reminders; guarded+30 expiry/release | Delayed countdowns, stale suppression, separate internal expiry and exact matching cooldown-lock release are tested. Physical stock/reservation is not part of this requirement. **VERIFIED local** |
| R03 | Explicit COD confirmation and exact Total Payable due-on-delivery message | COD remains pending until explicit confirmation; exact Total Payable to rider/postman is bilingual. Concurrent confirmation/expiry and cancellation tests prove no unconfirmed dispatch. **VERIFIED local** |
| R04 | No auto COD; receipt/TID protects review; late-money reconciliation | Receipt/TID and payment-approval races, late TID rejection after expiry, and no auto-paid/reopen/dispatch are covered synthetically. Real funds still require Admin evidence. **VERIFIED local controls** |
| R05 | Historical orders not retroactively bulk converted/cancelled/dispatched | Audit-only candidate reconciliation and preservation rules recorded; no mutation. **VERIFIED protocol / NOT TESTED operations** |
| R06 | CTWA FEP up to7d, per-contact evidence/conservative expiry/pricing | General Meta policy verified; actual account aggregate pricing read; per-contact referral/evidence/actual expiry absent. Do not hardcode168h. **PARTIAL / automation BLOCKED** |
| R07 | Utility templates outside CSW only with verified free eligibility | Two active reminder utility templates, quality pending, zero historical sends; no shipment/COD utility templates and no central guard. **PARTIAL / no production routing** |
| R08 | Verified event-driven tracking notifications | No postal event provider/history/dispatch system. **MISSING** |
| R09 | Internal shipment tracking continues after messaging expiry | No shipment poll/event system exists. **MISSING** |
| R10 | No unauthorized postal website automation | Published Terms expressly prohibit programmatic access; no API/written permission identified. Manual registered-ID link/status fallback is the only permissible current direction. **VERIFIED constraint** |
| R11 | No standalone Label Printer dependency | Existing native Free Seeds private HTML renderer; no source/runtime dependency; protected baseline923/923 unchanged. **VERIFIED local boundary** |
| R12 | Preserve methods/province fees/Rs125/MO/history/Access/API/Queue/DLQ/privateR2 | Source and tests preserve existing contracts; no implementation changes this turn. **VERIFIED baseline / future regression required** |
| R13 | Preserve existing CAPI configuration/security | Source configs disabled; no CAPI changes. **VERIFIED local source only** |
| R14 | Production changes separately authorized/gated/rollback ready | No release action; current deploys read-only verified, exact rollback parity/invocation not proven. **VERIFIED no mutation / release BLOCKED** |

All18 specification sections are mapped in MASTER_PLAN; detailed acceptance cases are in TEST_MATRIX. O01-O23 original-source blocker is closed. Account-specific FEP expiration is still unknown and blocks safe automated outside-CSW routing, not the completeness of this read-only audit.
