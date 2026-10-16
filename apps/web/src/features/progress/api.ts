import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  Assessment,
  AssessmentPayload,
  AssessmentUpdatePayload,
  Curriculum,
  CurriculumLevel,
  LearningPlan,
  PlanPayload,
  PlanUpdatePayload,
  ProgressOverview,
  StudentProgress,
} from '@tmi/shared';
import { indexCurriculum } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

export const progressKeys = {
  all: ['progress'] as const,
  overview: () => ['progress', 'overview'] as const,
  student: (id: string) => ['progress', 'student', id] as const,
};

/**
 * The catalog as this organization sees it. It changes only with a deploy or
 * when an admin changes which curricula are offered -- which invalidates
 * ['curriculum'] (both keys) in this tab; other tabs see it on reload.
 */
export function useCurriculum() {
  return useQuery({
    queryKey: ['curriculum'],
    queryFn: () => apiClient.get<ApiOk<CurriculumLevel[]>>('/curriculum'),
    staleTime: Infinity,
  });
}

/**
 * Phase 35: the curricula on this organization's list, the default first and
 * retired last. A picker offers a switch only when two or more are offered.
 */
export function useCurricula() {
  return useQuery({
    queryKey: ['curriculum', 'curricula'],
    queryFn: () => apiClient.get<ApiOk<Curriculum[]>>('/curricula'),
    staleTime: Infinity,
  });
}

/**
 * Topic lookup by id ("BA3.10"), with its level and its catalog position, for
 * labelling anything scored (by its `code`) and sorting it in teaching order.
 */
export function useTopicIndex() {
  const { data } = useCurriculum();
  const levels = useMemo(() => data?.data ?? [], [data]);
  const topics = useMemo(() => indexCurriculum(levels), [levels]);

  return { levels, topics };
}

export function useProgressOverview(enabled = true) {
  return useQuery({
    queryKey: progressKeys.overview(),
    queryFn: () => apiClient.get<ApiOk<ProgressOverview[]>>('/progress'),
    enabled,
  });
}

export function useStudentProgress(studentId: string | undefined) {
  return useQuery({
    queryKey: progressKeys.student(studentId ?? ''),
    queryFn: () => apiClient.get<ApiOk<StudentProgress>>(`/progress/${studentId}`),
    enabled: Boolean(studentId),
  });
}

/** Anything written here moves the charts, the dashboards and the log. */
function useProgressInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: progressKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useCreateAssessment() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: (input: AssessmentPayload) =>
      apiClient.post<ApiOk<Assessment>>('/progress/assessments', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAssessment() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssessmentUpdatePayload }) =>
      apiClient.patch<ApiOk<Assessment>>(`/progress/assessments/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteAssessment() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/progress/assessments/${id}`),
    onSuccess: invalidate,
  });
}

export function useCreatePlan() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: (input: PlanPayload) => apiClient.post<ApiOk<LearningPlan>>('/progress/plans', input),
    onSuccess: invalidate,
  });
}

export function useUpdatePlan() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PlanUpdatePayload }) =>
      apiClient.patch<ApiOk<LearningPlan>>(`/progress/plans/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeletePlan() {
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/progress/plans/${id}`),
    onSuccess: invalidate,
  });
}
