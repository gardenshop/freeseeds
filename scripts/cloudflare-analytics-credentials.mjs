const ANALYTICS_TOKEN_ENV = "GFS_ANALYTICS_API_TOKEN";

function readAnalyticsToken(env = process.env, { required = false } = {}) {
  const token = typeof env?.[ANALYTICS_TOKEN_ENV] === "string" ? env[ANALYTICS_TOKEN_ENV].trim() : "";
  if (!token) {
    if (required) throw new Error("analytics_credentials_unavailable");
    return null;
  }
  return token;
}

export { ANALYTICS_TOKEN_ENV, readAnalyticsToken };
