export type AnalyticsFilters = {
  from: string;
  to: string;
  toExclusive: string;
  status: AnalyticsStatus;
  asOf: string;
  inactivityCutoff: string;
};

export type AnalyticsStatus = "ALL" | "PRE_ORDER" | "POST_ORDER" | "ADVANCE_PENDING" | "COD_CONFIRMED" | "ACTIVE";

export type AnalyticsResult = {
  filters: AnalyticsFilters;
  inbound: {
    customerMessages: number;
    textMessages: number;
    interactiveMessages: number;
    mediaMessages: number;
    statusCallbacks: number;
    uniqueContacts: number;
    newContacts: number;
    newConversations: number;
    returningContacts: number;
    contactAttribution: "SNAPSHOT_ESTIMATE";
    daily: Array<{ day: string; customerMessages: number; textMessages: number; interactiveMessages: number; mediaMessages: number; statusCallbacks: number }>;
  };
  orders: {
    submitted: number;
    paidOrFulfilled: number;
    advanceSelected: number;
    codConfirmed: number;
    advancePending: number;
    conversionPct: number;
  };
  abandonment: {
    preOrder: number;
    postOrder: number;
    advancePending: number;
    codConfirmed: number;
    active: number;
    filtered: Array<{ status: Exclude<AnalyticsStatus, "ALL">; count: number }>;
    inactivityHours: 24;
  };
  reminders: {
    available: boolean;
    stage15: Record<string, number>;
    stage210: Record<string, number>;
    sent15: number;
    delivered15: number;
    read15: number;
    sent210: number;
    delivered210: number;
    read210: number;
  };
  whatsappReliability: {
    available: boolean;
    received: number; eligible: number; queued: number; accepted: number; delivered: number; read: number;
    failed: number; suppressed: number; unresolved: number; responseCoveragePct: number;
    duplicateResponseAttempts: number; duplicateAcceptedResponses: number; p50LatencyMs: number | null; p95LatencyMs: number | null;
    activeBillingIncidents: number; queueBacklog: number; deadLetter: number;
    suppressionReasons: Array<{ reasonCode: string; count: number }>;
    reconciliation: { classified: number; received: number; balanced: boolean };
  };
  queryCosts: Array<{ query: string; rowsRead: number }>;
  definitions: string[];
};

type D1DatabaseLike = Pick<D1Database, "prepare">;
type QueryResult<T> = { results: T[]; meta?: unknown };

type ReliabilityAccountingRow = { outcome: string; reason_code: string | null; eligible: number; attempted: number; accepted: number; delivered: number; read: number; received_at: string; response_accepted_at: string | null; response_attempts: number; accepted_responses: number };
const unavailableReliability = (): AnalyticsResult["whatsappReliability"] => ({ available: false, received: 0, eligible: 0, queued: 0, accepted: 0, delivered: 0, read: 0, failed: 0, suppressed: 0, unresolved: 0, responseCoveragePct: 0, duplicateResponseAttempts: 0, duplicateAcceptedResponses: 0, p50LatencyMs: null, p95LatencyMs: null, activeBillingIncidents: 0, queueBacklog: 0, deadLetter: 0, suppressionReasons: [], reconciliation: { classified: 0, received: 0, balanced: false } });

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

