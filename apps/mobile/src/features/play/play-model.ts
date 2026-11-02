// Ported from apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree): groupOf, the tile
// order, useStartQuest's request and HaveACode's routing -- kept pure here so Jest can hold them.
// Phase 62 (P6-P8, docs/stickiness-plan.md).
import {
  GAME_CODE_LENGTH,
  PLATFORM_BRAND,
  SPACE_CODE_LENGTH,
  type CreateGameRequest,
  type MemberTile,
} from '@tmi/shared';

/** A curriculum's group on the home, in the order shown. */
export function groupOf(levelId: string): string {
  if (levelId.startsWith('NC26.')) return 'NC standards';
  if (levelId.startsWith('NC17.')) return 'NC standards (2017)';
  if (/^BA\d$/.test(levelId)) return 'Beast Academy';
  if (['PRE', 'ALG', 'GEO'].includes(levelId)) return 'Art of Problem Solving';
  return 'Math Kangaroo';
}

/** The tiles in their groups: the level last played first, then the console's order. */
export function groupTiles(list: readonly MemberTile[], lastLevel?: string | null): [string, MemberTile[]][] {
  const ordered = [...list].sort(
    (a, b) => Number(b.level_id === lastLevel) - Number(a.level_id === lastLevel),
  );
  const map = new Map<string, MemberTile[]>();
  for (const tile of ordered)
    map.set(groupOf(tile.level_id), [...(map.get(groupOf(tile.level_id)) ?? []), tile]);
  return [...map.entries()];
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
