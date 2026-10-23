PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS orders_state_idx;

CREATE TABLE orders_dynamic (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  campaign_id TEXT REFERENCES campaigns(id),
  offer_code TEXT NOT NULL,
  pack_quantity INTEGER NOT NULL CHECK(typeof(pack_quantity) = 'integer' AND pack_quantity > 0),
  seed_price INTEGER NOT NULL CHECK(typeof(seed_price) = 'integer' AND seed_price >= 0),
  delivery_fee INTEGER NOT NULL CHECK(typeof(delivery_fee) = 'integer' AND delivery_fee >= 0),
  fertilizer_fee INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fertilizer_fee) = 'integer' AND fertilizer_fee >= 0),
  total_payable INTEGER NOT NULL CHECK(typeof(total_payable) = 'integer' AND total_payable = seed_price + fertilizer_fee + delivery_fee),
  province TEXT,
  fertilizer_selected INTEGER NOT NULL DEFAULT 0 CHECK(fertilizer_selected IN (0,1)),
  state TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  duplicate_review_required INTEGER NOT NULL DEFAULT 0 CHECK(duplicate_review_required IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO orders_dynamic (
  id, order_number, customer_id, campaign_id, offer_code, pack_quantity, seed_price,
  delivery_fee, fertilizer_fee, total_payable, province, fertilizer_selected, state,
  payment_status, duplicate_review_required, created_at, updated_at
)
SELECT id, order_number, customer_id, campaign_id, offer_code, pack_quantity, seed_price,
  delivery_fee, 0, total_payable, NULL, 0, state, payment_status,
  duplicate_review_required, created_at, updated_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_dynamic RENAME TO orders;
CREATE INDEX orders_state_idx ON orders(state);
CREATE INDEX orders_province_idx ON orders(province);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_pkr INTEGER NOT NULL CHECK(typeof(price_pkr) = 'integer' AND price_pkr >= 0),
  fertilizer_price_pkr INTEGER CHECK(fertilizer_price_pkr IS NULL OR (typeof(fertilizer_price_pkr) = 'integer' AND fertilizer_price_pkr >= 0)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX products_enabled_code_idx ON products(enabled, code);

CREATE TABLE province_delivery_rates (
  id TEXT PRIMARY KEY,
  province TEXT NOT NULL COLLATE NOCASE UNIQUE,
  delivery_fee_pkr INTEGER NOT NULL CHECK(typeof(delivery_fee_pkr) = 'integer' AND delivery_fee_pkr >= 0),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX province_delivery_rates_enabled_idx ON province_delivery_rates(enabled, province);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT REFERENCES products(id),
  item_type TEXT NOT NULL CHECK(item_type IN ('PRODUCT','FERTILIZER')),
  product_code TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity > 0),
  unit_price_pkr INTEGER NOT NULL CHECK(typeof(unit_price_pkr) = 'integer' AND unit_price_pkr >= 0),
  line_total_pkr INTEGER NOT NULL CHECK(typeof(line_total_pkr) = 'integer' AND line_total_pkr = quantity * unit_price_pkr),
  created_at TEXT NOT NULL,
  UNIQUE(order_id, item_type, product_code)
);
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);

PRAGMA foreign_keys = ON;
