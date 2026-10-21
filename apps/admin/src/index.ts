import { Hono } from "hono";
import type { Context } from "hono";
import { canTransition, createMetaActivationService, createWhatsAppProvider, getLatestOrderForWaId, MetaActivationAction, normalizeWhatsAppWaId, OrderState, approvedPurchaseValue, createPurchaseEvent, hasCompleteEnabledPaymentMethod, hasPaymentMessagePlaceholders, isPaymentMethodComplete, isPaymentMethodLocaleComplete, normalizePaymentMethodRow, parseProductInput, parseProvinceDeliveryRateInput, parseWhatsAppContentDraft, paymentInstructions, PaymentMethod, publishedWhatsAppContent, storePaymentQr, storeWhatsAppContentMedia, validatePaymentAmount, validateWhatsAppContentImage, WhatsAppActionId, whatsAppActionIdsForTemplate, whatsAppActionLabel, WhatsAppContent, WhatsAppTemplateKey, WHATSAPP_TEMPLATE_KEYS } from "@gfs/core";

 type Env = { Bindings: { DB: D1Database; RECEIPTS: R2Bucket; EVENTS?: Queue; DEPLOYMENT_STATE: string; ADMIN_EMAIL: string; META_ACCESS_TOKEN?: string; META_GRAPH_VERSION?: string; META_PHONE_NUMBER_ID?: string; META_WABA_ID?: string; META_APP_ID?: string; META_FLOW_ID?: string; META_CALLBACK_URL?: string; META_PROVIDER_ENABLED?: string; WEBHOOK_VERIFY_TOKEN?: string; META_APP_SECRET?: string; FLOW_PRIVATE_KEY?: string; FLOW_PUBLIC_KEY?: string } };
const app = new Hono<Env>();
app.use("/orders", async (c, next) => { c.header("Cache-Control", "no-store, max-age=0"); c.header("X-Content-Type-Options", "nosniff"); await next(); });
type AdminContext = Context<Env>;
const CSRF_COOKIE = "__Host-gfs_admin_csrf";

function authorized(c: { req: { header(name: string): string | undefined }; env: Env["Bindings"] }): boolean {
  return c.req.header("cf-access-authenticated-user-email") === c.env.ADMIN_EMAIL;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function issueCsrfToken(c: AdminContext): string {
  const current = cookieValue(c.req.header("cookie"), CSRF_COOKIE);
  const token = current && /^[a-f0-9]{64}$/.test(current) ? current : newCsrfToken();
  if (token !== current) c.header("Set-Cookie", `${CSRF_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`);
  return token;
}

function equalToken(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function validCsrf(c: AdminContext): boolean {
  const origin = c.req.header("origin");
  const expectedOrigin = new URL(c.req.url).origin;
  const cookie = cookieValue(c.req.header("cookie"), CSRF_COOKIE) ?? "";
  const header = c.req.header("x-csrf-token") ?? "";
  return origin === expectedOrigin && /^[a-f0-9]{64}$/.test(cookie) && equalToken(cookie, header);
}

function strictWaId(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[1-9]\d{6,19}$/.test(value.trim())) return undefined;
  return normalizeWhatsAppWaId(value.trim());
}

function requiredReason(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : undefined;
}

function validOrderDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function jsonRecords(value: unknown): Record<string, unknown>[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
  } catch {
    return [];
  }
}

export type ShippingLabelFormat = "4x6" | "A6";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function parseShippingLabelFormat(value: unknown): ShippingLabelFormat | undefined {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized === "A6" ? "A6" : normalized === "4X6" ? "4x6" : undefined;
}

function trackingNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9 ._\/-]{0,59}$/.test(normalized) ? normalized : undefined;
}

export function renderShippingLabelHtml(order: Record<string, unknown>, format: ShippingLabelFormat, assignedTrackingNumber?: string): string {
  const tracking = trackingNumber(assignedTrackingNumber ?? order.trackingNumber);
  const size = format === "A6" ? "105mm 148mm" : "4in 6in";
  const value = (key: string) => escapeHtml(order[key]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shipping label ${value("orderNumber")}</title><style>@page{size:${size};margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font:12pt/1.3 Arial,sans-serif}.label{width:100%;min-height:100%;padding:8mm;display:flex;flex-direction:column;gap:5mm}.brand{font-size:18pt;font-weight:800;letter-spacing:.03em}.rule{border-top:2px solid #111}.order{display:flex;justify-content:space-between;gap:8mm;align-items:flex-start}.order-number{font-size:20pt;font-weight:800}.caption{font-size:8pt;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.address{font-size:16pt;font-weight:700;line-height:1.35;overflow-wrap:anywhere}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3mm 6mm}.meta div{min-width:0}.value{font-weight:600;overflow-wrap:anywhere}.tracking{border:2px dashed #111;padding:3mm;font-size:13pt;font-weight:800}.print{border:0;background:#111;color:#fff;padding:2.5mm 4mm;font-size:11pt;font-weight:700;align-self:flex-end}@media print{.print{display:none}}@media screen{body{max-width:${format === "A6" ? "105mm" : "4in"};margin:1rem auto;box-shadow:0 0 0 1px #ddd}.label{min-height:${format === "A6" ? "148mm" : "6in"}}}</style></head><body><main class="label"><button class="print" type="button" onclick="window.print()">Print label</button><div class="brand">Get Free Seeds</div><div class="rule"></div><div class="order"><div><div class="caption">Order number</div><div class="order-number">${value("orderNumber")}</div></div><div><div class="caption">Province</div><div class="value">${value("province")}</div></div></div><section><div class="caption">Deliver to</div><div class="address">${value("customerName")}</div><div class="value">${value("deliveryAddress")}</div></section><div class="meta"><div><div class="caption">Landmark</div><div class="value">${value("landmark")}</div></div><div><div class="caption">City</div><div class="value">${value("city")}</div></div><div><div class="caption">Contact</div><div class="value">${value("contactNumber")}</div></div></div>${tracking ? `<div class="tracking">Tracking: ${escapeHtml(tracking)}</div>` : ""}<div class="rule"></div><div class="caption">Please keep this label with the parcel</div></main></body></html>`;
}

async function assignedTrackingNumber(db: D1Database, orderId: string): Promise<string | undefined> {
  const row = await db.prepare("SELECT metadata_json FROM audit_log WHERE entity_type='ORDER' AND entity_id=? AND action='ORDER_TRACKING_ASSIGNED' ORDER BY created_at DESC LIMIT 1").bind(orderId).first<{ metadata_json?: string }>();
  if (!row?.metadata_json) return undefined;
  try {
    const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
    return trackingNumber(metadata.trackingNumber);
  } catch {
    return undefined;
  }
}

function orderView(row: Record<string, unknown>) {
  const items = jsonRecords(row.items_json).map((item) => ({
    id: String(item.id),
    type: String(item.itemType),
    productCode: String(item.productCode),
    description: String(item.description),
    quantity: Number(item.quantity),
    unitPricePkr: Number(item.unitPricePkr),
    lineTotalPkr: Number(item.lineTotalPkr),
    createdAt: String(item.createdAt)
  }));
  const receipts = jsonRecords(row.receipts_json).map((receipt) => ({
    id: String(receipt.id),
    paymentId: String(receipt.paymentId),
    mimeType: String(receipt.mimeType),
    sizeBytes: Number(receipt.sizeBytes),
    submittedAt: String(receipt.submittedAt),
    createdAt: String(receipt.createdAt),
    previewUrl: `/api/orders/${encodeURIComponent(String(row.id))}/receipts/${encodeURIComponent(String(receipt.id))}/preview`
  }));
  const receiptCount = Number(row.receipt_count ?? receipts.length);
  const financial = String(row.state) === "PAID" || String(row.payment_status) === "PAID" || String(row.review_state ?? "") === "APPROVED" || row.approved_at != null || row.approved_amount != null;
  const state = String(row.state);
  const fulfillmentHold = String(row.order_number) === "FS-261019-000001";
  const unpaidState = ["NEW", "DETAILS_COMPLETED", "PAYMENT_PENDING", "PAYMENT_REJECTED", "CANCELLED"].includes(state);
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    state,
    fulfillmentHold,
    fulfillmentHoldReason: fulfillmentHold ? "Independent bank settlement and customer transaction reference are missing." : null,
    paymentStatus: String(row.payment_status),
    fulfillmentStatus: ["PAID", "PACKING", "DISPATCHED", "DELIVERED"].includes(state) ? state : "NOT_READY",
    province: row.province == null ? null : String(row.province),
    customerName: row.full_name == null ? null : String(row.full_name),
    deliveryAddress: row.delivery_address == null ? null : String(row.delivery_address),
    landmark: row.nearby_place == null ? null : String(row.nearby_place),
    city: row.city == null ? null : String(row.city),
    waId: row.wa_id == null ? null : String(row.wa_id),
    contactNumber: row.contact_number == null ? null : String(row.contact_number),
    normalizedContactNumber: row.normalized_contact_number == null ? null : String(row.normalized_contact_number),
    whatsappNumber: row.whatsapp_number == null ? null : String(row.whatsapp_number),
    normalizedWhatsappNumber: row.normalized_whatsapp_number == null ? null : String(row.normalized_whatsapp_number),
    paymentId: row.payment_id == null ? null : String(row.payment_id),
    paymentMethod: row.method == null ? null : String(row.method),
    paymentReviewState: row.review_state == null ? null : String(row.review_state),
    expectedAmountPkr: row.expected_amount == null ? null : Number(row.expected_amount),
    approvedAmountPkr: row.approved_amount == null ? null : Number(row.approved_amount),
    paymentReviewedBy: row.approved_by == null ? null : String(row.approved_by),
    paymentRejectionReason: row.rejection_reason == null ? null : String(row.rejection_reason),
    paymentSubmittedAt: row.submitted_at == null ? null : String(row.submitted_at),
    paymentApprovedAt: row.approved_at == null ? null : String(row.approved_at),
    paymentCreatedAt: row.payment_created_at == null ? null : String(row.payment_created_at),
    paymentUpdatedAt: row.payment_updated_at == null ? null : String(row.payment_updated_at),
    customerTransactionReference: row.customer_transaction_reference == null ? null : String(row.customer_transaction_reference),
    totalPayablePkr: Number(row.total_payable ?? 0),
    receiptCount,
    itemSummary: items.map((item) => `${item.description} x ${item.quantity}`).join(", "),
    items,
    receipts,
    trackingNumber: row.tracking_number == null ? null : trackingNumber(row.tracking_number) ?? null,
    confirmedAt: row.order_confirmed_at == null ? null : String(row.order_confirmed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: row.cancelled_at == null ? null : String(row.cancelled_at),
    cancelledBy: row.cancelled_by == null ? null : String(row.cancelled_by),
    cancellationReason: row.cancellation_reason == null ? null : String(row.cancellation_reason),
    archivedAt: row.archived_at == null ? null : String(row.archived_at),
    archivedBy: row.archived_by == null ? null : String(row.archived_by),
    archiveReason: row.archive_reason == null ? null : String(row.archive_reason),
    canConfirmOrder: !fulfillmentHold && ["PAID", "PACKING", "DISPATCHED", "DELIVERED"].includes(state) && row.order_confirmed_at == null && row.archived_at == null,
    canPrintShippingLabel: !fulfillmentHold && ["PAID", "PACKING", "DISPATCHED", "DELIVERED"].includes(state) && row.archived_at == null,
    canCancel: !financial && receiptCount === 0 && state !== "CANCELLED" && unpaidState && row.archived_at == null,
    canArchive: !financial && receiptCount === 0 && unpaidState && row.archived_at == null
  };
}

function productView(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    category: String(row.category ?? ""),
    pricePkr: Number(row.price_pkr),
    fertilizerPricePkr: row.fertilizer_price_pkr == null ? null : Number(row.fertilizer_price_pkr),
    packQuantity: Number(row.pack_quantity ?? 1),
    active: Number(row.enabled) === 1
  };
}

function tariffPageHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tariff Management | Get Free Seeds</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.5rem;text-align:left}input{box-sizing:border-box;max-width:12rem;padding:.35rem}small{display:block;color:#666}.status{margin-left:.5rem}.ok{color:green}.error{color:#b00020}</style></head><body><nav><a href="/">Admin home</a> | <a href="/payment-settings">Payment Settings</a></nav><h1>Tariff Management</h1><p>D1/admin is the only dynamic quote source.</p><table><thead><tr><th>Item/Province</th><th>Type</th><th>Price/Fee PKR</th><th>Packs</th><th>Active</th><th>Save</th></tr></thead><tbody id="rows"></tbody></table><script>
const escapeHtml=(value)=>String(value??'').replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function productRow(item){return '<tr data-kind="p" data-id="'+escapeHtml(item.id)+'"><td><input name="name" value="'+escapeHtml(item.name)+'"><small>'+escapeHtml(item.code)+'</small></td><td>'+escapeHtml(item.category)+'</td><td><input name="pricePkr" type="number" min="0" value="'+escapeHtml(item.pricePkr)+'"></td><td><input name="packQuantity" type="number" min="1" value="'+escapeHtml(item.packQuantity||1)+'"></td><td><input name="active" type="checkbox" '+(item.active?'checked':'')+'></td><td><button type="button">Save</button><span class="status"></span></td></tr>'}
function rateRow(item){return '<tr data-kind="r" data-id="'+escapeHtml(item.id)+'"><td>'+escapeHtml(item.province)+'</td><td>DELIVERY</td><td><input name="deliveryFeePkr" type="number" min="1" value="'+escapeHtml(item.deliveryFeePkr)+'"></td><td>-</td><td><input name="active" type="checkbox" '+(item.active?'checked':'')+'></td><td><button type="button">Save</button><span class="status"></span></td></tr>'}
async function load(){const [productResponse,rateResponse]=await Promise.all([fetch('/api/catalog/products').then((response)=>response.json()),fetch('/api/catalog/province-delivery-rates').then((response)=>response.json())]);const rows=(productResponse.products||[]).map(productRow).concat((rateResponse.rates||[]).map(rateRow));document.querySelector('#rows').innerHTML=rows.join('');for(const row of document.querySelectorAll('#rows tr')){const button=row.querySelector('button');const status=row.querySelector('span');button.onclick=async()=>{const body={};for(const input of row.querySelectorAll('input[name]'))body[input.name]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;const path=row.dataset.kind==='p'?'products':'province-delivery-rates';const result=await fetch('/api/catalog/'+path+'/'+row.dataset.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});status.textContent=result.ok?' Saved':' Validation blocked';status.className='status '+(result.ok?'ok':'error')}}}
load().catch(()=>{document.querySelector('#rows').textContent='Tariff unavailable'});
</script></body></html>`;
}

function ordersPageHtml(csrfToken: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orders | Get Free Seeds</title><style>body{font:15px system-ui;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#172018}nav{margin-bottom:1rem}.filters{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}input,select,textarea,button{font:inherit;padding:.5rem}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d9dfd9;padding:.55rem;text-align:left}tr:hover{background:#f4f7f4}tr[aria-selected=true]{background:#e8f1e9}.panel{border:1px solid #ccd5cc;border-radius:8px;padding:1rem;margin-top:1rem;white-space:pre-wrap}.actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}.receipt{margin:.75rem 0}.error{color:#a40019}.ok{color:#176b36}.muted{color:#59635a}.state{font-weight:600}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:700px){table{font-size:.9rem}th,td{padding:.4rem}.actions button{width:100%}}</style></head><body><nav><a href="/">Admin home</a> | <a href="/test-controls">Test controls</a></nav><h1>Orders</h1><form id="filters" class="filters"><label>Search <input name="q" placeholder="Order, customer, or wa_id"></label><label>State <select name="state"><option value="">All states</option><option>NEW</option><option>DETAILS_COMPLETED</option><option>PAYMENT_PENDING</option><option>RECEIPT_SUBMITTED</option><option>PAYMENT_REVIEW</option><option>PAYMENT_REJECTED</option><option>PAID</option><option>PACKING</option><option>DISPATCHED</option><option>DELIVERED</option><option>CANCELLED</option></select></label><label>Archived <select name="archived"><option value="active">Active</option><option value="all">All</option><option value="only">Archived</option></select></label><button>Search</button></form><p id="list-status" class="muted" role="status" aria-live="polite">Loading orders...</p><table><thead><tr><th>Order</th><th>Customer</th><th>State</th><th>Payment</th><th>Created</th></tr></thead><tbody id="rows"></tbody></table><section id="detail" class="panel muted" aria-live="polite">Select an order.</section><script>
 const csrf=${JSON.stringify(csrfToken)};const filters=document.querySelector('#filters');const rows=document.querySelector('#rows');const listStatus=document.querySelector('#list-status');const detail=document.querySelector('#detail');let selectedId='';
 const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}
 function hydrateFilters(){const params=new URLSearchParams(location.search);for(const name of ['q','state','archived']){const value=params.get(name);if(value!==null&&filters.elements[name])filters.elements[name].value=value}}
 function query(){return new URLSearchParams(new FormData(filters))}
 function syncUrl(){const params=query();const queryString=params.toString();history.replaceState(null,'',location.pathname+(queryString?'?'+queryString:''))}
 async function load(){listStatus.className='muted';listStatus.textContent='Loading orders...';rows.innerHTML='';const data=await json(await fetch('/api/orders?'+query()));const orders=data.orders||[];if(!orders.length){listStatus.textContent='No matching orders.';rows.innerHTML='<tr><td colspan="5" class="muted">No orders match these filters.</td></tr>';return}listStatus.textContent=orders.length+' order'+(orders.length===1?'':'s')+' found.';rows.innerHTML=orders.map((o)=>'<tr data-id="'+esc(o.id)+'" tabindex="0" aria-selected="'+(o.id===selectedId)+'"><td>'+esc(o.orderNumber)+'</td><td>'+esc(o.customerName)+'</td><td class="state">'+esc(o.state)+(o.archivedAt?' (archived)':'')+'</td><td>'+esc(o.paymentReviewState||o.paymentStatus)+'</td><td>'+esc(o.createdAt)+'</td></tr>').join('');for(const row of rows.querySelectorAll('[data-id]')){row.onclick=()=>show(row.dataset.id);row.onkeydown=(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row.dataset.id)}}}}
 async function mutate(path,body){return json(await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}))}
 async function refresh(id){await load();if(id)await show(id)}
 function actionButton(label,handler){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=async()=>{button.disabled=true;try{await handler();}catch(error){detail.className='panel error';detail.textContent=error instanceof Error?error.message:'Request failed'}finally{button.disabled=false}};return button}
 async function show(id){selectedId=id;detail.className='panel muted';detail.textContent='Loading order details...';try{const data=await json(await fetch('/api/orders/'+encodeURIComponent(id)));const o=data.order;const items=(data.items||[]).map((item)=>esc(item.description)+' x '+esc(item.quantity)).join(', ')||'None';const receipts=(data.receipts||[]).map((receipt)=>'<li class="receipt"><a href="'+esc(receipt.previewUrl)+'" target="_blank" rel="noreferrer">View private receipt preview</a> <span class="muted">('+esc(receipt.mimeType)+', submitted '+esc(receipt.submittedAt)+')</span></li>').join('')||'<li class="muted">No receipts.</li>';detail.className='panel';detail.innerHTML='<strong>'+esc(o.orderNumber)+'</strong><br>Customer: '+esc(o.customerName)+'<br>State: <span class="state">'+esc(o.state)+'</span><br>Payment: '+esc(o.paymentReviewState||o.paymentStatus)+'<br>Province: '+esc(o.province)+'<br>Items: '+items+'<br>Receipts:<ul>'+receipts+'</ul><div class="actions"></div><p class="action-status muted" role="status"></p>';const actions=detail.querySelector('.actions');const status=detail.querySelector('.action-status');const confirmOrder=()=>confirm('Confirm action for '+o.orderNumber+'?');const run=async(path,body,message)=>{await mutate(path,body);status.className='action-status ok';status.textContent=message;await refresh(o.id)};if(o.paymentId&&o.state==='PAYMENT_REVIEW'&&o.paymentReviewState==='REVIEW'){actions.append(actionButton('Approve payment',async()=>{if(!confirmOrder())return;await run('/api/payments/'+encodeURIComponent(o.paymentId)+'/approve',{orderId:o.id,confirmation:o.orderNumber},'Payment approved.')}));actions.append(actionButton('Reject payment',async()=>{const reason=prompt('Rejection reason');if(!reason||!confirm('Reject payment for '+o.orderNumber+'?'))return;await run('/api/payments/'+encodeURIComponent(o.paymentId)+'/reject',{orderId:o.id,reason,confirmation:o.orderNumber},'Payment rejected.')}));if(o.receiptCount>0)actions.append(actionButton('Request clearer receipt',async()=>{if(!confirm('Request a clearer receipt for '+o.orderNumber+'?'))return;await run('/api/payments/'+encodeURIComponent(o.paymentId)+'/request-clearer-receipt',{orderId:o.id,confirmation:o.orderNumber},'Clearer receipt requested.')}))}const next={PAID:'PACKING',PACKING:'DISPATCHED',DISPATCHED:'DELIVERED'}[o.state];if(next)actions.append(actionButton('Mark '+next,async()=>{if(!confirm('Move '+o.orderNumber+' from '+o.state+' to '+next+'?'))return;await run('/api/orders/'+encodeURIComponent(o.id)+'/transition',{from:o.state,to:next,confirmation:o.orderNumber},'Order moved to '+next+'.')}));if(o.canCancel)actions.append(actionButton('Cancel unpaid order',async()=>{const reason=prompt('Cancellation reason');if(!reason||!confirm('Cancel '+o.orderNumber+'? Financial history will be retained.'))return;await run('/api/orders/'+encodeURIComponent(o.id)+'/cancel',{reason,confirmation:o.orderNumber},'Order cancelled; financial history retained.')}));if(o.canArchive)actions.append(actionButton('Archive unpaid order',async()=>{const reason=prompt('Archive reason');if(!reason||!confirm('Archive '+o.orderNumber+'? No records will be deleted.'))return;await run('/api/orders/'+encodeURIComponent(o.id)+'/archive',{reason,confirmation:o.orderNumber},'Order archived; no records deleted.')}))}catch(error){detail.className='panel error';detail.textContent=error instanceof Error?error.message:'Request failed'}}
 filters.onsubmit=(event)=>{event.preventDefault();syncUrl();load().catch((error)=>{listStatus.className='error';listStatus.textContent=error instanceof Error?error.message:'Orders unavailable'})};hydrateFilters();load().catch((error)=>{listStatus.className='error';listStatus.textContent=error instanceof Error?error.message:'Orders unavailable'});
 </script></body></html>`;
}

