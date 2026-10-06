-- ===========================================================================
--  CLEANUP -- after verify.sql came back right. Drops the staging tables, which
--  hold a copy of production's rows that nothing should read again.
-- ===========================================================================
DROP TABLE IF EXISTS mig_org;
DROP TABLE IF EXISTS mig_user_map;
DROP TABLE IF EXISTS mig_platform_admins_keep;
DROP TABLE IF EXISTS mig_users;
DROP TABLE IF EXISTS mig_user_roles;
DROP TABLE IF EXISTS mig_tutor_profiles;
DROP TABLE IF EXISTS mig_student_profiles;
DROP TABLE IF EXISTS mig_admin_profiles;
DROP TABLE IF EXISTS mig_payment_handles;
DROP TABLE IF EXISTS mig_availability_slots;
DROP TABLE IF EXISTS mig_guardianships;
DROP TABLE IF EXISTS mig_assignments;
DROP TABLE IF EXISTS mig_sessions;
DROP TABLE IF EXISTS mig_scheduled_sessions;
DROP TABLE IF EXISTS mig_schedule_cancellations;
DROP TABLE IF EXISTS mig_session_drafts;
DROP TABLE IF EXISTS mig_session_write_ups;
DROP TABLE IF EXISTS mig_session_assessments;
DROP TABLE IF EXISTS mig_session_reflections;
DROP TABLE IF EXISTS mig_active_sessions;
DROP TABLE IF EXISTS mig_payments;
DROP TABLE IF EXISTS mig_audit_events;
DROP TABLE IF EXISTS mig_comments;
DROP TABLE IF EXISTS mig_assessments;
DROP TABLE IF EXISTS mig_assessment_topic_ratings;
DROP TABLE IF EXISTS mig_learning_plans;
DROP TABLE IF EXISTS mig_learning_plan_topics;
DROP TABLE IF EXISTS mig_session_progress;
DROP TABLE IF EXISTS mig_session_topic_ratings;
DROP TABLE IF EXISTS mig_user_onboarding;
DROP TABLE IF EXISTS mig_preflight;
DROP TABLE IF EXISTS mig_verify;
