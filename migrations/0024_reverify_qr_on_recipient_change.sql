CREATE TRIGGER payment_methods_reverify_after_recipient_change
AFTER UPDATE OF recipient_name,till_id ON payment_methods
WHEN NEW.recipient_name IS NOT OLD.recipient_name OR NEW.till_id IS NOT OLD.till_id
BEGIN
  UPDATE payment_qr_assets
  SET independent_ownership_verified=0,independent_evidence_ref=NULL
  WHERE method=NEW.method;

  UPDATE payment_methods
  SET enabled=0,qr_owner_verified=0,updated_at=COALESCE(NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_by=COALESCE(NEW.updated_by,'SYSTEM_REVERIFICATION_REQUIRED')
  WHERE method=NEW.method;

  INSERT INTO audit_log(id,action,actor_type,actor_id,entity_type,entity_id,correlation_id,metadata_json,created_at)
  VALUES(lower(hex(randomblob(16))),'PAYMENT_RECIPIENT_CHANGED_REVERIFICATION_REQUIRED','SYSTEM',COALESCE(NEW.updated_by,'SYSTEM'),'PAYMENT_METHOD',NEW.method,lower(hex(randomblob(16))),json_object('method',NEW.method,'ownershipEvidenceCleared',1,'methodDisabled',1),COALESCE(NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')));
END;
