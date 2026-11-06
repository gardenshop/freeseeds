import { pathToFileURL } from "node:url";

const API_BASE = "https://api.cloudflare.com/client/v4";
const ACCOUNT_ID = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const WATCHDOG_SCRIPT = "gfs-cod-mo-55-watchdog";
const SECRET_NAME = "ADMIN_RECOVERY_TOKEN";
const TOKEN_SHAPE = /^[A-Za-z0-9._~-]{20,256}$/;

function safeCode(value) {
  const text = String(value ?? "");
  return /^[A-Za-z0-9_.:-]{1,48}$/.test(text) ? text : "unclassified";
}

function validateInput({ accountId, scriptName, secretName, token }) {
  if (accountId !== ACCOUNT_ID) throw new Error("account_not_allowlisted");
  if (scriptName !== WATCHDOG_SCRIPT) throw new Error("watchdog_target_not_allowlisted");
  if (secretName !== SECRET_NAME) throw new Error("secret_name_not_allowlisted");
  if (!TOKEN_SHAPE.test(String(token ?? ""))) throw new Error("credential_shape_invalid");
}

function errorSummary(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const codes = errors.map((error) => safeCode(error?.code)).filter((code) => code !== "unclassified");
  return { providerErrorCode: codes[0] ?? "none", secondaryProviderErrorCode: codes[1] ?? "none" };
}

export async function injectWatchdogSecret({
  accountId = ACCOUNT_ID,
  scriptName = WATCHDOG_SCRIPT,
  secretName = SECRET_NAME,
  token,
  fetchImpl = fetch
} = {}) {
  validateInput({ accountId, scriptName, secretName, token });
  const url = `${API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/secrets`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: secretName, text: token, type: "secret_text" })
    });
  } catch {
    return { httpStatus: 0, result: "FAIL", ...errorSummary({ errors: [{ code: "network" }] }) };
  }
  let body = {};
  try { body = await response.json(); } catch { body = {}; }
  return { httpStatus: Number(response.status) || 0, result: response.status === 200 && body?.success === true ? "PASS" : "FAIL", ...errorSummary(body) };
}

async function main() {
  const result = await injectWatchdogSecret({ token: process.env.GFS_WATCHDOG_ADMIN_TOKEN });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.result !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ result: "FAIL", httpStatus: 0, error: safeCode(error?.message) })}\n`);
    process.exitCode = 1;
  });
}

export { ACCOUNT_ID, WATCHDOG_SCRIPT, SECRET_NAME, validateInput };