function ordersDashboardPageHtml(csrfToken: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orders | Get Free Seeds</title>
<style>
:root{color-scheme:light;--ink:#17231c;--muted:#657269;--line:#dbe3dc;--paper:#fff;--wash:#f4f7f4;--green:#174d31;--green-2:#dcecdf;--amber:#e8a72f;--danger:#a32929;--shadow:0 12px 32px rgba(23,35,28,.08)}*{box-sizing:border-box}body{margin:0;background:#edf2ed;color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select{font:inherit}button{cursor:pointer}.shell{max-width:1500px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:20px}.eyebrow{color:var(--green);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.top h1{font-family:Georgia,serif;font-size:34px;line-height:1;margin:5px 0 7px}.top p{margin:0;color:var(--muted)}nav a{color:var(--green);text-decoration:none;font-weight:700}.refresh{border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:9px 14px;box-shadow:var(--shadow)}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.tab{border:1px solid var(--line);border-radius:13px;background:var(--paper);padding:15px;text-align:left;box-shadow:0 5px 16px rgba(23,35,28,.04)}.tab span{display:block;color:var(--muted);font-size:12px;font-weight:700}.tab strong{display:block;margin-top:4px;color:var(--green);font:700 27px Georgia,serif}.tab.active{border-color:var(--green);background:var(--green);color:#fff}.tab.active span,.tab.active strong{color:#fff}.filters{display:grid;grid-template-columns:minmax(230px,2fr) repeat(4,minmax(130px,1fr)) auto auto;gap:9px;align-items:end;background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:14px}.filters label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}.filters input,.filters select{display:block;width:100%;margin-top:5px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px;color:var(--ink)}.filters button{height:38px;border-radius:8px;padding:0 14px}.apply{border:0;background:var(--green);color:#fff;font-weight:750}.clear{border:1px solid var(--line);background:#fff}.workspace{display:grid;grid-template-columns:minmax(370px,440px) minmax(0,1fr);height:calc(100vh - 285px);min-height:560px;background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}.master{display:flex;min-height:0;flex-direction:column;border-right:1px solid var(--line);background:#f8faf8}.list-head{display:flex;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid var(--line);background:#fff}.muted{color:var(--muted)}.error{color:var(--danger)}.ok{color:#176b36}.orders{overflow:auto;flex:1}.order{width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;padding:14px 15px;text-align:left}.order:hover{background:#f0f5f0}.order.active{background:var(--green-2);box-shadow:inset 4px 0 var(--green)}.order-top,.order-bottom{display:flex;justify-content:space-between;gap:12px;align-items:center}.order-number{font-weight:850}.customer{margin:5px 0;color:#344139}.order-bottom{color:var(--muted);font-size:12px}.badge{display:inline-flex;align-items:center;border-radius:999px;background:#e7ede8;padding:3px 8px;font-size:10px;font-weight:850;letter-spacing:.04em}.badge.review{background:#fff0cf;color:#7a5200}.badge.paid{background:#dcecdf;color:#174d31}.pager{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;border-top:1px solid var(--line);background:#fff}.pager button{border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 10px}.pager button:disabled{opacity:.4;cursor:not-allowed}.detail{overflow:auto;padding:23px 26px}.empty{height:100%;display:grid;place-items:center;color:var(--muted);text-align:center}.detail-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding-bottom:17px;border-bottom:1px solid var(--line)}.detail-header h2{font:700 29px Georgia,serif;margin:0 0 5px}.amount{text-align:right}.amount strong{display:block;color:var(--green);font:700 25px Georgia,serif}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:16px 0}.card{border:1px solid var(--line);border-radius:11px;padding:15px;background:#fff}.card h3{margin:0 0 11px;color:var(--green);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.facts{display:grid;grid-template-columns:minmax(110px,.7fr) 1.3fr;gap:7px 12px;margin:0}.facts dt{color:var(--muted)}.facts dd{margin:0;overflow-wrap:anywhere}.wide{grid-column:1/-1}.items,.receipts,.timeline{list-style:none;padding:0;margin:0}.items li,.receipts li,.timeline li{padding:8px 0;border-top:1px solid var(--wash)}.items li:first-child,.receipts li:first-child,.timeline li:first-child{border-top:0}.item-line{display:flex;justify-content:space-between;gap:12px}.receipts a{color:var(--green);font-weight:750}.actions{display:flex;flex-wrap:wrap;gap:8px;position:sticky;bottom:-23px;margin:18px -26px -23px;padding:13px 26px;background:rgba(255,255,255,.96);border-top:1px solid var(--line);backdrop-filter:blur(8px)}.actions button{border:1px solid var(--green);border-radius:8px;padding:8px 12px;background:#fff;color:var(--green);font-weight:750}.actions .primary{background:var(--green);color:#fff}.actions .danger{border-color:#d8adad;color:var(--danger)}.action-status{flex-basis:100%;margin:0}.skeleton{padding:22px;color:var(--muted)}@media(max-width:1050px){.filters{grid-template-columns:repeat(3,minmax(0,1fr))}.filters label:first-child{grid-column:span 2}}@media(max-width:760px){.shell{padding:14px}.top{align-items:center}.top h1{font-size:28px}.tabs{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr 1fr}.filters label:first-child{grid-column:1/-1}.workspace{grid-template-columns:1fr;grid-template-rows:minmax(280px,42vh) minmax(430px,1fr);height:auto;min-height:850px}.master{border-right:0;border-bottom:1px solid var(--line)}.detail{padding:18px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.actions{bottom:-18px;margin:18px -18px -18px;padding:12px 18px}.amount strong{font-size:20px}}@media(max-width:430px){.filters{grid-template-columns:1fr}.filters label:first-child{grid-column:auto}.tabs{gap:7px}.tab{padding:11px}.tab strong{font-size:23px}.detail-header{display:block}.amount{text-align:left;margin-top:10px}}
</style></head><body><main class="shell"><header class="top"><div><div class="eyebrow">Operations console</div><h1>Orders</h1><p>Payment review and fulfillment from one protected workspace.</p><nav><a href="/">Admin home</a> &nbsp;·&nbsp; <a href="/test-controls">Test controls</a></nav></div><button id="refresh" class="refresh" type="button">Refresh</button></header>
<section class="tabs" aria-label="Order queues"><button class="tab" data-tab="all" type="button"><span>All Orders</span><strong data-count="all">—</strong></button><button class="tab" data-tab="verify" type="button"><span>Verify Payments</span><strong data-count="verify">—</strong></button><button class="tab" data-tab="confirmed" type="button"><span>Confirmed Payments</span><strong data-count="confirmed">—</strong></button><button class="tab" data-tab="fulfillment" type="button"><span>Fulfillment</span><strong data-count="fulfillment">—</strong></button></section>
<form id="filters" class="filters"><label>Search<input name="q" type="search" autocomplete="off" placeholder="Order, customer, 03xx, +92, wa_id"></label><label>Order date<input name="date" type="date"></label><label>Payment<select name="paymentStatus"><option value="">Any payment</option><option value="PENDING">Pending</option><option value="REVIEW">In review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><label>Fulfillment<select name="fulfillment"><option value="">Any stage</option><option value="NOT_STARTED">Ready to pack</option><option value="PACKING">Packing</option><option value="DISPATCHED">Dispatched</option><option value="DELIVERED">Delivered</option><option value="CANCELLED">Cancelled</option></select></label><label>Archive<select name="archived"><option value="active">Active only</option><option value="all">Active + archived</option><option value="only">Archived only</option></select></label><label>Rows<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label><button class="apply" type="submit">Apply</button><button id="clear" class="clear" type="button">Clear</button></form>
<section class="workspace"><aside class="master"><div class="list-head"><strong id="queue-title">All Orders</strong><span id="list-status" class="muted" role="status" aria-live="polite">Loading…</span></div><div id="orders" class="orders"><div class="skeleton">Loading orders…</div></div><div class="pager"><button id="previous" type="button">Previous</button><span id="page-status" class="muted">Page 1</span><button id="next" type="button">Next</button></div></aside><article id="detail" class="detail"><div class="empty"><p>Select an order to inspect its full record.</p></div></article></section></main>
<script>
const csrf=${JSON.stringify(csrfToken)};
const filters=document.querySelector('#filters'),ordersRoot=document.querySelector('#orders'),detail=document.querySelector('#detail'),listStatus=document.querySelector('#list-status'),pageStatus=document.querySelector('#page-status');
const tabNames={all:'All Orders',verify:'Verify Payments',confirmed:'Confirmed Payments',fulfillment:'Fulfillment'};let tab='all',page=1,totalPages=0,selectedId='',loading=0;
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const text=(value)=>value===null||value===undefined||value===''?'—':esc(value);
const money=(value)=>value===null||value===undefined?'—':'PKR '+Number(value).toLocaleString('en-PK');
const when=(value)=>value?new Date(value).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'}):'—';
async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}
function hydrate(){const params=new URLSearchParams(location.search);tab=tabNames[params.get('tab')]?params.get('tab'):'all';page=Math.max(1,Number(params.get('page'))||1);for(const name of ['q','date','paymentStatus','fulfillment','archived','pageSize']){const value=params.get(name);if(value!==null&&filters.elements[name])filters.elements[name].value=value}}
function params(){const result=new URLSearchParams(new FormData(filters));result.set('tab',tab);result.set('page',String(page));return result}
function syncUrl(){history.replaceState(null,'',location.pathname+'?'+params().toString())}
function setTabs(counts){for(const button of document.querySelectorAll('[data-tab]'))button.classList.toggle('active',button.dataset.tab===tab);for(const [key,value] of Object.entries(counts||{})){const node=document.querySelector('[data-count="'+key+'"]');if(node)node.textContent=Number(value).toLocaleString('en-PK')}document.querySelector('#queue-title').textContent=tabNames[tab]}
function badge(order){const value=order.paymentReviewState||order.paymentStatus||order.state;const tone=value==='REVIEW'?' review':value==='APPROVED'||value==='PAID'?' paid':'';return '<span class="badge'+tone+'">'+esc(value)+'</span>'}
function orderCard(order){return '<button class="order '+(order.id===selectedId?'active':'')+'" data-order-id="'+esc(order.id)+'" type="button"><span class="order-top"><span class="order-number">'+esc(order.orderNumber)+'</span>'+badge(order)+'</span><span class="customer">'+text(order.customerName)+'</span><span class="order-bottom"><span>'+esc(order.itemSummary||'No item summary')+'</span><strong>'+money(order.totalPayablePkr)+'</strong></span><span class="order-bottom"><span>'+esc(order.state)+(order.archivedAt?' · Archived':'')+'</span><time>'+esc(when(order.createdAt))+'</time></span></button>'}
function renderList(data){const list=data.orders||[];totalPages=data.pagination.totalPages;listStatus.textContent=Number(data.total).toLocaleString('en-PK')+' total';pageStatus.textContent='Page '+data.pagination.page+' of '+Math.max(1,totalPages);document.querySelector('#previous').disabled=data.pagination.page<=1;document.querySelector('#next').disabled=data.pagination.page>=totalPages;setTabs(data.counts);if(!list.length){ordersRoot.innerHTML='<div class="skeleton">No orders match this queue and filter set.</div>';selectedId='';detail.innerHTML='<div class="empty"><p>No matching order to inspect.</p></div>';return null}if(!list.some((order)=>order.id===selectedId))selectedId=list[0].id;ordersRoot.innerHTML=list.map(orderCard).join('');for(const button of ordersRoot.querySelectorAll('[data-order-id]'))button.onclick=()=>show(button.dataset.orderId);return selectedId}
async function load(){const current=++loading;listStatus.className='muted';listStatus.textContent='Loading…';ordersRoot.innerHTML='<div class="skeleton">Loading orders…</div>';const data=await json(await fetch('/api/orders?'+params().toString(),{cache:'no-store'}));if(current!==loading)return;const id=renderList(data);syncUrl();if(id)await show(id)}
function facts(entries){return '<dl class="facts">'+entries.map((entry)=>'<dt>'+esc(entry[0])+'</dt><dd>'+entry[1]+'</dd>').join('')+'</dl>'}
function actionButton(label,handler,className=''){const button=document.createElement('button');button.type='button';button.className=className;button.textContent=label;button.onclick=async()=>{button.disabled=true;try{await handler()}catch(error){showActionError(error)}finally{button.disabled=false}};return button}
function showActionError(error){const node=detail.querySelector('.action-status');if(node){node.className='action-status error';node.textContent=error instanceof Error?error.message:'Request failed'}}
async function mutate(path,body){return json(await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}))}
async function run(path,body){await mutate(path,body);await load()}
function confirmAction(order,label){return confirm(label+' for '+order.orderNumber+'? This action is audited.')}
function addActions(order){const root=detail.querySelector('.actions');if(!root||order.archivedAt)return;if(order.paymentId&&order.state==='PAYMENT_REVIEW'&&order.paymentReviewState==='REVIEW'&&order.receiptCount>0){root.append(actionButton('Approve payment',async()=>{if(confirmAction(order,'Approve the reviewed payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/approve',{orderId:order.id,confirmation:order.orderNumber})},'primary'));root.append(actionButton('Reject payment',async()=>{const reason=prompt('Rejection reason');if(reason&&confirmAction(order,'Reject the payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/reject',{orderId:order.id,reason,confirmation:order.orderNumber})},'danger'));root.append(actionButton('Request clearer receipt',async()=>{if(confirmAction(order,'Request a clearer receipt'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/request-clearer-receipt',{orderId:order.id,confirmation:order.orderNumber})}))}const next={PAID:['PACKING','Mark packing'],PACKING:['DISPATCHED','Mark dispatched'],DISPATCHED:['DELIVERED','Mark delivered']}[order.state];if(next)root.append(actionButton(next[1],async()=>{if(confirmAction(order,next[1]))await run('/api/orders/'+encodeURIComponent(order.id)+'/transition',{from:order.state,to:next[0],confirmation:order.orderNumber})},'primary'));if(order.canCancel)root.append(actionButton('Cancel order',async()=>{const reason=prompt('Cancellation reason');if(reason&&confirmAction(order,'Cancel order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/cancel',{reason,confirmation:order.orderNumber})},'danger'));if(order.canArchive)root.append(actionButton('Archive order',async()=>{const reason=prompt('Archive reason');if(reason&&confirmAction(order,'Archive order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/archive',{reason,confirmation:order.orderNumber})}));root.insertAdjacentHTML('beforeend','<p class="action-status muted" role="status"></p>')}
function renderDetail(data){const order=data.order,items=data.items||order.items||[],receipts=data.receipts||order.receipts||[],audit=data.audit||[];const itemHtml=items.length?items.map((item)=>'<li><div class="item-line"><span><strong>'+text(item.description)+'</strong> × '+text(item.quantity)+'</span><span>'+money(item.lineTotalPkr)+'</span></div><small class="muted">'+text(item.productCode)+' · '+money(item.unitPricePkr)+' each</small></li>').join(''):'<li class="muted">No items recorded.</li>';const receiptHtml=receipts.length?receipts.map((receipt,index)=>'<li><a href="'+esc(receipt.previewUrl)+'" target="_blank" rel="noreferrer">Open private receipt '+(index+1)+'</a><br><small class="muted">'+text(receipt.mimeType)+' · '+Number(receipt.sizeBytes||0).toLocaleString('en-PK')+' bytes · '+esc(when(receipt.submittedAt))+'</small></li>').join(''):'<li class="muted">No receipts submitted.</li>';const auditHtml=audit.length?audit.map((entry)=>'<li><strong>'+text(entry.action)+'</strong><br><small class="muted">'+esc(when(entry.created_at))+' · '+text(entry.actor_id||entry.actor_type)+'</small></li>').join(''):'<li class="muted">No audit entries.</li>';detail.innerHTML='<header class="detail-header"><div><h2>'+esc(order.orderNumber)+'</h2><span class="badge">'+esc(order.state)+'</span> '+badge(order)+(order.archivedAt?' <span class="badge">Archived</span>':'')+'</div><div class="amount"><span class="muted">Order total</span><strong>'+money(order.totalPayablePkr)+'</strong><small>'+esc(when(order.createdAt))+'</small></div></header><div class="grid"><section class="card"><h3>Customer & delivery</h3>'+facts([['Name',text(order.customerName)],['Phone',text(order.contactNumber)],['Normalized phone',text(order.normalizedContactNumber)],['WhatsApp',text(order.whatsappNumber)],['Meta wa_id',text(order.waId)],['Address',text(order.deliveryAddress)],['Landmark',text(order.landmark)],['City',text(order.city)],['Province',text(order.province)]])+'</section><section class="card"><h3>Payment record</h3>'+facts([['Method',text(order.paymentMethod)],['Status',text(order.paymentReviewState||order.paymentStatus)],['Expected',money(order.expectedAmountPkr)],['Approved',money(order.approvedAmountPkr)],['Reviewer',text(order.paymentReviewedBy)],['Submitted',esc(when(order.paymentSubmittedAt))],['Approved at',esc(when(order.paymentApprovedAt))],['Reference',text(order.customerTransactionReference)],['Rejection reason',text(order.paymentRejectionReason)]])+'</section><section class="card"><h3>Fulfillment & retention</h3>'+facts([['Stage',text(order.fulfillmentStatus)],['Last updated',esc(when(order.updatedAt))],['Cancelled at',esc(when(order.cancelledAt))],['Cancelled by',text(order.cancelledBy)],['Cancellation reason',text(order.cancellationReason)],['Archived at',esc(when(order.archivedAt))],['Archived by',text(order.archivedBy)],['Archive reason',text(order.archiveReason)]])+'</section><section class="card"><h3>Receipts</h3><ul class="receipts">'+receiptHtml+'</ul></section><section class="card wide"><h3>Items</h3><ul class="items">'+itemHtml+'</ul></section><section class="card wide"><details><summary><strong>Audit trail</strong> <span class="muted">('+audit.length+')</span></summary><ul class="timeline">'+auditHtml+'</ul></details></section></div><div class="actions"></div>';addActions(order)}
async function show(id){selectedId=id;for(const node of ordersRoot.querySelectorAll('[data-order-id]'))node.classList.toggle('active',node.dataset.orderId===id);detail.innerHTML='<div class="skeleton">Loading full order record…</div>';try{const data=await json(await fetch('/api/orders/'+encodeURIComponent(id),{cache:'no-store'}));if(selectedId===id)renderDetail(data)}catch(error){detail.innerHTML='<div class="empty error"><p>'+esc(error instanceof Error?error.message:'Order unavailable')+'</p></div>'}}
filters.onsubmit=(event)=>{event.preventDefault();page=1;load().catch(fail)};document.querySelector('#clear').onclick=()=>{filters.reset();tab='all';page=1;selectedId='';load().catch(fail)};document.querySelector('#refresh').onclick=()=>load().catch(fail);document.querySelector('#previous').onclick=()=>{if(page>1){page-=1;selectedId='';load().catch(fail)}};document.querySelector('#next').onclick=()=>{if(page<totalPages){page+=1;selectedId='';load().catch(fail)}};for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{tab=button.dataset.tab;page=1;selectedId='';load().catch(fail)};
function fail(error){listStatus.className='error';listStatus.textContent=error instanceof Error?error.message:'Orders unavailable';ordersRoot.innerHTML='<div class="skeleton error">Orders could not be loaded.</div>'}
hydrate();setTabs({});load().catch(fail);
</script></body></html>`;
}

function legacyProfessionalOrdersPageHtml(csrfToken: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orders | Get Free Seeds</title><style>:root{color-scheme:light;--ink:#17231c;--muted:#657269;--line:#dbe3dc;--paper:#fff;--wash:#f4f7f4;--green:#174d31;--danger:#a32929;--shadow:0 12px 32px rgba(23,35,28,.08)}*{box-sizing:border-box}body{margin:0;background:#edf2ed;color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}button,input,select{font:inherit}button{cursor:pointer}.shell{max-width:1500px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.eyebrow{color:var(--green);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.top h1{font-family:Georgia,serif;font-size:34px;line-height:1;margin:5px 0 7px}.top p{margin:0;color:var(--muted)}nav a{color:var(--green);text-decoration:none;font-weight:700}.refresh,.tab,.filters,.card,.detail{border:1px solid var(--line);background:var(--paper);border-radius:13px;box-shadow:var(--shadow)}.refresh{padding:9px 14px}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.tab{padding:15px;text-align:left}.tab span{display:block;color:var(--muted);font-size:12px;font-weight:700}.tab strong{display:block;margin-top:4px;color:var(--green);font:700 27px Georgia,serif}.tab.active{border-color:var(--green);background:var(--green);color:#fff}.tab.active span,.tab.active strong{color:#fff}.filters{display:grid;grid-template-columns:minmax(230px,2fr) repeat(4,minmax(130px,1fr)) auto auto;gap:9px;align-items:end;padding:13px;margin-bottom:14px}.filters label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}.filters input,.filters select{display:block;width:100%;margin-top:5px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px;color:var(--ink)}.apply,.primary{border:0;border-radius:8px;background:var(--green);color:#fff;padding:9px 13px}.clear{border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px 13px}.workspace{display:grid;grid-template-columns:minmax(280px,420px) 1fr;gap:14px}.master{min-width:0}.list-head{display:flex;justify-content:space-between;align-items:center;padding:11px 4px}.orders{display:grid;grid-template-rows:minmax(280px,42vh);overflow:auto;gap:8px}.order{display:block;width:100%;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:12px;text-align:left}.order.active{outline:3px solid #9cc7a8}.order-top,.order-bottom{display:flex;justify-content:space-between;gap:8px}.order-number{font-weight:800;color:var(--green)}.customer{display:block;margin:5px 0;font-weight:700}.muted{color:var(--muted)}.badge{display:inline-block;border-radius:999px;padding:2px 7px;background:var(--wash);font-size:11px;font-weight:800}.badge.review{background:#fff0c7}.badge.paid{background:#dcecdf}.pager{display:flex;justify-content:space-between;align-items:center;padding:12px 0}.detail{padding:18px;min-width:0}.detail-header{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding-bottom:12px}.detail-header h2{margin:0 0 6px;font-family:Georgia,serif}.amount{text-align:right}.amount strong{display:block;font:700 24px Georgia,serif;color:var(--green)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px}.card{padding:14px;box-shadow:none}.card h3{margin:0 0 10px}.facts{display:grid;grid-template-columns:minmax(110px,.7fr) 1.3fr;gap:7px;margin:0}.facts dt{color:var(--muted);font-weight:700}.facts dd{margin:0;overflow-wrap:anywhere}.items{padding-left:20px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.actions button{border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px 11px}.actions .primary{border-color:var(--green);background:var(--green)}.actions .danger{border-color:#e6b4b4;color:var(--danger)}.action-status{min-height:1.4em}.error{color:var(--danger)}.ok{color:#176b36}.empty{display:grid;place-items:center;min-height:300px;color:var(--muted)}@media(max-width:900px){.filters{grid-template-columns:repeat(2,minmax(0,1fr))}.workspace{grid-template-columns:1fr}.orders{grid-template-rows:minmax(220px,35vh)}}@media(max-width:600px){.shell{padding:14px}.tabs{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr}.top{display:block}.refresh{margin-top:12px}.detail-header{display:block}.amount{text-align:left;margin-top:8px}.actions button{width:100%}}</style></head><body><main class="shell"><header class="top"><div><div class="eyebrow">Operations console</div><h1>Orders</h1><p>Payment review, operational confirmation, and fulfillment from one protected workspace.</p><nav><a href="/">Admin home</a> &nbsp;·&nbsp; <a href="/test-controls">Test controls</a></nav></div><button id="refresh" class="refresh" type="button">Refresh</button></header><section class="tabs" aria-label="Order queues"><button class="tab" data-tab="all" type="button"><span>All Orders</span><strong data-count="all">—</strong></button><button class="tab" data-tab="verify" type="button"><span>Verify Payments</span><strong data-count="verify">—</strong></button><button class="tab" data-tab="confirmed" type="button"><span>Confirmed Payments</span><strong data-count="confirmed">—</strong></button><button class="tab" data-tab="fulfillment" type="button"><span>Fulfillment</span><strong data-count="fulfillment">—</strong></button></section><form id="filters" class="filters"><label>Search<input name="q" type="search" autocomplete="off" placeholder="Order, customer, 03xx, +92, wa_id"></label><label>Order date<input name="date" type="date"></label><label>Payment<select name="paymentStatus"><option value="">Any payment</option><option value="PENDING">Pending</option><option value="REVIEW">In review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><label>Fulfillment<select name="fulfillment"><option value="">Any stage</option><option value="NOT_STARTED">Ready to pack</option><option value="PACKING">Packing</option><option value="DISPATCHED">Dispatched</option><option value="DELIVERED">Delivered</option><option value="CANCELLED">Cancelled</option></select></label><label>Archive<select name="archived"><option value="active">Active only</option><option value="all">Active + archived</option><option value="only">Archived only</option></select></label><label>Rows<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label><button class="apply" type="submit">Apply</button><button id="clear" class="clear" type="button">Clear</button></form><section class="workspace"><aside class="master"><div class="list-head"><strong id="queue-title">All Orders</strong><span id="list-status" class="muted" role="status" aria-live="polite">Loading...</span></div><div id="orders" class="orders"><div class="empty">Loading orders...</div></div><div class="pager"><button id="previous" type="button">Previous</button><span id="page-status" class="muted">Page 1</span><button id="next" type="button">Next</button></div></aside><article id="detail" class="detail"><div class="empty">Select an order to inspect its full record.</div></article></section></main><script>
const csrf=${JSON.stringify(csrfToken)};const filters=document.querySelector('#filters'),ordersRoot=document.querySelector('#orders'),detail=document.querySelector('#detail'),listStatus=document.querySelector('#list-status'),pageStatus=document.querySelector('#page-status');const tabNames={all:'All Orders',verify:'Verify Payments',confirmed:'Confirmed Payments',fulfillment:'Fulfillment'};let tab='all',page=1,totalPages=0,selectedId='';const esc=(value)=>String(value??'').replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));const text=(value)=>value===null||value===undefined||value===''?'—':esc(value);const money=(value)=>value===null||value===undefined?'—':'PKR '+Number(value).toLocaleString('en-PK');const when=(value)=>value?new Date(value).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'}):'—';async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}function hydrate(){const params=new URLSearchParams(location.search);tab=tabNames[params.get('tab')]?params.get('tab'):'all';page=Math.max(1,Number(params.get('page'))||1);for(const name of ['q','date','paymentStatus','fulfillment','archived','pageSize']){const value=params.get(name);if(value!==null&&filters.elements[name])filters.elements[name].value=value}}function params(){const result=new URLSearchParams(new FormData(filters));result.set('tab',tab);result.set('page',String(page));return result}function syncUrl(){history.replaceState(null,'',location.pathname+'?'+params().toString())}function badge(order){const value=order.paymentReviewState||order.paymentStatus||order.state;return '<span class="badge '+(value==='REVIEW'?'review':value==='APPROVED'||value==='PAID'?'paid':'')+'">'+esc(value)+'</span>'}function orderCard(order){return '<button class="order '+(order.id===selectedId?'active':'')+'" data-order-id="'+esc(order.id)+'" type="button"><span class="order-top"><span class="order-number">'+esc(order.orderNumber)+'</span>'+badge(order)+'</span><span class="customer">'+text(order.customerName)+'</span><span class="order-bottom"><span>'+esc(order.itemSummary||'No item summary')+'</span><strong>'+money(order.totalPayablePkr)+'</strong></span><span class="order-bottom"><span>'+esc(order.state)+(order.archivedAt?' · Archived':'')+'</span><time>'+esc(when(order.createdAt))+'</time></span></button>'}function setTabs(counts){for(const button of document.querySelectorAll('[data-tab]'))button.classList.toggle('active',button.dataset.tab===tab);for(const key of Object.keys(tabNames)){const node=document.querySelector('[data-count="'+key+'"]');if(node)node.textContent=Number(counts?.[key]||0).toLocaleString('en-PK')}document.querySelector('#queue-title').textContent=tabNames[tab]}function renderList(data){const list=data.orders||[];totalPages=data.pagination.totalPages;listStatus.textContent=Number(data.total).toLocaleString('en-PK')+' total';pageStatus.textContent='Page '+data.pagination.page+' of '+Math.max(1,totalPages);document.querySelector('#previous').disabled=data.pagination.page<=1;document.querySelector('#next').disabled=data.pagination.page>=totalPages;setTabs(data.counts);if(!list.length){ordersRoot.innerHTML='<div class="empty">No orders match this queue and filter set.</div>';selectedId='';detail.innerHTML='<div class="empty">No matching order to inspect.</div>';return null}if(!list.some((order)=>order.id===selectedId))selectedId=list[0].id;ordersRoot.innerHTML=list.map(orderCard).join('');for(const button of ordersRoot.querySelectorAll('[data-order-id]'))button.onclick=()=>show(button.dataset.orderId);return selectedId}async function mutate(path,body){return json(await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}))}function confirmAction(order,label){return confirm(label+' for '+order.orderNumber+'? This action is audited.')}function actionButton(label,handler,className){const button=document.createElement('button');button.type='button';button.textContent=label;if(className)button.className=className;button.onclick=async()=>{button.disabled=true;try{await handler()}catch(error){const status=detail.querySelector('.action-status');if(status){status.className='action-status error';status.textContent=error instanceof Error?error.message:'Request failed'}}finally{button.disabled=false}};return button}async function run(path,body){await mutate(path,body);await load()}function addActions(order){const root=detail.querySelector('.actions');if(!root||order.archivedAt)return;if(order.paymentId&&order.state==='PAYMENT_REVIEW'&&order.paymentReviewState==='REVIEW'&&order.receiptCount>0){root.append(actionButton('Approve payment',async()=>{if(confirmAction(order,'Approve the reviewed payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/approve',{orderId:order.id,confirmation:order.orderNumber})},'primary'));root.append(actionButton('Reject payment',async()=>{const reason=prompt('Rejection reason');if(reason&&confirmAction(order,'Reject the payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/reject',{orderId:order.id,reason,confirmation:order.orderNumber})},'danger'));root.append(actionButton('Request Clearer Receipt',async()=>{if(confirmAction(order,'Request a clearer receipt'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/request-clearer-receipt',{orderId:order.id,confirmation:order.orderNumber})}))}if(order.canConfirmOrder){root.append(actionButton('Confirm Order',async()=>{if(confirmAction(order,'Confirm Order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/confirm',{confirmation:order.orderNumber})},'primary'))}const next={PAID:['PACKING','Mark Packing'],PACKING:['DISPATCHED','Mark Dispatched'],DISPATCHED:['DELIVERED','Mark Delivered']}[order.state];if(next)root.append(actionButton(next[1],async()=>{if(confirmAction(order,next[1]))await run('/api/orders/'+encodeURIComponent(order.id)+'/transition',{from:order.state,to:next[0],confirmation:order.orderNumber})},'primary'));if(order.canPrintShippingLabel){root.append(actionButton('Print 4x6 Shipping Label',()=>{window.open('/api/orders/'+encodeURIComponent(order.id)+'/shipping-label?format=4x6','_blank','noopener,noreferrer')}));root.append(actionButton('Print A6 Shipping Label',()=>{window.open('/api/orders/'+encodeURIComponent(order.id)+'/shipping-label?format=A6','_blank','noopener,noreferrer')}))}if(['PAID','PACKING','DISPATCHED','DELIVERED'].includes(order.state)&&!order.trackingNumber){root.append(actionButton('Assign Tracking',async()=>{const value=prompt('Tracking number');if(value&&confirmAction(order,'Assign tracking number'))await run('/api/orders/'+encodeURIComponent(order.id)+'/tracking',{trackingNumber:value,confirmation:order.orderNumber})}))}if(order.trackingNumber){const tracking=document.createElement('span');tracking.className='badge';tracking.textContent='Tracking: '+order.trackingNumber;root.append(tracking)}if(order.canCancel)root.append(actionButton('Cancel order',async()=>{const reason=prompt('Cancellation reason');if(reason&&confirmAction(order,'Cancel order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/cancel',{reason,confirmation:order.orderNumber})},'danger'));if(order.canArchive)root.append(actionButton('Archive order',async()=>{const reason=prompt('Archive reason');if(reason&&confirmAction(order,'Archive order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/archive',{reason,confirmation:order.orderNumber})}));root.insertAdjacentHTML('beforeend','<p class="action-status muted" role="status"></p>')}function facts(entries){return '<dl class="facts">'+entries.map((entry)=>'<dt>'+esc(entry[0])+'</dt><dd>'+entry[1]+'</dd>').join('')+'</dl>'}function renderDetail(data){const order=data.order,items=data.items||[],receipts=data.receipts||[],audit=data.audit||[];const itemHtml=items.length?items.map((item)=>'<li>'+text(item.description)+' × '+text(item.quantity)+' <span class="muted">('+money(item.lineTotalPkr)+')</span></li>').join(''):'<li class="muted">No items recorded.</li>';const receiptHtml=receipts.length?receipts.map((receipt,index)=>'<li><a href="'+esc(receipt.previewUrl)+'" target="_blank" rel="noreferrer">Preview private receipt '+(index+1)+'</a> <small class="muted">'+text(receipt.mimeType)+' · '+esc(when(receipt.submittedAt))+'</small></li>').join(''):'<li class="muted">No receipts submitted.</li>';const auditHtml=audit.length?audit.map((entry)=>'<li><strong>'+text(entry.action)+'</strong> <small class="muted">'+esc(when(entry.created_at))+' · '+text(entry.actor_id||entry.actor_type)+'</small></li>').join(''):'<li class="muted">No audit entries.</li>';detail.innerHTML='<header class="detail-header"><div><h2>'+esc(order.orderNumber)+'</h2><span class="badge">'+esc(order.state)+'</span> '+badge(order)+(order.confirmedAt?' <span class="badge">Order confirmed</span>':'')+'</div><div class="amount"><span class="muted">Order total</span><strong>'+money(order.totalPayablePkr)+'</strong><small>'+esc(when(order.createdAt))+'</small></div></header><div class="grid"><section class="card"><h3>Customer & delivery</h3>'+facts([['Name',text(order.customerName)],['Contact',text(order.contactNumber)],['WhatsApp',text(order.whatsappNumber)],['Address',text(order.deliveryAddress)],['Landmark',text(order.landmark)],['City',text(order.city)],['Province',text(order.province)],['Tracking',text(order.trackingNumber)])+'</section><section class="card"><h3>Items</h3><ul class="items">'+itemHtml+'</ul><h3>Receipts</h3><ul>'+receiptHtml+'</ul></section><section class="card"><h3>Audit history</h3><ul>'+auditHtml+'</ul></section></div><div class="actions"></div>';addActions(order)}async function show(id){selectedId=id;detail.innerHTML='<div class="empty">Loading full order record...</div>';try{const data=await json(await fetch('/api/orders/'+encodeURIComponent(id),{cache:'no-store'}));if(selectedId===id)renderDetail(data)}catch(error){detail.innerHTML='<div class="empty error">'+esc(error instanceof Error?error.message:'Order unavailable')+'</div>'}}async function load(){listStatus.textContent='Loading...';const data=await json(await fetch('/api/orders?'+params().toString(),{cache:'no-store'}));const id=renderList(data);syncUrl();if(id)await show(id)}function fail(error){listStatus.className='error';listStatus.textContent=error instanceof Error?error.message:'Orders unavailable'}filters.onsubmit=(event)=>{event.preventDefault();page=1;load().catch(fail)};document.querySelector('#clear').onclick=()=>{filters.reset();tab='all';page=1;selectedId='';load().catch(fail)};document.querySelector('#refresh').onclick=()=>load().catch(fail);document.querySelector('#previous').onclick=()=>{if(page>1){page-=1;selectedId='';load().catch(fail)}};document.querySelector('#next').onclick=()=>{if(page<totalPages){page+=1;selectedId='';load().catch(fail)}};for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{tab=button.dataset.tab;page=1;selectedId='';load().catch(fail)};hydrate();setTabs({});load().catch(fail);
</script></body></html>`;
}

function professionalOrdersPageHtml(csrfToken: string): string {
  const csrf = JSON.stringify(csrfToken);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orders | Get Free Seeds</title>
<style>
:root{color-scheme:light;--ink:#17231c;--muted:#657269;--line:#dbe3dc;--paper:#fff;--green:#174d31;--danger:#a32929;--shadow:0 12px 32px rgba(23,35,28,.08)}*{box-sizing:border-box}body{margin:0;background:#edf2ed;color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}button,input,select{font:inherit}button{cursor:pointer}.shell{max-width:1500px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.eyebrow{color:var(--green);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.top h1{font-family:Georgia,serif;font-size:34px;line-height:1;margin:5px 0 7px}.top p{margin:0;color:var(--muted)}nav a{color:var(--green);text-decoration:none;font-weight:700}.refresh,.tab,.filters,.card,.detail{border:1px solid var(--line);background:var(--paper);border-radius:13px;box-shadow:var(--shadow)}.refresh{padding:9px 14px}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.tab{padding:15px;text-align:left}.tab span{display:block;color:var(--muted);font-size:12px;font-weight:700}.tab strong{display:block;margin-top:4px;color:var(--green);font:700 27px Georgia,serif}.tab.active{border-color:var(--green);background:var(--green);color:#fff}.tab.active span,.tab.active strong{color:#fff}.filters{display:grid;grid-template-columns:minmax(230px,2fr) repeat(4,minmax(130px,1fr)) auto auto;gap:9px;align-items:end;padding:13px;margin-bottom:14px}.filters label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}.filters input,.filters select{display:block;width:100%;margin-top:5px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px;color:var(--ink)}.apply,.primary{border:0;border-radius:8px;background:var(--green);color:#fff;padding:9px 14px}.clear{border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px 14px}.workspace{display:grid;grid-template-columns:minmax(360px,1fr) minmax(420px,1.35fr);gap:14px;min-height:520px}.master{min-width:0}.list-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.muted{color:var(--muted)}.error{color:var(--danger)}.orders{display:grid;grid-template-rows:minmax(280px,42vh);gap:8px;overflow:auto}.order{border:1px solid var(--line);border-radius:10px;background:#fff;text-align:left;padding:12px}.order.active{border-color:var(--green);box-shadow:0 0 0 2px #dcecdf}.order-top,.order-bottom{display:flex;justify-content:space-between;gap:10px}.order-number,.customer{font-weight:800}.customer{display:block;margin:6px 0}.order-bottom{color:var(--muted);font-size:12px}.badge{display:inline-block;border-radius:999px;background:#eef2ee;padding:3px 8px;font-size:11px;font-weight:800}.badge.review{background:#fff0d4}.badge.paid{background:#dcecdf;color:var(--green)}.pager{display:flex;justify-content:space-between;align-items:center;padding:10px 0}.pager button{border:1px solid var(--line);border-radius:8px;background:#fff;padding:7px 12px}.detail{padding:18px;min-width:0}.empty{display:grid;place-items:center;min-height:300px;color:var(--muted)}.detail-header{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--line);padding-bottom:12px}.detail-header h2{margin:0 0 5px;font-family:Georgia,serif}.amount{text-align:right}.amount strong{display:block;color:var(--green);font:700 24px Georgia,serif}.amount small{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.card{padding:14px;box-shadow:none}.card h3{margin:0 0 10px;font-size:14px}.facts{display:grid;grid-template-columns:130px 1fr;gap:5px 10px;margin:0}.facts dt{color:var(--muted)}.facts dd{margin:0;overflow-wrap:anywhere}.items,.receipts{margin:0;padding-left:20px}.item-line{display:flex;justify-content:space-between;gap:10px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.actions button{border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px 11px}.actions .primary{border-color:var(--green);background:var(--green)}.actions .danger{border-color:var(--danger);color:var(--danger)}.action-status{min-height:1.4em;width:100%;margin:0}.tracking{display:flex;gap:8px;margin-top:10px}.tracking input{min-width:0;flex:1;border:1px solid var(--line);border-radius:8px;padding:8px}.skeleton{padding:24px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}@media(max-width:900px){.filters{grid-template-columns:repeat(2,minmax(0,1fr))}.workspace{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}@media(max-width:560px){.shell{padding:14px}.tabs{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr}.top{align-items:flex-start}.top h1{font-size:28px}}
</style></head><body><main class="shell"><header class="top"><div><div class="eyebrow">Operations console</div><h1>Orders</h1><p>Payment review and fulfillment from one protected workspace.</p><nav><a href="/">Admin home</a> &nbsp;·&nbsp; <a href="/test-controls">Test controls</a></nav></div><button id="refresh" class="refresh" type="button">Refresh</button></header>
<section class="tabs" aria-label="Order queues"><button class="tab" data-tab="all" type="button"><span>All Orders</span><strong data-count="all">-</strong></button><button class="tab" data-tab="verify" type="button"><span>Verify Payments</span><strong data-count="verify">-</strong></button><button class="tab" data-tab="confirmed" type="button"><span>Confirmed Payments</span><strong data-count="confirmed">-</strong></button><button class="tab" data-tab="fulfillment" type="button"><span>Fulfillment</span><strong data-count="fulfillment">-</strong></button></section>
<form id="filters" class="filters"><label>Search<input name="q" type="search" autocomplete="off" placeholder="Order, customer, 03xx, +92, wa_id"></label><label>Order date<input name="date" type="date"></label><label>Payment<select name="paymentStatus"><option value="">Any payment</option><option value="PENDING">Pending</option><option value="REVIEW">In review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><label>Fulfillment<select name="fulfillment"><option value="">Any stage</option><option value="NOT_STARTED">Ready to pack</option><option value="PACKING">Packing</option><option value="DISPATCHED">Dispatched</option><option value="DELIVERED">Delivered</option><option value="CANCELLED">Cancelled</option></select></label><label>Archive<select name="archived"><option value="active">Active only</option><option value="all">Active + archived</option><option value="only">Archived only</option></select></label><label>Rows<select name="pageSize"><option>25</option><option>50</option><option>100</option></select></label><button class="apply" type="submit">Apply</button><button id="clear" class="clear" type="button">Clear</button></form>
<section class="workspace"><aside class="master"><div class="list-head"><strong id="queue-title">All Orders</strong><span id="list-status" class="muted" role="status" aria-live="polite">Loading orders...</span></div><div id="orders" class="orders"><div class="skeleton">Loading orders...</div></div><div class="pager"><button id="previous" type="button">Previous</button><span id="page-status" class="muted">Page 1</span><button id="next" type="button">Next</button></div></aside><article id="detail" class="detail"><div class="empty"><p>Select an order to inspect its full record.</p></div></article></section></main>
<script>
const csrf=${csrf};
const filters=document.querySelector('#filters'),ordersRoot=document.querySelector('#orders'),detail=document.querySelector('#detail'),listStatus=document.querySelector('#list-status'),pageStatus=document.querySelector('#page-status');
const tabNames={all:'All Orders',verify:'Verify Payments',confirmed:'Confirmed Payments',fulfillment:'Fulfillment'};let tab='all',page=1,totalPages=0,selectedId='',listController=null,detailController=null,listGeneration=0,detailGeneration=0;
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const text=(value)=>value===null||value===undefined||value===''?'-':esc(value);const money=(value)=>value===null||value===undefined?'-':'PKR '+Number(value).toLocaleString('en-PK');const when=(value)=>value?new Date(value).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'}):'-';
class RequestError extends Error{constructor(message,status=0,retryable=false){super(message);this.name='RequestError';this.status=status;this.retryable=retryable}}
function isAbort(error){return error instanceof RequestError&&error.message==='Request cancelled.'}
function retryableStatus(status){return status===408||status===429||status>=500}
async function readJson(response){const contentType=response.headers.get('content-type')||'';const body=await response.text();let data;try{data=body.trim()?JSON.parse(body):null}catch{throw new RequestError('Server returned a non-JSON response (HTTP '+response.status+').',response.status,false)}if(!response.ok){const message=data&&typeof data==='object'&&typeof data.error==='string'?data.error:'Request failed (HTTP '+response.status+').';throw new RequestError(message,response.status,retryableStatus(response.status))}if(!data||typeof data!=='object'||Array.isArray(data)){throw new RequestError(contentType.includes('json')?'Server returned an empty response.':'Server returned a non-JSON response (HTTP '+response.status+').',response.status,false)}return data}
function retryDelay(signal){return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{settled=true;if(signal)signal.removeEventListener('abort',cancel);resolve()},250);const cancel=()=>{if(settled)return;settled=true;clearTimeout(timer);if(signal)signal.removeEventListener('abort',cancel);reject(new RequestError('Request cancelled.'))};if(signal){if(signal.aborted)return cancel();signal.addEventListener('abort',cancel,{once:true})}})}
async function requestJson(path,options={},externalSignal,retry=true){let lastError;for(let attempt=0;attempt<2;attempt+=1){const controller=new AbortController();let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort()},12000);const cancel=()=>controller.abort();if(externalSignal){if(externalSignal.aborted)throw new RequestError('Request cancelled.');externalSignal.addEventListener('abort',cancel,{once:true})}try{const response=await fetch(path,{...options,signal:controller.signal});return await readJson(response)}catch(error){if(timedOut)lastError=new RequestError('Request timed out after 12 seconds.',0,true);else if(externalSignal&&externalSignal.aborted)lastError=new RequestError('Request cancelled.');else if(error instanceof RequestError)lastError=error;else lastError=new RequestError('Network request failed. Please try again.',0,true)}finally{clearTimeout(timeout);if(externalSignal)externalSignal.removeEventListener('abort',cancel)}if(!retry||attempt===1||!lastError.retryable)throw lastError;await retryDelay(externalSignal)}throw lastError||new RequestError('Request failed.')}
function hydrate(){const params=new URLSearchParams(location.search);tab=tabNames[params.get('tab')]?params.get('tab'):'all';page=Math.max(1,Number(params.get('page'))||1);for(const name of ['q','date','paymentStatus','fulfillment','archived','pageSize']){const value=params.get(name);if(value!==null&&filters.elements[name])filters.elements[name].value=value}}
function params(){const result=new URLSearchParams(new FormData(filters));result.set('tab',tab);result.set('page',String(page));return result}
function syncUrl(){history.replaceState(null,'',location.pathname+'?'+params().toString())}
function setTabs(counts){for(const button of document.querySelectorAll('[data-tab]'))button.classList.toggle('active',button.dataset.tab===tab);for(const key of Object.keys(tabNames)){const node=document.querySelector('[data-count="'+key+'"]');if(node)node.textContent=Number(counts&&counts[key]||0).toLocaleString('en-PK')}document.querySelector('#queue-title').textContent=tabNames[tab]}
function badge(order){const value=order.paymentReviewState||order.paymentStatus||order.state;return '<span class="badge '+(value==='REVIEW'?'review':value==='APPROVED'||value==='PAID'?'paid':'')+'">'+esc(value)+'</span>'}
function orderCard(order){return '<button class="order '+(order.id===selectedId?'active':'')+'" data-order-id="'+esc(order.id)+'" type="button"><span class="order-top"><span class="order-number">'+esc(order.orderNumber)+'</span>'+badge(order)+'</span><span class="customer">'+text(order.customerName)+'</span><span class="order-bottom"><span>'+esc(order.itemSummary||'No item summary')+'</span><strong>'+money(order.totalPayablePkr)+'</strong></span><span class="order-bottom"><span>'+esc(order.state)+(order.archivedAt?' · Archived':'')+'</span><time>'+esc(when(order.createdAt))+'</time></span></button>'}
function renderList(data){const list=data.orders||[];totalPages=data.pagination.totalPages;listStatus.textContent=Number(data.total).toLocaleString('en-PK')+' total';pageStatus.textContent='Page '+data.pagination.page+' of '+Math.max(1,totalPages);document.querySelector('#previous').disabled=data.pagination.page<=1;document.querySelector('#next').disabled=data.pagination.page>=totalPages;setTabs(data.counts);if(!list.length){ordersRoot.innerHTML='<div class="skeleton">No orders match this queue and filter set.</div>';selectedId='';detail.innerHTML='<div class="empty"><p>No matching order to inspect.</p></div>';return null}if(!list.some((order)=>order.id===selectedId))selectedId=list[0].id;ordersRoot.innerHTML=list.map(orderCard).join('');for(const button of ordersRoot.querySelectorAll('[data-order-id]'))button.onclick=()=>show(button.dataset.orderId);return selectedId}
async function load(){const generation=++listGeneration;if(listController)listController.abort();listController=new AbortController();const controller=listController;listStatus.className='muted';listStatus.textContent='Loading orders...';ordersRoot.innerHTML='<div class="skeleton">Loading orders...</div>';try{const data=await requestJson('/api/orders?'+params().toString(),{cache:'no-store'},controller.signal,true);if(generation!==listGeneration)return;const id=renderList(data);syncUrl();if(id)await show(id)}catch(error){if(generation!==listGeneration||isAbort(error))return;fail(error)}}
function facts(entries){return '<dl class="facts">'+entries.map((entry)=>'<dt>'+esc(entry[0])+'</dt><dd>'+entry[1]+'</dd>').join('')+'</dl>'}
 function actionButton(label,handler,className){const button=document.createElement('button');button.type='button';button.className=className||'';button.textContent=label==='Request clearer receipt'?'Request Clearer Receipt':label;const held=document.querySelector('.detail-header h2')?.textContent.trim()==='FS-261019-000001';if(held){button.disabled=true;button.title='Fulfillment held pending independent settlement verification and transaction reference.';const actions=detail.querySelector('.actions');if(actions&&!detail.querySelector('.fulfillment-hold'))actions.insertAdjacentHTML('beforebegin','<p class="error fulfillment-hold" role="alert">Fulfillment is on hold pending independent bank settlement verification and the customer transaction reference.</p>');return button}button.onclick=async()=>{button.disabled=true;try{await handler()}catch(error){showActionError(error)}finally{button.disabled=false}};return button}
function showActionError(error){const node=detail.querySelector('.action-status');if(node){node.className='action-status error';node.textContent=error instanceof Error?error.message:'Request failed'}}
const createOperationalActions=addActions;addActions=(order)=>{createOperationalActions(order);const root=detail.querySelector('.actions');if(!root||order.archivedAt)return;if(order.canPrintShippingLabel)root.append(actionButton('Print A6 Shipping Label',()=>{window.open('/api/orders/'+encodeURIComponent(order.id)+'/shipping-label?format=A6','_blank','noopener')}));if(['PAID','PACKING','DISPATCHED','DELIVERED'].includes(order.state)&&!order.trackingNumber)root.append(actionButton('Assign Tracking',async()=>{const value=prompt('Tracking number');if(value&&confirmAction(order,'Assign tracking number'))await run('/api/orders/'+encodeURIComponent(order.id)+'/tracking',{trackingNumber:value,confirmation:order.orderNumber})}))};
async function mutate(path,body){return requestJson(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)},undefined,false)}
async function run(path,body){await mutate(path,body);await load()}
function confirmAction(order,label){return confirm(label+' for '+order.orderNumber+'? This action is audited.')}
function addActions(order){const root=detail.querySelector('.actions');if(!root||order.archivedAt)return;if(order.paymentId&&order.state==='PAYMENT_REVIEW'&&order.paymentReviewState==='REVIEW'&&order.receiptCount>0){root.append(actionButton('Approve payment',async()=>{if(confirmAction(order,'Approve the reviewed payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/approve',{orderId:order.id,confirmation:order.orderNumber})},'primary'));root.append(actionButton('Reject payment',async()=>{const reason=prompt('Rejection reason');if(reason&&confirmAction(order,'Reject the payment'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/reject',{orderId:order.id,reason,confirmation:order.orderNumber})},'danger'));root.append(actionButton('Request clearer receipt',async()=>{if(confirmAction(order,'Request a clearer receipt'))await run('/api/payments/'+encodeURIComponent(order.paymentId)+'/request-clearer-receipt',{orderId:order.id,confirmation:order.orderNumber})}))}const next={PAID:['PACKING','Mark Packing'],PACKING:['DISPATCHED','Mark Dispatched'],DISPATCHED:['DELIVERED','Mark Delivered']}[order.state];if(next)root.append(actionButton(next[1],async()=>{if(confirmAction(order,next[1]))await run('/api/orders/'+encodeURIComponent(order.id)+'/transition',{from:order.state,to:next[0],confirmation:order.orderNumber})},'primary'));if(order.canConfirmOrder)root.append(actionButton('Confirm Order',async()=>{if(confirmAction(order,'Confirm Order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/confirm',{confirmation:order.orderNumber})},'primary'));if(order.canCancel)root.append(actionButton('Cancel order',async()=>{const reason=prompt('Cancellation reason');if(reason&&confirmAction(order,'Cancel order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/cancel',{reason,confirmation:order.orderNumber})},'danger'));if(order.canArchive)root.append(actionButton('Archive order',async()=>{const reason=prompt('Archive reason');if(reason&&confirmAction(order,'Archive order'))await run('/api/orders/'+encodeURIComponent(order.id)+'/archive',{reason,confirmation:order.orderNumber})}));if(order.canPrintShippingLabel)root.append(actionButton('Print shipping label',()=>{window.open('/api/orders/'+encodeURIComponent(order.id)+'/shipping-label?format=4x6','_blank','noopener') }));root.insertAdjacentHTML('beforeend','<p class="action-status muted" role="status"></p>')}
function renderDetail(data){const order=data.order,items=data.items||order.items||[],receipts=data.receipts||order.receipts||[],audit=data.audit||[];const itemHtml=items.length?items.map((item)=>'<li><div class="item-line"><span><strong>'+text(item.description)+'</strong> x '+text(item.quantity)+'</span><span>'+money(item.lineTotalPkr)+'</span></div><small class="muted">'+text(item.productCode)+' - '+money(item.unitPricePkr)+' each</small></li>').join(''):'<li class="muted">No items recorded.</li>';const receiptHtml=receipts.length?receipts.map((receipt,index)=>'<li><a href="'+esc(receipt.previewUrl)+'" target="_blank" rel="noreferrer">Preview private receipt '+(index+1)+'</a><br><small class="muted">'+text(receipt.mimeType)+' - '+Number(receipt.sizeBytes||0).toLocaleString('en-PK')+' bytes - '+esc(when(receipt.submittedAt))+'</small></li>').join(''):'<li class="muted">No receipts submitted.</li>';const auditHtml=audit.length?audit.map((entry)=>'<li><strong>'+text(entry.action)+'</strong><br><small class="muted">'+esc(when(entry.created_at))+' - '+text(entry.actor_id||entry.actor_type)+'</small></li>').join(''):'<li class="muted">No audit entries.</li>';detail.innerHTML='<header class="detail-header"><div><h2>'+esc(order.orderNumber)+'</h2><span class="badge">'+esc(order.state)+'</span> '+badge(order)+(order.archivedAt?' <span class="badge">Archived</span>':'')+'</div><div class="amount"><span class="muted">Order total</span><strong>'+money(order.totalPayablePkr)+'</strong><small>'+esc(when(order.createdAt))+'</small></div></header><div class="grid"><section class="card"><h3>Customer & delivery</h3>'+facts([['Name',text(order.customerName)],['Phone',text(order.contactNumber)],['Normalized phone',text(order.normalizedContactNumber)],['WhatsApp',text(order.whatsappNumber)],['Meta wa_id',text(order.waId)],['Address',text(order.deliveryAddress)],['Landmark',text(order.landmark)],['City',text(order.city)],['Province',text(order.province)]])+'</section><section class="card"><h3>Payment</h3>'+facts([['Status',text(order.paymentReviewState||order.paymentStatus)],['Method',text(order.paymentMethod)],['Expected',money(order.expectedAmountPkr)],['Approved',money(order.approvedAmountPkr)],['Reference',text(order.customerTransactionReference)],['Reviewed by',text(order.paymentReviewedBy)],['Submitted',text(when(order.paymentSubmittedAt))]])+'</section><section class="card"><h3>Items</h3><ul class="items">'+itemHtml+'</ul></section><section class="card"><h3>Receipts</h3><ul class="receipts">'+receiptHtml+'</ul></section><section class="card"><h3>Audit trail</h3><ul class="receipts">'+auditHtml+'</ul></section></div><div class="actions"></div>';addActions(order)}
async function show(id){selectedId=id;const generation=++detailGeneration;if(detailController)detailController.abort();detailController=new AbortController();const controller=detailController;for(const node of ordersRoot.querySelectorAll('[data-order-id]'))node.classList.toggle('active',node.dataset.orderId===id);detail.innerHTML='<div class="skeleton">Loading full order record...</div>';try{const data=await requestJson('/api/orders/'+encodeURIComponent(id),{cache:'no-store'},controller.signal,true);if(generation===detailGeneration&&selectedId===id)renderDetail(data)}catch(error){if(generation!==detailGeneration||isAbort(error))return;if(generation===detailGeneration)detail.innerHTML='<div class="empty error"><p>'+esc(error instanceof Error?error.message:'Order unavailable')+'</p></div>'}}
function fail(error){listStatus.className='error';listStatus.textContent=error instanceof Error?error.message:'Orders unavailable';ordersRoot.innerHTML='<div class="skeleton error">Orders could not be loaded. Use Refresh to try again.</div>';document.querySelector('#previous').disabled=true;document.querySelector('#next').disabled=true}
filters.onsubmit=(event)=>{event.preventDefault();page=1;load()};document.querySelector('#clear').onclick=()=>{filters.reset();tab='all';page=1;selectedId='';load()};document.querySelector('#refresh').onclick=()=>load();document.querySelector('#previous').onclick=()=>{if(page>1){page-=1;selectedId='';load()}};document.querySelector('#next').onclick=()=>{if(page<totalPages){page+=1;selectedId='';load()}};for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{tab=button.dataset.tab;page=1;selectedId='';load()};
hydrate();setTabs({});load();
</script></body></html>`;
}

function testControlsPageHtml(csrfToken: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test Controls | Get Free Seeds</title><style>body{font:15px system-ui;max-width:960px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}.card{border:1px solid #ccd5cc;border-radius:8px;padding:1rem}input,button{font:inherit;padding:.5rem}.row{display:flex;gap:.5rem;margin:.5rem 0}.row input{flex:1}pre{white-space:pre-wrap;background:#f5f7f5;padding:1rem;min-height:5rem}.error{color:#a40019}</style></head><body><nav><a href="/">Admin home</a> | <a href="/orders">Orders</a></nav><h1>Test controls</h1><p>Conversation reset affects only the selected state row. Orders, payments, receipts, cooldown locks, and audit history are retained.</p><div class="grid"><section class="card"><h2>Conversation</h2><form id="lookup" class="row"><input name="waId" inputmode="numeric" pattern="[0-9]{7,20}" placeholder="Meta wa_id" required><button>Load</button></form><pre id="conversation">Select a conversation.</pre><button id="reset" disabled>Reset selected conversation to NEW</button></section><section class="card"><h2>Cooldown exemptions</h2><form id="add" class="row"><input name="waId" inputmode="numeric" pattern="[0-9]{7,20}" placeholder="Meta wa_id" required><button>Add</button></form><div id="exemptions">Loading...</div></section></div><p id="result"></p><script>
const csrf=${JSON.stringify(csrfToken)};let selected='';const conversation=document.querySelector('#conversation');const result=document.querySelector('#result');const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}async function request(path,method,body){return json(await fetch(path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}))}
async function show(waId){const data=await json(await fetch('/api/test-controls/conversations/'+encodeURIComponent(waId)));selected=waId;document.querySelector('#reset').disabled=false;conversation.textContent=JSON.stringify(data,null,2)}
async function loadExemptions(){const data=await json(await fetch('/api/test-controls/cooldown-exemptions'));document.querySelector('#exemptions').innerHTML=data.exemptions.map((e)=>'<div>'+esc(e.waId)+' <button data-remove="'+esc(e.waId)+'">Remove</button></div>').join('')||'No exemptions.';for(const button of document.querySelectorAll('[data-remove]'))button.onclick=async()=>{const waId=button.dataset.remove;if(!confirm('Remove cooldown exemption for '+waId+'?'))return;await request('/api/test-controls/cooldown-exemptions/'+waId,'DELETE',{confirmation:waId});await loadExemptions();if(selected===waId)await show(waId)}}
document.querySelector('#lookup').onsubmit=async(event)=>{event.preventDefault();try{await show(new FormData(event.currentTarget).get('waId'))}catch(error){conversation.textContent=error.message}};document.querySelector('#reset').onclick=async()=>{if(!selected||!confirm('Reset only conversation '+selected+' to NEW?'))return;try{await request('/api/test-controls/conversations/'+selected+'/reset','POST',{confirmation:selected});await show(selected);result.textContent='Conversation reset; order and payment history retained.'}catch(error){result.textContent=error.message;result.className='error'}};document.querySelector('#add').onsubmit=async(event)=>{event.preventDefault();const waId=String(new FormData(event.currentTarget).get('waId')||'');if(!confirm('Add cooldown exemption for '+waId+'?'))return;try{await request('/api/test-controls/cooldown-exemptions','POST',{waId,confirmation:waId});event.currentTarget.reset();await loadExemptions()}catch(error){result.textContent=error.message;result.className='error'}};loadExemptions().catch((error)=>{result.textContent=error.message});
</script></body></html>`;
}

function whatsappContentPageHtml(csrfToken: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Content | Get Free Seeds</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem}.card{border:1px solid #ccd5cc;border-radius:8px;padding:1rem}label{display:block;margin:.55rem 0}input,textarea,button{box-sizing:border-box;width:100%;font:inherit;padding:.45rem}textarea{min-height:4rem}.row{display:flex;gap:.5rem}.row button{width:auto}.muted{color:#59635a}.error{color:#a40019}</style></head><body><nav><a href="/">Admin home</a> | <a href="/payment-settings">Payment Settings</a></nav><h1>WhatsApp Content</h1><p class="muted">Draft, publish, and rollback versioned EN/UR content. Media references must be private R2 keys under <code>whatsapp-content/</code>; public URLs are rejected.</p><div id="content" class="grid">Loading...</div><script>
const csrf=${JSON.stringify(csrfToken)};const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function request(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
function field(name,label,value,area=false){return '<label>'+label+(area?'<textarea name="'+name+'">'+esc(value)+'</textarea>':'<input name="'+name+'" value="'+esc(value)+'">')+'</label>'}
function card(t){const en=t.published?.contentEn||t.draft?.contentEn||{};const ur=t.published?.contentUr||t.draft?.contentUr||{};return '<section class="card" data-key="'+esc(t.templateKey)+'"><h2>'+esc(t.templateKey)+'</h2><p class="muted">Published: '+esc(t.publishedVersion??'none')+' | Draft: '+esc(t.draftVersion??'none')+'</p><h3>English</h3>'+field('enText','Text',en.text,true)+field('enButton','Button label',en.buttonLabel)+field('enListButton','List button label',en.listButtonLabel)+field('enListDescription','List description',en.listDescription)+'<h3>اردو</h3>'+field('urText','Text',ur.text,true)+field('urButton','Button label',ur.buttonLabel)+field('urListButton','List button label',ur.listButtonLabel)+field('urListDescription','List description',ur.listDescription)+field('mediaR2Key','Private R2 media key',t.published?.mediaR2Key||t.draft?.mediaR2Key||'')+'<div class="row"><button data-draft>Save draft</button><button data-publish '+(t.draftVersion?'':'disabled')+'>Publish draft</button></div><p data-result></p><details><summary>Rollback</summary><div class="row"><input data-version type="number" min="1" placeholder="Version"><button data-rollback>Rollback</button></div></details></section>'}
function values(card,prefix){return {text:card.querySelector('[name="'+prefix+'Text"]').value,buttonLabel:card.querySelector('[name="'+prefix+'Button"]').value||undefined,listButtonLabel:card.querySelector('[name="'+prefix+'ListButton"]').value||undefined,listDescription:card.querySelector('[name="'+prefix+'ListDescription"]').value||undefined}}
async function load(){const data=await fetch('/api/whatsapp-content').then((r)=>r.json());const root=document.querySelector('#content');root.innerHTML=(data.templates||[]).map(card).join('');for(const node of root.querySelectorAll('[data-key]')){const key=node.dataset.key;const result=node.querySelector('[data-result]');node.querySelector('[data-draft]').onclick=async()=>{try{const body={confirmation:key,contentEn:values(node,'en'),contentUr:values(node,'ur'),mediaR2Key:node.querySelector('[name="mediaR2Key"]').value||undefined};const saved=await request('/api/whatsapp-content/'+key+'/draft',body);result.textContent='Draft version '+saved.version+' saved.';await load()}catch(error){result.className='error';result.textContent=error.message}};node.querySelector('[data-publish]').onclick=async()=>{const version=node.querySelector('[data-version]').value||node.querySelector('p').textContent.match(/Draft: (\\d+)/)?.[1];if(!version||!confirm('Publish '+key+' version '+version+'?'))return;try{await request('/api/whatsapp-content/'+key+'/publish',{version:Number(version),confirmation:key+':'+version});await load()}catch(error){result.className='error';result.textContent=error.message}};node.querySelector('[data-rollback]').onclick=async()=>{const version=node.querySelector('[data-version]').value;if(!version||!confirm('Rollback '+key+' to version '+version+'?'))return;try{await request('/api/whatsapp-content/'+key+'/rollback',{version:Number(version),confirmation:key+':'+version});await load()}catch(error){result.className='error';result.textContent=error.message}}}}
load().catch(()=>document.querySelector('#content').textContent='WhatsApp content unavailable');</script></body></html>`;
}

function whatsappContentJourneyPageHtml(csrfToken: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Content | Get Free Seeds</title><style>:root{color-scheme:light;--ink:#172018;--leaf:#245b38;--line:#ccd5cc;--wash:#f4f7f4;--danger:#a40019}body{font:15px system-ui;max-width:1240px;margin:2rem auto;padding:0 1rem;color:var(--ink)}nav{margin-bottom:1rem}.journey{margin:2.5rem 0}.journey>h2{border-bottom:2px solid var(--leaf);padding-bottom:.35rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:1rem}.card{border:1px solid var(--line);border-radius:10px;padding:1rem;background:#fff}.langs{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.lang{border:1px solid #e1e7e1;padding:.7rem;border-radius:7px}.preview{white-space:pre-wrap;min-height:2.5rem;background:var(--wash);padding:.6rem}.row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}.row button{width:auto}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.65rem;margin:.75rem 0}.media{border:1px solid var(--line);border-radius:7px;padding:.45rem}.media.active{outline:3px solid #5a9b70}.media.disabled{opacity:.55}.media img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--wash);border-radius:4px}.media small{display:block;overflow-wrap:anywhere}.media .row{gap:.25rem}.media button{font-size:.8rem;padding:.35rem}.badge{display:inline-block;background:var(--wash);padding:.15rem .4rem;border-radius:999px;margin:.3rem .2rem .3rem 0}label{display:block;margin:.45rem 0}input,textarea,button{box-sizing:border-box;width:100%;font:inherit;padding:.45rem}textarea{min-height:4rem}.muted{color:#59635a}.error{color:var(--danger)}.ok{color:#176b36}@media(max-width:760px){.langs{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}</style></head><body><nav><a href="/">Admin home</a> | <a href="/payment-settings">Payment Settings</a></nav><h1>WhatsApp Content</h1><p class="muted">Each journey screen has a private image gallery. Masters are retained; the browser creates a WhatsApp-sized JPEG variant before upload. Gallery changes become customer-visible only when a draft is published.</p><div id="content">Loading...</div><script>
const csrf=${JSON.stringify(csrfToken)};const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(n,l,v,a=false)=>'<label>'+l+(a?'<textarea name="'+n+'">'+esc(v||'')+'</textarea>':'<input name="'+n+'" value="'+esc(v||'')+'">')+'</label>';
const provinceNames=['Punjab','Islamabad','Sindh','KPK','Balochistan','AJK','Gilgit Baltistan'];const listPreview=(value)=>value.listButtonLabel?'<div><button type="button" disabled>'+esc(value.listButtonLabel)+'</button><ul>'+provinceNames.map((province)=>'<li><strong>'+esc(province)+'</strong><br><small>'+esc(value.listDescription||'')+'</small></li>').join('')+'</ul></div>':'';
const language=(p,title,v,rtl,actionIds)=>{const actions=(actionIds||[]).map((id)=>'<button type="button" disabled title="'+esc(id)+'">'+esc(v.actionLabels&&v.actionLabels[id]||'')+'</button>').join('');return '<div class="lang"'+(rtl?' dir="rtl"':'')+'><h3>'+title+'</h3>'+field(p+'Text','Text',v.text,true)+field(p+'Button','Legacy button label',v.buttonLabel)+field(p+'ListButton','Province list title',v.listButtonLabel)+field(p+'ListDescription','Province list description',v.listDescription)+(actionIds||[]).map((id)=>field(p+'Action'+id,'Action '+id,v.actionLabels&&v.actionLabels[id])).join('')+'<strong>Actual WhatsApp preview</strong><div class="preview" data-preview="'+p+'"><div>'+esc(v.text||'')+'</div><div class="row">'+actions+listPreview(v)+'</div></div></div>'};
function mediaCard(m){return '<article class="media '+(m.active?'active ':'')+(m.enabled?'':'disabled')+'" data-media-id="'+esc(m.id)+'"><img src="'+esc(m.previewUrl)+'" alt="Private content preview" loading="lazy"><span class="badge">'+(m.active?'Active':m.enabled?'Rotation':'Disabled')+'</span><small>'+esc(m.mimeType)+' · '+Math.ceil(m.sizeBytes/1024)+' KiB</small><small title="'+esc(m.sha256)+'">SHA-256 '+esc(m.sha256.slice(0,12))+'…</small><div class="row"><button type="button" data-up title="Move earlier">↑</button><button type="button" data-down title="Move later">↓</button></div><button type="button" data-active>'+(m.active?'Use rotation':'Set active')+'</button><button type="button" data-enabled>'+(m.enabled?'Disable':'Enable')+'</button><button type="button" data-remove>Remove</button></article>'}
function card(t){const en=t.draft?.contentEn||t.published?.contentEn||{};const ur=t.draft?.contentUr||t.published?.contentUr||{};return '<section class="card" data-key="'+esc(t.templateKey)+'" data-action-ids="'+esc((t.actionIds||[]).join(','))+'"><h3>'+esc(t.templateKey)+'</h3><p class="muted">Published '+esc(t.publishedVersion??'none')+' | Draft '+esc(t.draftVersion??'none')+'</p><div class="langs">'+language('en','English',en,false,t.actionIds)+language('ur','اردو',ur,true,t.actionIds)+'</div><h4>Image gallery</h4><div class="gallery">'+(t.media||[]).map(mediaCard).join('')+'</div><label>Upload one or more masters<input name="mediaFiles" data-media type="file" multiple accept="image/png,image/jpeg,image/webp"></label><div class="row"><button type="button" data-upload>Optimize and upload</button><button type="button" data-save>Save draft</button><button type="button" data-publish>Publish draft + gallery</button></div><p data-result role="status"></p><details><summary>Rollback</summary><div class="row"><input name="rollbackVersion" data-version type="number" min="1" placeholder="Version"><button type="button" data-rollback>Rollback</button></div></details></section>'}
function copy(node,p){const actionLabels={};for(const id of (node.dataset.actionIds||'').split(',').filter(Boolean))actionLabels[id]=node.querySelector('[name="'+p+'Action'+id+'"]').value;return {text:node.querySelector('[name="'+p+'Text"]').value,buttonLabel:node.querySelector('[name="'+p+'Button"]').value||undefined,listButtonLabel:node.querySelector('[name="'+p+'ListButton"]').value||undefined,listDescription:node.querySelector('[name="'+p+'ListDescription"]').value||undefined,...(Object.keys(actionLabels).length?{actionLabels}:{})}}
function renderContentPreview(node,p){const value=copy(node,p);const buttons=Object.entries(value.actionLabels||{}).map(([id,label])=>'<button type="button" disabled title="'+esc(id)+'">'+esc(label)+'</button>').join('');node.querySelector('[data-preview="'+p+'"]').innerHTML='<div>'+esc(value.text)+'</div><div class="row">'+buttons+listPreview(value)+'</div>'}
async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}async function post(path,body){return json(await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}))}
async function optimized(file){if(file.size>10*1024*1024)throw new Error('Master exceeds 10 MiB.');const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>5*1024*1024)throw new Error('Could not create a WhatsApp image under 5 MiB.');return blob}
async function upload(key,file){const variant=await optimized(file);const form=new FormData();form.append('master',file,file.name);form.append('variant',variant,'whatsapp.jpg');return json(await fetch('/api/whatsapp-content/'+encodeURIComponent(key)+'/media',{method:'POST',headers:{'X-CSRF-Token':csrf},body:form}))}
async function reorder(key,gallery){const ids=[...gallery.querySelectorAll('[data-media-id]')].map((item)=>item.dataset.mediaId);await post('/api/whatsapp-content/'+encodeURIComponent(key)+'/media/order',{ids})}
async function load(){const data=await json(await fetch('/api/whatsapp-content'));const groups={};for(const t of data.templates||[])(groups[t.section||'Other']??=[]).push(t);const root=document.querySelector('#content');root.innerHTML=Object.entries(groups).map(([s,ts])=>'<section class="journey"><h2>'+esc(s)+'</h2><div class="grid">'+ts.map(card).join('')+'</div></section>').join('');for(const node of root.querySelectorAll('[data-key]')){const key=node.dataset.key;const result=node.querySelector('[data-result]');const show=(message,error=false)=>{result.className=error?'error':'ok';result.textContent=message};for(const input of node.querySelectorAll('[name^="en"],[name^="ur"]'))input.oninput=()=>node.querySelector('[data-preview="'+input.name.slice(0,2)+'"]').textContent=node.querySelector('[name="'+input.name.slice(0,2)+'Text"]').value;node.querySelector('[data-upload]').onclick=async()=>{try{const files=[...node.querySelector('[data-media]').files];if(!files.length)throw new Error('Choose PNG, JPEG, or WebP images.');for(let index=0;index<files.length;index+=1){show('Optimizing and uploading '+(index+1)+' of '+files.length+'…');await upload(key,files[index])}await load()}catch(error){show(error.message,true)}};for(const media of node.querySelectorAll('[data-media-id]')){const id=media.dataset.mediaId;media.querySelector('[data-active]').onclick=async()=>{try{await post('/api/whatsapp-content/'+key+'/media/'+id+'/active',{active:!media.classList.contains('active')});await load()}catch(error){show(error.message,true)}};media.querySelector('[data-enabled]').onclick=async()=>{try{await post('/api/whatsapp-content/'+key+'/media/'+id+'/enabled',{enabled:media.classList.contains('disabled')});await load()}catch(error){show(error.message,true)}};media.querySelector('[data-remove]').onclick=async()=>{if(!confirm('Remove this image? Published or session-referenced images will only be disabled.'))return;try{const d=await json(await fetch('/api/whatsapp-content/'+key+'/media/'+id,{method:'DELETE',headers:{'X-CSRF-Token':csrf}}));if(d.softDisabled)alert('This image is referenced and was safely disabled instead of deleted.');await load()}catch(error){show(error.message,true)}};media.querySelector('[data-up]').onclick=async()=>{const previous=media.previousElementSibling;if(!previous)return;media.parentNode.insertBefore(media,previous);try{await reorder(key,media.parentNode);await load()}catch(error){show(error.message,true)}};media.querySelector('[data-down]').onclick=async()=>{const next=media.nextElementSibling;if(!next)return;media.parentNode.insertBefore(next,media);try{await reorder(key,media.parentNode);await load()}catch(error){show(error.message,true)}}}node.querySelector('[data-save]').onclick=async()=>{try{const d=await post('/api/whatsapp-content/'+key+'/draft',{confirmation:key,contentEn:copy(node,'en'),contentUr:copy(node,'ur')});show('Draft '+d.version+' saved.');await load()}catch(error){show(error.message,true)}};node.querySelector('[data-publish]').onclick=async()=>{const v=String((data.templates||[]).find((t)=>t.templateKey===key)?.draftVersion||'');if(!v||!confirm('Publish '+key+' v'+v+' and its enabled gallery?'))return;try{await post('/api/whatsapp-content/'+key+'/publish',{version:Number(v),confirmation:key+':'+v});await load()}catch(error){show(error.message,true)}};node.querySelector('[data-rollback]').onclick=async()=>{const v=node.querySelector('[data-version]').value;if(!v||!confirm('Rollback '+key+' to v'+v+'?'))return;try{await post('/api/whatsapp-content/'+key+'/rollback',{version:Number(v),confirmation:key+':'+v});await load()}catch(error){show(error.message,true)}}}}
document.querySelector('#content').addEventListener('input',(event)=>{const node=event.target.closest('[data-key]');if(node&&/^(en|ur)/.test(event.target.name||''))renderContentPreview(node,event.target.name.slice(0,2))});load().catch((error)=>document.querySelector('#content').textContent=error.message||'WhatsApp content unavailable');</script></body></html>`;
}

function legacyPaymentSettingsPreviewPageHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Settings | Get Free Seeds</title><style>
body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:1rem}.card{border:1px solid #ccd5cc;border-radius:8px;padding:1rem}.cols{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.preview{white-space:pre-wrap;background:#f4f7f4;padding:.6rem;min-height:3rem}.qr{max-width:180px;max-height:180px;display:block;margin-top:.5rem}.error{color:#a40019}.ok{color:#176b36}.muted{color:#59635a}label{display:block;margin:.45rem 0}input,textarea,button{box-sizing:border-box;width:100%;font:inherit;padding:.45rem}textarea{min-height:4rem}.actions{display:flex;gap:.5rem;align-items:center}.actions button{width:auto}@media(max-width:700px){.cols{grid-template-columns:1fr}}</style></head><body><nav><a href="/">Admin home</a></nav><h1>Garden Shop Payment Settings</h1><p>Recipient values are protected Admin data. Only complete enabled methods can be used for customer payment requests.</p><div id="methods" class="grid">Loading...</div><script>
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=(m)=>m==='BANK_TRANSFER'?'Bank Transfer':m==='EASYPAISA'?'Easypaisa':'JazzCash';
const input=(k,l,v,a=false)=>'<label>'+l+(a?'<textarea data-key="'+k+'">'+esc(v||'')+'</textarea>':'<input data-key="'+k+'" value="'+esc(v||'')+'">')+'</label>';
function card(m){const qr=m.qrR2Key?'<img class="qr" data-preview-qr alt="Private QR preview" src="/api/payment-methods/'+encodeURIComponent(m.method)+'/qr">':'<p class="muted" data-qr-status>No QR configured.</p>';return '<section class="card" data-method="'+m.method+'"><h2>'+name(m.method)+'</h2><p>'+(m.enabled&&m.recipientName&&m.instructions?'Enabled and complete':'Safe draft or incomplete')+'</p>'+input('recipientName','Recipient name',m.recipientName)+input('tillId','TILL/TIL/account identifier',m.tillId)+input('instructions','Payment instructions',m.instructions,true)+input('referenceInstruction','Reference instruction',m.referenceInstruction)+'<label>Sort order<input data-key="sortOrder" type="number" min="0" step="1" value="'+(Number.isFinite(Number(m.sortOrder))?Number(m.sortOrder):100)+'"></label><label><input data-key="enabled" type="checkbox" '+(m.enabled?'checked':'')+'> Enabled after Garden Shop verification</label><div class="cols"><div><h3>English copy</h3>'+input('heading','Heading',m.heading)+input('qrCaption','QR caption',m.qrCaption)+input('shortInstructions','Short instructions',m.shortInstructions,true)+input('receiptInstructions','Receipt instructions',m.receiptInstructions,true)+input('paymentHelpCopy','Payment help',m.paymentHelpCopy,true)+input('statusCopy','Status copy',m.statusCopy,true)+'<h3>English preview</h3><div class="preview" data-preview="en"></div></div><div dir="rtl"><h3>اردو copy</h3>'+input('headingUr','عنوان',m.headingUr)+input('qrCaptionUr','QR caption',m.qrCaptionUr)+input('shortInstructionsUr','مختصر ہدایات',m.shortInstructionsUr,true)+input('receiptInstructionsUr','رسید ہدایات',m.receiptInstructionsUr,true)+input('paymentHelpCopyUr','ادائیگی مدد',m.paymentHelpCopyUr,true)+input('statusCopyUr','اسٹیٹس متن',m.statusCopyUr,true)+'<h3>اردو preview</h3><div class="preview" data-preview="ur"></div></div></div><h3>Private QR</h3>'+qr+'<div class="actions"><input data-qr type="file" accept="image/png,image/jpeg,image/webp"><button type="button" data-upload>Upload QR</button><button type="button" data-save>Save</button></div><p data-result></p></section>'}
function values(node){const body={};for(const e of node.querySelectorAll('[data-key]'))body[e.dataset.key]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;return body}
function preview(node){const v=values(node);node.querySelector('[data-preview="en"]').textContent=[v.heading,v.qrCaption,v.shortInstructions,v.instructions,v.referenceInstruction,v.receiptInstructions,v.paymentHelpCopy,v.statusCopy].filter(Boolean).join('\\n')||'Copy preview appears here.';node.querySelector('[data-preview="ur"]').textContent=[v.headingUr,v.qrCaptionUr,v.shortInstructionsUr,v.instructions,v.referenceInstruction,v.receiptInstructionsUr,v.paymentHelpCopyUr,v.statusCopyUr].filter(Boolean).join('\\n')||'اردو copy preview appears here.'}
async function readJson(response){try{return await response.json()}catch{return {}}}
function responseError(response,data){return typeof data.error==='string'?data.error:typeof data.message==='string'?data.message:'Request failed (HTTP '+response.status+').'}
async function load(){const response=await fetch('/api/payment-methods');const data=await response.json();const root=document.querySelector('#methods');root.innerHTML=(data.paymentMethods||[]).map(card).join('');for(const node of root.querySelectorAll('.card')){preview(node);for(const inputElement of node.querySelectorAll('[data-key]'))inputElement.oninput=()=>preview(node);const method=node.dataset.method;const result=node.querySelector('[data-result]');node.querySelector('[data-save]').onclick=async()=>{try{const response=await fetch('/api/payment-methods/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values(node))});const data=await readJson(response);if(!response.ok)throw new Error(responseError(response,data));result.className='ok';result.textContent=data.configured?'Saved as a complete enabled method.':'Saved as a safe draft.';await load()}catch(error){result.className='error';result.textContent=error instanceof Error?error.message:'Save failed'}};node.querySelector('[data-upload]').onclick=async()=>{const file=node.querySelector('[data-qr]').files[0];if(!file){result.className='error';result.textContent='Choose an image first.';return}try{const response=await fetch('/api/payment-methods/'+method+'/qr',{method:'POST',headers:{'Content-Type':file.type},body:file});const data=await readJson(response);if(!response.ok)throw new Error(responseError(response,data));result.className='ok';result.textContent='QR uploaded privately.';await load()}catch(error){result.className='error';result.textContent=error instanceof Error?error.message:'QR upload failed'}}}}load().catch(()=>document.querySelector('#methods').textContent='Payment settings unavailable');</script></body></html>`;
}

function paymentSettingsScript(csrfToken: string): string {
  const csrf = JSON.stringify(csrfToken);
  return [
    "(() => {",
    "const csrf=" + csrf + ";",
    "const root=document.querySelector('#methods');",
    "const labels={JAZZCASH:'JazzCash',EASYPAISA:'Easypaisa',BANK_TRANSFER:'Bank Transfer'};",
     "const fields=[['heading','Heading'],['qrCaption','QR caption'],['shortInstructions','Short instructions',true],['receiptInstructions','Receipt instructions',true],['paymentHelpCopy','Payment help',true],['statusCopy','Status copy',true]];",
    "const esc=(value)=>String(value??'').replace(/[&<>\"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[character]));",
    "const field=(key,label,value,area)=>'<label>'+label+(area?'<textarea data-key=\"'+key+'\">'+esc(value)+'</textarea>':'<input data-key=\"'+key+'\" value=\"'+esc(value)+'\">')+'</label>';",
    "const status=(method)=>method.enabled&&method.recipientName&&method.instructions?'Enabled':'Draft / incomplete';",
     "const badge=(method)=>'<span class=\"badge '+(method.enabled&&method.recipientName&&method.instructions?'badge-on':'badge-draft')+'\">'+status(method)+'</span>'+(method.translationWarnings&&method.translationWarnings.length?'<p class=\"status error\">'+method.translationWarnings.join(', ')+'</p>':'');",
     "const qr=(method)=>method.qrR2Key?'<p class=\"status error\">'+(method.qrDeliveryStatus==='BLOCKED_OWNERSHIP_UNVERIFIED'?'QR preview only. Customer delivery remains blocked until independent ownership evidence is approved.':'Verified QR delivery ready.')+'</p><img class=\"qr\" src=\"/api/payment-methods/'+encodeURIComponent(method.method)+'/qr\" alt=\"Private '+labels[method.method]+' QR code\">':'<p class=\"muted\">No QR configured.</p>';",
    "let methods=[];let selected='JAZZCASH';let current={};",
      "function localized(prefix){const suffix=prefix==='Ur'?'Ur':'';const copy=fields.map((item)=>field(item[0]+suffix,item[1],current[item[0]+suffix],item[2])).join('');return prefix==='Ur'?field('instructionsUr','ادائیگی کی ہدایات',current.instructionsUr,true)+field('referenceInstructionUr','حوالہ کی ہدایت',current.referenceInstructionUr)+copy:copy;}",
    "function card(method){current=method;const basic='<section class=\"panel\"><div class=\"section-heading\"><div><h2>Basic settings</h2><p class=\"muted\">Recipient details used in customer payment instructions.</p></div>'+badge(method)+'</div><div class=\"form-grid\">'+field('recipientName','Recipient name',method.recipientName)+'<label>Account / TILL / TIL identifier<input data-key=\"tillId\" value=\"'+esc(method.tillId)+'\"></label><label>Payment instructions<textarea data-key=\"instructions\">'+esc(method.instructions)+'</textarea></label><label>Reference instruction<input data-key=\"referenceInstruction\" value=\"'+esc(method.referenceInstruction)+'\"></label><label>Sort order<input data-key=\"sortOrder\" type=\"number\" min=\"0\" step=\"1\" value=\"'+(Number.isFinite(Number(method.sortOrder))?Number(method.sortOrder):100)+'\"></label></div><label class=\"toggle\"><input data-key=\"enabled\" type=\"checkbox\" '+(method.enabled?'checked':'')+'> Enable after Garden Shop verification</label></section>';const advanced='<details class=\"panel advanced\"><summary>Advanced EN / UR copy</summary><div class=\"language-grid\"><div><h3>English</h3>'+localized('')+'</div><div dir=\"rtl\"><h3>اردو</h3>'+localized('Ur')+'</div></div></details>';const preview='<section class=\"panel preview-panel\"><div class=\"section-heading\"><div><h2>Customer preview</h2><p class=\"muted\">Preview the payment copy without exposing private storage.</p></div><a class=\"text-link\" href=\"/api/payment-instructions/'+encodeURIComponent(method.method)+'\" target=\"_blank\" rel=\"noreferrer\">Open payment preview</a></div><div class=\"preview-grid\"><div><h3>English</h3><div class=\"preview\" data-preview=\"en\"></div></div><div dir=\"rtl\"><h3>اردو</h3><div class=\"preview\" data-preview=\"ur\"></div></div></div><p class=\"muted preview-links\">Manage shared WhatsApp copy in <a class=\"text-link\" href=\"/whatsapp-content\">WhatsApp CMS</a>.</p></section>';const qrPanel='<section class=\"panel qr-panel\"><div class=\"section-heading\"><div><h2>Private QR code</h2><p class=\"muted\">Stored privately in R2. Uploading replaces the current QR for this method.</p></div></div>'+qr(method)+'<div class=\"actions\"><input data-qr type=\"file\" accept=\"image/png,image/jpeg,image/webp\"><button type=\"button\" data-upload>Upload QR</button></div></section>';return basic+advanced+preview+qrPanel+'<div class=\"save-bar\"><button class=\"primary\" type=\"button\" data-save>Save '+labels[method.method]+' draft</button><span data-result class=\"status\" role=\"status\" aria-live=\"polite\"></span></div>';}",
     "function values(node){const body={};for(const element of node.querySelectorAll('[data-key]'))body[element.dataset.key]=element.type==='checkbox'?element.checked:element.type==='number'?Number(element.value):element.value;return body;}",
     "function preview(node){const value=values(node);node.querySelector('[data-preview=\"en\"]').textContent=[value.heading,value.qrCaption,value.shortInstructions,value.instructions,value.referenceInstruction,value.receiptInstructions,value.paymentHelpCopy,value.statusCopy].filter(Boolean).join('\\n')||'Payment copy preview appears here.';node.querySelector('[data-preview=\"ur\"]').textContent=[value.headingUr,value.qrCaptionUr,value.shortInstructionsUr,value.instructionsUr,value.referenceInstructionUr,value.receiptInstructionsUr,value.paymentHelpCopyUr,value.statusCopyUr].filter(Boolean).join('\\n')||'اردو ادائیگی کا پیش نظارہ یہاں ظاہر ہوگا۔';}",
    "async function readJson(response){try{return await response.json();}catch{return {};}}",
    "function responseError(response,data){if(data&&typeof data.error==='string')return data.error+(typeof data.message==='string'?' — '+data.message:'');if(data&&typeof data.message==='string')return data.message;return 'Request failed (HTTP '+response.status+').';}",
    "async function request(url,options){const response=await fetch(url,options);const data=await readJson(response);if(!response.ok){const error=new Error(responseError(response,data));error.code=data&&data.error;throw error;}return data;}",
    "function tabs(){return '<div class=\"method-tabs\" role=\"tablist\" aria-label=\"Payment methods\">'+methods.map((method)=>'<button type=\"button\" role=\"tab\" aria-selected=\"'+(method.method===selected)+'\" class=\"method-tab '+(method.method===selected?'active':'')+'\" data-tab-method=\"'+method.method+'\"><span>'+labels[method.method]+'</span>'+badge(method)+'</button>').join('')+'</div>';}",
    "function bind(node){preview(node);node.querySelectorAll('[data-key]').forEach((element)=>element.addEventListener('input',()=>preview(node)));const method=node.dataset.method;const result=node.querySelector('[data-result]');const save=node.querySelector('[data-save]');save.onclick=async()=>{save.disabled=true;try{const data=await request('/api/payment-methods/'+encodeURIComponent(method),{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(values(node))});await load(method);const statusNode=document.querySelector('[data-result]');statusNode.className='status ok';statusNode.textContent=data.configured?'Saved as a complete enabled method.':'Saved as a safe draft.';}catch(error){result.className='status error';result.textContent=error instanceof Error?error.message:'PAYMENT_METHOD_INVALID';}finally{save.disabled=false;}};node.querySelector('[data-upload]').onclick=async()=>{const file=node.querySelector('[data-qr]').files[0];if(!file){result.className='status error';result.textContent='PAYMENT_QR_FILE_REQUIRED';return;}try{await request('/api/payment-methods/'+encodeURIComponent(method)+'/qr',{method:'POST',headers:{'Content-Type':file.type,'X-CSRF-Token':csrf},body:file});await load(method);const statusNode=document.querySelector('[data-result]');statusNode.className='status ok';statusNode.textContent='QR uploaded privately.';}catch(error){result.className='status error';result.textContent=error instanceof Error?error.message:'PAYMENT_QR_UPLOAD_FAILED';}};}",
    "async function load(preferred){const response=await fetch('/api/payment-methods',{cache:'no-store'});const data=await readJson(response);if(!response.ok)throw new Error(responseError(response,data));methods=data.paymentMethods||[];if(preferred)selected=preferred;if(!methods.some((method)=>method.method===selected))selected=methods[0]?.method||'JAZZCASH';root.innerHTML=tabs()+(methods.length?'<div class=\"method-content\" data-method=\"'+selected+'\">'+card(methods.find((method)=>method.method===selected)||methods[0])+'</div>':'<div class=\"panel\">No payment methods are available.</div>');root.querySelectorAll('[data-tab-method]').forEach((element)=>element.onclick=()=>{selected=element.dataset.tabMethod;load(selected).catch(showLoadError);});const content=root.querySelector('.method-content');if(content)bind(content);}",
    "function showLoadError(error){root.innerHTML='<div class=\"panel error\">'+esc(error instanceof Error?error.message:'PAYMENT_CONFIGURATION_UNAVAILABLE')+'</div>';}",
    "window.paymentSettingsReload=()=>load(selected).catch(showLoadError);load().catch(showLoadError);",
    "})();"
  ].join("\n");
}

function paymentSettingsPageHtml(csrfToken: string): string {
  const script = paymentSettingsScript(csrfToken);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Settings | Get Free Seeds</title><style>
:root{color-scheme:light;--ink:#1b2a22;--muted:#647269;--line:#d8e2da;--paper:#fff;--wash:#f3f7f3;--green:#17603c;--green-dark:#0f452b;--red:#a32929;--shadow:0 14px 36px rgba(27,42,34,.08)}*{box-sizing:border-box}body{margin:0;background:#edf3ed;color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}.shell{max-width:1120px;margin:auto;padding:28px 20px 48px}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.eyebrow{color:var(--green);font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.top h1{font:700 38px/1.05 Georgia,serif;margin:6px 0 8px}.top p{color:var(--muted);margin:0;max-width:680px}.top nav{margin-top:12px}.top nav a,.text-link{color:var(--green);font-weight:750;text-decoration:none}.top nav a:hover,.text-link:hover{text-decoration:underline}.reload{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:10px 14px;box-shadow:var(--shadow);white-space:nowrap}.method-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.method-tab{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--paper);padding:14px 16px;box-shadow:0 6px 18px rgba(27,42,34,.04)}.method-tab>span{font-size:17px;font-weight:800}.method-tab.active{border-color:var(--green);background:var(--green);color:#fff}.method-tab.active .badge{color:var(--green-dark);background:#fff}.badge{border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;white-space:nowrap}.badge-on{background:#dcefe1;color:#17603c}.badge-draft{background:#fff0d2;color:#8a5a00}.method-content{display:grid;gap:14px}.panel{border:1px solid var(--line);border-radius:14px;background:var(--paper);padding:20px;box-shadow:var(--shadow)}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.section-heading h2{margin:0;font:700 23px/1.15 Georgia,serif}.section-heading p{margin:5px 0 0}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.form-grid label:nth-child(3),.form-grid label:nth-child(4){grid-column:1/-1}label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}input,textarea{width:100%;border:1px solid #cbd7cd;border-radius:8px;background:#fff;color:var(--ink);padding:10px 11px}textarea{min-height:92px;resize:vertical}.toggle{display:flex;align-items:center;gap:8px;margin-top:16px;text-transform:none;letter-spacing:0;font-size:14px;color:var(--ink)}.toggle input{width:auto}.advanced{padding:0}.advanced summary{cursor:pointer;padding:17px 20px;font-weight:800;color:var(--green);list-style-position:inside}.language-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;border-top:1px solid var(--line);padding:20px}.language-grid h3{margin:0 0 10px;font:700 18px Georgia,serif}.preview-panel{background:linear-gradient(135deg,#fff 0%,#f7fbf7 100%)}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.preview-grid h3{font-size:13px;margin:0 0 6px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.preview{min-height:140px;white-space:pre-wrap;background:var(--wash);border:1px solid var(--line);border-radius:9px;padding:13px;color:#27372c}.preview-links{margin-bottom:0}.qr{display:block;max-width:220px;max-height:220px;margin:16px 0;border:1px solid var(--line);border-radius:8px}.actions,.save-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.actions input{max-width:360px}.actions button,.primary{border:0;border-radius:8px;background:var(--green);color:#fff;padding:10px 14px;font-weight:800}.actions button:hover,.primary:hover{background:var(--green-dark)}.save-bar{padding:2px 4px}.save-bar .primary{padding:12px 18px}.status{color:var(--muted)}.ok{color:#176b36}.error{color:var(--red)}.muted{color:var(--muted)}@media(max-width:700px){.shell{padding:20px 14px 36px}.top{display:block}.reload{margin-top:16px}.top h1{font-size:32px}.method-tabs{grid-template-columns:1fr}.method-tab{padding:12px 14px}.form-grid,.language-grid,.preview-grid{grid-template-columns:1fr}.form-grid label:nth-child(3),.form-grid label:nth-child(4){grid-column:auto}.panel{padding:16px}.actions input{max-width:none}.actions button{flex:1}}
  </style></head><body><main class="shell"><header class="top"><div><div class="eyebrow">Commerce configuration</div><h1>Payment settings</h1><p>Manage Garden Shop payment recipients, customer instructions, private QR codes, and bilingual copy. Disabled or incomplete methods remain safe drafts.</p><p>Include <code>{amount}</code>, <code>{recipientName}</code>, <code>{tillId}</code> when configured, and <code>{orderNumber}</code> in both language templates. D1 supplies the values; Payment Settings stores the copy.</p><p class="status error">Customer payment remains disabled until method copy and recipient authorization are complete. QR media additionally requires independent ownership evidence; text-only fallback does not authorize an unverified recipient.</p><nav><a href="/">Admin home</a> &nbsp;·&nbsp; <a href="/whatsapp-content">Open WhatsApp CMS</a></nav></div><button class="reload" type="button" onclick="window.paymentSettingsReload&&window.paymentSettingsReload()">Reload saved settings</button></header><div id="methods"><div class="panel">Loading payment settings...</div></div></main><script>${script}</script></body></html>`;
}

function contentKey(value: string | undefined): ReturnType<typeof WhatsAppTemplateKey.parse> | undefined {
  return WhatsAppTemplateKey.safeParse(value).data;
}

function contentWithoutActionLabels(content: WhatsAppContent): Omit<WhatsAppContent, "actionLabels"> {
  const { actionLabels: _actionLabels, ...copy } = content;
  return copy;
}

function actionLabelStatements(db: D1Database, key: ReturnType<typeof WhatsAppTemplateKey.parse>, version: number, contentEn: WhatsAppContent, contentUr: WhatsAppContent, now: string, actor: string) {
  return whatsAppActionIdsForTemplate(key).map((actionId) => db.prepare("INSERT INTO whatsapp_content_version_action_labels (template_key,version,action_id,label_en,label_ur,created_at,created_by) VALUES (?,?,?,?,?,?,?)").bind(key, version, actionId, contentEn.actionLabels?.[actionId], contentUr.actionLabels?.[actionId], now, actor));
}

function paymentCopy(value: unknown, previous: unknown): string | undefined {
  if (value === undefined) return previous == null ? undefined : String(previous);
  if (typeof value !== "string" || value.trim().length > 1000) throw new Error("PAYMENT_COPY_INVALID");
  return value.trim() || undefined;
}

function validatePaymentLocaleCopy(candidate: { heading?: string; instructions?: string; referenceInstruction?: string; shortInstructions?: string; receiptInstructions?: string; paymentHelpCopy?: string; statusCopy?: string; headingUr?: string; instructionsUr?: string; referenceInstructionUr?: string; shortInstructionsUr?: string; receiptInstructionsUr?: string; paymentHelpCopyUr?: string; statusCopyUr?: string }): void {
  const english = [candidate.heading, candidate.instructions, candidate.referenceInstruction, candidate.shortInstructions, candidate.receiptInstructions, candidate.paymentHelpCopy, candidate.statusCopy];
  if (english.some((value) => value && /[\u0600-\u06ff]/u.test(value))) throw new Error("PAYMENT_COPY_LANGUAGE_MIXED");
  const pairs: Array<[string | undefined, string | undefined]> = [
    [candidate.heading, candidate.headingUr],
    [candidate.instructions, candidate.instructionsUr],
    [candidate.referenceInstruction, candidate.referenceInstructionUr],
    [candidate.shortInstructions, candidate.shortInstructionsUr],
    [candidate.receiptInstructions, candidate.receiptInstructionsUr],
    [candidate.paymentHelpCopy, candidate.paymentHelpCopyUr],
    [candidate.statusCopy, candidate.statusCopyUr]
  ];
  for (const [englishValue, urduValue] of pairs) {
    if (!urduValue) continue;
    if (englishValue && englishValue.trim().toLocaleLowerCase() === urduValue.trim().toLocaleLowerCase()) throw new Error("PAYMENT_URDU_TRANSLATION_DUPLICATED");
    if (!/[\u0600-\u06ff\u0750-\u077f]/u.test(urduValue)) throw new Error("PAYMENT_URDU_TRANSLATION_MISSING");
  }
}

function rateView(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    province: String(row.province),
    deliveryFeePkr: Number(row.delivery_fee_pkr),
    active: Number(row.enabled) === 1
  };
}

function auditStatement(db: D1Database, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>, now: string, actor: string) {
  return db.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), action, "ADMIN", actor, entityType, entityId, crypto.randomUUID(), JSON.stringify(metadata), now);
}

function catalogError(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : "CATALOG_VALIDATION_FAILED";
}

function metaActivation(c: { env: Env["Bindings"] }) {
  return createMetaActivationService({ accessToken: c.env.META_ACCESS_TOKEN, graphVersion: c.env.META_GRAPH_VERSION, phoneNumberId: c.env.META_PHONE_NUMBER_ID, wabaId: c.env.META_WABA_ID, appId: c.env.META_APP_ID, callbackUrl: c.env.META_CALLBACK_URL, providerEnabled: c.env.META_PROVIDER_ENABLED === "true", webhookVerifyToken: c.env.WEBHOOK_VERIFY_TOKEN, appSecret: c.env.META_APP_SECRET, flowPrivateKey: c.env.FLOW_PRIVATE_KEY, flowPublicKey: c.env.FLOW_PUBLIC_KEY });
}

app.use("*", async (c, next) => {
  if (!authorized(c)) return c.json({ error: "ADMIN_ACCESS_REQUIRED" }, 403);
  await next();
});

app.get("/health", async (c) => {
  const configured = c.env.DB ? await c.env.DB.prepare("SELECT COUNT(*) AS count FROM payment_methods WHERE enabled=1 AND recipient_name IS NOT NULL AND instructions IS NOT NULL AND EXISTS (SELECT 1 FROM payment_configuration WHERE id=1 AND advance_amount_pkr > 0)").first<{ count: number }>() : null;
  return c.json({ ok: true, service: "getfreeseeds-admin", state: c.env.DEPLOYMENT_STATE, paymentConfigured: Number(configured?.count ?? 0) > 0 });
});
app.get("/", (c) => c.html("<h1>Get Free Seeds Admin</h1><p>Payment review and fulfillment console.</p><nav><a href='/payment-settings'>Payment Settings</a> | <a href='/whatsapp-content'>WhatsApp Content</a> | <a href='/payment-amount'>Legacy Advance Amount</a> | <a href='/tariff'>Tariff Management</a> | <a href='/meta-activation'>Meta Activation</a> | <a href='/orders'>Orders</a> | <a href='/test-controls'>Test Controls</a> | Dashboard | Leads | Meta Instant Form | Payment Verification | Paid Orders | Packing | Dispatch | Delivered | Cancelled | Customers | Meta CAPI | WhatsApp Status | Audit Log | Configuration Summary</nav>"));

app.get("/api/csrf", (c) => c.json({ csrfToken: issueCsrfToken(c) }));
app.get("/orders", (c) => c.html(professionalOrdersPageHtml(issueCsrfToken(c))));
app.get("/test-controls", (c) => c.html(testControlsPageHtml(issueCsrfToken(c))));
app.get("/whatsapp-content", (c) => c.html(whatsappContentJourneyPageHtml(issueCsrfToken(c))));
app.get("/payment-settings", (c) => {
  c.header("Cache-Control", "no-store, max-age=0");
  return c.html(paymentSettingsPageHtml(issueCsrfToken(c)));
});

app.get("/api/whatsapp-content", async (c) => {
  if (!c.env.DB) return c.json({ templates: [] });
  const [result, gallery, actionLabels] = await Promise.all([
    c.env.DB.prepare("SELECT t.template_key,t.flow_order,t.section,t.draft_version,t.published_version,d.content_en_json AS draft_en,d.content_ur_json AS draft_ur,d.media_r2_key AS draft_media,p.content_en_json AS published_en,p.content_ur_json AS published_ur,p.media_r2_key AS published_media FROM whatsapp_content_templates t LEFT JOIN whatsapp_content_template_versions d ON d.template_key=t.template_key AND d.version=t.draft_version LEFT JOIN whatsapp_content_template_versions p ON p.template_key=t.template_key AND p.version=t.published_version ORDER BY t.flow_order,t.template_key").all<Record<string, unknown>>(),
    c.env.DB.prepare("SELECT m.id,m.template_key,m.mime_type,m.size_bytes,m.sha256,m.master_mime_type,m.master_size_bytes,m.enabled,m.active,m.sort_order,m.created_at,m.created_by,m.updated_at,m.updated_by,EXISTS(SELECT 1 FROM whatsapp_content_version_media vm WHERE vm.media_id=m.id) AS referenced FROM whatsapp_content_media m ORDER BY m.template_key,m.sort_order,m.created_at,m.id").all<Record<string, unknown>>().catch(() => ({ results: [] })),
    c.env.DB.prepare("SELECT template_key,version,action_id,label_en,label_ur FROM whatsapp_content_version_action_labels ORDER BY template_key,version,action_id").all<{ template_key: string; version: number; action_id: string; label_en: string; label_ur: string }>()
  ]);
  const labelsByVersion = new Map<string, { en: Partial<Record<WhatsAppActionId, string>>; ur: Partial<Record<WhatsAppActionId, string>> }>();
  for (const row of actionLabels.results ?? []) {
    const mapKey = `${row.template_key}:${row.version}`;
    const labels = labelsByVersion.get(mapKey) ?? { en: {}, ur: {} };
    const actionId = WhatsAppActionId.safeParse(row.action_id).data;
    if (!actionId) continue;
    labels.en[actionId] = row.label_en;
    labels.ur[actionId] = row.label_ur;
    labelsByVersion.set(mapKey, labels);
  }
  const galleryByTemplate = new Map<string, Array<Record<string, unknown>>>();
  for (const row of gallery.results ?? []) {
    const templateKey = String(row.template_key);
    const items = galleryByTemplate.get(templateKey) ?? [];
    items.push({ id: String(row.id), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), sha256: String(row.sha256), masterMimeType: String(row.master_mime_type), masterSizeBytes: Number(row.master_size_bytes), enabled: Number(row.enabled) === 1, active: Number(row.active) === 1, sortOrder: Number(row.sort_order), referenced: Number(row.referenced) === 1, createdAt: String(row.created_at), createdBy: String(row.created_by), updatedAt: String(row.updated_at), updatedBy: String(row.updated_by), previewUrl: `/api/whatsapp-content/${encodeURIComponent(templateKey)}/media/${encodeURIComponent(String(row.id))}/preview` });
    galleryByTemplate.set(templateKey, items);
  }
  const templates = result.results.map((row) => {
    const parse = (en: unknown, ur: unknown, media: unknown, version: number | null) => {
      if (typeof en !== "string" || typeof ur !== "string") return undefined;
      try {
        const labels = version == null ? undefined : labelsByVersion.get(`${String(row.template_key)}:${version}`);
        return { contentEn: { ...JSON.parse(en), ...(labels && Object.keys(labels.en).length ? { actionLabels: labels.en } : {}) }, contentUr: { ...JSON.parse(ur), ...(labels && Object.keys(labels.ur).length ? { actionLabels: labels.ur } : {}) }, ...(typeof media === "string" ? { mediaR2Key: media } : {}) };
      } catch { return undefined; }
    };
    const templateKey = String(row.template_key);
    const draftVersion = row.draft_version == null ? null : Number(row.draft_version);
    const publishedVersion = row.published_version == null ? null : Number(row.published_version);
    return { templateKey, actionIds: whatsAppActionIdsForTemplate(WhatsAppTemplateKey.parse(templateKey)), flowOrder: row.flow_order == null ? null : Number(row.flow_order), section: row.section == null ? "Other" : String(row.section), draftVersion, publishedVersion, draft: parse(row.draft_en, row.draft_ur, row.draft_media, draftVersion), published: parse(row.published_en, row.published_ur, row.published_media, publishedVersion), media: galleryByTemplate.get(templateKey) ?? [] };
  });
  return c.json({ templates });
});

function mediaError(error: unknown): string {
  return error instanceof Error && /^WHATSAPP_CONTENT_[A-Z0-9_]+$/.test(error.message) ? error.message : "WHATSAPP_CONTENT_MEDIA_INVALID";
}

async function uploadContentMedia(c: AdminContext, key: ReturnType<typeof WhatsAppTemplateKey.parse>, master: { body: ArrayBuffer; mimeType: string }, variant: { body: ArrayBuffer; mimeType: string }) {
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "WHATSAPP_CONTENT_UNAVAILABLE" }, 503);
  const template = await c.env.DB.prepare("SELECT template_key FROM whatsapp_content_templates WHERE template_key=?").bind(key).first();
  if (!template) return c.json({ error: "WHATSAPP_TEMPLATE_NOT_FOUND" }, 404);
  try {
    validateWhatsAppContentImage(master.body, master.mimeType, "master");
    validateWhatsAppContentImage(variant.body, variant.mimeType, "variant");
  } catch (error) {
    return c.json({ error: mediaError(error) }, 400);
  }
  const id = crypto.randomUUID();
  let stored: Awaited<ReturnType<typeof storeWhatsAppContentMedia>>;
  try { stored = await storeWhatsAppContentMedia(c.env.RECEIPTS, key, id, master, variant); } catch (error) { return c.json({ error: mediaError(error) }, 400); }
  const state = await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),-10)+10 AS sort_order,COALESCE(SUM(active),0) AS active_count FROM whatsapp_content_media WHERE template_key=?").bind(key).first<{ sort_order: number; active_count: number }>();
  const now = new Date().toISOString();
  const sortOrder = Math.max(0, Number(state?.sort_order ?? 0));
  const active = Number(state?.active_count ?? 0) === 0 ? 1 : 0;
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO whatsapp_content_media (id,template_key,r2_key,master_r2_key,mime_type,size_bytes,sha256,master_mime_type,master_size_bytes,master_sha256,enabled,active,sort_order,created_at,created_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, key, stored.r2Key, stored.masterR2Key, variant.mimeType, stored.sizeBytes, stored.sha256, master.mimeType, stored.masterSizeBytes, stored.masterSha256, 1, active, sortOrder, now, c.env.ADMIN_EMAIL, now, c.env.ADMIN_EMAIL),
      auditStatement(c.env.DB, "WHATSAPP_CONTENT_MEDIA_UPLOADED", "WHATSAPP_CONTENT_MEDIA", id, { templateKey: key, mimeType: variant.mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256, masterMimeType: master.mimeType, masterSizeBytes: stored.masterSizeBytes, masterSha256: stored.masterSha256 }, now, c.env.ADMIN_EMAIL)
    ]);
  } catch (error) {
    await Promise.allSettled([c.env.RECEIPTS.delete(stored.r2Key), c.env.RECEIPTS.delete(stored.masterR2Key)]);
    throw error;
  }
  return c.json({ ok: true, id, mediaR2Key: stored.r2Key, mimeType: variant.mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256, active: active === 1, enabled: true, sortOrder }, 201);
}

app.post("/api/whatsapp-content/:key/media", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key) return c.json({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" }, 400);
  let form: FormData;
  try { form = await c.req.formData(); } catch { return c.json({ error: "WHATSAPP_CONTENT_MEDIA_FORM_INVALID" }, 400); }
  const masterFile = form.get("master");
  const variantFile = form.get("variant");
  if (!(masterFile instanceof File) || !(variantFile instanceof File)) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_FILES_REQUIRED" }, 400);
  return uploadContentMedia(c, key, { body: await masterFile.arrayBuffer(), mimeType: masterFile.type.toLowerCase() }, { body: await variantFile.arrayBuffer(), mimeType: variantFile.type.toLowerCase() });
});

// Compatibility path for existing callers; a template key is now mandatory and the
// original can only double as the WhatsApp variant when it is already compatible.
app.post("/api/whatsapp-content/media", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.header("x-whatsapp-template-key"));
  if (!key) return c.json({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" }, 400);
  const mimeType = c.req.header("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
  const body = await c.req.arrayBuffer();
  return uploadContentMedia(c, key, { body, mimeType }, { body, mimeType });
});

app.get("/api/whatsapp-content/:key/media/:id/preview", async (c) => {
  const key = contentKey(c.req.param("key"));
  if (!key || !c.env.DB || !c.env.RECEIPTS) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  const row = await c.env.DB.prepare("SELECT r2_key,mime_type FROM whatsapp_content_media WHERE id=? AND template_key=?").bind(c.req.param("id"), key).first<{ r2_key: string; mime_type: string }>();
  if (!row) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  const object = await c.env.RECEIPTS.get(row.r2_key);
  if (!object) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": row.mime_type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

app.post("/api/whatsapp-content/:key/media/:id/enabled", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key || !c.env.DB) return c.json({ error: key ? "WHATSAPP_CONTENT_UNAVAILABLE" : "WHATSAPP_TEMPLATE_KEY_INVALID" }, key ? 503 : 400);
  let body: { enabled?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (typeof body.enabled !== "boolean") return c.json({ error: "WHATSAPP_CONTENT_MEDIA_ENABLED_INVALID" }, 400);
  const now = new Date().toISOString();
  const found = await c.env.DB.prepare("SELECT id FROM whatsapp_content_media WHERE id=? AND template_key=?").bind(c.req.param("id"), key).first();
  if (!found) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE whatsapp_content_media SET enabled=?,active=CASE WHEN ?=0 THEN 0 ELSE active END,disabled_at=CASE WHEN ?=0 THEN ? ELSE NULL END,disabled_by=CASE WHEN ?=0 THEN ? ELSE NULL END,updated_at=?,updated_by=? WHERE id=? AND template_key=?").bind(body.enabled ? 1 : 0, body.enabled ? 1 : 0, body.enabled ? 1 : 0, now, body.enabled ? 1 : 0, c.env.ADMIN_EMAIL, now, c.env.ADMIN_EMAIL, c.req.param("id"), key),
    auditStatement(c.env.DB, body.enabled ? "WHATSAPP_CONTENT_MEDIA_ENABLED" : "WHATSAPP_CONTENT_MEDIA_DISABLED", "WHATSAPP_CONTENT_MEDIA", c.req.param("id"), { templateKey: key }, now, c.env.ADMIN_EMAIL)
  ]);
  return c.json({ ok: true, enabled: body.enabled });
});

app.post("/api/whatsapp-content/:key/media/:id/active", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key || !c.env.DB) return c.json({ error: key ? "WHATSAPP_CONTENT_UNAVAILABLE" : "WHATSAPP_TEMPLATE_KEY_INVALID" }, key ? 503 : 400);
  let body: { active?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (typeof body.active !== "boolean") return c.json({ error: "WHATSAPP_CONTENT_MEDIA_ACTIVE_INVALID" }, 400);
  const found = await c.env.DB.prepare("SELECT id FROM whatsapp_content_media WHERE id=? AND template_key=?").bind(c.req.param("id"), key).first();
  if (!found) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  const statements = body.active ? [
    c.env.DB.prepare("UPDATE whatsapp_content_media SET active=0,updated_at=?,updated_by=? WHERE template_key=? AND active=1").bind(now, c.env.ADMIN_EMAIL, key),
    c.env.DB.prepare("UPDATE whatsapp_content_media SET active=1,enabled=1,disabled_at=NULL,disabled_by=NULL,updated_at=?,updated_by=? WHERE id=? AND template_key=?").bind(now, c.env.ADMIN_EMAIL, c.req.param("id"), key)
  ] : [c.env.DB.prepare("UPDATE whatsapp_content_media SET active=0,updated_at=?,updated_by=? WHERE id=? AND template_key=?").bind(now, c.env.ADMIN_EMAIL, c.req.param("id"), key)];
  await c.env.DB.batch([...statements, auditStatement(c.env.DB, body.active ? "WHATSAPP_CONTENT_MEDIA_ACTIVATED" : "WHATSAPP_CONTENT_MEDIA_ROTATION_ENABLED", "WHATSAPP_CONTENT_MEDIA", c.req.param("id"), { templateKey: key }, now, c.env.ADMIN_EMAIL)]);
  return c.json({ ok: true, active: body.active });
});

app.post("/api/whatsapp-content/:key/media/order", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key || !c.env.DB) return c.json({ error: key ? "WHATSAPP_CONTENT_UNAVAILABLE" : "WHATSAPP_TEMPLATE_KEY_INVALID" }, key ? 503 : 400);
  let body: { ids?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(id)) || new Set(body.ids).size !== body.ids.length) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_ORDER_INVALID" }, 400);
  const ids = body.ids as string[];
  const existing = await c.env.DB.prepare("SELECT id FROM whatsapp_content_media WHERE template_key=? ORDER BY sort_order,created_at,id").bind(key).all<{ id: string }>();
  if (existing.results.length !== ids.length || existing.results.some((row) => !ids.includes(row.id))) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_ORDER_MISMATCH" }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([...ids.map((id, index) => c.env.DB.prepare("UPDATE whatsapp_content_media SET sort_order=?,updated_at=?,updated_by=? WHERE id=? AND template_key=?").bind(index * 10, now, c.env.ADMIN_EMAIL, id, key)), auditStatement(c.env.DB, "WHATSAPP_CONTENT_MEDIA_REORDERED", "WHATSAPP_CONTENT_TEMPLATE", key, { ids }, now, c.env.ADMIN_EMAIL)]);
  return c.json({ ok: true });
});

app.delete("/api/whatsapp-content/:key/media/:id", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key || !c.env.DB || !c.env.RECEIPTS) return c.json({ error: key ? "WHATSAPP_CONTENT_UNAVAILABLE" : "WHATSAPP_TEMPLATE_KEY_INVALID" }, key ? 503 : 400);
  const row = await c.env.DB.prepare("SELECT id,r2_key,master_r2_key FROM whatsapp_content_media WHERE id=? AND template_key=?").bind(c.req.param("id"), key).first<{ id: string; r2_key: string; master_r2_key: string }>();
  if (!row) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 404);
  const references = await c.env.DB.prepare("SELECT (SELECT COUNT(*) FROM whatsapp_content_version_media WHERE media_id=?) + (SELECT COUNT(*) FROM whatsapp_content_media_selections WHERE media_id=?) AS count").bind(row.id, row.id).first<{ count: number }>();
  const now = new Date().toISOString();
  if (Number(references?.count ?? 0) > 0) {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE whatsapp_content_media SET enabled=0,active=0,disabled_at=?,disabled_by=?,updated_at=?,updated_by=? WHERE id=?").bind(now, c.env.ADMIN_EMAIL, now, c.env.ADMIN_EMAIL, row.id),
      auditStatement(c.env.DB, "WHATSAPP_CONTENT_MEDIA_SOFT_DISABLED", "WHATSAPP_CONTENT_MEDIA", row.id, { templateKey: key, reason: "REFERENCED" }, now, c.env.ADMIN_EMAIL)
    ]);
    return c.json({ ok: true, removed: false, softDisabled: true });
  }
  await Promise.all([c.env.RECEIPTS.delete(row.r2_key), c.env.RECEIPTS.delete(row.master_r2_key)]);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM whatsapp_content_media WHERE id=? AND template_key=?").bind(row.id, key),
    auditStatement(c.env.DB, "WHATSAPP_CONTENT_MEDIA_REMOVED", "WHATSAPP_CONTENT_MEDIA", row.id, { templateKey: key }, now, c.env.ADMIN_EMAIL)
  ]);
  return c.json({ ok: true, removed: true, softDisabled: false });
});

app.get("/api/whatsapp-content/:key", async (c) => {
  const key = contentKey(c.req.param("key"));
  if (!key) return c.json({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" }, 400);
  if (!c.env.DB) return c.json({ error: "WHATSAPP_CONTENT_UNAVAILABLE" }, 503);
  const versions = await c.env.DB.prepare("SELECT version,status,content_en_json,content_ur_json,media_r2_key,created_at,created_by FROM whatsapp_content_template_versions WHERE template_key=? ORDER BY version DESC").bind(key).all();
  return c.json({ templateKey: key, versions: versions.results });
});

app.post("/api/whatsapp-content/:key/draft", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key) return c.json({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" }, 400);
  if (!c.env.DB) return c.json({ error: "WHATSAPP_CONTENT_UNAVAILABLE" }, 503);
  let body: { confirmation?: unknown; contentEn?: unknown; contentUr?: unknown; mediaR2Key?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (body.confirmation !== key) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  let draft;
  try { draft = parseWhatsAppContentDraft({ contentEn: body.contentEn, contentUr: body.contentUr, ...(body.mediaR2Key === undefined ? {} : { mediaR2Key: body.mediaR2Key }) }, key); } catch (error) { return c.json({ error: error instanceof Error && /^WHATSAPP_CONTENT_/.test(error.message) ? error.message : "WHATSAPP_CONTENT_INVALID" }, 400); }
  if (draft.mediaR2Key) {
    if (!c.env.RECEIPTS || !await c.env.RECEIPTS.head(draft.mediaR2Key)) return c.json({ error: "WHATSAPP_CONTENT_MEDIA_NOT_FOUND" }, 400);
  }
  const template = await c.env.DB.prepare("SELECT template_key FROM whatsapp_content_templates WHERE template_key=?").bind(key).first<{ template_key: string }>();
  if (!template) return c.json({ error: "WHATSAPP_TEMPLATE_NOT_FOUND" }, 404);
  const latest = await c.env.DB.prepare("SELECT COALESCE(MAX(version),0) AS version FROM whatsapp_content_template_versions WHERE template_key=?").bind(key).first<{ version: number }>();
  const version = Number(latest?.version ?? 0) + 1;
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO whatsapp_content_template_versions (id,template_key,version,status,content_en_json,content_ur_json,media_r2_key,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, version, "DRAFT", JSON.stringify(contentWithoutActionLabels(draft.contentEn)), JSON.stringify(contentWithoutActionLabels(draft.contentUr)), draft.mediaR2Key ?? null, now, c.env.ADMIN_EMAIL),
    ...actionLabelStatements(c.env.DB, key, version, draft.contentEn, draft.contentUr, now, c.env.ADMIN_EMAIL),
    c.env.DB.prepare("UPDATE whatsapp_content_templates SET draft_version=?,updated_at=?,updated_by=? WHERE template_key=?").bind(version, now, c.env.ADMIN_EMAIL, key),
    auditStatement(c.env.DB, "WHATSAPP_CONTENT_DRAFT_SAVED", "WHATSAPP_CONTENT_TEMPLATE", key, { version, hasPrivateMedia: Boolean(draft.mediaR2Key) }, now, c.env.ADMIN_EMAIL)
  ]);
  return c.json({ ok: true, templateKey: key, version }, 201);
});

export function whatsappContentMediaSnapshotMatches(current: Array<{ id: string; active: number; sort_order: number }>, published: Array<{ id: string; active: number; sort_order: number }>): boolean {
  const signature = (rows: Array<{ id: string; active: number; sort_order: number }>) => rows.map((row) => `${row.id}:${Number(row.active) === 1 ? 1 : 0}:${Number(row.sort_order)}`).join("|");
  return signature(current) === signature(published);
}

async function publishWhatsAppContent(c: AdminContext, rollback: boolean) {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const key = contentKey(c.req.param("key"));
  if (!key) return c.json({ error: "WHATSAPP_TEMPLATE_KEY_INVALID" }, 400);
  if (!c.env.DB) return c.json({ error: "WHATSAPP_CONTENT_UNAVAILABLE" }, 503);
  let body: { version?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const version = typeof body.version === "number" && Number.isInteger(body.version) && body.version > 0 ? body.version : 0;
  if (!version || body.confirmation !== `${key}:${version}`) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  const [template, target, targetLabels] = await Promise.all([
    c.env.DB.prepare("SELECT published_version,draft_version FROM whatsapp_content_templates WHERE template_key=?").bind(key).first<{ published_version: number | null; draft_version: number | null }>(),
    c.env.DB.prepare("SELECT status,content_en_json,content_ur_json,media_r2_key FROM whatsapp_content_template_versions WHERE template_key=? AND version=?").bind(key, version).first<{ status: string; content_en_json: string; content_ur_json: string; media_r2_key: string | null }>(),
    c.env.DB.prepare("SELECT action_id,label_en,label_ur FROM whatsapp_content_version_action_labels WHERE template_key=? AND version=? ORDER BY action_id").bind(key, version).all<{ action_id: string; label_en: string; label_ur: string }>()
  ]);
  if (!template || !target) return c.json({ error: "WHATSAPP_TEMPLATE_VERSION_NOT_FOUND" }, 404);
  const enActionLabels: Partial<Record<WhatsAppActionId, string>> = {};
  const urActionLabels: Partial<Record<WhatsAppActionId, string>> = {};
  for (const label of targetLabels.results ?? []) {
    const actionId = WhatsAppActionId.safeParse(label.action_id).data;
    if (!actionId) continue;
    enActionLabels[actionId] = label.label_en;
    urActionLabels[actionId] = label.label_ur;
  }
  try { parseWhatsAppContentDraft({ contentEn: { ...JSON.parse(target.content_en_json), ...(Object.keys(enActionLabels).length ? { actionLabels: enActionLabels } : {}) }, contentUr: { ...JSON.parse(target.content_ur_json), ...(Object.keys(urActionLabels).length ? { actionLabels: urActionLabels } : {}) }, ...(target.media_r2_key ? { mediaR2Key: target.media_r2_key } : {}) }, key); } catch { return c.json({ error: "WHATSAPP_CONTENT_INVALID" }, 409); }
  const now = new Date().toISOString();
  const gallery = rollback ? { results: [] as Array<{ id: string; active: number; sort_order: number }> } : await c.env.DB.prepare("SELECT id,active,sort_order FROM whatsapp_content_media WHERE template_key=? AND enabled=1 ORDER BY active DESC,sort_order,created_at,id").bind(key).all<{ id: string; active: number; sort_order: number }>();
  let publishVersion = version;
  const cloneStatements = [];
  if (!rollback && target.status === "PUBLISHED" && template.published_version === version && template.draft_version === version) {
    const publishedGallery = await c.env.DB.prepare("SELECT media_id AS id,active,sort_order FROM whatsapp_content_version_media WHERE template_key=? AND version=? ORDER BY active DESC,sort_order,media_id").bind(key, version).all<{ id: string; active: number; sort_order: number }>();
    if (whatsappContentMediaSnapshotMatches(gallery.results, publishedGallery.results)) return c.json({ ok: true, templateKey: key, version, upToDate: true });
    const latest = await c.env.DB.prepare("SELECT COALESCE(MAX(version),0) AS version FROM whatsapp_content_template_versions WHERE template_key=?").bind(key).first<{ version: number }>();
    publishVersion = Number(latest?.version ?? 0) + 1;
    cloneStatements.push(
      c.env.DB.prepare("INSERT INTO whatsapp_content_template_versions (id,template_key,version,status,content_en_json,content_ur_json,media_r2_key,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, publishVersion, "DRAFT", target.content_en_json, target.content_ur_json, target.media_r2_key, now, c.env.ADMIN_EMAIL),
      c.env.DB.prepare("INSERT INTO whatsapp_content_version_action_labels (template_key,version,action_id,label_en,label_ur,created_at,created_by) SELECT template_key,?,action_id,label_en,label_ur,?,? FROM whatsapp_content_version_action_labels WHERE template_key=? AND version=?").bind(publishVersion, now, c.env.ADMIN_EMAIL, key, version),
      c.env.DB.prepare("UPDATE whatsapp_content_templates SET draft_version=?,updated_at=?,updated_by=? WHERE template_key=?").bind(publishVersion, now, c.env.ADMIN_EMAIL, key)
    );
  } else if ((!rollback && target.status !== "DRAFT") || (rollback && !["PUBLISHED", "ARCHIVED"].includes(target.status))) {
    return c.json({ error: rollback ? "WHATSAPP_CONTENT_ROLLBACK_NOT_ALLOWED" : "WHATSAPP_CONTENT_PUBLISH_REQUIRES_DRAFT" }, 409);
  }
  const snapshotStatements = rollback ? [] : [
    c.env.DB.prepare("DELETE FROM whatsapp_content_version_media WHERE template_key=? AND version=?").bind(key, publishVersion),
    ...gallery.results.map((media) => c.env.DB.prepare("INSERT INTO whatsapp_content_version_media (template_key,version,media_id,active,sort_order,created_at,created_by) VALUES (?,?,?,?,?,?,?)").bind(key, publishVersion, media.id, Number(media.active) === 1 ? 1 : 0, Number(media.sort_order), now, c.env.ADMIN_EMAIL))
  ];
  const legacyMediaStatement = !rollback && gallery.results.length ? [c.env.DB.prepare("UPDATE whatsapp_content_template_versions SET media_r2_key=(SELECT r2_key FROM whatsapp_content_media WHERE id=?) WHERE template_key=? AND version=?").bind(gallery.results[0].id, key, publishVersion)] : [];
  const templatePublishStatement = rollback
    ? c.env.DB.prepare("UPDATE whatsapp_content_templates SET published_version=?,updated_at=?,updated_by=? WHERE template_key=?").bind(publishVersion, now, c.env.ADMIN_EMAIL, key)
    : c.env.DB.prepare("UPDATE whatsapp_content_templates SET published_version=?,draft_version=?,updated_at=?,updated_by=? WHERE template_key=?").bind(publishVersion, publishVersion, now, c.env.ADMIN_EMAIL, key);
  await c.env.DB.batch([
    ...cloneStatements,
    ...snapshotStatements,
    ...legacyMediaStatement,
    c.env.DB.prepare("UPDATE whatsapp_content_template_versions SET status='ARCHIVED' WHERE template_key=? AND status='PUBLISHED' AND version<>?").bind(key, publishVersion),
    c.env.DB.prepare("UPDATE whatsapp_content_template_versions SET status='PUBLISHED' WHERE template_key=? AND version=?").bind(key, publishVersion),
    templatePublishStatement,
    auditStatement(c.env.DB, rollback ? "WHATSAPP_CONTENT_ROLLED_BACK" : "WHATSAPP_CONTENT_PUBLISHED", "WHATSAPP_CONTENT_TEMPLATE", key, { version: publishVersion, sourceVersion: publishVersion === version ? undefined : version, previousPublishedVersion: template.published_version, mediaCount: rollback ? undefined : gallery.results.length }, now, c.env.ADMIN_EMAIL)
  ]);
  return c.json({ ok: true, templateKey: key, publishedVersion: publishVersion, rolledBack: rollback });
}

app.post("/api/whatsapp-content/:key/publish", (c) => publishWhatsAppContent(c, false));
app.post("/api/whatsapp-content/:key/rollback", (c) => publishWhatsAppContent(c, true));

 app.get("/meta-activation", (c) => c.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meta Activation | Get Free Seeds</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}.card{border:1px solid #ccc;border-radius:8px;padding:1rem;margin:1rem 0}pre{white-space:pre-wrap;background:#f6f6f6;padding:1rem}label{display:block;margin:.7rem 0}input,select{box-sizing:border-box;width:100%;padding:.5rem}button{padding:.5rem .8rem;margin:.2rem}.muted{color:#666}.warning{color:#8a4b00}</style></head><body><nav><a href='/'>Admin home</a></nav><h1>Meta activation</h1><p class="muted">Status is safe to reread. Graph actions use only the configured server token; OTP and PIN fields are transient and cleared after each attempt.</p><pre id="status">Loading...</pre><section class="card"><h2>Phone verification</h2><button id="request-code">Request SMS code (once)</button><label>OTP<input id="otp" type="password" inputmode="numeric" autocomplete="one-time-code"></label><button id="verify-code">Verify OTP</button></section><section class="card"><h2>Phone registration and app subscription</h2><label>Two-step PIN<input id="pin" type="password" inputmode="numeric" autocomplete="off"></label><button id="register">Register phone</button><button id="subscribe-app">Subscribe App to WABA</button></section><section class="card"><h2>Status-only checks</h2><button id="refresh">Refresh status</button><button id="controlled-test">Run controlled test</button><button id="send-test">Send fixed test message</button><p class="warning">The test message has one fixed recipient and message. No recipient input is accepted.</p></section><p id="result" role="status"></p><script>
 const status=document.querySelector('#status');const result=document.querySelector('#result');
 async function load(){const response=await fetch('/api/meta-activation/status');status.textContent=JSON.stringify(await response.json(),null,2)}
  async function action(name,payload={}){try{const response=await fetch('/api/meta-activation/actions/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();const failure=data.error||{};const detail=[failure.code||data.reason||'unknown',failure.subcode?'subcode='+failure.subcode:'',failure.status?'HTTP='+failure.status:'',failure.message||'',failure.fbtraceId?'trace='+failure.fbtraceId:''].filter(Boolean).join(' ');result.textContent=response.ok?(data.executed?('Action '+name+' applied; status reread safely.'):('Action '+name+' not applied: '+detail)):('Action '+name+' failed: '+detail);await load()}catch{result.textContent='Activation action unavailable'}}
 document.querySelector('#request-code').onclick=()=>action('request-code',{codeMethod:'SMS'});
 document.querySelector('#verify-code').onclick=async()=>{const input=document.querySelector('#otp');try{await action('verify-code',{otp:input.value})}finally{input.value=''}};
 document.querySelector('#register').onclick=async()=>{const input=document.querySelector('#pin');try{await action('register',{pin:input.value})}finally{input.value=''}};
  document.querySelector('#subscribe-app').onclick=()=>action('subscribe-app');
  const flowKeyButton=document.createElement('button');flowKeyButton.textContent='Register Flow public key';flowKeyButton.onclick=()=>action('flow-key');document.querySelector('#subscribe-app').after(flowKeyButton);
 document.querySelector('#refresh').onclick=load;
 document.querySelector('#controlled-test').onclick=()=>action('controlled-test');
  document.querySelector('#send-test').onclick=()=>action('send-test');
 load().catch(()=>status.textContent='Activation status unavailable');</script></body></html>`));

app.get("/api/meta-activation/status", async (c) => c.json(await metaActivation(c).status()));

app.get("/api/meta-activation/flows", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  if (!c.env.META_ACCESS_TOKEN || !c.env.META_WABA_ID) return c.json({ error: "META_GRAPH_NOT_CONFIGURED" }, 503);
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(c.env.META_WABA_ID)}/flows?fields=id,name,status,validation_errors,health_status,data_channel_uri,whatsapp_business_account,application`, { headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}` } });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  const data = Array.isArray(body.data) ? body.data.filter((item) => item && typeof item === "object").map((item) => { const flow = item as Record<string, unknown>; return { id: typeof flow.id === "string" ? flow.id : undefined, name: typeof flow.name === "string" ? flow.name : undefined, status: typeof flow.status === "string" ? flow.status : undefined, health_status: typeof flow.health_status === "string" ? flow.health_status : undefined, data_channel_uri: typeof flow.data_channel_uri === "string" ? flow.data_channel_uri : undefined, validation_errors: Array.isArray(flow.validation_errors) ? flow.validation_errors : [] }; }) : [];
  return c.json({ httpStatus: response.status, data, paging: body.paging ?? null, error: body.error && typeof body.error === "object" ? { code: (body.error as Record<string, unknown>).code, message: (body.error as Record<string, unknown>).message } : undefined }, response.ok ? 200 : 400);
});

app.get("/api/meta-activation/phone-coexistence", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  if (!c.env.META_ACCESS_TOKEN || !c.env.META_PHONE_NUMBER_ID) return c.json({ error: "META_GRAPH_NOT_CONFIGURED" }, 503);
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(c.env.META_PHONE_NUMBER_ID)}?fields=is_on_biz_app,platform_type`, { headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}` } });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({ httpStatus: response.status, is_on_biz_app: body.is_on_biz_app ?? null, platform_type: body.platform_type ?? null, error: body.error && typeof body.error === "object" ? { code: (body.error as Record<string, unknown>).code, message: (body.error as Record<string, unknown>).message } : undefined }, response.ok ? 200 : 400);
});

app.post("/api/meta-activation/flows/create", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  if (!c.env.META_ACCESS_TOKEN || !c.env.META_WABA_ID) return c.json({ error: "META_GRAPH_NOT_CONFIGURED" }, 503);
  const request = await c.req.json().catch(() => ({})) as { name?: string };
  const name = typeof request.name === "string" && /^[A-Za-z0-9 _-]{3,80}$/.test(request.name) ? request.name : "Get Free Seeds Commerce";
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(c.env.META_WABA_ID)}/flows`, { method: "POST", headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ name, categories: ["OTHER"] }) });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({ httpStatus: response.status, id: typeof body.id === "string" ? body.id : undefined, error: body.error && typeof body.error === "object" ? { code: (body.error as Record<string, unknown>).code, subcode: (body.error as Record<string, unknown>).error_subcode, message: (body.error as Record<string, unknown>).message, trace: (body.error as Record<string, unknown>).fbtrace_id } : undefined }, response.ok ? 200 : 400);
});

app.post("/api/meta-activation/flows/:id/assets", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  const flowId = c.req.param("id");
  const body = await c.req.json().catch(() => ({})) as { flowJson?: unknown };
  if (!body.flowJson || typeof body.flowJson !== "object") return c.json({ error: "FLOW_JSON_REQUIRED" }, 400);
  const form = new FormData();
  form.append("asset_type", "FLOW_JSON");
  form.append("name", "flow.json");
  form.append("file", new Blob([JSON.stringify(body.flowJson)], { type: "application/json" }), "flow.json");
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(flowId)}/assets`, { method: "POST", headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}` }, body: form });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({ httpStatus: response.status, result, error: result.error && typeof result.error === "object" ? { code: (result.error as Record<string, unknown>).code, message: (result.error as Record<string, unknown>).message, validation_errors: (result.error as Record<string, unknown>).error_data } : undefined }, response.ok ? 200 : 400);
});

app.post("/api/meta-activation/flows/:id/publish", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(c.req.param("id"))}/publish`, { method: "POST", headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}` } });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({ httpStatus: response.status, result, error: result.error && typeof result.error === "object" ? { code: (result.error as Record<string, unknown>).code, message: (result.error as Record<string, unknown>).message, validation_errors: (result.error as Record<string, unknown>).error_data } : undefined }, response.ok ? 200 : 400);
});

app.post("/api/meta-activation/flows/:id/endpoint", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  const version = c.env.META_GRAPH_VERSION ?? "v26.0";
  const endpointUri = "https://getfreeseeds-api-staging.get-free-seeds.workers.dev/webhooks/whatsapp/flows";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(c.req.param("id"))}`, { method: "POST", headers: { Authorization: `Bearer ${c.env.META_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ endpoint_uri: endpointUri }) });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({ httpStatus: response.status, endpointUri, result, error: result.error && typeof result.error === "object" ? { code: (result.error as Record<string, unknown>).code, subcode: (result.error as Record<string, unknown>).error_subcode, message: (result.error as Record<string, unknown>).message, trace: (result.error as Record<string, unknown>).fbtrace_id } : undefined }, response.ok ? 200 : 400);
});

app.post("/api/meta-activation/actions/:action", async (c) => {
  const rawAction = c.req.param("action");
  if (rawAction === "send-welcome-media-test") {
    if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
    const key = "welcome_media_test:923034901810:v6";
    const existing = await c.env.DB.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ status: string; provider_message_id: string | null }>();
    if (existing) return c.json({ executed: false, status: existing.status, messageId: existing.provider_message_id });
    const [ur, en] = await Promise.all([publishedWhatsAppContent(c.env.DB, "WELCOME", "ur", "WELCOME_TEST:923034901810"), publishedWhatsAppContent(c.env.DB, "WELCOME", "en", "WELCOME_TEST:923034901810")]);
    if (!ur || !en || !ur.mediaR2Key || !ur.mediaMimeType || !["image/jpeg", "image/png"].includes(ur.mediaMimeType)) return c.json({ executed: false, reason: "WELCOME_PUBLISHED_MEDIA_REQUIRED" }, 409);
    const object = await c.env.RECEIPTS.get(ur.mediaR2Key);
    if (!object) return c.json({ executed: false, reason: "WELCOME_R2_MEDIA_MISSING" }, 409);
    const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", phoneNumberId: c.env.META_PHONE_NUMBER_ID, accessToken: c.env.META_ACCESS_TOKEN, appSecret: c.env.META_APP_SECRET });
    const now = new Date().toISOString();
    await c.env.DB.prepare("INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, "WELCOME_MEDIA_TEST", "PENDING", 0, now, now).run();
    try { const sent = await provider.sendInteractive("+923034901810", `${ur.text}\n\n${en.text}`, [{ id: "LANG_UR", title: whatsAppActionLabel(ur, "LANG_UR") }, { id: "LANG_EN", title: whatsAppActionLabel(en, "LANG_EN") }], { body: await object.arrayBuffer(), mimeType: ur.mediaMimeType as "image/jpeg" | "image/png", filename: "welcome.jpg" }); await c.env.DB.prepare("UPDATE outbound_messages SET status='SENT',provider_message_id=?,attempt_count=1,updated_at=? WHERE idempotency_key=?").bind(sent.providerMessageId, new Date().toISOString(), key).run(); return c.json({ executed: true, messageId: sent.providerMessageId }); } catch (error) { const safe = error instanceof Error ? error.message.slice(0, 160) : "WELCOME_MEDIA_SEND_FAILED"; await c.env.DB.prepare("UPDATE outbound_messages SET status='FAILED',attempt_count=1,last_error=?,updated_at=? WHERE idempotency_key=?").bind(safe, new Date().toISOString(), key).run(); return c.json({ executed: false, reason: safe }, 502); }
  }
  if (rawAction === "retry-failed-reply") {
    if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
    const row = await c.env.DB.prepare("SELECT id,idempotency_key FROM outbound_messages WHERE idempotency_key LIKE 'welcome_reply:%' AND status='FAILED' AND provider_message_id IS NULL ORDER BY updated_at ASC LIMIT 1").first<{ id: string; idempotency_key: string }>();
    if (!row) return c.json({ executed: false, reason: "NO_FAILED_REPLY_ELIGIBLE" });
    const claim = await c.env.DB.prepare("UPDATE outbound_messages SET status='RETRYING',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND status='FAILED' AND provider_message_id IS NULL").bind(new Date().toISOString(), row.id).run();
    if (!claim.meta.changes) return c.json({ executed: false, reason: "REPLY_ALREADY_CLAIMED" });
    const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", phoneNumberId: c.env.META_PHONE_NUMBER_ID, accessToken: c.env.META_ACCESS_TOKEN, appSecret: c.env.META_APP_SECRET });
    try {
      const sent = await provider.sendText("+923034901810", "Welcome to Get Free Seeds! 🌱 Get 5 packs of vegetable seeds FREE. Reply START to begin your order.");
      await c.env.DB.prepare("UPDATE outbound_messages SET status='SENT',provider_message_id=?,updated_at=? WHERE id=?").bind(sent.providerMessageId, new Date().toISOString(), row.id).run();
      return c.json({ executed: true, messageId: sent.providerMessageId, idempotencyKey: row.idempotency_key });
    } catch (error) {
      const safe = error instanceof Error ? error.message.slice(0, 180) : "META_REPLY_FAILED";
      await c.env.DB.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE id=?").bind(safe, new Date().toISOString(), row.id).run();
      return c.json({ executed: false, reason: safe, idempotencyKey: row.idempotency_key }, 502);
    }
  }
  if (rawAction === "send-flow-test") {
    if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
    const flowId = c.env.META_FLOW_ID ?? "1133458765899784";
    const key = `flow_cta:${flowId}:923034901810`;
    const existing = await c.env.DB.prepare("SELECT status,provider_message_id FROM outbound_messages WHERE idempotency_key=?").bind(key).first<{ status: string; provider_message_id: string | null }>();
    if (existing) return c.json({ executed: false, reason: "FLOW_CTA_ALREADY_ATTEMPTED", status: existing.status, messageId: existing.provider_message_id });
    const now = new Date().toISOString();
    await c.env.DB.prepare("INSERT INTO outbound_messages (id,idempotency_key,kind,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), key, "FLOW_CTA", "PENDING", 0, now, now).run();
    const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", phoneNumberId: c.env.META_PHONE_NUMBER_ID, accessToken: c.env.META_ACCESS_TOKEN, appSecret: c.env.META_APP_SECRET });
    try {
      const sent = await provider.sendFlow("+923034901810", flowId, `GFS_FLOW_E2E_${flowId}`);
      await c.env.DB.prepare("UPDATE outbound_messages SET status='SENT',provider_message_id=?,attempt_count=1,updated_at=? WHERE idempotency_key=?").bind(sent.providerMessageId, new Date().toISOString(), key).run();
      return c.json({ executed: true, messageId: sent.providerMessageId });
    } catch (error) {
      const safe = error instanceof Error ? error.message.slice(0, 180) : "META_FLOW_SEND_FAILED";
      await c.env.DB.prepare("UPDATE outbound_messages SET status='FAILED',attempt_count=1,last_error=?,updated_at=? WHERE idempotency_key=?").bind(safe, new Date().toISOString(), key).run();
      return c.json({ executed: false, reason: safe }, 502);
    }
  }
  const action = rawAction as MetaActivationAction;
  const allowed: MetaActivationAction[] = ["phone-state", "waba-subscription", "webhook", "provider", "flow-key", "controlled-test", "send-test", "request-code", "request_code", "verify-code", "verify_code", "register", "subscribe-app"];
  if (!allowed.includes(action)) return c.json({ error: "META_ACTIVATION_ACTION_NOT_FOUND" }, 404);
  let body: Record<string, unknown> = {};
  try {
    const parsed = await c.req.json<unknown>();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return c.json({ error: "META_ACTIVATION_INVALID_REQUEST" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return c.json({ error: "META_ACTIVATION_INVALID_REQUEST" }, 400);
  }
  if (action === "send-test" && (Object.prototype.hasOwnProperty.call(body, "to") || Object.prototype.hasOwnProperty.call(body, "recipient"))) return c.json({ error: "META_SEND_TEST_RECIPIENT_FIXED" }, 400);
  // Only the narrow action inputs below reach the service. Secrets never reach logs, audits, or responses.
  const otp = typeof body.otp === "string" ? body.otp : typeof body.code === "string" ? body.code : undefined;
  const input = (action === "request-code" || action === "request_code")
    ? { codeMethod: body.codeMethod === "VOICE" ? "VOICE" as const : body.codeMethod === "SMS" ? "SMS" as const : undefined, language: typeof body.language === "string" ? body.language : undefined }
    : (action === "verify-code" || action === "verify_code")
      ? { otp }
      : action === "register"
        ? { pin: typeof body.pin === "string" ? body.pin : undefined }
        : {};
  return c.json(await metaActivation(c).action(action, input));
});

app.post("/api/meta-activation/actions/retry-failed-reply", async (c) => {
  if (!authorized(c)) return c.json({ error: "UNAUTHORIZED" }, 401);
  const row = await c.env.DB.prepare("SELECT id,idempotency_key FROM outbound_messages WHERE idempotency_key LIKE 'welcome_reply:%' AND status='FAILED' AND provider_message_id IS NULL ORDER BY updated_at ASC LIMIT 1").first<{ id: string; idempotency_key: string }>();
  if (!row) return c.json({ executed: false, reason: "NO_FAILED_REPLY_ELIGIBLE" });
  const claim = await c.env.DB.prepare("UPDATE outbound_messages SET status='RETRYING',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND status='FAILED' AND provider_message_id IS NULL").bind(new Date().toISOString(), row.id).run();
  if (!claim.meta.changes) return c.json({ executed: false, reason: "REPLY_ALREADY_CLAIMED" });
  const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", phoneNumberId: c.env.META_PHONE_NUMBER_ID, accessToken: c.env.META_ACCESS_TOKEN, appSecret: c.env.META_APP_SECRET });
  try {
    const sent = await provider.sendText("+923034901810", "Welcome to Get Free Seeds! 🌱 Get 5 packs of vegetable seeds FREE. Reply START to begin your order.");
    await c.env.DB.prepare("UPDATE outbound_messages SET status='SENT',provider_message_id=?,updated_at=? WHERE id=?").bind(sent.providerMessageId, new Date().toISOString(), row.id).run();
    return c.json({ executed: true, messageId: sent.providerMessageId, idempotencyKey: row.idempotency_key });
  } catch (error) {
    const safe = error instanceof Error ? error.message.slice(0, 180) : "META_REPLY_FAILED";
    await c.env.DB.prepare("UPDATE outbound_messages SET status='FAILED',last_error=?,updated_at=? WHERE id=?").bind(safe, new Date().toISOString(), row.id).run();
    return c.json({ executed: false, reason: safe, idempotencyKey: row.idempotency_key }, 502);
  }
});

app.get("/payment-amount", (c) => c.html(`<!doctype html><html><head><meta charset="utf-8"><title>Advance Amount | Get Free Seeds</title><style>body{font:16px system-ui;max-width:700px;margin:2rem auto;padding:0 1rem}label{display:block;margin:1rem 0}input{box-sizing:border-box;width:100%;padding:.6rem}button{padding:.6rem .9rem}.status{margin:1rem 0}.error{color:#b00020}.ok{color:green}</style></head><body><nav><a href='/'>Admin home</a> | <a href='/payment-settings'>Payment methods</a></nav><h1>Authoritative advance payment</h1><p>Set the positive PKR delivery/advance amount used for new payment requests. At least one complete enabled payment method is required.</p><label>Amount (PKR)<input id="amount" type="number" min="1" step="1" inputmode="numeric"></label><button id="save">Save amount</button><div id="status" class="status"></div><script>
 const amount=document.querySelector('#amount');const status=document.querySelector('#status');
 async function load(){const r=await fetch('/api/payment-configuration');const d=await r.json();amount.value=d.advanceAmountPkr??'';status.textContent=d.paymentMethodsConfigured?'':'Configure a complete enabled payment method before saving an amount.';status.className='status '+(d.paymentMethodsConfigured?'':'error')}
 document.querySelector('#save').onclick=async()=>{const value=Number(amount.value);const r=await fetch('/api/payment-configuration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({advanceAmountPkr:value})});const d=await r.json();status.textContent=r.ok?'Saved':'Unable to save: '+(d.error||'validation failed');status.className='status '+(r.ok?'ok':'error');if(r.ok)await load()};load().catch(()=>status.textContent='Payment configuration unavailable');</script></body></html>`));

app.get("/catalog", (c) => c.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalog | Get Free Seeds</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem}nav{margin-bottom:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.card{border:1px solid #ccc;border-radius:8px;padding:1rem}.card h2{margin-top:0}label{display:block;margin:.6rem 0}input{box-sizing:border-box;width:100%;padding:.5rem}button{padding:.5rem .8rem}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;align-items:end;border-top:1px solid #ddd;padding:1rem 0}.status{margin:.5rem 0}.error{color:#b00020}.ok{color:green}</style></head><body><nav><a href='/'>Admin home</a> | <a href='/payment-settings'>Payment methods</a></nav><h1>Catalog and delivery rates</h1><p>Only values saved here are used for dynamic quotes. New entries start disabled.</p><div class="grid"><section class="card"><h2>Products</h2><form id="product-form"><label>Code<input name="code" required></label><label>Name<input name="name" required></label><label>Category<input name="category" required></label><label>Price (PKR)<input name="pricePkr" type="number" min="1" step="1" required></label><label>Fertilizer price (PKR, optional)<input name="fertilizerPricePkr" type="number" min="1" step="1"></label><label><input name="active" type="checkbox"> Active</label><button>Save new product</button></form><div id="products" class="status">Loading...</div></section><section class="card"><h2>Province delivery rates</h2><form id="rate-form"><label>Province<input name="province" required></label><label>Delivery fee (PKR)<input name="deliveryFeePkr" type="number" min="1" step="1" required></label><label><input name="active" type="checkbox"> Active</label><button>Save new rate</button></form><div id="rates" class="status">Loading...</div></section></div><script>
 const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=(form,name)=>form.elements[name].type==='checkbox'?form.elements[name].checked:form.elements[name].value;
 const payload=(form,names)=>Object.fromEntries(names.map((name)=>[name,value(form,name)]));
 async function request(url,method,body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Save failed');return d}
  function productForm(item){return '<form class="row" data-product="'+esc(item.id)+'"><input name="code" value="'+esc(item.code)+'" required><input name="name" value="'+esc(item.name)+'" required><input name="category" value="'+esc(item.category)+'" required><input name="pricePkr" type="number" min="1" step="1" value="'+item.pricePkr+'" required><input name="fertilizerPricePkr" type="number" min="1" step="1" value="'+(item.fertilizerPricePkr??'')+'"><label><input name="active" type="checkbox" '+(item.active?'checked':'')+'> Active</label><button>Save</button><button type="button" data-toggle>'+(item.active?'Disable':'Enable')+'</button><span data-status></span></form>'}
  function rateForm(item){return '<form class="row" data-rate="'+esc(item.id)+'"><input name="province" value="'+esc(item.province)+'" required><input name="deliveryFeePkr" type="number" min="1" step="1" value="'+item.deliveryFeePkr+'" required><label><input name="active" type="checkbox" '+(item.active?'checked':'')+'> Active</label><button>Save</button><button type="button" data-toggle>'+(item.active?'Disable':'Enable')+'</button><span data-status></span></form>'}
 async function load(){const [products,rates]=await Promise.all([fetch('/api/catalog/products').then((r)=>r.json()),fetch('/api/catalog/province-delivery-rates').then((r)=>r.json())]);document.querySelector('#products').innerHTML=(products.products||[]).map(productForm).join('')||'No products configured.';document.querySelector('#rates').innerHTML=(rates.rates||[]).map(rateForm).join('')||'No delivery rates configured.';for(const form of document.querySelectorAll('[data-product]'))bind(form,'product');for(const form of document.querySelectorAll('[data-rate]'))bind(form,'rate')}
  function bind(form,type){const names=type==='product'?['code','name','category','pricePkr','fertilizerPricePkr','active']:['province','deliveryFeePkr','active'];const status=form.querySelector('[data-status]');const toggle=form.querySelector('[data-toggle]');form.onsubmit=async(e)=>{e.preventDefault();try{await request('/api/catalog/'+(type==='product'?'products/':'province-delivery-rates/')+form.dataset[type], 'PUT', payload(form,names));status.textContent='Saved';status.className='ok';toggle.textContent=form.elements.active.checked?'Disable':'Enable';}catch(error){status.textContent=error.message;status.className='error'}};toggle.onclick=()=>{form.elements.active.checked=!form.elements.active.checked;form.requestSubmit()}}
 document.querySelector('#product-form').onsubmit=async(e)=>{e.preventDefault();const form=e.currentTarget;try{await request('/api/catalog/products','POST',payload(form,['code','name','category','pricePkr','fertilizerPricePkr','active']));form.reset();await load()}catch(error){alert(error.message)}};
 document.querySelector('#rate-form').onsubmit=async(e)=>{e.preventDefault();const form=e.currentTarget;try{await request('/api/catalog/province-delivery-rates','POST',payload(form,['province','deliveryFeePkr','active']));form.reset();await load()}catch(error){alert(error.message)}};load().catch(()=>{document.querySelector('#products').textContent='Catalog unavailable';document.querySelector('#rates').textContent='Catalog unavailable'});
 </script></body></html>`));
app.get("/api/catalog/products", async (c) => {
  if (!c.env.DB) return c.json({ products: [] });
  const result = await c.env.DB.prepare("SELECT id,code,name,category,price_pkr,fertilizer_price_pkr,pack_quantity,enabled FROM products ORDER BY category,name,code").all();
  return c.json({ products: result.results.map((row) => productView(row as Record<string, unknown>)) });
});

app.get("/api/catalog/province-delivery-rates", async (c) => {
  if (!c.env.DB) return c.json({ rates: [] });
  const result = await c.env.DB.prepare("SELECT id,province,delivery_fee_pkr,enabled FROM province_delivery_rates ORDER BY province").all();
  return c.json({ rates: result.results.map((row) => rateView(row as Record<string, unknown>)) });
});

app.post("/api/catalog/products", async (c) => {
  let product;
  try {
    product = parseProductInput(await c.req.json<Record<string, unknown>>());
  } catch (error) {
    return c.json({ error: catalogError(error) }, 400);
  }
  const id = crypto.randomUUID();
  if (!c.env.DB) return c.json({ ok: true, simulated: true, product: { id, ...product } });
  const now = new Date().toISOString();
  try {
    await c.env.DB.batch([
       c.env.DB.prepare("INSERT INTO products (id,code,name,category,price_pkr,fertilizer_price_pkr,pack_quantity,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, product.code, product.name, product.category, product.pricePkr, product.fertilizerPricePkr, product.packQuantity, product.active ? 1 : 0, now, now),
      auditStatement(c.env.DB, "PRODUCT_CREATED", "PRODUCT", id, { code: product.code, category: product.category, pricePkr: product.pricePkr, fertilizerPricePkr: product.fertilizerPricePkr, active: product.active }, now, c.env.ADMIN_EMAIL)
    ]);
  } catch {
    return c.json({ error: "PRODUCT_ALREADY_EXISTS_OR_WRITE_FAILED" }, 409);
  }
  return c.json({ ok: true, product: { id, ...product } });
});

app.on(["POST", "PUT"], "/api/catalog/products/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "CATALOG_UNAVAILABLE" }, 503);
  const id = c.req.param("id");
   const existing = await c.env.DB.prepare("SELECT id,code,name,category,price_pkr,fertilizer_price_pkr,pack_quantity,enabled FROM products WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const product = parseProductInput({
      code: body.code ?? existing.code,
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      pricePkr: body.pricePkr ?? body.price_pkr ?? existing.price_pkr,
       fertilizerPricePkr: Object.prototype.hasOwnProperty.call(body, "fertilizerPricePkr") ? body.fertilizerPricePkr : Object.prototype.hasOwnProperty.call(body, "fertilizer_price_pkr") ? body.fertilizer_price_pkr : existing.fertilizer_price_pkr,
       packQuantity: body.packQuantity ?? body.pack_quantity ?? existing.pack_quantity,
      active: body.active ?? body.enabled ?? Number(existing.enabled) === 1
    });
    const now = new Date().toISOString();
    await c.env.DB.batch([
       c.env.DB.prepare("UPDATE products SET code=?,name=?,category=?,price_pkr=?,fertilizer_price_pkr=?,pack_quantity=?,enabled=?,updated_at=? WHERE id=?").bind(product.code, product.name, product.category, product.pricePkr, product.fertilizerPricePkr, product.packQuantity, product.active ? 1 : 0, now, id),
      auditStatement(c.env.DB, "PRODUCT_UPDATED", "PRODUCT", id, { code: product.code, category: product.category, pricePkr: product.pricePkr, fertilizerPricePkr: product.fertilizerPricePkr, active: product.active }, now, c.env.ADMIN_EMAIL)
    ]);
    return c.json({ ok: true, product: { id, ...product } });
  } catch (error) {
    if (error instanceof Error && /^CATALOG_|^PRODUCT_|^FERTILIZER_/.test(error.message)) return c.json({ error: catalogError(error) }, 400);
    return c.json({ error: "PRODUCT_ALREADY_EXISTS_OR_WRITE_FAILED" }, 409);
  }
});

app.post("/api/catalog/province-delivery-rates", async (c) => {
  let rate;
  try {
    rate = parseProvinceDeliveryRateInput(await c.req.json<Record<string, unknown>>());
  } catch (error) {
    return c.json({ error: catalogError(error) }, 400);
  }
  const id = crypto.randomUUID();
  if (!c.env.DB) return c.json({ ok: true, simulated: true, rate: { id, ...rate } });
  const now = new Date().toISOString();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO province_delivery_rates (id,province,delivery_fee_pkr,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(id, rate.province, rate.deliveryFeePkr, rate.active ? 1 : 0, now, now),
      auditStatement(c.env.DB, "PROVINCE_DELIVERY_RATE_CREATED", "PROVINCE_DELIVERY_RATE", id, { province: rate.province, deliveryFeePkr: rate.deliveryFeePkr, active: rate.active }, now, c.env.ADMIN_EMAIL)
    ]);
  } catch {
    return c.json({ error: "PROVINCE_ALREADY_EXISTS_OR_WRITE_FAILED" }, 409);
  }
  return c.json({ ok: true, rate: { id, ...rate } });
});

app.on(["POST", "PUT"], "/api/catalog/province-delivery-rates/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "CATALOG_UNAVAILABLE" }, 503);
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id,province,delivery_fee_pkr,enabled FROM province_delivery_rates WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "PROVINCE_DELIVERY_RATE_NOT_FOUND" }, 404);
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const rate = parseProvinceDeliveryRateInput({
      province: body.province ?? existing.province,
      deliveryFeePkr: body.deliveryFeePkr ?? body.delivery_fee_pkr ?? existing.delivery_fee_pkr,
      active: body.active ?? body.enabled ?? Number(existing.enabled) === 1
    });
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE province_delivery_rates SET province=?,delivery_fee_pkr=?,enabled=?,updated_at=? WHERE id=?").bind(rate.province, rate.deliveryFeePkr, rate.active ? 1 : 0, now, id),
      auditStatement(c.env.DB, "PROVINCE_DELIVERY_RATE_UPDATED", "PROVINCE_DELIVERY_RATE", id, { province: rate.province, deliveryFeePkr: rate.deliveryFeePkr, active: rate.active }, now, c.env.ADMIN_EMAIL)
    ]);
    return c.json({ ok: true, rate: { id, ...rate } });
  } catch (error) {
    if (error instanceof Error && /^CATALOG_|^DELIVERY_|^PROVINCE_/.test(error.message)) return c.json({ error: catalogError(error) }, 400);
    return c.json({ error: "PROVINCE_ALREADY_EXISTS_OR_WRITE_FAILED" }, 409);
  }
});

app.get("/api/leads", async (c) => {
  if (!c.env.DB) return c.json({ leads: [] });
  const source = c.req.query("source");
  const query = "SELECT l.id AS lead_id, l.status, l.capi_event_id, o.id AS order_id, o.order_number, o.state AS order_state, c.full_name, c.city, ls.source, ls.provider_lead_id, ls.meta_form_id, ls.provider_created_time, ls.campaign_id, ls.ad_set_id, ls.ad_id FROM leads l JOIN orders o ON o.id=l.order_id JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_sources ls ON ls.lead_id=l.id" + (source ? " WHERE ls.source=?" : "") + " ORDER BY l.created_at DESC";
  const result = source ? await c.env.DB.prepare(query).bind(source).all() : await c.env.DB.prepare(query).all();
  return c.json({ leads: result.results });
});

app.get("/api/payment-methods", async (c) => {
  if (!c.env.DB) return c.json({ paymentMethods: [] });
  const result = await c.env.DB.prepare("SELECT pm.*,EXISTS(SELECT 1 FROM payment_qr_assets qa WHERE qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'') AS qr_asset_verified FROM payment_methods pm ORDER BY pm.sort_order, pm.method").all();
   return c.json({ paymentMethods: result.results.map((row) => { const values = row as Record<string, unknown>; const method = normalizePaymentMethodRow(values); const translationWarnings: string[] = []; const englishCopy = [method.heading, method.instructions, method.referenceInstruction, method.shortInstructions, method.receiptInstructions, method.paymentHelpCopy, method.statusCopy]; if (englishCopy.some((value) => value && /[\u0600-\u06ff]/u.test(value))) translationWarnings.push("PAYMENT_COPY_LANGUAGE_MIXED"); if (!method.instructions?.trim() || !method.receiptInstructions?.trim()) translationWarnings.push("PAYMENT_ENGLISH_TRANSLATION_MISSING"); if (!hasPaymentMessagePlaceholders(method, "en") || !hasPaymentMessagePlaceholders(method, "ur")) translationWarnings.push("PAYMENT_COPY_PLACEHOLDER_MISSING"); if (!method.headingUr?.trim() || !method.instructionsUr?.trim() || !method.referenceInstructionUr?.trim() || !method.receiptInstructionsUr?.trim()) translationWarnings.push("PAYMENT_URDU_TRANSLATION_MISSING"); return { ...method, translationWarnings, qrDeliveryStatus: method.qrR2Key ? (method.qrOwnerVerified && Number(values.qr_asset_verified) === 1 ? "READY" : "BLOCKED_OWNERSHIP_UNVERIFIED") : "TEXT_ONLY" }; }) });
});

app.get("/api/payment-configuration", async (c) => {
  if (!c.env.DB) return c.json({ advanceAmountPkr: null, paymentMethodsConfigured: false });
  const [configuration, methods] = await Promise.all([
    c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>(),
    c.env.DB.prepare("SELECT pm.* FROM payment_methods pm JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE pm.enabled=1 AND pm.qr_owner_verified=1 ORDER BY pm.sort_order, pm.method").all()
  ]);
  const configs = methods.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>));
  return c.json({ advanceAmountPkr: configuration?.advance_amount_pkr == null ? null : Number(configuration.advance_amount_pkr), paymentMethodsConfigured: hasCompleteEnabledPaymentMethod(configs) });
});

app.post("/api/payment-configuration", async (c) => {
  let amount: number;
  try {
    const body = await c.req.json<{ advanceAmountPkr?: unknown }>();
    amount = validatePaymentAmount(body.advanceAmountPkr);
  } catch (error) {
    return c.json({ error: error instanceof Error && error.message === "PAYMENT_AMOUNT_INVALID" ? error.message : "PAYMENT_AMOUNT_INVALID" }, 400);
  }
  if (!c.env.DB) return c.json({ ok: true, simulated: true, advanceAmountPkr: amount });
  const methods = await c.env.DB.prepare("SELECT pm.* FROM payment_methods pm JOIN payment_qr_assets qa ON qa.method=pm.method AND qa.derivative_r2_key=pm.qr_r2_key AND qa.active=1 AND qa.decoder_agreement=1 AND qa.payload_match=1 AND qa.scan_pass=1 AND qa.independent_ownership_verified=1 AND qa.independent_evidence_ref IS NOT NULL AND TRIM(qa.independent_evidence_ref)<>'' WHERE pm.enabled=1 AND pm.qr_owner_verified=1").all();
  const configs = methods.results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>));
  if (!hasCompleteEnabledPaymentMethod(configs)) return c.json({ error: "PAYMENT_METHOD_NOT_CONFIGURED" }, 400);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO payment_configuration (id,advance_amount_pkr,updated_at,updated_by) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET advance_amount_pkr=excluded.advance_amount_pkr,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(amount, now, c.env.ADMIN_EMAIL),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_CONFIGURATION_UPDATED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_CONFIGURATION", "1", crypto.randomUUID(), JSON.stringify({ advanceAmountPkr: amount }), now)
  ]);
  return c.json({ ok: true, advanceAmountPkr: amount });
});

app.get("/api/configuration", async (c) => {
  const methods = c.env.DB ? (await c.env.DB.prepare("SELECT * FROM payment_methods ORDER BY sort_order, method").all()).results.map((row) => normalizePaymentMethodRow(row as Record<string, unknown>)) : [];
  const amount = c.env.DB ? await c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>() : null;
  const advanceAmountPkr = amount?.advance_amount_pkr == null ? null : Number(amount.advance_amount_pkr);
  return c.json({ advanceAmountPkr, paymentMethods: methods.map((method) => { const instructions = paymentInstructions(method); return advanceAmountPkr && advanceAmountPkr > 0 ? instructions : { ...instructions, configured: false }; }), whatsappState: c.env.DEPLOYMENT_STATE, metaProviderEnabled: false });
});

app.post("/api/payment-methods/:method", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  const body = await c.req.json<{ recipientName?: unknown; tillId?: unknown; instructions?: unknown; instructionsUr?: unknown; referenceInstruction?: unknown; referenceInstructionUr?: unknown; heading?: unknown; headingUr?: unknown; qrCaption?: unknown; qrCaptionUr?: unknown; shortInstructions?: unknown; shortInstructionsUr?: unknown; receiptInstructions?: unknown; receiptInstructionsUr?: unknown; paymentHelpCopy?: unknown; paymentHelpCopyUr?: unknown; statusCopy?: unknown; statusCopyUr?: unknown; enabled?: unknown; sortOrder?: unknown; qrOwnerVerified?: unknown }>();
  if (Object.hasOwn(body, "qrOwnerVerified")) return c.json({ error: "QR_OWNERSHIP_REQUIRES_INDEPENDENT_EVIDENCE" }, 400);
  const current = c.env.DB ? await c.env.DB.prepare("SELECT * FROM payment_methods WHERE method=?").bind(method).first<Record<string, unknown>>() : undefined;
  try {
    const candidate = {
      id: String(current?.id ?? `payment-method-${method.toLowerCase()}`),
      method,
      displayName: String(current?.display_name ?? (method === "BANK_TRANSFER" ? "Bank Transfer" : method === "EASYPAISA" ? "Easypaisa" : "JazzCash")),
      recipientName: paymentCopy(body.recipientName, current?.recipient_name),
      tillId: paymentCopy(body.tillId, current?.till_id),
      instructions: paymentCopy(body.instructions, current?.instructions),
      instructionsUr: paymentCopy(body.instructionsUr, current?.instructions_ur),
      referenceInstruction: paymentCopy(body.referenceInstruction, current?.reference_instruction),
      referenceInstructionUr: paymentCopy(body.referenceInstructionUr, current?.reference_instruction_ur),
      heading: paymentCopy(body.heading, current?.heading),
      headingUr: paymentCopy(body.headingUr, current?.heading_ur),
      qrCaption: paymentCopy(body.qrCaption, current?.qr_caption),
      qrCaptionUr: paymentCopy(body.qrCaptionUr, current?.qr_caption_ur),
      shortInstructions: paymentCopy(body.shortInstructions, current?.short_instructions),
      shortInstructionsUr: paymentCopy(body.shortInstructionsUr, current?.short_instructions_ur),
      receiptInstructions: paymentCopy(body.receiptInstructions, current?.receipt_instructions),
      receiptInstructionsUr: paymentCopy(body.receiptInstructionsUr, current?.receipt_instructions_ur),
      paymentHelpCopy: paymentCopy(body.paymentHelpCopy, current?.payment_help_copy),
      paymentHelpCopyUr: paymentCopy(body.paymentHelpCopyUr, current?.payment_help_copy_ur),
      statusCopy: paymentCopy(body.statusCopy, current?.status_copy),
      statusCopyUr: paymentCopy(body.statusCopyUr, current?.status_copy_ur),
      enabled: body.enabled === undefined ? Number(current?.enabled ?? 0) === 1 : body.enabled === true,
      sortOrder: body.sortOrder === undefined ? Number(current?.sort_order ?? 100) : Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 100,
    };
    const recipientChanged = Boolean(current) && ((candidate.recipientName ?? null) !== (current?.recipient_name ?? null) || (candidate.tillId ?? null) !== (current?.till_id ?? null));
    if (recipientChanged) candidate.enabled = false;
    validatePaymentLocaleCopy(candidate);
   if (candidate.enabled && !isPaymentMethodComplete(candidate)) return c.json({ error: "PAYMENT_METHOD_INCOMPLETE", message: "Enabled payment methods require a recipient name and instructions." }, 400);
   if (candidate.enabled && (!candidate.headingUr?.trim() || !candidate.instructionsUr?.trim() || !candidate.referenceInstructionUr?.trim() || !candidate.receiptInstructionsUr?.trim())) return c.json({ error: "PAYMENT_URDU_TRANSLATION_MISSING", message: "Add a distinct Urdu heading, payment instruction, reference instruction, and receipt instruction before enabling this method." }, 400);
   if (candidate.enabled && (!hasPaymentMessagePlaceholders(candidate, "en") || !hasPaymentMessagePlaceholders(candidate, "ur"))) return c.json({ error: "PAYMENT_COPY_PLACEHOLDER_MISSING", message: "English and Urdu instructions must include {amount}, {recipientName}, {orderNumber}, and {tillId} when an account identifier is configured." }, 400);
   if (candidate.enabled && !isPaymentMethodLocaleComplete(candidate, "ur")) return c.json({ error: "PAYMENT_URDU_TRANSLATION_MISSING", message: "Complete the Urdu copy before enabling this method." }, 400);
   if (candidate.enabled) {
     const ownership = current && Number(current.qr_owner_verified) === 1 && current.qr_r2_key
       ? await c.env.DB?.prepare("SELECT 1 FROM payment_qr_assets WHERE method=? AND derivative_r2_key=? AND active=1 AND decoder_agreement=1 AND payload_match=1 AND scan_pass=1 AND independent_ownership_verified=1 AND independent_evidence_ref IS NOT NULL AND TRIM(independent_evidence_ref)<>''").bind(method, current.qr_r2_key).first()
       : undefined;
     if (!ownership) return c.json({ error: "PAYMENT_RECIPIENT_OWNERSHIP_UNVERIFIED", message: "Do not enable this payment method until independent recipient evidence is recorded for its QR asset." }, 400);
   }
    if (!c.env.DB) return c.json({ ok: true, simulated: true, configured: isPaymentMethodComplete(candidate) });
    const now = new Date().toISOString();
    if (recipientChanged) {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE payment_methods SET enabled=0,qr_owner_verified=0,updated_at=?,updated_by=? WHERE method=?").bind(now, c.env.ADMIN_EMAIL, method),
        c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_RECIPIENT_CHANGE_REVERIFICATION_STARTED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, methodDisabled: true, independentReverificationRequired: true }), now)
      ]);
    }
    const enabledChanged = current && body.enabled !== undefined && candidate.enabled !== (Number(current.enabled ?? 0) === 1);
    if (current && !recipientChanged && !enabledChanged) {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE payment_methods SET instructions=?,instructions_ur=?,reference_instruction=?,reference_instruction_ur=?,heading=?,heading_ur=?,qr_caption=?,qr_caption_ur=?,short_instructions=?,short_instructions_ur=?,receipt_instructions=?,receipt_instructions_ur=?,payment_help_copy=?,payment_help_copy_ur=?,status_copy=?,status_copy_ur=?,sort_order=?,updated_at=?,updated_by=? WHERE method=?").bind(candidate.instructions ?? null, candidate.instructionsUr ?? null, candidate.referenceInstruction ?? null, candidate.referenceInstructionUr ?? null, candidate.heading ?? null, candidate.headingUr ?? null, candidate.qrCaption ?? null, candidate.qrCaptionUr ?? null, candidate.shortInstructions ?? null, candidate.shortInstructionsUr ?? null, candidate.receiptInstructions ?? null, candidate.receiptInstructionsUr ?? null, candidate.paymentHelpCopy ?? null, candidate.paymentHelpCopyUr ?? null, candidate.statusCopy ?? null, candidate.statusCopyUr ?? null, candidate.sortOrder, now, c.env.ADMIN_EMAIL, method),
        c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_METHOD_UPDATED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, requestedEnabled: candidate.enabled, sortOrder: candidate.sortOrder }), now)
      ]);
      const saved = await c.env.DB.prepare("SELECT enabled,qr_owner_verified FROM payment_methods WHERE method=?").bind(method).first<{ enabled: number; qr_owner_verified: number }>();
      const enabled = Number(saved?.enabled ?? 0) === 1;
      const qrOwnerVerified = Number(saved?.qr_owner_verified ?? 0) === 1;
      return c.json({ ok: true, configured: enabled && qrOwnerVerified && isPaymentMethodComplete(candidate), enabled, qrOwnerVerified, reverificationRequired: false });
    }
   await c.env.DB.batch([
     c.env.DB.prepare("INSERT INTO payment_methods (id,method,display_name,recipient_name,till_id,instructions,instructions_ur,reference_instruction,reference_instruction_ur,heading,heading_ur,qr_caption,qr_caption_ur,short_instructions,short_instructions_ur,receipt_instructions,receipt_instructions_ur,payment_help_copy,payment_help_copy_ur,status_copy,status_copy_ur,enabled,sort_order,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(method) DO UPDATE SET recipient_name=excluded.recipient_name,till_id=excluded.till_id,instructions=excluded.instructions,instructions_ur=excluded.instructions_ur,reference_instruction=excluded.reference_instruction,reference_instruction_ur=excluded.reference_instruction_ur,heading=excluded.heading,heading_ur=excluded.heading_ur,qr_caption=excluded.qr_caption,qr_caption_ur=excluded.qr_caption_ur,short_instructions=excluded.short_instructions,short_instructions_ur=excluded.short_instructions_ur,receipt_instructions=excluded.receipt_instructions,receipt_instructions_ur=excluded.receipt_instructions_ur,payment_help_copy=excluded.payment_help_copy,payment_help_copy_ur=excluded.payment_help_copy_ur,status_copy=excluded.status_copy,status_copy_ur=excluded.status_copy_ur,enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(candidate.id, candidate.method, candidate.displayName, candidate.recipientName ?? null, candidate.tillId ?? null, candidate.instructions ?? null, candidate.instructionsUr ?? null, candidate.referenceInstruction ?? null, candidate.referenceInstructionUr ?? null, candidate.heading ?? null, candidate.headingUr ?? null, candidate.qrCaption ?? null, candidate.qrCaptionUr ?? null, candidate.shortInstructions ?? null, candidate.shortInstructionsUr ?? null, candidate.receiptInstructions ?? null, candidate.receiptInstructionsUr ?? null, candidate.paymentHelpCopy ?? null, candidate.paymentHelpCopyUr ?? null, candidate.statusCopy ?? null, candidate.statusCopyUr ?? null, candidate.enabled ? 1 : 0, candidate.sortOrder, now, c.env.ADMIN_EMAIL),
      c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_METHOD_UPDATED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, requestedEnabled: candidate.enabled, sortOrder: candidate.sortOrder }), now)
   ]);
    const saved = await c.env.DB.prepare("SELECT enabled,qr_owner_verified FROM payment_methods WHERE method=?").bind(method).first<{ enabled: number; qr_owner_verified: number }>();
    const enabled = Number(saved?.enabled ?? 0) === 1;
    const qrOwnerVerified = Number(saved?.qr_owner_verified ?? 0) === 1;
    return c.json({ ok: true, configured: enabled && qrOwnerVerified && isPaymentMethodComplete(candidate), enabled, qrOwnerVerified, reverificationRequired: recipientChanged });
   } catch (error) {
      const code = error instanceof Error && ["PAYMENT_COPY_INVALID", "PAYMENT_COPY_LANGUAGE_MIXED", "PAYMENT_URDU_TRANSLATION_DUPLICATED", "PAYMENT_URDU_TRANSLATION_MISSING"].includes(error.message) ? error.message : "PAYMENT_METHOD_INVALID";
      const message = code === "PAYMENT_COPY_LANGUAGE_MIXED" ? "Move Urdu text to its matching Urdu field; English fields must use English text." : code === "PAYMENT_URDU_TRANSLATION_DUPLICATED" ? "Enter an Urdu translation instead of repeating the English field." : code === "PAYMENT_URDU_TRANSLATION_MISSING" ? "Enter Urdu-script copy in the matching Urdu field." : "Check the payment settings and try again.";
      return c.json({ error: code, message }, 400);
   }
});

app.post("/api/payment-methods/:method/qr", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const mimeType = c.req.header("content-type")?.split(";", 1)[0] ?? "";
  const body = await c.req.arrayBuffer();
  try {
    const stored = await storePaymentQr(c.env.RECEIPTS, method, body, mimeType);
    const now = new Date().toISOString();
    try {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE payment_methods SET qr_r2_key=?, qr_sha256=?, qr_mime_type=?, qr_size_bytes=?, qr_owner_verified=0, updated_at=?, updated_by=? WHERE method=?").bind(stored.objectKey, stored.sha256, mimeType, stored.sizeBytes, now, c.env.ADMIN_EMAIL, method),
        c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_QR_REPLACED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT_METHOD", method, crypto.randomUUID(), JSON.stringify({ method, sha256: stored.sha256, sizeBytes: stored.sizeBytes }), now)
      ]);
    } catch (error) {
      throw error;
    }
    return c.json({ ok: true, method, qrR2Key: stored.objectKey, sha256: stored.sha256, sizeBytes: stored.sizeBytes });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "PAYMENT_QR_UPLOAD_FAILED" }, 400);
  }
});

app.get("/api/payment-methods/:method/qr", async (c) => {
  const method = PaymentMethod.parse(c.req.param("method").toUpperCase());
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const row = await c.env.DB.prepare("SELECT qr_r2_key, qr_mime_type FROM payment_methods WHERE method=?").bind(method).first<{ qr_r2_key?: string; qr_mime_type?: string }>();
  if (!row?.qr_r2_key) return c.json({ error: "PAYMENT_QR_NOT_CONFIGURED" }, 404);
  const object = await c.env.RECEIPTS.get(row.qr_r2_key);
  if (!object) return c.json({ error: "PAYMENT_QR_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": row.qr_mime_type ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

const ORDER_ADMIN_SELECT = `SELECT o.id,o.order_number,o.state,o.payment_status,o.total_payable,o.province,o.created_at,o.updated_at,
  o.cancelled_at,o.cancelled_by,o.cancellation_reason,o.archived_at,o.archived_by,o.archive_reason,
  (SELECT created_at FROM audit_log confirmation WHERE confirmation.entity_type='ORDER' AND confirmation.entity_id=o.id AND confirmation.action='ORDER_CONFIRMED' ORDER BY confirmation.created_at DESC LIMIT 1) AS order_confirmed_at,
  c.full_name,c.delivery_address,c.nearby_place,c.city,c.contact_number,c.normalized_phone,c.normalized_contact_number,c.whatsapp_number,c.normalized_whatsapp_number,c.wa_id,
  p.id AS payment_id,p.method,p.expected_amount,p.approved_amount,p.review_state,p.submitted_at,p.approved_by,p.approved_at,p.rejection_reason,p.customer_transaction_reference,p.created_at AS payment_created_at,p.updated_at AS payment_updated_at,
  (SELECT COUNT(*) FROM payment_receipts receipt_count WHERE receipt_count.order_id=o.id) AS receipt_count,
  COALESCE((SELECT json_group_array(json_object('id',items.id,'itemType',items.item_type,'productCode',items.product_code,'description',items.description,'quantity',items.quantity,'unitPricePkr',items.unit_price_pkr,'lineTotalPkr',items.line_total_pkr,'createdAt',items.created_at)) FROM order_items items WHERE items.order_id=o.id),'[]') AS items_json,
  COALESCE((SELECT json_group_array(json_object('id',receipts.id,'paymentId',receipts.payment_id,'objectKey',receipts.r2_object_key,'mimeType',receipts.mime_type,'sizeBytes',receipts.size_bytes,'submittedAt',receipts.submitted_at,'createdAt',receipts.created_at)) FROM payment_receipts receipts WHERE receipts.order_id=o.id),'[]') AS receipts_json
  FROM orders o JOIN customers c ON c.id=o.customer_id
  LEFT JOIN payments p ON p.order_id=o.id`;

const ORDER_TAB_SQL: Record<string, string> = {
  all: "1=1",
  verify: "o.state='PAYMENT_REVIEW' AND p.review_state='REVIEW'",
  confirmed: "(p.review_state='APPROVED' OR o.payment_status='PAID')",
  fulfillment: "o.state IN ('PAID','PACKING','DISPATCHED','DELIVERED')"
};

app.get("/api/orders", async (c) => {
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  const tab = c.req.query("tab")?.trim() || "all";
  if (!ORDER_TAB_SQL[tab]) return c.json({ error: "ORDER_TAB_INVALID" }, 400);
  const archived = c.req.query("archived") ?? "active";
  if (!["active", "only", "all"].includes(archived)) return c.json({ error: "ARCHIVED_FILTER_INVALID" }, 400);
  const paymentStatus = c.req.query("paymentStatus")?.trim();
  if (paymentStatus && !["PENDING", "REVIEW", "APPROVED", "REJECTED"].includes(paymentStatus)) return c.json({ error: "PAYMENT_STATUS_INVALID" }, 400);
  const fulfillment = c.req.query("fulfillment")?.trim();
  if (fulfillment && !["NOT_STARTED", "PACKING", "DISPATCHED", "DELIVERED", "CANCELLED"].includes(fulfillment)) return c.json({ error: "FULFILLMENT_FILTER_INVALID" }, 400);
  const date = c.req.query("date")?.trim();
  if (date && !validOrderDate(date)) return c.json({ error: "ORDER_DATE_INVALID" }, 400);
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = Number(c.req.query("pageSize") ?? "25");
  if (!Number.isInteger(page) || page < 1) return c.json({ error: "PAGE_INVALID" }, 400);
  if (![25, 50, 100].includes(pageSize)) return c.json({ error: "PAGE_SIZE_INVALID" }, 400);
  const search = c.req.query("q")?.trim().slice(0, 100);
  const commonWhere: string[] = [];
  const commonBindings: unknown[] = [];
  if (paymentStatus === "PENDING") commonWhere.push("p.review_state='PENDING'");
  if (paymentStatus === "REVIEW") commonWhere.push("p.review_state='REVIEW'");
  if (paymentStatus === "APPROVED") commonWhere.push("(p.review_state='APPROVED' OR o.payment_status='PAID')");
  if (paymentStatus === "REJECTED") commonWhere.push("(p.review_state='REJECTED' OR o.payment_status='REJECTED')");
  if (fulfillment === "NOT_STARTED") commonWhere.push("o.state='PAID'");
  if (fulfillment && fulfillment !== "NOT_STARTED") { commonWhere.push("o.state=?"); commonBindings.push(fulfillment); }
  if (date) { commonWhere.push("substr(o.created_at,1,10)=?"); commonBindings.push(date); }
  if (archived === "active") commonWhere.push("o.archived_at IS NULL");
  if (archived === "only") commonWhere.push("o.archived_at IS NOT NULL");
  if (search) {
    const normalizedPhone = normalizeWhatsAppWaId(search);
    const pattern = `%${search}%`;
    if (normalizedPhone) {
      commonWhere.push("(o.order_number LIKE ? OR c.full_name LIKE ? OR c.city LIKE ? OR c.wa_id LIKE ? OR c.normalized_phone LIKE ? OR c.normalized_contact_number LIKE ? OR c.normalized_whatsapp_number LIKE ?)");
      const digitsPattern = `%${normalizedPhone}%`;
      const internationalPattern = `%+${normalizedPhone}%`;
      commonBindings.push(pattern, pattern, pattern, digitsPattern, internationalPattern, internationalPattern, internationalPattern);
    } else {
      commonWhere.push("(o.order_number LIKE ? OR c.full_name LIKE ? OR c.city LIKE ?)");
      commonBindings.push(pattern, pattern, pattern);
    }
  }
  const joins = " FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN payments p ON p.order_id=o.id";
  const commonSql = commonWhere.length ? ` WHERE ${commonWhere.join(" AND ")}` : "";
  const tabWhere = [...commonWhere, ORDER_TAB_SQL[tab]];
  const tabSql = ` WHERE ${tabWhere.join(" AND ")}`;
  const offset = (page - 1) * pageSize;
  const [countsRow, totalRow, result] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS all_count,SUM(CASE WHEN ${ORDER_TAB_SQL.verify} THEN 1 ELSE 0 END) AS verify_count,SUM(CASE WHEN ${ORDER_TAB_SQL.confirmed} THEN 1 ELSE 0 END) AS confirmed_count,SUM(CASE WHEN ${ORDER_TAB_SQL.fulfillment} THEN 1 ELSE 0 END) AS fulfillment_count${joins}${commonSql}`).bind(...commonBindings).first<Record<string, unknown>>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total${joins}${tabSql}`).bind(...commonBindings).first<{ total: number }>(),
    c.env.DB.prepare(`${ORDER_ADMIN_SELECT}${tabSql} ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?`).bind(...commonBindings, pageSize, offset).all()
  ]);
  const total = Number(totalRow?.total ?? 0);
  return c.json({
    orders: result.results.map((row) => orderView(row as Record<string, unknown>)),
    counts: { all: Number(countsRow?.all_count ?? 0), verify: Number(countsRow?.verify_count ?? 0), confirmed: Number(countsRow?.confirmed_count ?? 0), fulfillment: Number(countsRow?.fulfillment_count ?? 0) },
    total,
    pagination: { page, pageSize, totalPages: Math.ceil(total / pageSize) }
  });
});

app.get("/api/orders/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  const row = await c.env.DB.prepare(`${ORDER_ADMIN_SELECT} WHERE o.id=?`).bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!row) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  const audit = await c.env.DB.prepare("SELECT id,action,actor_type,actor_id,metadata_json,created_at FROM audit_log WHERE (entity_type='ORDER' AND entity_id=?) OR (entity_type='PAYMENT' AND entity_id=(SELECT id FROM payments WHERE order_id=?)) ORDER BY created_at DESC LIMIT 100").bind(c.req.param("id"), c.req.param("id")).all();
  const order = orderView(row);
  order.trackingNumber = await assignedTrackingNumber(c.env.DB, c.req.param("id")) ?? order.trackingNumber;
  return c.json({ order, items: order.items, receipts: order.receipts, audit: audit.results });
});

app.get("/api/test-controls/conversations", async (c) => {
  if (!c.env.DB) return c.json({ conversations: [] });
  const search = c.req.query("q")?.trim().slice(0, 40);
  const result = search
    ? await c.env.DB.prepare("SELECT wa_id,state,last_inbound_message_id,last_inbound_at,created_at,updated_at FROM whatsapp_conversations WHERE wa_id LIKE ? ORDER BY updated_at DESC LIMIT 100").bind(`%${search}%`).all()
    : await c.env.DB.prepare("SELECT wa_id,state,last_inbound_message_id,last_inbound_at,created_at,updated_at FROM whatsapp_conversations ORDER BY updated_at DESC LIMIT 100").all();
  return c.json({ conversations: result.results });
});

app.get("/api/test-controls/conversations/:waId", async (c) => {
  if (!c.env.DB) return c.json({ error: "TEST_CONTROLS_UNAVAILABLE" }, 503);
  const waId = strictWaId(c.req.param("waId"));
  if (!waId) return c.json({ error: "WA_ID_INVALID" }, 400);
  const conversation = await c.env.DB.prepare("SELECT wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at FROM whatsapp_conversations WHERE wa_id IN (?,?) ORDER BY CASE WHEN wa_id=? THEN 0 ELSE 1 END LIMIT 1").bind(waId, `+${waId}`, waId).first<{ wa_id: string; state: string; state_data: string; last_inbound_message_id: string | null; last_inbound_at: string | null; created_at: string; updated_at: string }>();
  if (!conversation) return c.json({ error: "CONVERSATION_NOT_FOUND" }, 404);
  let preferredOrderId: string | undefined;
  try {
    const stateData = JSON.parse(conversation.state_data) as { orderId?: unknown };
    if (typeof stateData.orderId === "string") preferredOrderId = stateData.orderId;
  } catch {
    // Corrupt legacy state is not returned to the browser and does not block safe inspection/reset.
  }
  const [latestOrder, exemption] = await Promise.all([
    getLatestOrderForWaId(c.env.DB, waId, preferredOrderId),
    c.env.DB.prepare("SELECT wa_id,reason,created_by,created_at FROM cooldown_exemptions WHERE wa_id=?").bind(waId).first<Record<string, unknown>>()
  ]);
  const lock = latestOrder ? await c.env.DB.prepare("SELECT order_id,order_number,last_order_at FROM order_eligibility_locks WHERE household_key=?").bind(latestOrder.householdKey).first<{ order_id: string; order_number: string | null; last_order_at: string }>() : undefined;
  const nextEligibleAt = lock ? new Date(new Date(lock.last_order_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
  const exempt = Boolean(exemption);
  return c.json({
    conversation: { waId: conversation.wa_id, state: conversation.state, lastInboundMessageId: conversation.last_inbound_message_id, lastInboundAt: conversation.last_inbound_at, createdAt: conversation.created_at, updatedAt: conversation.updated_at },
    latestOrder: latestOrder ? { ...latestOrder, householdKey: undefined } : null,
    cooldown: { exempt, lastOrderAt: lock?.last_order_at ?? null, orderNumber: lock?.order_number ?? null, nextEligibleAt, active: !exempt && Boolean(nextEligibleAt && nextEligibleAt > new Date().toISOString()) }
  });
});

app.post("/api/test-controls/conversations/:waId/reset", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "TEST_CONTROLS_UNAVAILABLE" }, 503);
  const waId = strictWaId(c.req.param("waId"));
  if (!waId) return c.json({ error: "WA_ID_INVALID" }, 400);
  let body: { confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (body.confirmation !== waId) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  const current = await c.env.DB.prepare("SELECT wa_id,state FROM whatsapp_conversations WHERE wa_id IN (?,?) ORDER BY CASE WHEN wa_id=? THEN 0 ELSE 1 END LIMIT 1").bind(waId, `+${waId}`, waId).first<{ wa_id: string; state: string }>();
  if (!current) return c.json({ error: "CONVERSATION_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE whatsapp_conversations SET state='NEW',state_data='{}',last_inbound_message_id=NULL,last_inbound_at=NULL,updated_at=? WHERE wa_id=?").bind(now, current.wa_id),
    auditStatement(c.env.DB, "WHATSAPP_CONVERSATION_RESET", "WHATSAPP_CONVERSATION", current.wa_id, { previousState: current.state, preservedHistory: true }, now, c.env.ADMIN_EMAIL)
  ]);
  return result[0].meta.changes === 1 ? c.json({ ok: true, waId: current.wa_id, state: "NEW", historyPreserved: true }) : c.json({ error: "CONVERSATION_STATE_CONFLICT" }, 409);
});

app.get("/api/test-controls/cooldown-exemptions", async (c) => {
  const result = c.env.DB ? await c.env.DB.prepare("SELECT wa_id,reason,created_by,created_at FROM cooldown_exemptions ORDER BY created_at,wa_id").all() : { results: [] };
  return c.json({ exemptions: result.results.map((row) => ({ waId: String(row.wa_id), reason: String(row.reason), createdBy: String(row.created_by), createdAt: String(row.created_at) })) });
});

app.post("/api/test-controls/cooldown-exemptions", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "TEST_CONTROLS_UNAVAILABLE" }, 503);
  let body: { waId?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const waId = strictWaId(body.waId);
  if (!waId) return c.json({ error: "WA_ID_INVALID" }, 400);
  if (body.confirmation !== waId) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  const now = new Date().toISOString();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO cooldown_exemptions (wa_id,reason,created_by,created_at) VALUES (?,?,?,?)").bind(waId, "ADMIN_TEST_EXEMPTION", c.env.ADMIN_EMAIL, now),
      auditStatement(c.env.DB, "COOLDOWN_EXEMPTION_ADDED", "COOLDOWN_EXEMPTION", waId, { waId }, now, c.env.ADMIN_EMAIL)
    ]);
  } catch {
    return c.json({ error: "COOLDOWN_EXEMPTION_ALREADY_EXISTS" }, 409);
  }
  return c.json({ ok: true, waId }, 201);
});

app.delete("/api/test-controls/cooldown-exemptions/:waId", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "TEST_CONTROLS_UNAVAILABLE" }, 503);
  const waId = strictWaId(c.req.param("waId"));
  if (!waId) return c.json({ error: "WA_ID_INVALID" }, 400);
  let body: { confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (body.confirmation !== waId) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM cooldown_exemptions WHERE wa_id=?").bind(waId),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(), "COOLDOWN_EXEMPTION_REMOVED", "ADMIN", c.env.ADMIN_EMAIL, "COOLDOWN_EXEMPTION", waId, crypto.randomUUID(), JSON.stringify({ waId }), now)
  ]);
  return result[0].meta.changes === 1 ? c.json({ ok: true, waId }) : c.json({ error: "COOLDOWN_EXEMPTION_NOT_FOUND" }, 404);
});

async function orderRetentionAction(c: AdminContext, action: "cancel" | "archive") {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  let body: { reason?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const orderId = c.req.param("id");
  const order = await c.env.DB.prepare("SELECT order_number FROM orders WHERE id=?").bind(orderId).first<{ order_number: string }>();
  if (!order) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (body.confirmation !== order.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  const reason = requiredReason(body.reason);
  if (!reason) return c.json({ error: "REASON_REQUIRED" }, 400);
  const now = new Date().toISOString();
  const eligible = "state IN ('NEW','DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_REJECTED','CANCELLED') AND payment_status<>'PAID' AND NOT EXISTS (SELECT 1 FROM payment_receipts r WHERE r.order_id=orders.id) AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id=orders.id AND (p.review_state='APPROVED' OR p.approved_at IS NOT NULL OR p.approved_amount IS NOT NULL))";
  const update = action === "cancel"
    ? c.env.DB.prepare(`UPDATE orders SET state='CANCELLED',cancelled_at=?,cancelled_by=?,cancellation_reason=?,updated_at=? WHERE id=? AND archived_at IS NULL AND state<>'CANCELLED' AND ${eligible}`).bind(now, c.env.ADMIN_EMAIL, reason, now, orderId)
    : c.env.DB.prepare(`UPDATE orders SET archived_at=?,archived_by=?,archive_reason=?,updated_at=? WHERE id=? AND archived_at IS NULL AND ${eligible}`).bind(now, c.env.ADMIN_EMAIL, reason, now, orderId);
  const audit = c.env.DB.prepare(`INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders WHERE id=? AND ${action === "cancel" ? "cancelled_at" : "archived_at"}=?`).bind(crypto.randomUUID(), action === "cancel" ? "ORDER_CANCELLED" : "ORDER_ARCHIVED", "ADMIN", c.env.ADMIN_EMAIL, "ORDER", orderId, crypto.randomUUID(), JSON.stringify({ orderNumber: order.order_number, reason, financialHistoryPreserved: true }), now, orderId, now);
  const result = await c.env.DB.batch([update, audit]);
  if (result[0].meta.changes !== 1) return c.json({ error: action === "cancel" ? "ORDER_NOT_ELIGIBLE_FOR_CANCELLATION" : "ORDER_NOT_ELIGIBLE_FOR_ARCHIVE" }, 409);
  return c.json({ ok: true, orderId, orderNumber: order.order_number, action, historyPreserved: true });
}

app.post("/api/orders/:id/cancel", (c) => orderRetentionAction(c, "cancel"));
app.post("/api/orders/:id/archive", (c) => orderRetentionAction(c, "archive"));

app.post("/api/orders/:id/transition", async (c) => {
  let body: { from?: unknown; to?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const from = OrderState.safeParse(body.from);
  const to = OrderState.safeParse(body.to);
  if (!from.success || !to.success) return c.json({ error: "ORDER_STATE_INVALID" }, 400);
  const fulfillmentTransition = from.data === "PAID" && to.data === "PACKING"
    || from.data === "PACKING" && to.data === "DISPATCHED"
    || from.data === "DISPATCHED" && to.data === "DELIVERED";
  if (!fulfillmentTransition) return c.json({ error: to.data === "CANCELLED" ? "USE_EXPLICIT_CANCELLATION" : "FULFILLMENT_TRANSITION_INVALID" }, 409);
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!canTransition(from.data, to.data)) return c.json({ error: "INVALID_STATE_TRANSITION" }, 409);
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const current = await c.env.DB.prepare("SELECT o.order_number,o.state,o.payment_status,o.archived_at,p.review_state FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.id=?").bind(c.req.param("id")).first<{ order_number: string; state: OrderState; payment_status: string; review_state: string | null; archived_at: string | null }>();
  if (!current) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  if (current.order_number === "FS-261019-000001") return c.json({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" }, 409);
  if (current.archived_at != null || current.state !== from.data) return c.json({ error: "STATE_CONFLICT" }, 409);
  if (current.payment_status !== "PAID" && current.review_state !== "APPROVED") return c.json({ error: "FULFILLMENT_PAYMENT_NOT_APPROVED" }, 409);
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE orders SET state=?,updated_at=? WHERE id=? AND state=? AND archived_at IS NULL").bind(to.data, now, c.req.param("id"), from.data),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(), "ORDER_STATE_TRANSITIONED", "ADMIN", c.env.ADMIN_EMAIL, "ORDER", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ from: from.data, to: to.data, orderNumber: current.order_number }), now)
  ]);
  return result[0].meta.changes === 1 ? c.json({ ok: true, from: from.data, to: to.data }) : c.json({ error: "STATE_CONFLICT" }, 409);
});

app.post("/api/orders/:id/confirm", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  let body: { confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const current = await c.env.DB.prepare("SELECT o.order_number,o.state,o.payment_status,o.archived_at,p.review_state FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.id=?").bind(c.req.param("id")).first<{ order_number: string; state: OrderState; payment_status: string; review_state: string | null; archived_at: string | null }>();
  if (!current) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  if (current.order_number === "FS-261019-000001") return c.json({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" }, 409);
  if (current.archived_at != null) return c.json({ error: "ORDER_ARCHIVED" }, 409);
  if (current.payment_status !== "PAID" && current.review_state !== "APPROVED") return c.json({ error: "ORDER_CONFIRMATION_REQUIRES_APPROVED_PAYMENT" }, 409);
  if (!["PAID", "PACKING", "DISPATCHED", "DELIVERED"].includes(current.state)) return c.json({ error: "ORDER_CONFIRMATION_NOT_READY" }, 409);
  const existing = await c.env.DB.prepare("SELECT created_at FROM audit_log WHERE entity_type='ORDER' AND entity_id=? AND action='ORDER_CONFIRMED' ORDER BY created_at DESC LIMIT 1").bind(c.req.param("id")).first<{ created_at: string }>();
  if (existing) return c.json({ ok: true, alreadyConfirmed: true, confirmedAt: existing.created_at });
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    auditStatement(c.env.DB, "ORDER_CONFIRMED", "ORDER", c.req.param("id"), { orderNumber: current.order_number, operationalOnly: true, financialStateUnchanged: true }, now, c.env.ADMIN_EMAIL)
  ]);
  return result[0].meta.changes === 1 ? c.json({ ok: true, confirmedAt: now }) : c.json({ error: "ORDER_CONFIRMATION_FAILED" }, 409);
});

app.post("/api/orders/:id/tracking", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  let body: { trackingNumber?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const value = trackingNumber(body.trackingNumber);
  if (!value) return c.json({ error: "TRACKING_NUMBER_INVALID" }, 400);
  const current = await c.env.DB.prepare("SELECT order_number,state,archived_at FROM orders WHERE id=?").bind(c.req.param("id")).first<{ order_number: string; state: OrderState; archived_at: string | null }>();
  if (!current) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  if (current.order_number === "FS-261019-000001") return c.json({ error: "FULFILLMENT_HOLD_INCIDENT_REVIEW_REQUIRED" }, 409);
  if (current.archived_at != null) return c.json({ error: "ORDER_ARCHIVED" }, 409);
  if (!["PAID", "PACKING", "DISPATCHED", "DELIVERED"].includes(current.state)) return c.json({ error: "TRACKING_NOT_READY" }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    auditStatement(c.env.DB, "ORDER_TRACKING_ASSIGNED", "ORDER", c.req.param("id"), { orderNumber: current.order_number, trackingNumber: value }, now, c.env.ADMIN_EMAIL)
  ]);
  return c.json({ ok: true, trackingNumber: value });
});

async function shippingLabelResponse(c: AdminContext) {
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  const format = parseShippingLabelFormat(c.req.query("format") ?? c.req.query("size") ?? "4x6");
  if (!format) return c.json({ error: "SHIPPING_LABEL_FORMAT_INVALID" }, 400);
  const row = await c.env.DB.prepare(`${ORDER_ADMIN_SELECT} WHERE o.id=?`).bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!row) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  const order = orderView(row);
  if (!order.canPrintShippingLabel) return c.json({ error: "SHIPPING_LABEL_NOT_READY" }, 409);
  const tracking = await assignedTrackingNumber(c.env.DB, c.req.param("id") ?? "");
  const html = renderShippingLabelHtml(order, format, tracking);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none';", "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename="${order.orderNumber}-${format}.html"` } });
}

app.get("/api/orders/:id/shipping-label", shippingLabelResponse);
app.get("/api/orders/:id/label", shippingLabelResponse);

app.post("/api/payments/:id/approve", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  let body: { orderId?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (!c.env.DB) return c.json({ error: "ORDER_ADMIN_UNAVAILABLE" }, 503);
  try {
    const current = await c.env.DB.prepare("SELECT p.review_state,p.expected_amount,p.approved_amount,p.customer_transaction_reference,o.id AS order_id,o.order_number,o.state,o.archived_at,c.id AS customer_id,ma.ctwa_clid,COUNT(pr.id) AS receipt_count FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id LEFT JOIN meta_attribution ma ON ma.order_id=o.id LEFT JOIN payment_receipts pr ON pr.payment_id=p.id WHERE p.id=? AND o.id=? GROUP BY p.id,o.id,c.id,ma.id").bind(c.req.param("id"), body.orderId).first<{ review_state: string; expected_amount: number; approved_amount: number | null; customer_transaction_reference: string | null; order_id: string; order_number: string; state: OrderState; archived_at: string | null; customer_id: string; ctwa_clid?: string; receipt_count: number }>();
    if (!current) return c.json({ error: "PAYMENT_NOT_FOUND" }, 404);
    if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
    if (!Number.isSafeInteger(Number(current.expected_amount)) || Number(current.expected_amount) <= 0) return c.json({ error: "PAYMENT_AMOUNT_INVALID" }, 409);
    const amount = approvedPurchaseValue(Number(current.expected_amount), Number(current.expected_amount));
    const event = createPurchaseEvent(current.order_number, amount, current.ctwa_clid ? { ctwaClid: current.ctwa_clid } : undefined);
    if (current.review_state === "APPROVED" && current.state === "PAID") return c.json({ ok: true, alreadyApproved: true, eventId: event.eventId });
    if (current.archived_at != null || current.review_state !== "REVIEW" || current.state !== "PAYMENT_REVIEW") return c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
    if (Number(current.receipt_count) < 1) return c.json({ error: "PAYMENT_RECEIPT_REQUIRED" }, 409);
    if (!current.customer_transaction_reference?.trim()) return c.json({ error: "PAYMENT_TRANSACTION_REFERENCE_REQUIRED" }, 409);
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE payments SET review_state='APPROVED', approved_amount=?, approved_by=?, approved_at=?, updated_at=? WHERE id=? AND review_state='REVIEW'").bind(amount, c.env.ADMIN_EMAIL, now, now, c.req.param("id")),
      c.env.DB.prepare("UPDATE orders SET state='PAID', payment_status='PAID', updated_at=? WHERE id=? AND state='PAYMENT_REVIEW' AND EXISTS (SELECT 1 FROM payments WHERE id=? AND review_state='APPROVED')").bind(now, current.order_id, c.req.param("id")),
      c.env.DB.prepare("INSERT OR IGNORE INTO capi_events (id,event_id,event_name,order_id,customer_id,send_status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND o.state='PAID' AND p.id=? AND p.review_state='APPROVED'").bind(crypto.randomUUID(), event.eventId, event.eventName, current.order_id, current.customer_id, "PENDING", now, now, current.order_id, c.req.param("id")),
      c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND o.state='PAID' AND p.id=? AND p.review_state='APPROVED'").bind(crypto.randomUUID(), event.eventId, "CAPI_PURCHASE", current.order_id, JSON.stringify(event), "PENDING", now, now, now, current.order_id, c.req.param("id")),
      c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders WHERE id=? AND state='PAID'").bind(crypto.randomUUID(), "PAYMENT_APPROVED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ orderNumber: current.order_number, eventId: event.eventId }), now, current.order_id)
    ]);
    let queued = false;
    try {
      if (c.env.EVENTS) {
        await c.env.EVENTS.send({ kind: "CAPI_PURCHASE", idempotencyKey: event.eventId, entityId: current.order_id, schemaVersion: 1 });
        queued = true;
      }
    } catch {
      // The durable outbox remains authoritative when Queue delivery is temporarily unavailable.
    }
    return c.json({ ok: true, eventId: event.eventId, capiQueue: queued ? "QUEUED" : "DEFERRED" });
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : "APPROVAL_FAILED" }, 400); }
});

app.post("/api/payments/:id/reject", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  let body: { orderId?: unknown; reason?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  const reason = requiredReason(body.reason);
  if (!reason) return c.json({ error: "REJECTION_REASON_REQUIRED" }, 400);
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const current = await c.env.DB.prepare("SELECT p.review_state,o.id AS order_id,o.order_number,o.state,o.archived_at FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? AND o.id=?").bind(c.req.param("id"), body.orderId).first<{ review_state: string; order_id: string; order_number: string; state: OrderState; archived_at: string | null }>();
  if (!current) return c.json({ error: "PAYMENT_NOT_FOUND" }, 404);
  if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  if (current.archived_at != null || current.review_state !== "REVIEW" || current.state !== "PAYMENT_REVIEW") return c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
  const now = new Date().toISOString();
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE payments SET review_state='REJECTED', rejection_reason=?, approved_by=?, updated_at=? WHERE id=? AND review_state='REVIEW'").bind(reason, c.env.ADMIN_EMAIL, now, c.req.param("id")),
    c.env.DB.prepare("UPDATE orders SET state='PAYMENT_REJECTED', payment_status='REJECTED', updated_at=? WHERE id=? AND state='PAYMENT_REVIEW' AND archived_at IS NULL AND EXISTS (SELECT 1 FROM payments WHERE id=? AND review_state='REJECTED')").bind(now, current.order_id, c.req.param("id")),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM orders WHERE id=? AND state='PAYMENT_REJECTED'").bind(crypto.randomUUID(), "PAYMENT_REJECTED", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ reason }), now, current.order_id)
  ]);
  return result[1].meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
});

