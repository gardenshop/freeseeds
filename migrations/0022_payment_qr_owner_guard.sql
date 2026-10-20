CREATE TRIGGER payment_methods_require_verified_qr_on_insert
BEFORE INSERT ON payment_methods
WHEN (NEW.enabled=1 OR NEW.qr_owner_verified=1)
  AND NOT (
    NEW.qr_owner_verified=1
    AND EXISTS (
      SELECT 1 FROM payment_qr_assets qa
      WHERE qa.method=NEW.method
        AND qa.derivative_r2_key=NEW.qr_r2_key
        AND qa.derivative_sha256=NEW.qr_sha256
        AND qa.derivative_mime_type=NEW.qr_mime_type
        AND qa.derivative_size_bytes=NEW.qr_size_bytes
        AND qa.active=1
        AND qa.decoder_agreement=1
        AND qa.payload_match=1
        AND qa.scan_pass=1
        AND qa.independent_ownership_verified=1
        AND qa.independent_evidence_ref IS NOT NULL
        AND TRIM(qa.independent_evidence_ref)<>''
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_RECIPIENT_OWNERSHIP_UNVERIFIED');
END;

CREATE TRIGGER payment_methods_require_verified_qr_on_update
BEFORE UPDATE OF enabled,qr_owner_verified,qr_r2_key,qr_sha256,qr_mime_type,qr_size_bytes ON payment_methods
WHEN (NEW.enabled=1 OR NEW.qr_owner_verified=1)
  AND NOT (
    NEW.qr_owner_verified=1
    AND EXISTS (
      SELECT 1 FROM payment_qr_assets qa
      WHERE qa.method=NEW.method
        AND qa.derivative_r2_key=NEW.qr_r2_key
        AND qa.derivative_sha256=NEW.qr_sha256
        AND qa.derivative_mime_type=NEW.qr_mime_type
        AND qa.derivative_size_bytes=NEW.qr_size_bytes
        AND qa.active=1
        AND qa.decoder_agreement=1
        AND qa.payload_match=1
        AND qa.scan_pass=1
        AND qa.independent_ownership_verified=1
        AND qa.independent_evidence_ref IS NOT NULL
        AND TRIM(qa.independent_evidence_ref)<>''
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_RECIPIENT_OWNERSHIP_UNVERIFIED');
END;
