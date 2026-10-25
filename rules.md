# Get Free Seeds Binding Rules

## GFS-217 Approved COD / Simple Checkout Boundary (2026-10-25)

- The approved customer-flow change is now: `PAY_COD` emits one itemized COD summary with `Confirm COD Order` and `Advance Payment`; the latter enters the three advance methods directly. Existing order/idempotency/COD snapshot safeguards remain authoritative. Legacy `COD_FEE_WARNING` handling remains only for already-open conversations and must not be entered by new sessions.
- A user authorization to reuse an existing COD contract does not substitute for an independently visible contract record, signed Meta credentials, canonical sender Contact Info, or a public signed webhook. This execution found no COD contract row/audit record in shared or V2 D1, no Meta secrets on V2, and `workers_dev=false` with no API route. Do not copy secret values from another Worker, expose an unauthenticated API, enable provider/COD flags, or send live messages until those existing records are visibly verified.
- The exact tester identity was reverified in WhatsApp Profile against the authorized record. Meta top-level labels showed Free Seeds/Creeper Seeds and no Hoja asset, but canonical sender Contact Info and signed webhook routing were not independently confirmed. No WAMID or live launch is valid from this execution.

## GFS-216 Final COD/WhatsApp Acceptance (2026-10-25)

- The active Codex host is `CODEX_HOME=D:\\AI-Tools\\Codex\\home`; `codex mcp list` is authoritative for this environment. Replace stale `chrome_devtools` registrations rather than adding duplicates. The supported `chrome-devtools` server now exposes `list_pages`, page snapshots, read-only identity checks, visible UI actions, dialogs, and network status through a fresh Codex process. Do not use raw CDP or direct dashboard HTTP as a browser substitute.
- The correct isolated Admin URL is `https://getfreeseeds-v2-admin-staging.get-free-seeds.workers.dev`; the similarly named legacy `getfreeseeds-admin-staging` URL is not V2 and must never be used for V2 fixtures. If a V2 page reports `PRODUCTION_INTEGRATION_READY`, stop and audit target selection before any write.
- GFS-216 isolated COD and payment fixtures are test-only and must be removed after evidence capture. COD runtime is now disabled, the dedicated test HMAC secret is deleted, and no public COD/WhatsApp launch is authorized without genuine courier collection/remittance and Meta sender/webhook gates.

## GFS-215 Chrome MCP Acceptance Boundary (2026-10-25)

- The supported Chrome MCP configuration is enabled through Kilo's global `chrome_devtools` server using `npx -y chrome-devtools-mcp@latest --autoConnect`. A direct diagnostic start of official `chrome-devtools-mcp@1.12.0` connected to the existing Chrome, but the active Codex agent exposed no Chrome MCP action namespace. Until a fresh MCP-enabled agent exposes `list_pages` and page-scoped actions, browser acceptance is `PLATFORM_BLOCKED`; never substitute raw CDP, direct dashboard HTTP, shell browser automation, a new profile, or unauthenticated requests.
- The mandatory recovery procedure is: verify loaded Kilo MCP config, package/version, Chrome process and endpoint; restart only the official MCP bridge; verify initialization, `list_pages`, and a read-only page inspection in a fresh MCP-enabled session. Reuse existing authenticated tabs and verify the visible account before every mutation. This execution reached bridge connection but not action exposure, so no browser mutation or live evidence is valid.
- Use the explicit V2 package commands (`dev:api:v2`, `dev:admin:v2`, `deploy:api:v2`, `deploy:admin:v2`, and `dry-run:*:v2`) for isolated V2 work. Existing V1 commands remain bound to the shared/frozen path and must not be used for PR #9 acceptance. V2 current-head deployment still requires the browser retest and release gates.

## GFS-212 Repair Authority and Protocol Precedence (2026-10-25)

- GFS-212 authorizes targeted repairs, local regressions and PR #9 updates on `codex/gfs-v2-payments-reminders-001`; it is not authority to change frozen V1 `d816ba1`, approve real funds, enable COD, migrate shared V1 D1, spend, or release to production. Preserve `images/`, receipts, financial/audit history, rollback versions and the incident hold.
- Newer verified rules on this V2 branch supersede historical default-branch onboarding/number instructions. Do not merge old rules over them. Canonical GFS identities, the new-number WhatsApp lock, Hoja zero-connection rule, signed webhook, Access, service-window, beneficiary and release gates are unchanged. Dated status observations are evidence at that time, not permission or a current health guarantee.
- `COD_V2_ENABLED` controls new COD intake only. Persisted COD obligations must remain recognizable when intake is disabled: no advance QR/receipt/reminder path; collection and remittance remain separately verified, audited and conditional. Intake requires valid policy, enabled D1 province, courier collection/remittance approval, secret readiness and explicit enablement/release gates.
- OFFER text and media must agree with actual payment availability. A compatibility fallback must suppress its unverified/stale media; compatible published CMS content remains authoritative. Never infer an image's payment claim from its filename, and never advertise disabled COD or promise unverified shipment.
- Prices come from D1 snapshots: seed + selected fertilizer + province delivery + configured COD collection fee. PKR125 is the COD setting default, not a provincial tariff. Keep delivery and collection fees distinct. Flag known city/province conflicts and request correction without rewriting addresses or changing a historical quote.
- V2 Admin presents one `Confirm Paid` action only after authenticated independent receiving-account credit verification. The genuine unique transaction reference, exact method/amount/receipt/order binding, Access/CSRF, audit, atomicity and idempotency remain mandatory; a supplementary settlement-reference field is optional. A receipt, button, checkbox or fabricated reference never proves actual credit. The reported real order remains read-only absent that evidence.
- Source-only and synthetic acceptance are not live fixes, Meta WAMID evidence, credit or shipment. Mandatory browser acceptance uses exposed Chrome DevTools MCP tools and verified existing identities; do not replace missing tools with raw CDP, another profile, or unauthenticated dashboard requests. Continue safe source/test/PR work when external gates are blocked.

## GFS-214 Payment Selection and Admin Confirmation (2026-10-25)

- Guided checkout reuses the already-created provisional review order. First offer `Advance Payment` and `COD` only when V2 eligibility, policy, HMAC-secret readiness, verified courier collection/remittance and the selected enabled D1 province all pass. Advance selection then offers only verified JazzCash/Easypaisa/Bank Transfer; COD warning then explicit COD quote/confirmation. COD `Back to Payment` returns to advance methods and clears the COD fee from the provisional order without duplicating order/receipt/payment rows.
- Maintain exact server-side quote snapshot: seed PKR0 + actual fertilizer item if selected + saved province fee + configurable COD fee default125. Example Balochistan350 + fertilizer250 = advance600/COD725. Never hardcode observed rates. Correct province/city mismatch only through customer correction before creating/finalizing an order; never silently rewrite address or quote. Unknown cities are not guessed.
- `Confirm Paid` is a single authenticated V2 reviewer action with exact current receipt/order/method/amount and a unique genuine transaction reference plus attestation that actual credit was independently checked. Supplemental evidence reference is optional. No screenshot, receipt, checkbox, synthetic test, or order number alone is financial proof. COD stays unpaid until independent collection and remittance reconciliation.
- `PAYMENT_CONFIRMATION_V2_UI_ENABLED` controls isolated Admin action visibility separately from outbound `PAYMENT_CONFIRMATION_V2_ENABLED`; notifications remain disabled during source/browser-gate work. Do not deploy a UI flag or promote a PAID action without the required authenticated browser retest.
- Every callback path (advance, COD warning, summary, back, confirm/cancel, receipt, reminder) must be idempotent and conditional; only one winning transition/audit is accepted. Verify disabled-intake historical COD still rejects advance receipt/reminders without exposing V1 to the V2 table/schema.

## GFS-210 Payment Review and Fulfillment (2026-10-24)

- Reverified WhatsApp **You > View Profile**, canonical GFS **Contact Info**, Admin Access and Cloudflare account. Current tester and GFS sender match the approved identities. Do not use display-name-only matches or any Hoja asset.
- `FS-261024-000005` is a non-payment test image. Preserve its JPEG/private R2/D1 receipt and history; keep `PAYMENT_REVIEW`/`PENDING`. The V1 Admin clearer-receipt request used audit reason `TEST_IMAGE_NOT_PAYMENT_PROOF`; localized notice was sent and reached READ. This is transport/review messaging, not evidence of funds.
- Never mark a real order `PAID` without independently verified credit in the receiving wallet/bank and an authenticated Admin attestation. An empty Confirmed Payments queue plus no authenticated account evidence means P1 is blocked; synthetic PAID state is allowed only in the isolated V2 simulation and must be labeled/cleaned.
- V2 order-state tests are non-financial simulations only. Use `SIM-GFS210-` order numbers, explicit TEST ONLY / DO NOT SHIP notices and labels, separate terminal-path fixtures, and cleanup. Do not send customer messages unless V2 provider credentials, approved templates, service window, recipient and release authorization all pass.
- Keep V1 checkout frozen, V2 notifications/provider/template flags OFF unless separately approved, and Hoja isolation, private R2, prior payments, holds and `images/` untouched. Full WAMIDs/screenshots remain private outside Git.

## GFS-211 COD Consolidation and V2 Gate (2026-10-24)

- COD is V2-only. Keep `COD_V2_ENABLED=false`; do not modify the shared `PaymentMethod` type, frozen V1 checkout, shared payment migrations, or active V1 data.
- Canonical COD settings use the versioned shared `V2CodPolicy` format. Store a verification reference only as HMAC-SHA-256 under the dedicated `COD_POLICY_HMAC_KEY`; never persist/log the plaintext. A missing key, invalid policy, legacy/plaintext format, or missing provenance fails closed. Do not overwrite/migrate legacy state without a provenance-reviewed, explicit migration.
- COD customer totals must use the persisted seed/fertilizer selection, enabled D1 province delivery rate, and configured COD fee (default display Rs125); never hardcode a province charge. No receipt/QR/advance-payment request for COD. Keep `PAID` blocked until collection and remittance are independently reconciled.
- New additive `0034_cod_orders_v2.sql` was applied only to isolated V2 D1 `getfreeseeds-v2-staging` after verifying `gisupp@gmail.com` / Get Free Seeds, `PRAGMA quick_check=ok`, no FK violations, zero customers/orders/payments/receipts/COD-policy rows, zero province-rate rows, and the retained recovery D1 at migration 0033. The V1/shared D1 and migration history remain untouched. Do not drop the table or restore over later data; rollback is Worker-version rollback, retaining additive schema/history.
- Admin COD updates require the existing signed Cloudflare Access identity, CSRF, explicit owner confirmation to enable, audited write, and verified courier collection/remittance. Do not fabricate courier approval or enable COD before isolated E2E and explicit release authorization.
- Preserve new-number WhatsApp lock, Hoja Seeds zero-connection rule, held incidents, private R2, historical payment/order data, and `images/`. No COD setting enablement, CMS publish, public API route, Meta/WhatsApp message, or production deployment is authorized. Verify the authenticated GFS account before every further staging mutation; COD stays disabled until isolated acceptance and explicit release authorization.

