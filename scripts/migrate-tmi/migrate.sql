-- ===========================================================================
--  The institute's records into tutoring-db, as the organization
--  "Mathematics Institute of the Triangle"            (docs/migration-tmi.md)
-- ===========================================================================
--
--  Runs against tutoring-db AFTER stage.sql (the mig_* tables: production's
--  rows, verbatim) and AFTER preflight.sql has come back empty.
--
--  What it does, in order:
--    1. makes sure the organization exists, wearing the institute's look
--       (palette 'plum', the built-in logo, its calendar domain, its TIN);
--    2. removes EVERYTHING that organization holds in tutoring-db -- and only
--       that organization: every other organization is untouched;
--    3. copies every production row back in: same ids, same text, same
--       created_at / updated_at / last_login_at, the whole audit log.
--
--  Re-runnable: step 2 empties the organization first, so a second run lands
--  in exactly the same state as the first. Nothing here reads tmi-portal-db.
--
--  People are global in tutoring-db. A production person is matched to an
--  EXISTING person (same Google account, else same address) only when that
--  person belongs to another organization; otherwise production's own row --
--  its id and timestamps -- is the person. That is how the platform admin
--  placeholder for ndessai@gmail.com gives way to the institute's own record
--  of the same person, keeping platform-admin standing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The organization
-- ---------------------------------------------------------------------------
-- Keyed on its slug, so an organization already created for the institute
-- (from the console, or by an earlier run) is the one used. Its look is the
-- institute's own: palette 'plum' is index.css's base palette, the one
-- tmi-portal wears, and builtin_logo 'institute' serves the same logo files.
-- The calendar domain is the one every calendar file the institute has
-- issued carries: keeping it means subscribers' events update, not double.
INSERT INTO organizations
  (id, slug, name, short_name, tagline, blurb, place, palette, builtin_logo,
   time_zone, calendar_domain)
VALUES
  ('0a1a0000-0000-4000-8000-000000000001', 'tmi', 'Mathematics Institute of the Triangle',
   'TMI', 'Exploring the fun of Math',
   'Small classes, advanced-degree instructors, and a curriculum built around problem solving — for grades 1 through 12, in person and online.',
   'Chapel Hill, North Carolina', 'plum', 'institute', 'America/New_York',
   'trianglemathinstitute.com')
ON CONFLICT (slug) DO UPDATE SET
  name = excluded.name,
  palette = excluded.palette,
  builtin_logo = excluded.builtin_logo,
  calendar_domain = excluded.calendar_domain,
  archived_at = NULL;

DROP TABLE IF EXISTS mig_org;
CREATE TABLE mig_org AS SELECT id FROM organizations WHERE slug = 'tmi';

-- The payer TIN production keeps on its admins' records (the most recently
-- updated one that is set). Not an SSN: production's API refused one.
UPDATE organizations
SET tin = COALESCE(
      (SELECT tin FROM mig_admin_profiles WHERE tin IS NOT NULL AND trim(tin) <> ''
       ORDER BY updated_at DESC LIMIT 1),
      tin)
WHERE id = (SELECT id FROM mig_org);


-- ---------------------------------------------------------------------------
-- 2. Empty the organization -- this organization only
-- ---------------------------------------------------------------------------
-- Children go with their parents through ON DELETE CASCADE: a lesson's
-- write-up, assessments, reflection, progress and ratings with the lesson; a
-- schedule's cancellations with the schedule; a plan's topics with the plan;
-- an assessment's ratings with the assessment; a member's roles, profiles,
-- handles, availability and guardianships with the membership.
DELETE FROM comments           WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM session_drafts     WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM active_sessions    WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM sessions           WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM scheduled_sessions WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM payments           WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM learning_plans     WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM assessments        WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM assignments        WHERE organization_id = (SELECT id FROM mig_org);
-- The organization's own log. Production's whole log is copied back in step
-- 3, so nothing of it is lost; lines tutoring-db wrote for this organization
-- before the run (its creation from the console, say) go with the rest.
DELETE FROM audit_events       WHERE organization_id = (SELECT id FROM mig_org);
DELETE FROM org_members        WHERE organization_id = (SELECT id FROM mig_org);

