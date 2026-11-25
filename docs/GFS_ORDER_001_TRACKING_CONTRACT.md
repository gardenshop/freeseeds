# GFS-ORDER-001 REV.2 Tracking Contract

Design only. Automatic allocation, generated media and postal sync NOT IMPLEMENTED. No dependency on protected Garden Shop Label Printer.

## Evidence and external gate

Native Free Seeds label: `apps/admin/src/index.ts:97-135,2485-2501`, individual authenticated/private/no-store A6/4x6 HTML. Manual tracking at2464-2482 writes audit metadata, not postal registration. Preserve all historical references.

Read2026-11-25: https://ep.gov.pk/track.asp . Official HTML iframe points to `https://ep.gov.pk/emtts/EPTrack_Live.aspx?ArticleIDz=`; form field `textfieldz`. This verifies candidate parameter spelling/location, not acceptance/registration of self-issued VPL/RGL references or parcel results. No real parcel query was performed by this audit.

Read2026-11-25: https://ep.gov.pk/termsofuse.asp . Disclaimer: "The site visitor must access the information manually by request and not programmatically by macro or other automated means." Commercial reproduction/use also requires permission. **No website scraper/polling fallback.** Obtain an official authorized API agreement or written permission covering automation/event use. No API was verified. No CAPTCHA/access-control bypass or undocumented endpoint testing.

## Allocation

COD prefixVPL; verified paid Advance prefixRGL. Format `[PREFIX][YY][MM][XXXX]`; syntheticVPL26110001/RGL26110001. Karachi allocation date suppliesYY/MM, separate sequence per prefix/month,0001-9999. Existing opaque order IDs/counters remain untouched.

Additive authoritative allocation ledger must enforce unique reference and one replay-safe allocation per eligible shipment/order version, prefix/month sequence uniqueness and bounded exhaustion. Atomic transaction rechecks confirmedCOD/verifiedAdvance, complete details, review/expiry/cancel/archive/hold, shipment identity and prior allocation. Concurrent/timeout replay returns the committed value. No recycling after failed print/cancel/reprint/month rollover, no wrap beyond9999. Existing references collision-checked without renumbering.

Keep internal reference separate from official postal tracking ID and booking evidence where required. Barcode standard and reference registration require verification. Allocation may mean Label prepared, never Postal booked/Dispatched. Construct official result URL only for a registered verified official ID after compatibility evidence. General official manual tracking is available without asserting registration.

## Private native label

Reuse renderer/auth/security headers. Required order ID, name, full address, landmark, city, province, prominent contact, verified sender details, tracking/reference and barcode. VPL designated block uses reconciled principal+commission; RGL omits amount. AMOUNT_CONTRACT governs values. Do not copy another project's sender/config/layout.

Generate individual PDF/image through approved private R2/media pipeline; bind per-order ownership/object/version/digest, safe content type and private/no-store retrieval, no public customer URL. Record issuance/availability distinct from booking/dispatch. No whole-batch delivery. Check own-customer media and free eligibility before upload/send/retry. Existing Admin HTML alone is not a customer-media implementation.

## Provider states

| Normalized state | Evidence |
|---|---|
| Label prepared | Actual native issuance, not movement |
| Postal booked | Provider booking record/acceptance |
| Dispatched | Actual postal dispatch, not tracking assignment |
| In transit | Verified provider movement |
| Destination post office | Verified arrival |
| Out for delivery | Explicit delivery run |
| Delivery attempted | Actual attempt, verified reason only |
| Available for collection | Explicit availability; office/deadline only if supplied |
| Delivered | Parcel delivery, never WhatsApp status |
| Return initiated | Actual return start |
| Returned | Completed return |
| Unknown/exception | Unmapped/conflicting/missing evidence, no invented fallback |

Provider-specific mapping remains NOT TESTED because authorized status catalog/access is absent. Store minimal raw/normalized status, official ID, event reference/time, observation time and evidence source. Poll time is not event/dispatch time. Dedupe by trackingID+normalizedstatus+providerreference/timestamp; preserve genuine repeated attempts with distinct events. Out-of-order events may enrich history but cannot send stale/regressive duplicate updates. Conflicts require review.

Once permitted, existing Cron/Queue/D1 performs configurable4-6-hour checks after capacity review with atomic due lease, bounded concurrency, backoff/jitter and terminal stop. No per-parcel minute queries. Failures/unknown results do not advance status. Continue internal tracking after FEP expiry independently of notifications. Combine simultaneous fresh significant events into one outbox send with all included dedupe keys. Provider prohibition is a hard blocker, not permission to probe alternatives.
