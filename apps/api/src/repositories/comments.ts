import {
  formatClockTime,
  type Comment,
  type CommentFeedEntry,
  type ListCommentFeedParams,
  type CommentPayload,
  type CommentTarget,
  type CommentTargetType,
  type User,
} from '@tmi/shared';

import { isAdmin, teachingScopeSql, visibleUserIds } from '../lib/scope.js';

/**
 * The column each kind of target lives in.
 *
 * Interpolated into SQL, which is only safe because the key always arrives
 * through the `target_type` Zod enum -- the same exception the sort columns
 * use. The ids themselves are always bound.
 */
const TARGET_COLUMN: Record<CommentTargetType, string> = {
  user: 'target_user_id',
  session: 'target_session_id',
  assignment: 'target_assignment_id',
  scheduled_session: 'target_scheduled_session_id',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * What a comment is attached to, as far as permissions and the audit log are
 * concerned.
 *
 * `label` is how the thing is named in an audit line; the two user ids are the
 * parties a teaching row concerns, and are absent for a person.
 */
export interface CommentTargetRow {
  label: string;
  /** The person a `user` comment is about, for the audience hint. */
  name: string | null;
  tutor_user_id: string | null;
  student_user_id: string | null;
}

export async function loadCommentTarget(
  db: D1Database,
  target: CommentTarget,
): Promise<CommentTargetRow | null> {
  const { target_type, target_id } = target;

  if (target_type === 'user') {
    const row = await db
      .prepare('SELECT full_name FROM users WHERE id = ?')
      .bind(target_id)
      .first<{ full_name: string }>();

    return row
      ? { label: row.full_name, name: row.full_name, tutor_user_id: null, student_user_id: null }
      : null;
  }

  if (target_type === 'session') {
    const row = await db
      .prepare(
        `SELECT s.tutor_user_id, s.student_user_id, s.occurred_on, st.full_name AS student_name
         FROM sessions s JOIN users st ON st.id = s.student_user_id
         WHERE s.id = ?`,
      )
      .bind(target_id)
      .first<{
        tutor_user_id: string;
        student_user_id: string;
        occurred_on: string;
        student_name: string;
      }>();

    return row
      ? {
          label: `the ${row.occurred_on} session with ${row.student_name}`,
          name: null,
          tutor_user_id: row.tutor_user_id,
          student_user_id: row.student_user_id,
        }
      : null;
  }

  if (target_type === 'assignment') {
    const row = await db
      .prepare(
        `SELECT a.tutor_user_id, a.student_user_id,
                t.full_name AS tutor_name, st.full_name AS student_name
         FROM assignments a
         JOIN users t  ON t.id  = a.tutor_user_id
         JOIN users st ON st.id = a.student_user_id
         WHERE a.id = ?`,
      )
      .bind(target_id)
      .first<{
        tutor_user_id: string;
        student_user_id: string;
        tutor_name: string;
        student_name: string;
      }>();

    return row
      ? {
          label: `${row.tutor_name}’s assignment with ${row.student_name}`,
          name: null,
          tutor_user_id: row.tutor_user_id,
          student_user_id: row.student_user_id,
        }
      : null;
  }

  const row = await db
    .prepare(
      `SELECT ss.tutor_user_id, ss.student_user_id, ss.day_of_week, ss.start_time,
              st.full_name AS student_name
       FROM scheduled_sessions ss JOIN users st ON st.id = ss.student_user_id
       WHERE ss.id = ?`,
    )
    .bind(target_id)
    .first<{
      tutor_user_id: string;
      student_user_id: string;
      day_of_week: number;
      start_time: string;
      student_name: string;
    }>();

  return row
    ? {
        label: DAY_LABEL(row.day_of_week, row.start_time, row.student_name),
        name: null,
        tutor_user_id: row.tutor_user_id,
        student_user_id: row.student_user_id,
      }
    : null;
}

/** Whether this viewer is responsible for that person. */
export async function isGuardianOf(
  db: D1Database,
  guardianUserId: string,
  dependentUserId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM guardianships
       WHERE guardian_user_id = ? AND dependent_user_id = ?`,
    )
    .bind(guardianUserId, dependentUserId)
    .first<{ ok: number }>();

  return Boolean(row);
}

/**
 * Whether the viewer may open this thread at all -- which is the same question
 * as whether they may see the thing it hangs off.
 *
 * A teaching row concerns its tutor, its student and that student's parents.
 * A person concerns anyone who can already see them, which is what lets a
 * tutor leave a comment on a student they teach.
 */
export async function canAccessTarget(
  db: D1Database,
  viewer: User,
  target: CommentTarget,
  row: CommentTargetRow,
): Promise<boolean> {
  if (isAdmin(viewer)) return true;

  if (target.target_type === 'user') {
    const visible = await visibleUserIds(db, viewer);
    return visible === null || visible.has(target.target_id);
  }

  if (row.tutor_user_id === viewer.id || row.student_user_id === viewer.id) return true;

  return row.student_user_id ? isGuardianOf(db, viewer.id, row.student_user_id) : false;
}

/**
 * Whether the viewer reads the WHOLE thread or only their own lines.
 *
 * Every party to a lesson, pairing or slot reads all of its comments -- it is
 * a shared record of a shared thing. A comment about a PERSON is narrower:
 * admins, the author, that person, and their parents, and nobody else. That is
 * what keeps a tutor's remark about a family off the other tutors' screens,
 * while still never being written behind that family's back.
 */
async function readsWholeThread(
  db: D1Database,
  viewer: User,
  target: CommentTarget,
): Promise<boolean> {
  if (isAdmin(viewer)) return true;
  if (target.target_type !== 'user') return true;
  if (target.target_id === viewer.id) return true;

  return isGuardianOf(db, viewer.id, target.target_id);
}

/**
 * The person rule as a WHERE fragment: your own lines, lines about you, and
 * lines about someone you are responsible for.
 *
 * The same rule `readsWholeThread` applies row by row. Written once so the
 * thread, the badges and the global feed cannot answer differently -- a
 * divergence there would show somebody a comment they cannot open, or hide
 * one they are entitled to.
 */
function personScopeSql(viewer: User, alias = 'c'): { sql: string; values: unknown[] } {
  return {
    sql:
      `(${alias}.author_user_id = ?` +
      ` OR ${alias}.target_user_id = ?` +
      ` OR EXISTS (SELECT 1 FROM guardianships g` +
      ` WHERE g.dependent_user_id = ${alias}.target_user_id AND g.guardian_user_id = ?))`,
    values: [viewer.id, viewer.id, viewer.id],
  };
}

const DAY_LABEL = (day: number, time: string, student: string) =>
  `the ${DAY_NAMES[day]} ${formatClockTime(time)} slot with ${student}`;

const SELECT_COMMENT = `
  SELECT c.id, c.author_user_id, u.full_name AS author_name, c.body, c.created_at
  FROM comments c
  JOIN users u ON u.id = c.author_user_id
`;

interface CommentRow {
  id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

function toComment(row: CommentRow, target: CommentTarget, viewer: User): Comment {
  return {
    id: row.id,
    author_user_id: row.author_user_id,
    author_name: row.author_name,
    target_type: target.target_type,
    target_id: target.target_id,
    body: row.body,
    created_at: row.created_at,
    // The plan gives the right to withdraw to the author alone, so this is
    // false even for an admin.
    can_delete: row.author_user_id === viewer.id,
  };
}

/** One thread, newest first. */
export async function listComments(
  db: D1Database,
  viewer: User,
  target: CommentTarget,
): Promise<Comment[]> {
  const column = TARGET_COLUMN[target.target_type];
  const whole = await readsWholeThread(db, viewer, target);

  const result = await db
    .prepare(
      `${SELECT_COMMENT}
       WHERE c.deleted_at IS NULL AND c.${column} = ?
             ${whole ? '' : 'AND c.author_user_id = ?'}
       ORDER BY c.created_at DESC, c.id`,
    )
    .bind(...(whole ? [target.target_id] : [target.target_id, viewer.id]))
    .all<CommentRow>();

  return (result.results ?? []).map((row) => toComment(row, target, viewer));
}

export async function createComment(
  db: D1Database,
  authorUserId: string,
  input: CommentPayload,
): Promise<string> {
  const id = crypto.randomUUID();
  const column = TARGET_COLUMN[input.target_type];

  await db
    .prepare(`INSERT INTO comments (id, author_user_id, ${column}, body) VALUES (?, ?, ?, ?)`)
    .bind(id, authorUserId, input.target_id, input.body)
    .run();

  return id;
}

export async function getComment(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT id, author_user_id, body, deleted_at,
              target_user_id, target_session_id, target_assignment_id,
              target_scheduled_session_id
       FROM comments WHERE id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      author_user_id: string;
      body: string;
      deleted_at: string | null;
      target_user_id: string | null;
      target_session_id: string | null;
      target_assignment_id: string | null;
      target_scheduled_session_id: string | null;
    }>();
}

/**
 * Withdraws a comment. Soft, because a thread with a hole in it is harder to
 * read than one without the line, and because "who said what" is worth keeping
 * even after somebody thinks better of it.
 */
export async function softDeleteComment(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE comments SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .run();

  return Boolean(result.meta.changes);
}

/**
 * How many comments hang off each target of one kind, so a list can show that
 * there is something to read without loading every thread.
 *
 * Counts only what the viewer may actually read, or the badge would announce
 * the existence of remarks they cannot open.
 */
export async function countCommentsByTarget(
  db: D1Database,
  viewer: User,
  targetType: CommentTargetType,
): Promise<Record<string, number>> {
  const column = TARGET_COLUMN[targetType];
  const admin = isAdmin(viewer);
  const values: unknown[] = [];
  let sql: string;

  if (targetType === 'user') {
    const person = admin ? null : personScopeSql(viewer);
    if (person) values.push(...person.values);

    sql = `SELECT c.${column} AS target_id, COUNT(*) AS total
           FROM comments c
           WHERE c.deleted_at IS NULL AND c.${column} IS NOT NULL
                 ${person ? `AND ${person.sql}` : ''}
           GROUP BY c.${column}`;
  } else {
    const table =
      targetType === 'session'
        ? 'sessions'
        : targetType === 'assignment'
          ? 'assignments'
          : 'scheduled_sessions';

    const scope = teachingScopeSql(viewer, 't');
    if (scope) values.push(...scope.values);

    sql = `SELECT c.${column} AS target_id, COUNT(*) AS total
           FROM comments c
           JOIN ${table} t ON t.id = c.${column}
           WHERE c.deleted_at IS NULL ${scope ? `AND ${scope.sql}` : ''}
           GROUP BY c.${column}`;
  }

  const result = await db
    .prepare(sql)
    .bind(...values)
    .all<{ target_id: string; total: number }>();

  const counts: Record<string, number> = {};
  for (const row of result.results ?? []) counts[row.target_id] = Number(row.total);
  return counts;
}

/**
 * The global feed: every comment this viewer may read, newest first.
 *
 * One query over all four kinds of target rather than four queries merged in
 * JS, so paging is the database's job and a page is always exactly a page.
 * The joins are LEFT because each row uses one of them and ignores the rest;
 * the WHERE then applies that target's own rule -- the SAME fragments the
 * threads and the badges use.
 */
export async function listCommentFeed(
  db: D1Database,
  viewer: User,
  params: ListCommentFeedParams,
): Promise<{ entries: CommentFeedEntry[]; total: number }> {
  const where: string[] = ['c.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (params.target_type) {
    where.push(`c.${TARGET_COLUMN[params.target_type]} IS NOT NULL`);
  }

  if (!isAdmin(viewer)) {
    const person = personScopeSql(viewer);
    const session = teachingScopeSql(viewer, 's')!;
    const assignment = teachingScopeSql(viewer, 'a')!;
    const scheduled = teachingScopeSql(viewer, 'sch')!;

    where.push(
      `((c.target_user_id IS NOT NULL AND ${person.sql})` +
        ` OR (c.target_session_id IS NOT NULL AND ${session.sql})` +
        ` OR (c.target_assignment_id IS NOT NULL AND ${assignment.sql})` +
        ` OR (c.target_scheduled_session_id IS NOT NULL AND ${scheduled.sql}))`,
    );

    values.push(
      ...person.values,
      ...session.values,
      ...assignment.values,
      ...scheduled.values,
    );
  }

  const from = `
    FROM comments c
    JOIN users au ON au.id = c.author_user_id
    LEFT JOIN users tu ON tu.id = c.target_user_id
    LEFT JOIN sessions s ON s.id = c.target_session_id
    LEFT JOIN users s_student ON s_student.id = s.student_user_id
    LEFT JOIN assignments a ON a.id = c.target_assignment_id
    LEFT JOIN users a_student ON a_student.id = a.student_user_id
    LEFT JOIN users a_tutor ON a_tutor.id = a.tutor_user_id
    LEFT JOIN scheduled_sessions sch ON sch.id = c.target_scheduled_session_id
    LEFT JOIN users sch_student ON sch_student.id = sch.student_user_id
    WHERE ${where.join(' AND ')}
  `;

  const [totalResult, pageResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total ${from}`).bind(...values),
    db
      .prepare(
        `SELECT c.id, c.author_user_id, au.full_name AS author_name, c.body, c.created_at,
                c.target_user_id, c.target_session_id, c.target_assignment_id,
                c.target_scheduled_session_id,
                tu.full_name AS target_user_name,
                s.occurred_on AS session_date, s_student.full_name AS session_student,
                a_tutor.full_name AS assignment_tutor, a_student.full_name AS assignment_student,
                sch.day_of_week AS scheduled_day, sch.start_time AS scheduled_time,
                sch_student.full_name AS scheduled_student
         ${from}
         ORDER BY c.created_at DESC, c.id
         LIMIT ? OFFSET ?`,
      )
      .bind(...values, params.limit, params.offset),
  ]);

  const total = Number((totalResult?.results?.[0] as { total?: number })?.total ?? 0);
  const rows = (pageResult?.results ?? []) as Record<string, unknown>[];

  const entries = rows.map((row): CommentFeedEntry => {
    const base = {
      id: String(row.id),
      author_user_id: String(row.author_user_id),
      author_name: String(row.author_name),
      body: String(row.body),
      created_at: String(row.created_at),
      can_delete: String(row.author_user_id) === viewer.id,
    };

    // Named exactly as loadCommentTarget names it, so a comment reads the
    // same in the feed as in the audit line it produced.
    if (row.target_user_id) {
      return {
        ...base,
        target_type: 'user',
        target_id: String(row.target_user_id),
        target_label: String(row.target_user_name),
      };
    }

    if (row.target_session_id) {
      return {
        ...base,
        target_type: 'session',
        target_id: String(row.target_session_id),
        target_label: `the ${row.session_date} session with ${row.session_student}`,
      };
    }

    if (row.target_assignment_id) {
      return {
        ...base,
        target_type: 'assignment',
        target_id: String(row.target_assignment_id),
        target_label: `${row.assignment_tutor}’s assignment with ${row.assignment_student}`,
      };
    }

    return {
      ...base,
      target_type: 'scheduled_session',
      target_id: String(row.target_scheduled_session_id),
      target_label: DAY_LABEL(
        Number(row.scheduled_day),
        String(row.scheduled_time),
        String(row.scheduled_student),
      ),
    };
  });

  return { entries, total };
}
