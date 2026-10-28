import { isInsideWhatsAppServiceWindow } from "@gfs/core";

export type PaymentChoiceRecoveryStageMinutes = 15 | 210;
export type PaymentChoiceRecoveryScheduleResult = { scheduled: number; queued: number; blocked: number; skipped: number };

export type PaymentChoiceRecoveryCopyValues = {
  orderNumber: string;
  amount: string | number;
  deliveryFee: string | number;
  codFee?: string | number;
};

const DEFAULT_COPY: Record<PaymentChoiceRecoveryStageMinutes, Record<"en" | "ur", string>> = {
  15: {
    en: "🌱 *Your Free Seeds Order Is Almost Ready!*\n\nOrder: {orderNumber}\nFree Vegetable Seeds (5 Packs): FREE\nDelivery Charges: PKR {deliveryFee}\n\nPlease choose Advance Payment or Cash on Delivery to continue.",
    ur: "🌱 *آپ کا مفت بیجوں کا آرڈر تقریباً تیار ہے!*\n\nآرڈر: {orderNumber}\nمفت سبزیوں کے بیج (5 پیک): مفت\nڈیلیوری چارجز: PKR {deliveryFee}\n\nجاری رکھنے کے لیے پیشگی ادائیگی یا کیش آن ڈیلیوری منتخب کریں۔"
  },
  210: {
    en: "⏳ *Your Free Seeds Order Is Still Awaiting Your Choice*\n\nOrder: {orderNumber}\nAmount including delivery: PKR {amount}\n\nChoose Advance Payment or Cash on Delivery. COD adds an extra PKR {codFee} cash collection fee.\n\nNeed help? Reply HELP.",
    ur: "⏳ *آپ کے مفت بیجوں کے آرڈر کے لیے انتخاب ابھی باقی ہے*\n\nآرڈر: {orderNumber}\nڈیلیوری سمیت رقم: PKR {amount}\n\nپیشگی ادائیگی یا کیش آن ڈیلیوری منتخب کریں۔ COD پر اضافی PKR {codFee} کیش کلیکشن فیس ہوگی۔\n\nمدد چاہیے؟ HELP لکھ کر بھیجیں۔"
  }
};

const NO_COD_FINAL_COPY: Record<"en" | "ur", string> = {
  en: "⏳ *Your Free Seeds Order Is Still Awaiting Your Choice*\n\nOrder: {orderNumber}\nAmount including delivery: PKR {amount}\n\nChoose an available Advance Payment method.\n\nNeed help? Reply HELP.",
  ur: "⏳ *آپ کے مفت بیجوں کے آرڈر کے لیے انتخاب ابھی باقی ہے*\n\nآرڈر: {orderNumber}\nڈیلیوری سمیت رقم: PKR {amount}\n\nدستیاب پیشگی ادائیگی کا طریقہ منتخب کریں۔\n\nمدد چاہیے؟ HELP لکھ کر بھیجیں۔"
};

