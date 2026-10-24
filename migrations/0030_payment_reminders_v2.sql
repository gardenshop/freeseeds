CREATE TABLE payment_reminder_v2_schedules (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  cycle INTEGER NOT NULL DEFAULT 0 CHECK(cycle>=0),
  source_created_at TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'PAYMENT_PENDING'
    CHECK(phase IN ('PAYMENT_PENDING','PAYMENT_GRACE','CANCELLED_UNPAID','STOPPED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK(status IN ('ACTIVE','PAUSED','STOPPED','TERMINAL')),
  stop_reason TEXT,
  held_at TEXT,
  hold_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id,cycle),
  UNIQUE(payment_id,cycle)
);

CREATE TABLE payment_reminder_v2_stages (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES payment_reminder_v2_schedules(id),
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,30,60,210,240,270)),
  due_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('REMINDER','CANCEL_UNPAID')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','CLAIMED','QUEUED','SENT','DELIVERED','SKIPPED','PAUSED','BLOCKED_TEMPLATE','BLOCKED_WINDOW','DEAD_LETTER','CANCELLED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  template_name TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(schedule_id, stage_minutes)
);
CREATE INDEX payment_reminder_v2_due_idx
  ON payment_reminder_v2_stages(status, due_at, stage_minutes);

CREATE TABLE payment_reminder_v2_templates (
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,30,60,210,240,270)),
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  template_name TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(stage_minutes, locale)
);

CREATE TABLE payment_v2_template_versions (
  template_key TEXT NOT NULL CHECK(template_key IN ('REMINDER_15M','REMINDER_30M','REMINDER_60M','REMINDER_3H30','GRACE_NOTICE_4H','CANCEL_NOTICE_4H30','PAYMENT_CONFIRMED','PAYMENT_REJECTED','LATE_PAYMENT_REVIEW')),
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  version INTEGER NOT NULL CHECK(version>0),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 20 AND 1000),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','PUBLISHED','SUPERSEDED')),
  utility_template_name TEXT,
  utility_approved_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  published_at TEXT,
  published_by TEXT,
  PRIMARY KEY(template_key,locale,version)
);
CREATE UNIQUE INDEX payment_v2_template_one_published_idx
  ON payment_v2_template_versions(template_key,locale) WHERE state='PUBLISHED';

