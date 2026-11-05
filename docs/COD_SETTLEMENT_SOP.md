# COD Settlement SOP

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
