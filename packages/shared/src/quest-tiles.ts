import { z } from 'zod';
import { GAME_LIMITS } from './quest-games.js';
import { QUESTION_BANK_LEVEL_IDS, type QuestionBankLevelId } from './questions.js';

// ---------------------------------------------------------------------------
// Tiles (Phase 62, P5 in docs/stickiness-plan.md)
// ---------------------------------------------------------------------------
// A tile is a quest in one tap, named by a code: <level tag><Q|T|A><number>.
//   Q: that many questions; T: that many minutes; A: a handwritten Assessment of that many questions.
//   G4Q5 (Grade 4, 5 questions), G4T10 (Grade 4, 10 minutes), BA3Q5, MK34Q10, G4A5.
// Platform admins keep the list in the console (`platform_settings` 'tiles'); until they change it,
// DEFAULT_TILES is the list. Members see the tiles shown to members, in the curricula their space
// offers, at levels deep enough to play; guests (Phase 63) see open and locked ones.

/** Each bank level's tag in a tile's code. Letters and digits only, unique, none a prefix clash. */
export const TILE_LEVEL_TAGS: Record<QuestionBankLevelId, string> = {
  'NC26.K': 'GK',
  'NC26.1': 'G1',
  'NC26.2': 'G2',
  'NC26.3': 'G3',
  'NC26.4': 'G4',
  'NC26.5': 'G5',
  'NC26.6': 'G6',
  'NC26.7': 'G7',
  'NC26.8': 'G8',
  'NC26.M1': 'M1',
  'NC26.M2': 'M2',
  'NC26.ALR': 'LR',
  'NC26.ASDS': 'DS',
  'NC26.MSM': 'MM',
  'NC17.K': 'NK',
  'NC17.1': 'N1',
  'NC17.2': 'N2',
  'NC17.3': 'N3',
  'NC17.4': 'N4',
  'NC17.5': 'N5',
  'NC17.6': 'N6',
  'NC17.7': 'N7',
  'NC17.8': 'N8',
  'NC17.M1': 'NM1',
  'NC17.M2': 'NM2',
  'NC17.M3': 'NM3',
  'NC17.M4': 'NM4',
  'NC17.PC': 'NPC',
  BA1: 'BA1',
  BA2: 'BA2',
  BA3: 'BA3',
  BA4: 'BA4',
  BA5: 'BA5',
  PRE: 'PA',
  ALG: 'AL',
  GEO: 'GE',
  MK12: 'MK12',
  MK34: 'MK34',
  MK56: 'MK56',
  MK78: 'MK78',
  MK910: 'MK910',
  MK1112: 'MK1112',
};

/** The words under a tile's code: "Grade 4", "Beast Academy 3", "Kangaroo 3-4". */
export const TILE_LEVEL_WORDS: Record<QuestionBankLevelId, string> = {
  'NC26.K': 'Kindergarten',
  'NC26.1': 'Grade 1',
  'NC26.2': 'Grade 2',
  'NC26.3': 'Grade 3',
  'NC26.4': 'Grade 4',
  'NC26.5': 'Grade 5',
  'NC26.6': 'Grade 6',
  'NC26.7': 'Grade 7',
  'NC26.8': 'Grade 8',
  'NC26.M1': 'Math 1',
  'NC26.M2': 'Math 2',
  'NC26.ALR': 'Applied Logic',
  'NC26.ASDS': 'Statistics & Data Science',
  'NC26.MSM': 'Math Modeling',
  'NC17.K': 'Kindergarten (2017)',
  'NC17.1': 'Grade 1 (2017)',
  'NC17.2': 'Grade 2 (2017)',
  'NC17.3': 'Grade 3 (2017)',
  'NC17.4': 'Grade 4 (2017)',
  'NC17.5': 'Grade 5 (2017)',
  'NC17.6': 'Grade 6 (2017)',
  'NC17.7': 'Grade 7 (2017)',
  'NC17.8': 'Grade 8 (2017)',
  'NC17.M1': 'Math 1 (2017)',
  'NC17.M2': 'Math 2 (2017)',
  'NC17.M3': 'Math 3 (2017)',
  'NC17.M4': 'Math 4 (2017)',
  'NC17.PC': 'Precalculus (2017)',
  BA1: 'Beast Academy 1',
  BA2: 'Beast Academy 2',
  BA3: 'Beast Academy 3',
  BA4: 'Beast Academy 4',
  BA5: 'Beast Academy 5',
  PRE: 'AoPS Prealgebra',
  ALG: 'AoPS Algebra',
  GEO: 'AoPS Geometry',
  MK12: 'Kangaroo 1-2',
  MK34: 'Kangaroo 3-4',
  MK56: 'Kangaroo 5-6',
  MK78: 'Kangaroo 7-8',
  MK910: 'Kangaroo 9-10',
  MK1112: 'Kangaroo 11-12',
};

