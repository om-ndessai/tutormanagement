// Ported from apps/web/src/features/organizations/api.ts @ 1132322 (the Phase 52 block @ 9485a8e)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  CreateSpaceInput,
  CurriculumOffering,
  JoinRequest,
  SpaceCode,
  SpaceLookup,
  CurriculumOfferingInput,
  NotificationLogEntry,
  OrganizationSettings,
  UpdateOrganizationSettingsInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const settingsKey = ['organization', 'settings'] as const;

/** The payer details on every 1099 the organization issues. Its admins only. */
export function useOrganizationSettings(enabled: boolean) {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => apiClient.get<ApiOk<OrganizationSettings>>('/organization/settings'),
    enabled,
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationSettingsInput) =>
      apiClient.patch<ApiOk<OrganizationSettings>>('/organization/settings', input),
    onSuccess: (response) => queryClient.setQueryData(settingsKey, response),
  });
}

const curriculaKey = ['organization', 'curricula'] as const;

/** Phase 35: every curriculum the organization may offer, with its standing here. Its admins only. */
export function useCurriculumOfferings(enabled: boolean) {
  return useQuery({
    queryKey: curriculaKey,
    queryFn: () => apiClient.get<ApiOk<CurriculumOffering[]>>('/organization/curricula'),
    enabled,
  });
}

/**
 * Replaces the choice of curricula. Every picker reads the catalog through it,
 * so ['curriculum'] (the catalog and the list) is fetched again; other open
 * tabs see the change on reload.
 */
export function useUpdateCurriculumOffering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CurriculumOfferingInput) =>
      apiClient.put<ApiOk<CurriculumOffering[]>>('/organization/curricula', input),
    onSuccess: (response) => {
      queryClient.setQueryData(curriculaKey, response);
      void queryClient.invalidateQueries({ queryKey: ['curriculum'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

const notificationsKey = ['organization', 'notifications'] as const;

/** Phase 32: the recent notification attempts, newest first. Its admins only. */
export function useOrganizationNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiClient.get<ApiOk<NotificationLogEntry[]>>('/organization/notifications'),
    enabled,
  });
}

/** Accepts or declines an invitation; the session is re-read afterwards. */
export function useAnswerInvitation() {
  return useMutation({
    mutationFn: ({ slug, accept }: { slug: string; accept: boolean }) =>
      apiClient.post(`/auth/invitations/${encodeURIComponent(slug)}/${accept ? 'accept' : 'decline'}`),
  });
}

/** Chooses the organization the person lands in on signing in (`null` clears it). */
export function useSetDefaultOrganization() {
  const { refreshSession } = useAuth();
  return useMutation({
    mutationFn: (slug: string | null) =>
      apiClient.put<ApiOk<{ default_organization: string | null }>>('/auth/default-organization', { slug }),
    onSuccess: () => refreshSession(),
  });
}

// ---------------------------------------------------------------------------
// Phase 52: spaces -- joining with a code, making one, and its admins' side
// ---------------------------------------------------------------------------

/** What a code opens (404 for no space, or one with joining by code off). */
export function useLookupSpace() {
  return useMutation({
    mutationFn: (code: string) => apiClient.post<ApiOk<SpaceLookup>>('/spaces/lookup', { code }),
  });
}

export function useAskToJoin() {
  const { refreshSession } = useAuth();
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post<ApiOk<{ requested: true; slug: string }>>('/spaces/join-requests', { code }),
    onSuccess: () => refreshSession(),
  });
}

export function useWithdrawRequest() {
  const { refreshSession } = useAuth();
  return useMutation({
    mutationFn: (slug: string) => apiClient.delete(`/spaces/join-requests/${encodeURIComponent(slug)}`),
    onSuccess: () => refreshSession(),
  });
}

export function useMarkDeclinesSeen() {
  return useMutation({ mutationFn: () => apiClient.post('/spaces/join-requests/seen') });
}

export function useMakeSpace() {
  const { refreshSession } = useAuth();
  return useMutation({
    mutationFn: (input: CreateSpaceInput) => apiClient.post<ApiOk<{ slug: string; name: string }>>('/spaces', input),
    onSuccess: () => refreshSession(),
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => apiClient.delete('/auth/account') });
}

export const codeKey = ['organization', 'code'] as const;
export const requestsKey = ['organization', 'join-requests'] as const;

/** The space's code and switch. Its admins only. */
export function useSpaceCode(enabled: boolean) {
  return useQuery({
    queryKey: codeKey,
    queryFn: () => apiClient.get<ApiOk<SpaceCode>>('/organization/code'),
    enabled,
  });
}

export function useRenewSpaceCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<ApiOk<SpaceCode>>('/organization/code'),
    onSuccess: (response) => queryClient.setQueryData(codeKey, response),
  });
}

export function useSetJoinByCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => apiClient.put<ApiOk<SpaceCode>>('/organization/code', { join_by_code: on }),
    onSuccess: (response) => queryClient.setQueryData(codeKey, response),
  });
}

/** Open requests to join. Its admins only. */
export function useJoinRequests(enabled: boolean) {
  return useQuery({
    queryKey: requestsKey,
    queryFn: () => apiClient.get<ApiOk<JoinRequest[]>>('/organization/join-requests'),
    enabled,
  });
}

export function useDeclineJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClient.post(`/organization/join-requests/${encodeURIComponent(userId)}/decline`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestsKey }),
  });
}

/** After letting someone in through the person form. */
export function useRefreshJoinRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: requestsKey });
}

export function useLeaveSpace() {
  return useMutation({ mutationFn: () => apiClient.post('/organization/leave') });
}

export function useDeleteSpace() {
  return useMutation({
    mutationFn: (confirmName: string) => apiClient.delete('/organization', { confirm_name: confirmName }),
  });
}
