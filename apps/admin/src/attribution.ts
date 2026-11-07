import type { AnalyticsFilters } from "./analytics";

type D1Like = Pick<D1Database, "prepare">;
type QueryResult<T> = { results: T[]; meta?: unknown };

export type AttributionReport = {
  filters: Pick<AnalyticsFilters, "from" | "to" | "toExclusive" | "asOf">;
  totals: {
    whatsappConversations: number;
    persistedLeads: number;
    attributedLeads: number;
    attributedOrders: number;
    attributedPaidOrFulfilledOrders: number;
    campaignAttributedOrders: number;
    persistedLeadOrderLinkPct: number | null;
    campaignToOrderConversionPct: null;
  };
  daily: Array<{
    day: string;
    whatsappConversations: number;
    persistedLeads: number;
    attributedLeads: number;
    attributedOrders: number;
    attributedPaidOrFulfilledOrders: number;
  }>;
  queryCosts: Array<{ query: string; rowsRead: number }>;
  definitions: string[];
};

function number(value: unknown): number { return Number(value ?? 0); }

function rowsRead(result: { meta?: unknown }): number {
  const meta = result.meta && typeof result.meta === "object" ? result.meta as Record<string, unknown> : {};
  return number(meta.rows_read ?? meta.rowsRead);
}

const ATTRIBUTED = `(
  NULLIF(TRIM(ma.ctwa_clid),'') IS NOT NULL
  OR NULLIF(TRIM(ma.campaign_id),'') IS NOT NULL
  OR NULLIF(TRIM(ma.ad_set_id),'') IS NOT NULL
  OR NULLIF(TRIM(ma.ad_id),'') IS NOT NULL
)`;

