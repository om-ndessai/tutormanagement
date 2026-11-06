// Ported from apps/web/src/features/play/play-api.ts @ 0e3ec7a (working tree). Phase 62 (P5-P8,
// docs/stickiness-plan.md). The same query keys and reads.
//
// Mobile: Waiting for you is read only while Home is focused (`active`): TanStack's focusManager follows
// AppState, so a backgrounded app never polls it (`refetchIntervalInBackground` stays false).
//
// Phase 73 (JF13, owner 2026-11-05): the device's "last quest" is gone. Continue is the server's open game
// (`GET /quest/games/open`, `useOpenGame`), read only where Continue is shown and only while that screen is
// in front -- each read may call the game's Durable Object -- for a minute at a time, never polled. (JF14) A
// grade picked on the board's row is the server's too (`PUT /quest/grade`, `useSaveQuestGrade`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GAME_LIMITS,
  tileGameRequest,
  type ApiOk,
  type GameFavorite,
  type MemberTile,
  type MemberTilesResponse,
  type OpenGameResponse,
  type QuestGradeInput,
  type QuestMember,
  type WaitingGame,
} from '@tmi/shared';
import { useEffect, useRef } from 'react';

import { guestLeadLevel, guestMemory, loadGuestMemory } from '@/features/guest/guest-store';
import { gameKeys, useSaveGameFavorite } from '@/features/quest/games-api';
import { apiClient } from '@/lib/api-client';

const TILES_KEY = ['quest', 'tiles'] as const;

/** Phase 62 (P5/P6): the tiles a member here may start in one tap, and whether the Play home is on. */
export function useMemberTiles(enabled = true) {
  return useQuery({
    queryKey: TILES_KEY,
    queryFn: () => apiClient.get<ApiOk<MemberTilesResponse>>('/quest/tiles'),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Phase 73 (JF13): the reader's open game here -- running or in its lobby, with where they are in it -- else
 * what "again" would start. Read only while `enabled` (Continue is on screen, for a learner where Quest is
 * on, and that screen is in front): each read may ask the game itself, so it holds for a minute, is read
 * again when the app comes back to the front, and is never polled. A start, a join, every game action and
 * the results mark it stale (games-api.ts, game-results.tsx). With `enabled` false it only hands back what
 * is already cached (the home-screen quick action reads it that way).
 */
export const openGameQuery = {
  queryKey: gameKeys.open,
  queryFn: () => apiClient.get<ApiOk<OpenGameResponse>>('/quest/games/open'),
};

export function useOpenGame(enabled = true) {
  return useQuery({
    ...openGameQuery,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });
}

/**
 * Phase 73 (JF14): the grade picked on the board's row here (0 is "Not in school", null forgets it) -- a
 * preference kept on the server per space, so it follows the person to another device. The tiles carry the
 * lead again afterwards.
 */
export function useSaveQuestGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuestGradeInput) => apiClient.put<ApiOk<{ grade: number | null }>>('/quest/grade', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: TILES_KEY }),
  });
}

/**
 * Phase 63 (P13): the level a guest's play on this phone leads the Play home with once they are a member
 * (their grade becomes the default). Phase 73 (JF14): carried once into the grade the server keeps for them
 * here (`guestGradeToCarry`), when the server knows nothing more particular; an older Worker, which keeps no
 * grade, still leads with it. A query, so the phone's memory is read once it has loaded (and again after
 * sign-up clears the cache).
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
          // Keyed by its code, as a starred tile is (said in words on the row: `favoriteWords`, Phase 78).
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
