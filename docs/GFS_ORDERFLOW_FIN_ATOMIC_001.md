# GFS ORDERFLOW FIN-ATOMIC-001

Date:2026-11-25. Master project **GFS ORDERFLOW**. Checkout `D:\free seeds\gfs-order-001-rev2`, branch `codex/gfs-order-001-rev2`. The correction uses the actual Admin Hono handlers with synthetic data and a local D1-compatible SQLite adapter. No production migration, real payment, customer message, Meta/Cloudflare mutation or deployment.

## Application failures reproduced

The tests are in `tests/cod-admin.test.ts`; they invoke `app.fetch()` through real authenticated Admin routes. The adapter runs `DB.batch()` SQL inside a SQLite transaction and has controlled race/failure hooks. It demonstrates D1 semantics relevant here: a conditional statement changing zero rows is still a successful statement, while a thrown SQL error rolls back the batch.

| HTTP scenario | Before correction | Result after correction |
|---|---|---|
| Advance approval: order changes to CANCELLED after approval preflight but before the batch | Payment update changed1; order update0; HTTP409; payment was APPROVED while order remained CANCELLED | Payment UPDATE now requires the same authoritative order/method/QR/receipt conditions as the following PAID update. Both are winner-gated; test expects payment REVIEW, order CANCELLED, audit0. |
| COD MO: payment expected amount changes after preflight but before the settlement batch | Receipt inserted, COD sidecar PAID; payment expected-amount UPDATE0 and order PAID UPDATE0; HTTP409 | First receipt INSERT rechecks COD/order/payment amount/status/hold in SQL. Subsequent sidecar/payment/order/audit rows require previous `changes()=1`; stale race leaves receipt0, sidecar COLLECTING, payment/order pending. |
| Two Admin approvals concurrently pass REVIEW preflight for one payment | A loser could insert a second PAYMENT_APPROVED audit after the winner had set PAID | Actual route race returns one200/one409; payment/order settle once; one approval audit, one Purchase event, one durable CAPI outbox job. |
| Same TID submitted concurrently to two orders with the same method | Application precheck is outside batch; two route requests race | Existing method+normalized-reference unique index is exercised through the Admin routes; one200/one409 and exactly one saved reference/audit. No namespace change. |
| Same normalized TID under distinct payment methods | Existing provider-specific method scope | Both routes succeed, confirming BANK and EASYPAISA remain separate scopes; no global normalization invented. |
| Normal and historical MO handlers concurrently receive the same synthetic article number | Both application prechecks could pass; separate ledger indexes accepted both receipts | Migration0049 shared HMAC claim/legacy-compatible triggers permit one winner only; other route returns409; one ledger receipt and one settlement audit. |
| Concurrent exact same-order MO replay | Preflight/receipt idempotency race could otherwise report stale | Exact same HMAC/amount after PAID returns idempotent success, without another receipt/audit/event; conflicting MO or amount is rejected. |
| Required approval/MO audit write throws after financial DML | Batch must not persist preceding rows | Synthetic SQL failure on Advance audit, normal MO audit, historical MO audit, and optional Purchase outbox throws; route rejects and the payment/order/ledger/audit/CAPI/outbox rows all roll back. |
| Historical preflight race / protected incident | Historical route did not repeat tracking/receipt/incident predicates in the transactional insert | Receipt INSERT and PAID order update both repeat delivered/unarchived/exact gross/no COD sidecar/no Advance receipt/tracking-assignment and incident-number guards. Tests verify stale order and protected incident cannot settle. |

Other route cases preserve Admin Access/CSRF/HMAC, unauthorized operator denial, incorrect amount rejection, receipts, `MO Received` audit, historical original payment method/review state, repeated same-order replay and CAPI idempotency. TID SQL normalization/provider scope is unchanged.

## Correction

