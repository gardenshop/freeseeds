CREATE UNIQUE INDEX IF NOT EXISTS payments_method_transaction_reference_unique
  ON payments(method, upper(trim(customer_transaction_reference)))
  WHERE method IS NOT NULL
    AND customer_transaction_reference IS NOT NULL
    AND trim(customer_transaction_reference) <> '';
