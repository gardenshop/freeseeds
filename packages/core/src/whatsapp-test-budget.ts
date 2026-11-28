import type { WhatsAppOutboundGuard } from "./provider";

export const WHATSAPP_TEST_WINDOW_MS = 30 * 60 * 1000;
export const WHATSAPP_TEST_MESSAGE_LIMIT = 10;

export type WhatsAppTestBudgetSettings = {
  enabled?: string;
  deploymentState?: string;
  recipient?: string;
  windowStart?: string;
};

function normalizedPhone(value: string): string {
  return value.replace(/\D/g, "");
}

function testWindow(settings: WhatsAppTestBudgetSettings, now: Date): { startMs: number; prefix: string } {
  if (settings.deploymentState !== "ISOLATED_WHATSAPP_TEST") throw new Error("WHATSAPP_TEST_ISOLATION_REQUIRED");
  if (!settings.recipient || !/^\+?\d{8,15}$/.test(settings.recipient)) throw new Error("WHATSAPP_TEST_RECIPIENT_NOT_CONFIGURED");
  const startMs = Date.parse(settings.windowStart ?? "");
  if (!Number.isSafeInteger(startMs) || new Date(startMs).toISOString() !== settings.windowStart) throw new Error("WHATSAPP_TEST_WINDOW_INVALID");
  if (now.getTime() < startMs) throw new Error("WHATSAPP_TEST_WINDOW_NOT_STARTED");
  if (now.getTime() >= startMs + WHATSAPP_TEST_WINDOW_MS) throw new Error("WHATSAPP_TEST_WINDOW_EXPIRED");
  return { startMs, prefix: `whatsapp_test_budget:${startMs}:` };
}