- Advance payment approval's first UPDATE rechecks the authoritative order identity/number, PAYMENT_REVIEW state, archive status, total/expected amount, exact payment method, currently verified QR binding and associated receipt. The PAID order UPDATE requires `changes()=1` from that UPDATE and rechecks the same receipt/QR/method/amount. `PAYMENT_APPROVED` audit requires the order transition to have changed exactly one row. A batch loser cannot commit a partial payment or duplicate approval audit.
- Normal COD MO preflight now selects/checks `payments.expected_amount`. The initial receipt INSERT requires the exact collection-pending order/sidecar, unchanged base/gross snapshot, no test hold, COD_PENDING payment, null prior approval and `expected_amount=base_amount_pkr`. Later sidecar/payment/order/audit statements remain state-conditional and require `changes()=1` from the prior winner.
- Historical COD adds an explicit protected incident rejection. Its receipt INSERT repeats delivered state, exact original gross, archive/payment/receipt/COD-sidecar and tracking-assignment eligibility; its PAID order update repeats those conditions and requires a changed receipt insertion. Replays are idempotent only when stored HMAC, exact amount and paid state match.
- All normal/historical MO unique-key errors and empty guarded claim results fail safely. Same-order same-reference/amount paid retry returns idempotent success; a different article, amount, order or ledger collision never does.
- CAPI settings remain unchanged. When enabled by pre-existing configuration, unique Purchase event/idempotency keys remain in the same D1 batch as PAID/audit. Queue send happens after the durable batch; enqueue failure leaves the one durable PENDING outbox. Injected outbox SQL failure aborts the whole payment batch.

## Migration0049 preparation

New additive file: `migrations/0049_cod_mo_global_reference_claims.sql`. It preserves both existing ledgers and the shared Asia/Karachi order/tracking IDs. It stores only the existing HMAC digest, order ID, NORMAL/HISTORICAL ledger type and claim timestamp. It does not store raw Money Order numbers or alter settlement amounts.

The shared `cod_mo_reference_claims.mo_reference_hmac` primary key enforces uniqueness across the two ledgers. A count-only `cod_mo_reference_migration_preflight` with `CHECK(legacy_duplicate_count=0)` counts duplicate digest groups across the UNION of both existing ledgers; conflict blocks migration. The candidate backfills existing receipts, then adds legacy-compatible AFTER INSERT triggers that claim any normal/historical receipt written by old or new Workers. Immutable-claim triggers prohibit update/delete. The second preflight runs after insert triggers are installed to detect a cross-ledger race during setup. The migration marker is0049 in the COD-specific schema marker table.

Tests prove: clean normal/historical backfill, idempotent reapplication, claim capture from a legacy-style direct ledger INSERT, cross-ledger duplicate rejection, and migration preflight abort/rollback on a synthetic pre-existing duplicate while both original receipt rows remain unchanged. The migration is **not applied to production**.

## Compatibility, preflight and rollback

Before a separately authorized production migration, perform a count-only duplicate-digest preflight; never export HMAC values/rows. Verify the D1 migration runner's transaction behavior, take authorized D1 backup and ensure settlement writes are quiesced through migration completion. Confirm the stored preflight count0, both old receipt counts unchanged, both ledgers fully reconciled, claim row count equals existing receipt union, triggers/unique key present and legacy Worker insert compatibility passes before enabling new code. If any historical duplicate exists, stop for evidence-based per-order reconciliation; no automatic merge or deletion.

Before production application, rollback is simply discard the candidate migration and source commit. Once0049 is applied or a claim written, it is forward-only: rollback the Worker if necessary but **retain the claim table/triggers and every receipt**. Legacy Worker inserts continue to auto-claim. Never drop claims, reuse MO numbers or apply the separate principal accounting change as part of rollback.

## Postal amount separation

This task preserves existing gross behavior and does not implement the future postal principal calculation. Example remains customer grossRs.625, intended VPL label550+75, and actual MO principal550. Current MO handler still expects customer gross; no amount logic, tariff, Rs.125 fee or historical record was changed. **GFS-ORDERFLOW-FIN-MO-002** is a separate required prospective accounting correction before enabling new VPL/RGL settlement. Preserve exact gross, actual remittance, commission evidence and existing MO/history/duplicate guards.

## Verification

Focused actual-route file `npm.cmd test -- tests/cod-admin.test.ts --reporter=dot`: **50/50 passed** with synthetic SQL fault injection and synchronized concurrent requests. Hono focused suite remains **9/9 passed**. Final full regression: **34 Vitest files,410 passed,1 skipped (411 total)**; documented Node controller/capacity suite **52/52 passed**; TypeScript build/lint pass; production dependency audit **0 vulnerabilities**. Full dependency audit retains6 moderate dev-tool findings through minimatch GHSA-g3hv-75wg-m249 in the existing `@typescript-eslint` chain. No unrelated development dependency was changed. Hono4.13.16 remains pinned.

S0 remains8/10=80%; A06 per-contact FEP eligibility/expiry and A10 release-specific rollback readiness remain partial. S0-S9 stage completion percentages do not advance from this task. WhatsApp leads launch remains NO-GO until its Meta/FEP, order intent, release and rollback gates pass. Next local task is **GFS-ORDERFLOW-INTENT-030**. Postal automation and postal principal accounting remain optional for intent development but mandatory before new postal settlement activation.
