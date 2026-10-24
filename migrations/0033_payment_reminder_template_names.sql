ALTER TABLE payment_v2_template_versions RENAME TO payment_v2_template_versions_legacy_names;
DROP INDEX payment_v2_template_one_published_idx;

CREATE TABLE payment_v2_template_versions (
  template_key TEXT NOT NULL CHECK(template_key IN ('REMINDER_15M','REMINDER_30M','REMINDER_60M','FINAL_WARNING_210M','GRACE_NOTICE_240M','CANCELLATION_270M','PAYMENT_CONFIRMED','PAYMENT_REJECTED','LATE_PAYMENT_REVIEW')),
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

INSERT INTO payment_v2_template_versions(template_key,locale,version,body,state,utility_template_name,utility_approved_at,created_at,created_by,published_at,published_by)
SELECT CASE template_key WHEN 'REMINDER_3H30' THEN 'FINAL_WARNING_210M' WHEN 'GRACE_NOTICE_4H' THEN 'GRACE_NOTICE_240M' WHEN 'CANCEL_NOTICE_4H30' THEN 'CANCELLATION_270M' ELSE template_key END,
  locale,version,body,state,utility_template_name,utility_approved_at,created_at,created_by,published_at,published_by
FROM payment_v2_template_versions_legacy_names;

DROP TABLE payment_v2_template_versions_legacy_names;
CREATE UNIQUE INDEX payment_v2_template_one_published_idx
  ON payment_v2_template_versions(template_key,locale) WHERE state='PUBLISHED';
