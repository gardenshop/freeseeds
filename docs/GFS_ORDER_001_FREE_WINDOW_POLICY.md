# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Free Window Policy

Status: official general policy/current WABA aggregate evidence were read-only verified2026-11-25; no live per-contact referral/FEP expiry/free-pricing evidence was observed in this task. A reusable local fail-closed guard and minimal signed-webhook evidence writer now exist in `packages/core/src/free-messaging.ts` / `webhook.ts` and are applied to API/Admin automatic sends/retries. The writer accepts only explicit mobile-origin fields when supplied, hashes CTWA click IDs, and requires actual status pricing plus provider expiration for active FEP. Synthetic evidence only; no live messaging, template submission, billing or campaign change occurred.

## FEP-001 opening-response rule (2026-11-26)

The current official pricing policy states that the first business response within24h of a qualifying mobile Click-to-WhatsApp referral opens a free-entry-point window. Therefore the initial qualifying response must not require an already-open FEP, a future FEP expiry, or a delivered-pricing webhook. The local guard has a separate `FEP_OPENING_RESPONSE` basis for exactly one free-form service-window response, and the claim is consumed atomically before send. It requires a signed inbound referral with `source_type=ad`, a supplied `ctwa_clid` hashed before persistence, an explicit Android/iOS platform field, recent provider message timestamp and the versioned official opening-response policy. No platform is inferred from ad/source IDs or owner-reported aggregate traffic. If platform/referral/source/time is absent or unknown, the opening path fails closed; a verified remaining free-service allowance may independently authorize a service message.

After the first response, an active FEP is stored only from the exact provider message status webhook that correlates to the claimed first-response message and supplies `conversation.origin.type=referral_conversion`, an actual `conversation.expiration_timestamp`, and `pricing.type=free_entry_point`, `pricing.category=referral_conversion`, `pricing_model=PMP`, and `billable=false`. The implementation uses that timestamp as the exact per-contact expiry; it never computes or assumes 168h. Sent-status evidence is held pending until delivery/read confirmation; failure clears pending evidence. No raw `ctwa_clid` or full webhook is persisted, only click/payload hashes and minimal timestamps/policy/pricing fields in existing `whatsapp_conversations.state_data`. No separate FEP table/ledger is added.

The prior owner-provided 90-day aggregate (68,214 FEP deliveries,1,715 free service deliveries,zero paid deliveries,approximately $0) is historical account aggregate only, not evidence for an individual recipient or current remaining service-message allowance. Current message-level pricing evidence remains unknown until the signed per-contact webhook is observed. The monthly service-tier path therefore requires a separately verified positive remaining-message count, current to that business phone number and month; aggregate delivery totals alone cannot authorize a send.

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

### Minimal template register

This inventory uses the last read-only WABA list from2026-11-25; statuses have not been refreshed. “Active - Quality pending” is recorded verbatim and is not treated as either rejection or send approval. Do not submit templates or route messages from this register alone.

| Notice family | Message-sequence copy/spec | Existing Meta template mapping | Locale/status and routing disposition |
|---|---|---|---|
| Initial CTWA response | FEP-001 opening reply | Not a template; the one-time opening path is only for a qualifying referral in an open CSW | EN/UR selected after language choice; signed mobile/platform evidence and free-only guard required. Unknown evidence suppresses. |
| T+10 / T+25 reminders | INTENT-030 T+10 and final T+25 | None verified; do not infer mapping from template names containing `15m` or `30m` | Localized free-form only while CSW and the free-only guard pass; any out-of-CSW route needs an exact approved matching template. |
| T+30 expiry notice | INTENT-030 expiry copy; internal expiry is independent | None verified; `gfs_payment_reminder_30m` is not presumed to match | EN/UR copy is specified, but delivery is suppressed unless current CSW/free evidence or an exact approved template passes. |
| COD / payment notices | U01 COD confirmation; U02 verified Payment Received | None verified | EN/UR copy exists locally. Receipt upload/TID is not Payment Received; use only after actual approved payment or explicit COD confirmation and current messaging eligibility. |
| Shipment notices | U03 label prepared; U04-U11 booking/tracking/delivery/return | None verified; U03-U11 are draft specification IDs, not Meta asset names | EN/UR specs exist locally. Each event needs its own verified postal evidence; out-of-CSW delivery requires an exact approved locale/category/media match. |
| Existing account template | `gfs_payment_reminder_15m` | Exact observed name | English Utility; last read **Active - Quality pending** (2026-11-25), not freshly checked and not release-cleared. No message-sequence mapping is approved. |
| Existing account template | `gfs_payment_reminder_30m` | Exact observed name | Urdu Utility; last read **Active - Quality pending** (2026-11-25), not freshly checked and not release-cleared. No message-sequence mapping is approved. |

