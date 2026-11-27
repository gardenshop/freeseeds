type WebhookChange = { field?: string; value?: Record<string, unknown> };
type WebhookEntry = { changes?: WebhookChange[]; [key: string]: unknown };
type WebhookEnvelope = { entry?: WebhookEntry[]; [key: string]: unknown };

function waId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/\D/g, "");
  return digits || undefined;
}

function copyEnvelope(root: WebhookEnvelope, entries: WebhookEntry[]): WebhookEnvelope | undefined {
  if (!entries.length) return undefined;
  return { ...root, entry: entries };
}

export function splitTestWebhookPayload(payload: unknown, testRecipient: string): { test?: WebhookEnvelope; production?: WebhookEnvelope } {
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as WebhookEnvelope : {};
  const allowed = waId(testRecipient);
  if (!allowed) return { production: root };
  const testEntries: WebhookEntry[] = [];
  const productionEntries: WebhookEntry[] = [];
  for (const entry of root.entry ?? []) {
    const testChanges: WebhookChange[] = [];
    const productionChanges: WebhookChange[] = [];
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value || typeof value !== "object" || Array.isArray(value)) { productionChanges.push(change); continue; }
      const original = value as Record<string, unknown>;
      const messages = Array.isArray(original.messages) ? original.messages as Array<Record<string, unknown>> : undefined;
      const statuses = Array.isArray(original.statuses) ? original.statuses as Array<Record<string, unknown>> : undefined;
      if (!messages && !statuses) { productionChanges.push(change); continue; }
      const testMessages = messages?.filter((message) => waId(message.from) === allowed) ?? [];
      const otherMessages = messages?.filter((message) => waId(message.from) !== allowed) ?? [];
      const testStatuses = statuses?.filter((status) => waId(status.recipient_id) === allowed) ?? [];
      const otherStatuses = statuses?.filter((status) => waId(status.recipient_id) !== allowed) ?? [];
      if (!testMessages.length && !testStatuses.length) { productionChanges.push(change); continue; }
      const makeChange = (partMessages: Array<Record<string, unknown>>, partStatuses: Array<Record<string, unknown>>, keepContacts: boolean) => {
        const partValue: Record<string, unknown> = { ...original, ...(messages ? { messages: partMessages } : {}), ...(statuses ? { statuses: partStatuses } : {}) };
        if (Array.isArray(original.contacts)) {
          if (keepContacts) {
            const recipients = new Set([...partMessages.map((message) => waId(message.from)), ...partStatuses.map((status) => waId(status.recipient_id))]);
            const contacts = original.contacts.filter((contact) => Boolean(contact && typeof contact === "object" && recipients.has(waId((contact as { wa_id?: unknown }).wa_id))));
            if (contacts.length) partValue.contacts = contacts;
            else delete partValue.contacts;
          } else delete partValue.contacts;
        }
        return { ...change, value: partValue };
      };
      if (testMessages.length || testStatuses.length) testChanges.push(makeChange(testMessages, testStatuses, false));
      if (otherMessages.length || otherStatuses.length) productionChanges.push(makeChange(otherMessages, otherStatuses, true));
    }
    if (testChanges.length) testEntries.push({ ...entry, changes: testChanges });
    if (productionChanges.length) productionEntries.push({ ...entry, changes: productionChanges });
  }
  return { test: copyEnvelope(root, testEntries), production: copyEnvelope(root, productionEntries) };
}

export function isolatedTestRelayUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "getfreeseeds-api-wa-test.get-free-seeds.workers.dev" || url.username || url.password || url.pathname !== "/webhooks/whatsapp" || url.search || url.hash) return undefined;
    return url.toString();
  } catch { return undefined; }
}

export async function signMetaWebhook(raw: ArrayBuffer, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  return `sha256=${[...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
