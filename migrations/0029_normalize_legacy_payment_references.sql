DROP INDEX IF EXISTS payments_method_transaction_reference_unique;
CREATE UNIQUE INDEX payments_method_transaction_reference_unique
  ON payments(method, upper(replace(replace(replace(replace(replace(replace(trim(customer_transaction_reference),' ',''),char(9),''),char(10),''),char(11),''),char(12),''),char(13),'')))
  WHERE method IS NOT NULL
    AND customer_transaction_reference IS NOT NULL
    AND trim(customer_transaction_reference) <> '';
