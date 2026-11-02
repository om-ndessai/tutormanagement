import { guestTileWords, type GuestConfig, type GuestTile, type QuestTile } from '@tmi/shared';

import { fillEmptyGuestPools, guestPoolSizes, guestVersion } from '../repositories/guest.js';
import { cachedDrawableCounts } from '../repositories/level-counts.js';
import { getGuestSettings, getPlay } from '../repositories/platform-settings.js';
import type { Env } from '../types.js';

/**
 * Phase 63 (P10): guest play is on at this address only while the Worker allows it (GUEST_PLAY,
 * "true" on `tutoring` and the demo, not on `tmi-portal`) AND platform admins have switched it on in the
 * console. Both, so the console cannot open an address the deploy kept closed.
 */
export async function guestPlayOn(env: Env): Promise<boolean> {
  if (env.GUEST_PLAY !== 'true') return false;
  return (await getGuestSettings(env.DB)).enabled;
}

/**
 * Phase 63 (P10): what /api/auth/config tells a signed-out client while guest play is on here: the
 * version (devices fetch pools by it), the nudges' settings, the tiles for guests (open ones only
 * where the level's pool has questions; locked ones as the offer) and each level's member count.
 * Read from memoised settings and the cached counts: no scan per visit.
 */
export async function guestConfigFor(env: Env): Promise<GuestConfig | undefined> {
  if (!(await guestPlayOn(env))) return undefined;
  const [settings, play, version, sizes, counts] = await Promise.all([
    getGuestSettings(env.DB),
    getPlay(env.DB),
    guestVersion(env.DB),
    guestPoolSizesCached(env.DB),
    cachedDrawableCounts(env.DB, true, new Set(['nc-2026', 'nc-2017', 'ba', 'mk'])),
  ]);
  const { enabled: _enabled, ...shown } = settings;
  const tiles: GuestTile[] = play.tiles
    .filter((tile) => tile.guest !== 'hidden' && (tile.kind === 'quest' || settings.assessment_enabled))
    .map((tile) => ({
      code: tile.code,
      kind: tile.kind,
      level_id: tile.level_id,
      mode: tile.mode,
      value: tile.value,
      words: guestTileWords(tile),
      locked: tile.guest === 'locked' || (sizes.get(tile.level_id) ?? 0) === 0,
    }));
  const member_counts: Record<string, number> = {};
  for (const level of counts) member_counts[level.level_id] = level.available;
  return { version, settings: shown, tiles, member_counts };
}

let sizesMemo: { value: Map<string, number>; at: number } | null = null;

/** The pools' sizes, memoised a few minutes (the console's edits bump the version anyway). */
async function guestPoolSizesCached(db: D1Database): Promise<Map<string, number>> {
  if (sizesMemo && Date.now() - sizesMemo.at < 5 * 60_000) return sizesMemo.value;
  sizesMemo = { value: await guestPoolSizes(db), at: Date.now() };
  return sizesMemo.value;
}

export function forgetGuestSizes(): void {
  sizesMemo = null;
}

/**
 * While the console's Guest play switch is on, every level with a tile open to guests gets free
 * questions: an empty pool takes the console's suggestion (repositories/guest.ts). Called after the
 * console saves guest play or the tiles, so switching it on is all it takes. Returns the levels filled.
 */
export async function fillOpenTilePools(db: D1Database, tiles: readonly QuestTile[], enabled: boolean): Promise<string[]> {
  if (!enabled) return [];
  const filled = await fillEmptyGuestPools(
    db,
    tiles.filter((tile) => tile.guest === 'open').map((tile) => tile.level_id),
  );
  if (filled.length > 0) forgetGuestSizes();
  return filled;
}
