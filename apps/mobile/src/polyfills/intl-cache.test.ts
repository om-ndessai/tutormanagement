import './intl-cache';

import { formatCents, formatRelativeTime, zonedClockParts } from '@tmi/shared';

describe('cached Intl formatters', () => {
  it('formats exactly as before', () => {
    expect(formatCents(1234567)).toBe('$12,345.67');
    expect(formatRelativeTime('2026-07-01T16:30:00Z', new Date('2026-07-01T19:30:00Z'))).toBe('3 hours ago');
    expect(zonedClockParts('2026-07-01T16:30:00Z', 'America/New_York')).toEqual({
      day: '2026-07-01',
      minutesOfDay: 750,
    });
    expect(
      new Date('2026-07-01T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
    ).toBe('Jul 1');
    expect(new Date('2026-07-01T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC' })).toBe(
      '7/1/2026',
    );
    expect((1234.5).toLocaleString('en-US')).toBe('1,234.5');
  });

  it('reuses one formatter per locale and options', () => {
    const a = new Intl.DateTimeFormat('en-US', { month: 'long' });
    const b = new Intl.DateTimeFormat('en-US', { month: 'long' });
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(Intl.DateTimeFormat);
    expect(new Intl.RelativeTimeFormat('en', { numeric: 'auto' })).toBe(
      new Intl.RelativeTimeFormat('en', { numeric: 'auto' }),
    );
  });
});
