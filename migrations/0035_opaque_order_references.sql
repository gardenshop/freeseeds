-- New orders keep the private Karachi-day sequence separately from the customer reference.
-- Existing order_number values are intentionally not rewritten.
ALTER TABLE orders ADD COLUMN internal_sequence INTEGER;
ALTER TABLE orders ADD COLUMN internal_sequence_date TEXT;
CREATE UNIQUE INDEX orders_internal_sequence_unique
  ON orders(internal_sequence_date, internal_sequence)
  WHERE internal_sequence_date IS NOT NULL AND internal_sequence IS NOT NULL;
