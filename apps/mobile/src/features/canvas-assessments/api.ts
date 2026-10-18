// Ported from apps/web/src/features/canvas-assessments/api.ts @ 22b9701
//
// Mobile: the same hooks, query keys and invalidation sets. The web's `canvasAssessmentPdfUrl` (a
// plain link) becomes `fetchCanvasAssessmentPdf`: the app fetches the bytes through
// src/lib/download.ts and hands them to its in-app viewer, never to a file or the share sheet.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  CanvasAssessment,
  CanvasAssessmentDetail,
  CanvasAssessmentLevel,
  StartCanvasAssessmentInput,
  SubmitCanvasAssessmentInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { fetchBytes } from '@/lib/download';

// Phase 38: the Assessment menu (beta). docs/canvas-assessment-plan.md.

export const canvasAssessmentKeys = {
  all: ['canvas-assessments'] as const,
  list: ['canvas-assessments', 'list'] as const,
  levels: ['canvas-assessments', 'levels'] as const,
  detail: (id: string) => ['canvas-assessments', 'detail', id] as const,
  summary: (id: string) => ['canvas-assessments', 'summary', id] as const,
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
 * The PDF's bytes, for the in-app viewer: the organization and the session go along, as with every
 * request. Never written to a file. Only the student's tutors and the admins get it; anyone else, 404.
 */
export function fetchCanvasAssessmentPdf(id: string): Promise<Uint8Array> {
  return fetchBytes(`/canvas-assessments/${id}/pdf`, 'application/pdf');
}
