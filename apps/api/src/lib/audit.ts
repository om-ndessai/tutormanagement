import type { AuditAction, User } from '@tmi/shared';

export interface AuditInput {
  action: AuditAction;
  /** The brief line shown in the activity feed. Written by the caller, which
   *  is the only place that knows what the action meant. */
  description: string;
  /** Who or what was acted upon, when that is not the actor themselves. */
  subject?: Pick<User, 'id' | 'full_name'> | null;
  entity_type?: string | null;
  entity_id?: string | null;
}

/**
 * Appends one row to the activity log.
 *
 * Deliberately swallows its own errors: a failure to write history must never
 * turn a successful action into a failed request. The failure is logged so it
 * shows up in `wrangler tail` rather than vanishing.
 *
 * Deliberately awaited rather than fired into `waitUntil`: the log is read
 * immediately after the action in both the UI and the end-to-end tests, and a
 * background write would make that a race.
 */
export async function recordAudit(
  db: D1Database,
  actor: Pick<User, 'id' | 'full_name'> | null,
  input: AuditInput,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_events
           (id, actor_user_id, actor_name, subject_user_id, subject_name,
            action, description, entity_type, entity_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor?.id ?? null,
        // Names are snapshots so the log stays readable after a purge.
        actor?.full_name ?? 'System',
        input.subject?.id ?? null,
        input.subject?.full_name ?? null,
        input.action,
        input.description,
        input.entity_type ?? null,
        input.entity_id ?? null,
      )
      .run();
  } catch (error) {
    console.error('Failed to write audit event', input.action, error);
  }
}

/** Summarises a patch as "phone, roles and status", for the log line. */
export function describeChangedFields(fields: Record<string, unknown>): string {
  const names = Object.keys(fields).map((key) => key.replace(/_/g, ' '));

  if (names.length === 0) return 'no fields';
  if (names.length === 1) return names[0]!;

  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
