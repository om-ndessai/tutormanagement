import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  CanvasAssessment,
  CanvasAssessmentDetail,
  CanvasAssessmentLevel,
  CanvasReview,
  SaveCanvasReviewInput,
  StartCanvasAssessmentInput,
  SubmitCanvasAssessmentInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { withOrg } from '@/lib/organization';

// Phase 38: the Assessment menu (beta). docs/canvas-assessment-plan.md.

export const canvasAssessmentKeys = {
  all: ['canvas-assessments'] as const,
  list: ['canvas-assessments', 'list'] as const,
  levels: ['canvas-assessments', 'levels'] as const,
  detail: (id: string) => ['canvas-assessments', 'detail', id] as const,
  summary: (id: string) => ['canvas-assessments', 'summary', id] as const,
  review: (id: string) => ['canvas-assessments', 'review', id] as const,
};

/** The grades, with how many approved questions each can draw on. */
export function useCanvasAssessmentLevels() {
  return useQuery({
    queryKey: canvasAssessmentKeys.levels,
    queryFn: () => apiClient.get<ApiOk<CanvasAssessmentLevel[]>>('/canvas-assessments/levels'),
    // Counting the bank reads every drawable question in D1 (thousands while the organization
    // includes unreviewed ones): once a few minutes is plenty.
    staleTime: 5 * 60_000,
  });
}

export function useCanvasAssessments() {
  return useQuery({
    queryKey: canvasAssessmentKeys.list,
    queryFn: () => apiClient.get<ApiOk<CanvasAssessment[]>>('/canvas-assessments'),
  });
}

/** One assessment; its questions come only to whoever is taking it. */
export function useCanvasAssessment(id: string | undefined) {
  return useQuery({
    queryKey: canvasAssessmentKeys.detail(id ?? ''),
    queryFn: () => apiClient.get<ApiOk<CanvasAssessmentDetail>>(`/canvas-assessments/${id}`),
    enabled: Boolean(id),
    // The questions do not change while it is taken: never refetch under the student.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** One assessment as a reviewer sees it: the row, never its questions. */
export function useCanvasAssessmentSummary(id: string | undefined) {
  return useQuery({
    queryKey: canvasAssessmentKeys.summary(id ?? ''),
    queryFn: () => apiClient.get<ApiOk<CanvasAssessmentDetail>>(`/canvas-assessments/${id}`),
    enabled: Boolean(id),
  });
}

export function useStartCanvasAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartCanvasAssessmentInput) =>
      apiClient.post<ApiOk<CanvasAssessment>>('/canvas-assessments', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.list }),
  });
}

export function useSubmitCanvasAssessment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCanvasAssessmentInput) =>
      apiClient.post<ApiOk<CanvasAssessment>>(`/canvas-assessments/${id}/submit`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.list });
      queryClient.removeQueries({ queryKey: canvasAssessmentKeys.detail(id) });
    },
  });
}

export function useDiscardCanvasAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<ApiOk<CanvasAssessment>>(`/canvas-assessments/${id}/discard`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.list }),
  });
}

/**
 * A PDF, as a plain link: the session cookie goes along, `?org=` names the
 * organization. The submitted one is the tutors' and admins'; the reviewed one
 * (Phase 40) the student's whole audience's.
 */
export function canvasAssessmentPdfUrl(id: string, kind: 'submitted' | 'reviewed' = 'submitted'): string {
  return withOrg(`/api/canvas-assessments/${id}/pdf${kind === 'reviewed' ? '?kind=reviewed' : ''}`);
}

// Phase 40: the tutor's review.

export function useCanvasReview(id: string | undefined) {
  return useQuery({
    queryKey: canvasAssessmentKeys.review(id ?? ''),
    queryFn: () => apiClient.get<ApiOk<CanvasReview>>(`/canvas-assessments/${id}/review`),
    enabled: Boolean(id),
    // The editor owns the draft once loaded: never refetch it under the tutor's pen.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveCanvasReview(id: string) {
  return useMutation({
    mutationFn: (input: SaveCanvasReviewInput) => apiClient.put<ApiOk<{ saved: boolean }>>(`/canvas-assessments/${id}/review`, input),
  });
}

function useReviewStep(id: string, step: 'finish' | 'reopen') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<ApiOk<CanvasAssessment>>(`/canvas-assessments/${id}/review/${step}`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.list });
      void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.summary(id) });
      void queryClient.invalidateQueries({ queryKey: canvasAssessmentKeys.review(id) });
    },
  });
}

/** Saves the review as reviewed: the reviewed PDF is written and the family can read it. */
export function useFinishCanvasReview(id: string) {
  return useReviewStep(id, 'finish');
}

export function useReopenCanvasReview(id: string) {
  return useReviewStep(id, 'reopen');
}
