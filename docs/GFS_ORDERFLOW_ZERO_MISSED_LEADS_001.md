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

- Additive local migration `0052_whatsapp_lead_accounting_and_billing_incidents.sql` adds privacy-preserving inbound outcome, accepted-response, billable incident and active send-block ledgers. It follows 0049 → unchanged0050 → 0051 and is **not applied to production**.
- The signed webhook writes hashed inbound identity, received time, final outcome, exact reason code, eligibility/attempt/acceptance/delivery/read flags and response-attempt counts. Duplicate event IDs do not inflate received totals. Accepted provider-message IDs are hashed/deduplicated per inbound event; status callbacks advance delivery/read state without regression.
- Initial-reply outbox acceptance marks the job SENT. Retryable known non-acceptance is bounded through the existing Queue/DLQ path. Missing D1 returns 503; orphan Queue jobs are audited before acknowledgment; stale PROCESSING acceptance becomes unresolved and is never blindly replayed.
- Signed `source_type=ad` plus nonempty `ctwa_clid`, authenticated webhook evidence and provider timestamp inside the actual 24-hour service window permits exactly the one-time free CTWA opening response. Click IDs are hashed; no OS/device field, `source_platform`, test attestation or already-open FEP is needed. Missing referral evidence remains an unresolved lead, not a fabricated free send.
- Later FEP requires a response-correlated status, referral-conversion origin, actual provider expiry and explicit FEP/PMP pricing evidence. No expiry is synthesized.
- Explicit `pricing.billable=true` on DELIVERED/READ creates an idempotent hash-only incident, audit record and active per-recipient WhatsApp block in one D1 batch. The block applies centrally to automated WhatsApp sends. Admin displays an alert; there is no automatic resolution/resumption or paid fallback. Payment/order/COD/fulfillment processing is unchanged.
- Admin reliability analytics separate accepted from delivered/read and show unique inbound events, eligible, queued, accepted, delivered, read, failed, suppressed, unresolved, exact suppression reasons, backlog/DLQ, retry attempts, duplicate accepted responses, accepted/eligible coverage, p50/p95 latency, and currently active billing incidents. A missing migration returns an explicit unavailable state. The Admin is read-only.

## Monthly service allowance decision

The monthly service-message path is disabled for all recipients. Meta/WAM insights are approximate, report after-the-fact totals and cannot establish exact current balance across human inbox activity, other Workers, external API callers or shared senders. Local atomic counting would cover only this Worker and could overstate remaining quota. No approximate dashboard number authorizes a send. Re-enable only with an authoritative exact pre-send phone/month quota plus tested atomic reservations and idempotency across every sender. FEP and the one-time qualifying CTWA opening basis remain separate.

## Legacy/candidate synthetic coverage

The authenticated Cloudflare deployment history maps production version `b426ba47` to source commit `901f3f6` (GFS-309). Its verified outbound reply path gates on the 24-hour service window before sending and has no comparable FEP/pricing decision. The identical sanitized fixture test uses that exact legacy service-window predicate and executes the candidate API with a deterministic mocked provider:

| Measure | Legacy b426 CSW attempt model | Candidate synthetic result |
|---|---:|---:|
| Unique inbound provider events | 7 | 7 |
| In-window attempts/eligible | 7 attempts | 5 eligible, 5 attempted |
| Provider accepted | Not established by legacy source/model | 5 |
| Delivered / read | Not established by legacy source/model | 5 / 2 |
| Suppressed | Not priced/classified by legacy source/model | 0 |
| Unresolved | Not durably classified by legacy source/model | 2: new and returning events without signed referral/free evidence |
| Duplicate accepted replies | Not measured in legacy history | 0; duplicate event replay adds no send |

The five signed CTWA fixtures omit device/platform fields. All five eligible leads reached a mocked provider-accepted and delivered outcome (100% synthetic eligible coverage). The two no-referral cases remain unresolved with exact reason `FREE_BILLING_UNKNOWN_OR_MISMATCHED`; no paid message is sent. The legacy “attempts” column is a source-based decision comparison only, not historical provider acceptance/delivery or live coverage. User locale and payment journey formatting remain covered by bilingual guided/COD/Advance tests. D1/Queue failure, stale processing, duplicate events, concurrent test-budget admission, expired FEP and disabled monthly allowance are covered by focused suites; the isolated 10-attempt cap does not apply to ordinary production routes.

## External live gates

The current read-only Meta Phone Manager UI shows display name **Rejected**, phone **Connected**, and quality **High**. It does not expose a separate registration-expiry field; the prior Graph `EXPIRED` status has not been refreshed. Meta Business Agent remains at **Set up**/disabled. No Meta settings were changed.

Exact recovery action: the owner selects the exact business/legal name that conforms to the linked website and Meta naming guidelines, opens WhatsApp Manager → Phone Numbers → Profile → Display name → Edit, then submits the owner-selected name for review. Do not guess a replacement name or submit without separate authorization. Refresh the registration state in the existing authenticated Meta UI/API; if registration is still expired, the owner completes the official registration flow privately. Never share an OTP or authentication factor. No live send, callback/route change, campaign, migration, export, restore or deployment occurred.

Production migration history, approved encrypted backup/export, isolated restore, canonical D1 target, candidate routing, name review, registration verification and COD-compatible rollback remain separate gates. `0052` must not be applied and its API must not be deployed until the authorized backup, 0049/0050/0051 provenance and migration approval pass.

## Completion status

S0 remains **80% (8/10 audit units)**. S1 and S3 remain locally accepted; operational exit stages S2 and S4-S9 remain unaccepted. Overall **2/10 stage exits (20%)**. These are acceptance gates, not engineering-effort percentages or launch readiness. Final local validation: **533 Vitest passed/1 skipped across44 files**, focused reliability278/1, TypeScript/lint PASS, Node safety52/52, credential-scope dummy test PASS, API/Admin dry-runs PASS, production audit0, full audit six registered moderate dev findings retained, and Label Printer protected hashes923/923 identical. Final commit/push verification is reported in the task closeout. Live lead totals remain unavailable until a separately authorized migration/deployment.
