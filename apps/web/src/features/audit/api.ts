import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApiList, ApiOk, AuditEvent, ListAuditParams } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

export type AuditParams = Partial<ListAuditParams>;

export const auditKeys = {
  all: ['audit'] as const,
  list: (params: AuditParams) => ['audit', 'list', params] as const,
  actions: ['audit', 'actions'] as const,
};

export function useAuditEvents(params: AuditParams, enabled = true) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () =>
      apiClient.get<ApiList<AuditEvent>>(
        `/audit${toQueryString({
          user_id: params.user_id,
          actor_user_id: params.actor_user_id,
          action: params.action,
          entity: params.entity,
          from: params.from,
          to: params.to,
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Only the actions that actually appear in the log, for the filter dropdown. */
export function useAuditActions() {
  return useQuery({
    queryKey: auditKeys.actions,
    queryFn: () => apiClient.get<ApiOk<string[]>>('/audit/actions'),
    staleTime: 60_000,
  });
}
