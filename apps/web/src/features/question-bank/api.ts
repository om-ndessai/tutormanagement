import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiRun,
  AiTaskId,
  AiTaskStatus,
  AiTaskUpdateInput,
  ApiOk,
  Question,
  QuestionCoverageLevel,
  QuestionStatus,
  QuestionUpdateInput,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

// The question bank and the AI page of the platform console (Phase 36).

export const bankKeys = {
  all: ['platform', 'questions'] as const,
  coverage: ['platform', 'questions', 'coverage'] as const,
  list: (filter: { topic_id?: string; status?: QuestionStatus }) =>
    ['platform', 'questions', 'list', filter] as const,
  aiTasks: ['platform', 'ai', 'tasks'] as const,
  aiRuns: ['platform', 'ai', 'runs'] as const,
};

export function useQuestionCoverage() {
  return useQuery({
    queryKey: bankKeys.coverage,
    queryFn: () => apiClient.get<ApiOk<QuestionCoverageLevel[]>>('/platform/questions/coverage'),
  });
}

export function useQuestions(filter: { topic_id?: string; status?: QuestionStatus }, enabled = true) {
  return useQuery({
    queryKey: bankKeys.list(filter),
    queryFn: () =>
      apiClient.get<ApiOk<Question[]>>(`/platform/questions${toQueryString({ ...filter, limit: 200 })}`),
    enabled,
  });
}

/** Anything that changes a question changes the counts, the lists and the spend. */
function useBankInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: bankKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['platform', 'ai'] });
  };
}

export function useDraftQuestions() {
  const invalidate = useBankInvalidation();
  return useMutation({
    mutationFn: (input: { topic_id: string; count?: number }) =>
      apiClient.post<ApiOk<{ questions: Question[]; note: string }>>('/platform/questions/draft', input),
    onSuccess: invalidate,
  });
}

export function useCheckQuestions() {
  const invalidate = useBankInvalidation();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post<ApiOk<Question[]>>('/platform/questions/check', { ids }),
    onSuccess: invalidate,
  });
}

export function useUpdateQuestion() {
  const invalidate = useBankInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: QuestionUpdateInput }) =>
      apiClient.patch<ApiOk<Question>>(`/platform/questions/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useQuestionAction() {
  const invalidate = useBankInvalidation();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'retire' | 'restore' }) =>
      apiClient.post<ApiOk<Question>>(`/platform/questions/${id}/${action}`),
    onSuccess: invalidate,
  });
}

export function useSetNeedsFigure() {
  const invalidate = useBankInvalidation();
  return useMutation({
    mutationFn: ({ topicId, needs_figure }: { topicId: string; needs_figure: boolean }) =>
      apiClient.patch<ApiOk<{ topic_id: string; needs_figure: boolean }>>(
        `/platform/questions/topics/${encodeURIComponent(topicId)}`,
        { needs_figure },
      ),
    onSuccess: invalidate,
  });
}

export function useAiTasks() {
  return useQuery({
    queryKey: bankKeys.aiTasks,
    queryFn: () => apiClient.get<ApiOk<AiTaskStatus[]>>('/platform/ai/tasks'),
  });
}

export function useUpdateAiTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, input }: { task: AiTaskId; input: AiTaskUpdateInput }) =>
      apiClient.patch<ApiOk<AiTaskStatus>>(`/platform/ai/tasks/${task}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'ai'] }),
  });
}

export function useAiRuns() {
  return useQuery({
    queryKey: bankKeys.aiRuns,
    queryFn: () => apiClient.get<ApiOk<AiRun[]>>('/platform/ai/runs?limit=100'),
  });
}
