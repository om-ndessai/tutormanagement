import {
  addDays,
  isOccurrenceOf,
  parseClockTime,
  partOfDay,
  zonedClockParts,
  expandUpcoming,
  type Location,
  type ScheduledSession,
  type TutorHome,
  type TutorHomeBrief,
  type TutorHomeLesson,
  type User,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { listCancellationsForSchedules } from './schedule-cancellations.js';
import { listSchedules } from './schedules.js';
import { getVisibleSession } from './sessions.js';
import { buildStudentProgress, progressReader } from './progress.js';

// The tutor's Home (Phase 43, docs/tutor-home-plan.md). Every read names the
// organization and keeps to the viewer's OWN pairings (tutor_user_id = them),
// as the dashboard's carousel does: an admin who tutors sees their own lessons
// here, not everyone's. Nothing returned carries money.

/** How far back a finished lesson still asks to be recorded on Home. */
const UNRECORDED_WINDOW_MINUTES = 24 * 60;

function placeFor(locations: Location[], mode: ScheduledSession['mode']): Location | null {
  const kind = mode === 'virtual' ? 'virtual' : 'physical';
  return locations.find((l) => l.kind === kind) ?? locations[0] ?? null;
}

function lessonOf(schedule: ScheduledSession, date: string, together: Map<string, { n: number; since: string | null }>): TutorHomeLesson {
  const start = parseClockTime(schedule.start_time) ?? 0;
  const end = start + schedule.duration_minutes;
  const pad = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const pair = together.get(schedule.student_user_id);
  return {
    schedule_id: schedule.id,
    occurs_on: date,
    start_time: pad(start),
    end_time: pad(end),
    mode: schedule.mode,
    student_user_id: schedule.student_user_id,
    student_name: schedule.student_name,
    place: placeFor(schedule.locations, schedule.mode),
    lessons_together: pair?.n ?? 0,
    together_since: pair?.since ?? null,
  };
}

export async function buildTutorHome(
  db: D1Database,
  org: { id: OrgId; time_zone: string },
  viewer: User,
  nowIso = new Date().toISOString(),
): Promise<TutorHome> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const yesterday = addDays(today, -1);

  const schedules = (await listSchedules(db, org.id, viewer, { include_inactive: false, tutor_user_id: viewer.id })).filter(
    (s) => s.tutor_user_id === viewer.id,
  );

  const [recorded, together, running, cancellations] = await Promise.all([
    db
      .prepare(
        `SELECT student_user_id, occurred_on FROM sessions
         WHERE organization_id = ? AND tutor_user_id = ? AND occurred_on >= ?`,
      )
      .bind(org.id, viewer.id, yesterday)
      .all<{ student_user_id: string; occurred_on: string }>(),
    db
      .prepare(
        `SELECT student_user_id, COUNT(*) AS n, MIN(occurred_on) AS since FROM sessions
         WHERE organization_id = ? AND tutor_user_id = ?
         GROUP BY student_user_id`,
      )
      .bind(org.id, viewer.id)
      .all<{ student_user_id: string; n: number; since: string | null }>(),
    db
      .prepare('SELECT student_user_id FROM active_sessions WHERE organization_id = ? AND tutor_user_id = ?')
      .bind(org.id, viewer.id)
      .all<{ student_user_id: string }>(),
    listCancellationsForSchedules(db, org.id, schedules.map((s) => s.id), { from: yesterday }),
  ]);

  const taken = new Set((recorded.results ?? []).map((r) => `${r.student_user_id}|${r.occurred_on}`));
  const pairs = new Map((together.results ?? []).map((r) => [r.student_user_id, { n: r.n, since: r.since }]));
  const live = new Set((running.results ?? []).map((r) => r.student_user_id));
  const cancelled = new Set(cancellations.map((c) => `${c.schedule_id}|${c.occurs_on}`));

  // Finished within the last day, on the organization's clock, and not recorded, cancelled or running.
  const unrecorded: (TutorHomeLesson & { homework_last: string | null; ended: number })[] = [];
  for (const schedule of schedules) {
    const start = parseClockTime(schedule.start_time);
    if (start === null) continue;
    const end = start + schedule.duration_minutes;
    for (const [date, offset] of [
      [yesterday, -24 * 60],
      [today, 0],
    ] as const) {
      if (!isOccurrenceOf(schedule, date)) continue;
      const endedAgo = now - (offset + end);
      if (endedAgo < 0 || endedAgo > UNRECORDED_WINDOW_MINUTES) continue;
      if (taken.has(`${schedule.student_user_id}|${date}`) || cancelled.has(`${schedule.id}|${date}`)) continue;
      if (live.has(schedule.student_user_id)) continue;
      unrecorded.push({ ...lessonOf(schedule, date, pairs), homework_last: null, ended: endedAgo });
    }
  }
  unrecorded.sort((a, b) => a.ended - b.ended);

  // The next lesson: the soonest date the schedules produce that is not cancelled (expandUpcoming
  // keeps a lesson until it ends, so one under way is "next").
  const taken3 = new Set((recorded.results ?? []).map((r) => `${viewer.id}|${r.student_user_id}|${r.occurred_on}`));
  const upcoming = expandUpcoming(schedules, nowIso, { offset: 0, limit: 10, taken: taken3, timeZone: org.time_zone }).items;
  const nextItem = upcoming.find((u) => !cancelled.has(`${u.schedule_id}|${u.occurs_on}`)) ?? null;
  const nextSchedule = nextItem ? schedules.find((s) => s.id === nextItem.schedule_id) ?? null : null;
  const next = nextItem && nextSchedule ? lessonOf(nextSchedule, nextItem.occurs_on, pairs) : null;

  // The homework set at each pairing's last lesson, for the record sheet's "Homework review".
  for (const lesson of unrecorded) {
    const last = await lastLesson(db, org.id, viewer, lesson.student_user_id);
    lesson.homework_last = last?.write_up?.homework_assigned ?? null;
  }

  return {
    part_of_day: partOfDay(now),
    unrecorded: unrecorded.map(({ ended: _ended, ...rest }) => rest),
    next,
    brief: next ? await briefFor(db, org, viewer, next.student_user_id) : null,
  };
}