async function readWhatsAppReliability(filters: AnalyticsFilters, run: <T>(query: string, bindings: unknown[]) => Promise<T[]>): Promise<AnalyticsResult["whatsappReliability"]> {
  const from = `${filters.from}T00:00:00.000Z`;
  try {
    const [accounting, queue, incidents, reasons] = await Promise.all([
      run<ReliabilityAccountingRow>(`SELECT a.outcome,a.reason_code,a.eligible,a.attempted,a.accepted,a.delivered,a.read,
        a.received_at,a.response_accepted_at,a.response_attempts,COALESCE(r.accepted_responses,0) AS accepted_responses FROM whatsapp_lead_accounting a
        LEFT JOIN (SELECT inbound_event_hash,COUNT(*) AS accepted_responses FROM whatsapp_lead_responses GROUP BY inbound_event_hash) r ON r.inbound_event_hash=a.inbound_event_hash
        WHERE a.received_at>=? AND a.received_at<?`, [from, filters.toExclusive]),
      run<{ status: string; count: number }>(`SELECT status,COUNT(*) AS count FROM outbox_jobs WHERE kind='WHATSAPP_INITIAL_LEAD_REPLY' AND created_at>=? AND created_at<? GROUP BY status`, [from, filters.toExclusive]),
      run<{ count: number }>(`SELECT COUNT(*) AS count FROM whatsapp_billing_incidents WHERE upper(status) NOT IN ('RESOLVED','CLOSED')`, []),
      run<{ reason_code: string; count: number }>(`SELECT a.reason_code,COUNT(*) AS count FROM whatsapp_lead_accounting a
        WHERE a.received_at>=? AND a.received_at<? AND (a.outcome LIKE 'SUPPRESSED%' OR a.outcome='UNRESOLVED_FREE_ELIGIBILITY')
        AND a.reason_code IS NOT NULL GROUP BY a.reason_code ORDER BY a.reason_code`, [from, filters.toExclusive])
    ]);
    const count = (predicate: (row: ReliabilityAccountingRow) => boolean) => accounting.filter(predicate).length;
    const received = accounting.length;
    const suppressed = count((row) => row.outcome.startsWith("SUPPRESSED"));
    const failedOutcomes = new Set(["RETRYABLE_PROVIDER_REJECTION", "UNRESOLVED_PROVIDER_REJECTION", "UNRESOLVED_PROVIDER_DELIVERY_FAILURE", "UNRESOLVED_RESPONSE_DELIVERY_FAILURE", "UNRESOLVED_INITIAL_REPLY_DEAD_LETTER"]);
    const failed = count((row) => failedOutcomes.has(row.outcome));
    const unresolved = count((row) => row.outcome.startsWith("UNRESOLVED") && !failedOutcomes.has(row.outcome));
    const isClassified = (row: ReliabilityAccountingRow) => row.outcome.startsWith("SUPPRESSED") || row.outcome.startsWith("UNRESOLVED") || row.outcome === "RETRYABLE_PROVIDER_REJECTION" || row.outcome.startsWith("RESPONSE_") || row.outcome === "ELIGIBLE_RESPONSE_ATTEMPTED" || row.outcome.startsWith("PROCESSED_");
    const classified = count(isClassified);
    const latencies = accounting.flatMap((row) => {
      if (!row.accepted || !row.received_at || !row.response_accepted_at) return [];
      const latency = Date.parse(row.response_accepted_at) - Date.parse(row.received_at);
      return Number.isFinite(latency) && latency >= 0 ? [latency] : [];
    });
    const queueCounts = Object.fromEntries(queue.map((row) => [row.status.toUpperCase(), Number(row.count) || 0]));
    const queued = (queueCounts.PENDING ?? 0) + (queueCounts.QUEUED ?? 0) + (queueCounts.PROCESSING ?? 0) + (queueCounts.RETRY ?? 0);
    const accepted = count((row) => Number(row.accepted) === 1);
    const eligible = count((row) => Number(row.eligible) === 1);
    return {
      available: true, received, eligible, queued, accepted,
      delivered: count((row) => Number(row.delivered) === 1), read: count((row) => Number(row.read) === 1),
      failed, suppressed, unresolved, responseCoveragePct: eligible ? Number((accepted / eligible * 100).toFixed(2)) : 0,
      duplicateResponseAttempts: accounting.reduce((sum, row) => sum + Math.max(0, Number(row.response_attempts ?? 0) - 1), 0),
      duplicateAcceptedResponses: accounting.reduce((sum, row) => sum + Math.max(0, Number(row.accepted_responses ?? 0) - 1), 0),
      p50LatencyMs: percentile(latencies, 0.5), p95LatencyMs: percentile(latencies, 0.95),
      activeBillingIncidents: Number(incidents[0]?.count ?? 0), queueBacklog: queued, deadLetter: queueCounts.DEAD_LETTER ?? 0,
      suppressionReasons: reasons.filter((row) => Number(row.count) > 0).map((row) => ({ reasonCode: row.reason_code, count: Number(row.count) || 0 })),
      reconciliation: { classified, received, balanced: classified === received }
    };
  } catch (error) {
    if (/no such table|no such column|does not exist|no column/i.test(error instanceof Error ? error.message : String(error))) return unavailableReliability();
    throw error;
  }
}

