import type { NotificationKind, NotificationLogEntry, NotificationStatus } from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

/** Somebody an email may go to: a live member of the organization, with an address. */
export interface Recipient {
  id: string;
  full_name: string;
  email: string;
}

/** Who an event concerns, before anybody is filtered out. */
export interface Audience {
  /** The person the event is about: the one added, or the student. */
  subjectId: string | null;
  /** The lesson's or the schedule's own tutor, when there is one. */
  tutorId?: string | null;
  /** The subject's guardians here (a student's parents). */
  guardians?: boolean;
  /** Every tutor the student is actively paired with here (plans, assessments). */
  pairedTutors?: boolean;
  /** The organization's admins (a person added). */
  admins?: boolean;
  /**
   * Whether the subject may be emailed while their membership is still
   * `invited`: true only for "you have been added", which is how they hear of
   * it. Everybody else must be an active member.
   */
  subjectMayBeInvited?: boolean;
}

/**
 * Everybody an event concerns, as live members of THIS organization with an
 * email, in one query. The candidates come from the same tables the portal's
 * own scoping uses -- guardianships, pairings, roles -- each narrowed to the
 * organization, and the join to org_members drops anybody removed, suspended or
 * not yet a member.
 */
export async function recipientsFor(
  db: D1Database,
  org: OrgId,
  audience: Audience,
): Promise<Recipient[]> {
  const subject = audience.subjectId ?? '';
  const result = await db
    .prepare(
      `WITH candidates (user_id) AS (
         SELECT ?1 WHERE ?1 <> ''
         UNION SELECT ?2 WHERE ?2 <> ''
         UNION SELECT g.guardian_user_id FROM guardianships g
                WHERE ?3 = 1 AND g.organization_id = ?6 AND g.dependent_user_id = ?1
         UNION SELECT a.tutor_user_id FROM assignments a
                WHERE ?4 = 1 AND a.organization_id = ?6 AND a.student_user_id = ?1 AND a.is_active = 1
         UNION SELECT r.user_id FROM user_roles r
                WHERE ?5 = 1 AND r.organization_id = ?6 AND r.role = 'admin'
       )
       SELECT u.id, u.full_name, u.email
       FROM candidates c
       JOIN users u ON u.id = c.user_id
       JOIN org_members m ON m.organization_id = ?6 AND m.user_id = u.id
       WHERE u.deleted_at IS NULL
         AND u.email IS NOT NULL
         AND m.removed_at IS NULL
         AND (m.status = 'active' OR (?7 = 1 AND u.id = ?1 AND m.status = 'invited'))
       ORDER BY u.full_name COLLATE NOCASE`,
    )
    .bind(
      subject,
      audience.tutorId ?? '',
      audience.guardians ? 1 : 0,
      audience.pairedTutors ? 1 : 0,
      audience.admins ? 1 : 0,
      org,
      audience.subjectMayBeInvited ? 1 : 0,
    )
    .all<Recipient>();
  return result.results ?? [];
}

/** One attempt, written after it was made. */
export interface LogRow {
  kind: NotificationKind;
  subjectId: string | null;
  recipientId: string;
  status: NotificationStatus;
  detail: string | null;
}

export async function logNotifications(db: D1Database, org: OrgId, rows: LogRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.batch(
    rows.map((row) =>
      db
        .prepare(
          `INSERT INTO notification_log
             (id, organization_id, kind, subject_user_id, recipient_user_id, status, detail)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), org, row.kind, row.subjectId, row.recipientId, row.status, row.detail),
    ),
  );
}

/** The organization's most recent attempts, newest first: for its admins. */
export async function listNotifications(
  db: D1Database,
  org: OrgId,
  limit = 50,
): Promise<NotificationLogEntry[]> {
  const result = await db
    .prepare(
      `SELECT n.id, n.kind, n.subject_user_id, s.full_name AS subject_name,
              n.recipient_user_id, r.full_name AS recipient_name,
              n.status, n.detail, n.created_at
       FROM notification_log n
       JOIN users r ON r.id = n.recipient_user_id
       LEFT JOIN users s ON s.id = n.subject_user_id
       WHERE n.organization_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`,
    )
    .bind(org, limit)
    .all<NotificationLogEntry>();
  return result.results ?? [];
}
