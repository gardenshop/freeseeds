# Test Matrix

| Area | Required coverage | Status |
| --- | --- | --- |
| Governance | authorized number lock, no existing number | PASS |
| Webhook | challenge, signature, replay boundary, parsing | PASS (live callback deferred) |
| Flow | exactly five fields, validation, persistence contract | PASS |
| Orders | FS numbering, concurrency contract, state transitions | PASS |
| Payments | JazzCash, Easypaisa, Bank Transfer, disabled-safe config, D1 methods | PASS (synthetic; recipient values pending) |
| Receipts | mock retrieval, invalid media, private R2, checksum, payment review | PASS |
| Admin | Access, configuration, QR upload/replacement, approve, reject, clearer receipt, fulfillment | PASS (staging routes) |
| CAPI | Lead/Purchase IDs, approval timing, deduplication, retries | PASS (live send deferred) |
| WhatsApp | provider boundary, authorized number not yet live-enabled | PASS (external onboarding pending) |
| Isolation | Hoja/Google Sheets/secrets/public receipt scans | PASS |
| E2E | synthetic referral through delivered | PASS |
| Real WhatsApp production E2E | clean Meta onboarding, webhook/Flow/media/CAPI | BLOCKED: prohibited/limited Meta portfolio; no prohibited asset used |
| MCP recovery | config/process/Chrome/profile/fresh MCP `list_pages` proof | PASS locally; active session namespace requires fresh MCP-enabled execution |
| Fresh MCP staging probe | challenge and health against deployed staging Worker | BLOCKED: challenge `Forbidden`; deployed Worker remains old number gate |
| Creeper Seeds asset audit | exact business/ad account/Page ownership and Hoja isolation | BLOCKED: matching ad account is nested under Hoja/Garden Shop portfolio; no mutation |
| Cloudflare pre-deploy identity | visible clean account/profile before Worker mutation | BLOCKED: login showed `nazimsaeed@gmail.com`, not required `gisupp@gmail.com` |
| Meta identity separation | Ayesha Facebook login and no cross-use of Gisupp | BLOCKED: Ayesha password gate; no Meta asset mutation |
