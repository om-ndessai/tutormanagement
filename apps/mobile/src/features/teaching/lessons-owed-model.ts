// Phase 75 (docs/journey-fixes-plan.md JF19, JF30; owner 2026-11-05): one way to record a lesson the schedule
// knows about, from every door -- Home's To record, Next up, the Sessions page's To record and the lessons-owed
// list. A lesson with the reader's own draft opens that draft ("Draft saved 12:43 PM · Continue"), never a second
// one; one without opens "Record a lesson" filled in from the schedule ("It ran as planned" / "Write up the
// lesson"). No money in any of it: these doors are on Tutoring surfaces.
import {
  formatDay,
  formatInstant,
  formatInstantTime,
  instantDay,
  type LessonDraftRef,
  type LessonOwed,
  type SessionDraft,
  type SessionMode,
} from '@tmi/shared';
import type { Href } from 'expo-router';

import { formatSessionTimes } from './session-format';

/** A lesson the schedule knows about, as each door has it (a `LessonOwed`, a home lesson to record). */
export interface KnownLesson {
  student_user_id: string;
  /** The lesson's tutor, when the door knows it (an admin's rows; a tutor's own are theirs). */
  tutor_user_id?: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  place?: { name: string } | null;
  draft?: LessonDraftRef | null;
  /** Phase 43: the homework set last time, for Homework review's first line. */
  homework?: string;
}

/**
 * "Draft saved 12:43 PM" -- when the reader's draft of this lesson was last kept, on the space's clock -- with the
 * day in front when it was not today ("Draft saved Tue, Nov 3, 12:43 PM").
 */
export function draftSavedLine(draft: Pick<LessonDraftRef, 'updated_at'>, timeZone: string, today: string): string {
  if (instantDay(draft.updated_at, timeZone) === today) return `Draft saved ${formatInstantTime(draft.updated_at, timeZone)}`;
  return `Draft saved ${formatInstant(draft.updated_at, timeZone, { today, weekday: true })}`;
}

/** Where a known lesson's Record leads: its draft when the reader has one, else the record-as-planned sheet. */
export function knownLessonHref(lesson: KnownLesson): Href {
  if (lesson.draft) return { pathname: '/record-lesson', params: { draft: lesson.draft.id } };
  return { pathname: '/record-as-planned', params: knownLessonParams(lesson) };
}

/** The schedule's lesson as route params: who, the day, the times, the mode, the place's name and the homework. */
export function knownLessonParams(lesson: KnownLesson): Record<string, string> {
  return {
    student: lesson.student_user_id,
    ...(lesson.tutor_user_id ? { tutor: lesson.tutor_user_id } : {}),
    date: lesson.occurs_on,
    start: lesson.start_time,
    end: lesson.end_time,
    mode: lesson.mode,
    ...(lesson.place ? { place: lesson.place.name } : {}),
    ...(lesson.homework ? { homework: lesson.homework } : {}),
  };
}

/** A `LessonOwed` row as a known lesson. */
export function owedAsKnown(row: LessonOwed): KnownLesson {
  return {
    student_user_id: row.student_user_id,
    tutor_user_id: row.tutor_user_id,
    occurs_on: row.occurs_on,
    start_time: row.start_time,
    end_time: row.end_time,
    mode: row.mode,
    place: row.place,
    draft: row.draft,
  };
}

/** "Today, 4:00–5:00 PM · Institute, room 2" (the place by name only, R16), with "with Alex" for the office. */
export function owedLine(row: LessonOwed, today: string, withTutor: boolean): string {
  const day = row.occurs_on === today ? 'Today' : formatDay(row.occurs_on, today, { weekday: true });
  const tutor = withTutor ? ` with ${row.tutor_name}` : '';
  const place = row.place ? ` · ${row.place.name}` : '';
  return `${day}, ${formatSessionTimes(row.start_time, row.end_time)}${tutor}${place}`;
}

/** Whether a door's rows name the tutor: an admin's list holds every tutor's lessons, a tutor's only their own. */
export function owedShowsTutor(rows: readonly Pick<LessonOwed, 'tutor_user_id'>[], readerId: string | undefined): boolean {
  return rows.some((row) => row.tutor_user_id !== readerId);
}

/**
 * The reader's own draft of a lesson -- the same tutor (when known), student and date; the newest -- as the server
 * matches them (`myDraftsByLesson`), for a door whose data carries no draft (the carousel, Stop).
 */
export function draftForLesson(
  drafts: readonly SessionDraft[],
  lesson: { student: string; tutor?: string; date?: string },
): SessionDraft | null {
  if (!lesson.date) return null;
  const matching = drafts
    .filter(
      (draft) =>
        draft.student_user_id === lesson.student &&
        draft.occurred_on === lesson.date &&
        (!lesson.tutor || draft.tutor_user_id === lesson.tutor),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return matching[0] ?? null;
}

/** "Running 12 min", "Running 1 hr 5 min": a lesson under way, from its start and now (whole minutes). */
export function runningLine(startedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000));
  if (minutes < 60) return `Running ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Running ${hours} hr ${rest} min` : `Running ${hours} hr`;
}
