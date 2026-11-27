# GFS ORDERFLOW PENDING-001 Closeout

**Local implementation and synthetic acceptance: PASS. Live order reconciliation: NOT REFRESHED. WhatsApp/production launch: NO-GO.**

PENDING-001 adds a read-only, paginated `Order Reconciliation` tab to the existing authenticated Admin Orders view. It defaults to active and archived orders and shows an as-of timestamp, filtered aggregate counts, and per-order payment/COD/sequence/fulfillment dispositions. The report performs no DML, does not enqueue or replay messages, hides CSV export on the reconciliation tab and rejects its export route, and never writes customer row data to source/tests/docs.

## LAUNCH-001 live aggregate follow-up (2026-11-27)

The existing authenticated Admin and its active D1 binding were read without loading row details into this report. D1 has **2,213 total orders** (**2,212 active,1 archived**). State aggregates: `DETAILS_COMPLETED`752, `PAYMENT_PENDING`199 (198 active,1 archived), `PAYMENT_REVIEW`59, `PAYMENT_REJECTED`5, `PAID`1, `PACKING`4, `DISPATCHED`1 and `COD_PENDING`1,192. COD sidecars total1,196 (1,192 pending,3 packing,1 dispatched); all1,196 have the customer-origin exact-quote audit and0 are unconfirmed. No order is converted/updated.

Two payment-status-PAID/APPROVED records have exact expected/approved/order totals and stored receipts, but their legacy `PAYMENT_APPROVED` audit metadata contains only the existing order/event keys, with no settlement-evidence reference or TID hash. One is already in `PACKING`. Under the new PENDING guard these are **2 payment-state conflicts**, with **1 fulfillment conflict**; the strict `PAID_RECORDED` predicate matches0. This does **not** assert that no bank funds were received. Preserve both states/receipts, block further dispatch, and require an authorized operator to reconcile actual bank credit before any future guard rollout. No IDs, names, phone numbers, TIDs or receipts are stored here.

Admin/Analytics also showed submitted orders364 in the UTC 7-day window and2,000 in 30 days; the exact rolling24-hour total is unavailable from the date-only Admin filter (last full UTC date62; current UTC date-to-date7). Other existing filter counts: `COD_PENDING`1,196, `PAYMENT_REVIEW`59, active Admin payment-pending filter950, approved-payment candidates2, `COD_PAID`0, instruction `NOT_SENT`0, and cancelled0. Counts are overlapping, with the old Admin filtering active by default; use D1 all-record state counts above for total/historical splits. Analytics lifecycle snapshots show `ADVANCE_PENDING`42/214 and `COD_CONFIRMED`190/1,095 over7/30 days; they are not proof of per-order funds or consent.

This reads from the active Cloudflare `Production` environment of staging-named Workers/D1; owner confirmation that the staging-named data binding is the canonical production dataset remains required. The deployed Admin is still the old four-tab UI with no Reconciliation view, and no historical-intent sequence is created. The per-contact, paid-evidence and dispatch-conflict rows cannot be closed solely from aggregate counts.

## Classification

The primary order/payment classifications are exclusive per row; sequence and fulfillment are separate axes:

| Admin classification | Evidence rule | Safety meaning |
|---|---|---|
| `PAID_RECORDED` | Exact expected, approved and order amounts plus persisted `PAYMENT_APPROVED` audit containing the settlement-evidence reference and TID hash; historical MO requires exact persisted receipt/settlement amount. | Database approval evidence only; it is not a fresh bank read. |
| `CONFIRMED_COD` | Customer-origin `COD_ORDER_CONFIRMED` or existing explicit interactive fallback audit, with the immutable quote matched to COD sidecar. | A COD selection or `COD_PENDING` state alone is not confirmation or payment. |
| `PAYMENT_REVIEW` | Review state, receipt, or TID evidence without the complete recorded approval evidence. | Not dispatchable. Late evidence remains review; it does not automatically settle. |
| `UNRESOLVED` | Active pending order with no payment/COD/review evidence. | No inferred abandonment, cancellation, conversion, or historical outreach. |
| `COD_CONFIRMATION_UNVERIFIED` | COD sidecar without the exact customer confirmation evidence. | Blocks fulfillment and never converts Advance; an already-presented, unresolved `COD_CONFIRM_PENDING` INTENT-030 may continue only through its guarded individual reminder sequence. |
| `EXPIRED` / `CANCELLED` | Existing terminal state. | Excluded from new customer messaging/fulfillment actions. |
| `PAYMENT_STATE_CONFLICT` / `FULFILLMENT_CONFLICT` | Paid/fulfillment state disagrees with the required financial or explicit-consent evidence. | Blocked for manual reconciliation; no automatic repair or rollback. |
| `OTHER` | State is outside the evidence classes above. | No inferred eligibility. |

