import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  gameRefetchDelay,
  type ApiOk,
  type CreateGameRequest,
  type GameAnswerInput,
  type GameFavorite,
  type GameFavoriteRequest,
  type GameLevel,
  type GameLookup,
  type GameResults,
  type GameSummary,
  type GameView,
  type JoinGameInput,
} from '@tmi/shared';

import { memberHomeKey } from '@/features/home/api';
import { openGameKey } from '@/features/play/play-api';
import { ApiRequestError, apiClient } from '@/lib/api-client';

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
      // Phase 73 (JF13): Continue now names this game.
      queryClient.removeQueries({ queryKey: openGameKey });
      // Phase 77 (JF15): and a child's card offers "Continue with <child>" for a game on this device.
      void queryClient.invalidateQueries({ queryKey: memberHomeKey });
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
    mutationFn: (input: GameFavoriteRequest) => apiClient.put<ApiOk<GameFavorite>>('/quest/games/favorites', input),
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
      queryClient.removeQueries({ queryKey: openGameKey });
    },
  });
}

/** The game now, polled while it is open: the lobby filling, the scores, the clock. */
/**
 * Only a 404 or 403 means the game is not there for this reader. Anything else -- a dropped
 * connection, a server hiccup -- is passing: the game stays on screen and the poll carries on.
 */
export function gameIsMissing(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 404 || error.status === 403);
}

export function useGame(id: string) {
  return useQuery({
    queryKey: gameKeys.game(id),
    queryFn: () => apiClient.get<ApiOk<GameView>>(`/quest/games/${id}`),
    // Phase 62 (P4): a game of several teams every GAME_POLL_MS; a single player's only at the
    // countdown's end and when its time is up (each answer's reply carries the game).
    refetchInterval: (query) =>
      gameIsMissing(query.state.error)
        ? false
        : gameRefetchDelay(query.state.data?.data, query.state.dataUpdatedAt, Date.now()),
    refetchOnWindowFocus: true,
    // A game you are not in says so at once; a hiccup is tried again, a second apart.
    retry: (failures, error) => !gameIsMissing(error) && failures < 3,
    retryDelay: 1000,
  });
}

/** The start, an answer, a leave or the end: each reply is the game now, written into the cache. */
export function useGameAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: { kind: 'start' } | { kind: 'end' } | { kind: 'leave' } | ({ kind: 'answer' } & GameAnswerInput)) => {
      if (action.kind === 'answer') {
        const { kind: _kind, ...input } = action;
        return apiClient.post<ApiOk<GameView | null>>(`/quest/games/${id}/answer`, input);
      }
      return apiClient.post<ApiOk<GameView | null>>(`/quest/games/${id}/${action.kind}`);
    },
    onSuccess: (game) => {
      if (game.data) queryClient.setQueryData(gameKeys.game(id), game);
      void queryClient.invalidateQueries({ queryKey: gameKeys.list });
      // Phase 73 (JF13): where the reader is in the game moved (or they left it, or it ended). Dropped rather than
      // refetched: nothing reads it while the game is on screen, so this costs no request until the home is back,
      // and the home never shows the old words meanwhile.
      queryClient.removeQueries({ queryKey: openGameKey });
    },
  });
}

export function useGameResults(id: string, team: string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: gameKeys.results(id, team),
    queryFn: async () => {
      const results = await apiClient.get<ApiOk<GameResults>>(`/quest/games/${id}/results${team ? `?team=${encodeURIComponent(team)}` : ''}`);
      // Phase 64: a finished game moves My progress and a tile's best, so they are read again on the way home.
      void queryClient.invalidateQueries({ queryKey: ['quest', 'habit'] });
      void queryClient.invalidateQueries({ queryKey: ['quest', 'tiles'] });
      // Phase 73 (JF16, JF36): and the home itself -- the day counts, Next up moves, Continue offers "again".
      queryClient.removeQueries({ queryKey: openGameKey });
      void queryClient.invalidateQueries({ queryKey: memberHomeKey });
      return results;
    },
    enabled,
    staleTime: Infinity,
  });
}
