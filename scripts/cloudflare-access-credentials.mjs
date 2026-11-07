const CLIENT_ID_ENV = "GFS_ACCESS_CLIENT_ID";
const CLIENT_SECRET_ENV = "GFS_ACCESS_CLIENT_SECRET";

function readAccessCredentials(env = process.env, { required = false } = {}) {
  const clientId = typeof env?.[CLIENT_ID_ENV] === "string" ? env[CLIENT_ID_ENV] : "";
  const clientSecret = typeof env?.[CLIENT_SECRET_ENV] === "string" ? env[CLIENT_SECRET_ENV] : "";
  if (!clientId || !clientSecret) {
    if (required) throw new Error("access_credentials_unavailable");
    return null;
  }
  return { clientId, clientSecret };
}

function accessHeaders(credentials) {
  if (!credentials?.clientId || !credentials?.clientSecret) throw new Error("access_credentials_unavailable");
  return {
    "CF-Access-Client-Id": credentials.clientId,
    "CF-Access-Client-Secret": credentials.clientSecret
  };
}

export { CLIENT_ID_ENV, CLIENT_SECRET_ENV, accessHeaders, readAccessCredentials };
