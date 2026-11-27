import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import apiWorker from "../apps/api/src/index.js";
import { createWhatsAppProvider, createWhatsAppTestOutboundGuard, WHATSAPP_TEST_MESSAGE_LIMIT, WHATSAPP_TEST_WINDOW_MS } from "../packages/core/src/index.js";

function fixture(start = "2026-11-27T13:00:00.000Z") {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE outbound_messages (
    id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, order_id TEXT, customer_id TEXT,
    kind TEXT NOT NULL, provider_message_id TEXT, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) { args = values; return statement; },
        async run() { const result = sqlite.prepare(sql).run(...args as never[]); return { meta: { changes: Number(result.changes) } }; },
        async first() { return sqlite.prepare(sql).get(...args as never[]); }
      };
      return statement;
    }
  } as unknown as D1Database;
  const now = new Date(Date.parse(start) + 1_000);
  const settings = { enabled: "true", deploymentState: "ISOLATED_WHATSAPP_TEST", recipient: "+15555550123", windowStart: start };
  const guard = createWhatsAppTestOutboundGuard(db, settings, () => new Date(now));
  if (!guard) throw new Error("test guard not created");
  const send = (body: string, to = settings.recipient) => guard.send(to, { messaging_product: "whatsapp", to, type: "text", text: { body } }, async () => ({ providerMessageId: `synthetic-${body}` }));
  return { sqlite, db, guard, settings, now, send };
}