## GFS-206 Active Receipt Hotfix Gate (2026-10-24)

- For a shared order with no linked `whatsapp_conversations` row, no exact inbound-event link, zero D1 receipt rows and no order-prefix R2 object, do not infer that a screenshot image was received or belongs to that order. READ/DELIVERED status for outbound payment text/QR is not inbound-receipt evidence.
- The V1-compatible candidate hotfix is separate from V2 scheduler work, adds no migration, and changes only media/order association, review/audit and safe R2 cleanup. It is a review PR only; do not merge or deploy to the active callback until the authorized WhatsApp tester and canonical GFS sender are independently verified, the exact inbound image is positively attributed, active bindings/traffic/rollback are preflighted, and the live retest is authorized.
- Candidate commit `bdef700` is on `codex/gfs206-v1-receipt-hotfix`, PR #10 against the frozen-release branch; the release branch/tag remains unchanged. No merge/deploy before release gates pass.
- V2 hashed diagnostic implementation/test commit `582cc16` and docs commits `f2fa23a`/`359f1ca` are pushed on PR #9; not an active webhook deployment. GitHub reports no CI checks.
- Isolated API diagnostics deploy `c714ac55-ef19-46b3-a803-e672460abc93` has Queue only, no Cron/public route/provider; shared active API remains `9b5f13ae` pending the release gate.
- Receipt diagnostics must hash message/media identifiers and record only stable reason/stage/count/correlation fields. Never log raw media, phone/WA IDs, content, access tokens or payment references. Never attach across orders; ambiguous media is rejected.
- Keep shared API/D1/R2, held incident, real payments and frozen V1 checkout untouched. Do not switch into Hoja-associated Meta assets or open unrelated chats. If profile or sender verification fails, no real image submission or acknowledgement is attempted.

## Permanent Cloud Cost and Resource Cleanup Protocol

- Before creating any Cloudflare, Meta, GitHub, or other hosted resource, inventory reusable resources, verify account/owner identity, inspect billing and quotas, and estimate setup plus recurring costs. Prefer an existing isolated resource when safe.
- Never purchase a plan or activate a paid feature without explicit user approval. Free-tier use still requires quota/cost review and cleanup planning.
- Register every temporary Worker, D1, R2 bucket, Queue/DLQ, Cron, Access app, and integration with owner, purpose, created-at time, cost/quota risk, dependencies, and a cleanup deadline. Use provider tags/description metadata where available and mirror them in `docs/RESOURCE_REGISTRY.md`.
- After testing, stop unneeded Cron triggers/Queue consumers first; inspect bindings, routes, Access policies, D1/R2 references, audit/financial data, and rollback dependencies; then delete temporary resources only through authorized account tools.
- Never delete active V1/V2 resources, genuine customer/payment data, required audit evidence, necessary rollback backups, or a resource still referenced by a Worker/Access route. Preserve holds and financial history.
- Review GFS-204 `getfreeseeds-v2-restore-check`, isolated R2, Queue/DLQ, and Workers for cost and necessity. Keep resources required for V2 acceptance; mark any retained non-production resource with its next review/cleanup date.
- After successful acceptance, remove disposable clones, temporary databases/buckets/queues, and other unneeded test infrastructure; verify deletion in the authorized dashboard/CLI and record evidence.
- Record completed cleanup, retained assets/dependencies, expected or observed charges, quota usage, and billing observations in `docs/RESOURCE_REGISTRY.md` and `docs/FINAL_REPORT.md`. Do not claim zero cost without billing evidence.
- If cleanup is blocked by outage, Access, ownership, or dependencies, disable avoidable charge-generating work (especially Cron/consumers), leave necessary rollback resources intact, and record the exact blocker and next review date.
- This protocol is mandatory for all future agents, test runs, deployments, and account integrations.

## GFS-205 Receipt Diagnosis, Cost Review, and Staging State (2026-10-24)

- The new shared-staging order is payment-linked and PAYMENT_PENDING for JazzCash PKR 600, but D1 has zero exact payment/order receipt rows, no saved reference, no receipt audit, no `whatsapp_conversations` row/last-inbound ID, and no matching object under its private R2 order prefix. Admin's zero-receipt display matches D1; this is not stale Admin rendering.
- Do not infer whether a WhatsApp image was delivered or belongs to this order. Current event storage retains hashes, not the inbound media body/ID; the authenticated tester Profile still mismatches the authorized tester and the open Meta tabs are Hoja-associated. Do not open chats, switch identities, or attach media by guess.
- Receipt code resolves exact payment-reply context first; with no context it permits a unique eligible sender/payment match even when a newly created conversation is `NEW`/missing, and fails closed if multiple orders match. The receipt enters REVIEW and pauses its schedule before attachment; tests cover unique-new-conversation and ambiguous-order cases. The fix is in V2 source only; the shared V1/API webhook was not changed.
- Access-protected isolated V2 Admin now includes Orders/Payment Reminders. The isolated D1 contains no genuine orders. A clearly synthetic no-receipt timeline order was used for the screenshot, then its orders/payment/item/conversation/schedule/stages were deleted and zero counts verified. No fake receipt, PAID state, or message was created.
- Test-only EN/UR versions are published in isolated D1 (`REMINDER_15M` and `PAYMENT_CONFIRMED`); remaining stage templates stay drafts. All API send, automation, confirmation, provider, utility-template flags are OFF. Admin reminder-history/CMS view is enabled only in isolated Admin; this is not approval to send.
- Isolated API Cron is removed while automation is OFF; Queue consumer remains idle for later acceptance. Retain primary/recovery D1, private R2, Queue/DLQ, Workers and existing Access integration until V2 acceptance. Review retained isolated resources by 2026-11-23; no resource/plan deletion or purchase without dependency and billing review.

## GFS-204 Simple Credit Confirmation and Isolated Deployment (2026-10-23)

- Final safety follow-up `7938dd2e153ffd9920e902f2b2971079f5a73899` is pushed to PR #9; it stops V2 reminder jobs at PAID even when the send flag is OFF, if the V2 schema exists. V1 databases without V2 schema are unaffected.

- The reported receipt-backed Easypaisa order was re-read in authenticated Admin: it remains `PAYMENT_REVIEW`/`PENDING`, has one receipt, saved reference and verified payment method. No wallet/bank credit was confirmed; never mark this or any real order PAID without the Admin's truthful checked attestation after checking the actual Garden Shop account. Leave REVIEW otherwise.
- V2 confirmation requires the associated order/payment, exact expected amount, saved transaction reference, verified method, receipt, REVIEW state and explicit checked credit attestation. A separate opaque settlement evidence reference is optional and stored only as a hash. Attestation, reviewer/time/method/amount/reference hash, PAID transition and stop-pending-reminders updates are audited/atomic; retries must not duplicate money transitions or confirmation jobs.
- Real PAID notifications are only enqueued after authorized approval and remain subject to the original customer's identity, WhatsApp service window/template approval, opt-out and idempotency. No real payment/receipt/transaction data belongs in source, logs, tests, screenshots or docs.
- GFS-204 isolated staging resources are `getfreeseeds-v2-staging` D1, `getfreeseeds-v2-receipts-staging` private R2, `getfreeseeds-v2-events-staging` plus its DLQ, and separately deployed V2 API/Admin Workers. Schema 0001-0033 is applied only to isolated D1/recovery clone. Shared staging/V1 bindings and migration ledger remain untouched.
- All V2 messaging/confirmation/reminder flags are OFF. API has no public workers.dev route. The isolated Admin route returns `ACCESS_JWT_REQUIRED` without a signed Cloudflare Access JWT; do not weaken this gate. It is not yet attached to the authorized Admin Access app because the Cloudflare dashboard reports a Workers outage and its Access editor did not safely expose the new Worker. Do not change or replace the existing Admin destination.
- Chrome `You > View Profile` tester identity still mismatches the authorized tester in these rules. Do not open chats, send, switch/relink accounts, approve real funds, publish Meta templates or use the Hoja-associated Meta tabs. V2 Admin promotion/live acceptance waits for correct Access attachment and authorized tester/Meta verification.
- Preserve held incident `FS-261019-000001`, all history, frozen V1 `d816ba1`, PR #8, `images/`, private R2, canonical GFS sender, Hoja Seeds zero-connection boundary and new-number WhatsApp lock.
- GFS-204 source/tests/docs are pushed to PR #9 as `c8c4edd2d60fe72771c9282d392f1f167ead5a7`. GitHub has no CI checks; this does not clear the Access, real-credit, Meta identity or live messaging gates.

## GFS-202 Receipt and Reminder Safety (2026-10-23)

- The Admin evidence shows distinct records: one JazzCash `PAYMENT_PENDING` order with zero receipt rows, and a separate Easypaisa `PAYMENT_REVIEW` order with one receipt and a saved reference. Never treat a screenshot/conversation image as evidence for either order without matching authenticated sender, inbound message, payment and stored receipt associations.
- Receipt association uses an exact reply-to outbound payment message when present. Without reply context, require one eligible unpaid order for the sender and a matching active order; ambiguous media is not downloaded/attached. Never reassign across orders without authenticated, auditable evidence.
- Keep genuine submitted receipts in REVIEW and pause the V2 schedule immediately. Reference text alone is not receipt/settlement evidence. After cancellation, retain late media as LATE_REVIEW; never mark PAID automatically.
- Admin receipt totals/status/upload time/private preview and per-order reminder history are V2 source changes only until isolated staging and identity gates pass. Do not expose receipt media publicly or include customer/WAMID/settlement data in source, tests, logs, screenshots, or docs.
- Receipt source fix is synthetic-test verified only. The WhatsApp tester Profile mismatch and shared D1 ledger remain live gates; do not deploy or inspect customer chats to infer which image belongs to which order.
- Reminder delivery history records actual text, locale, CMS version, sent time and provider status only after send success. A newly published copy is for eligible unsent stages; a selected-order updated notice must show its exact preview, require authenticated/audited confirmation and remain subject to opt-out, service-window/template and idempotency gates.
- Migration `0032_payment_reminder_delivery_history.sql` is source only. The shared staging database remains forbidden for V2 schema/deployment; require isolated D1, backup/restore proof and a validated migration path.
- GFS-202 source/tests/docs are pushed as `046565478bea5a4d49c286b83364f48457a792bd` to PR #9. GitHub reports no CI checks; this is not deployment approval.

## GFS-201 V2 Payment/Reminder Release Gate (2026-10-23)

