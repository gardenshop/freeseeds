type D1Like = Pick<D1Database, "prepare">;
type Row = Record<string, unknown>;
type Query = { results?: Row[]; meta?: unknown };

export type ConversationFilters = { q: string; state: string; paymentStatus: string; page: number; pageSize: number };
export class ConversationInputError extends Error {}

const safeState = /^[A-Z0-9_ -]{1,40}$/;
const value = (row: Row | undefined, key: string): unknown => row?.[key];
const text = (row: Row | undefined, key: string): string | null => { const v = value(row, key); return v == null ? null : String(v); };
const num = (row: Row | undefined, key: string): number => Number(value(row, key) ?? 0);
function rowsRead(result: Query): number { const meta = result.meta && typeof result.meta === "object" ? result.meta as Row : {}; return Number(meta.rows_read ?? meta.rowsRead ?? 0); }
function maskWaId(waId: string | null): string { if (!waId) return "unavailable"; return `***${waId.slice(-4)}`; }
function bounded(value: string | undefined, max: number): string { return (value ?? "").trim().slice(0, max); }

export function parseConversationFilters(params: { q?: string; state?: string; paymentStatus?: string; page?: string; pageSize?: string } = {}): ConversationFilters {
  const page = Number(params.page ?? 1); const pageSize = Number(params.pageSize ?? 25);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new ConversationInputError("CONVERSATION_PAGE_INVALID");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new ConversationInputError("CONVERSATION_PAGE_SIZE_INVALID");
  const state = (params.state ?? "").trim().toUpperCase(); const paymentStatus = (params.paymentStatus ?? "").trim().toUpperCase();
  if (state && !safeState.test(state)) throw new ConversationInputError("CONVERSATION_STATE_INVALID");
  if (paymentStatus && !safeState.test(paymentStatus)) throw new ConversationInputError("CONVERSATION_PAYMENT_STATUS_INVALID");
  return { q: bounded(params.q, 80), state, paymentStatus, page, pageSize };
}

type Cost = { query: string; rowsRead: number };
type ConversationSummary = { conversationId: string; customerRef: string; lastActivityAt: string; state: string; latestOrder: { orderNumber: string; state: string; paymentStatus: string } | null; orderCount: number; historyAvailable: boolean };
type Message = { direction: "INBOUND" | "OUTBOUND"; kind: string; status: string; occurredAt: string; text: string | null; interactive: { id: string | null; title: string | null } | null; media: { placeholder: string; mimeType: string | null } | null; providerMessageIdPresent: boolean };

function queryName(sql: string): string { return sql.replace(/\s+/g, " ").trim().slice(0, 100); }

export async function readConversations(db: D1Like, filters: ConversationFilters): Promise<{ conversations: ConversationSummary[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; queryCosts: Cost[] }> {
  const costs: Cost[] = [];
  const run = async <T extends Row>(sql: string, args: unknown[]): Promise<T[]> => { const result = await db.prepare(sql).bind(...args).all<T>() as unknown as Query; costs.push({ query: queryName(sql), rowsRead: rowsRead(result) }); return (result.results ?? []) as T[]; };
  const where = ["1=1"]; const args: unknown[] = [];
  if (filters.q) { where.push("(wc.wa_id=? OR c.id=? OR EXISTS (SELECT 1 FROM orders oq WHERE oq.customer_id=c.id AND oq.order_number=?))"); args.push(filters.q, filters.q, filters.q); }
  if (filters.state) { where.push("wc.state=?"); args.push(filters.state); }
  if (filters.paymentStatus) { where.push("EXISTS (SELECT 1 FROM orders op JOIN payments pp ON pp.order_id=op.id WHERE op.customer_id=c.id AND pp.review_state=?)"); args.push(filters.paymentStatus); }
  const predicate = where.join(" AND ");
  const count = await run<{ total: number }>(`SELECT COUNT(*) AS total FROM whatsapp_conversations wc LEFT JOIN customers c ON c.wa_id=wc.wa_id WHERE ${predicate}`, args);
  const rows = await run<Row>(`SELECT wc.id AS conversation_id,wc.wa_id,wc.state,COALESCE(wc.last_inbound_at,wc.updated_at) AS last_activity_at,
      (SELECT COUNT(*) FROM orders ox WHERE ox.customer_id=c.id) AS order_count,
      (SELECT order_number FROM orders ox WHERE ox.customer_id=c.id ORDER BY ox.updated_at DESC,ox.created_at DESC LIMIT 1) AS order_number,
      (SELECT state FROM orders ox WHERE ox.customer_id=c.id ORDER BY ox.updated_at DESC,ox.created_at DESC LIMIT 1) AS order_state,
      (SELECT payment_status FROM orders ox WHERE ox.customer_id=c.id ORDER BY ox.updated_at DESC,ox.created_at DESC LIMIT 1) AS order_payment
      FROM whatsapp_conversations wc LEFT JOIN customers c ON c.wa_id=wc.wa_id WHERE ${predicate}
      ORDER BY last_activity_at DESC,wc.id LIMIT ? OFFSET ?`, [...args, filters.pageSize, (filters.page - 1) * filters.pageSize]);
  const total = num(count[0], "total");
  return { conversations: rows.map((row) => ({ conversationId: String(value(row, "conversation_id")), customerRef: maskWaId(text(row, "wa_id")), lastActivityAt: String(value(row, "last_activity_at") ?? ""), state: String(value(row, "state") ?? ""), latestOrder: value(row, "order_number") == null ? null : { orderNumber: String(value(row, "order_number")), state: String(value(row, "order_state") ?? ""), paymentStatus: String(value(row, "order_payment") ?? "") }, orderCount: num(row, "order_count"), historyAvailable: false })), pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) }, queryCosts: costs };
}

