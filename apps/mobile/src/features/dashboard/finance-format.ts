// Dates and amounts for the Finance tab, every date on the organization's clock. Helpers ported
// from apps/web/src/features/dashboard/tutor-payments.tsx (daysAway, LastPaidOn) and
// apps/web/src/features/schedules/lesson-cancellation.tsx (formatLessonDay) @ 1132322.
import { formatCents, zonedClockParts } from '@tmi/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date (YYYY-MM-DD) on the organization's clock. */
export function orgToday(timeZone: string, now: Date = new Date()): string {
  return zonedClockParts(now.toISOString(), timeZone).day;
}

/** This year on the organization's clock: the financial year the Finance tab opens on. */
export function orgYear(timeZone: string, now: Date = new Date()): number {
  return Number(orgToday(timeZone, now).slice(0, 4));
}

/** "Tue, Oct 14" for a calendar date. */
export function formatLessonDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "today", "tomorrow", "in 5 days" -- both dates on the organization's clock. */
export function daysAway(date: string, today: string): string {
  const gap = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (gap <= 0) return 'today';
  if (gap === 1) return 'tomorrow';
  return `in ${gap} days`;
}

/**
 * The day an instant (a payment's `paid_at`) fell on, on the organization's clock: "Sep 28",
 * with the year only when it is not this one, or "Sep 28, 2025" with `withYear`.
 */
export function formatPaidOn(at: string, timeZone: string, today: string, withYear = false): string {
  const day = zonedClockParts(at, timeZone).day;
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear || !sameYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** A StatCard's `formatValue` for money: the finance tab's only way to print a card's amount. */
export const formatMoneyValue = (cents: number): string => formatCents(cents);

/** Hours to one decimal: "116.5", never a rounded-away quarter. */
export function hours(minutes: number): string {
  return minutes === 0 ? '—' : (minutes / 60).toFixed(1);
}

/** An amount, or a dash for nothing (zero) or not yours to see (null). */
export function moneyOrDash(cents: number | null): string {
  if (cents === null) return '—';
  return cents === 0 ? '—' : formatCents(cents);
}
