-- Additive V2-only COD snapshots and collection reconciliation. No V1 order or payment rows are rewritten.
CREATE TABLE cod_order_details (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  seed_total_pkr INTEGER NOT NULL CHECK(typeof(seed_total_pkr)='integer' AND seed_total_pkr>=0),
  fertilizer_total_pkr INTEGER NOT NULL CHECK(typeof(fertilizer_total_pkr)='integer' AND fertilizer_total_pkr>=0),
  delivery_fee_pkr INTEGER NOT NULL CHECK(typeof(delivery_fee_pkr)='integer' AND delivery_fee_pkr>=0),
  cod_fee_pkr INTEGER NOT NULL CHECK(typeof(cod_fee_pkr)='integer' AND cod_fee_pkr>0),
  total_payable_pkr INTEGER NOT NULL CHECK(typeof(total_payable_pkr)='integer' AND total_payable_pkr=seed_total_pkr+fertilizer_total_pkr+delivery_fee_pkr+cod_fee_pkr),
  status TEXT NOT NULL CHECK(status IN ('COD_PENDING','COD_CONFIRMED','PACKING','DISPATCHED','DELIVERED','COLLECTION_PENDING','COLLECTED','RECONCILED')),
  collection_amount_pkr INTEGER CHECK(collection_amount_pkr IS NULL OR (typeof(collection_amount_pkr)='integer' AND collection_amount_pkr>=0)),
  collection_reference_hash TEXT CHECK(collection_reference_hash IS NULL OR length(collection_reference_hash)=64),
  collected_at TEXT,
  collected_by TEXT,
  remittance_reference_hash TEXT CHECK(remittance_reference_hash IS NULL OR length(remittance_reference_hash)=64),
  reconciled_at TEXT,
  reconciled_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(status NOT IN ('COLLECTED','RECONCILED') OR (collection_amount_pkr IS NOT NULL AND collected_at IS NOT NULL AND collected_by IS NOT NULL)),
  CHECK(status<>'RECONCILED' OR (remittance_reference_hash IS NOT NULL AND reconciled_at IS NOT NULL AND reconciled_by IS NOT NULL))
);
CREATE INDEX cod_order_details_status_idx ON cod_order_details(status,updated_at);
