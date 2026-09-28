export type InboundEvent = { id: string; from: string; kind: "text" | "interactive" | "flow" | "media"; payload: unknown; referral?: { ctwaClid?: string; campaignId?: string; adSetId?: string; adId?: string } };
export type MediaResult = { mimeType: string; size: number; body: ArrayBuffer; mediaId: string };

export interface WhatsAppProvider {
  verifyWebhook(challenge: string, verifyToken: string, configuredToken?: string): string | null;
  validateSignature(rawBody: ArrayBuffer, signature: string | null, appSecret?: string): Promise<boolean>;
  parseInboundEvent(payload: unknown): InboundEvent[];
  sendText(to: string, body: string): Promise<{ providerMessageId: string }>;
  sendInteractive(to: string, body: string, buttons: string[]): Promise<{ providerMessageId: string }>;
  sendTemplate(to: string, template: string, parameters: string[]): Promise<{ providerMessageId: string }>;
  sendFlow(to: string, flowId: string, flowToken: string): Promise<{ providerMessageId: string }>;
  sendPaymentInstructions(to: string, body: string, qr?: { body: ArrayBuffer; mimeType: string }): Promise<{ providerMessageId: string }>;
  sendConfirmation(to: string, body: string): Promise<{ providerMessageId: string }>;
  downloadMedia(mediaId: string): Promise<MediaResult>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly sent: Array<{ to: string; kind: string; body: string }> = [];
  verifyWebhook(challenge: string, verifyToken: string, configuredToken?: string): string | null { return configuredToken && verifyToken === configuredToken ? challenge : null; }
  async validateSignature(): Promise<boolean> { return true; }
  parseInboundEvent(payload: unknown): InboundEvent[] { return Array.isArray(payload) ? payload as InboundEvent[] : []; }
  async sendText(to: string, body: string) { this.sent.push({ to, kind: "text", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendInteractive(to: string, body: string, _buttons: string[] = []) { this.sent.push({ to, kind: "interactive", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendTemplate(to: string, template: string, _parameters: string[] = []) { this.sent.push({ to, kind: "template", body: template }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendFlow(to: string, flowId: string, _flowToken: string) { this.sent.push({ to, kind: "flow", body: flowId }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendPaymentInstructions(to: string, body: string, _qr?: { body: ArrayBuffer; mimeType: string }) { this.sent.push({ to, kind: "payment-instructions", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendConfirmation(to: string, body: string) { this.sent.push({ to, kind: "confirmation", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async downloadMedia(mediaId: string): Promise<MediaResult> { return { mediaId, mimeType: "image/png", size: 4, body: new Uint8Array([137, 80, 78, 71]).buffer }; }
}

export type MetaWhatsAppConfig = { enabled: boolean; graphVersion: string; phoneNumberId?: string; accessToken?: string; verifyToken?: string; appSecret?: string };

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
    const root = payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ id?: string; from?: string; type?: string; image?: { id?: string }; document?: { id?: string }; referral?: Record<string, string> }> } }> }> };
    const result: InboundEvent[] = [];
    for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const message of change.value?.messages ?? []) {
      if (!message.id || !message.from) continue;
      const kind = message.image || message.document ? "media" : message.type === "interactive" ? "interactive" : "text";
      const referral = message.referral ? { ctwaClid: message.referral.ctwa_clid, campaignId: message.referral.campaign_id, adSetId: message.referral.adset_id, adId: message.referral.ad_id } : undefined;
      result.push({ id: message.id, from: message.from, kind, payload: message, ...(referral ? { referral } : {}) });
    }
    return result;
  }

  async sendText(to: string, body: string) { return this.send({ messaging_product: "whatsapp", to, type: "text", text: { body } }); }
  async sendInteractive(to: string, body: string, buttons: string[]) { return this.send({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.map((title, index) => ({ type: "reply", reply: { id: `button_${index}`, title } })) } } }); }
  async sendTemplate(to: string, template: string, parameters: string[]) { return this.send({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: "en_US" }, components: parameters.length ? [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }] : undefined } }); }
  async sendFlow(to: string, flowId: string, flowToken: string) { return this.send({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "flow", body: { text: "Get Free Seeds" }, action: { name: "flow", parameters: { flow_id: flowId, flow_token: flowToken, mode: "published" } } } }); }
  async sendPaymentInstructions(to: string, body: string, qr?: { body: ArrayBuffer; mimeType: string }) {
    const text = await this.sendText(to, body);
    if (!qr) return text;
    this.requireEnabled();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([qr.body], { type: qr.mimeType }), "payment-qr");
    const upload = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/media`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}` }, body: form });
    if (!upload.ok) throw new Error(`META_MEDIA_UPLOAD_${upload.status}`);
    const uploaded = await upload.json() as { id?: string };
    if (!uploaded.id) throw new Error("META_MEDIA_UPLOAD_ID_MISSING");
    return this.send({ messaging_product: "whatsapp", to, type: "image", image: { id: uploaded.id, caption: "Payment QR" } });
  }
  async sendConfirmation(to: string, body: string) { return this.sendText(to, body); }

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
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`META_MESSAGE_SEND_${response.status}`);
    const data = await response.json() as { messages?: Array<{ id?: string }> };
    const providerMessageId = data.messages?.[0]?.id;
    if (!providerMessageId) throw new Error("META_MESSAGE_ID_MISSING");
    return { providerMessageId };
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function createWhatsAppProvider(kind: string | undefined, config?: Partial<MetaWhatsAppConfig>): WhatsAppProvider {
  return kind === "meta" ? new MetaWhatsAppProvider({ enabled: false, graphVersion: "v26.0", ...config }) : new MockWhatsAppProvider();
}