const STATUSES: AnalyticsStatus[] = ["ALL", "PRE_ORDER", "POST_ORDER", "ADVANCE_PENDING", "COD_CONFIRMED", "ACTIVE"];
const PRE_ORDER_STATES = ["NEW", "LANGUAGE", "OFFER", "FERTILIZER", "PRODUCT", "PROVINCE", "FULL_NAME", "ADDRESS", "NEARBY", "CITY", "CONTACT", "REVIEW"];

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

function rowsRead(result: { meta?: unknown }): number {
  const meta = result.meta && typeof result.meta === "object" ? result.meta as Record<string, unknown> : {};
  return number(meta.rows_read ?? meta.rowsRead);
}

function statusCount(rows: Array<{ status: string; count: unknown }>): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [String(row.status), number(row.count)]));
}

export class AnalyticsInputError extends Error {}

export function parseAnalyticsFilters(params: { from?: string; to?: string; status?: string; now?: Date } = {}): AnalyticsFilters {
  const now = params.now ?? new Date();
  const asOf = now.toISOString();
  const today = asOf.slice(0, 10);
  const from = params.from ?? addDays(today, -6);
  const to = params.to ?? today;
  if (!validDate(from) || !validDate(to) || from > to) throw new AnalyticsInputError("ANALYTICS_DATE_INVALID");
  const end = addDays(to, 1);
  if (new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime() > 31 * 86400000) throw new AnalyticsInputError("ANALYTICS_RANGE_TOO_WIDE");
  const status = (params.status?.trim().toUpperCase() || "ALL") as AnalyticsStatus;
  if (!STATUSES.includes(status)) throw new AnalyticsInputError("ANALYTICS_STATUS_INVALID");
  return { from, to, toExclusive: `${end}T00:00:00.000Z`, status, asOf, inactivityCutoff: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() };
}

