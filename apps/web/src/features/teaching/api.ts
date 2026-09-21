import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActiveSession,
  ApiList,
  ApiOk,
  Assignment,
  AssignmentPayload,
  AssignmentUpdatePayload,
  ListAssignmentsParams,
  ListSessionsParams,
  SessionPayload,
  SessionTotals,
  StartSessionPayload,
  StopSessionPayload,
  UpdateActiveSessionPayload,
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
    void queryClient.invalidateQueries({ queryKey: ['active-session'] });
    void queryClient.invalidateQueries({ queryKey: ['balances'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

interface ActiveSessionResponse {
  mine: ActiveSession | null;
  all: ActiveSession[];
}

/**
 * The lesson currently running, if any.
 *
 * Polled rather than held in component state: the timer lives in the database
 * so it survives a refresh, and a tutor may start on a phone and stop on a
 * laptop. Polling keeps those views honest with each other.
 */
export function useActiveSession() {
  return useQuery({
    queryKey: ['active-session'],
    queryFn: () => apiClient.get<ApiOk<ActiveSessionResponse>>('/sessions/active'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useStartSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (input: StartSessionPayload) =>
      apiClient.post<ApiOk<ActiveSession>>('/sessions/active', input),
    onSuccess: invalidate,
  });
}

export function useUpdateActiveSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (input: UpdateActiveSessionPayload) =>
      apiClient.patch<ApiOk<ActiveSession>>('/sessions/active', input),
    onSuccess: invalidate,
  });
}

export function useStopSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: (input: StopSessionPayload) =>
      apiClient.post<ApiOk<TutoringSession>>('/sessions/active/stop', input),
    onSuccess: invalidate,
  });
}

export function useCancelActiveSession() {
  const invalidate = useTeachingInvalidation();

  return useMutation({
    mutationFn: () => apiClient.delete<undefined>('/sessions/active'),
    onSuccess: invalidate,
  });
}

/**
 * One session by id, for a link that points straight at it.
 *
 * The list is paged server-side, so a session somebody links to may not be on
 * the page the filters would show -- it has to be fetched on its own.
 */
export function useSession(id: string | null) {
  return useQuery({
    queryKey: ['sessions', 'one', id],
    queryFn: () => apiClient.get<ApiOk<TutoringSession>>(`/sessions/${id}`),
    enabled: Boolean(id),
  });
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
