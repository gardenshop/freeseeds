import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("migration 0046 compatibility", () => {
  it("is additive, idempotent, and preserves populated legacy rows", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE orders(id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE payments(id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), review_state TEXT NOT NULL);
      INSERT INTO whatsapp_conversations VALUES('conv-synthetic','OFFER');
      INSERT INTO orders VALUES('order-synthetic','PAID');
      INSERT INTO payments VALUES('payment-synthetic','order-synthetic','APPROVED');`);

    const before = {
      conversations: sqlite.prepare("SELECT * FROM whatsapp_conversations ORDER BY id").all(),
      orders: sqlite.prepare("SELECT * FROM orders ORDER BY id").all(),
      payments: sqlite.prepare("SELECT * FROM payments ORDER BY id").all(),
    };
    const migration = readFileSync("migrations/0046_checkout_cancellation_feedback.sql", "utf8");
    sqlite.exec(migration);
    sqlite.exec(migration);

    expect(sqlite.prepare("SELECT * FROM whatsapp_conversations ORDER BY id").all()).toEqual(before.conversations);
    expect(sqlite.prepare("SELECT * FROM orders ORDER BY id").all()).toEqual(before.orders);
    expect(sqlite.prepare("SELECT * FROM payments ORDER BY id").all()).toEqual(before.payments);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'checkout_cancellation_%' ORDER BY name").all()).toEqual([
      { name: "checkout_cancellation_events" },
      { name: "checkout_cancellation_feedback_events" },
    ]);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'checkout_cancellation_%_idx' ORDER BY name").all()).toHaveLength(5);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(sqlite.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    sqlite.close();
  });
});
