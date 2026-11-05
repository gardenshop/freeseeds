# COD Settlement SOP

## GFS-COD-MO-21 routing gate (2026-11-05 PKT)

Do not apply migration 0048 while Admin active provisioning or Access health conflicts with the approved baseline. Resolve routing and `/health` evidence through a separately authorized read-only audit before requesting a new migration window.

## GFS-COD-MO-20 release boundary (2026-11-05 PKT)

The original 0048 migration is blocked before remote execution because it omitted its exact-once schema marker. The marker and cross-ledger duplicate protections are repaired and tested locally only; do not settle real orders or release the repaired source until the repaired migration is separately reviewed and targeted execution is authorized.

## Historical Pakistan Post MO

This SOP is source-ready but not released until migration 0048 and the Admin candidate are separately authorized.

1. Match the exact order in authenticated Admin. A phone match alone is insufficient.
2. Confirm the order is unpaid, unarchived, not cancelled or held, has delivered state and assigned tracking, and has no COD sidecar.
3. Preserve the original payment method, quote, Advance receipts and review history. Do not add the PKR125 COD fee to a historical order.
4. Verify the genuine Pakistan Post MO and private company-receipt evidence. Record only HMACs and the operator-entered reason/reference; never store the raw MO number in Git, logs or reports.
5. Submit the guarded historical form with the exact original payable, receipt date, evidence reference, reason and exact order-number confirmation.
6. The atomic path writes one immutable historical ledger row, marks the order PAID, and writes one audit entry. It does not rewrite the payment row or queue CAPI.
7. Stop on missing evidence, amount mismatch, pending Advance receipt, verified Advance payment, duplicate MO, concurrency conflict, or any state/hold mismatch. Do not force PAID or use direct D1 SQL.

Current status: local implementation and tests PASS; migration 0048, candidate upload, deployment and genuine settlement remain pending separate authorization and evidence.
