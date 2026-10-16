// Home's top (UI upgrades U6), as pure functions so the words are tested without a device: the
// greeting by the organization's clock, the Today line, a child's month in words, the topics worth a
// celebration, and the draft a tutor left today. Nothing here carries money.
import {
  addDays,
  formatMinutesOfDay,
  parseClockTime,
  type SessionDraft,
  type StudentProgress,
  type UpcomingSession,
} from '@tmi/shared';

import { countOf } from '@/lib/plural';

// ---------------------------------------------------------------------------
// The greeting
// ---------------------------------------------------------------------------

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

/** Morning from 5:00, afternoon from noon, evening from 5:00 PM and through the night. */
export const MORNING_FROM = 5 * 60;
export const AFTERNOON_FROM = 12 * 60;
export const EVENING_FROM = 17 * 60;

/** The part of the day at `minutesOfDay` on the organization's clock (0-1439). */
export function partOfDay(minutesOfDay: number): PartOfDay {
  const minutes = ((Math.floor(minutesOfDay) % 1440) + 1440) % 1440;
  if (minutes >= MORNING_FROM && minutes < AFTERNOON_FROM) return 'morning';
  if (minutes >= AFTERNOON_FROM && minutes < EVENING_FROM) return 'afternoon';
  return 'evening';
}

