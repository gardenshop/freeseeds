# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Free Window Policy

Status: official general policy/current WABA aggregate evidence were read-only verified2026-11-25; actual per-contact referral, FEP expiry and free-pricing evidence remain UNKNOWN. A reusable local fail-closed guard now exists in `packages/core/src/free-messaging.ts` and is applied to API/Admin automatic sends/retries. It has synthetic tests only; no external evidence writer or live messaging test was added. No send, template submission, billing or campaign change occurred.

## Official evidence

Read on2026-11-25: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ . The page explicitly reflects October1,2026 changes.

- Qualifying CTWA inbound originates from mobile Android/iOS WhatsApp; desktop/web do not qualify under this provision.
- A business response in the customer service window opens FEP from that response; the qualifying response is free. FEP **may remain open for up to seven days**, not a promise of168 hours for every account/contact.
- Ordinary service, utility, marketing and authentication messages in an actual open FEP are free. Meta Business Agent messages remain charged.
- Non-template text/interactive/media requires an open24-hour customer service window. FEP does not permit free-form messages outside that window.
- Since October1,2026, the first1000 delivered service messages per business phone per month are free, resetting in the messaging account timezone, without rollover. Service messages beyond allowance can be charged. Utility messages inside CSW are not automatically free either.
- Delivered service pricing can contain `billable:false`, `type:free_customer_service`, `category:service`, `subtype:free_tier`; after allowance, `billable:true`, `type:regular`. Charges depend on delivery, not accepted API requests.
- FEP is shared for the phone-number business/user pair, not exclusive to the messaging account that funded the ad. Shared-phone allowance consumption makes local unverified counters unsafe.

No rate-card price or account-specific duration is inferred. All-ad traffic is acquisition context, not per-contact eligibility evidence. Monthly service allowance is a separate billing basis, not FEP qualification.

## Account evidence

Owner-provided profile contact: `ayesha.butt55@hotmail.com`. It is recorded as owner-reported profile context, not a password, OTP/token, system identity or independently matched email. Current Meta business UI identified the visible user as Saeed Nazim (You) without exposing its login email. Do not assume the account/profile email match; do not request secrets.

Read-only verification in the existing authenticated profile: Garden Shop portfolio568026370701542 owns Page `Free Seeds In Pakistan - www.gardenshop.pk` ID101192938541236, WABA `Get Free Seeds`2616648355452496 (Asia/Karachi), phoneID1323932417479627/+923044429933, and ad account `creeper seeds`1198439777611633. WABA/account and phone show Connected; number quality High. Phone display name is **In Review**, with a Meta warning that display names were not approved. Do not alter or resubmit display name in this task.

Meta WhatsApp Manager Message Pricing, selected Cloud API - Utility, **Last90 days Aug28-Nov25,2026**, displayed:

| Metric | Account insight |
|---|---:|
| Free Entry Point messages delivered | 68,214 |
| Free Customer Service messages delivered | 1,715 |
| Total free messages delivered in category breakdown | 69,929 |
| Paid messages delivered | 0 |
| Approximate charges | $0.00 |

These are approximate WABA-wide aggregates, not per-user/order invoice proof. The same overview's separate all-message delivered summary read69,923, a six-message discrepancy; reconcile with message pricing/invoice analytics before accounting assertions. Zero billed messages in this historical interval does not guarantee future delivery is free or provide a contact's FEP start/expiry.

Freshest selected WABA Message Pricing period, **Last7 days Nov19-Nov25,2026**, displayed12,953 total free deliveries: FEP12,696 plus free customer service257; paid0; approximate charges$0.00. The separate all-messages summary showed12,944 delivered (nine fewer). This confirms only the aggregate category view in this period; it remains approximate and does not reveal individual FEP duration.

Exactly two templates appear in the WABA template list: `gfs_payment_reminder_15m` (English Utility) and `gfs_payment_reminder_30m` (Urdu Utility), both **Active - Quality pending**,0 sent/0 opened in the displayed template-insight period, edited Oct28,2026. The Urdu body says amount pending and asks the customer to send a receipt if paid; the English body also offers an enabled advance method. Neither shows COD-confirm, cancellation, label media, shipment tracking or event content. No other template appears in this WABA list. Active status is recorded verbatim; quality-pending templates are not release-cleared for new message routing.

Official pricing states FEP may last **up to7 days**, not that this WABA/customer necessarily receives168h. The recorded Manager insights do not expose verified account-specific per-contact expiry nor historical qualifying mobile-origin/referral/first-response evidence. No normal authenticity challenge was present on that 2026-11-25 read; no new browser identity was asserted and no controlled live test is authorized. Account-level identity and historical billing insights are historical read-only evidence; per-contact duration/eligibility remains UNKNOWN and the guard suppresses sends when it is absent.

