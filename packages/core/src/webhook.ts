export type WebhookRecord = {
  providerEventId: string;
  eventType: string;
  status: string;
};

type WebhookMessage = { id?: string; type?: string; image?: unknown; document?: unknown };
type WebhookStatus = { id?: string; status?: string };
type WebhookValue = { messages?: WebhookMessage[]; statuses?: WebhookStatus[] };
type WebhookPayload = { entry?: Array<{ changes?: Array<{ value?: WebhookValue }> }> };

export function parseWebhookRecords(payload: unknown): WebhookRecord[] {
  const root = payload && typeof payload === "object" ? payload as WebhookPayload : {};
  const records: WebhookRecord[] = [];
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) {
    for (const message of change.value?.messages ?? []) {
      if (!message.id) continue;
      const eventType = message.image || message.document ? "MEDIA" : message.type === "interactive" ? "INTERACTIVE" : "MESSAGE";
      records.push({ providerEventId: `message:${message.id}`, eventType, status: "RECEIVED" });
    }
    for (const status of change.value?.statuses ?? []) {
      if (!status.id) continue;
      records.push({ providerEventId: `status:${status.id}`, eventType: "STATUS", status: status.status ?? "RECEIVED" });
    }
  }
  return records;
}

export async function webhookPayloadHash(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistWebhookRecords(db: D1Database, payload: unknown, rawBody: ArrayBuffer, correlationId: string): Promise<number> {
  const records = parseWebhookRecords(payload);
  if (!records.length) return 0;
  const payloadHash = await webhookPayloadHash(rawBody);
  const now = new Date().toISOString();
  await db.batch(records.map((record) => db.prepare("INSERT OR IGNORE INTO whatsapp_events (id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.providerEventId, record.eventType, payloadHash, record.status, correlationId, now)));
  return records.length;
}
