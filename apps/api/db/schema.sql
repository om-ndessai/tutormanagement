-- ===========================================================================
--  Aimtrue - complete database schema (organization support)
-- ===========================================================================
--
--  This project is greenfield: there are no migrations. This file is the
--  single source of truth, and `npm run db:rebuild` DROPS everything below and
--  recreates it. To change the model, edit this file and re-run the rebuild.
--
--  This is the multi-organization schema (docs/multi-organization.md), built
--  clean on the `tutoring` deployments. The institute's tmi-portal database
--  still runs the single-organization schema on `main`; never apply this file
--  to it.
--
--  Design notes live in docs/data-model.md. The short version:
--
--    * One person = one `users` row, across every organization: their sign-in
--      identity and how to reach them (name, email, phone). Nothing else.
--    * Belonging to an organization is `org_members`; what they do there is
--      `user_roles`, keyed by organization. Everything an organization decides
--      or records about a person -- profiles, pay, prices, guardians, payment
--      handles, availability -- carries `organization_id` too, because two
--      organizations can sensibly disagree about all of it.
--    * Every teaching and money row carries `organization_id`, NOT NULL, and a
--      trigger refuses one whose people are not members of that organization.
--      A row never moves between organizations.
--
--  Conventions:
--    * Ids are UUIDv4 text from crypto.randomUUID().
--    * Timestamps are ISO-8601 UTC text with millisecond precision, which
--      sorts chronologically as text. SQLite has no date type.
--    * Booleans are INTEGER 0/1 with a CHECK, since SQLite has no boolean.
--    * day_of_week is 0=Sunday .. 6=Saturday, matching JS Date#getDay().
-- ===========================================================================

-- Dropped children-first so foreign keys never block the rebuild. Triggers go
-- with their tables; the old single-organization names are listed so this file
-- also clears a database that had the earlier schema.
DROP TABLE IF EXISTS quest_game_seen;
DROP TABLE IF EXISTS quest_game_favorites;
DROP TABLE IF EXISTS quest_game_players;
DROP TABLE IF EXISTS quest_game_teams;
DROP TABLE IF EXISTS quest_games;
DROP TABLE IF EXISTS activity_days;
DROP TABLE IF EXISTS points_ledger;
DROP TABLE IF EXISTS quest_attempts;
DROP TABLE IF EXISTS canvas_assessment_reviews;
DROP TABLE IF EXISTS canvas_assessment_files;
DROP TABLE IF EXISTS canvas_assessments;
DROP TABLE IF EXISTS question_bank_topics;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS ai_runs;
DROP TABLE IF EXISTS ai_task_settings;
DROP TABLE IF EXISTS notification_log;
DROP TABLE IF EXISTS session_topic_ratings;
DROP TABLE IF EXISTS session_progress;
DROP TABLE IF EXISTS learning_plan_topics;
DROP TABLE IF EXISTS learning_plans;
DROP TABLE IF EXISTS assessment_topic_ratings;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS curriculum_topics;
DROP TABLE IF EXISTS curriculum_levels;
DROP TABLE IF EXISTS organization_curricula;
DROP TABLE IF EXISTS curricula;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS session_reflections;
DROP TABLE IF EXISTS session_assessments;
DROP TABLE IF EXISTS session_write_ups;
DROP TABLE IF EXISTS schedule_locations;
DROP TABLE IF EXISTS assignment_locations;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS schedule_cancellations;
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
DROP TABLE IF EXISTS org_members;
DROP TABLE IF EXISTS platform_admins;
DROP TABLE IF EXISTS organization_logos;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS user_onboarding;
DROP TABLE IF EXISTS users;


-- ---------------------------------------------------------------------------
-- users - a person, once, whichever organizations they belong to
-- ---------------------------------------------------------------------------
-- Their sign-in identity and how to reach them. Everything an organization
-- records about them lives in that organization's rows below, so one
-- organization can never read or overwrite another's view of the same person.
--
-- There is no status here: suspending someone is per organization
-- (org_members.status), so suspending in one leaves the others alone.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,

  -- Sign-in matches on this (after google_sub). NULL means this person has no
  -- address -- most students are children who never sign in. The API requires
  -- one from anyone holding a role other than `student`; docs/data-model.md.
  email         TEXT,
  full_name     TEXT NOT NULL,
  phone         TEXT,

  -- Google's permanent id for the account, pinned on first sign-in. Sign-in
  -- looks this up FIRST, and refuses an email match whose pinned sub differs:
  -- otherwise whoever could edit an email could take over the account in
  -- every organization the person belongs to.
  google_sub    TEXT,

  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT,

  -- The ACCOUNT erased. Leaving an organization never sets this (that is
  -- org_members.removed_at): the live-email index below would then let a
  -- second row take the same address, which would be a duplicate person.
  deleted_at    TEXT
);

CREATE UNIQUE INDEX users_email_unique
  ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX users_google_sub_unique
  ON users (google_sub) WHERE google_sub IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX users_full_name_idx ON users (full_name) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- organizations - a tutoring business on the platform
-- ---------------------------------------------------------------------------
-- Created and branded by platform admins. Never deleted -- archived -- so no
-- foreign key to it needs an ON DELETE action, and none has one.
CREATE TABLE organizations (
  id              TEXT PRIMARY KEY,

  -- In the X-Organization header, the tmi_last_org cookie, file names and logo
  -- URLs. Lower-case letters, digits and hyphens; validated in packages/shared.
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  tagline         TEXT,
  blurb           TEXT,
  place           TEXT,

  -- One of ORG_PALETTES in packages/shared. No CHECK, deliberately: adding a
  -- palette must never need a table change.
  palette         TEXT NOT NULL DEFAULT 'platform',

  -- A logo shipped with the app rather than uploaded. Set by platform admins
  -- only, so no organization can wear another's artwork.
  builtin_logo    TEXT CHECK (builtin_logo IN ('institute')),

  -- The payer on every 1099 this organization issues. NOT an SSN: the API's
  -- `containsSsn` guard applies, as on every free-text field.
  tin             TEXT,
  payer_address_line1 TEXT,
  payer_address_line2 TEXT,
  payer_city          TEXT,
  payer_state         TEXT CHECK (payer_state IS NULL
                                  OR (length(payer_state) = 2 AND payer_state = upper(payer_state))),
  payer_postal_code   TEXT,

  -- The clock every lesson of this organization is recorded against.
  time_zone       TEXT NOT NULL DEFAULT 'America/New_York',

  -- Phase 32: whether the four notifying actions (a person added, a plan or
  -- assessment, a schedule, a recorded session) email the people they
  -- concern. Off until an admin chooses.
  email_notifications INTEGER NOT NULL DEFAULT 0 CHECK (email_notifications IN (0, 1)),

  -- Phase 38: whether the Assessment menu (beta) is on: answers written by
  -- hand on a canvas, and a PDF for the tutor. Off until its admins choose.
  canvas_assessments INTEGER NOT NULL DEFAULT 0 CHECK (canvas_assessments IN (0, 1)),
  -- Phase 38: a trial -- assessments may also draw on questions the bank has
  -- checked but no person has approved yet. Off until its admins choose; the
  -- tutor's PDF marks each such question.
  canvas_assessments_unreviewed INTEGER NOT NULL DEFAULT 0 CHECK (canvas_assessments_unreviewed IN (0, 1)),
  -- Phase 40: how many questions an assessment draws.
  canvas_assessment_questions INTEGER NOT NULL DEFAULT 10
    CHECK (canvas_assessment_questions BETWEEN 1 AND 25),
  -- Phase 42: gamification, Question Quest -- signed-in students answer the
  -- bank's unapproved questions and their tutors approve them, for points.
  -- Off until its admins choose (docs/gamification-plan.md).
  gamify_question_quest INTEGER NOT NULL DEFAULT 0 CHECK (gamify_question_quest IN (0, 1)),

  -- The domain in every calendar UID. Never changed once set: a new UID
  -- duplicates every event in every subscriber's calendar.
  calendar_domain TEXT NOT NULL,

  archived_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (slug = lower(slug) AND length(slug) BETWEEN 2 AND 40)
);

