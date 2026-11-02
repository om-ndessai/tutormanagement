// Ported from apps/web/src/features/habit/habit-api.ts @ 0e3ec7a (working tree). Phase 64 (P17-P19,
// docs/stickiness-plan.md). The same query keys, reads and invalidation as the web.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, DailyResultInput, DailySet, HabitSummary } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

/** Phase 64 (P17-P18): the reader's own streak and badges here. */
export function useHabit(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'habit'] as const,
    queryFn: () => apiClient.get<ApiOk<HabitSummary>>('/quest/me/habit'),
    enabled,
    staleTime: 60_000,
  });
}

/** Phase 64 (P19): today's Daily set of a level, and the reader's result if they have played it. */
export function useDaily(levelId: string | null) {
  return useQuery({
    queryKey: ['quest', 'daily', levelId] as const,
    queryFn: () => apiClient.get<ApiOk<DailySet>>(`/quest/daily/${encodeURIComponent(levelId!)}`),
    enabled: levelId !== null,
  });
}

export function useSaveDaily(levelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DailyResultInput) =>
      apiClient.post<ApiOk<DailySet>>(`/quest/daily/${encodeURIComponent(levelId)}/result`, input),
    onSuccess: (result) => {
      queryClient.setQueryData(['quest', 'daily', levelId], result);
      void queryClient.invalidateQueries({ queryKey: ['quest', 'habit'] });
    },
  });
}
