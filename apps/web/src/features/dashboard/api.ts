import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApiOk, DashboardResponse, UserRole } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

export function useDashboard(params: { role?: UserRole; userId?: string }) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () =>
      apiClient.get<ApiOk<DashboardResponse>>(
        `/dashboard${toQueryString({ role: params.role, user_id: params.userId })}`,
      ),
    // Switching role or subject should not blank the page.
    placeholderData: keepPreviousData,
  });
}
