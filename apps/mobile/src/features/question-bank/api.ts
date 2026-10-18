// Ported from apps/web/src/features/question-bank/api.ts @ b0d216e. `bankKeys` are identical (all
// five, so a later port shares them). Only the reviewing hooks are here: the app's console reviews
// the bank and leaves writing it to the desk (design #54). Left on the web, by design:
// useDraftQuestions and useCheckQuestions (paid model runs on the production key, minutes long, read
// in batches), useUpdateQuestion (an edit needs a keyboard and a fresh check), useSetNeedsFigure
// (it decides what gets written, so it stays with writing), and the AI page's hooks.
//
// One deliberate change from the web (#54, "no refetch per action, to save D1 reads"): after an
// action the web refetches the 200-question queue and the coverage, ~4,500 D1 rows per approval
// today. Here the server's answer is written into the caches, and the keys are only marked stale.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiOk, Question, QuestionCoverageLevel, QuestionStatus } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { applyActionToCoverage, applyActionToList, type QuestionFilter } from './bank-model';

export const bankKeys = {
  all: ['platform', 'questions'] as const,
  coverage: ['platform', 'questions', 'coverage'] as const,
  list: (filter: { topic_id?: string; status?: QuestionStatus }) =>
    ['platform', 'questions', 'list', filter] as const,
  aiTasks: ['platform', 'ai', 'tasks'] as const,
  aiRuns: ['platform', 'ai', 'runs'] as const,
};

/** Mobile: `enabled`, so the bank's tab reads it only once opened (Android mounts every tab). */
export function useQuestionCoverage(enabled = true) {
  return useQuery({
    queryKey: bankKeys.coverage,
    queryFn: () => apiClient.get<ApiOk<QuestionCoverageLevel[]>>('/platform/questions/coverage'),
    enabled,
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

export type QuestionActionKind = 'approve' | 'retire' | 'restore';

/**
 * Anything that changes a question changes the counts, the lists and the spend. The web refetches
 * them all; the app writes the answer in (the question leaves a list of a status it no longer has,
 * is replaced where else it shows, and one count moves in the coverage), then marks the same keys
 * stale without refetching. They are read again only on a pull to refresh, a screen's return
 * (the bank's coverage), or when Review's loaded page runs low.
 */
function useBankInvalidation() {
  const queryClient = useQueryClient();
  return (updated: Question) => {
    const lists = queryClient.getQueriesData<ApiOk<Question[]>>({
      queryKey: ['platform', 'questions', 'list'],
    });
    const before = lists
      .flatMap(([, data]) => data?.data ?? [])
      .find((question) => question.id === updated.id);
    for (const [key, data] of lists) {
      if (!data) continue;
      const filter = (key[3] ?? {}) as QuestionFilter;
      const next = applyActionToList(data.data, filter, updated);
      if (next !== data.data) queryClient.setQueryData(key, { ...data, data: next });
    }
    const coverage = queryClient.getQueryData<ApiOk<QuestionCoverageLevel[]>>(bankKeys.coverage);
    if (coverage && before) {
      queryClient.setQueryData(bankKeys.coverage, {
        ...coverage,
        data: applyActionToCoverage(coverage.data, before, updated),
      });
      void queryClient.invalidateQueries({ queryKey: bankKeys.all, refetchType: 'none' });
    } else {
      // Nothing cached to move a count from: let the coverage read again, as the web would.
      void queryClient.invalidateQueries({ queryKey: bankKeys.coverage });
      void queryClient.invalidateQueries({ queryKey: bankKeys.all, refetchType: 'none' });
    }
    void queryClient.invalidateQueries({ queryKey: ['platform', 'ai'], refetchType: 'none' });
  };
}

export function useQuestionAction() {
  const apply = useBankInvalidation();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: QuestionActionKind }) =>
      apiClient.post<ApiOk<Question>>(`/platform/questions/${id}/${action}`),
    onSuccess: (result) => apply(result.data),
  });
}
