ALTER TABLE customers ADD COLUMN bsuid TEXT;
ALTER TABLE customers ADD COLUMN bsuid_business_id TEXT;
ALTER TABLE customers ADD COLUMN whatsapp_username TEXT;
CREATE UNIQUE INDEX customers_bsuid_scope_unique ON customers(bsuid_business_id, bsuid) WHERE bsuid IS NOT NULL AND bsuid_business_id IS NOT NULL;
