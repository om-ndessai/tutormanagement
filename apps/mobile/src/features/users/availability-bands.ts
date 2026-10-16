// A week in three bands (UI upgrades U3): Morning, After school and Evening, each a run of the
// hour blocks the availability model already stores (`{ day_of_week, hour }`, one hour each). The
// bands are a quicker way to fill the same rows the exact grid edits, so the two can be mixed: an
// hour fine-tuned off inside a band shows that band as partly chosen, and hours outside every band
// (midday, the last hour of the evening) are never touched by a band.
import { DAYS_OF_WEEK, formatTimeRange, groupSlotsByDay, type AvailabilitySlot } from '@tmi/shared';

/** The hours the exact grid offers (availability-picker): 07:00 to the 21:00 block. */
export const PICKER_FIRST_HOUR = 7;
export const PICKER_LAST_HOUR = 21;

export type BandKey = 'morning' | 'after-school' | 'evening';

export interface AvailabilityBand {
  key: BandKey;
  label: string;
  /** The first hour block. */
  start: number;
  /** The hour the band ends at: its last block starts an hour before. */
  end: number;
}

export const AVAILABILITY_BANDS: readonly AvailabilityBand[] = [
  { key: 'morning', label: 'Morning', start: 7, end: 12 },
  { key: 'after-school', label: 'After school', start: 15, end: 18 },
  { key: 'evening', label: 'Evening', start: 18, end: 21 },
];

/** A band's hour blocks, clipped to what the grid offers, so a band never sets an hour it cannot show. */
export function bandHours(
  band: Pick<AvailabilityBand, 'start' | 'end'>,
  first: number = PICKER_FIRST_HOUR,
  last: number = PICKER_LAST_HOUR,
): number[] {
  const hours: number[] = [];
  for (let hour = Math.max(band.start, first); hour < band.end && hour <= last; hour++) hours.push(hour);
  return hours;
}

/** How much of a band is chosen on one day: every hour, some of them (fine-tuned), or none. */
export type BandState = 'all' | 'some' | 'none';

export function bandState(slots: readonly AvailabilitySlot[], day: number, band: AvailabilityBand): BandState {
  const hours = bandHours(band);
  if (hours.length === 0) return 'none';
  const on = hours.filter((hour) => slots.some((slot) => slot.day_of_week === day && slot.hour === hour));
  if (on.length === 0) return 'none';
  return on.length === hours.length ? 'all' : 'some';
}

/**
 * Taps a band on a day: a band wholly chosen is cleared; one partly chosen or not at all is filled
 * (a tap on a fine-tuned band completes it, as a mixed checkbox does). Other days, other bands and
 * hours outside the band are kept as they were.
 */
export function toggleBand(
  slots: readonly AvailabilitySlot[],
  day: number,
  band: AvailabilityBand,
): AvailabilitySlot[] {
  const hours = bandHours(band);
  const inBand = (slot: AvailabilitySlot) => slot.day_of_week === day && hours.includes(slot.hour);
  const rest = slots.filter((slot) => !inBand(slot));
  if (bandState(slots, day, band) === 'all') return rest;
  return [...rest, ...hours.map((hour) => ({ day_of_week: day, hour }))];
}

/** The week in words, one line a day with its hours collapsed ("Tuesday: 4:00–6:00 PM"), as the grid sums it up. */
export function availabilityLines(slots: readonly AvailabilitySlot[]): string[] {
  return groupSlotsByDay([...slots]).map(
    ({ day_of_week, ranges }) =>
      `${DAYS_OF_WEEK[day_of_week]?.label}: ${ranges
        .map((range) => formatTimeRange(range.start * 60, range.end * 60))
        .join(', ')}`,
  );
}
