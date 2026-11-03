import assert from "node:assert/strict";
import { test } from "node:test";
import { runCloudflareGraphqlProbes } from "./cloudflare-graphql-probe.mjs";

const accountTag = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const now = new Date("2026-11-03T02:00:00Z");

function response(body, status = 200) {
  return { status, json: async () => body };
}

test("runs A through D with four bounded requests when every layer passes", async () => {
  let calls = 0;
  const results = await runCloudflareGraphqlProbes({ accountTag, token: "synthetic", now, fetchImpl: async (_url, options) => {
    calls += 1;
    const request = JSON.parse(options.body);
    assert.ok(!JSON.stringify(request).includes("synthetic"));
    if (calls === 1) return response({ data: { viewer: { __typename: "viewer" } }, errors: null });
    if (calls === 2) return response({ data: { viewer: { accounts: [{ __typename: "account" }] } }, errors: null });
    return response({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } }, errors: null });
  } });
  assert.equal(calls, 4);
  assert.deepEqual(results.map((item) => item.result), ["PASS", "PASS", "PASS", "PASS"]);
  assert.ok(results.every((item) => Object.keys(item).sort().join(",") === "category,code,graphqlErrorCount,httpStatus,probe,result,structure"));
});

test("stops at the first failing probe and retains no provider message", async () => {
  let calls = 0;
  const secretLikeText = "query contains error token-shaped-value";
  const results = await runCloudflareGraphqlProbes({ accountTag, token: "synthetic", now, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return response({ data: { viewer: { __typename: "viewer" } }, errors: null });
    return response({ errors: [{ message: secretLikeText, extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] }, 400);
  } });
  assert.equal(calls, 2);
  assert.equal(results.length, 2);
  assert.deepEqual(results[1], { probe: "B_account", httpStatus: 400, graphqlErrorCount: 1, category: "query_syntax", code: "GRAPHQL_VALIDATION_FAILED", structure: "graphql_errors", result: "FAIL" });
  assert.ok(!JSON.stringify(results).includes(secretLikeText));
});

test("classifies non-JSON responses without retaining content", async () => {
  const results = await runCloudflareGraphqlProbes({ accountTag, token: "synthetic", now, fetchImpl: async () => ({ status: 400, json: async () => { throw new Error("raw response"); } }) });
  assert.deepEqual(results, [{ probe: "A_viewer", httpStatus: 400, graphqlErrorCount: null, category: "invalid_json", code: "none", structure: "non_json", result: "FAIL" }]);
});
