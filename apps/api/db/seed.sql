-- ===========================================================================
--  Local development seed
-- ===========================================================================
--  Safe to re-run: it clears every table first. Never point this at the remote
--  database.
--
--  The roster is chosen to exercise each combination the plan calls for rather
--  than to look like a plausible institute:
--
--    Priya   admin + tutor      an owner who also teaches
--    Dana    admin + parent     staff who is also a client; never signed in
--    Alex    tutor              the fully-populated tutor case
--    Maria   tutor + parent     "a parent can be a tutor"
--    Johan   tutor              suspended
--    Sanjay  tutor + student    "a tutor could also be a student tutoring
--                               lower grades", and has a parent of his own
--    Anita   parent             Sanjay's mother
--    Sofia   student            Maria's daughter; one parent
--    Ben     student            two parents, one marked primary
--    Tom     parent             Ben's father
--    Grace   parent             "parent may or may not have a student assigned"
-- ===========================================================================

DELETE FROM payments;
DELETE FROM sessions;
DELETE FROM assignments;
DELETE FROM guardianships;
DELETE FROM availability_slots;
DELETE FROM payment_handles;
DELETE FROM student_profiles;
DELETE FROM tutor_profiles;
DELETE FROM user_roles;
DELETE FROM users;

-- --- people ----------------------------------------------------------------
INSERT INTO users (id, email, full_name, phone, status) VALUES
  ('00000000-0000-4000-8000-000000000001', 'priya.raghavan@gmail.com',  'Priya Raghavan',  '(919) 555-0142', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'dana.whitfield@gmail.com',  'Dana Whitfield',  '(919) 555-0177', 'invited'),
  ('00000000-0000-4000-8000-000000000003', 'alex.chen.math@gmail.com',  'Alex Chen',       '(984) 555-0113', 'active'),
  ('00000000-0000-4000-8000-000000000004', 'maria.okafor@gmail.com',    'Maria Okafor',    '(919) 555-0155', 'active'),
  ('00000000-0000-4000-8000-000000000005', 'j.lindqvist@gmail.com',     'Johan Lindqvist', NULL,             'suspended'),
  ('00000000-0000-4000-8000-000000000006', 'sanjay.patel.nc@gmail.com', 'Sanjay Patel',    '(919) 555-0198', 'active'),
  ('00000000-0000-4000-8000-000000000007', 'anita.patel.nc@gmail.com',  'Anita Patel',     '(919) 555-0199', 'active'),
  ('00000000-0000-4000-8000-000000000008', 'sofia.okafor@gmail.com',    'Sofia Okafor',    NULL,             'active'),
  ('00000000-0000-4000-8000-000000000009', 'ben.whitfield09@gmail.com', 'Ben Whitfield',   NULL,             'active'),
  ('00000000-0000-4000-8000-00000000000a', 'tom.whitfield@gmail.com',   'Tom Whitfield',   '(919) 555-0121', 'active'),
  ('00000000-0000-4000-8000-00000000000b', 'grace.lee.nc@gmail.com',    'Grace Lee',       '(984) 555-0166', 'active');

