PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  wa_id TEXT,
  full_name TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  nearby_place TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  normalized_address_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX customers_wa_id_unique ON customers(wa_id) WHERE wa_id IS NOT NULL;
CREATE INDEX customers_phone_idx ON customers(normalized_phone);

CREATE TABLE campaigns (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, meta_campaign_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  campaign_id TEXT REFERENCES campaigns(id),
  offer_code TEXT NOT NULL,
  pack_quantity INTEGER NOT NULL CHECK(pack_quantity = 5),
  seed_price INTEGER NOT NULL CHECK(seed_price = 0),
  delivery_fee INTEGER NOT NULL CHECK(delivery_fee >= 0),
  total_payable INTEGER NOT NULL CHECK(total_payable = delivery_fee),
  state TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  duplicate_review_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX orders_state_idx ON orders(state);
CREATE TABLE leads (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), campaign_id TEXT REFERENCES campaigns(id), status TEXT NOT NULL, capi_event_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), method TEXT, expected_amount INTEGER NOT NULL, approved_amount INTEGER, review_state TEXT NOT NULL, submitted_at TEXT, approved_by TEXT, approved_at TEXT, rejection_reason TEXT, customer_transaction_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE payment_receipts (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), order_id TEXT NOT NULL REFERENCES orders(id), provider_media_id TEXT NOT NULL UNIQUE, r2_object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, submitted_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE meta_attribution (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), customer_id TEXT NOT NULL REFERENCES customers(id), ctwa_clid TEXT, campaign_id TEXT, ad_set_id TEXT, ad_id TEXT, minimized_referral_json TEXT, created_at TEXT NOT NULL);
CREATE TABLE capi_events (id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, event_name TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), customer_id TEXT NOT NULL REFERENCES customers(id), send_status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, last_response TEXT, last_error TEXT, provider_response_id TEXT, sent_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE whatsapp_events (id TEXT PRIMARY KEY, provider_event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL, correlation_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE outbound_messages (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, order_id TEXT REFERENCES orders(id), customer_id TEXT REFERENCES customers(id), kind TEXT NOT NULL, provider_message_id TEXT, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE audit_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, correlation_id TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE configuration (key TEXT PRIMARY KEY, value TEXT, environment TEXT NOT NULL, is_secret INTEGER NOT NULL DEFAULT 0, updated_by TEXT, updated_at TEXT NOT NULL);
CREATE TABLE duplicate_flags (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), customer_id TEXT NOT NULL REFERENCES customers(id), signal TEXT NOT NULL, confidence REAL NOT NULL, resolution TEXT, created_at TEXT NOT NULL);
CREATE TABLE order_counters (namespace TEXT PRIMARY KEY, next_value INTEGER NOT NULL CHECK(next_value >= 100000));
INSERT INTO order_counters(namespace, next_value) VALUES ('FREE_SEEDS', 100000);
CREATE TABLE outbox_jobs (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, entity_id TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
