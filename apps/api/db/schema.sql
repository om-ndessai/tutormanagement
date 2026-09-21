-- ===========================================================================
--  TMI portal - complete database schema
-- ===========================================================================
--
--  This project is greenfield: there are no migrations. This file is the
--  single source of truth, and `npm run db:rebuild` DROPS everything below and
--  recreates it. To change the model, edit this file and re-run the rebuild.
--
--  Design notes live in docs/data-model.md. The short version:
--
--    * One person = one `users` row, whatever they do at the institute.
--    * What they DO is `user_roles` (many per user), not a column on `users`.
--    * Attributes that only make sense for one role live in that role's
--      profile table. Attributes that describe the PERSON (when they are free,
--      how they are paid) hang off `users`, so someone who is both a parent
--      and a tutor cannot end up with two conflicting copies.
--
--  Conventions:
--    * Ids are UUIDv4 text from crypto.randomUUID().
--    * Timestamps are ISO-8601 UTC text with millisecond precision, which
--      sorts chronologically as text. SQLite has no date type.
--    * Booleans are INTEGER 0/1 with a CHECK, since SQLite has no boolean.
--    * day_of_week is 0=Sunday .. 6=Saturday, matching JS Date#getDay().
-- ===========================================================================

-- Dropped children-first so foreign keys never block the rebuild.
DROP TRIGGER IF EXISTS payments_set_updated_at;
DROP TRIGGER IF EXISTS scheduled_sessions_set_updated_at;
DROP TRIGGER IF EXISTS sessions_set_updated_at;
DROP TRIGGER IF EXISTS assignments_set_updated_at;
DROP TRIGGER IF EXISTS payment_handles_set_updated_at;
DROP TRIGGER IF EXISTS student_profiles_set_updated_at;
DROP TRIGGER IF EXISTS tutor_profiles_set_updated_at;
DROP TRIGGER IF EXISTS users_set_updated_at;

-- Comments first: they reference four of the tables below, and SQLite will
-- not drop a table something still points at.
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS scheduled_sessions;
DROP TABLE IF EXISTS active_sessions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS guardianships;
DROP TABLE IF EXISTS availability_slots;
DROP TABLE IF EXISTS payment_handles;
DROP TABLE IF EXISTS student_profiles;
DROP TABLE IF EXISTS tutor_profiles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;


-- ---------------------------------------------------------------------------
-- users - every person at the institute, regardless of what they do
-- ---------------------------------------------------------------------------
-- Admins, tutors, students and parents are all rows here. There is no `role`
-- column: a person can hold several roles at once (a parent who tutors, a
-- senior student who tutors younger ones), so roles are a separate table.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,

  -- Sign-in matches on this. Any Google-backed address is accepted; Google
  -- sign-in is what proves the account is real, so no domain is hard-coded.
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,

  --   active    - taking part normally
  --   invited   - record created by an admin, has never signed in
  --   suspended - access revoked, record kept
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'invited', 'suspended')),

  -- Google's permanent id for the account, pinned on first sign-in. Matching
  -- is on email because admins create rows before anyone signs in, but `sub`
  -- survives a Google account changing its address.
  google_sub    TEXT,

  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT,

  -- Soft delete. Retired people stay referenced by schedules and history.
  -- Distinct from status: `suspended` is "still ours, no access", while
  -- deleted_at is "no longer part of the institute".
  deleted_at    TEXT
);

-- Unique among LIVE rows only, so a retired person's address can be reused.
-- Lowercased because SQLite's default collation is case-sensitive.
CREATE UNIQUE INDEX users_email_unique
  ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_google_sub_unique
  ON users (google_sub) WHERE google_sub IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX users_status_idx    ON users (status)    WHERE deleted_at IS NULL;
CREATE INDEX users_full_name_idx ON users (full_name) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- user_roles - what each person does. Many rows per user.
-- ---------------------------------------------------------------------------
-- This table is the whole reason the model looks the way it does. "A user can
-- have multiple roles" makes a single `users.role` column unrepresentable.
--
--   admin   - owns the institute or has admin access. Only admins may add users.
--   tutor   - offers tutoring
--   student - enrolled for tutoring
--   parent  - responsible for costs, communication and monitoring
CREATE TABLE user_roles (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'tutor', 'student', 'parent')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (user_id, role)
);

