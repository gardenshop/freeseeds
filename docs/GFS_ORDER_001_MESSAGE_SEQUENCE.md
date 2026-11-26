# GFS-ORDER-001 REV.2 Message Sequence

INTENT-030 local source acceptance COMPLETE; NOT SENT / NOT DEPLOYED. After the explicit language choice, every message/button uses the immutable English/Urdu order-locale snapshot, including delayed jobs and COD/tracking text. The initial language chooser is neutral bilingual self-labeling. All automatic API/Admin sends/retries pass the fail-closed FREE_WINDOW_POLICY guard immediately before each attempt; unknown evidence suppresses. CMS content is not Meta template approval. Live per-contact FEP/pricing evidence remains a production gate.

## Intent sequence

| Event | Customer view and authoritative rule |
|---|---|
| T0 | Successful actionable options message delivered/read; first valid provider event timestamp is immutable T0 and deadline=T0+30m. Incomplete details, order creation, send acceptance or missing status alone do not start it. Buttons: Advance Payment, Cash on Delivery, Cancel Order. |
| T+10 | One unresolved-order reminder; same deadline. Exact remaining time is computed at send time; show locale-matched Advance/COD/Cancel buttons. |
| T+25 | Final unresolved-order reminder. Show actual remaining time (not a static five minutes when delayed) and locale-matched buttons. Suppress at/past deadline. |
| T+30 | Commit internal expiry only when still unresolved, unpaid and without timely receipt/TID/review/confirmation. Release only the matching household cooldown lock; no parcel dispatch. Expiry notification is separate and may be suppressed by the free guard. No automatic COD conversion or24/48-hour decision reminders. |
| Advance selected | Existing JazzCash/Easypaisa/Bank Alfalah instructions; pay/switch COD/cancel until original deadline. Method selection alone is not confirmation. Verified payment or timely receipt/TID under review stops decision reminders. |
| COD selected | Review product/fertilizer/province delivery/Rs.125 fee and gross payable on delivery; explicit Confirm COD Order required |
| Timely receipt OR TID | Protect review and stop reminders. TID is not funds evidence; preserve existing receipt/security prerequisites for actual approval until securely extended. |
| COD explicitly confirmed | Existing appropriate confirmed state and audit; stop payment reminders and send gross confirmation below |
| Late evidence | Preserve/reconcile through existing review/Admin controls; never automatically reopen, mark paid or dispatch an expired request |
| Expired restart | A new customer request gets its own fresh intent/deadline without mutating historical order evidence |

Physical stock management is not required. Existing eligibility locks are household cooldown controls, not stock reservations. No stock tables, counters or warehouse dependencies. Use deadline-based urgency only; never claim scarcity, allocation or availability.

English T0: "Confirm your order within 30 minutes through advance payment or Cash on Delivery (COD). Advance payment: PKR [ADVANCE_TOTAL]. COD: PKR [GROSS_TOTAL], including the PKR 125 collection fee. Selecting a payment method alone does not confirm your order."

Urdu T0: "پیشگی ادائیگی یا کیش آن ڈیلیوری (COD) کے ذریعے 30 منٹ کے اندر اپنے آرڈر کی تصدیق کریں۔ پیشگی ادائیگی: PKR [ADVANCE_TOTAL]۔ COD: PKR [GROSS_TOTAL]، جس میں PKR 125 وصولی فیس شامل ہے۔ صرف ادائیگی کا طریقہ منتخب کرنے سے آرڈر کی تصدیق نہیں ہوتی۔"

English T+10: "Your order awaits confirmation. Please decide within the remaining [REMAINING_TIME]." English T+25: "Final reminder. Only [REMAINING_TIME] left." Both messages calculate [REMAINING_TIME] from immutable deadline and current time, and are suppressed if stale or no longer unresolved.

Urdu T+10: "آپ کے آرڈر کی تصدیق باقی ہے۔ براہ کرم باقی [REMAINING_TIME] میں فیصلہ کریں۔" Urdu T+25: "آخری یاد دہانی: تصدیق کے لیے صرف [REMAINING_TIME] باقی ہے۔" Numbers are localized by the selected-locale formatting policy; delayed work never reports the original five minutes if less time remains.

English T+30: "Your request has expired. No parcel will be dispatched against this request. You may place a new order."

Urdu T+30: "آپ کی درخواست کی میعاد ختم ہو گئی ہے۔ اس درخواست کے تحت کوئی پارسل روانہ نہیں کیا جائے گا۔ آپ نیا آرڈر دے سکتے ہیں۔"

Exact English COD confirmation after explicit confirmation: "Your COD order [ORDER] is confirmed. Please pay the full gross total of PKR [GROSS_TOTAL] to the delivery rider or Pakistan Post postman when you receive your parcel. No advance payment is required. Your tracking details will be shared once available."

