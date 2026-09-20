import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiList,
  ApiOk,
  Assignment,
  AssignmentPayload,
  AssignmentUpdatePayload,
  ListAssignmentsParams,
  ListSessionsParams,
  SessionPayload,
  SessionTotals,
  SessionUpdatePayload,
  TutoringSession,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

export const teachingKeys = {
  assignments: (params: Partial<ListAssignmentsParams>) => ['assignments', params] as const,
  sessions: (params: Partial<ListSessionsParams>) => ['sessions', params] as const,
};

/** Sessions and assignments both feed the activity log, so both invalidate it. */
function useTeachingInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useAssignments(params: Partial<ListAssignmentsParams> = {}) {
  return useQuery({
    queryKey: teachingKeys.assignments(params),
    queryFn: () =>
      apiClient.get<ApiOk<Assignment[]>>(
        `/assignments${toQueryString({
          tutor_user_id: params.tutor_user_id,
          student_user_id: params.student_user_id,
          include_inactive: params.include_inactive,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateAssignment() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (input: AssignmentPayload) =>
      apiClient.post<ApiOk<Assignment>>('/assignments', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAssignment() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignmentUpdatePayload }) =>
      apiClient.patch<ApiOk<Assignment>>(`/assignments/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteAssignment() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/assignments/${id}`),
    onSuccess: invalidate,
  });
}

/** The list endpoint returns totals alongside the page, so they stay in step. */
interface SessionListResponse extends ApiList<TutoringSession> {
  totals: SessionTotals;
}

export function useSessions(params: Partial<ListSessionsParams> = {}) {
  return useQuery({
    queryKey: teachingKeys.sessions(params),
    queryFn: () =>
      apiClient.get<SessionListResponse>(
        `/sessions${toQueryString({
          tutor_user_id: params.tutor_user_id,
          student_user_id: params.student_user_id,
          from: params.from,
          to: params.to,
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useRecordSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (input: SessionPayload) =>
      apiClient.post<ApiOk<TutoringSession>>('/sessions', input),
    onSuccess: invalidate,
  });
}

export function useUpdateSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SessionUpdatePayload }) =>
      apiClient.patch<ApiOk<TutoringSession>>(`/sessions/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/sessions/${id}`),
    onSuccess: invalidate,
  });
}
