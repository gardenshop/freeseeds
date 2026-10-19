-- Payment instructions that are customer-facing must not reuse English text in Urdu messages.
ALTER TABLE payment_methods ADD COLUMN instructions_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN reference_instruction_ur TEXT;

-- PAYMENT method buttons are runtime-generated from complete enabled D1 methods.
-- Legacy action-label rows remain historical, but are ignored by the runtime allowlist.
