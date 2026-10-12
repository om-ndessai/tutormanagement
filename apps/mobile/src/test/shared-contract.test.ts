// The shared package (packages/shared, the API contract) loads and behaves under the app's
// toolchain: its './x.js' imports resolve, its zod is this app's, its formatting is stable.
import { containsSsn, formatCents, PLATFORM_BRAND, zonedClockParts } from '@tmi/shared';

describe('@tmi/shared in the mobile toolchain', () => {
  it('loads the platform brand', () => {
    expect(PLATFORM_BRAND.name).toBe('Tutor Portal');
  });

  it('formats cents', () => {
    expect(formatCents(1234567)).toBe('$12,345.67');
  });

  it('reads a clock time on an organization clock, not UTC', () => {
    // 16:30 UTC in July is 12:30 in New York (EDT).
    expect(zonedClockParts('2026-07-01T16:30:00Z', 'America/New_York')).toEqual({
      day: '2026-07-01',
      minutesOfDay: 12 * 60 + 30,
    });
  });

  it('refuses SSN-shaped text', () => {
    expect(containsSsn('123-45-6789')).toBe(true);
    expect(containsSsn('call 919-555-0100')).toBe(false);
  });
});
