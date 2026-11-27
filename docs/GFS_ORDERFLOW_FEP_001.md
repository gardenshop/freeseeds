# GFS ORDERFLOW FEP-001 Closeout

**Status: local implementation and synthetic acceptance complete; WhatsApp launch NO-GO.** No campaign, template, billing, sender, migration, deployment, customer or Meta/Cloudflare setting was changed.

## Verified Rules

Official read-only sources:

- [WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/)
- [WhatsApp status webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status)
- [WhatsApp message webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages)

A first business response within24 hours of a qualifying **mobile** Click-to-WhatsApp referral can open an FEP. The first response is a distinct policy basis: it must not require an already active FEP, future expiry timestamp, or post-delivery pricing receipt before sending. The local guard permits only one initial free-form response when a signed inbound webhook provides `source_type=ad`, a hashed `ctwa_clid`, explicit `ANDROID`/`IOS` platform, provider timestamp inside CSW, and the versioned opening-response policy; a database CAS consumes the one-time claim. No mobile origin is inferred from campaign ID, ad traffic or `ctwa_clid` alone.

Subsequent FEP use is recognized only from a matching signed outgoing-message status and exact per-contact `conversation.expiration_timestamp`, `conversation.origin.type=referral_conversion`, and `pricing` evidence (`type=free_entry_point`, `category=referral_conversion`, `pricing_model=PMP`, `billable=false`). SENT proof is pending until DELIVERED/READ; FAILED clears pending proof. The exact provider expiry is used; Meta's “up to seven days” maximum is not a duration default.

The 24-hour customer-service window and FEP are separate. Free-form messages still require an open CSW. Outside CSW, the pure guard accepts only an exact approved template ID/locale/category/validity plus active verified FEP. No template sender fallback or paid send was added.

Current official pricing also reports a 1,000 free service-message tier per business phone/month. The local service-allowance path requires a separately verified positive remaining-message counter and a matching `free_customer_service`/`service`/`free_tier`/PMP proof. A prior free-service delivery, 90-day total or aggregate analytics do not prove the next message is free.

## Existing Account Evidence

The previously recorded read-only 90-day WABA aggregate, supplied as prior evidence, was **68,214 FEP deliveries, 1,715 free service deliveries, zero paid deliveries and approximately $0 charges**. The previously read seven-day aggregate was also free; neither aggregate proves any individual referral/device, current FEP expiry, remaining monthly allowance or next-message billability. The prior template audit listed the English 15-minute Utility and Urdu 30-minute Utility templates as **Active - Quality pending**; this status was not freshly rechecked and is not treated as rejection or approval. No identity audit was repeated, and no business settings/templates were opened or changed.

