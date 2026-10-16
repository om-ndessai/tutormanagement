import type { SessionDraft, StudentProgress } from '@tmi/shared';

import { studentProgress, upcoming } from '@/test/fixtures';
import {
  CELEBRATED_KEEP,
  celebrationKey,
  celebrationLine,
  childNextLine,
  draftToFinish,
  firstName,
  greeting,
  lessonWhen,
  monthProgress,
  needsMoreUpcoming,
  nextLessonFor,
  parseCelebrated,
  partOfDay,
  recentlyMastered,
  summarizeToday,
  withCelebrated,
} from './home-model';

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('greeting', () => {
  it.each([
    [at(0, 0), 'evening'],
    [at(4, 59), 'evening'],
    [at(5, 0), 'morning'],
    [at(11, 59), 'morning'],
    [at(12, 0), 'afternoon'],
    [at(16, 59), 'afternoon'],
    [at(17, 0), 'evening'],
    [at(23, 59), 'evening'],
  ])('at minute %i of the day it is %s', (minutes, part) => {
    expect(partOfDay(minutes)).toBe(part);
  });

  it('wraps minutes outside the day', () => {
    expect(partOfDay(1440 + at(9))).toBe('morning');
    expect(partOfDay(-60)).toBe('evening');
  });

  it('uses the first name, and none when there is none', () => {
    expect(greeting('Priya Raghavan', at(14))).toBe('Good afternoon, Priya');
    expect(greeting('  Cher ', at(8))).toBe('Good morning, Cher');
    expect(greeting(null, at(20))).toBe('Good evening');
    expect(firstName('')).toBe('');
  });
});

describe('Today', () => {
  const TODAY = '2026-10-15';
  const sofia = upcoming({ occurs_on: TODAY, start_time: '16:00', end_time: '17:00' });
  const ben = upcoming({
    schedule_id: 'sch-2',
    occurs_on: TODAY,
    start_time: '18:00',
    end_time: '19:00',
    student_user_id: 'student-2',
    student_name: 'Ben Whitfield',
  });
  const tomorrow = upcoming({ schedule_id: 'sch-3', occurs_on: '2026-10-16' });
  const cancelled = (o: typeof sofia) => ({
    ...o,
    cancellation: { note: null } as unknown as NonNullable<typeof o.cancellation>,
  });

  it('counts the day and names the next lesson', () => {
    const today = summarizeToday({
      upcoming: [sofia, ben, tomorrow],
      recordedToday: 0,
      today: TODAY,
      nowMinutes: at(14),
      who: 'student',
    });
    expect(today.headline).toBe('2 lessons today');
    expect(today.detail).toBe('Next at 4:00 PM with Sofia');
    expect(today.underWay).toBe(false);
  });

  it('counts a lesson already recorded today', () => {
    const today = summarizeToday({
      upcoming: [ben],
      recordedToday: 1,
      today: TODAY,
      nowMinutes: at(17, 30),
      who: 'student',
    });
    expect(today.headline).toBe('2 lessons today');
    expect(today.detail).toBe('Next at 6:00 PM with Ben');
  });

  it('never makes a cancelled lesson the next one', () => {
    const today = summarizeToday({
      upcoming: [cancelled(sofia), ben],
      recordedToday: 0,
      today: TODAY,
      nowMinutes: at(9),
      who: 'student',
    });
    expect(today.headline).toBe('1 lesson today · 1 cancelled');
    expect(today.next?.student_name).toBe('Ben Whitfield');
  });

  it('says a lesson is under way, and names both sides for the office and families', () => {
    const today = summarizeToday({
      upcoming: [sofia],
      recordedToday: 0,
      today: TODAY,
      nowMinutes: at(16, 10),
      who: 'both',
    });
    expect(today.detail).toBe('Under way now: Sofia with Alex');
    const student = summarizeToday({
      upcoming: [sofia],
      recordedToday: 0,
      today: TODAY,
      nowMinutes: at(15),
      who: 'tutor',
    });
    expect(student.detail).toBe('Next at 4:00 PM with Alex');
  });

  it('is calm when there is nothing, and says when the day is done', () => {
    expect(
      summarizeToday({
        upcoming: [tomorrow],
        recordedToday: 0,
        today: TODAY,
        nowMinutes: at(9),
        who: 'student',
      }),
    ).toMatchObject({ headline: 'No lessons today', detail: 'Nothing on the schedule.', next: null });
    expect(
      summarizeToday({ upcoming: [], recordedToday: 2, today: TODAY, nowMinutes: at(20), who: 'student' }),
    ).toMatchObject({ headline: '2 lessons today', detail: 'All done for today.' });
    expect(
      summarizeToday({
        upcoming: [cancelled(sofia)],
        recordedToday: 0,
        today: TODAY,
        nowMinutes: at(9),
        who: 'student',
      }).headline,
    ).toBe('No lessons today · 1 cancelled');
  });

  it("finds one child's next lesson, skipping a cancelled date", () => {
    expect(nextLessonFor([cancelled(sofia), ben, tomorrow], 'student-1')?.schedule_id).toBe('sch-3');
    expect(nextLessonFor([ben], 'student-1')).toBeNull();
  });

  it('reads more pages only until the horizon is covered', () => {
    expect(needsMoreUpcoming([sofia], true, TODAY)).toBe(true);
    expect(needsMoreUpcoming([sofia, tomorrow], true, TODAY)).toBe(false);
    expect(needsMoreUpcoming([sofia], false, TODAY)).toBe(false);
    expect(needsMoreUpcoming([], true, TODAY)).toBe(true);
  });

  it("says a child's next lesson, or that it is under way", () => {
    expect(childNextLine(sofia, TODAY, at(15))).toBe('Next: Today at 4:00 PM with Alex Chen');
    expect(childNextLine(sofia, TODAY, at(16, 5))).toBe('Under way now with Alex Chen');
    expect(childNextLine(null, TODAY, at(9))).toBe('Nothing scheduled in the next two weeks');
  });

  it('says when a lesson is', () => {
    expect(lessonWhen(sofia, TODAY)).toBe('Today at 4:00 PM');
    expect(lessonWhen(tomorrow, TODAY)).toBe('Tomorrow at 4:00 PM');
    expect(lessonWhen({ occurs_on: '2026-10-22', start_time: '09:30' }, TODAY)).toBe(
      'Thu, Oct 22 at 9:30 AM',
    );
  });
});