app.post("/api/payments/:id/request-clearer-receipt", async (c) => {
  if (!validCsrf(c)) return c.json({ error: "CSRF_VALIDATION_FAILED" }, 403);
  let body: { orderId?: unknown; confirmation?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "INVALID_REQUEST" }, 400); }
  if (!c.env.DB) return c.json({ ok: true, simulated: true });
  const current = await c.env.DB.prepare("SELECT p.review_state,o.id AS order_id,o.order_number,o.state,o.archived_at,COUNT(pr.id) AS receipt_count FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN payment_receipts pr ON pr.order_id=o.id WHERE p.id=? AND o.id=? GROUP BY p.id,o.id").bind(c.req.param("id"), body.orderId).first<{ review_state: string; order_id: string; order_number: string; state: OrderState; archived_at: string | null; receipt_count: number }>();
  if (!current) return c.json({ error: "PAYMENT_NOT_FOUND" }, 404);
  if (body.confirmation !== current.order_number) return c.json({ error: "CONFIRMATION_REQUIRED" }, 400);
  if (current.archived_at != null || current.review_state !== "REVIEW" || current.state !== "PAYMENT_REVIEW" || Number(current.receipt_count) < 1) return c.json({ error: "PAYMENT_NOT_IN_REVIEW" }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `clearer_receipt_${c.req.param("id")}`, "WHATSAPP_CLEARER_RECEIPT", current.order_id, JSON.stringify({ paymentId: c.req.param("id"), orderId: current.order_id }), "PENDING", now, now, now),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "REQUEST_CLEARER_RECEIPT", "ADMIN", c.env.ADMIN_EMAIL, "PAYMENT", c.req.param("id"), crypto.randomUUID(), JSON.stringify({ orderId: current.order_id }), now)
  ]);
  return c.json({ ok: true });
});

