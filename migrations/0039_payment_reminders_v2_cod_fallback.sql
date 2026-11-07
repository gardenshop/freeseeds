-- GFS-279: selectively recover the reminder ledger after live0038.
-- Additive only: no historical orders are backfilled and no payment row is changed.
CREATE TABLE IF NOT EXISTS payment_reminder_v2_schedules (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  cycle INTEGER NOT NULL DEFAULT 0 CHECK(cycle >= 0),
  source_created_at TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'PAYMENT_PENDING' CHECK(phase IN ('PAYMENT_PENDING','PAYMENT_GRACE','STOPPED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','STOPPED','TERMINAL')),
  stop_reason TEXT,
  held_at TEXT,
  hold_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id,cycle), UNIQUE(payment_id,cycle)
);
CREATE TABLE IF NOT EXISTS payment_reminder_v2_stages (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES payment_reminder_v2_schedules(id),
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,30,60,210,240)),
  due_at TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'REMINDER' CHECK(action='REMINDER'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','QUEUED','SENT','DELIVERED','SKIPPED','PAUSED','BLOCKED_TEMPLATE','BLOCKED_WINDOW','DEAD_LETTER','CANCELLED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  template_name TEXT,
  locale TEXT CHECK(locale IS NULL OR locale IN ('en','ur')),
  template_version INTEGER,
  rendered_text TEXT,
  sent_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(schedule_id,stage_minutes)
);
CREATE INDEX IF NOT EXISTS payment_reminder_v2_due_idx ON payment_reminder_v2_stages(status,due_at,stage_minutes);
CREATE TABLE IF NOT EXISTS payment_v2_template_versions (
  template_key TEXT NOT NULL CHECK(template_key IN ('REMINDER_15M','REMINDER_30M','REMINDER_60M','FINAL_WARNING_210M','GRACE_NOTICE_240M')),
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  version INTEGER NOT NULL CHECK(version > 0),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 20 AND 1200),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','PUBLISHED','SUPERSEDED')),
  utility_template_name TEXT,
  utility_approved_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  published_at TEXT,
  published_by TEXT,
  PRIMARY KEY(template_key,locale,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_v2_template_one_published_idx ON payment_v2_template_versions(template_key,locale) WHERE state='PUBLISHED';
CREATE TABLE IF NOT EXISTS payment_reminder_v2_opt_outs (
  customer_id TEXT REFERENCES customers(id), wa_id TEXT NOT NULL UNIQUE, opted_out_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'WHATSAPP'
);
CREATE TABLE IF NOT EXISTS payment_reminder_cod_fallbacks (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  choice TEXT NOT NULL CHECK(choice IN ('CONFIRMED_COD','KEPT_ADVANCE','CANCELLED')),
  consent_source TEXT NOT NULL DEFAULT 'WHATSAPP_INTERACTIVE',
  base_amount_pkr INTEGER NOT NULL CHECK(base_amount_pkr >= 0),
  cod_fee_pkr INTEGER NOT NULL CHECK(cod_fee_pkr = 125),
  quoted_total_pkr INTEGER NOT NULL CHECK(quoted_total_pkr = base_amount_pkr + cod_fee_pkr),
  correlation_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO payment_v2_template_versions(template_key,locale,version,body,state,created_at,created_by) VALUES
 ('REMINDER_15M','en',1,'Payment for order {orderNumber} is still pending. Amount: PKR {amount}. Choose an enabled advance payment method or upload a receipt after payment.','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('REMINDER_15M','ur',1,'آرڈر {orderNumber} کی ادائیگی ابھی زیرِ التوا ہے۔ رقم PKR {amount} ہے۔ فعال ایڈوانس طریقہ منتخب کریں یا ادائیگی کے بعد رسید بھیجیں۔','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('REMINDER_30M','en',1,'Reminder: payment for order {orderNumber} (PKR {amount}) is still pending. If you already paid, upload the receipt; payment is not PAID until verified.','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('REMINDER_30M','ur',1,'یاد دہانی: آرڈر {orderNumber} کی PKR {amount} ادائیگی ابھی زیرِ التوا ہے۔ اگر ادائیگی ہو چکی ہے تو رسید بھیجیں؛ تصدیق تک PAID نہیں ہوگا۔','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('REMINDER_60M','en',1,'Payment for order {orderNumber} remains pending. Amount: PKR {amount}. Use an enabled advance method or send the receipt after payment.','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('REMINDER_60M','ur',1,'آرڈر {orderNumber} کی ادائیگی زیرِ التوا ہے۔ رقم PKR {amount} ہے۔ فعال ایڈوانس طریقہ استعمال کریں یا ادائیگی کے بعد رسید بھیجیں۔','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('FINAL_WARNING_210M','en',1,'Final advance-payment warning for order {orderNumber}: PKR {amount} remains unpaid. At the next step you may be offered COD with an additional PKR {codFee} collection fee; no COD change happens without your confirmation.','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('FINAL_WARNING_210M','ur',1,'آرڈر {orderNumber} کے لیے آخری ایڈوانس ادائیگی تنبیہ: PKR {amount} باقی ہے۔ اگلے مرحلے میں PKR {codFee} اضافی وصولی فیس کے ساتھ COD پیش کی جا سکتی ہے؛ آپ کی تصدیق کے بغیر COD تبدیل نہیں ہوگی۔','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('GRACE_NOTICE_240M','en',1,'Payment grace notice for order {orderNumber}: items {items}; delivery PKR {delivery}; COD collection fee PKR {codFee}; total on delivery PKR {codTotal}. Choose Confirm COD, Keep Advance, or Cancel Order. COD requires explicit confirmation.','DRAFT',datetime('now'),'gfs279-bootstrap'),
 ('GRACE_NOTICE_240M','ur',1,'آرڈر {orderNumber}: اشیاء {items}؛ ڈیلیوری PKR {delivery}؛ COD وصولی فیس PKR {codFee}؛ ڈیلیوری پر کل PKR {codTotal}۔ COD کی تصدیق، ایڈوانس برقرار، یا آرڈر منسوخ کریں۔ COD کے لیے واضح تصدیق ضروری ہے۔','DRAFT',datetime('now'),'gfs279-bootstrap');

UPDATE payment_v2_template_versions
SET utility_template_name=CASE template_key
  WHEN 'REMINDER_15M' THEN 'gfs_payment_reminder_15m'
  WHEN 'REMINDER_30M' THEN 'gfs_payment_reminder_30m'
  WHEN 'REMINDER_60M' THEN 'gfs_payment_reminder_60m'
  WHEN 'FINAL_WARNING_210M' THEN 'gfs_payment_final_warning_210m'
  WHEN 'GRACE_NOTICE_240M' THEN 'gfs_payment_grace_240m' END
WHERE version=1 AND locale IN ('en','ur');

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0039',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
