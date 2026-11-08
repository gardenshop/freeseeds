CREATE TABLE audit_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  actor_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STAFF', 'SUPER_ADMIN')),
  event_type TEXT NOT NULL CHECK (event_type IN ('FILE_PROCESSED','LABELS_GENERATED','PDF_GENERATED','PRINT_REQUESTED','PRINT_CONFIRMED','REPRINT_REQUESTED','APP_ERROR')),
  batch_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX audit_events_created_at ON audit_events(created_at DESC, sequence DESC);
CREATE INDEX audit_events_actor_created ON audit_events(actor_hash, created_at DESC);
CREATE INDEX audit_events_batch ON audit_events(batch_id);
