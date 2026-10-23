-- Additive metadata keeps template versions immutable while giving the admin UI a stable journey order.
ALTER TABLE whatsapp_content_templates ADD COLUMN flow_order INTEGER;
ALTER TABLE whatsapp_content_templates ADD COLUMN section TEXT;

UPDATE whatsapp_content_templates
SET flow_order = CASE template_key
  WHEN 'WELCOME' THEN 10
  WHEN 'OFFER' THEN 20
  WHEN 'FERTILIZER' THEN 30
  WHEN 'PROVINCE_DELIVERY' THEN 40
  WHEN 'FIELD_FULL_NAME' THEN 50
  WHEN 'FIELD_DELIVERY_ADDRESS' THEN 51
  WHEN 'FIELD_NEARBY_PLACE' THEN 52
  WHEN 'FIELD_CITY' THEN 53
  WHEN 'FIELD_CONTACT_NUMBER' THEN 54
  WHEN 'REVIEW' THEN 60
  WHEN 'CONFIRMATION' THEN 70
  WHEN 'PAYMENT' THEN 80
  WHEN 'RECEIPT' THEN 90
  WHEN 'ORDER_STATUS' THEN 100
  WHEN 'SUPPORT' THEN 110
  WHEN 'VALIDATION' THEN 120
END,
section = CASE template_key
  WHEN 'WELCOME' THEN 'Welcome'
  WHEN 'OFFER' THEN 'Offer'
  WHEN 'FERTILIZER' THEN 'Fertilizer'
  WHEN 'PROVINCE_DELIVERY' THEN 'Province/Delivery'
  WHEN 'FIELD_FULL_NAME' THEN 'Delivery Form'
  WHEN 'FIELD_DELIVERY_ADDRESS' THEN 'Delivery Form'
  WHEN 'FIELD_NEARBY_PLACE' THEN 'Delivery Form'
  WHEN 'FIELD_CITY' THEN 'Delivery Form'
  WHEN 'FIELD_CONTACT_NUMBER' THEN 'Delivery Form'
  WHEN 'REVIEW' THEN 'Review'
  WHEN 'CONFIRMATION' THEN 'Confirmation'
  WHEN 'PAYMENT' THEN 'Payment'
  WHEN 'RECEIPT' THEN 'Receipt'
  WHEN 'ORDER_STATUS' THEN 'Order Status'
  WHEN 'SUPPORT' THEN 'Support'
  WHEN 'VALIDATION' THEN 'Validation'
END;

CREATE INDEX IF NOT EXISTS whatsapp_content_templates_journey_idx ON whatsapp_content_templates(flow_order, template_key);

ALTER TABLE payment_methods ADD COLUMN heading_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN qr_caption_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN short_instructions_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN receipt_instructions_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN payment_help_copy_ur TEXT;
ALTER TABLE payment_methods ADD COLUMN status_copy_ur TEXT;
