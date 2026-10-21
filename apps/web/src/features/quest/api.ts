import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  QuestAnswerInput,
  QuestLevelInput,
  QuestReviewInput,
  QuestReviewQueue,
  QuestState,
  QuestStudent,
  QuestSummary,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

// Phase 42: Question Quest. docs/gamification-plan.md.

export const questKeys = {
  all: ['quest'] as const,
  me: ['quest', 'me'] as const,
  review: ['quest', 'review'] as const,
  students: ['quest', 'students'] as const,
};

/** The student's level, the question to answer now, their points. */
export function useQuestState(enabled = true) {
  return useQuery({
    queryKey: questKeys.me,
    queryFn: () => apiClient.get<ApiOk<QuestState>>('/quest/me'),
    enabled,
    // The question must not change under the student while they answer it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Sends one answer; the reply is the next state, written straight into the cache. */
export function useAnswerQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuestAnswerInput) => apiClient.post<ApiOk<QuestState>>('/quest/answers', input),
    onSuccess: (state) => queryClient.setQueryData(questKeys.me, state),
  });
}

/** A reviewer's queue: the oldest answer waiting, how many wait, their points. */
export function useQuestReview(enabled = true) {
  return useQuery({
    queryKey: questKeys.review,
    queryFn: () => apiClient.get<ApiOk<QuestReviewQueue>>('/quest/review'),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useReviewQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, ...input }: QuestReviewInput & { attemptId: string }) =>
      apiClient.post<ApiOk<QuestReviewQueue>>(`/quest/review/${attemptId}`, input),
    onSuccess: (queue) => {
      queryClient.setQueryData(questKeys.review, queue);
      void queryClient.invalidateQueries({ queryKey: questKeys.students });
    },
  });
}

export function useQuestStudents(enabled = true) {
  return useQuery({
    queryKey: questKeys.students,
    queryFn: () => apiClient.get<ApiOk<QuestStudent[]>>('/quest/students'),
    enabled,
  });
}

export function useSetQuestLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, ...input }: QuestLevelInput & { studentId: string }) =>
      apiClient.put<ApiOk<QuestStudent | null>>(`/quest/students/${studentId}/level`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: questKeys.students }),
  });
}

/** Who Quest is for, in this organization: a student plays; a tutor or an admin reviews. */
export function questRoles(roles: readonly string[] | undefined) {
  const list = roles ?? [];
  return {
    plays: list.includes('student'),
    reviews: list.includes('tutor') || list.includes('admin'),
  };
}

/** The numbers for the welcome popup (owner, 2026-10-21): read fresh each time Quest opens. */
export function useQuestSummary(enabled = true) {
  return useQuery({
    queryKey: [...questKeys.all, 'summary'] as const,
    queryFn: () => apiClient.get<ApiOk<QuestSummary>>('/quest/me/summary'),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
