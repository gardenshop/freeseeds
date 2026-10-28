type ReminderStageMinutes = 15 | 30 | 60 | 210 | 240;

export type PaymentReminderV2Delivery = {
  orderId: string;
  paymentId: string;
  stageMinutes: ReminderStageMinutes;
  idempotencyKey: string;
};

export type PaymentReminderV2EnqueueResult = { queued: number; blocked: number; stopped: number };
export type PaymentReminderV2FallbackChoice = "CONFIRMED_COD" | "KEPT_ADVANCE" | "CANCELLED";
export type PaymentReminderV2FallbackResult = "CONFIRMED" | "KEPT_ADVANCE" | "CANCELLED" | "NOT_ELIGIBLE" | "ALREADY_DECIDED";

export type PaymentReminderCodPolicy = {
  feePkr: number;
  revision: string;
  collectionPolicyHash: string | null;
  remittancePolicyHash: string | null;
  testHold?: 0 | 1;
};

const STAGES: readonly ReminderStageMinutes[] = [15, 30, 60, 210, 240];
const TERMINAL_ORDER_STATES = new Set(["CANCELLED", "CANCELLED_UNPAID", "PAID", "PACKING", "DISPATCHED", "DELIVERED", "ARCHIVED"]);

function asIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_PAYMENT_REMINDER_TIME");
  return date.toISOString();
}

function stageId(scheduleId: string, stage: number): string { return `${scheduleId}:stage:${stage}`; }

