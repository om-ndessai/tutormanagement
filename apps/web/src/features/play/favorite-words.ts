import { TILE_LEVEL_WORDS, guestTileTitle, parseTileCode } from '@tmi/shared';

/**
 * Phase 78 (JF32): a favorite as a person reads it. A starred tile keeps its code as the favorite's name (the key
 * both clients and the guest carry match on), but is said in words -- "G4Q5" reads "Grade 4 Quick 5"; a favorite
 * someone named in New Quest reads as they named it.
 */
export function favoriteWords(name: string): string {
  const tile = parseTileCode(name);
  return tile ? `${TILE_LEVEL_WORDS[tile.level_id]} ${guestTileTitle(tile)}` : name;
}