- Frozen V1 source is commit `d816ba17e6ef14e15400141ea34e734ac9d0a9c8`, branch/tag `release/gfs-v1-frozen-20261023`. Do not modify or recreate it. V2 implementation commit is `2c404d17f1b01a0da0201da93b2e1078d96af045` on separate `codex/gfs-v2-payments-reminders-001`; PR #9 is open against frozen V1. Do not merge/deploy until release gates pass. PR #8 is unchanged.
- Preserve the existing payment delivery fix: `SENT`/`DELIVERED`/`READ` and provider IDs are idempotent success; check completed QR child status before any R2 read; never replay terminal jobs or delivered messages.
- Never approve from receipt/reference alone. One live REVIEW currently has a receipt, saved reference, verified method and matching order amount, but no independently confirmed receiving-account credit. Keep REVIEW; no real funds, PAID, fulfillment or payment-confirmation WAMID is evidenced.
- The Admin one-button confirmation and V2 reminder/confirmation engine are source-only. All API V2 flags remain `false`; the connected `getfreeseeds-staging` D1 is shared with the active Worker. Wrangler reports migrations 0001-0031 pending against its legacy empty migration ledger. Do not apply/replay migrations or deploy against that database. Require a verified isolated V2 D1, backup/rollback and schema checks first.
- Current live Worker versions at GFS-201 read-only preflight: API `9b5f13ae-f023-4fa8-befe-2085bb24cbda` (previous `8da54b28-4bec-45b2-9a3f-672225dba843`); Admin `9482bd56-ca4c-4d81-b2e3-6bfe59162ac0` (previous `132f5ea9-324f-482d-b350-f52bc6907758`). Existing published CMS is OFFER5/RECEIPT2/PAYMENT2/FERTILIZER7; V2 utility templates are not Meta-approved.
- Current Chrome `You > View Profile` did not match the authorized tester recorded in these rules. Stop before opening chats, switching/relinking accounts, sending, deploying callbacks or submitting templates. Reverify the tester's own profile and separately verify canonical sender Contact Info before any real send. No identity mismatch authorizes a number/profile change.
- GitHub `gardenshop` and Cloudflare `gisupp@gmail.com` identities were verified read-only. Do not bypass the GitHub billing lock. Keep the protected incident, `images/`, private R2, historical orders/payments, canonical sender, no-Hoja rule and new-number WhatsApp lock unchanged.
- Local acceptance is not live payment acceptance. Synthetic PAID, WAMID, reminder, receipt, callback or cancellation tests must remain labeled synthetic; never report them as real customer/provider evidence.

## GFS-199 Verified OFFER Protocol (2026-10-23)

- Verify the tester through **You > View Profile**, where the own phone is visible. You/Settings/Account alone may hide it; missing digits there are not proof of a different account. Compare the exact own phone and separately confirm the canonical GFS phone through Contact Info. Never switch/relink accounts to satisfy a check.
- API `9b5f13ae-f023-4fa8-befe-2085bb24cbda` implements LANGUAGE -> OFFER -> CONTINUE_ORDER -> FERTILIZER. OFFER owns its text/image and exactly CONTINUE_ORDER/CANCEL_ORDER. FERTILIZER owns its own media; never attach OFFER media as a substitute for OFFER state.
- Published CMS is OFFER v5, RECEIPT v2, PAYMENT v2, FERTILIZER v7. English fertilizer labels are Add Fertilizer / Seeds Only; preserve approved Urdu copy and dynamic D1 prices/fees.
- CANCEL_ORDER is accepted only in OFFER and creates no order/payment; START after cancellation returns LANGUAGE. A stale OFFER Cancel after Continue must not cancel a later state or existing order. Test resets remain authenticated, tester-only and history-preserving.
- GFS-199 proves new real EN/UR OFFER and pre-payment checkout, not confirmed funds. Keep complete WAMIDs/cropped screenshots privately outside Git. No receipt/reference/funds/PAID/fulfillment may be inferred from a delivered QR.
- At close, all three test payment text/QR parts were READ but instruction queue jobs were DEAD_LETTER/PAYMENT_TEXT_DELIVERY_FAILED. Preserve terminal jobs; do not replay or claim full payment acceptance until this reconciliation defect is independently repaired/retested.
- Immediate API rollback is `8da54b28-4bec-45b2-9a3f-672225dba843`; CMS rollback OFFER v4/RECEIPT v1/FERTILIZER v6. Coordinate rollback because the old API lacks OFFER/reference callbacks; retain additive D1 schema and all financial history.

## GFS-197 OFFER API Deployment Gate (2026-10-23)

- The authenticated Admin profile does not substitute for the approved WhatsApp tester. Before any callback/API deployment or real outbound E2E, verify the tester's OWN WhatsApp Profile Phone against the authorized tester in these rules and verify the GFS sender via Contact Info. If either fails, stop; never switch/relink/create a number/profile or send to another contact.
- Active API `8da54b28` predates the OFFER action/state flow and new receipt-reference handling. Keep OFFER/RECEIPT v5/v2 as drafts and do not publish incompatible content until the matching API is deployed and retested.
- The current receipt-backed REVIEW has no transaction reference, a closed service window and no approved utility template. Admin Request Reference remains disabled; do not send or mark PAID. Await a genuine reference, actual receiving-account credit and authorized evidence.
- Preserve the three approved methods and recipient-bound QR evidence; no screenshots/old WAMIDs are substitutes for a new live test. Payment transfer/PAID/fulfillment remain separate authorization gates.

## GFS-196 OFFER Release and Tester Lock (2026-10-23)

- The current deployed API predates the stable OFFER Continue/Cancel flow and customer transaction-reference capture. Never publish OFFER/RECEIPT drafts or expose new customer-facing callbacks on that API version.
- API/webhook rollout requires the authorized tester's OWN WhatsApp Profile Phone to match the tester in these rules. A different/hidden Profile is a hard stop; do not switch, relink, create a Profile, or message a different contact to create a superficial PASS.
- Keep the GFS-195 Admin reference/settlement gate deployed and fail-closed. Reference requests require a proven open 24-hour window or an approved utility template; an Admin button must not imply dispatch when the queue is disabled.
- Saved CMS drafts are not published. Do not publish EN/UR OFFER/RECEIPT action labels or copy until matching API code is deployed and authenticated real Chrome output can be retested.
- Preserve the three previously audited/approved method configurations, their current QR hashes, enabled state, settlement proof requirements, and all payment/incident history. No transfer, PAID or fulfillment without genuine provider-credit evidence and authorized review.

## GFS-196 OFFER Release and Tester Lock (2026-10-23)

- The current deployed API predates the stable OFFER Continue/Cancel flow and customer transaction-reference capture. Never publish OFFER/RECEIPT drafts or expose new customer-facing callbacks on that API version.
- API/webhook rollout requires the authorized tester's OWN WhatsApp Profile Phone to match the tester in these rules. A different/hidden Profile is a hard stop; do not switch, relink, create a Profile, or message a different contact to create a superficial PASS.
- Keep the GFS-195 Admin reference/settlement gate deployed and fail-closed. Reference requests require a verified open 24-hour window or an approved utility template; an Admin button must not imply dispatch when the queue is disabled.
- Saved CMS drafts are not published. Do not publish EN/UR OFFER/RECEIPT action labels or copy until matching API code is deployed and authenticated real Chrome output can be retested.
- Preserve the three previously audited/approved method configurations, their current QR hashes, enabled state, settlement proof requirements, and all payment/incident history. No transfer, PAID or fulfillment without genuine provider-credit evidence and authorized review.

## GFS-195 Reference and OFFER Safeguards (2026-10-22)

- Admin may store a normalized customer transaction reference only on its receipt-backed PAYMENT_REVIEW payment, bound to the matching order, method and exact persisted total. Database uniqueness, Admin checks and customer normalization must use the same case/ASCII-whitespace canonical form, including legacy values with internal spaces. Audit stores a hash, actor, time and order/payment association; do not log the raw reference.
- A reference is not settlement proof. PAID requires the associated receipt, saved genuine reference, persisted order amount, currently approved receiving destination, authenticated Admin review of actual account credit, and a non-sensitive settlement evidence reference. The API must atomically record payment/order/audit state. CAPI remains disabled unless explicitly configured.
- Request Reference may send only inside a proven open service window or via an approved utility template. Admin shows a clear closed-window/API-not-deployed blocker and must not enqueue a request when either condition fails. Historical age and conversation.updated_at never open a window.
- On receipt, keep order/payment at PAYMENT_REVIEW while requesting the genuine reference in the customer's language. Do not mark paid from media, reference alone, or an Admin checkbox without provider-account credit verification.
- OFFER quick replies are exactly stable `CONTINUE_ORDER` and `CANCEL_ORDER`. Continue alone opens FERTILIZER; cancel clears only the unsubmitted entry, creates no order/payment/CAPI/dispatch, and START restarts. Preserve the payment selector allowlist and separate Check Order status action.
- Do not deploy webhook/offer changes or publish changed customer-facing copy until the authorized tester profile matches the project rule. Never switch numbers/create profiles to bypass this lock. Drafts are safe; publication is not.
- Directly apply only the narrow versioned migrations after duplicate/reference and D1 backup/integrity preflight. Never replay the empty legacy ledger or invent history.

## GFS-193 Owner-Supplied QR Evidence Limit (2026-10-22)

- Generic QR-scanner screenshots are supporting evidence of encoded payload only. They do not independently authenticate the destination or prove that the encoded merchant/wallet/bank account belongs to Garden Shop. Never approve from an owner-uploaded scanner screen alone.
- For each method, approve once only after an authenticated provider/bank record or a separately authorized and independently confirmed settlement links the exact decoded destination to Garden Shop. The one-time workflow is available, but keep all methods disabled until that evidence is reviewed against the current recipient-bound QR snapshot.
- JazzCash still needs an official till-ownership link even when the displayed Garden Shop payload matches the configured draft. Easypaisa still needs the official alias-to-Garden-Shop destination mapping. A Bank Alfalah/ALFH payload or partial identifier without the beneficiary name needs an authenticated bank payee record matching the exact QR/Raast/IBAN destination.
- Do not rescan, re-upload, replace a QR, expose raw payment identifiers, accept a mismatched destination, or repeat provider searches. When the account portal/record is absent, report the exact missing provider record once; no transfer or account switch to create synthetic verification.
- GFS-193 reused CMS v2 and deployed Workers from GFS-192. Current new scan evidence does not qualify any method, so no payment selector/QR/receipt stage can be newly accepted. Keep previous lead-only WAMIDs/screenshots separate from financial acceptance.

## GFS-192 Live Staging Protocol (2026-10-22)

