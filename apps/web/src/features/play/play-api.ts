import { useQuery } from '@tanstack/react-query';
import type { ApiOk, CreateGameRequest, MemberTilesResponse, QuestMember, WaitingGame } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

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

const key = (space: string) => `aimtrue.last-quest.${space}`;

export function readLastQuest(space: string | undefined): LastQuest | null {
  if (!space) return null;
  try {
    const raw = localStorage.getItem(key(space));
    return raw ? (JSON.parse(raw) as LastQuest) : null;
  } catch {
    return null;
  }
}

export function writeLastQuest(space: string | undefined, last: LastQuest): void {
  if (!space) return;
  try {
    localStorage.setItem(key(space), JSON.stringify(last));
  } catch {
    // A private window: Continue simply does not appear.
  }
}

/**
 * Phase 62 (P8): games a roster invited the reader to. Read when the tab is in front, at most once a
 * minute -- never polled in the background (the free plan's request count).
 */
export function useWaitingGames(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'waiting'] as const,
    queryFn: () => apiClient.get<ApiOk<WaitingGame[]>>('/quest/games/waiting'),
    enabled,
    refetchInterval: 60_000,
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
