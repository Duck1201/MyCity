-- Existing hashes may still represent the shared legacy credential.
ALTER TABLE users ADD COLUMN login_enabled BOOLEAN NOT NULL DEFAULT false;
