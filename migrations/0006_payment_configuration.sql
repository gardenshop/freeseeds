CREATE TABLE payment_configuration (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  advance_amount_pkr INTEGER CHECK(advance_amount_pkr IS NULL OR (typeof(advance_amount_pkr) = 'integer' AND advance_amount_pkr > 0)),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

INSERT INTO payment_configuration (id, advance_amount_pkr, updated_at, updated_by)
VALUES (1, NULL, datetime('now'), 'bootstrap');