-- People who now belong to no organization and are production's -- by id,
-- or by an address a production person has -- are removed too, so the
-- person can come back as production's own row. Platform admins among them
-- are remembered first and restored after (the table survives a failed run,
-- so a re-run still restores them).
CREATE TABLE IF NOT EXISTS mig_platform_admins_keep (email TEXT PRIMARY KEY);
INSERT OR IGNORE INTO mig_platform_admins_keep (email)
SELECT lower(u.email)
FROM platform_admins p JOIN users u ON u.id = p.user_id
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = u.id)
  AND (u.id IN (SELECT id FROM mig_users)
       OR lower(u.email) IN (SELECT lower(email) FROM mig_users WHERE email IS NOT NULL));

DELETE FROM users
WHERE NOT EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = users.id)
  AND (id IN (SELECT id FROM mig_users)
       OR lower(email) IN (SELECT lower(email) FROM mig_users WHERE email IS NOT NULL));


-- ---------------------------------------------------------------------------
-- 3. People
-- ---------------------------------------------------------------------------
-- Who each production person is in tutoring-db: someone who belongs to
-- another organization (same Google account, else same live address), or
-- production's own row.
DROP TABLE IF EXISTS mig_user_map;
CREATE TABLE mig_user_map (src TEXT PRIMARY KEY, dst TEXT NOT NULL);
INSERT INTO mig_user_map (src, dst)
SELECT s.id,
       COALESCE(
         (SELECT u.id FROM users u
          WHERE s.google_sub IS NOT NULL AND u.google_sub = s.google_sub AND u.deleted_at IS NULL),
         (SELECT u.id FROM users u
          WHERE s.email IS NOT NULL AND lower(u.email) = lower(s.email) AND u.deleted_at IS NULL),
         s.id)
FROM mig_users s;

-- Production's own people, exactly as production holds them. Production's
-- deleted_at meant "no longer part of the institute", which is now the
-- membership's removed_at (below); the person themselves is not erased.
INSERT INTO users
  (id, email, full_name, phone, google_sub, created_at, updated_at, last_login_at, deleted_at)
SELECT s.id, s.email, s.full_name, s.phone, s.google_sub,
       s.created_at, s.updated_at, s.last_login_at, NULL
FROM mig_users s JOIN mig_user_map m ON m.src = s.id
WHERE m.dst = s.id;

INSERT OR IGNORE INTO platform_admins (user_id)
SELECT u.id FROM users u JOIN mig_platform_admins_keep k ON lower(u.email) = k.email
WHERE u.deleted_at IS NULL;

-- Belonging to the institute. Production's status, its removal date, and
-- when they last signed in (which is when they last entered the institute,
-- so nobody who has used it is welcomed as new).
INSERT INTO org_members
  (organization_id, user_id, status, removed_at, first_entered_at, last_entered_at,
   details_confirmed_at, created_at, updated_at)
SELECT o.id, m.dst, s.status, s.deleted_at, s.last_login_at, s.last_login_at,
       ob.details_confirmed_at, s.created_at, s.updated_at
FROM mig_users s
JOIN mig_user_map m ON m.src = s.id
CROSS JOIN mig_org o
LEFT JOIN mig_user_onboarding ob ON ob.user_id = s.id;

INSERT INTO user_roles (organization_id, user_id, role, created_at)
SELECT o.id, m.dst, r.role, r.created_at
FROM mig_user_roles r JOIN mig_user_map m ON m.src = r.user_id CROSS JOIN mig_org o;

INSERT INTO tutor_profiles
  (organization_id, user_id, highest_education, school, area, availability_notes,
   virtual_available, default_rate_in_person_cents, default_rate_virtual_cents,
   topup_amount_cents, max_session_minutes, ssn_received_on,
   address_line1, address_line2, city, state, postal_code, created_at, updated_at)
