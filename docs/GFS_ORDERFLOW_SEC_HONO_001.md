# GFS ORDERFLOW SEC-HONO-001

Date:2026-11-25. Master project **GFS ORDERFLOW**. Worktree: `D:\free seeds\gfs-order-001-rev2`, branch `codex/gfs-order-001-rev2`, repository `gardenshop/freeseeds`. This record covers only local Hono security correction, synthetic regressions and read-only S0 gates. No production deployment, migration, Meta mutation, payment, settlement, customer message or campaign change.

## Advisory verification

Before repair, lock/runtime Hono4.13.13 and `npm audit --omit=dev --json` reported these five Hono advisories, fixed at4.13.16:

| Advisory | Affected feature | Local-app applicability / disposition |
|---|---|---|
| GHSA-h7mg-cq63-vhpq / CVE-2026-126358 | RegExpRouter wildcard middleware can be skipped for documented route pattern combinations and line-terminator paths | The Admin has a global Cloudflare Access `app.use("*", authorizedForAdmin)` and API/admin use Hono routing. A pre-fix local regression reproduced the two advisory scoped-pattern cases: unauthorized handler ran HTTP200 and authorization middleware ran0 times. The source-shaped global middleware/parameter route edge did not bypass auth (401). No direct vulnerable pattern was found in the real Admin/API routes; do not claim a confirmed production-app exploit. Patched dependency and route regressions now cover boundary. |
| GHSA-4m76-xfj5-7975 / CVE-2026-126357 | Hono mount middleware behavior | No `app.mount()` use found in the audited applications; no direct vulnerable feature path. Dependency update resolves the advisory. |
| GHSA-46wx-v44x-9hh2 / CVE-2026-126355 | Hono CSRF helper behavior | No Hono `csrf()` helper use found; existing application CSRF handlers remain. Dependency update resolves the advisory. |
| GHSA-4h7h-rv7c-7m2v / CVE-2026-126356 | Hono form validator | No `validator("form")` use found. Dependency update resolves the advisory. |
| GHSA-3gg2-335m-rxc6 / CVE-2026-126359 | Hono CSS helper | No Hono CSS helper/import use found. Dependency update resolves the advisory. |

The registry currently lists4.13.22, but minimum patched4.13.16 was published, compatible with this project's Node/runtime metadata and passed the complete app suite. Exact pin4.13.16 is intentionally used as the smallest verified remediation; npm's production audit now returns0 vulnerabilities.

## Changes

- `package.json`: pin direct Hono dependency from `^4.7.11` to exact `4.13.16`.
- `package-lock.json`: update only root Hono spec and Hono package version/resolved URL/integrity from4.13.13 to4.13.16. No transitive or unrelated package changes.
- `tests/hono-security.test.ts`: add9 synthetic tests for two vulnerable wildcard patterns, four encoded line terminators under global middleware, unauthenticated/mismatched Cloudflare Access Admin reads, an unauthorized financial approval POST, authorized Admin CSRF token access, health-only Access service identity, invalid Meta webhook HMAC rejection and valid synthetic HMAC acceptance.

No application middleware or financial behavior was changed. Admin remains protected by Cloudflare Access identity; the API's customer routes remain public as designed, and the WhatsApp webhook remains HMAC-protected. Existing financial POST CSRF, verification, audit and settlement guards are not weakened.

## Before/after evidence

| Check | Hono4.13.13 before fix | Hono4.13.16 after fix |
|---|---|---|
| Scoped middleware pattern `/api/:tenant{[^/]+}/admin/*` + parameter route | Pre-fix synthetic request returned200; middlewareCalls0; protectedHandlerCalls1 | Test passes expecting401; middlewareCalls1; protectedHandlerCalls0 |
| Wildcard `/admin/*` + `/admin*` | Pre-fix synthetic request returned200; middlewareCalls0; handlerCalls1 | Test passes expecting401; middlewareCalls1; handlerCalls0 |
| Encoded `%0A`, `%0D`, `%E2%80%A8`, `%E2%80%A9` source-shaped global auth | Unauthorized requests denied; no protected handler reached | Same boundary tests pass after patch |
| Admin Access / financial approval POST | Unauthenticated/mismatched identity rejected; financial endpoint returns403 before writes | Tests pass; authorized CSRF endpoint returns200 |
| API webhook HMAC | Invalid signature403; valid synthetic signature accepted200 | Tests pass |

These are local tests with synthetic identities/IDs only; they prove the library pattern and application's configured boundaries, not live Worker exploitability or Cloudflare edge behavior. Cloudflare Access itself was not bypassed or modified.

## Verification

- Pre-fix focused test intentionally failed2/9: both middleware bypass cases returned200. Seven boundary cases passed.
- Post-fix focused suite `npm.cmd test -- tests/hono-security.test.ts --reporter=dot`: **9/9 passed**.
- Full Vitest `npm.cmd test -- --reporter=dot --maxWorkers=2`: **34 files passed;395 passed,1 skipped (396 total)**, final rerun after the test type correction.
- Documented Node suite (eight controller/adapter/observability/GraphQL/token/watchdog/capacity scripts): **52/52 passed**, final rerun.
- `npm.cmd run build` (`tsc --noEmit`): PASS. One initial test fixture typing error was fixed; focused/full tests and build were rerun successfully.
- `npm.cmd run lint`: PASS, final rerun.
- `npm.cmd audit --omit=dev`: **0 vulnerabilities**, final rerun.
- Full `npm.cmd audit --json`: Hono advisories absent, but6 moderate dev-dependency findings remain through `minimatch` GHSA-g3hv-75wg-m249 in the existing `@typescript-eslint` toolchain. User explicitly prohibited unrelated dependency upgrades; no dev dependency was changed. Track separately; this does not affect deployed production dependencies.
- `npm.cmd ci --no-audit --no-fund`: 183 locked packages installed; only existing esbuild/workerd install-script approval warnings, no scripts approved/bypassed.

## S0 and production boundary

The two still-partial S0 gates remain A06 (individual qualifying referral/FEP expiry unavailable; sender display-name/template clearance outstanding) and A10 (full release-specific rollback parity/readiness outstanding). GitHub account `gardenshop` and primary verified private noreply identity were confirmed in the existing authenticated GitHub profile; the command line commit uses that account identity only with per-command `git -c`, never by editing global/repository config. Push permission was previously confirmed by a no-write dry run; any push remains scoped to this branch.

Read-only Cloudflare rollout recheck remained unchanged: Admin active version prefix3e4b7c26 at100%, ce023b54 at0%; API active prefixb426ba47 at100%, d683ec45 at0%. Admin ready versionbd242216 remains unpromoted. No deployment/API/D1/Access/CAPI change occurred. These short IDs are UI prefixes; a complete production rollback operation was not tested or authorized.

Existing S0 gate progress remains8/10=80%; no full stage completed. WhatsApp lead launch is **NO-GO** until individual FEP eligibility/duration, display name/templates, fixed order timer, financial atomicity and all release gates pass. Keep O01-O23 and all REV.2 work in `GFS_ORDER_001_TASK_REGISTER.md`. Next engineering task is synthetic financial atomicity and cross-ledger settlement protection; no such correction is implemented here.

## Protected-worktree result

No source/runtime/config change in Garden Shop Label Printer, standalone Money Order Printing or Hoja Seeds; no external project/runtime dependency. The approved Free Seeds application change is limited to `package.json`, `package-lock.json`, and `tests/hono-security.test.ts`; documentation changes are limited to GFS ORDERFLOW records and required project entry points. Recheck all923 protected baseline hashes after final documentation/commit staging. Do not stage inherited dirty work or secrets/real customer records.