- Current deployed state supersedes GFS-191: migration0026 was applied once after direct `PRAGMA table_info` proved the column absent. Do not infer schema from an old Admin JSON response. Never replay the 26 pending migrations or fabricate historical ledger rows; the legacy `d1_migrations` table remains empty.
- Use Cloudflare-supported `PRAGMA quick_check` and `PRAGMA foreign_key_check` for D1 preflight. `PRAGMA integrity_check` is not in D1's supported list; its SQLITE_AUTH failure does not by itself prove missing account permissions. API7403 was not reproduced in GFS-192; do not change accounts or widen scopes on transient errors.
- Migration0026 is nullable/no-backfill. Fresh signed tester messages now populate last_inbound_at; historical timestamps must remain unknown. Preserve existing orders and held incident. Never infer customer windows from aggregate traffic or changed conversation state.
- The deployed beneficiary-review UI/API binds the reviewed recipient/account/copy/QR state to a SHA-256 snapshot. Stale snapshots, concurrent losing reviews and failed audit/enablement must roll back; one approval records opaque provider reference, authenticated reviewer, server time, QR hash and recipient-bound snapshot. Do not repeat approval for an unchanged approved destination. Never approve from owner confirmation alone.
- PAYMENT CMS v2 is published in EN/UR with `{orderNumber}` and authoritative `{amount}`. Runtime must use persisted order totals; a global fixed advance is not checkout evidence. Zero verified enabled methods must show no payable buttons or QR and no payment request. Check Order remains separately available under order status.
- GFS-192 live evidence is lead-only: one English test order and partial Urdu regression, not a payment checkout. No receipt, transfer, PAID or fulfillment is authorized by this evidence. Keep full WAMIDs and cropped screenshots in private external evidence storage, never source control.
- Roll back Workers/CMS through supported version controls; retain the additive timestamp column. Time Travel bookmark is recovery evidence, not approval to restore over subsequent orders. Database restoration requires an independently approved incident procedure with writes quiesced.

## GFS-191 Payment Activation and Checkout (2026-10-22)

- An owner's statement that an account/QR belongs to Garden Shop is not independent proof of the QR's decoded beneficiary. Reconcile each exact destination to an authenticated provider/bank record, or a separately authorized and confirmed settlement. Never infer an alias or IBAN/Raast mismatch is harmless.
- Approve once per unchanged payment destination only after the independent source is reviewed. Record method, non-sensitive evidence reference, authenticated reviewer, server time, and current QR hash in the protected audit path. A changed recipient/account/QR automatically invalidates approval. Never write verification flags directly or invent references.
- Keep each method disabled until recipient, both-language copy, required identifiers/placeholders, and current private QR integrity/ownership all pass. Enable a qualifying method immediately after approval; do not wait for other methods.
- `{amount}` in the PAYMENT introduction must be rendered from the persisted order summary, never from user input, a global hardcoded amount, or a mutable preview.
- Wrangler may report every migration pending when its D1 migration ledger is absent even though application schema exists. Confirm field presence through a read path and do not replay a full pending migration list against a populated database. Do not repair migration history by blind inserts or direct SQL bypass.
- Before Worker deployment, verify authenticated GFS identity, active bindings, application/D1 health, rollback version, and a clean regression. When direct D1 integrity/query access returns API7403, do not switch accounts or widen scopes; use existing authorized read-only Admin APIs for diagnosis and stop before writes/deploys if integrity cannot be established.
- Do not send payment instructions without a verified enabled method and a proven open 24-hour window or approved template. Never claim simulation as live WhatsApp evidence; PAID still requires real funds, unique reference, and authorized approval.

## GFS-190 Emergency Payment Recovery (2026-10-22)

- A successful supported `chrome_devtools.list_pages` call proves the Chrome MCP tool path is available for this session; it does not prove authenticated identity on every already-open service page. Reuse matching tabs, verify the active account before mutations, and stop if the Admin/Cloudflare Access identity is not visible.
- Cloudflare Wrangler identity and dashboard/API identity are separate checks. Do not switch accounts or broaden scopes on API7403; test the authorized account through a read-only staging D1 query and record which surface succeeds. Never infer dashboard authorization from `wrangler whoami` alone.
- D1 staging still requires independently verified Garden Shop beneficiary evidence and a complete, published payment configuration. QR integrity flags, active D1 provenance, owner attestation, and a visible QR are not beneficiary proof. Keep all methods disabled until the protected evidence-review workflow records independent proof and audit.
- Existing pending orders must not be contacted based on order age, a recent aggregate webhook timestamp, or `conversation.updated_at`. Migration0026 is not applied in the recorded GFS-190 execution; no inbound service window is established for historical orders. Require a proven signed inbound timestamp or an approved utility template.
- An additive migration or Worker deployment affecting the active WhatsApp callback still requires verified bindings, D1 integrity/rollback, clean local regression, authenticated Admin/Meta/tester identity, and a real Chrome retest. Do not deploy or claim live recovery when any of these prerequisites is unavailable.
- Never record raw D1 payment identifiers, customer data, QR bytes, Access/OAuth challenges, or credentials in logs, screenshots, tests, or documentation.

## GFS-189 Service-Window and Messaging Controls

- Migration0026 adds nullable `whatsapp_conversations.last_inbound_at`, with no historical backfill. Populate only after HMAC signature and canonical callback Phone ID validation, from the first unique `whatsapp_events.created_at` server receipt timestamp. Duplicate provider IDs keep their original time; status/outbound events never extend the service window.
- Before any free-form reply/payment text, compare the source inbound event against the strict 24-hour boundary. Direct and queued payment instructions also require a current conversation timestamp. Missing/invalid/future/expired timestamp is closed. If no approved utility template is configured, permanently block and audit; never retry terminal history or send stale details.
- A later authentic customer inbound opens a new window. Order creation, `conversation.updated_at`, order ID, owner statement or outbound delivery is not proof of inbound time/consent. Old conversations remain NULL until new authenticated inbound activity.
- WhatsApp payment outbox keys include a hash of the triggering message ID; the same inbound retry keeps the same key, while a new authorized customer method-selection message creates a distinct key. Text and QR parts derive from that request key. Never clear/rearm a terminal job to resend.
- Preserve service-window error/terminal status behavior on D1 deployment. Apply migration before the Worker, then verify signed webhook message updates, duplicate replay doesn't extend, status callbacks don't update, and the outbox doesn't send outside the window.

## GFS-189 Trusted Inbound Time and Service Window

- Migration0026 adds nullable `whatsapp_conversations.last_inbound_at` with no historic backfill. Set it only after the signed WhatsApp webhook and canonical callback Phone ID pass. Use the first `whatsapp_events.created_at` server receipt time for the unique `message:<provider-id>`; `INSERT OR IGNORE` preserves that original time on duplicate delivery. Status/outbound/Flow-server callbacks alone never advance the timestamp.
- Do not infer historic inbound time from order creation, message ID, or conversation `updated_at`. Null/invalid/future/age>=24h means the free-form service window is closed.
- Before free-form replies, QR/payment messages, or queued payment-instruction retries, validate the exact persisted inbound timestamp. Outside the 24-hour window, use only an explicitly approved utility template. No approved template means permanently block/terminalize the outbox job with a safe reason and audit; never retry terminal history or send details without customer service eligibility.
- A new signed inbound message can open a fresh window. A duplicate old message cannot extend it. Message retries use the original event timestamp, not retry time. Historical rows remain null until a new authenticated inbound event; do not backfill.

## GFS-188 Pending Orders, Service Window, and Coexistence

- Before sending any payment details, publish the exact approved localized PAYMENT CMS introduction and then expose only enabled independently verified methods. Never bypass versioned Admin CMS with direct production D1 edits.
- Pending orders with no verified method receive no payment instructions. Do not infer a WhatsApp 24-hour service window from order age or conversation `updated_at`; current schema has `last_inbound_message_id` but no dedicated `last_inbound_at`. If the window cannot be proven, do not send free-form messages. Outside the window require an approved utility template. Never replay terminalized outbox jobs.
- Use each order's authoritative `total_payable`; never invent a fixed advance. A real transfer needs explicit method and amount authorization, independently confirmed funds, transaction reference, and authorized Admin approval before PAID/fulfillment.
- Do not register or migrate a second WhatsApp number until its owner, Business App age, country/provider Embedded Signup eligibility, and coexistence status are verified through supported Meta workflow. Preserve all app history. Manual support is a separate optional contact only after ownership verification and never a payment-selection button.
- Advertising verification must stay draft/preview-only. No campaign activation/spend without explicit budget and release approval.

## GFS-187 Admin Ownership Preservation and Redacted D1 Reads

- Admin Payment Settings copy-only updates change only localized copy/sort fields; they never touch recipient, till/account, enabled, QR metadata, or ownership evidence. This preserves independent QR verification and avoids firing financial triggers for unchanged state.
- If recipient name or identifier changes, force method disabled and owner flag false first in an audited fail-closed operation, save the new recipient details, and let migration0024 clear independent asset ownership/evidence. Return persisted state and indicate re-verification required. QR upload remains the only asset replacement path and resets ownership; preserve original/derivative/hash/provenance/private-preview synchronization.
- Never select or print raw payment identifiers in D1 diagnostics. Query only booleans, aggregate counts, or explicitly masked data. GFS-187's first broad D1 diagnostic output raw payment identifiers; they were not copied to source/docs, but owner review is required. Do not repeat or post the values.
- No new method may be enabled without an authenticated independent provider/bank record. Owner statement and QR integrity are not beneficiary proof. Do not perform real WhatsApp checkout or request a transfer without method verification and explicit amount authorization.
- If Chrome DevTools MCP/list_pages is unavailable, stop browser/E2E work and do not substitute raw CDP/debug ports. Do not deploy Admin payment changes without the required authenticated Chrome retest; keep staging methods disabled.

## GFS-186 Payment Harness and Security Recovery

- The browser payment lab is `tests/fixtures/nonpayable-checkout.html`, served only from `127.0.0.1` with the working directory restricted to `tests/fixtures`. Its CSP is `default-src 'none'` and `connect-src 'none'`; no Worker, D1, R2, Meta, WhatsApp, or real recipient is reachable. Order/receipt/review state is in memory only; receipt preview uses an object URL revoked on reset; page reload clears all state.
- All harness account names, identifiers, provinces, fees, totals, order IDs, receipts, QR-like images and approvals must be visibly marked TEST/NON-PAYABLE. QR-like fixture assets are intentionally NOT SCANNABLE and never contain or reuse real QR bytes. TEST approval is not PAID; TEST fulfillment is not dispatch. Never point a fixture at a real method, recipient, browser messaging profile, or database.
- Do not add Check Order, Help, or Support to payment-selection buttons; Check Order belongs only to later status. Actual customer methods continue to require enabled + complete localized settings + independent beneficiary evidence + method-matched active QR provenance. Do not change that gate to make fixtures work.
- GFS-186 verified Hoja is listed under Meta Business Integrations Removed, but bearer invalidation is not proven without using the token. Never test the compromised bearer. Account owner must confirm/revoke through Meta security controls before public release. Four unrelated integrations remain Removed; do not remove or reconnect them without each owner/provider's authorization.

## GFS-185 Meta Credential and Asset Isolation (2026-10-20)

