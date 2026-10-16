// The week in bands (UI upgrades U3): Morning 7-12, After school 15-18, Evening 18-21, as the hour
// blocks the availability model stores, clipped to the exact grid's 07:00-21:00 range.
import type { AvailabilitySlot } from '@tmi/shared';

import {
  AVAILABILITY_BANDS,
  availabilityLines,
  PICKER_FIRST_HOUR,
  PICKER_LAST_HOUR,
  bandHours,
  bandState,
  toggleBand,
} from './availability-bands';
import { FIRST_HOUR, LAST_HOUR } from './availability-picker';

const [MORNING, AFTER_SCHOOL, EVENING] = AVAILABILITY_BANDS as [
  (typeof AVAILABILITY_BANDS)[number],
  (typeof AVAILABILITY_BANDS)[number],
  (typeof AVAILABILITY_BANDS)[number],
];
const MONDAY = 1;
const TUESDAY = 2;

const hoursOn = (slots: AvailabilitySlot[], day: number) =>
  slots
    .filter((slot) => slot.day_of_week === day)
    .map((slot) => slot.hour)
    .sort((a, b) => a - b);

test('each band is its hour blocks, end exclusive', () => {
  expect(bandHours(MORNING)).toEqual([7, 8, 9, 10, 11]);
  expect(bandHours(AFTER_SCHOOL)).toEqual([15, 16, 17]);
  expect(bandHours(EVENING)).toEqual([18, 19, 20]);
});

test('the bands are clipped to the hours the exact grid offers', () => {
  // The grid and the bands agree on the range.
  expect([PICKER_FIRST_HOUR, PICKER_LAST_HOUR]).toEqual([FIRST_HOUR, LAST_HOUR]);
  // Every band fits today, so nothing is lost...
  for (const band of AVAILABILITY_BANDS) {
    expect(bandHours(band).every((hour) => hour >= FIRST_HOUR && hour <= LAST_HOUR)).toBe(true);
  }
  // ...and a band reaching past either edge would be cut to it.
  expect(bandHours({ start: 5, end: 9 })).toEqual([7, 8]);
  expect(bandHours({ start: 20, end: 24 })).toEqual([20, 21]);
  expect(bandHours({ start: 18, end: 21 }, 7, 19)).toEqual([18, 19]);
  expect(bandHours({ start: 1, end: 5 })).toEqual([]);
});

test('a band on a day is all, some or none of it', () => {
  expect(bandState([], MONDAY, MORNING)).toBe('none');
  const morning = toggleBand([], MONDAY, MORNING);
  expect(bandState(morning, MONDAY, MORNING)).toBe('all');
  // Only that day.
  expect(bandState(morning, TUESDAY, MORNING)).toBe('none');
  // Fine-tuned to part of the band: shown as partly chosen.
  const tuned = morning.filter((slot) => slot.hour !== 9);
  expect(bandState(tuned, MONDAY, MORNING)).toBe('some');
  expect(bandState([{ day_of_week: MONDAY, hour: 16 }], MONDAY, AFTER_SCHOOL)).toBe('some');
});

test('tapping fills a band that is empty or partly chosen, and clears one that is full', () => {
  const full = toggleBand([], MONDAY, AFTER_SCHOOL);
  expect(hoursOn(full, MONDAY)).toEqual([15, 16, 17]);
  expect(hoursOn(toggleBand(full, MONDAY, AFTER_SCHOOL), MONDAY)).toEqual([]);
  // A fine-tuned band is completed, with no hour twice.
  const partial: AvailabilitySlot[] = [{ day_of_week: MONDAY, hour: 16 }];
  expect(hoursOn(toggleBand(partial, MONDAY, AFTER_SCHOOL), MONDAY)).toEqual([15, 16, 17]);
});

test('a band never touches other days, other bands, or hours outside every band', () => {
  const start: AvailabilitySlot[] = [
    { day_of_week: MONDAY, hour: 13 }, // midday: no band
    { day_of_week: MONDAY, hour: 21 }, // the grid's last block: no band
    { day_of_week: MONDAY, hour: 18 }, // evening
    { day_of_week: TUESDAY, hour: 15 },
  ];
  const added = toggleBand(start, MONDAY, AFTER_SCHOOL);
  expect(hoursOn(added, MONDAY)).toEqual([13, 15, 16, 17, 18, 21]);
  expect(hoursOn(added, TUESDAY)).toEqual([15]);
  // After school ends where Evening begins: clearing one leaves the other.
  const cleared = toggleBand(added, MONDAY, AFTER_SCHOOL);
  expect(hoursOn(cleared, MONDAY)).toEqual([13, 18, 21]);
  expect(bandState(cleared, MONDAY, EVENING)).toBe('some');
});

test('the week reads as a line a day, hours collapsed', () => {
  const slots = toggleBand(toggleBand([], TUESDAY, AFTER_SCHOOL), MONDAY, EVENING);
  expect(availabilityLines(slots)).toEqual(['Monday: 6:00–9:00 PM', 'Tuesday: 3:00–6:00 PM']);
  expect(availabilityLines([])).toEqual([]);
});
