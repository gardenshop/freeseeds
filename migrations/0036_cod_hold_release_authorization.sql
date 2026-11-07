-- Controlled release is additive. The fail-closed default in 0030 remains unchanged.
CREATE TABLE IF NOT EXISTS cod_hold_release_authorizations (
  order_id TEXT PRIMARY KEY REFERENCES cod_order_details(order_id),
  audit_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

DROP TRIGGER IF EXISTS cod_snapshot_immutable;
CREATE TRIGGER cod_snapshot_immutable
BEFORE UPDATE ON cod_order_details
WHEN (NEW.order_id IS NOT OLD.order_id OR NEW.base_amount_pkr IS NOT OLD.base_amount_pkr
 OR NEW.cod_fee_pkr IS NOT OLD.cod_fee_pkr OR NEW.quoted_total_pkr IS NOT OLD.quoted_total_pkr
 OR NEW.policy_revision IS NOT OLD.policy_revision OR NEW.collection_policy_hash IS NOT OLD.collection_policy_hash
 OR NEW.remittance_policy_hash IS NOT OLD.remittance_policy_hash
 OR (NEW.test_hold IS NOT OLD.test_hold AND NOT (
   OLD.test_hold=1 AND NEW.test_hold=0 AND EXISTS(
     SELECT 1 FROM cod_hold_release_authorizations r
     WHERE r.order_id=OLD.order_id AND r.consumed_at IS NULL
   )
 )))
BEGIN
  SELECT RAISE(ABORT,'COD_SNAPSHOT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS cod_hold_release_authorization_consume
AFTER UPDATE OF test_hold ON cod_order_details
WHEN OLD.test_hold=1 AND NEW.test_hold=0
BEGIN
  UPDATE cod_hold_release_authorizations SET consumed_at=NEW.updated_at WHERE order_id=NEW.order_id AND consumed_at IS NULL;
END;

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0036',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
