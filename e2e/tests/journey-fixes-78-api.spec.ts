import {
  AUDIT_ACTION_LABELS,
  CHECKED_QUESTIONS_COPY,
  COMMON_COPY,
  GAME_CODE_NOT_FOUND_MESSAGE,
  NOTIFICATION_KIND_LABELS,
  QUICK_ACTIONS,
  QUICK_ACTION_LABELS,
  SIGNED_OUT_MESSAGE,
  TERMS,
  countOf,
  dayInWords,
  formatDay,
  formatDaySpan,
  formatInstant,
  formatInstantTime,
  formatMonthShort,
  instantDay,
  lessonDayWords,
  lessonWhen,
  quickActionLabel,
  readableDates,
  todayIn,
} from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 78 (docs/journey-fixes-plan.md, JF32 and JF35), the contract's half: one word per thing, and one date
 * formatter.
 *
 * JF32 -- the glossary (packages/shared/src/words.ts) is what both clients read: "lesson", never "session" (the sign-in
 * sense too: "You were signed out"); "person"/"people", never "user(s)"; "quest" for anything played on the board, named
 * in words ("Grade 4 Quick 5"), never "Quest game"; "space". The Worker's messages, the labels and NEW audit lines say
 * them; the codes, routes, audit keys and error codes are unchanged; "Beta" is gone from what a reader sees (the
 * assessment PDF is titled "Assessment").
 *
 * JF35 -- dates.ts: a calendar day reads as the day it names in every time zone (composed from its digits, as a Date at
 * UTC noon prints it); an instant reads on the space's clock; the older helpers print what they always did.
 */

