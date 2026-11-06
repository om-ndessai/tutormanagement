// A bank level as a member reads it (Phase 78, JF32): "Grade 6", "Beast Academy 3", "Math 1" -- shared
// `TILE_LEVEL_WORDS`, never the code labels ("G6", "BA3") that `levelLabel` gives the console. A level the
// table does not know is shown as it is. One place, for Quest, quests, the Daily and Assessments alike.
import { TILE_LEVEL_WORDS, type QuestionBankLevelId } from '@tmi/shared';

export function levelWords(levelId: string): string {
  return TILE_LEVEL_WORDS[levelId as QuestionBankLevelId] ?? levelId;
}

/** A level as Question Quest names it: its words, or "No level yet". */
export function questLevelWords(levelId: string | null): string {
  return levelId ? levelWords(levelId) : 'No level yet';
}

/** A quest's level scope in words: "Grade 6", or "Grade 5 and up, at random" (shared `gameLevelLabel`'s shape). */
export function gameLevelWords(game: { level_id: string; level_scope?: 'level' | 'upward' }): string {
  return game.level_scope === 'upward' ? `${levelWords(game.level_id)} and up, at random` : levelWords(game.level_id);
}
