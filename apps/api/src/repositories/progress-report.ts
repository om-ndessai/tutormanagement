// Phase 58: what the progress report reads beyond the progress page itself
// (docs/progress-report-plan.md). Every query names the organization, and the
// lessons are read through the sessions list's own WHERE for this reader.
//
// No money: the SELECT below names no `*_cents` column, and nothing here
// imports a money scope. The report has no use for a price, so it never holds one.

import type { HomeworkStatus, User } from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { teachingScopeSql } from '../lib/scope.js';

/** The most lessons one report lists; the counts and hours still cover the whole range. */
export const REPORT_SESSION_LIMIT = 500;

/** One lesson as the report prints it: times, tutor, place and its whole write-up. */
export interface ReportSession {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  occurred_on: string;
  /** Wall-clock HH:MM, as stored. */
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  mode: 'in_person' | 'virtual';
  /** "What was covered". */
  notes: string | null;
  planned: string | null;
  previous_review: string | null;
  homework_review: string | null;
  homework_status: HomeworkStatus | null;
  homework_assigned: string | null;
  /** The pairing's one location of this lesson's kind, by name -- never its address or link. */
  location_name: string | null;
}

export interface ReportSessions {
  sessions: ReportSession[];
  /** Every lesson in the range this reader may list, even past REPORT_SESSION_LIMIT. */
  count: number;
  total_minutes: number;
}

/**
 * The student's lessons from `from` to `to` inclusive, newest first, as this
 * reader's sessions page would list them (`teachingScopeSql`: a tutor sees only
 * the lessons they taught). Authorise the student first.
 */
export async function listReportSessions(
  db: D1Database,
  org: OrgId,
  viewer: User,
  studentId: string,
  from: string,
  to: string,
): Promise<ReportSessions> {
  const scope = teachingScopeSql(viewer, 's', org);
  // The sessions list's own scope (filter.sql carries the organization).
  const filter = {
    sql: `WHERE s.student_user_id = ? AND s.occurred_on >= ? AND s.occurred_on <= ? AND ${scope.sql}`,
    values: [studentId, from, to, ...scope.values],
  };

  const [totals, rows, places] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(s.duration_minutes), 0) AS total_minutes
         FROM sessions s ${filter.sql}`,
      )
      .bind(...filter.values),
    db
      .prepare(
        `SELECT s.id, s.tutor_user_id, t.full_name AS tutor_name, s.occurred_on, s.started_at,
                s.ended_at, s.duration_minutes, s.mode, s.notes,
                w.planned, w.previous_review, w.homework_review, w.homework_status,
                w.homework_assigned
         FROM sessions s
         JOIN users t ON t.id = s.tutor_user_id
         LEFT JOIN session_write_ups w ON w.session_id = s.id
         ${filter.sql}
         ORDER BY s.occurred_on DESC, s.started_at DESC, s.id
         LIMIT ?`,
      )
      .bind(...filter.values, REPORT_SESSION_LIMIT),
    // The places the student's schedules name, per tutor and kind. Names only.
    db
      .prepare(
        `SELECT DISTINCT ss.tutor_user_id, sl.kind, l.id AS location_id, l.name
         FROM scheduled_sessions ss
         JOIN schedule_locations sl ON sl.schedule_id = ss.id AND sl.organization_id = ss.organization_id
         JOIN locations l ON l.id = sl.location_id AND l.organization_id = sl.organization_id
         WHERE ss.organization_id = ? AND ss.student_user_id = ?`,
      )
      .bind(org, studentId),
  ]);

  // A pairing whose schedules name exactly one place of a kind: that place.
  // Two or more (or none) is ambiguous, and the lesson shows its mode alone.
  const named = new Map<string, Map<string, string>>();
  for (const row of (places?.results ?? []) as { tutor_user_id: string; kind: string; location_id: string; name: string }[]) {
    const key = `${row.tutor_user_id}:${row.kind}`;
    const byId = named.get(key) ?? new Map<string, string>();
    byId.set(row.location_id, row.name);
    named.set(key, byId);
  }
  const placeFor = (tutorId: string, mode: string): string | null => {
    const byId = named.get(`${tutorId}:${mode === 'in_person' ? 'physical' : 'virtual'}`);
    return byId && byId.size === 1 ? [...byId.values()][0]! : null;
  };

  const sessions = ((rows?.results ?? []) as unknown as Omit<ReportSession, 'location_name'>[]).map((row) => ({
    ...row,
    duration_minutes: Number(row.duration_minutes),
    location_name: placeFor(row.tutor_user_id, row.mode),
  }));
  const total = (totals?.results?.[0] ?? {}) as { count?: number; total_minutes?: number };

  return { sessions, count: Number(total.count ?? 0), total_minutes: Number(total.total_minutes ?? 0) };
}

/** A topic or level as the report names it: its code and name, from this organization's curricula. */
export interface CatalogLabel {
  id: string;
  code: string;
  name: string;
  /** For a topic, its level's code; for a level, null. */
  level_code: string | null;
}

/**
 * Labels for the few levels and topics a report names, read through this
 * organization's own list (retired curricula included: old plans keep their
 * names). One JSON parameter per kind, as D1 caps bound parameters.
 */
export async function catalogLabels(
  db: D1Database,
  org: OrgId,
  levelIds: readonly string[],
  topicIds: readonly string[],
): Promise<Map<string, CatalogLabel>> {
  const labels = new Map<string, CatalogLabel>();
  if (levelIds.length === 0 && topicIds.length === 0) return labels;

  const [levels, topics] = await db.batch<CatalogLabel>([
    db
      .prepare(
        `SELECT l.id, COALESCE(l.code, l.id) AS code, l.name, NULL AS level_code
         FROM curriculum_levels l
         JOIN organization_curricula oc ON oc.curriculum_id = l.curriculum_id
                                       AND oc.organization_id = ?
         JOIN curricula c ON c.id = oc.curriculum_id
                         AND (c.organization_id IS NULL OR c.organization_id = oc.organization_id)
         WHERE l.id IN (SELECT value FROM json_each(?))`,
      )
      .bind(org, JSON.stringify(levelIds)),
    db
      .prepare(
        `SELECT t.id, COALESCE(t.code, t.id) AS code, t.name, COALESCE(l.code, l.id) AS level_code
         FROM curriculum_topics t
         JOIN curriculum_levels l ON l.id = t.level_id
         JOIN organization_curricula oc ON oc.curriculum_id = l.curriculum_id
                                       AND oc.organization_id = ?
         JOIN curricula c ON c.id = oc.curriculum_id
                         AND (c.organization_id IS NULL OR c.organization_id = oc.organization_id)
         WHERE t.id IN (SELECT value FROM json_each(?))`,
      )
      .bind(org, JSON.stringify(topicIds)),
  ]);

  for (const row of [...(levels?.results ?? []), ...(topics?.results ?? [])]) labels.set(row.id, row);
  return labels;
}
