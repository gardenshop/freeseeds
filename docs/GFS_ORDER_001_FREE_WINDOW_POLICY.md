# GFS ORDERFLOW / GFS-ORDER-001 REV.2 Free Window Policy

## ZERO-MISSED-LEADS-002 current policy (2026-11-28)

Owner status update: the alternate display name `Free Seeds In Pakistan` is already under review; do not resubmit/change it. The requested current Meta refresh is pending because Chrome DevTools MCP `list_pages` repeatedly timed out. The last successful Phone Manager read showed the active display name Rejected, phone Connected/High; registration expiry remains unresolved.

This policy supersedes historical device/platform and isolated-test-attestation rules below. A single opening response may use authenticated, signed Meta referral evidence (`source_type=ad`, nonempty `ctwa_clid`, provider timestamp) within the actual 24-hour customer-service window. The click ID is hashed before storage. No device/OS field, `source_platform`, or test attestation is used, and the first response does not depend on already-observed FEP pricing/expiry. Missing referral evidence remains unresolved and is not sent.

Subsequent FEP messages require the first-response match, referral-conversion origin, the provider's actual expiry, and observed non-billable FEP/PMP pricing evidence. No seven-day expiry is synthesized. Unknown/billable pricing, opt-out, storage failure, or active billing block denies the send; there is no paid fallback or Admin bypass.

The monthly free service allowance remains **disabled for every recipient**. WAM dashboard counts are approximate; the plan has no authoritative pre-send counter covering other senders, human inbox activity, and external API callers. `SERVICE_ALLOWANCE` evidence and an apparently positive dashboard balance do not authorize sending. Re-enable only after Meta supplies an authoritative exact phone/month quota and the implementation proves atomic reservations/idempotency across all send paths and senders.

Only an authenticated DELIVERED/READ status with explicit `pricing.billable=true` creates a durable hash-only incident and active send block for the affected recipient. The existing Admin raises an alert; no automated resumption is provided. Order, payment, COD and fulfillment transitions remain unaffected. Business Agent remains at **Set up**/disabled.

Refreshed read-only Phone Manager UI (2026-11-28) shows the current display name **Rejected**, phone **Connected**, quality **High**. The UI does not expose a separate registration-expiry field; the prior Graph `EXPIRED` report is not refreshed, so registration expiry remains unresolved. No settings were changed. Candidate `0052` is not applied to production.

## FEP-LIVE-002 historical read (2026-11-27; superseded where noted above)

The official Meta developer pricing page was reread: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ . It reflects the October1,2026 pricing rules. The legacy 72-hour public guidance is historical; current developer documentation says a qualifying FEP may remain open **up to seven days**, not that every contact receives seven days. Always use the provider's actual per-contact `conversation.expiration_timestamp`; never synthesize a seven-day expiry. Non-template sends still require an open24-hour customer service window unless the actual FEP remains open; eligible approved templates can be free outside CSW while the actual FEP is open. FEP, CSW and monthly service allowance are separate billing bases.

WABA Message Pricing was read-only checked for `Get Free Seeds`; the selector showed one listed business phone, so the All phone numbers view contains that one number. Last30 days Oct29-Nov27,2026 showed66,349 Free Entry Point deliveries,981 Free Customer Service deliveries,0 paid deliveries, and approximate $0.00 charges. Calendar month-to-date Nov1-Nov27 showed57,489 FEP deliveries and892 Free Customer Service deliveries,0 paid and approximate $0.00. Insights explicitly says totals are approximate and may differ from invoices. The previous owner-provided rolling30-day snapshot (61,254 FEP/924 free service) differs from this refreshed snapshot; do not combine the two windows or infer a recipient's next send is free. The monthly1,000 service-message tier is per phone/month; the dashboard suggests ~108 remaining service messages MTD, approximate only, and this count is not FEP eligibility or send authorization.

The Business Agent page remains at **Set up** (not enabled); the Message Pricing view shows0 AI Provider messages. Free Seeds uses its custom Cloud API chatbot, not Meta Business Agent, and does not call a third-party paid AI service. No Business Agent setting was changed. Read-only Meta Activation status reports Graph API `v26.0`, WABA subscription active, management/messaging permissions granted, phone quality GREEN, display-name status **DECLINED**, and registration **EXPIRED**. These current status fields supersede the historical 2026-11-25 `In Review`/Connected snapshot. No registration, display-name, webhook or provider setting was changed. The expired registration and declined name independently block live sending until an owner-authorized resolution.

Read-only production D1 aggregates found12,304 conversations but0 opening CTWA evidence,0 click-hash entries,0 first-response timestamps,0 FEP records/expiry,0 pricing records and0 durations over72h. `whatsapp_events` stores provider event ID/type/hash/status/correlation/time only, not raw webhook referral or pricing fields. Existing history therefore does not prove an individual FEP duration beyond72h and cannot be credited for this gate. Historical WABA free deliveries remain account aggregate only.

