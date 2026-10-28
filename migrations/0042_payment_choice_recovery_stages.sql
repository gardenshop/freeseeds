-- GFS-301: bounded two-stage recovery for newly-created no-method orders.
-- Additive only. The feature remains disabled unless the Worker flag and an
-- explicit activation start time are configured. No historical rows are added.
CREATE TABLE IF NOT EXISTS payment_choice_recovery_stages (
  order_id TEXT NOT NULL REFERENCES orders(id),
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,210)),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','BLOCKED_WINDOW','SKIPPED')),
  due_at TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  inbound_message_id TEXT,
  inbound_at TEXT,
  outbound_idempotency_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(order_id, stage_minutes)
);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_stage_due_idx
  ON payment_choice_recovery_stages(status,due_at,order_id);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_stage_order_idx
  ON payment_choice_recovery_stages(order_id,stage_minutes);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0042',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
