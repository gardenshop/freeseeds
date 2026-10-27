-- GFS-268: keep authoritative Admin detail/receipt reads on entity-key indexes.
-- Additive only; no customer, payment, receipt, COD, or order data is changed.
CREATE INDEX IF NOT EXISTS audit_log_entity_created_idx
  ON audit_log(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_receipts_order_submitted_idx
  ON payment_receipts(order_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS outbox_jobs_entity_kind_status_idx
  ON outbox_jobs(entity_id, kind, status);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0037',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
