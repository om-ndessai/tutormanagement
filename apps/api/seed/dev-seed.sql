-- Local development seed data. Safe to re-run: it clears the table first.
-- Never run this against the remote database.

DELETE FROM users;

INSERT INTO users (id, email, full_name, phone, role, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@trianglemathinstitute.com',   'Priya Raghavan',  '(919) 555-0142', 'admin', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'office@trianglemathinstitute.com',  'Dana Whitfield',  '(919) 555-0177', 'admin', 'active'),
  ('33333333-3333-4333-8333-333333333333', 'a.chen@trianglemathinstitute.com',  'Alex Chen',       '(984) 555-0113', 'tutor', 'active'),
  ('44444444-4444-4444-8444-444444444444', 'm.okafor@trianglemathinstitute.com','Maria Okafor',    NULL,             'tutor', 'active'),
  ('55555555-5555-4555-8555-555555555555', 's.patel@trianglemathinstitute.com', 'Sanjay Patel',    '(919) 555-0198', 'tutor', 'invited'),
  ('66666666-6666-4666-8666-666666666666', 'j.lindqvist@trianglemathinstitute.com', 'Johan Lindqvist', NULL,        'tutor', 'suspended');
