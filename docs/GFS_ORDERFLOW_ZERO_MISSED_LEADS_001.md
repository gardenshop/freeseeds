# GFS-ORDERFLOW-ZERO-MISSED-LEADS-001/002 Closeout

**Updated:** 2026-11-28

**Repository:** `gardenshop/freeseeds`

**Branch:** `codex/gfs-order-001-rev2`

**Result:** local synthetic acceptance only; live WhatsApp remains **NO-GO**.

## Permanent policies

- **GFS-ZERO-MISSED-LEADS-001:** persist each unique inbound provider event once, classify it with a durable outcome and exact safe reason, attempt a response for every provably free-eligible lead, and expose all unresolved outcomes. A webhook 503 is not a received/closed lead; it asks the provider to retry. No synthetic result is represented as live coverage.
- **GFS-FREE-ONLY-001:** all outbound API, Queue and Admin paths use the shared fail-closed decision. Unknown/paid pricing, unverified/expired FEP, opt-out, active billing block or missing durable evidence deny sending. No paid fallback, template loophole or Admin override.
- **GFS-NO-META-AGENT-001:** Meta Business Agent is never set up, activated, enabled or used.

## Implemented candidate

- Additive local migration `0052_whatsapp_lead_accounting_and_billing_incidents.sql` adds privacy-preserving inbound outcome/recipient, accepted-response, billable incident and active send-block ledgers. It follows 0049 → unchanged0050 → 0051 and is **not applied to production**.
- The signed webhook writes hashed inbound-event and recipient identities, received time, final outcome, exact reason code, eligibility/attempt/acceptance/delivery/read flags and response-attempt counts. Duplicate event IDs do not inflate event totals; Admin deduplicates recipient hashes into unique leads while retaining a separate inbound-event count. Accepted provider-message IDs are hashed/deduplicated per inbound event; status callbacks advance delivery/read state without regression.
- Initial-reply outbox acceptance marks the job SENT. Retryable known non-acceptance is bounded through the existing Queue/DLQ path. Missing D1 returns 503; orphan Queue jobs are audited before acknowledgment; stale PROCESSING acceptance becomes unresolved and is never blindly replayed.
- Signed `source_type=ad` plus nonempty `ctwa_clid`, authenticated webhook evidence and provider timestamp inside the actual 24-hour service window permits exactly the one-time free CTWA opening response. Click IDs are hashed; no OS/device field, `source_platform`, test attestation or already-open FEP is needed. Missing referral evidence remains an unresolved lead, not a fabricated free send.
- Later FEP requires a response-correlated status, referral-conversion origin, actual provider expiry and explicit FEP/PMP pricing evidence. No expiry is synthesized.
- Explicit `pricing.billable=true` on DELIVERED/READ creates an idempotent hash-only incident/audit and a WABA-wide circuit-breaker pause in one D1 batch; an active per-recipient block is added when the provider supplies a valid recipient ID. Missing recipient/timestamp still triggers the global pause without storing raw identity. Since a single billable event cannot safely be classified as isolated versus systemic, this conservative pause applies across API/Admin/Cron/Queue. Admin alerts; no automatic resolution/resumption or paid fallback. Payment/order/COD/fulfillment processing is unchanged.
- Admin reliability analytics separate unique leads from inbound events and accepted from delivered/read; show lead/event outcomes, queued, failed, suppressed, unresolved, exact suppression reasons, backlog/DLQ, retry attempts, duplicate accepted responses, unique eligible-lead coverage, p50/p95 lead latency, and currently active billing incidents. Missing migration returns an explicit unavailable state. The Admin is read-only and never returns recipient hashes.

## Monthly service allowance decision

The monthly service-message path is disabled for all recipients. Meta/WAM insights are approximate, report after-the-fact totals and cannot establish exact current balance across human inbox activity, other Workers, external API callers or shared senders. Local atomic counting would cover only this Worker and could overstate remaining quota. No approximate dashboard number authorizes a send. Re-enable only with an authoritative exact pre-send phone/month quota plus tested atomic reservations and idempotency across every sender. FEP and the one-time qualifying CTWA opening basis remain separate.

## Legacy/candidate synthetic coverage

The authenticated Cloudflare deployment history maps production version `b426ba47` to source commit `901f3f6` (GFS-309). Its verified outbound reply path gates on the 24-hour service window before sending and has no comparable FEP/pricing decision. The identical sanitized fixture test uses that exact legacy service-window predicate and executes the candidate API with a deterministic mocked provider:

