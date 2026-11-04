// Ported from apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree): the board's grouping,
// useStartQuest's request and HaveACode's routing -- kept pure here so Jest can hold them.
// Phase 62 (P6-P8, docs/stickiness-plan.md); Phase 67 (H5, H7): the Quest board.
import {
  GAME_CODE_LENGTH,
  PLATFORM_BRAND,
  SPACE_CODE_LENGTH,
  boardGrades,
  boardLeadGrade,
  offBoardTiles,
  tileLook,
  type CreateGameRequest,
  type MemberTile,
  type QuestionBankLevelId,
  type StartCanvasAssessmentInput,
} from '@tmi/shared';

/**
 * Phase 67 (H5): the Quest board's "More levels" -- the tiles off the 1-8 row (Kindergarten, Math 1,
 * Kangaroo 9-12...), grouped by their level in words, in the console's order.
 */
export function offBoardGroups(list: readonly MemberTile[]): [string, MemberTile[]][] {
  const map = new Map<string, MemberTile[]>();
  for (const tile of offBoardTiles(list)) {
    const words = tileLook(tile).level;
    map.set(words, [...(map.get(words) ?? []), tile]);
  }
  return [...map.entries()];
}

/** The grade the board opens on: the one chosen here, else the lead's (`boardLeadGrade`). */
export function shownGrade(
  list: readonly MemberTile[],
  chosen: number | null,
  lead: string | null | undefined,
): number | null {
  const grades: number[] = boardGrades(list);
  if (chosen !== null && grades.includes(chosen)) return chosen;
  return boardLeadGrade(list, (lead ?? null) as QuestionBankLevelId | null);
}

/**
 * Phase 67 (H7): "Show your work" for oneself -- the tile's level and its number of questions, as the
 * reader's own assessment (allowed in a personal space).
 */
export function assessmentTileRequest(tile: Pick<MemberTile, 'level_id' | 'value'>, me: string): StartCanvasAssessmentInput {
  return { student_user_id: me, level_id: tile.level_id, question_count: tile.value };
}

/**
 * What one tap sends. A single player's game as it is; a multiplayer favorite's with the host already
 * playing (P7), and its roster invited (P8) when it has one.
 */
export function startRequest(
  request: CreateGameRequest,
  roster?: readonly string[] | null,
): CreateGameRequest {
  if (request.players !== 'multi') return request;
  return { ...request, host_plays: true, ...(roster?.length ? { invite_user_ids: [...roster] } : {}) };
}

/** A typed code tidied: spaces and dashes out, upper case ("fmxy-2345" -> "FMXY2345"). */
export function tidyCode(text: string): string {
  return text.replace(/[\s-]/g, '').toUpperCase();
}

/** Six characters is a game; eight a space to ask to join; anything else is not yet a code. */
export function codeKind(text: string): 'game' | 'space' | null {
  const typed = tidyCode(text);
  if (typed.length === GAME_CODE_LENGTH) return 'game';
  if (typed.length === SPACE_CODE_LENGTH) return 'space';
  return null;
}

/**
 * Where a game's code leads (the web's `gameInviteUrl`): the server's own Play home with the code
 * filled in. The Worker serves the web app at the same origin as the API. With no origin known, the
 * code alone -- a camera then shows the code, which is still what to type.
 */
export function gameInviteUrl(origin: string | null | undefined, code: string): string {
  const base = (origin ?? '').replace(/\/+$/, '');
  return /^https?:\/\//.test(base) ? `${base}/?code=${encodeURIComponent(code)}` : code;
}

/** The share sheet's words (the web's LobbyInvite): the code, and nobody's name. */
export function gameShareText(code: string): string {
  return `Join my ${PLATFORM_BRAND.name} game: code ${code}`;
}

/** The roster sheet's toast after saving. */
export function rosterSavedText(name: string, count: number): string {
  return count
    ? `${name} invites ${count} ${count === 1 ? 'person' : 'people'}.`
    : `${name} is open to anyone with the code.`;
}