export async function readInboundAnalytics(db: D1DatabaseLike, filters: AnalyticsFilters): Promise<AnalyticsResult> {
  const from = `${filters.from}T00:00:00.000Z`;
  const costs: Array<{ query: string; rowsRead: number }> = [];
  const run = async <T>(query: string, bindings: unknown[]): Promise<T[]> => {
    const result = await db.prepare(query).bind(...bindings).all<T>() as unknown as QueryResult<T>;
    costs.push({ query, rowsRead: rowsRead(result) });
    return result.results ?? [];
  };

  const [eventRows, dailyRows, contactRows, orderRows, abandonmentRows] = await Promise.all([
    run<{ event_type: string; count: number }>(`SELECT event_type,COUNT(DISTINCT provider_event_id) AS count
      FROM whatsapp_events WHERE created_at>=? AND created_at<?
      AND event_type IN ('MESSAGE','INTERACTIVE','MEDIA','STATUS') GROUP BY event_type`, [from, filters.toExclusive]),
    run<{ day: string; event_type: string; count: number }>(`SELECT substr(created_at,1,10) AS day,event_type,COUNT(DISTINCT provider_event_id) AS count
      FROM whatsapp_events WHERE created_at>=? AND created_at<?
      AND event_type IN ('MESSAGE','INTERACTIVE','MEDIA','STATUS') GROUP BY day,event_type ORDER BY day`, [from, filters.toExclusive]),
    run<{ unique_contacts: number; new_contacts: number; returning_contacts: number }>(`SELECT COUNT(DISTINCT wa_id) AS unique_contacts,
      SUM(CASE WHEN created_at>=? AND created_at<? THEN 1 ELSE 0 END) AS new_contacts,
      SUM(CASE WHEN created_at<? THEN 1 ELSE 0 END) AS returning_contacts
      FROM whatsapp_conversations WHERE last_inbound_at>=? AND last_inbound_at<?`, [from, filters.toExclusive, from, from, filters.toExclusive]),
    run<{ submitted: number; paid_or_fulfilled: number; advance_selected: number; cod_confirmed: number; advance_pending: number }>(`SELECT COUNT(DISTINCT o.id) AS submitted,
      COUNT(DISTINCT CASE WHEN o.state IN ('PAID','PACKING','DISPATCHED','DELIVERED') OR cod.status='PAID' THEN o.id END) AS paid_or_fulfilled,
      COUNT(DISTINCT CASE WHEN p.method IS NOT NULL AND cod.order_id IS NULL THEN o.id END) AS advance_selected,
      COUNT(DISTINCT CASE WHEN cod.status IN ('COD_PENDING','COLLECTION_PENDING','PAID') THEN o.id END) AS cod_confirmed,
      COUNT(DISTINCT CASE WHEN p.method IS NOT NULL AND cod.order_id IS NULL AND o.payment_status='PENDING' AND p.review_state IN ('PENDING','REVIEW') AND o.state NOT IN ('CANCELLED','PAID') THEN o.id END) AS advance_pending
      FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN cod_order_details cod ON cod.order_id=o.id
      WHERE o.created_at>=? AND o.created_at<?`, [from, filters.toExclusive]),
    run<{ status: string; count: number }>(`WITH conversation_snapshot AS (
      SELECT wa_id,state,state_data,last_inbound_at FROM whatsapp_conversations
      WHERE last_inbound_at>=? AND last_inbound_at<?
    ), order_rows AS (
      SELECT o.id AS order_id,c.wa_id,o.state AS order_state,o.payment_status,p.method,p.review_state,cod.status AS cod_status,wc.last_inbound_at
      FROM orders o JOIN customers c ON c.id=o.customer_id
      LEFT JOIN whatsapp_conversations wc ON wc.wa_id=c.wa_id
      LEFT JOIN payments p ON p.order_id=o.id
      LEFT JOIN cod_order_details cod ON cod.order_id=o.id
      WHERE o.created_at>=? AND o.created_at<?
    ), classified AS (
      SELECT 'PRE_ORDER' AS status,wa_id FROM conversation_snapshot
       WHERE state IN (${PRE_ORDER_STATES.map(() => "?").join(",")})
         AND COALESCE(json_extract(CASE WHEN json_valid(state_data) THEN state_data ELSE '{}' END,'$.orderId'),'')=''
         AND NOT EXISTS (SELECT 1 FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=conversation_snapshot.wa_id)
         AND last_inbound_at<?
      UNION ALL
      SELECT 'POST_ORDER',co.wa_id FROM order_rows co
       WHERE co.order_id IS NOT NULL AND co.method IS NULL AND co.cod_status IS NULL
         AND co.order_state NOT IN ('CANCELLED','PAID','PACKING','DISPATCHED','DELIVERED')
         AND COALESCE(co.order_state,'')<>'' AND co.last_inbound_at<? AND EXISTS (SELECT 1 FROM outbound_messages m WHERE m.order_id=co.order_id AND m.kind IN ('PAYMENT_CHOICE','PAYMENT_CHOICE_RECOVERY') AND m.status IN ('SENT','DELIVERED','READ'))
      UNION ALL
      SELECT 'ADVANCE_PENDING',co.wa_id FROM order_rows co
       WHERE co.method IS NOT NULL AND co.cod_status IS NULL
         AND co.payment_status='PENDING' AND co.review_state IN ('PENDING','REVIEW') AND co.order_state NOT IN ('CANCELLED','PAID')
      UNION ALL
      SELECT 'COD_CONFIRMED',co.wa_id FROM order_rows co
       WHERE co.cod_status IN ('COD_PENDING','COLLECTION_PENDING','PAID')
      UNION ALL
      SELECT 'ACTIVE',wa_id FROM conversation_snapshot
       WHERE last_inbound_at>=? AND state IN (${PRE_ORDER_STATES.map(() => "?").join(",")})
         AND NOT EXISTS (SELECT 1 FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.wa_id=conversation_snapshot.wa_id)
    ) SELECT status,COUNT(DISTINCT wa_id) AS count FROM classified GROUP BY status`, [from, filters.toExclusive, from, filters.toExclusive, ...PRE_ORDER_STATES, filters.inactivityCutoff, filters.inactivityCutoff, filters.inactivityCutoff, ...PRE_ORDER_STATES])
  ]);

  const eventCount = (type: string) => number(eventRows.find((row) => row.event_type === type)?.count);
  const customerMessages = eventCount("MESSAGE") + eventCount("INTERACTIVE") + eventCount("MEDIA");
  const dailyByDay = new Map<string, { customerMessages: number; textMessages: number; interactiveMessages: number; mediaMessages: number; statusCallbacks: number }>();
  for (const row of dailyRows) {
    const day = dailyByDay.get(row.day) ?? { customerMessages: 0, textMessages: 0, interactiveMessages: 0, mediaMessages: 0, statusCallbacks: 0 };
    const count = number(row.count);
    if (row.event_type === "MESSAGE") { day.textMessages += count; day.customerMessages += count; }
    if (row.event_type === "INTERACTIVE") { day.interactiveMessages += count; day.customerMessages += count; }
    if (row.event_type === "MEDIA") { day.mediaMessages += count; day.customerMessages += count; }
    if (row.event_type === "STATUS") day.statusCallbacks += count;
    dailyByDay.set(row.day, day);
  }
  const contact = contactRows[0] ?? { unique_contacts: 0, new_contacts: 0, returning_contacts: 0 };
  const order = orderRows[0] ?? { submitted: 0, paid_or_fulfilled: 0, advance_selected: 0, cod_confirmed: 0, advance_pending: 0 };
  const classified = statusCount(abandonmentRows);
  const preOrder = classified.PRE_ORDER ?? 0;
  const postOrder = classified.POST_ORDER ?? 0;
  const advancePending = classified.ADVANCE_PENDING ?? number(order.advance_pending);
  const codConfirmed = classified.COD_CONFIRMED ?? number(order.cod_confirmed);
  const active = classified.ACTIVE ?? 0;
  const filteredMap: Record<Exclude<AnalyticsStatus, "ALL">, number> = { PRE_ORDER: preOrder, POST_ORDER: postOrder, ADVANCE_PENDING: advancePending, COD_CONFIRMED: codConfirmed, ACTIVE: active };

  let reminders: AnalyticsResult["reminders"] = { available: true, stage15: {}, stage210: {}, sent15: 0, delivered15: 0, read15: 0, sent210: 0, delivered210: 0, read210: 0 };
  try {
    const rows = await run<{ stage_minutes: number; status: string; count: number }>(`SELECT stage_minutes,status,COUNT(*) AS count FROM payment_choice_recovery_stages
      WHERE updated_at>=? AND updated_at<? AND stage_minutes IN (15,210) GROUP BY stage_minutes,status`, [from, filters.toExclusive]);
    for (const row of rows) {
      const target = Number(row.stage_minutes) === 15 ? reminders.stage15 : reminders.stage210;
      target[String(row.status)] = number(row.count);
    }
    reminders.sent15 = reminders.stage15.SENT ?? 0;
    reminders.delivered15 = reminders.stage15.DELIVERED ?? 0;
    reminders.read15 = reminders.stage15.READ ?? 0;
    reminders.sent210 = reminders.stage210.SENT ?? 0;
    reminders.delivered210 = reminders.stage210.DELIVERED ?? 0;
    reminders.read210 = reminders.stage210.READ ?? 0;
  } catch (error) {
    if (!/no such table|does not exist|no column/i.test(error instanceof Error ? error.message : String(error))) throw error;
    reminders = { available: false, stage15: {}, stage210: {}, sent15: 0, delivered15: 0, read15: 0, sent210: 0, delivered210: 0, read210: 0 };
  }

  const whatsappReliability = await readWhatsAppReliability(filters, run);

  const submitted = number(order.submitted);
  const filtered = (Object.entries(filteredMap) as Array<[Exclude<AnalyticsStatus, "ALL">, number]>)
    .filter(([status]) => filters.status === "ALL" || filters.status === status)
    .map(([status, count]) => ({ status, count }));
  return {
    filters,
    inbound: { customerMessages, textMessages: eventCount("MESSAGE"), interactiveMessages: eventCount("INTERACTIVE"), mediaMessages: eventCount("MEDIA"), statusCallbacks: eventCount("STATUS"), uniqueContacts: number(contact.unique_contacts), newContacts: number(contact.new_contacts), newConversations: number(contact.new_contacts), returningContacts: number(contact.returning_contacts), contactAttribution: "SNAPSHOT_ESTIMATE", daily: [...dailyByDay.entries()].map(([day, values]) => ({ day, ...values })) },
    orders: { submitted, paidOrFulfilled: number(order.paid_or_fulfilled), advanceSelected: number(order.advance_selected), codConfirmed: number(order.cod_confirmed), advancePending: number(order.advance_pending), conversionPct: customerMessages ? Number((submitted / customerMessages * 100).toFixed(2)) : 0 },
    abandonment: { preOrder, postOrder, advancePending, codConfirmed, active, filtered, inactivityHours: 24 },
    reminders,
    whatsappReliability,
    queryCosts: costs.map(({ query, rowsRead: read }) => ({ query: query.split("\n", 1)[0].trim().slice(0, 80), rowsRead: read })),
    definitions: [
      "Customer inbound excludes STATUS callbacks and counts distinct provider_event_id; INTERACTIVE includes button, list, and Flow callbacks because historical subtype is not stored.",
      "Unique/new/returning contacts are SNAPSHOT ESTIMATES from the latest whatsapp_conversations row; historical sender attribution is unavailable because whatsapp_events does not store wa_id.",
      "Submitted orders are orders created in the selected UTC window. PAID/fulfilled includes PAID, PACKING, DISPATCHED, DELIVERED, or COD status PAID; it is not a unique-contact conversion.",
      `The conversion percentage is submitted orders divided by distinct customer inbound events (${customerMessages ? Number((submitted / customerMessages * 100).toFixed(2)) : 0}%). It is not unique-lead conversion or a payment rate.`,
      "PRE_ORDER and POST_ORDER require the current conversation/order snapshot to be inactive for 24 hours. Historical stage transitions are unavailable, so a historical zero is not proof of zero drop-off.",
      "ADVANCE_PENDING and COD_CONFIRMED are lifecycle snapshots, not mutually exclusive abandonment classes; paid, fulfilled, and cancelled orders are excluded from abandoned pre/post classification.",
      "Reminder statuses are separate: SENT/provider accepted, DELIVERED, and READ. They are stage rows updated in the UTC window; no resend or state write occurs.",
      "All date filters and daily buckets are UTC (Pakistan local time is UTC+5); convert the selected local calendar dates before comparing business-day totals.",
      "WhatsApp reliability counts use migration 0052 accounting joined to inbound event receipt timestamps in the selected half-open UTC window; missing schema is unavailable, not zero.",
      "Provider accepted is distinct from delivered and read. Each received event is classified once by its final accounting outcome; reconciliation must balance received and classified.",
      "Response latency is inbound event receipt to provider acceptance time for accepted responses only; percentiles use nearest-rank. Duplicate accepted responses count distinct provider message hashes beyond one per inbound event; retries are reported separately.",
      "Queue backlog and dead-letter are initial-response outbox job statuses created in the selected window. Active billing incidents count all currently active incidents, independent of the selected window."
    ]
  };
}

