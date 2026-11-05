import { guestLevelPlace, guestTileDetail, guestTileTitle } from './guest-board.js';
import { QUEST_GRADE_NOT_IN_SCHOOL, TILE_LEVEL_WORDS, tileGameRequest, type MemberTile, type QuestLead, type TileShape } from './quest-tiles.js';
import type { CreateGameRequest } from './quest-games.js';
import type { QuestionBankLevelId } from './questions.js';

// ---------------------------------------------------------------------------
// How a tile looks (Phase 67, H5 in docs/member-home-plan.md)
// ---------------------------------------------------------------------------
// One hue per grade, 1-8 (`--grade-N` tokens, the same in every palette). A harder track (Beast
// Academy, AoPS, Kangaroo) takes its grade's hue with an "Adv" mark; a level off the row (Kindergarten,
// Math 1, Kangaroo 9-12) has no hue and wears the brand's. The mode is an icon, and a tile always says
// its level in words, so colour is never the only signal (WCAG 1.4.1). Members read real curriculum
// names; masking stays the guest page's rule. Pure, so the web and the app agree.

/** The grades that have a hue, 1-8. */
export const TILE_GRADES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type TileGrade = (typeof TILE_GRADES)[number];

/** A level's grade on the row (1-8), or null for one off it. A track spanning two grades takes the first. */
export function levelGrade(level: QuestionBankLevelId): TileGrade | null {
  const grade = guestLevelPlace(level)?.grades[0];
  return TILE_GRADES.find((g) => g === grade) ?? null;
}

/** Whether a level is a harder track than its grade's standards. */
export function levelAdvanced(level: QuestionBankLevelId): boolean {
  return guestLevelPlace(level)?.advanced ?? false;
}

/** The mode's icon: a target for a number of questions, a timer for minutes, a pencil for handwriting. */
export type TileIcon = 'target' | 'timer' | 'pencil';

export interface TileLook {
  /** The grade whose hue it wears, or null (the brand's). */
  grade: TileGrade | null;
  advanced: boolean;
  icon: TileIcon;
  /** "Quick 5", "10-minute challenge", "Show your work". */
  title: string;
  /** "5 questions", "Beat the clock", "5 questions, by hand". */
  detail: string;
  /** The level in real words: "Grade 4", "Beast Academy 3". */
  level: string;
}

export function tileLook(tile: TileShape): TileLook {
  return {
    grade: levelGrade(tile.level_id),
    advanced: levelAdvanced(tile.level_id),
    icon: tile.kind === 'assessment' ? 'pencil' : tile.mode === 'timed' ? 'timer' : 'target',
    title: guestTileTitle(tile),
    detail: guestTileDetail(tile),
    level: TILE_LEVEL_WORDS[tile.level_id],
  };
}

/** A tile in a sentence, for a screen reader: "Quick 5, Grade 4, 5 questions". */
export function tileSpoken(tile: TileShape): string {
  const look = tileLook(tile);
  return `${look.title}, ${look.level}, ${look.detail}`;
}

/** The grades a member's tiles reach, in order: the grade row shows these and no others. */
export function boardGrades(tiles: readonly TileShape[]): TileGrade[] {
  const present = new Set(tiles.map((tile) => levelGrade(tile.level_id)));
  return TILE_GRADES.filter((g) => present.has(g));
}

/**
 * The Quest board's grade for a member: the grade of the level they played last (or a guest's carried
 * level), else the first grade with tiles. Null when no tile is on the row at all.
 */
export function boardLeadGrade(tiles: readonly TileShape[], lead?: QuestionBankLevelId | null): TileGrade | null {
  const grades = boardGrades(tiles);
  const fromLead = lead ? levelGrade(lead) : null;
  if (fromLead && grades.includes(fromLead)) return fromLead;
  return grades[0] ?? null;
}

/**
 * Phase 73 (JF14, owner 2026-11-05): the grade that leads a member's Quest board and their Daily, in this order:
 * 1. the grade they picked on the row here (0, "Not in school", leads with the top of the row);
 * 2. the level the space records for a student;
 * 3. the level they played last;
 * 4. for anyone 13 or older, the top of the row.
 * Null when none of these says: then they are asked once ("Which grade?").
 */
