import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiList, ApiOk, Assignment, Location, LocationPayload, LocationUpdatePayload } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

// Phase 33: a person's own locations, and a pairing's allowed set.

export const locationKeys = {
  all: ['locations'] as const,
  owner: (userId: string) => ['locations', userId] as const,
  organization: ['locations', 'organization'] as const,
};

/** Locations show up inside pairings and schedules too, so a change refreshes all three. */
function useLocationInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: locationKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

/** Every tutor's and student's locations in the organization: the admins' Locations page. */
export function useOrganizationLocations() {
  return useQuery({
    queryKey: locationKeys.organization,
    queryFn: () => apiClient.get<ApiList<Location>>('/locations'),
  });
}

export function useLocations(userId: string | null) {
  return useQuery({
    queryKey: locationKeys.owner(userId ?? ''),
    queryFn: () => apiClient.get<ApiList<Location>>(`/locations?user_id=${userId}`),
    enabled: Boolean(userId),
  });
}

export function useCreateLocation() {
  const invalidate = useLocationInvalidation();
  return useMutation({
    mutationFn: (input: LocationPayload) => apiClient.post<ApiOk<Location>>('/locations', input),
    onSuccess: invalidate,
  });
}

export function useUpdateLocation() {
  const invalidate = useLocationInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LocationUpdatePayload }) =>
      apiClient.patch<ApiOk<Location>>(`/locations/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLocation() {
  const invalidate = useLocationInvalidation();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/locations/${id}`),
    onSuccess: invalidate,
  });
}

export function useSetPairingLocations() {
  const invalidate = useLocationInvalidation();
  return useMutation({
    mutationFn: ({ assignmentId, locationIds }: { assignmentId: string; locationIds: string[] }) =>
      apiClient.put<ApiOk<Assignment>>(`/assignments/${assignmentId}/locations`, { location_ids: locationIds }),
    onSuccess: invalidate,
  });
}
