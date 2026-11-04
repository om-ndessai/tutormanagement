import type { RetentionRow, StickyShare, VisitSettingsResponse } from '@tmi/shared';

import {
  cohortLabel,
  dayBars,
  percent,
  rowKey,
  rowName,
  shareHint,
  shownRows,
  visitsLine,
  visitsToggleEnabled,
  weeklyBars,
  weeklyEmpty,
} from './stickiness-model';

const none: StickyShare = { base: 0, count: 0, share: null };
const row = (over: Partial<RetentionRow>): RetentionRow => ({
  hat: 'all',
  space_kind: 'all',
  arrival: 'all',
  cohort: 0,
  weeks: { '1': none, '4': none, '8': none },
  ...over,
});

describe('stickiness model', () => {
  it('prints a share as a whole percent, and a suppressed one as a dash', () => {
    expect(percent(0.426)).toBe('43%');
    expect(percent(0)).toBe('0%');
    expect(percent(null)).toBe('—');
  });

  it('says the base of a share, or that the group is too small', () => {
    expect(shareHint('came the week after', { base: 8, count: 3, share: 3 / 8 })).toBe('came the week after · 3 of 8');
    expect(shareHint('came the week after', { base: 2, count: 1, share: null })).toBe('came the week after · fewer than 5');
  });

  it('draws days 1-7 and says each aloud', () => {
    const bars = dayBars({ days_per_week: [0, 4, 3, 0, 0, 0, 0, 1] });
    expect(bars).toHaveLength(7);
    expect(bars[0]).toEqual({ label: '1', value: 4, tip: '1 day: 4 people' });
    expect(bars[1]!.tip).toBe('2 days: 3 people');
    expect(dayBars({ days_per_week: null })).toEqual([]);
  });

  it('draws a suppressed week empty and says so', () => {
    const report = { weekly: [{ week: '2026-10-19', active: -1 }, { week: '2026-10-26', active: 7 }] };
    expect(weeklyBars(report)).toEqual([
      { label: '10-19', value: 0, tip: 'Week of 2026-10-19: fewer than 5' },
      { label: '10-26', value: 7, tip: 'Week of 2026-10-26: 7 people' },
    ]);
    expect(weeklyEmpty(report)).toBe(false);
    expect(weeklyEmpty({ weekly: [{ week: '2026-10-19', active: -1 }, { week: '2026-10-26', active: 0 }] })).toBe(true);
  });

  it('names rows and keeps Everyone even when small', () => {
    const everyone = row({});
    const tutors = row({ hat: 'tutor', space_kind: 'tutoring', arrival: 'invited', cohort: 6 });
    const small = row({ hat: 'parent', cohort: 0 });
    expect(rowName(everyone)).toBe('Everyone');
    expect(rowName(tutors)).toBe('Tutors · Tutoring spaces · Added by a space');
    expect(rowKey(tutors)).toBe('tutor-tutoring-invited');
    expect(shownRows([everyone, tutors, small])).toEqual([everyone, tutors]);
    expect(cohortLabel(everyone)).toBe('<5');
    expect(cohortLabel(tutors)).toBe('6');
  });

  it('holds the switch until the privacy notice covers visits', () => {
    const waiting: VisitSettingsResponse = {
      settings: { record: false },
      may_record: false,
      privacy_version: '2026-11-01',
      needs_privacy_version: '2026-11-04',
    };
    expect(visitsLine(waiting)).toBe(
      'Waiting for the privacy notice of 2026-11-04 (published: 2026-11-01). Until then only days played are counted.',
    );
    expect(visitsToggleEnabled(waiting)).toBe(false);
    // Switching off is never held.
    expect(visitsToggleEnabled({ ...waiting, settings: { record: true } })).toBe(true);
    expect(visitsToggleEnabled({ ...waiting, may_record: true })).toBe(true);
    expect(visitsLine({ ...waiting, may_record: true })).toMatch(/^One line per person, space and day/);
  });
});
