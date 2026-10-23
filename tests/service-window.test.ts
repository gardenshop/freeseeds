import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isInsideWhatsAppServiceWindow, persistInboundConversationActivity, persistWebhookRecords } from "@gfs/core";

let sqlite: DatabaseSync;

function makeDb(): D1Database {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind: (...args: SQLInputValue[]) => { values = args; return statement; },
        first: async <T>() => sqlite.prepare(sql).get(...values) as T | undefined,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
      };
      return statement;
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    }
  } as unknown as D1Database;
}

describe("WhatsApp service-window timestamps", () => {
  afterEach(() => {
    vi.useRealTimers();
    sqlite?.close();
  });

  it("accepts only inbound times strictly inside the 24-hour window", () => {
    const now = Date.parse("2026-10-21T08:00:00.000Z");
    expect(isInsideWhatsAppServiceWindow(new Date(now - 24 * 60 * 60 * 1000 + 1).toISOString(), now)).toBe(true);
    expect(isInsideWhatsAppServiceWindow(new Date(now - 24 * 60 * 60 * 1000).toISOString(), now)).toBe(false);
    expect(isInsideWhatsAppServiceWindow(new Date(now + 1).toISOString(), now)).toBe(false);
    expect(isInsideWhatsAppServiceWindow(null, now)).toBe(false);
    expect(isInsideWhatsAppServiceWindow("invalid", now)).toBe(false);
  });

  it("uses first trusted receipt time, does not backfill, and duplicate callbacks cannot extend the window", async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE whatsapp_events(id TEXT PRIMARY KEY,provider_event_id TEXT UNIQUE,event_type TEXT,payload_hash TEXT,status TEXT,correlation_id TEXT,created_at TEXT);
      CREATE TABLE whatsapp_conversations(id TEXT,wa_id TEXT UNIQUE,state TEXT,state_data TEXT,last_inbound_message_id TEXT,created_at TEXT,updated_at TEXT);
      INSERT INTO whatsapp_conversations(id,wa_id,state,state_data,last_inbound_message_id,created_at,updated_at) VALUES('legacy','923001234567','NEW','{}','old-message','2026-01-01','2026-01-01');
    `);
    sqlite.exec(readFileSync("migrations/0026_whatsapp_last_inbound_at.sql", "utf8"));
    expect(sqlite.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id='923001234567'").get()).toEqual({ last_inbound_at: null });
    const db = makeDb();
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "synthetic-inbound-1", from: "923001234567", type: "text", text: { body: "START" } }] } }] }] };
    const raw = new TextEncoder().encode("synthetic-signed-body").buffer as ArrayBuffer;
    const start = Date.parse("2026-10-21T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);
    await persistWebhookRecords(db, payload, raw, "synthetic-correlation-1");
    await persistInboundConversationActivity(db, [{ id: "synthetic-inbound-1", from: "923001234567" }]);
    const acceptedAt = sqlite.prepare("SELECT last_inbound_at,last_inbound_message_id FROM whatsapp_conversations WHERE wa_id='923001234567'").get() as { last_inbound_at: string; last_inbound_message_id: string };
    expect(acceptedAt).toEqual({ last_inbound_at: "2026-10-21T08:00:00.000Z", last_inbound_message_id: "synthetic-inbound-1" });

    vi.setSystemTime(start + 25 * 60 * 60 * 1000);
    await persistWebhookRecords(db, payload, raw, "synthetic-correlation-duplicate");
    await persistInboundConversationActivity(db, [{ id: "synthetic-inbound-1", from: "923001234567" }]);
    expect(sqlite.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id='923001234567'").get()).toEqual({ last_inbound_at: acceptedAt.last_inbound_at });
    await persistInboundConversationActivity(db, []); // Status-only webhook records do not update the session window.
    expect(sqlite.prepare("SELECT last_inbound_at FROM whatsapp_conversations WHERE wa_id='923001234567'").get()).toEqual({ last_inbound_at: acceptedAt.last_inbound_at });

    const nextPayload = { entry: [{ changes: [{ value: { messages: [{ id: "synthetic-inbound-2", from: "923001234567", type: "text", text: { body: "START" } }] } }] }] };
    await persistWebhookRecords(db, nextPayload, raw, "synthetic-correlation-2");
    await persistInboundConversationActivity(db, [{ id: "synthetic-inbound-2", from: "923001234567" }]);
    expect(sqlite.prepare("SELECT last_inbound_at,last_inbound_message_id FROM whatsapp_conversations WHERE wa_id='923001234567'").get()).toEqual({ last_inbound_at: "2026-10-22T09:00:00.000Z", last_inbound_message_id: "synthetic-inbound-2" });
  });
});
