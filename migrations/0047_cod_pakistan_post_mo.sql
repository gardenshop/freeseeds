-- Pakistan Post COD settlement: one verified Money Order is the payment evidence.
-- The raw MO number is never stored; only its keyed digest is retained.
CREATE TABLE IF NOT EXISTS cod_mo_receipts (
  order_id TEXT PRIMARY KEY REFERENCES cod_order_details(order_id),
  mo_reference_hmac TEXT NOT NULL UNIQUE,
  mo_amount_pkr INTEGER NOT NULL CHECK(mo_amount_pkr >= 0),
  operator_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS cod_mo_receipt_immutable_update
BEFORE UPDATE ON cod_mo_receipts
BEGIN
  SELECT RAISE(ABORT,'COD_MO_RECEIPT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS cod_mo_receipt_immutable_delete
BEFORE DELETE ON cod_mo_receipts
BEGIN
  SELECT RAISE(ABORT,'COD_MO_RECEIPT_IMMUTABLE');
END;

DROP TRIGGER IF EXISTS cod_order_payment_status_guard;
CREATE TRIGGER cod_order_payment_status_guard
BEFORE UPDATE OF payment_status ON orders
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id)
 AND NEW.payment_status IS NOT OLD.payment_status
 AND NOT (OLD.state='DETAILS_COMPLETED' AND NEW.state='COD_PENDING' AND NEW.payment_status='COD_PENDING')
  AND NOT (OLD.state='COLLECTION_PENDING' AND NEW.state='PAID' AND NEW.payment_status='PAID'
  AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID'
   AND ((cod.test_hold=0 AND cod.policy_revision IS NOT NULL AND cod.policy_revision<>'unconfigured' AND length(cod.collection_policy_hash)=64 AND length(cod.remittance_policy_hash)=64 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr)
    OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=cod.order_id AND mo.mo_amount_pkr=cod.quoted_total_pkr))))
BEGIN
  SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED');
END;

DROP TRIGGER IF EXISTS cod_payment_approval_guard;
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
   AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=NEW.order_id AND cod.status='PAID'
    AND ((cod.test_hold=0 AND cod.policy_revision IS NOT NULL AND cod.policy_revision<>'unconfigured' AND length(cod.collection_policy_hash)=64 AND length(cod.remittance_policy_hash)=64 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr)
     OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=cod.order_id AND mo.mo_amount_pkr=cod.quoted_total_pkr)))
 )
BEGIN
  SELECT RAISE(ABORT,'COD_REQUIRES_COLLECTION_REMITTANCE_RECONCILIATION');
END;

DROP TRIGGER IF EXISTS cod_status_transition_guard;
CREATE TRIGGER cod_status_transition_guard
BEFORE UPDATE OF status ON cod_order_details
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='COD_PENDING' AND NEW.status='PACKING') OR
  (OLD.status='PACKING' AND NEW.status='DISPATCHED') OR
  (OLD.status='DISPATCHED' AND NEW.status='DELIVERED') OR
  (OLD.status='DELIVERED' AND NEW.status='COLLECTION_PENDING') OR
  (OLD.status='COLLECTION_PENDING' AND NEW.status='PAID' AND EXISTS(
    SELECT 1 FROM cod_order_details cod WHERE cod.order_id=NEW.order_id AND ((cod.test_hold=0 AND cod.policy_revision IS NOT NULL AND cod.policy_revision<>'unconfigured' AND length(cod.collection_policy_hash)=64 AND length(cod.remittance_policy_hash)=64 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr) OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=cod.order_id AND mo.mo_amount_pkr=cod.quoted_total_pkr))
  ))
)
BEGIN
  SELECT RAISE(ABORT,'COD_STATE_TRANSITION_INVALID');
END;

DROP TRIGGER IF EXISTS cod_paid_status_guard;
CREATE TRIGGER cod_paid_status_guard
BEFORE UPDATE OF status ON cod_order_details
WHEN NEW.status='PAID'
 AND NOT (
   (NEW.test_hold=0 AND NEW.policy_revision IS NOT NULL AND NEW.policy_revision<>'unconfigured'
    AND length(NEW.collection_policy_hash)=64 AND length(NEW.remittance_policy_hash)=64
    AND NEW.collection_ref_hmac IS NOT NULL AND NEW.collection_amount_pkr=NEW.quoted_total_pkr
    AND NEW.remittance_ref_hmac IS NOT NULL AND NEW.remittance_amount_pkr=NEW.quoted_total_pkr)
   OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=NEW.order_id AND mo.mo_amount_pkr=NEW.quoted_total_pkr AND NEW.test_hold=0)
 )
BEGIN
  SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED');
END;

DROP TRIGGER IF EXISTS cod_order_transition_guard;
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
   (OLD.state='COLLECTION_PENDING' AND NEW.state='PAID' AND NEW.payment_status='PAID' AND EXISTS(
     SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID' AND ((cod.test_hold=0 AND cod.policy_revision IS NOT NULL AND cod.policy_revision<>'unconfigured' AND length(cod.collection_policy_hash)=64 AND length(cod.remittance_policy_hash)=64 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr) OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=cod.order_id AND mo.mo_amount_pkr=cod.quoted_total_pkr))
   ))
 )
BEGIN
  SELECT RAISE(ABORT,'COD_STATE_TRANSITION_INVALID');
END;

DROP TRIGGER IF EXISTS cod_order_paid_guard;
CREATE TRIGGER cod_order_paid_guard
BEFORE UPDATE OF state,payment_status ON orders
WHEN OLD.state='COLLECTION_PENDING' AND NEW.state='PAID'
 AND (NEW.payment_status<>'PAID' OR NOT EXISTS(
   SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID' AND ((cod.test_hold=0 AND cod.policy_revision IS NOT NULL AND cod.policy_revision<>'unconfigured' AND length(cod.collection_policy_hash)=64 AND length(cod.remittance_policy_hash)=64 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr) OR EXISTS(SELECT 1 FROM cod_mo_receipts mo WHERE mo.order_id=cod.order_id AND mo.mo_amount_pkr=cod.quoted_total_pkr))
  ))
BEGIN
  SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED');
END;

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0047',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
