import { lessonEvent, zonedInstant } from './lesson-event';

const schedule = {
  day_of_week: 2, // Tuesday
  start_time: '16:00',
  duration_minutes: 60,
  starts_on: '2026-09-01',
  ends_on: '2026-12-15',
  location: 'Institute, room 2',
};

describe('zonedInstant', () => {
  it("is the instant the organization's clock showed, either side of a DST change", () => {
    expect(zonedInstant('2026-10-13', 16 * 60, 'America/New_York').toISOString()).toBe(
      '2026-10-13T20:00:00.000Z',
    );
    expect(zonedInstant('2026-11-10', 16 * 60, 'America/New_York').toISOString()).toBe(
      '2026-11-10T21:00:00.000Z',
    );
    expect(zonedInstant('2026-10-13', 16 * 60, 'America/Los_Angeles').toISOString()).toBe(
      '2026-10-13T23:00:00.000Z',
    );
  });
});

describe('lessonEvent', () => {
  it('starts at the next date, weekly until the last, titled "Lesson" with no name or notes', () => {
    const event = lessonEvent(schedule, '2026-10-10', 'America/New_York');
    expect(event.title).toBe('Lesson');
    expect(event.startDate.toISOString()).toBe('2026-10-13T20:00:00.000Z');
    expect(event.endDate.toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect(event.timeZone).toBe('America/New_York');
    expect(event.location).toBe('Institute, room 2');
    expect(event.recurrenceRule.frequency).toBe('weekly');
    // The last lesson's end, after the November change: EST.
    expect(event.recurrenceRule.endDate?.toISOString()).toBe('2026-12-15T22:00:00.000Z');
    expect(Object.keys(event)).not.toContain('notes');
  });

  it('starts at the series start when it has not begun, and runs on when open-ended', () => {
    const event = lessonEvent(
      { ...schedule, starts_on: '2026-11-03', ends_on: null, location: null },
      '2026-10-10',
      'America/New_York',
    );
    expect(event.startDate.toISOString()).toBe('2026-11-03T21:00:00.000Z');
    expect(event.recurrenceRule.endDate).toBeUndefined();
    expect(event.location).toBeUndefined();
  });
});
