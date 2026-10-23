type ReminderEligibility =
  | { verified: true; kind: "SERVICE_WINDOW" }
  | { verified: true; kind: "APPROVED_TEMPLATE"; locale: "en" | "ur"; templateName: string };

export interface PaymentReminderV2Delivery {
  orderId: string;
  paymentId: string;
  stageMinutes: 15 | 30 | 60 | 210 | 240;
  idempotencyKey: string;
  eligibility: ReminderEligibility;
}

export interface PaymentReminderV2Options {
  enabled?: boolean;
  eligibility?: ReminderEligibility;
  sendReminder?: (delivery: PaymentReminderV2Delivery) => Promise<void>;
  isHeld?: (orderId: string) => Promise<boolean>;
}

export interface PaymentReminderV2Result {
  scheduled: number;
  sent: number;
  skipped: number;
  cancelled: number;
  blocked: number;
  stockRelease: "NOT_APPLICABLE";
}

export interface PaymentReminderV2EnqueueResult {
  queued: number;
  cancelled: number;
  blocked: number;
}

const STAGES = [15, 30, 60, 210, 240, 270] as const;
const TERMINAL_ORDER_STATES = new Set([
  "CANCELLED", "CANCELLED_UNPAID", "PAID", "PACKING", "DISPATCHED", "DELIVERED", "ARCHIVED"
]);

function asIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_PAYMENT_REMINDER_V2_TIME");
  return date.toISOString();
}

/** Explicitly schedule one newly-created V2 order/payment; never scan or backfill historical orders. */
export async function createPaymentV2Schedule(
  db: D1Database,
  orderId: string,
  paymentId: string,
  now: Date
): Promise<{ scheduleId: string; created: boolean }> {
  const createdAt = await db.prepare(
    "SELECT o.created_at FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND p.id=?"
  ).bind(orderId, paymentId).first<{ created_at: string }>();
  if (!createdAt || !Number.isFinite(Date.parse(createdAt.created_at))) {
    throw new Error("PAYMENT_REMINDER_V2_ORDER_PAYMENT_NOT_FOUND");
  }

  const timestamp = asIso(now);
  const scheduleId = `payment-reminder-v2:${orderId}:${paymentId}`;
  const statements = [
    db.prepare(`INSERT OR IGNORE INTO payment_reminder_v2_schedules
      (id,order_id,payment_id,source_created_at,created_at,updated_at)
      SELECT ?,o.id,p.id,o.created_at,?,? FROM orders o JOIN payments p ON p.order_id=o.id
      WHERE o.id=? AND p.id=?`).bind(scheduleId, timestamp, timestamp, orderId, paymentId),
    ...STAGES.map((stage) => {
      const dueAt = new Date(Date.parse(createdAt.created_at) + stage * 60_000).toISOString();
      const action = stage === 270 ? "CANCEL_UNPAID" : "REMINDER";
      const key = `${scheduleId}:stage:${stage}`;
      return db.prepare(`INSERT OR IGNORE INTO payment_reminder_v2_stages
        (id,schedule_id,stage_minutes,due_at,action,idempotency_key,created_at,updated_at)
        SELECT ?,id,?,?, ?,?,?,? FROM payment_reminder_v2_schedules WHERE order_id=? AND payment_id=?`)
        .bind(key, stage, dueAt, action, key, timestamp, timestamp, orderId, paymentId);
    })
  ];
  const results = await db.batch(statements);
  const existing = await db.prepare(
    "SELECT id FROM payment_reminder_v2_schedules WHERE order_id=? AND payment_id=?"
  ).bind(orderId, paymentId).first<{ id: string }>();
  if (!existing) throw new Error("PAYMENT_REMINDER_V2_SCHEDULE_NOT_CREATED");
  return { scheduleId: existing.id, created: Number(results[0]?.meta?.changes ?? 0) > 0 };
}

