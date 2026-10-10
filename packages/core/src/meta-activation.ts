export type MetaActivationConfig = {
  accessToken?: string;
  graphVersion?: string;
  phoneNumberId?: string;
  wabaId?: string;
  appId?: string;
  callbackUrl?: string;
  providerEnabled?: boolean;
  webhookVerifyToken?: string;
  appSecret?: string;
  flowPrivateKey?: string;
  fetcher?: typeof fetch;
};

type GraphObject = Record<string, unknown>;

export type MetaActivationStatus = {
  graph: { configured: boolean; version: string; error?: { code: string; status?: number } };
  phone: { configured: boolean; state: "not_configured" | "unavailable" | "available"; idConfigured: boolean; displayNumber?: string; verifiedName?: string; nameStatus?: string; qualityRating?: string; registrationStatus?: string };
  wabaSubscription: { configured: boolean; state: "not_configured" | "unavailable" | "subscribed" | "not_subscribed"; appIdConfigured: boolean; subscribed: boolean };
  webhook: { callbackConfigured: boolean; verifyTokenConfigured: boolean; appSecretConfigured: boolean };
  provider: { enabled: boolean; configured: boolean; state: "disabled" | "not_configured" | "ready" };
  flowKey: { configured: boolean };
  controlledTest: { allowed: true; sendsMessages: false; performsMutations: false };
};

export type MetaActivationAction = "phone-state" | "waba-subscription" | "webhook" | "provider" | "flow-key" | "controlled-test" | "request-code" | "request_code" | "verify-code" | "verify_code" | "register" | "subscribe-app";

export type MetaActivationActionInput = {
  codeMethod?: "SMS" | "VOICE";
  language?: string;
  code?: string;
  otp?: string;
  pin?: string;
};

export type MetaActivationActionResult = {
  action: MetaActivationAction;
  executed: boolean;
  reason: string;
  status: MetaActivationStatus;
  error?: { code: string; status?: number };
};

type GraphResult = { ok: true; data: GraphObject } | { ok: false; status?: number };
type GraphMutationResult = { ok: true } | { ok: false; status?: number };

function stringValue(value: unknown, secret?: string): string | undefined {
  return typeof value === "string" && value.length > 0 && (!secret || !value.includes(secret)) ? value : undefined;
}

function graphError(status?: number): { code: string; status?: number } {
  return status === undefined ? { code: "META_GRAPH_UNAVAILABLE" } : { code: "META_GRAPH_REQUEST_FAILED", status };
}

