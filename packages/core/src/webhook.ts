export type WebhookRecord = {
  providerEventId: string;
  eventType: string;
  status: string;
};

type WebhookMessage = { id?: string; type?: string; image?: unknown; document?: unknown };
type WebhookStatus = { id?: string; status?: string; timestamp?: string | number; recipient_id?: string };
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

export type WhatsAppDeliveryReceipt = { providerMessageId: string; recipientId?: string; status: "DELIVERED" | "READ"; providerTimestamp: string };

export function parseWhatsAppDeliveryReceipts(payload: unknown): WhatsAppDeliveryReceipt[] {
  const root = payload && typeof payload === "object" ? payload as WebhookPayload : {};
  const receipts: WhatsAppDeliveryReceipt[] = [];
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const status of change.value?.statuses ?? []) {
    if (!status.id || (status.status !== "delivered" && status.status !== "read")) continue;
    const seconds = typeof status.timestamp === "string" || typeof status.timestamp === "number" ? Number(status.timestamp) : Number.NaN;
    const milliseconds = seconds * 1000;
    if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isSafeInteger(milliseconds) || milliseconds > 8_640_000_000_000_000) continue;
    receipts.push({ providerMessageId: status.id, recipientId: typeof status.recipient_id === "string" ? status.recipient_id : undefined, status: status.status === "read" ? "READ" : "DELIVERED", providerTimestamp: new Date(milliseconds).toISOString() });
  }
  return receipts;
}

export async function webhookPayloadHash(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistWebhookRecords(db: D1Database, payload: unknown, rawBody: ArrayBuffer, correlationId: string, captureDeliveryReceipts = false): Promise<number> {
  const records = parseWebhookRecords(payload);
  if (!records.length) return 0;
  const payloadHash = await webhookPayloadHash(rawBody);
  const now = new Date().toISOString();
  const statusUpdates = records.filter((record) => record.eventType === "STATUS").map((record) => {
    const providerMessageId = record.providerEventId.slice("status:".length);
    const outboundStatus = record.status === "failed" ? "FAILED" : record.status === "delivered" ? "DELIVERED" : record.status === "read" ? "READ" : record.status === "sent" ? "SENT" : "PROVIDER_STATUS";
    const statusRank = record.status === "read" ? 3 : record.status === "delivered" ? 2 : record.status === "sent" || record.status === "failed" ? 1 : 0;
    return db.prepare("UPDATE outbound_messages SET status=?,last_error=?,updated_at=? WHERE provider_message_id=? AND CASE status WHEN 'READ' THEN 3 WHEN 'DELIVERED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END <= ?").bind(outboundStatus, record.status === "failed" ? "META_DELIVERY_FAILED" : null, now, providerMessageId, statusRank);
  });
  const receiptStatements = captureDeliveryReceipts ? parseWhatsAppDeliveryReceipts(payload).map((receipt) => db.prepare(`INSERT OR IGNORE INTO whatsapp_delivery_receipts(provider_message_id,status,provider_timestamp,received_at)
    SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM outbound_messages m JOIN order_confirmation_intents i ON i.presentation_message_id=m.provider_message_id WHERE m.provider_message_id=? AND m.kind='ORDER_INTENT_OPTIONS' AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.presented_at IS NULL)
       OR (?<>'' AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN whatsapp_conversations c ON c.id=i.conversation_id
         WHERE c.wa_id IN (?,?) AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.state='PRESENTATION_PENDING' AND i.presentation_message_id IS NULL))`).bind(receipt.providerMessageId, receipt.status, receipt.providerTimestamp, now, receipt.providerMessageId, receipt.recipientId ?? "", receipt.recipientId ?? "", receipt.recipientId?.startsWith("+") ? receipt.recipientId.slice(1) : receipt.recipientId ?? "")) : [];
  await db.batch([...records.map((record) => db.prepare("INSERT OR IGNORE INTO whatsapp_events (id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.providerEventId, record.eventType, payloadHash, record.status, correlationId, now)), ...statusUpdates, ...receiptStatements]);
  return records.length;
}

export async function persistInboundConversationActivity(db: D1Database, events: Array<{ id: string; from: string }>): Promise<void> {
  if (!events.length) return;
  await db.batch(events.map((event) => db.prepare(`INSERT INTO whatsapp_conversations
    (id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at)
    SELECT ?,?,'NEW','{}',?,created_at,created_at,created_at
    FROM whatsapp_events WHERE provider_event_id=?
    ON CONFLICT(wa_id) DO UPDATE SET
      last_inbound_message_id=excluded.last_inbound_message_id,
      last_inbound_at=excluded.last_inbound_at,
      updated_at=CASE WHEN excluded.last_inbound_at>COALESCE(whatsapp_conversations.last_inbound_at,'') THEN excluded.updated_at ELSE whatsapp_conversations.updated_at END
    WHERE whatsapp_conversations.last_inbound_at IS NULL OR excluded.last_inbound_at>=whatsapp_conversations.last_inbound_at`)
    .bind(crypto.randomUUID(), event.from, event.id, `message:${event.id}`)));
}
