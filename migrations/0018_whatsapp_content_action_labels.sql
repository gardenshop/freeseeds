-- Semantic labels are version-scoped while the stable action IDs and routing remain code-controlled.
-- Existing content-version rows are not rewritten.
CREATE TABLE whatsapp_content_version_action_labels (
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  action_id TEXT NOT NULL CHECK(action_id IN ('LANG_EN','LANG_UR','ADD_FERTILIZER','SEEDS_ONLY','PLACE_ORDER','BACK','PAY_JAZZCASH','CHECK_ORDER','PAYMENT_HELP','SUPPORT')),
  label_en TEXT NOT NULL CHECK(length(trim(label_en)) BETWEEN 1 AND 20),
  label_ur TEXT NOT NULL CHECK(length(trim(label_ur)) BETWEEN 1 AND 20),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(template_key, version, action_id),
  FOREIGN KEY(template_key, version) REFERENCES whatsapp_content_template_versions(template_key, version)
);

CREATE INDEX whatsapp_content_action_labels_runtime_idx ON whatsapp_content_version_action_labels(template_key, version, action_id);

WITH defaults(template_key,action_id,label_en,label_ur) AS (VALUES
  ('WELCOME','LANG_EN','English','انگریزی'),
  ('WELCOME','LANG_UR','Urdu','اردو'),
  ('FERTILIZER','ADD_FERTILIZER','Add Fertilizer','کھاد شامل کریں'),
  ('FERTILIZER','SEEDS_ONLY','Seeds Only','صرف بیج'),
  ('REVIEW','PLACE_ORDER','Place Order','آرڈر کریں'),
  ('REVIEW','BACK','Back','واپس'),
  ('PAYMENT','PAY_JAZZCASH','JazzCash','JazzCash'),
  ('PAYMENT','PAYMENT_HELP','Payment Help','ادائیگی مدد'),
  ('ORDER_STATUS','CHECK_ORDER','Check Order','آرڈر چیک کریں'),
  ('SUPPORT','SUPPORT','Support','مدد')
)
INSERT INTO whatsapp_content_version_action_labels (template_key,version,action_id,label_en,label_ur,created_at,created_by)
SELECT v.template_key,v.version,defaults.action_id,defaults.label_en,defaults.label_ur,datetime('now'),'migration-0018'
FROM whatsapp_content_template_versions v
JOIN defaults ON defaults.template_key=v.template_key;
