import { organizationToday, rangeBounds, shiftDay } from './session-ranges';

describe('session ranges', () => {
  it('reads today on the organization clock, not UTC', () => {
    // 02:30 UTC on Oct 8 is still Oct 7 in New York.
    expect(organizationToday('America/New_York', new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07');
    expect(organizationToday('Europe/London', new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-08');
  });

  it('computes month and year presets', () => {
    expect(rangeBounds('all', '2026-10-08')).toEqual({ from: '', to: '' });
    expect(rangeBounds('this-month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(rangeBounds('last-month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(rangeBounds('last-month', '2024-03-31')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(rangeBounds('this-year', '2026-10-08')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('counts the last 90 days including today', () => {
    expect(rangeBounds('last-90-days', '2026-10-08')).toEqual({ from: '2026-07-11', to: '2026-10-08' });
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});
