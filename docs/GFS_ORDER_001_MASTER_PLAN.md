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
| S0 | Isolation, fresh audit, original/revised mapping, identities, nine records | O01-O23 mapped. Numeric owner2/5 crosswalk unavailable; exact candidates/proposal documented. Meta account/analytics/templates were last read2026-11-25 and were not refreshed for LAUNCH-001; per-contact FEP evidence remains unknown. GitHub gardenshop author/private noreply identity and write permission were verified for the prior scoped push. Full release-specific rollback remains unproven; S0 stays PARTIAL. |
| S1 | Existing review/selection/recovery/Queue | **INTENT-030 local acceptance complete:** first exact-message delivered/read provider timestamp anchors fixed T0/+10/+25/+30; method switches preserve deadline; explicit COD and cancellation; timely receipt/TID/approval arbitration; stale-job suppression; no24/48h; no unconfirmed dispatch; no stock dependency. Suppress legacy schedules for new-version orders. |
| S2 | Read-only A-G report and shared dispatch guard | PENDING-001 local report/guard implementation and synthetic tests pass. Live row-level evidence, final A-G reconciliation and event denominators remain unrefreshed; no bulk writes/messages. Do not claim exit acceptance until supported Admin evidence is reviewed. |
| S3 | Existing secure Admin reference/approval | **TID-001 local acceptance complete:** one TID→Confirm Payment action; operator verifies actual received funds and settlement evidence; exact amount, receipt, QR/method provenance, Access/CSRF/HMAC, atomic PAID transition, hashed audit, same-method uniqueness and cross-method warning/ack are tested. Leading zeros/text preserved; TID alone is not proof. |
| S4 | Existing inbound/provider/window/outbox | **Partial local guard/evidence writer:** the one qualifying mobile-CTWA opening response can be free before FEP expiry/pricing exists, when signed referral/platform and opening policy are verified. Later FEP requires matched provider referral-conversion pricing, origin and actual expiry status. API/Admin sends/retries check CSW, locale, message form, template approval, opt-out and free billing; unknown fails closed. Evidence is minimized in existing conversation state, with no duplicate FEP table or paid fallback. Live per-contact evidence, monthly service allowance and metrics remain; no activation. |
| S5 | Existing atomic D1 allocation pattern | Separate VPL/RGL prefix/month sequences1-9999; Karachi rollover; concurrency/collision/replay/exhaustion. Postal registration blocked; internal reference not advertised as official booking. |
| S6 | Native private HTML renderer/R2 pipeline | Individual PDF/image, barcode/all fields, ownership/privacy; VPL principal+commission, RGL no amount; gross unchanged. Verified tariff/settlement design required. |
| S7 | Existing Cron/Queue/D1 | Authorized API or written permission;4-6h configurable lease/capacity/backoff, verified deduped events and terminal stop. Website automation currently prohibited. |
| S8 | Existing outbox/provider | Eleven EN/UR categories, combined events, own label, significant fresh status only, final FEP guard and suppression after expiry. Depends on S4/S6/S7. |
| S9 | Integration/staging/release | Full synthetic/fake-clock/provider regressions, private visual checks, separately authorized controlled tests, writer/accounts/rollback/scoped migration/canary authorization. No production action from this plan alone. |

Prioritize S1-S4 after S0 closes. Postal blockers need not prevent a later proven-safe manual-dispatch release, but that safety/authorization is not established now and S0 is not waived.

## Current local security/product gate progress (2026-11-27)

