-- Migration 0001: staff user directory.
--
-- Phase 1 covers staff only (admin, tutor). Student and parent records will get
-- their own tables alongside classes and scheduling.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'tutor')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),

  -- Reserved for the Google sign-in phase: the `sub` claim from the Google ID
  -- token. Nothing writes to it yet.
  google_sub  TEXT,

  -- ISO-8601 UTC, millisecond precision. Stored as TEXT because D1/SQLite has
  -- no native date type and text sorts correctly in this format.
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Soft delete. Staff records are referenced by schedules and history, so rows
  -- are retired rather than removed.
  deleted_at  TEXT
);

-- Email is unique among live records only, so a deleted person's address can be
-- reused. Lowercased because the app stores emails lowercased but SQLite's
-- default collation is case-sensitive.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub) WHERE google_sub IS NOT NULL;

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
