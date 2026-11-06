import { playAgain, type OpenGameResponse } from '@tmi/shared';

import { quickActionItems, quickActionRoute } from './quick-actions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-quick-actions', () => ({
  initial: null,
  setItems: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const ORG = {};
const ASSESS_ONLY = { feature_tutoring: false, feature_assessment: true, canvas_assessments: true };

describe('home-screen quick actions', () => {
  it('are offered only to someone who teaches here, with generic verbs and nothing else', () => {
    expect(quickActionItems(['tutor'], ORG).map((item) => item.title)).toEqual([
      'Start a lesson',
      'Record a lesson',
    ]);
    expect(quickActionItems(['admin', 'tutor', 'parent'], ORG)).toHaveLength(2);
    for (const roles of [['admin'], ['parent'], ['student'], []] as const) {
      expect(quickActionItems(roles, ORG)).toEqual([]);
    }
    expect(quickActionItems(undefined, ORG)).toEqual([]);
    // A system surface: no name, no organization, no money -- only the two fixed titles.
    for (const item of quickActionItems(['tutor'], ORG)) {
      expect(Object.keys(item).sort()).toEqual(['icon', 'id', 'title']);
      expect(item.title).not.toMatch(/\$|[0-9]/);
    }
  });

  it('lead to their sheet only while the reader still teaches in this organization', () => {
    expect(quickActionRoute('start-lesson', ['tutor'], ORG)).toBe('/start-lesson');
    // Phase 75 (JF30): the lessons still owed, as every "Record a lesson" door.
    expect(quickActionRoute('record-session', ['tutor'], ORG)).toBe('/lessons-owed');
    expect(quickActionRoute('start-lesson', ['parent'], ORG)).toBeNull();
    expect(quickActionRoute('anything-else', ['tutor'], ORG)).toBeNull();
    expect(quickActionRoute(undefined, ['tutor'], ORG)).toBeNull();
  });

  it('are cleared in a space without Tutoring (Phase 50), even for a kept tutor', () => {
    expect(quickActionItems(['tutor'], ASSESS_ONLY)).toEqual([]);
    expect(quickActionItems(['admin', 'tutor'], null)).toEqual([]);
    expect(quickActionRoute('start-lesson', ['tutor'], ASSESS_ONLY)).toBeNull();
    expect(quickActionRoute('record-session', ['tutor'], ASSESS_ONLY)).toBeNull();
  });

  it('offer Continue where Quest is on, from the open-game read Home had: the game, else "again", naming nobody', () => {
    const QUEST = { feature_quest: true, gamify_question_quest: true };
    const shape = { level_id: 'NC26.4' as const, level_scope: 'level' as const, mode: 'timed' as const, question_count: null, duration_seconds: 600 };
    const open: OpenGameResponse = {
      open: { game_id: 'g-1', status: 'running', label: 'Grade 4 10-minute challenge · 3 points', question: null, of: null, points: 3 },
      again: null,
    };
    const again: OpenGameResponse = { open: null, again: playAgain(shape) };
    expect(quickActionItems(['student'], QUEST, open)).toEqual([
      { id: 'play-last', title: 'Continue your quest', icon: 'symbol:play.fill' },
    ]);
    expect(quickActionItems(['student'], QUEST, again)).toEqual([
      { id: 'play-last', title: 'Play Grade 4 10-minute challenge again', icon: 'symbol:play.fill' },
    ]);
    // A tutor in a Tutoring space with Quest on: the lesson actions, then Continue.
    expect(quickActionItems(['tutor'], QUEST, again).map((item) => item.title)).toEqual([
      'Start a lesson',
      'Record a lesson',
      'Play Grade 4 10-minute challenge again',
    ]);
    // Nothing to continue, nothing read yet, Quest off, or nobody signed in: none.
    expect(quickActionItems(['student'], QUEST, { open: null, again: null })).toEqual([]);
    expect(quickActionItems(['student'], QUEST, null)).toEqual([]);
    expect(quickActionItems(['student'], QUEST, undefined)).toEqual([]);
    expect(quickActionItems(['student'], { feature_quest: false }, again)).toEqual([]);
    expect(quickActionItems(undefined, QUEST, again)).toEqual([]);
    // A system surface: the open game's progress and any label a person typed never reach the icon.
    expect(quickActionItems(['student'], QUEST, open)[0]!.title).not.toMatch(/point|question/);
  });

  it('lead "Play" to the last-quest screen only while Quest is on', () => {
    const QUEST = { feature_quest: true, gamify_question_quest: true };
    expect(quickActionRoute('play-last', ['student'], QUEST)).toBe('/quest/play-last');
    expect(quickActionRoute('play-last', ['student'], { feature_quest: false })).toBeNull();
    expect(quickActionRoute('play-last', undefined, QUEST)).toBeNull();
  });
});
