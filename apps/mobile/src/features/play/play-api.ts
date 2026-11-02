// Ported from apps/web/src/features/play/play-api.ts @ 0e3ec7a (working tree). Phase 62 (P5-P8,
// docs/stickiness-plan.md). The same query keys and reads.
//
// Mobile: the last quest is kept in AsyncStorage (`readLastQuestRaw`), one per space, read through a
// query so Continue and the quick action follow a start at once (`rememberLastQuest`). Waiting for you
// is read only while Home is focused (`active`): TanStack's focusManager follows AppState, so a
// backgrounded app never polls it (`refetchIntervalInBackground` stays false).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GAME_LIMITS,
  tileGameRequest,
  type ApiOk,
  type CreateGameRequest,
  type GameFavorite,
  type MemberTile,
  type MemberTilesResponse,
  type QuestMember,
  type WaitingGame,
} from '@tmi/shared';
import { useCallback, useEffect, useRef } from 'react';

import { guestLeadLevel, guestMemory, loadGuestMemory } from '@/features/guest/guest-store';
import { useSaveGameFavorite } from '@/features/quest/games-api';
import { apiClient } from '@/lib/api-client';
import { readLastQuestRaw, writeLastQuestRaw } from '@/lib/storage';

/** Phase 62 (P5/P6): the tiles a member here may start in one tap, and whether the Play home is on. */
export function useMemberTiles(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'tiles'] as const,
    queryFn: () => apiClient.get<ApiOk<MemberTilesResponse>>('/quest/tiles'),
    enabled,
    staleTime: 60_000,
  });
}

/** The last quest started here, kept on this device for Continue (never on the server: no audit line per game). */
export interface LastQuest {
  label: string;
  request: CreateGameRequest;
}

export const lastQuestKey = (space: string | undefined) => ['play', 'last-quest', space ?? ''] as const;

export function parseLastQuest(raw: string | null): LastQuest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LastQuest>;
    return typeof value.label === 'string' && value.request && typeof value.request === 'object'
      ? (value as LastQuest)
      : null;
  } catch {
    return null;
  }
}

export function useLastQuest(space: string | undefined) {
  return useQuery({
    queryKey: lastQuestKey(space),
    queryFn: async () => parseLastQuest(await readLastQuestRaw(space!)),
    enabled: Boolean(space),
    staleTime: Infinity,
  });
}

/** Remembers a start on this device, and tells Continue and the quick action at once. */
export function useRememberLastQuest(space: string | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    (last: LastQuest) => {
      if (!space) return;
      queryClient.setQueryData(lastQuestKey(space), last);
      void writeLastQuestRaw(space, JSON.stringify(last));
    },
    [queryClient, space],
  );
}

/**
 * Phase 63 (P13): the level a guest's play on this phone leads the Play home with once they are a member
 * (their grade becomes the default), until a quest started here takes over as the last one. A query, so
 * the phone's memory is read once it has loaded (and again after sign-up clears the cache).
 */
export function useGuestLeadLevel() {
  return useQuery({
    queryKey: ['play', 'guest-lead'] as const,
    queryFn: async () => {
      await loadGuestMemory();
      return guestLeadLevel();
    },
    staleTime: Infinity,
  });
}

/**
 * Phase 63 (P13, "the device's played tiles become favorites"): once the phone's memory, the member's
 * tiles and their favorites have loaded, the tiles this phone played as a guest are saved as favorites --
 * those this space offers, not already a favorite, within the limit -- and each is carried once.
 * Ported from apps/web/src/features/play/play-home.tsx (useCarryGuestTiles).
 */
export function useCarryGuestTiles(ready: boolean, tiles: MemberTile[] | undefined, favorites: GameFavorite[] | undefined) {
  const save = useSaveGameFavorite();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready || !tiles || tiles.length === 0 || !favorites) return;
    const codes = guestMemory.uncarried();
    if (codes.length === 0) return;
    done.current = true;
    const have = new Set(favorites.map((favorite) => favorite.name));
    const room = Math.max(0, GAME_LIMITS.maxFavorites - favorites.length);
    const carry = codes
      .map((code) => tiles.find((tile) => tile.code === code))
      .filter((tile): tile is MemberTile => tile !== undefined && !have.has(tile.code))
      .slice(0, room);
    void (async () => {
      for (const tile of carry) {
        try {
          await save.mutateAsync({ name: tile.code, config: tileGameRequest(tile) });
        } catch {
          // Not carried: the member can still star it.
        }
      }
      guestMemory.markCarried(codes);
    })();
  }, [ready, tiles, favorites, save]);
}

/**
 * Phase 62 (P8): games a roster invited the reader to. Read when Home is in front, at most once a
 * minute -- never polled in the background (the free plan's request count).
 */
export function useWaitingGames(active = true) {
  return useQuery({
    queryKey: ['quest', 'waiting'] as const,
    queryFn: () => apiClient.get<ApiOk<WaitingGame[]>>('/quest/games/waiting'),
    enabled: active,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** Phase 62 (P8, R27): who the reader may put on a roster. */
export function useRosterMembers(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'members'] as const,
    queryFn: () => apiClient.get<ApiOk<QuestMember[]>>('/quest/games/members'),
    enabled,
    staleTime: 60_000,
  });
}
