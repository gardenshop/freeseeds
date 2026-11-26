export const ORDER_INTENT_VERSION = "GFS-ORDERFLOW-INTENT-030-V1";
export const ORDER_INTENT_DURATION_MS = 30 * 60 * 1000;
const ORDER_INTENT_STAGES = [10, 25, 30] as const;
const ACTIVE_INTENT_STATES = ["PRESENTATION_PENDING","AWAITING_DECISION","ADVANCE_PENDING","COD_CONFIRM_PENDING"] as const;

export type OrderIntentLocale = "en" | "ur";

export function orderIntentOptionRows(locale: OrderIntentLocale, codEnabled: boolean): Array<{ id: string; title: string }> {
  return [
    { id: "PAY_ADVANCE", title: locale === "ur" ? "پیشگی ادائیگی" : "Advance Payment" },
    ...(codEnabled ? [{ id: "PAY_COD", title: locale === "ur" ? "کیش آن ڈیلیوری" : "Cash on Delivery" }] : []),
    { id: "CANCEL_ORDER", title: locale === "ur" ? "آرڈر منسوخ کریں" : "Cancel Order" }
  ];
}

export function orderIntentNewOrderButton(locale: OrderIntentLocale) {
  return { id: "START", title: locale === "ur" ? "نیا آرڈر دیں" : "Place a new order" };
}

export function formatIntentRemainingTime(deadlineAt: string, now: Date, locale: OrderIntentLocale): string | null {
  const remainingMs = Date.parse(deadlineAt) - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (locale === "ur") return `${minutes ? `${minutes} منٹ` : ""}${minutes && seconds ? " " : ""}${seconds ? `${seconds} سیکنڈ` : ""}`;
  return `${minutes ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : ""}${minutes && seconds ? " " : ""}${seconds ? `${seconds} ${seconds === 1 ? "second" : "seconds"}` : ""}`;
}

export async function setOrderIntentChoiceState(db: D1Database, intentId: string, state: "ADVANCE_PENDING" | "COD_CONFIRM_PENDING", now = new Date()): Promise<boolean> {
  const result = await db.prepare(`UPDATE order_confirmation_intents SET state=?,updated_at=?
    WHERE intent_id=? AND workflow_version=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING')
      AND (deadline_at IS NULL OR deadline_at>?)`).bind(state,now.toISOString(),intentId,ORDER_INTENT_VERSION,now.toISOString()).run();
  return Number(result.meta?.changes??0)===1;
}

export async function switchIntentAdvanceToCod(db: D1Database, intentId: string, orderId: string, customerIdHash: string, evidenceCorrelationHash: string, now = new Date()): Promise<boolean> {
  const nowIso=now.toISOString();
  const results=await db.batch([
    db.prepare(`UPDATE payments SET method=NULL,updated_at=? WHERE order_id=? AND method IS NOT NULL AND method<>'COD' AND review_state='PENDING' AND approved_amount IS NULL AND approved_by IS NULL AND approved_at IS NULL AND submitted_at IS NULL AND customer_transaction_reference IS NULL
      AND expected_amount=(SELECT total_payable FROM orders WHERE id=?)
      AND EXISTS(SELECT 1 FROM orders o WHERE o.id=payments.order_id AND o.state='PAYMENT_PENDING' AND o.payment_status='PENDING' AND o.archived_at IS NULL)
      AND EXISTS(SELECT 1 FROM order_confirmation_intents i WHERE i.intent_id=? AND i.order_id=payments.order_id AND i.workflow_version=? AND i.state='ADVANCE_PENDING' AND i.cod_enabled=1 AND (i.deadline_at IS NULL OR i.deadline_at>?))
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=payments.order_id AND r.payment_id=payments.id)`).bind(nowIso,orderId,orderId,intentId,ORDER_INTENT_VERSION,nowIso),
    db.prepare(`UPDATE order_confirmation_intents SET state='COD_CONFIRM_PENDING',updated_at=? WHERE intent_id=? AND changes()=1 AND workflow_version=? AND state='ADVANCE_PENDING' AND cod_enabled=1 AND (deadline_at IS NULL OR deadline_at>?)`).bind(nowIso,intentId,ORDER_INTENT_VERSION,nowIso),
    db.prepare(`INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at)
      SELECT ?,?,'CUSTOMER',?,'ORDER',?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM order_confirmation_intents i WHERE i.intent_id=? AND i.state='COD_CONFIRM_PENDING')`).bind(crypto.randomUUID(),"COD_OPTION_SELECTED_FROM_ADVANCE",customerIdHash,orderId,evidenceCorrelationHash,JSON.stringify({intentId,workflowVersion:ORDER_INTENT_VERSION}),nowIso,intentId),
    db.prepare(`UPDATE outbox_jobs SET status='PERMANENT_FAILURE',last_error='ORDER_INTENT_SWITCHED_TO_COD',updated_at=? WHERE entity_id=? AND kind='WHATSAPP_PAYMENT_INSTRUCTIONS' AND status IN ('PENDING','RETRY','QUEUED') AND EXISTS(SELECT 1 FROM payments p WHERE p.order_id=? AND p.method IS NULL AND p.review_state='PENDING')`).bind(nowIso,orderId,orderId)
  ]);
  return Number(results[0]?.meta?.changes??0)===1 && Number(results[1]?.meta?.changes??0)===1 && Number(results[2]?.meta?.changes??0)===1;
}

