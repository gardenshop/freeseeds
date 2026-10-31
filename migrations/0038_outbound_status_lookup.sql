-- GFS-273: bound WhatsApp delivery-status updates to the provider lookup key.
-- Additive only; no customer, payment, receipt, COD, or order data is changed.
CREATE INDEX IF NOT EXISTS outbound_messages_provider_status_idx
  ON outbound_messages(provider_message_id, status);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0038',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
