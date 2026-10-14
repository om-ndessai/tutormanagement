import type { Location } from '@tmi/shared';

import { upcoming } from '@/test/fixtures';
import {
  DISMISSED_KEPT,
  isLink,
  parseDismissed,
  pickReminder,
  reminderTitle,
  withDismissed,
} from './reminder-model';

const TZ = 'America/New_York';
// 15:50 in New York on the fixture's lesson day: ten minutes before its 16:00 start.
const NOW = '2026-10-08T19:50:00Z';

function place(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    owner_user_id: 'tutor-1',
    owner_name: 'Alex Chen',
    name: 'Institute, room 2',
    kind: 'physical',
    address: '1 Main St',
    reminder_minutes: 15,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const tutor = { id: 'tutor-1', roles: ['tutor'] };
const admin = { id: 'admin-1', roles: ['admin'] };

describe('pickReminder', () => {
  it('reminds a lesson inside its locations’ reminder, on the organization’s clock', () => {
    const due = pickReminder([upcoming({ locations: [place()] })], tutor, [], NOW, TZ);
    expect(due?.minutes).toBe(10);
    expect(due?.lesson.schedule_id).toBe('sch-1');
  });

  it('says nothing outside the window, with no reminder set, or once begun', () => {
    expect(
      pickReminder([upcoming({ locations: [place({ reminder_minutes: 5 })] })], tutor, [], NOW, TZ),
    ).toBeNull();
    expect(
      pickReminder([upcoming({ locations: [place({ reminder_minutes: 0 })] })], tutor, [], NOW, TZ),
    ).toBeNull();
    expect(pickReminder([upcoming({ locations: [] })], tutor, [], NOW, TZ)).toBeNull();
    expect(
      pickReminder([upcoming({ locations: [place()] })], tutor, [], '2026-10-08T20:05:00Z', TZ),
    ).toBeNull();
  });

  it('uses the longest reminder of a lesson’s places', () => {
    const lesson = upcoming({
      locations: [
        place({ reminder_minutes: 5 }),
        place({ id: 'loc-2', kind: 'virtual', reminder_minutes: 30 }),
      ],
    });
    expect(pickReminder([lesson], tutor, [], NOW, TZ)?.minutes).toBe(10);
  });

  it('skips a cancelled lesson and a dismissed date', () => {
    const cancelled = upcoming({
      locations: [place()],
      cancellation: {
        note: null,
        cancelled_as: 'tutor',
        cancelled_by_user_id: 'tutor-1',
        created_at: NOW,
      } as never,
    });
    expect(pickReminder([cancelled], tutor, [], NOW, TZ)).toBeNull();
    expect(
      pickReminder([upcoming({ locations: [place()] })], tutor, ['sch-1:2026-10-08'], NOW, TZ),
    ).toBeNull();
  });

  it('reminds an admin only of the lessons they teach or take', () => {
    const others = upcoming({ locations: [place()] });
    expect(pickReminder([others], admin, [], NOW, TZ)).toBeNull();
    const own = upcoming({ locations: [place()], tutor_user_id: 'admin-1' });
    expect(pickReminder([own], admin, [], NOW, TZ)?.lesson.tutor_user_id).toBe('admin-1');
  });

  it('says nothing without a reader', () => {
    expect(pickReminder([upcoming({ locations: [place()] })], null, [], NOW, TZ)).toBeNull();
  });
});

describe('dismissed dates', () => {
  it('adds a key once, keeping only the latest', () => {
    expect(withDismissed(['a', 'b'], 'a')).toEqual(['b', 'a']);
    const many = Array.from({ length: DISMISSED_KEPT }, (_, i) => `k${i}`);
    const next = withDismissed(many, 'new');
    expect(next).toHaveLength(DISMISSED_KEPT);
    expect(next[0]).toBe('k1');
    expect(next.at(-1)).toBe('new');
  });

  it('reads back only a list of strings', () => {
    expect(parseDismissed(null)).toEqual([]);
    expect(parseDismissed('not json')).toEqual([]);
    expect(parseDismissed('{"a":1}')).toEqual([]);
    expect(parseDismissed('["a",2,"b"]')).toEqual(['a', 'b']);
  });
});

describe('copy', () => {
  it('counts down, then says it is starting', () => {
    expect(reminderTitle(12)).toBe('Your lesson starts in 12 minutes');
    expect(reminderTitle(1)).toBe('Your lesson is starting');
    expect(reminderTitle(0)).toBe('Your lesson is starting');
  });

  it('links only a web address', () => {
    expect(isLink('https://meet.example.com/x')).toBe(true);
    expect(isLink('Zoom id 123')).toBe(false);
    expect(isLink(null)).toBe(false);
  });
});
