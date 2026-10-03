CREATE TABLE lead_sources (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  source TEXT NOT NULL CHECK(source IN ('META_INSTANT_FORM','WHATSAPP','FACEBOOK_MESSENGER','INSTAGRAM_DM')),
  provider_lead_id TEXT UNIQUE,
  meta_form_id TEXT,
  provider_created_time TEXT,
  campaign_id TEXT,
  ad_set_id TEXT,
  ad_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX lead_sources_source_idx ON lead_sources(source, created_at);