-- --- what each of them does ------------------------------------------------
INSERT INTO user_roles (user_id, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000001', 'tutor'),
  ('00000000-0000-4000-8000-000000000002', 'admin'),
  ('00000000-0000-4000-8000-000000000002', 'parent'),
  ('00000000-0000-4000-8000-000000000003', 'tutor'),
  ('00000000-0000-4000-8000-000000000004', 'tutor'),
  ('00000000-0000-4000-8000-000000000004', 'parent'),
  ('00000000-0000-4000-8000-000000000005', 'tutor'),
  ('00000000-0000-4000-8000-000000000006', 'tutor'),
  ('00000000-0000-4000-8000-000000000006', 'student'),
  ('00000000-0000-4000-8000-000000000007', 'parent'),
  ('00000000-0000-4000-8000-000000000008', 'student'),
  ('00000000-0000-4000-8000-000000000009', 'student'),
  ('00000000-0000-4000-8000-00000000000a', 'parent'),
  ('00000000-0000-4000-8000-00000000000b', 'parent');

-- --- tutor-only data -------------------------------------------------------
INSERT INTO tutor_profiles
  (user_id, highest_education, school, area, availability_notes, virtual_available,
   default_rate_in_person_cents, default_rate_virtual_cents) VALUES
  ('00000000-0000-4000-8000-000000000001', 'PhD, Mathematics',       'UNC Chapel Hill',      'Chapel Hill',  'Limited hours during term planning weeks.', 1, 9000, 8000),
  ('00000000-0000-4000-8000-000000000003', 'MS, Applied Mathematics','NC State',             'Cary',         'Prefers back-to-back sessions.',            1, 7500, 6500),
  ('00000000-0000-4000-8000-000000000004', 'BS, Statistics',         'Duke',                 'Durham',       'In person only during school holidays.',    0, 6000, NULL),
  ('00000000-0000-4000-8000-000000000005', 'MSc, Mathematics',       'Lund University',      'Chapel Hill',  NULL,                                        1, 7000, 6000),
  -- A tutor still at school: "highest education" carries his current course,
  -- and his rate is lower than the advanced-degree tutors'.
  ('00000000-0000-4000-8000-000000000006', 'Grade 12 - AP Calculus BC','East Chapel Hill High','Chapel Hill','Only after 5pm on weekdays.',               1, 3500, 3000);

-- --- student-only data -----------------------------------------------------
INSERT INTO student_profiles
  (user_id, school, current_math_course, academic_year_goal, virtual_available) VALUES
  ('00000000-0000-4000-8000-000000000006', 'East Chapel Hill High', 'AP Calculus BC',     'Score 5 on the AP exam.',                        1),
  ('00000000-0000-4000-8000-000000000008', 'Culbreth Middle',       'Grade 7 Mathematics','Move up to the accelerated track next year.',     1),
  ('00000000-0000-4000-8000-000000000009', 'Ephesus Elementary',    'Grade 5 Mathematics','Confidence with fractions and word problems.',    0);

-- --- how money moves -------------------------------------------------------
-- Tutors are paid through these; parents are billed through them.
INSERT INTO payment_handles (user_id, method, handle) VALUES
  ('00000000-0000-4000-8000-000000000003', 'zelle', 'alex.chen.math@gmail.com'),
  ('00000000-0000-4000-8000-000000000003', 'venmo', '@alex-chen-math'),
  -- Maria is a tutor AND a parent: one handle, used in both directions.
  ('00000000-0000-4000-8000-000000000004', 'zelle', '(919) 555-0155'),
  ('00000000-0000-4000-8000-000000000006', 'venmo', '@sanjay-patel-nc'),
  ('00000000-0000-4000-8000-000000000007', 'zelle', 'anita.patel.nc@gmail.com'),
  ('00000000-0000-4000-8000-00000000000a', 'venmo', '@tom-whitfield'),
  ('00000000-0000-4000-8000-00000000000b', 'zelle', '(984) 555-0166');

-- --- when people are free --------------------------------------------------
-- (day_of_week 0=Sun..6=Sat, hour = start of a one-hour block)
INSERT INTO availability_slots (user_id, day_of_week, hour) VALUES
  -- Priya: Wednesday afternoons
  ('00000000-0000-4000-8000-000000000001', 3, 14),
  ('00000000-0000-4000-8000-000000000001', 3, 15),
  -- Alex: Tue/Thu evenings and Saturday mornings
  ('00000000-0000-4000-8000-000000000003', 2, 16),
  ('00000000-0000-4000-8000-000000000003', 2, 17),
  ('00000000-0000-4000-8000-000000000003', 4, 16),
  ('00000000-0000-4000-8000-000000000003', 4, 17),
  ('00000000-0000-4000-8000-000000000003', 6, 10),
  ('00000000-0000-4000-8000-000000000003', 6, 11),
  -- Maria: Saturday mornings only
  ('00000000-0000-4000-8000-000000000004', 6, 10),
  -- Sanjay: one set of hours, covering both his tutoring and his own lessons
  ('00000000-0000-4000-8000-000000000006', 1, 17),
  ('00000000-0000-4000-8000-000000000006', 3, 17),
  -- Sofia and Ben: when they can be tutored
  ('00000000-0000-4000-8000-000000000008', 2, 16),
  ('00000000-0000-4000-8000-000000000008', 4, 16),
  ('00000000-0000-4000-8000-000000000009', 6, 10);

-- --- who is responsible for whom -------------------------------------------
INSERT INTO guardianships (guardian_user_id, dependent_user_id, relationship, is_primary) VALUES
  -- Sofia has one parent, who is also a tutor here.
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000008', 'mother', 1),
  -- Ben has two, one of them the primary contact and also an admin.
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000009', 'mother', 1),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000009', 'father', 0),
  -- Sanjay tutors here AND is a student here, and is still a minor: the same
  -- table carries his parent link.
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000006', 'mother', 1);
-- Grace Lee deliberately has no dependents: a parent need not have a student.

