// Phase 64 (P17-P20): the words and decisions of My progress, the Play home's Daily and the Daily screen,
// and the Daily's result page.
import { DEFAULT_TILES, dailyShareText, tileWords, type DailyQuestion, type MemberTile } from '@tmi/shared';

import { dailyResultHtml, dailyResultSpeech, dailyResultText } from './daily-html';
import {
  dailyButtonLabel,
  dailyGrid,
  dailyGridSpeech,
  dailyHeading,
  dailyProgress,
  dailyTileFor,
  daysLine,
  earnedOf,
  giveAnswer,
  levelTag,
  levelWords,
  secondsSince,
  streakLine,
  todayLabel,
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

  it('keeps the earned badges in the shared order', () => {
    const badges = [
      { id: 'first_quest', label: 'First quest', description: '', earned: true },
      { id: 'quests_10', label: '10 quests', description: '', earned: false },
      { id: 'daily_7', label: 'Seven Dailies', description: '', earned: true },
    ] as const;
    expect(earnedOf({ badges: [...badges] }).map((b) => b.id)).toEqual(['first_quest', 'daily_7']);
  });
});

describe('the Play home’s Daily', () => {
  const tiles = [member('G4Q5'), member('BA3Q5')];
  it('is of the level last played, else the first tile’s, and none without tiles', () => {
    expect(dailyTileFor(tiles, 'BA3')?.code).toBe('BA3Q5');
    expect(dailyTileFor(tiles, null)?.code).toBe('G4Q5');
    expect(dailyTileFor(tiles, 'NC26.8')?.code).toBe('G4Q5');
    expect(dailyTileFor([], 'NC26.4')).toBeNull();
  });

  it('says the level’s Daily by its tag', () => {
    expect(dailyButtonLabel('NC26.4')).toBe("Today's Daily · G4D");
    expect(dailyButtonLabel('BA3')).toBe("Today's Daily · BA3D");
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
