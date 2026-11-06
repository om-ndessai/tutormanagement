// Dates and amounts for the Finance tab, every date on the organization's clock. Helpers ported
// from apps/web/src/features/dashboard/tutor-payments.tsx (daysAway) @ 1132322. A day or an
// instant reads through the shared formatter (`formatDay`, `formatInstant`, Phase 78).
import { formatCents, todayIn } from '@tmi/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** This year on the organization's clock: the financial year the Finance tab opens on. */
export function orgYear(timeZone: string, now: Date = new Date()): number {
  return Number(todayIn(timeZone, now).slice(0, 4));
}

/** "today", "tomorrow", "in 5 days" -- both dates on the organization's clock. */
export function daysAway(date: string, today: string): string {
  const gap = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (gap <= 0) return 'today';
  if (gap === 1) return 'tomorrow';
  return `in ${gap} days`;
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
