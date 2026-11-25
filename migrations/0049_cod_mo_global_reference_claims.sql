-- Normal and historical MO ledgers must share one durable article-reference namespace.
-- A zero-result CHECK makes legacy cross-ledger conflicts stop this migration before claims are written.
CREATE TABLE IF NOT EXISTS cod_mo_reference_migration_preflight (
  id INTEGER PRIMARY KEY CHECK(id=1),
  legacy_duplicate_count INTEGER NOT NULL CHECK(legacy_duplicate_count=0),
  checked_at TEXT NOT NULL
);

INSERT OR REPLACE INTO cod_mo_reference_migration_preflight(id,legacy_duplicate_count,checked_at)
VALUES(
  1,
  (SELECT COUNT(*) FROM (
    SELECT mo_reference_hmac
    FROM (
      SELECT mo_reference_hmac FROM cod_mo_receipts
      UNION ALL
      SELECT mo_reference_hmac FROM cod_historical_mo_receipts
    ) AS existing_mo_references
    GROUP BY mo_reference_hmac
    HAVING COUNT(*)>1
  )),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

CREATE TABLE IF NOT EXISTS cod_mo_reference_claims (
  mo_reference_hmac TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  ledger_type TEXT NOT NULL CHECK(ledger_type IN ('NORMAL','HISTORICAL')),
  claimed_at TEXT NOT NULL
);

INSERT OR IGNORE INTO cod_mo_reference_claims(mo_reference_hmac,order_id,ledger_type,claimed_at)
SELECT mo_reference_hmac,order_id,'NORMAL',received_at FROM cod_mo_receipts
UNION ALL
SELECT mo_reference_hmac,order_id,'HISTORICAL',received_at FROM cod_historical_mo_receipts;

-- AFTER INSERT preserves compatibility with an older Worker while the migration is rolled out.
CREATE TRIGGER IF NOT EXISTS cod_mo_reference_claim_normal_insert
AFTER INSERT ON cod_mo_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM cod_mo_reference_claims
  WHERE mo_reference_hmac=NEW.mo_reference_hmac AND order_id=NEW.order_id AND ledger_type='NORMAL'
)
BEGIN
  INSERT INTO cod_mo_reference_claims(mo_reference_hmac,order_id,ledger_type,claimed_at)
  VALUES(NEW.mo_reference_hmac,NEW.order_id,'NORMAL',NEW.received_at);
END;

CREATE TRIGGER IF NOT EXISTS cod_mo_reference_claim_historical_insert
AFTER INSERT ON cod_historical_mo_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM cod_mo_reference_claims
  WHERE mo_reference_hmac=NEW.mo_reference_hmac AND order_id=NEW.order_id AND ledger_type='HISTORICAL'
)
BEGIN
  INSERT INTO cod_mo_reference_claims(mo_reference_hmac,order_id,ledger_type,claimed_at)
  VALUES(NEW.mo_reference_hmac,NEW.order_id,'HISTORICAL',NEW.received_at);
END;

-- Recheck after the compatibility triggers exist to catch rows written during preflight.
INSERT OR REPLACE INTO cod_mo_reference_migration_preflight(id,legacy_duplicate_count,checked_at)
VALUES(
  1,
  (SELECT COUNT(*) FROM (
    SELECT mo_reference_hmac
    FROM (
      SELECT mo_reference_hmac FROM cod_mo_receipts
      UNION ALL
      SELECT mo_reference_hmac FROM cod_historical_mo_receipts
    ) AS existing_mo_references
    GROUP BY mo_reference_hmac
    HAVING COUNT(*)>1
  )),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

INSERT OR IGNORE INTO cod_mo_reference_claims(mo_reference_hmac,order_id,ledger_type,claimed_at)
SELECT mo_reference_hmac,order_id,'NORMAL',received_at FROM cod_mo_receipts
UNION ALL
SELECT mo_reference_hmac,order_id,'HISTORICAL',received_at FROM cod_historical_mo_receipts;

CREATE TRIGGER IF NOT EXISTS cod_mo_reference_claim_immutable_update
BEFORE UPDATE ON cod_mo_reference_claims
BEGIN
  SELECT RAISE(ABORT,'COD_MO_REFERENCE_CLAIM_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS cod_mo_reference_claim_immutable_delete
BEFORE DELETE ON cod_mo_reference_claims
BEGIN
  SELECT RAISE(ABORT,'COD_MO_REFERENCE_CLAIM_IMMUTABLE');
END;

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0049',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
