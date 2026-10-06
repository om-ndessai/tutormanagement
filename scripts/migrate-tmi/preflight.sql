-- ===========================================================================
--  PREFLIGHT -- reads tutoring-db, writes only its own mig_preflight table. Run against tutoring-db after stage.sql and before
--  migrate.sql. EVERY ROW IT RETURNS IS A REASON NOT TO RUN THE MIGRATION.
--  An empty result is the go-ahead.
-- ===========================================================================

DROP TABLE IF EXISTS mig_preflight;
CREATE TABLE mig_preflight (problem TEXT, detail TEXT);

INSERT INTO mig_preflight (problem, detail)
-- Two production people with one live address: they would become one person.
SELECT 'duplicate address in production' AS problem, lower(email) AS detail
FROM mig_users WHERE email IS NOT NULL AND deleted_at IS NULL
GROUP BY lower(email) HAVING COUNT(*) > 1;

INSERT INTO mig_preflight (problem, detail)
-- Two production people that resolve to the same tutoring-db person.
SELECT 'two production people match one tutoring person', lower(a.email)
FROM mig_users a JOIN mig_users b ON a.id < b.id
WHERE a.email IS NOT NULL AND lower(a.email) = lower(b.email);

INSERT INTO mig_preflight (problem, detail)
-- A production person's Google account is pinned to a DIFFERENT person in
-- another organization: they cannot be both.
SELECT 'Google account pinned to someone else', s.email
FROM mig_users s JOIN users u ON u.google_sub = s.google_sub AND u.deleted_at IS NULL
WHERE s.google_sub IS NOT NULL
  AND lower(coalesce(u.email, '')) <> lower(coalesce(s.email, ''))
  AND EXISTS (SELECT 1 FROM org_members m JOIN organizations o ON o.id = m.organization_id
              WHERE m.user_id = u.id AND o.slug <> 'tmi');

INSERT INTO mig_preflight (problem, detail)
-- A production id already used by a person who belongs to another
-- organization (ids are random UUIDs; this should never happen).
SELECT 'person id taken elsewhere', s.id
FROM mig_users s JOIN users u ON u.id = s.id
WHERE lower(coalesce(u.email, '')) <> lower(coalesce(s.email, ''))
  AND EXISTS (SELECT 1 FROM org_members m JOIN organizations o ON o.id = m.organization_id
              WHERE m.user_id = u.id AND o.slug <> 'tmi');

INSERT INTO mig_preflight (problem, detail)
-- A row id already used by ANOTHER organization's row.
SELECT 'session id taken elsewhere', s.id FROM mig_sessions s JOIN sessions t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'assignment id taken elsewhere', s.id FROM mig_assignments s JOIN assignments t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'schedule id taken elsewhere', s.id FROM mig_scheduled_sessions s
  JOIN scheduled_sessions t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'payment id taken elsewhere', s.id FROM mig_payments s JOIN payments t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'comment id taken elsewhere', s.id FROM mig_comments s JOIN comments t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'assessment id taken elsewhere', s.id FROM mig_assessments s JOIN assessments t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'plan id taken elsewhere', s.id FROM mig_learning_plans s JOIN learning_plans t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'draft id taken elsewhere', s.id FROM mig_session_drafts s JOIN session_drafts t ON t.id = s.id
  JOIN organizations o ON o.id = t.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
SELECT 'audit id taken elsewhere', s.id FROM mig_audit_events s JOIN audit_events t ON t.id = s.id
  WHERE t.organization_id IS NULL
     OR t.organization_id NOT IN (SELECT id FROM organizations WHERE slug = 'tmi');

INSERT INTO mig_preflight (problem, detail)
-- A live lesson whose tutor is teaching one for another organization right now.
SELECT 'tutor has a live lesson elsewhere', s.tutor_user_id FROM mig_active_sessions s
  JOIN users u ON lower(u.email) = (SELECT lower(email) FROM mig_users WHERE id = s.tutor_user_id)
  JOIN active_sessions a ON a.tutor_user_id = u.id
  JOIN organizations o ON o.id = a.organization_id WHERE o.slug <> 'tmi';

INSERT INTO mig_preflight (problem, detail)
-- Curriculum the rows name that tutoring-db's catalog does not have.
SELECT 'unknown topic', topic_id FROM (
  SELECT topic_id FROM mig_assessment_topic_ratings
  UNION SELECT topic_id FROM mig_learning_plan_topics
  UNION SELECT topic_id FROM mig_session_topic_ratings)
WHERE topic_id NOT IN (SELECT id FROM curriculum_topics);

INSERT INTO mig_preflight (problem, detail)
SELECT 'unknown level', level_id FROM (
  SELECT recommended_level_id AS level_id FROM mig_assessments WHERE recommended_level_id IS NOT NULL
  UNION SELECT target_level_id FROM mig_learning_plans WHERE target_level_id IS NOT NULL)
WHERE level_id NOT IN (SELECT id FROM curriculum_levels);

INSERT INTO mig_preflight (problem, detail)
-- A student with no guardian in production would arrive breaking the rule.
SELECT 'student without a guardian', r.user_id FROM mig_user_roles r
WHERE r.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM mig_guardianships g WHERE g.dependent_user_id = r.user_id);

SELECT problem, detail FROM mig_preflight;
