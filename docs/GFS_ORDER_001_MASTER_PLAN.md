# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Master Plan

Permanent project reference **GFS ORDERFLOW** covers GFS-ORDER-001 REV.2, all S0-S9 work, historical decisions and future subtasks. Preserve existing document filenames, branch and task IDs. The owner-provided Facebook profile context is not an auth factor or proof of browser identity. Free Seeds only. S0 PARTIAL; INTENT-030 local acceptance is complete, but no runtime release. Evidence is in CURRENT_AUDIT and execution units in TASK_REGISTER. Reuse existing D1/Cron/Queue/provider/Admin; no parallel services or protected Label Printer dependency. Standalone MO Printing and Hoja Seeds also remain separate.

## Binding design

Keep intent, payment review/approval, conversation, outbound delivery/pricing and shipment states separate. Never infer paid from TID, confirmed COD from selection, dispatched from label, booked from internal reference, free from referral alone, or parcel delivered from WhatsApp DELIVERED.

Intent needs versioned successful presentation evidence, immutable start/deadline, decision state and one-time reminder claims. Schema names remain proposed. Extend an appropriate versioned existing ledger without reinterpreting old stage meanings or running two systems for one order. Define successful presentation and accepted/delivered/unknown response reconciliation before coding T0; provider timeouts cannot manufacture a deadline or duplicate sends.

Receipt/TID, expiry, COD confirmation, approval and dispatch must arbitrate atomically with authoritative predicates. `DB.batch()` successful zero-row statements do not cause rollback. Use compare-and-set plus database abort/invariant guards and synthetic real SQLite concurrency tests. Timely evidence protects review; approval still needs actual funds and security/receipt provenance. Late money requires reconciliation, never loss or duplicate fulfillment.

Owner decision2026-11-26: the30-minute timer is customer-confirmation policy only. Physical stock management is not required and is not a blocker. Add no stock/inventory tables, counters, warehouse dependencies, scarcity claims or reservation ledger. Existing `order_eligibility_locks` are household cooldown controls, not physical stock reservations. Expiry/cancellation releases only the matching lock.

## Stage gates

| Stage | Work/reuse | Exit acceptance/dependencies |
|---|---|---|
| S0 | Isolation, fresh audit, original/revised mapping, identities, nine records | O01-O23 mapped. Numeric owner2/5 crosswalk unavailable; exact candidates/proposal documented. Meta account/analytics/templates verified; per-contact FEP evidence remains unknown. GitHub gardenshop author/private noreply identity and write permission verified. Full release-specific rollback remains unproven; S0 stays PARTIAL. |
| S1 | Existing review/selection/recovery/Queue | **INTENT-030 local acceptance complete:** first exact-message delivered/read provider timestamp anchors fixed T0/+10/+25/+30; method switches preserve deadline; explicit COD and cancellation; timely receipt/TID/approval arbitration; stale-job suppression; no24/48h; no unconfirmed dispatch; no stock dependency. Suppress legacy schedules for new-version orders. |
| S2 | Read-only A-G report and shared dispatch guard | Evidence-based non-overlap; conflicts/F protected; only finalized A/B eligible after other checks; C review, D one authorized sequence, E excluded. No retroactive bulk writes. Event-based rates with known denominators. |
| S3 | Existing secure Admin reference/approval | Atomic approval and same-method concurrent TID guard corrections are implemented/tested locally in FIN-ATOMIC. Simple TID -> Confirm Payment UX, operator funds verification workflow and complete acceptance remain. Preserve existing provider/method uniqueness scope, leading zeros, receipts, audit and CSRF/HMAC/Access. |
| S4 | Existing inbound/provider/window/outbox | **Partial local guard:** final free-only guard covers API/Admin automatic sends/retries and checks service window, mobile CTWA evidence, verified FEP expiry, message form/category, template approval, opt-out and matching free-pricing evidence; unknown fails closed. No duplicate FEP store/architecture or paid fallback. Per-contact evidence writer/reconciliation/metrics and live policy tests remain; no activation. |
| S5 | Existing atomic D1 allocation pattern | Separate VPL/RGL prefix/month sequences1-9999; Karachi rollover; concurrency/collision/replay/exhaustion. Postal registration blocked; internal reference not advertised as official booking. |
| S6 | Native private HTML renderer/R2 pipeline | Individual PDF/image, barcode/all fields, ownership/privacy; VPL principal+commission, RGL no amount; gross unchanged. Verified tariff/settlement design required. |
| S7 | Existing Cron/Queue/D1 | Authorized API or written permission;4-6h configurable lease/capacity/backoff, verified deduped events and terminal stop. Website automation currently prohibited. |
| S8 | Existing outbox/provider | Eleven EN/UR categories, combined events, own label, significant fresh status only, final FEP guard and suppression after expiry. Depends on S4/S6/S7. |
| S9 | Integration/staging/release | Full synthetic/fake-clock/provider regressions, private visual checks, separately authorized controlled tests, writer/accounts/rollback/scoped migration/canary authorization. No production action from this plan alone. |

Prioritize S1-S4 after S0 closes. Postal blockers need not prevent a later proven-safe manual-dispatch release, but that safety/authorization is not established now and S0 is not waived.

## Current local security/product gate progress (2026-11-26)

Hono SEC-HONO-001 and Admin financial atomicity FIN-ATOMIC-001 remain locally tested and undeployed. INTENT-030's local S1 acceptance is complete: exact provider-time anchoring, immutable locale, delayed remaining-time prompts/buttons, independent internal expiry, review/COD/cancel/payment races, legacy reminder isolation and lock release all have synthetic coverage. The reusable free-only guard is local and fail-closed; no FEP persistence architecture or paid fallback was added. `0050` is unchanged; `0049/0050/0051` are only locally sequence-tested and unapplied remotely. Live per-contact FEP/pricing proof, S0-A06, S0-A10 and S4 evidence/metrics remain release gates. No physical stock work is needed. Preserve O01-O23, six dev-tool findings, and Pakistan Post restrictions. No production change is authorized. FIN-MO-002 remains required before S5/S6 postal settlement activation.

