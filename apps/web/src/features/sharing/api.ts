import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, ChallengeAnswerInput, ChallengeResult, CreateShareInput, PublicShare, Share } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

/** Phase 56: the reader's own shares, making one, withdrawing one; and the public page's reads. */
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

export function usePublicShare(id: string) {
  return useQuery({
    queryKey: ['public-share', id],
    queryFn: () => apiClient.get<ApiOk<PublicShare>>(`/public/shares/${id}`),
    retry: false,
  });
}

export function useAnswerChallenge(id: string) {
  return useMutation({
    mutationFn: (input: ChallengeAnswerInput) =>
      apiClient.post<ApiOk<ChallengeResult>>(`/public/challenge/${id}/answer`, input),
  });
}
