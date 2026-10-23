CREATE TABLE cooldown_exemptions (
  wa_id TEXT PRIMARY KEY CHECK(wa_id NOT GLOB '*[^0-9]*' AND substr(wa_id, 1, 1) <> '0' AND length(wa_id) BETWEEN 7 AND 20),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO cooldown_exemptions (wa_id, reason, created_by, created_at)
VALUES ('923034901810', 'VERIFIED_E2E_SENDER', 'MIGRATION_0014', '2026-10-12T00:00:00.000Z');

ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN archived_at TEXT;
ALTER TABLE orders ADD COLUMN archived_by TEXT;
ALTER TABLE orders ADD COLUMN archive_reason TEXT;

CREATE INDEX orders_archived_state_idx ON orders(archived_at, state, created_at);
