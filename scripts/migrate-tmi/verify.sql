-- ===========================================================================
--  VERIFY -- reads tutoring-db, writes only its own mig_verify table. Run against tutoring-db after migrate.sql. Every row
--  pairs what production had (mig_*) with what the organization now holds;
--  `ok` must be 1 on every line.
-- ===========================================================================

DROP TABLE IF EXISTS mig_verify;
CREATE TABLE mig_verify (what TEXT, production INTEGER, tutoring INTEGER);

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'people' AS what, (SELECT COUNT(*) FROM mig_users) AS production,
       (SELECT COUNT(*) FROM org_members WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')) AS tutoring;

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'roles', (SELECT COUNT(*) FROM mig_user_roles),
       (SELECT COUNT(*) FROM user_roles WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'tutor profiles', (SELECT COUNT(*) FROM mig_tutor_profiles),
       (SELECT COUNT(*) FROM tutor_profiles WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'student profiles', (SELECT COUNT(*) FROM mig_student_profiles),
       (SELECT COUNT(*) FROM student_profiles WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'payment handles', (SELECT COUNT(*) FROM mig_payment_handles),
       (SELECT COUNT(*) FROM payment_handles WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'availability', (SELECT COUNT(*) FROM mig_availability_slots),
       (SELECT COUNT(*) FROM availability_slots WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'guardianships', (SELECT COUNT(*) FROM mig_guardianships),
       (SELECT COUNT(*) FROM guardianships WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'pairings', (SELECT COUNT(*) FROM mig_assignments),
       (SELECT COUNT(*) FROM assignments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'lessons', (SELECT COUNT(*) FROM mig_sessions),
       (SELECT COUNT(*) FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'lesson money (cents)',
       (SELECT COALESCE(SUM(tutor_amount_cents + charge_amount_cents), 0) FROM mig_sessions),
       (SELECT COALESCE(SUM(tutor_amount_cents + charge_amount_cents), 0) FROM sessions
        WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'write-ups', (SELECT COUNT(*) FROM mig_session_write_ups),
       (SELECT COUNT(*) FROM session_write_ups WHERE session_id IN
          (SELECT id FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'lesson assessments', (SELECT COUNT(*) FROM mig_session_assessments),
       (SELECT COUNT(*) FROM session_assessments WHERE session_id IN
          (SELECT id FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'reflections', (SELECT COUNT(*) FROM mig_session_reflections),
       (SELECT COUNT(*) FROM session_reflections WHERE session_id IN
          (SELECT id FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'scored lessons', (SELECT COUNT(*) FROM mig_session_progress),
       (SELECT COUNT(*) FROM session_progress WHERE session_id IN
          (SELECT id FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'lesson topic ratings', (SELECT COUNT(*) FROM mig_session_topic_ratings),
       (SELECT COUNT(*) FROM session_topic_ratings WHERE session_id IN
          (SELECT id FROM sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'schedules', (SELECT COUNT(*) FROM mig_scheduled_sessions),
       (SELECT COUNT(*) FROM scheduled_sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'cancelled lessons', (SELECT COUNT(*) FROM mig_schedule_cancellations),
       (SELECT COUNT(*) FROM schedule_cancellations WHERE schedule_id IN
          (SELECT id FROM scheduled_sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'drafts', (SELECT COUNT(*) FROM mig_session_drafts),
       (SELECT COUNT(*) FROM session_drafts WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'live lessons', (SELECT COUNT(*) FROM mig_active_sessions),
       (SELECT COUNT(*) FROM active_sessions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'payments', (SELECT COUNT(*) FROM mig_payments),
       (SELECT COUNT(*) FROM payments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'payment money (cents)', (SELECT COALESCE(SUM(amount_cents), 0) FROM mig_payments),
       (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'comments', (SELECT COUNT(*) FROM mig_comments),
       (SELECT COUNT(*) FROM comments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'assessments', (SELECT COUNT(*) FROM mig_assessments),
       (SELECT COUNT(*) FROM assessments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'assessment ratings', (SELECT COUNT(*) FROM mig_assessment_topic_ratings),
       (SELECT COUNT(*) FROM assessment_topic_ratings WHERE assessment_id IN
          (SELECT id FROM assessments WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'plans', (SELECT COUNT(*) FROM mig_learning_plans),
       (SELECT COUNT(*) FROM learning_plans WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'plan topics', (SELECT COUNT(*) FROM mig_learning_plan_topics),
       (SELECT COUNT(*) FROM learning_plan_topics WHERE plan_id IN
          (SELECT id FROM learning_plans WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')));
-- Production's log line for line, plus the one migration line.

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'log lines (+1 migration line)', (SELECT COUNT(*) FROM mig_audit_events) + 1,
       (SELECT COUNT(*) FROM audit_events WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'tmi'));
-- Timestamps carried exactly: every production log line, lesson and person
-- found with the same instant.

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'log timestamps identical', (SELECT COUNT(*) FROM mig_audit_events),
       (SELECT COUNT(*) FROM mig_audit_events e JOIN audit_events t
          ON t.id = e.id AND t.created_at = e.created_at AND t.description = e.description);

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'lesson timestamps identical', (SELECT COUNT(*) FROM mig_sessions),
       (SELECT COUNT(*) FROM mig_sessions s JOIN sessions t
          ON t.id = s.id AND t.created_at = s.created_at AND t.updated_at = s.updated_at);

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'membership timestamps identical', (SELECT COUNT(*) FROM mig_users),
       (SELECT COUNT(*) FROM mig_users s JOIN mig_user_map m ON m.src = s.id
          JOIN org_members t ON t.user_id = m.dst AND t.organization_id = (SELECT id FROM organizations WHERE slug = 'tmi')
          AND t.created_at = s.created_at);
-- Every student still has a guardian in the organization.

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'students without a guardian (want 0)', 0,
       (SELECT COUNT(*) FROM user_roles r
        WHERE r.organization_id = (SELECT id FROM organizations WHERE slug = 'tmi') AND r.role = 'student'
          AND NOT EXISTS (SELECT 1 FROM guardianships g
                          WHERE g.organization_id = r.organization_id
                            AND g.dependent_user_id = r.user_id));
-- The platform admins are still platform admins.

INSERT INTO mig_verify (what, production, tutoring)
SELECT 'platform admins kept', (SELECT COUNT(*) FROM mig_platform_admins_keep),
       (SELECT COUNT(*) FROM mig_platform_admins_keep k JOIN users u ON lower(u.email) = k.email
          JOIN platform_admins p ON p.user_id = u.id);

SELECT what, production, tutoring, production = tutoring AS ok FROM mig_verify;
