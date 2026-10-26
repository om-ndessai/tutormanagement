// Ported from apps/web/src/features/sharing/api.ts @ 3279506 (the signed-in half: the public page is the web's)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, CreateShareInput, Share } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

/** Phase 56: the reader's own shares, making one, withdrawing one. */
const KEY = ['shares'] as const;

export function useMyShares(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => apiClient.get<ApiOk<Share[]>>('/shares'), enabled });
}

export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShareInput) => apiClient.post<ApiOk<Share>>('/shares', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useWithdrawShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/shares/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
