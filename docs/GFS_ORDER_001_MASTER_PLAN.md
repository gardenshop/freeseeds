# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Master Plan

Permanent project reference **GFS ORDERFLOW** covers GFS-ORDER-001 REV.2, all S0-S9 work, historical decisions and future subtasks. Preserve existing document filenames, branch and task IDs. The owner supplied Facebook profile context `ayesha.butt55@hotmail.com`; record it only as owner-provided contact/account context, not a credential or proof of the visible browser principal. Free Seeds only. S0 PARTIAL, no runtime implementation. Evidence is in CURRENT_AUDIT and execution units in TASK_REGISTER. Reuse existing D1/Cron/Queue/provider/Admin; no parallel services or protected Label Printer dependency. Standalone MO Printing and Hoja Seeds also remain separate.

## Binding design

Keep intent, payment review/approval, conversation, outbound delivery/pricing and shipment states separate. Never infer paid from TID, confirmed COD from selection, dispatched from label, booked from internal reference, free from referral alone, or parcel delivered from WhatsApp DELIVERED.

Intent needs versioned successful presentation evidence, immutable start/deadline, decision state and one-time reminder claims. Schema names remain proposed. Extend an appropriate versioned existing ledger without reinterpreting old stage meanings or running two systems for one order. Define successful presentation and accepted/delivered/unknown response reconciliation before coding T0; provider timeouts cannot manufacture a deadline or duplicate sends.

Receipt/TID, expiry, COD confirmation, approval, stock release and dispatch must arbitrate atomically with authoritative predicates. `DB.batch()` successful zero-row statements do not cause rollback. Use compare-and-set plus database abort/invariant guards and synthetic real SQLite concurrency tests. Timely evidence protects review; approval still needs actual funds and security/receipt provenance. Late money requires reconciliation, never loss or duplicate fulfillment.

Stock/reservation authority is absent. Verify actual campaign inventory first; do not fabricate stock/scarcity or call a household lock a reservation. Add a minimal reservation ledger only if actual stock exists. History is excluded from new expiry unless reconciled and explicitly authorized.

## Stage gates

| Stage | Work/reuse | Exit acceptance/dependencies |
|---|---|---|
| S0 | Isolation, fresh audit, original/revised mapping, identities, nine records | O01-O23 mapped. Numeric owner2/5 crosswalk unavailable; exact candidates/proposal documented. Meta account/analytics/templates verified; per-contact FEP evidence remains unknown. GitHub gardenshop author/private noreply identity and write permission verified. Full release-specific rollback remains unproven; S0 stays PARTIAL. |
| S1 | Existing review/selection/recovery/Queue | Fixed T0/+10/+25/+30 across switches; explicit COD; timely receipt OR TID protection; stale-job suppression; no24/48h; honest stock. Suppress legacy decision schedules atomically for new-version orders. |
| S2 | Read-only A-G report and shared dispatch guard | Evidence-based non-overlap; conflicts/F protected; only finalized A/B eligible after other checks; C review, D one authorized sequence, E excluded. No retroactive bulk writes. Event-based rates with known denominators. |
| S3 | Existing secure Admin reference/approval | Atomic approval and same-method concurrent TID guard corrections are implemented/tested locally in FIN-ATOMIC. Simple TID -> Confirm Payment UX, operator funds verification workflow and complete acceptance remain. Preserve existing provider/method uniqueness scope, leading zeros, receipts, audit and CSRF/HMAC/Access. |
| S4 | Existing inbound/provider/window/outbox | Minimized referral/FEP/pricing persistence; final free-only guard on every send/retry; conservative account expiry, opt-out and approved utility routing/metrics. No activation until separately authorized account tests. |
| S5 | Existing atomic D1 allocation pattern | Separate VPL/RGL prefix/month sequences1-9999; Karachi rollover; concurrency/collision/replay/exhaustion. Postal registration blocked; internal reference not advertised as official booking. |
| S6 | Native private HTML renderer/R2 pipeline | Individual PDF/image, barcode/all fields, ownership/privacy; VPL principal+commission, RGL no amount; gross unchanged. Verified tariff/settlement design required. |
| S7 | Existing Cron/Queue/D1 | Authorized API or written permission;4-6h configurable lease/capacity/backoff, verified deduped events and terminal stop. Website automation currently prohibited. |
| S8 | Existing outbox/provider | Eleven EN/UR categories, combined events, own label, significant fresh status only, final FEP guard and suppression after expiry. Depends on S4/S6/S7. |
| S9 | Integration/staging/release | Full synthetic/fake-clock/provider regressions, private visual checks, separately authorized controlled tests, writer/accounts/rollback/scoped migration/canary authorization. No production action from this plan alone. |

Prioritize S1-S4 after S0 closes. Postal blockers need not prevent a later proven-safe manual-dispatch release, but that safety/authorization is not established now and S0 is not waived.

## Current local security gate progress (2026-11-25)

Hono SEC-HONO-001 and Admin financial atomicity FIN-ATOMIC-001 have local corrections and synthetic actual-route regressions; see their dedicated reports. Neither closes a numbered S0-S9 stage or authorizes production changes. Additive migration0049 remains local/unapplied. Next task is GFS-ORDERFLOW-INTENT-030. Separate FIN-MO-002 gross/principal accounting remains mandatory before S5/S6 postal settlement activation.