Urdu COD confirmation: "آپ کے COD آرڈر [ORDER] کی تصدیق ہو گئی ہے۔ پارسل وصول کرتے وقت ڈیلیوری رائیڈر یا پاکستان پوسٹ کے ڈاکیے کو مکمل مجموعی رقم PKR [GROSS_TOTAL] ادا کریں۔ پیشگی ادائیگی کی ضرورت نہیں۔ ٹریکنگ کی تفصیلات دستیاب ہونے پر بھیج دی جائیں گی۔"

COD review example: free seeds0 + fertilizer250 + delivery250 + collection125 = gross625. No postal commission in ordinary text. Never instruct payment against an expired order.

## Shipment utility specifications

Shipment utility IDs below remain draft specification IDs, **not existing approved template names**. Existing or future tracking/delivery/status messages use the same pinned customer locale. Outside CSW only a locale/category-matched approved template with verified free FEP evidence may be sent; unknown or unapproved routing is suppressed. No paid fallback or template submission occurred.

| ID | English body specification | Urdu body specification | Parameters/media |
|---|---|---|---|
| U01 | Your COD order[ORDER] is confirmed. Pay Rs.[GROSS] on receipt. No advance payment is required. Tracking will follow once available. | آرڈر[ORDER] کی تصدیق ہو گئی ہے۔ پارسل وصول کرتے وقت[GROSS] روپے ادا کریں۔ پیشگی ادائیگی ضروری نہیں۔ ٹریکنگ دستیاب ہونے پر بھیجی جائے گی۔ | order/gross; runtime confirmation must use exact owner wording above |
| U02 | Payment received for order[ORDER]. Your verified payment is Rs.[AMOUNT]. | آرڈر[ORDER] کی[AMOUNT] روپے ادائیگی وصول اور تصدیق ہو گئی ہے۔ | verified payment only, not receipt upload |
| U03 | The shipping label for order[ORDER] is prepared. This is not confirmation of postal booking or dispatch. | آرڈر[ORDER] کا شپنگ لیبل تیار ہے۔ یہ پوسٹل بکنگ یا روانگی کی تصدیق نہیں ہے۔ | own private image/document; verify approved media header |
| U04 | Order[ORDER] is[VERIFIED_BOOKED_OR_DISPATCHED]. Track:[URL]. | آرڈر[ORDER] کی[VERIFIED_BOOKED_OR_DISPATCHED] تصدیق ہو گئی ہے۔ ٹریکنگ:[URL]۔ | actual verified event and registered official URL |
| U05 | Order[ORDER] has a new verified in-transit update:[EVENT]. Track:[URL]. | آرڈر[ORDER] کے سفر کی نئی تصدیق شدہ اطلاع:[EVENT]۔ ٹریکنگ:[URL]۔ | fresh significant event only |
| U06 | Order[ORDER] has reached the destination post office. Track:[URL]. | آرڈر[ORDER] منزل کے ڈاک خانے پہنچ گیا ہے۔ ٹریکنگ:[URL]۔ | verified arrival |
| U07 | Order[ORDER] is out for delivery. Track:[URL]. | آرڈر[ORDER] کی ترسیل کے لیے ڈاکیا یا رائیڈر روانہ ہو چکا ہے۔ ٹریکنگ:[URL]۔ | COD-only suffix: Pay Rs.[GROSS] on receipt; Advance omits payable |
| U08 | Delivery of order[ORDER] was unsuccessful.[VERIFIED_NEXT_STEP] Track:[URL]. | آرڈر[ORDER] کی ترسیل کامیاب نہیں ہوئی۔[VERIFIED_NEXT_STEP] ٹریکنگ:[URL]۔ | no invented reason or retry promise |
| U09 | Order[ORDER] is available for collection.[VERIFIED_COLLECTION_DETAILS] Track:[URL]. | آرڈر[ORDER] وصولی کے لیے دستیاب ہے۔[VERIFIED_COLLECTION_DETAILS] ٹریکنگ:[URL]۔ | only verified office/deadline |
| U10 | Order[ORDER] is marked delivered by the postal provider. Track:[URL]. | پوسٹل ادارے کے مطابق آرڈر[ORDER] پہنچا دیا گیا ہے۔ ٹریکنگ:[URL]۔ | parcel event, never WhatsAppDELIVERED |
| U11 | Order[ORDER] is marked returned by the postal provider. Track:[URL]. | پوسٹل ادارے کے مطابق آرڈر[ORDER] واپس آ گیا ہے۔ ٹریکنگ:[URL]۔ | actual returned, not return initiated |

No promotion, daily unchanged-status reminder or postal-fee payment link. Combine simultaneous significant events without inventing template parameters; reserve dedupe for every included event. Check media ownership before upload/send and again after delay. After free expiry continue authorized internal tracking and retain functional manual tracking URL, but suppress automatic paid updates. Customer inquiries still pass current CSW/free-billing policy; a new24-hour window alone is not free evidence.
