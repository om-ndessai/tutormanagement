import { instantToOrgClock, orgClockToInstant, orgNow } from './payment-time';

const NY = 'America/New_York';

describe('payment time on the organization clock', () => {
  it('turns a New York date and time into the instant, in summer and in winter', () => {
    expect(orgClockToInstant('2026-07-15', '16:30', NY)).toBe('2026-07-15T20:30:00.000Z');
    expect(orgClockToInstant('2026-01-15', '16:30', NY)).toBe('2026-01-15T21:30:00.000Z');
  });

  it('lands either side of a daylight-saving change', () => {
    // Clocks went back at 2:00 on Nov 1, 2026; 1:30 is ambiguous, 3:00 is after.
    expect(orgClockToInstant('2026-11-01', '03:00', NY)).toBe('2026-11-01T08:00:00.000Z');
    expect(orgClockToInstant('2026-03-08', '12:00', NY)).toBe('2026-03-08T16:00:00.000Z');
    // Late evening keeps its own day, not the next UTC one.
    expect(orgClockToInstant('2026-10-09', '23:45', NY)).toBe('2026-10-10T03:45:00.000Z');
  });

  it('works for another zone', () => {
    expect(orgClockToInstant('2026-07-15', '09:00', 'America/Los_Angeles')).toBe('2026-07-15T16:00:00.000Z');
  });

  it('round-trips an instant through the pickers', () => {
    const at = '2026-09-28T22:05:00.000Z';
    const { day, clock } = instantToOrgClock(at, NY);
    expect({ day, clock }).toEqual({ day: '2026-09-28', clock: '18:05' });
    expect(orgClockToInstant(day, clock, NY)).toBe(at);
  });

  it('starts the form at now on the organization clock, rounded down to five minutes', () => {
    expect(orgNow(NY, new Date('2026-10-10T02:13:00Z'))).toEqual({ day: '2026-10-09', clock: '22:10' });
  });
});