## Original owner register map

The owner supplied O01-O23 and their text in the2026-11-25 GFS ORDERFLOW instruction. Each ID, existing evidence and current status is recorded individually in [CURRENT_AUDIT: O01-O23](GFS_ORDER_001_CURRENT_AUDIT.md#original-owner-requirement-register-o01-o23). INTENT-030's O04/O05 timer/choice behaviors are now locally accepted with no stock-management dependency; O08/O09/O13-O15 and other postal/history requirements remain open as mapped. No owner notification number is falsely mapped. The original-source-missing blocker is removed.

## Revised requirement map

Each row maps its specified behaviors to contracts/test groups. Current classification is not future acceptance.

| REV.2 Section | Evidence/contract | Current classification |
|---|---|---|
| 1 Objective/scope | CURRENT_AUDIT isolation/native label; INTENT-030 report | PARTIAL project scope; INTENT-030 local lifecycle accepted |
| 2 Binding/protections | rules; audit identity/rollback; SEC tests | PARTIAL: Meta/writer/rollback gates |
| 3 Audit/status/abandonment/2&5/23 | CURRENT_AUDIT aggregate states and O01-O23 table | PARTIAL: state audit complete; unknown causes/return outcomes; notification labels 2/5 lack source crosswalk, with explicit candidate/replacement |
| 4 Thirty-minute choices/confirmation races/restart | MESSAGE_SEQUENCE; INT tests | VERIFIED local fixed timer/state arbitration; no stock-management scope |
| 5 History A-G/recovery/rates | CURRENT_AUDIT reconciliation; HIST tests | PARTIAL candidates; final classes/rates blocked |
| 6 FEP/referral/pricing/guard/metrics | FREE_WINDOW_POLICY; fresh WABA insight/template evidence; FEP tests | PARTIAL: local fail-closed guard/test complete; per-contact evidence source/reconciliation/metrics remain |
| 7 TID/duplicates/approval/security/no CAPI | Admin2503-2601; PAY tests | PARTIAL existing secure reference/approval |
| 8 Tracking format/month/concurrency/postal proof | TRACKING_CONTRACT; ALLOC tests | MISSING allocator; registration BLOCKED |
| 9 Gross/principal/commission/MO/history | AMOUNT_CONTRACT; AMT tests | PARTIAL gross preserved; split/settlement missing |
| 10 Private native PDF/image/barcode | Admin97-135,2485-2501; LABEL tests | PARTIAL HTML exists; generated media missing |
| 11 Postal access/status/history/dedupe | TRACKING_CONTRACT; POST tests | BLOCKED external method; sync missing |
| 12 Eleven updates/templates/opt-out/expiry | MESSAGE_SEQUENCE/FREE_WINDOW_POLICY; MSG tests | MISSING automation; account approval blocked |
| 13 Minimal Admin/time/review/TID/tracking/label/FEP/gross export | Existing Admin; ADM tests | PARTIAL existing auth/labels/tracking/review |
| 14 Permanent docs/rules/README | Nine GFS_ORDER_001 records/entry points and INTENT-030 closeout | VERIFIED records and local INTENT acceptance; not production completion |
| 15 Stages/S0 first/dependencies | Stage table/TASK_REGISTER | PARTIAL S0 with explicit A06/A10 holds; S1 local INTENT complete |
| 16 Baseline/test/repair/protection/commit | TEST_MATRIX, SQLite/Hono reproductions and exact advisories | Hono4.13.16 correction/regressions passed locally; revised lifecycle acceptance remains NOT TESTED; production deployment not authorized |
| 17 Pulses/identity/scoped push/rollback | rules/HANDOVER/current GitHub and rollout evidence | Verified author/account/write permission; no force push; full release rollback remains unproven |
| 18 Final report/evidence/percentages/next | HANDOVER/TASK_REGISTER/INTENT-030 report | INTENT-030 local PASS, WhatsApp launch NO-GO |

## Minimal source boundaries

Proposed edits stay in `apps/api/src/index.ts`, existing recovery modules, `packages/core/src/provider.ts`, `webhook.ts`, payment-reference/payment-flow and narrowly shared intent/eligibility helpers. Admin uses existing Access/CSRF/HMAC in `apps/admin/src/index.ts`. New migrations must be additive/isolated after fresh schema inspection; no future filename/number is reserved here. Tests use existing synthetic SQLite harnesses under `tests/`, never production customer fixtures.

Financial static risks in CURRENT_AUDIT need endpoint-level reproduction/repair in the next financial atomicity task. CAPI configuration remains untouched; unrelated CAPI redispatch is not part of this work. Hono4.13.16 correction and regressions are complete; unrelated dev-tool findings remain deferred by scope. No deployment was authorized.

## Rollback/release

S0 is documentation-only: rollback its exact selective additions, preserving inherited edits; never reset/clean. Runtime rollback requires fresh full deployment UUIDs/config/bindings, exact source/build parity, scoped migration backup/compatibility, independent bounded recovery and owner release authorization. Additive schema may remain after Worker rollback only when proven compatible; never drop financial history/receipts or replay the legacy chain. Recheck Cloudflare/Meta/GitHub identity before mutation/push, review intended diff and exclude protected Label Printer paths. Markers/API acceptance alone are not a safety PASS.
