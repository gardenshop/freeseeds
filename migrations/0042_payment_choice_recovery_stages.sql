-- GFS-301: bounded two-stage recovery for newly-created no-method orders.
-- Additive only. The feature remains disabled unless the Worker flag and an
-- explicit activation start time are configured. No historical rows are added.
CREATE TABLE IF NOT EXISTS payment_choice_recovery_stages (
  order_id TEXT NOT NULL REFERENCES orders(id),
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,210)),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','BLOCKED_WINDOW','SKIPPED')),
  due_at TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  inbound_message_id TEXT,
  inbound_at TEXT,
  outbound_idempotency_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(order_id, stage_minutes)
);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_stage_due_idx
  ON payment_choice_recovery_stages(status,due_at,order_id);
CREATE INDEX IF NOT EXISTS payment_choice_recovery_stage_order_idx
  ON payment_choice_recovery_stages(order_id,stage_minutes);

CREATE TABLE IF NOT EXISTS payment_choice_recovery_template_versions (
  stage_minutes INTEGER NOT NULL CHECK(stage_minutes IN (15,210)),
  locale TEXT NOT NULL CHECK(locale IN ('en','ur')),
  version INTEGER NOT NULL CHECK(version > 0),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 20 AND 1200),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','PUBLISHED','SUPERSEDED')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  published_at TEXT,
  published_by TEXT,
  PRIMARY KEY(stage_minutes,locale,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_choice_recovery_template_one_published_idx
  ON payment_choice_recovery_template_versions(stage_minutes,locale) WHERE state='PUBLISHED';

INSERT OR IGNORE INTO payment_choice_recovery_template_versions(stage_minutes,locale,version,body,state,created_at,created_by,published_at,published_by) VALUES
 (15,'en',1,'🌱 *Your Free Seeds Order Is Almost Ready!*\n\nOrder: {orderNumber}\nFree Vegetable Seeds (5 Packs): FREE\nDelivery Charges: PKR {deliveryFee}\n\nPlease choose Advance Payment or Cash on Delivery to continue.','PUBLISHED',datetime('now'),'gfs302-bootstrap',datetime('now'),'gfs302-bootstrap'),
 (15,'ur',1,'🌱 *آپ کا مفت بیجوں کا آرڈر تقریباً تیار ہے!*\n\nآرڈر: {orderNumber}\nمفت سبزیوں کے بیج (5 پیک): مفت\nڈیلیوری چارجز: PKR {deliveryFee}\n\nجاری رکھنے کے لیے پیشگی ادائیگی یا کیش آن ڈیلیوری منتخب کریں۔','PUBLISHED',datetime('now'),'gfs302-bootstrap',datetime('now'),'gfs302-bootstrap'),
 (210,'en',1,'⏳ *Your Free Seeds Order Is Still Awaiting Your Choice*\n\nOrder: {orderNumber}\nAmount including delivery: PKR {amount}\n\nChoose Advance Payment or Cash on Delivery. COD adds an extra PKR {codFee} cash collection fee.\n\nNeed help? Reply HELP.','PUBLISHED',datetime('now'),'gfs302-bootstrap',datetime('now'),'gfs302-bootstrap'),
 (210,'ur',1,'⏳ *آپ کے مفت بیجوں کے آرڈر کے لیے انتخاب ابھی باقی ہے*\n\nآرڈر: {orderNumber}\nڈیلیوری سمیت رقم: PKR {amount}\n\nپیشگی ادائیگی یا کیش آن ڈیلیوری منتخب کریں۔ COD پر اضافی PKR {codFee} کیش کلیکشن فیس ہوگی۔\n\nمدد چاہیے؟ HELP لکھ کر بھیجیں۔','PUBLISHED',datetime('now'),'gfs302-bootstrap',datetime('now'),'gfs302-bootstrap');

INSERT OR IGNORE INTO cod_schema_migrations(version,applied_at)
VALUES('0042',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
