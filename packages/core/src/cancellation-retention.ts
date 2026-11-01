const DAY_MS = 24 * 60 * 60 * 1000;
export const CANCELLATION_SUGGESTION_RETENTION_DAYS = 90;
export const CANCELLATION_RETENTION_DEFAULT_BATCH_SIZE = 100;

type RetentionRow = { id: string };
type RetentionStatement = Pick<D1Database, "prepare">;

export type CancellationRetentionOptions = {
  now?: Date;
  batchSize?: number;
  maxBatches?: number;
  /** Safe default: physical deletion must be explicitly enabled by its caller. */
  dryRun?: boolean;
};

export type CancellationRetentionResult = {
  dryRun: boolean;
  cutoff: string;
  batchSize: number;
  batches: number;
  eligible: number;
  deleted: number;
  hasMore: boolean;
};

function isoNow(value?: Date): string {
  const date = value ?? new Date();
  if (Number.isNaN(date.getTime())) throw new Error("CANCELLATION_RETENTION_DATE_INVALID");
  return date.toISOString();
}

function boundedInteger(value: number | undefined, fallback: number, name: string): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < 1 || result > 1_000) throw new Error(`${name}_INVALID`);
  return result;
}

/**
 * Deletes only expired free-text suggestion events. This function is deliberately
 * not connected to a Worker route, queue consumer, or Cron handler. Callers must
 * pass dryRun:false from a separately approved retention execution path.
 *
 * Each batch is a D1 batch transaction. A failed batch can be retried safely:
 * cancellation facts and reason events are never selected, and already deleted
 * suggestion rows are absent on the next run.
 */
export async function runCancellationSuggestionRetention(
  db: RetentionStatement & Pick<D1Database, "batch">,
  options: CancellationRetentionOptions = {},
): Promise<CancellationRetentionResult> {
  const now = isoNow(options.now);
  const batchSize = boundedInteger(options.batchSize, CANCELLATION_RETENTION_DEFAULT_BATCH_SIZE, "CANCELLATION_RETENTION_BATCH_SIZE");
  const maxBatches = boundedInteger(options.maxBatches, 1, "CANCELLATION_RETENTION_MAX_BATCHES");
  const dryRun = options.dryRun !== false;
  const cutoff = new Date(Date.parse(now) - CANCELLATION_SUGGESTION_RETENTION_DAYS * DAY_MS).toISOString();
  let batches = 0;
  let eligible = 0;
  let deleted = 0;
  let hasMore = false;

  while (batches < maxBatches) {
    const rows = await db.prepare(`SELECT id
      FROM checkout_cancellation_feedback_events
      WHERE event_type='SUGGESTION'
        AND suggestion IS NOT NULL
        AND suggestion_expires_at IS NOT NULL
        AND suggestion_expires_at <= ?
      ORDER BY suggestion_expires_at ASC, id ASC
      LIMIT ?`).bind(now, batchSize).all<RetentionRow>();
    const candidates = rows.results ?? [];
    eligible += candidates.length;
    if (!candidates.length) break;
    batches += 1;

    if (!dryRun) {
      const results = await db.batch(candidates.map(({ id }) => db.prepare(`DELETE FROM checkout_cancellation_feedback_events
        WHERE id=? AND event_type='SUGGESTION' AND suggestion IS NOT NULL
          AND suggestion_expires_at IS NOT NULL AND suggestion_expires_at <= ?`).bind(id, now)));
      deleted += results.reduce((total, result) => total + Number(result.meta?.changes ?? 0), 0);
    }

    if (candidates.length < batchSize || dryRun) break;
  }

  if (batches === maxBatches) {
    const next = await db.prepare(`SELECT id
      FROM checkout_cancellation_feedback_events
      WHERE event_type='SUGGESTION'
        AND suggestion IS NOT NULL
        AND suggestion_expires_at IS NOT NULL
        AND suggestion_expires_at <= ?
      LIMIT 1`).bind(now).all<RetentionRow>();
    hasMore = (next.results ?? []).length > 0;
  }

  return { dryRun, cutoff, batchSize, batches, eligible, deleted, hasMore };
}