An active sequence disposition requires an existing, successfully presented, unexpired INTENT-030 row and a valid WhatsApp identity. It is labeled **guarded**, not send-eligible: the regular sender still rechecks opt-out, recipient, CSW/FEP, service allowance, exact pricing, locale/template and expiry before each individual T+10/T+25 reminder. At T+30 the existing worker first commits conditional expiry, then separately queues the localized expiry notice; delivery remains subject to the same free-only guard and may be suppressed. The reconciliation view cannot initiate or replay any stage. Missing/invalid recipient, expired intent without its already-committed boundary notice, missing intent, or absent intent schema is never backfilled.

Aggregate counts are overlapping evidence dimensions, not a partition, unique-customer count, conversion denominator, or replacement for the final live A-G review. `PAID_RECORDED` is not a current bank-account verification. No rates or conversions are claimed.

## Fulfillment Protection

- Advance transition to packing/dispatch requires order payment status PAID, payment review APPROVED, exact expected/approved values equal to Total Payable, an approved timestamp, stored receipt, and matching Admin `PAYMENT_APPROVED` audit with nonempty settlement-evidence reference and TID hash. The SQL state update repeats these predicates atomically.
- COD transition to fulfillment requires a customer-origin confirmation audit matching the immutable COD quote. The read-only projection, precheck and state update share the same exact audit match. Missing proof returns a conflict and leaves state unchanged.
- No stock allocation, postal claim, shipment event, automatic COD conversion, COD payment settlement, cancellation, new order, reminder, message, or historical state repair was added.

## Live Data Boundary

The 2026-11-27 MCP recovery provided current Admin aggregate counts and authenticated D1-console aggregate status/evidence counts; details are in `GFS_ORDERFLOW_MCP_RECOVERY_001.md`. No row IDs, names, addresses, TIDs, receipts, WAMIDs or individual records were copied into this report. The 2026-11-25 cohort totals remain historical. Per-contact FEP/referral/expiry/pricing is still unknown; the visible Meta user principal was not matched to the owner-reported profile, while account/business assets matched. Existing Orders UI fields are insufficient for individual A-G/dispatch acceptance.

No migrations `0049`, `0050`, or `0051` were applied. No deployment, live message, campaign, payment, COD/order transition, traffic/routing, billing/template/account or parcel change occurred. The existing D1 Time Travel bookmark was retrieved read-only; no D1 row/schema change or full export backup was made. The protected Label Printer set remains923/923 unchanged and is not a commit target.

## Local Verification

The final local results are: **218 passed/1 skipped** in the eight-file PENDING/Admin/fulfillment focus; **136 passed/1 skipped** in the four-file FEP/intent/service-window focus; and **465 passed/1 skipped** across **39 files** in the full Vitest suite. Documented Node safety suites: **52/52**. TypeScript build and lint pass. `npm audit --omit=dev` reports **0** production findings; the full audit retains the six previously registered moderate development-tool findings and no unrelated dependency upgrade was made.

The PENDING/Admin integration tests use synthetic SQLite/D1 fixtures and assert the active+archived query, exact COD audit match, strict Advance evidence, missing-migration degradation, no message enqueue, and no DML from the report. `migrations/0050_order_confirmation_intents.sql` remains unchanged at SHA-256 `d3aad32271a7988fd44d34fc36e03486c68d4551237dc68c696bb3bafba4e5b4`; no migration was applied. The protected Label Printer set was rehashed: **923 identical, 0 changed, 0 missing**. Whitespace/diff validation is recorded before the authorized commit. See [TEST_MATRIX](TEST_MATRIX.md) for the complete evidence matrix.

PENDING-001 local source/synthetic acceptance is complete; aggregate live status was refreshed. S2 operational exit remains **PARTIAL**: confirmed COD audits match1196/1196, but two legacy PAID/APPROVED records lack the new settlement/TID-hash audit and one is already PACKING; actual bank credit must be independently reconciled before new guard deployment. No state was changed. Final A-G/event denominators and other per-order decisions remain open. LAUNCH-001 preflight remains NO-GO pending the account/user, sender/template, migration, backup, rollback, test-contact and per-contact FEP gates.
