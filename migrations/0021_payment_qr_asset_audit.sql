CREATE TABLE payment_qr_assets (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL REFERENCES payment_methods(method),
  source_r2_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  source_mime_type TEXT NOT NULL,
  source_size_bytes INTEGER NOT NULL CHECK(source_size_bytes>0),
  derivative_r2_key TEXT NOT NULL UNIQUE,
  derivative_sha256 TEXT NOT NULL CHECK(length(derivative_sha256)=64),
  derivative_mime_type TEXT NOT NULL CHECK(derivative_mime_type='image/png'),
  derivative_size_bytes INTEGER NOT NULL CHECK(derivative_size_bytes>0),
  derivative_width INTEGER NOT NULL CHECK(derivative_width>0),
  derivative_height INTEGER NOT NULL CHECK(derivative_height>0),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
  decoder_agreement INTEGER NOT NULL CHECK(decoder_agreement IN (0,1)),
  payload_match INTEGER NOT NULL CHECK(payload_match IN (0,1)),
  scan_pass INTEGER NOT NULL CHECK(scan_pass IN (0,1)),
  decoder_versions TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  owner_attestation_source TEXT,
  owner_attested_at TEXT,
  independent_ownership_verified INTEGER NOT NULL DEFAULT 0 CHECK(independent_ownership_verified IN (0,1)),
  independent_evidence_ref TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(method,source_sha256,derivative_sha256)
);

CREATE UNIQUE INDEX payment_qr_assets_one_active_method_idx
  ON payment_qr_assets(method) WHERE active=1;

CREATE INDEX payment_qr_assets_source_idx
  ON payment_qr_assets(method,source_sha256);
