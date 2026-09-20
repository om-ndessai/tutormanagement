-- Full database schema for the TMI portal.
--
-- This project is greenfield: there are no migrations. This file is the single
-- source of truth for the schema, and `npm run db:rebuild` DROPS every table and
-- recreates them from scratch. When the data model changes, edit this file.
--
-- Because a rebuild destroys all data, it is only ever run against the local
-- database unless you deliberately pass --remote.

DROP TRIGGER IF EXISTS users_set_updated_at;
DROP TABLE IF EXISTS users;

-- Staff directory. Phase 2 of the plan expands this into a multi-role model
-- covering students and parents; today it covers admins and tutors.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'tutor')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),

  -- The `sub` claim from the user's Google ID token: Google's stable, immutable
  -- id for the account. Recorded on first sign-in. Email is what we match on,
  -- because admins create rows before anyone has ever signed in, but `sub`
  -- survives a Google account changing its email address.
  google_sub  TEXT,

  -- ISO-8601 UTC, millisecond precision. Stored as TEXT because D1/SQLite has
  -- no native date type and text sorts correctly in this format.
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT,

  -- Soft delete. Staff records are referenced by schedules and history, so rows
  -- are retired rather than removed.
  deleted_at  TEXT
);

-- Email is unique among live records only, so a deleted person's address can be
-- reused. Lowercased because the app stores emails lowercased but SQLite's
-- default collation is case-sensitive. Sign-in looks a user up through this
-- index.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub)
  WHERE google_sub IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX users_role_idx ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX users_full_name_idx ON users (full_name) WHERE deleted_at IS NULL;

-- Keeps updated_at honest even for writes that bypass the API (manual
-- `wrangler d1 execute`, future services).
CREATE TRIGGER users_set_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
