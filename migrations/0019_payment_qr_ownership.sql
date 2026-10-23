ALTER TABLE payment_methods ADD COLUMN qr_owner_verified INTEGER NOT NULL DEFAULT 0 CHECK(qr_owner_verified IN (0,1));