- Never take a full accessibility snapshot or screenshot of Graph API Explorer when an access token can be rendered. If a token appears in MCP output, do not quote, copy, inspect, or use it; close the page and revoke it immediately through the narrowest app-scoped visible control. Verify only a token-free revocation state. Do not use a broad business-integration removal button if its target cannot be unambiguously anchored; confirm each exact app/domain before mutation.
- GFS-185 removed the Hoja Lead Integration through Meta's Business Integrations UI after its token was exposed in a rendered snapshot. Meta now shows it in Removed, but already-issued bearer invalidation is not independently confirmed; require account-owner confirmation/revocation before public release. Four unrelated integrations were also removed during that UI sequence (Wix Marketing Tools, Daraz Seller Center, WooCommerce by Meta, Zapier). Their Removed entries provide only View details, no Restore action. Do not reconnect them without their own provider authorization. Record this incident; never repeat broad list-index clicks.
- Clean Garden Shop dataset `1210750267244729` website allowlist must contain only authorized Garden Shop domains. GFS-185 removed `hojaseeds.pk` and `hojaseeds.pages.dev`; preserve `gardenshopfreeseeds.netlify.app`. Verify exact dialog domain before confirming removals.
- Meta says generating a Dataset Quality API token will grant permission to previously generated tokens. Do not click it as a shortcut to CAPI least privilege. Require a documented clean GFS system-user/app token with dataset permission and explicit consent, then send a new Lead Test Event. Never use a Hoja token/app/dataset. Keep Lead CAPI OFF until every gate passes and keep Purchase CAPI OFF until financial readiness.
- An existing WhatsApp Graph token secret is not evidence of Marketing API/dataset permission. Secret presence is not authorization; never print secret values. Current sanitized permissions show WhatsApp management/messaging and public profile only.
- Ads with all campaigns off provide no live ads-to-WhatsApp CTA acceptance. Verify a draft/preview read-only only when available; do not publish/spend for a launch test.

## GFS-184 Payment Journey Restore Boundary (2026-10-20)

- `8f1c2da` is a report-only commit; it contains no payment runtime change. `c57c252` adds locale-complete method filtering, method+locale outbox idempotency, stricter QR/R2 metadata checks, stale outbound claims, field validation, authenticated canonical-phone validation and separate receipt Check Order action. Preserve these protections.
- Do not restore the historical selector query that only checked `enabled=1`/complete fields. Live selectors, stale action handlers, payment selection and QR/text delivery require the current independent Garden Shop QR ownership/evidence gate. Help/Support/Check Order are never payment methods.
- No source UX regression was found when staging has zero independently eligible methods. A successful order then transitions to `COMPLETE`, sends the localized no-payment message and offers a separate Check Order button. This is correct fail-closed UI, not a reason to inject real QR drafts into the selector.
- NON-PAYABLE fixture coverage is local-only and synthetic, explicitly labeled in source/test data. Fixture method details/text/QR markers must be unique per method and locale; never create active D1 `payment_methods`, change staging flags, use private real QR bytes, send mock content through Meta, or imply payment. Selection of each actual staging method must still reject.
- Receipt storage and Admin rejection tests against synthetic SQLite are not real receipt/Chrome/Admin staging proof. Actual PAID and fulfillment require a real verified method, independently confirmed funds, unique customer transaction reference and authorized Admin approval. Never synthesize or manually set these states.

## GFS-183 Real Chrome Acceptance and Durable Admission (2026-10-20)

- Staging API `5151e081-98ab-45c4-a57f-3ba43c4e6983` includes runtime source `79b5033`, the GFS-182 monotonic callback repair, durable sender admission, and terminal DLQ isolation. Immediate API rollback is `8a045e16-17c5-4663-bc65-f8c815712ce9`; preserve the additive admission table on rollback and never reverse orders/payments.
- Verify the tester through WhatsApp's own Profile Phone and the recipient through Contact Info before sending. GFS-183 did both, then used only synthetic delivery fields and the existing tester exemption. Any reset must use the authenticated CSRF-protected Admin test-control action and preserve history.
- Signed canonical WhatsApp callbacks admit at most 30 distinct inbound IDs per sender in a rolling 60-second D1 window. D1 trigger/batch admission is atomic, duplicate IDs consume no extra quota, status-only callbacks are exempt, and excess callbacks receive `429` plus `Retry-After: 60` before event/conversation mutation. Never add a tester exemption to the limiter or drop excess messages with a successful acknowledgement. Ordinary guided replies and accessible text commands remain supported.
- Admission stores only SHA-256 sender/event keys, not message bodies or phone strings; entries older than 24 hours are removed on subsequent inbound admission. This is traffic-triggered cleanup, not a guaranteed scheduled deletion SLA. Provider/event/order deduplication remains independently required.
- `DEAD_LETTER` is terminal alongside SENT/SUCCEEDED/PERMANENT_FAILURE. Never replay historical financial/CAPI failures. A failure callback can update SENT, but cannot regress DELIVERED/READ.
- Fresh real acceptance is `FS-261020-000011`, English Seeds Only/Punjab/PKR 250, DETAILS_COMPLETED/PENDING, zero receipts/method. The safe same-version Urdu branch stops before creating another order. A real no-method notice and separate Check Order are PASS, not a payment acceptance result.
- A dataset test-event code does not authorize a token. GFS-183 Graph Explorer was selected to Hoja Lead Integration with a pre-existing token; it was not used, copied, or submitted. Require an authorized clean-app/dataset token before sending any Lead Test Event. Keep CAPI OFF and never connect Hoja runtime assets.
- NON-PAYABLE formatter/mock-media/private-receipt/Admin-rejection tests are isolated local fixtures only. They must never enable staged customer methods, be labeled real QR delivery, receive PAID, emit Purchase, or be substituted for the real Chrome lead journey.

## GFS-182 Final Launch Readiness (2026-10-20)

- Webhook status callbacks are monotonic: `SENT <= DELIVERED <= READ`; duplicate provider event IDs remain ignored and delayed/reordered callbacks must never regress a successful outbound status. This is local/synthetic evidence until an authorized live callback is available.
- Queue work is bounded to five attempts with retry backoff and a terminal dead-letter state. There is no automatic DLQ replay. Recovery requires an authorized operator, provider health evidence, deterministic idempotency review, and a new audited replay; never replay CAPI, payment, receipt, or historical financial events by default.
- The clean Meta Events Manager `Free Seeds` dataset is the only candidate CAPI source observed for this project (`1210750267244729`). It currently reports no integrations and no event activity. The visible Hoja dataset is prohibited and must not be queried, connected, or used. Dataset visibility is not token permission, test-event acknowledgement, consent, or production authorization.
- `META_CAPI_ENABLED=false` remains fail-closed. Lead IDs are deterministic `lead_<FS_ORDER_ID>` and deduplicated by D1 event/outbox uniqueness, but pending D1 rows are not Meta delivery proof. Do not add a dataset/token, send Test Events, or activate production CAPI without authorized clean-asset, token-permission, consent, test-event, and acknowledgement evidence.
- Public lead release additionally requires an approved consent path, privacy/data-deletion proof, signed webhook and canonical sender gates, an enforced edge or durable per-sender rate limit, queue/DLQ recovery runbook, Admin access/error recovery, and legitimate Meta brand/release approval. A local test pass does not satisfy these public gates.
- Do not deploy a Worker change affecting the active Meta callback unless the authorized tester/account, recent activity, unchanged payment/CAPI flags, compatibility, and rollback have been reverified in the same execution. Preserve the new-number WhatsApp lock, zero-Hoja runtime rule, payment gates, and incident hold.

## GFS-181 Payment Resolution and Launch Completion (2026-10-20)

- Existing owner-uploaded JazzCash, Easypaisa, and Bank Transfer QR files are accepted as private draft assets when R2 integrity, method linkage, decoder agreement, payload equality, scan, MIME, size, and D1 hash evidence pass. Draft acceptance is not beneficiary verification and never enables a method.
- Keep QR integrity, owner attestation, destination matching, and independent beneficiary verification as separate evidence fields. `USER_ASSERTION_GFS-176` remains an owner statement only; it cannot set either ownership flag or authorize delivery.
- Current staging evidence passes QR integrity for all three methods, but no authenticated merchant/bank record was accessible in the inspected browser session. JazzCash has a D1 identifier match without independent wallet proof; Easypaisa has a decoded identifier/D1 mismatch with a printed alias candidate but no alias proof; Bank Transfer has no exact decoded match to the configured IBAN or printed alternate. All three remain disabled and non-payable.
- If provider evidence is inaccessible after one authenticated inspection, record the exact blocker and required evidence once, then continue local, simulated, lead-only, and documentation work. Do not loop, guess a beneficiary, alter recipient fields, or enable a method.
- GFS-181 reuses GFS-178/GFS-180 real EN/UR lead-only evidence and WAMIDs. Payment-tail, receipt, approval, PAID, and fulfillment results are not inferred from lead-only or simulated tests. Simulated disabled-method fixtures must remain clearly labeled and cannot change financial state.
- Public lead-only readiness is assessed separately from payment readiness: identity/consent, privacy-safe persistence, signed webhook/canonical sender checks, idempotent retries, concurrent/reordered callback acceptance, Lead CAPI delivery, and release authorization each require their own evidence. No paid spend, public promotion, or production payment launch is implied.

## GFS-174 Final Guided Journey Lock (2026-10-20)

- Guided WhatsApp checkout remains the only launch path; `WHATSAPP_CHECKOUT_MODE=guided` is required and the legacy `/flows/get-free-seeds` POST is disabled while guided mode is active. Native Meta Flow remains OFF for launch.
- New payment selectors may contain only complete, enabled, locale-complete D1 payment methods. `PAYMENT_HELP`, `SUPPORT`, and `CHECK_ORDER` are never selector actions; historical taps receive safe localized handling without mutating payment state.
- Interactive actions require stable semantic IDs. Numbered text fallback is state-aware for language, fertilizer, and review controls; no positional button IDs are synthesized.
- Webhook callbacks fail closed unless every callback carries the configured canonical `META_PHONE_NUMBER_ID`; rejected callbacks write only a sanitized audit reason. The new-number WhatsApp lock is never bypassed.
- QR delivery requires exact R2 content type, image signature, method metadata, and D1 SHA-256 metadata in addition to independent `qr_owner_verified`; missing metadata is blocked, not inferred.
- Payment approval requires a receipt and a customer transaction reference. Incident `FS-261019-000001` is hard-blocked from confirmation/fulfillment transitions until independent verification and incident review are recorded. No reversal, CAPI replay, dispatch, or artificial approval is permitted.
- GFS-174 evidence is strictly separated: local tests/build/lint/audit are not live WhatsApp/Admin evidence. Missing Chrome DevTools MCP, WAMIDs, screenshots, or third-party authorization must be reported as `BLOCKED`, never inferred.

## Identity and Isolation

