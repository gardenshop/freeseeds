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
  downloadMedia(mediaId: string): Promise<MediaResult>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly sent: Array<{ to: string; kind: string; body: string }> = [];
  verifyWebhook(challenge: string, verifyToken: string, configuredToken?: string): string | null { return configuredToken && verifyToken === configuredToken ? challenge : null; }
  async validateSignature(): Promise<boolean> { return true; }
  parseInboundEvent(payload: unknown): InboundEvent[] { return Array.isArray(payload) ? payload as InboundEvent[] : []; }
  async sendText(to: string, body: string) { this.sent.push({ to, kind: "text", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendInteractive(to: string, body: string, _buttons: string[] = []) { this.sent.push({ to, kind: "interactive", body }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendTemplate(to: string, template: string) { this.sent.push({ to, kind: "template", body: template }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async sendFlow(to: string, flowId: string) { this.sent.push({ to, kind: "flow", body: flowId }); return { providerMessageId: `mock_${this.sent.length}` }; }
  async downloadMedia(mediaId: string): Promise<MediaResult> { return { mediaId, mimeType: "image/png", size: 4, body: new Uint8Array([137, 80, 78, 71]).buffer }; }
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly enabled: boolean) {}
  private disabled(): never { throw new Error(this.enabled ? "META_PROVIDER_REQUIRES_LIVE_CONFIGURATION" : "META_PROVIDER_DISABLED_WHATSAPP_NUMBER_PENDING"); }
  verifyWebhook(): string | null { return this.disabled(); }
  async validateSignature(): Promise<boolean> { return this.disabled(); }
  parseInboundEvent(): InboundEvent[] { return this.disabled(); }
  async sendText(): Promise<{ providerMessageId: string }> { return this.disabled(); }
  async sendInteractive(): Promise<{ providerMessageId: string }> { return this.disabled(); }
  async sendTemplate(): Promise<{ providerMessageId: string }> { return this.disabled(); }
  async sendFlow(): Promise<{ providerMessageId: string }> { return this.disabled(); }
  async downloadMedia(): Promise<MediaResult> { return this.disabled(); }
}

export function createWhatsAppProvider(kind: string | undefined): WhatsAppProvider {
  return kind === "meta" ? new MetaWhatsAppProvider(false) : new MockWhatsAppProvider();
}
