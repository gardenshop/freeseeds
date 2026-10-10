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
  flowPublicKey?: string;
  fetcher?: typeof fetch;
};

export const META_SEND_TEST_RECIPIENT = "+923354299783";
export const META_SEND_TEST_MESSAGE = "Get Free Seeds E2E test. WhatsApp integration is active. Please reply OK.";

type GraphObject = Record<string, unknown>;

export type MetaActivationStatus = {
  graph: { configured: boolean; version: string; permissions: Array<{ permission: string; status: string }>; permissionError?: { code: string; status?: number }; error?: { code: string; status?: number } };
  phone: { configured: boolean; state: "not_configured" | "unavailable" | "available"; idConfigured: boolean; displayNumber?: string; verifiedName?: string; nameStatus?: string; qualityRating?: string; registrationStatus?: string };
  wabaSubscription: { configured: boolean; state: "not_configured" | "unavailable" | "subscribed" | "not_subscribed"; appIdConfigured: boolean; subscribed: boolean; observedAppIds: string[] };
  webhook: { callbackConfigured: boolean; verifyTokenConfigured: boolean; appSecretConfigured: boolean };
  provider: { enabled: boolean; configured: boolean; state: "disabled" | "not_configured" | "ready" };
  flowKey: { configured: boolean; publicConfigured: boolean };
  controlledTest: { allowed: true; sendsMessages: false; performsMutations: false };
};

export type MetaActivationAction = "phone-state" | "waba-subscription" | "webhook" | "provider" | "flow-key" | "controlled-test" | "send-test" | "request-code" | "request_code" | "verify-code" | "verify_code" | "register" | "subscribe-app";

export type MetaActivationActionInput = {
  codeMethod?: "SMS" | "VOICE";
  language?: string;
  code?: string;
  otp?: string;
  pin?: string;
  locale?: string;
};

export type MetaActivationActionResult = {
  action: MetaActivationAction;
  executed: boolean;
  reason: string;
  status: MetaActivationStatus;
  error?: { code: string; status?: number };
  httpStatus?: number;
  messageId?: string;
};

type GraphResult = { ok: true; data: GraphObject } | { ok: false; status?: number };
type GraphMutationResult = { ok: true; status: number; data?: { success?: boolean; id?: string; messageId?: string } } | { ok: false; status?: number; error?: { code: string; message?: string } };

function stringValue(value: unknown, secret?: string): string | undefined {
  return typeof value === "string" && value.length > 0 && (!secret || !value.includes(secret)) ? value : undefined;
}

function graphError(status?: number): { code: string; status?: number } {
  return status === undefined ? { code: "META_GRAPH_UNAVAILABLE" } : { code: "META_GRAPH_REQUEST_FAILED", status };
}

