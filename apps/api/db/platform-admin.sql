-- The platform's first administrator ("Super Admin"): creates organizations
-- and their admins from the platform console. Belongs to no organization, so
-- sees nothing inside one unless an organization makes them a member.
--
-- Applied after the schema on the tutoring databases (and after the seed on
-- tutoring-test and locally). Idempotent: an upsert on the address, never
-- INSERT OR REPLACE -- with foreign keys on, REPLACE deletes the row first and
-- its cascades fire.
INSERT INTO users (id, email, full_name)
VALUES ('0c000000-0000-4000-8000-000000000001', 'ndessai@gmail.com', 'Nav Dessai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_admins (user_id)
SELECT id FROM users WHERE lower(email) = 'ndessai@gmail.com' AND deleted_at IS NULL
ON CONFLICT (user_id) DO NOTHING;
