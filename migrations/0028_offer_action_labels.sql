CREATE TABLE whatsapp_content_version_action_labels_new (
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  action_id TEXT NOT NULL CHECK(action_id IN ('LANG_EN','LANG_UR','ADD_FERTILIZER','SEEDS_ONLY','PLACE_ORDER','BACK','PAY_JAZZCASH','CHECK_ORDER','PAYMENT_HELP','SUPPORT','CONTINUE_ORDER','CANCEL_ORDER')),
  label_en TEXT NOT NULL CHECK(length(trim(label_en)) BETWEEN 1 AND 20),
  label_ur TEXT NOT NULL CHECK(length(trim(label_ur)) BETWEEN 1 AND 20),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(template_key, version, action_id),
  FOREIGN KEY(template_key, version) REFERENCES whatsapp_content_template_versions(template_key, version)
);

INSERT INTO whatsapp_content_version_action_labels_new (template_key,version,action_id,label_en,label_ur,created_at,created_by)
SELECT template_key,version,action_id,label_en,label_ur,created_at,created_by
FROM whatsapp_content_version_action_labels;

DROP INDEX whatsapp_content_action_labels_runtime_idx;
DROP TABLE whatsapp_content_version_action_labels;
ALTER TABLE whatsapp_content_version_action_labels_new RENAME TO whatsapp_content_version_action_labels;
CREATE INDEX whatsapp_content_action_labels_runtime_idx ON whatsapp_content_version_action_labels(template_key,version,action_id);