app.get("/api/orders/:id/receipts/:receiptId/preview", async (c) => {
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "RECEIPT_PREVIEW_UNAVAILABLE" }, 503);
  const receipt = await c.env.DB.prepare("SELECT r2_object_key,mime_type FROM payment_receipts WHERE id=? AND order_id=?").bind(c.req.param("receiptId"), c.req.param("id")).first<{ r2_object_key: string; mime_type: string }>();
  if (!receipt) return c.json({ error: "RECEIPT_NOT_FOUND" }, 404);
  const object = await c.env.RECEIPTS.get(receipt.r2_object_key);
  if (!object) return c.json({ error: "RECEIPT_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": receipt.mime_type ?? object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

app.get("/api/receipts/:key{.+}", async (c) => {
  const object = await c.env.RECEIPTS.get(c.req.param("key"));
  if (!object) return c.json({ error: "RECEIPT_NOT_FOUND" }, 404);
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

app.get("/api/payment-instructions/:method", async (c) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_METHOD_NOT_CONFIGURED" }, 503);
  const row = await c.env.DB.prepare("SELECT * FROM payment_methods WHERE method=?").bind(c.req.param("method").toUpperCase()).first();
  if (!row) return c.json({ error: "PAYMENT_METHOD_NOT_FOUND" }, 404);
  const amount = await c.env.DB.prepare("SELECT advance_amount_pkr FROM payment_configuration WHERE id=1").first<{ advance_amount_pkr?: number | null }>();
  if (amount?.advance_amount_pkr == null || Number(amount.advance_amount_pkr) <= 0) return c.json({ error: "PAYMENT_AMOUNT_NOT_CONFIGURED" }, 503);
  return c.json(paymentInstructions(normalizePaymentMethodRow(row as Record<string, unknown>)));
});

app.get("/tariff", (c) => c.html(tariffPageHtml()));

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
export default app;