/** Explicitly creates a schedule for a newly selected unpaid Advance payment; never backfills history. */
export async function createPaymentV2Schedule(db: D1Database, orderId: string, paymentId: string, now: Date, cycle = 0, anchorAtOrderCreation = true): Promise<{ scheduleId: string; created: boolean }> {
  if (!Number.isInteger(cycle) || cycle < 0) throw new Error("INVALID_PAYMENT_REMINDER_CYCLE");
  const current = await db.prepare(`SELECT o.created_at
    FROM orders o JOIN payments p ON p.order_id=o.id
    WHERE o.id=? AND p.id=? AND o.payment_status='PENDING'
      AND o.state IN ('PAYMENT_PENDING','PAYMENT_GRACE') AND p.review_state='PENDING'
      AND p.method IS NOT NULL AND p.method<>'COD'
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)`).bind(orderId, paymentId).first<{ created_at: string }>();
  if (!current || !Number.isFinite(Date.parse(current.created_at))) throw new Error("PAYMENT_REMINDER_ORDER_NOT_ELIGIBLE");
  const timestamp = asIso(now);
  const id = cycle === 0 ? `payment-reminder-v2:${orderId}:${paymentId}` : `payment-reminder-v2:${orderId}:${paymentId}:cycle:${cycle}`;
  const source = cycle === 0 && anchorAtOrderCreation ? current.created_at : timestamp;
  const statements = [db.prepare(`INSERT OR IGNORE INTO payment_reminder_v2_schedules
    (id,order_id,payment_id,cycle,source_created_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(id, orderId, paymentId, cycle, source, timestamp, timestamp), ...STAGES.map((stage) => {
      const dueAt = new Date(Date.parse(source) + stage * 60_000).toISOString();
      const key = stageId(id, stage);
      return db.prepare(`INSERT OR IGNORE INTO payment_reminder_v2_stages
        (id,schedule_id,stage_minutes,due_at,idempotency_key,created_at,updated_at)
        SELECT ?,?,?,?,?,?,? FROM payment_reminder_v2_schedules WHERE id=?`)
        .bind(key, id, stage, dueAt, key, timestamp, timestamp, id);
    })];
  const results = await db.batch(statements);
  const existing = await db.prepare("SELECT id FROM payment_reminder_v2_schedules WHERE order_id=? AND payment_id=? AND cycle=?").bind(orderId, paymentId, cycle).first<{ id: string }>();
  if (!existing) throw new Error("PAYMENT_REMINDER_SCHEDULE_NOT_CREATED");
  return { scheduleId: existing.id, created: Number(results[0]?.meta?.changes ?? 0) === 1 };
}

async function stopSchedule(db: D1Database, id: string, reason: string, now: string, pause: boolean): Promise<void> {
  await db.batch([
    db.prepare("UPDATE payment_reminder_v2_schedules SET status=?,stop_reason=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(pause ? "PAUSED" : "STOPPED", reason, now, id),
    ...(pause ? [] : [db.prepare("UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,last_error=?,updated_at=? WHERE schedule_id=? AND status IN ('PENDING','CLAIMED','QUEUED')").bind(now, reason, now, id)])
  ]);
}

/** Claims at most one due stage per schedule and writes its durable Queue job atomically. */
export async function enqueueDuePaymentV2Stages(db: D1Database, now: Date, enabled: boolean): Promise<PaymentReminderV2EnqueueResult> {
  const timestamp = asIso(now);
  const result: PaymentReminderV2EnqueueResult = { queued: 0, blocked: 0, stopped: 0 };
  if (!enabled) return result;
  const schedules = await db.prepare(`SELECT s.id,s.order_id,s.payment_id,s.held_at,o.customer_id,o.state AS order_state,
      o.payment_status,p.review_state,p.method,c.wa_id,
      EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS has_receipt,
      EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=c.wa_id) AS opted_out,
      EXISTS(SELECT 1 FROM cod_order_details cd WHERE cd.order_id=o.id) AS is_cod
    FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN payments p ON p.id=s.payment_id JOIN customers c ON c.id=o.customer_id
    WHERE s.status='ACTIVE' ORDER BY s.created_at,s.id`).all<{
      id: string; order_id: string; payment_id: string; held_at: string | null; customer_id: string; wa_id: string;
      order_state: string; payment_status: string; review_state: string; method: string | null; has_receipt: number; opted_out: number; is_cod: number;
    }>();
  for (const schedule of schedules.results ?? []) {
    const pause = Boolean(schedule.held_at || schedule.has_receipt || schedule.review_state === "REVIEW" || schedule.order_state === "PAYMENT_REVIEW");
    const stopped = Boolean(schedule.is_cod || schedule.opted_out || schedule.payment_status === "PAID" || TERMINAL_ORDER_STATES.has(schedule.order_state) || !schedule.method || schedule.method === "COD");
    if (pause || stopped) {
      const reason = schedule.held_at ? "HELD" : schedule.has_receipt ? "RECEIPT_SUBMITTED" : schedule.review_state === "REVIEW" || schedule.order_state === "PAYMENT_REVIEW" ? "PAYMENT_REVIEW" : schedule.is_cod || schedule.method === "COD" ? "COD_ORDER" : schedule.opted_out ? "OPTED_OUT" : "TERMINAL";
      await stopSchedule(db, schedule.id, reason, timestamp, pause);
      result.stopped += 1;
      continue;
    }
    const due = await db.prepare(`SELECT id,stage_minutes,idempotency_key FROM payment_reminder_v2_stages
      WHERE schedule_id=? AND status='PENDING' AND due_at<=?
      AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_stages prior WHERE prior.schedule_id=? AND prior.stage_minutes<payment_reminder_v2_stages.stage_minutes
        AND prior.status NOT IN ('SENT','DELIVERED','SKIPPED','BLOCKED_TEMPLATE','BLOCKED_WINDOW','DEAD_LETTER','CANCELLED'))
      ORDER BY stage_minutes LIMIT 1`).bind(schedule.id, timestamp, schedule.id).first<{ id: string; stage_minutes: ReminderStageMinutes; idempotency_key: string }>();
    if (!due) continue;
    const claimed = await db.prepare(`UPDATE payment_reminder_v2_stages SET status='CLAIMED',updated_at=? WHERE id=? AND status='PENDING' AND EXISTS(
      SELECT 1 FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN payments p ON p.order_id=o.id
      WHERE s.id=? AND s.status='ACTIVE' AND s.held_at IS NULL AND o.payment_status='PENDING' AND o.state IN ('PAYMENT_PENDING','PAYMENT_GRACE')
        AND p.review_state='PENDING' AND p.method IS NOT NULL AND p.method<>'COD'
        AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
        AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=o.customer_id OR x.wa_id=(SELECT c.wa_id FROM customers c WHERE c.id=o.customer_id)))`)
      .bind(timestamp, due.id, schedule.id).run();
    if (Number(claimed.meta.changes) !== 1) continue;
    const statements = [
      ...(due.stage_minutes === 240 ? [
        db.prepare("UPDATE payment_reminder_v2_schedules SET phase='PAYMENT_GRACE',updated_at=? WHERE id=? AND status='ACTIVE' AND phase='PAYMENT_PENDING'").bind(timestamp, schedule.id),
        db.prepare("UPDATE whatsapp_conversations SET state='PAYMENT_GRACE',updated_at=? WHERE wa_id=? AND state IN ('PAYMENT_PENDING','PAYMENT_METHOD') AND state_data LIKE ?").bind(timestamp, schedule.wa_id, `%\"orderId\":\"${schedule.order_id}\"%`)
      ] : []),
      db.prepare(`INSERT OR IGNORE INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at)
        SELECT ?,?,'WHATSAPP_PAYMENT_REMINDER',?,?, 'PENDING',?,?,? WHERE EXISTS(SELECT 1 FROM payment_reminder_v2_stages WHERE id=? AND status='CLAIMED')`)
        .bind(crypto.randomUUID(), due.idempotency_key, schedule.order_id, JSON.stringify({ scheduleId: schedule.id, stageId: due.id, stageMinutes: due.stage_minutes, orderId: schedule.order_id, paymentId: schedule.payment_id, customerId: schedule.customer_id }), timestamp, timestamp, timestamp, due.id),
      db.prepare("UPDATE payment_reminder_v2_stages SET status='QUEUED',updated_at=? WHERE id=? AND status='CLAIMED' AND EXISTS(SELECT 1 FROM outbox_jobs WHERE idempotency_key=?)").bind(timestamp, due.id, due.idempotency_key)
    ];
    const rows = await db.batch(statements);
    if (Number(rows.at(-1)?.meta?.changes ?? 0) === 1) result.queued += 1;
    else result.blocked += 1;
  }
  return result;
}

