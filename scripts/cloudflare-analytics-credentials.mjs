const ANALYTICS_TOKEN_ENV = "GFS_ANALYTICS_API_TOKEN";

function inspectAnalyticsToken(rawToken) {
  const present = typeof rawToken === "string" && rawToken.length > 0;
  const leadingOrTrailingWhitespace = typeof rawToken === "string" && rawToken !== rawToken.trim();
  const bearerPrefix = typeof rawToken === "string" && /^bearer(?:\s|$)/i.test(rawToken);
  const quoted = typeof rawToken === "string" && ((rawToken.startsWith("\"") && rawToken.endsWith("\"")) || (rawToken.startsWith("'") && rawToken.endsWith("'")));
  const controlCharacters = typeof rawToken === "string" && /[\u0000-\u001f\u007f]/.test(rawToken);
  const tokenIdLike = typeof rawToken === "string" && /^[a-f0-9]{32}$/i.test(rawToken);
  const apiKeyLike = typeof rawToken === "string" && /^[a-f0-9]{37,45}$/.test(rawToken);
  const placeholderLike = typeof rawToken === "string" && /^(?:token|api[-_ ]?key|secret|password|changeme|<[^>]+>)$/i.test(rawToken.trim());
  const malformedHeaderValue = !present || leadingOrTrailingWhitespace || bearerPrefix || quoted || controlCharacters || tokenIdLike || apiKeyLike || placeholderLike;
  return {
    present,
    bearerPrefix,
    quoted,
    leadingOrTrailingWhitespace,
    controlCharacters,
    tokenIdLike,
    apiKeyLike,
    placeholderLike,
    malformedHeaderValue
  };
}

function readAnalyticsToken(env = process.env, { required = false } = {}) {
  const token = typeof env?.[ANALYTICS_TOKEN_ENV] === "string" ? env[ANALYTICS_TOKEN_ENV].trim() : "";
  if (!token) {
    if (required) throw new Error("analytics_credentials_unavailable");
    return null;
  }
  return token;
}

export { ANALYTICS_TOKEN_ENV, inspectAnalyticsToken, readAnalyticsToken };
