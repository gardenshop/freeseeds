import { FEP_OPENING_POLICY_VERSION } from "./free-messaging";

export type WebhookRecord = {
  providerEventId: string;
  eventType: string;
  status: string;
  recipientId?: string;
};

type WebhookMessage = { id?: string; from?: string; type?: string; text?: unknown; image?: unknown; document?: unknown };
type WebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string | number;
  recipient_id?: string;
  conversation?: { id?: string; expiration_timestamp?: string | number; origin?: { type?: string } };
  pricing?: { billable?: boolean; pricing_model?: string; type?: string; category?: string; subtype?: string };
};
type WebhookValue = { messages?: WebhookMessage[]; statuses?: WebhookStatus[] };
type WebhookPayload = { entry?: Array<{ changes?: Array<{ value?: WebhookValue }> }> };

export function parseWebhookRecords(payload: unknown): WebhookRecord[] {
  const root = payload && typeof payload === "object" ? payload as WebhookPayload : {};
  const records: WebhookRecord[] = [];
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) {
    for (const message of change.value?.messages ?? []) {
      if (!message.id || !message.from) continue;
      const eventType = message.image || message.document || message.type === "image" || message.type === "document" ? "MEDIA" : message.type === "interactive" ? "INTERACTIVE" : message.type === "text" || (!message.type && message.text) ? "MESSAGE" : "UNSUPPORTED";
      records.push({ providerEventId: `message:${message.id}`, eventType, status: eventType === "UNSUPPORTED" ? "UNRESOLVED_UNSUPPORTED_MESSAGE" : "RECEIVED", recipientId: message.from });
    }
    for (const status of change.value?.statuses ?? []) {
      if (!status.id) continue;
      records.push({ providerEventId: `status:${status.id}`, eventType: "STATUS", status: status.status ?? "RECEIVED" });
    }
  }
  return records;
}

export type WhatsAppDeliveryReceipt = { providerMessageId: string; recipientId?: string; status: "DELIVERED" | "READ"; providerTimestamp: string };

export function parseWhatsAppDeliveryReceipts(payload: unknown): WhatsAppDeliveryReceipt[] {
  const root = payload && typeof payload === "object" ? payload as WebhookPayload : {};
  const receipts: WhatsAppDeliveryReceipt[] = [];
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const status of change.value?.statuses ?? []) {
    if (!status.id || (status.status !== "delivered" && status.status !== "read")) continue;
    const seconds = typeof status.timestamp === "string" || typeof status.timestamp === "number" ? Number(status.timestamp) : Number.NaN;
    const milliseconds = seconds * 1000;
    if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isSafeInteger(milliseconds) || milliseconds > 8_640_000_000_000_000) continue;
    receipts.push({ providerMessageId: status.id, recipientId: typeof status.recipient_id === "string" ? status.recipient_id : undefined, status: status.status === "read" ? "READ" : "DELIVERED", providerTimestamp: new Date(milliseconds).toISOString() });
  }
  return receipts;
}

export type WhatsAppFreeWindowStatus = {
  providerMessageId: string;
  recipientId?: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  providerTimestamp: string;
  conversationId?: string;
  conversationExpiresAt?: string;
  conversationOriginType?: string;
  pricing?: { billable?: boolean; pricingModel?: string; type?: string; category?: string; subtype?: string };
};
export type WhatsAppBillableDeliverySignal = { providerMessageId: string; recipientId?: string; status: "DELIVERED" | "READ"; pricing: { billable: true; category?: string } };

