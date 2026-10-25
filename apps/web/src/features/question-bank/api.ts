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

// The coverage and a status's list each read every question of the bank in D1, so they are not
// refetched on every focus or after every approval: a review session of a few hundred approvals
// would otherwise spend the account's daily read allowance (5 M rows, shared with every
// organization). A minute's staleness is harmless; approvals write into the caches instead.
const BANK_STALE_MS = 60_000;

export function useQuestionCoverage() {
  return useQuery({
    queryKey: bankKeys.coverage,
    queryFn: () => apiClient.get<ApiOk<QuestionCoverageLevel[]>>('/platform/questions/coverage'),
    staleTime: BANK_STALE_MS,
  });
}

/** How many a list loads at once; the review queue asks for more as it runs low. */
export const QUESTION_PAGE = 200;

export function useQuestions(
  filter: { topic_id?: string; status?: QuestionStatus; suggested?: 'true' },
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.list(filter),
    queryFn: () =>
      apiClient.get<ApiOk<Question[]>>(`/platform/questions${toQueryString({ ...filter, limit: QUESTION_PAGE })}`),
    enabled,
    staleTime: BANK_STALE_MS,
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

type CoverageCount = 'checked' | 'flagged' | 'draft';
const COUNTED: readonly QuestionStatus[] = ['checked', 'flagged', 'draft'];

/**
 * Approve, retire and restore change one question and nothing else, so the answer is written
 * into the lists and the coverage already loaded instead of refetching them (see BANK_STALE_MS).
 */
function useApplyQuestion() {
  const queryClient = useQueryClient();
  return (question: Question) => {
    let before: Question | undefined;
    for (const [key, data] of queryClient.getQueriesData<ApiOk<Question[]>>({ queryKey: [...bankKeys.all, 'list'] })) {
      if (!data) continue;
      const filter = key[3] as { topic_id?: string; status?: QuestionStatus } | undefined;
      const index = data.data.findIndex((q) => q.id === question.id);
      if (index === -1) continue;
      before ??= data.data[index];
      const belongs = !filter?.status || filter.status === question.status;
      queryClient.setQueryData<ApiOk<Question[]>>(key, {
        ...data,
        data: belongs ? data.data.map((q) => (q.id === question.id ? question : q)) : data.data.filter((q) => q.id !== question.id),
      });
    }
    queryClient.setQueryData<ApiOk<QuestionCoverageLevel[]>>(bankKeys.coverage, (coverage) => {
      if (!coverage || !before) return coverage;
      const was = before;
      return {
        ...coverage,
        data: coverage.data.map((level) => ({
          ...level,
          topics: level.topics.map((topic) => {
            if (topic.topic_id !== question.topic_id) return topic;
            const next = { ...topic, approved: [...topic.approved] as [number, number, number] };
            const shift = (status: QuestionStatus, difficulty: number, by: number) => {
              if (status === 'approved') next.approved[difficulty - 1] = Math.max(0, next.approved[difficulty - 1]! + by);
              else if (COUNTED.includes(status)) next[status as CoverageCount] = Math.max(0, next[status as CoverageCount] + by);
            };
            shift(was.status, was.difficulty, -1);
            shift(question.status, question.difficulty, 1);
            return next;
          }),
        })),
      };
    });
  };
}

export function useQuestionAction() {
  const apply = useApplyQuestion();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'retire' | 'restore' }) =>
      apiClient.post<ApiOk<Question>>(`/platform/questions/${id}/${action}`),
    onSuccess: (result) => apply(result.data),
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
