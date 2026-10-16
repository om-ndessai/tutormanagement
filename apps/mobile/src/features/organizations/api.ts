// Ported from apps/web/src/features/organizations/api.ts @ 1132322
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  CurriculumOffering,
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
