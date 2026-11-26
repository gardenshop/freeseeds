-- GFS ORDERFLOW INTENT-030: local/backward-compatible intent and presentation anchor.
-- Production migration is separately gated. Existing orders receive no backfill.
CREATE TABLE IF NOT EXISTS order_confirmation_intents (
  intent_id TEXT PRIMARY KEY,
  workflow_version TEXT NOT NULL CHECK(workflow_version='GFS-ORDERFLOW-INTENT-030-V1'),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  conversation_id TEXT NOT NULL REFERENCES whatsapp_conversations(id),
  state TEXT NOT NULL CHECK(state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING','CONFIRMED_COD','PAID','PAYMENT_REVIEW','CANCELLED','EXPIRED','PRESENTATION_FAILED')),
  advance_total_pkr INTEGER NOT NULL CHECK(advance_total_pkr>=0),
  cod_enabled INTEGER NOT NULL CHECK(cod_enabled IN (0,1)),
  cod_fee_pkr INTEGER,
  cod_total_pkr INTEGER,
  cod_policy_revision TEXT,
  collection_policy_hash TEXT,
  remittance_policy_hash TEXT,
  presentation_message_id TEXT UNIQUE,
  presented_at TEXT,
  deadline_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((cod_enabled=0 AND cod_fee_pkr IS NULL AND cod_total_pkr IS NULL) OR (cod_enabled=1 AND cod_fee_pkr=125 AND cod_total_pkr=advance_total_pkr+cod_fee_pkr)),
  CHECK((presented_at IS NULL AND deadline_at IS NULL) OR (presented_at IS NOT NULL AND deadline_at IS NOT NULL AND deadline_at>presented_at)),
  CHECK(presentation_message_id IS NOT NULL OR presented_at IS NULL)
);

CREATE INDEX IF NOT EXISTS order_confirmation_intents_due_idx
  ON order_confirmation_intents(state,deadline_at);
CREATE INDEX IF NOT EXISTS order_confirmation_intents_order_version_idx
  ON order_confirmation_intents(order_id,workflow_version,state);

CREATE TABLE IF NOT EXISTS order_confirmation_intent_stages (
  intent_id TEXT NOT NULL REFERENCES order_confirmation_intents(intent_id),
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (10,25,30)),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUEUED','SENT','SUPPRESSED','SKIPPED','EXPIRED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(intent_id,stage_minutes)
);
CREATE INDEX IF NOT EXISTS order_confirmation_intent_stages_due_idx
  ON order_confirmation_intent_stages(status,due_at,stage_minutes);

-- Retain only qualifying webhook status and provider event time, never raw callback bodies.
CREATE TABLE IF NOT EXISTS whatsapp_delivery_receipts (
  provider_message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('DELIVERED','READ')),
  provider_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY(provider_message_id,status)
);

CREATE TRIGGER IF NOT EXISTS order_intent_advance_state_from_order
AFTER UPDATE OF state,payment_status ON orders
WHEN NEW.id IS NOT OLD.id
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
  WHERE order_id=NEW.id AND state NOT IN ('PAID','PAYMENT_REVIEW','CONFIRMED_COD','CANCELLED','EXPIRED','PRESENTATION_FAILED');
  UPDATE order_confirmation_intent_stages
  SET status='SUPPRESSED',last_error='INTENT_NO_LONGER_UNRESOLVED',updated_at=NEW.updated_at
  WHERE intent_id IN (SELECT intent_id FROM order_confirmation_intents WHERE order_id=NEW.id AND state IN ('PAID','PAYMENT_REVIEW','CONFIRMED_COD','CANCELLED','EXPIRED'))
    AND status IN ('PENDING','QUEUED');
END;

CREATE TRIGGER IF NOT EXISTS order_intent_advance_state_from_payment_review
AFTER UPDATE OF review_state ON payments
WHEN NEW.review_state='REVIEW'
BEGIN
  UPDATE order_confirmation_intents
  SET state='PAYMENT_REVIEW',updated_at=NEW.updated_at
  WHERE order_id=NEW.order_id AND state IN ('PRESENTATION_PENDING','AWAITING_DECISION','ADVANCE_PENDING','COD_CONFIRM_PENDING');
  UPDATE order_confirmation_intent_stages
  SET status='SUPPRESSED',last_error='PAYMENT_REVIEW_PROTECTED',updated_at=NEW.updated_at
  WHERE intent_id IN (SELECT intent_id FROM order_confirmation_intents WHERE order_id=NEW.order_id AND state='PAYMENT_REVIEW')
    AND status IN ('PENDING','QUEUED');
END;
