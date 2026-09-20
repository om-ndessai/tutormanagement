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
  (user_id, highest_education, school, area, availability_notes, virtual_available) VALUES
  ('00000000-0000-4000-8000-000000000001', 'PhD, Mathematics',       'UNC Chapel Hill',      'Chapel Hill',  'Limited hours during term planning weeks.', 1),
  ('00000000-0000-4000-8000-000000000003', 'MS, Applied Mathematics','NC State',             'Cary',         'Prefers back-to-back sessions.',            1),
  ('00000000-0000-4000-8000-000000000004', 'BS, Statistics',         'Duke',                 'Durham',       'In person only during school holidays.',    0),
  ('00000000-0000-4000-8000-000000000005', 'MSc, Mathematics',       'Lund University',      'Chapel Hill',  NULL,                                        1),
  -- A tutor still at school: "highest education" carries his current course.
  ('00000000-0000-4000-8000-000000000006', 'Grade 12 - AP Calculus BC','East Chapel Hill High','Chapel Hill','Only after 5pm on weekdays.',               1);

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
