// The start wizard's model (Phase 47, design 61): what each kind of game sends, checked against the
// shared schema; a favorite's settings back into every step; the Review's lines; a favorite's tile and
// whether it can be played here; the first step's refusal; the last action's words.
import { createGameSchema, type GameFavorite, type GameLevel } from '@tmi/shared';

import {
  WIZARD_START,
  favoriteDetail,
  favoritePlayable,
  favoriteRefusal,
  fromConfig,
  levelProblem,
  reviewHint,
  reviewLines,
  submitLabel,
  summaryOf,
  toRequest,
  type WizardDraft,
} from './game-wizard-model';

const g6: WizardDraft = { ...WIZARD_START, level_id: 'NC26.6' };

describe('toRequest', () => {
  it('starts as the web does: 10 questions, right +1, wrong 0, up to 10 teams of up to 4, joining closed', () => {
    expect(toRequest(g6)).toEqual({
      level_id: 'NC26.6',
      level_scope: 'level',
      mode: 'count',
      question_count: 10,
      right_points: 1,
      wrong_points: 0,
      knockout: false,
      players: 'multi',
      max_teams: 10,
      max_team_size: 4,
      late_join: false,
    });
    expect(createGameSchema.safeParse(toRequest(g6)).success).toBe(true);
  });

  it('sends a single player no knockout, no late join, no most teams, and a team size of 1', () => {
    const request = toRequest({ ...g6, players: 'single', knockout: true, late_join: true, max_teams: 5 });
    expect(request).toEqual({
      level_id: 'NC26.6',
      level_scope: 'level',
      mode: 'count',
      question_count: 10,
      right_points: 1,
      wrong_points: 0,
      knockout: false,
      players: 'single',
      max_team_size: 1,
      late_join: false,
    });
    expect(createGameSchema.parse(request)).toMatchObject({
      players: 'single',
      max_teams: 1,
      max_team_size: 1,
    });
  });

  it('sends everyone on their own as a team size of 1, and teams of several as their size', () => {
    expect(toRequest({ ...g6, teams: false, max_team_size: 3 }).max_team_size).toBe(1);
    expect(toRequest({ ...g6, teams: true, max_team_size: 3 }).max_team_size).toBe(3);
    const parsed = createGameSchema.parse(
      toRequest({ ...g6, teams: false, knockout: true, wrong_points: -3, max_teams: 2, late_join: true }),
    );
    expect(parsed).toMatchObject({
      max_team_size: 1,
      knockout: true,
      wrong_points: -3,
      max_teams: 2,
      late_join: true,
    });
  });

  it('sends the length of its mode only, and Random as upward', () => {
    const timed = toRequest({ ...g6, mode: 'timed', duration_minutes: 7, random: true });
    expect(timed).toMatchObject({ mode: 'timed', duration_minutes: 7, level_scope: 'upward' });
    expect(timed).not.toHaveProperty('question_count');
    expect(createGameSchema.safeParse(timed).success).toBe(true);
  });
});

describe('fromConfig', () => {
  it('fills every step back from a saved game', () => {
    const drafts: WizardDraft[] = [
      g6,
      { ...g6, players: 'single' },
      {
        ...g6,
        teams: false,
        knockout: true,
        wrong_points: -2,
        right_points: 3,
        max_teams: 4,
        late_join: true,
      },
      { ...g6, mode: 'timed', duration_minutes: 12, random: true, max_team_size: 2 },
    ];
    for (const draft of drafts) {
      const config = createGameSchema.parse(toRequest(draft));
      expect(toRequest(fromConfig(config))).toEqual(toRequest(draft));
    }
  });

  it("keeps the wizard's defaults for what a single player's game does not carry", () => {
    const draft = fromConfig(createGameSchema.parse(toRequest({ ...g6, players: 'single' })));
    expect(draft).toMatchObject({ players: 'single', max_teams: 10, teams: false, max_team_size: 4 });
  });
});

describe('the words', () => {
  it("says each step's lines on the Review, with Knockout and Joining for a multiplayer game only", () => {
    expect(reviewLines(toRequest({ ...g6, knockout: true, late_join: true }))).toEqual({
      questions: ['G6'],
      length: ['10 questions'],
      scoring: ['Right +1, wrong 0', 'Knockout: On'],
      players: ['Up to 10 teams of up to 4', 'Joining: Open while it runs'],
    });
    expect(reviewLines(toRequest({ ...g6, wrong_points: -1 })).scoring).toEqual([
      'Right +1, wrong −1',
      'Knockout: Off',
    ]);
    expect(reviewLines(toRequest({ ...g6, teams: false })).players).toEqual([
      'Up to 10 players, each on their own',
      'Joining: Closed once it starts',
    ]);
    expect(
      reviewLines(toRequest({ ...g6, players: 'single', random: true, mode: 'timed', duration_minutes: 1 })),
    ).toEqual({
      questions: ['G6 and up, at random'],
      length: ['1 minute'],
      scoring: ['Right +1, wrong 0'],
      players: ['Single player'],
    });
    expect(summaryOf(toRequest(g6))).toEqual({
      level: 'G6',
      length: '10 questions',
      scoring: 'Right +1, wrong 0',
      players: 'Up to 10 teams of up to 4',
    });
  });

  const favorite: Pick<GameFavorite, 'config'> = { config: createGameSchema.parse(toRequest(g6)) };

  it("says a favorite's tile, and whether its level can be played here", () => {
    expect(favoriteDetail(favorite)).toBe('G6 · 10 questions · Up to 10 teams of up to 4');
    const levels: GameLevel[] = [
      { level_id: 'NC26.6', label: 'G6', available: 412 },
      { level_id: 'NC26.7', label: 'G7', available: 0 },
    ];
    expect(favoritePlayable(favorite, levels)).toBe(true);
    expect(favoritePlayable(favorite, [levels[1]!])).toBe(false);
    expect(favoritePlayable({ config: { ...favorite.config, level_id: 'NC26.7' } }, levels)).toBe(false);
    expect(favoriteRefusal(favorite)).toBe('G6 has no questions to play here now.');
  });

  it('refuses the first step without a level, or (Random) a lowest one', () => {
    expect(levelProblem(WIZARD_START)).toBe('Choose a level.');
    expect(levelProblem({ ...WIZARD_START, random: true })).toBe('Choose the lowest level.');
    expect(levelProblem(g6)).toBeNull();
  });

  it('names the last action and the Review’s hint by who plays', () => {
    expect(submitLabel('multi')).toBe('Generate game code');
    expect(submitLabel('single')).toBe('Start game');
    expect(reviewHint('multi')).toBe('Once you generate the code, the settings are fixed.');
    expect(reviewHint('single')).toBe('The game starts as soon as you press Start game.');
  });
});