-- Answers "list every tutor" without scanning users.
CREATE INDEX user_roles_by_role_idx ON user_roles (role, user_id);


-- ---------------------------------------------------------------------------
-- tutor_profiles - data that only means anything for a tutor
-- ---------------------------------------------------------------------------
-- 1:1 with users, and present only while the person holds the tutor role.
-- Kept out of `users` so that "which fields apply to this person" is answered
-- by the schema rather than by convention.
CREATE TABLE tutor_profiles (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

  -- Highest education reached -- or, for a tutor still at school, their
  -- current grade or math course. Free text because it is one or the other.
  highest_education TEXT,
  school            TEXT,

  -- Area only. The institute is deliberately not recording street addresses.
  area              TEXT,

  -- Free-text caveats on the structured availability in availability_slots
  -- ("term-time only", "alternate Saturdays").
  availability_notes TEXT,

  -- Whether this tutor will teach online as well as in person.
  virtual_available INTEGER NOT NULL DEFAULT 0 CHECK (virtual_available IN (0, 1)),

  -- Default hourly rates, in whole cents. Integers rather than REAL because
  -- money in floating point accumulates rounding error, and these feed billing.
  -- The two can differ: virtual sessions are often priced lower.
  -- A per-student override on `assignments` beats these; see rate resolution
  -- in docs/data-model.md.
  default_rate_in_person_cents INTEGER CHECK (default_rate_in_person_cents >= 0),
  default_rate_virtual_cents   INTEGER CHECK (default_rate_virtual_cents >= 0),

  -- The longest single lesson this tutor teaches. A live session that passes
  -- it is closed at it and marked auto_stopped, so a timer left running does
  -- not bill a family for the rest of the night.
  --
  -- NULL means "no limit of their own": the student's limit applies, and if
  -- neither sets one, DEFAULT_MAX_SESSION_MINUTES in packages/shared does.
  -- A multiple of 15 because that is the unit sessions are recorded in.
  max_session_minutes INTEGER
                      CHECK (max_session_minutes IS NULL
                             OR (max_session_minutes > 0
                                 AND max_session_minutes % 15 = 0)),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- ---------------------------------------------------------------------------
-- student_profiles - data that only means anything for a student
-- ---------------------------------------------------------------------------
CREATE TABLE student_profiles (
  user_id             TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

  school              TEXT,
  -- The math course or grade they are currently enrolled in.
  current_math_course TEXT,
  -- What they are working towards this academic year.
  academic_year_goal  TEXT,

  -- Whether this student will take online sessions.
  virtual_available   INTEGER NOT NULL DEFAULT 0 CHECK (virtual_available IN (0, 1)),

  -- What the institute CHARGES this student's family per hour, in whole cents.
  -- Deliberately separate from what the tutor is PAID (tutor_profiles and
  -- assignments): the institute keeps the difference, so the two sides must be
  -- able to move independently. Storing only one rate made the margin
  -- structurally zero.
  --
  -- Nullable so a student can exist before pricing is agreed, but a session
  -- cannot be recorded until the mode being taught has a rate -- see
  -- priceSession in routes/sessions.ts.
  charge_rate_in_person_cents INTEGER CHECK (charge_rate_in_person_cents >= 0),
  charge_rate_virtual_cents   INTEGER CHECK (charge_rate_virtual_cents >= 0),

  -- The longest single lesson this student sits. Held here as well as on the
  -- tutor because the two are different facts -- a tutor who will teach three
  -- hours straight and a nine-year-old who cannot sit for more than one both
  -- get to be true -- and the SHORTER of the two is what applies.
  max_session_minutes INTEGER
                      CHECK (max_session_minutes IS NULL
                             OR (max_session_minutes > 0
                                 AND max_session_minutes % 15 = 0)),

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- NOTE: there is deliberately no `parent_profiles` table. The plan gives
-- parents no attributes of their own beyond a payment handle, and payment
-- handles belong to the person (see below). Being a parent is therefore a role
-- plus a set of guardianship links -- an empty profile table would carry no
-- information.


-- ---------------------------------------------------------------------------
-- payment_handles - how money reaches or leaves a person
-- ---------------------------------------------------------------------------
-- Tutors are paid through these; parents are billed through them. That is the
-- same fact about a person viewed from two sides, so it hangs off users rather
-- than off tutor_profiles and a parent table. A parent who also tutors has one
-- Zelle id, not two that can disagree.
--
-- The composite primary key allows at most one handle per method per person,
-- so someone may register both a Zelle and a Venmo id but not two of either.
CREATE TABLE payment_handles (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  method     TEXT NOT NULL CHECK (method IN ('zelle', 'venmo')),

  -- Phone, email or @username, depending on the service. Stored as given.
  handle     TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (user_id, method)
);


-- ---------------------------------------------------------------------------
-- availability_slots - when a person is free, as day + hour blocks
-- ---------------------------------------------------------------------------
-- Required by tutors and by students, so again keyed on the person: someone
-- who both tutors and studies is free at one set of times, not two.
--
-- One row is one hour block, e.g. (Tuesday, 16) = Tuesday 16:00-17:00. The
-- composite primary key makes a duplicate slot impossible.
CREATE TABLE availability_slots (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- 0 = Sunday .. 6 = Saturday (JS Date#getDay()).
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- Start of the block in 24h local time; the block runs to hour + 1.
  hour        INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),

  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (user_id, day_of_week, hour)
);

-- Answers "who is free on Tuesday at 16:00", which is what scheduling will ask.
CREATE INDEX availability_slots_when_idx ON availability_slots (day_of_week, hour);


-- ---------------------------------------------------------------------------
-- guardianships - which adult is responsible for which young person
-- ---------------------------------------------------------------------------
-- The plan needs this twice: every student must have at least one parent, and
-- a tutor may have one too (a senior student tutoring younger children is
-- still someone's child). Both are the same shape -- one user is responsible
-- for another -- so one table serves both instead of a students-only link.
--
-- INVARIANT NOT ENFORCED HERE: "a student must have at least one parent".
-- That cannot be a constraint: the student row has to exist before any link to
-- it can, so no CHECK or foreign key can express it. The API enforces it.
CREATE TABLE guardianships (
  guardian_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  dependent_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  relationship      TEXT NOT NULL DEFAULT 'guardian'
                    CHECK (relationship IN ('mother', 'father', 'guardian', 'other')),

  -- The first point of contact when a student has more than one guardian.
  is_primary        INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (guardian_user_id, dependent_user_id),

  -- Nobody is their own guardian.
  CHECK (guardian_user_id <> dependent_user_id)
);

-- Answers "who are this student's parents", the common direction.
CREATE INDEX guardianships_dependent_idx ON guardianships (dependent_user_id);

-- At most one primary guardian per dependent.
CREATE UNIQUE INDEX guardianships_one_primary_idx
  ON guardianships (dependent_user_id) WHERE is_primary = 1;


-- ---------------------------------------------------------------------------
-- assignments - which tutor teaches which student, and at what rate
-- ---------------------------------------------------------------------------
-- Created by an admin. A session can only be recorded for a pair that has an
-- active assignment, which is what stops a tutor billing for a student who was
-- never given to them.
--
-- The two rate columns are OPTIONAL overrides. NULL means "use the tutor's
-- default for that mode", so the common case needs no per-pair setup and the
-- exception is one field.
CREATE TABLE assignments (
  id                   TEXT PRIMARY KEY,

  tutor_user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  rate_in_person_cents INTEGER CHECK (rate_in_person_cents >= 0),
  rate_virtual_cents   INTEGER CHECK (rate_virtual_cents >= 0),

  -- Ending an assignment keeps its history; it just stops new sessions.
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes                TEXT,

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- One pairing per tutor/student. Re-assigning reactivates the same row.
  UNIQUE (tutor_user_id, student_user_id),

  -- A user can be both a tutor and a student here, but not their own tutor.
  CHECK (tutor_user_id <> student_user_id)
);

CREATE INDEX assignments_tutor_idx   ON assignments (tutor_user_id)   WHERE is_active = 1;
CREATE INDEX assignments_student_idx ON assignments (student_user_id) WHERE is_active = 1;


-- ---------------------------------------------------------------------------
-- sessions - a lesson that actually happened, and what it costs
-- ---------------------------------------------------------------------------
-- Recorded by the tutor afterwards. This is the billing record: everything the
-- amount depends on is frozen here at the moment it is saved.
--
-- Deliberately NOT a foreign key to `assignments`. The assignment authorises
-- and prices a session, but the session records what happened. Unassigning a
-- student later must not delete the history of lessons already taught.
CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,

  tutor_user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Local calendar date of the lesson, YYYY-MM-DD.
  occurred_on        TEXT NOT NULL,
  -- Local wall-clock times, HH:MM. Stored as entered rather than as an instant:
  -- a lesson is "Tuesday 4pm" to everyone involved, and no timezone conversion
  -- should ever move it.
  started_at         TEXT NOT NULL,
  ended_at           TEXT NOT NULL,

  -- Elapsed time rounded to the nearest quarter hour, which is the unit the
  -- institute bills in. Stored rather than recomputed so a later change to the
  -- rounding rule cannot silently restate old invoices.
  duration_minutes   INTEGER NOT NULL
                     CHECK (duration_minutes > 0 AND duration_minutes % 15 = 0),

  mode               TEXT NOT NULL CHECK (mode IN ('in_person', 'virtual')),

  -- Snapshots of BOTH hourly rates that applied when this was saved, and the
  -- money each one produced. Frozen so that changing a rate tomorrow does not
  -- restate every session already taught.
  --
  -- tutor_*  is what the institute owes the tutor for this lesson.
  -- charge_* is what the institute bills the student's family for it.
  --
  -- The institute's margin is the difference, and is never stored: it is
  -- derived wherever it is shown, so it cannot drift out of step with the two
  -- numbers it comes from.
  tutor_rate_cents    INTEGER NOT NULL CHECK (tutor_rate_cents >= 0),
  tutor_amount_cents  INTEGER NOT NULL CHECK (tutor_amount_cents >= 0),
  charge_rate_cents   INTEGER NOT NULL CHECK (charge_rate_cents >= 0),
  charge_amount_cents INTEGER NOT NULL CHECK (charge_amount_cents >= 0),

  -- Feedback, progress towards the student's goal, assessment, homework set.
  notes              TEXT,

  -- 1 when the end was imposed by the session limit rather than observed:
  -- the timer ran past the shorter of the tutor's and the student's maximum,
  -- so the lesson was cut to it. Surfaced in the UI because the figure needs
  -- a human to confirm or correct it.
  auto_stopped       INTEGER NOT NULL DEFAULT 0 CHECK (auto_stopped IN (0, 1)),

  recorded_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,

  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (ended_at > started_at)
);

CREATE INDEX sessions_tutor_idx   ON sessions (tutor_user_id, occurred_on);
CREATE INDEX sessions_student_idx ON sessions (student_user_id, occurred_on);
CREATE INDEX sessions_date_idx    ON sessions (occurred_on);

-- ---------------------------------------------------------------------------
-- scheduled_sessions - a standing weekly lesson
-- ---------------------------------------------------------------------------
-- What the calendar invite is generated from. Distinct from `sessions`, which
-- records lessons that actually happened: a schedule says "every Tuesday at
-- four", and whether any particular Tuesday went ahead is a separate fact.
--
-- Weekly on one weekday is the only recurrence offered. It is what tutoring
-- actually looks like, and it maps onto a single RRULE without needing a
-- recurrence engine.
CREATE TABLE scheduled_sessions (
  id               TEXT PRIMARY KEY,

  tutor_user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- 0 = Sunday .. 6 = Saturday, matching availability_slots and JS getDay().
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- Local wall-clock start, HH:MM. Stored as entered: a lesson is "Tuesday at
  -- four" to everyone involved, and no timezone conversion should move it.
  start_time       TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL
                   CHECK (duration_minutes > 0 AND duration_minutes % 15 = 0),

  mode             TEXT NOT NULL CHECK (mode IN ('in_person', 'virtual')),

  -- The recurrence window. `ends_on` NULL means open-ended, which becomes an
  -- RRULE with no UNTIL.
  starts_on        TEXT NOT NULL,
  ends_on          TEXT,

  -- Free text: a room, or a meeting link for virtual lessons.
  location         TEXT,
  notes            TEXT,

  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),

  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX scheduled_sessions_tutor_idx   ON scheduled_sessions (tutor_user_id)   WHERE is_active = 1;
CREATE INDEX scheduled_sessions_student_idx ON scheduled_sessions (student_user_id) WHERE is_active = 1;


-- ---------------------------------------------------------------------------
-- active_sessions - a lesson being taught right now
-- ---------------------------------------------------------------------------
-- The tutor presses start, teaches, then presses stop, at which point a row in
-- `sessions` is written and this one is removed.
--
-- Deliberately NOT a half-filled `sessions` row. A session is the billing
-- record and every column it carries must be true of it; a lesson in progress
-- has no end, no duration and no amount. Making those nullable would weaken
-- the constraints that protect every completed session.
--
-- Living in the database rather than the browser means a tutor can start on
-- their phone and stop on a laptop, and a refresh does not lose the lesson.
CREATE TABLE active_sessions (
  -- One live session per tutor: you cannot teach two lessons at once, and the
  -- primary key is what enforces it.
  tutor_user_id   TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  mode            TEXT NOT NULL CHECK (mode IN ('in_person', 'virtual')),

  -- The real instant start was pressed. Rounding happens when the session is
  -- written, so the raw value stays available for the ticking display and for
  -- working out what happened if something goes wrong.
  started_at      TEXT NOT NULL,

  -- Notes may be typed during the lesson or left until afterwards.
  notes           TEXT,

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX active_sessions_student_idx ON active_sessions (student_user_id);


-- ---------------------------------------------------------------------------
-- payments - money that changed hands, recorded after the fact
-- ---------------------------------------------------------------------------
-- No money moves through the portal. This is a ledger of payments made
-- elsewhere, so the institute can answer two questions: what does a family
-- still owe, and what is a tutor still owed.
--
-- Those two questions are opposite directions of the same table, which is why
-- `direction` exists rather than two near-identical tables.
CREATE TABLE payments (
  id                  TEXT PRIMARY KEY,

  --   from_parent - a family paying the institute
  --   to_tutor    - the institute paying a tutor
  direction           TEXT NOT NULL CHECK (direction IN ('from_parent', 'to_tutor')),

  -- The parent who paid, or the tutor who was paid.
  party_user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Which student the money is for. Charges attach to a student, not to a
  -- parent, because a student may have two guardians and either may pay.
  -- Required for from_parent (see the CHECK below) so every family payment
  -- lands against exactly one balance; meaningless for to_tutor.
  --
  -- CASCADE, not SET NULL: nulling this on a purge would leave a from_parent
  -- row violating that CHECK, and the delete would fail outright. A payment
  -- "for Sofia" also means nothing once Sofia is gone. Matches how
  -- sessions.student_user_id behaves.
  student_user_id     TEXT REFERENCES users (id) ON DELETE CASCADE,

  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),

  -- "The payment form need to be supported are venmo, zelle, cash, check."
  method              TEXT NOT NULL CHECK (method IN ('zelle', 'venmo', 'cash', 'check')),

  -- When the money actually moved, which is not when it was typed in.
  paid_at             TEXT NOT NULL,

  -- Cheque number, transfer confirmation, whatever makes it findable later.
  reference           TEXT,
  notes               TEXT,

  recorded_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- A family payment with no student would belong to no balance at all.
  CHECK (direction <> 'from_parent' OR student_user_id IS NOT NULL)
);

CREATE INDEX payments_party_idx   ON payments (party_user_id, paid_at DESC);
CREATE INDEX payments_student_idx ON payments (student_user_id, paid_at DESC);
CREATE INDEX payments_recent_idx  ON payments (paid_at DESC);


-- audit_events - who did what, and when
-- ---------------------------------------------------------------------------
-- An append-only activity log. Rows are never updated and never deleted by the
-- application: an audit trail that can be edited is not an audit trail.
--
-- Note the two name columns. They are snapshots taken when the event is
-- written, and they are the reason the foreign keys are ON DELETE SET NULL
-- rather than CASCADE: purging a user must not erase the record of what they
-- did, and the log still has to read sensibly afterwards.
CREATE TABLE audit_events (
  id              TEXT PRIMARY KEY,

  -- Who performed the action. NULL once that user is purged.
  actor_user_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_name      TEXT NOT NULL,

  -- Who or what it was done to, when that differs from the actor. An admin
  -- editing a tutor records the admin as actor and the tutor as subject, so
  -- "activity for this user" can mean both what they did and what was done to
  -- them.
  subject_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  subject_name    TEXT,

  -- Machine-readable, always "<entity>.<verb>": user.created, auth.signed_in.
  -- Grouped this way so the UI can filter by entity without a second column.
  action          TEXT NOT NULL,

  -- The brief, human-readable line the plan asks for. Written once, at the
  -- moment of the action, because only the code performing it knows what it
  -- meant -- reconstructing it later from ids would lose that.
  description     TEXT NOT NULL,

  -- The record acted upon, when it is not a user (an assignment, a session).
  entity_type     TEXT,
  entity_id       TEXT,

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The three ways the log is read: newest-first overall, and newest-first for
-- one person as either actor or subject.
CREATE INDEX audit_events_recent_idx  ON audit_events (created_at DESC);
CREATE INDEX audit_events_actor_idx   ON audit_events (actor_user_id, created_at DESC);
CREATE INDEX audit_events_subject_idx ON audit_events (subject_user_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
-- Phase 12. A remark somebody wants on the record against a person, a lesson,
-- a pairing or a recurring slot: "parent asked to move Thursdays", "finished
-- the fractions unit".
--
-- Distinct from `audit_events`, which record what the SYSTEM did and are never
-- written by hand, and from the `notes` column on a session, which is the
-- tutor's account of that lesson. A comment is one person addressing the
-- people who share the thing it is attached to.

CREATE TABLE comments (
  id                TEXT PRIMARY KEY,

  -- Who wrote it. Their name is read through this rather than snapshotted:
  -- unlike an audit line, a comment is part of a live conversation, so it
  -- should follow a rename.
  author_user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- What it is about. Exactly ONE of these is set.
  --
  -- Four nullable foreign keys rather than a (target_type, target_id) pair,
  -- because the pair cannot be a foreign key: the database would no longer
  -- know the target exists, and a deleted lesson would leave its comments
  -- behind. The CHECK below is what makes the four behave as one field.
  target_user_id              TEXT REFERENCES users (id) ON DELETE CASCADE,
  target_session_id           TEXT REFERENCES sessions (id) ON DELETE CASCADE,
  target_assignment_id        TEXT REFERENCES assignments (id) ON DELETE CASCADE,
  target_scheduled_session_id TEXT REFERENCES scheduled_sessions (id) ON DELETE CASCADE,

  body              TEXT NOT NULL,

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Comments are never edited -- there is no updated_at and no trigger,
  -- deliberately, because a remark somebody replied to must not change under
  -- them. The author, and only the author, may withdraw one: that sets this
  -- and every reader stops seeing it.
  deleted_at        TEXT,

  CHECK (length(trim(body)) > 0),
  CHECK (
    (target_user_id IS NOT NULL) +
    (target_session_id IS NOT NULL) +
    (target_assignment_id IS NOT NULL) +
    (target_scheduled_session_id IS NOT NULL) = 1
  )
);

-- One index per target, because a thread is always read for a single entity,
-- newest first. Partial so each index holds only the comments of its own kind.
CREATE INDEX comments_user_idx ON comments (target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX comments_session_idx ON comments (target_session_id, created_at DESC)
  WHERE target_session_id IS NOT NULL;
CREATE INDEX comments_assignment_idx ON comments (target_assignment_id, created_at DESC)
  WHERE target_assignment_id IS NOT NULL;
CREATE INDEX comments_scheduled_idx ON comments (target_scheduled_session_id, created_at DESC)
  WHERE target_scheduled_session_id IS NOT NULL;

-- "Comments I wrote" -- the only thing the author alone may act on.
CREATE INDEX comments_author_idx ON comments (author_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
-- Each fires only when a writer left updated_at alone, so the API can set it
-- inline (saving a second write) while manual `wrangler d1 execute` edits and
-- future services still get it maintained for them.

CREATE TRIGGER users_set_updated_at
AFTER UPDATE ON users FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER tutor_profiles_set_updated_at
AFTER UPDATE ON tutor_profiles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tutor_profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER student_profiles_set_updated_at
AFTER UPDATE ON student_profiles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE student_profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER payment_handles_set_updated_at
AFTER UPDATE ON payment_handles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE payment_handles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.user_id AND method = NEW.method;
END;

CREATE TRIGGER assignments_set_updated_at
AFTER UPDATE ON assignments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE assignments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER sessions_set_updated_at
AFTER UPDATE ON sessions FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER payments_set_updated_at
AFTER UPDATE ON payments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE payments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER scheduled_sessions_set_updated_at
AFTER UPDATE ON scheduled_sessions FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE scheduled_sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
