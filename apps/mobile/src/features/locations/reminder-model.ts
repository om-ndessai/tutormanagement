// The reminder's decisions, kept apart from the sheet so they can be tested without a renderer.
// From apps/web/src/features/locations/lesson-reminder.tsx @ 2933e3f (Phase 33, working tree).
import { dueReminder, reminderKey, type UpcomingSession } from '@tmi/shared';

/** How many dismissed keys are kept: a few weeks of lessons is plenty. */
export const DISMISSED_KEPT = 50;

/** The window opens while Home sits open, so the clock is re-read this often. */
export const REMINDER_TICK_MS = 30_000;

export interface ReminderReader {
  id: string;
  roles: readonly string[];
}

/**
 * The lesson to remind the reader of now, or null. An admin sees every lesson in the
 * organization; a reminder is only for their own (as the web). A dismissed date never reminds again.
 */
export function pickReminder(
  lessons: readonly UpcomingSession[],
  reader: ReminderReader | null | undefined,
  dismissed: readonly string[],
  nowIso: string,
  timeZone?: string,
): { lesson: UpcomingSession; minutes: number } | null {
  if (!reader) return null;
  const isAdmin = reader.roles.includes('admin');
  const mine = lessons
    .filter(
      (lesson) => !isAdmin || lesson.tutor_user_id === reader.id || lesson.student_user_id === reader.id,
    )
    .filter((lesson) => !dismissed.includes(reminderKey(lesson)));
  return dueReminder(mine, nowIso, timeZone);
}

/** The stored list with one more key, the oldest falling away. */
export function withDismissed(dismissed: readonly string[], key: string): string[] {
  return [...dismissed.filter((existing) => existing !== key), key].slice(-DISMISSED_KEPT);
}

/** The stored list, or empty for anything that is not a list of strings. */
export function parseDismissed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** "Your lesson starts in 12 minutes", or "…is starting" in its last minute. */
export function reminderTitle(minutes: number): string {
  return minutes <= 1 ? 'Your lesson is starting' : `Your lesson starts in ${minutes} minutes`;
}

/** A virtual location's address that can be opened. */
export function isLink(text: string | null): text is string {
  return Boolean(text && /^https?:\/\//i.test(text));
}