export async function setPaymentReminderV2OptOut(db: D1Database, customerId: string | null, waId: string, now: Date): Promise<void> {
  const timestamp = asIso(now);
  await db.batch([
    db.prepare("INSERT INTO payment_reminder_v2_opt_outs(customer_id,wa_id,opted_out_at,source) VALUES(?,?,?,'WHATSAPP') ON CONFLICT(wa_id) DO UPDATE SET customer_id=COALESCE(excluded.customer_id,payment_reminder_v2_opt_outs.customer_id),opted_out_at=excluded.opted_out_at").bind(customerId, waId, timestamp),
    db.prepare("UPDATE payment_reminder_v2_schedules SET status='STOPPED',phase='STOPPED',stop_reason='OPTED_OUT',updated_at=? WHERE status='ACTIVE' AND order_id IN (SELECT o.id FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=?)").bind(timestamp, waId),
    db.prepare("UPDATE payment_reminder_v2_stages SET status='SKIPPED',completed_at=?,last_error='OPTED_OUT',updated_at=? WHERE status IN ('PENDING','CLAIMED','QUEUED') AND schedule_id IN (SELECT s.id FROM payment_reminder_v2_schedules s JOIN orders o ON o.id=s.order_id JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=?)").bind(timestamp, timestamp, waId),
    db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_REMINDERS_OPTED_OUT", "CUSTOMER", "PAYMENT_REMINDER_PREFERENCE", "OPT_OUT", crypto.randomUUID(), JSON.stringify({ source: "WHATSAPP" }), timestamp)
  ]);
}

