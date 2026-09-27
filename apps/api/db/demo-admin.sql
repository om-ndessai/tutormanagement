-- The demo deployment's own administrator.
--
-- BOOTSTRAP_ADMIN_EMAILS only opens while the database holds NO admin, and the
-- seeded roster ships with two, so the demonstrator could never sign in on a
-- freshly seeded demo. This adds them as a real admin row instead, which is
-- also closer to what they are.
--
-- Applied to tmi-portal-test-db only, after seeding. Never production: there
-- the administrator is a real person with real records.
INSERT OR REPLACE INTO users (id, email, full_name, phone, status)
VALUES ('90000000-0000-4000-8000-000000000001', 'om.ndessai@gmail.com', 'Om Dessai', NULL, 'active');

INSERT OR REPLACE INTO user_roles (user_id, role)
VALUES ('90000000-0000-4000-8000-000000000001', 'admin');

-- Gives the demo's 1099s a payer TIN to prefill with, as an admin record does.
INSERT OR REPLACE INTO admin_profiles (user_id, tin)
VALUES ('90000000-0000-4000-8000-000000000001', '47-2019388');