-- An organization's own artwork: a square mark and a full lockup. PNG or WebP
-- only (SVG can carry script), at most 256 KB, checked by the API. Bound as a
-- parameter, so D1's statement size limit never applies.
CREATE TABLE organization_logos (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  kind            TEXT NOT NULL CHECK (kind IN ('mark', 'full')),
  content_type    TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/webp')),
  bytes           BLOB NOT NULL,
  -- The ?v= of its URL, so it can be cached forever and still change.
  sha256          TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, kind)
);


-- ---------------------------------------------------------------------------
-- platform_admins - who runs the platform itself
-- ---------------------------------------------------------------------------
-- Not a role: roles belong to an organization, and a platform admin need not
-- belong to any. They create organizations and their admins, and see nothing
-- inside an organization unless they are also a member of it.
CREATE TABLE platform_admins (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- ---------------------------------------------------------------------------
-- org_members - who belongs to which organization
-- ---------------------------------------------------------------------------
-- Every per-organization row about a person references this, so nothing can
-- be recorded about someone an organization does not have.
CREATE TABLE org_members (
  organization_id      TEXT NOT NULL REFERENCES organizations (id),
  user_id              TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  --   active    - taking part normally
  --   invited   - added, not yet accepted (someone who already belongs to
  --               another organization accepts at sign-in; a brand-new person
  --               accepts by signing in)
  --   suspended - access to THIS organization revoked, record kept
  status               TEXT NOT NULL DEFAULT 'invited'
                       CHECK (status IN ('active', 'invited', 'suspended')),

  -- "No longer part of this organization". Their history stays.
  removed_at           TEXT,

  first_entered_at     TEXT,
  last_entered_at      TEXT,

  -- When a non-admin confirmed this organization has their details right.
  details_confirmed_at TEXT,

  -- The organization this person lands in when they sign in, if they have
  -- chosen one. At most one per person (org_members_one_default); a default
  -- they may no longer enter is simply passed over.
  is_default           INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX org_members_user_idx ON org_members (user_id);
CREATE UNIQUE INDEX org_members_one_default ON org_members (user_id) WHERE is_default = 1;


-- ---------------------------------------------------------------------------
-- user_roles - what each person does, in each organization
-- ---------------------------------------------------------------------------
--   admin   - runs the organization. Only admins may add or change people.
--   tutor   - offers tutoring
--   student - enrolled for tutoring
--   parent  - responsible for costs, communication and monitoring
CREATE TABLE user_roles (
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'tutor', 'student', 'parent')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id, role),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);

CREATE INDEX user_roles_by_role_idx ON user_roles (organization_id, role, user_id);


-- ---------------------------------------------------------------------------
-- tutor_profiles - what an organization records about one of its tutors
-- ---------------------------------------------------------------------------
-- Present only while the person holds the tutor role IN THAT organization.
CREATE TABLE tutor_profiles (
  organization_id   TEXT NOT NULL,
  user_id           TEXT NOT NULL,

  -- Highest education reached -- or, for a tutor still at school, their
  -- current grade or math course. Free text because it is one or the other.
  highest_education TEXT,
  school            TEXT,

  -- The neighbourhood, for matching a tutor to families nearby.
  area              TEXT,

  -- The tutor's mailing address, printed as the recipient's address on the
  -- 1099-NEC this organization issues. Readable only by its admins and the
  -- tutor themselves.
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  state             TEXT CHECK (state IS NULL OR (length(state) = 2 AND state = upper(state))),
  postal_code       TEXT,

  -- Free-text caveats on the structured availability in availability_slots.
  availability_notes TEXT,

  virtual_available INTEGER NOT NULL DEFAULT 0 CHECK (virtual_available IN (0, 1)),

  -- Default hourly pay, in whole cents. A per-student override on
  -- `assignments` beats these.
  default_rate_in_person_cents INTEGER CHECK (default_rate_in_person_cents >= 0),
  default_rate_virtual_cents   INTEGER CHECK (default_rate_virtual_cents >= 0),

  -- WHEN this organization confirmed it holds the tutor's SSN, YYYY-MM-DD.
  -- The number itself is NEVER stored, anywhere.
  ssn_received_on   TEXT,

  -- The floor this tutor's advance is kept above, in whole cents. NULL means
  -- they are paid for work already done and no top-up is ever due.
  topup_amount_cents INTEGER CHECK (topup_amount_cents >= 0),

  -- The longest single lesson this tutor teaches here; see the student's.
  max_session_minutes INTEGER
                      CHECK (max_session_minutes IS NULL
                             OR (max_session_minutes > 0
                                 AND max_session_minutes % 15 = 0)),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------------
-- student_profiles - what an organization records about one of its students
-- ---------------------------------------------------------------------------
CREATE TABLE student_profiles (
  organization_id     TEXT NOT NULL,
  user_id             TEXT NOT NULL,

  school              TEXT,
  current_math_course TEXT,
  academic_year_goal  TEXT,

  virtual_available   INTEGER NOT NULL DEFAULT 0 CHECK (virtual_available IN (0, 1)),

  -- What this organization CHARGES the family per hour, in whole cents.
  -- Separate from what the tutor is PAID: the margin is the difference.
  charge_rate_in_person_cents INTEGER CHECK (charge_rate_in_person_cents >= 0),
  charge_rate_virtual_cents   INTEGER CHECK (charge_rate_virtual_cents >= 0),

  -- The longest single lesson this student sits. The SHORTER of the tutor's
  -- and the student's applies.
  max_session_minutes INTEGER
                      CHECK (max_session_minutes IS NULL
                             OR (max_session_minutes > 0
                                 AND max_session_minutes % 15 = 0)),

  -- Phase 42: the bank level Question Quest serves this student from (a
  -- QUESTION_BANK_LEVEL_IDS value, checked in code). NULL until set; Quest
  -- moves it up by itself once a level's unapproved questions are used up.
  quest_level_id      TEXT,

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);

-- There is no admin_profiles: the TIN an admin used to carry is the
-- organization's (organizations.tin), and there is no parent_profiles, since a
-- parent is a role plus guardianship links.


-- ---------------------------------------------------------------------------
-- payment_handles - how this organization pays or bills a person
-- ---------------------------------------------------------------------------
-- Per organization on purpose: a handle any organization's admin could edit
-- would let one organization redirect another's payouts.
CREATE TABLE payment_handles (
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('zelle', 'venmo')),
  handle          TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id, method),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------------
-- availability_slots - when a person is free for this organization
-- ---------------------------------------------------------------------------
CREATE TABLE availability_slots (
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour            INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),

  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, user_id, day_of_week, hour),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);

CREATE INDEX availability_slots_when_idx
  ON availability_slots (organization_id, day_of_week, hour);