## Original owner register map

The owner supplied O01-O23 and their text in the2026-11-25 GFS ORDERFLOW instruction. Each ID, existing evidence and current status is recorded individually in [CURRENT_AUDIT: O01-O23](GFS_ORDER_001_CURRENT_AUDIT.md#original-owner-requirement-register-o01-o23). Summary: O01/O21/O22 mapped and audit artifacts exist; O02/O03/O05/O06/O07/O10-O12/O16-O20/O23 are partial; O04/O08/O09/O13-O15 are missing; no owner notification number is falsely mapped. The original-source-missing blocker is removed.

## Revised requirement map

Each row maps its specified behaviors to contracts/test groups. Current classification is not future acceptance.

| REV.2 Section | Evidence/contract | Current classification |
|---|---|---|
| 1 Objective/scope | CURRENT_AUDIT isolation/native label | PARTIAL: scope verified, lifecycle incomplete |
| 2 Binding/protections | rules; audit identity/rollback; SEC tests | PARTIAL: Meta/writer/rollback gates |
| 3 Audit/status/abandonment/2&5/23 | CURRENT_AUDIT aggregate states and O01-O23 table | PARTIAL: state audit complete; unknown causes/return outcomes; notification labels 2/5 lack source crosswalk, with explicit candidate/replacement |
| 4 Thirty-minute choices/stock/races/restart | MESSAGE_SEQUENCE; INT tests | MISSING revised timer/expiry; explicit COD/review reused |
| 5 History A-G/recovery/rates | CURRENT_AUDIT reconciliation; HIST tests | PARTIAL candidates; final classes/rates blocked |
| 6 FEP/referral/pricing/guard/metrics | FREE_WINDOW_POLICY; fresh WABA insight/template evidence; FEP tests | PARTIAL current account aggregate pricing verified; per-contact referral/expiry evidence and central guard missing |
| 7 TID/duplicates/approval/security/no CAPI | Admin2503-2601; PAY tests | PARTIAL existing secure reference/approval |
| 8 Tracking format/month/concurrency/postal proof | TRACKING_CONTRACT; ALLOC tests | MISSING allocator; registration BLOCKED |
| 9 Gross/principal/commission/MO/history | AMOUNT_CONTRACT; AMT tests | PARTIAL gross preserved; split/settlement missing |
| 10 Private native PDF/image/barcode | Admin97-135,2485-2501; LABEL tests | PARTIAL HTML exists; generated media missing |
| 11 Postal access/status/history/dedupe | TRACKING_CONTRACT; POST tests | BLOCKED external method; sync missing |
| 12 Eleven updates/templates/opt-out/expiry | MESSAGE_SEQUENCE/FREE_WINDOW_POLICY; MSG tests | MISSING automation; account approval blocked |
| 13 Minimal Admin/time/review/TID/tracking/label/FEP/gross export | Existing Admin; ADM tests | PARTIAL existing auth/labels/tracking/review |
| 14 Nine permanent docs/rules/README | Nine GFS_ORDER_001 records/entry points | VERIFIED records, not runtime completion |
| 15 Stages/S0 first/dependencies | Stage table/TASK_REGISTER | PARTIAL S0 with explicit holds |
| 16 Baseline/test/repair/protection/commit | TEST_MATRIX, SQLite/Hono reproductions and exact advisories | Hono4.13.16 correction/regressions passed locally; revised lifecycle acceptance remains NOT TESTED; production deployment not authorized |
| 17 Pulses/identity/scoped push/rollback | rules/HANDOVER/current GitHub and rollout evidence | Verified author/account/write permission; no force push; full release rollback remains unproven |
| 18 Final report/evidence/percentages/next | HANDOVER/TASK_REGISTER | PARTIAL, no invented PASS/GO |

## Minimal source boundaries

Proposed edits stay in `apps/api/src/index.ts`, existing recovery modules, `packages/core/src/provider.ts`, `webhook.ts`, payment-reference/payment-flow and narrowly shared intent/eligibility helpers. Admin uses existing Access/CSRF/HMAC in `apps/admin/src/index.ts`. New migrations must be additive/isolated after fresh schema inspection; no future filename/number is reserved here. Tests use existing synthetic SQLite harnesses under `tests/`, never production customer fixtures.

Financial static risks in CURRENT_AUDIT need endpoint-level reproduction/repair in the next financial atomicity task. CAPI configuration remains untouched; unrelated CAPI redispatch is not part of this work. Hono4.13.16 correction and regressions are complete; unrelated dev-tool findings remain deferred by scope. No deployment was authorized.

## Rollback/release

S0 is documentation-only: rollback its exact selective additions, preserving inherited edits; never reset/clean. Runtime rollback requires fresh full deployment UUIDs/config/bindings, exact source/build parity, scoped migration backup/compatibility, independent bounded recovery and owner release authorization. Additive schema may remain after Worker rollback only when proven compatible; never drop financial history/receipts or replay the legacy chain. Recheck Cloudflare/Meta/GitHub identity before mutation/push, review intended diff and exclude protected Label Printer paths. Markers/API acceptance alone are not a safety PASS.
