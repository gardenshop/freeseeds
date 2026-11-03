import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";
import { tokenStatus, verifyCloudflareToken } from "./cloudflare-token-verify.mjs";

const accountId = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";

function response(body, status = 200) {
  return { status, json: async () => body };
}

test("verifies an active token with a bearer header and emits no secret", async () => {
  let request;
  const result = await verifyCloudflareToken({ accountId, token: "synthetic-secret", fetchImpl: async (url, options) => {
    request = { url, method: options.method, authorization: options.headers.Authorization };
    return response({ success: true, errors: [], result: { id: "token-id", status: "active" } });
  } });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.tokenStatus, "ACTIVE");
  assert.equal(result.authHeaderPresent, true);
  assert.equal(result.result, "PASS");
  assert.equal(result.credentialShape.malformedHeaderValue, false);
  assert.deepEqual(request, { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, method: "GET", authorization: "Bearer synthetic-secret" });
  assert.ok(!JSON.stringify(result).includes("synthetic-secret"));
});

test("maps provider token states and fails closed", async () => {
  assert.equal(tokenStatus({ result: { status: "active" } }), "ACTIVE");
  assert.equal(tokenStatus({ result: { status: "expired" } }), "EXPIRED");
  assert.equal(tokenStatus({ result: { status: "disabled" } }), "DISABLED");
  assert.equal(tokenStatus({ result: { status: "placeholder" } }), "UNKNOWN");
  const result = await verifyCloudflareToken({ accountId, token: "invalid", fetchImpl: async () => response({ success: false, errors: [{ code: 10000, message: "redacted" }] }, 401) });
  assert.equal(result.httpStatus, 401);
  assert.equal(result.providerErrorCode, "cf_10000");
  assert.equal(result.secondaryProviderErrorCode, "none");
  assert.equal(result.result, "FAIL");
});

test("never reports PASS for missing, malformed or inactive credentials", async () => {
  const missing = await verifyCloudflareToken({ accountId, token: "", fetchImpl: async () => { throw new Error("must not call"); } });
  assert.equal(missing.providerErrorCode, "credentials_unavailable");
  assert.equal(missing.authHeaderPresent, false);
  assert.equal(missing.result, "FAIL");
  const inactive = await verifyCloudflareToken({ accountId, token: "synthetic", fetchImpl: async () => response({ success: true, result: { status: "expired" } }) });
  assert.equal(inactive.tokenStatus, "EXPIRED");
  assert.equal(inactive.result, "FAIL");
});

test("rejects unsafe bearer values without making a request", async () => {
  for (const token of [" Bearer secret", "Bearer secret", "\"secret\"", "secret\nvalue", "a".repeat(32), "a".repeat(40), "<token>"]) {
    const result = await verifyCloudflareToken({ accountId, token, fetchImpl: async () => { throw new Error("must not call"); } });
    assert.equal(result.providerErrorCode, "credential_shape_invalid");
    assert.equal(result.authHeaderPresent, false);
    assert.equal(result.result, "FAIL");
    assert.equal(result.credentialShape.malformedHeaderValue, true);
  }
  assert.equal(inspectAnalyticsToken("synthetic-secret").malformedHeaderValue, false);
});

test("reports a safe secondary provider error code", async () => {
  const result = await verifyCloudflareToken({ accountId, token: "synthetic-secret", fetchImpl: async () => response({ success: false, errors: [{ code: 6003, message: "redacted" }, { code: 6111, message: "redacted" }] }, 400) });
  assert.equal(result.providerErrorCode, "cf_6003");
  assert.equal(result.secondaryProviderErrorCode, "cf_6111");
  assert.ok(!JSON.stringify(result).includes("redacted"));
});
