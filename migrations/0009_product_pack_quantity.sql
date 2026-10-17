ALTER TABLE products ADD COLUMN pack_quantity INTEGER NOT NULL DEFAULT 1 CHECK(typeof(pack_quantity) = 'integer' AND pack_quantity > 0);
