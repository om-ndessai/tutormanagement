// The directory a page at a time, for a phone list that grows as it is scrolled. The web pages with
// Previous/Next over `useUsers` (api.ts, copied verbatim); this is the same request, 25 a page, held
// as an infinite query. Its key starts with 'users', so every invalidation in api.ts (create,
// update, delete, restore, SSN receipt) refreshes it.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ApiList, User } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import type { UsersListParams } from './api';

export const USERS_PAGE_SIZE = 25;

export type UsersFilter = Omit<UsersListParams, 'limit' | 'offset'>;

export function useUserPages(filter: UsersFilter) {
  return useInfiniteQuery({
    queryKey: ['users', 'pages', filter] as const,
    queryFn: ({ pageParam }) =>
      apiClient.get<ApiList<User>>(
        `/users${toQueryString({
          search: filter.search,
          role: filter.role,
          status: filter.status,
          include_deleted: filter.include_deleted,
          sort: filter.sort,
          order: filter.order,
          limit: USERS_PAGE_SIZE,
          offset: pageParam,
        })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < last.meta.total && last.data.length > 0 ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
}
