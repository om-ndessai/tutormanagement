import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
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

/** Accepts or declines an invitation; the session is re-read afterwards. */
export function useAnswerInvitation() {
  return useMutation({
    mutationFn: ({ slug, accept }: { slug: string; accept: boolean }) =>
      apiClient.post(`/auth/invitations/${encodeURIComponent(slug)}/${accept ? 'accept' : 'decline'}`),
  });
}

/**
 * Chooses the organization the person lands in on signing in (`null`
 * clears it). The session is re-read afterwards, so every menu shows it.
 */
export function useSetDefaultOrganization() {
  const { refreshSession } = useAuth();
  return useMutation({
    mutationFn: (slug: string | null) =>
      apiClient.put<ApiOk<{ default_organization: string | null }>>('/auth/default-organization', { slug }),
    onSuccess: () => refreshSession(),
  });
}
