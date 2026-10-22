import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GAME_POLL_MS,
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

import { apiClient } from '@/lib/api-client';

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
    },
  });
}

/** The game now, polled while it is open: the lobby filling, the scores, the clock. */
export function useGame(id: string) {
  return useQuery({
    queryKey: gameKeys.game(id),
    queryFn: () => apiClient.get<ApiOk<GameView>>(`/quest/games/${id}`),
    refetchInterval: (query) => (query.state.data?.data.status === 'finished' ? false : GAME_POLL_MS),
    refetchOnWindowFocus: true,
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
    },
  });
}

export function useGameResults(id: string, team: string | null, enabled: boolean) {
  return useQuery({
    queryKey: gameKeys.results(id, team),
    queryFn: () =>
      apiClient.get<ApiOk<GameResults>>(`/quest/games/${id}/results${team ? `?team=${encodeURIComponent(team)}` : ''}`),
    enabled,
    staleTime: Infinity,
  });
}