INSERT INTO payment_v2_template_versions(template_key,locale,version,body,state,created_at,created_by) VALUES
  ('REMINDER_15M','en',1,'Payment for order {orderNumber} is still pending. Pay PKR {amount} using an enabled method: {paymentMethod}. Deadline: {deadline}. If already paid, upload your receipt; payment is pending until verified.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_15M','ur',1,'آرڈر {orderNumber} کی ادائیگی ابھی زیرِ التوا ہے۔ فعال طریقے {paymentMethod} سے PKR {amount} ادا کریں۔ آخری وقت: {deadline}۔ اگر ادا کر چکے ہیں تو رسید اپ لوڈ کریں؛ تصدیق تک ادائیگی زیرِ التوا رہے گی۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_30M','en',1,'Reminder: payment for order {orderNumber} (PKR {amount}) is still pending by {deadline}. Use {paymentMethod} or upload a receipt if paid. We will not mark it PAID until account credit is verified.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_30M','ur',1,'یاد دہانی: آرڈر {orderNumber} کی PKR {amount} ادائیگی {deadline} تک زیرِ التوا ہے۔ {paymentMethod} استعمال کریں یا ادائیگی ہو چکی ہو تو رسید اپ لوڈ کریں۔ اکاؤنٹ کریڈٹ کی تصدیق تک PAID نہیں ہوگا۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_60M','en',1,'Payment for order {orderNumber} is still pending. Amount PKR {amount}; method {paymentMethod}; deadline {deadline}. Reply if you need help or upload your receipt after payment.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_60M','ur',1,'آرڈر {orderNumber} کی ادائیگی زیرِ التوا ہے۔ رقم PKR {amount}؛ طریقہ {paymentMethod}؛ آخری وقت {deadline}۔ مدد درکار ہو تو جواب دیں یا ادائیگی کے بعد رسید اپ لوڈ کریں۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_3H30','en',1,'Final warning: payment for order {orderNumber}, PKR {amount} via {paymentMethod}, is due in {remainingMinutes} minutes by {deadline}. A final 30-minute grace period follows; then the unpaid order may be cancelled.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('REMINDER_3H30','ur',1,'آخری تنبیہ: آرڈر {orderNumber} کی PKR {amount} ادائیگی، {paymentMethod} کے ذریعے، {remainingMinutes} منٹ میں {deadline} تک واجب ہے۔ اس کے بعد 30 منٹ کی آخری مہلت ہوگی؛ پھر غیر ادا شدہ آرڈر منسوخ ہو سکتا ہے۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('GRACE_NOTICE_4H','en',1,'The four-hour payment deadline for order {orderNumber} has passed. A final grace period lasts until {deadline}. Amount PKR {amount}; method {paymentMethod}. Upload a receipt if paid; review payments are not cancelled automatically.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('GRACE_NOTICE_4H','ur',1,'آرڈر {orderNumber} کے لیے چار گھنٹے کی ادائیگی کی مدت ختم ہو گئی ہے۔ آخری مہلت {deadline} تک ہے۔ رقم PKR {amount}؛ طریقہ {paymentMethod}۔ ادائیگی ہو چکی ہو تو رسید اپ لوڈ کریں؛ جائزے میں موجود ادائیگی خودکار طور پر منسوخ نہیں ہوگی۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('CANCEL_NOTICE_4H30','en',1,'Order {orderNumber} was cancelled as unpaid after the final grace deadline. If you paid before cancellation, contact Garden Shop with your real transaction reference. Do not pay again.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('CANCEL_NOTICE_4H30','ur',1,'آخری مہلت کے بعد آرڈر {orderNumber} غیر ادا شدہ ہونے کی وجہ سے منسوخ کر دیا گیا۔ اگر آپ نے پہلے ادائیگی کی ہے تو اصل ٹرانزیکشن حوالہ کے ساتھ گارڈن شاپ سے رابطہ کریں۔ دوبارہ ادائیگی نہ کریں۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('PAYMENT_CONFIRMED','en',1,'Payment of PKR {amount} received and verified for order {orderNumber}. Your order is confirmed.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('PAYMENT_CONFIRMED','ur',1,'آپ کے آرڈر {orderNumber} کی {amount} روپے ادائیگی کی تصدیق ہو گئی ہے۔ آپ کا آرڈر کنفرم ہو گیا ہے۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('PAYMENT_REJECTED','en',1,'Payment for order {orderNumber} could not be verified. Please contact Garden Shop with the actual transaction reference; do not resend payment unless instructed.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('PAYMENT_REJECTED','ur',1,'آرڈر {orderNumber} کی ادائیگی کی تصدیق نہیں ہو سکی۔ اصل ٹرانزیکشن حوالہ کے ساتھ گارڈن شاپ سے رابطہ کریں؛ ہدایت کے بغیر دوبارہ ادائیگی نہ کریں۔','DRAFT',datetime('now'),'v2-bootstrap'),
  ('LATE_PAYMENT_REVIEW','en',1,'We received payment evidence for previously cancelled order {orderNumber}. It is under Admin review; it is not yet confirmed PAID. Do not pay again.','DRAFT',datetime('now'),'v2-bootstrap'),
  ('LATE_PAYMENT_REVIEW','ur',1,'منسوخ شدہ آرڈر {orderNumber} کے لیے ادائیگی کا ثبوت موصول ہو گیا ہے۔ یہ ایڈمن کے جائزے میں ہے؛ ابھی PAID کی تصدیق نہیں ہوئی۔ دوبارہ ادائیگی نہ کریں۔','DRAFT',datetime('now'),'v2-bootstrap');

CREATE TABLE payment_reminder_v2_opt_outs (
  customer_id TEXT REFERENCES customers(id),
  wa_id TEXT NOT NULL UNIQUE,
  opted_out_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'WHATSAPP'
);
