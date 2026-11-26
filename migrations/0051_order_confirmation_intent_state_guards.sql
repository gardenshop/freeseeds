-- INTENT-030 follow-up to migration0050: replace its no-op order-id predicate
-- with state-based transitions. This file is a local candidate only.
CREATE TABLE IF NOT EXISTS order_confirmation_intent_preferences (
  intent_id TEXT PRIMARY KEY REFERENCES order_confirmation_intents(intent_id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  created_at TEXT NOT NULL
);

DROP TRIGGER IF EXISTS order_intent_advance_state_from_order;
CREATE TRIGGER order_intent_advance_state_from_order
AFTER UPDATE OF state,payment_status ON orders
WHEN NEW.state IS NOT OLD.state OR NEW.payment_status IS NOT OLD.payment_status
BEGIN
  UPDATE order_confirmation_intents
  SET state=CASE
    WHEN NEW.state='PAID' AND NEW.payment_status='PAID' THEN 'PAID'
    WHEN NEW.state='PAYMENT_REVIEW' THEN 'PAYMENT_REVIEW'
    WHEN NEW.state='COD_PENDING' AND NEW.payment_status='COD_PENDING' THEN 'CONFIRMED_COD'
    WHEN NEW.state='CANCELLED' THEN 'CANCELLED'
    WHEN NEW.state='EXPIRED' THEN 'EXPIRED'
    WHEN NEW.state='PAYMENT_PENDING' AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION') THEN 'ADVANCE_PENDING'
    ELSE state
  END,
  updated_at=NEW.updated_at
  WHERE order_id=NEW.id AND state NOT IN ('PAID','CANCELLED','PRESENTATION_FAILED');

  UPDATE order_confirmation_intent_stages
  SET status='SUPPRESSED',last_error='INTENT_NO_LONGER_UNRESOLVED',updated_at=NEW.updated_at
  WHERE intent_id IN (SELECT intent_id FROM order_confirmation_intents WHERE order_id=NEW.id AND state IN ('PAID','PAYMENT_REVIEW','CONFIRMED_COD','CANCELLED','EXPIRED'))
    AND stage_minutes IN (10,25) AND status IN ('PENDING','QUEUED');

  UPDATE order_confirmation_intent_stages
  SET status='SUPPRESSED',last_error='INTENT_CONFIRMED_OR_CANCELLED',updated_at=NEW.updated_at
  WHERE intent_id IN (SELECT intent_id FROM order_confirmation_intents WHERE order_id=NEW.id AND state IN ('PAID','PAYMENT_REVIEW','CONFIRMED_COD','CANCELLED'))
    AND stage_minutes=30 AND status IN ('PENDING','QUEUED');

  DELETE FROM order_eligibility_locks
  WHERE order_id=NEW.id AND NEW.state IN ('CANCELLED','EXPIRED');
END;

DROP TRIGGER IF EXISTS order_intent_advance_state_from_payment_review;
CREATE TRIGGER order_intent_advance_state_from_payment_review
AFTER UPDATE OF review_state ON payments
WHEN NEW.review_state='REVIEW'
BEGIN
  UPDATE order_confirmation_intents
  SET state='PAYMENT_REVIEW',updated_at=NEW.updated_at
  WHERE order_id=NEW.order_id AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING','EXPIRED');

  UPDATE order_confirmation_intent_stages
  SET status='SUPPRESSED',last_error='PAYMENT_REVIEW_PROTECTED',updated_at=NEW.updated_at
  WHERE intent_id IN (SELECT intent_id FROM order_confirmation_intents WHERE order_id=NEW.order_id AND state='PAYMENT_REVIEW')
    AND status IN ('PENDING','QUEUED');
END;

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0051',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
