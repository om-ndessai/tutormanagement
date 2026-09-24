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

DROP TRIGGER IF EXISTS learning_plans_set_updated_at;
DROP TRIGGER IF EXISTS assessments_set_updated_at;
DROP TRIGGER IF EXISTS session_progress_set_updated_at;

-- Progress tracking (Phase 16) references sessions, users and the curriculum,
-- so it goes before any of them.
DROP TABLE IF EXISTS session_topic_ratings;
DROP TABLE IF EXISTS session_progress;
DROP TABLE IF EXISTS learning_plan_topics;
DROP TABLE IF EXISTS learning_plans;
DROP TABLE IF EXISTS assessment_topic_ratings;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS curriculum_topics;
DROP TABLE IF EXISTS curriculum_levels;

-- Comments first: they reference four of the tables below, and SQLite will
-- not drop a table something still points at.
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS scheduled_sessions;
DROP TABLE IF EXISTS session_drafts;
DROP TABLE IF EXISTS active_sessions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS guardianships;
DROP TABLE IF EXISTS availability_slots;
DROP TABLE IF EXISTS payment_handles;
DROP TABLE IF EXISTS admin_profiles;
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
  --
  -- NULL is allowed, and means exactly what it says: this person has no email
  -- address. Most students are children who do not have one and never sign in
  -- -- their parents read their dashboard from their own login. Requiring an
  -- address here forced made-up ones like `child-no-email@noemail.com` into
  -- the directory, which look like contact details and are not.
  --
  -- Nobody can sign in without one, so the API requires an address from anyone
  -- who holds a role other than `student`; see docs/data-model.md.
  email         TEXT,
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

-- Unique among LIVE rows that HAVE an address, so a retired person's address
-- can be reused and any number of children can have none at all. Lowercased
-- because SQLite's default collation is case-sensitive.
CREATE UNIQUE INDEX users_email_unique
  ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;

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

  -- The neighbourhood, for matching a tutor to families nearby.
  area              TEXT,

  -- The tutor's mailing address, printed as the recipient's address on their
  -- year-end 1099-NEC. Readable only by admins and the tutor themselves.
  -- All optional: a tutor is often recorded before their paperwork arrives.
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  state             TEXT CHECK (state IS NULL OR (length(state) = 2 AND state = upper(state))),
  postal_code       TEXT,

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

  -- WHEN the office confirmed it had the tutor's SSN, as YYYY-MM-DD. NULL
  -- means it has not been received and a tax document cannot be issued.
  --
  -- The number itself is NEVER stored -- not here, not anywhere in this
  -- database, and not in the portal. This column is a receipt, not a record:
  -- it answers "may we file for this tutor yet", which is the only question
  -- the institute needs answered all year. The SSN lives wherever the office
  -- keeps its paper, and `containsSsn` in packages/shared rejects anything
  -- that looks like one from every free-text field, so it cannot arrive here
  -- by the back door either.
  ssn_received_on   TEXT,

  -- The floor the institute keeps this tutor's advance above, in whole cents.
  --
  -- Tutors here are paid BEFORE they teach: the office hands over, say, $100,
  -- and the tutor works it off. `topup_amount_cents` is the level at which
  -- another payment is due -- when what the tutor still holds falls below it,
  -- the office tops them back up.
  --
  -- Only the threshold is stored. What the tutor currently holds is
  -- paid - earned, derived wherever it is shown like every other balance, so
  -- it cannot drift out of step with the payments and sessions it comes from.
  --
  -- NULL means this tutor is not on an advance: they are paid for work already
  -- done, and no top-up is ever due.
  topup_amount_cents INTEGER CHECK (topup_amount_cents >= 0),

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
-- Role data for an admin. Today that is one field: the taxpayer identification
-- number the institute files under, which every 1099 it issues has to carry.
--
-- Kept per admin, beside the tutor's and the student's profile rather than in
-- a settings table, because it follows the same rule as they do -- it exists
-- while the role does, and goes when the role goes. An institute with two
-- admins records it twice, which is the price of the model being one rule
-- rather than two.
--
-- It is NOT a Social Security number. A sole proprietor may file under theirs,
-- and the API refuses that: `containsSsn` rejects SSN-shaped text everywhere,
-- this field included, because the promise that the portal never stores one
-- cannot have an exception for the field named after tax.
CREATE TABLE admin_profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

  -- The institute's EIN, as it should read on a 1099. Free text: it is printed
  -- rather than computed with, and the formats vary.
  tin         TEXT,

  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

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
-- A lesson a tutor has written up but not yet posted.
--
-- Deliberately NOT a `sessions` row with a flag on it, for the same reason
-- `active_sessions` is not: a session is the billing record, and every figure
-- that reads it -- balances, the monthly rundown, the dashboards, the exports,
-- a student's progress -- would then have to remember to exclude drafts. One
-- forgotten WHERE bills a family for notes a tutor was still drafting. Kept in
-- its own table, no query can see a draft by accident.
--
-- Nothing here is money. A draft is priced when it is posted, at the rates
-- that apply then, and posting is what produces the `sessions` row.
CREATE TABLE session_drafts (
  id              TEXT PRIMARY KEY,

  tutor_user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Whoever is writing it. A draft is theirs alone until it is posted: an
  -- admin recording on a tutor's behalf sees their own, not the tutor's.
  author_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  occurred_on     TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  ended_at        TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('in_person', 'virtual')),

  -- The point of the feature: notes that are not ready to be read yet.
  notes           TEXT,

  -- The progress ratings the form was holding, as the form held them. Unposted
  -- working state rather than a record -- nothing reads this but the form it
  -- came from, and posting turns it into real progress rows.
  progress_json   TEXT,

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (ended_at > started_at)
);

