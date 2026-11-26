# GFS-ORDERFLOW-INTENT-030 Closeout

**Status: local acceptance complete; WhatsApp production launch NO-GO.** This closes the local INTENT-030 implementation only. It does not close S0-A06/A10, authorize a live message or deployment, or change the preserved O01-O23/REV.2 register.

## Owner Decisions

- Every customer-facing message/button after language choice uses the immutable `en` or `ur` order locale, including T0/T+10/T+25/T+30, advance payment, COD, status/tracking, and delivery notices. The preselection prompt is a neutral bilingual picker with self-labeled `English` and `اردو` choices.
- The 30-minute timer controls customer confirmation only. Physical stock management is not required and is not a blocker. Add no inventory/stock counters, warehouse dependency, scarcity/availability claim, or reservation ledger.
- Existing `order_eligibility_locks` are household cooldown controls, not physical-stock reservations. Expiry/cancellation releases only the matching order lock.
- Urgency is deadline-based only. Selecting a payment method does not confirm; COD requires explicit confirmation. No automatic COD conversion or dispatch.
- A fail-closed free-only send/retry guard is implemented. Missing or unknown eligibility suppresses; no paid fallback and no assumed 168-hour FEP.

## Timer And State

- T0 is established once by the first valid provider timestamp for `DELIVERED`/`READ` on the exact payment-options message ID. It is not send acceptance, order creation, callback arrival time, or an inferred timestamp. Provider time orders delayed/duplicate receipts; no qualifying webhook means no deadline and no automatic expiry.
- Deadline is fixed at `presented_at + 30 minutes`. Stage timestamps are validated against that same anchor. A method switch never resets it.
- T+10 and T+25 are queued once. Remaining time is computed at delivery time, including seconds, and buttons use the persisted locale. T+10 is suppressed once T+25 is due; either reminder is suppressed at/after its stale boundary or when order/evidence is resolved.
- T+30 internal expiry is committed independently before notification delivery. It applies only to a still-unresolved unpaid order with no submitted receipt/TID/review, payment approval, COD confirmation or cancellation. A suppressed T+30 message does not block expiry or retain the matching cooldown lock.
- Receipt/TID submission under review and approval arbitrate with expiry using conditional D1 state predicates. COD creation competes atomically with expiry/cancellation. A TID is evidence for review, never payment approval. A late TID cannot reopen an expired order or automatically dispatch it; preserve existing Admin verification for reconciliation.
- COD confirmation states the exact gross total payable to the delivery rider or Pakistan Post postman. No advance payment is required after explicit COD confirmation.
- New-version intents suppress both legacy recovery and V2 reminder schedules. Historical orders without an intent are unchanged.

## Customer Copy

**T0 English:** “Confirm your order within 30 minutes through advance payment or Cash on Delivery (COD).”

**T0 Urdu:** “پیشگی ادائیگی یا کیش آن ڈیلیوری (COD) کے ذریعے 30 منٹ کے اندر اپنے آرڈر کی تصدیق کریں۔”

**T+10 English:** “Your order awaits confirmation. Please decide within the remaining [REMAINING_TIME].”

**T+10 Urdu:** “آپ کے آرڈر کی تصدیق باقی ہے۔ براہ کرم باقی [REMAINING_TIME] میں فیصلہ کریں۔”

**T+25 English:** “Final reminder. Only [REMAINING_TIME] left.”

**T+25 Urdu:** “آخری یاد دہانی: تصدیق کے لیے صرف [REMAINING_TIME] باقی ہے۔”

**T+30 English:** “Your request has expired. No parcel will be dispatched against this request. You may place a new order.”

**T+30 Urdu:** “آپ کی درخواست کی میعاد ختم ہو گئی ہے۔ اس درخواست کے تحت کوئی پارسل روانہ نہیں کیا جائے گا۔ آپ نیا آرڈر دے سکتے ہیں۔”

**Confirmed COD English:** “Your COD order [ORDER] is confirmed. Please pay the full gross total of PKR [GROSS_TOTAL] to the delivery rider or Pakistan Post postman when you receive your parcel. No advance payment is required. Your tracking details will be shared once available.”

