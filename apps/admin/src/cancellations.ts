type D1Like = Pick<D1Database, "prepare">;
type Row = Record<string, unknown>;
type Query = { results?: Row[]; meta?: unknown };

const STAGES = ["OFFER", "REVIEW", "OTHER_PRE_SUBMISSION", "UNKNOWN"] as const;
const REASONS = ["DELIVERY_FEE_HIGH", "COD_COLLECTION_FEE", "ADVANCE_TRUST", "PRODUCT_UNSUITABLE", "ORDER_LATER", "OFFER_UNCLEAR", "FERTILIZER_COST", "OTHER", "UNKNOWN"] as const;
export type CancellationFilters = { from: string; to: string; stage: string; reason: string };
export class CancellationInputError extends Error {}

const rowsRead = (result: Query): number => {
  const meta = result.meta && typeof result.meta === "object" ? result.meta as Row : {};
  return Number(meta.rows_read ?? meta.rowsRead ?? 0);
};
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const pktDate = (date: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export function parseCancellationFilters(params: { from?: string; to?: string; stage?: string; reason?: string } = {}, now = new Date()): CancellationFilters {
  const today = pktDate(now);
  const from = params.from?.trim() || addDays(today, -29);
  const to = params.to?.trim() || today;
  const stage = (params.stage ?? "ALL").trim().toUpperCase();
  const reason = (params.reason ?? "ALL").trim().toUpperCase();
  if (!dateOnly.test(from) || !dateOnly.test(to) || Date.parse(`${from}T00:00:00Z`) > Date.parse(`${to}T00:00:00Z`) || Date.parse(`${addDays(from, 92)}T00:00:00Z`) <= Date.parse(`${to}T00:00:00Z`)) throw new CancellationInputError("CANCELLATION_DATE_RANGE_INVALID");
  if (stage !== "ALL" && !STAGES.includes(stage as typeof STAGES[number])) throw new CancellationInputError("CANCELLATION_STAGE_INVALID");
  if (reason !== "ALL" && !REASONS.includes(reason as typeof REASONS[number])) throw new CancellationInputError("CANCELLATION_REASON_INVALID");
  return { from, to, stage, reason };
}

export async function readCancellationReport(db: D1Like, filters: CancellationFilters, now = new Date()) {
  const queryCosts: Array<{ query: string; rowsRead: number }> = [];
  const all = async (sql: string, args: unknown[]) => {
    const result = await db.prepare(sql).bind(...args).all<Row>() as unknown as Query;
    queryCosts.push({ query: sql.replace(/\s+/g, " ").trim().slice(0, 100), rowsRead: rowsRead(result) });
    return result.results ?? [];
  };
  const fromUtc = new Date(`${filters.from}T00:00:00+05:00`).toISOString();
  const toUtc = new Date(`${addDays(filters.to, 1)}T00:00:00+05:00`).toISOString();
  const where = ["ce.occurred_at>=?", "ce.occurred_at<?"];
  const args: unknown[] = [fromUtc, toUtc];
  if (filters.stage !== "ALL") { where.push("ce.original_stage=?"); args.push(filters.stage); }
  if (filters.reason !== "ALL") { where.push("EXISTS(SELECT 1 FROM checkout_cancellation_feedback_events rf WHERE rf.cancellation_event_id=ce.id AND rf.event_type='REASON' AND rf.reason_code=?)"); args.push(filters.reason); }
  const predicate = where.join(" AND ");
  const totalsRows = await all(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN ce.original_stage='OFFER' THEN 1 ELSE 0 END) AS offer_count,
    SUM(CASE WHEN ce.original_stage='REVIEW' THEN 1 ELSE 0 END) AS review_count,
    SUM(CASE WHEN ce.original_stage='OTHER_PRE_SUBMISSION' THEN 1 ELSE 0 END) AS other_count,
    SUM(CASE WHEN ce.original_stage='UNKNOWN' THEN 1 ELSE 0 END) AS unknown_count
    FROM checkout_cancellation_events ce WHERE ${predicate}`, args);
  const total = Number(totalsRows[0]?.total ?? 0);
  const reasonRows = await all(`SELECT f.reason_code,COUNT(*) AS reason_count
    FROM checkout_cancellation_events ce JOIN checkout_cancellation_feedback_events f ON f.cancellation_event_id=ce.id AND f.event_type='REASON'
    WHERE ${predicate} GROUP BY f.reason_code ORDER BY reason_count DESC,f.reason_code`, args);
  const reasonResponses = reasonRows.reduce((sum, row) => sum + Number(row.reason_count ?? 0), 0);
  const latestRows = await all(`SELECT ce.masked_conversation_ref,ce.original_stage,ce.language,ce.occurred_at,
    CASE WHEN ce.order_id IS NULL THEN 0 ELSE 1 END AS linked_order,
    (SELECT f.reason_code FROM checkout_cancellation_feedback_events f WHERE f.cancellation_event_id=ce.id AND f.event_type='REASON' ORDER BY f.occurred_at DESC,f.id DESC LIMIT 1) AS reason_code,
    (SELECT f.suggestion FROM checkout_cancellation_feedback_events f WHERE f.cancellation_event_id=ce.id AND f.event_type='SUGGESTION' AND f.suggestion_expires_at>? ORDER BY f.occurred_at DESC,f.id DESC LIMIT 1) AS suggestion
    FROM checkout_cancellation_events ce WHERE ${predicate}
    ORDER BY ce.occurred_at DESC,ce.id DESC LIMIT 50`, [now.toISOString(), ...args]);
  const totals = totalsRows[0] ?? {};
  return {
    filters,
    window: { fromPkt: filters.from, toPkt: filters.to, fromUtc, toUtcExclusive: toUtc },
    totals: { total, offer: Number(totals.offer_count ?? 0), review: Number(totals.review_count ?? 0), otherPreSubmission: Number(totals.other_count ?? 0), unknown: Number(totals.unknown_count ?? 0), reasonResponses },
    reasons: reasonRows.map((row) => ({ code: String(row.reason_code ?? "UNKNOWN"), count: Number(row.reason_count ?? 0), percentageOfResponses: reasonResponses ? Number((Number(row.reason_count ?? 0) * 100 / reasonResponses).toFixed(1)) : 0, percentageOfCancellations: total ? Number((Number(row.reason_count ?? 0) * 100 / total).toFixed(1)) : 0 })),
    latest: latestRows.map((row) => ({ customerRef: String(row.masked_conversation_ref ?? "unavailable"), stage: String(row.original_stage ?? "UNKNOWN"), language: String(row.language ?? "UNKNOWN"), occurredAt: String(row.occurred_at ?? ""), reason: row.reason_code == null ? null : String(row.reason_code), suggestion: row.suggestion == null ? null : String(row.suggestion), linkedOrder: Number(row.linked_order ?? 0) === 1 })),
    retention: { suggestionVisibleDays: 90, expiredSuggestionsHidden: true },
    queryCosts
  };
}

export function cancellationDashboardPageHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancellation Analytics | Get Free Seeds</title><style>*{box-sizing:border-box}body{font:15px/1.45 system-ui,sans-serif;max-width:1250px;margin:2rem auto;padding:0 1rem;color:#172018}.muted{color:#59635a}.controls,.card{border:1px solid #ccd5cc;border-radius:10px;padding:1rem;margin:1rem 0;background:#fff}.controls{display:flex;flex-wrap:wrap;gap:.7rem;align-items:end}.controls label{display:flex;flex-direction:column;gap:.25rem}.controls input,.controls select,.controls button{font:inherit;padding:.45rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.7rem}.metric strong{display:block;font-size:1.5rem;color:#17603c}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:650px}th,td{padding:.55rem;border-bottom:1px solid #d9dfd9;text-align:left;vertical-align:top}nav a{color:#174d31;font-weight:700;text-decoration:none}@media(max-width:650px){body{margin:1rem auto}.controls label{width:100%}}</style></head><body><header><p class="muted">Protected operations console</p><h1>Cancellation reasons & feedback</h1><p class="muted">Read-only, privacy-safe cancellation facts. Times display in Pakistan time; suggestions disappear after 90 days.</p><nav><a href="/">Admin home</a> · <a href="/orders">Orders</a> · <a href="/conversations">Conversations</a> · <a href="/analytics">Analytics</a></nav></header><form id="filters" class="controls"><label>From (PKT)<input name="from" type="date"></label><label>To (PKT)<input name="to" type="date"></label><label>Stage<select name="stage"><option>ALL</option><option>OFFER</option><option>REVIEW</option><option>OTHER_PRE_SUBMISSION</option><option>UNKNOWN</option></select></label><label>Reason<select name="reason"><option>ALL</option>${REASONS.map((r) => `<option>${r}</option>`).join("")}</select></label><button>Refresh</button><span id="status" class="muted" role="status"></span></form><section id="totals" class="grid"></section><section class="card scroll"><h2>Reason categories</h2><div id="reasons"></div></section><section class="card scroll"><h2>Latest cancellations</h2><div id="latest"></div></section><script>const f=document.querySelector('#filters'),s=document.querySelector('#status'),totals=document.querySelector('#totals'),reasons=document.querySelector('#reasons'),latest=document.querySelector('#latest'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const pktDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),today=new Date(),start=new Date(Date.now()-29*86400000);f.elements.from.value=pktDate(start);f.elements.to.value=pktDate(today);const pkt=v=>v?new Intl.DateTimeFormat('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';const card=(n,v)=>'<article class="card metric"><span>'+esc(n)+'</span><strong>'+Number(v||0).toLocaleString('en-PK')+'</strong></article>';function render(d){totals.innerHTML=[card('Total',d.totals.total),card('Cancel Offer',d.totals.offer),card('Cancel Order / review',d.totals.review),card('Other pre-submission',d.totals.otherPreSubmission),card('Unknown historical',d.totals.unknown)].join('');reasons.innerHTML='<table><thead><tr><th>Reason</th><th>Count</th><th>% responses</th><th>% cancellations</th></tr></thead><tbody>'+d.reasons.map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+x.count+'</td><td>'+x.percentageOfResponses+'%</td><td>'+x.percentageOfCancellations+'%</td></tr>').join('')+'</tbody></table>';latest.innerHTML='<table><thead><tr><th>PKT time</th><th>Reference</th><th>Stage</th><th>Reason</th><th>Suggestion</th></tr></thead><tbody>'+d.latest.map(x=>'<tr><td>'+esc(pkt(x.occurredAt))+'</td><td>'+esc(x.customerRef)+'</td><td>'+esc(x.stage)+'</td><td>'+esc(x.reason||'Not provided')+'</td><td>'+esc(x.suggestion||'—')+'</td></tr>').join('')+'</tbody></table>'}async function load(){s.textContent='Loading…';const q=new URLSearchParams(new FormData(f));const r=await fetch('/api/cancellations?'+q,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Cancellation analytics unavailable');render(d);s.textContent='Read-only report loaded'}f.onsubmit=e=>{e.preventDefault();load().catch(e=>s.textContent=e.message)};load().catch(e=>s.textContent=e.message);</script></body></html>`;
}