async function payloadFingerprint(payload: unknown): Promise<string> {
  const source = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "to"))
    : payload;
  const bytes = new TextEncoder().encode(JSON.stringify(source));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function createWhatsAppTestOutboundGuard(
  db: D1Database,
  settings: WhatsAppTestBudgetSettings,
  clock: () => Date = () => new Date()
): WhatsAppOutboundGuard | undefined {
  if (settings.enabled !== "true") return undefined;

  const assertRecipient = (to: string) => {
    testWindow(settings, clock());
    if (!/^\+?\d{8,15}$/.test(to)) throw new Error("WHATSAPP_TEST_RECIPIENT_REJECTED");
    if (normalizedPhone(to) !== normalizedPhone(settings.recipient ?? "")) throw new Error("WHATSAPP_TEST_RECIPIENT_REJECTED");
  };

  return {
    assertRecipient,
    async send<T>(to: string, payload: unknown, performSend: () => Promise<T>, getProviderMessageId?: (result: T) => string | undefined): Promise<T> {
      assertRecipient(to);
      const { startMs, prefix } = testWindow(settings, clock());
      const windowStart = new Date(startMs).toISOString();
      let anchor: { created_at: string } | null;
      try {
        await db.prepare(`INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at)
          VALUES (?,?,'WHATSAPP_TEST_WINDOW','ACTIVE',0,?,?) ON CONFLICT(idempotency_key) DO NOTHING`)
          .bind(crypto.randomUUID(), "whatsapp_test_window_anchor", windowStart, windowStart).run();
        anchor = await db.prepare("SELECT created_at FROM outbound_messages WHERE idempotency_key=? AND kind='WHATSAPP_TEST_WINDOW'").bind("whatsapp_test_window_anchor").first<{ created_at: string }>();
      } catch {
        throw new Error("WHATSAPP_TEST_BUDGET_UNAVAILABLE");
      }
      if (!anchor) throw new Error("WHATSAPP_TEST_BUDGET_UNAVAILABLE");
      if (anchor.created_at !== windowStart) throw new Error("WHATSAPP_TEST_WINDOW_MISMATCH");
      const fingerprint = await payloadFingerprint(payload);
      testWindow(settings, clock());
      const idempotencyKey = `${prefix}${fingerprint}`;
      const now = clock().toISOString();
      const staleAttemptBefore = new Date(clock().getTime() - 60_000).toISOString();
      let reservation: D1Result;
      try {
        reservation = await db.prepare(`INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at)
          SELECT ?,?,'WHATSAPP_TEST_BUDGET','SENDING',1,?,?
          WHERE (SELECT COALESCE(SUM(attempt_count),0) FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND substr(idempotency_key,1,?)=?) < ?
            AND NOT EXISTS (SELECT 1 FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND status='UNKNOWN' AND substr(idempotency_key,1,?)=?)
            AND NOT EXISTS (SELECT 1 FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND status='SENDING' AND updated_at<=? AND substr(idempotency_key,1,?)=?)
          ON CONFLICT(idempotency_key) DO NOTHING`)
          .bind(crypto.randomUUID(), idempotencyKey, now, now, prefix.length, prefix, WHATSAPP_TEST_MESSAGE_LIMIT, prefix.length, prefix, staleAttemptBefore, prefix.length, prefix)
          .run();
      } catch {
        throw new Error("WHATSAPP_TEST_BUDGET_UNAVAILABLE");
      }
      if (Number(reservation.meta?.changes ?? 0) !== 1) {
        let existing: { status: string } | null;
        try { existing = await db.prepare("SELECT status FROM outbound_messages WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(idempotencyKey).first<{ status: string }>(); }
        catch { throw new Error("WHATSAPP_TEST_BUDGET_UNAVAILABLE"); }
        if (existing?.status === "RETRYABLE") {
          let retry: D1Result;
          try {
            retry = await db.prepare(`UPDATE outbound_messages SET status='SENDING',attempt_count=attempt_count+1,updated_at=?
              WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET' AND status='RETRYABLE'
                AND (SELECT COALESCE(SUM(attempt_count),0) FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND substr(idempotency_key,1,?)=?) < ?
                AND NOT EXISTS (SELECT 1 FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND status='UNKNOWN' AND substr(idempotency_key,1,?)=?)`)
              .bind(now, idempotencyKey, prefix.length, prefix, WHATSAPP_TEST_MESSAGE_LIMIT, prefix.length, prefix).run();
          } catch { throw new Error("WHATSAPP_TEST_BUDGET_UNAVAILABLE"); }
          if (Number(retry.meta?.changes ?? 0) === 1) reservation = retry;
          else throw new Error("WHATSAPP_TEST_BUDGET_EXHAUSTED");
        } else if (existing) throw new Error(existing.status === "UNKNOWN" || existing.status === "SENDING" ? "WHATSAPP_TEST_ACCEPTANCE_UNRESOLVED" : "WHATSAPP_TEST_DUPLICATE_SUPPRESSED");
        else {
        const unresolved = await db.prepare("SELECT 1 AS found FROM outbound_messages WHERE kind='WHATSAPP_TEST_BUDGET' AND status IN ('UNKNOWN','SENDING') AND substr(idempotency_key,1,?)=?").bind(prefix.length, prefix).first().catch(() => ({ found: 1 }));
        if (unresolved) throw new Error("WHATSAPP_TEST_ACCEPTANCE_UNRESOLVED");
        throw new Error("WHATSAPP_TEST_BUDGET_EXHAUSTED");
        }
      }

      let result: T;
      try { testWindow(settings, clock()); }
      catch (error) {
        try { await db.prepare("UPDATE outbound_messages SET status='BLOCKED',last_error='WHATSAPP_TEST_WINDOW_EXPIRED',updated_at=? WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(clock().toISOString(), idempotencyKey).run(); } catch { /* The reservation remains counted. */ }
        throw error;
      }
      try { result = await performSend(); }
      catch (error) {
        const failureCode = error instanceof Error ? error.message : "";
        if (failureCode === "META_MESSAGE_SEND_429" || failureCode === "META_MEDIA_UPLOAD_RETRYABLE") {
          try { await db.prepare("UPDATE outbound_messages SET status='RETRYABLE',last_error=?,updated_at=? WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(failureCode, clock().toISOString(), idempotencyKey).run(); } catch { /* The SENDING reservation remains counted. */ }
          throw new Error("WHATSAPP_TEST_RETRYABLE_REJECTION");
        }
        if (/^META_MESSAGE_SEND_4\d\d$/.test(failureCode) || /^META_MEDIA_UPLOAD_4\d\d$/.test(failureCode)) {
          try { await db.prepare("UPDATE outbound_messages SET status='REJECTED',last_error=?,updated_at=? WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(failureCode, clock().toISOString(), idempotencyKey).run(); } catch { /* The SENDING reservation remains counted. */ }
          throw new Error("WHATSAPP_TEST_PROVIDER_REJECTED");
        }
        try { await db.prepare("UPDATE outbound_messages SET status='UNKNOWN',last_error='WHATSAPP_TEST_ACCEPTANCE_UNKNOWN',updated_at=? WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(clock().toISOString(), idempotencyKey).run(); } catch { /* The SENDING reservation remains counted and blocks stale attempts. */ }
        throw new Error("WHATSAPP_TEST_ACCEPTANCE_UNKNOWN");
      }
      try { await db.prepare("UPDATE outbound_messages SET status='SENT',provider_message_id=?,updated_at=? WHERE idempotency_key=? AND kind='WHATSAPP_TEST_BUDGET'").bind(getProviderMessageId?.(result) ?? null, clock().toISOString(), idempotencyKey).run(); } catch { /* The durable SENDING reservation still counts. */ }
      return result;
    }
  };
}

export function createWhatsAppRelayRecipientBlocker(enabled: string | undefined, recipient: string | undefined): WhatsAppOutboundGuard | undefined {
  if (enabled !== "true" || !recipient || !/^\+?\d{8,15}$/.test(recipient)) return undefined;
  const blockedRecipient = normalizedPhone(recipient);
  const assertRecipient = (to: string) => {
    if (normalizedPhone(to) === blockedRecipient) throw new Error("WHATSAPP_TEST_RECIPIENT_ROUTED_TO_CANDIDATE");
  };
  return {
    assertRecipient,
    async send<T>(to: string, _payload: unknown, performSend: () => Promise<T>): Promise<T> {
      assertRecipient(to);
      return performSend();
    }
  };
}
