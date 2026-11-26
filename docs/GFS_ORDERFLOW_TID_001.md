# GFS ORDERFLOW TID-001 Closeout

**Status: local acceptance complete; production changes not authorized.** This task adds a simplified, guarded Admin approval action and localized payment confirmation without changing payment methods, pricing, COD fee, CAPI configuration, tracking allocation or dispatch behavior.

## Admin Action And Financial Invariants

- The Admin panel exposes one `Confirm Payment` action. It automatically uses the stored order ID, selected method and exact Total Payable. The operator enters the customer TID as text, preserves leading zeros, supplies the existing non-sensitive receiving-credit evidence reference, and explicitly attests actual funds reached the authorized account.
- A TID or uploaded receipt alone never marks PAID. The approval path still requires a bound receipt, verified method/QR owner and destination, exact persisted expected amount, operator credit evidence, existing Access/CSRF/HMAC controls, a conditional D1 approval→PAID state chain and immutable audit.
- Failed approval after saving the TID leaves the payment REVIEW. Same-order replay is idempotent; no amount/method/order-ID fields are manually resubmitted.
- Same-method normalized duplicates are rejected immediately, the authorized Admin receives the conflicting order ID/number, and the rejection is audited with a one-way reference hash. Existing method-scoped unique DB guard arbitrates concurrent submits.
- A matching reference on another method returns an order/method warning. The operator must verify the receiving provider/account and explicitly acknowledge before approval; no broader uniqueness rule is added. The approval CAS rechecks the cross-method conflict so a concurrent match cannot be silently approved.
- Successful approval sets payment APPROVED and order PAID, terminates pending reminder jobs, and prepares one idempotent locale-snapshotted payment-confirmation outbox job. CAPI was not enabled or modified. No automatic COD conversion or parcel dispatch is added.

## Customer Copy And Direction

**English**

Payment Received

Your advance payment of Rs. [AMOUNT] has been received and verified.

Order Number: [ORDER_ID]

Your order is confirmed. Your tracking details will be shared once available.

**Urdu**

ادائیگی موصول ہو گئی

آپ کی [AMOUNT] روپے کی پیشگی ادائیگی موصول ہو گئی ہے اور اس کی تصدیق کر دی گئی ہے۔

آرڈر نمبر: [ORDER_ID]

آپ کے آرڈر کی تصدیق ہو گئی ہے۔ ٹریکنگ کی تفصیلات دستیاب ہوتے ہی آپ کو بھیج دی جائیں گی۔

`packages/core/src/whatsapp-formatting.ts` uses LRM/LRI/PDI to keep English paragraphs LTR/left-aligned and RLM/RLI/PDI to keep Urdu paragraphs RTL/right-aligned, isolates Latin amounts/IDs/TIDs/phone numbers/URLs within Urdu, and preserves exact logical paragraphs, blank lines and field order. It uses Unicode text controls only, not HTML/CSS. Selected-locale buttons remain textual and stable.

## Free-Only Notification

Payment confirmation outbox delivery rechecks approval, receipt, exact amount, current CSW, locale, opt-out, CTWA/mobile origin, verified FEP expiry and matching free-pricing evidence through the shared guard. Missing/expired evidence permanently suppresses only the notification; it never rolls back APPROVED/PAID state. No paid fallback. The test queue uses synthetic timestamps/referral/pricing evidence; production per-contact FEP evidence remains unavailable and is a release gate.

## Verification

- Focused TID/Admin/bidi suite:101/101 across `admin-payment`, `cod-admin`, `payment-confirmation`, `whatsapp-formatting`, `order-intent` and Meta activation tests. Guided API suite:104 passed/1 skipped.
- Full Vitest:447 passed/1 skipped across38 files. Eight documented Node suites:52/52. TypeScript build and lint pass.
- `npm.cmd audit --omit=dev`:0 production findings. Full `npm.cmd audit` confirms six moderate development-tool findings, unchanged and not upgraded.
- Admin HTML test confirms a single Confirm Payment action with loaded order/method/Total Payable; actual Hono Admin/SQLite tests cover missing/invalid TID, leading zeros, same-order replay, same-provider concurrent duplicates, conflicting-order detail/audit, cross-provider warning/ack, late-TID non-reopen, actual-funds/receipt/method/amount requirements, reminder cancellation, cross-method race protection and approval rollback.
- Synthetic API Queue tests verify exact English/Urdu Payment Received payload through bidi formatting and that unknown free eligibility suppresses the message while PAID remains durable.
- Full S1/INTENT regression and COD/MO/Admin security suites pass.
- Production migrations0049/0050/0051 remain unapplied. `0050` SHA-256 remains `d3aad32271a7988fd44d34fc36e03486c68d4551237dc68c696bb3bafba4e5b4`. No production CAPI/Meta/Cloudflare/routing/payment/customer/message/deployment action occurred.
- Label Printer protection:923/923 baseline SHA-256 hashes unchanged; standalone MO Printing and Hoja Seeds are untouched. Chrome DevTools `list_pages` was called first; no page navigation or mutation occurred.
- Commit/push SHAs and final branch verification are reported in the final response.

## Remaining Gates And Next Work

Stage acceptance: S0 80% audited/20% remaining; S1 INTENT-030 100% local; S2 0%; S3 TID-001 100% local; S4 0% exit accepted (partial local guard work); S5 0%; S6 0%; S7 0%; S8 0%; S9 0%. Two of ten local stage gates are complete; eight remain. WhatsApp launch remains **NO-GO** until S0-A06 per-contact CTWA/FEP/pricing evidence, S0-A10 rollback readiness, sender display-name/template clearance and authorized staging/live-rendering checks pass. FEP-001 is the next task. Preserve PENDING-001, FIN-MO-002 (gross625/VPL550+75/MO principal550), the six development dependency findings, authorized Pakistan Post integration, O01-O23/REV.2, new-number WhatsApp, private tracking/labels and Hoja Seeds isolation.
