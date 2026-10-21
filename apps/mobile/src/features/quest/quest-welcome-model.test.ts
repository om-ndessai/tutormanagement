// The welcome and the point's flight (owner, 2026-10-21): when the welcome opens, what it says, and
// where the "+1" flies.
import { QUEST_LEFT_CAP, type QuestState, type QuestSummary } from '@tmi/shared';

import {
  burstPath,
  burstText,
  leftLabel,
  streakLabel,
  welcomeContent,
  welcomeDecision,
} from './quest-welcome-model';

const SUMMARY: QuestSummary = {
  first_name: 'Sofia',
  level_id: 'BA3',
  points: 12,
  answered: 9,
  confirmed: 3,
  answered_today: 2,
  streak_days: 3,
  streak_at_risk: false,
  best_streak: 4,
  left_in_level: 57,
};

const STATE = {
  level_id: 'BA3',
  finished: false,
  question: { id: 'q1', kind: 'choice', stem: 'x', choices: ['1', '2', '3', '4'] },
} as unknown as QuestState;

describe('welcomeDecision', () => {
  it('waits for both reads', () => {
    expect(welcomeDecision({ summary: undefined, summaryFailed: false, state: STATE })).toBeUndefined();
    expect(welcomeDecision({ summary: SUMMARY, summaryFailed: false, state: undefined })).toBeUndefined();
  });
  it('opens with a level and a question waiting', () => {
    expect(welcomeDecision({ summary: SUMMARY, summaryFailed: false, state: STATE })).toBe(true);
  });
  it('stays shut when the summary failed, even before the state', () => {
    expect(welcomeDecision({ summary: undefined, summaryFailed: true, state: undefined })).toBe(false);
  });
  it('stays shut without a level', () => {
    expect(
      welcomeDecision({ summary: { ...SUMMARY, level_id: null }, summaryFailed: false, state: STATE }),
    ).toBe(false);
    expect(
      welcomeDecision({
        summary: SUMMARY,
        summaryFailed: false,
        state: { ...STATE, level_id: null } as QuestState,
      }),
    ).toBe(false);
  });
  it('stays shut when Quest is finished', () => {
    expect(
      welcomeDecision({
        summary: SUMMARY,
        summaryFailed: false,
        state: { ...STATE, finished: true, question: null } as QuestState,
      }),
    ).toBe(false);
  });
});

describe('welcomeContent', () => {
  it('uses the shared words and shows the numbers in order', () => {
    const content = welcomeContent(SUMMARY);
    expect(content.title).toBe('3 days in a row, Sofia!');
    expect(content.line).toContain('2 answered');
    expect(content.streak).toBe('🔥 3 days');
    expect(content.stats).toEqual([
      { key: 'points', label: 'Points', value: '12' },
      { key: 'answered', label: 'Answered', value: '9' },
      { key: 'approved', label: 'Approved', value: '3' },
      { key: 'today', label: 'Today', value: '2' },
      { key: 'left', label: 'Left in BA3', value: '57' },
    ]);
  });
  it('welcomes a first-timer by name, with no streak', () => {
    const content = welcomeContent({
      ...SUMMARY,
      points: 0,
      answered: 0,
      confirmed: 0,
      answered_today: 0,
      streak_days: 0,
      best_streak: 0,
    });
    expect(content.title).toBe('Welcome to Question Quest, Sofia!');
    expect(content.streak).toBeNull();
  });
  it('says 200+ at the cap', () => {
    const left = welcomeContent({ ...SUMMARY, left_in_level: QUEST_LEFT_CAP }).stats.at(-1);
    expect(left?.value).toBe('200+');
  });
});

describe('labels', () => {
  it('leftLabel', () => {
    expect(leftLabel(0)).toBe('0');
    expect(leftLabel(199)).toBe('199');
    expect(leftLabel(200)).toBe('200+');
  });
  it('streakLabel', () => {
    expect(streakLabel(0)).toBeNull();
    expect(streakLabel(1)).toBe('🔥 1 day');
    expect(streakLabel(5)).toBe('🔥 5 days');
  });
  it('burstText is what one answer earns', () => {
    expect(burstText()).toBe('+1');
    expect(burstText(2)).toBe('+2');
  });
});

describe('burstPath', () => {
  it('flies from the top middle of Submit to the middle of the points, in the frame', () => {
    const path = burstPath(
      { x: 16, y: 600, width: 300, height: 52 },
      { x: 100, y: 80, width: 80, height: 20 },
      { x: 0, y: 10, width: 390, height: 800 },
    );
    expect(path).toEqual({ start: { x: 166, y: 590 }, end: { x: 140, y: 80 } });
  });
});
