-- Prior sessions require a fresh login to bind to the current credential.
BEGIN;
ALTER TABLE sessions ADD COLUMN credential_hash CHAR(64) NOT NULL DEFAULT repeat('0',64);
ALTER TABLE sessions ALTER COLUMN credential_hash DROP DEFAULT;
COMMIT;
