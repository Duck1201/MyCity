BEGIN;
SELECT 'CREATE ROLE mycity_api LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mycity_api')
\gexec
ALTER ROLE mycity_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
SET LOCAL password_encryption = 'scram-sha-256';
\password mycity_api

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE mycity FROM PUBLIC;
GRANT CONNECT ON DATABASE mycity TO mycity_api;
GRANT USAGE ON SCHEMA public TO mycity_api;
GRANT SELECT ON users, profiles, sessions, reports, report_categories, report_confirmations,
                report_events, report_photos, notifications TO mycity_api;
-- PostgreSQL requires UPDATE on at least one column for the login's SELECT FOR SHARE.
GRANT UPDATE (modified_at) ON users TO mycity_api;
GRANT INSERT, DELETE ON sessions, report_confirmations TO mycity_api;
GRANT INSERT, UPDATE ON reports, report_categories TO mycity_api;
GRANT INSERT ON report_events, report_photos, notifications TO mycity_api;
GRANT DELETE ON report_photos TO mycity_api;
GRANT UPDATE (read_at, modified_at) ON notifications TO mycity_api;
COMMIT;