| Measure | Legacy b426 CSW attempt model | Candidate synthetic result |
|---|---:|---:|
| Unique inbound provider events | 8 | 8 |
| Unique recipient-hash leads | Not distinguished by legacy CSW predicate | 7 |
| In-window attempts / eligible response events | 8 attempts | 6 eligible, 6 attempted |
| Free-eligible lead contacts | Not distinguished by legacy CSW predicate | 5; all 5 received an initial response |
| Provider-accepted leads / messages | Not established by legacy source/model | 5 leads / 6 messages |
| Delivered / read leads | Not established by legacy source/model | 5 / 2 |
| Failed / suppressed leads | Not priced/classified by legacy source/model | 0 / 0 |
| Unresolved leads / events | Not durably classified by legacy source/model | 2 / 2: new unknown-origin inquiry and returning contact without retained free evidence |
| Duplicate accepted replies | Not measured in legacy history | 0; duplicate event replay adds no send |

## Previous 7-event analysis (superseded by RELEASE-READINESS-003)

Five first-contact messages have signed CTWA ad referrals and omit all device/platform fields. A sixth event is a structurally valid new inquiry without referral evidence; its origin cannot be determined as genuine CTWA versus ordinary inquiry, so the new lead remains unresolved as `FREE_BILLING_UNKNOWN_OR_MISMATCHED` (not malformed). The seventh event is a returning message from one of the five signed-referral contacts, with no new referral; it reuses that contact's prior signed referral and matched provider FEP expiry/pricing evidence, and receives a free reply. No new ad referral is required while stored FEP evidence remains valid. Admin deduplicates the seven events into six recipient-hash leads: five eligible and answered (100% lead coverage), one unresolved new lead; event-level response coverage is6/6. All six eligible messages were accepted and delivered by the mocked provider (2 read), with zero queue backlog, failures, suppressions or duplicate responses. The legacy “attempts” column is a source-based decision comparison only, not historical provider acceptance/delivery or live coverage. Bilingual/COD/Advance, D1/Queue failure, stale processing, duplicate events, concurrent lead requests, expired FEP and disabled monthly allowance remain covered by focused suites; the isolated 10-attempt cap does not apply to ordinary routes.

## RELEASE-READINESS-003 fixture disposition

The superseded paragraph was the earlier test that reused prior FEP evidence for the returning fixture but omitted a second no-evidence returning case. The expanded fixture now has8 inbound events across7 contacts: the original new no-referral event and a returning contact with no persisted free proof both remain unresolved; a separate returning event from a contact with a verified prior signed referral, matching FEP status, actual expiry and pricing is accepted/delivered without a new referral. Thus the exact prior no-evidence returning fixture is not misclassified as free, while a genuine returning CTWA contact does not need the ad referral repeated. The updated coverage totals are the table above:6/6 free-eligible inbound events,5/5 distinct eligible leads,6 mocked accepted/delivered responses,2 unresolved no-evidence leads, zero duplicates. This is synthetic only.

## External live gates

Authorized Chrome DevTools MCP was reconnected and used read-only. The Phone Numbers list name cell reads `Get Free Seeds In Review`; the Profile detail shows active `Get Free Seeds` with **Rejected/Declined** status. The list does not expose the exact pending text; the owner reports **Free Seeds In Pakistan** is already under review and explicitly directs **do not resubmit or change the display name**. Phone status is **Connected**, quality **High**, and Messaging Limits is **Current**. No separate registration-expiry or Graph API-scope field is exposed; prior Graph `EXPIRED` and WABA subscription reports are not freshly reconciled. Business Agent remains at **Set up**/disabled. No Meta mutation occurred.

Current recovery action: **do not resubmit or edit**. Keep the owner-confirmed pending name intact; use Phone Numbers/Profile read-only and the existing authorized Graph client to reconcile the active/pending name, phone registration and current API permission/subscription status. Do not infer registration from Connected or quota from WAM Insights. If an authorized current read confirms registration expired or messaging scopes are missing, document the provider-prescribed repair and seek only that specific owner approval before action. Never request/share an OTP. No live send, callback/route change, campaign, migration, export, restore or deployment occurred.

Production migration history, approved encrypted backup/export, isolated restore, canonical D1 target, candidate routing, name review, registration verification and COD-compatible rollback remain separate gates. `0052` must not be applied and its API must not be deployed until the authorized backup, 0049/0050/0051 provenance and migration approval pass.

## Completion status

S0 remains **80% (8/10 audit units)**. S1 and S3 remain locally accepted; operational exit stages S2 and S4-S9 remain unaccepted. Overall **2/10 stage exits (20%)**. These are acceptance gates, not engineering-effort percentages or launch readiness. Final local validation: **534 Vitest passed/1 skipped across44 files**, focused reliability278/1, TypeScript/lint PASS, Node safety52/52, credential-scope dummy test PASS, API/Admin dry-runs PASS, production audit0, full audit six registered moderate dev findings retained, and Label Printer protected hashes923/923 identical. Final commit/push verification is reported in the task closeout. Live lead totals remain unavailable until an authorized encrypted export/restore and migration.