**Confirmed COD Urdu:** “آپ کے COD آرڈر [ORDER] کی تصدیق ہو گئی ہے۔ پارسل وصول کرتے وقت ڈیلیوری رائیڈر یا پاکستان پوسٹ کے ڈاکیے کو مکمل مجموعی رقم PKR [GROSS_TOTAL] ادا کریں۔ پیشگی ادائیگی کی ضرورت نہیں۔ ٹریکنگ کی تفصیلات دستیاب ہونے پر بھیج دی جائیں گی۔”

Buttons use the same snapshot: `پیشگی ادائیگی` / `Advance Payment`, `کیش آن ڈیلیوری` / `Cash on Delivery`, `آرڈر منسوخ کریں` / `Cancel Order`, and `نیا آرڈر دیں` / `Place a new order`.

## Free-Only Guard

`packages/core/src/free-messaging.ts` provides the reusable pure evaluator and stored-conversation adapter. API replies, payment text/QR parts, welcome replies, recovery/V2 reminders, Admin test sends, and every retry re-evaluate current service-window, locale, opt-out, message form/category, CTWA source/platform/click hash, first-response time, independently verified FEP expiry, matching `billable:false` free-pricing evidence, and approved template ID/locale/category/validity when applicable. FEP outside the service window does not authorize free-form text; no paid/template fallback sender is added.

No FEP persistence architecture or schema is duplicated. The current application has no authoritative writer for the per-contact evidence snapshot, so production requests with unknown evidence are durably suppressed. Synthetic tests supply referral/delivery/pricing evidence. A06 live evidence and actual WABA policy/expiry remain an external release gate, not a local-development blocker. The code never derives a 168-hour expiry from Meta's “up to seven days” maximum.

## Tests And Migrations

- Full Vitest: 436 passed, 1 skipped, 36 files.
- Focused lifecycle/free-gate/Meta-action suites: 36/36; guided API journey:104 passed,1 skipped. Cases use synthetic SQLite, referral/delivery/pricing evidence and fake clocks.
- Documented Node safety suites: 52/52.
- `npm.cmd run build` (TypeScript), `npm.cmd run lint`, and `npm.cmd audit --omit=dev` pass; production dependency audit has 0 findings. Preserve the six registered moderate development-tool findings; no unrelated upgrade.
- The local migration test applies `0049_cod_mo_global_reference_claims.sql` → unchanged `0050_order_confirmation_intents.sql` → `0051_order_confirmation_intent_state_guards.sql`. The full guided API harness also applies sorted migrations. `0050` SHA-256 is `d3aad32271a7988fd44d34fc36e03486c68d4551237dc68c696bb3bafba4e5b4`; the final check must match. None is applied remotely.
- No physical stock table, counter, allocation or warehouse dependency is introduced. A synthetic legacy order without an intent remains unchanged.

## Protected Boundaries And Gates

- Repo: `gardenshop/freeseeds`; worktree `D:\free seeds\gfs-order-001-rev2`; branch `codex/gfs-order-001-rev2`; starting HEAD `dda2ddec93c22189d89cefa29f133e30a9c467d6`.
- Label Printer protection: 923/923 baseline SHA-256 hashes match; no protected parent file is part of this change. Standalone MO Printing and Hoja Seeds remain separate.
- Chrome DevTools `list_pages` was invoked first for read-only inventory; no page was navigated or mutated. No external account identity is claimed from page inventory.
- No live message, payment, external order transition, Meta/Cloudflare/routing write, migration apply, deployment, or traffic change occurred.
- WhatsApp launch remains **NO-GO** until S0-A06 per-contact evidence/template/display-name gates, S0-A10 release-specific rollback, final code/config parity, and separate owner release authorization pass. Unknown billing always suppresses.
- Acceptance percentages: S0 80% audited/20% remaining; S1 INTENT-030 100% local/0% local remaining; S2 0/100%; S3 0/100%; S4 0% exit accepted (partial guard implementation)/100%; S5 0/100%; S6 0/100%; S7 0/100%; S8 0/100%; S9 0/100%. One of ten local stage gates is complete; nine remain. These are acceptance gates, not effort estimates. WhatsApp launch is **NO-GO**.
- Keep A06, A10, FIN-MO-002, six development dependency findings, authorized Pakistan Post integration and all O01-O23/REV.2 tasks registered. S1 INTENT-030 is locally complete. Next single local task: **TID-001**.
- Commit/push outcome and verified code/remote SHAs are reported in the final closeout response after scoped diff and writer review.
