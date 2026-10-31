-- GFS-316: bound the repeated Admin/Cron lookup paths.
-- Additive only. No customer, order, payment, receipt, COD, or reminder state is changed.
CREATE INDEX IF NOT EXISTS orders_updated_id_idx
  ON orders(updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS orders_recovery_candidate_idx
  ON orders(archived_at, payment_status, state, created_at, id);

CREATE INDEX IF NOT EXISTS outbound_messages_order_kind_status_idx
  ON outbound_messages(order_id, kind, status, updated_at DESC, id);

CREATE INDEX IF NOT EXISTS outbound_messages_updated_order_idx
  ON outbound_messages(updated_at DESC, order_id, id);

CREATE INDEX IF NOT EXISTS outbound_messages_kind_status_key_idx
  ON outbound_messages(kind, status, idempotency_key);

CREATE INDEX IF NOT EXISTS outbox_jobs_kind_status_available_idx
  ON outbox_jobs(kind, status, available_at, id);

CREATE INDEX IF NOT EXISTS outbox_jobs_updated_entity_kind_idx
  ON outbox_jobs(updated_at DESC, entity_id, kind, id);

CREATE INDEX IF NOT EXISTS payments_updated_order_idx
  ON payments(updated_at DESC, order_id, id);

CREATE INDEX IF NOT EXISTS cod_order_details_updated_order_idx
  ON cod_order_details(updated_at DESC, order_id);

CREATE INDEX IF NOT EXISTS payment_reminder_v2_stage_schedule_status_due_idx
  ON payment_reminder_v2_stages(schedule_id, status, due_at, stage_minutes);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0043',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
