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

  'user.created',
  'user.updated',
  'user.roles_changed',
  'user.deactivated',
  'user.restored',
  'user.deleted',

  'assignment.created',
  'assignment.updated',
  'assignment.removed',

  'session.recorded',
  'session.updated',
  'session.deleted',

  'payment.recorded',
  'payment.updated',
  'payment.deleted',

  'schedule.created',
  'schedule.updated',
  'schedule.removed',
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

  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.roles_changed': 'Roles changed',
  'user.deactivated': 'User deactivated',
  'user.restored': 'User restored',
  'user.deleted': 'User deleted',

  'assignment.created': 'Student assigned',
  'assignment.updated': 'Assignment updated',
  'assignment.removed': 'Assignment removed',

  'session.recorded': 'Session recorded',
  'session.updated': 'Session updated',
  'session.deleted': 'Session deleted',

  'payment.recorded': 'Payment recorded',
  'payment.updated': 'Payment updated',
  'payment.deleted': 'Payment deleted',

  'schedule.created': 'Session scheduled',
  'schedule.updated': 'Schedule updated',
  'schedule.removed': 'Schedule removed',
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
