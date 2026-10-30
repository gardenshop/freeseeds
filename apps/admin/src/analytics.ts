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
    daily: Array<{ day: string; customerMessages: number; textMessages: number; interactiveMessages: number; mediaMessages: number; statusCallbacks: number }>;
  };
  orders: {
    submitted: number;
    completed: number;
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
    delivered15: number;
    delivered210: number;
  };
  queryCosts: Array<{ query: string; rowsRead: number }>;
  definitions: string[];
};

type D1DatabaseLike = Pick<D1Database, "prepare">;
type QueryResult<T> = { results: T[]; meta?: unknown };

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
    run<{ submitted: number; completed: number; advance_selected: number; cod_confirmed: number; advance_pending: number }>(`SELECT COUNT(DISTINCT o.id) AS submitted,
      COUNT(DISTINCT CASE WHEN o.state IN ('PAID','PACKING','DISPATCHED','DELIVERED') OR cod.status='PAID' THEN o.id END) AS completed,
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
         AND last_inbound_at<?
      UNION ALL
      SELECT 'POST_ORDER',co.wa_id FROM order_rows co
       WHERE co.order_id IS NOT NULL AND co.method IS NULL AND co.cod_status IS NULL
         AND co.last_inbound_at<? AND EXISTS (SELECT 1 FROM outbound_messages m WHERE m.order_id=co.order_id AND m.kind IN ('PAYMENT_CHOICE','PAYMENT_CHOICE_RECOVERY') AND m.status IN ('SENT','DELIVERED','READ'))
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
  const order = orderRows[0] ?? { submitted: 0, completed: 0, advance_selected: 0, cod_confirmed: 0, advance_pending: 0 };
  const classified = statusCount(abandonmentRows);
  const preOrder = classified.PRE_ORDER ?? 0;
  const postOrder = classified.POST_ORDER ?? 0;
  const advancePending = classified.ADVANCE_PENDING ?? number(order.advance_pending);
  const codConfirmed = classified.COD_CONFIRMED ?? number(order.cod_confirmed);
  const active = classified.ACTIVE ?? 0;
  const filteredMap: Record<Exclude<AnalyticsStatus, "ALL">, number> = { PRE_ORDER: preOrder, POST_ORDER: postOrder, ADVANCE_PENDING: advancePending, COD_CONFIRMED: codConfirmed, ACTIVE: active };

  let reminders: AnalyticsResult["reminders"] = { available: true, stage15: {}, stage210: {}, delivered15: 0, delivered210: 0 };
  try {
    const rows = await run<{ stage_minutes: number; status: string; count: number }>(`SELECT stage_minutes,status,COUNT(*) AS count FROM payment_choice_recovery_stages
      WHERE updated_at>=? AND updated_at<? AND stage_minutes IN (15,210) GROUP BY stage_minutes,status`, [from, filters.toExclusive]);
    for (const row of rows) {
      const target = Number(row.stage_minutes) === 15 ? reminders.stage15 : reminders.stage210;
      target[String(row.status)] = number(row.count);
    }
    reminders.delivered15 = (reminders.stage15.SENT ?? 0) + (reminders.stage15.DELIVERED ?? 0) + (reminders.stage15.READ ?? 0);
    reminders.delivered210 = (reminders.stage210.SENT ?? 0) + (reminders.stage210.DELIVERED ?? 0) + (reminders.stage210.READ ?? 0);
  } catch (error) {
    if (!/no such table|does not exist|no column/i.test(error instanceof Error ? error.message : String(error))) throw error;
    reminders = { available: false, stage15: {}, stage210: {}, delivered15: 0, delivered210: 0 };
  }

  const submitted = number(order.submitted);
  const filtered = (Object.entries(filteredMap) as Array<[Exclude<AnalyticsStatus, "ALL">, number]>)
    .filter(([status]) => filters.status === "ALL" || filters.status === status)
    .map(([status, count]) => ({ status, count }));
  return {
    filters,
    inbound: { customerMessages, textMessages: eventCount("MESSAGE"), interactiveMessages: eventCount("INTERACTIVE"), mediaMessages: eventCount("MEDIA"), statusCallbacks: eventCount("STATUS"), uniqueContacts: number(contact.unique_contacts), newContacts: number(contact.new_contacts), newConversations: number(contact.new_contacts), returningContacts: number(contact.returning_contacts), daily: [...dailyByDay.entries()].map(([day, values]) => ({ day, ...values })) },
    orders: { submitted, completed: number(order.completed), advanceSelected: number(order.advance_selected), codConfirmed: number(order.cod_confirmed), advancePending: number(order.advance_pending), conversionPct: customerMessages ? Number((submitted / customerMessages * 100).toFixed(2)) : 0 },
    abandonment: { preOrder, postOrder, advancePending, codConfirmed, active, filtered, inactivityHours: 24 },
    reminders,
    queryCosts: costs.map(({ query, rowsRead: read }) => ({ query: query.split("\n", 1)[0].trim().slice(0, 80), rowsRead: read })),
    definitions: [
      "Customer inbound excludes STATUS callbacks and counts distinct provider_event_id; INTERACTIVE includes button, list, and Flow callbacks because historical subtype is not stored.",
      "Unique/new/returning contacts use the whatsapp_conversations latest-inbound snapshot. Historical sender attribution is unavailable because whatsapp_events does not store wa_id.",
      "Submitted orders are orders created in the selected UTC window. Completed orders are PAID/fulfillment-complete states or COD status PAID.",
      "PRE_ORDER and POST_ORDER require the latest conversation/order snapshot to be inactive for 24 hours. ADVANCE_PENDING is reported separately and is never labelled abandoned.",
      "Reminder totals are stage rows updated in the window; SENT, DELIVERED, and READ are counted as delivered/provider-accepted. No resend or state write occurs."
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
    ["submitted_orders", result.orders.submitted, "Orders created in the UTC window"],
    ["inbound_to_order_pct", result.orders.conversionPct, "Submitted orders divided by customer inbound events"],
    ["pre_order_abandoned", result.abandonment.preOrder, "Pre-order state, no order ID, inactive 24h"],
    ["post_order_abandoned", result.abandonment.postOrder, "Order/payment choice sent, no method, inactive 24h"],
    ["advance_pending", result.abandonment.advancePending, "Advance selected but unpaid/review; not abandoned"],
    ["cod_confirmed", result.abandonment.codConfirmed, "COD pending, collection pending, or paid"],
    ["active_checkout", result.abandonment.active, "Pre-order snapshot still active within 24h"]];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