function safeIdentifier(value: unknown, secret?: string): string | undefined {
  const text = stringValue(value, secret);
  return text && /^[A-Za-z0-9._:-]{1,200}$/.test(text) ? text : undefined;
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
    const parsed = await response.json().catch(() => ({})) as GraphObject;
    const graphErrorBody = parsed.error && typeof parsed.error === "object" ? parsed.error as GraphObject : undefined;
    const safeError = graphErrorBody ? { code: safeIdentifier(graphErrorBody.code) ?? "META_GRAPH_REQUEST_FAILED" } : undefined;
    const safeData = {
      success: typeof parsed.success === "boolean" ? parsed.success : undefined,
      id: typeof parsed.id === "string" && /^\d+$/.test(parsed.id) ? parsed.id : undefined,
      messageId: Array.isArray(parsed.messages) && parsed.messages[0] && typeof parsed.messages[0] === "object" && typeof (parsed.messages[0] as GraphObject).id === "string" && /^[A-Za-z0-9._:-]{1,200}$/.test((parsed.messages[0] as GraphObject).id as string) ? (parsed.messages[0] as GraphObject).id as string : undefined
    };
    return response.ok ? { ok: true, status: response.status, data: safeData } : { ok: false, status: response.status, error: safeError };
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
      let permissionError: { code: string; status?: number } | undefined;
      let phoneData: GraphObject | undefined;
      let subscriptionData: GraphObject | undefined;
      let permissionData: GraphObject | undefined;

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
      if (graphConfigured) {
        const result = await readGraph(fetcher, baseUrl, config.accessToken as string, "me/permissions");
        if (result.ok) permissionData = result.data;
        else permissionError = graphError(result.status);
      }

      const subscribedApps = Array.isArray(subscriptionData?.data) ? subscriptionData.data : [];
      const observedAppIds = subscribedApps.filter((entry) => entry && typeof entry === "object").map((entry) => {
        const object = entry as GraphObject;
        const nested = object.whatsapp_business_api_data && typeof object.whatsapp_business_api_data === "object" ? object.whatsapp_business_api_data as GraphObject : undefined;
        return safeIdentifier(object.id ?? nested?.id, config.accessToken) ?? "";
      }).filter(Boolean);
      const subscribed = Boolean(config.appId && observedAppIds.includes(config.appId));
      const providerEnabled = config.providerEnabled === true;
      const providerConfigured = Boolean(config.accessToken && config.phoneNumberId);
      const permissions = Array.isArray(permissionData?.data) ? permissionData.data.filter((entry) => entry && typeof entry === "object").map((entry) => {
        const permission = safeIdentifier((entry as GraphObject).permission, config.accessToken) ?? "";
        const status = safeIdentifier((entry as GraphObject).status, config.accessToken) ?? "";
        return permission && status ? { permission, status } : null;
      }).filter((entry): entry is { permission: string; status: string } => Boolean(entry)) : [];
      return {
         graph: { configured: graphConfigured, version, permissions, ...(permissionError ? { permissionError } : {}), ...(graphFailure ? { error: graphFailure } : {}) },
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
           subscribed,
           observedAppIds
        },
        webhook: { callbackConfigured: Boolean(config.callbackUrl), verifyTokenConfigured: Boolean(config.webhookVerifyToken), appSecretConfigured: Boolean(config.appSecret) },
        provider: { enabled: providerEnabled, configured: providerConfigured, state: !providerEnabled ? "disabled" : providerConfigured ? "ready" : "not_configured" },
         flowKey: { configured: Boolean(config.flowPrivateKey), publicConfigured: Boolean(config.flowPublicKey) },
        controlledTest: { allowed: true, sendsMessages: false, performsMutations: false }
      };
    },
    async action(action: MetaActivationAction, input: MetaActivationActionInput = {}): Promise<MetaActivationActionResult> {
      const graphAction = action === "request_code" ? "request-code" : action === "verify_code" ? "verify-code" : action;
      const readOnly = ["phone-state", "waba-subscription", "webhook", "provider", "controlled-test"].includes(action);
      if (readOnly) return { action, executed: false, reason: "READ_ONLY_ACTIVATION", status: await service.status() };
      if (!config.accessToken) return { action, executed: false, reason: "META_ACCESS_TOKEN_REQUIRED", status: await service.status() };
      if (action === "send-test" && config.providerEnabled !== true) return { action, executed: false, reason: "META_PROVIDER_DISABLED", status: await service.status() };

      let path: string;
      let body: GraphObject | undefined;
      if (graphAction === "request-code") {
        if (!config.phoneNumberId) return { action, executed: false, reason: "META_PHONE_NUMBER_ID_REQUIRED", status: await service.status() };
        if (requestCodeAttempted) return { action, executed: false, reason: "META_REQUEST_CODE_ALREADY_SENT", status: await service.status() };
        const codeMethod = input.codeMethod ?? "SMS";
         const locale = input.locale ?? input.language ?? "en_US";
         if ((codeMethod !== "SMS" && codeMethod !== "VOICE") || !/^[A-Za-z]{2}_[A-Za-z]{2}$/.test(locale)) return { action, executed: false, reason: "META_REQUEST_CODE_INPUT_INVALID", status: await service.status() };
        requestCodeAttempted = true;
        path = `${encodeURIComponent(config.phoneNumberId)}/request_code`;
         body = { code_method: codeMethod, locale };
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
       } else if (action === "send-test") {
         if (!config.phoneNumberId) return { action, executed: false, reason: "META_PHONE_NUMBER_ID_REQUIRED", status: await service.status() };
         path = `${encodeURIComponent(config.phoneNumberId)}/messages`;
         body = { messaging_product: "whatsapp", recipient_type: "individual", to: META_SEND_TEST_RECIPIENT, type: "text", text: { preview_url: false, body: META_SEND_TEST_MESSAGE } };
       } else if (action === "flow-key") {
         if (!config.phoneNumberId || !config.flowPublicKey) return { action, executed: false, reason: "META_FLOW_PUBLIC_KEY_REQUIRED", status: await service.status() };
         path = `${encodeURIComponent(config.phoneNumberId)}/whatsapp_business_encryption`;
         body = { business_public_key: config.flowPublicKey };
      } else {
        return { action, executed: false, reason: "META_ACTIVATION_ACTION_NOT_FOUND", status: await service.status() };
      }

      const result = await postGraph(fetcher, baseUrl, config.accessToken, path, body);
      const reread = await service.status();
       if (!result.ok) return { action, executed: false, reason: "META_GRAPH_REQUEST_FAILED", error: result.error ? { code: result.error.code, ...(result.status === undefined ? {} : { status: result.status }) } : graphError(result.status), status: reread };
       if (result.data?.success === false) return { action, executed: false, reason: "META_GRAPH_REPORTED_FAILURE", status: reread };
       if (action === "send-test" && !result.data?.messageId) return { action, executed: false, reason: "META_MESSAGE_ID_MISSING", status: reread };
       return { action, executed: true, reason: action === "send-test" ? "META_TEST_MESSAGE_SENT" : "GRAPH_MUTATION_APPLIED", status: reread, ...(action === "send-test" ? { messageId: result.data?.messageId, httpStatus: result.status } : {}) };
    }
  };

  return service;
}
