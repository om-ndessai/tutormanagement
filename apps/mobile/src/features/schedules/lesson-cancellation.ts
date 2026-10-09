// Ported from apps/web/src/features/schedules/lesson-cancellation.tsx @ 1132322 (the helpers).
// Phase 24: calling off one lesson of a standing schedule, and putting it back. Nothing here is
// money. `organizationToday` is the sessions feature's (session-ranges.ts), the same function.
import {
  DAYS_OF_WEEK,
  SCHEDULE_CANCELLER_LABELS,
  firstOccurrence,
  type ScheduleCancellerRole,
  type VisibleSchedule,
} from '@tmi/shared';

export { organizationToday } from '@/features/teaching/session-ranges';

/** A calendar date moved by whole days, as YYYY-MM-DD. */
export function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

/** "Tue, Sep 29", read as a calendar date wherever the reader is. */
export function formatLessonDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "by Maria Okafor (the family)", or just the capacity once they are gone. */
export function cancelledByText(name: string | null, role: ScheduleCancellerRole): string {
  return name ? `by ${name} (${SCHEDULE_CANCELLER_LABELS[role]})` : `by ${SCHEDULE_CANCELLER_LABELS[role]}`;
}

/**
 * The dates the cancel sheet's picker offers. A parent may only call off today or later; the tutor
 * and the office may also mark a past lesson (`mayCancelOn`). The API holds the same line.
 */
export function cancelDateBounds(
  schedule: Pick<VisibleSchedule, 'cancel_as' | 'starts_on' | 'ends_on' | 'day_of_week'>,
  viewerIsAdmin: boolean,
  today: string,
): { min: string; max: string | null; futureOnly: boolean; hint: string } {
  const futureOnly = schedule.cancel_as === 'parent' && !viewerIsAdmin;
  const min = futureOnly && today > schedule.starts_on ? today : schedule.starts_on;
  const dayLabel = DAYS_OF_WEEK[schedule.day_of_week]?.label ?? '';
  return {
    min,
    max: schedule.ends_on,
    futureOnly,
    hint: `${dayLabel}s only${futureOnly ? ', from today on' : ''}.`,
  };
}

/** Where the picker opens: the series' next lesson from today (or its first, if it starts later). */
export function defaultCancelDate(
  schedule: Pick<VisibleSchedule, 'starts_on' | 'ends_on' | 'day_of_week'>,
  today: string,
): string {
  const next = firstOccurrence(today > schedule.starts_on ? today : schedule.starts_on, schedule.day_of_week);
  // A series that has ended: its last lesson day, which only the tutor or the office may mark.
  if (schedule.ends_on && next > schedule.ends_on) {
    return firstOccurrence(shiftDay(schedule.ends_on, -6), schedule.day_of_week);
  }
  return next;
}