-- --- who teaches whom, and at what price ------------------------------------
-- Rates are only set here when they differ from the tutor's default, so the
-- NULLs are the normal case rather than missing data.
INSERT INTO assignments (id, tutor_user_id, student_user_id, rate_in_person_cents, rate_virtual_cents, notes) VALUES
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', NULL, NULL, 'Weekly, building towards the accelerated track.'),
  -- A negotiated rate for this family, below Alex's usual in-person price.
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000009', 7000, NULL, 'Sibling-style discount agreed with the Whitfields.'),
  -- The senior student tutoring a younger one.
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000009', NULL, NULL, NULL),
  -- ...and being tutored himself, by the institute's owner.
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', NULL, NULL, 'AP Calculus BC exam prep.');

-- --- lessons that happened --------------------------------------------------
-- rate_cents and amount_cents are frozen snapshots: amount = rate x minutes/60.
INSERT INTO sessions
  (id, tutor_user_id, student_user_id, occurred_on, started_at, ended_at, duration_minutes, mode, rate_cents, amount_cents, notes, recorded_by_user_id) VALUES
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', '2026-09-08', '16:00', '17:00', 60,  'in_person', 7500, 7500,  'Reviewed equivalent fractions. Confident on halves and quarters, shaky on thirds. Homework: worksheet 3a.', '00000000-0000-4000-8000-000000000003'),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', '2026-09-15', '16:00', '17:30', 90,  'virtual',   6500, 9750,  'Word problems. Much better at extracting the operation from the sentence. Goal check: on track for accelerated track.', '00000000-0000-4000-8000-000000000003'),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000009', '2026-09-12', '10:00', '11:00', 60,  'in_person', 7000, 7000,  'Long division. Needed scaffolding but got there. Set 10 practice problems.', '00000000-0000-4000-8000-000000000003'),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000009', '2026-09-13', '17:00', '18:00', 60,  'virtual',   3000, 3000,  'Times tables drill, 6s through 9s. Fast recall improving.', '00000000-0000-4000-8000-000000000006'),
  ('50000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', '2026-09-10', '14:00', '15:30', 90,  'in_person', 9000, 13500, 'Related rates. Worked three past-paper questions. Assessment: exam-ready on this topic.', '00000000-0000-4000-8000-000000000001');

-- --- money that has changed hands -------------------------------------------
-- Sofia's mother has paid part of what is owed; Ben's family has paid in full
-- for Alex's lesson. Alex has been paid once. The rest is outstanding, which
-- is what the balances screen is for.
INSERT INTO payments (id, direction, party_user_id, student_user_id, amount_cents, method, paid_at, reference, notes, recorded_by_user_id) VALUES
  ('60000000-0000-4000-8000-000000000001', 'from_parent', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000008', 7500,  'zelle', '2026-09-09T18:30:00.000Z', NULL,   'For the 8 Sept lesson.', '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002', 'from_parent', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000009', 7000,  'venmo', '2026-09-13T09:05:00.000Z', NULL,   NULL,                     '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000003', 'from_parent', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000006', 10000, 'check', '2026-09-11T12:00:00.000Z', '1042', 'Part payment.',          '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000004', 'to_tutor',    '00000000-0000-4000-8000-000000000003', NULL,                                   15000, 'zelle', '2026-09-16T10:00:00.000Z', NULL,   'September, first half.', '00000000-0000-4000-8000-000000000001');
