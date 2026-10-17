import { z } from 'zod';

/**
 * Every action the portal records, as "<entity>.<verb>".
 *
 * Kept as one closed list rather than free-form strings so the filter UI can
 * be generated from it, and so a typo in a call site is a type error instead
 * of an event nobody can ever find again.
 */
export const AUDIT_ACTIONS = [
  'auth.signed_in',
  'auth.signed_out',
  'auth.denied',
  'auth.entered',

  'user.created',
  'user.updated',
  'user.roles_changed',
  'user.deactivated',
  'user.restored',
  'user.deleted',
  'user.details_confirmed',
  'onboarding.tour_finished',

  'assignment.created',
  'assignment.updated',
  'assignment.removed',
  'assignment.locations_set',

  'location.created',
  'location.updated',
  'location.removed',

  'tutor.ssn_confirmed',
  'tutor.ssn_cleared',
  'comment.added',
  'comment.deleted',
  'session.drafted',
  'session.draft_discarded',
  'session.recorded',
  'session.auto_stopped',
  'session.updated',
  'session.deleted',
  'session.assessed',
  'session.assessment_withdrawn',
  'session.reflected',
  'session.reflection_withdrawn',

  'payment.recorded',
  'payment.updated',
  'payment.deleted',

  'schedule.created',
  'schedule.updated',
  'schedule.removed',
  'schedule.occurrence_cancelled',
  'schedule.occurrence_restored',

  'assessment.recorded',
  'assessment.updated',
  'assessment.deleted',

  'plan.created',
  'plan.updated',
  'plan.deleted',

  // Phase 35. Deliberately not organization.*: the platform console lists
  // those across organizations, and this sentence may one day name an
  // organization's own curriculum (R14).
  'curriculum.offering_updated',

  'membership.invited',
  'membership.accepted',
  'membership.declined',
  'membership.default_set',
  'membership.default_cleared',

  'organization.created',
  'organization.updated',
  'organization.archived',
  'organization.restored',
  'organization.logo_updated',
  'organization.settings_updated',
  'organization.admin_added',
  'organization.admin_removed',

  'platform_admin.added',
  'person.updated_by_platform',
  'person.sign_in_unpinned',

  // Phase 36: the AI layer and the question bank. Platform events (no
  // organization); never a prompt, a reply or a question's text (AG7).
  'ai.task_updated',
  'question_bank.drafted',
  'question_bank.checked',
  'question_bank.topic_updated',
  'question.updated',
  'question.approved',
  'question.retired',
  'question.restored',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The entity each action concerns, derived from the action name. */
export function auditEntity(action: string): string {
  return action.split('.')[0] ?? 'other';
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'auth.signed_in': 'Signed in',
  'auth.signed_out': 'Signed out',
  'auth.denied': 'Sign-in denied',
  'auth.entered': 'Entered the organization',

  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.roles_changed': 'Roles changed',
  'user.deactivated': 'User deactivated',
  'user.restored': 'User restored',
  'user.deleted': 'User deleted',
  'user.details_confirmed': 'Details confirmed',
  'onboarding.tour_finished': 'Portal tour finished',

  'assignment.created': 'Student assigned',
  'assignment.updated': 'Assignment updated',
  'assignment.removed': 'Assignment removed',
  'assignment.locations_set': 'Pairing locations changed',
  'location.created': 'Location added',
  'location.updated': 'Location updated',
  'location.removed': 'Location removed',

  'tutor.ssn_confirmed': 'SSN confirmed received',
  'tutor.ssn_cleared': 'SSN receipt withdrawn',
  'comment.added': 'Comment added',
  'comment.deleted': 'Comment deleted',
  'session.drafted': 'Draft saved',
  'session.draft_discarded': 'Draft discarded',
  'session.recorded': 'Session recorded',
  'session.auto_stopped': 'Session auto-stopped',
  'session.updated': 'Session updated',
  'session.deleted': 'Session deleted',
  'session.assessed': 'Session assessed',
  'session.assessment_withdrawn': 'Session assessment withdrawn',
  'session.reflected': 'Reflection recorded',
  'session.reflection_withdrawn': 'Reflection withdrawn',

  'payment.recorded': 'Payment recorded',
  'payment.updated': 'Payment updated',
  'payment.deleted': 'Payment deleted',

  'schedule.created': 'Session scheduled',
  'schedule.updated': 'Schedule updated',
  'schedule.removed': 'Schedule removed',
  'schedule.occurrence_cancelled': 'Lesson cancelled',
  'schedule.occurrence_restored': 'Cancelled lesson restored',

  'assessment.recorded': 'Assessment recorded',
  'assessment.updated': 'Assessment updated',
  'assessment.deleted': 'Assessment deleted',

  'plan.created': 'Learning plan created',
  'plan.updated': 'Learning plan updated',
  'plan.deleted': 'Learning plan deleted',

  'curriculum.offering_updated': 'Curricula offered changed',

  'membership.invited': 'Invited to the organization',
  'membership.accepted': 'Invitation accepted',
  'membership.declined': 'Invitation declined',
  'membership.default_set': 'Default organization chosen',
  'membership.default_cleared': 'Default organization cleared',

  'organization.created': 'Organization created',
  'organization.updated': 'Organization updated',
  'organization.archived': 'Organization archived',
  'organization.restored': 'Organization restored',
  'organization.logo_updated': 'Logo updated',
  'organization.settings_updated': 'Organization settings updated',
  'organization.admin_added': 'Admin added by the platform',
  'organization.admin_removed': 'Admin removed by the platform',

  'platform_admin.added': 'Platform admin added',
  'person.updated_by_platform': 'Shared details updated by the platform',
  'person.sign_in_unpinned': 'Google sign-in unpinned',

  'ai.task_updated': 'AI task settings changed',
  'question_bank.drafted': 'Questions written',
  'question_bank.checked': 'Questions checked',
  'question_bank.topic_updated': 'Standard marked',
  'question.updated': 'Question edited',
  'question.approved': 'Question approved',
  'question.retired': 'Question retired',
  'question.restored': 'Question restored',
};

export interface AuditEvent {
  id: string;
  /** Null once that user has been purged; `actor_name` still says who it was. */
  actor_user_id: string | null;
  actor_name: string;
  subject_user_id: string | null;
  subject_name: string | null;
  action: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export const listAuditQuerySchema = z.object({
  /**
   * Activity involving one person, as either the actor or the subject. That
   * pairing is what makes a profile's activity feed complete: an admin editing
   * your record is your activity too.
   */
  user_id: z.uuid().optional(),
  /** Narrow to what one person did, ignoring what was done to them. */
  actor_user_id: z.uuid().optional(),
  action: z.string().trim().max(64).optional(),
  /** Entity prefix, e.g. "user" matches user.created and user.updated. */
  entity: z.string().trim().max(32).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-20.')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-20.')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAuditParams = z.output<typeof listAuditQuerySchema>;

/** "2 minutes ago" / "3 days ago", for a log that is read newest-first. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((now.getTime() - then) / 1000);

  if (seconds < 45) return 'just now';

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(-Math.round(seconds / size), unit);
    }
  }

  return formatter.format(-seconds, 'second');
}