/** The pairing's last recorded lesson, as the viewer may see it (write-up and assessments included). */
async function lastLesson(db: D1Database, org: OrgId, viewer: User, studentId: string) {
  const row = await db
    .prepare(
      `SELECT id FROM sessions
       WHERE organization_id = ? AND tutor_user_id = ? AND student_user_id = ?
       ORDER BY occurred_on DESC, started_at DESC
       LIMIT 1`,
    )
    .bind(org, viewer.id, studentId)
    .first<{ id: string }>();
  return row ? getVisibleSession(db, org, viewer, row.id) : null;
}

async function briefFor(
  db: D1Database,
  org: { id: OrgId; time_zone: string },
  viewer: User,
  studentId: string,
): Promise<TutorHomeBrief> {
  const [last, progress] = await Promise.all([
    lastLesson(db, org.id, viewer, studentId),
    progressReader(db, org, viewer).then((reader) => buildStudentProgress(db, studentId, reader)),
  ]);

  let nextTopic: TutorHomeBrief['next_topic'] = null;
  const plan = progress?.plan ?? null;
  if (plan) {
    const byId = new Map((progress?.topics ?? []).map((t) => [t.topic_id, t]));
    const topicId = plan.topic_ids.find((id) => !byId.get(id)?.mastered);
    if (topicId) {
      const topic = await db
        .prepare(
          // The organization's own list: a topic of a curriculum it does not offer is not shown.
          `SELECT t.id, COALESCE(t.code, t.id) AS code, t.name, t.description
           FROM curriculum_topics t
           JOIN curriculum_levels l ON l.id = t.level_id
           JOIN organization_curricula oc ON oc.curriculum_id = l.curriculum_id AND oc.organization_id = ?
           WHERE t.id = ?`,
        )
        .bind(org.id, topicId)
        .first<{ id: string; code: string; name: string; description: string | null }>();
      if (topic) {
        nextTopic = {
          topic_id: topic.id,
          code: topic.code,
          name: topic.name,
          description: topic.description,
          current: byId.get(topic.id)?.current ?? null,
          plan_target_on: plan.target_on,
        };
      }
    }
  }

  return {
    last_lesson: last ? { session_id: last.id, occurred_on: last.occurred_on } : null,
    homework: last?.write_up
      ? { assigned: last.write_up.homework_assigned, status_before: last.write_up.homework_status }
      : null,
    next_topic: nextTopic,
    assessments: last?.assessments ?? [],
  };
}
