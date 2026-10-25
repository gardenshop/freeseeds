ALTER TABLE payment_reminder_v2_stages ADD COLUMN locale TEXT CHECK(locale IS NULL OR locale IN ('en','ur'));
ALTER TABLE payment_reminder_v2_stages ADD COLUMN template_version INTEGER;
ALTER TABLE payment_reminder_v2_stages ADD COLUMN rendered_text TEXT;
ALTER TABLE payment_reminder_v2_stages ADD COLUMN sent_at TEXT;