export async function readConversationSummary(db: D1Like, now = new Date()): Promise<{ summary: { total: number; activeLast24Hours: number; paymentReviewPending: number; codPending: number; asOf: string }; queryCosts: Cost[] }> {
  const costs: Cost[] = [];
  const run = async (sql: string, args: unknown[]): Promise<Row | null> => {
    const result = await db.prepare(sql).bind(...args).all<Row>() as unknown as Query;
    costs.push({ query: queryName(sql), rowsRead: rowsRead(result) });
    return (result.results ?? [])[0] ?? null;
  };
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [total, activeLast24Hours, paymentReviewPending, codPending] = await Promise.all([
    run("SELECT COUNT(*) AS total FROM whatsapp_conversations", []),
    run("SELECT COUNT(*) AS total FROM whatsapp_conversations WHERE COALESCE(last_inbound_at,updated_at)>=?", [since]),
    run("SELECT COUNT(DISTINCT wc.id) AS total FROM whatsapp_conversations wc JOIN customers c ON c.wa_id=wc.wa_id JOIN orders o ON o.customer_id=c.id JOIN payments p ON p.order_id=o.id WHERE o.state='PAYMENT_REVIEW' AND p.review_state='REVIEW'", []),
    run("SELECT COUNT(DISTINCT wc.id) AS total FROM whatsapp_conversations wc JOIN customers c ON c.wa_id=wc.wa_id JOIN orders o ON o.customer_id=c.id WHERE o.payment_status='COD_PENDING'", [])
  ]);
  return { summary: { total: num(total ?? undefined, "total"), activeLast24Hours: num(activeLast24Hours ?? undefined, "total"), paymentReviewPending: num(paymentReviewPending ?? undefined, "total"), codPending: num(codPending ?? undefined, "total"), asOf: now.toISOString() }, queryCosts: costs };
}

async function all<T extends Row>(db: D1Like, costs: Cost[], sql: string, args: unknown[]): Promise<T[]> { const result = await db.prepare(sql).bind(...args).all<T>() as unknown as Query; costs.push({ query: queryName(sql), rowsRead: rowsRead(result) }); return (result.results ?? []) as T[]; }
async function first<T extends Row>(db: D1Like, costs: Cost[], sql: string, args: unknown[]): Promise<T | null> { const statement = db.prepare(sql).bind(...args) as unknown as { first: <R>() => Promise<R | null> }; const row = await statement.first<T>(); costs.push({ query: queryName(sql), rowsRead: 0 }); return row; }