export async function cancelOrderIntent(db: D1Database, intentId: string, now = new Date()): Promise<boolean> {
  const timestamp=now.toISOString();
  const results=await db.batch([
    db.prepare(`UPDATE orders SET state='CANCELLED',payment_status='CANCELLED',updated_at=? WHERE id=(SELECT order_id FROM order_confirmation_intents WHERE intent_id=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND (deadline_at IS NULL OR deadline_at>?) )
      AND state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND payment_status='PENDING' AND archived_at IS NULL
      AND EXISTS(SELECT 1 FROM payments p WHERE p.order_id=orders.id AND p.review_state IN ('PENDING','REJECTED') AND p.approved_amount IS NULL AND p.approved_by IS NULL AND p.approved_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=orders.id)
      AND NOT EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=orders.id)`).bind(timestamp,intentId,timestamp),
    db.prepare(`INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
      SELECT ?,?,'CUSTOMER','ORDER',orders.id,?,?,? FROM orders JOIN order_confirmation_intents i ON i.order_id=orders.id WHERE i.intent_id=? AND changes()=1 AND orders.state='CANCELLED'`)
      .bind(crypto.randomUUID(),"ORDER_INTENT_CANCELLED",crypto.randomUUID(),JSON.stringify({intentId,workflowVersion:ORDER_INTENT_VERSION}),timestamp,intentId),
    db.prepare(`DELETE FROM order_eligibility_locks WHERE order_id=(SELECT order_id FROM order_confirmation_intents WHERE intent_id=? AND state='CANCELLED')`).bind(intentId)
  ]);
  return Number(results[0]?.meta?.changes??0)===1;
}

export function orderIntentOptionsText(locale: OrderIntentLocale, advanceTotalPkr: number, codTotalPkr?: number, codFeePkr?: number): string {
  if (locale === "ur") {
    const advance = `PKR ${advanceTotalPkr}`;
    const cod = codTotalPkr === undefined ? "" : `\nکیش آن ڈیلیوری: PKR ${codTotalPkr}، جس میں PKR ${codFeePkr ?? 0} وصولی فیس شامل ہے۔ مکمل رقم پارسل وصول کرتے وقت ادا کریں؛ پیشگی ادائیگی کی ضرورت نہیں۔`;
    return `پیشگی ادائیگی یا کیش آن ڈیلیوری (COD) کے ذریعے 30 منٹ کے اندر اپنے آرڈر کی تصدیق کریں۔\nپیشگی ادائیگی: ${advance}۔${cod}\nادائیگی کا طریقہ منتخب کرنے سے آرڈر کی تصدیق نہیں ہوتی۔`;
  }
  const cod = codTotalPkr === undefined ? "" : `\nCash on Delivery: PKR ${codTotalPkr}, including the PKR ${codFeePkr ?? 0} collection fee. Pay the complete amount in cash when the parcel arrives; no advance payment is required.`;
  return `Confirm your order within 30 minutes through advance payment or Cash on Delivery (COD).\nAdvance payment: PKR ${advanceTotalPkr}.${cod}\nSelecting a payment method alone does not confirm your order.`;
}

