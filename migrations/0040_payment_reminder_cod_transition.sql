-- GFS-279: allow only the explicit reminder fallback into the existing COD lifecycle.
DROP TRIGGER IF EXISTS cod_order_transition_guard;
CREATE TRIGGER cod_order_transition_guard
BEFORE UPDATE OF state ON orders
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id) AND NEW.state<>OLD.state
 AND NOT (
   (OLD.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_GRACE') AND NEW.state='COD_PENDING' AND NEW.payment_status='COD_PENDING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='COD_PENDING')) OR
   (OLD.state='COD_PENDING' AND NEW.state='PACKING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='COD_PENDING')) OR
   (OLD.state='PACKING' AND NEW.state='DISPATCHED' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PACKING') AND EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='ORDER' AND a.entity_id=OLD.id AND a.action='ORDER_TRACKING_ASSIGNED')) OR
   (OLD.state='DISPATCHED' AND NEW.state='DELIVERED' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='DISPATCHED')) OR
   (OLD.state='DELIVERED' AND NEW.state='COLLECTION_PENDING' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='DELIVERED')) OR
   (OLD.state='COLLECTION_PENDING' AND NEW.state='PAID' AND NEW.payment_status='PAID' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID' AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr))
 )
BEGIN SELECT RAISE(ABORT,'COD_STATE_TRANSITION_INVALID'); END;
DROP TRIGGER IF EXISTS cod_order_payment_status_guard;
CREATE TRIGGER cod_order_payment_status_guard
BEFORE UPDATE OF payment_status ON orders
WHEN EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id) AND NEW.payment_status IS NOT OLD.payment_status
 AND NOT (OLD.state IN ('DETAILS_COMPLETED','PAYMENT_PENDING','PAYMENT_GRACE') AND NEW.state='COD_PENDING' AND NEW.payment_status='COD_PENDING')
 AND NOT (OLD.state='COLLECTION_PENDING' AND NEW.state='PAID' AND NEW.payment_status='PAID' AND EXISTS(SELECT 1 FROM cod_order_details cod WHERE cod.order_id=OLD.id AND cod.status='PAID' AND cod.test_hold=0 AND cod.collection_ref_hmac IS NOT NULL AND cod.collection_amount_pkr=cod.quoted_total_pkr AND cod.remittance_ref_hmac IS NOT NULL AND cod.remittance_amount_pkr=cod.quoted_total_pkr))
BEGIN SELECT RAISE(ABORT,'COD_COLLECTION_AND_EXACT_REMITTANCE_REQUIRED'); END;
INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at) VALUES('0040',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
