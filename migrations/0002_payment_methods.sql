CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL UNIQUE CHECK(method IN ('JAZZCASH','EASYPAISA','BANK_TRANSFER')),
  display_name TEXT NOT NULL,
  recipient_name TEXT,
  till_id TEXT,
  qr_r2_key TEXT,
  qr_sha256 TEXT,
  qr_mime_type TEXT,
  qr_size_bytes INTEGER,
  instructions TEXT,
  reference_instruction TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX payment_methods_enabled_order_idx ON payment_methods(enabled, sort_order);

INSERT INTO payment_methods (id, method, display_name, enabled, sort_order, updated_at, updated_by) VALUES
  ('payment-method-jazzcash', 'JAZZCASH', 'JazzCash', 0, 10, datetime('now'), 'bootstrap'),
  ('payment-method-easypaisa', 'EASYPAISA', 'Easypaisa', 0, 20, datetime('now'), 'bootstrap'),
  ('payment-method-bank-transfer', 'BANK_TRANSFER', 'Bank Transfer', 0, 30, datetime('now'), 'bootstrap');
