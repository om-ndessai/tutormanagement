import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApiOk, DashboardResponse, UserRole,
  MonthlyFinanceResponse,
  TutorTaxStatus,
} from '@tmi/shared';

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

/**
 * The month-by-month rundown, scoped to whoever is asking -- or, for an admin
 * viewing someone's dashboard, to that person.
 */
export function useMonthlyFinance(year: number, userId?: string) {
  return useQuery({
    queryKey: ['finance', 'monthly', year, userId ?? 'me'],
    queryFn: () =>
      apiClient.get<ApiOk<MonthlyFinanceResponse>>(
        `/payments/monthly${toQueryString({ year, user_id: userId })}`,
      ),
  });
}

/** Each tutor's year-end position: what they were paid, and whether we can file. */
export function useTaxStatus(year: number, enabled = true) {
  return useQuery({
    queryKey: ['finance', 'tax-status', year],
    queryFn: () => apiClient.get<ApiOk<TutorTaxStatus[]>>(`/payments/tax-status?year=${year}`),
    enabled,
  });
}
