-- GFS-268: keep authoritative Admin detail/receipt reads on entity-key indexes.
-- Additive only; no customer, payment, receipt, COD, or order data is changed.
CREATE INDEX IF NOT EXISTS audit_log_entity_created_idx
  ON audit_log(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_receipts_order_submitted_idx
  ON payment_receipts(order_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS outbox_jobs_entity_kind_status_idx
  ON outbox_jobs(entity_id, kind, status);

CREATE INDEX IF NOT EXISTS orders_archived_created_idx
  ON orders(archived_at, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS customers_normalized_whatsapp_idx
  ON customers(normalized_whatsapp_number);

CREATE INDEX IF NOT EXISTS customers_whatsapp_idx
  ON customers(whatsapp_number);

CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON orders(customer_id, created_at DESC, id DESC);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0037',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