describe("a child's month", () => {
  const progress = (overrides: Partial<StudentProgress>): StudentProgress => ({
    ...studentProgress,
    ...overrides,
  });
  const point = (occurred_on: string, percent: number) => ({
    session_id: occurred_on,
    occurred_on,
    tutor_name: 'Alex Chen',
    duration_minutes: 60,
    goal_rating: 4 as const,
    topics_rated: 1,
    percent,
  });

  it('counts the lessons and topics of this month, and how far the plan moved', () => {
    const month = monthProgress(
      progress({
        timeline: [point('2026-09-20', 15), point('2026-10-02', 20), point('2026-10-09', 25)],
        topics: [
          { topic_id: 'BA3.1', baseline: 2, current: 4, last_rated_on: '2026-10-09', mastered: true },
          { topic_id: 'BA3.2', baseline: 4, current: 5, last_rated_on: '2026-09-20', mastered: true },
        ],
      }),
      '2026-10-15',
    );
    expect(month.lessonsLine).toBe('2 lessons this month, 1 topic mastered');
    expect(month.planLine).toBe('25% of the plan mastered, up from 15%');
    expect(month.measured).toBe(true);
  });

  it('is calm with no lessons yet and no plan', () => {
    const month = monthProgress(progress({ plan: null, timeline: [] }), '2026-10-15');
    expect(month.lessonsLine).toBe('No lessons yet this month');
    expect(month.planLine).toBe('No learning plan yet');
    expect(month.measured).toBe(false);
    expect(monthProgress(null, '2026-10-15').planLine).toBe('No learning plan yet');
  });
});

describe('celebrations', () => {
  const withTopics = (topics: StudentProgress['topics']) => ({ ...studentProgress, topics });

  it('celebrates a topic at mastery scored within two weeks, not before and not below mastery', () => {
    const topics = recentlyMastered(
      withTopics([
        { topic_id: 'A', baseline: 2, current: 4, last_rated_on: '2026-10-01', mastered: true },
        { topic_id: 'B', baseline: 2, current: 5, last_rated_on: '2026-09-30', mastered: true },
        { topic_id: 'C', baseline: 2, current: 3, last_rated_on: '2026-10-14', mastered: false },
        { topic_id: 'D', baseline: null, current: null, last_rated_on: null, mastered: false },
      ]),
      '2026-10-15',
    );
    expect(topics).toEqual(['A']);
  });

  it('remembers each topic once, newest kept', () => {
    const key = celebrationKey('student-1', 'BA3.1');
    expect(key).toBe('student-1:BA3.1');
    expect(withCelebrated(['x', key], [key, 'y', 'y'])).toEqual(['x', key, 'y']);
    const many = Array.from({ length: CELEBRATED_KEEP }, (_, index) => `k${index}`);
    expect(withCelebrated(many, ['new'])).toHaveLength(CELEBRATED_KEEP);
    expect(withCelebrated(many, ['new']).at(-1)).toBe('new');
    expect(parseCelebrated('not json')).toEqual([]);
    expect(parseCelebrated('[1,"a"]')).toEqual(['a']);
  });

  it('says what was mastered', () => {
    expect(celebrationLine('Sofia', ['Fractions'])).toBe('Sofia mastered Fractions!');
    expect(celebrationLine('You', ['Fractions', 'Decimals'])).toBe('You mastered Fractions and Decimals!');
    expect(celebrationLine('Sofia', ['a', 'b', 'c'])).toBe('Sofia mastered 3 topics!');
  });
});

describe('Finish write-up', () => {
  const draft = (overrides: Partial<SessionDraft>): SessionDraft =>
    ({
      id: 'd1',
      tutor_user_id: 'tutor-1',
      occurred_on: '2026-10-15',
      updated_at: '2026-10-15T18:00:00Z',
      ...overrides,
    }) as SessionDraft;

  it("offers the tutor's latest draft from today only", () => {
    const found = draftToFinish(
      [
        draft({ id: 'old', occurred_on: '2026-10-14' }),
        draft({ id: 'a', updated_at: '2026-10-15T17:00:00Z' }),
        draft({ id: 'b', updated_at: '2026-10-15T19:00:00Z' }),
        draft({ id: 'other', tutor_user_id: 'tutor-2' }),
      ],
      '2026-10-15',
      'tutor-1',
    );
    expect(found?.draft.id).toBe('b');
    expect(found?.others).toBe(1);
    expect(draftToFinish([draft({ occurred_on: '2026-10-14' })], '2026-10-15', 'tutor-1')).toBeNull();
  });
});