Hono SEC-HONO-001 and Admin financial atomicity FIN-ATOMIC-001 remain locally tested and undeployed. INTENT-030 (S1), TID-001 (S3) and FEP-001 local acceptance are complete. PENDING-001 adds the read-only all-history Admin reconciliation view and exact payment/COD fulfillment predicates; its local synthetic acceptance is complete, but live row-level classification is not refreshed. The first verified mobile-CTWA response has a separate free-opening path; later FEP requires matched provider pricing/origin/exact expiration status. No 168-hour assumption, raw click ID or duplicate FEP table. TID approval preserves receipt/amount/method/credit evidence and queues locale-pinned Payment Received through the same free-only guard. `packages/core/src/whatsapp-formatting.ts` applies LTR/RTL paragraph isolation and LTR token isolation while preserving paragraph order. `0050` is unchanged; `0049/0050/0051` are only locally sequence-tested and unapplied remotely. Live per-contact/mobile-platform/pricing proof, S0-A06, S0-A10, S2 live A-G reconciliation and S4 metrics/template evidence remain release gates. No physical stock work is needed. Preserve O01-O23, six dev-tool findings and Pakistan Post restrictions. No production change is authorized. FIN-MO-002 remains required before S5/S6 postal settlement activation.
Hono SEC-HONO-001 and Admin financial atomicity FIN-ATOMIC-001 remain locally tested and undeployed. INTENT-030 (S1), TID-001 (S3), FEP-001 and PENDING-001 local acceptance are complete. LAUNCH-001 preflight is **PARTIAL/BLOCKED** because the authenticated Chrome DevTools MCP is not exposed; no live current/historical row decisions, identities, runtime deployment IDs, migration history, billing/template status, D1 backup or rollback target are verified. Local Wrangler dry-runs produced only staging bundles. The first verified mobile-CTWA response has a separate free-opening path; later FEP requires matched provider pricing/origin/exact expiration status. No 168-hour assumption, raw click ID or duplicate FEP table. `0050` is unchanged; `0049/0050/0051` are only locally sequence-tested and unapplied remotely. A06, A10, S2 live reconciliation and S4 live FEP/metrics remain release gates. Preserve O01-O23, six dev-tool findings, physical stock nondependency and Pakistan Post restrictions. No production change is authorized. FIN-MO-002 remains required before S5/S6 postal settlement activation.

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
| 5 History A-G/recovery/rates | CURRENT_AUDIT reconciliation; Admin PENDING-001 view; HIST tests | Local individual classifications/count query and dispatch guards pass; live historic/current row classifications, final A-G report and event rates remain blocked |
| 6 FEP/referral/pricing/guard/metrics | FREE_WINDOW_POLICY; fresh WABA insight/template evidence; FEP tests | PARTIAL: local fail-closed guard/test complete; per-contact evidence source/reconciliation/metrics remain |
| 7 TID/duplicates/approval/security/no CAPI | Admin TID approval; COD-ADMIN/TID tests; TID-001 report | VERIFIED local one-action guarded approval, same-provider duplicate rejection, cross-method warning/ack and no CAPI enablement |
| 8 Tracking format/month/concurrency/postal proof | TRACKING_CONTRACT; ALLOC tests | MISSING allocator; registration BLOCKED |
| 9 Gross/principal/commission/MO/history | AMOUNT_CONTRACT; AMT tests | PARTIAL gross preserved; split/settlement missing |
| 10 Private native PDF/image/barcode | Admin97-135,2485-2501; LABEL tests | PARTIAL HTML exists; generated media missing |
| 11 Postal access/status/history/dedupe | TRACKING_CONTRACT; POST tests | BLOCKED external method; sync missing |
| 12 Eleven updates/templates/opt-out/expiry | MESSAGE_SEQUENCE/FREE_WINDOW_POLICY; MSG tests | PARTIAL local direction-aware formatter/guard; approved template routing and live FEP evidence remain blocked |
| 13 Minimal Admin/time/review/TID/tracking/label/FEP/Total Payable export | Existing Admin; ADM tests; TID-001 | VERIFIED local one-action TID approval; other Admin capabilities remain partial |
| 14 Permanent docs/rules/README | GFS ORDERFLOW records/rules and INTENT/TID/FEP/PENDING closeouts | Local source/test decisions and permanent records updated; live row evidence and release remain open |
| 15 Stages/S0 first/dependencies | Stage table/TASK_REGISTER | PARTIAL S0 with explicit A06/A10 holds; S1 local INTENT complete |
| 16 Baseline/test/repair/protection/commit | TEST_MATRIX, SQLite/Hono/TID/PENDING tests and advisories | INTENT/TID/FEP/PENDING local suites; 923 Label Printer hashes match; production deployment not authorized |
| 17 Pulses/identity/scoped push/rollback | rules/HANDOVER/current GitHub and rollout evidence | GitHub source/remote verified; active Cloudflare/Meta identities and runtime readback unavailable; no force push; full release rollback remains unproven |
| 18 Final report/evidence/percentages/next | HANDOVER/TASK_REGISTER and INTENT/TID/FEP/PENDING/LAUNCH reports | PENDING local PASS; LAUNCH preflight PARTIAL/BLOCKED; live rows not refreshed; WhatsApp NO-GO |

## Minimal source boundaries

Proposed edits stay in `apps/api/src/index.ts`, existing recovery modules, `packages/core/src/provider.ts`, `webhook.ts`, payment-reference/payment-flow and narrowly shared intent/eligibility helpers. Admin uses existing Access/CSRF/HMAC in `apps/admin/src/index.ts`. New migrations must be additive/isolated after fresh schema inspection; no future filename/number is reserved here. Tests use existing synthetic SQLite harnesses under `tests/`, never production customer fixtures.

Financial static risks in CURRENT_AUDIT need endpoint-level reproduction/repair in the next financial atomicity task. CAPI configuration remains untouched; unrelated CAPI redispatch is not part of this work. Hono4.13.16 correction and regressions are complete; unrelated dev-tool findings remain deferred by scope. No deployment was authorized.

## Rollback/release

S0 is documentation-only: rollback its exact selective additions, preserving inherited edits; never reset/clean. Runtime rollback requires fresh full deployment UUIDs/config/bindings, exact source/build parity, scoped migration backup/compatibility, independent bounded recovery and owner release authorization. Additive schema may remain after Worker rollback only when proven compatible; never drop financial history/receipts or replay the legacy chain. Recheck Cloudflare/Meta/GitHub identity before mutation/push, review intended diff and exclude protected Label Printer paths. Markers/API acceptance alone are not a safety PASS.
