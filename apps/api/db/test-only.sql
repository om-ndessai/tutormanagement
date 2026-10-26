-- ===========================================================================
--  TEST DATABASE ONLY (tutoring-test-db). Never part of schema.sql; never run on production.
-- ===========================================================================
-- Phase 53 (docs/test-environment-plan.md): the test portal has Google sign-in on, as production,
-- and lets in only the people on this list. Loaded by `npm run db:reset:test` after the schema.
-- `scripts/check-test-only.mjs` (npm run typecheck) fails if this table ever appears in schema.sql or
-- in a production SQL block of docs/database.md.
--
-- An entry is an email, or a pattern of one, or a provider account's permanent id (Phase 55: google
-- `sub`, microsoft `tid:oid`, apple `sub`, facebook's app-scoped id):
--   INSERT INTO invited_users (id, email, note) VALUES (lower(hex(randomblob(16))), 'nav@example.com', 'owner');
--   INSERT INTO invited_users (id, email, note) VALUES (lower(hex(randomblob(16))), '*@trianglemathinstitute.com', 'the institute');
--   INSERT INTO invited_users (id, provider, subject, note) VALUES (lower(hex(randomblob(16))), 'google', '1234567890', 'a tester');
-- `*` is any run of characters and `?` one character; matching ignores case (invitedMatch in shared).
-- Kept across `db:reset:test`: schema.sql never drops it (it has no foreign keys), and this file
-- only creates it when missing, so the owner's list survives a reset of everything else.
CREATE TABLE IF NOT EXISTS invited_users (
  id        TEXT PRIMARY KEY,
  email     TEXT,
  -- Phase 55: any of the four providers (the table is rebuilt below when an older one is found).
  provider  TEXT CHECK (provider IN ('google', 'microsoft', 'apple', 'facebook')),
  subject   TEXT,
  note      TEXT,
  added_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (email IS NOT NULL OR (provider IS NOT NULL AND subject IS NOT NULL))
);

-- Phase 55: a table made before (provider 'google' only) is rebuilt with the wider CHECK, keeping
-- its rows. It has no foreign keys, so the copy-drop-rename is safe; run on every reset, it is a no-op
-- copy for a table that is already current.
DROP TABLE IF EXISTS invited_users_next;
CREATE TABLE invited_users_next (
  id        TEXT PRIMARY KEY,
  email     TEXT,
  provider  TEXT CHECK (provider IN ('google', 'microsoft', 'apple', 'facebook')),
  subject   TEXT,
  note      TEXT,
  added_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (email IS NOT NULL OR (provider IS NOT NULL AND subject IS NOT NULL))
);
INSERT INTO invited_users_next (id, email, provider, subject, note, added_at)
  SELECT id, email, provider, subject, note, added_at FROM invited_users;
DROP TABLE invited_users;
ALTER TABLE invited_users_next RENAME TO invited_users;

CREATE UNIQUE INDEX IF NOT EXISTS invited_users_email ON invited_users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invited_users_login ON invited_users (provider, subject) WHERE subject IS NOT NULL;

-- The owner, who runs the platform console on test too.
INSERT INTO invited_users (id, email, note) VALUES ('owner', 'ndessai@gmail.com', 'the owner')
  ON CONFLICT DO NOTHING;