export async function readAttributionReport(db: D1Like, filters: AnalyticsFilters): Promise<AttributionReport> {
  const from = `${filters.from}T00:00:00.000Z`;
  const costs: Array<{ query: string; rowsRead: number }> = [];
  const run = async <T>(query: string, bindings: unknown[]): Promise<T[]> => {
    const result = await db.prepare(query).bind(...bindings).all<T>() as unknown as QueryResult<T>;
    costs.push({ query, rowsRead: rowsRead(result) });
    return result.results ?? [];
  };
  const orderQuery = `SELECT
      COUNT(DISTINCT l.id) AS persisted_leads,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} THEN l.id END) AS attributed_leads,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} THEN o.id END) AS attributed_orders,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} AND (o.state IN ('PAID','PACKING','DISPATCHED','DELIVERED') OR cod.status='PAID') THEN o.id END) AS attributed_paid_or_fulfilled_orders,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} AND NULLIF(TRIM(ma.campaign_id),'') IS NOT NULL THEN o.id END) AS campaign_attributed_orders
    FROM leads l
    JOIN orders o ON o.id=l.order_id
    LEFT JOIN meta_attribution ma ON ma.order_id=o.id
    LEFT JOIN cod_order_details cod ON cod.order_id=o.id
    WHERE l.created_at>=? AND l.created_at<?`;
  const dailyOrderQuery = `SELECT substr(l.created_at,1,10) AS day,
      COUNT(DISTINCT l.id) AS persisted_leads,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} THEN l.id END) AS attributed_leads,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} THEN o.id END) AS attributed_orders,
      COUNT(DISTINCT CASE WHEN ${ATTRIBUTED} AND (o.state IN ('PAID','PACKING','DISPATCHED','DELIVERED') OR cod.status='PAID') THEN o.id END) AS attributed_paid_or_fulfilled_orders
    FROM leads l
    JOIN orders o ON o.id=l.order_id
    LEFT JOIN meta_attribution ma ON ma.order_id=o.id
    LEFT JOIN cod_order_details cod ON cod.order_id=o.id
    WHERE l.created_at>=? AND l.created_at<?
    GROUP BY day ORDER BY day`;
  const [conversationRows, orderRows, dailyConversationRows, dailyOrderRows] = await Promise.all([
    run<{ whatsapp_conversations: number }>("SELECT COUNT(DISTINCT wa_id) AS whatsapp_conversations FROM whatsapp_conversations WHERE last_inbound_at>=? AND last_inbound_at<?", [from, filters.toExclusive]),
    run<{ persisted_leads: number; attributed_leads: number; attributed_orders: number; attributed_paid_or_fulfilled_orders: number; campaign_attributed_orders: number }>(orderQuery, [from, filters.toExclusive]),
    run<{ day: string; whatsapp_conversations: number }>("SELECT substr(last_inbound_at,1,10) AS day,COUNT(DISTINCT wa_id) AS whatsapp_conversations FROM whatsapp_conversations WHERE last_inbound_at>=? AND last_inbound_at<? GROUP BY day ORDER BY day", [from, filters.toExclusive]),
    run<{ day: string; persisted_leads: number; attributed_leads: number; attributed_orders: number; attributed_paid_or_fulfilled_orders: number }>(dailyOrderQuery, [from, filters.toExclusive])
  ]);
  const totals = orderRows[0] ?? { persisted_leads: 0, attributed_leads: 0, attributed_orders: 0, attributed_paid_or_fulfilled_orders: 0, campaign_attributed_orders: 0 };
  const attributedLeads = number(totals.attributed_leads);
  const days = new Map<string, AttributionReport["daily"][number]>();
  for (const row of dailyConversationRows) days.set(row.day, { day: row.day, whatsappConversations: number(row.whatsapp_conversations), persistedLeads: 0, attributedLeads: 0, attributedOrders: 0, attributedPaidOrFulfilledOrders: 0 });
  for (const row of dailyOrderRows) {
    const day = days.get(row.day) ?? { day: row.day, whatsappConversations: 0, persistedLeads: 0, attributedLeads: 0, attributedOrders: 0, attributedPaidOrFulfilledOrders: 0 };
    day.persistedLeads = number(row.persisted_leads);
    day.attributedLeads = number(row.attributed_leads);
    day.attributedOrders = number(row.attributed_orders);
    day.attributedPaidOrFulfilledOrders = number(row.attributed_paid_or_fulfilled_orders);
    days.set(row.day, day);
  }
  return {
    filters: { from: filters.from, to: filters.to, toExclusive: filters.toExclusive, asOf: filters.asOf },
    totals: {
      whatsappConversations: number(conversationRows[0]?.whatsapp_conversations),
      persistedLeads: number(totals.persisted_leads),
      attributedLeads,
      attributedOrders: number(totals.attributed_orders),
      attributedPaidOrFulfilledOrders: number(totals.attributed_paid_or_fulfilled_orders),
      campaignAttributedOrders: number(totals.campaign_attributed_orders),
      persistedLeadOrderLinkPct: attributedLeads ? Number((number(totals.attributed_orders) / attributedLeads * 100).toFixed(2)) : null,
      campaignToOrderConversionPct: null
    },
    daily: [...days.values()],
    queryCosts: costs.map(({ query, rowsRead: read }) => ({ query: query.split("\n", 1)[0].trim().slice(0, 100), rowsRead: read })),
    definitions: [
      "Attributed means a persisted order has at least one non-empty CTWA click ID or campaign/ad identifier in meta_attribution; it is not a Meta Ads denominator.",
      "Persisted lead-to-order linkage is measured from the leads.order_id foreign-key relationship and is not a customer purchase conversion.",
      "Campaign-to-order conversion remains UNKNOWN because the current D1 record does not contain the complete Meta campaign lead/conversation denominator.",
      "WhatsApp conversation counts are snapshot aggregates from last_inbound_at; historical sender-to-conversation attribution is unavailable.",
      "Only aggregate counts and daily buckets are returned; customer identifiers, provider IDs, referral values and payment references are excluded."
    ]
  };
}