test.describe('Phase 78: the date formatter (dates.ts)', () => {
  const TODAY = '2026-11-05'; // a Thursday

  test('a calendar day: plain, with its weekday, relative, and with the year only when it is not this one', () => {
    expect(formatDay('2026-11-05', TODAY)).toBe('Nov 5');
    expect(formatDay('2026-11-03', TODAY, { weekday: true })).toBe('Tue, Nov 3');
    expect(formatDay('2025-11-05', TODAY)).toBe('Nov 5, 2025');
    expect(formatDay('2025-11-05', TODAY, { weekday: true })).toBe('Wed, Nov 5, 2025');
    expect(formatDay('2026-11-05', TODAY, { relative: true })).toBe('Today');
    expect(formatDay('2026-11-06', TODAY, { relative: true })).toBe('Tomorrow');
    expect(formatDay('2026-11-04', TODAY, { relative: true })).toBe('Yesterday');
    expect(formatDay('2026-11-10', TODAY, { relative: true, weekday: true })).toBe('Tue, Nov 10');
    expect(formatDay('2026-03-01', TODAY, { year: 'always' })).toBe('Mar 1, 2026');
    expect(formatDay('2027-01-02', TODAY, { year: 'never', weekday: true })).toBe('Sat, Jan 2');
    // Across the new year, the year is said.
    expect(formatDay('2027-01-04', '2026-12-30', { weekday: true })).toBe('Mon, Jan 4, 2027');
    // Not a day: handed back as it came.
    expect(formatDay('soon', TODAY)).toBe('soon');
    expect(formatDay('2026-13-01', TODAY)).toBe('2026-13-01');
  });

  test('the same words as en-US at UTC noon, for every day of two years', () => {
    const start = Date.UTC(2025, 0, 1);
    for (let i = 0; i < 730; i += 1) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const noon = new Date(`${day}T12:00:00Z`);
      const sameYear = day.slice(0, 4) === TODAY.slice(0, 4);
      const year = sameYear ? {} : { year: 'numeric' as const };
      expect(formatDay(day, TODAY), day).toBe(noon.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...year, timeZone: 'UTC' }));
      expect(formatDay(day, TODAY, { weekday: true }), day).toBe(
        noon.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...year, timeZone: 'UTC' }),
      );
      expect(formatDay(day, TODAY, { year: 'always' }), day).toBe(noon.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }));
    }
  });

  test("an instant, on the space's clock: the day can differ from UTC's, and the year from the device's", () => {
    // 03:30 UTC on Nov 6 is still Nov 5 in New York (EST, UTC-5), and already Nov 6 in Tokyo.
    const late = '2026-11-06T03:30:00.000Z';
    expect(formatInstant(late, 'America/New_York', { today: TODAY })).toBe('Nov 5, 10:30 PM');
    expect(formatInstant(late, 'America/New_York', { today: TODAY, relative: true })).toBe('Today, 10:30 PM');
    expect(formatInstant(late, 'America/New_York', { today: TODAY, weekday: true })).toBe('Thu, Nov 5, 10:30 PM');
    expect(formatInstant(late, 'Asia/Tokyo', { today: '2026-11-06', relative: true })).toBe('Today, 12:30 PM');
    expect(formatInstant(late, 'America/New_York', { today: TODAY, time: false })).toBe('Nov 5');
    expect(formatInstant('2025-12-31T17:00:00Z', 'America/New_York', { today: TODAY })).toBe('Dec 31, 2025, 12:00 PM');
    expect(formatInstantTime(late, 'America/Los_Angeles')).toBe('7:30 PM');
    expect(instantDay(late, 'America/New_York')).toBe('2026-11-05');
    expect(instantDay(late, 'UTC')).toBe('2026-11-06');
    expect(todayIn('America/New_York', new Date(late))).toBe('2026-11-05');
    // Without `today`, the year is decided on the space's clock now: this year's day has none.
    const now = new Date().toISOString();
    expect(formatInstant(now, 'America/New_York', { time: false })).not.toMatch(/, \d{4}$/);
    expect(formatInstant('not a date', 'America/New_York')).toBe('not a date');
  });

  test("a schedule's span, and a server's sentence with days in it", () => {
    expect(formatDaySpan('2026-09-01', '2026-12-20', TODAY)).toBe('from Sep 1 to Dec 20');
    expect(formatDaySpan('2026-09-01', null, TODAY)).toBe('from Sep 1, ongoing');
    expect(formatDaySpan('2026-09-01', '2027-06-10', TODAY)).toBe('from Sep 1 to Jun 10, 2027');
    expect(readableDates('Commented on the 2026-09-15 lesson with Sofia Okafor', TODAY)).toBe(
      'Commented on the Sep 15 lesson with Sofia Okafor',
    );
    expect(readableDates('from 2025-12-01 to 2026-01-31', TODAY)).toBe('from Dec 1, 2025 to Jan 31');
    expect(readableDates('no dates here', TODAY)).toBe('no dates here');
  });

  test('the older helpers print what they did: dayInWords, lessonWhen, lessonDayWords, formatMonthShort', () => {
    expect(dayInWords(TODAY, TODAY)).toBe('today');
    expect(dayInWords('2026-11-06', TODAY)).toBe('tomorrow');
    expect(dayInWords('2026-11-04', TODAY)).toBe('yesterday');
    expect(dayInWords('2026-11-09', TODAY)).toBe('Mon');
    expect(dayInWords('2026-11-11', TODAY)).toBe('Wed');
    expect(dayInWords('2026-11-12', TODAY)).toBe('Thu, Nov 12');
    expect(dayInWords('2026-10-01', TODAY)).toBe('Thu, Oct 1');
    // Never a year: it says when something is coming up or just was.
    expect(dayInWords('2027-01-14', '2026-12-30')).toBe('Thu, Jan 14');
    expect(lessonWhen(TODAY, '16:00', TODAY)).toBe('today at 4:00 PM');
    expect(lessonWhen('2026-11-10', '09:30', TODAY)).toBe('Tue at 9:30 AM');
    expect(lessonDayWords('2026-11-06', TODAY)).toBe("tomorrow's lesson");
    expect(lessonDayWords('2026-11-10', TODAY)).toBe("Tuesday's lesson");
    expect(formatMonthShort('2026-03')).toBe('Mar');
    expect(formatMonthShort('2026-12')).toBe('Dec');
    expect(formatMonthShort('nope')).toBe('nope');
  });
});

