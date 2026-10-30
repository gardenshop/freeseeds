-- GFS-339: proposed additive indexes for bounded inbound analytics reads.
-- Local proposal only; do not apply remotely without separate migration authorization.
CREATE INDEX IF NOT EXISTS whatsapp_events_created_type_id_idx
  ON whatsapp_events(created_at, event_type, provider_event_id);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_last_inbound_created_idx
  ON whatsapp_conversations(last_inbound_at, created_at, wa_id);

CREATE INDEX IF NOT EXISTS orders_created_id_idx
  ON orders(created_at, id);

CREATE INDEX IF NOT EXISTS leads_created_id_idx
  ON leads(created_at, id);
