CREATE TABLE cod_configuration (
  id TEXT PRIMARY KEY CHECK(id='default'),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  fee_pkr INTEGER NOT NULL DEFAULT 125 CHECK(fee_pkr >= 0),
  collection_policy_hash TEXT,
  remittance_policy_hash TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO cod_configuration(id,enabled,fee_pkr,updated_at)
VALUES('default',0,125,'1970-01-01T00:00:00.000Z');

CREATE TABLE cod_order_details (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  base_amount_pkr INTEGER NOT NULL CHECK(base_amount_pkr >= 0),
  cod_fee_pkr INTEGER NOT NULL CHECK(cod_fee_pkr >= 0),
  quoted_total_pkr INTEGER NOT NULL CHECK(quoted_total_pkr = base_amount_pkr + cod_fee_pkr),
  status TEXT NOT NULL DEFAULT 'COD_PENDING' CHECK(status IN ('COD_PENDING','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','PAID')),
  collection_ref_hmac TEXT,
  collection_amount_pkr INTEGER,
  collection_actor TEXT,
  collection_at TEXT,
  remittance_ref_hmac TEXT,
  remittance_amount_pkr INTEGER,
  remittance_actor TEXT,
  remittance_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER cod_payment_approval_guard
BEFORE UPDATE OF review_state,approved_amount,approved_by,approved_at ON payments
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.order_id)
 AND (NEW.review_state <> OLD.review_state OR NEW.approved_amount IS NOT OLD.approved_amount
      OR NEW.approved_by IS NOT OLD.approved_by OR NEW.approved_at IS NOT OLD.approved_at)
 AND NOT (
   OLD.review_state='PENDING' AND NEW.review_state='COD_PENDING' AND NEW.approved_amount IS NULL AND NEW.approved_by IS NULL AND NEW.approved_at IS NULL
   AND EXISTS(SELECT 1 FROM orders o JOIN cod_order_details cod ON cod.order_id=o.id WHERE o.id=NEW.order_id AND o.state='COD_PENDING' AND o.payment_status='COD_PENDING' AND cod.status='COD_PENDING')
 )
 AND NOT (
   OLD.review_state='COD_PENDING' AND NEW.review_state='COD_PAID' AND NEW.approved_amount=(SELECT quoted_total_pkr FROM cod_order_details WHERE order_id=NEW.order_id)
   AND NEW.approved_by IS NOT NULL AND NEW.approved_at IS NOT NULL
   AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=NEW.order_id AND cod.status='PAID' AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr)
 )
BEGIN
  SELECT RAISE(ABORT,'COD_REQUIRES_COLLECTION_REMITTANCE_RECONCILIATION');
END;

CREATE TRIGGER cod_status_transition_guard
BEFORE UPDATE OF status ON cod_order_details
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='COD_PENDING' AND NEW.status='PACKING') OR
  (OLD.status='PACKING' AND NEW.status='DISPATCHED') OR
  (OLD.status='DISPATCHED' AND NEW.status='DELIVERED') OR
  (OLD.status='DELIVERED' AND NEW.status='COLLECTION_PENDING') OR
  (OLD.status='COLLECTION_PENDING' AND NEW.status='PAID' AND NEW.collection_ref_hmac IS NOT NULL AND NEW.collection_amount_pkr=NEW.quoted_total_pkr AND NEW.remittance_ref_hmac IS NOT NULL AND NEW.remittance_amount_pkr=NEW.quoted_total_pkr)
)
BEGIN
  SELECT RAISE(ABORT,'COD_STATE_TRANSITION_INVALID');
END;

CREATE TRIGGER cod_receipt_guard
BEFORE INSERT ON payment_receipts
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=NEW.order_id)
BEGIN
  SELECT RAISE(ABORT,'COD_DOES_NOT_ACCEPT_ADVANCE_RECEIPTS');
END;

CREATE TRIGGER cod_paid_status_guard
BEFORE UPDATE OF status ON cod_order_details
WHEN NEW.status='PAID'
 AND (NEW.collection_ref_hmac IS NULL OR NEW.collection_amount_pkr IS NOT NEW.quoted_total_pkr
      OR NEW.remittance_ref_hmac IS NULL OR NEW.remittance_amount_pkr IS NOT NEW.quoted_total_pkr)
BEGIN
  SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED');
END;

CREATE TRIGGER cod_order_transition_guard
BEFORE UPDATE OF state ON orders
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id)
 AND NEW.state<>OLD.state
 AND NOT (
   (OLD.state='DETAILS_COMPLETED' AND NEW.state='COD_PENDING' AND NEW.payment_status='COD_PENDING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='COD_PENDING')) OR
   (OLD.state='COD_PENDING' AND NEW.state='PACKING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='COD_PENDING')) OR
   (OLD.state='PACKING' AND NEW.state='DISPATCHED' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PACKING') AND EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='ORDER' AND a.entity_id=OLD.id AND a.action='ORDER_TRACKING_ASSIGNED')) OR
   (OLD.state='DISPATCHED' AND NEW.state='DELIVERED' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='DISPATCHED')) OR
   (OLD.state='DELIVERED' AND NEW.state='COLLECTION_PENDING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='DELIVERED')) OR
   (OLD.state='COLLECTION_PENDING' AND NEW.state='PAID' AND NEW.payment_status='PAID' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID' AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr))
 )
BEGIN
  SELECT RAISE(ABORT,'COD_STATE_TRANSITION_INVALID');
END;

CREATE TRIGGER cod_order_state_sync
AFTER UPDATE OF state ON orders
WHEN NEW.state<>OLD.state AND NEW.state<>'PAID'
 AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=NEW.id AND cod.status<>NEW.state)
BEGIN
  UPDATE cod_order_details SET status=NEW.state,updated_at=NEW.updated_at WHERE order_id=NEW.id;
END;

CREATE TRIGGER cod_order_paid_guard
BEFORE UPDATE OF state,payment_status ON orders
WHEN OLD.state='COLLECTION_PENDING' AND NEW.state='PAID'
 AND (NEW.payment_status<>'PAID' OR NOT EXISTS(
   SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID'
    AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr
    AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr
 ))
BEGIN
  SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED');
END;