async function readGraph(fetcher: typeof fetch, baseUrl: string, token: string, path: string): Promise<GraphResult> {
  try {
    const response = await fetcher(`${baseUrl}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!response.ok) return { ok: false, status: response.status };
    const data = await response.json() as unknown;
    return data && typeof data === "object" && !Array.isArray(data) ? { ok: true, data: data as GraphObject } : { ok: true, data: {} };
  } catch {
    return { ok: false };
  }
}

async function postGraph(fetcher: typeof fetch, baseUrl: string, token: string, path: string, body?: GraphObject): Promise<GraphMutationResult> {
  try {
    const init: RequestInit = { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) } };
    if (body) init.body = JSON.stringify(body);
    const response = await fetcher(`${baseUrl}/${path}`, init);
    return response.ok ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false };
  }
}

function transientDigits(value: unknown, length: number): string | undefined {
  return typeof value === "string" && new RegExp(`^\\d{${length}}$`).test(value) ? value : undefined;
}

export function createMetaActivationService(config: MetaActivationConfig) {
  const version = config.graphVersion ?? "v26.0";
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = `https://graph.facebook.com/${version}`;
  let requestCodeAttempted = false;

  const service = {
    async status(): Promise<MetaActivationStatus> {
      const graphConfigured = Boolean(config.accessToken);
      let graphFailure: { code: string; status?: number } | undefined;
      let phoneData: GraphObject | undefined;
      let subscriptionData: GraphObject | undefined;

      if (graphConfigured && config.phoneNumberId) {
        const result = await readGraph(fetcher, baseUrl, config.accessToken as string, `${encodeURIComponent(config.phoneNumberId)}?fields=id,display_phone_number,verified_name,name_status,quality_rating,code_verification_status,status`);
        if (result.ok) phoneData = result.data;
        else graphFailure = graphError(result.status);
      }
      if (graphConfigured && config.wabaId) {
        const result = await readGraph(fetcher, baseUrl, config.accessToken as string, `${encodeURIComponent(config.wabaId)}/subscribed_apps`);
        if (result.ok) subscriptionData = result.data;
        else graphFailure ??= graphError(result.status);
      }

      const subscribedApps = Array.isArray(subscriptionData?.data) ? subscriptionData.data : [];
      const subscribed = Boolean(config.appId && subscribedApps.some((entry) => entry && typeof entry === "object" && String((entry as GraphObject).id ?? "") === config.appId));
      const providerEnabled = config.providerEnabled === true;
      const providerConfigured = Boolean(config.accessToken && config.phoneNumberId);
      return {
        graph: { configured: graphConfigured, version, ...(graphFailure ? { error: graphFailure } : {}) },
        phone: {
          configured: Boolean(graphConfigured && config.phoneNumberId && phoneData),
          state: !graphConfigured || !config.phoneNumberId ? "not_configured" : phoneData ? "available" : "unavailable",
          idConfigured: Boolean(config.phoneNumberId),
           ...(phoneData && stringValue(phoneData.display_phone_number, config.accessToken) ? { displayNumber: stringValue(phoneData.display_phone_number, config.accessToken) } : {}),
           ...(phoneData && stringValue(phoneData.verified_name, config.accessToken) ? { verifiedName: stringValue(phoneData.verified_name, config.accessToken) } : {}),
           ...(phoneData && stringValue(phoneData.name_status, config.accessToken) ? { nameStatus: stringValue(phoneData.name_status, config.accessToken) } : {}),
           ...(phoneData && stringValue(phoneData.quality_rating, config.accessToken) ? { qualityRating: stringValue(phoneData.quality_rating, config.accessToken) } : {}),
           ...(phoneData && stringValue(phoneData.code_verification_status ?? phoneData.status, config.accessToken) ? { registrationStatus: stringValue(phoneData.code_verification_status ?? phoneData.status, config.accessToken) } : {})
        },
        wabaSubscription: {
          configured: Boolean(graphConfigured && config.wabaId && subscriptionData),
          state: !graphConfigured || !config.wabaId ? "not_configured" : subscriptionData ? subscribed ? "subscribed" : "not_subscribed" : "unavailable",
          appIdConfigured: Boolean(config.appId),
          subscribed
        },
        webhook: { callbackConfigured: Boolean(config.callbackUrl), verifyTokenConfigured: Boolean(config.webhookVerifyToken), appSecretConfigured: Boolean(config.appSecret) },
        provider: { enabled: providerEnabled, configured: providerConfigured, state: !providerEnabled ? "disabled" : providerConfigured ? "ready" : "not_configured" },
        flowKey: { configured: Boolean(config.flowPrivateKey) },
        controlledTest: { allowed: true, sendsMessages: false, performsMutations: false }
      };
    },
    async action(action: MetaActivationAction, input: MetaActivationActionInput = {}): Promise<MetaActivationActionResult> {
      const graphAction = action === "request_code" ? "request-code" : action === "verify_code" ? "verify-code" : action;
      const readOnly = ["phone-state", "waba-subscription", "webhook", "provider", "flow-key", "controlled-test"].includes(action);
      if (readOnly) return { action, executed: false, reason: "READ_ONLY_ACTIVATION", status: await service.status() };
      if (!config.accessToken) return { action, executed: false, reason: "META_ACCESS_TOKEN_REQUIRED", status: await service.status() };

      let path: string;
      let body: GraphObject | undefined;
      if (graphAction === "request-code") {
        if (!config.phoneNumberId) return { action, executed: false, reason: "META_PHONE_NUMBER_ID_REQUIRED", status: await service.status() };
        if (requestCodeAttempted) return { action, executed: false, reason: "META_REQUEST_CODE_ALREADY_SENT", status: await service.status() };
        const codeMethod = input.codeMethod ?? "SMS";
        const language = input.language ?? "en_US";
        if ((codeMethod !== "SMS" && codeMethod !== "VOICE") || !/^[A-Za-z]{2}_[A-Za-z]{2}$/.test(language)) return { action, executed: false, reason: "META_REQUEST_CODE_INPUT_INVALID", status: await service.status() };
        requestCodeAttempted = true;
        path = `${encodeURIComponent(config.phoneNumberId)}/request_code`;
        body = { code_method: codeMethod, language };
      } else if (graphAction === "verify-code") {
        if (!config.phoneNumberId) return { action, executed: false, reason: "META_PHONE_NUMBER_ID_REQUIRED", status: await service.status() };
        const code = transientDigits(input.otp ?? input.code, 6);
        if (!code) return { action, executed: false, reason: "META_OTP_INVALID", status: await service.status() };
        path = `${encodeURIComponent(config.phoneNumberId)}/verify_code`;
        body = { code };
      } else if (action === "register") {
        if (!config.phoneNumberId) return { action, executed: false, reason: "META_PHONE_NUMBER_ID_REQUIRED", status: await service.status() };
        const pin = transientDigits(input.pin, 6);
        if (!pin) return { action, executed: false, reason: "META_PIN_INVALID", status: await service.status() };
        path = `${encodeURIComponent(config.phoneNumberId)}/register`;
        body = { messaging_product: "whatsapp", pin };
      } else if (action === "subscribe-app") {
        if (!config.wabaId) return { action, executed: false, reason: "META_WABA_ID_REQUIRED", status: await service.status() };
        path = `${encodeURIComponent(config.wabaId)}/subscribed_apps`;
      } else {
        return { action, executed: false, reason: "META_ACTIVATION_ACTION_NOT_FOUND", status: await service.status() };
      }

      const result = await postGraph(fetcher, baseUrl, config.accessToken, path, body);
      const reread = await service.status();
      if (!result.ok) return { action, executed: false, reason: "META_GRAPH_REQUEST_FAILED", error: graphError(result.status), status: reread };
      return { action, executed: true, reason: "GRAPH_MUTATION_APPLIED", status: reread };
    }
  };

  return service;
}