SELECT o.id, m.dst, p.highest_education, p.school, p.area, p.availability_notes,
       p.virtual_available, p.default_rate_in_person_cents, p.default_rate_virtual_cents,
       p.topup_amount_cents, p.max_session_minutes, p.ssn_received_on,
       p.address_line1, p.address_line2, p.city, p.state, p.postal_code, p.created_at, p.updated_at
FROM mig_tutor_profiles p JOIN mig_user_map m ON m.src = p.user_id CROSS JOIN mig_org o;

INSERT INTO student_profiles
  (organization_id, user_id, school, current_math_course, academic_year_goal, virtual_available,
   charge_rate_in_person_cents, charge_rate_virtual_cents, max_session_minutes,
   created_at, updated_at)
SELECT o.id, m.dst, p.school, p.current_math_course, p.academic_year_goal, p.virtual_available,
       p.charge_rate_in_person_cents, p.charge_rate_virtual_cents, p.max_session_minutes,
       p.created_at, p.updated_at
FROM mig_student_profiles p JOIN mig_user_map m ON m.src = p.user_id CROSS JOIN mig_org o;

INSERT INTO payment_handles (organization_id, user_id, method, handle, created_at, updated_at)
SELECT o.id, m.dst, h.method, h.handle, h.created_at, h.updated_at
FROM mig_payment_handles h JOIN mig_user_map m ON m.src = h.user_id CROSS JOIN mig_org o;

INSERT INTO availability_slots (organization_id, user_id, day_of_week, hour, created_at)
SELECT o.id, m.dst, a.day_of_week, a.hour, a.created_at
FROM mig_availability_slots a JOIN mig_user_map m ON m.src = a.user_id CROSS JOIN mig_org o;

INSERT INTO guardianships
  (organization_id, guardian_user_id, dependent_user_id, relationship, is_primary, created_at)
SELECT o.id, gm.dst, dm.dst, g.relationship, g.is_primary, g.created_at
FROM mig_guardianships g
JOIN mig_user_map gm ON gm.src = g.guardian_user_id
JOIN mig_user_map dm ON dm.src = g.dependent_user_id
CROSS JOIN mig_org o;

-- The welcome-tour state is the person's; someone already in tutoring-db
-- keeps their own.
INSERT INTO user_onboarding (user_id, tour_finished_at, tour_outcome, created_at, updated_at)
SELECT m.dst, ob.tour_finished_at, ob.tour_outcome, ob.created_at, ob.updated_at
FROM mig_user_onboarding ob JOIN mig_user_map m ON m.src = ob.user_id
WHERE true
ON CONFLICT (user_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. Teaching, money and the record of both -- same ids, same timestamps
-- ---------------------------------------------------------------------------
-- (SELECT dst FROM mig_user_map WHERE src = x) is a production person's id in
-- tutoring-db; for almost everyone it is the same id. A reference production
-- had already cleared (a purged person) stays NULL.

INSERT INTO assignments
  (id, organization_id, tutor_user_id, student_user_id, rate_in_person_cents, rate_virtual_cents,
   is_active, notes, created_at, updated_at)
SELECT a.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = a.tutor_user_id),
       (SELECT dst FROM mig_user_map WHERE src = a.student_user_id),
       a.rate_in_person_cents, a.rate_virtual_cents, a.is_active, a.notes, a.created_at, a.updated_at
FROM mig_assignments a CROSS JOIN mig_org o;

INSERT INTO sessions
  (id, organization_id, tutor_user_id, student_user_id, occurred_on, started_at, ended_at,
   duration_minutes, mode, tutor_rate_cents, tutor_amount_cents, charge_rate_cents,
   charge_amount_cents, notes, auto_stopped, recorded_by_user_id, created_at, updated_at)
SELECT s.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = s.tutor_user_id),
       (SELECT dst FROM mig_user_map WHERE src = s.student_user_id),
       s.occurred_on, s.started_at, s.ended_at, s.duration_minutes, s.mode,
       s.tutor_rate_cents, s.tutor_amount_cents, s.charge_rate_cents, s.charge_amount_cents,
       s.notes, s.auto_stopped,
       (SELECT dst FROM mig_user_map WHERE src = s.recorded_by_user_id),
       s.created_at, s.updated_at
