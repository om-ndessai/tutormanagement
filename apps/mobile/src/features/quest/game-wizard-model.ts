// Ported from apps/web/src/features/quest/start-game-page.tsx @ 9eccdf2 (working tree): Draft, START,
// toRequest, fromConfig, summaryOf, the Review's rows, a favorite's tile and the wizard's words.
//
// Phase 47 (docs/quest-games-g2-plan.md, design 61): what the start wizard holds, and the request it
// sends at the end. `toRequest` and `fromConfig` are the web's, line for line: a single player sends no
// knockout, no late join and no most teams, with a team size of 1; "Everyone on their own" sends 1.
// Pure: no React, no api client.
import {
  GAME_LIMITS,
  gameLengthLabel,
  gameLevelLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  levelLabel,
  type CreateGameInput,
  type CreateGameRequest,
  type GameFavorite,
  type GameLevel,
  type GameMode,
  type GamePlayerMode,
} from '@tmi/shared';

/** What the wizard holds; the request is built from it at the end. */
export interface WizardDraft {
  level_id: string;
  /** Random: from `level_id` upward. */
  random: boolean;
  mode: GameMode;
  question_count: number;
  duration_minutes: number;
  right_points: number;
  wrong_points: number;
  knockout: boolean;
  players: GamePlayerMode;
  max_teams: number;
  /** Teams of several (true), or everyone on their own. */
  teams: boolean;
  max_team_size: number;
  late_join: boolean;
}

export const WIZARD_START: WizardDraft = {
  level_id: '',
  random: false,
  mode: 'count',
  question_count: 10,
  duration_minutes: 5,
  right_points: 1,
  wrong_points: 0,
  knockout: false,
  players: 'multi',
  max_teams: GAME_LIMITS.defaultTeams,
  teams: true,
  max_team_size: GAME_LIMITS.defaultTeamSize,
  late_join: false,
};

export function toRequest(draft: WizardDraft): CreateGameRequest {
  const multi = draft.players === 'multi';
  return {
    level_id: draft.level_id as CreateGameRequest['level_id'],
    level_scope: draft.random ? 'upward' : 'level',
    mode: draft.mode,
    ...(draft.mode === 'count'
      ? { question_count: draft.question_count }
      : { duration_minutes: draft.duration_minutes }),
    right_points: draft.right_points,
    wrong_points: draft.wrong_points,
    knockout: multi && draft.knockout,
    players: draft.players,
    ...(multi ? { max_teams: draft.max_teams } : {}),
    max_team_size: multi && draft.teams ? draft.max_team_size : 1,
    late_join: multi && draft.late_join,
  };
}

export function fromConfig(config: CreateGameInput): WizardDraft {
  return {
    level_id: config.level_id,
    random: config.level_scope === 'upward',
    mode: config.mode,
    question_count: config.question_count ?? WIZARD_START.question_count,
    duration_minutes: config.duration_minutes ?? WIZARD_START.duration_minutes,
    right_points: config.right_points,
    wrong_points: config.wrong_points,
    knockout: config.knockout,
    players: config.players,
    max_teams: config.players === 'multi' ? config.max_teams : WIZARD_START.max_teams,
    teams: config.max_team_size > 1,
    max_team_size: config.max_team_size > 1 ? config.max_team_size : WIZARD_START.max_team_size,
    late_join: config.late_join,
  };
}

/** The settings in words, for the Review and a favorite's tile. */
export function summaryOf(request: CreateGameRequest) {
  const view = {
    level_id: request.level_id,
    level_scope: request.level_scope ?? 'level',
    mode: request.mode,
    question_count: request.question_count ?? null,
    duration_seconds: request.duration_minutes ? request.duration_minutes * 60 : null,
    players: request.players ?? 'multi',
    max_teams: request.max_teams ?? GAME_LIMITS.maxTeams,
    max_team_size: request.max_team_size,
  };
  return {
    level: gameLevelLabel(view, levelLabel),
    length: gameLengthLabel(view),
    scoring: gameMarkingLabel({
      right_points: request.right_points ?? 1,
      wrong_points: request.wrong_points ?? 0,
    }),
    players: gamePlayersLabel(view),
  };
}

export type WizardStepKey = 'questions' | 'length' | 'scoring' | 'players';

/**
 * Each step's lines for its card on the Review: the web's rows, grouped by the step that sets them --
 * Knockout under Scoring and Joining under Players, for a multiplayer game only.
 */
export function reviewLines(request: CreateGameRequest): Record<WizardStepKey, string[]> {
  const words = summaryOf(request);
  const multi = (request.players ?? 'multi') === 'multi';
  return {
    questions: [words.level],
    length: [words.length],
    scoring: multi ? [words.scoring, `Knockout: ${request.knockout ? 'On' : 'Off'}`] : [words.scoring],
    players: multi
      ? [words.players, `Joining: ${request.late_join ? 'Open while it runs' : 'Closed once it starts'}`]
      : [words.players],
  };
}

/** A favorite's tile, under its name: "G6 · 10 questions · Up to 10 teams of up to 4". */
export function favoriteDetail(favorite: Pick<GameFavorite, 'config'>): string {
  const words = summaryOf(favorite.config);
  return `${words.level} · ${words.length} · ${words.players}`;
}

/** Whether a favorite's level still has questions to play here (the organization's bank changes). */
export function favoritePlayable(
  favorite: Pick<GameFavorite, 'config'>,
  levels: readonly GameLevel[],
): boolean {
  return levels.some((level) => level.level_id === favorite.config.level_id && level.available > 0);
}

/** Said when an unplayable favorite is tapped: "G6 has no questions to play here now." */
export function favoriteRefusal(favorite: Pick<GameFavorite, 'config'>): string {
  return `${levelLabel(favorite.config.level_id)} has no questions to play here now.`;
}

/** The first step's refusal: no level, or (Random) no lowest level; null when chosen. */
export function levelProblem(draft: Pick<WizardDraft, 'level_id' | 'random'>): string | null {
  if (draft.level_id) return null;
  return draft.random ? 'Choose the lowest level.' : 'Choose a level.';
}

/** The last action: a multiplayer game gets its code first; a single player's starts at once. */
export function submitLabel(players: GamePlayerMode): string {
  return players === 'multi' ? 'Generate game code' : 'Start game';
}

/** The Review's line under "Ready?". */
export function reviewHint(players: GamePlayerMode): string {
  return players === 'multi'
    ? 'Once you generate the code, the settings are fixed.'
    : 'The game starts as soon as you press Start game.';
}
