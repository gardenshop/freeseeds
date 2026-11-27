import { FEP_OPENING_POLICY_VERSION, OWNER_CONFIRMED_TEST_MOBILE_POLICY } from "./free-messaging";

export type WebhookRecord = {
  providerEventId: string;
  eventType: string;
  status: string;
};

type WebhookMessage = { id?: string; type?: string; image?: unknown; document?: unknown };
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
      if (!message.id) continue;
      const eventType = message.image || message.document ? "MEDIA" : message.type === "interactive" ? "INTERACTIVE" : "MESSAGE";
      records.push({ providerEventId: `message:${message.id}`, eventType, status: "RECEIVED" });
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

async function persistFirstResponseFreeWindowEvidence(db:D1Database,statuses:WhatsAppFreeWindowStatus[],payloadHash:string,receivedAt:string):Promise<void>{
  for(const status of statuses){
    if(!status.recipientId)continue;
    const waId=status.recipientId.startsWith("+")?status.recipientId.slice(1):status.recipientId;
    const conversation=await db.prepare("SELECT id,state_data FROM whatsapp_conversations WHERE wa_id=?").bind(waId).first<{id:string;state_data:string|null}>();
    if(!conversation?.state_data)continue;
    let state:{freeMessagingEvidence?:{openingResponse?:Record<string,unknown>;fep?:unknown;pricing?:unknown}};
    try{state=JSON.parse(conversation.state_data) as typeof state;}catch{continue;}
    const opening=state.freeMessagingEvidence?.openingResponse;
    const ownerTestMobile=opening?.mobileOriginAttestation===OWNER_CONFIRMED_TEST_MOBILE_POLICY;
    if(ownerTestMobile&&opening.platform!=="ANDROID"&&opening.platform!=="IOS")opening.platform="ANDROID"; // Temporary legacy predicate adapter; only the owner attestation is persisted.
    if(!opening||opening.sourceType!=="CTWA_AD"||!(["ANDROID","IOS"] as unknown[]).includes(opening.platform)||opening.policyVerified!==true||opening.policyRef!==FEP_OPENING_POLICY_VERSION||typeof opening.firstResponseMessageIdHash!=="string")continue;
    if(ownerTestMobile)delete opening.platform;
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
      sourceType:"CTWA_AD",...(opening.platform?{platform:opening.platform}:{}),...(ownerTestMobile?{mobileOriginAttestation:OWNER_CONFIRMED_TEST_MOBILE_POLICY}:{}),clickIdHash:opening.clickIdHash,referralAt:opening.referralAt,
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
  const records = parseWebhookRecords(payload);
  if (!records.length) return 0;
  const payloadHash = await webhookPayloadHash(rawBody);
  const now = new Date().toISOString();
  const statusUpdates = records.filter((record) => record.eventType === "STATUS").map((record) => {
    const providerMessageId = record.providerEventId.slice("status:".length);
    const outboundStatus = record.status === "failed" ? "FAILED" : record.status === "delivered" ? "DELIVERED" : record.status === "read" ? "READ" : record.status === "sent" ? "SENT" : "PROVIDER_STATUS";
    const statusRank = record.status === "read" ? 3 : record.status === "delivered" ? 2 : record.status === "sent" || record.status === "failed" ? 1 : 0;
    return db.prepare("UPDATE outbound_messages SET status=?,last_error=?,updated_at=? WHERE provider_message_id=? AND CASE status WHEN 'READ' THEN 3 WHEN 'DELIVERED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END <= ?").bind(outboundStatus, record.status === "failed" ? "META_DELIVERY_FAILED" : null, now, providerMessageId, statusRank);
  });
  const receiptStatements = captureDeliveryReceipts ? parseWhatsAppDeliveryReceipts(payload).map((receipt) => db.prepare(`INSERT OR IGNORE INTO whatsapp_delivery_receipts(provider_message_id,status,provider_timestamp,received_at)
    SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM outbound_messages m JOIN order_confirmation_intents i ON i.presentation_message_id=m.provider_message_id WHERE m.provider_message_id=? AND m.kind='ORDER_INTENT_OPTIONS' AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.presented_at IS NULL)
       OR (?<>'' AND EXISTS(SELECT 1 FROM order_confirmation_intents i JOIN whatsapp_conversations c ON c.id=i.conversation_id
         WHERE c.wa_id IN (?,?) AND i.workflow_version='GFS-ORDERFLOW-INTENT-030-V1' AND i.state='PRESENTATION_PENDING' AND i.presentation_message_id IS NULL))`).bind(receipt.providerMessageId, receipt.status, receipt.providerTimestamp, now, receipt.providerMessageId, receipt.recipientId ?? "", receipt.recipientId ?? "", receipt.recipientId?.startsWith("+") ? receipt.recipientId.slice(1) : receipt.recipientId ?? "")) : [];
  await db.batch([...records.map((record) => db.prepare("INSERT OR IGNORE INTO whatsapp_events (id,provider_event_id,event_type,payload_hash,status,correlation_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), record.providerEventId, record.eventType, payloadHash, record.status, correlationId, now)), ...statusUpdates, ...receiptStatements]);
  await persistFirstResponseFreeWindowEvidence(db,parseWhatsAppFreeWindowStatuses(payload),payloadHash,now);
  return records.length;
}

export async function persistInboundConversationActivity(db: D1Database, events: Array<{ id: string; from: string; providerTimestamp?: string; referral?: {ctwaClid?:string;sourceType?:string;platform?:string} }>, options: {ownerMobileTestAttestation?:boolean} = {}): Promise<void> {
  if (!events.length) return;
  const statements=[];
  for(const event of events){
    const sourceType=event.referral?.sourceType?.toLowerCase();
    const platform=event.referral?.platform?.toUpperCase();
    const recognizedPlatform=platform==="ANDROID"||platform==="IOS"?platform:undefined;
    const referralAt=event.providerTimestamp&&Number.isFinite(Date.parse(event.providerTimestamp))?event.providerTimestamp:undefined;
    const providerTimestamp=event.providerTimestamp&&Number.isFinite(Date.parse(event.providerTimestamp))?event.providerTimestamp:null;
    const ctwaClid=event.referral?.ctwaClid?.trim();
    let openingResponse:Record<string,unknown>|undefined;
    if(sourceType==="ad"&&ctwaClid&&referralAt&&(recognizedPlatform||options.ownerMobileTestAttestation===true)){
      const source=await db.prepare("SELECT payload_hash FROM whatsapp_events WHERE provider_event_id=?").bind(`message:${event.id}`).first<{payload_hash:string}>();
      if(source?.payload_hash){
        const clickDigest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ctwaClid)));
        const clickIdHash=[...clickDigest].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
        openingResponse={sourceType:"CTWA_AD",...(recognizedPlatform?{platform:recognizedPlatform}:{}),...(options.ownerMobileTestAttestation?{mobileOriginAttestation:OWNER_CONFIRMED_TEST_MOBILE_POLICY}:{}),clickIdHash,referralAt,policyVerified:true,policyRef:FEP_OPENING_POLICY_VERSION,sourceEvidenceRef:source.payload_hash};
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
