// The tutor's Now card (Phase 43): which state wins, the words with an injected clock, the
// "together since" wording and where Directions goes.
import type { Location, TutorHomeLesson } from '@tmi/shared';

import {
  briefSentence,
  canStartNow,
  celebrateHeadline,
  clockLabel,
  countdown,
  endedLine,
  homeworkReviewPrefill,
  lessonKey,
  lessonWhen,
  mapChoices,
  nextHeadline,
  nowGreeting,
  nowState,
  placeAction,
  togetherLine,
  type UnrecordedLesson,
} from './now-model';

const TODAY = '2026-10-20'; // a Tuesday

function place(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    owner_user_id: 'tutor-1',
    owner_name: 'Alex Chen',
    name: 'Chapel Hill Public Library',
    kind: 'physical',
    address: '100 Library Dr, Chapel Hill, NC 27514',
    reminder_minutes: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function lesson(overrides: Partial<TutorHomeLesson> = {}): TutorHomeLesson {
  return {
    schedule_id: 'sch-1',
    occurs_on: TODAY,
    start_time: '16:30',
    end_time: '17:30',
    mode: 'in_person',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    place: place(),
    lessons_together: 23,
    together_since: '2026-08-11',
    ...overrides,
  };
}

function unrecorded(overrides: Partial<UnrecordedLesson> = {}): UnrecordedLesson {
  return { ...lesson(), homework_last: 'pp. 48-53', ...overrides };
}

describe('nowState', () => {
  const none = new Set<string>();

  it('celebrates a finished, unrecorded lesson before anything else, a running lesson included', () => {
    const home = { unrecorded: [unrecorded()], next: lesson({ occurs_on: '2026-10-24' }) };
    expect(nowState(home, { running: true, later: none })).toEqual({ kind: 'celebrate', lesson: home.unrecorded[0] });
  });

  it('skips the lessons put off with Later, in order', () => {
    const first = unrecorded({ schedule_id: 'a' });
    const second = unrecorded({ schedule_id: 'b' });
    const home = { unrecorded: [first, second], next: lesson() };
    expect(nowState(home, { running: false, later: new Set([lessonKey(first)]) })).toEqual({
      kind: 'celebrate',
      lesson: second,
    });
    expect(nowState(home, { running: false, later: new Set([lessonKey(first), lessonKey(second)]) })).toEqual({
      kind: 'next',
      lesson: home.next,
    });
  });

  it('then a running lesson (the live bar says so), then the next, then nothing', () => {
    const next = lesson();
    expect(nowState({ unrecorded: [], next }, { running: true, later: none })).toEqual({ kind: 'running' });
    expect(nowState({ unrecorded: [], next }, { running: false, later: none })).toEqual({ kind: 'next', lesson: next });
    expect(nowState({ unrecorded: [], next: null }, { running: false, later: none })).toEqual({ kind: 'none' });
    expect(nowState(null, { running: false, later: none })).toEqual({ kind: 'none' });
  });

  it('keys a lesson by its series and date', () => {
    expect(lessonKey(lesson())).toBe(`sch-1:${TODAY}`);
  });
});

describe('the next lesson, in words', () => {
  // 3:12 PM on the organization's clock.
  const now = 15 * 60 + 12;

  it('today: the time and a countdown', () => {
    expect(nextHeadline(lesson(), TODAY, now)).toBe("Sofia's lesson is today at 4:30 PM, in 1 h 18 min");
    expect(lessonWhen(lesson({ start_time: '15:42' }), TODAY, now)).toBe('today at 3:42 PM, in 30 min');
    expect(lessonWhen(lesson({ start_time: '17:12' }), TODAY, now)).toBe('today at 5:12 PM, in 2 h');
  });

  it('under way once it has started', () => {
    expect(lessonWhen(lesson({ start_time: '15:00', end_time: '16:00' }), TODAY, now)).toBe(
      'under way, since 3:00 PM',
    );
  });

  it('tomorrow, a weekday this week, or a date further on', () => {
    expect(nextHeadline(lesson({ occurs_on: '2026-10-21', start_time: '08:00' }), TODAY, now)).toBe(
      "Sofia's lesson is tomorrow at 8:00 AM",
    );
    expect(lessonWhen(lesson({ occurs_on: '2026-10-24', start_time: '10:00' }), TODAY, now)).toBe(
      'Saturday at 10:00 AM',
    );
    expect(lessonWhen(lesson({ occurs_on: '2026-10-27', start_time: '16:00' }), TODAY, now)).toBe(
      'on Tuesday, Oct 27, at 4:00 PM',
    );
  });

  it('counts down in hours and minutes', () => {
    expect(countdown(78)).toBe('1 h 18 min');
    expect(countdown(45)).toBe('45 min');
    expect(countdown(120)).toBe('2 h');
    expect(countdown(0.4)).toBe('less than a minute');
    expect(clockLabel('08:05')).toBe('8:05 AM');
  });

  it('greets by the part of the day and the first name', () => {
    expect(nowGreeting('afternoon', 'Alex Chen')).toBe('Good afternoon, Alex');
    expect(nowGreeting('evening', null)).toBe('Good evening');
  });

  it('says where and the homework set last time in one sentence', () => {
    expect(briefSentence(lesson(), { homework: { assigned: 'Factor trees, pp. 48-53.', status_before: null } })).toBe(
      'In person at Chapel Hill Public Library. Last time you set: Factor trees, pp. 48-53.',
    );
    expect(
      briefSentence(lesson({ mode: 'virtual', place: place({ kind: 'virtual', name: "Ben's Zoom room" }) }), null),
    ).toBe("Online, Ben's Zoom room.");
    expect(briefSentence(lesson({ place: null, mode: 'virtual' }), { homework: null })).toBe('Online.');
  });

  it('offers Start from 15 minutes before the start until the end, on the day only', () => {
    expect(canStartNow(lesson(), TODAY, 16 * 60 + 14)).toBe(false);
    expect(canStartNow(lesson(), TODAY, 16 * 60 + 15)).toBe(true);
    expect(canStartNow(lesson(), TODAY, 17 * 60 + 29)).toBe(true);
    expect(canStartNow(lesson(), TODAY, 17 * 60 + 30)).toBe(false);
    expect(canStartNow(lesson({ occurs_on: '2026-10-21' }), TODAY, 16 * 60 + 20)).toBe(false);
  });
});

describe('the celebration, in words', () => {
  it('names the student and counts this lesson in', () => {
    expect(celebrateHeadline(lesson())).toBe('Yay! You completed one more lesson with Sofia');
    expect(togetherLine(lesson(), TODAY)).toBe("That's 24 together since August.");
  });

  it('a first lesson together, and a start in another year', () => {
    expect(togetherLine(lesson({ lessons_together: 0, together_since: null }), TODAY)).toBe(
      'Your first lesson together!',
    );
    expect(togetherLine(lesson({ lessons_together: 40, together_since: '2025-09-02' }), TODAY)).toBe(
      "That's 41 together since September 2025.",
    );
  });

  it('when it ended, today or yesterday', () => {
    expect(endedLine(lesson(), TODAY)).toBe('It ended at 5:30 PM.');
    expect(endedLine(lesson({ occurs_on: '2026-10-19' }), TODAY)).toBe('It ended yesterday at 5:30 PM.');
  });

  it('starts the Homework review with the homework set last time', () => {
    expect(homeworkReviewPrefill(' pp. 48-53 ')).toBe('Last time: pp. 48-53');
    expect(homeworkReviewPrefill(null)).toBe('');
    expect(homeworkReviewPrefill('   ')).toBe('');
  });
});

describe('the place', () => {
  it('Directions for a physical address, the link for a virtual place, nothing otherwise', () => {
    expect(placeAction(place())).toEqual({ kind: 'directions', address: '100 Library Dr, Chapel Hill, NC 27514' });
    expect(placeAction(place({ kind: 'virtual', address: 'https://zoom.us/j/123' }))).toEqual({
      kind: 'link',
      url: 'https://zoom.us/j/123',
    });
    // Joining instructions that are not a link are shown, never opened.
    expect(placeAction(place({ kind: 'virtual', address: 'Call 919 555 0100' }))).toEqual({ kind: 'none' });
    expect(placeAction(place({ address: null }))).toEqual({ kind: 'none' });
    expect(placeAction(null)).toEqual({ kind: 'none' });
  });

  it('Google Maps everywhere, Apple Maps offered too on iOS', () => {
    const address = '100 Library Dr, Chapel Hill';
    const google = 'https://www.google.com/maps/search/?api=1&query=100%20Library%20Dr%2C%20Chapel%20Hill';
    expect(mapChoices(address, 'android')).toEqual([{ label: 'Google Maps', url: google }]);
    expect(mapChoices(address, 'ios')).toEqual([
      { label: 'Google Maps', url: google },
      { label: 'Apple Maps', url: 'https://maps.apple.com/?q=100%20Library%20Dr%2C%20Chapel%20Hill' },
    ]);
  });
});
