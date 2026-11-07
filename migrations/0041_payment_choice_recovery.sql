-- GFS-299: bounded, owner-requested recovery for orders that never selected a method.
-- Additive only. No historical rows are backfilled and no payment/order state is changed.
CREATE TABLE IF NOT EXISTS payment_choice_recoveries (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','DELIVERED','READ','FAILED','BLOCKED_WINDOW','SKIPPED')),
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  inbound_message_id TEXT NOT NULL,
  inbound_at TEXT NOT NULL,
  outbound_idempotency_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  last_error TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_status_idx
  ON payment_choice_recoveries(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_inbound_idx
  ON payment_choice_recoveries(inbound_at DESC,order_id);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0041',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