export function orderIntentReminderText(stage: 10 | 25 | 30, locale: OrderIntentLocale, orderNumber?: string, remainingTime?: string): string {
  if (locale === "ur") {
    if (stage === 10) return `آپ کے آرڈر کی تصدیق باقی ہے۔ براہ کرم باقی ${remainingTime ?? "وقت"} میں فیصلہ کریں۔`;
    if (stage === 25) return `آخری یاد دہانی: تصدیق کے لیے صرف ${remainingTime ?? "مقررہ وقت"} باقی ہے۔`;
    return "آپ کی درخواست کی میعاد ختم ہو گئی ہے۔ اس درخواست کے تحت کوئی پارسل روانہ نہیں کیا جائے گا۔ آپ نیا آرڈر دے سکتے ہیں۔";
  }
  if (stage === 10) return `Your order awaits confirmation. Please decide within the remaining ${remainingTime ?? "time"}.`;
  if (stage === 25) return `Final reminder. Only ${remainingTime ?? "the remaining time"} left.`;
  const order = orderNumber ? ` for order ${orderNumber}` : "";
  return `Your request${order} has expired. No parcel will be dispatched against this request. You may place a new order.`;
}

export function orderIntentCodConfirmationText(orderNumber: string, grossPkr: number, locale: OrderIntentLocale): string {
  return locale === "ur"
    ? `آپ کے COD آرڈر ${orderNumber} کی تصدیق ہو گئی ہے۔ پارسل وصول کرتے وقت ڈیلیوری رائیڈر یا پاکستان پوسٹ کے ڈاکیے کو مکمل مجموعی رقم PKR ${grossPkr} ادا کریں۔ پیشگی ادائیگی کی ضرورت نہیں۔ ٹریکنگ کی تفصیلات دستیاب ہونے پر بھیج دی جائیں گی۔`
    : `Your COD order ${orderNumber} is confirmed. Please pay the full gross total of PKR ${grossPkr} to the delivery rider or Pakistan Post postman when you receive your parcel. No advance payment is required. Your tracking details will be shared once available.`;
}

export async function anchorOrderIntentOnDelivery(db: D1Database, intentId: string, providerMessageId: string, now = new Date()): Promise<boolean> {
  const intent = await db.prepare(`SELECT intent_id,order_id,workflow_version,state,presentation_message_id,presented_at,created_at
    FROM order_confirmation_intents WHERE intent_id=?`).bind(intentId).first<{
      intent_id: string;
      order_id: string;
      workflow_version: string;
      state: string;
      presentation_message_id: string | null;
      presented_at: string | null;
      created_at: string;
    }>();
  if (!intent || intent.workflow_version !== ORDER_INTENT_VERSION || intent.presentation_message_id !== providerMessageId || intent.presented_at) return false;
  const receipt = await db.prepare(`SELECT provider_timestamp FROM whatsapp_delivery_receipts
    WHERE provider_message_id=? AND status IN ('DELIVERED','READ') ORDER BY provider_timestamp ASC,received_at ASC LIMIT 1`).bind(providerMessageId).first<{ provider_timestamp: string }>();
  if (!receipt) return false;
  const presentedMs = Date.parse(receipt.provider_timestamp);
  const createdMs = Date.parse(intent.created_at);
  if (!Number.isFinite(presentedMs) || !Number.isFinite(createdMs) || presentedMs < createdMs || presentedMs > now.getTime() + 5 * 60 * 1000) return false;

  const presentedAt = new Date(presentedMs).toISOString();
  const deadlineAt = new Date(presentedMs + ORDER_INTENT_DURATION_MS).toISOString();
  const t10At = new Date(presentedMs + 10 * 60 * 1000).toISOString();
  const t25At = new Date(presentedMs + 25 * 60 * 1000).toISOString();
  const t30At = deadlineAt;
  const updatedAt = now.toISOString();
  const insertStage = (stageMinutes: 10 | 25 | 30, dueAt: string) => db.prepare(`INSERT OR IGNORE INTO order_confirmation_intent_stages
    (intent_id,stage_minutes,due_at,status,idempotency_key,created_at,updated_at)
    SELECT ?,?,?,'PENDING',?,?,? WHERE EXISTS (
      SELECT 1 FROM order_confirmation_intents WHERE intent_id=? AND workflow_version=? AND presentation_message_id=? AND presented_at=? AND deadline_at=? AND state IN ('AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING')
    )`).bind(intentId, stageMinutes, dueAt, `order-intent:${intentId}:${ORDER_INTENT_VERSION}:T${stageMinutes}`, updatedAt, updatedAt, intentId, ORDER_INTENT_VERSION, providerMessageId, presentedAt, deadlineAt);

  const results = await db.batch([
    db.prepare(`UPDATE order_confirmation_intents SET presented_at=?,deadline_at=?,
      state=CASE WHEN state='PRESENTATION_PENDING' THEN 'AWAITING_DECISION' ELSE state END,updated_at=?
       WHERE intent_id=? AND workflow_version=? AND presentation_message_id=? AND presented_at IS NULL
         AND state IN ('PRESENTATION_PENDING','ADVANCE_PENDING','COD_CONFIRM_PENDING','CONFIRMED_COD','PAID','PAYMENT_REVIEW','CANCELLED')`).bind(presentedAt, deadlineAt, updatedAt, intentId, ORDER_INTENT_VERSION, providerMessageId),
    insertStage(10, t10At),
    insertStage(25, t25At),
    insertStage(30, t30At)
  ]);
  return Number(results[0]?.meta?.changes ?? 0) === 1;
}