FROM mig_sessions s CROSS JOIN mig_org o;

INSERT INTO session_write_ups
  (session_id, planned, previous_review, homework_review, homework_status, homework_assigned,
   created_at, updated_at)
SELECT session_id, planned, previous_review, homework_review, homework_status, homework_assigned,
       created_at, updated_at
FROM mig_session_write_ups;

INSERT INTO session_assessments
  (session_id, author_user_id, author_role, rating, body, created_at, updated_at)
SELECT a.session_id, (SELECT dst FROM mig_user_map WHERE src = a.author_user_id),
       a.author_role, a.rating, a.body, a.created_at, a.updated_at
FROM mig_session_assessments a;

INSERT INTO session_reflections
  (session_id, learned_new, difficulty, understanding, pace, homework_notes, comment,
   entered_by_user_id, entered_as, created_at, updated_at)
SELECT r.session_id, r.learned_new, r.difficulty, r.understanding, r.pace, r.homework_notes,
       r.comment, (SELECT dst FROM mig_user_map WHERE src = r.entered_by_user_id),
       r.entered_as, r.created_at, r.updated_at
FROM mig_session_reflections r;

INSERT INTO scheduled_sessions
  (id, organization_id, tutor_user_id, student_user_id, day_of_week, start_time, duration_minutes,
   mode, starts_on, ends_on, location, notes, is_active, created_at, updated_at)
SELECT s.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = s.tutor_user_id),
       (SELECT dst FROM mig_user_map WHERE src = s.student_user_id),
       s.day_of_week, s.start_time, s.duration_minutes, s.mode, s.starts_on, s.ends_on,
       s.location, s.notes, s.is_active, s.created_at, s.updated_at
FROM mig_scheduled_sessions s CROSS JOIN mig_org o;

INSERT INTO schedule_cancellations
  (schedule_id, occurs_on, note, cancelled_by_user_id, cancelled_as, created_at)
SELECT c.schedule_id, c.occurs_on, c.note,
       (SELECT dst FROM mig_user_map WHERE src = c.cancelled_by_user_id),
       c.cancelled_as, c.created_at
FROM mig_schedule_cancellations c;

INSERT INTO session_drafts
  (id, organization_id, tutor_user_id, student_user_id, author_user_id, occurred_on, started_at,
   ended_at, mode, notes, progress_json, write_up_json, assessment_json, created_at, updated_at)
SELECT d.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = d.tutor_user_id),
       (SELECT dst FROM mig_user_map WHERE src = d.student_user_id),
       (SELECT dst FROM mig_user_map WHERE src = d.author_user_id),
       d.occurred_on, d.started_at, d.ended_at, d.mode, d.notes, d.progress_json,
       d.write_up_json, d.assessment_json, d.created_at, d.updated_at
FROM mig_session_drafts d CROSS JOIN mig_org o;

-- A lesson running at the moment of the export is carried over still
-- running; the sweep closes it at its limit as it would have in production.
INSERT INTO active_sessions
  (tutor_user_id, organization_id, student_user_id, mode, started_at, notes, created_at)
SELECT (SELECT dst FROM mig_user_map WHERE src = a.tutor_user_id), o.id,
       (SELECT dst FROM mig_user_map WHERE src = a.student_user_id),
       a.mode, a.started_at, a.notes, a.created_at
FROM mig_active_sessions a CROSS JOIN mig_org o;

INSERT INTO payments
  (id, organization_id, direction, party_user_id, student_user_id, amount_cents, method, paid_at,
   reference, notes, recorded_by_user_id, created_at, updated_at)
SELECT p.id, o.id, p.direction,
       (SELECT dst FROM mig_user_map WHERE src = p.party_user_id),
       (SELECT dst FROM mig_user_map WHERE src = p.student_user_id),
       p.amount_cents, p.method, p.paid_at, p.reference, p.notes,
       (SELECT dst FROM mig_user_map WHERE src = p.recorded_by_user_id),
       p.created_at, p.updated_at