CREATE INDEX session_drafts_author_idx
  ON session_drafts (author_user_id, updated_at DESC);

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


-- BEGIN PHASE 16 TABLES
-- (Markers used to carry this block to production verbatim; docs/database.md.)
-- ===========================================================================
--  Progress tracking (Phase 16)
-- ===========================================================================
--
--  The institute teaches from one ladder: Beast Academy levels 1-5, then the
--  Art of Problem Solving books (Prealgebra, Introduction to Algebra,
--  Introduction to Geometry). A student is assessed against that ladder when
--  they enrol, a plan is agreed that names a goal and the topics that lead to
--  it, and each lesson is then scored against the plan.
--
--      curriculum_levels ─┬─ curriculum_topics ──┬── assessment_topic_ratings ── assessments
--                         │                      ├── learning_plan_topics ────── learning_plans
--                         │                      └── session_topic_ratings ───── sessions
--                         └── (recommended / target level)
--
--  Ratings everywhere use ONE scale, 1-5, where 1 is "needs a lot of help" and
--  5 is "has it cold". One scale is what lets a lesson's rating be compared
--  with the assessment's, which is the whole of "tracking progress".

-- ---------------------------------------------------------------------------
-- curriculum_levels / curriculum_topics - the ladder, as reference data
-- ---------------------------------------------------------------------------
-- Rows are inserted by this file (see the catalog block at the end) and never
-- written by the application. Ids are human-readable codes rather than UUIDs
-- because they ARE the naming convention the office speaks in:
--
--   level  BA1 .. BA5   Beast Academy Level 1 .. 5
--          PRE          AoPS Prealgebra
--          ALG          AoPS Introduction to Algebra
--          GEO          AoPS Introduction to Geometry
--   topic  <level>.<nn> e.g. BA3.10 is "topic 10 of Beast Academy Level 3"
--
-- A Beast Academy topic is one chapter of a guide book, numbered straight
-- through the level (3A's chapters are BA3.01-03, 3B's continue from there),
-- so "topic 10 from level 3" means exactly one thing. An AoPS topic is one
-- chapter of the book, keeping the book's own chapter number.
--
-- Topics are never deleted: ratings reference them without a cascade, so a
-- row that has ever been scored cannot silently vanish from a student's
-- history. Correct a name in place; add new chapters with new numbers.
CREATE TABLE curriculum_levels (
  id          TEXT PRIMARY KEY,
  program     TEXT NOT NULL CHECK (program IN ('beast_academy', 'aops')),
  name        TEXT NOT NULL,
  -- Position on the ladder, which is what "a lower level" means. Algebra and
  -- geometry are often taken in either order; the ladder places algebra first
  -- because AoPS recommends it.
  stage       INTEGER NOT NULL UNIQUE CHECK (stage > 0),
  grade_band  TEXT,
  description TEXT
);

CREATE TABLE curriculum_topics (
  id        TEXT PRIMARY KEY,
  level_id  TEXT NOT NULL REFERENCES curriculum_levels (id),
  -- The <nn> in the code: chapter order within the level.
  number    INTEGER NOT NULL CHECK (number > 0),
  -- The Beast Academy guide book the chapter is in ("3D"); NULL for AoPS.
  unit      TEXT,
  name      TEXT NOT NULL,

  UNIQUE (level_id, number)
);