async function suppressIntentStage(db: D1Database, intentId: string, stageMinutes: number, reason: string, now: string) {
  await db.batch([
    db.prepare("UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error=?,updated_at=? WHERE intent_id=? AND stage_minutes=? AND status IN ('PENDING','QUEUED')").bind(reason, now, intentId, stageMinutes),
    db.prepare("UPDATE outbox_jobs SET status='PERMANENT_FAILURE',last_error=?,updated_at=? WHERE idempotency_key=? AND status IN ('PENDING','RETRY','QUEUED')").bind(reason, now, `order-intent:${intentId}:${ORDER_INTENT_VERSION}:T${stageMinutes}`)
  ]);
}

export async function expireOrderIntent(db: D1Database, intentId: string, now = new Date()): Promise<"EXPIRED" | "PAYMENT_REVIEW" | "ALREADY_RESOLVED" | "NOT_DUE" | "MISSING"> {
  const current = await db.prepare(`SELECT i.intent_id,i.state,i.deadline_at,i.presented_at,i.order_id,i.conversation_id,pref.locale,o.state AS order_state,o.payment_status,o.archived_at,
      p.review_state,p.submitted_at,p.customer_transaction_reference,(SELECT COUNT(*) FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AS receipt_count,
      EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=o.id) AS has_cod
    FROM order_confirmation_intents i JOIN orders o ON o.id=i.order_id JOIN payments p ON p.order_id=o.id LEFT JOIN order_confirmation_intent_preferences pref ON pref.intent_id=i.intent_id WHERE i.intent_id=?`).bind(intentId).first<{
      intent_id:string;state:string;deadline_at:string|null;presented_at:string|null;order_id:string;conversation_id:string;locale:string|null;order_state:string;payment_status:string;archived_at:string|null;review_state:string;submitted_at:string|null;customer_transaction_reference:string|null;receipt_count:number;has_cod:number;
    }>();
  if (!current) return "MISSING";
  const nowIso = now.toISOString();
  if (!current.presented_at || !current.deadline_at || Date.parse(current.deadline_at) > now.getTime()) return "NOT_DUE";
  if (current.state === "PAYMENT_REVIEW" || current.review_state === "REVIEW" || current.submitted_at !== null || current.customer_transaction_reference !== null || Number(current.receipt_count) > 0) {
    await db.batch([
      db.prepare("UPDATE order_confirmation_intents SET state='PAYMENT_REVIEW',updated_at=? WHERE intent_id=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING','EXPIRED')").bind(nowIso, intentId),
      ...[10,25,30].map((stage) => db.prepare("UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error='PAYMENT_REVIEW_PROTECTED',updated_at=? WHERE intent_id=? AND stage_minutes=? AND status IN ('PENDING','QUEUED')").bind(nowIso,intentId,stage))
    ]);
    return "PAYMENT_REVIEW";
  }
  if (current.state === "PAID" || current.state === "CONFIRMED_COD" || current.state === "CANCELLED" || current.state === "EXPIRED"
      || current.order_state === "PAID" || current.payment_status === "PAID" || Number(current.has_cod) > 0 || current.order_state === "CANCELLED" || current.order_state === "EXPIRED") {
    const resolved = current.order_state === "PAID" || current.payment_status === "PAID" ? "PAID"
      : Number(current.has_cod) > 0 || current.order_state === "COD_PENDING" ? "CONFIRMED_COD"
      : current.order_state === "CANCELLED" ? "CANCELLED"
      : "EXPIRED";
    const stagesToSuppress = resolved === "EXPIRED" ? [10,25] : [10,25,30];
    await db.batch([
      db.prepare("UPDATE order_confirmation_intents SET state=?,updated_at=? WHERE intent_id=? AND state NOT IN ('PAID','CONFIRMED_COD','PAYMENT_REVIEW','CANCELLED','EXPIRED')").bind(resolved,nowIso,intentId),
      ...stagesToSuppress.map((stage) => db.prepare("UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error='INTENT_NO_LONGER_UNRESOLVED',updated_at=? WHERE intent_id=? AND stage_minutes=? AND status IN ('PENDING','QUEUED')").bind(nowIso,intentId,stage))
    ]);
    return "ALREADY_RESOLVED";
  }

  const presentedAtMs=Date.parse(current.presented_at);
  const deadlineAtMs=Date.parse(current.deadline_at);
  if(!Number.isFinite(presentedAtMs)||deadlineAtMs!==presentedAtMs+ORDER_INTENT_DURATION_MS){
    const invalidAt=now.toISOString();
    await db.batch([
      db.prepare("UPDATE order_confirmation_intents SET state='PRESENTATION_FAILED',updated_at=? WHERE intent_id=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND presented_at=? AND deadline_at=?").bind(invalidAt,intentId,current.presented_at,current.deadline_at),
      ...[10,25,30].map((stage)=>db.prepare("UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error='ORDER_INTENT_TIMELINE_INVALID',updated_at=? WHERE intent_id=? AND stage_minutes=? AND status IN ('PENDING','QUEUED')").bind(invalidAt,intentId,stage)),
      db.prepare("INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"ORDER_INTENT_TIMELINE_INVALID","SYSTEM","ORDER",current.order_id,crypto.randomUUID(),JSON.stringify({intentId,reason:"T0_PLUS_30_MISMATCH"}),invalidAt)
    ]);
    return "NOT_DUE";
  }

  const orderEligible = current.archived_at === null
    && ["DETAILS_COMPLETED","PAYMENT_PENDING"].includes(current.order_state)
    && current.payment_status === "PENDING"
    && ["PENDING","REJECTED"].includes(current.review_state)
    && Number(current.has_cod) === 0;
  if (!orderEligible) {
    await db.batch([
      db.prepare("UPDATE order_confirmation_intents SET state='PRESENTATION_FAILED',updated_at=? WHERE intent_id=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND deadline_at<=? AND EXISTS(SELECT 1 FROM orders o WHERE o.id=order_confirmation_intents.order_id AND o.state NOT IN ('PAID','COD_PENDING','CANCELLED','EXPIRED'))").bind(nowIso,intentId,current.deadline_at),
      db.prepare("UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error='ORDER_NO_LONGER_EXPIRABLE',updated_at=? WHERE intent_id=? AND stage_minutes IN (10,25,30) AND status IN ('PENDING','QUEUED')").bind(nowIso,intentId)
    ]);
    return "ALREADY_RESOLVED";
  }

  await db.batch([
    db.prepare(`UPDATE orders SET state='EXPIRED',payment_status='EXPIRED',updated_at=? WHERE id=? AND state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND payment_status='PENDING' AND archived_at IS NULL
      AND EXISTS(SELECT 1 FROM order_confirmation_intents i WHERE i.intent_id=? AND i.state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND i.presented_at=? AND i.deadline_at=? AND i.deadline_at<=?)
      AND EXISTS(SELECT 1 FROM payments p WHERE p.order_id=orders.id AND p.review_state IN ('PENDING','REJECTED') AND p.approved_amount IS NULL AND p.approved_at IS NULL AND p.submitted_at IS NULL AND p.customer_transaction_reference IS NULL)
      AND NOT EXISTS(SELECT 1 FROM payment_receipts r JOIN payments p ON p.id=r.payment_id WHERE r.order_id=orders.id AND p.order_id=orders.id)
      AND NOT EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=orders.id)`).bind(nowIso,current.order_id,intentId,current.presented_at,current.deadline_at,current.deadline_at),
    db.prepare(`UPDATE order_confirmation_intents SET state='EXPIRED',updated_at=? WHERE intent_id=? AND presented_at=? AND deadline_at=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING')
       AND EXISTS(SELECT 1 FROM orders o WHERE o.id=order_confirmation_intents.order_id AND o.state='EXPIRED' AND o.payment_status='EXPIRED')`).bind(nowIso,intentId,current.presented_at,current.deadline_at),
    db.prepare(`DELETE FROM order_eligibility_locks WHERE order_id=? AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN orders o ON o.id=i.order_id WHERE i.intent_id=? AND i.state='EXPIRED' AND o.state='EXPIRED')`).bind(current.order_id,intentId),
    db.prepare(`UPDATE whatsapp_conversations SET state='EXPIRED',updated_at=? WHERE id=? AND state IN ('REVIEW','PAYMENT_METHOD','PAYMENT_PENDING','COD_CONFIRM')
      AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN orders o ON o.id=i.order_id WHERE i.intent_id=? AND i.state='EXPIRED' AND o.state='EXPIRED')`).bind(nowIso,current.conversation_id,intentId),
    db.prepare(`UPDATE order_confirmation_intent_stages SET status='SUPPRESSED',last_error='INTENT_EXPIRED',updated_at=? WHERE intent_id=? AND stage_minutes IN (10,25) AND status IN ('PENDING','QUEUED')
      AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN orders o ON o.id=i.order_id WHERE i.intent_id=? AND i.state='EXPIRED' AND o.state='EXPIRED')`).bind(nowIso,intentId,intentId),
    db.prepare(`UPDATE order_confirmation_intent_stages SET status='QUEUED',updated_at=? WHERE intent_id=? AND stage_minutes=30 AND status='PENDING'
      AND EXISTS(SELECT 1 FROM order_confirmation_intents i WHERE i.intent_id=? AND i.state='EXPIRED')`).bind(nowIso,intentId,intentId),
    db.prepare(`INSERT OR IGNORE INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at)
      SELECT ?,?,?,?,?,'PENDING',?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),`order-intent:${intentId}:${ORDER_INTENT_VERSION}:T30`,'WHATSAPP_ORDER_INTENT_STAGE',current.order_id,JSON.stringify({intentId,stageMinutes:30,workflowVersion:ORDER_INTENT_VERSION,locale:current.locale}),nowIso,nowIso,nowIso),
    db.prepare(`INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
      SELECT ?,?,'SYSTEM','ORDER',?,?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),'ORDER_INTENT_EXPIRED',current.order_id,crypto.randomUUID(),JSON.stringify({intentId,workflowVersion:ORDER_INTENT_VERSION,deadlineAt:current.deadline_at}),nowIso)
  ]);
  const after = await db.prepare("SELECT state FROM order_confirmation_intents WHERE intent_id=?").bind(intentId).first<{state:string}>();
  return after?.state === "EXPIRED" ? "EXPIRED" : "ALREADY_RESOLVED";
}

