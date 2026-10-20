CREATE TABLE whatsapp_sender_admissions (
  event_hash TEXT PRIMARY KEY,
  sender_hash TEXT NOT NULL,
  admitted_at INTEGER NOT NULL
);
CREATE INDEX whatsapp_sender_admissions_window ON whatsapp_sender_admissions(sender_hash, admitted_at);

CREATE TRIGGER whatsapp_sender_admissions_limit
BEFORE INSERT ON whatsapp_sender_admissions
WHEN NOT EXISTS (SELECT 1 FROM whatsapp_sender_admissions WHERE event_hash=NEW.event_hash)
  AND (SELECT COUNT(*) FROM whatsapp_sender_admissions
    WHERE sender_hash=NEW.sender_hash AND admitted_at>NEW.admitted_at-60)>=30
BEGIN
  SELECT RAISE(ABORT, 'WHATSAPP_SENDER_RATE_LIMITED');
END;
