-- Gallery assets remain private in R2. Publishing snapshots the enabled gallery so
-- later gallery edits cannot silently change an already-published customer journey.
CREATE TABLE whatsapp_content_media (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL REFERENCES whatsapp_content_templates(template_key),
  r2_key TEXT NOT NULL UNIQUE CHECK(r2_key GLOB 'whatsapp-content/images/*/*' AND r2_key NOT LIKE '%://%' AND r2_key NOT LIKE '%../%'),
  master_r2_key TEXT NOT NULL UNIQUE CHECK(master_r2_key GLOB 'whatsapp-content/images/*/*' AND master_r2_key NOT LIKE '%://%' AND master_r2_key NOT LIKE '%../%'),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  master_mime_type TEXT NOT NULL CHECK(master_mime_type IN ('image/jpeg','image/png','image/webp')),
  master_size_bytes INTEGER NOT NULL CHECK(master_size_bytes > 0 AND master_size_bytes <= 10485760),
  master_sha256 TEXT NOT NULL CHECK(length(master_sha256) = 64),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  disabled_at TEXT,
  disabled_by TEXT
);

CREATE UNIQUE INDEX whatsapp_content_media_active_idx ON whatsapp_content_media(template_key) WHERE active = 1;
CREATE INDEX whatsapp_content_media_gallery_idx ON whatsapp_content_media(template_key, enabled DESC, sort_order, created_at, id);

CREATE TABLE whatsapp_content_version_media (
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  media_id TEXT NOT NULL REFERENCES whatsapp_content_media(id),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(template_key, version, media_id),
  FOREIGN KEY(template_key, version) REFERENCES whatsapp_content_template_versions(template_key, version)
);

CREATE INDEX whatsapp_content_version_media_runtime_idx ON whatsapp_content_version_media(template_key, version, active DESC, sort_order, media_id);

CREATE TABLE whatsapp_content_media_selections (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL CHECK(length(session_key) BETWEEN 1 AND 200),
  template_key TEXT NOT NULL REFERENCES whatsapp_content_templates(template_key),
  media_id TEXT NOT NULL REFERENCES whatsapp_content_media(id),
  content_version INTEGER NOT NULL CHECK(content_version > 0),
  created_at TEXT NOT NULL,
  UNIQUE(session_key, template_key)
);

CREATE INDEX whatsapp_content_media_selections_media_idx ON whatsapp_content_media_selections(media_id, template_key);