export async function whatsappIdentityHash(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistInboundLeadAccounting(db: D1Database, inboundEventId: string, outcome: string, reason: string, updatedAt = new Date().toISOString(), recipientId?: string): Promise<void> {
  const inboundEventHash = await whatsappIdentityHash(inboundEventId);
  const normalizedRecipient=recipientId?.replace(/^\+/,"");
  const recipientHash=normalizedRecipient&&/^\d{8,15}$/.test(normalizedRecipient)?await whatsappIdentityHash(normalizedRecipient):null;
  const eligible = outcome === "ELIGIBLE_RESPONSE_ATTEMPTED" || outcome === "RESPONSE_ACCEPTED" || outcome === "RESPONSE_SENT" || outcome === "RESPONSE_DELIVERED" || outcome === "RESPONSE_READ";
  const attempted = ["ELIGIBLE_RESPONSE_ATTEMPTED", "RESPONSE_ACCEPTED", "RESPONSE_SENT", "RESPONSE_DELIVERED", "RESPONSE_READ", "UNRESOLVED_UNKNOWN_ACCEPTANCE", "UNRESOLVED_PROVIDER_SEND", "UNRESOLVED_PROVIDER_REJECTION", "UNRESOLVED_PROVIDER_DELIVERY_FAILURE", "RETRYABLE_PROVIDER_REJECTION"].includes(outcome);
  const accepted = ["RESPONSE_ACCEPTED", "RESPONSE_SENT", "RESPONSE_DELIVERED", "RESPONSE_READ"].includes(outcome);
  const reasonCode=reason.replace(/[^A-Za-z0-9_.:-]/g,"_").slice(0,100)||outcome;
  await db.prepare(`INSERT INTO whatsapp_lead_accounting(inbound_event_hash,recipient_hash,outcome,reason_code,eligible,attempted,accepted,delivered,read,received_at,response_accepted_at,response_attempts,updated_at)
    VALUES(?,?,?,?,?,?,?,0,0,?,?,?,?) ON CONFLICT(inbound_event_hash) DO UPDATE SET
    outcome=CASE WHEN excluded.outcome='RECEIVED' THEN whatsapp_lead_accounting.outcome ELSE excluded.outcome END,
    reason_code=CASE WHEN excluded.outcome='RECEIVED' THEN whatsapp_lead_accounting.reason_code ELSE excluded.reason_code END,
    recipient_hash=COALESCE(whatsapp_lead_accounting.recipient_hash,excluded.recipient_hash),
    eligible=MAX(whatsapp_lead_accounting.eligible,excluded.eligible),attempted=MAX(whatsapp_lead_accounting.attempted,excluded.attempted),
    accepted=MAX(whatsapp_lead_accounting.accepted,excluded.accepted),
    response_accepted_at=COALESCE(whatsapp_lead_accounting.response_accepted_at,excluded.response_accepted_at),
    response_attempts=whatsapp_lead_accounting.response_attempts+CASE WHEN excluded.outcome='ELIGIBLE_RESPONSE_ATTEMPTED' AND whatsapp_lead_accounting.outcome<>'ELIGIBLE_RESPONSE_ATTEMPTED' THEN 1 ELSE 0 END,
    updated_at=excluded.updated_at`)
    .bind(inboundEventHash, recipientHash, outcome, reasonCode, Number(eligible), Number(attempted), Number(accepted), updatedAt, accepted?updatedAt:null, Number(outcome==="ELIGIBLE_RESPONSE_ATTEMPTED"), updatedAt).run();
}

export async function persistAcceptedLeadResponse(db: D1Database, inboundEventId: string, providerMessageId: string, acceptedAt = new Date().toISOString()): Promise<void> {
  const [inboundEventHash, providerMessageHash] = await Promise.all([whatsappIdentityHash(inboundEventId), whatsappIdentityHash(providerMessageId)]);
  await db.prepare("INSERT OR IGNORE INTO whatsapp_lead_responses(inbound_event_hash,provider_message_hash,accepted_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM whatsapp_lead_accounting WHERE inbound_event_hash=?)")
    .bind(inboundEventHash, providerMessageHash, acceptedAt, inboundEventHash).run();
}

export async function persistBillableWhatsAppIncidents(db: D1Database, statuses: WhatsAppBillableDeliverySignal[], evidenceHash: string, detectedAt = new Date().toISOString()): Promise<number> {
  const statements = [];
  let count = 0;
  for (const status of statuses) {
    if (status.pricing?.billable !== true || (status.status !== "DELIVERED" && status.status !== "READ")) continue;
    const providerMessageHash = await whatsappIdentityHash(status.providerMessageId);
    const normalizedRecipient = status.recipientId?.replace(/^\+/, "") ?? "";
    const recipientHash = /^\d{8,15}$/.test(normalizedRecipient) ? await whatsappIdentityHash(normalizedRecipient) : null;
    const category = status.pricing.category ?? "UNKNOWN";
    const categoryHash = await whatsappIdentityHash(category);
    statements.push(
      db.prepare("INSERT OR IGNORE INTO whatsapp_billing_incidents(provider_message_hash,recipient_hash,category_hash,evidence_hash,detected_at,status) VALUES(?,?,?,?,?,'ACTIVE')").bind(providerMessageHash, recipientHash, categoryHash, evidenceHash, detectedAt),
      db.prepare("INSERT OR IGNORE INTO whatsapp_send_blocks(recipient_hash,incident_provider_message_hash,status,created_at) SELECT recipient_hash,provider_message_hash,'ACTIVE',? FROM whatsapp_billing_incidents WHERE provider_message_hash=? AND recipient_hash IS NOT NULL").bind(detectedAt, providerMessageHash),
      db.prepare(`INSERT OR IGNORE INTO whatsapp_system_send_pauses(pause_key,incident_provider_message_hash,reason_code,status,created_at)
        SELECT 'WABA_GLOBAL',provider_message_hash,'CONFIRMED_BILLABLE_DELIVERY_REQUIRES_OWNER_REVIEW','ACTIVE',?
        FROM whatsapp_billing_incidents WHERE provider_message_hash=?`).bind(detectedAt,providerMessageHash),
      db.prepare(`INSERT INTO audit_log(id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at)
        SELECT ?, 'WHATSAPP_BILLABLE_DELIVERY_INCIDENT', 'SYSTEM', 'WHATSAPP_BILLING_INCIDENT', provider_message_hash, ?, ?, ?
        FROM whatsapp_billing_incidents i WHERE i.provider_message_hash=? AND NOT EXISTS(
          SELECT 1 FROM audit_log a WHERE a.action='WHATSAPP_BILLABLE_DELIVERY_INCIDENT' AND a.entity_id=i.provider_message_hash)`)
        .bind(crypto.randomUUID(), providerMessageHash, JSON.stringify({ recipientHash, categoryHash, evidenceHash }), detectedAt, providerMessageHash)
    );
    count++;
  }
  if (statements.length) await db.batch(statements);
  return count;
}

export function parseWhatsAppFreeWindowStatuses(payload: unknown): WhatsAppFreeWindowStatus[] {
  const root=payload&&typeof payload==="object"?payload as WebhookPayload:{};
  const result:WhatsAppFreeWindowStatus[]=[];
  for(const entry of root.entry??[])for(const change of entry.changes??[])for(const status of change.value?.statuses??[]){
    if(!status.id||!["sent","delivered","read","failed"].includes(status.status??""))continue;
    const seconds=typeof status.timestamp==="string"||typeof status.timestamp==="number"?Number(status.timestamp):Number.NaN;
    const millis=seconds*1000;
    if(!Number.isSafeInteger(seconds)||seconds<=0||!Number.isSafeInteger(millis)||millis>8_640_000_000_000_000)continue;
    const expiry=typeof status.conversation?.expiration_timestamp==="string"||typeof status.conversation?.expiration_timestamp==="number"?Number(status.conversation.expiration_timestamp):Number.NaN;
    result.push({
      providerMessageId:status.id,
      ...(typeof status.recipient_id==="string"?{recipientId:status.recipient_id}:{}),
      status:status.status==="sent"?"SENT":status.status==="delivered"?"DELIVERED":status.status==="read"?"READ":"FAILED",
      providerTimestamp:new Date(millis).toISOString(),
      ...(typeof status.conversation?.id==="string"?{conversationId:status.conversation.id}:{}),
      ...(Number.isSafeInteger(expiry)&&expiry>0&&Number.isSafeInteger(expiry*1000)?{conversationExpiresAt:new Date(expiry*1000).toISOString()}:{}),
      ...(typeof status.conversation?.origin?.type==="string"?{conversationOriginType:status.conversation.origin.type}:{}),
      ...(status.pricing?{pricing:{...(typeof status.pricing.billable==="boolean"?{billable:status.pricing.billable}:{}),...(typeof status.pricing.pricing_model==="string"?{pricingModel:status.pricing.pricing_model}:{}),...(typeof status.pricing.type==="string"?{type:status.pricing.type}:{}),...(typeof status.pricing.category==="string"?{category:status.pricing.category}:{}),...(typeof status.pricing.subtype==="string"?{subtype:status.pricing.subtype}:{})}}:{})
    });
  }
  return result;
}

export function parseWhatsAppBillableDeliveries(payload: unknown): WhatsAppBillableDeliverySignal[] {
  const root=payload&&typeof payload==="object"?payload as WebhookPayload:{};
  const result:WhatsAppBillableDeliverySignal[]=[];
  for(const entry of root.entry??[])for(const change of entry.changes??[])for(const status of change.value?.statuses??[]){
    if(!status.id||status.pricing?.billable!==true||(status.status!=="delivered"&&status.status!=="read"))continue;
    result.push({providerMessageId:status.id,...(typeof status.recipient_id==="string"?{recipientId:status.recipient_id}:{}),status:status.status==="read"?"READ":"DELIVERED",pricing:{billable:true,...(typeof status.pricing.category==="string"?{category:status.pricing.category}:{})}});
  }
  return result;
}

async function persistFirstResponseFreeWindowEvidence(db:D1Database,statuses:WhatsAppFreeWindowStatus[],payloadHash:string,receivedAt:string):Promise<void>{
  for(const status of statuses){
    if(!status.recipientId)continue;
    const waId=status.recipientId.startsWith("+")?status.recipientId.slice(1):status.recipientId;
    const conversation=await db.prepare("SELECT id,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(waId).first<{id:string;state_data:string|null}>();
    if(!conversation?.state_data)continue;
    let state:{freeMessagingEvidence?:{openingResponse?:Record<string,unknown>;fep?:unknown;pricing?:unknown}};
    try{state=JSON.parse(conversation.state_data) as typeof state;}catch{continue;}
    const opening=state.freeMessagingEvidence?.openingResponse;
    if(!opening||opening.sourceType!=="CTWA_AD"||opening.policyVerified!==true||opening.policyRef!==FEP_OPENING_POLICY_VERSION||typeof opening.firstResponseMessageIdHash!=="string")continue;
    const providerIdHashBytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(status.providerMessageId)));
    const providerIdHash=[...providerIdHashBytes].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
    if(providerIdHash!==opening.firstResponseMessageIdHash)continue;
    if(status.status==="FAILED"){
      if(opening.fepPending){delete opening.fepPending;opening.firstResponseFailedAt=receivedAt;await db.prepare("UPDATE whatsapp_conversations SET state_data=?,updated_at=? WHERE id=? AND state_data=?").bind(JSON.stringify(state),receivedAt,conversation.id,conversation.state_data).run();}
      continue;
    }
    type PendingFep={sentAt?:string;deliveredAt?:string;readAt?:string;expiresAt?:string;originType?:string;conversationIdHash?:string;expiryEvidenceRef?:string;responseAt?:string;pricingObservedAt?:string;evidenceRef?:string;pricing?:{billable?:boolean;pricingModel?:string;type?:string;category?:string;subtype?:string;observedAt?:string;evidenceRef?:string}};
    const pending={...((opening.fepPending&&typeof opening.fepPending==="object")?opening.fepPending as PendingFep:{})};
    if(status.status==="SENT")pending.sentAt=status.providerTimestamp;
    if(status.status==="DELIVERED")pending.deliveredAt=status.providerTimestamp;
    if(status.status==="READ")pending.readAt=status.providerTimestamp;
    if(status.conversationExpiresAt){pending.expiresAt=status.conversationExpiresAt;pending.expiryEvidenceRef=payloadHash;}
    if(status.conversationOriginType)pending.originType=status.conversationOriginType;
    if(status.conversationId){
      const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(status.conversationId)));
      const conversationIdHash=[...digest].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
      if(pending.conversationIdHash&&pending.conversationIdHash!==conversationIdHash){delete opening.fepPending;await db.prepare("UPDATE whatsapp_conversations SET state_data=?,updated_at=? WHERE id=? AND state_data=?").bind(JSON.stringify(state),receivedAt,conversation.id,conversation.state_data).run();continue;}
      pending.conversationIdHash=conversationIdHash;
    }
    if(status.pricing){
      if(status.pricing.billable===true||(status.pricing.type&&status.pricing.type!=="free_entry_point")||(status.pricing.category&&status.pricing.category!=="referral_conversion")){
        delete opening.fepPending;opening.fepRejectedAt=receivedAt;
        await db.prepare("UPDATE whatsapp_conversations SET state_data=?,updated_at=? WHERE id=? AND state_data=?").bind(JSON.stringify(state),receivedAt,conversation.id,conversation.state_data).run();
        continue;
      }
      pending.pricing={...pending.pricing,...status.pricing,observedAt:status.providerTimestamp,evidenceRef:payloadHash};
    }
    opening.fepPending=pending;
    const pricing=pending.pricing;
    const pricingVerified=pricing?.billable!==true&&pricing?.pricingModel==="PMP"&&pricing.type==="free_entry_point"&&pricing.category==="referral_conversion"&&pending.originType==="referral_conversion"&&Boolean(pending.expiresAt);
    const businessResponseAt=pending.sentAt??(typeof opening.firstBusinessResponseAt==="string"?opening.firstBusinessResponseAt:pending.responseAt);
    if(!pricingVerified||!pending.sentAt||(!pending.deliveredAt&&!pending.readAt)||!businessResponseAt){
      await db.prepare("UPDATE whatsapp_conversations SET state_data=?,updated_at=? WHERE id=? AND state_data=?").bind(JSON.stringify(state),receivedAt,conversation.id,conversation.state_data).run();
      continue;
    }
    const candidate={expiresAt:pending.expiresAt,responseAt:businessResponseAt,pricingObservedAt:pricing.observedAt??pending.pricingObservedAt,evidenceRef:pricing.evidenceRef??pending.evidenceRef,expiryEvidenceRef:pending.expiryEvidenceRef,conversationIdHash:pending.conversationIdHash,pricing};
    const expiry=Date.parse(candidate.expiresAt??"");
    const responseAt=Date.parse(candidate.responseAt??"");
    const referralAt=Date.parse(String(opening.referralAt??""));
    if(!Number.isFinite(expiry)||!Number.isFinite(responseAt)||!Number.isFinite(referralAt)||referralAt>responseAt||responseAt-referralAt>24*60*60*1000||expiry<=responseAt||expiry-responseAt>7*24*60*60*1000)continue;
    state.freeMessagingEvidence??={};
    state.freeMessagingEvidence.fep={
      sourceType:"CTWA_AD",clickIdHash:opening.clickIdHash,referralAt:opening.referralAt,
      firstBusinessResponseAt:candidate.responseAt,expiryVerified:true,verifiedAt:receivedAt,verifiedExpiresAt:candidate.expiresAt,
      ...(candidate.conversationIdHash?{conversationIdHash:candidate.conversationIdHash}:{}),expiryEvidenceRef:candidate.expiryEvidenceRef??payloadHash
    };
    state.freeMessagingEvidence.pricing={
      verified:true,...(candidate.pricing.billable===false?{billable:false}:{}),basis:"FEP",type:"free_entry_point",category:"REFERRAL_CONVERSION",messageCategory:"SERVICE",pricingModel:"PMP",form:"FREEFORM",
      evidenceRef:candidate.evidenceRef??payloadHash,observedAt:candidate.pricingObservedAt??candidate.responseAt,verifiedAt:receivedAt,validUntil:candidate.expiresAt
    };
    delete opening.fepPending;
    await db.prepare("UPDATE whatsapp_conversations SET state_data=?,updated_at=? WHERE id=? AND state_data=?").bind(JSON.stringify(state),receivedAt,conversation.id,conversation.state_data).run();
  }
}