describe("isolated WhatsApp test budget", () => {
  it("allows ten eligible message attempts and atomically blocks eleven", async () => {
    const test = fixture();
    for (let index = 1; index <= WHATSAPP_TEST_MESSAGE_LIMIT; index += 1) await test.send(`synthetic-${index}`);
    await expect(test.send("synthetic-11")).rejects.toThrow("WHATSAPP_TEST_BUDGET_EXHAUSTED");
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ n: 10 });
  });

  it("enforces the same durable budget at the Meta provider boundary", async () => {
    const test = fixture();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ messages: [{ id: `synthetic-provider-${fetcher.mock.calls.length}` }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    try {
      const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: "v26.0", phoneNumberId: "synthetic-phone-id", accessToken: "synthetic-access-token", outboundGuard: test.guard });
      for (let index = 1; index <= 10; index += 1) await provider.sendText(test.settings.recipient!, `provider-${index}`);
      await expect(provider.sendText(test.settings.recipient!, "provider-11")).rejects.toThrow("WHATSAPP_TEST_BUDGET_EXHAUSTED");
      expect(fetcher).toHaveBeenCalledTimes(10);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not exceed ten under concurrent sends", async () => {
    const test = fixture();
    const results = await Promise.allSettled(Array.from({ length: 24 }, (_, index) => test.send(`parallel-${index}`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ n: 10 });
  });

  it("shares the ten-message cap across API and Admin guard instances on the same D1", async () => {
    const test = fixture();
    const adminGuard = createWhatsAppTestOutboundGuard(test.db, test.settings, () => new Date(test.now));
    for (let index = 0; index < 6; index += 1) await test.send(`api-${index}`);
    for (let index = 0; index < 4; index += 1) await adminGuard!.send(test.settings.recipient!, { type: "text", text: { body: `admin-${index}` } }, async () => ({ providerMessageId: `synthetic-admin-${index}` }));
    await expect(adminGuard!.send(test.settings.recipient!, { type: "text", text: { body: "admin-11" } }, async () => ({ providerMessageId: "synthetic-admin-11" }))).rejects.toThrow("WHATSAPP_TEST_BUDGET_EXHAUSTED");
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ n: 10 });
  });

  it("pins the single fixed window across separately configured Worker instances", async () => {
    const test = fixture();
    await test.send("anchor");
    const mismatchedWindow = createWhatsAppTestOutboundGuard(test.db, { ...test.settings, windowStart: "2026-11-27T12:59:00.000Z" }, () => new Date(test.now));
    await expect(mismatchedWindow!.send(test.settings.recipient!, { type: "text", text: { body: "second-window" } }, async () => ({ providerMessageId: "must-not-send" }))).rejects.toThrow("WHATSAPP_TEST_WINDOW_MISMATCH");
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ n: 1 });
  });

  it("deduplicates identical payload retries", async () => {
    const test = fixture();
    await test.send("same");
    await expect(test.send("same")).rejects.toThrow("WHATSAPP_TEST_DUPLICATE_SUPPRESSED");
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ n: 1 });
  });

  it("counts unknown acceptance and blocks subsequent sends", async () => {
    const test = fixture();
    await expect(test.guard.send(test.settings.recipient!, { type: "text", text: { body: "ambiguous" } }, async () => { throw new Error("socket closed"); })).rejects.toThrow("WHATSAPP_TEST_ACCEPTANCE_UNKNOWN");
    await expect(test.send("different")).rejects.toThrow("WHATSAPP_TEST_ACCEPTANCE_UNRESOLVED");
    expect(test.sqlite.prepare("SELECT status FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET'").get()).toEqual({ status: "UNKNOWN" });
  });

  it("rejects other recipients before reservation or provider call", async () => {
    const test = fixture();
    const providerSend = vi.fn(async () => ({ providerMessageId: "synthetic" }));
    await expect(test.guard.send("+15555550124", { type: "text" }, providerSend)).rejects.toThrow("WHATSAPP_TEST_RECIPIENT_REJECTED");
    expect(providerSend).not.toHaveBeenCalled();
    expect(test.sqlite.prepare("SELECT COUNT(*) AS n FROM outbound_messages").get()).toEqual({ n: 0 });
  });

  it("enforces the fixed thirty-minute deadline and isolated deployment state", async () => {
    const test = fixture();
    test.now.setTime(Date.parse(test.settings.windowStart) + WHATSAPP_TEST_WINDOW_MS);
    await expect(test.send("late")).rejects.toThrow("WHATSAPP_TEST_WINDOW_EXPIRED");
    const invalid = createWhatsAppTestOutboundGuard(test.sqlite as unknown as D1Database, { ...test.settings, deploymentState: "PRODUCTION_INTEGRATION_READY" }, () => new Date(test.now));
    await expect(invalid!.send(test.settings.recipient!, { type: "text" }, async () => ({ providerMessageId: "no" }))).rejects.toThrow("WHATSAPP_TEST_ISOLATION_REQUIRED");
  });

  it("locks the isolated API to the signed WhatsApp webhook and disables Cron/Queue sends", async () => {
    const response = await apiWorker.fetch(new Request("https://api-test.example.workers.dev/orders", { method: "POST" }), { DEPLOYMENT_STATE: "ISOLATED_WHATSAPP_TEST", WHATSAPP_TEST_MODE: "false" } as never);
    expect(response.status).toBe(404);
    const retry = vi.fn();
    const acknowledge = vi.fn();
    await apiWorker.queue({ messages: [{ body: { kind: "WHATSAPP_PAYMENT_CONFIRMED", idempotencyKey: "synthetic-job", entityId: "synthetic-order", schemaVersion: 1 }, retry, ack: acknowledge }] } as never, { DEPLOYMENT_STATE: "ISOLATED_WHATSAPP_TEST", WHATSAPP_TEST_MODE: "true" } as never);
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(acknowledge).not.toHaveBeenCalled();
    await apiWorker.scheduled({ cron: "* * * * *" } as never, { DEPLOYMENT_STATE: "ISOLATED_WHATSAPP_TEST", WHATSAPP_TEST_MODE: "true" } as never);
  });

  it("is disabled unless explicitly enabled", async () => {
    const test = fixture();
    expect(createWhatsAppTestOutboundGuard(test.sqlite as unknown as D1Database, { ...test.settings, enabled: undefined })).toBeUndefined();
  });
});
