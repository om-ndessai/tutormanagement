// Phase 75 (JF19, JF30): one way to record a lesson the schedule knows -- its draft when the reader has one, else
// "Record a lesson" filled in from the schedule -- from every door, in the space's own clock, with no money.
import type { LessonOwed, SessionDraft } from '@tmi/shared';

import {
  draftForLesson,
  draftSavedLine,
  knownLessonHref,
  owedAsKnown,
  owedLine,
  owedShowsTutor,
  runningLine,
} from './lessons-owed-model';
import { refusalLines } from './refusal';

const row = (overrides: Partial<LessonOwed> = {}): LessonOwed => ({
  schedule_id: 'sch-1',
  occurs_on: '2026-11-03',
  start_time: '16:00',
  end_time: '17:00',
  mode: 'in_person',
  tutor_user_id: 'tutor-1',
  tutor_name: 'Alex Chen',
  student_user_id: 'stu-1',
  student_name: 'Yusuf Haddad',
  place: { name: 'Institute, room 2', kind: 'physical' },
  draft: null,
  ...overrides,
});

describe('a lesson owed', () => {
  it('opens "Record a lesson" filled in from the schedule, the place by name only', () => {
    expect(knownLessonHref(owedAsKnown(row()))).toEqual({
      pathname: '/record-as-planned',
      params: {
        student: 'stu-1',
        tutor: 'tutor-1',
        date: '2026-11-03',
        start: '16:00',
        end: '17:00',
        mode: 'in_person',
        place: 'Institute, room 2',
      },
    });
  });

  it('opens the reader’s draft of it instead, never a second one', () => {
    expect(knownLessonHref(owedAsKnown(row({ draft: { id: 'd-1', updated_at: '2026-11-03T17:43:00Z' } })))).toEqual({
      pathname: '/record-lesson',
      params: { draft: 'd-1' },
    });
  });

  it('says when its draft was kept, on the space’s clock, with the day when not today', () => {
    const draft = { updated_at: '2026-11-03T17:43:00Z' };
    expect(draftSavedLine(draft, 'America/New_York', '2026-11-03')).toBe('Draft saved 12:43 PM');
    expect(draftSavedLine(draft, 'America/New_York', '2026-11-05')).toBe('Draft saved Tue, Nov 3, 12:43 PM');
    // Another space's clock reads the same instant differently.
    expect(draftSavedLine(draft, 'Europe/London', '2026-11-03')).toBe('Draft saved 5:43 PM');
  });

  it('reads as a line: the day, the times, the tutor for the office, the place', () => {
    expect(owedLine(row(), '2026-11-03', false)).toBe('Today, 4:00–5:00 PM · Institute, room 2');
    expect(owedLine(row({ place: null }), '2026-11-05', true)).toBe('Tue, Nov 3, 4:00–5:00 PM with Alex Chen');
    expect(owedShowsTutor([row()], 'tutor-1')).toBe(false);
    expect(owedShowsTutor([row(), row({ tutor_user_id: 'tutor-2' })], 'admin-1')).toBe(true);
  });

  it('finds the reader’s draft of a lesson by tutor, student and date -- the newest', () => {
    const drafts = [
      { id: 'old', tutor_user_id: 't', student_user_id: 's', occurred_on: '2026-11-03', updated_at: '2026-11-03T10:00:00Z' },
      { id: 'new', tutor_user_id: 't', student_user_id: 's', occurred_on: '2026-11-03', updated_at: '2026-11-03T12:00:00Z' },
      { id: 'day', tutor_user_id: 't', student_user_id: 's', occurred_on: '2026-11-02', updated_at: '2026-11-03T13:00:00Z' },
      { id: 'other', tutor_user_id: 'x', student_user_id: 's', occurred_on: '2026-11-03', updated_at: '2026-11-03T14:00:00Z' },
    ] as SessionDraft[];
    expect(draftForLesson(drafts, { student: 's', tutor: 't', date: '2026-11-03' })?.id).toBe('new');
    expect(draftForLesson(drafts, { student: 's', date: '2026-11-02' })?.id).toBe('day');
    expect(draftForLesson(drafts, { student: 's', tutor: 't' })).toBeNull();
    expect(draftForLesson(drafts, { student: 'nobody', date: '2026-11-03' })).toBeNull();
  });
});

describe('a lesson under way', () => {
  it('says how long it has run, in whole minutes', () => {
    const start = '2026-11-05T16:00:00Z';
    expect(runningLine(start, Date.parse('2026-11-05T16:12:40Z'))).toBe('Running 12 min');
    expect(runningLine(start, Date.parse('2026-11-05T17:05:00Z'))).toBe('Running 1 hr 5 min');
    expect(runningLine(start, Date.parse('2026-11-05T18:00:00Z'))).toBe('Running 2 hr');
    expect(runningLine(start, Date.parse('2026-11-05T15:59:00Z'))).toBe('Running 0 min');
  });
});

describe('a refusal, said once (JF18)', () => {
  it('prints the message, then any field’s other words -- never the mode’s repeat', () => {
    const words = "Ask the office to set Yusuf's price.";
    expect(refusalLines(words, { mode: words })).toEqual([words]);
    expect(refusalLines(words, { mode: words, ended_at: 'The end time must be after the start time.' })).toEqual([
      words,
      'The end time must be after the start time.',
    ]);
    // A field the sheet shows under its own input stays there.
    expect(refusalLines('Check the notes.', { notes: 'Too long.' }, ['notes'])).toEqual(['Check the notes.']);
  });
});