/** Claims at most one due stage per order and writes its Queue outbox job in the same D1 batch. */
export async function enqueueDuePaymentV2Stages(
  db: D1Database,
  now: Date,
  enabled: boolean
): Promise<PaymentReminderV2EnqueueResult> {
  const timestamp = asIso(now);
  const result: PaymentReminderV2EnqueueResult = { queued: 0, cancelled: 0, blocked: 0 };
  if (!enabled) return result;

  const schedules = await db.prepare(`SELECT s.id,s.order_id,s.payment_id,s.phase,s.held_at,o.customer_id,c.wa_id,o.state AS order_state,
      o.payment_status,p.review_state,
      EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED') AS has_receipt,
      EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=c.wa_id) AS opted_out
    FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id JOIN customers c ON c.id=o.customer_id
    WHERE s.status='ACTIVE' ORDER BY s.created_at,s.id`).all<{
      id: string; order_id: string; payment_id: string; phase: string; held_at: string | null; customer_id:string;wa_id:string;
      order_state: string; payment_status: string; review_state: string; has_receipt: number; opted_out: number;
    }>();

  for (const schedule of schedules.results ?? []) {
    const paused = schedule.held_at || schedule.has_receipt || schedule.review_state === "REVIEW" || schedule.order_state === "PAYMENT_REVIEW";
    const stopped = schedule.opted_out || schedule.payment_status === "PAID" || TERMINAL_ORDER_STATES.has(schedule.order_state);
    if (paused || stopped) {
      const reason = schedule.held_at ? "HELD" : schedule.has_receipt ? "RECEIPT_SUBMITTED"
        : schedule.review_state === "REVIEW" || schedule.order_state === "PAYMENT_REVIEW" ? "PAYMENT_REVIEW"
        : schedule.opted_out ? "OPTED_OUT" : "TERMINAL";
      const status = paused ? "PAUSED" : "STOPPED";
      await db.batch([
        db.prepare(`UPDATE payment_reminder_v2_schedules SET status=?,stop_reason=?,updated_at=?
          WHERE id=? AND status='ACTIVE'`).bind(status, reason, timestamp, schedule.id),
        db.prepare(`UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,updated_at=?
          WHERE schedule_id=? AND status='PENDING' AND EXISTS(
            SELECT 1 FROM payment_reminder_v2_schedules WHERE id=? AND status='STOPPED')`)
          .bind(timestamp, timestamp, schedule.id, schedule.id)
      ]);
      continue;
    }

    const due = await db.prepare(`SELECT id,stage_minutes,action,idempotency_key FROM payment_reminder_v2_stages
      WHERE schedule_id=? AND status='PENDING' AND due_at<=?
        AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_stages prior WHERE prior.schedule_id=?
          AND prior.stage_minutes<payment_reminder_v2_stages.stage_minutes
          AND prior.status NOT IN ('SENT','DELIVERED','SKIPPED','BLOCKED_TEMPLATE','BLOCKED_WINDOW','DEAD_LETTER','CANCELLED'))
      ORDER BY stage_minutes LIMIT 1`)
      .bind(schedule.id, timestamp, schedule.id).first<{ id: string; stage_minutes: number; action: string; idempotency_key: string }>();
    if (!due) {
      const cancellationDue = await db.prepare(`SELECT 1 AS due FROM payment_reminder_v2_stages
        WHERE schedule_id=? AND stage_minutes=270 AND status='PENDING' AND due_at<=?`)
        .bind(schedule.id, timestamp).first<{ due: number }>();
      if (cancellationDue && schedule.phase === "PAYMENT_GRACE") result.blocked += 1;
      continue;
    }

    if (due.stage_minutes === 270) {
      const graceDelivered = await db.prepare(`SELECT 1 AS delivered FROM payment_reminder_v2_stages
        WHERE schedule_id=? AND stage_minutes=240 AND status='DELIVERED'`).bind(schedule.id)
        .first<{ delivered: number }>();
      if (!graceDelivered || schedule.phase !== "PAYMENT_GRACE") { result.blocked += 1; continue; }
      const statements = [
        db.prepare(`UPDATE payment_reminder_v2_stages SET status='CLAIMED',updated_at=?
          WHERE id=? AND status='PENDING' AND EXISTS(SELECT 1 FROM payment_reminder_v2_stages
            WHERE schedule_id=? AND stage_minutes=240 AND status='DELIVERED')`).bind(timestamp, due.id, schedule.id),
        db.prepare(`UPDATE payments SET review_state='CANCELLED_UNPAID',updated_at=?
          WHERE id=? AND review_state='PENDING' AND EXISTS(SELECT 1 FROM orders o WHERE o.id=?
            AND o.state='PAYMENT_GRACE' AND o.payment_status='PENDING' AND o.archived_at IS NULL)
            AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.payment_id=payments.id AND r.order_id=payments.order_id AND r.review_state='SUBMITTED')`)
          .bind(timestamp, schedule.payment_id, schedule.order_id),
        db.prepare(`UPDATE orders SET state='CANCELLED_UNPAID',payment_status='CANCELLED_UNPAID',updated_at=?
          WHERE id=? AND state='PAYMENT_GRACE' AND payment_status='PENDING' AND EXISTS(
            SELECT 1 FROM payments p WHERE p.id=? AND p.review_state='CANCELLED_UNPAID')`)
          .bind(timestamp, schedule.order_id, schedule.payment_id),
        db.prepare(`INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
          SELECT CASE WHEN changes()=1 THEN ? ELSE NULL END,?,?,?,?,?,?,?`)
          .bind(crypto.randomUUID(), "ORDER_CANCELLED_UNPAID", "SYSTEM", "ORDER", schedule.order_id,
            due.idempotency_key, JSON.stringify({ stageMinutes: 270, scheduleId: schedule.id }), timestamp),
        db.prepare(`UPDATE payment_reminder_v2_schedules SET phase='CANCELLED_UNPAID',status='TERMINAL',updated_at=?
          WHERE id=? AND status='ACTIVE' AND phase='PAYMENT_GRACE' AND EXISTS(
            SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=?
              AND o.state='CANCELLED_UNPAID' AND p.review_state='CANCELLED_UNPAID')`)
          .bind(timestamp, schedule.id, schedule.order_id),
        db.prepare(`INSERT OR IGNORE INTO outbox_jobs
          (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at)
          SELECT ?,?,'WHATSAPP_PAYMENT_REMINDER',?,?, 'PENDING',?,?,? WHERE EXISTS(
            SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=?
              AND o.state='CANCELLED_UNPAID' AND p.review_state='CANCELLED_UNPAID')`)
          .bind(crypto.randomUUID(), due.idempotency_key, schedule.order_id,
            JSON.stringify({ scheduleId: schedule.id, stageId: due.id, stageMinutes: 270, orderId: schedule.order_id, paymentId: schedule.payment_id, customerId:schedule.customer_id }),
            timestamp, timestamp, timestamp, schedule.order_id),
        db.prepare(`UPDATE whatsapp_conversations SET state='CANCELLED_UNPAID',updated_at=?
          WHERE wa_id=(SELECT c.wa_id FROM customers c JOIN orders o ON o.customer_id=c.id WHERE o.id=?)
            AND state='PAYMENT_GRACE' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND state='CANCELLED_UNPAID')`)
          .bind(timestamp, schedule.order_id, schedule.order_id),
        db.prepare(`UPDATE payment_reminder_v2_stages SET status='QUEUED',updated_at=?
          WHERE id=? AND status='CLAIMED' AND EXISTS(SELECT 1 FROM outbox_jobs WHERE idempotency_key=?)`)
          .bind(timestamp, due.id, due.idempotency_key)
      ];
      const rows = await db.batch(statements);
      if (Number(rows[1]?.meta?.changes) && Number(rows[2]?.meta?.changes) && Number(rows[4]?.meta?.changes) && Number(rows[7]?.meta?.changes)) {
        result.cancelled += 1;
        result.queued += 1;
      } else result.blocked += 1;
      continue;
    }

    const stageClaim = db.prepare(`UPDATE payment_reminder_v2_stages SET status='CLAIMED',updated_at=?
      WHERE id=? AND status='PENDING' AND EXISTS(
        SELECT 1 FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id
        WHERE s.id=? AND s.status='ACTIVE' AND s.held_at IS NULL AND o.payment_status='PENDING'
          AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_GRACE') AND p.review_state='PENDING'
            AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.payment_id=p.id AND r.order_id=o.id AND r.review_state='SUBMITTED')
          AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
      .bind(timestamp, due.id, schedule.id);
    const statements = [stageClaim];
    if (due.stage_minutes === 240) statements.push(db.prepare(`UPDATE orders SET state='PAYMENT_GRACE',updated_at=?
      WHERE id=? AND state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND payment_status='PENDING' AND EXISTS(
        SELECT 1 FROM payment_reminder_v2_stages WHERE id=? AND status='CLAIMED')`).bind(timestamp, schedule.order_id, due.id));
    if (due.stage_minutes === 240) statements.push(db.prepare(`UPDATE whatsapp_conversations SET state='PAYMENT_GRACE',updated_at=?
      WHERE wa_id=(SELECT c.wa_id FROM customers c JOIN orders o ON o.customer_id=c.id WHERE o.id=?)
        AND state IN ('PAYMENT_METHOD','PAYMENT_PENDING') AND EXISTS(
          SELECT 1 FROM payment_reminder_v2_stages WHERE id=? AND status='CLAIMED')`).bind(timestamp, schedule.order_id, due.id));
    if (due.stage_minutes === 240) statements.push(db.prepare(`UPDATE payment_reminder_v2_schedules SET phase='PAYMENT_GRACE',updated_at=?
      WHERE id=? AND status='ACTIVE' AND phase='PAYMENT_PENDING'`).bind(timestamp, schedule.id));
    statements.push(db.prepare(`INSERT OR IGNORE INTO outbox_jobs
      (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at)
      SELECT ?,?,'WHATSAPP_PAYMENT_REMINDER',?,?, 'PENDING',?,?,? WHERE EXISTS(
        SELECT 1 FROM payment_reminder_v2_stages st JOIN payment_reminder_v2_schedules s ON s.id=st.schedule_id
        JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id WHERE st.id=? AND st.status='CLAIMED'
          AND s.status='ACTIVE' AND o.payment_status='PENDING' AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_GRACE')
          AND p.review_state='PENDING' AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.payment_id=p.id AND r.order_id=o.id AND r.review_state='SUBMITTED')
          AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
      .bind(crypto.randomUUID(), due.idempotency_key, schedule.order_id,
        JSON.stringify({ scheduleId: schedule.id, stageId: due.id, stageMinutes: due.stage_minutes, orderId: schedule.order_id, paymentId: schedule.payment_id, customerId:schedule.customer_id }),
        timestamp, timestamp, timestamp, due.id));
    statements.push(db.prepare(`UPDATE payment_reminder_v2_stages SET status='QUEUED',updated_at=?
      WHERE id=? AND status='CLAIMED' AND EXISTS(SELECT 1 FROM outbox_jobs WHERE idempotency_key=?)`)
      .bind(timestamp, due.id, due.idempotency_key));
    const rows = await db.batch(statements);
    if (Number(rows[0]?.meta?.changes) && Number(rows.at(-1)?.meta?.changes)) result.queued += 1;
    else result.blocked += 1;
  }
  return result;
}