/** "Priya" from "Priya Raghavan"; the whole of a one-word name; '' for none. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** "Good afternoon, Priya", or "Good afternoon" when there is no name to use. */
export function greeting(fullName: string | null | undefined, minutesOfDay: number): string {
  const name = firstName(fullName);
  const salute = `Good ${partOfDay(minutesOfDay)}`;
  return name ? `${salute}, ${name}` : salute;
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

/** Whose name the Today line gives: the student (a tutor's), the tutor (a student's), or both. */
export type TodayWho = 'student' | 'tutor' | 'both';

type Occurrence = Pick<
  UpcomingSession,
  'occurs_on' | 'start_time' | 'end_time' | 'student_user_id' | 'student_name' | 'tutor_name' | 'cancellation'
>;

export interface TodaySummary {
  /** Lessons today that are not called off: those already recorded and those still to come. */
  count: number;
  cancelled: number;
  /** The first lesson still to come today that is not cancelled, or null. */
  next: Occurrence | null;
  /** The next one has started (it is under way, not yet recorded). */
  underWay: boolean;
  /** "2 lessons today", "No lessons today". */
  headline: string;
  /** "Next at 4:00 PM with Sofia", "All done for today.", "Nothing on the schedule." */
  detail: string;
}

function withWhom(occurrence: Occurrence, who: TodayWho): string {
  const student = firstName(occurrence.student_name);
  const tutor = firstName(occurrence.tutor_name);
  switch (who) {
    case 'student':
      return `with ${student}`;
    case 'tutor':
      return `with ${tutor}`;
    case 'both':
      return `${student} with ${tutor}`;
  }
}

/**
 * The Today card's words. `upcoming` is what the schedules say is coming (the server drops a
 * lesson once it is recorded or over, and keeps a cancelled date, flagged); `recordedToday` is how
 * many lessons were recorded today, so a lesson already taught still counts as one of today's.
 * A cancelled lesson is counted apart and is never "next".
 */
export function summarizeToday({
  upcoming,
  recordedToday,
  today,
  nowMinutes,
  who,
}: {
  upcoming: readonly Occurrence[];
  recordedToday: number;
  today: string;
  nowMinutes: number;
  who: TodayWho;
}): TodaySummary {
  const todays = upcoming.filter((occurrence) => occurrence.occurs_on === today);
  const live = todays
    .filter((occurrence) => !occurrence.cancellation)
    .sort((a, b) => (parseClockTime(a.start_time) ?? 0) - (parseClockTime(b.start_time) ?? 0));
  const cancelled = todays.length - live.length;
  const count = recordedToday + live.length;
  const next = live[0] ?? null;
  const start = next ? (parseClockTime(next.start_time) ?? 0) : 0;
  const underWay = Boolean(next) && start <= nowMinutes;

  const cancelledNote = cancelled > 0 ? ` · ${cancelled} cancelled` : '';
  const headline =
    count === 0 ? `No lessons today${cancelledNote}` : `${countOf(count, 'lesson')} today${cancelledNote}`;

  let detail: string;
  if (next) {
    const whom = withWhom(next, who);
    if (underWay) detail = who === 'both' ? `Under way now: ${whom}` : `Under way now ${whom}`;
    else
      detail =
        who === 'both'
          ? `Next at ${formatMinutesOfDay(start)}: ${whom}`
          : `Next at ${formatMinutesOfDay(start)} ${whom}`;
  } else if (count > 0) {
    detail = 'All done for today.';
  } else {
    detail = 'Nothing on the schedule.';
  }
  return { count, cancelled, next, underWay, headline, detail };
}

/** The first lesson of one student still to come and not called off, or null. */
export function nextLessonFor<T extends Occurrence>(upcoming: readonly T[], studentId: string): T | null {
  return (
    upcoming.find((occurrence) => occurrence.student_user_id === studentId && !occurrence.cancellation) ??
    null
  );
}

/** How far ahead Home reads the schedules for a child's next lesson. */
export const CHILD_HORIZON_DAYS = 14;

/** The last date Home reads lessons up to: today for the office and tutors, two weeks for families. */
export function upcomingHorizon(today: string, days: number): string {
  return addDays(today, days);
}

/** True while another page of upcoming lessons is needed to cover the horizon. */
export function needsMoreUpcoming(
  items: readonly Pick<UpcomingSession, 'occurs_on'>[],
  hasMore: boolean,
  until: string,
): boolean {
  if (!hasMore) return false;
  const last = items[items.length - 1];
  return !last || last.occurs_on <= until;
}

/** A child card's line: "Next: Today at 4:00 PM with Alex Chen", or "Under way now with Alex Chen". */
export function childNextLine(
  next: Pick<UpcomingSession, 'occurs_on' | 'start_time' | 'tutor_name'> | null,
  today: string,
  nowMinutes: number,
): string {
  if (!next) return 'Nothing scheduled in the next two weeks';
  if (next.occurs_on === today && (parseClockTime(next.start_time) ?? 0) <= nowMinutes) {
    return `Under way now with ${next.tutor_name}`;
  }
  return `Next: ${lessonWhen(next, today)} with ${next.tutor_name}`;
}

/** "Today at 4:00 PM", "Tomorrow at 4:00 PM", "Thu, Oct 22 at 4:00 PM". */
export function lessonWhen(
  occurrence: Pick<UpcomingSession, 'occurs_on' | 'start_time'>,
  today: string,
): string {
  const start = formatMinutesOfDay(parseClockTime(occurrence.start_time) ?? 0);
  if (occurrence.occurs_on === today) return `Today at ${start}`;
  if (occurrence.occurs_on === addDays(today, 1)) return `Tomorrow at ${start}`;
  const date = new Date(`${occurrence.occurs_on}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${date} at ${start}`;
}

// ---------------------------------------------------------------------------
// A child's month
// ---------------------------------------------------------------------------

export interface MonthProgress {
  /** Lessons on the timeline this calendar month. */
  lessons: number;
  /** Plan topics whose latest score this month is at mastery. */
  masteredThisMonth: number;
  /** Whether there is a plan with topics to measure. */
  measured: boolean;
  percent: number;
  /** Where the plan stood when the month began. */
  startPercent: number;
  expected: number;
  /** "3 lessons this month, 1 topic mastered" */
  lessonsLine: string;
  /** "25% of the plan mastered, up from 15%", or why there is no bar. */
  planLine: string;
}

/** This month in words, from the shared progress (`computeProgress`); a bar is drawn from `percent`. */
export function monthProgress(progress: StudentProgress | null | undefined, today: string): MonthProgress {
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const timeline = progress?.timeline ?? [];
  const lessons = timeline.filter((point) => point.occurred_on.startsWith(month)).length;
  const masteredThisMonth = (progress?.topics ?? []).filter(
    (topic) => topic.mastered && (topic.last_rated_on ?? '').startsWith(month),
  ).length;
  const summary = progress?.summary;
  const measured = Boolean(progress?.plan) && (summary?.topic_count ?? 0) > 0;
  const before = [...timeline].reverse().find((point) => point.occurred_on < monthStart);
  const percent = summary?.percent ?? 0;
  const startPercent = before?.percent ?? summary?.start_percent ?? 0;

  const lessonsLine =
    lessons === 0
      ? 'No lessons yet this month'
      : `${countOf(lessons, 'lesson')} this month${
          masteredThisMonth > 0 ? `, ${countOf(masteredThisMonth, 'topic')} mastered` : ''
        }`;

  let planLine: string;
  if (!progress?.plan) planLine = 'No learning plan yet';
  else if (!measured) planLine = 'The plan has no topics yet';
  else if (percent > startPercent) planLine = `${percent}% of the plan mastered, up from ${startPercent}%`;
  else planLine = `${percent}% of the plan mastered`;

  return {
    lessons,
    masteredThisMonth,
    measured,
    percent,
    startPercent,
    expected: summary?.expected_percent ?? 0,
    lessonsLine,
    planLine,
  };
}

// ---------------------------------------------------------------------------
// Celebrations
// ---------------------------------------------------------------------------

/** How recent a mastery has to be for Home to celebrate it. */
export const CELEBRATE_WITHIN_DAYS = 14;

/**
 * Plan topics mastered recently: at mastery now (shared `computeProgress`: the latest score at
 * MASTERED_RATING or above) and scored so within the last two weeks.
 */
export function recentlyMastered(progress: StudentProgress | null | undefined, today: string): string[] {
  const since = addDays(today, -CELEBRATE_WITHIN_DAYS);
  return (progress?.topics ?? [])
    .filter(
      (topic) =>
        topic.mastered &&
        topic.last_rated_on !== null &&
        topic.last_rated_on >= since &&
        topic.last_rated_on <= today,
    )
    .map((topic) => topic.topic_id);
}

/** A celebration is shown once per topic, per student, per device. */
export function celebrationKey(studentId: string, topicId: string): string {
  return `${studentId}:${topicId}`;
}

/** How many celebrated keys a device keeps. */
export const CELEBRATED_KEEP = 200;

export function parseCelebrated(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

/** The list with `keys` added at the end (no repeats), trimmed to the newest CELEBRATED_KEEP. */
export function withCelebrated(list: readonly string[], keys: readonly string[]): string[] {
  const next = list.filter((key) => !keys.includes(key));
  next.push(...keys.filter((key, index) => keys.indexOf(key) === index));
  return next.slice(-CELEBRATED_KEEP);
}

/** "Sofia mastered Fractions!", "You mastered Fractions and Decimals!", "Sofia mastered 3 topics!" */
export function celebrationLine(who: string, names: readonly string[]): string {
  if (names.length === 1) return `${who} mastered ${names[0]}!`;
  if (names.length === 2) return `${who} mastered ${names[0]} and ${names[1]}!`;
  return `${who} mastered ${names.length} topics!`;
}

// ---------------------------------------------------------------------------
// Finish write-up
// ---------------------------------------------------------------------------

/**
 * The tutor's own draft from today to finish: dated today on the organization's clock and for a
 * lesson they teach, the most recently touched first. Drafts are the author's alone (R10).
 */
export function draftToFinish(
  drafts: readonly SessionDraft[],
  today: string,
  tutorUserId: string,
): { draft: SessionDraft; others: number } | null {
  const todays = drafts
    .filter((draft) => draft.occurred_on === today && draft.tutor_user_id === tutorUserId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const draft = todays[0];
  return draft ? { draft, others: todays.length - 1 } : null;
}
