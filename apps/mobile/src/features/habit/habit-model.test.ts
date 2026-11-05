// Phase 64 (P17-P20): the words and decisions of My progress, the Play home's Daily and the Daily screen,
// and the Daily's result page. Phase 73 (JF16, JF23): My progress's one headline, and the Daily's one name and
// one level rule (shared `dailyLevelFor`, which the board and Next up both use).
import {
  DAILY_NAME,
  DEFAULT_TILES,
  dailyLevelFor,
  dailyShareText,
  tileWords,
  type DailyQuestion,
  type MemberTile,
} from '@tmi/shared';

import { dailyResultHtml, dailyResultSpeech, dailyResultText } from './daily-html';
import {
  PLAY_DAILY_LABEL,
  WELCOME_BACK_TEXT,
  dailyButtonLabel,
  dailyCardTitle,
  dailyRings,
  dailyRingsLabel,
  dailyGrid,
  dailyGridSpeech,
  dailyHeading,
  dailyProgress,
  daysLine,
  earnedOf,
  giveAnswer,
  levelTag,
  levelWords,
  nextBadgeLine,
  progressHeadline,
  secondsSince,
  streakLine,
  todayLabel,
  weekDotLabel,
} from './habit-model';

const member = (code: string): MemberTile => {
  const tile = DEFAULT_TILES.find((t) => t.code === code)!;
  return { ...tile, words: tileWords(tile), available: 300, beta: false };
};

describe('My progress', () => {
  it('words the streak, the week and the ring', () => {
    expect(streakLine(0)).toBe('Start a streak');
    expect(streakLine(1)).toBe('1 week in a row');
    expect(streakLine(12)).toBe('12 weeks in a row');
    expect(daysLine(0)).toBe('0 of 3 days this week');
    expect(daysLine(2)).toBe('2 of 3 days this week');
    // A week counts once it has its days: more are not shown.
    expect(daysLine(6)).toBe('3 of 3 days this week');
    expect(todayLabel(true)).toBe('Played today');
    expect(todayLabel(false)).toBe('Not played yet today');
  });

  it('says ONE state from the current run, never "Start a streak" beside a welcome (Phase 73, JF16; the web\'s words)', () => {
    expect(progressHeadline({ streak_weeks: 0, days_this_week: 0 })).toEqual({
      title: 'Start a streak',
      detail: 'Play on 3 days this week.',
      welcome: false,
    });
    expect(progressHeadline({ streak_weeks: 0, days_this_week: 1 })).toEqual({
      title: 'Start a streak',
      detail: '1 of 3 days this week. 2 to go.',
      welcome: false,
    });
    // Back after a week away: the welcome IS the state (no "Start a streak" with it), and no loss.
    const back = progressHeadline({ streak_weeks: 0, days_this_week: 0, welcome_back: true });
    expect(back).toEqual({
      title: 'Welcome back!',
      detail: 'A fresh week starts now: play 3 days to start a streak.',
      welcome: true,
    });
    expect(`${back.title} ${back.detail}`).not.toMatch(/lost|broke|missed|Start a streak/);
    // A streak this week has not yet kept: what keeps it.
    expect(progressHeadline({ streak_weeks: 4, days_this_week: 1 })).toEqual({
      title: '4-week streak',
      detail: 'Play 2 days more this week to keep it.',
      welcome: false,
    });
    expect(progressHeadline({ streak_weeks: 4, days_this_week: 2 }).detail).toBe('Play 1 day more this week to keep it.');
    // This week kept.
    expect(progressHeadline({ streak_weeks: 5, days_this_week: 4 })).toEqual({
      title: '5-week streak',
      detail: 'This week counts. Keep it going next week.',
      welcome: false,
    });
  });

  it('keeps the earned badges in the shared order', () => {
    const badges = [
      { id: 'first_quest', label: 'First quest', description: '', earned: true },
      { id: 'quests_10', label: '10 quests', description: '', earned: false },
      { id: 'daily_7', label: 'Seven Dailies', description: '', earned: true },
    ] as const;
    expect(earnedOf({ badges: [...badges] }).map((b) => b.id)).toEqual(['first_quest', 'daily_7']);
  });
});

describe('the Play home’s Daily (Phase 73: one rule, one name)', () => {
  const tiles = [member('BA3Q5'), member('G4Q5'), member('G4T10'), member('G5Q5')];
  it('is the lead grade’s first standard card’s level -- its harder track only without one -- else the first tile’s', () => {
    expect(dailyLevelFor(tiles, 4)).toBe('NC26.4');
    expect(dailyLevelFor(tiles, 5)).toBe('NC26.5');
    expect(dailyLevelFor(tiles, 3)).toBe('BA3');
    expect(dailyLevelFor(tiles, null)).toBe('BA3');
    expect(dailyLevelFor(tiles, 8)).toBe('BA3');
    expect(dailyLevelFor([], 4)).toBeNull();
  });

  it('says the Daily by its one name and its level in words', () => {
    expect(DAILY_NAME).toBe("Today's Daily");
    expect(dailyButtonLabel('NC26.4')).toBe("Today's Daily · Grade 4");
    expect(dailyButtonLabel('BA3')).toBe("Today's Daily · Beast Academy 3");
    expect(PLAY_DAILY_LABEL).toBe("Play today's Daily");
    expect(levelTag('NOPE')).toBe('NOPE');
    expect(levelWords('NC26.4')).toBe('Grade 4');
  });
});

