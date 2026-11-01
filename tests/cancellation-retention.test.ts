import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCancellationSuggestionRetention } from "@gfs/core";

type Bound = {
  bind: (...args: unknown[]) => Bound;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string): Bound {
    let args: SQLInputValue[] = [];
    const statement = {
      bind: (...next: unknown[]) => { args = next as SQLInputValue[]; return statement; },
      all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...args) as T[] }),
      run: async () => ({ meta: { changes: Number(this.sqlite.prepare(sql).run(...args).changes) } }),
    } as Bound;
    return statement;
  }

  async batch(statements: Bound[]): Promise<Array<{ meta: { changes: number } }>> {
    this.sqlite.exec("BEGIN");
    try {
      const results: Array<{ meta: { changes: number } }> = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function fixture(): SqliteD1 {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE whatsapp_conversations(id TEXT PRIMARY KEY); CREATE TABLE orders(id TEXT PRIMARY KEY);");
  sqlite.exec(readFileSync("migrations/0046_checkout_cancellation_feedback.sql", "utf8"));
  sqlite.prepare("INSERT INTO whatsapp_conversations VALUES(?)").run("conv-synthetic");
  sqlite.prepare("INSERT INTO checkout_cancellation_events VALUES(?,?,?,?,?,?,?,?,?)").run("cancel-synthetic", "conv-synthetic", "***4567", "OFFER", "en", null, "provider-cancel-synthetic", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
  const insert = sqlite.prepare("INSERT INTO checkout_cancellation_feedback_events VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  insert.run("reason-synthetic", "cancel-synthetic", "REASON", "ORDER_LATER", null, "START_WHEN_READY", "REASON_SELECTED", "provider-reason-synthetic", "2026-01-01T00:01:00Z", null, "2026-01-01T00:01:00Z");
  insert.run("suggestion-expired-a", "cancel-synthetic", "SUGGESTION", null, "Synthetic expired text A", null, "SUGGESTION_PROVIDED", "provider-suggestion-a", "2026-01-01T00:02:00Z", "2026-04-01T00:02:00Z", "2026-01-01T00:02:00Z");
  insert.run("suggestion-expired-b", "cancel-synthetic", "SUGGESTION", null, "Synthetic expired text B", null, "SUGGESTION_PROVIDED", "provider-suggestion-b", "2026-01-02T00:02:00Z", "2026-04-02T00:02:00Z", "2026-01-02T00:02:00Z");
  insert.run("suggestion-future", "cancel-synthetic", "SUGGESTION", null, "Synthetic future text", null, "SUGGESTION_PROVIDED", "provider-suggestion-future", "2026-06-01T00:02:00Z", "2026-09-01T00:02:00Z", "2026-06-01T00:02:00Z");
  return new SqliteD1(sqlite);
}

describe("GFS-404 cancellation suggestion retention", () => {
  it("is dry-run by default and exposes only aggregate counts", async () => {
    const db = fixture();
    const result = await runCancellationSuggestionRetention(db as never, { now: new Date("2026-07-01T00:00:00Z"), batchSize: 1 });
    expect(result).toMatchObject({ dryRun: true, eligible: 1, deleted: 0, batches: 1, hasMore: true });
    expect(JSON.stringify(result)).not.toContain("Synthetic");
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM checkout_cancellation_feedback_events WHERE event_type='SUGGESTION'").get()).toEqual({ count: 3 });
    db.sqlite.close();
  });

  it("deletes expired suggestions in bounded, retry-safe batches and preserves facts/reasons", async () => {
    const db = fixture();
    const options = { now: new Date("2026-07-01T00:00:00Z"), batchSize: 1, dryRun: false } as const;
    const first = await runCancellationSuggestionRetention(db as never, options);
    expect(first).toMatchObject({ dryRun: false, eligible: 1, deleted: 1, batches: 1, hasMore: true });
    const second = await runCancellationSuggestionRetention(db as never, options);
    expect(second).toMatchObject({ eligible: 1, deleted: 1, batches: 1, hasMore: false });
    const retry = await runCancellationSuggestionRetention(db as never, options);
    expect(retry).toMatchObject({ eligible: 0, deleted: 0, batches: 0, hasMore: false });
    expect(db.sqlite.prepare("SELECT id FROM checkout_cancellation_feedback_events WHERE event_type='SUGGESTION' ORDER BY id").all()).toEqual([{ id: "suggestion-future" }]);
    expect(db.sqlite.prepare("SELECT original_stage FROM checkout_cancellation_events WHERE id=?").get("cancel-synthetic")).toEqual({ original_stage: "OFFER" });
    expect(db.sqlite.prepare("SELECT reason_code FROM checkout_cancellation_feedback_events WHERE event_type='REASON'").get()).toEqual({ reason_code: "ORDER_LATER" });
    db.sqlite.close();
  });

  it("does not leave a partial batch when the D1 transaction fails", async () => {
    const db = fixture();
    db.batch = async (statements) => {
      db.sqlite.exec("BEGIN");
      try {
        await statements[0].run();
        throw new Error("synthetic retention batch failure");
      } catch (error) {
        db.sqlite.exec("ROLLBACK");
        throw error;
      }
    };
    await expect(runCancellationSuggestionRetention(db as never, { now: new Date("2026-07-01T00:00:00Z"), batchSize: 2, dryRun: false })).rejects.toThrow("synthetic retention batch failure");
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM checkout_cancellation_feedback_events WHERE event_type='SUGGESTION'").get()).toEqual({ count: 3 });
    db.sqlite.close();
  });

  it("rejects unsafe batch settings before any database work", async () => {
    const db = fixture();
    await expect(runCancellationSuggestionRetention(db as never, { batchSize: 0 })).rejects.toThrow("CANCELLATION_RETENTION_BATCH_SIZE_INVALID");
    db.sqlite.close();
  });
});
