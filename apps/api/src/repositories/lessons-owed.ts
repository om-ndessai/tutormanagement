import {
  UNRECORDED_LOOKBACK_DAYS,
  addDays,
  cancellationKey,
  isOccurrenceOf,
  parseClockTime,
  upcomingTakenKey,
  zonedClockParts,
  type LessonOwed,
  type ScheduledSession,
  type User,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { isAdmin } from '../lib/scope.js';
import { placeFor, tutorSchedules } from './home.js';
import { listCancellationsForSchedules } from './schedule-cancellations.js';
import { listSchedules } from './schedules.js';
import { myDraftsByLesson } from './session-drafts.js';

// The lessons still owed a record (Phase 66's "to record", H9; Phase 75's list, JF30): the occurrences of
// the schedules that ended within the lookback and were never recorded, cancelled or left running. One
// rule for the member home's tutor and office parts and for `GET /api/sessions/to-record`, so the home's
// count and the list it leads to cannot disagree. Nothing here carries money.

/** "HH:MM" for minutes since midnight (wrapping past midnight). */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Whole days from `a` to `b` (calendar dates). */
export function daysBetween(a: string, b: string): number {
  const at = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((at(b) - at(a)) / 86_400_000);
}

export interface Occurrence {
  schedule: ScheduledSession;
  date: string;
  /** Minutes since it ended (negative before then). */
  endedAgo: number;
}

/** Every occurrence of the schedules from `from` to `to` (inclusive), with how long ago each ended. */
export function occurrences(schedules: ScheduledSession[], from: string, to: string, today: string, now: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const schedule of schedules) {
    if (!schedule.is_active) continue;
    const start = parseClockTime(schedule.start_time);
    if (start === null) continue;
    for (let date = from; date <= to; date = addDays(date, 1)) {
      if (!isOccurrenceOf(schedule, date)) continue;
      const end = start + schedule.duration_minutes;
      out.push({ schedule, date, endedAgo: daysBetween(date, today) * 1440 + now - end });
    }
  }
  return out;
}

/**
 * Lessons that ended within the lookback and were never recorded, cancelled or left running: the
 * "to record" flag (H9), most recently ended first. `taken` and `live` decide by the caller's keys.
 */
export function unrecordedOf(
  list: Occurrence[],
  taken: (o: Occurrence) => boolean,
  cancelled: ReadonlySet<string>,
  live: (o: Occurrence) => boolean,
): Occurrence[] {
  return list
    .filter((o) => o.endedAgo >= 0 && o.endedAgo <= UNRECORDED_LOOKBACK_DAYS * 1440)
    .filter((o) => !taken(o) && !cancelled.has(cancellationKey(o.schedule.id, o.date)) && !live(o))
    .sort((a, b) => a.endedAgo - b.endedAgo);
}

/**
 * `GET /api/sessions/to-record` (Phase 75, JF30, R34): a tutor's own lessons owed -- an admin's, every
 * tutor's here -- as full rows, newest first, each with the READER's own draft of it (R10). Someone who
 * teaches nobody and is not an admin gets an empty list.
 */
export async function listLessonsOwed(
  db: D1Database,
  org: { id: OrgId; time_zone: string },
  viewer: User,
  nowIso = new Date().toISOString(),
): Promise<LessonOwed[]> {
  const { day: today, minutesOfDay: now } = zonedClockParts(nowIso, org.time_zone);
  const from = addDays(today, -UNRECORDED_LOOKBACK_DAYS);
  const office = isAdmin(viewer);

  // An admin: every active schedule here (listSchedules' admin scope); a tutor: their own as the tutor.
  const schedules = office
    ? await listSchedules(db, org.id, viewer, { include_inactive: false })
    : await tutorSchedules(db, org.id, viewer);
  if (schedules.length === 0) return [];

  const [recorded, running, cancellations, drafts] = await Promise.all([
    office
      ? db
          .prepare('SELECT tutor_user_id, student_user_id, occurred_on FROM sessions WHERE organization_id = ? AND occurred_on >= ?')
          .bind(org.id, from)
          .all<{ tutor_user_id: string; student_user_id: string; occurred_on: string }>()
      : db
          .prepare(
            'SELECT tutor_user_id, student_user_id, occurred_on FROM sessions WHERE organization_id = ? AND tutor_user_id = ? AND occurred_on >= ?',
          )
          .bind(org.id, viewer.id, from)
          .all<{ tutor_user_id: string; student_user_id: string; occurred_on: string }>(),
    db
      .prepare('SELECT tutor_user_id, student_user_id FROM active_sessions WHERE organization_id = ?')
      .bind(org.id)
      .all<{ tutor_user_id: string; student_user_id: string }>(),
    listCancellationsForSchedules(db, org.id, schedules.map((s) => s.id), { from }),
    myDraftsByLesson(db, org.id, viewer.id, from),
  ]);

  const taken = new Set((recorded.results ?? []).map((r) => upcomingTakenKey(r.tutor_user_id, r.student_user_id, r.occurred_on)));
  const live = new Set((running.results ?? []).map((r) => `${r.tutor_user_id}|${r.student_user_id}`));
  const cancelled = new Set(cancellations.map((c) => cancellationKey(c.schedule_id, c.occurs_on)));

  const owed = unrecordedOf(
    occurrences(schedules, from, today, today, now),
    (o) => taken.has(upcomingTakenKey(o.schedule.tutor_user_id, o.schedule.student_user_id, o.date)),
    cancelled,
    (o) => o.date === today && live.has(`${o.schedule.tutor_user_id}|${o.schedule.student_user_id}`),
  );

  return owed.map(({ schedule, date }): LessonOwed => {
    const start = parseClockTime(schedule.start_time) ?? 0;
    const place = placeFor(schedule.locations ?? [], schedule.mode);
    return {
      schedule_id: schedule.id,
      occurs_on: date,
      start_time: clock(start),
      end_time: clock(start + schedule.duration_minutes),
      mode: schedule.mode,
      tutor_user_id: schedule.tutor_user_id,
      tutor_name: schedule.tutor_name,
      student_user_id: schedule.student_user_id,
      student_name: schedule.student_name,
      place: place ? { name: place.name, kind: place.kind } : null,
      draft: drafts.get(upcomingTakenKey(schedule.tutor_user_id, schedule.student_user_id, date)) ?? null,
    };
  });
}