-- ---------------------------------------------------------------------------
-- assessments - where a student stood, in prose and topic by topic
-- ---------------------------------------------------------------------------
-- Usually one, taken when the student enrols; any later reassessment is
-- another row, so the first one is never overwritten and the distance
-- travelled since stays visible.
CREATE TABLE assessments (
  id                   TEXT PRIMARY KEY,
  student_user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Who assessed. SET NULL so purging a former admin keeps the assessment.
  assessor_user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  assessed_on          TEXT NOT NULL,
  -- What the student was enrolled in at school at the time, as the family
  -- described it. A snapshot: student_profiles.current_math_course moves on.
  school_course        TEXT,
  -- The level the assessor recommends they work at.
  recommended_level_id TEXT REFERENCES curriculum_levels (id),
  -- The long-form write-up.
  summary              TEXT,

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX assessments_student_idx ON assessments (student_user_id, assessed_on DESC);

-- One row per topic the assessor chose to score -- "topic 10 from level 3,
-- marked 1". Unscored topics simply have no row: silence is not a 1.
CREATE TABLE assessment_topic_ratings (
  assessment_id TEXT NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  topic_id      TEXT NOT NULL REFERENCES curriculum_topics (id),
  -- 1 = performs poorly / needs help ... 5 = mastered.
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),

  PRIMARY KEY (assessment_id, topic_id)
);


-- ---------------------------------------------------------------------------
-- learning_plans - the recommended course of tutoring towards a goal
-- ---------------------------------------------------------------------------
-- "Get ready for prealgebra by next academic year": a goal, a date, the
-- topics that lead there, and how often to meet.
--
-- The goal is the same fact as student_profiles.academic_year_goal: the
-- profile holds it before any plan exists, and while a plan is active the
-- API keeps the two equal on every write, from either side, in one batch
-- (goalSyncFromProfile, planGoalSyncStatement). A finished plan keeps the
-- goal it had, as history.
CREATE TABLE learning_plans (
  id                 TEXT PRIMARY KEY,
  student_user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- The assessment the plan answers. SET NULL: deleting a mistaken
  -- assessment must not take the plan and every lesson's score with it.
  assessment_id      TEXT REFERENCES assessments (id) ON DELETE SET NULL,

  goal               TEXT NOT NULL,
  -- The level the goal is about being ready for, when it is one.
  target_level_id    TEXT REFERENCES curriculum_levels (id),

  -- The goal timeline: tutoring begins, and the goal falls due.
  starts_on          TEXT NOT NULL,
  target_on          TEXT NOT NULL,

  -- The recommended cadence, e.g. twice a week for an hour.
  sessions_per_week  INTEGER NOT NULL CHECK (sessions_per_week BETWEEN 1 AND 7),
  session_minutes    INTEGER NOT NULL
                     CHECK (session_minutes > 0 AND session_minutes % 15 = 0),

  -- The prose half of the recommendation.
  recommendation     TEXT,

  --   active   - being worked towards
  --   achieved - the goal was met
  --   closed   - set aside without being met (replaced, or the family left)
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'achieved', 'closed')),

  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (target_on > starts_on)
);

-- A student works towards one plan at a time, so "the plan" a lesson is
-- scored against is never ambiguous. Finished plans stay as history.
CREATE UNIQUE INDEX learning_plans_one_active_idx
  ON learning_plans (student_user_id) WHERE status = 'active';