The minimal template register is recorded in [GFS_ORDER_001_FREE_WINDOW_POLICY.md](GFS_ORDER_001_FREE_WINDOW_POLICY.md#minimal-template-register). It preserves the two exact last-observed template names/statuses and does not infer mappings to reminder, COD, payment, label or shipment notices. The local U01-U11 shipment/payment specs are not Meta-approved assets. Unknown or unmatched out-of-CSW template evidence means **NO SEND**.

## LAUNCH-001 live read-only update (2026-11-27)

Using the existing authorized Meta/WhatsApp Manager session, the currently linked GFS phone displayed **Connected / High quality** and sender display name **In Review**. The same two Utility templates remain **Active - Quality pending**; no exact approved English/Urdu pair or mapping to INTENT-030 reminders/payment/COD/shipment copy was visible. The account messaging tier is **10,000 business-initiated conversations per rolling24h**, with **2,440/5,000** high-quality unique customers displayed toward the next tier. This tier is not the free-service allowance.

The latest Manager insight period, **2026-10-30 through 2026-11-26**, displayed **61,254 Free Entry Point**, **924 free customer-service**, **0 paid**, and approximately **$0** charges. These are account-level aggregates only. No individual referral platform, opening response status, exact FEP expiry, per-contact pricing/remaining allowance or actual English/Urdu client rendering was verified. No message, template, sender, billing, WABA, campaign or account setting was changed; no live test contact was used. WABA aggregate free deliveries do not prove a future message is free.

## Local Implementation

- Reused `evaluateFreeWhatsAppOutbound` / `evaluateStoredFreeWhatsAppOutbound`; no parallel FEP table/service. Referral click IDs and webhook payloads are not persisted raw. Minimal hashes, source/platform, provider timestamps, actual expiry and pricing proof are stored in existing conversation state.
- All API/Admin automatic text, buttons, media parts and retries use the same fail-closed evidence gate. Service CSW, explicit opt-out/blocked state, locale, form/category, approved-template evidence and free pricing are checked immediately before every attempt. Out-of-CSW free-form is never allowed, even in FEP; approved-template requirements apply outside CSW.
- Payment approval, internal T+30 expiry, cancellation and financial processing are independent of notice delivery. Unknown eligibility terminally suppresses a message; it does not undo PAID or prevent expiry. No paid fallback.
- Provider-inbound timestamps—not webhook arrival time—drive the service window. Missing timestamps fail closed. Duplicate/delayed referral/status callbacks are idempotent and cannot overwrite newer evidence.
- The initial language-choice response is direction-formatted but neutral before customer selection. All subsequent customer copy/buttons use the pinned locale. LRM/RLM plus LRI/RLI/PDI preserves English LTR/left and Urdu RTL/right paragraph flow, blank lines, amounts and LTR IDs/URLs without HTML/CSS.

## Tests And Boundaries

- Synthetic tests cover qualifying/nonqualifying/mobile-unknown referral, first-response exception with no prior FEP/price, one-time claim, status-based exact expiry/pricing activation, missing/duplicate/delayed events, CSW/FEP separation, approved template outside CSW, service allowance counter, retry after expiry, opt-out, bilingual formatting and suppression.
- Focused FEP/intent/API/service-window suites: **136 passed, 1 skipped** across four files. Full Vitest: **451 passed, 1 skipped** across38 files; documented Node suites: **52/52**; build/TypeScript/lint pass. Production-only dependency audit: **0 findings**. Full audit: six moderate dev-tool findings remain unchanged; no unrelated upgrades.
- Migrations0049/0050/0051 remain unapplied. INTENT/TID and COD/MO security regressions remain passing. Label Printer **923/923** protected hashes match. Standalone MO Printing and Hoja Seeds remain separate.
- Chrome DevTools `list_pages` was called first; no page navigation/screenshot, external account mutation, live message, campaign activation, payment or deployment occurred. The prior verified WABA identity/aggregate audit was not repeated.

## Production Release Gate

S0-A06 remains open until an authorized controlled test on an explicitly approved synthetic contact captures the actual signed mobile referral/platform, first-response status, exact per-contact FEP expiry, matching pricing webhook and any service-counter evidence. If the referral webhook does not expose mobile platform, do not infer it; obtain another supported independent per-contact evidence source or retain fail-closed suppression. Recheck template quality/approval, sender display name, opt-out, English/Urdu client rendering and A10 rollback readiness before a separately authorized send. Do not use ordinary customers, activate the existing campaign, submit templates or send a live test without separate authorization. Unknown evidence means **NO SEND**, not paid fallback.

Current stage acceptance: S0 80% audited; S1 INTENT-030 100% local; S2 aggregate read PASS but row-level/denominator exit partial; S3 TID-001 100% local; S4 local implementation PASS/live per-contact gates PARTIAL; S5 0%; S6 0%; S7 0%; S8 0%; S9 0%. Two of ten stage exits are complete; eight remain. WhatsApp launch stays **NO-GO**. Preserve PENDING-001, FIN-MO-002 before S5/S6, authorized Pakistan Post integration, six dev findings, tracking/private labels, new-number lock and O01-O23/REV.2. **Next task: close PENDING row-level evidence and remaining LAUNCH-001 gates; do not deploy from this report.**
