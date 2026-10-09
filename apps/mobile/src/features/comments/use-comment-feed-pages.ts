// The comments feed a page at a time, for a phone list that grows as it is scrolled. The web pages
// with Previous/Next over `useCommentFeed` (api.ts, copied verbatim); this is the same request, 25 a
// page, held as an infinite query. Its key starts with ['comments', 'feed'], so the invalidation
// every post and delete runs in api.ts refreshes it too.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ApiList, CommentFeedEntry, CommentTargetType } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

export const COMMENTS_PAGE_SIZE = 25;

export function useCommentFeedPages(targetType: CommentTargetType | undefined) {
  return useInfiniteQuery({
    queryKey: ['comments', 'feed', 'pages', { target_type: targetType }] as const,
    queryFn: ({ pageParam }) =>
      apiClient.get<ApiList<CommentFeedEntry>>(
        `/comments/feed${toQueryString({
          target_type: targetType,
          limit: COMMENTS_PAGE_SIZE,
          offset: pageParam,
        })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < last.meta.total && last.data.length > 0 ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
}
