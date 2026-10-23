CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id TEXT PRIMARY KEY,
  wa_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  state_data TEXT NOT NULL DEFAULT '{}',
  last_inbound_message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_updated_idx ON whatsapp_conversations(updated_at);