export async function readConversation(db: D1Like, id: string): Promise<{ conversation: ConversationSummary; orders: Array<{ orderNumber: string; state: string; paymentStatus: string; method: string | null }>; messages: Message[]; recoveryTimeline: Array<{ stageMinutes: number; status: string; dueAt: string | null; updatedAt: string }>; historyAvailability: { mode: "MESSAGE_HISTORY" | "LEGACY_METADATA_ONLY"; inboundBodyStored: boolean; outboundBodyStored: boolean; note: string }; queryCosts: Cost[] }> {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new ConversationInputError("CONVERSATION_ID_INVALID");
  const costs: Cost[] = []; const base = await first<Row>(db, costs, `SELECT wc.id,wc.wa_id,wc.state,wc.updated_at,wc.last_inbound_at,wc.last_inbound_message_id,c.id AS customer_id FROM whatsapp_conversations wc LEFT JOIN customers c ON c.wa_id=wc.wa_id WHERE wc.id=?`, [id]);
  if (!base) throw new ConversationInputError("CONVERSATION_NOT_FOUND");
  const customerId = text(base, "customer_id");
  const orders = customerId ? await all<Row>(db, costs, `SELECT o.order_number,o.state,o.payment_status,p.method FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.customer_id=? ORDER BY o.updated_at DESC,o.created_at DESC LIMIT 50`, [customerId]) : [];
  const recovery: Array<{ stageMinutes: number; status: string; dueAt: string | null; updatedAt: string }> = [];
  if (orders.length) { try { const ids = orders.map((_, i) => `SELECT ? AS order_id${i ? " UNION ALL SELECT ?".repeat(i) : ""}`).join(" "); void ids; const stageRows = await all<Row>(db, costs, `SELECT stage_minutes,status,due_at,updated_at FROM payment_choice_recovery_stages WHERE order_id IN (SELECT id FROM orders WHERE customer_id=?) AND stage_minutes IN (15,210) ORDER BY due_at,stage_minutes LIMIT 100`, [customerId]); recovery.push(...stageRows.map((r) => ({ stageMinutes: num(r, "stage_minutes"), status: String(value(r, "status") ?? ""), dueAt: text(r, "due_at"), updatedAt: String(value(r, "updated_at") ?? "") }))); } catch (error) { if (!/no such table|does not exist|no column/i.test(error instanceof Error ? error.message : String(error))) throw error; } }
  let messages: Message[] = []; let mode: "MESSAGE_HISTORY" | "LEGACY_METADATA_ONLY" = "LEGACY_METADATA_ONLY";
  try {
    const history = await all<Row>(db, costs, `SELECT direction,message_kind,status,occurred_at,text_body,interactive_id,interactive_title,media_mime_type,provider_message_id FROM admin_message_history WHERE conversation_id=? ORDER BY occurred_at,id LIMIT 200`, [id]);
    if (history.length) { mode = "MESSAGE_HISTORY"; messages = history.map((r) => ({ direction: String(value(r, "direction")) === "OUTBOUND" ? "OUTBOUND" : "INBOUND", kind: String(value(r, "message_kind") ?? "TEXT"), status: String(value(r, "status") ?? "RECEIVED"), occurredAt: String(value(r, "occurred_at") ?? ""), text: text(r, "text_body"), interactive: value(r, "interactive_id") != null || value(r, "interactive_title") != null ? { id: text(r, "interactive_id"), title: text(r, "interactive_title") } : null, media: value(r, "media_mime_type") != null ? { placeholder: "Media content is available only as a protected private preview when separately authorized.", mimeType: text(r, "media_mime_type") } : null, providerMessageIdPresent: Boolean(value(r, "provider_message_id")) })); }
  } catch (error) { if (!/no such table|does not exist|no column/i.test(error instanceof Error ? error.message : String(error))) throw error; }
  if (!messages.length && customerId) {
    const outbound = await all<Row>(db, costs, `SELECT kind,status,created_at,provider_message_id FROM outbound_messages WHERE customer_id=? ORDER BY created_at LIMIT 200`, [customerId]);
    messages = outbound.map((r) => ({ direction: "OUTBOUND", kind: String(value(r, "kind") ?? ""), status: String(value(r, "status") ?? ""), occurredAt: String(value(r, "created_at") ?? ""), text: null, interactive: null, media: null, providerMessageIdPresent: Boolean(value(r, "provider_message_id")) }));
    const inboundId = text(base, "last_inbound_message_id");
    if (inboundId) { const event = await first<Row>(db, costs, `SELECT event_type,status,created_at FROM whatsapp_events WHERE provider_event_id=? LIMIT 1`, [`message:${inboundId}`]); if (event) messages.unshift({ direction: "INBOUND", kind: String(value(event, "event_type") ?? "MESSAGE"), status: String(value(event, "status") ?? "RECEIVED"), occurredAt: String(value(event, "created_at") ?? ""), text: null, interactive: null, media: null, providerMessageIdPresent: false }); }
  }
  const latest = orders[0];
  return { conversation: { conversationId: id, customerRef: maskWaId(text(base, "wa_id")), lastActivityAt: String(value(base, "last_inbound_at") ?? value(base, "updated_at") ?? ""), state: String(value(base, "state") ?? ""), latestOrder: latest ? { orderNumber: String(value(latest, "order_number")), state: String(value(latest, "state") ?? ""), paymentStatus: String(value(latest, "payment_status") ?? "") } : null, orderCount: orders.length, historyAvailable: mode === "MESSAGE_HISTORY" }, orders: orders.map((r) => ({ orderNumber: String(value(r, "order_number") ?? ""), state: String(value(r, "state") ?? ""), paymentStatus: String(value(r, "payment_status") ?? ""), method: text(r, "method") })), messages, recoveryTimeline: recovery, historyAvailability: { mode, inboundBodyStored: mode === "MESSAGE_HISTORY", outboundBodyStored: mode === "MESSAGE_HISTORY", note: mode === "MESSAGE_HISTORY" ? "Only sanitized future-capture fields are shown; provider IDs and payment references remain protected." : "Legacy storage retains metadata only. Historical message bodies and interactive labels are unavailable; STATUS callbacks and CAPI events are not customer messages." }, queryCosts: costs };
}

