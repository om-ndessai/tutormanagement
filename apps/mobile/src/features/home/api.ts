// Ported from apps/web/src/features/home/api.ts @ working tree (Phase 66, H11): the member home in one
// read, `GET /api/home`. Under ['home'], so recording, starting or stopping a lesson, a schedule change
// and a cancellation refresh it (`useTeachingInvalidation`). Only the reader's own; no money.
// (Phase 43's `GET /home/tutor` is Tutoring's only now; the tutor block's `now` carries the same.)
// Phase 68 (H4): `usePinHome`, "Make this my home" (`PUT /api/home/pin`), which answers the new home.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, HomeFocus, MemberHome } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

export const memberHomeKey = ['home', 'member'] as const;

export function useMemberHome() {
  return useQuery({
    queryKey: memberHomeKey,
    queryFn: () => apiClient.get<ApiOk<MemberHome>>('/home'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Phase 68 (H4): "Make this my home" -- pin a focus, or null for automatic. Answers the new home. */
export function usePinHome() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (focus: HomeFocus | null) => apiClient.put<ApiOk<MemberHome>>('/home/pin', { focus }),
    onSuccess: (answer) => client.setQueryData(memberHomeKey, answer),
  });
}
