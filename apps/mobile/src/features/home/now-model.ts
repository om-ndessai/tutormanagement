// The tutor's Home (Phase 43, docs/tutor-home-plan.md, the owner's decisions of 2026-10-20): which
// "Now" card shows, and its words, as pure functions so they are tested with an injected clock and
// no device. Nothing here carries money: the card leads the Tutoring tab.
import {
  WEEKDAY_LONG,
  addDays,
  formatDay,
  formatMinutesOfDay,
  googleMapsUrl,
  parseClockTime,
  type PartOfDay,
  START_LEAD_MINUTES,
  type TutorHome,
  type TutorHomeBrief,
  type TutorHomeLesson,
  weekdayOf,
} from '@tmi/shared';

import { firstName } from '@/features/dashboard/home-model';

export type UnrecordedLesson = TutorHome['unrecorded'][number];

/** One lesson of a series, on one date: what "Later" and the confetti remember. */
export function lessonKey(lesson: Pick<TutorHomeLesson, 'schedule_id' | 'occurs_on'>): string {
  return `${lesson.schedule_id}:${lesson.occurs_on}`;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A month in full, for "together since August" (the shared formatter writes months short). */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** "4:30 PM" from "16:30"; the text as given when it is not a clock time. */
export function clockLabel(time: string): string {
  const minutes = parseClockTime(time);
  return minutes === null ? time : formatMinutesOfDay(minutes);
}

/** "1 h 18 min", "45 min", "2 h"; "less than a minute" under one. */
export function countdown(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 1) return 'less than a minute';
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "Good afternoon, Alex" (the server's part of the day, on the organization's clock). */
export function nowGreeting(part: PartOfDay, fullName: string | null | undefined): string {
  const name = firstName(fullName);
  return name ? `Good ${part}, ${name}` : `Good ${part}`;
}

/**
 * When the lesson is, as the owner worded it (2026-10-20): "today at 4:30 PM, in 1 h 18 min",
 * "tomorrow at 8:00 AM", "Saturday at 10:00 AM", or a date beyond the coming week. A lesson already
 * under way says so.
 */
export function lessonWhen(
  lesson: Pick<TutorHomeLesson, 'occurs_on' | 'start_time' | 'end_time'>,
  today: string,
  nowMinutes: number,
): string {
  const at = clockLabel(lesson.start_time);
  if (lesson.occurs_on === today) {
    const start = parseClockTime(lesson.start_time);
    if (start === null) return `today at ${at}`;
    if (start <= nowMinutes) return `under way, since ${at}`;
    return `today at ${at}, in ${countdown(start - nowMinutes)}`;
  }
  if (lesson.occurs_on === addDays(today, 1)) return `tomorrow at ${at}`;
  if (lesson.occurs_on > today && lesson.occurs_on < addDays(today, 7)) {
    return `${WEEKDAY_LONG[weekdayOf(lesson.occurs_on)]} at ${at}`;
  }
  return `on ${WEEKDAY_LONG[weekdayOf(lesson.occurs_on)]}, ${formatDay(lesson.occurs_on, today)}, at ${at}`;
}

/** "Sofia's lesson is today at 4:30 PM, in 1 h 18 min." */
export function nextHeadline(
  lesson: Pick<TutorHomeLesson, 'student_name' | 'occurs_on' | 'start_time' | 'end_time'>,
  today: string,
  nowMinutes: number,
): string {
  const who = firstName(lesson.student_name) || lesson.student_name;
  return `${who}'s lesson is ${lessonWhen(lesson, today, nowMinutes)}`;
}

/** "Yay! You completed one more lesson with Sofia" */
export function celebrateHeadline(lesson: Pick<TutorHomeLesson, 'student_name'>): string {
  const who = firstName(lesson.student_name) || lesson.student_name;
  return `Yay! You completed one more lesson with ${who}`;
}

/**
 * "That's 24 together since August." -- the pairing's recorded lessons and this one. The first:
 * "Your first lesson together!" A start in another year names it: "since August 2025".
 */
export function togetherLine(
  lesson: Pick<TutorHomeLesson, 'lessons_together' | 'together_since'>,
  today: string,
): string {
  if (lesson.lessons_together <= 0 || !lesson.together_since) return 'Your first lesson together!';
  const [year, month] = lesson.together_since.split('-').map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? '';
  const since = lesson.together_since.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${year}`;
  return `That's ${lesson.lessons_together + 1} together since ${since}.`;
}

/** "It ended at 5:30 PM." / "It ended yesterday at 5:30 PM." */
export function endedLine(lesson: Pick<TutorHomeLesson, 'occurs_on' | 'end_time'>, today: string): string {
  const at = clockLabel(lesson.end_time);
  return lesson.occurs_on === today ? `It ended at ${at}.` : `It ended yesterday at ${at}.`;
}

/** "Last time: <homework>" for the record sheet's Homework review; '' with nothing set. */
export function homeworkReviewPrefill(homeworkLast: string | null | undefined): string {
  const text = homeworkLast?.trim();
  return text ? `Last time: ${text}` : '';
}

/**
 * The Now card's one sentence from the brief: the place, then the homework set last time.
 * "In person at Institute, room 2. Last time you set: pages 48-53." Null with nothing to say.
 */
export function briefSentence(
  lesson: Pick<TutorHomeLesson, 'mode' | 'place'>,
  brief: Pick<TutorHomeBrief, 'homework'> | null,
): string | null {
  const parts: string[] = [];
  if (lesson.place) {
    parts.push(
      lesson.place.kind === 'virtual' ? `Online, ${lesson.place.name}.` : `In person at ${lesson.place.name}.`,
    );
  } else {
    parts.push(lesson.mode === 'virtual' ? 'Online.' : 'In person.');
  }
  const assigned = brief?.homework?.assigned?.trim();
  if (assigned) parts.push(`Last time you set: ${assigned}`);
  return parts.join(' ') || null;
}

/** True from START_LEAD_MINUTES (shared, 15) before the start until the end, on the lesson's own day. */
export function canStartNow(
  lesson: Pick<TutorHomeLesson, 'occurs_on' | 'start_time' | 'end_time'>,
  today: string,
  nowMinutes: number,
): boolean {
  if (lesson.occurs_on !== today) return false;
  const start = parseClockTime(lesson.start_time);
  const end = parseClockTime(lesson.end_time);
  if (start === null || end === null) return false;
  return nowMinutes >= start - START_LEAD_MINUTES && nowMinutes < end;
}

// ---------------------------------------------------------------------------
// The place
// ---------------------------------------------------------------------------

export type PlaceAction =
  | { kind: 'directions'; address: string }
  | { kind: 'link'; url: string }
  | { kind: 'none' };

/** A meeting link only when it is one: joining instructions are shown, not opened. */
function asLink(text: string): string | null {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/** What the place offers: Directions to a physical address, or the meeting link of a virtual one. */
export function placeAction(place: TutorHomeLesson['place']): PlaceAction {
  const address = place?.address?.trim();
  if (!place || !address) return { kind: 'none' };
  if (place.kind === 'virtual') {
    const url = asLink(address);
    return url ? { kind: 'link', url } : { kind: 'none' };
  }
  return { kind: 'directions', address };
}

export interface MapChoice {
  label: string;
  url: string;
}

/**
 * Where Directions may open: Google Maps everywhere (its app where installed, else the browser),
 * and Apple Maps too on iOS. No API key and no location: the address is the query.
 */
export function mapChoices(address: string, os: string): MapChoice[] {
  const google = { label: 'Google Maps', url: googleMapsUrl(address) };
  if (os !== 'ios') return [google];
  return [google, { label: 'Apple Maps', url: `https://maps.apple.com/?q=${encodeURIComponent(address)}` }];
}
