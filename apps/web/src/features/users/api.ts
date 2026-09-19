import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type {
  ApiList,
  ApiOk,
  CreateUserPayload,
  ListUsersParams,
  UpdateUserPayload,
  User,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

export type UsersListParams = Partial<ListUsersParams>;

export const userKeys = {
  all: ['users'] as const,
  list: (params: UsersListParams) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

function listPath(params: UsersListParams) {
  return `/users${toQueryString({
    search: params.search,
    role: params.role,
    status: params.status,
    include_deleted: params.include_deleted,
    sort: params.sort,
    order: params.order,
    limit: params.limit,
    offset: params.offset,
  })}`;
}

export function useUsers(params: UsersListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => apiClient.get<ApiList<User>>(listPath(params)),
    // Keeps the current page visible while the next one loads, so filtering
    // and paging do not flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserPayload) =>
      apiClient.post<ApiOk<User>>('/users', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserPayload }) =>
      apiClient.patch<ApiOk<User>>(`/users/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/** Soft delete by default; `hard` removes the row for good. */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, hard = false }: { id: string; hard?: boolean }) =>
      apiClient.delete<ApiOk<User> | undefined>(`/users/${id}${hard ? '?hard=true' : ''}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.post<ApiOk<User>>(`/users/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}