export async function holdPaymentV2Schedule(db: D1Database, orderId: string, reason: string, now: Date): Promise<void> {
  const timestamp = asIso(now);
  await db.prepare("UPDATE payment_reminder_v2_schedules SET held_at=?,hold_reason=?,updated_at=? WHERE order_id=? AND status='ACTIVE'").bind(timestamp, reason.slice(0, 120), timestamp, orderId).run();
}

export async function resolvePaymentReminderCodFallback(db: D1Database, orderId: string, waId: string, choice: PaymentReminderV2FallbackChoice, correlationId: string, policy?: PaymentReminderCodPolicy): Promise<PaymentReminderV2FallbackResult> {
  const current = await db.prepare(`SELECT o.total_payable AS base_amount_pkr,o.state,o.payment_status,f.choice AS decision
    FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id
    LEFT JOIN payment_reminder_cod_fallbacks f ON f.order_id=o.id
    WHERE o.id=? AND c.wa_id=? AND (f.choice IS NOT NULL OR (
      o.state='PAYMENT_PENDING' AND o.payment_status='PENDING' AND o.archived_at IS NULL AND p.review_state='PENDING' AND p.method IS NOT NULL AND p.method<>'COD'
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
      AND EXISTS(SELECT 1 FROM payment_reminder_v2_schedules s JOIN payment_reminder_v2_stages st ON st.schedule_id=s.id
        WHERE s.order_id=o.id AND s.status='ACTIVE' AND s.phase='PAYMENT_GRACE' AND st.stage_minutes=240 AND st.status IN ('QUEUED','SENT','DELIVERED'))
    ))`).bind(orderId, waId).first<{ base_amount_pkr: number; state: string; payment_status: string; decision: string | null }>();
  if (!current) return "NOT_ELIGIBLE";
  if (current.decision) return current.decision === "CONFIRMED_COD" ? "CONFIRMED" : current.decision === "KEPT_ADVANCE" ? "KEPT_ADVANCE" : "CANCELLED";
  if (current.state !== "PAYMENT_PENDING" || current.payment_status !== "PENDING") return "NOT_ELIGIBLE";
  const fee = policy?.feePkr ?? 0;
  if (choice === "CONFIRMED_COD" && (!policy || fee !== 125 || !policy.revision)) return "NOT_ELIGIBLE";
  const quotedFee = choice === "CONFIRMED_COD" ? fee : 125;
  const total = Number(current.base_amount_pkr) + quotedFee;
  const timestamp = new Date().toISOString();
  const statements = [db.prepare(`INSERT OR IGNORE INTO payment_reminder_cod_fallbacks
    (order_id,choice,consent_source,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,correlation_id,created_at,updated_at)
    VALUES(?,?, 'WHATSAPP_INTERACTIVE',?,?,?, ?,?,?)`).bind(orderId, choice, Number(current.base_amount_pkr), quotedFee, total, correlationId, timestamp, timestamp)];
  if (choice === "CONFIRMED_COD") {
    statements.push(db.prepare(`INSERT OR IGNORE INTO cod_order_details
      (order_id,base_amount_pkr,cod_fee_pkr,quoted_total_pkr,policy_revision,collection_policy_hash,remittance_policy_hash,test_hold,status,created_at,updated_at)
      SELECT o.id,o.total_payable,?,?, ?,?,?,?,'COD_PENDING',?,? FROM orders o JOIN payments p ON p.order_id=o.id
      WHERE o.id=? AND o.state='PAYMENT_PENDING' AND o.payment_status='PENDING' AND p.review_state='PENDING' AND p.method IS NOT NULL AND p.method<>'COD'
        AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
        AND NOT EXISTS(SELECT 1 FROM cod_order_details existing WHERE existing.order_id=o.id)`)
      .bind(fee, total, policy!.revision, policy!.collectionPolicyHash, policy!.remittancePolicyHash, policy!.testHold ?? 0, timestamp, timestamp, orderId));
    statements.push(db.prepare("UPDATE orders SET state='COD_PENDING',payment_status='COD_PENDING',updated_at=? WHERE id=? AND state='PAYMENT_PENDING' AND payment_status='PENDING' AND EXISTS(SELECT 1 FROM payment_reminder_cod_fallbacks WHERE order_id=? AND choice='CONFIRMED_COD') AND EXISTS(SELECT 1 FROM cod_order_details WHERE order_id=? AND quoted_total_pkr=?)").bind(timestamp, orderId, orderId, orderId, total));
    statements.push(db.prepare("UPDATE payments SET review_state='COD_PENDING',updated_at=? WHERE order_id=? AND review_state='PENDING' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND state='COD_PENDING' AND payment_status='COD_PENDING')").bind(timestamp, orderId, orderId));
  } else if (choice === "CANCELLED") {
    statements.push(db.prepare("UPDATE orders SET state='CANCELLED',payment_status='CANCELLED_UNPAID',updated_at=? WHERE id=? AND state='PAYMENT_PENDING' AND payment_status='PENDING' AND EXISTS(SELECT 1 FROM payment_reminder_cod_fallbacks WHERE order_id=? AND choice='CANCELLED')").bind(timestamp, orderId, orderId));
    statements.push(db.prepare("UPDATE payments SET review_state='CANCELLED_UNPAID',updated_at=? WHERE order_id=? AND review_state='PENDING' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND state='CANCELLED')").bind(timestamp, orderId, orderId));
  }
  statements.push(db.prepare("UPDATE payment_reminder_v2_schedules SET status='STOPPED',phase='STOPPED',stop_reason=?,updated_at=? WHERE order_id=? AND status IN ('ACTIVE','PAUSED')").bind(choice === "CONFIRMED_COD" ? "COD_CONFIRMED" : choice === "KEPT_ADVANCE" ? "CUSTOMER_KEPT_ADVANCE" : "CUSTOMER_CANCELLED", timestamp, orderId));
  statements.push(db.prepare("UPDATE payment_reminder_v2_stages SET status=CASE WHEN status IN ('SENT','DELIVERED') THEN status ELSE 'CANCELLED' END,completed_at=COALESCE(completed_at,?),last_error=?,updated_at=? WHERE schedule_id IN (SELECT id FROM payment_reminder_v2_schedules WHERE order_id=?) AND status IN ('PENDING','CLAIMED','QUEUED')").bind(timestamp, choice, timestamp, orderId));
  statements.push(db.prepare("UPDATE outbox_jobs SET status='CANCELLED',last_error=?,updated_at=? WHERE entity_id=? AND kind='WHATSAPP_PAYMENT_REMINDER' AND status NOT IN ('SENT','DEAD_LETTER','PERMANENT_FAILURE')").bind(choice, timestamp, orderId));
  statements.push(db.prepare("INSERT OR IGNORE INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(`payment_reminder_fallback:${orderId}`, choice === "CONFIRMED_COD" ? "PAYMENT_REMINDER_COD_CONFIRMED" : choice === "KEPT_ADVANCE" ? "PAYMENT_REMINDER_ADVANCE_RETAINED" : "PAYMENT_REMINDER_ORDER_CANCELLED", "CUSTOMER", "ORDER", orderId, correlationId, JSON.stringify({ choice, baseAmountPkr: Number(current.base_amount_pkr), codFeePkr: quotedFee, quotedTotalPkr: total, consentSource: "WHATSAPP_INTERACTIVE" }), timestamp));
  try { await db.batch(statements); } catch { return "NOT_ELIGIBLE"; }
  if (choice === "CONFIRMED_COD") {
    const updated = await db.prepare("SELECT state,payment_status FROM orders WHERE id=?").bind(orderId).first<{ state: string; payment_status: string }>();
    return updated?.state === "COD_PENDING" && updated.payment_status === "COD_PENDING" ? "CONFIRMED" : "NOT_ELIGIBLE";
  }
  if (choice === "CANCELLED") {
    const updated = await db.prepare("SELECT state FROM orders WHERE id=?").bind(orderId).first<{ state: string }>();
    return updated?.state === "CANCELLED" ? "CANCELLED" : "NOT_ELIGIBLE";
  }
  return "KEPT_ADVANCE";
}