export async function webhookPayloadHash(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistWebhookRecords(db: D1Database, payload: unknown, rawBody: ArrayBuffer, correlationId: string, captureDeliveryReceipts = false): Promise<number> {
  const payloadHash = await webhookPayloadHash(rawBody);
  const parsedRecords = parseWebhookRecords(payload);
  const statusMessageIds = new Map<string, string>();
  const records = await Promise.all(parsedRecords.map(async (record) => {
    if (record.eventType !== "STATUS") return record;
    const messageId = record.providerEventId.slice("status:".length);
    const eventHash = await whatsappIdentityHash(messageId);
    statusMessageIds.set(eventHash, messageId);
    return { ...record, providerEventId: `status:${eventHash}` };
  }));
  const root = payload && typeof payload === "object" ? payload as WebhookPayload : {};
  let malformedIndex = 0;
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const message of change.value?.messages ?? []) {
    if (!message.id || !message.from) {
      records.push({ providerEventId: `malformed:${payloadHash}:${malformedIndex++}`, eventType: "MALFORMED_INBOUND", status: "UNRESOLVED_MALFORMED_INBOUND" });
    }
  }
  if (!records.length) return 0;
  const now = new Date().toISOString();
  const statusUpdates = records.filter((record) => record.eventType === "STATUS").map((record) => {
    const providerMessageId = statusMessageIds.get(record.providerEventId.slice("status:".length))!;
    const outboundStatus = record.status === "failed" ? "FAILED" : record.status === "delivered" ? "DELIVERED" : record.status === "read" ? "READ" : record.status === "sent" ? "SENT" : "PROVIDER_STATUS";
    const statusRank = record.status === "read" ? 3 : record.status === "delivered" ? 2 : record.status === "sent" || record.status === "failed" ? 1 : 0;
    return db.prepare("UPDATE outbound_messages SET status=?,last_error=?,updated_at=? WHERE provider_message_id=? AND CASE status WHEN 'READ' THEN 3 WHEN 'DELIVERED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END <= ?").bind(outboundStatus, record.status === "failed" ? "META_DELIVERY_FAILED" : null, now, providerMessageId, statusRank);
  });
  const leadResponseUpdates = records.filter((record) => record.eventType === "STATUS").map((record) => {
    const providerMessageId = statusMessageIds.get(record.providerEventId.slice("status:".length))!;
    const leadStatus = record.status === "read" ? "RESPONSE_READ" : record.status === "delivered" ? "RESPONSE_DELIVERED" : record.status === "sent" ? "RESPONSE_SENT" : record.status === "failed" ? "UNRESOLVED_RESPONSE_DELIVERY_FAILURE" : undefined;
    if (!leadStatus) return null;
    const rank = record.status === "read" ? 3 : record.status === "delivered" ? 2 : record.status === "sent" ? 1 : 0;
    return db.prepare(`UPDATE whatsapp_events SET status=? WHERE provider_event_id=(
      SELECT 'message:'||CASE WHEN m.idempotency_key LIKE 'welcome_reply:%' THEN substr(m.idempotency_key,15) ELSE substr(m.idempotency_key,20) END FROM outbound_messages m
      WHERE m.provider_message_id=? AND m.kind IN ('LANGUAGE_SELECTION','WELCOME_REPLY') AND (m.idempotency_key LIKE 'welcome_reply:%' OR m.idempotency_key LIKE 'conversation_reply:%')
    ) AND status IN ('RESPONSE_ACCEPTED','RESPONSE_SENT','RESPONSE_DELIVERED','RESPONSE_READ','UNRESOLVED_RESPONSE_DELIVERY_FAILURE','UNRESOLVED_UNKNOWN_ACCEPTANCE')
      AND CASE status WHEN 'RESPONSE_READ' THEN 3 WHEN 'RESPONSE_DELIVERED' THEN 2 WHEN 'RESPONSE_SENT' THEN 1 ELSE 0 END <= ?`).bind(leadStatus, providerMessageId, rank);
  }).filter((statement): statement is NonNullable<typeof statement> => statement !== null);
  const receiptStatements = captureDeliveryReceipts ? parseWhatsAppDeliveryReceipts(payload).map((receipt) => db.prepare(`INSERT OR IGNORE INTO whatsapp_delivery_receipts(provider_message_id,status,provider_timestamp,received_at)
    SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM outbound_messages m JOIN order_confirmation_intents i ON i.presentation_message_id=m.provider_message_id WHERE m.provider_message_id=? AND m.kind='ORDER_INTENT_OPTIONS' AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.presented_at IS NULL)
       OR (?<>'' AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN whatsapp_conversations c ON c.id=i.conversation_id
         WHERE c.wa_id IN (?,?) AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.state='PRESENTATION_PENDING' AND i.presentation_message_id IS NULL))`).bind(receipt.providerMessageId, receipt.status, receipt.providerTimestamp, now, receipt.providerMessageId, receipt.recipientId ?? "", receipt.recipientId ?? "", receipt.recipientId?.startsWith("+") ? receipt.recipientId.slice(1) : receipt.recipientId ?? "")) : [];
  await db.batch([...records.map((record) => db.prepare("INSERT OR IGNORE INTO whatsapp_events (id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.providerEventId, record.eventType, payloadHash, record.status, correlationId, now)), ...statusUpdates, ...leadResponseUpdates, ...receiptStatements]);
  for (const record of records) if (record.eventType !== "STATUS") {
    const inboundId = record.eventType === "MALFORMED_INBOUND" ? record.providerEventId.slice("malformed:".length) : record.providerEventId.slice("message:".length);
    await persistInboundLeadAccounting(db, inboundId, record.status, record.status === "RECEIVED" ? "INBOUND_RECEIVED" : record.status, now, record.recipientId);
  }
  const deliveredStatuses = parseWhatsAppFreeWindowStatuses(payload);
  await persistBillableWhatsAppIncidents(db, parseWhatsAppBillableDeliveries(payload), payloadHash, now);
  for (const status of deliveredStatuses) {
    const matching = await db.prepare(`SELECT CASE WHEN idempotency_key LIKE 'welcome_reply:%' THEN substr(idempotency_key,15)
      ELSE substr(idempotency_key,20) END AS inbound_id FROM outbound_messages
      WHERE provider_message_id=? AND kind IN ('LANGUAGE_SELECTION','WELCOME_REPLY')
        AND (idempotency_key LIKE 'welcome_reply:%' OR idempotency_key LIKE 'conversation_reply:%')`).bind(status.providerMessageId).all<{ inbound_id: string }>();
    for (const row of matching.results ?? []) {
      const inboundHash = await whatsappIdentityHash(row.inbound_id);
      if (status.status === "SENT" || status.status === "DELIVERED" || status.status === "READ") await persistAcceptedLeadResponse(db,row.inbound_id,status.providerMessageId,now);
      await db.prepare(`UPDATE whatsapp_lead_accounting SET
        outcome=CASE WHEN read=1 OR ?='READ' THEN 'RESPONSE_READ' WHEN delivered=1 OR ?='DELIVERED' THEN 'RESPONSE_DELIVERED'
          WHEN ?='FAILED' AND delivered=0 THEN 'UNRESOLVED_RESPONSE_DELIVERY_FAILURE' ELSE outcome END,
        reason_code=CASE WHEN ?='FAILED' AND delivered=0 THEN 'META_DELIVERY_FAILED' ELSE reason_code END,
        delivered=MAX(delivered,?),read=MAX(read,?),updated_at=? WHERE inbound_event_hash=?`)
        .bind(status.status,status.status,status.status,status.status,Number(status.status === "DELIVERED" || status.status === "READ"),Number(status.status === "READ"),now,inboundHash).run();
    }
  }
  await persistFirstResponseFreeWindowEvidence(db,parseWhatsAppFreeWindowStatuses(payload),payloadHash,now);
  const inserted = await db.prepare("SELECT COUNT(*) AS count FROM whatsapp_events WHERE correlation_id=?").bind(correlationId).first<{ count: number }>();
  return Number(inserted?.count ?? 0);
}

export async function persistInboundConversationActivity(db: D1Database, events: Array<{ id: string; from: string; providerTimestamp?: string; referral?: {ctwaClid?:string;sourceType?:string} }>): Promise<void> {
  if (!events.length) return;
  const statements=[];
  for(const event of events){
    const sourceType=event.referral?.sourceType?.toLowerCase();
    const referralAt=event.providerTimestamp&&Number.isFinite(Date.parse(event.providerTimestamp))?event.providerTimestamp:undefined;
    const providerTimestamp=event.providerTimestamp&&Number.isFinite(Date.parse(event.providerTimestamp))?event.providerTimestamp:null;
    const ctwaClid=event.referral?.ctwaClid?.trim();
    let openingResponse:Record<string,unknown>|undefined;
    if(sourceType==="ad"&&ctwaClid&&referralAt){
      const source=await db.prepare("SELECT payload_hash FROM whatsapp_events WHERE provider_event_id=?").bind(`message:${event.id}`).first<{payload_hash:string}>();
      if(source?.payload_hash){
        const clickDigest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ctwaClid)));
        const clickIdHash=[...clickDigest].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
        openingResponse={sourceType:"CTWA_AD",clickIdHash,referralAt,policyVerified:true,policyRef:FEP_OPENING_POLICY_VERSION,sourceEvidenceRef:source.payload_hash};
      }
    }
    const initialState=openingResponse?JSON.stringify({freeMessagingEvidence:{openingResponse}}):"{}";
    const openingJson=openingResponse?JSON.stringify(openingResponse):null;
    const normalizedReferralAt=referralAt??null;
    statements.push(db.prepare(`INSERT INTO whatsapp_conversations
      (id,wa_id,state,state_data,last_inbound_message_id,last_inbound_at,created_at,updated_at)
      SELECT ?,?,'NEW',?,?,?,created_at,created_at
      FROM whatsapp_events WHERE provider_event_id=?
      ON CONFLICT(wa_id) DO UPDATE SET
        last_inbound_message_id=CASE WHEN excluded.last_inbound_at IS NULL OR whatsapp_conversations.last_inbound_at IS NULL OR excluded.last_inbound_at>=whatsapp_conversations.last_inbound_at THEN excluded.last_inbound_message_id ELSE whatsapp_conversations.last_inbound_message_id END,
        last_inbound_at=CASE WHEN excluded.last_inbound_at IS NULL THEN NULL WHEN whatsapp_conversations.last_inbound_at IS NULL OR excluded.last_inbound_at>=whatsapp_conversations.last_inbound_at THEN excluded.last_inbound_at ELSE whatsapp_conversations.last_inbound_at END,
        state_data=CASE
          WHEN ? IS NULL OR json_valid(whatsapp_conversations.state_data)=0 THEN whatsapp_conversations.state_data
          WHEN excluded.last_inbound_at IS NULL OR excluded.last_inbound_at<COALESCE(whatsapp_conversations.last_inbound_at,'') THEN whatsapp_conversations.state_data
          WHEN json_extract(whatsapp_conversations.state_data,'$.freeMessagingEvidence.fep.verifiedExpiresAt')>? THEN whatsapp_conversations.state_data
          WHEN json_extract(whatsapp_conversations.state_data,'$.freeMessagingEvidence.openingResponse.referralAt')>=? THEN whatsapp_conversations.state_data
          ELSE json_set(COALESCE(whatsapp_conversations.state_data,'{}'),'$.freeMessagingEvidence.openingResponse',json(?)) END,
        updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(),event.from,initialState,event.id,providerTimestamp,`message:${event.id}`,openingJson,normalizedReferralAt,normalizedReferralAt,openingJson));
  }
  await db.batch(statements);
}
