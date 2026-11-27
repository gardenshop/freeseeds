export type InboundEvent = { id: string; from: string; kind: "text" | "interactive" | "flow" | "media"; payload: unknown; providerTimestamp?: string; referral?: { ctwaClid?: string; campaignId?: string; adSetId?: string; adId?: string; sourceType?: string; platform?: string } };
export type MediaResult = { mimeType: string; size: number; body: ArrayBuffer; mediaId: string };
export type OutboundImage = { body: ArrayBuffer; mimeType: "image/jpeg" | "image/png"; filename?: string };
export type InteractiveButton = { id: string; title: string };
export type TemplateLanguageCode = "en_US" | "ur";

export type WhatsAppOutboundGuard = {
  assertRecipient(to: string): void;
  send<T>(to: string, payload: unknown, performSend: () => Promise<T>, providerMessageId?: (result: T) => string | undefined): Promise<T>;
};

export interface WhatsAppProvider {
  verifyWebhook(challenge: string, verifyToken: string, configuredToken?: string): string | null;
  validateSignature(rawBody: ArrayBuffer, signature: string | null, appSecret?: string): Promise<boolean>;
  parseInboundEvent(payload: unknown): InboundEvent[];
  sendText(to: string, body: string): Promise<{ providerMessageId: string }>;
  sendImage(to: string, body: string, image: OutboundImage): Promise<{ providerMessageId: string }>;
  sendInteractive(to: string, body: string, buttons: InteractiveButton[], image?: OutboundImage): Promise<{ providerMessageId: string }>;
  sendList(to: string, body: string, buttonText: string, rows: Array<{ id: string; title: string; description?: string }>, image?: OutboundImage): Promise<{ providerMessageId: string }>;
  sendTemplate(to: string, template: string, parameters: string[], languageCode?: TemplateLanguageCode, quickReplyPayloads?: string[]): Promise<{ providerMessageId: string }>;
  sendFlow(to: string, flowId: string, flowToken: string): Promise<{ providerMessageId: string }>;
  sendPaymentInstructions(to: string, body: string, qr?: { body: ArrayBuffer; mimeType: string }): Promise<{ providerMessageId: string }>;
  sendPaymentQr(to: string, qr: { body: ArrayBuffer; mimeType: string }): Promise<{ providerMessageId: string }>;
  sendConfirmation(to: string, body: string): Promise<{ providerMessageId: string }>;
  downloadMedia(mediaId: string): Promise<MediaResult>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly sent: Array<{ to: string; kind: string; body: string }> = [];
  verifyWebhook(challenge: string, verifyToken: string, configuredToken?: string): string | null { return configuredToken && verifyToken === configuredToken ? challenge : null; }
  async validateSignature(): Promise<boolean> { return true; }
  parseInboundEvent(payload: unknown): InboundEvent[] { return Array.isArray(payload) ? payload as InboundEvent[] : []; }
  async sendText(to: string, body: string) { this.sent.push({ to, kind: "text", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendImage(to: string, body: string, _image: OutboundImage) { this.sent.push({ to, kind: "image", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendInteractive(to: string, body: string, _buttons: InteractiveButton[] = [], image?: OutboundImage) { this.sent.push({ to, kind: image ? "interactive-image" : "interactive", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendList(to: string, body: string, _buttonText: string, _rows: Array<{ id: string; title: string; description?: string }>, image?: OutboundImage) { this.sent.push({ to, kind: image ? "list-image" : "list", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendTemplate(to: string, template: string, _parameters: string[] = [], languageCode: TemplateLanguageCode = "en_US", _quickReplyPayloads: string[] = []) { this.sent.push({ to, kind: `template:${languageCode}`, body: template }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendFlow(to: string, flowId: string, _flowToken: string) { this.sent.push({ to, kind: "flow", body: flowId }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendPaymentInstructions(to: string, body: string, qr?: { body: ArrayBuffer; mimeType: string }) { const text = await this.sendText(to, body); return qr ? this.sendPaymentQr(to, qr) : text; }
  async sendPaymentQr(to: string, _qr: { body: ArrayBuffer; mimeType: string }) { this.sent.push({ to, kind: "payment-qr", body: "Payment QR" }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendConfirmation(to: string, body: string) { this.sent.push({ to, kind: "confirmation", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async downloadMedia(mediaId: string): Promise<MediaResult> { return { mediaId, mimeType: "image/png", size: 4, body: new Uint8Array([137, 80, 78, 71]).buffer }; }
}

export type MetaWhatsAppConfig = { enabled: boolean; graphVersion: string; phoneNumberId?: string; accessToken?: string; verifyToken?: string; appSecret?: string; outboundGuard?: WhatsAppOutboundGuard };

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: MetaWhatsAppConfig) {}

  private requireEnabled(): void {
    if (!this.config.enabled) throw new Error("META_PROVIDER_DISABLED_UNTIL_WHATSAPP_ONBOARDING");
    if (!this.config.phoneNumberId || !this.config.accessToken) throw new Error("META_PROVIDER_REQUIRES_LIVE_CONFIGURATION");
  }

  verifyWebhook(challenge: string, verifyToken: string, configuredToken = this.config.verifyToken): string | null {
    return configuredToken && verifyToken === configuredToken ? challenge : null;
  }

  async validateSignature(rawBody: ArrayBuffer, signature: string | null, appSecret = this.config.appSecret): Promise<boolean> {
    if (!signature || !appSecret) return false;
    const [scheme, supplied] = signature.split("=", 2);
    if (scheme !== "sha256" || !supplied) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
    const expected = [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
    return constantTimeEqual(expected, supplied);
  }

  parseInboundEvent(payload: unknown): InboundEvent[] {
    const root = payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string | number; image?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string }; context?: { id?: string }; interactive?: { nfm_reply?: unknown }; referral?: Record<string, string> }> } }> }> };
    const result: InboundEvent[] = [];
    for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const message of change.value?.messages ?? []) {
      if (!message.id || !message.from) continue;
      const kind = message.image || message.document ? "media" : message.interactive?.nfm_reply ? "flow" : message.type === "interactive" ? "interactive" : "text";
      const referral = message.referral ? {
        ctwaClid: message.referral.ctwa_clid,
        campaignId: message.referral.campaign_id,
        adSetId: message.referral.adset_id,
        adId: message.referral.ad_id,
        sourceType: message.referral.source_type
      } : undefined;
      const providerTimestamp=normalizeMetaTimestamp(message.timestamp);
      result.push({ id: message.id, from: message.from, kind, payload: message, ...(providerTimestamp?{providerTimestamp}:{}), ...(referral ? { referral } : {}) });
    }
    return result;
  }

  async sendText(to: string, body: string) { this.assertRecipient(to); return this.send({ messaging_product: "whatsapp", to, type: "text", text: { body } }); }
  async sendImage(to: string, body: string, image: OutboundImage) {
    const caption = body.slice(0, 1024);
    const identity = { messaging_product: "whatsapp", to, type: "image", image: { caption, mimeType: image.mimeType, filename: image.filename, sha256: await this.imageFingerprint(image) } };
    return this.sendWithGuard(to, identity, async () => {
      const id = await this.uploadMedia(image);
      return this.performSend({ messaging_product: "whatsapp", to, type: "image", image: { id, caption } });
    });
  }
  async sendInteractive(to: string, body: string, buttons: InteractiveButton[], image?: OutboundImage) {
    this.assertRecipient(to);
    const replies = buttons.slice(0, 3).map((button) => ({ type: "reply", reply: button }));
    const imageHash = image ? await this.imageFingerprint(image) : undefined;
    const identity = { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", ...(imageHash ? { header: { type: "image", sha256: imageHash } } : {}), body: { text: body }, action: { buttons: replies } } };
    return this.sendWithGuard(to, identity, async () => {
      const header = image ? { type: "image", image: { id: await this.uploadMedia(image) } } : undefined;
      const interactive = { type: "button", ...(header ? { header } : {}), body: { text: body }, action: { buttons: replies } };
      return this.performSend({ messaging_product: "whatsapp", to, type: "interactive", interactive });
    });
  }
  async sendList(to: string, body: string, buttonText: string, rows: Array<{ id: string; title: string; description?: string }>, image?: OutboundImage) {
    this.assertRecipient(to);
    const listRows = rows.slice(0, 10);
    const imageHash = image ? await this.imageFingerprint(image) : undefined;
    const identity = { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", ...(imageHash ? { header: { type: "image", sha256: imageHash } } : {}), body: { text: body }, action: { button: buttonText, sections: [{ title: buttonText, rows: listRows }] } } };
    return this.sendWithGuard(to, identity, async () => {
      const header = image ? { type: "image", image: { id: await this.uploadMedia(image) } } : undefined;
      return this.performSend({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", ...(header ? { header } : {}), body: { text: body }, action: { button: buttonText, sections: [{ title: buttonText, rows: listRows }] } } });
    });
  }
  async sendTemplate(to: string, template: string, parameters: string[], languageCode: TemplateLanguageCode = "en_US", quickReplyPayloads: string[] = []) {
    const components: Array<Record<string, unknown>> = [];
    if (parameters.length) components.push({ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) });
    for (const [index, payload] of quickReplyPayloads.slice(0, 3).entries()) {
      components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] });
    }
    return this.send({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { policy: "deterministic", code: languageCode }, components: components.length ? components : undefined } });
  }
  async sendFlow(to: string, flowId: string, flowToken: string) {
    this.assertRecipient(to);
    return this.send({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: "Get Free Seeds" },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: flowId,
            flow_token: flowToken,
            flow_cta: "Get Free Seeds",
            flow_action: "data_exchange",
            mode: "published"
          }
        }
      }
    });
  }
  async sendPaymentInstructions(to: string, body: string, qr?: { body: ArrayBuffer; mimeType: string }) {
    const text = await this.sendText(to, body);
    if (!qr) return text;
    return this.sendPaymentQr(to, qr);
  }
  async sendPaymentQr(to: string, qr: { body: ArrayBuffer; mimeType: string }) {
    this.assertRecipient(to);
    const imageHash = await this.bytesFingerprint(qr.body);
    const identity = { messaging_product: "whatsapp", to, type: "image", image: { caption: "Payment QR", mimeType: qr.mimeType, sha256: imageHash } };
    return this.sendWithGuard(to, identity, async () => {
      this.requireEnabled();
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("file", new Blob([qr.body], { type: qr.mimeType }), "payment-qr");
      const upload = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/media`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}` }, body: form });
      if (!upload.ok) throw new Error(`META_MEDIA_UPLOAD_${upload.status}`);
      const uploaded = await upload.json() as { id?: string };
      if (!uploaded.id) throw new Error("META_MEDIA_UPLOAD_ID_MISSING");
      return this.performSend({ messaging_product: "whatsapp", to, type: "image", image: { id: uploaded.id, caption: "Payment QR" } });
    });
  }
  async sendConfirmation(to: string, body: string) { return this.sendText(to, body); }

  private async uploadMedia(media: OutboundImage): Promise<string> {
    this.requireEnabled();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([media.body], { type: media.mimeType }), media.filename ?? "content-image");
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/media`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}` }, body: form });
    if (!response.ok) throw new Error(`META_MEDIA_UPLOAD_${response.status}`);
    const uploaded = await response.json() as { id?: string };
    if (!uploaded.id) throw new Error("META_MEDIA_UPLOAD_ID_MISSING");
    return uploaded.id;
  }

  async downloadMedia(mediaId: string): Promise<MediaResult> {
    this.requireEnabled();
    const metadataResponse = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${mediaId}`, { headers: { Authorization: `Bearer ${this.config.accessToken}` } });
    if (!metadataResponse.ok) throw new Error(`META_MEDIA_METADATA_${metadataResponse.status}`);
    const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
    if (!metadata.url) throw new Error("META_MEDIA_URL_MISSING");
    const mediaResponse = await fetch(metadata.url, { headers: { Authorization: `Bearer ${this.config.accessToken}` } });
    if (!mediaResponse.ok) throw new Error(`META_MEDIA_DOWNLOAD_${mediaResponse.status}`);
    const body = await mediaResponse.arrayBuffer();
    return { mediaId, mimeType: metadata.mime_type ?? mediaResponse.headers.get("content-type") ?? "application/octet-stream", size: metadata.file_size ?? body.byteLength, body };
  }

  private async send(payload: unknown): Promise<{ providerMessageId: string }> {
    this.requireEnabled();
    const recipient = (payload as { to?: unknown })?.to;
    if (typeof recipient !== "string") throw new Error("META_MESSAGE_RECIPIENT_REQUIRED");
    return this.sendWithGuard(recipient, payload, () => this.performSend(payload));
  }

  private async sendWithGuard(to: string, identityPayload: unknown, performSend: () => Promise<{ providerMessageId: string }>): Promise<{ providerMessageId: string }> {
    this.requireEnabled();
    this.assertRecipient(to);
    return this.config.outboundGuard ? this.config.outboundGuard.send(to, identityPayload, performSend) : performSend();
  }

  private async performSend(payload: unknown): Promise<{ providerMessageId: string }> {
    this.requireEnabled();
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`META_MESSAGE_SEND_${response.status}`);
    const data = await response.json() as { messages?: Array<{ id?: string }> };
    const providerMessageId = data.messages?.[0]?.id;
    if (!providerMessageId) throw new Error("META_MESSAGE_ID_MISSING");
    return { providerMessageId };
  }

  private async imageFingerprint(image: OutboundImage): Promise<string> { return this.bytesFingerprint(image.body); }

  private async bytesFingerprint(bytes: ArrayBuffer): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  private assertRecipient(to: string): void { this.config.outboundGuard?.assertRecipient(to); }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function normalizeMetaTimestamp(value:unknown):string|undefined{
  const seconds=typeof value==="string"||typeof value==="number"?Number(value):Number.NaN;
  const milliseconds=seconds*1000;
  if(!Number.isSafeInteger(seconds)||seconds<=0||!Number.isSafeInteger(milliseconds)||milliseconds>Date.now()+300_000||milliseconds>8_640_000_000_000_000)return undefined;
  return new Date(milliseconds).toISOString();
}

export function createWhatsAppProvider(kind: string | undefined, config?: Partial<MetaWhatsAppConfig>): WhatsAppProvider {
  return kind === "meta" ? new MetaWhatsAppProvider({ enabled: false, graphVersion: "v26.0", ...config }) : new MockWhatsAppProvider();
}
