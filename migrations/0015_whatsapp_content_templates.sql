CREATE TABLE whatsapp_content_templates (
  template_key TEXT PRIMARY KEY CHECK(template_key IN ('WELCOME','OFFER','FERTILIZER','PROVINCE_DELIVERY','FIELD_FULL_NAME','FIELD_DELIVERY_ADDRESS','FIELD_NEARBY_PLACE','FIELD_CITY','FIELD_CONTACT_NUMBER','VALIDATION','REVIEW','CONFIRMATION','ORDER_STATUS','SUPPORT','PAYMENT','RECEIPT')),
  draft_version INTEGER,
  published_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE whatsapp_content_template_versions (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL REFERENCES whatsapp_content_templates(template_key),
  version INTEGER NOT NULL CHECK(version > 0),
  status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  content_en_json TEXT NOT NULL,
  content_ur_json TEXT NOT NULL,
  media_r2_key TEXT CHECK(media_r2_key IS NULL OR (media_r2_key GLOB 'whatsapp-content/*' AND media_r2_key NOT LIKE '%://%')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(template_key, version)
);
CREATE INDEX whatsapp_content_template_versions_status_idx ON whatsapp_content_template_versions(template_key, status, version DESC);

ALTER TABLE payment_methods ADD COLUMN heading TEXT;
ALTER TABLE payment_methods ADD COLUMN qr_caption TEXT;
ALTER TABLE payment_methods ADD COLUMN short_instructions TEXT;
ALTER TABLE payment_methods ADD COLUMN receipt_instructions TEXT;
ALTER TABLE payment_methods ADD COLUMN payment_help_copy TEXT;
ALTER TABLE payment_methods ADD COLUMN status_copy TEXT;

INSERT INTO whatsapp_content_templates (template_key, draft_version, published_version, created_at, updated_at, updated_by) VALUES
  ('WELCOME', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('OFFER', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FERTILIZER', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('PROVINCE_DELIVERY', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FIELD_FULL_NAME', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FIELD_DELIVERY_ADDRESS', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FIELD_NEARBY_PLACE', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FIELD_CITY', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('FIELD_CONTACT_NUMBER', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('VALIDATION', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('REVIEW', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('CONFIRMATION', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('ORDER_STATUS', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('SUPPORT', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('PAYMENT', 1, 1, datetime('now'), datetime('now'), 'migration-0015'),
  ('RECEIPT', 1, 1, datetime('now'), datetime('now'), 'migration-0015');

INSERT INTO whatsapp_content_template_versions (id, template_key, version, status, content_en_json, content_ur_json, created_at, created_by) VALUES
  ('content-welcome-v1', 'WELCOME', 1, 'PUBLISHED', '{"text":"Welcome to Get Free Seeds! Tap below to begin your order.","buttonLabel":"Get 5 Free Packs"}', '{"text":"گٹ فری سیڈز میں خوش آمدید! آرڈر شروع کرنے کے لیے نیچے دبائیں۔","buttonLabel":"5 مفت پیک حاصل کریں"}', datetime('now'), 'migration-0015'),
  ('content-offer-v1', 'OFFER', 1, 'PUBLISHED', '{"text":"Get 5 seed packs FREE. Choose your option to continue."}', '{"text":"5 بیجوں کے پیک مفت حاصل کریں۔ جاری رکھنے کے لیے انتخاب کریں۔"}', datetime('now'), 'migration-0015'),
  ('content-fertilizer-v1', 'FERTILIZER', 1, 'PUBLISHED', '{"text":"Would you like to add Micro Nutrients Fertilizer, or continue with seeds only?","buttonLabel":"Seeds Only"}', '{"text":"کیا آپ مائیکرو نیوٹرینٹس فرٹیلائزر شامل کرنا چاہتے ہیں یا صرف بیج جاری رکھنا چاہتے ہیں؟","buttonLabel":"صرف بیج"}', datetime('now'), 'migration-0015'),
  ('content-province-v1', 'PROVINCE_DELIVERY', 1, 'PUBLISHED', '{"text":"Choose your province for delivery.","listButtonLabel":"Select Province","listDescription":"Delivery area"}', '{"text":"ڈیلیوری کے لیے اپنا صوبہ منتخب کریں۔","listButtonLabel":"صوبہ منتخب کریں","listDescription":"ڈیلیوری کا علاقہ"}', datetime('now'), 'migration-0015'),
  ('content-full-name-v1', 'FIELD_FULL_NAME', 1, 'PUBLISHED', '{"text":"Please reply with your full name."}', '{"text":"براہ کرم اپنا پورا نام لکھیں۔"}', datetime('now'), 'migration-0015'),
  ('content-address-v1', 'FIELD_DELIVERY_ADDRESS', 1, 'PUBLISHED', '{"text":"Please reply with your complete delivery address."}', '{"text":"براہ کرم مکمل ڈیلیوری پتہ لکھیں۔"}', datetime('now'), 'migration-0015'),
  ('content-nearby-v1', 'FIELD_NEARBY_PLACE', 1, 'PUBLISHED', '{"text":"Please reply with a nearby famous place."}', '{"text":"براہ کرم قریبی مشہور جگہ لکھیں۔"}', datetime('now'), 'migration-0015'),
  ('content-city-v1', 'FIELD_CITY', 1, 'PUBLISHED', '{"text":"Please reply with your city."}', '{"text":"براہ کرم اپنا شہر لکھیں۔"}', datetime('now'), 'migration-0015'),
  ('content-contact-v1', 'FIELD_CONTACT_NUMBER', 1, 'PUBLISHED', '{"text":"Please reply with your contact number."}', '{"text":"براہ کرم اپنا رابطہ نمبر لکھیں۔"}', datetime('now'), 'migration-0015'),
  ('content-validation-v1', 'VALIDATION', 1, 'PUBLISHED', '{"text":"Please choose one of the listed options."}', '{"text":"براہ کرم دیے گئے اختیارات میں سے انتخاب کریں۔"}', datetime('now'), 'migration-0015'),
  ('content-review-v1', 'REVIEW', 1, 'PUBLISHED', '{"text":"🛒 *Order Summary*\n\n______________________________\n\n{orderSummaryItems}\n\nDelivery Fee: PKR {deliveryFee}\n\n______________________________\n\n*Order Total: PKR {orderTotal}*\n\n=====================\n\nPlease select your payment method below to continue.","buttonLabel":"Place Order"}', '{"text":"🛒 *آرڈر کا خلاصہ*\n\n______________________________\n\n{orderSummaryItems}\n\nڈیلیوری فیس: PKR {deliveryFee}\n\n______________________________\n\n*کل آرڈر: PKR {orderTotal}*\n\n=====================\n\nجاری رکھنے کے لیے نیچے ادائیگی کا طریقہ منتخب کریں۔","buttonLabel":"آرڈر کریں"}', datetime('now'), 'migration-0015'),
  ('content-confirmation-v1', 'CONFIRMATION', 1, 'PUBLISHED', '{"text":"Order {orderNumber} created. Total: PKR {totalPkr}."}', '{"text":"آرڈر {orderNumber} تیار ہو گیا۔ کل: PKR {totalPkr}۔"}', datetime('now'), 'migration-0015'),
  ('content-status-v1', 'ORDER_STATUS', 1, 'PUBLISHED', '{"text":"Use Check Order to see the current order and payment status.","buttonLabel":"Check Order"}', '{"text":"موجودہ آرڈر اور ادائیگی کی حالت دیکھنے کے لیے آرڈر چیک کریں۔","buttonLabel":"آرڈر چیک کریں"}', datetime('now'), 'migration-0015'),
  ('content-support-v1', 'SUPPORT', 1, 'PUBLISHED', '{"text":"Reply START to begin, STATUS to check an order, or CANCEL to stop the current order entry.","buttonLabel":"Support"}', '{"text":"شروع کرنے کے لیے START، آرڈر دیکھنے کے لیے STATUS، یا روکنے کے لیے CANCEL لکھیں۔","buttonLabel":"مدد"}', datetime('now'), 'migration-0015'),
  ('content-payment-v1', 'PAYMENT', 1, 'PUBLISHED', '{"text":"Choose a verified payment method for order {orderNumber}.","buttonLabel":"JazzCash"}', '{"text":"آرڈر {orderNumber} کے لیے تصدیق شدہ ادائیگی کا طریقہ منتخب کریں۔","buttonLabel":"JazzCash"}', datetime('now'), 'migration-0015'),
  ('content-receipt-v1', 'RECEIPT', 1, 'PUBLISHED', '{"text":"Receipt received for order {orderNumber}. Garden Shop will review it before payment is marked PAID."}', '{"text":"آرڈر {orderNumber} کی رسید موصول ہو گئی۔ گارڈن شاپ ادائیگی کو PAID کرنے سے پہلے جائزہ لے گی۔"}', datetime('now'), 'migration-0015');
