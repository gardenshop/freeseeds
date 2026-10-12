CREATE TABLE order_eligibility_locks (
  household_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_number TEXT,
  last_order_at TEXT NOT NULL
);

INSERT OR IGNORE INTO order_eligibility_locks (household_key, order_id, order_number, last_order_at)
SELECT c.normalized_address_hash, o.id, o.order_number, o.created_at
FROM orders o
JOIN customers c ON c.id=o.customer_id
WHERE c.normalized_address_hash IS NOT NULL
  AND o.created_at=(SELECT MAX(o2.created_at) FROM orders o2 JOIN customers c2 ON c2.id=o2.customer_id WHERE c2.normalized_address_hash=c.normalized_address_hash);
