ALTER TABLE customers ADD COLUMN normalized_contact_number TEXT;
ALTER TABLE customers ADD COLUMN whatsapp_number TEXT;
ALTER TABLE customers ADD COLUMN normalized_whatsapp_number TEXT;
UPDATE customers SET normalized_contact_number=normalized_phone WHERE normalized_contact_number IS NULL;
