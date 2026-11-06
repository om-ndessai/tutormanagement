import { TILE_LEVEL_WORDS, levelLabel, type QuestionBankLevelId } from '@tmi/shared';

/**
 * Phase 78 (JF32): a bank level as a member reads it -- "Grade 6", "Beast Academy 3" (`TILE_LEVEL_WORDS`), never the
 * short form a code uses ("G6"). `levelLabel` covers anything the words table does not know.
 */
export function levelWords(levelId: string): string {
  return TILE_LEVEL_WORDS[levelId as QuestionBankLevelId] ?? levelLabel(levelId);
}

/** Question Quest's level in words, or "No level yet" (`questLevelLabel`'s words, without the code). */
export function questLevelWords(levelId: string | null): string {
  return levelId ? levelWords(levelId) : 'No level yet';
}