No exact EN/UR pair or approved Meta asset mapping is established for T+10/T+25/T+30, COD, Payment Received, label or U04-U11. Outside CSW, suppress until a current approved template with the exact locale, category and media requirements is verified. Reuse existing assets only after an authorized read-only status/content match; do not create or submit unnecessary templates.

Official pricing states FEP may last **up to7 days**, not that this WABA/customer necessarily receives168h. The recorded Manager insights do not expose verified account-specific per-contact expiry nor historical qualifying mobile-origin/referral/first-response evidence. No normal authenticity challenge was present on that 2026-11-25 read; no new browser identity was asserted and no controlled live test is authorized. Account-level identity and historical billing insights are historical read-only evidence; per-contact duration/eligibility remains UNKNOWN and the guard suppresses sends when it is absent.

`packages/core/src/provider.ts` parses the authenticated message referral, provider timestamp and any explicit platform field. `webhook.ts` stores a minimized CTWA click hash/source/time in existing `whatsapp_conversations.state_data`, not the raw click ID or payload. It permits one policy-verified first response without a pre-open FEP/pricing receipt when a mobile CTWA referral is explicit and the CSW is open; an atomic claim prevents duplicate opening replies. Later active FEP evidence requires a matching outbound response and signed Meta status with actual `conversation.origin=referral_conversion`, `conversation.expiration_timestamp`, and non-billable `pricing.type=free_entry_point/category=referral_conversion`. No new FEP table/service is introduced. Missing platform/status/price/expiry remains unknown and suppresses subsequent sends. No expiry is calculated from the seven-day maximum, and DELIVERED/READ alone is not billing proof.

The current account gives an aggregate historical free-delivery baseline above, not implementation metrics. Per-contact referral/active-expiry status is now minimized in existing conversation state when verified webhook evidence is available; no aggregate reporting/dashboard for eligible/active/expired counts, referral-verified cohort, per-retry billable state or suppression trends was added. Missing current evidence is UNKNOWN, not zero. Existing ordinary delivery failures are separate in CURRENT_AUDIT.

## PENDING-001 order-sequence boundary

The Admin Reconciliation view may display an already-presented, active, unexpired INTENT-030 as **guarded sequence work**; this is not a fresh FEP, CSW, service-tier or billability decision. It never starts/replays the sequence or labels a recipient send-eligible. The ordinary per-message sender still re-reads recipient identity, opt-out, CSW/FEP, service allowance, exact pricing, approved locale/template and expiry before each individual T+10/T+25 reminder. At T+30, the existing worker commits conditional expiry before separately queueing its localized expiry notice; that notice is also free-guarded and suppressible. Missing/expired/unreachable/schema-unknown evidence suppresses; only that already-committed T+30 boundary notice is exempt from the no-post-expiry rule. No historical backfill, bulk outreach or WABA aggregate inference is allowed. Live order rows and counters remain unrefreshed in this local task.

## Central decision contract

One shared final guard covers API/Admin automatic reply, payment instruction/media, recovery/V2 reminder and post-approval Payment Received sends/retries. Local entry point: `evaluateFreeWhatsAppOutbound` plus `evaluateStoredFreeWhatsAppOutbound` in `packages/core/src/free-messaging.ts`; each attempt re-reads evidence and current customer state. No parallel FEP table/service was added; the writer uses existing authenticated webhook and conversation-state/outbox infrastructure. Templates outside CSW can pass only with exact approved locale/category/id and active verified FEP evidence, but no paid/template fallback sender exists in this workflow.

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

Retain first qualifying inbound and business response separately, eligibility/evidence source, actual provider FEP expiry, account policy version, last provider inbound/CSW expiry, hashed referral/click identifiers, and pricing model/type/category/billable/subtype. Do not retain raw CTWA click IDs or raw payloads, and do not expose recipient identifiers in reporting.

Reconcile pricing webhooks idempotently by message/event identity and prevent stale updates. Free-delivered and billable-delivered count distinct delivered messages with explicit evidence; accepted/sent without pricing stays unknown. Use supported verified-WABA pricing analytics with documented timezone/cohort semantics. Eligible/active/expired count windows; suppression counts decisions/jobs; failure counts final failed messages; missing eligibility and missing delivered pricing are separate unknowns. Never sum incompatible denominators.

Production enablement needs separately authorized controlled tests, exact sender/Page/WABA, utility template status/quality/language/media/category clear for actual use, proof of qualifying mobile ad referral and prompt response, actual expiry source/conservative margin, pricing webhook reconciliation and fake-clock boundary/race/retry/opt-out tests. No campaign activation or paid fallback. See TEST_MATRIX FEP/MSG and S0-A06.