-- ---------------------------------------------------------------------------
-- guardianships - which adult this organization treats as responsible for whom
-- ---------------------------------------------------------------------------
-- Per organization: who is billed and kept informed is that organization's
-- arrangement. Both people must be its members.
--
-- INVARIANT NOT ENFORCED HERE: "a student has at least one guardian who is a
-- member of this organization". The API enforces it.
CREATE TABLE guardianships (
  organization_id   TEXT NOT NULL,
  guardian_user_id  TEXT NOT NULL,
  dependent_user_id TEXT NOT NULL,

  relationship      TEXT NOT NULL DEFAULT 'guardian'
                    CHECK (relationship IN ('mother', 'father', 'guardian', 'other')),
  is_primary        INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (organization_id, guardian_user_id, dependent_user_id),
  FOREIGN KEY (organization_id, guardian_user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, dependent_user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE,

  CHECK (guardian_user_id <> dependent_user_id)
);

CREATE INDEX guardianships_dependent_idx ON guardianships (organization_id, dependent_user_id);
CREATE INDEX guardianships_guardian_idx  ON guardianships (guardian_user_id);

CREATE UNIQUE INDEX guardianships_one_primary_idx
  ON guardianships (organization_id, dependent_user_id) WHERE is_primary = 1;


-- ---------------------------------------------------------------------------
-- assignments - which tutor teaches which student, and at what rate
-- ---------------------------------------------------------------------------
-- A session can only be recorded for a pair with an active assignment.
-- The rate columns are OPTIONAL overrides of the tutor's defaults.
CREATE TABLE assignments (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations (id),

  tutor_user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  rate_in_person_cents INTEGER CHECK (rate_in_person_cents >= 0),
  rate_virtual_cents   INTEGER CHECK (rate_virtual_cents >= 0),

  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes                TEXT,

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- One pairing per tutor/student in an organization. Re-assigning
  -- reactivates the same row.
  UNIQUE (organization_id, tutor_user_id, student_user_id),

  CHECK (tutor_user_id <> student_user_id)
);

CREATE INDEX assignments_tutor_idx   ON assignments (organization_id, tutor_user_id)   WHERE is_active = 1;
CREATE INDEX assignments_student_idx ON assignments (organization_id, student_user_id) WHERE is_active = 1;


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
  organization_id    TEXT NOT NULL REFERENCES organizations (id),

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

CREATE INDEX sessions_tutor_idx   ON sessions (organization_id, tutor_user_id, occurred_on);
CREATE INDEX sessions_student_idx ON sessions (organization_id, student_user_id, occurred_on);
CREATE INDEX sessions_date_idx    ON sessions (organization_id, occurred_on);

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
  organization_id  TEXT NOT NULL REFERENCES organizations (id),

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

CREATE INDEX scheduled_sessions_tutor_idx   ON scheduled_sessions (organization_id, tutor_user_id)   WHERE is_active = 1;
CREATE INDEX scheduled_sessions_student_idx ON scheduled_sessions (organization_id, student_user_id) WHERE is_active = 1;

-- BEGIN PHASE 24 TABLES
-- ---------------------------------------------------------------------------
-- schedule_cancellations - one lesson of a standing schedule that is not happening
-- ---------------------------------------------------------------------------
-- A vacation week, a sick day: one DATE of a series called off, without
-- touching the series. It is a fact about that date, never an edit to the
-- schedule, so every other week is unaffected and the calendar file simply
-- leaves the date out.
--
-- Restoring the lesson deletes the row -- the date is back in the series as if
-- nothing had happened -- and the audit log keeps the trail of both. There is
-- no updated_at: a note is not edited, it is restored and cancelled again.
--
-- The API guarantees `occurs_on` was a date the series fell on when it was
-- cancelled (the database cannot see the weekday rule). `cancelled_as` is the
-- capacity they cancelled in -- the tutor, the family, the office -- decided by
-- the API from how they relate to the schedule and frozen here, like
-- session_assessments.author_role.
--
-- Named for what it holds. Moves and no-shows (roadmap S1) would extend it
-- additively: a rename and a `kind` column, keeping this key -- one decision
-- per date of a series.
CREATE TABLE schedule_cancellations (
  schedule_id          TEXT NOT NULL REFERENCES scheduled_sessions (id) ON DELETE CASCADE,
  occurs_on            TEXT NOT NULL,

  -- Why, in the canceller's words. Read by the schedule's audience only.
  note                 TEXT,

  -- Who cancelled it. SET NULL if they are purged: the cancellation stands.
  cancelled_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  cancelled_as         TEXT NOT NULL CHECK (cancelled_as IN ('tutor', 'parent', 'admin')),

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (schedule_id, occurs_on)
);

CREATE INDEX schedule_cancellations_on_idx ON schedule_cancellations (occurs_on);
-- END PHASE 24 TABLES

-- BEGIN PHASE 33 TABLES
-- ---------------------------------------------------------------------------
-- locations - where a person likes to have lessons
-- ---------------------------------------------------------------------------
-- A tutor's or a student's own places: "Main library, room 2", "Home",
-- "Zoom". Owned by ONE person in ONE organization (two organizations can
-- sensibly disagree about where someone teaches). `address` is a street
-- address for a physical place, or a meeting link or joining instructions for
-- a virtual one.
--
-- `reminder_minutes` > 0: the portal and the app remind people about a lesson
-- there that many minutes before it starts (a bottom sheet today; a push
-- notification later). 0 means no reminder.
--
-- The API decides who may write one: admins anyone's, a tutor their own, a
-- parent their child's; the owner holds the tutor or student role. Who may
-- read one is R16 in docs/data-exposure.md.
CREATE TABLE locations (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations (id),
  owner_user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('physical', 'virtual')),
  address           TEXT,
  reminder_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (reminder_minutes BETWEEN 0 AND 1440),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX locations_owner_idx ON locations (organization_id, owner_user_id);

-- A pairing's allowed places: some of its tutor's and its student's own
-- locations (the API checks the owner; the database cannot see the pairing's
-- two people from here without a trigger per insert, which is below).
CREATE TABLE assignment_locations (
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  assignment_id    TEXT NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  location_id      TEXT NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (assignment_id, location_id)
);

CREATE INDEX assignment_locations_location_idx ON assignment_locations (location_id);

-- A schedule's places, from its pairing's: at least one (the API), and never
-- two of one kind (the UNIQUE). `kind` is the location's, copied at insert and
-- checked by a trigger, so the database itself holds the "one physical, one
-- virtual" rule.
CREATE TABLE schedule_locations (
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  schedule_id      TEXT NOT NULL REFERENCES scheduled_sessions (id) ON DELETE CASCADE,
  location_id      TEXT NOT NULL REFERENCES locations (id),
  kind             TEXT NOT NULL CHECK (kind IN ('physical', 'virtual')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (schedule_id, location_id),
  UNIQUE (schedule_id, kind)
);

CREATE INDEX schedule_locations_location_idx ON schedule_locations (location_id);
-- END PHASE 33 TABLES


-- ---------------------------------------------------------------------------
-- session_drafts - a lesson written up but not yet posted (Phase 22)
-- ---------------------------------------------------------------------------
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
  organization_id TEXT NOT NULL REFERENCES organizations (id),

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

  -- The same for the structured parts of the notes (Phase 23), and for the
  -- author's own assessment of the lesson: held as the form held them, and
  -- turned into `session_write_ups` and `session_assessments` rows on posting.
  -- Private with the rest of the draft until then.
  write_up_json   TEXT,
  assessment_json TEXT,

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (ended_at > started_at)
);

CREATE INDEX session_drafts_author_idx
  ON session_drafts (organization_id, author_user_id, updated_at DESC);

-- BEGIN PHASE 23 TABLES
-- ---------------------------------------------------------------------------
-- session_write_ups - the structured parts of a lesson's notes
-- ---------------------------------------------------------------------------
-- What was planned, how the previous lesson and its homework held up, and
-- what was set for next time. `sessions.notes` stays as "what was covered",
-- so every lesson recorded before these parts existed keeps its notes.
--
-- Beside the billing row rather than on it, for the same reason
-- `session_progress` is: sixteen queries read `sessions` for money and counts,
-- and none of them has any business with this. One row per lesson, present
-- only when something was written; deleting the lesson deletes it.
--
-- Read by exactly the people who may read the lesson, and never money: this
-- is what a tutor has open with the student beside them.
CREATE TABLE session_write_ups (
  session_id        TEXT PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,

  planned           TEXT,
  previous_review   TEXT,
  homework_review   TEXT,
  -- How the homework set last time went. NULL when the tutor did not say.
  homework_status   TEXT CHECK (homework_status IN ('done', 'partial', 'not_done', 'none_set')),
  homework_assigned TEXT,

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER session_write_ups_set_updated_at
AFTER UPDATE ON session_write_ups FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE session_write_ups SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE session_id = NEW.session_id;
END;

-- ---------------------------------------------------------------------------
-- session_assessments - what the people a lesson concerns thought of it
-- ---------------------------------------------------------------------------
-- Its tutor, the student, the student's parents and the office may each say
-- how a lesson went: a 1-5 rating, a few words, or both. One each -- the
-- primary key -- which they may change or withdraw.
--
-- Not a comment: a comment is a remark addressed to people and is never
-- edited, while this is one person's standing answer to one question, and
-- revising it is the point. Not a placement assessment either (`assessments`,
-- Phase 16), which is the office's reading of a student rather than of one
-- lesson.
--
-- The audience is the lesson's, as for `notes`. `author_role` is the capacity
-- they wrote in, decided by the API from how they relate to the lesson and
-- frozen here: a parent who later stops being one still wrote as a parent.
CREATE TABLE session_assessments (
  session_id     TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_role    TEXT NOT NULL CHECK (author_role IN ('tutor', 'student', 'parent', 'admin')),

  rating         INTEGER CHECK (rating BETWEEN 1 AND 5),
  body           TEXT,

  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (session_id, author_user_id),
  -- A rating, some words, or both; never an empty row.
  CHECK (rating IS NOT NULL OR length(trim(body)) > 0)
);

CREATE TRIGGER session_assessments_set_updated_at
AFTER UPDATE ON session_assessments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE session_assessments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE session_id = NEW.session_id AND author_user_id = NEW.author_user_id;
END;
-- END PHASE 23 TABLES

-- BEGIN PHASE 25 TABLES
-- ---------------------------------------------------------------------------
-- session_reflections - the student's own view of a lesson
-- ---------------------------------------------------------------------------
-- After a lesson is recorded, the student says what it was like for them:
-- whether they learned something new, how hard the topic was, whether they
-- understand it better, how the pace felt, and notes on the homework.
--
-- One per lesson, because a lesson has one student. It replaces the student's
-- Phase 23 assessment (session_assessments keeps those given before), and it
-- sits beside the billing row for the same reason that table does.
--
-- Most students are children who never sign in, so the answers may be typed
-- by the student, a parent sitting with them, or the tutor at the end of the
-- lesson -- `entered_as` records whose hands, decided by the API. The words
-- stay the student's: an adult may not overwrite what the student entered
-- themselves.
--
-- Difficulty and pace are CENTRED scales: 3 is about right, 1 and 5 are the
-- two ways to be off. Learned-new and understanding run low to high.
CREATE TABLE session_reflections (
  session_id         TEXT PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,

  learned_new        INTEGER CHECK (learned_new   BETWEEN 1 AND 5),
  difficulty         INTEGER CHECK (difficulty    BETWEEN 1 AND 5),
  understanding      INTEGER CHECK (understanding BETWEEN 1 AND 5),
  pace               INTEGER CHECK (pace          BETWEEN 1 AND 5),
  homework_notes     TEXT,
  comment            TEXT,

  -- Who typed it, and as whom. SET NULL if they are purged: the answers stand.
  entered_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  entered_as         TEXT NOT NULL CHECK (entered_as IN ('student', 'parent', 'tutor')),

  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Something answered; never an empty row.
  CHECK (learned_new IS NOT NULL OR difficulty IS NOT NULL OR understanding IS NOT NULL
         OR pace IS NOT NULL OR length(trim(homework_notes)) > 0 OR length(trim(comment)) > 0)
);

CREATE TRIGGER session_reflections_set_updated_at
AFTER UPDATE ON session_reflections FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE session_reflections SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE session_id = NEW.session_id;
END;
-- END PHASE 25 TABLES


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
  -- In every organization at once: nobody teaches two lessons at the same time.
  tutor_user_id   TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations (id),
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

CREATE INDEX active_sessions_student_idx ON active_sessions (organization_id, student_user_id);


-- ---------------------------------------------------------------------------
-- notification_log - every email the portal tried to send (Phase 32)
-- ---------------------------------------------------------------------------
-- One row per recipient per notifying action, written after the attempt.
-- Ids only: never an address and never the message, so the log can be shown to
-- the organization's admins without becoming a second copy of anybody's
-- details. `skipped` means this deployment has no mail binding (local and the
-- demo): what would have been sent, sent to nobody.
CREATE TABLE notification_log (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations (id),
  kind              TEXT NOT NULL CHECK (kind IN
                      ('user_added', 'plan_added', 'assessment_added', 'schedule_added', 'session_recorded')),
  -- Who the email was about (the person added, the student), when anybody.
  subject_user_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  recipient_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status            TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  -- Cloudflare's refusal, or why it was skipped. Never the message.
  detail            TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX notification_log_org_idx ON notification_log (organization_id, created_at);

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
  organization_id     TEXT NOT NULL REFERENCES organizations (id),

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

CREATE INDEX payments_party_idx   ON payments (organization_id, party_user_id, paid_at DESC);
CREATE INDEX payments_student_idx ON payments (organization_id, student_user_id, paid_at DESC);
CREATE INDEX payments_recent_idx  ON payments (organization_id, paid_at DESC);


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

  -- Whose log this line is in. NULL only for events that belong to no
  -- organization: the sign-in itself and platform_admin.*. Feeds always filter
  -- `organization_id = ?`, never `OR IS NULL`.
  organization_id TEXT REFERENCES organizations (id),

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
CREATE INDEX audit_events_recent_idx  ON audit_events (organization_id, created_at DESC);
CREATE INDEX audit_events_actor_idx   ON audit_events (organization_id, actor_user_id, created_at DESC);
CREATE INDEX audit_events_subject_idx ON audit_events (organization_id, subject_user_id, created_at DESC);


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
  organization_id   TEXT NOT NULL REFERENCES organizations (id),

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
CREATE INDEX comments_author_idx ON comments (organization_id, author_user_id, created_at DESC);
CREATE INDEX comments_org_idx    ON comments (organization_id, created_at DESC);

-- BEGIN PHASE 26 TABLES
-- ---------------------------------------------------------------------------
-- user_onboarding - whether someone has been through the welcome wizard
-- ---------------------------------------------------------------------------
-- The portal opens a welcome wizard and feature tour the first time a person
-- signs in. This is what remembers they have been through it -- finished or
-- skipped -- so it does not open again on every device. (A cookie covers the
-- device side: a browser that has not seen it gets a small offer instead.)
--
-- Kept off `users` on purpose: that row is listed to other readers, and this
-- is nobody's business but the person's own. No row means they have not been
-- through it, which is how every existing person is treated on the day the
-- wizard ships.
CREATE TABLE user_onboarding (
  user_id              TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

  -- When they first went through it, and whether to the end. The first
  -- outcome is kept: taking the tour again later is not a new fact.
  tour_finished_at     TEXT,
  tour_outcome         TEXT CHECK (tour_outcome IN ('completed', 'skipped')),

  -- (Confirming one's details is per organization: org_members.)

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER user_onboarding_set_updated_at
AFTER UPDATE ON user_onboarding FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE user_onboarding SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.user_id;
END;
-- END PHASE 26 TABLES


-- BEGIN PHASE 34 TABLES
-- ---------------------------------------------------------------------------
-- curricula / organization_curricula - which ladders an organization teaches
-- ---------------------------------------------------------------------------
-- The catalog (curriculum_levels, curriculum_topics, below) holds one or more
-- curricula: Beast Academy ('ba'), which keeps the three AoPS books as its
-- upper levels, and North Carolina's standards in both editions ('nc-2017',
-- 'nc-2026'; Phase 35). An organization reads and writes only the curricula
-- on its own list, organization_curricula, which its admins choose on the
-- Organization page: every catalog read and every id check in the API goes
-- through that list, so it is the one choke point between an organization and
-- the catalog.
--
--   curricula ──┬── curriculum_levels ── curriculum_topics ── (ratings, plan topics)
--               └── organization_curricula ── organizations
--
-- A platform curriculum (organization_id NULL) is reference data, written by
-- db/catalog.sql and never by the application. One with organization_id set is
-- that organization's own and nobody else's (R13); no row has one yet.
CREATE TABLE curricula (
  -- The platform's: a slug ('ba', 'nc-2017'). An organization's own: a UUID.
  id              TEXT PRIMARY KEY,
  -- NULL: the platform's, shared by every organization that offers it.
  -- Set: that organization's own, and nobody else's.
  organization_id TEXT REFERENCES organizations (id),
  name            TEXT NOT NULL,
  -- Where it comes from. No CHECK: a new source is never a table change.
  source          TEXT,
  -- '2017', '2026'; NULL when the source has none.
  edition         TEXT,
  description     TEXT,
  source_url      TEXT,
  -- Display order only.
  sort            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- An organization's list. Exactly one default per organization: the index
-- allows at most one, and the API makes sure there is one (creating an
-- organization inserts it; docs/data-model.md has the audit query).
CREATE TABLE organization_curricula (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  curriculum_id   TEXT NOT NULL REFERENCES curricula (id),
  is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  -- Hidden from pickers; everything written against it still reads, and a
  -- write may still name it. Rows are never deleted.
  retired_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, curriculum_id),
  CHECK (is_default = 0 OR retired_at IS NULL)
);

CREATE UNIQUE INDEX organization_curricula_one_default
  ON organization_curricula (organization_id) WHERE is_default = 1;

-- A row may name the platform's curriculum or this organization's own, never
-- another organization's. The API repeats the same test in its SQL.
CREATE TRIGGER organization_curricula_same_organization
BEFORE INSERT ON organization_curricula
WHEN NOT EXISTS (SELECT 1 FROM curricula c WHERE c.id = NEW.curriculum_id
                 AND (c.organization_id IS NULL OR c.organization_id = NEW.organization_id))
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

-- The row's key never moves: neither to another organization nor, by an
-- update, onto a curriculum the insert trigger would have refused.
CREATE TRIGGER organization_curricula_organization_fixed
BEFORE UPDATE OF organization_id, curriculum_id ON organization_curricula
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.curriculum_id IS NOT OLD.curriculum_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER curricula_organization_fixed
BEFORE UPDATE OF organization_id ON curricula
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;
-- END PHASE 34 TABLES


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
-- Rows are inserted by db/catalog.sql (generated from db/catalog/*.json) and
-- never written by the application. Since Phase 34 every level belongs to a
-- curriculum (`curricula`, above), and an organization reads only those on
-- its own list. Platform ids are reviewed, human-readable keys, unique across
-- the catalog; `code` is what people read where it differs (North Carolina's
-- official "NC.5.NF.1" for the id NC17.5.NF.1). Beast Academy's ids are its
-- codes, the naming convention the office speaks in:
--
--   level  BA1 .. BA5   Beast Academy Level 1 .. 5
--          PRE          AoPS Prealgebra
--          ALG          AoPS Introduction to Algebra
--          GEO          AoPS Introduction to Geometry
--   topic  <level>.<nn> e.g. BA3.10 is "topic 10 of Beast Academy Level 3"
--   NC     NC17.<grade|course>, NC26.<...>; a topic is one numbered state
--          standard, its `unit` the domain (Phase 35)
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
  -- (Phase 35 dropped `program`, whose CHECK allowed Beast Academy and AoPS
  -- alone; production's ALTER TABLE ... DROP COLUMN, docs/database.md.)
  name        TEXT NOT NULL,
  -- Position on the ladder, which is what "a lower level" means. Algebra and
  -- geometry are often taken in either order; the ladder places algebra first
  -- because AoPS recommends it. Unique across the whole catalog, so each
  -- platform curriculum has its own thousand (Beast Academy 1-8, nc-2017
  -- from 1001, nc-2026 from 2001), and a shipped stage never changes: the
  -- generator refuses either.
  stage       INTEGER NOT NULL UNIQUE CHECK (stage > 0),
  grade_band  TEXT,
  description TEXT,
  -- Phase 34, last because production gains them by ALTER TABLE (where this
  -- column is nullable; a level without one is invisible to everybody).
  curriculum_id TEXT NOT NULL REFERENCES curricula (id),
  -- What people read. NULL where the id already is the code, as for every
  -- Beast Academy row; the API answers COALESCE(code, id). Ids are keys.
  code        TEXT
);

-- A curriculum's levels, in ladder order. Platform stages sit in disjoint
-- thousands per curriculum (Beast Academy 1-8) and never change once shipped.
CREATE INDEX curriculum_levels_curriculum_idx ON curriculum_levels (curriculum_id, stage);

CREATE TABLE curriculum_topics (
  id        TEXT PRIMARY KEY,
  level_id  TEXT NOT NULL REFERENCES curriculum_levels (id),
  -- The <nn> in the code: chapter order within the level.
  number    INTEGER NOT NULL CHECK (number > 0),
  -- The Beast Academy guide book the chapter is in ("3D"); NULL for AoPS;
  -- a state standard's domain. The pickers group topics under it.
  unit      TEXT,
  name      TEXT NOT NULL,
  -- Phase 34: what people read, as on curriculum_levels. Last of the
  -- columns, where production's ALTER TABLE put it.
  code      TEXT,
  -- Phase 35: a line under the name in the pickers. For a state standard, a
  -- summary of it (and, for the 2026 edition, its objectives); NULL for a
  -- Beast Academy chapter, whose title says enough.
  description TEXT,

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
  organization_id      TEXT NOT NULL REFERENCES organizations (id),
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

CREATE INDEX assessments_student_idx ON assessments (organization_id, student_user_id, assessed_on DESC);

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
  organization_id    TEXT NOT NULL REFERENCES organizations (id),
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
  ON learning_plans (organization_id, student_user_id) WHERE status = 'active';

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

CREATE TRIGGER organizations_set_updated_at
AFTER UPDATE ON organizations FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE organizations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER org_members_set_updated_at
AFTER UPDATE ON org_members FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE org_members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id;
END;

CREATE TRIGGER tutor_profiles_set_updated_at
AFTER UPDATE ON tutor_profiles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tutor_profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id;
END;

CREATE TRIGGER student_profiles_set_updated_at
AFTER UPDATE ON student_profiles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE student_profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id;
END;

CREATE TRIGGER payment_handles_set_updated_at
AFTER UPDATE ON payment_handles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE payment_handles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id AND method = NEW.method;
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
-- Rows stay in their organization
-- ---------------------------------------------------------------------------
-- Enforced by the database, not left to discipline: a teaching or money row
-- whose people are not members of its organization is refused, and no row ever
-- moves to another organization. A comment must also hang off something in its
-- own organization.

CREATE TRIGGER assignments_same_organization
BEFORE INSERT ON assignments
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER assignments_organization_fixed
BEFORE UPDATE OF organization_id ON assignments
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER sessions_same_organization
BEFORE INSERT ON sessions
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER sessions_organization_fixed
BEFORE UPDATE OF organization_id ON sessions
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER locations_same_organization
BEFORE INSERT ON locations
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.owner_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER locations_organization_fixed
BEFORE UPDATE OF organization_id ON locations
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER locations_set_updated_at
AFTER UPDATE ON locations
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE locations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- A pairing's location belongs to one of the pairing's two people, in its organization.
CREATE TRIGGER assignment_locations_owner
BEFORE INSERT ON assignment_locations
WHEN NOT EXISTS (
  SELECT 1 FROM assignments a JOIN locations l ON l.id = NEW.location_id
  WHERE a.id = NEW.assignment_id
    AND a.organization_id = NEW.organization_id
    AND l.organization_id = NEW.organization_id
    AND l.owner_user_id IN (a.tutor_user_id, a.student_user_id)
)
BEGIN
  SELECT RAISE(ABORT, 'location_not_in_pairing');
END;

-- A schedule's location is one of its pairing's, and `kind` is the location's own.
CREATE TRIGGER schedule_locations_in_pairing
BEFORE INSERT ON schedule_locations
WHEN NOT EXISTS (
  SELECT 1 FROM scheduled_sessions ss
  JOIN assignments a ON a.organization_id = ss.organization_id
                    AND a.tutor_user_id = ss.tutor_user_id
                    AND a.student_user_id = ss.student_user_id
  JOIN assignment_locations al ON al.assignment_id = a.id AND al.location_id = NEW.location_id
  JOIN locations l ON l.id = NEW.location_id AND l.kind = NEW.kind
  WHERE ss.id = NEW.schedule_id AND ss.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'location_not_in_pairing');
END;

CREATE TRIGGER scheduled_sessions_same_organization
BEFORE INSERT ON scheduled_sessions
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER scheduled_sessions_organization_fixed
BEFORE UPDATE OF organization_id ON scheduled_sessions
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER session_drafts_same_organization
BEFORE INSERT ON session_drafts
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.author_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER session_drafts_organization_fixed
BEFORE UPDATE OF organization_id ON session_drafts
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER active_sessions_same_organization
BEFORE INSERT ON active_sessions
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER active_sessions_organization_fixed
BEFORE UPDATE OF organization_id ON active_sessions
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER payments_same_organization
BEFORE INSERT ON payments
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.party_user_id)
  OR (NEW.student_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id))
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER payments_organization_fixed
BEFORE UPDATE OF organization_id ON payments
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER comments_same_organization
BEFORE INSERT ON comments
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.author_user_id)
  OR (NEW.target_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.target_user_id))
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER comments_organization_fixed
BEFORE UPDATE OF organization_id ON comments
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER assessments_same_organization
BEFORE INSERT ON assessments
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER assessments_organization_fixed
BEFORE UPDATE OF organization_id ON assessments
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER learning_plans_same_organization
BEFORE INSERT ON learning_plans
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER learning_plans_organization_fixed
BEFORE UPDATE OF organization_id ON learning_plans
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER comments_target_same_organization
BEFORE INSERT ON comments
WHEN (NEW.target_session_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM sessions s WHERE s.id = NEW.target_session_id
          AND s.organization_id = NEW.organization_id))
  OR (NEW.target_assignment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM assignments a WHERE a.id = NEW.target_assignment_id
          AND a.organization_id = NEW.organization_id))
  OR (NEW.target_scheduled_session_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM scheduled_sessions s WHERE s.id = NEW.target_scheduled_session_id
          AND s.organization_id = NEW.organization_id))
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER notification_log_same_organization
BEFORE INSERT ON notification_log
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.recipient_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER notification_log_organization_fixed
BEFORE UPDATE OF organization_id ON notification_log
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER audit_events_organization_fixed
BEFORE UPDATE OF organization_id ON audit_events
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- ---------------------------------------------------------------------------
-- The curriculum catalog -- reference data, in db/catalog.sql (Phase 35)
-- ---------------------------------------------------------------------------
-- The platform's curricula (Beast Academy, North Carolina Math 2017 and 2026)
-- are generated from db/catalog/*.json by db/generate-catalog.mjs, which
-- refuses a dropped id or a changed stage. Every database is built from this
-- file THEN catalog.sql (npm run db:rebuild, db:rebuild:test, scripts/e2e.sh).

-- ---------------------------------------------------------------------------
-- The AI layer and the question bank (Phase 36, docs/ai-platform-plan.md)
-- ---------------------------------------------------------------------------
-- Every model call goes through the Worker's runAi (apps/api/src/lib/ai).

-- A platform admin's settings for a task in AI_TASKS (packages/shared/src/ai.ts).
-- No row: the task's defaults. Caps are cents, checked before every call.
CREATE TABLE ai_task_settings (
  task              TEXT PRIMARY KEY,
  enabled           INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  daily_cap_cents   INTEGER NOT NULL CHECK (daily_cap_cents >= 0),
  monthly_cap_cents INTEGER NOT NULL CHECK (monthly_cap_cents >= 0),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per call, refused ones included: what was asked of whom, what it cost
-- and how it ended. NEVER the prompt or the reply (AG7) -- `detail` is an error
-- code or an HTTP status, never text from the model.
CREATE TABLE ai_runs (
  id                TEXT PRIMARY KEY,
  -- NULL for a platform task (the question bank). Set once a task runs on an
  -- organization's data; such a task joins check-org-scope's list.
  organization_id   TEXT REFERENCES organizations (id),
  task              TEXT NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_microdollars INTEGER NOT NULL DEFAULT 0,
  outcome           TEXT NOT NULL CHECK (outcome IN ('ok', 'invalid_output', 'provider_error',
                      'refused_disabled', 'refused_consent', 'refused_budget', 'refused_ssn')),
  detail            TEXT,
  actor_user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX ai_runs_task_time_idx ON ai_runs (task, created_at);
CREATE INDEX ai_runs_time_idx ON ai_runs (created_at);

-- The question bank: platform reference data, like the catalog. One standard
-- per question. Written by a model, checked by code and by a second model
-- solving it blind (`checks`), and approved by a platform admin -- the only
-- status a test may draw on. Never deleted once used: retired instead.
CREATE TABLE questions (
  id             TEXT PRIMARY KEY,
  topic_id       TEXT NOT NULL REFERENCES curriculum_topics (id),
  difficulty     INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3)),
  kind           TEXT NOT NULL CHECK (kind IN ('choice', 'numeric')),
  -- The specific skill within the standard, as the writer named it.
  skill          TEXT,
  -- Text with maths in $...$ (KaTeX).
  stem           TEXT NOT NULL,
  -- JSON array: four strings for 'choice', [] for 'numeric'.
  choices        TEXT NOT NULL DEFAULT '[]',
  -- The correct choice's text, or the number.
  answer         TEXT NOT NULL,
  -- Arithmetic the answer must equal exactly, when it is a calculation.
  compute        TEXT,
  solution       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'checked', 'flagged', 'approved', 'retired')),
  -- JSON QuestionChecks: the code checks' problems and the blind solve.
  checks         TEXT NOT NULL DEFAULT '{"lint":[],"solve":null}',
  source         TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  draft_run_id   TEXT REFERENCES ai_runs (id) ON DELETE SET NULL,
  reviewed_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at    TEXT,
  -- Phase 42: how it was approved: 'console' (a platform admin) or 'quest' (a
  -- tutor confirming a student's answer). No CHECK: a new way must not mean
  -- rebuilding a table production cannot rebuild; QUESTION_APPROVED_VIA in shared.
  approved_via   TEXT,
  -- Phase 37: how it fares in use.
  times_used     INTEGER NOT NULL DEFAULT 0,
  times_correct  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (status != 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX questions_topic_idx ON questions (topic_id, status, difficulty);
CREATE INDEX questions_status_idx ON questions (status, created_at);
-- Phase 42: Question Quest's next question -- the checked questions of a
-- level in the order they are served (chapter, then easier first), so a
-- student's place is one seek, never a sort of the bank.
CREATE INDEX questions_quest_idx ON questions (status, topic_id, difficulty);

-- What the bank knows about a standard: whether it cannot be asked without a
-- figure (left out of tests until figures exist). No row: it can.
CREATE TABLE question_bank_topics (
  topic_id     TEXT PRIMARY KEY REFERENCES curriculum_topics (id),
  needs_figure INTEGER NOT NULL DEFAULT 0 CHECK (needs_figure IN (0, 1)),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- Phase 38: the Assessment menu (beta). One row per attempt: a student answers
-- approved bank questions by hand, one question per page; on submitting, the
-- Worker writes a PDF for the tutor (docs/canvas-assessment-plan.md).
CREATE TABLE canvas_assessments (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations (id),
  student_user_id    TEXT NOT NULL REFERENCES users (id),
  -- Who started it: the student, a guardian, a tutor of theirs or an admin.
  started_by_user_id TEXT NOT NULL REFERENCES users (id),
  -- A bank level, 'NC26.5'. The questions are platform reference data.
  level_id           TEXT NOT NULL,
  -- JSON array of question ids, in the order they are asked.
  question_ids       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress', 'submitted', 'discarded')),
  -- Counted on submitting: pages with any writing; the multiple-choice
  -- questions, how many were answered and how many correctly (by code); and
  -- how many questions were drawn while still unreviewed in the bank.
  questions_written  INTEGER NOT NULL DEFAULT 0,
  choice_questions   INTEGER NOT NULL DEFAULT 0,
  choices_answered   INTEGER NOT NULL DEFAULT 0,
  choices_correct    INTEGER NOT NULL DEFAULT 0,
  unreviewed_questions INTEGER NOT NULL DEFAULT 0,
  started_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at       TEXT,
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Phase 40: a tutor saved its review as reviewed (the review is
  -- canvas_assessment_reviews). Status stays 'submitted': "reviewed" is these.
  reviewed_by_user_id TEXT REFERENCES users (id),
  reviewed_at        TEXT,

  CHECK ((status = 'submitted') = (submitted_at IS NOT NULL))
);

CREATE INDEX canvas_assessments_org_time_idx ON canvas_assessments (organization_id, started_at);
CREATE INDEX canvas_assessments_student_idx ON canvas_assessments (organization_id, student_user_id);

CREATE TRIGGER canvas_assessments_same_organization
BEFORE INSERT ON canvas_assessments
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.started_by_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER canvas_assessments_organization_fixed
BEFORE UPDATE OF organization_id ON canvas_assessments
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER canvas_assessments_set_updated_at
AFTER UPDATE ON canvas_assessments
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE canvas_assessments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- Its files, kept apart so a list never reads a blob: the PDF ('answers'), the
-- handwriting it was drawn from ('strokes', deflated JSON) and, from Phase 39,
-- the PDF with an AI evaluation ('evaluated'). In D1 for now; moving them to R2
-- replaces `bytes` with a key here and nowhere else.
CREATE TABLE canvas_assessment_files (
  assessment_id   TEXT NOT NULL REFERENCES canvas_assessments (id),
  kind            TEXT NOT NULL CHECK (kind IN ('answers', 'strokes', 'evaluated')),
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  content_type    TEXT NOT NULL,
  bytes           BLOB NOT NULL,
  size            INTEGER NOT NULL,
  sha256          TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (assessment_id, kind)
);

CREATE TRIGGER canvas_assessment_files_same_organization
BEFORE INSERT ON canvas_assessment_files
WHEN NOT EXISTS (SELECT 1 FROM canvas_assessments a WHERE a.id = NEW.assessment_id AND a.organization_id = NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

-- Phase 40: a tutor's review of a submitted assessment -- red ink over its
-- pages, a note per question, an overall comment; no scoring yet. Kept as
-- data, and the reviewed PDF rebuilt from it, so the submitted PDF never
-- changes. Only the student's current tutors and the admins write it; once
-- 'final', its PDF is the student's whole audience's to read (R17).
CREATE TABLE canvas_assessment_reviews (
  assessment_id    TEXT PRIMARY KEY REFERENCES canvas_assessments (id),
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  reviewer_user_id TEXT NOT NULL REFERENCES users (id),
  -- JSON: { question id: note }.
  notes            TEXT NOT NULL DEFAULT '{}',
  comment          TEXT NOT NULL DEFAULT '',
  -- Deflated JSON: [{ question_id, strokes: ["w x y x y ..."] }], in PDF points.
  ink              BLOB,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  -- The reviewed PDF, while 'final'. In D1 for now, with the other files.
  pdf              BLOB,
  pdf_size         INTEGER,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at      TEXT,

  CHECK ((status = 'final') = (finished_at IS NOT NULL AND pdf IS NOT NULL))
);

CREATE TRIGGER canvas_assessment_reviews_same_organization
BEFORE INSERT ON canvas_assessment_reviews
WHEN NOT EXISTS (SELECT 1 FROM canvas_assessments a WHERE a.id = NEW.assessment_id AND a.organization_id = NEW.organization_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.reviewer_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER canvas_assessment_reviews_organization_fixed
BEFORE UPDATE OF organization_id ON canvas_assessment_reviews
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;


-- ---------------------------------------------------------------------------
-- Phase 42: gamification -- Question Quest (docs/gamification-plan.md)
-- ---------------------------------------------------------------------------
-- A signed-in student answers the bank's checked (unapproved) questions one
-- at a time; code marks each answer; a tutor of theirs reviews it and either
-- approves the question (for the whole platform, approved_via = 'quest') or
-- flags it. Answers are these rows, never audit lines (there are too many).
CREATE TABLE quest_attempts (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES organizations (id),
  student_user_id     TEXT NOT NULL REFERENCES users (id),
  question_id         TEXT NOT NULL REFERENCES questions (id),
  -- The level it was served from.
  level_id            TEXT NOT NULL,
  answer              TEXT NOT NULL,
  -- Marked by code (checkAnswer) against the bank's key when submitted.
  correct             INTEGER NOT NULL CHECK (correct IN (0, 1)),
  submitted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- The tutor's review: 'approved' (the question is right) or 'flagged'.
  review              TEXT CHECK (review IN ('approved', 'flagged')),
  review_note         TEXT,
  reviewed_by_user_id TEXT REFERENCES users (id),
  reviewed_at         TEXT,

  -- A question is served to a student once, ever.
  UNIQUE (organization_id, student_user_id, question_id),
  CHECK ((review IS NULL) = (reviewed_at IS NULL)),
  CHECK ((review IS NULL) = (reviewed_by_user_id IS NULL))
);

-- The review queue: the organization's unreviewed answers, oldest first.
CREATE INDEX quest_attempts_queue_idx ON quest_attempts (organization_id, reviewed_at, submitted_at);
-- "Is this question waiting for a review here already?"
CREATE INDEX quest_attempts_question_idx ON quest_attempts (question_id, organization_id);
-- A student's own answers, newest first (where Quest resumes).
CREATE INDEX quest_attempts_student_idx ON quest_attempts (organization_id, student_user_id, submitted_at);

CREATE TRIGGER quest_attempts_same_organization
BEFORE INSERT ON quest_attempts
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_attempts_organization_fixed
BEFORE UPDATE OF organization_id ON quest_attempts
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- Points, append-only (never updated or deleted, like audit_events): a balance
-- is always a SUM, never stored. `reason` is a POINTS_REASONS value (shared);
-- no CHECK, so a later phase's reasons (streaks, badges, redemptions) need no
-- rebuild. One award per attempt, person and reason.
CREATE TABLE points_ledger (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  user_id         TEXT NOT NULL REFERENCES users (id),
  points          INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  attempt_id      TEXT REFERENCES quest_attempts (id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX points_ledger_user_idx ON points_ledger (organization_id, user_id, created_at);
CREATE UNIQUE INDEX points_ledger_once ON points_ledger (attempt_id, user_id, reason) WHERE attempt_id IS NOT NULL;

CREATE TRIGGER points_ledger_same_organization
BEFORE INSERT ON points_ledger
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER points_ledger_no_update
BEFORE UPDATE ON points_ledger
BEGIN
  SELECT RAISE(ABORT, 'points_ledger_append_only');
END;

-- One row per person per day of activity, on the organization's clock: what
-- streaks and "days active" are derived from (Phase 44), and the daily rollup
-- of the ledger's points, written in the same batch as each award, so a
-- balance reads a row per day rather than every award. The ledger stays the
-- record; this is its running sum by day.
CREATE TABLE activity_days (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  user_id         TEXT NOT NULL REFERENCES users (id),
  -- YYYY-MM-DD in the organization's time zone.
  day             TEXT NOT NULL,
  answers         INTEGER NOT NULL DEFAULT 0,
  reviews         INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (organization_id, user_id, day)
);

CREATE TRIGGER activity_days_same_organization
BEFORE INSERT ON activity_days
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;


-- ---------------------------------------------------------------------------
-- Phase 46: Quest Games (docs/quest-games-plan.md)
-- ---------------------------------------------------------------------------
-- Anyone in the organization starts a game on a level of the bank; anyone
-- joins it with its code, on their own or in a team with a code of its own.
-- The play itself runs in the game's Durable Object (QuestGame), in memory:
-- these rows are the record -- the code lookup, the lists, the audit -- and
-- the results, written once when the game ends. Nothing during play writes here.

CREATE TABLE quest_games (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations (id),
  -- Six characters of GAME_CODE_ALPHABET (shared), unique for good: a code
  -- names one game, and teams' codes never repeat a game's.
  code               TEXT NOT NULL,
  host_user_id       TEXT NOT NULL REFERENCES users (id),
  -- A bank level (QUESTION_BANK_LEVEL_IDS).
  level_id           TEXT NOT NULL,
  mode               TEXT NOT NULL CHECK (mode IN ('count', 'timed')),
  question_count     INTEGER CHECK (question_count IS NULL OR question_count BETWEEN 1 AND 50),
  duration_seconds   INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 60 AND 1800),
  negative_marking   INTEGER NOT NULL DEFAULT 0 CHECK (negative_marking IN (0, 1)),
  max_team_size      INTEGER NOT NULL DEFAULT 4 CHECK (max_team_size BETWEEN 1 AND 6),
  -- Whether the series could include checked (unapproved) questions: the
  -- organization's canvas_assessments_unreviewed at the start.
  include_unreviewed INTEGER NOT NULL DEFAULT 0 CHECK (include_unreviewed IN (0, 1)),
  status             TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'running', 'finished')),
  series_length      INTEGER,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  started_at         TEXT,
  ended_at           TEXT,
  -- Phase 47 (docs/quest-games-g2-plan.md), added to production with
  -- ALTER TABLE ... ADD COLUMN, so each has a default that describes a Phase
  -- 46 game as it was: one level, right +1, wrong by negative_marking (kept,
  -- derived as wrong_points < 0), multiplayer, joining closed at the start.
  -- 'upward': Random, the level and every one above it in its family.
  level_scope        TEXT NOT NULL DEFAULT 'level' CHECK (level_scope IN ('level', 'upward')),
  right_points       INTEGER NOT NULL DEFAULT 1 CHECK (right_points BETWEEN 1 AND 10),
  wrong_points       INTEGER NOT NULL DEFAULT 0 CHECK (wrong_points BETWEEN -10 AND 0),
  knockout           INTEGER NOT NULL DEFAULT 0 CHECK (knockout IN (0, 1)),
  players            TEXT NOT NULL DEFAULT 'multi' CHECK (players IN ('single', 'multi')),
  max_teams          INTEGER CHECK (max_teams IS NULL OR max_teams BETWEEN 1 AND 20),
  late_join          INTEGER NOT NULL DEFAULT 0 CHECK (late_join IN (0, 1)),
  end_reason         TEXT CHECK (end_reason IS NULL OR end_reason IN ('complete', 'time', 'knockout', 'host', 'expired')),

  CHECK ((mode = 'count') = (question_count IS NOT NULL)),
  CHECK ((mode = 'timed') = (duration_seconds IS NOT NULL)),
  -- A game ended in its lobby (never started) is finished without a start.
  CHECK (status != 'running' OR started_at IS NOT NULL),
  CHECK ((status = 'finished') = (ended_at IS NOT NULL))
);

CREATE UNIQUE INDEX quest_games_code ON quest_games (code);
CREATE INDEX quest_games_org_idx ON quest_games (organization_id, created_at);

CREATE TRIGGER quest_games_same_organization
BEFORE INSERT ON quest_games
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.host_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_games_organization_fixed
BEFORE UPDATE OF organization_id ON quest_games
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- A team, or one player on their own (solo, no code). The totals, the place
-- and the answers are written when the game ends.
CREATE TABLE quest_game_teams (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations (id),
  game_id            TEXT NOT NULL REFERENCES quest_games (id),
  code               TEXT,
  name               TEXT NOT NULL,
  solo               INTEGER NOT NULL DEFAULT 0 CHECK (solo IN (0, 1)),
  created_by_user_id TEXT NOT NULL REFERENCES users (id),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  score              INTEGER,
  correct            INTEGER,
  wrong              INTEGER,
  skipped            INTEGER,
  finished_at        TEXT,
  place              INTEGER,
  -- JSON: [{ index, question_id, user_id, answer, correct, skipped, at }].
  answers            TEXT,

  CHECK ((solo = 1) = (code IS NULL))
);

CREATE UNIQUE INDEX quest_game_teams_code ON quest_game_teams (code) WHERE code IS NOT NULL;
CREATE INDEX quest_game_teams_game_idx ON quest_game_teams (game_id);

CREATE TRIGGER quest_game_teams_same_organization
BEFORE INSERT ON quest_game_teams
WHEN NOT EXISTS (SELECT 1 FROM quest_games g WHERE g.id = NEW.game_id AND g.organization_id = NEW.organization_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.created_by_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_game_teams_organization_fixed
BEFORE UPDATE OF organization_id ON quest_game_teams
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- Who plays, in which team: one team per player per game. What each answered
-- is in their team's answers (by user_id), so nothing more is written here.
CREATE TABLE quest_game_players (
  game_id         TEXT NOT NULL REFERENCES quest_games (id),
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  team_id         TEXT NOT NULL REFERENCES quest_game_teams (id),
  user_id         TEXT NOT NULL REFERENCES users (id),
  joined_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  PRIMARY KEY (game_id, user_id)
);

-- A person's games, newest first.
CREATE INDEX quest_game_players_user_idx ON quest_game_players (organization_id, user_id);

CREATE TRIGGER quest_game_players_same_organization
BEFORE INSERT ON quest_game_players
WHEN NOT EXISTS (SELECT 1 FROM quest_game_teams t
                 WHERE t.id = NEW.team_id AND t.game_id = NEW.game_id AND t.organization_id = NEW.organization_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_game_players_organization_fixed
BEFORE UPDATE OF organization_id ON quest_game_players
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- Phase 47: a person's named settings for a game, saved from the start
-- wizard's review and offered on its first step. Their own, in one
-- organization; `config` is the create request's JSON (createGameSchema's
-- output), parsed again by the shared schema on every read.
CREATE TABLE quest_game_favorites (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  user_id         TEXT NOT NULL REFERENCES users (id),
  name            TEXT NOT NULL COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 40),
  config          TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One name per person per organization: saving under a name again replaces it.
CREATE UNIQUE INDEX quest_game_favorites_name ON quest_game_favorites (organization_id, user_id, name);

CREATE TRIGGER quest_game_favorites_same_organization
BEFORE INSERT ON quest_game_favorites
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_game_favorites_organization_fixed
BEFORE UPDATE OF organization_id ON quest_game_favorites
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

-- Phase 48 (docs/quest-games-g3-plan.md): which questions a person has seen in this organization's
-- games, so the next game's series leaves them out. One row per person and question: seeing it
-- again moves it to that game and moment. Written once, at a game's end, by its object -- never
-- during play -- and read only by the next series' draw, never by a route.
CREATE TABLE quest_game_seen (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  user_id         TEXT NOT NULL REFERENCES users (id),
  question_id     TEXT NOT NULL REFERENCES questions (id),
  game_id         TEXT NOT NULL REFERENCES quest_games (id),
  seen_at         TEXT NOT NULL,

  -- The draw asks, per question, whether any of the game's players has seen it: one probe of this
  -- key per player, so no second index is needed.
  PRIMARY KEY (organization_id, user_id, question_id)
);

CREATE TRIGGER quest_game_seen_same_organization
BEFORE INSERT ON quest_game_seen
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.user_id)
  OR NOT EXISTS (SELECT 1 FROM quest_games g WHERE g.id = NEW.game_id AND g.organization_id = NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER quest_game_seen_organization_fixed
BEFORE UPDATE OF organization_id ON quest_game_seen
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;
