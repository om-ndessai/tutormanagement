import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  OrganizationSettings,
  UpdateOrganizationSettingsInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

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