function renderRecoveryCopy(template: string, values: PaymentChoiceRecoveryCopyValues): string {
  return template.replace(/\{(orderNumber|amount|deliveryFee|codFee)\}/g, (_match, name: keyof PaymentChoiceRecoveryCopyValues) => {
    const value = values[name];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** Reads stage-specific internal CMS copy, falling back safely before 0042 is deployed. */
export async function paymentChoiceRecoveryCopy(
  db: D1Database,
  stage: PaymentChoiceRecoveryStageMinutes,
  locale: "en" | "ur",
  values: PaymentChoiceRecoveryCopyValues,
): Promise<{ text: string; version: number | null }> {
  let body: string | undefined;
  let version: number | null = null;
  try {
    const row = await db.prepare("SELECT version,body FROM payment_choice_recovery_template_versions WHERE stage_minutes=? AND locale=? AND state='PUBLISHED' ORDER BY version DESC LIMIT 1").bind(stage, locale).first<{ version: number; body: string }>();
    body = row?.body;
    version = row?.version == null ? null : Number(row.version);
  } catch {
    // Migration 0042 is intentionally optional until the release gate passes.
  }
  const safeTemplate = stage === 210 && values.codFee === undefined ? NO_COD_FINAL_COPY[locale] : body || DEFAULT_COPY[stage][locale];
  return { text: renderRecoveryCopy(safeTemplate, values), version: safeTemplate === NO_COD_FINAL_COPY[locale] ? null : version };
}

export function defaultPaymentChoiceRecoveryCopy(stage: PaymentChoiceRecoveryStageMinutes, locale: "en" | "ur"): string {
  return DEFAULT_COPY[stage][locale];
}

const STAGES: readonly PaymentChoiceRecoveryStageMinutes[] = [15, 210];

function iso(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("INVALID_PAYMENT_CHOICE_RECOVERY_TIME");
  return value.toISOString();
}

function startAt(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/**
 * Creates only the two durable stage rows for orders created after the
 * activation boundary. It never scans or backfills older orders.
 */
export async function enqueueDuePaymentChoiceRecoveryStages(
  db: D1Database,
  now: Date,
  enabled: boolean,
  configuredStartAt: string | undefined
): Promise<PaymentChoiceRecoveryScheduleResult> {
  const result: PaymentChoiceRecoveryScheduleResult = { scheduled: 0, queued: 0, blocked: 0, skipped: 0 };
  if (!enabled) return result;
  const activationAt = startAt(configuredStartAt);
  if (!activationAt) return result;
  const timestamp = iso(now);
  const candidates = await db.prepare(`SELECT o.id,o.created_at,p.id AS payment_id,c.wa_id,wc.last_inbound_message_id,wc.last_inbound_at,
      CASE WHEN json_extract(wc.state_data,'$.language')='ur' THEN 'ur' ELSE 'en' END AS locale
    FROM orders o JOIN payments p ON p.order_id=o.id JOIN customers c ON c.id=o.customer_id
    JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id
    WHERE o.created_at>=? AND o.created_at<=? AND o.archived_at IS NULL
      AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND o.payment_status='PENDING'
      AND p.method IS NULL AND p.review_state='PENDING'
      AND wc.state IN ('PAYMENT_METHOD','PAYMENT_PENDING') AND wc.last_inbound_message_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id)
      AND NOT EXISTS(SELECT 1 FROM outbound_messages m WHERE m.order_id=o.id AND m.kind='PAYMENT_CHOICE_RECOVERY')
    ORDER BY o.created_at,o.id LIMIT 100`).bind(activationAt, timestamp).all<{
      id: string; created_at: string; payment_id: string; wa_id: string; last_inbound_message_id: string | null; last_inbound_at: string | null; locale: "en" | "ur";
    }>();

  for (const candidate of candidates.results ?? []) {
    const created = Date.parse(candidate.created_at);
    if (!Number.isFinite(created)) { result.skipped += 1; continue; }
    const statements = STAGES.map((stage) => {
      const dueAt = new Date(created + stage * 60_000).toISOString();
      const key = `payment-choice-recovery:${candidate.id}:${stage}`;
      return db.prepare(`INSERT OR IGNORE INTO payment_choice_recovery_stages
        (order_id,stage_minutes,status,due_at,locale,inbound_message_id,inbound_at,outbound_idempotency_key,created_at,updated_at)
        VALUES(?,?, 'PENDING',?,?,?,?,?,?,?)`).bind(candidate.id, stage, dueAt, candidate.locale, candidate.last_inbound_message_id, candidate.last_inbound_at, key, timestamp, timestamp);
    });
    const rows = await db.batch(statements);
    result.scheduled += rows.reduce((count, row) => count + Number(row.meta?.changes ?? 0), 0);
  }

  const due = await db.prepare(`SELECT s.order_id,s.stage_minutes,s.outbound_idempotency_key,s.inbound_message_id,s.inbound_at,
      o.state,o.payment_status,o.archived_at,p.review_state,p.method,c.id AS customer_id,c.wa_id,wc.state AS conversation_state,wc.last_inbound_message_id,wc.last_inbound_at,
      EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS has_receipt,
      EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=o.id) AS is_cod,
      EXISTS(SELECT 1 FROM payment_reminder_v2_opt_outs x WHERE x.customer_id=c.id OR x.wa_id=c.wa_id) AS opted_out
    FROM payment_choice_recovery_stages s JOIN orders o ON o.id=s.order_id JOIN payments p ON p.order_id=o.id
      JOIN customers c ON c.id=o.customer_id JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id
    WHERE s.status='PENDING' AND s.due_at<=? ORDER BY s.due_at,s.order_id LIMIT 100`).bind(timestamp).all<{
      order_id: string; stage_minutes: PaymentChoiceRecoveryStageMinutes; outbound_idempotency_key: string; inbound_message_id: string | null; inbound_at: string | null;
      state: string; payment_status: string; archived_at: string | null; review_state: string; method: string | null; customer_id: string; wa_id: string; conversation_state: string;
      last_inbound_message_id: string | null; last_inbound_at: string | null; has_receipt: number; is_cod: number; opted_out: number;
    }>();
  for (const stage of due.results ?? []) {
    const currentInboundId = stage.last_inbound_message_id;
    const open = Boolean(currentInboundId) && isInsideWhatsAppServiceWindow(stage.last_inbound_at, now.getTime());
    const eligible = !stage.archived_at && (stage.state === "DETAILS_COMPLETED" || stage.state === "PAYMENT_PENDING") && (stage.conversation_state === "PAYMENT_METHOD" || stage.conversation_state === "PAYMENT_PENDING") && stage.payment_status === "PENDING" && stage.review_state === "PENDING" && !stage.method && !stage.has_receipt && !stage.is_cod && !stage.opted_out && /^\d{7,20}$/.test(stage.wa_id);
    if (!eligible || !open) {
      const status = !eligible ? "SKIPPED" : "BLOCKED_WINDOW";
      await db.prepare("UPDATE payment_choice_recovery_stages SET status=?,last_error=?,inbound_message_id=?,inbound_at=?,updated_at=? WHERE order_id=? AND stage_minutes=? AND status='PENDING'")
        .bind(status, !eligible ? "PAYMENT_CHOICE_RECOVERY_NO_LONGER_ELIGIBLE" : "WHATSAPP_SERVICE_WINDOW_CLOSED", currentInboundId, stage.last_inbound_at, timestamp, stage.order_id, stage.stage_minutes).run();
      if (status === "BLOCKED_WINDOW") result.blocked += 1; else result.skipped += 1;
      continue;
    }
    const claimed = await db.prepare("UPDATE payment_choice_recovery_stages SET status='QUEUED',inbound_message_id=?,inbound_at=?,updated_at=? WHERE order_id=? AND stage_minutes=? AND status='PENDING'")
      .bind(currentInboundId, stage.last_inbound_at, timestamp, stage.order_id, stage.stage_minutes).run();
    if (Number(claimed.meta?.changes ?? 0) !== 1) continue;
    await db.prepare(`INSERT OR IGNORE INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
      VALUES(?,?,?,?,?,'PENDING',0,?,?,?)`).bind(crypto.randomUUID(), stage.outbound_idempotency_key, "WHATSAPP_PAYMENT_CHOICE_RECOVERY", stage.order_id, JSON.stringify({ orderId: stage.order_id, stageMinutes: stage.stage_minutes, customerId: stage.customer_id }), timestamp, timestamp, timestamp).run();
    result.queued += 1;
  }
  return result;
}