FROM mig_payments p CROSS JOIN mig_org o;

INSERT INTO assessments
  (id, organization_id, student_user_id, assessor_user_id, assessed_on, school_course,
   recommended_level_id, summary, created_at, updated_at)
SELECT a.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = a.student_user_id),
       (SELECT dst FROM mig_user_map WHERE src = a.assessor_user_id),
       a.assessed_on, a.school_course, a.recommended_level_id, a.summary, a.created_at, a.updated_at
FROM mig_assessments a CROSS JOIN mig_org o;

INSERT INTO assessment_topic_ratings (assessment_id, topic_id, rating)
SELECT assessment_id, topic_id, rating FROM mig_assessment_topic_ratings;

INSERT INTO learning_plans
  (id, organization_id, student_user_id, assessment_id, goal, target_level_id, starts_on,
   target_on, sessions_per_week, session_minutes, recommendation, status, created_by_user_id,
   created_at, updated_at)
SELECT p.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = p.student_user_id),
       p.assessment_id, p.goal, p.target_level_id, p.starts_on, p.target_on,
       p.sessions_per_week, p.session_minutes, p.recommendation, p.status,
       (SELECT dst FROM mig_user_map WHERE src = p.created_by_user_id),
       p.created_at, p.updated_at
FROM mig_learning_plans p CROSS JOIN mig_org o;

INSERT INTO learning_plan_topics (plan_id, topic_id, position)
SELECT plan_id, topic_id, position FROM mig_learning_plan_topics;

INSERT INTO session_progress (session_id, plan_id, goal_rating, created_at, updated_at)
SELECT session_id, plan_id, goal_rating, created_at, updated_at FROM mig_session_progress;

INSERT INTO session_topic_ratings (session_id, topic_id, rating)
SELECT session_id, topic_id, rating FROM mig_session_topic_ratings;

INSERT INTO comments
  (id, organization_id, author_user_id, target_user_id, target_session_id, target_assignment_id,
   target_scheduled_session_id, body, created_at, deleted_at)
SELECT c.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = c.author_user_id),
       (SELECT dst FROM mig_user_map WHERE src = c.target_user_id),
       c.target_session_id, c.target_assignment_id, c.target_scheduled_session_id,
       c.body, c.created_at, c.deleted_at
FROM mig_comments c CROSS JOIN mig_org o;

-- The whole log, line for line: who, what, the sentence written at the time,
-- and when. Its names are the snapshots production took.
INSERT INTO audit_events
  (id, organization_id, actor_user_id, actor_name, subject_user_id, subject_name, action,
   description, entity_type, entity_id, created_at)
SELECT e.id, o.id,
       (SELECT dst FROM mig_user_map WHERE src = e.actor_user_id), e.actor_name,
       (SELECT dst FROM mig_user_map WHERE src = e.subject_user_id), e.subject_name,
       e.action, e.description, e.entity_type,
       CASE WHEN e.entity_type = 'user'
            THEN COALESCE((SELECT dst FROM mig_user_map WHERE src = e.entity_id), e.entity_id)
            ELSE e.entity_id END,
       e.created_at
FROM mig_audit_events e CROSS JOIN mig_org o;

-- And one line saying it happened, so the log explains its own beginning.
INSERT INTO audit_events
  (id, organization_id, actor_user_id, actor_name, action, description, entity_type, entity_id,
   created_at)
SELECT lower(substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-8' ||
             substr(h, 18, 3) || '-' || substr(h, 21, 12)),
       o.id, NULL, 'System', 'organization.updated',
       'Brought the institute''s records over from tmi-portal: ' ||
         (SELECT COUNT(*) FROM mig_users) || ' people, ' ||
         (SELECT COUNT(*) FROM mig_sessions) || ' lessons, ' ||
         (SELECT COUNT(*) FROM mig_audit_events) || ' log lines',
       'organization', o.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM mig_org o, (SELECT hex(randomblob(16)) AS h);

-- The staging tables stay until verify.sql has compared them with what was
-- written; cleanup.sql drops them.