- Public brand: Get Free Seeds.
- Operational merchant and payment recipient: Garden Shop.
- Customer identity: Get Free Seeds / Free Seeds In Pakistan.
- Current WhatsApp launch display name: `Free Seeds` (Meta's verified App console requires an authorized phone sender; display-name-only is not treated as runnable).
- Customer-facing Page: `https://www.facebook.com/FreeSeedsPK/` (Page ID `101192938541236`); it is not a runtime dependency until clean Meta ownership is verified.
- Designated Meta/advertising/WhatsApp ownership context: `Creeper Seeds`.
- Current authenticated Saeed A Nazim Meta session is authorized as the operator for creating/managing the new clean Creeper Seeds context. `ayesha.butt55@hotmail.com` remains historical/intended ownership context, but Ayesha authentication is not a prerequisite when the working Meta session exposes the required clean, non-Hoja authority. Do not force logout/login solely to match the intended email.
- Cloudflare, GitHub, and Get Free Seeds admin account: `gisupp@gmail.com` only.
- Never use `ayesha.butt55@hotmail.com` for Cloudflare/GitHub, and never use `gisupp@gmail.com` as the intended Meta owner for this new clean setup.
- Creeper Seeds is authorized for Get Free Seeds advertising, Click-to-WhatsApp campaigns, WhatsApp Business Platform/WABA, Meta App, system user/token ownership, Page/WhatsApp linkage, and CAPI/event-source integration.
- Hoja Seeds has zero runtime/backend connection. Do not use, import, reference, share, or depend on any Hoja Seeds repository, source, database, Cloudflare resource, domain, DNS, API, secret, payment credential, customer record, CRM data, analytics, webhook, campaign, deployment, or configuration. The only explicit exception is the Meta-only root authorized below; it must never cross into GFS backend/payment/runtime resources.
- The known Hoja-linked Cloudflare account ID `85f6a6181b4653c2a45e69cb7ce8a474` is prohibited.
- Hoja portfolio, WABA, app, dataset, system user, ad account, credentials, and old Garden Shop WhatsApp assets remain prohibited except for the explicit Meta-only root below; unrelated Hoja assets inside that root remain excluded.
- Explicit Meta-only exception authorized by the user: Business Portfolio `568026370701542` and existing Creeper Seeds Ad Account `1198439777611633` may be used for Get Free Seeds Meta advertising/CTWA/WhatsApp/App/WABA/CAPI only. Do not create another Business Portfolio, and do not share this root with Cloudflare, GitHub, D1, R2, payment, or other backend resources.
- Google Sheets is not an operational dependency. Cloudflare D1 is authoritative.

## Customer Journey

- `META_FORM_LAUNCH_FIRST`: temporary lead/order-request launch uses the canonical Meta Instant Form and native Leads Center; it does not depend on the WhatsApp system-user token, `/register`, `subscribed_apps`, WhatsApp webhook, or Lead→D1 realtime integration. The separate WhatsApp API track remains `WHATSAPP_API_ENHANCEMENT_PENDING`.
- `INITIAL_LAUNCH_PAYMENT_FIRST`: the first customer launch gate is authoritative Garden Shop payment configuration and immediate post-submit payment/receipt instructions. It does not authorize campaign/ad edits, paid spend, WhatsApp API work, or Lead→D1 realtime work. Payment amount and at least one complete enabled method must come from D1/admin; never use placeholders, synthetic values, zero-value requests, or Hoja values.
- `WHATSAPP_FLOW_CTWA_LAUNCH_FIRST`: the WhatsApp order path begins from a customer-initiated Click-to-WhatsApp conversation. Use the encrypted Flow endpoint, server-side catalog/province quote, optional fertilizer upsell, order summary, configured payment buttons/details, and same-chat receipt. Do not rely on Instant Form phone capture as WhatsApp consent or a proactive messaging window.
- Flow publication is not messaging runtime readiness: public encryption keys are non-secret and may be registered in Meta; the matching private key remains Cloudflare secret-only. Never read/export raw Meta credentials, private keys, passwords, OTPs, or 2FA PINs.
- `WHATSAPP_CHECKOUT_MODE=guided` is the safe fast-launch default; native Flow remains published/rollback-capable but opt-in until live client acceptance is proven.
- When Flow Manager is unavailable, Graph-backed Flow discovery/upload is authoritative. Flow assets must use multipart `asset_type=FLOW_JSON`, field `name=flow.json`, and file filename `flow.json`; publish only after Graph validation succeeds.
- Published Flow structures are immutable: use one validated replacement Flow, keep the prior ID as rollback, and switch runtime CTA through `META_FLOW_ID` only after publish/health PASS. Flow session tokens are expiring HMAC bindings to trusted Meta wa_id.
- `GRAPH_ACTIVATION_AUTHORITY`: current supported Meta Graph/WhatsApp Business Tools state is authoritative for phone registration, quality/name status, App↔WABA subscription, and runtime readiness; dashboard banners are not proof of activation.
- `INITIAL_PHONE_REGISTRATION_DOES_NOT_WAIT_ON_NAME_REVIEW`: ownership verification precedes `/register`; do not wait for `name_status` approval unless Meta explicitly requires it for the registration case or Graph returns that exact blocker. Track name review separately.
- Meta phone verification request payloads use the official `locale` field; OTP verification is distinct from the six-digit registration PIN. Activation-console failures must expose only sanitized `reason`, error code, and HTTP status.
- `BSUID_USER_IDENTITY_NOT_BUSINESS_ID`: a Meta BSUID is a customer/user-scoped identity, never a Business ID. Store it separately with its business scope when Meta supplies it; never invent or route by it without current official support.
- `BSUID_READY`: preserve `CUSTOMER_CONTACT_NUMBER`, `CUSTOMER_WHATSAPP_NUMBER`, and `META_WA_ID` independently. BSUID absence leaves existing recipient resolution unchanged, and different business scopes must never collide.
- `META_ACTIVATION_CONSOLE`: all Meta activation actions use the Access-protected admin console and secret-only `META_ACCESS_TOKEN`; OTP/PIN fields are transient password inputs, never persisted or logged. Public status is sanitized and never includes credentials.
- If a Meta token ever appears in an MCP-rendered page snapshot, treat it as compromised: stop generation, close the token surface without rereading it, revoke the affected token through Meta's visible revoke control, and do not create a replacement until revocation is proven.
- Webhook challenge and signed POST are separate gates: `WEBHOOK_VERIFY_TOKEN` authenticates the GET challenge; `META_APP_SECRET` validates `X-Hub-Signature-256` POSTs. A challenge pass never proves signed-event readiness.
- Inbound text events receive one idempotent welcome reply keyed by the Meta message ID; replayed callbacks must not duplicate the reply. Outbound replies remain subject to Meta's customer-service window/template rules.
- Conversation commands/answers are parsed in memory, then only normalized intent/state and validated order/customer fields are persisted in D1. Raw WhatsApp message bodies are not stored. Every transition is keyed by the real inbound message ID and queues one response after durable state update.
- Interactive WhatsApp replies use stable semantic IDs, not positional `button_0`/`button_1`; text/button/list/Flow replies normalize into one dispatcher, with numbered text fallback when a client lacks interactive support.
- New customer orders are blocked for fourteen 24-hour days from the last submitted order, except the verified E2E sender `+923034901810`; UI/input changes cannot bypass the server/D1 rule.
- Cooldown exemptions are D1/admin managed by verified Meta `wa_id`; only `923034901810` is initially exempt. Conversation reset is a separate explicit audited action and never deletes historical orders, payments, receipts, or audit records.
- Admin order cancellation/archive is Access-protected, CSRF-confirmed, audited, and limited to eligible unpaid orders; PAID orders, real receipts, and financial history are never hard-deleted.
- Shipping labels are operational documents only: generated from authoritative order/customer D1 data, escaped for print, and never used to imply dispatch or payment approval. Tracking IDs are recorded only when assigned.
- Admin Orders opens all active orders newest-first with server pagination/counts; payment approval requires a receipt plus independently verified funds, payee, amount and unique reference. Client-supplied financial authority is never accepted.
- Payment Settings saves are draft-safe: incomplete/disabled method values may be persisted for later verification, but enabling a method requires complete recipient and instruction fields. Legacy fixed advance configuration never blocks dynamic WhatsApp order totals.
- New orders use a Karachi-dated, atomic `FS-YYMMDD-######` identifier. Historical order numbers are immutable; replay/idempotency returns the original order without consuming a second sequence.
- After FS order confirmation, only complete enabled payment methods may be offered; selected method details must use persisted `orders.total_payable`, and PAID/CAPI Purchase requires genuine admin approval.
- Customer-facing WhatsApp copy is versioned, bilingual, Access-protected Admin/D1 content. Only allowlisted placeholders and private `whatsapp-content/` R2 media references may be published; action IDs, pricing, payment logic, and security rules remain code-controlled.
- Gallery-only changes create a new immutable published CMS version. Cached media selections must match the current published version, enabled media and snapshot membership or be safely reselected.
- `ADMIN_TARIFF_SOURCE_OF_TRUTH`: all product prices, fertilizer prices, pack quantities, and province delivery fees live only in Access-protected admin/D1 and are editable without deployment. Flow/runtime code and Flow JSON must never embed permanent tariff values; tests may use clearly labeled fixtures only.
- Temporary primary acquisition channel is Meta Instant Form; target primary after approval is WhatsApp; Facebook Messenger is secondary support and Instagram DM automation is deferred.
- Native Instant Form Messenger continuation is available when the customer selects Meta's checked Messenger consent option and Meta creates the messaging context. Form completion alone still does not prove a customer-side message was received; verify the native session/message separately.
- An Instant Form customer WhatsApp/contact number is a recipient value (`CUSTOMER_WHATSAPP_NUMBER`), never the GFS business sender. The current business sender is `+923044429933`; superseded `+923328883383`, old Phone ID `1429127796940691`, and CTA target `923124093162` are prohibited for runtime.
- `CUSTOMER_CONTACT_NUMBER` is the number manually entered in the form; `CUSTOMER_WHATSAPP_NUMBER` is Meta's auto-fetched WhatsApp number. Persist both separately and never overwrite either.
- WhatsApp recipient priority is Meta `wa_id` when actually supplied, then `CUSTOMER_WHATSAPP_NUMBER`, then `CUSTOMER_CONTACT_NUMBER`; deduplicate identical candidates and reject the business sender/old CTA target.
- Any customer WhatsApp follow-up requires an eligible Meta messaging context/consent and a verified sender; a phone field alone does not authorize proactive WhatsApp automation.
- Meta Instant Form is the sole authorized temporary customer web form; no additional website form or custom domain is introduced.
- All allowed channel sources (`META_INSTANT_FORM`, `WHATSAPP`, `FACEBOOK_MESSENGER`, `INSTAGRAM_DM`) feed the same D1 customer/lead/order/payment workflow. Do not create a separate CRM or channel-specific business logic.
- Meta advertising, when explicitly authorized, uses the Instant Form until WhatsApp production sender approval.
- Offer: Get 5 Seed Packs FREE; coverage approximately 2 to 3 marla depending on crop, spacing and growing method; one promotional set per household per campaign. Product price is admin/D1 data.
- Required WhatsApp Flow customer data fields remain exactly: Full Name; Complete Delivery Address; Nearby Famous Place; City; Contact Number. Separate commerce fields may be added for product, province, fertilizer choice, quote, payment method, and receipt workflow; these are not customer-identity fields.
- Payment methods are JazzCash, Easypaisa, and Bank Transfer. Garden Shop recipient values must be verified before activation; never guess account numbers, IBANs, wallet numbers, merchant IDs, or credentials.
- Customer-visible payment configuration is backend-managed in D1 `payment_methods`; QR binaries are private R2 objects. Do not hardcode recipient values, TILL/TIL IDs, QR keys, or payment instructions in source, Worker environment variables, Flow JSON, templates, or frontend strings.
- Admin payment settings are managed only through the existing `/payment-settings` UI and payment-method APIs; incomplete methods remain disabled, synthetic test values are restored, and private QR previews never become public.
- Payment credentials and provider secrets remain Cloudflare secrets and are never stored in customer-visible configuration.
- Payment message formatting is CMS/payment-settings controlled: locale chooses the published language copy, server injects only allowlisted amount/order/method/recipient placeholders, and each order reference appears exactly once.
- Do not send a payment request when payable amount or Garden Shop recipient configuration is absent. Exact gate: `PAYMENT_AMOUNT_NOT_CONFIGURED`; never send a zero-value request or guess payment values.
- Dynamic WhatsApp quotes are server-authoritative: catalog product price + optional fertilizer price + selected province delivery fee = total payable. Never trust client-supplied price or total. Catalog and province rates are D1/admin-managed; workbook imports require verified source content.
- CTWA customer-initiated messages use the normal 24-hour service window; qualifying CTWA entry points may provide Meta's free-entry-point window. Instant Form leads do not authorize automatic WhatsApp messages without supported consent/template rules.
- Creeper Seeds is not the customer payment recipient. JazzCash, Easypaisa, and Bank QR/TILL payment recipients remain Garden Shop, backend-controlled, manually reviewed, and disabled until verified values are supplied.

## WhatsApp Number Lock

- Customer-facing WhatsApp identity: Get Free Seeds.
- Authorized production sender: `+923044429933`; Phone Number ID `1323932417479627`; superseded sender `+923328883383` / Phone ID `1429127796940691` is historical only.
- Current state (2026-10-20): canonical phone is `CONNECTED`, Graph `VERIFIED`/GREEN, both messaging permissions granted, and WABA `messages` subscription is active at `getfreeseeds-api-staging`. Meta name status is `DECLINED` and the display name `Get Free Seeds` is rejected under guidelines. This name status does not itself block API messaging; GFS-178/179 delivered/read controlled test replies with the name still declined. It remains a public brand/release gate.
- Production must not use any existing, Hoja Seeds, Garden Shop, temporary, or other phone number.
- Do not locate, migrate, register, connect, or use any existing, Hoja-linked, or old Garden Shop number or WABA.
- The known Meta test number `+1 555-897-9372` and every Hoja-linked test asset remain prohibited.
- `STAGING_WABA_TEST_ALLOWED`: a Meta-provided test WABA/test number may be used only when its visible ownership is independently verified as clean Get Free Seeds, only for staging synthetic data, staging webhook/Flow/messages, and Meta test events. It must never receive real customers, real payments, production events, or ad spend.
- GFS-178/179 explicitly authorized tester exception: the Admin Test Controls number may use the canonical sender only after its own WhatsApp Profile Phone and GFS Contact Info have been verified. Restrict it to synthetic lead data and disabled payment methods; preserve existing orders. This does not authorize using a random Web conversation or public/paid traffic.
- Cloud API production messaging requires the registered business phone sender. The display name `Free Seeds` is not a standalone sender; continue only through Meta's supported phone verification/registration flow.
- Display-name-only readiness is not sufficient for public launch: production still requires compliant public identity/release approval, registered callbacks, approved templates/Flows where used, and verified CAPI. Do not treat a staging test WAMID as production approval.
- Creeper Seeds may be used only for the authorized Free Seeds In Pakistan Page/number integration. Unrelated Hoja assets visible inside that context remain excluded and must not become runtime dependencies.
- Canonical Meta assets for this phase are Business `568026370701542`, Ad Account `1198439777611633`, Page `101192938541236`, App `2354726831735899`, and approved WABA `2616648355452496`; Hoja App `1065866162865361`, Hoja WABA `810731151319635`, and all Hoja numbers remain excluded.
- Clean WhatsApp system user `Automation` (`61595003169877`) is assigned only canonical App `2354726831735899` and WABA `2616648355452496`. Token generation is a protected credential step; never display, copy, log, or commit the token.
- The generic Page/App `Connect assets` chooser is not assumed to be the WhatsApp integration mechanism. Verify App WhatsApp API Setup/WABA subscription and WABA assigned-app surfaces before mutating assets.

## Platform

- Cloudflare Workers hosts backend services.
- Cloudflare D1 is the operational source of truth.
- Cloudflare R2 stores receipt images privately; public access is forbidden.
- Cloudflare Queues handles retryable asynchronous work and DLQs.
- Public API and private admin Workers use `workers.dev`; no custom domain.
- Internal admin is protected by Cloudflare Access for `gisupp@gmail.com`; public WhatsApp callbacks must remain reachable.

## Payments and Events

- Payment is manually reviewed by Garden Shop.
- Meta Lead is created only after durable storage of all five fields, customer, lead, and order.
- Meta Purchase is created only after manual payment approval, with event ID `purchase_<FS_ORDER_ID>`, currency PKR, and actual approved amount.
- Lead event ID is `lead_<FS_ORDER_ID>`.
- Financial approval, rejection, state transitions, retries, outbound messages, CAPI, and receipt association are idempotent and audited.

## Secrets and Git

- Never commit tokens, secrets, payment credentials, private keys, production receipts, customer exports, or real personal data.
- Use Cloudflare secrets for runtime secrets and placeholders only in examples/tests.
- Never force-push or rewrite unrelated history.

## Bootstrap Lock

- Cloudflare Account ID: `cb5066a6d71ecdee0bd7ed8aacb4d3c2`
- workers.dev subdomain: `get-free-seeds.workers.dev`
- All real resource IDs are recorded in `docs/RESOURCE_REGISTRY.md` and become immutable after bootstrap.
- Account or resource migration requires explicit user authorization, migration and rollback plans, registry update, decision record, and changelog entry.

## Release States

`LOCAL` -> `STAGING_INFRA_READY` -> `WHATSAPP_NUMBER_AUTHORIZED_PENDING_ONBOARDING` -> `WHATSAPP_PHONE_VERIFICATION_PENDING` -> `WHATSAPP_OTP_REQUIRED` -> `META_ASSETS_PENDING` -> `PRODUCTION_INTEGRATION_READY` -> `PRODUCTION_READY`

Expected state for this phase: `META_ASSETS_PENDING`.

## Spend Safety

- Never publish a paid Meta campaign, increase budget, charge a card, or start delivery without explicit authorization containing the intended spend/publication decision.

## Browser Automation Protocol

- Always use Chrome DevTools MCP with the current authenticated Meta/Facebook session for Meta work (currently Saeed A Nazim), and `gisupp@gmail.com` for Cloudflare, GitHub, and Get Free Seeds admin. The same human operator may administer multiple businesses, but GFS must share zero Hoja runtime/business assets.
- Never cross-use the Meta identity for Cloudflare/GitHub or the Cloudflare/GitHub identity for intended Meta ownership.
- Verify the visible active account/profile before every external mutation and record the result.
- First call Chrome DevTools MCP `list_pages`, then inspect every already-open Facebook/Meta/Business Suite/Ads Manager/WhatsApp Manager/Developer tab before navigating to login or creating a context.
- Authentication is established by the working authenticated page and actual clean asset access; do not treat a forced email login screen as a prerequisite when the current session has verified clean authority.
- Never log out an already authenticated useful Meta session merely to switch accounts; use the current authenticated session for read-only asset discovery first.
- Switch/login only when the required clean asset cannot be accessed from the current session, and stop at the exact permission/authentication gate rather than repeatedly retrying.
- Reuse the already-open tab for the same service, task, or page. Do not open a new tab for every sub-step.
- Open one separate tab only when beginning a genuinely new service, task, or context that should remain separate.
- Same-task tab reuse is mandatory. Avoid duplicate Cloudflare, Meta, GitHub, or admin tabs. Do not close useful authenticated tabs unless necessary.
- `CHROME_LIST_PAGES_FIRST`: every browser automation execution or MCP reconnection must begin with `chrome_devtools.list_pages`; build a page-ID, URL, and service inventory before navigation or clicking.
- `REUSE_EXISTING_MATCHING_TAB`: reuse the exact existing Meta, Cloudflare, GitHub, or Admin page when it matches the task; open exactly one new tab only when no same-service tab exists.
- `NEVER_CHANGE_UNRELATED_TABS`: never navigate, refresh, close, overwrite, or repurpose an unrelated-origin/task tab. Verify page ID, URL, authenticated identity, and asset before every mutation. Record list-pages result, tab reuse/new-tab result, and unrelated-tab changes in every report.

## Chrome DevTools MCP Recovery Protocol

- Chrome DevTools MCP is mandatory for dashboard automation; do not substitute unauthenticated HTTP/API guesses or claim browser evidence from mocks.
- If the MCP namespace disappears, diagnose before declaring a blocker: inspect the loaded Kilo/Codex MCP configuration, package/command, process state, logs, Chrome process, DevToolsActivePort/endpoint, and existing profile.
- Repair locally where possible by restarting/reconnecting only the MCP bridge or required browser component; test with MCP initialization, page listing, and a read-only page inspection after every repair.
- Preserve the existing authenticated Saeed Chrome profile/session for Meta and `gisupp@gmail.com` for Cloudflare/GitHub/admin. Ayesha is historical, not the active Meta profile; never create a fresh profile merely to bypass recovery.
- Reuse existing service tabs; create a tab only for a genuinely new task/context, and verify the visible account before every mutation.
- Declare `PLATFORM_BLOCKED` only when the MCP server works locally but its tools cannot be exposed to the active agent because of an external Codex/platform restriction, with the exact diagnostics recorded in `STATUS.md`, `DECISIONS.md`, and `CHANGELOG.md`.

## Quality Gate Availability

- `REMOTE_CI_UNAVAILABLE_NON_BLOCKING`: GitHub Actions may remain unavailable because of account billing state. Do not add billing, payment methods, or spend money to enable it.
- Local `npm ci`, `npm test`, `npm run build`, `npm run lint`, dependency audit, and simulated E2E are the active release quality gate while remote CI is unavailable.

## GFS-169 Authorized Live E2E Protocol

- The verified E2E tester is authorized only when WhatsApp Profile/Account Settings visibly identify the signed-in account as the project-approved tester; chat-list names, historical message content, or assumptions are not identity proof.
- After identity proof, use only the Get Free Seeds conversation with the authorized GFS sender. Do not open, search, inspect, forward, reply to, or capture unrelated personal chats.
- `/test-controls` may register or reset only the verified test `wa_id`. Reset is explicit, CSRF-protected, audited, and history-preserving; it must not delete or alter orders, receipts, payment history, or audit records.
- A real live E2E requires an actual tester-controlled inbound interaction and matching Admin/D1 order evidence. Backend/API, Admin preview, or synthetic-provider results must be labeled SIMULATED or API-ONLY and never reported as customer completion.
- Payment rendering coverage may select multiple methods on one existing test order only when the endpoint is idempotent and no receipt, approval, PAID, CAPI, or fulfillment mutation is made. Never create duplicate orders solely to render another method.
- Payment selector evidence must contain only complete enabled methods. Help, Support, Check Order, or other legacy controls are not valid payment-method selector buttons; do not hide incomplete methods by label alone.
- WAMIDs must come from authenticated Meta/D1 evidence. WhatsApp Web timestamps or internal browser request IDs are not WAMIDs and must be reported as unavailable.
- Live evidence records must mask customer phone numbers, payment account/TILL/IBAN values, receipts, tokens, cookies, and other secrets. Screenshots remain private and uncommitted.

## GFS-170 Protected Payment QR Protocol

- A payment QR is a private R2 asset, never a public URL and never a CMS WhatsApp-content gallery image. Guided payment delivery must load the selected method's `qr_r2_key` only.
- QR delivery requires independent Garden Shop verification of the payee/account and QR ownership. A QR that merely has a key, MIME type, size, or checksum is not ownership proof. The `qr_owner_verified` gate defaults false and every replacement upload resets it.
- Before Meta delivery, verify R2 object existence, method metadata, HTTP content type, allowed image type/signature, exact byte size, and SHA-256 against D1. A mismatch is fail-closed and must create an Admin-visible warning/audit event.
- Payment text and QR are separate idempotent outbound records with separate provider IDs and callback statuses. A retry may resend only the failed part; a successful text or QR part must never be duplicated.
- Missing QR is a valid text-only fallback with an explicit `SKIPPED` QR status. Ownership-unverified, corrupted, mismatched, or otherwise unverified QR assets are `FAILED`/blocked and must not reach Meta.
- QR reconciliation must compare current Admin/D1 rows, private R2 HTTP/hash evidence, and the visible QR payee/account identifier; an upload appearing in Admin does not prove ownership. Any visual/configured-recipient mismatch remains blocked until authorized ownership evidence is recorded.
- A pending test order may switch payment methods idempotently for rendering coverage. A paid, approved, receipt-bearing, review, or fulfilled order must never be reset or method-switched.
- Paid-order forensic review is read-only: record receipt time/hash, actor, approval time, amount, payment method, order transitions, CAPI status, and fulfillment events. Missing external verification or a null customer transaction reference is an incident; place a fulfillment hold and never auto-reverse or auto-approve.

## GFS-175 QR Extraction and Immutable Source Lock

- Uploaded payment QR originals are immutable private R2 source objects. Never overwrite/delete them when a replacement or derivative is uploaded; retain prior versions for audit and rollback. Identical source bytes for the same method must resolve to one content-addressed source object, not duplicate assets.
- Extraction must be automatic from the original pixels and may remove only surrounding non-QR content. Preserve every QR module and at least the required white quiet zone; do not synthesize, redraw, or alter the encoded payload. The extraction record must link source key/hash to derivative key/hash, MIME, dimensions, method, tool/version, timestamp, and actor.
- Before accepting a derivative, independently decode both source and derivative and require byte-for-byte identical decoded payloads plus a successful scan of the derivative. A decoder/scan failure, ambiguous QR boundary, or payload mismatch blocks activation and delivery.
- Cropping or visual cleanup is never payee/ownership evidence. Decode and compare the destination against independently authorized Garden Shop account records. Do not set `qr_owner_verified=1` through ordinary Payment Settings saves, upload, cropping, OCR, checksum, visual similarity, or a customer scan; only a separate evidence-backed authorization may establish it.
- Customer delivery uses only the verified method-specific derivative. Original and derivative remain private, checksummed, MIME/signature validated, method-linked, auditable, idempotent, and rollback-capable. Missing or mismatched evidence fails closed and must not reveal another method's image.
- Payment-method enablement, customer selectors, stale button handling, and payment initiation all require a matching active `payment_qr_assets` provenance row with decoder agreement, payload equality, scan PASS, `qr_owner_verified=1`, `independent_ownership_verified=1`, and a non-empty independent evidence reference. Text fallback must not make an unverified recipient payable.
- Any change to a payment method's recipient name or account/TILL identifier invalidates its independent QR ownership evidence and disables the method; re-verification is required before enabling it again.
- The owner statement stored as `USER_ASSERTION_GFS-176` is not independent evidence. Until provider/bank evidence links the decoded destination to Garden Shop, keep every unmatched or unverified method disabled and leave both ownership flags false.
- For unresolved `FS-261019-000001`, retain the server-side hold across confirmation, fulfillment transitions, shipping labels, and tracking. The Admin UI must not present active fulfillment controls for this order. Do not modify its payment, receipt, fulfillment, or CAPI history without evidence and authorization.
- WhatsApp Web may only send test messages from the verified GFS staging/test account to a specifically authorized tester number. A random currently selected conversation is unrelated; do not message it. If the authorized conversation/session cannot be confirmed, do not send.
- The user has attested that all three payment QR codes belong to Garden Shop. Record this as an owner attestation only; it is not independent ownership verification and never sets `qr_owner_verified=1`.
- Treat a visual label, alternate till/merchant identifier, alias (including `BIO TECH`), account suffix, or previous QR incident as a discrepancy candidate, not a final beneficiary verdict. Decode the actual source payload and compare it with authoritative D1 account records and independent bank/wallet ownership evidence. An alias may be legitimate only when that independent evidence links it to the authorized Garden Shop account.
- Current staging originals visibly show JazzCash/TILL branding, an Easypaisa merchant number different from its configured D1 number, and Bank Alfalah / `GARDEN SHOP - 2039` while the D1 IBAN ends differently. These visible labels are not a decode or ownership proof. All QR delivery remains blocked until exact payloads, recipient mapping, and independent ownership evidence pass.

## GFS-173 Locale and Action Protection

- Selected WhatsApp locale is persisted after the bilingual Welcome and controls every later customer-facing template, payment message, receipt acknowledgement, and status response. Missing Urdu payment copy raises `PAYMENT_TRANSLATION_MISSING` and never falls back field-by-field to English; Admin exposes `PAYMENT_URDU_TRANSLATION_MISSING` until corrected and published.
- Payment Settings separates shared financial identifiers from localized customer copy. English payment fields reject Urdu-script contamination; Urdu delivery requires dedicated heading, instruction, reference, and receipt fields. Amount, order reference, method eligibility, recipient/account values, QR key, and payment state remain server/D1 authoritative.
- Payment-selection buttons are generated only from complete enabled D1 methods. `CHECK_ORDER`, `SUPPORT`, `PAYMENT_HELP`, and legacy payment labels are never included in the payment selector. `CHECK_ORDER` remains a separate status action; stale/invalid taps receive a safe localized response and cannot mutate order/payment state.
- CMS action labels are allowlisted by current runtime actions. Historical unknown action rows are ignored safely during load/publish and cannot reintroduce obsolete buttons. CMS publish remains the source for journey copy; payment method details remain Payment Settings/D1 source.
- The paid/packing incident `FS-261019-000001` remains read-only under fulfillment hold until independent payment verification and incident review are recorded. No reversal, fabricated evidence, Purchase replay, or dispatch is permitted.

## GFS-178 Verified Sender and Lead-Only Recovery

- Display-name review and API messaging eligibility are separate. Graph `name_status=DECLINED` alone is not a messaging prohibition: check registered phone verification, messaging permissions, WABA subscription, actual delivery status, and the authorized tester's own WhatsApp Profile Phone before a controlled send.
- On 2026-10-20 the canonical phone was verified with GREEN quality, both WhatsApp permissions granted, subscribed WABA, and actual delivered/read replies while its display name remained declined. `@FreeSeeds` is a separate username and remains unchanged. Do not change display name, username, number, WABA, or webhook to manufacture a PASS.
- A display-name resubmission must have genuine brand evidence and a supported review path. The present Meta dialog offers only a replacement-name input; canonical Support has no eligible issues and Request Review is disabled. Do not submit a blind repeat or choose an alternative name without explicit authorization. No appeal/case reference exists from GFS-178.
- Controlled GFS-178 E2E uses only the profile-verified authorized tester and synthetic delivery fields. Admin conversation resets preserve historical orders; all payment methods remain disabled. Real lead-only results must be labeled separately from simulated receipts/approvals and never marked PAID.
- Returning order delivery data is immutable per order: preserve earlier customer/order snapshots and associate later snapshots with the trusted normalized WhatsApp number rather than overwriting old delivery data or duplicating unique `wa_id`. Ownership checks must accept only that trusted association.
- No eligible method means clear localized payment unavailability, no payment-selector/media or payment request, and a separate post-order Check Order action. Delivered webhook replays and stale structured callbacks must not advance fields or create extra orders.
- API staging is the active Meta webhook. Before a controlled deploy verify account, recent traffic, local regression, unchanged payment/CAPI flags, version compatibility, and record rollback. GFS-178 checked only the authorized tester active in the preceding 24 hours. This grants no ads/spend/production or public launch permission.

## GFS-177 Active Staging and Province Selector Guard (Historical)

- The authorized GFS WABA is connected to `getfreeseeds-api-staging` for its `messages` webhook. A deployment of that Worker can change responses for real inbound traffic; do not deploy API/customer-message changes until an authorized tester/account is confirmed and the active sender identity/status is safe.
- The currently connected phone row reports quality `High`, but Meta marks the `Get Free Seeds` display name `Rejected`. Do not change/re-submit the name or send a new customer message without verified display-name authorization. The canonical Business/WABA route is authorized; Hoja-associated assets remain excluded.
- The authorized tester record exists in Admin Test Controls and has an existing pending order. Preserve that order. WhatsApp Web must be verified as the tester account before using it; a missing chat or unrelated selected contact is not test authorization.
- Province rows come only from enabled Admin D1 `province_delivery_rates`. Send a WhatsApp interactive LIST with `title` from the D1 province and localized `Delivery Fee: Rs. {fee}` / `ڈلیوری فیس: {fee} روپے` descriptions. Enforce Meta row title 24-character, description 72-character, and 10-row limits. Do not hardcode province names or prices.
- `REMOTE_CI_UNAVAILABLE_NON_BLOCKING` allows controlled staging work only when local tests/build/lint/audit/Wrangler pass and no actual repository protection rule forbids it. Never bypass a protection rule. Staging-only authorization does not authorize production or Meta mutations.