export function questLeadGrade(
  tiles: readonly TileShape[],
  input: { picked: number | null; recorded: QuestionBankLevelId | null; played: QuestionBankLevelId | null; grown: boolean },
): QuestLead | null {
  const grades = boardGrades(tiles);
  const top = grades[grades.length - 1];
  if (top === undefined) return null;
  const onRow = (grade: number | null): TileGrade | null =>
    grade !== null && (grades as readonly number[]).includes(grade) ? (grade as TileGrade) : null;
  if (input.picked !== null) {
    const picked = input.picked === QUEST_GRADE_NOT_IN_SCHOOL ? top : onRow(input.picked);
    if (picked !== null) return { grade: picked, from: 'picked' };
  }
  const recorded = input.recorded ? onRow(levelGrade(input.recorded)) : null;
  if (recorded !== null) return { grade: recorded, from: 'recorded' };
  const played = input.played ? onRow(levelGrade(input.played)) : null;
  if (played !== null) return { grade: played, from: 'played' };
  return input.grown ? { grade: top, from: 'age' } : null;
}

/**
 * Phase 73 (JF14, JF23): ONE rule for a member's Daily, on the board and in Next up alike: the level of the lead
 * grade's first card (its standard first), else the first tile's.
 */
export function dailyLevelFor<T extends MemberTile>(tiles: readonly T[], grade: number | null): QuestionBankLevelId | null {
  if (grade !== null) {
    const { standard, advanced } = memberBoard(tiles, grade);
    const first = standard[0] ?? advanced[0];
    if (first) return first.level_id;
  }
  return tiles[0]?.level_id ?? null;
}

/** A game's settings, as the open-game read carries them. */
export interface GameShapeRow {
  level_id: QuestionBankLevelId;
  level_scope: 'level' | 'upward';
  mode: 'count' | 'timed';
  question_count: number | null;
  duration_seconds: number | null;
}

/** "Grade 7 Quick 5": a game in words, never codes (Phase 73, JF13, JF32). */
export function gameWords(game: GameShapeRow): string {
  const value = game.mode === 'timed' ? Math.round((game.duration_seconds ?? 0) / 60) : (game.question_count ?? 0);
  const level = `${TILE_LEVEL_WORDS[game.level_id] ?? game.level_id}${game.level_scope === 'upward' ? ' and up' : ''}`;
  return `${level} ${guestTileTitle({ kind: 'quest', level_id: game.level_id, mode: game.mode, value })}`;
}

/** Continue's words for an open game: "Grade 7 Quick 5 · question 3 of 5 · 2 points", or "· waiting to start". */
export function openGameLabel(
  game: GameShapeRow & { status: 'lobby' | 'running'; question: number | null; of: number | null; points: number | null },
): string {
  const parts = [gameWords(game)];
  if (game.status === 'lobby') parts.push('waiting to start');
  else {
    if (game.mode === 'count' && game.question !== null && game.of !== null) parts.push(`question ${game.question} of ${game.of}`);
    if (game.points !== null) parts.push(`${game.points} ${Math.abs(game.points) === 1 ? 'point' : 'points'}`);
  }
  return parts.join(' · ');
}

/** With no open game: the last one's settings, to start again, alone ("Play Grade 7 Quick 5 again"). */
export function playAgain(game: GameShapeRow): { label: string; request: CreateGameRequest } {
  const value = game.mode === 'timed' ? Math.round((game.duration_seconds ?? 0) / 60) : (game.question_count ?? 0);
  return {
    label: `Play ${gameWords(game)} again`,
    request: { ...tileGameRequest({ kind: 'quest', level_id: game.level_id, mode: game.mode, value }), level_scope: game.level_scope },
  };
}

/** One grade's cards for a member: its standards' first, then the harder tracks', each in the console's order. */
export function memberBoard<T extends MemberTile>(tiles: readonly T[], grade: number): { standard: T[]; advanced: T[] } {
  const inGrade = tiles.filter((tile) => guestLevelPlace(tile.level_id)?.grades.includes(grade));
  return {
    standard: inGrade.filter((tile) => !levelAdvanced(tile.level_id)),
    advanced: inGrade.filter((tile) => levelAdvanced(tile.level_id)),
  };
}

/** The tiles whose level is off the row (Kindergarten, Math 1, Kangaroo 9-12), grouped by level, in order. */
export function offBoardTiles<T extends MemberTile>(tiles: readonly T[]): T[] {
  return tiles.filter((tile) => guestLevelPlace(tile.level_id)?.grades.every((g) => g > 8) ?? true);
}
