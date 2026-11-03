import assert from "node:assert/strict";
import { test } from "node:test";
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
  assert.deepEqual(request, { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, method: "GET", authorization: "Bearer synthetic-secret" });
  assert.ok(!JSON.stringify(result).includes("synthetic-secret"));
});

test("maps provider token states and fails closed", async () => {
  assert.equal(tokenStatus({ result: { status: "active" } }), "ACTIVE");
  assert.equal(tokenStatus({ result: { status: "expired" } }), "EXPIRED");
  assert.equal(tokenStatus({ result: { status: "disabled" } }), "DISABLED");
  assert.equal(tokenStatus({ result: { status: "placeholder" } }), "UNKNOWN");
  const result = await verifyCloudflareToken({ accountId, token: "invalid", fetchImpl: async () => response({ success: false, errors: [{ code: 10000, message: "redacted" }] }, 401) });
  assert.deepEqual(result, { httpStatus: 401, tokenStatus: "UNKNOWN", providerErrorCode: "cf_10000", authHeaderPresent: true, result: "FAIL" });
});

test("never reports PASS for missing, malformed or inactive credentials", async () => {
  assert.deepEqual(await verifyCloudflareToken({ accountId, token: "", fetchImpl: async () => { throw new Error("must not call"); } }), {
    httpStatus: 0, tokenStatus: "UNKNOWN", providerErrorCode: "credentials_unavailable", authHeaderPresent: false, result: "FAIL"
  });
  assert.deepEqual(await verifyCloudflareToken({ accountId, token: "synthetic", fetchImpl: async () => response({ success: true, result: { status: "expired" } }) }), {
    httpStatus: 200, tokenStatus: "EXPIRED", providerErrorCode: "none", authHeaderPresent: true, result: "FAIL"
  });
});