export const TILE_KINDS = ['quest', 'assessment'] as const;
export type TileKind = (typeof TILE_KINDS)[number];

export const TILE_GUEST_STATES = ['open', 'locked', 'hidden'] as const;
export type TileGuestState = (typeof TILE_GUEST_STATES)[number];

/** A tile's format: Q (questions), T (minutes) or A (an Assessment's questions). */
export type TileFormat = 'Q' | 'T' | 'A';

export interface TileShape {
  kind: TileKind;
  level_id: QuestionBankLevelId;
  /** 'count' for Q and A, 'timed' for T. */
  mode: 'count' | 'timed';
  /** Questions (Q, A) or minutes (T). */
  value: number;
}

export function tileFormat(tile: Pick<TileShape, 'kind' | 'mode'>): TileFormat {
  return tile.kind === 'assessment' ? 'A' : tile.mode === 'timed' ? 'T' : 'Q';
}

/** "G4T10". */
export function tileCode(tile: TileShape): string {
  return `${TILE_LEVEL_TAGS[tile.level_id]}${tileFormat(tile)}${tile.value}`;
}

/** Tags longest first, so "MK1112" is tried before "MK12"'s neighbours and "NM1" before "N1". */
const TAGS_LONGEST_FIRST = (Object.entries(TILE_LEVEL_TAGS) as [QuestionBankLevelId, string][]).sort(
  (a, b) => b[1].length - a[1].length,
);

/** "g4t10" -> its shape, or null when it is not a tile code. Case does not matter. */
export function parseTileCode(code: string): TileShape | null {
  const text = code.trim().toUpperCase();
  for (const [level_id, tag] of TAGS_LONGEST_FIRST) {
    if (!text.startsWith(tag)) continue;
    const match = /^([QTA])([1-9]\d{0,2})$/.exec(text.slice(tag.length));
    if (!match) continue;
    const format = match[1] as TileFormat;
    const shape: TileShape = {
      kind: format === 'A' ? 'assessment' : 'quest',
      level_id,
      mode: format === 'T' ? 'timed' : 'count',
      value: Number(match[2]),
    };
    return tileValueProblem(shape) === null ? shape : null;
  }
  return null;
}

/** Why a tile's number does not fit its format, or null. */
export function tileValueProblem(tile: Pick<TileShape, 'kind' | 'mode' | 'value'>): string | null {
  if (!Number.isInteger(tile.value) || tile.value < 1) return 'Use a whole number of at least 1.';
  if (tile.kind === 'assessment') return tile.value <= 25 ? null : 'An assessment holds at most 25 questions.';
  if (tile.mode === 'timed') {
    return tile.value <= GAME_LIMITS.maxMinutes ? null : `A timed quest lasts at most ${GAME_LIMITS.maxMinutes} minutes.`;
  }
  return tile.value <= GAME_LIMITS.maxQuestions ? null : `A quest holds at most ${GAME_LIMITS.maxQuestions} questions.`;
}

/** "Grade 4 · 10 minutes", "Beast Academy 3 · 5 questions", "Grade 4 · Assessment, 5 questions". */
export function tileWords(tile: TileShape): string {
  const level = TILE_LEVEL_WORDS[tile.level_id];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (tile.kind === 'assessment') return `${level} · Assessment, ${plural(tile.value, 'question')}`;
  return `${level} · ${tile.mode === 'timed' ? plural(tile.value, 'minute') : plural(tile.value, 'question')}`;
}

/** One tile as the console keeps it. The code is derived, never typed. */
export const questTileSchema = z
  .object({
    kind: z.enum(TILE_KINDS),
    level_id: z.enum(QUESTION_BANK_LEVEL_IDS as unknown as [QuestionBankLevelId, ...QuestionBankLevelId[]]),
    mode: z.enum(['count', 'timed']),
    value: z.number().int(),
    /** For guests (Phase 63): open, locked (shown with a lock) or hidden. */
    guest: z.enum(TILE_GUEST_STATES),
    /** Whether members see it. */
    members: z.boolean(),
  })
  .superRefine((tile, ctx) => {
    if (tile.kind === 'assessment' && tile.mode !== 'count') {
      ctx.addIssue({ code: 'custom', path: ['mode'], message: 'An assessment is a number of questions.' });
    }
    const problem = tileValueProblem(tile);
    if (problem) ctx.addIssue({ code: 'custom', path: ['value'], message: problem });
  });
