import { pathToFileURL } from "node:url";
import { readAnalyticsToken } from "./cloudflare-analytics-credentials.mjs";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,48}$/;

function providerErrorCode(body) {
  const first = Array.isArray(body?.errors) ? body.errors[0] : null;
  const code = first?.code ?? body?.code;
  if (Number.isSafeInteger(code)) return `cf_${code}`;
  return SAFE_CODE.test(String(code ?? "")) ? String(code) : "none";
}

function tokenStatus(body) {
  const status = String(body?.result?.status ?? "").toLowerCase();
  return status === "active" || status === "expired" || status === "disabled" ? status.toUpperCase() : "UNKNOWN";
}

export async function verifyCloudflareToken({
  accountId = DEFAULT_ACCOUNT,
  token = readAnalyticsToken(process.env, { required: true }),
  fetchImpl = fetch
} = {}) {
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("invalid_account_id");
  const authHeaderPresent = typeof token === "string" && token.trim().length > 0;
  if (!authHeaderPresent) return { httpStatus: 0, tokenStatus: "UNKNOWN", providerErrorCode: "credentials_unavailable", authHeaderPresent: false, result: "FAIL" };

  let response;
  try {
    response = await fetchImpl(`${API_BASE}/accounts/${accountId}/tokens/verify`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" }
    });
  } catch {
    return { httpStatus: 0, tokenStatus: "UNKNOWN", providerErrorCode: "network", authHeaderPresent: true, result: "FAIL" };
  }

  let body;
  try { body = await response.json(); } catch {
    return { httpStatus: Number(response.status) || 0, tokenStatus: "UNKNOWN", providerErrorCode: "invalid_json", authHeaderPresent: true, result: "FAIL" };
  }
  const status = tokenStatus(body);
  const pass = response.status === 200 && status === "ACTIVE" && body?.success === true;
  return {
    httpStatus: Number(response.status) || 0,
    tokenStatus: status,
    providerErrorCode: providerErrorCode(body),
    authHeaderPresent: true,
    result: pass ? "PASS" : "FAIL"
  };
}

async function main() {
  const result = await verifyCloudflareToken({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT });
  console.log(JSON.stringify(result));
  if (result.result !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = SAFE_CODE.test(String(error?.message ?? "")) ? String(error.message) : "verification_failed";
    console.error(JSON.stringify({ httpStatus: 0, tokenStatus: "UNKNOWN", providerErrorCode: code, authHeaderPresent: false, result: "FAIL" }));
    process.exitCode = 1;
  });
}

export { DEFAULT_ACCOUNT, tokenStatus };
