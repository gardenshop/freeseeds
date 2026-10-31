-- GFS-341 LOCAL PROPOSAL ONLY. Do not apply remotely without separate authorization.
-- Bodies are intentionally bounded; payment references, credentials, full payloads and private media are prohibited.
CREATE TABLE IF NOT EXISTS admin_message_history (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES whatsapp_conversations(id),
  direction TEXT NOT NULL CHECK(direction IN ('INBOUND','OUTBOUND')),
  message_kind TEXT NOT NULL CHECK(message_kind IN ('TEXT','MEDIA','INTERACTIVE','FLOW','TEMPLATE')),
  status TEXT NOT NULL CHECK(status IN ('RECEIVED','SENT','DELIVERED','READ','FAILED')),
  status_rank INTEGER NOT NULL DEFAULT 0 CHECK(status_rank >= 0),
  provider_message_id TEXT,
  provider_event_id TEXT,
  idempotency_key TEXT,
  occurred_at TEXT NOT NULL,
  text_body TEXT CHECK(text_body IS NULL OR length(text_body) <= 4000),
  interactive_id TEXT CHECK(interactive_id IS NULL OR length(interactive_id) <= 200),
  interactive_title TEXT CHECK(interactive_title IS NULL OR length(interactive_title) <= 200),
  media_mime_type TEXT CHECK(media_mime_type IS NULL OR length(media_mime_type) <= 120),
  media_ref_ciphertext TEXT,
  created_at TEXT NOT NULL,
  CHECK(text_body IS NULL OR (lower(text_body) NOT LIKE '%password%' AND lower(text_body) NOT LIKE '%secret%' AND lower(text_body) NOT LIKE '%token%'))
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_message_history_provider_msg_uq ON admin_message_history(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_message_history_provider_event_uq ON admin_message_history(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_message_history_idempotency_uq ON admin_message_history(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_message_history_conversation_time_idx ON admin_message_history(conversation_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS admin_message_history_status_idx ON admin_message_history(provider_message_id,status);
CREATE TRIGGER IF NOT EXISTS admin_message_history_status_monotonic
BEFORE UPDATE OF status,status_rank ON admin_message_history
WHEN NEW.status_rank < OLD.status_rank
BEGIN SELECT RAISE(ABORT,'ADMIN_MESSAGE_STATUS_REGRESSION'); END;
-- Future activation must add encrypted/protected content handling, a configurable retention job (default 90 days),
-- least-privilege Admin access logging, and provider acknowledgement retry/idempotency. This proposal is unapplied.