export function analyticsCsv(result: AnalyticsResult): string {
  const rows: unknown[][] = [["Metric", "Value", "Definition"],
    ["customer_inbound_messages", result.inbound.customerMessages, "Distinct MESSAGE, INTERACTIVE, and MEDIA webhook event IDs"],
    ["status_callbacks", result.inbound.statusCallbacks, "Distinct STATUS webhook event IDs, excluded from inbound"],
    ["unique_contacts_snapshot", result.inbound.uniqueContacts, "Contacts whose latest inbound is in the window"],
    ["new_conversations_snapshot", result.inbound.newConversations, "Snapshot contacts/conversations created in the window"],
    ["returning_contacts_snapshot", result.inbound.returningContacts, "Snapshot contacts created before the window"],
    ["submitted_orders", result.orders.submitted, "Orders created in the selected UTC window"],
    ["paid_or_fulfilled_orders", result.orders.paidOrFulfilled, "PAID or fulfillment-complete order states; COD PAID included"],
    ["inbound_to_order_pct", result.orders.conversionPct, "Submitted orders divided by distinct customer inbound messages; not unique-lead conversion"],
    ["pre_order_abandoned", result.abandonment.preOrder, "Pre-order state, no order ID, inactive 24h"],
    ["post_order_abandoned", result.abandonment.postOrder, "Order/payment choice sent, no method, inactive 24h"],
    ["advance_pending", result.abandonment.advancePending, "Advance selected but unpaid/review; not abandoned"],
    ["cod_confirmed", result.abandonment.codConfirmed, "COD pending, collection pending, or paid"],
    ["active_checkout", result.abandonment.active, "Pre-order snapshot still active within 24h"],
    ["reminder_15_sent_provider_accepted", result.reminders.sent15, "15-minute stage status SENT"],
    ["reminder_15_delivered", result.reminders.delivered15, "15-minute stage status DELIVERED"],
    ["reminder_15_read", result.reminders.read15, "15-minute stage status READ"],
    ["reminder_210_sent_provider_accepted", result.reminders.sent210, "210-minute stage status SENT"],
    ["reminder_210_delivered", result.reminders.delivered210, "210-minute stage status DELIVERED"],
    ["reminder_210_read", result.reminders.read210, "210-minute stage status READ"],
    ["whatsapp_reliability_available", result.whatsappReliability.available, "False means migration 0052 schema is unavailable; legacy analytics remain available"],
    ["whatsapp_received", result.whatsappReliability.received, "Distinct accounted inbound events within the UTC window"],
    ["whatsapp_eligible", result.whatsappReliability.eligible, "Accounting eligible flag"],
    ["whatsapp_queued", result.whatsappReliability.queued, "Initial-response outbox jobs in pending/queued/processing/retry statuses created in window"],
    ["whatsapp_provider_accepted", result.whatsappReliability.accepted, "Provider accepted; not equivalent to delivered or read"],
    ["whatsapp_delivered", result.whatsappReliability.delivered, "Provider delivery status flag"],
    ["whatsapp_read", result.whatsappReliability.read, "Provider read status flag"],
    ["whatsapp_failed", result.whatsappReliability.failed, "Retryable or provider rejection outcome"],
    ["whatsapp_suppressed", result.whatsappReliability.suppressed, "Suppressed response outcome"],
    ["whatsapp_unresolved", result.whatsappReliability.unresolved, "Unresolved accounting outcome"],
    ["whatsapp_response_coverage_pct", result.whatsappReliability.responseCoveragePct, "Accepted eligible leads divided by eligible inbound leads"],
    ["whatsapp_duplicate_response_attempts", result.whatsappReliability.duplicateResponseAttempts, "Excess outbound attempt_count beyond the first, summed per inbound event"],
    ["whatsapp_duplicate_accepted_responses", result.whatsappReliability.duplicateAcceptedResponses, "Distinct accepted initial replies beyond one per inbound event"],
    ["whatsapp_p50_latency_ms", result.whatsappReliability.p50LatencyMs, "Nearest-rank p50 accepted inbound-to-outbound-record latency; null when unavailable"],
    ["whatsapp_p95_latency_ms", result.whatsappReliability.p95LatencyMs, "Nearest-rank p95 accepted inbound-to-outbound-record latency; null when unavailable"],
    ["whatsapp_active_billing_incidents", result.whatsappReliability.activeBillingIncidents, "All currently active billing incidents"],
    ["whatsapp_queue_backlog", result.whatsappReliability.queueBacklog, "Initial-response outbox backlog created in selected window"],
    ["whatsapp_dead_letter", result.whatsappReliability.deadLetter, "Initial-response dead-letter jobs created in selected window"],
    ...result.whatsappReliability.suppressionReasons.map(({ reasonCode, count }) => [`whatsapp_suppressed_reason_${reasonCode}`, count, "Exact suppression reason code; aggregate only"]),
    ["whatsapp_outcome_reconciliation", `${result.whatsappReliability.reconciliation.classified}/${result.whatsappReliability.reconciliation.received}`, "Mutually exclusive accounting outcomes classified / received"]];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