`packages/core/src/provider.ts` parses referral/ctwa_clid; `flow.ts` can retain attribution. `webhook.ts` persists delivery status/time/hash, not authoritative FEP or price eligibility. The new guard reads only an explicit `freeMessagingEvidence` snapshot already attached to the existing conversation state; no new FEP table/service is introduced and no production writer currently populates that snapshot. It requires mobile CTWA/referral hash, response time, independently verified expiry evidence, fresh matching free-pricing proof, service-window rules, locale, opt-out, and approved matching template data. It never derives expiry from a seven-day maximum and treats DELIVERED/READ alone as no billing proof.

The current account gives an aggregate historical free-delivery baseline above, not implementation metrics. Per-contact FEP eligible/active/expired, referral-verified, first-response-verified, suppression, free/billable status per event/retry and unknown-FEP counts are **UNKNOWN / NOT INSTRUMENTED**, not zero. Existing ordinary delivery failures are separate in CURRENT_AUDIT.

## Central decision contract

One shared final guard covers API/Admin automatic reply, reminder, payment instruction and media sends/retries. Local entry point: `evaluateFreeWhatsAppOutbound` plus `evaluateStoredFreeWhatsAppOutbound` in `packages/core/src/free-messaging.ts`; each attempt re-reads evidence and current customer state. No separate FEP persistence architecture is added: future FEP-001 must provide a verified evidence snapshot through the existing conversation context. Templates outside CSW can pass the pure guard only with exact approved locale/category/id and free-pricing evidence, but no paid/template fallback sender exists in this workflow.

| Condition | Decision |
|---|---|
| Opt-out, blocked customer, identity mismatch or stale job | Suppress with durable reason; no paid fallback |
| Verified qualifying mobile inbound awaiting prompt response in CSW | Permit only under verified account policy for the free FEP-opening response; capture response evidence and reconcile delivery/pricing. API acceptance is provisional. |
| Verified active FEP, sufficient safety margin, CSW open | Supported existing text/interactive/media, excluding Meta Business Agent charges |
| Verified active FEP, sufficient margin, CSW closed | Approved utility template matching locale/category/media; otherwise suppress |
| FEP unknown or expired | Suppress automatic chargeable sends. A separately verified free service-allowance basis requires conservative shared-phone accounting and approved policy; unknown allowance suppresses. |
| Customer initiates inquiry | Re-evaluate current CSW and free billing basis; inbound alone does not guarantee free outbound |
| Retry or delay crosses expiry/margin | Suppress even when enqueue-time eligibility passed |

Never hardcode168 hours from the maximum. Shorter verified account policy wins. Ordinary inbound/replies may reset CSW, not FEP. Preserve window history when a genuine new qualifying entry occurs; do not overwrite evidence or double-count pricing. Unknown device/platform eligibility remains unknown, not assumed mobile.

Guard result: suppression reason or verified-free basis/evidence reference/effective expiry and customer locale. The local caller logs only reason and message kind, not CTWA IDs, pricing proof or recipient details. No unguarded automatic `sendTemplate` escape hatch. Reuse existing outbox/status infrastructure, not a new messaging service. Recheck before every separately sent text/QR/media part and retry. Internal order expiry runs independently before outbound notification; a suppressed T+30 notification does not retain the cooldown lock or revive an expired request.

## Persistence and metrics

Retain first qualifying inbound and business response separately, eligibility and evidence source, start/conservative expiry, account policy version, last inbound/CSW expiry, minimized referral/source/ad identifiers and ctwa_clid when supplied. Keep actual sent type/category/template identifier, provider message ID, delivery state and actual pricing model/type/category/billable/subtype, plus supported platform origin/expiry evidence. Do not retain raw payloads or expose customer identifiers in reporting.

Reconcile pricing webhooks idempotently by message/event identity and prevent stale updates. Free-delivered and billable-delivered count distinct delivered messages with explicit evidence; accepted/sent without pricing stays unknown. Use supported verified-WABA pricing analytics with documented timezone/cohort semantics. Eligible/active/expired count windows; suppression counts decisions/jobs; failure counts final failed messages; missing eligibility and missing delivered pricing are separate unknowns. Never sum incompatible denominators.

Production enablement needs separately authorized controlled tests, exact sender/Page/WABA, utility template status/quality/language/media/category clear for actual use, proof of qualifying mobile ad referral and prompt response, actual expiry source/conservative margin, pricing webhook reconciliation and fake-clock boundary/race/retry/opt-out tests. No campaign activation or paid fallback. See TEST_MATRIX FEP/MSG and S0-A06.
