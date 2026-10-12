import type { AuditEvent } from '@tmi/shared';

import { activeFilterCount, dayLabel, filterChips, groupByDay } from './activity-model';

function event(id: string, created_at: string): AuditEvent {
  return {
    id,
    actor_user_id: 'a',
    actor_name: 'Priya Raghavan',
    subject_user_id: null,
    subject_name: null,
    action: 'comment.added',
    entity_type: 'comment',
    entity_id: id,
    description: 'Commented on Sanjay Patel',
    created_at,
  } as AuditEvent;
}

describe('groupByDay', () => {
  it('heads each day of the organization’s clock, not UTC’s', () => {
    // 01:30 UTC on Oct 9 is still the evening of Oct 8 in New York.
    const items = groupByDay(
      [
        event('e3', '2026-10-09T15:00:00Z'),
        event('e2', '2026-10-09T01:30:00Z'),
        event('e1', '2026-10-08T14:00:00Z'),
      ],
      'America/New_York',
      '2026-10-09',
    );
    expect(items.map((item) => (item.kind === 'day' ? item.label : item.key))).toEqual([
      'Today',
      'e3',
      'Yesterday',
      'e2',
      'e1',
    ]);
    // The hairline stops at the last event of each day.
    expect(
      items.filter((item) => item.kind === 'event').map((item) => item.kind === 'event' && item.last),
    ).toEqual([true, false, true]);
  });

  it('names older days by date, with the year only when it is not this one', () => {
    expect(dayLabel('2026-09-15', '2026-10-09')).toBe('Tue, Sep 15');
    expect(dayLabel('2025-12-01', '2026-10-09')).toBe('Mon, Dec 1, 2025');
  });
});

describe('filters', () => {
  it('counts and labels only what is set', () => {
    expect(activeFilterCount({})).toBe(0);
    const filter = { user_id: 'alex', action: 'tutor.ssn_confirmed', to: '2026-10-09' };
    expect(activeFilterCount(filter)).toBe(3);
    expect(filterChips(filter, (id) => (id === 'alex' ? 'Alex Chen' : undefined), '2026-10-09')).toEqual([
      { key: 'user_id', label: 'Person: Alex Chen' },
      { key: 'action', label: 'Action: SSN confirmed received' },
      { key: 'to', label: 'To Fri, Oct 9' },
    ]);
  });
});