export type QuestTileInput = z.infer<typeof questTileSchema>;

export interface QuestTile extends QuestTileInput {
  code: string;
}

/** The Play settings platform admins keep beside the tiles. */
export const playSettingsSchema = z.object({
  /** The members' Play home (P6): on, or the homes as before. */
  play_home: z.boolean(),
  /** A tile shows to members only while its level has at least this many questions to play. */
  min_depth: z.number().int().min(1).max(1000),
  /** Phase 64 (P19): the members' Daily set. Absent (saved before Phase 64, or an older console) is on. */
  daily: z.boolean().default(true),
});
export type PlaySettings = z.output<typeof playSettingsSchema>;

export const DEFAULT_PLAY_SETTINGS: PlaySettings = { play_home: true, min_depth: 50, daily: true };

/** What the console saves: the settings and the whole ordered list (at most 200, codes unique). */
export const updatePlaySchema = z
  .object({
    settings: playSettingsSchema,
    tiles: z.array(questTileSchema).max(200),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.tiles.forEach((tile, index) => {
      const code = tileCode(tile);
      if (seen.has(code)) ctx.addIssue({ code: 'custom', path: ['tiles', index], message: `${code} is listed twice.` });
      seen.add(code);
    });
  });
export type UpdatePlayInput = z.infer<typeof updatePlaySchema>;

export function withCode(tile: QuestTileInput): QuestTile {
  return { ...tile, code: tileCode(tile) };
}

const quest = (level_id: QuestionBankLevelId, mode: 'count' | 'timed', value: number, guest: TileGuestState): QuestTileInput => ({
  kind: 'quest',
  level_id,
  mode,
  value,
  guest,
  members: true,
});
const assessment = (level_id: QuestionBankLevelId, value: number, guest: TileGuestState): QuestTileInput => ({
  kind: 'assessment',
  level_id,
  mode: 'count',
  value,
  guest,
  // Members' assessment tiles ("G4A10 for Sofia") come later; guests' are Phase 63's.
  members: false,
});

/** The list until platform admins change it (docs/stickiness-plan.md, "Default set"). */
export const DEFAULT_TILES: QuestTile[] = [
  ...(['NC26.3', 'NC26.4', 'NC26.5', 'NC26.6', 'NC26.7', 'NC26.8', 'NC26.M1'] as const).flatMap((level) => [
    quest(level, 'count', 5, 'open'),
    quest(level, 'timed', 5, 'open'),
    assessment(level, 5, 'open'),
    quest(level, 'count', 10, 'locked'),
    quest(level, 'timed', 10, 'locked'),
    quest(level, 'timed', 20, 'locked'),
  ]),
  ...(['NC26.K', 'NC26.1', 'NC26.2'] as const).map((level) => quest(level, 'count', 5, 'open')),
  ...(['BA1', 'BA2', 'BA3', 'BA4', 'BA5'] as const).flatMap((level) => [
    quest(level, 'count', 5, 'open'),
    quest(level, 'timed', 10, 'locked'),
  ]),
  ...(['PRE', 'ALG', 'GEO'] as const).map((level) => quest(level, 'count', 10, 'locked')),
  ...(['MK12', 'MK34', 'MK56', 'MK78', 'MK910', 'MK1112'] as const).map((level) => quest(level, 'count', 10, 'locked')),
].map(withCode);

/** The single-player game a quest tile starts: the existing one-request path (`POST /quest/games`). */
export function tileGameRequest(tile: TileShape) {
  return {
    level_id: tile.level_id,
    level_scope: 'level' as const,
    mode: tile.mode,
    ...(tile.mode === 'timed' ? { duration_minutes: tile.value } : { question_count: tile.value }),
    players: 'single' as const,
    max_team_size: 1,
  };
}

/** A member's tile: the tile, its words and how many questions its level has here. */
export interface MemberTile extends QuestTile {
  words: string;
  available: number;
  /** Its level draws checked ("Beta") questions here. */
  beta: boolean;
  /** Phase 64 (P20): the reader's best score of this tile's shape here, or null if never played. */
  best?: number | null;
}

export interface MemberTilesResponse {
  play_home: boolean;
  /** Phase 64 (P19): whether the Daily set is on. Absent from an older Worker means off. */
  daily?: boolean;
  tiles: MemberTile[];
}

/** What the console reads: the settings and the list, and whether the list is still the default. */
export interface PlayConsoleResponse {
  settings: PlaySettings;
  tiles: QuestTile[];
  is_default: boolean;
}
