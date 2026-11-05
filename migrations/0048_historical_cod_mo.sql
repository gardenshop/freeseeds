-- Historical COD settlement for orders created before COD selection was persisted.
-- Original payment method, quote, receipts and review history remain untouched.
CREATE TABLE IF NOT EXISTS cod_historical_mo_receipts (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  mo_reference_hmac TEXT NOT NULL UNIQUE,
  received_amount_pkr INTEGER NOT NULL CHECK(received_amount_pkr >= 0),
  receipt_date TEXT NOT NULL,
  evidence_reference_hmac TEXT NOT NULL,
  settlement_reason TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS cod_historical_mo_immutable_update
BEFORE UPDATE ON cod_historical_mo_receipts
BEGIN
  SELECT RAISE(ABORT,'COD_HISTORICAL_MO_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS cod_historical_mo_immutable_delete
BEFORE DELETE ON cod_historical_mo_receipts
BEGIN
  SELECT RAISE(ABORT,'COD_HISTORICAL_MO_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS cod_historical_order_paid_guard
BEFORE UPDATE OF state,payment_status ON orders
WHEN (OLD.state <> NEW.state OR OLD.payment_status <> NEW.payment_status)
 AND NEW.state='PAID' AND NEW.payment_status='PAID'
 AND EXISTS(SELECT 1 FROM cod_historical_mo_receipts mo WHERE mo.order_id=OLD.id)
 AND NOT EXISTS(SELECT 1 FROM cod_historical_mo_receipts mo WHERE mo.order_id=OLD.id AND mo.received_amount_pkr=OLD.total_payable)
BEGIN
  SELECT RAISE(ABORT,'COD_HISTORICAL_MO_AMOUNT_REQUIRED');
END;

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0048',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
