-- Historical orders keep their existing order_number values. New orders use this per-Karachi-date allocator.
CREATE TABLE order_number_sequences (
  order_date TEXT PRIMARY KEY,
  next_sequence INTEGER NOT NULL CHECK(next_sequence BETWEEN 1 AND 1000000),
  created_at TEXT NOT NULL
);

CREATE TABLE order_requests (
  idempotency_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  source TEXT NOT NULL CHECK(source IN ('META_INSTANT_FORM','WHATSAPP','FACEBOOK_MESSENGER','INSTAGRAM_DM')),
  created_at TEXT NOT NULL
);
