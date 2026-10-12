import { upcoming } from '@/test/fixtures';
import { START_LEAD_MINUTES, lessonAtHand, nextUpActions } from './next-up-actions';

const TODAY = '2026-10-08';
const lesson = upcoming({ occurs_on: TODAY, start_time: '16:00', end_time: '17:00' });
const at = (h: number, m = 0) => h * 60 + m;

describe('lessonAtHand', () => {
  it('opens an hour before the start and closes at the end, today only', () => {
    expect(START_LEAD_MINUTES).toBe(60);
    expect(lessonAtHand(lesson, TODAY, at(14, 59))).toBe(false);
    expect(lessonAtHand(lesson, TODAY, at(15, 0))).toBe(true);
    expect(lessonAtHand(lesson, TODAY, at(16, 30))).toBe(true);
    expect(lessonAtHand(lesson, TODAY, at(17, 0))).toBe(false);
    expect(lessonAtHand(lesson, '2026-10-07', at(16, 0))).toBe(false);
  });

  it('is never at hand once cancelled', () => {
    const cancelled = { ...lesson, cancellation: { note: null } as never };
    expect(lessonAtHand(cancelled, TODAY, at(16))).toBe(false);
  });
});

describe('nextUpActions', () => {
  const base = { occurrence: lesson, today: TODAY, nowMinutes: at(15, 30), running: false };

  it("gives the lesson's own tutor Start, Record and Cancel while it is at hand", () => {
    expect(nextUpActions({ ...base, userId: 'tutor-1', isAdmin: false })).toEqual({
      start: true,
      record: true,
      cancel: true,
    });
  });

  it('keeps Cancel only, away from the window or while a lesson runs', () => {
    expect(nextUpActions({ ...base, nowMinutes: at(10), userId: 'tutor-1', isAdmin: false })).toEqual({
      start: false,
      record: false,
      cancel: true,
    });
    expect(nextUpActions({ ...base, running: true, userId: 'tutor-1', isAdmin: false })).toEqual({
      start: false,
      record: false,
      cancel: true,
    });
  });

  it('never offers an admin Start or Record for another tutor (the server starts as the caller)', () => {
    expect(nextUpActions({ ...base, userId: 'admin-1', isAdmin: true })).toEqual({
      start: false,
      record: false,
      cancel: true,
    });
  });

  it('offers nothing to anybody else, or before anyone is known', () => {
    const none = { start: false, record: false, cancel: false };
    expect(nextUpActions({ ...base, userId: 'tutor-2', isAdmin: false })).toEqual(none);
    expect(nextUpActions({ ...base, userId: undefined, isAdmin: false })).toEqual(none);
  });
});