export async function expireDueOrderIntents(db: D1Database, now = new Date()): Promise<number> {
  const due = await db.prepare(`SELECT intent_id FROM order_confirmation_intents WHERE workflow_version=? AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND presented_at IS NOT NULL AND deadline_at IS NOT NULL AND deadline_at<=? ORDER BY deadline_at LIMIT 100`).bind(ORDER_INTENT_VERSION,now.toISOString()).all<{intent_id:string}>();
  let expired=0;
  for(const row of due.results??[]) if(await expireOrderIntent(db,row.intent_id,now)==="EXPIRED") expired+=1;
  return expired;
}

export async function queueDueOrderIntentReminders(db: D1Database, now = new Date()): Promise<number> {
  const nowIso=now.toISOString();
  const due=await db.prepare(`SELECT s.intent_id,s.stage_minutes,s.due_at,s.status AS stage_status,s.idempotency_key,
      i.state,i.presented_at,i.deadline_at,pref.locale,(SELECT t25.due_at FROM order_confirmation_intent_stages t25 WHERE t25.intent_id=i.intent_id AND t25.stage_minutes=25) AS t25_due_at,i.order_id,i.workflow_version
    FROM order_confirmation_intent_stages s JOIN order_confirmation_intents i ON i.intent_id=s.intent_id LEFT JOIN order_confirmation_intent_preferences pref ON pref.intent_id=i.intent_id
    WHERE s.stage_minutes IN (10,25) AND s.status='PENDING' AND s.due_at<=?
    ORDER BY s.due_at,s.stage_minutes LIMIT 100`).bind(nowIso).all<{intent_id:string;stage_minutes:number;due_at:string;stage_status:string;idempotency_key:string;state:string;presented_at:string|null;deadline_at:string|null;locale:string|null;t25_due_at:string|null;order_id:string;workflow_version:string}>();
  let queued=0;
  for(const stage of due.results??[]){
    const minutes=stage.stage_minutes as 10|25;
    const presented=Date.parse(stage.presented_at??"");
    const deadline=Date.parse(stage.deadline_at??"");
    const nextStage=Date.parse(stage.t25_due_at??"");
    const dueAt=Date.parse(stage.due_at);
    const timelineInvalid=!Number.isFinite(presented)||deadline!==presented+ORDER_INTENT_DURATION_MS||dueAt!==presented+minutes*60_000||(minutes===10&&!Number.isFinite(nextStage));
    if(timelineInvalid){await suppressIntentStage(db,stage.intent_id,minutes,"ORDER_INTENT_STAGE_TIMESTAMP_MISMATCH",nowIso);continue;}
    const stale=minutes===10?Number.isFinite(nextStage)&&now.getTime()>=nextStage:!Number.isFinite(deadline)||now.getTime()>=deadline;
    if(stale){await suppressIntentStage(db,stage.intent_id,minutes,"ORDER_INTENT_REMINDER_STALE",nowIso);continue;}
    if(!stage.presented_at||!stage.deadline_at||!ACTIVE_INTENT_STATES.includes(stage.state as typeof ACTIVE_INTENT_STATES[number])||deadline<=now.getTime()){
      await suppressIntentStage(db,stage.intent_id,minutes,"ORDER_INTENT_NO_LONGER_ELIGIBLE",nowIso);continue;
    }
    const results=await db.batch([
      db.prepare(`UPDATE order_confirmation_intent_stages SET status='QUEUED',last_error=NULL,updated_at=? WHERE intent_id=? AND stage_minutes=? AND status='PENDING' AND due_at<=?
        AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN orders o ON o.id=i.order_id JOIN payments p ON p.order_id=o.id WHERE i.intent_id=? AND i.state IN ('AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING') AND i.deadline_at>? AND o.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING') AND o.payment_status='PENDING' AND o.archived_at IS NULL AND p.review_state IN ('PENDING','REJECTED') AND p.approved_amount IS NULL AND p.approved_at IS NULL AND NOT EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.payment_id=p.id) AND NOT EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=o.id))`).bind(nowIso,stage.intent_id,minutes,nowIso,stage.intent_id,nowIso),
      db.prepare(`INSERT OR IGNORE INTO outbox_jobs(id,idempotency_key,kind,entity_id,payload_json,status,attempts,available_at,created_at,updated_at)
        SELECT ?,?,?,?,?,'PENDING',0,?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),stage.idempotency_key,"WHATSAPP_ORDER_INTENT_STAGE",stage.order_id,JSON.stringify({intentId:stage.intent_id,stageMinutes:minutes,workflowVersion:stage.workflow_version,locale:stage.locale}),nowIso,nowIso,nowIso)
    ]);
    if(Number(results[0]?.meta?.changes??0)===1)queued+=1;
  }
  return queued;
}
