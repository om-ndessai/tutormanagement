-- ===========================================================================
--  TEST DATABASE ONLY (tutoring-test-db). Run first by `npm run db:reset:test`.
-- ===========================================================================
-- Phase 65: the console's sign-up list (access_list) is a schema table, so a reset drops it. Before
-- the reset it is copied into invited_users, which the schema never drops; db/test-only.sql copies it
-- back afterwards. invited_users is no longer read by the Worker: it is the list's keeping place.
DELETE FROM invited_users;
INSERT INTO invited_users (id, email, provider, subject, note, added_at)
  SELECT id, email, provider, subject, note, added_at FROM access_list;
