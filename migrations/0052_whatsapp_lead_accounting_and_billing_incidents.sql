-- Durable WhatsApp lead accounting and billable-delivery incident protection.
-- All provider and recipient identities stored here are SHA-256 hashes.
CREATE TABLE IF NOT EXISTS whatsapp_lead_accounting (
  inbound_event_hash TEXT PRIMARY KEY CHECK(length(inbound_event_hash)=64),
  recipient_hash TEXT CHECK(recipient_hash IS NULL OR length(recipient_hash)=64),
  outcome TEXT NOT NULL CHECK(outcome IN (
    'RECEIVED','ELIGIBLE_RESPONSE_ATTEMPTED','RESPONSE_ACCEPTED','RESPONSE_SENT',
    'RESPONSE_DELIVERED','RESPONSE_READ','PROCESSED_RECEIPT_INPUT','PROCESSED_RECOVERY_RECEIPT',
    'SUPPRESSED_SERVICE_WINDOW','SUPPRESSED_FREE_MESSAGE','SUPPRESSED_UNVERIFIED_FLOW',
    'SUPPRESSED_DUPLICATE_OPENING','SUPPRESSED_TEST_POLICY','UNRESOLVED_NO_RESPONSE',
    'UNRESOLVED_UNKNOWN_ACCEPTANCE','UNRESOLVED_OUTBOUND_TERMINAL','UNRESOLVED_PROVIDER_SEND',
    'UNRESOLVED_PROVIDER_REJECTION','UNRESOLVED_PROVIDER_DELIVERY_FAILURE','RETRYABLE_PROVIDER_REJECTION',
    'UNRESOLVED_RATE_LIMITED','UNRESOLVED_TEST_INPUT','UNRESOLVED_TEST_FLOW_STATE',
    'UNRESOLVED_UNSUPPORTED_MESSAGE','UNRESOLVED_MEDIA_INPUT','UNRESOLVED_RECOVERY_MEDIA',
    'UNRESOLVED_UNHANDLED_INPUT','UNRESOLVED_MALFORMED_INBOUND','UNRESOLVED_RESPONSE_DELIVERY_FAILURE',
    'UNRESOLVED_INITIAL_REPLY_CONTEXT','UNRESOLVED_INITIAL_REPLY_DEAD_LETTER','UNRESOLVED_FREE_ELIGIBILITY','SUPPRESSED_RECOVERY_MODE'
  )),
  reason_code TEXT NOT NULL CHECK(length(reason_code) BETWEEN 1 AND 100),
  eligible INTEGER NOT NULL DEFAULT 0 CHECK(eligible IN (0,1)),
  attempted INTEGER NOT NULL DEFAULT 0 CHECK(attempted IN (0,1)),
  accepted INTEGER NOT NULL DEFAULT 0 CHECK(accepted IN (0,1)),
  delivered INTEGER NOT NULL DEFAULT 0 CHECK(delivered IN (0,1)),
  read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)),
  received_at TEXT NOT NULL,
  response_accepted_at TEXT,
  response_attempts INTEGER NOT NULL DEFAULT 0 CHECK(response_attempts>=0),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_lead_accounting_recipient_received
  ON whatsapp_lead_accounting(recipient_hash,received_at);

CREATE TABLE IF NOT EXISTS whatsapp_lead_responses (
  inbound_event_hash TEXT NOT NULL REFERENCES whatsapp_lead_accounting(inbound_event_hash),
  provider_message_hash TEXT NOT NULL CHECK(length(provider_message_hash)=64),
  accepted_at TEXT NOT NULL,
  PRIMARY KEY(inbound_event_hash,provider_message_hash)
);
CREATE INDEX IF NOT EXISTS whatsapp_lead_responses_inbound_idx ON whatsapp_lead_responses(inbound_event_hash);

CREATE TABLE IF NOT EXISTS whatsapp_billing_incidents (
  provider_message_hash TEXT PRIMARY KEY CHECK(length(provider_message_hash)=64),
  recipient_hash TEXT CHECK(recipient_hash IS NULL OR length(recipient_hash)=64),
  category_hash TEXT NOT NULL CHECK(length(category_hash)=64),
  evidence_hash TEXT NOT NULL CHECK(length(evidence_hash)=64),
  detected_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status='ACTIVE')
);
CREATE INDEX IF NOT EXISTS whatsapp_billing_incidents_recipient_idx
  ON whatsapp_billing_incidents(recipient_hash,status);

CREATE TABLE IF NOT EXISTS whatsapp_send_blocks (
  recipient_hash TEXT PRIMARY KEY CHECK(length(recipient_hash)=64),
  incident_provider_message_hash TEXT NOT NULL REFERENCES whatsapp_billing_incidents(provider_message_hash),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status='ACTIVE'),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_system_send_pauses (
  pause_key TEXT PRIMARY KEY CHECK(pause_key='WABA_GLOBAL'),
  incident_provider_message_hash TEXT NOT NULL REFERENCES whatsapp_billing_incidents(provider_message_hash),
  reason_code TEXT NOT NULL CHECK(reason_code='CONFIRMED_BILLABLE_DELIVERY_REQUIRES_OWNER_REVIEW'),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status='ACTIVE'),
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0052',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