export function conversationPageHtml(): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conversations | Get Free Seeds</title><style>body{font:15px/1.45 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#172018}.card{border:1px solid #ccd5cc;border-radius:10px;padding:1rem;margin:1rem 0}.muted{color:#59635a}.controls{display:flex;gap:.6rem;flex-wrap:wrap}.controls input,.controls select,.controls button{padding:.45rem;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.7rem}.conversation{cursor:pointer;text-align:left;background:#fff;width:100%}.conversation:hover{border-color:#174d31}.bubble{padding:.7rem;border-radius:10px;margin:.5rem 0;max-width:80%}.in{background:#edf5ed}.out{background:#e8eef8;margin-left:auto}.warning{background:#fff6dc;padding:.7rem;border-radius:8px}nav a{color:#174d31;font-weight:700;text-decoration:none}@media(max-width:700px){body{margin:1rem auto}.bubble{max-width:95%}}</style></head><body><header><p class="muted">Protected operations console</p><h1>WhatsApp conversations</h1><p class="muted">Admin-only, read-only viewer. No reply, send, reset, status change, or private media action is available.</p><nav><a href="/">Admin home</a> · <a href="/orders">Orders</a> · <a href="/analytics">Analytics</a></nav></header><form id="filters" class="card controls"><input name="q" maxlength="80" placeholder="Authorized order/customer reference"><input name="state" maxlength="40" placeholder="Checkout state"><input name="paymentStatus" maxlength="40" placeholder="Payment review state"><button>Search</button></form><p id="status" class="muted" role="status"></p><section id="list" class="grid"></section><section id="detail"></section><script>const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const form=document.querySelector('#filters'),status=document.querySelector('#status'),list=document.querySelector('#list'),detail=document.querySelector('#detail');let current=new URLSearchParams(location.search);for(const k of ['q','state','paymentStatus'])if(current.get(k))form.elements[k].value=current.get(k);function params(){return new URLSearchParams(new FormData(form))}function renderList(d){list.innerHTML=d.conversations.map(x=>'<button class="card conversation" data-id="'+encodeURIComponent(x.conversationId)+'"><strong>'+esc(x.customerRef)+'</strong><br>State: '+esc(x.state)+' · Last activity: '+esc(x.lastActivityAt)+'<br>Orders: '+x.orderCount+(x.latestOrder?' · '+esc(x.latestOrder.orderNumber)+' / '+esc(x.latestOrder.paymentStatus):'')+'</button>').join('')||'<p class="muted">No conversations found.</p>';list.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>loadDetail(decodeURIComponent(b.dataset.id)));status.textContent='Read-only list loaded; '+d.pagination.total+' conversation(s).'}function renderDetail(d){const h=d.historyAvailability;detail.innerHTML='<article class="card"><h2>'+esc(d.conversation.customerRef)+'</h2><p>State: '+esc(d.conversation.state)+' · Last activity: '+esc(d.conversation.lastActivityAt)+'</p><div class="warning">'+esc(h.note)+'</div><h3>Message history</h3>'+(d.messages.length?d.messages.map(m=>'<div class="bubble '+(m.direction==='INBOUND'?'in':'out')+'"><strong>'+m.direction+' · '+esc(m.status)+'</strong><br>'+esc(m.text|| (m.interactive?('Selection: '+(m.interactive.title||m.interactive.id||'captured')):m.media?'[Media placeholder]':'Historical content unavailable'))+'</div>').join(''):'<p class="muted">No message body is available in current storage.</p>')+'<h3>Linked orders</h3>'+d.orders.map(o=>'<p>'+esc(o.orderNumber)+' · '+esc(o.state)+' · '+esc(o.paymentStatus)+' · '+esc(o.method||'method not selected')+'</p>').join('')+'<h3>+15 / +210 recovery timeline</h3>'+d.recoveryTimeline.map(x=>'<p>'+x.stageMinutes+' minutes · '+esc(x.status)+' · '+esc(x.updatedAt)+'</p>').join('')+'</article>'}async function load(){status.textContent='Loading read-only data…';try{const r=await fetch('/api/conversations?'+params(),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Conversations unavailable');renderList(d);const id=new URLSearchParams(location.search).get('id');if(id)loadDetail(id)}catch(e){status.textContent=e.message||'Conversations unavailable'}}async function loadDetail(id){const r=await fetch('/api/conversations/'+encodeURIComponent(id),{cache:'no-store'}),d=await r.json();if(!r.ok){status.textContent=d.error||'Conversation unavailable';return}renderDetail(d)}form.onsubmit=e=>{e.preventDefault();history.replaceState(null,'','/conversations?'+params());load()};load();</script></body></html>`; }