export async function setPaymentReminderV2OptOut(
  db: D1Database,
  customerId: string | null,
  waId: string,
  now: Date
): Promise<void> {
  const timestamp=asIso(now);
  await db.batch([
    db.prepare(`INSERT INTO payment_reminder_v2_opt_outs(customer_id,wa_id,opted_out_at,source) VALUES(?,?,?,'WHATSAPP')
      ON CONFLICT(wa_id) DO UPDATE SET customer_id=COALESCE(excluded.customer_id,payment_reminder_v2_opt_outs.customer_id),opted_out_at=excluded.opted_out_at`)
      .bind(customerId,waId,timestamp),
    db.prepare(`UPDATE payment_reminder_v2_schedules SET status='STOPPED',stop_reason='OPTED_OUT',updated_at=?
      WHERE status='ACTIVE' AND order_id IN (SELECT o.id FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=?)`)
      .bind(timestamp,waId),
    db.prepare(`UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,last_error='OPTED_OUT',updated_at=?
      WHERE status='PENDING' AND schedule_id IN (SELECT s.id FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=?)`)
      .bind(timestamp,timestamp,waId),
    db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),"PAYMENT_REMINDERS_OPTED_OUT","CUSTOMER","PAYMENT_REMINDER_PREFERENCE","OPT_OUT",crypto.randomUUID(),JSON.stringify({source:"WHATSAPP"}),timestamp)
  ]);
}

