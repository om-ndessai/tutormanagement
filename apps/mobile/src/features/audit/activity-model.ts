// The Activity screen's pure parts: the filter it sends, the chips that show it, and the timeline
// grouped by day on the organization's clock.
import { AUDIT_ACTION_LABELS, zonedClockParts, type AuditEvent } from '@tmi/shared';

import { formatSessionDay } from '@/features/teaching/session-format';

export interface ActivityFilter {
  /** Admins only: the server answers anyone else with their own activity, whatever is sent. */
  user_id?: string;
  action?: string;
  /** "YYYY-MM-DD". */
  from?: string;
  to?: string;
}

export type FilterKey = keyof ActivityFilter;

export function activeFilterCount(filter: ActivityFilter): number {
  return (Object.keys(filter) as FilterKey[]).filter((key) => Boolean(filter[key])).length;
}

export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as never] ?? action;
}

/** One closable chip per active filter, in the sheet's order. */
export function filterChips(
  filter: ActivityFilter,
  personName: (id: string) => string | undefined,
  today: string,
): { key: FilterKey; label: string }[] {
  const chips: { key: FilterKey; label: string }[] = [];
  if (filter.user_id)
    chips.push({ key: 'user_id', label: `Person: ${personName(filter.user_id) ?? 'one person'}` });
  if (filter.action) chips.push({ key: 'action', label: `Action: ${actionLabel(filter.action)}` });
  if (filter.from) chips.push({ key: 'from', label: `From ${formatSessionDay(filter.from, today)}` });
  if (filter.to) chips.push({ key: 'to', label: `To ${formatSessionDay(filter.to, today)}` });
  return chips;
}

export type TimelineItem =
  | { kind: 'day'; key: string; day: string; label: string }
  | { kind: 'event'; key: string; event: AuditEvent; last: boolean };

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", else "Fri, Oct 9" (with the year when it is not this one). */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === previousDay(today)) return 'Yesterday';
  return formatSessionDay(day, today);
}

/**
 * The log, newest first, with a heading before each day's events. A day is the organization's: an
 * event at 01:00 UTC is still the evening before in New York.
 */
export function groupByDay(events: AuditEvent[], timeZone: string, today: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  const days = events.map((event) => zonedClockParts(event.created_at, timeZone).day);
  events.forEach((event, index) => {
    const day = days[index]!;
    if (day !== days[index - 1]) {
      items.push({ kind: 'day', key: `day-${day}`, day, label: dayLabel(day, today) });
    }
    items.push({ kind: 'event', key: event.id, event, last: days[index + 1] !== day });
  });
  return items;
}
