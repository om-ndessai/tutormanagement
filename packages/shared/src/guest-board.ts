import type { GuestQuestion, GuestTile } from './guest.js';
import { dailySeed } from './habit.js';
import { TILE_LEVEL_TAGS, TILE_LEVEL_WORDS, type TileShape } from './quest-tiles.js';
import type { QuestionBankLevelId } from './questions.js';

// ---------------------------------------------------------------------------
// The guest Quest board (landing page, direction C; docs/landing-page-proposal.md)
// ---------------------------------------------------------------------------
// A signed-out visitor picks a grade (1-8) and sees that grade's quests as game cards, with a daily
// "Today's 5". Curricula are never named to a guest (owner, 2026-11-02): a level is "Grade 4", and
// a harder curriculum's level is "Adv G4". Pure, so the web and the app agree.

/** The grades on the board's row, in order (owner, 2026-11-02: 1-8). */
export const GUEST_GRADES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type GuestGrade = (typeof GUEST_GRADES)[number];
export const GUEST_DEFAULT_GRADE: GuestGrade = 4;

/** How many questions Today's 5 holds. */
export const GUEST_TODAY_SIZE = 5;

/** Where a level sits on the board: its grade(s), and whether it is an advanced track. */
export interface GuestLevelPlace {
  grades: number[];
  advanced: boolean;
}

/** Advanced tracks whose id is not "<letters><grade>": AoPS's courses by the grade they usually suit, Kangaroo's pairs. */
const ADVANCED_GRADES: Partial<Record<QuestionBankLevelId, number[]>> = {
  PRE: [6],
  ALG: [7],
  GEO: [8],
  MK12: [1, 2],
  MK34: [3, 4],
  MK56: [5, 6],
  MK78: [7, 8],
  MK910: [9, 10],
  MK1112: [11, 12],
};

export function guestLevelPlace(level: QuestionBankLevelId): GuestLevelPlace | null {
  const nc = /^NC(?:26|17)\.(\d)$/.exec(level);
  if (nc) return { grades: [Number(nc[1])], advanced: false };
  const ba = /^BA(\d)$/.exec(level);
  if (ba) return { grades: [Number(ba[1])], advanced: true };
  const grades = ADVANCED_GRADES[level];
  return grades ? { grades, advanced: true } : null;
}

/** A level's name for a guest: "Grade 4", "Adv G2", "Adv G3-4"; never a curriculum's name. */
export function guestLevelWords(level: QuestionBankLevelId): string {
  const place = guestLevelPlace(level);
  if (place?.advanced) return `Adv G${place.grades.join('–')}`;
  if (place) return `Grade ${place.grades[0]}`;
  // Off the row (Kindergarten, Math 1, ...): the level's own words, without the edition.
  return TILE_LEVEL_WORDS[level].replace(/ \(2017\)$/, '');
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A tile as a game card's title: "Quick 5", "10 in a row", "5-minute dash", "Show your work". */
export function guestTileTitle(tile: TileShape): string {
  if (tile.kind === 'assessment') return 'Show your work';
  if (tile.mode === 'timed') {
    const kind = tile.value <= 5 ? 'dash' : tile.value <= 10 ? 'challenge' : 'marathon';
    return `${tile.value}-minute ${kind}`;
  }
  return tile.value <= 5 ? `Quick ${tile.value}` : `${tile.value} in a row`;
}

/** The line under a card's title: "5 questions", "Beat the clock", "5 questions, by hand". */
export function guestTileDetail(tile: TileShape): string {
  if (tile.kind === 'assessment') return `${plural(tile.value, 'question')}, by hand`;
  return tile.mode === 'timed' ? 'Beat the clock' : plural(tile.value, 'question');
}

/** A guest tile's words, as /api/auth/config serves them: "Adv G2 · 5 questions". */
export function guestTileWords(tile: TileShape): string {
  const level = guestLevelWords(tile.level_id);
  if (tile.kind === 'assessment') return `${level} · Show your work, ${plural(tile.value, 'question')}`;
  return `${level} · ${tile.mode === 'timed' ? plural(tile.value, 'minute') : plural(tile.value, 'question')}`;
}

/** A tile's name in a sentence ("Quick 5, Adv G2"): what a guest reads instead of its code. */
export function guestTileName(tile: TileShape): string {
  return `${guestTileTitle(tile)}, ${guestLevelWords(tile.level_id)}`;
}

/** The grade a remembered level stands for, if it is on the row. */
export function guestGradeOf(level: QuestionBankLevelId | undefined): GuestGrade | undefined {
  const grade = level ? guestLevelPlace(level)?.grades[0] : undefined;
  return GUEST_GRADES.find((g) => g === grade);
}

/** One grade's cards: its own level's first, then the advanced tracks'; open before locked, each in the console's order. */
export function guestBoard(tiles: readonly GuestTile[], grade: number): { standard: GuestTile[]; advanced: GuestTile[] } {
  const inGrade = tiles.filter((tile) => guestLevelPlace(tile.level_id)?.grades.includes(grade));
  const openFirst = (list: GuestTile[]) => [...list.filter((t) => !t.locked), ...list.filter((t) => t.locked)];
  return {
    standard: openFirst(inGrade.filter((t) => !guestLevelPlace(t.level_id)!.advanced)),
    advanced: openFirst(inGrade.filter((t) => guestLevelPlace(t.level_id)!.advanced)),
  };
}

/** The level a grade's Today's 5 draws from: its own level with a quest open to guests, else an advanced one. */
export function guestTodayLevel(tiles: readonly GuestTile[], grade: number): QuestionBankLevelId | undefined {
  const { standard, advanced } = guestBoard(tiles, grade);
  return [...standard, ...advanced].find((t) => !t.locked && t.kind === 'quest')?.level_id;
}

/** Today's 5 as a tile code would name it, for the anonymous counts only: "G4D5". */
export function guestTodayCode(level: QuestionBankLevelId): string {
  return `${TILE_LEVEL_TAGS[level]}D${GUEST_TODAY_SIZE}`;
}

/** The device's own date, "2026-11-02": Today's 5 changes at the visitor's midnight. */
export function guestDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Today's 5: the same questions of a level's guest pool for every visitor that day (seeded by the day
 * and the level), served easiest first. A pool smaller than five gives what it has.
 */
export function guestTodaySet(pool: readonly GuestQuestion[], day: string, level: string): GuestQuestion[] {
  let seed = dailySeed(day, `guest|${level}`);
  const random = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled
    .slice(0, GUEST_TODAY_SIZE)
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

/** Where Contact us goes (the address the portal already shows). */
export const PLATFORM_CONTACT_EMAIL = 'om.ndessai@gmail.com';

/** The band's checklist under the headline (owner, 2026-11-02). */
export const GUEST_PROMISES = ['Free play', 'Grades 1–8', 'No account to start', 'No ads'] as const;

/**
 * The console's home bar beside the band's Sign up button: the words after "Sign up" ("free to save
 * scores and unlock every quest."), or null when the line has no "Sign up" (then it is shown whole).
 */
export function homeBarAfterSignUp(line: string): string | null {
  const at = line.search(/sign up/i);
  if (at < 0) return null;
  return line.slice(at + 'sign up'.length).trim() || null;
}
