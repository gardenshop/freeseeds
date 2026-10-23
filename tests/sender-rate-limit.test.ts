import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { admitWhatsAppSenders } from "../apps/api/src/rate-limit";

describe("durable sender admission (NON-PAYABLE synthetic fixtures)", () => {
  it("bounds concurrent admission, exempts duplicates/statuses, isolates senders, and recovers after the window", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(readFileSync("migrations/0025_whatsapp_sender_rate_limit.sql", "utf8"));
    const db = {
      prepare(sql: string) {
        let args: SQLInputValue[] = [];
        const statement = { bind: (...values: SQLInputValue[]) => { args = values; return statement; }, run: () => sqlite.prepare(sql).run(...args) };
        return statement;
      },
      async batch(statements: Array<{ run: () => unknown }>) {
        sqlite.exec("BEGIN");
        try { const results = statements.map((statement) => statement.run()); sqlite.exec("COMMIT"); return results; }
        catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      }
    } as unknown as D1Database;
    const event = (id: number, from = "synthetic-sender") => ({ id: `synthetic-${id}`, from, kind: "text" as const, payload: {} });
    const now = 1792518000000;
    try {
      const results = await Promise.all(Array.from({ length: 40 }, (_, i) => admitWhatsAppSenders(db, [event(i)], now)));
      expect(results.filter(Boolean)).toHaveLength(30);
      expect(await admitWhatsAppSenders(db, [event(0)], now)).toBe(true);
      expect(await admitWhatsAppSenders(db, [], now)).toBe(true);
      expect(await admitWhatsAppSenders(db, [event(40)], now)).toBe(false);
      expect(await admitWhatsAppSenders(db, [event(40, "synthetic-other")], now)).toBe(true);
      // A mixed callback must roll back its other sender's admission when any sender is limited.
      expect(await admitWhatsAppSenders(db, [event(41, "synthetic-third"), event(41)], now)).toBe(false);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_sender_admissions").get()).toEqual({ count: 31 });
      expect(await admitWhatsAppSenders(db, [event(40)], now + 60000)).toBe(true);
      expect(await admitWhatsAppSenders(db, [event(42)], now + 86461000)).toBe(true);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM whatsapp_sender_admissions").get()).toEqual({ count: 1 });
      const rows = JSON.stringify(sqlite.prepare("SELECT * FROM whatsapp_sender_admissions").all());
      expect(rows).not.toContain("synthetic");
    } finally { sqlite.close(); }
  });
});
