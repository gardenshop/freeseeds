# GFS-ORDER-001 REV.2 Message Sequence

Design only: NOT IMPLEMENTED, NOT SENT. Preserve existing English/Urdu journey, methods and sender lock. All automatic sends must pass FREE_WINDOW_POLICY immediately before each send/retry and honor opt-out/blocked state, ownership and order/version/event idempotency. CMS content is not Meta template approval.

## Intent sequence

| Event | Customer view and authoritative rule |
|---|---|
| T0 | Complete details and actionable review/options successfully presented; one immutable30-minute deadline; show Advance and COD totals. Buttons: Advance Payment, Cash on Delivery, Cancel Order. Incomplete details/order creation alone do not start it. |
| T+10 | One unresolved-order reminder; no timely evidence, cancellation or COD confirmation; same deadline |
| T+25 | Final reminder: five minutes remain only when actually timely; delayed jobs cannot lie about remaining time |
| T+30 | Atomic expiry, release only genuinely reserved stock, deny dispatch. No automatic COD conversion or24/48-hour decision reminders. |
| Advance selected | Existing JazzCash/Easypaisa/Bank Alfalah instructions; pay/switch COD/cancel until original deadline. Selection is not confirmation. |
| COD selected | Review product/fertilizer/province delivery/Rs.125 fee and gross payable on delivery; explicit Confirm COD Order required |
| Timely receipt OR TID | Protect review and stop reminders. TID is not funds evidence; preserve existing receipt/security prerequisites for actual approval until securely extended. |
| COD explicitly confirmed | Existing appropriate confirmed state and audit; stop payment reminders and send gross confirmation below |
| Late evidence | Reconciliation hold; preserve received money/evidence, no duplicate dispatch |
| Expired restart | Fresh availability/confirmation and versioned deadline, without overwriting old evidence/identifiers |

Scarcity text is conditional on actual verified campaign stock. Without stock authority omit limited-pack/reservation claims.

English T0: "Please confirm your order within30 minutes. Advance payment: Rs.[ADVANCE_TOTAL]. Cash on delivery: Rs.[GROSS_TOTAL], including the Rs.125 cash collection fee. Choose Advance Payment, Cash on Delivery or Cancel Order. Selecting a payment method does not confirm your order."

Urdu T0: "براہ کرم30 منٹ کے اندر اپنے آرڈر کی تصدیق کریں۔ پیشگی ادائیگی: [ADVANCE_TOTAL] روپے۔ وصولی پر ادائیگی: [GROSS_TOTAL] روپے، جس میں125 روپے کیش کلیکشن فیس شامل ہے۔ پیشگی ادائیگی، کیش آن ڈیلیوری یا آرڈر منسوخ کرنے کا انتخاب کریں۔ صرف ادائیگی کا طریقہ منتخب کرنے سے آرڈر کی تصدیق نہیں ہوتی۔"

English final reminder: "Your order is not confirmed yet. Five minutes remain. Pay in advance, explicitly confirm Cash on Delivery, or cancel before [DEADLINE]." Do not send this if evidence is already submitted; protect review instead.

Urdu final reminder: "آپ کے آرڈر کی ابھی تصدیق نہیں ہوئی۔ پانچ منٹ باقی ہیں۔ [DEADLINE] سے پہلے پیشگی ادائیگی کریں، کیش آن ڈیلیوری کی واضح تصدیق کریں یا آرڈر منسوخ کریں۔"

Exact required English COD confirmation: "Your COD order is confirmed. Please pay Rs. [GROSS_TOTAL] to the delivery rider or Pakistan Post postman when you receive your parcel. No advance payment is required. Your tracking details will be shared once available."

Urdu COD confirmation: "آپ کے کیش آن ڈیلیوری آرڈر کی تصدیق ہو گئی ہے۔ پارسل وصول کرتے وقت ڈیلیوری رائیڈر یا پاکستان پوسٹ کے ڈاکیے کو [GROSS_TOTAL] روپے ادا کریں۔ پیشگی ادائیگی کی ضرورت نہیں۔ ٹریکنگ کی تفصیلات دستیاب ہونے پر آپ کو بھیج دی جائیں گی۔"

COD review example: free seeds0 + fertilizer250 + delivery250 + collection125 = gross625. No postal commission in ordinary text. Never instruct payment against an expired order.

## Shipment utility specifications

Semantic IDs below are draft specification IDs, **not existing approved template names**. Produce en/ur variants with fixed transactional wording and bounded parameters. Outside CSW require approved utility routing within verified FEP. Account-specific template names/status/category/language codes/media support remain BLOCKED; no submission/send occurred.

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
