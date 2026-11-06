import assert from "node:assert/strict";
import test from "node:test";
import { injectWatchdogSecret, validateInput, ACCOUNT_ID, WATCHDOG_SCRIPT, SECRET_NAME } from "./cloudflare-watchdog-secret-inject.mjs";

const synthetic = "synthetic-watchdog-token-0123456789";
const syntheticAuth = "synthetic-watchdog-auth-0123456789";

test("allowlist rejects wrong account, worker and binding", () => {
  assert.throws(() => validateInput({ accountId: "other", scriptName: WATCHDOG_SCRIPT, secretName: SECRET_NAME, authToken: syntheticAuth, secretValue: synthetic }), /account_not_allowlisted/);
  assert.throws(() => validateInput({ accountId: ACCOUNT_ID, scriptName: "getfreeseeds-admin-staging", secretName: SECRET_NAME, authToken: syntheticAuth, secretValue: synthetic }), /watchdog_target_not_allowlisted/);
  assert.throws(() => validateInput({ accountId: ACCOUNT_ID, scriptName: WATCHDOG_SCRIPT, secretName: "TOKEN", authToken: syntheticAuth, secretValue: synthetic }), /secret_name_not_allowlisted/);
});

test("mock injection sends only the allowlisted API request and sanitizes success", async () => {
  let request;
  const result = await injectWatchdogSecret({ authToken: syntheticAuth, secretValue: synthetic, fetchImpl: async (url, options) => {
    request = { url, options };
    return { status: 200, json: async () => ({ success: true, result: { id: "redacted" } }) };
  } });
  assert.deepEqual(result, { httpStatus: 200, result: "PASS", providerErrorCode: "none", secondaryProviderErrorCode: "none" });
  assert.equal(request.url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WATCHDOG_SCRIPT}/secrets`);
  assert.equal(request.options.method, "PUT");
  assert.equal(request.options.headers.Authorization, `Bearer ${syntheticAuth}`);
  assert.match(request.options.body, /ADMIN_RECOVERY_TOKEN/);
  assert.match(request.options.body, /synthetic-watchdog-token/);
  assert.equal(JSON.stringify(result).includes(synthetic), false);
});

test("mock HTTP failure returns codes only and never response text", async () => {
  const result = await injectWatchdogSecret({ authToken: syntheticAuth, secretValue: synthetic, fetchImpl: async () => ({
    status: 403,
    json: async () => ({ success: false, errors: [{ code: 10000, message: synthetic }] })
  }) });
  assert.deepEqual(result, { httpStatus: 403, result: "FAIL", providerErrorCode: "10000", secondaryProviderErrorCode: "none" });
  assert.equal(JSON.stringify(result).includes(synthetic), false);
});

test("secret creation accepts the official HTTP 201 response", async () => {
  const result = await injectWatchdogSecret({ authToken: syntheticAuth, secretValue: synthetic, fetchImpl: async () => ({
    status: 201,
    json: async () => ({ success: true, result: { id: "redacted" } })
  }) });
  assert.deepEqual(result, { httpStatus: 201, result: "PASS", providerErrorCode: "none", secondaryProviderErrorCode: "none" });
});

test("network failure is sanitized", async () => {
  const result = await injectWatchdogSecret({ authToken: syntheticAuth, secretValue: synthetic, fetchImpl: async () => { throw new Error(synthetic); } });
  assert.deepEqual(result, { httpStatus: 0, result: "FAIL", providerErrorCode: "network", secondaryProviderErrorCode: "none" });
  assert.equal(JSON.stringify(result).includes(synthetic), false);
});

test("malformed token is rejected before HTTP", async () => {
  let called = false;
  await assert.rejects(() => injectWatchdogSecret({ authToken: "bad", secretValue: synthetic, fetchImpl: async () => { called = true; } }), /credential_shape_invalid/);
  await assert.rejects(() => injectWatchdogSecret({ authToken: syntheticAuth, secretValue: "bad", fetchImpl: async () => { called = true; } }), /secret_shape_invalid/);
  assert.equal(called, false);
});
