ALTER TABLE payment_receipts
  ADD COLUMN review_state TEXT NOT NULL DEFAULT 'SUBMITTED'
  CHECK(review_state IN ('SUBMITTED','REJECTED','LATE_REVIEW'));

CREATE INDEX payment_receipts_active_review_idx
  ON payment_receipts(payment_id,order_id,review_state);
