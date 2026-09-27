import type { CapiEvent } from "./capi";

export type CapiProviderConfig = { enabled: boolean; graphVersion: string; datasetId?: string; accessToken?: string };

export class MetaCapiProvider {
  constructor(private readonly config: CapiProviderConfig) {}

  async send(event: CapiEvent): Promise<{ responseId?: string }> {
    if (!this.config.enabled) throw new Error("META_CAPI_DISABLED_UNTIL_CLEAN_EVENT_SOURCE");
    if (!this.config.datasetId || !this.config.accessToken) throw new Error("META_CAPI_REQUIRES_LIVE_CONFIGURATION");
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.datasetId}/events`, { method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: [{ event_name: event.eventName, event_id: event.eventId, event_time: Math.floor(Date.now() / 1000), action_source: "business_messaging", messaging_channel: "whatsapp", custom_data: event.value === undefined ? undefined : { currency: event.currency, value: event.value }, user_data: event.ctwaClid ? { ctwa_clid: event.ctwaClid } : undefined }] }) });
    if (!response.ok) throw new Error(`META_CAPI_${response.status}`);
    const data = await response.json() as { events_received?: number; fbtrace_id?: string };
    if (data.events_received !== 1) throw new Error("META_CAPI_EVENT_NOT_ACCEPTED");
    return { responseId: data.fbtrace_id };
  }
}
