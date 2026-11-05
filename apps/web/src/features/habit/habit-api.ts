import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, DailySet, HabitSummary } from '@tmi/shared';

import { memberHomeKey } from '@/features/home/api';
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
    mutationFn: (input: { day: string; answers: (string | null)[]; seconds: number }) =>
      apiClient.post<ApiOk<DailySet>>(`/quest/daily/${encodeURIComponent(levelId)}/result`, input),
    onSuccess: (result) => {
      queryClient.setQueryData(['quest', 'daily', levelId], result);
      void queryClient.invalidateQueries({ queryKey: ['quest', 'habit'] });
      // Phase 73: the day counts on the home, and Next up moves on.
      void queryClient.invalidateQueries({ queryKey: memberHomeKey });
    },
  });
}
