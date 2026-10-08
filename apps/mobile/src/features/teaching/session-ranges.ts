// The sessions list's date filter on the phone: a few ranges a tap away, and a custom one. The web
// has two date inputs (sessions-page.tsx); typing dates on a phone is the slow path, so the common
// ranges come first. Every range is in calendar dates on the organization's clock.
import { zonedClockParts } from '@tmi/shared';

export const SESSION_RANGES = [
  'all',
  'this-month',
  'last-month',
  'last-90-days',
  'this-year',
  'custom',
] as const;
export type SessionRange = (typeof SESSION_RANGES)[number];

export const SESSION_RANGE_LABELS: Record<SessionRange, string> = {
  all: 'All time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-90-days': 'Last 90 days',
  'this-year': 'This year',
  custom: 'Custom',
};

export interface DateBounds {
  /** Inclusive, YYYY-MM-DD; '' for open. */
  from: string;
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A calendar date moved by whole days ("2026-03-01", -1 → "2026-02-28"). */
export function shiftDay(day: string, days: number): string {
  return iso(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

/** The last day of a month, from any day in it. */
function endOfMonth(year: number, monthIndex: number): string {
  return iso(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

/** Today (YYYY-MM-DD) on the organization's clock. */
export function organizationToday(timeZone: string, now: Date = new Date()): string {
  return zonedClockParts(now.toISOString(), timeZone).day;
}

/**
 * The bounds a preset stands for, given today on the organization's clock. `custom` keeps
 * whatever was chosen, so it is not computed here.
 */
export function rangeBounds(range: Exclude<SessionRange, 'custom'>, today: string): DateBounds {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  switch (range) {
    case 'all':
      return { from: '', to: '' };
    case 'this-month':
      return { from: iso(new Date(Date.UTC(year, month, 1))), to: endOfMonth(year, month) };
    case 'last-month':
      return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: endOfMonth(year, month - 1) };
    case 'last-90-days':
      return { from: shiftDay(today, -89), to: today };
    case 'this-year':
      return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
}