test.describe('Phase 78: one word per thing (words.ts)', () => {
  test('the glossary, its counts, and the quick actions worded once for both clients', () => {
    expect(TERMS.lesson).toEqual({ one: 'lesson', many: 'lessons', One: 'Lesson', Many: 'Lessons' });
    expect(TERMS.person.many).toBe('people');
    expect(TERMS.quest.One).toBe('Quest');
    expect(TERMS.space.Many).toBe('Spaces');
    expect(countOf(1, 'lesson')).toBe('1 lesson');
    expect(countOf(3, 'person')).toBe('3 people');
    expect(countOf(0, 'quest')).toBe('0 quests');
    expect(COMMON_COPY.lessons_page).toBe('Lessons');
    expect(COMMON_COPY.people_page).toBe('People');
    expect(COMMON_COPY.add_person).toBe('Add a person');
    expect(SIGNED_OUT_MESSAGE).toBe('You were signed out. Please sign in again.');

    expect(Object.keys(QUICK_ACTION_LABELS).sort()).toEqual([...QUICK_ACTIONS].sort());
    expect(QUICK_ACTION_LABELS.new_quest).toBe('New quest');
    expect(QUICK_ACTION_LABELS.add_person).toBe('Add a person');
    expect(quickActionLabel('add_person', { personal: true })).toBe('Add my child');
    expect(quickActionLabel('add_person')).toBe('Add a person');
    expect(quickActionLabel('record_lesson', { personal: true })).toBe('Record a lesson');
  });

  test('no label a reader sees says session, user, Quest game or Beta; the keys are unchanged', () => {
    const OLD = /\bsessions?\b|\busers?\b|\bquest games?\b|\bbeta\b|organi[sz]ation/i;
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) expect(label, action).not.toMatch(OLD);
    for (const [kind, label] of Object.entries(NOTIFICATION_KIND_LABELS)) expect(label, kind).not.toMatch(OLD);
    for (const words of [...Object.values(COMMON_COPY), ...Object.values(QUICK_ACTION_LABELS), ...Object.values(CHECKED_QUESTIONS_COPY)]) {
      expect(words).not.toMatch(OLD);
    }
    expect(CHECKED_QUESTIONS_COPY.included).toContain('served like any other');
    // The keys stay: older apps and the log read them.
    expect(AUDIT_ACTION_LABELS['session.recorded']).toBe('Lesson recorded');
    expect(AUDIT_ACTION_LABELS['user.created']).toBe('Person added');
    expect(AUDIT_ACTION_LABELS['quest.game_created']).toBe('Quest started');
    expect(NOTIFICATION_KIND_LABELS.session_recorded).toBe('Lesson recorded');
    expect(GAME_CODE_NOT_FOUND_MESSAGE).not.toMatch(/\bgames?\b/i);
  });

  test("the Worker's messages say lesson, person and quest; the error codes are unchanged", async ({ as }) => {
    const admin = await as('admin');

    const nobody = await admin.request.get('/api/users/00000000-0000-4000-8000-00000000dead');
    expect(nobody.status()).toBe(404);
    expect((await nobody.json()).error).toMatchObject({ code: 'not_found', message: 'That person does not exist.' });

    const noLesson = await admin.request.get('/api/sessions/00000000-0000-4000-8000-00000000dead');
    expect(noLesson.status()).toBe(404);
    expect((await noLesson.json()).error).toMatchObject({ code: 'not_found', message: 'That lesson does not exist.' });

    const notRunning = await admin.request.delete('/api/sessions/active');
    expect(notRunning.status()).toBe(404);
    expect((await notRunning.json()).error).toMatchObject({ code: 'not_found', message: 'You have no lesson running.' });

  });

  test('a new log line names the quest in words, never "Quest game" or a tile code; a code nobody has says quest', async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.4', mode: 'count', question_count: 5, players: 'single', max_team_size: 1 },
        }),
        'a single-player quest',
      );
      // A code nobody has: the honest words, in the glossary's.
      const code = await admin.request.post('/api/quest/games/lookup', { data: { code: 'ZZZZZZ' } });
      expect(code.status()).toBe(404);
      const message = (await code.json()).error.message as string;
      expect(message).toBe(GAME_CODE_NOT_FOUND_MESSAGE);
      expect(message).toContain('No quest in this space has that code.');

      const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=20'), 'the log');
      const line = log.find((row) => row.action === 'quest.game_created' && row.entity_id === game.id);
      expect(line.description).toBe('Started a single-player Grade 4 Quick 5 quest');
      // Ending it says the same words.
      expect((await admin.request.post(`/api/quest/games/${game.id}/end`)).status()).toBe(200);
      const after = await unwrap<any[]>(await admin.request.get('/api/audit?limit=20'), 'the log');
      const ended = after.find((row) => row.action === 'quest.game_ended' && row.entity_id === game.id);
      expect(ended.description).toBe('Ended a single-player Grade 4 Quick 5 quest');
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });
});
