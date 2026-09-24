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
  SessionDraft,
  SessionDraftInput,
  SessionAssessmentInput,
  SessionReflectionInput,
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
    // A lesson changes its month's sessions, hours, billed and earned.
    void queryClient.invalidateQueries({ queryKey: ['finance'] });
    // A scored lesson moves the student's progress and every chart of it.
    void queryClient.invalidateQueries({ queryKey: ['progress'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** The viewer's own unposted write-ups. Nobody else's are ever returned. */
export function useMyDrafts() {
  return useQuery({
    queryKey: ['session-drafts'],
    queryFn: () => apiClient.get<ApiOk<SessionDraft[]>>('/sessions/drafts'),
  });
}

function useDraftInvalidation() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['session-drafts'] });
}

export function useSaveDraft() {
  const invalidateDrafts = useDraftInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SessionDraftInput }) =>
      id
        ? apiClient.patch<ApiOk<SessionDraft>>(`/sessions/drafts/${id}`, input)
        : apiClient.post<ApiOk<SessionDraft>>('/sessions/drafts', input),
    onSuccess: invalidateDrafts,
  });
}

export function useDiscardDraft() {
  const invalidateDrafts = useDraftInvalidation();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/sessions/drafts/${id}`),
    onSuccess: invalidateDrafts,
  });
}

/**
 * Posts a draft. This is the moment it becomes a lesson everybody concerned
 * can see, so it invalidates the teaching views as well as the drafts.
 */
export function usePostDraft() {
  const invalidateDrafts = useDraftInvalidation();
  const invalidateTeaching = useTeachingInvalidation();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<ApiOk<TutoringSession>>(`/sessions/drafts/${id}/post`),
    onSuccess: () => {
      invalidateDrafts();
      invalidateTeaching();
    },
  });
}

// ---------------------------------------------------------------------------
// Assessments (Phase 23)
// ---------------------------------------------------------------------------

/** An assessment changes the lesson it is on, and the log; nothing with money. */
function useAssessmentInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

/** Gives or revises the reader's own assessment of a lesson. */
export function useSaveSessionAssessment() {
  const invalidate = useAssessmentInvalidation();

  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: SessionAssessmentInput }) =>
      apiClient.put<ApiOk<TutoringSession>>(`/sessions/${sessionId}/assessment`, input),
    onSuccess: invalidate,
  });
}

/** Withdraws the reader's own assessment. There is no way to remove another's. */
export function useWithdrawSessionAssessment() {
  const invalidate = useAssessmentInvalidation();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete<undefined>(`/sessions/${sessionId}/assessment`),
    onSuccess: invalidate,
  });
}

/**
 * The lesson before this one with the same student, for the review parts of
 * the write-up: what was set last time is what is being checked now.
 *
 * Read through the ordinary list, so it is only ever a lesson the reader may
 * already see -- for a tutor, the last one THEY taught that student.
 */
export function usePreviousSession(
  studentId: string | undefined,
  before: { occurredOn: string; startedAt: string },
  excludeId: string | undefined,
) {
  return useQuery({
    // The time and the lesson being edited are applied in `select`, so moving
    // the start time re-filters what was fetched rather than fetching again.
    queryKey: ['sessions', 'previous', studentId, before.occurredOn],
    queryFn: () =>
      apiClient.get<SessionListResponse>(
        `/sessions${toQueryString({ student_user_id: studentId, to: before.occurredOn, limit: 5 })}`,
      ),
    enabled: Boolean(studentId && before.occurredOn),
    select: (response) =>
      response.data.find(
        (session) =>
          session.id !== excludeId &&
          (session.occurred_on < before.occurredOn ||
            (session.occurred_on === before.occurredOn && session.started_at < before.startedAt)),
      ) ?? null,
  });
}

// ---------------------------------------------------------------------------
// The student's reflection (Phase 25)
// ---------------------------------------------------------------------------

/** Records or revises the student's reflection on a lesson. */
export function useSaveReflection() {
  const invalidate = useAssessmentInvalidation();

  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: SessionReflectionInput }) =>
      apiClient.put<ApiOk<TutoringSession>>(`/sessions/${sessionId}/reflection`, input),
    onSuccess: invalidate,
  });
}

/** Withdraws the student's reflection, where the reader may. */
export function useWithdrawReflection() {
  const invalidate = useAssessmentInvalidation();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete<undefined>(`/sessions/${sessionId}/reflection`),
    onSuccess: invalidate,
  });
}