export async function holdPaymentV2Schedule(
  db: D1Database,
  orderId: string,
  reason: string,
  now: Date
): Promise<void> {
  await db.prepare(`UPDATE payment_reminder_v2_schedules
    SET held_at=?,hold_reason=?,updated_at=? WHERE order_id=? AND status='ACTIVE'`)
    .bind(asIso(now), reason.slice(0, 120), asIso(now), orderId).run();
}

/** Process persisted due stages. Sends are disabled unless both flags are explicitly supplied. */
export async function processDuePaymentV2Schedules(
  db: D1Database,
  now: Date,
  options: PaymentReminderV2Options = {}
): Promise<PaymentReminderV2Result> {
  const currentTime = asIso(now);
  const result: PaymentReminderV2Result = {
    scheduled: 0, sent: 0, skipped: 0, cancelled: 0, blocked: 0, stockRelease: "NOT_APPLICABLE"
  };
  const schedules = await db.prepare(`SELECT s.id,s.order_id,s.payment_id,s.phase,s.status,s.held_at,
      o.customer_id,o.state AS order_state,o.payment_status,p.review_state,
      (SELECT COUNT(*) FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED') AS receipt_count,
      EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=c.wa_id) AS opted_out
    FROM payment_reminder_v2_schedules s
    JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id JOIN customers c ON c.id=o.customer_id
    WHERE s.status='ACTIVE' ORDER BY s.created_at,s.id`).all<{
      id: string; order_id: string; payment_id: string; phase: string; status: string; held_at: string | null;
      customer_id: string; order_state: string; payment_status: string; review_state: string;
      receipt_count: number; opted_out: number;
    }>();

  for (const schedule of schedules.results ?? []) {
    const externallyHeld = await options.isHeld?.(schedule.order_id) ?? false;
    const stopReason = schedule.held_at || externallyHeld ? "HELD"
      : schedule.opted_out ? "OPTED_OUT"
      : Number(schedule.receipt_count) > 0 ? "RECEIPT_SUBMITTED"
      : schedule.review_state === "REVIEW" || schedule.order_state === "PAYMENT_REVIEW" ? "PAYMENT_REVIEW"
      : schedule.payment_status === "PAID" || TERMINAL_ORDER_STATES.has(schedule.order_state) ? "TERMINAL"
      : null;
    if (stopReason) {
      const reviewPause = stopReason === "RECEIPT_SUBMITTED" || stopReason === "PAYMENT_REVIEW";
      const stopped = await db.prepare(`UPDATE payment_reminder_v2_schedules
        SET status=?,phase=CASE WHEN ?='STOPPED' THEN 'STOPPED' ELSE phase END,stop_reason=?,updated_at=?
        WHERE id=? AND status='ACTIVE'`).bind(reviewPause ? "PAUSED" : "STOPPED",
        reviewPause ? "PAUSED" : "STOPPED", stopReason, currentTime, schedule.id).run();
      if (Number(stopped.meta.changes) > 0) {
        if (!reviewPause) {
          await db.prepare(`UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,updated_at=?
            WHERE schedule_id=? AND status='PENDING'`).bind(currentTime, currentTime, schedule.id).run();
          result.skipped += 1;
        }
      }
      continue;
    }

    const dueStages = await db.prepare(`SELECT id,stage_minutes,action,idempotency_key
      FROM payment_reminder_v2_stages WHERE schedule_id=? AND status='PENDING' AND due_at<=?
      ORDER BY stage_minutes`).bind(schedule.id, currentTime).all<{
        id: string; stage_minutes: number; action: string; idempotency_key: string;
      }>();
    for (const stage of dueStages.results ?? []) {
      if (stage.stage_minutes === 240) {
        await db.prepare(`UPDATE payment_reminder_v2_schedules SET phase='PAYMENT_GRACE',updated_at=?
          WHERE id=? AND status='ACTIVE' AND phase='PAYMENT_PENDING'
            AND held_at IS NULL
            AND EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id
              WHERE o.id=payment_reminder_v2_schedules.order_id AND o.payment_status<>'PAID'
                AND o.state NOT IN ('PAYMENT_REVIEW','CANCELLED','CANCELLED_UNPAID','PAID','PACKING','DISPATCHED','DELIVERED','ARCHIVED')
                AND p.review_state<>'REVIEW'
                AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED')
                AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
          .bind(currentTime, schedule.id).run();
      }
      if (stage.action === "CANCEL_UNPAID") {
        const cancelled = await db.prepare(`UPDATE payment_reminder_v2_schedules
          SET phase='CANCELLED_UNPAID',status='TERMINAL',updated_at=?
          WHERE id=? AND status='ACTIVE' AND phase IN ('PAYMENT_PENDING','PAYMENT_GRACE')
            AND held_at IS NULL
            AND EXISTS(SELECT 1 FROM orders o JOIN payments p ON p.order_id=o.id
              WHERE o.id=payment_reminder_v2_schedules.order_id AND o.payment_status<>'PAID'
                AND o.state NOT IN ('PAYMENT_REVIEW','CANCELLED','CANCELLED_UNPAID','PAID','PACKING','DISPATCHED','DELIVERED','ARCHIVED')
                AND p.review_state<>'REVIEW'
                AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED')
                AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
          .bind(currentTime, schedule.id).run();
        if (Number(cancelled.meta.changes) > 0) {
          await db.prepare(`UPDATE payment_reminder_v2_stages SET status='CANCELLED',completed_at=?,updated_at=?
            WHERE id=? AND status='PENDING'`).bind(currentTime, currentTime, stage.id).run();
          await db.prepare(`UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,updated_at=?
            WHERE schedule_id=? AND status='PENDING'`).bind(currentTime, currentTime, schedule.id).run();
          result.cancelled += 1;
        }
        continue;
      }

      if (options.enabled !== true || !options.eligibility?.verified || !options.sendReminder) {
        result.blocked += 1;
        continue;
      }
      if (options.eligibility.kind === "APPROVED_TEMPLATE") {
        const template = await db.prepare(`SELECT 1 AS eligible FROM payment_reminder_v2_templates
          WHERE stage_minutes=? AND locale=? AND template_name=? AND enabled=1 AND approved=1`)
          .bind(stage.stage_minutes, options.eligibility.locale, options.eligibility.templateName)
          .first<{ eligible: number }>();
        if (!template) {
          result.blocked += 1;
          continue;
        }
      }

      const claim = await db.prepare(`UPDATE payment_reminder_v2_stages SET status='CLAIMED',updated_at=?
        WHERE id=? AND status='PENDING' AND EXISTS(
          SELECT 1 FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id
          JOIN payments p ON p.id=s.payment_id
          WHERE s.id=payment_reminder_v2_stages.schedule_id AND s.status='ACTIVE' AND s.held_at IS NULL
            AND o.payment_status<>'PAID'
            AND o.state NOT IN ('PAYMENT_REVIEW','CANCELLED','CANCELLED_UNPAID','PAID','PACKING','DISPATCHED','DELIVERED','ARCHIVED')
            AND p.review_state<>'REVIEW'
            AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id AND r.review_state='SUBMITTED')
            AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
        .bind(currentTime, stage.id).run();
      if (Number(claim.meta.changes) === 0) continue;
      try {
        await options.sendReminder({
          orderId: schedule.order_id,
          paymentId: schedule.payment_id,
          stageMinutes: stage.stage_minutes as 15 | 30 | 60 | 210 | 240,
          idempotencyKey: stage.idempotency_key,
          eligibility: options.eligibility
        });
        await db.prepare(`UPDATE payment_reminder_v2_stages SET status='SENT',completed_at=?,updated_at=?
          WHERE id=? AND status='CLAIMED'`).bind(currentTime, currentTime, stage.id).run();
        result.sent += 1;
      } catch {
        await db.prepare(`UPDATE payment_reminder_v2_stages SET status='DEAD_LETTER',
          last_error='PAYMENT_REMINDER_V2_SEND_FAILED',completed_at=?,updated_at=?
          WHERE id=? AND status='CLAIMED'`).bind(currentTime, currentTime, stage.id).run();
        result.blocked += 1;
      }
    }
  }
  return result;
}