-- The topics the plan covers, in the order they should be taught. May reach
-- into a lower level than the recommended one, which is exactly the "add some
-- topics from other levels" case.
CREATE TABLE learning_plan_topics (
  plan_id  TEXT NOT NULL REFERENCES learning_plans (id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES curriculum_topics (id),
  position INTEGER NOT NULL CHECK (position >= 0),

  PRIMARY KEY (plan_id, topic_id)
);


-- ---------------------------------------------------------------------------
-- session_progress / session_topic_ratings - a lesson, scored against the plan
-- ---------------------------------------------------------------------------
-- Kept beside `sessions` rather than in it. A session is the billing record
-- and every column on it has to be true for billing; how the lesson moved the
-- goal is a teaching judgement, optional, and corrected on its own schedule.
CREATE TABLE session_progress (
  session_id  TEXT PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
  -- The plan that was active when the lesson was scored. Frozen, so a later
  -- plan does not reinterpret old lessons. SET NULL if the plan is deleted.
  plan_id     TEXT REFERENCES learning_plans (id) ON DELETE SET NULL,
  -- How the lesson moved the student towards the goal:
  -- 1 = no progress ... 5 = a big step forward. NULL if not scored.
  goal_rating INTEGER CHECK (goal_rating BETWEEN 1 AND 5),

  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX session_progress_plan_idx ON session_progress (plan_id);

-- Where the student stood on each topic worked on, at the END of the lesson,
-- on the same 1-5 scale as the assessment.
CREATE TABLE session_topic_ratings (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  topic_id   TEXT NOT NULL REFERENCES curriculum_topics (id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),

  PRIMARY KEY (session_id, topic_id)
);

-- Kept with their tables, rather than among the triggers below, so the block
-- between the markers is complete on its own.
CREATE TRIGGER assessments_set_updated_at
AFTER UPDATE ON assessments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE assessments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER learning_plans_set_updated_at
AFTER UPDATE ON learning_plans FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE learning_plans SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER session_progress_set_updated_at
AFTER UPDATE ON session_progress FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE session_progress SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE session_id = NEW.session_id;
END;
-- END PHASE 16 TABLES

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

CREATE TRIGGER admin_profiles_set_updated_at
AFTER UPDATE ON admin_profiles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE admin_profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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

CREATE TRIGGER session_drafts_set_updated_at
AFTER UPDATE ON session_drafts FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE session_drafts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
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

-- ---------------------------------------------------------------------------
-- Curriculum catalog (Phase 16) -- reference data, part of the schema
-- ---------------------------------------------------------------------------
-- Written as upserts so this block can be run against a live database on its
-- own (docs/database.md): re-running it corrects names and adds chapters
-- without disturbing a single rating. Never add a DELETE here.
-- BEGIN CURRICULUM CATALOG
INSERT INTO curriculum_levels (id, program, name, stage, grade_band, description) VALUES
  ('BA1', 'beast_academy', 'Beast Academy Level 1', 1, 'Ages 6-8 (about grade 1)', 'Guide books 1A-1D.'),
  ('BA2', 'beast_academy', 'Beast Academy Level 2', 2, 'Ages 7-9 (about grade 2)', 'Guide books 2A-2D.'),
  ('BA3', 'beast_academy', 'Beast Academy Level 3', 3, 'Ages 8-10 (about grade 3)', 'Guide books 3A-3D.'),
  ('BA4', 'beast_academy', 'Beast Academy Level 4', 4, 'Ages 9-12 (about grade 4)', 'Guide books 4A-4D.'),
  ('BA5', 'beast_academy', 'Beast Academy Level 5', 5, 'Ages 10-13 (about grade 5)', 'Guide books 5A-5D.'),
  ('PRE', 'aops', 'AoPS Prealgebra', 6, 'About grades 5-7', 'After Beast Academy 5. The bridge from arithmetic to algebra.'),
  ('ALG', 'aops', 'AoPS Introduction to Algebra', 7, 'Grades 6-9', 'Follows Prealgebra.'),
  ('GEO', 'aops', 'AoPS Introduction to Geometry', 8, 'Grades 7-10', 'Usually after Introduction to Algebra; the two are sometimes taken in either order.')
ON CONFLICT (id) DO UPDATE SET
  program = excluded.program, name = excluded.name, stage = excluded.stage,
  grade_band = excluded.grade_band, description = excluded.description;

INSERT INTO curriculum_topics (id, level_id, number, unit, name) VALUES
  ('BA1.01', 'BA1', 1, '1A', 'Counting'),
  ('BA1.02', 'BA1', 2, '1A', 'Shapes'),
  ('BA1.03', 'BA1', 3, '1A', 'Comparing'),
  ('BA1.04', 'BA1', 4, '1B', 'Addition'),
  ('BA1.05', 'BA1', 5, '1B', 'Subtraction'),
  ('BA1.06', 'BA1', 6, '1B', 'Categories'),
  ('BA1.07', 'BA1', 7, '1C', 'Addition & Subtraction'),
  ('BA1.08', 'BA1', 8, '1C', 'Comparing'),
  ('BA1.09', 'BA1', 9, '1C', 'Patterns'),
  ('BA1.10', 'BA1', 10, '1D', 'Big Numbers'),
  ('BA1.11', 'BA1', 11, '1D', 'Measurement'),
  ('BA1.12', 'BA1', 12, '1D', 'Problem Solving'),
  ('BA2.01', 'BA2', 1, '2A', 'Place Value'),
  ('BA2.02', 'BA2', 2, '2A', 'Comparing'),
  ('BA2.03', 'BA2', 3, '2A', 'Addition'),
  ('BA2.04', 'BA2', 4, '2B', 'Subtraction'),
  ('BA2.05', 'BA2', 5, '2B', 'Expressions'),
  ('BA2.06', 'BA2', 6, '2B', 'Problem Solving'),
  ('BA2.07', 'BA2', 7, '2C', 'Measurement'),
  ('BA2.08', 'BA2', 8, '2C', 'Strategies'),
  ('BA2.09', 'BA2', 9, '2C', 'Odds & Evens'),
  ('BA2.10', 'BA2', 10, '2D', 'Big Numbers'),
  ('BA2.11', 'BA2', 11, '2D', 'Algorithms'),
  ('BA2.12', 'BA2', 12, '2D', 'Problem Solving'),
  ('BA3.01', 'BA3', 1, '3A', 'Shapes'),
  ('BA3.02', 'BA3', 2, '3A', 'Skip-Counting'),
  ('BA3.03', 'BA3', 3, '3A', 'Perimeter & Area'),
  ('BA3.04', 'BA3', 4, '3B', 'Multiplication'),
  ('BA3.05', 'BA3', 5, '3B', 'Perfect Squares'),
  ('BA3.06', 'BA3', 6, '3B', 'The Distributive Property'),
  ('BA3.07', 'BA3', 7, '3C', 'Variables'),
  ('BA3.08', 'BA3', 8, '3C', 'Division'),
  ('BA3.09', 'BA3', 9, '3C', 'Measurement'),
  ('BA3.10', 'BA3', 10, '3D', 'Fractions'),
  ('BA3.11', 'BA3', 11, '3D', 'Estimation'),
  ('BA3.12', 'BA3', 12, '3D', 'Area'),
  ('BA4.01', 'BA4', 1, '4A', 'Shapes'),
  ('BA4.02', 'BA4', 2, '4A', 'Multiplication'),
  ('BA4.03', 'BA4', 3, '4A', 'Exponents'),
  ('BA4.04', 'BA4', 4, '4B', 'Counting'),
  ('BA4.05', 'BA4', 5, '4B', 'Division'),
  ('BA4.06', 'BA4', 6, '4B', 'Logic'),
  ('BA4.07', 'BA4', 7, '4C', 'Factors'),
  ('BA4.08', 'BA4', 8, '4C', 'Fractions'),
  ('BA4.09', 'BA4', 9, '4C', 'Integers'),
  ('BA4.10', 'BA4', 10, '4D', 'Fractions'),
  ('BA4.11', 'BA4', 11, '4D', 'Decimals'),
  ('BA4.12', 'BA4', 12, '4D', 'Probability'),
  ('BA5.01', 'BA5', 1, '5A', '3D Solids'),
  ('BA5.02', 'BA5', 2, '5A', 'Integers'),
  ('BA5.03', 'BA5', 3, '5A', 'Expressions & Equations'),
  ('BA5.04', 'BA5', 4, '5B', 'Statistics'),
  ('BA5.05', 'BA5', 5, '5B', 'Factors & Multiples'),
  ('BA5.06', 'BA5', 6, '5B', 'Fractions'),
  ('BA5.07', 'BA5', 7, '5C', 'Sequences'),
  ('BA5.08', 'BA5', 8, '5C', 'Ratios & Rates'),
  ('BA5.09', 'BA5', 9, '5C', 'Decimals'),
  ('BA5.10', 'BA5', 10, '5D', 'Percents'),
  ('BA5.11', 'BA5', 11, '5D', 'Square Roots'),
  ('BA5.12', 'BA5', 12, '5D', 'Exponents'),
  ('PRE.01', 'PRE', 1, NULL, 'Properties of Arithmetic'),
  ('PRE.02', 'PRE', 2, NULL, 'Exponents'),
  ('PRE.03', 'PRE', 3, NULL, 'Number Theory'),
  ('PRE.04', 'PRE', 4, NULL, 'Fractions'),
  ('PRE.05', 'PRE', 5, NULL, 'Equations and Inequalities'),
  ('PRE.06', 'PRE', 6, NULL, 'Decimals'),
  ('PRE.07', 'PRE', 7, NULL, 'Ratios, Conversions, and Rates'),
  ('PRE.08', 'PRE', 8, NULL, 'Percents'),
  ('PRE.09', 'PRE', 9, NULL, 'Square Roots'),
  ('PRE.10', 'PRE', 10, NULL, 'Angles'),
  ('PRE.11', 'PRE', 11, NULL, 'Perimeter and Area'),
  ('PRE.12', 'PRE', 12, NULL, 'Right Triangles and Quadrilaterals'),
  ('PRE.13', 'PRE', 13, NULL, 'Data and Statistics'),
  ('PRE.14', 'PRE', 14, NULL, 'Counting'),
  ('PRE.15', 'PRE', 15, NULL, 'Problem-Solving Strategies'),
  ('ALG.01', 'ALG', 1, NULL, 'Follow the Rules'),
  ('ALG.02', 'ALG', 2, NULL, 'x Marks the Spot'),
  ('ALG.03', 'ALG', 3, NULL, 'One-Variable Linear Equations'),
  ('ALG.04', 'ALG', 4, NULL, 'More Variables'),
  ('ALG.05', 'ALG', 5, NULL, 'Multi-Variable Linear Equations'),
  ('ALG.06', 'ALG', 6, NULL, 'Ratios and Percents'),
  ('ALG.07', 'ALG', 7, NULL, 'Proportion'),
  ('ALG.08', 'ALG', 8, NULL, 'Graphing Lines'),
  ('ALG.09', 'ALG', 9, NULL, 'Introduction to Inequalities'),
  ('ALG.10', 'ALG', 10, NULL, 'Quadratic Equations – Part 1'),
  ('ALG.11', 'ALG', 11, NULL, 'Special Factorizations'),
  ('ALG.12', 'ALG', 12, NULL, 'Complex Numbers'),
  ('ALG.13', 'ALG', 13, NULL, 'Quadratic Equations – Part 2'),
  ('ALG.14', 'ALG', 14, NULL, 'Graphing Quadratics'),
  ('ALG.15', 'ALG', 15, NULL, 'More Inequalities'),
  ('ALG.16', 'ALG', 16, NULL, 'Functions'),
  ('ALG.17', 'ALG', 17, NULL, 'Graphing Functions'),
  ('ALG.18', 'ALG', 18, NULL, 'Polynomials'),
  ('ALG.19', 'ALG', 19, NULL, 'Exponents and Logarithms'),
  ('ALG.20', 'ALG', 20, NULL, 'Special Functions'),
  ('ALG.21', 'ALG', 21, NULL, 'Sequences & Series'),
  ('ALG.22', 'ALG', 22, NULL, 'Special Manipulations'),
  ('GEO.01', 'GEO', 1, NULL, 'What''s in a Name?'),
  ('GEO.02', 'GEO', 2, NULL, 'Angles'),
  ('GEO.03', 'GEO', 3, NULL, 'Congruent Triangles'),
  ('GEO.04', 'GEO', 4, NULL, 'Perimeter and Area'),
  ('GEO.05', 'GEO', 5, NULL, 'Similar Triangles'),
  ('GEO.06', 'GEO', 6, NULL, 'Right Triangles'),
  ('GEO.07', 'GEO', 7, NULL, 'Special Parts of a Triangle'),
  ('GEO.08', 'GEO', 8, NULL, 'Quadrilaterals'),
  ('GEO.09', 'GEO', 9, NULL, 'Polygons'),
  ('GEO.10', 'GEO', 10, NULL, 'Geometric Inequalities'),
  ('GEO.11', 'GEO', 11, NULL, 'Circles'),
  ('GEO.12', 'GEO', 12, NULL, 'Circles and Angles'),
  ('GEO.13', 'GEO', 13, NULL, 'Power of a Point'),
  ('GEO.14', 'GEO', 14, NULL, 'Three-Dimensional Geometry'),
  ('GEO.15', 'GEO', 15, NULL, 'Curved Surfaces'),
  ('GEO.16', 'GEO', 16, NULL, 'The More Things Change...'),
  ('GEO.17', 'GEO', 17, NULL, 'Analytic Geometry'),
  ('GEO.18', 'GEO', 18, NULL, 'Introduction to Trigonometry'),
  ('GEO.19', 'GEO', 19, NULL, 'Problem Solving Strategies in Geometry')
ON CONFLICT (id) DO UPDATE SET
  level_id = excluded.level_id, number = excluded.number, unit = excluded.unit,
  name = excluded.name;
-- END CURRICULUM CATALOG
