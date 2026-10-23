// Ported from apps/web/src/features/quest/games-api.ts @ cd0378d (Phase 46, working tree); Phase 47's
// favorites and the wizard's request @ 9eccdf2 (working tree).
//
// Mobile: the same hooks, query keys and cache behaviour -- create, join and every action write the
// game they return into its cache and invalidate the list; the results never go stale; the levels
// hold for five minutes. The one deliberate change (design 60): `useGame(id, active)` polls only
// while `active` (the game screen is focused) and the game is not finished. TanStack's focusManager
// follows AppState (query-provider.tsx), so a backgrounded app stops polling too
// (`refetchIntervalInBackground` stays false), and a finished game is never polled again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  CreateGameRequest,
  GameAnswerInput,
  GameFavorite,
  GameFavoriteRequest,
  GameLevel,
  GameLookup,
  GameResults,
  GameSummary,
  GameView,
  JoinGameInput,
} from '@tmi/shared';

import { ApiRequestError, apiClient } from '@/lib/api-client';
import { gamePollInterval } from './game-model';

// Phase 46: Quest Games. docs/quest-games-plan.md. Phase 47 (the start
// wizard's favorites): docs/quest-games-g2-plan.md.

export const gameKeys = {
  all: ['quest-games'] as const,
  list: ['quest-games', 'list'] as const,
  levels: ['quest-games', 'levels'] as const,
  favorites: ['quest-games', 'favorites'] as const,
  game: (id: string) => ['quest-games', 'game', id] as const,
  results: (id: string, team: string | null) => ['quest-games', 'results', id, team] as const,
};

export function useGames(enabled = true) {
  return useQuery({
    queryKey: gameKeys.list,
    queryFn: () => apiClient.get<ApiOk<GameSummary[]>>('/quest/games'),
    enabled,
  });
}

export function useGameLevels(enabled = true) {
  return useQuery({
    queryKey: gameKeys.levels,
    queryFn: () => apiClient.get<ApiOk<GameLevel[]>>('/quest/games/levels'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGameRequest) => apiClient.post<ApiOk<GameView>>('/quest/games', input),
    onSuccess: (game) => {
      queryClient.setQueryData(gameKeys.game(game.data.id), game);
      void queryClient.invalidateQueries({ queryKey: gameKeys.list });
    },
  });
}

/** The person's own named settings, for the wizard's first step. */
export function useGameFavorites(enabled = true) {
  return useQuery({
    queryKey: gameKeys.favorites,
    queryFn: () => apiClient.get<ApiOk<GameFavorite[]>>('/quest/games/favorites'),
    enabled,
  });
}

/** Saves under a name, replacing the person's favorite of that name. */
export function useSaveGameFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GameFavoriteRequest) =>
      apiClient.put<ApiOk<GameFavorite>>('/quest/games/favorites', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: gameKeys.favorites }),
  });
}

export function useDeleteGameFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<ApiOk<{ id: string }>>(`/quest/games/favorites/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: gameKeys.favorites }),
  });
}

export function useLookupGame() {
  return useMutation({
    mutationFn: (code: string) => apiClient.post<ApiOk<GameLookup>>('/quest/games/lookup', { code }),
  });
}

export function useJoinGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, ...input }: JoinGameInput & { gameId: string }) =>
      apiClient.post<ApiOk<GameView>>(`/quest/games/${gameId}/join`, input),
    onSuccess: (game) => {
      queryClient.setQueryData(gameKeys.game(game.data.id), game);
      void queryClient.invalidateQueries({ queryKey: gameKeys.list });
    },
  });
}

/**
 * The game now, polled while it is open: the lobby filling, the scores, the clock. Mobile: only while
 * `active` (the screen is focused), never once it is finished.
 */
/**
 * Only a 404 or 403 means the game is not there for this reader. Anything else -- a dropped
 * connection, the phone waking, a server hiccup -- is passing: the game stays on screen and the
 * poll carries on (a single failed poll used to replace a live game with "not found" for good).
 */
export function gameIsMissing(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 404 || error.status === 403);
}

export function useGame(id: string, active: boolean) {
  return useQuery({
    queryKey: gameKeys.game(id),
    queryFn: () => apiClient.get<ApiOk<GameView>>(`/quest/games/${id}`),
    // A game not found (404) is not asked about again until the screen is opened again.
    refetchInterval: (query) =>
      gameIsMissing(query.state.error) ? false : gamePollInterval(active, query.state.data?.data.status),
    refetchOnWindowFocus: true,
    // A game you are not in says so at once; a hiccup is tried again, a second apart.
    retry: (failures, error) => !gameIsMissing(error) && failures < 3,
    retryDelay: 1000,
  });
}

export type GameAction =
  { kind: 'start' } | { kind: 'end' } | { kind: 'leave' } | ({ kind: 'answer' } & GameAnswerInput);

/** The start, an answer, a leave or the end: each reply is the game now, written into the cache. */
export function useGameAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: GameAction) => {
      if (action.kind === 'answer') {
        const { kind: _kind, ...input } = action;
        return apiClient.post<ApiOk<GameView | null>>(`/quest/games/${id}/answer`, input);
      }
      return apiClient.post<ApiOk<GameView | null>>(`/quest/games/${id}/${action.kind}`);
    },
    onSuccess: (game) => {
      if (game.data) queryClient.setQueryData(gameKeys.game(id), game);
      void queryClient.invalidateQueries({ queryKey: gameKeys.list });
    },
  });
}

export function useGameResults(id: string, team: string | null, enabled: boolean) {
  return useQuery({
    queryKey: gameKeys.results(id, team),
    queryFn: () =>
      apiClient.get<ApiOk<GameResults>>(
        `/quest/games/${id}/results${team ? `?team=${encodeURIComponent(team)}` : ''}`,
      ),
    enabled,
    staleTime: Infinity,
  });
}
