-- GFS-403 LOCAL PROPOSAL ONLY. Do not apply remotely without separate owner approval.
-- Cancellation facts and feedback are append-only; raw WhatsApp identifiers are prohibited.
CREATE TABLE IF NOT EXISTS checkout_cancellation_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES whatsapp_conversations(id),
  masked_conversation_ref TEXT NOT NULL CHECK(masked_conversation_ref='unavailable' OR (length(masked_conversation_ref)=7 AND masked_conversation_ref GLOB '***[0-9][0-9][0-9][0-9]')),
  original_stage TEXT NOT NULL CHECK(original_stage IN ('OFFER','REVIEW','OTHER_PRE_SUBMISSION','UNKNOWN')),
  language TEXT NOT NULL CHECK(language IN ('en','ur','UNKNOWN')),
  order_id TEXT REFERENCES orders(id),
  provider_event_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checkout_cancellation_stage_time_idx ON checkout_cancellation_events(original_stage,occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS checkout_cancellation_conversation_time_idx ON checkout_cancellation_events(conversation_id,occurred_at DESC,id);

CREATE TABLE IF NOT EXISTS checkout_cancellation_feedback_events (
  id TEXT PRIMARY KEY,
  cancellation_event_id TEXT NOT NULL REFERENCES checkout_cancellation_events(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('REASON','SUGGESTION','SKIPPED','OUTCOME','RESTARTED')),
  reason_code TEXT CHECK(reason_code IS NULL OR reason_code IN ('DELIVERY_FEE_HIGH','COD_COLLECTION_FEE','ADVANCE_TRUST','PRODUCT_UNSUITABLE','ORDER_LATER','OFFER_UNCLEAR','FERTILIZER_COST','OTHER','UNKNOWN')),
  suggestion TEXT CHECK(suggestion IS NULL OR length(suggestion) BETWEEN 1 AND 300),
  recovery_code TEXT CHECK(recovery_code IS NULL OR length(recovery_code) <= 60),
  response_outcome TEXT NOT NULL CHECK(response_outcome IN ('REASON_SELECTED','FEEDBACK_SKIPPED','SUGGESTION_REQUESTED','SUGGESTION_PROVIDED','SUGGESTION_SKIPPED','RESTARTED')),
  provider_event_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  suggestion_expires_at TEXT,
  created_at TEXT NOT NULL,
  CHECK((event_type='REASON' AND reason_code IS NOT NULL AND suggestion IS NULL) OR (event_type='SUGGESTION' AND suggestion IS NOT NULL) OR (event_type IN ('SKIPPED','OUTCOME','RESTARTED') AND suggestion IS NULL))
);
CREATE INDEX IF NOT EXISTS checkout_cancellation_feedback_event_idx ON checkout_cancellation_feedback_events(cancellation_event_id,event_type,occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS checkout_cancellation_feedback_reason_idx ON checkout_cancellation_feedback_events(reason_code,cancellation_event_id) WHERE event_type='REASON';
CREATE INDEX IF NOT EXISTS checkout_cancellation_feedback_expiry_idx ON checkout_cancellation_feedback_events(suggestion_expires_at) WHERE suggestion_expires_at IS NOT NULL;

-- Suggestions become unreadable to Admin after 90 days. A separately approved retention job
-- must physically delete expired suggestion rows before production activation.