describe('the Daily screen', () => {
  it('heads the result, draws the grid and counts the play', () => {
    expect(dailyHeading('NC26.4', 2, 4, 5)).toBe('G4D #2 · 4 of 5');
    expect(dailyGrid([true, true, false, true, true])).toBe('✓✓✗✓✓');
    expect(dailyGrid([false, false, false, false, false])).toBe('✗✗✗✗✗');
    expect(dailyGridSpeech([true, false])).toBe('1 of 2 right: 1 right, 2 wrong');
    expect(dailyProgress('NC26.4', 1, 5)).toBe('Grade 4 · question 2 of 5');
  });

  it('collects the answers, a skip as null, and is done on the last', () => {
    let state = giveAnswer([], '12', 3);
    expect(state).toEqual({ answers: ['12'], done: false });
    state = giveAnswer(state.answers, null, 3);
    expect(state.done).toBe(false);
    state = giveAnswer(state.answers, 'B', 3);
    expect(state).toEqual({ answers: ['12', null, 'B'], done: true });
  });

  it('counts whole seconds, never below zero', () => {
    expect(secondsSince(1_000, 133_400)).toBe(132);
    expect(secondsSince(5_000, 1_000)).toBe(0);
  });

  it('shares a grid that names nobody (the shared words)', () => {
    expect(dailyShareText(levelTag('NC26.4'), 42, [true, true, false, true, true], 133)).toBe(
      'Aimtrue G4D #42 ✓✓✗✓✓ 4/5 · 2:13',
    );
  });
});

describe('the Daily’s result page', () => {
  const questions: DailyQuestion[] = [
    { id: 'q1', kind: 'choice', stem: 'What is $2+2$?', choices: ['3', '4'], answer: '4', beta: false },
    { id: 'q2', kind: 'numeric', stem: 'Half of 10 <b>?</b>', choices: [], answer: '5', beta: true },
  ];

  it('lists each question with its mark, its stem and its key, escaped', () => {
    const html = dailyResultHtml(questions, [true, false], { errorColor: 'red' });
    expect(html).toContain('✓');
    expect(html).toContain('✗');
    expect(html).toContain('Answer: <b>');
    expect(html).toContain('katex');
    expect(html).not.toContain('<b>?</b>');
  });

  it('leaves out a key the server has not sent', () => {
    const unplayed = questions.map(({ answer: _answer, ...q }) => q);
    expect(dailyResultHtml(unplayed, [false, false], { errorColor: 'red' })).not.toContain('Answer:');
    expect(dailyResultText(unplayed, [false, false])).not.toContain('Answer:');
  });

  it('says the same in words and as plain text', () => {
    expect(dailyResultSpeech(questions, [true, false])).toMatch(/^Question 1, right\. .*Answer: 4\. Question 2, wrong\./);
    expect(dailyResultText(questions, [true, false])).toContain('✓ 1\n');
    expect(dailyResultText(questions, [true, false])).toContain('Answer: 5');
  });
});

describe('Phase 67 (H8): the week, welcome back, the next badge and the Daily rings', () => {
  it('reads each dot aloud by its day', () => {
    expect(weekDotLabel(0, 'played')).toBe('Monday: played');
    expect(weekDotLabel(3, 'missed')).toBe('Thursday: not played');
    expect(weekDotLabel(4, 'today')).toBe('Friday: today, not played yet');
    expect(weekDotLabel(6, 'ahead')).toBe('Sunday: still to come');
  });

  it('welcomes back without a word of loss, and names the next badge', () => {
    expect(WELCOME_BACK_TEXT).toBe('Welcome back! A fresh week starts now.');
    expect(WELCOME_BACK_TEXT).not.toMatch(/lost|broke|missed/i);
    expect(nextBadgeLine({ label: '10 quests', have: 4, need: 10 })).toBe('Next badge: 10 quests · 4 of 10');
  });

  it('fills the rings from the marks once played, else leaves them open', () => {
    expect(dailyRings(null)).toEqual(['open', 'open', 'open', 'open', 'open']);
    expect(dailyRings({ right: 2, of: 5, seconds: 30, marks: [true, false, true, false, false] })).toEqual([
      'hit',
      'miss',
      'hit',
      'miss',
      'miss',
    ]);
    expect(dailyCardTitle(null)).toBe('Five questions. Can you hit all five?');
    expect(dailyCardTitle({ right: 4, of: 5, seconds: 30, marks: [] })).toBe('You hit 4 of 5 today.');
    expect(dailyRingsLabel(null)).toBe('5 targets, not played yet');
    expect(dailyRingsLabel({ right: 4, of: 5, seconds: 30, marks: [] })).toBe('4 hit of 5');
  });
});
