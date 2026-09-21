import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiList,
  ApiOk,
  Comment,
  CommentPayload,
  CommentFeedEntry,
  CommentTarget,
  CommentTargetType,
  ListCommentFeedParams,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

export const commentKeys = {
  all: ['comments'] as const,
  thread: (target: CommentTarget) =>
    ['comments', 'thread', target.target_type, target.target_id] as const,
  counts: (targetType: CommentTargetType) => ['comments', 'counts', targetType] as const,
  feed: (params: Partial<ListCommentFeedParams>) => ['comments', 'feed', params] as const,
};

interface ThreadResponse {
  comments: Comment[];
  /** The name of the person a `user` thread is about, for the audience hint. */
  target_name: string | null;
}

/**
 * One thread, newest first.
 *
 * `enabled` exists because most threads hang off a row in a list and are only
 * worth fetching once somebody opens them.
 */
export function useComments(target: CommentTarget, enabled = true) {
  return useQuery({
    queryKey: commentKeys.thread(target),
    queryFn: () =>
      apiClient.get<ApiOk<ThreadResponse>>(
        `/comments${toQueryString({ target_type: target.target_type, target_id: target.target_id })}`,
      ),
    enabled,
  });
}

/**
 * How many comments hang off each target of one kind, so a list can show there
 * is something to read without opening every thread.
 */
export function useCommentCounts(targetType: CommentTargetType, enabled = true) {
  return useQuery({
    queryKey: commentKeys.counts(targetType),
    queryFn: () =>
      apiClient.get<ApiOk<Record<string, number>>>(
        `/comments/counts${toQueryString({ target_type: targetType })}`,
      ),
    enabled,
  });
}

/** Everything the viewer may read, whatever it hangs off, newest first. */
export function useCommentFeed(params: Partial<ListCommentFeedParams>) {
  return useQuery({
    queryKey: commentKeys.feed(params),
    queryFn: () =>
      apiClient.get<ApiList<CommentFeedEntry>>(
        `/comments/feed${toQueryString({
          target_type: params.target_type,
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

function useCommentInvalidation() {
  const queryClient = useQueryClient();

  return (target: CommentTarget) => {
    void queryClient.invalidateQueries({ queryKey: commentKeys.thread(target) });
    void queryClient.invalidateQueries({ queryKey: commentKeys.counts(target.target_type) });
    void queryClient.invalidateQueries({ queryKey: ['comments', 'feed'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useAddComment() {
  const invalidate = useCommentInvalidation();

  return useMutation({
    mutationFn: (input: CommentPayload) => apiClient.post<ApiOk<Comment>>('/comments', input),
    onSuccess: (_result, input) => invalidate(input),
  });
}

/** Withdrawing is the author's alone, so the target comes along for the cache. */
export function useDeleteComment() {
  const invalidate = useCommentInvalidation();

  return useMutation({
    mutationFn: ({ id }: { id: string; target: CommentTarget }) =>
      apiClient.delete<void>(`/comments/${id}`),
    onSuccess: (_result, { target }) => invalidate(target),
  });
}
