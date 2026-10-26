import type { OrgId } from '../lib/org.js';

/**
 * Phase 52: deleting a self-serve space at its maker's request removes everything it holds, in
 * one batch, children before parents (D1 enforces foreign keys). Every table that carries
 * `organization_id`, or hangs off one that does, is listed here; `scripts/check-purge.mjs` (run
 * by `npm run typecheck`) fails when a new one is not.
 *
 * Each entry deletes the space's rows of one table: `where` is a condition on that table's own
 * columns, with `?` the organization's id.
 */
export const PURGE_ORDER: { table: string; where: string }[] = [
  // Assessment
  { table: 'canvas_assessment_reviews', where: 'organization_id = ?' },
  { table: 'canvas_assessment_files', where: 'organization_id = ?' },
  { table: 'canvas_assessments', where: 'organization_id = ?' },
  // Quest
  { table: 'shares', where: 'organization_id = ?' },
  { table: 'quest_game_seen', where: 'organization_id = ?' },
  { table: 'quest_game_players', where: 'organization_id = ?' },
  { table: 'quest_game_teams', where: 'organization_id = ?' },
  { table: 'quest_games', where: 'organization_id = ?' },
  { table: 'quest_game_favorites', where: 'organization_id = ?' },
  { table: 'points_ledger', where: 'organization_id = ?' },
  { table: 'activity_days', where: 'organization_id = ?' },
  { table: 'question_suggestions', where: 'organization_id = ?' },
  { table: 'quest_attempts', where: 'organization_id = ?' },
  // Tutoring: what hangs off a lesson, a plan or an assessment, then those
  { table: 'session_progress', where: 'session_id IN (SELECT id FROM sessions WHERE organization_id = ?)' },
  { table: 'session_topic_ratings', where: 'session_id IN (SELECT id FROM sessions WHERE organization_id = ?)' },
  { table: 'session_write_ups', where: 'session_id IN (SELECT id FROM sessions WHERE organization_id = ?)' },
  { table: 'session_assessments', where: 'session_id IN (SELECT id FROM sessions WHERE organization_id = ?)' },
  { table: 'session_reflections', where: 'session_id IN (SELECT id FROM sessions WHERE organization_id = ?)' },
  { table: 'learning_plan_topics', where: 'plan_id IN (SELECT id FROM learning_plans WHERE organization_id = ?)' },
  { table: 'learning_plans', where: 'organization_id = ?' },
  { table: 'assessment_topic_ratings', where: 'assessment_id IN (SELECT id FROM assessments WHERE organization_id = ?)' },
  { table: 'assessments', where: 'organization_id = ?' },
  { table: 'comments', where: 'organization_id = ?' },
  { table: 'schedule_cancellations', where: 'schedule_id IN (SELECT id FROM scheduled_sessions WHERE organization_id = ?)' },
  { table: 'schedule_locations', where: 'organization_id = ?' },
  { table: 'assignment_locations', where: 'organization_id = ?' },
  { table: 'active_sessions', where: 'organization_id = ?' },
  { table: 'session_drafts', where: 'organization_id = ?' },
  { table: 'sessions', where: 'organization_id = ?' },
  { table: 'payments', where: 'organization_id = ?' },
  { table: 'scheduled_sessions', where: 'organization_id = ?' },
  { table: 'assignments', where: 'organization_id = ?' },
  { table: 'locations', where: 'organization_id = ?' },
  // The space's records about itself
  { table: 'notification_log', where: 'organization_id = ?' },
  { table: 'audit_events', where: 'organization_id = ?' },
  { table: 'ai_runs', where: 'organization_id = ?' },
  { table: 'consents', where: 'organization_id = ?' },
  { table: 'join_requests', where: 'organization_id = ?' },
  // Its curricula: its list, and any of its own
  { table: 'organization_curricula', where: 'organization_id = ?' },
  {
    table: 'curriculum_topics',
    where: 'level_id IN (SELECT l.id FROM curriculum_levels l JOIN curricula c ON c.id = l.curriculum_id WHERE c.organization_id = ?)',
  },
  { table: 'curriculum_levels', where: 'curriculum_id IN (SELECT id FROM curricula WHERE organization_id = ?)' },
  { table: 'curricula', where: 'organization_id = ?' },
  // Its people's places in it
  { table: 'user_roles', where: 'organization_id = ?' },
  { table: 'tutor_profiles', where: 'organization_id = ?' },
  { table: 'student_profiles', where: 'organization_id = ?' },
  { table: 'payment_handles', where: 'organization_id = ?' },
  { table: 'availability_slots', where: 'organization_id = ?' },
  { table: 'guardianships', where: 'organization_id = ?' },
  { table: 'org_members', where: 'organization_id = ?' },
  { table: 'organization_logos', where: 'organization_id = ?' },
  { table: 'organizations', where: 'id = ?' },
];

/**
 * Deletes a space and everything in it, then the people who existed only because of it: those who
 * belonged nowhere else, never signed in and never signed up (a child added without an address).
 * A person with an account of their own keeps it.
 */
export async function purgeSpace(db: D1Database, org: OrgId): Promise<{ peopleRemoved: number }> {
  const only = await db
    .prepare(
      // org-scope: who belongs ONLY to this space, read before its memberships go.
      `SELECT u.id FROM org_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = ? AND u.google_sub IS NULL
         AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM org_members o WHERE o.user_id = u.id AND o.organization_id <> m.organization_id)
         AND NOT EXISTS (SELECT 1 FROM platform_accounts p WHERE p.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM platform_admins a WHERE a.user_id = u.id)`,
    )
    .bind(org)
    .all<{ id: string }>();
  const ids = (only.results ?? []).map((row) => row.id);
  await db.batch([
    // org-scope: every statement names the organization through PURGE_ORDER's conditions.
    ...PURGE_ORDER.map(({ table, where }) => db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(org)),
    ...ids.map((id) => db.prepare('DELETE FROM users WHERE id = ?').bind(id)),
  ]);
  return { peopleRemoved: ids.length };
}