Current webhook reference semantics are applied: actual `conversation.id` and `conversation.expiration_timestamp` are optional and may appear on only some relevant status callbacks; `pricing` may also appear on SENT or DELIVERED/READ. The evidence writer merges matching statuses by the first-response provider-message hash, hashes an observed conversation ID, and finalizes only after actual SENT plus DELIVERED/READ and explicit `conversation.origin.type=referral_conversion`, actual expiry, and `pricing_model=PMP`, `pricing.type=free_entry_point`, `pricing.category=referral_conversion`. `pricing.billable` is deprecated in future API versions and is not required when the current type/category prove FEP; an explicit `billable=true` still blocks. Missing status fields remain pending/unknown; no expiry is fabricated.

The documented referral schema provides ad source and `ctwa_clid`, but does not define an Android/iOS device field. Do not map `source_platform` to device OS or require an undocumented field. The historical isolated-test mobile-attestation policy is superseded by ZERO-MISSED-LEADS-002: no attestation is used. A Facebook Page CTA remains a distinct entry point; unless the signed callback contains qualifying ad-referral evidence, preserve it as unresolved and do not send.

No live test, provider send, callback change or campaign action occurred. The mobile FEP test remains gated by the expired sender registration, declined name, isolated candidate deployment and separately authorized production selective relay. The test contact and identifier are not stored in this policy.

Status: this paragraph is retained as a historical checkpoint only. Current policy is the ZERO-MISSED-LEADS-002 section above; owner mobile attestation is not used. No live messaging, template submission, billing or campaign change occurred.

## Historical FEP-001 opening-response rule (2026-11-26; superseded by ZERO-MISSED-LEADS-002)

The current official pricing policy states the first business response within24h of a qualifying CTWA ad referral opens FEP. The current implementation uses the signed `source_type=ad` referral, hashes `ctwa_clid`, records provider timestamp and uses the versioned one-time opening policy. No OS/platform field or isolated-test attestation is used. No paid fallback.

After the first response, an active FEP is stored only from exact statuses correlated to its first-response provider-message hash: actual `conversation.origin.type=referral_conversion`, actual `conversation.expiration_timestamp`, and `pricing.type=free_entry_point`, `pricing.category=referral_conversion`, `pricing_model=PMP`. The status writer merges fields from SENT and DELIVERED/READ events, hashes an optional `conversation.id`, and waits for successful delivery/read. `pricing.billable` is deprecated in future API versions; an explicit true denies, while the documented type/category remain necessary if it is absent. The actual provider expiry is used without computing168h; first response must be inside CSW and measured duration cannot exceed7d. Failure clears pending evidence. No raw CTWA click ID or webhook is retained, only hashes and minimal evidence in existing `whatsapp_conversations.state_data`; no FEP ledger was added.

All prior aggregate WAM counts are historical/account-wide only, not evidence for an individual recipient or current remaining service-message allowance. Pricing callbacks arrive after delivery and cannot prove a pre-send monthly balance. The monthly service-tier path therefore remains disabled; aggregate delivery totals cannot authorize a send.

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

This 2026-11-25 paragraph is a historical checkpoint; the current read-only findings and superseding account status are above. Account-level insights do not expose per-contact expiry. The current D1 contains no stored per-contact FEP records, so historical duration and current eligibility remain UNKNOWN.

Current source parses signed ad referral source/`ctwa_clid` and provider timestamp; it does not map `source_platform` to device OS. Referral/click evidence is stored as hashes in existing `whatsapp_conversations.state_data`. Only the owner-attested isolated test may open without a prior FEP pricing receipt, and that attestation is a separate test policy value, not a Meta platform field. Later active FEP requires matched status evidence with actual origin, exact expiry, and free pricing type/category. Missing device/status/price/expiry remains unknown and suppresses production sends. No expiry is calculated from the seven-day maximum; DELIVERED/READ without pricing/origin/expiry is insufficient.

The current account gives an aggregate historical free-delivery baseline above, not implementation metrics. Per-contact referral/active-expiry status is now minimized in existing conversation state when verified webhook evidence is available; no aggregate reporting/dashboard for eligible/active/expired counts, referral-verified cohort, per-retry billable state or suppression trends was added. Missing current evidence is UNKNOWN, not zero. Existing ordinary delivery failures are separate in CURRENT_AUDIT.

## PENDING-001 order-sequence boundary

The Admin Reconciliation view may display an already-presented, active, unexpired INTENT-030 as **guarded sequence work**; this is not a fresh FEP, CSW, service-tier or billability decision. It never starts/replays the sequence or labels a recipient send-eligible. The ordinary per-message sender still re-reads recipient identity, opt-out, CSW/FEP, service allowance, exact pricing, approved locale/template and expiry before each individual T+10/T+25 reminder. At T+30, the existing worker commits conditional expiry before separately queueing its localized expiry notice; that notice is also free-guarded and suppressible. Missing/expired/unreachable/schema-unknown evidence suppresses; only that already-committed T+30 boundary notice is exempt from the no-post-expiry rule. No historical backfill, bulk outreach or WABA aggregate inference is allowed. LAUNCH-001 refreshed aggregate counts only; live row-level order eligibility remains unverified.

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
