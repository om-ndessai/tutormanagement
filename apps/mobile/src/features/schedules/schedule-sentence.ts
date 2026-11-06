// A standing lesson said as one sentence (UI upgrades U5; docs/ui-upgrades-spec.md): the Review of
// Schedule a lesson reads "Every Monday, 4:00–5:00 PM, at Institute, room 2, starting Oct 19." Pure,
// so the wording is tested on its own. Dates are calendar dates (YYYY-MM-DD) on the organization's
// clock, read as written: no device zone is ever consulted.
import {
  DAYS_OF_WEEK,
  firstOccurrence,
  formatDay,
  formatTimeRange,
  parseClockTime,
  type Location,
  type SessionMode,
} from '@tmi/shared';

/** "at Institute, room 2" / "online in Online room". */
export function placePhrase(place: Pick<Location, 'kind' | 'name'>): string {
  return place.kind === 'virtual' ? `online in ${place.name}` : `at ${place.name}`;
}

/**
 * Where, as a phrase: the usual place first. With an in-person place and an online room, the lesson's
 * mode decides which leads ("at Institute, room 2, or online in Online room"). Empty for none.
 */
export function placesPhrase(
  places: readonly Pick<Location, 'kind' | 'name'>[],
  mode: SessionMode,
): string {
  const usualKind = mode === 'virtual' ? 'virtual' : 'physical';
  const ordered = [...places].sort(
    (a, b) => Number(b.kind === usualKind) - Number(a.kind === usualKind),
  );
  return ordered.map(placePhrase).join(', or ');
}

export interface ScheduleSentenceInput {
  dayOfWeek: number;
  /** "16:00" */
  startTime: string;
  durationMinutes: number;
  mode: SessionMode;
  places: readonly Pick<Location, 'kind' | 'name'>[];
  /** The series' first allowed date; the sentence names the first lesson on its weekday. */
  startsOn: string;
  endsOn?: string | null;
  /** Today on the organization's clock, so a date this year needs no year. */
  today: string;
}

/**
 * "Every Monday, 4:00–5:00 PM, at Institute, room 2, starting Oct 19." -- and ", until Mar 1" when
 * the series ends. The start is the first lesson itself: the first date on or after `startsOn` that
 * falls on the day.
 */
export function scheduleSentence({
  dayOfWeek,
  startTime,
  durationMinutes,
  mode,
  places,
  startsOn,
  endsOn,
  today,
}: ScheduleSentenceInput): string {
  const day = DAYS_OF_WEEK[dayOfWeek]?.label ?? 'week';
  const start = parseClockTime(startTime);
  const parts = [`Every ${day}`];
  if (start !== null) parts.push(formatTimeRange(start, start + durationMinutes));
  const where = placesPhrase(places, mode);
  if (where) parts.push(where);

  const first = firstOccurrence(startsOn, dayOfWeek);
  parts.push(`starting ${formatDay(first, today)}`);
  if (endsOn) parts.push(`until ${formatDay(endsOn, today)}`);
  return `${parts.join(', ')}.`;
}
