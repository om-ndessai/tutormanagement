// Ported from apps/web/src/features/comments/comments-page.tsx @ 1132322 (`commentTargetHref`,
// the filter labels and the icon per kind of target).
import type { CommentFeedEntry, CommentTargetType } from '@tmi/shared';
import type { Href } from 'expo-router';

/** Material Community glyphs standing in for the web's lucide icons. */
export const TARGET_ICONS: Record<CommentTargetType, string> = {
  user: 'account-outline',
  session: 'book-open-outline',
  assignment: 'link-variant',
  scheduled_session: 'calendar-month-outline',
};

export const FILTER_LABELS: Record<CommentTargetType, string> = {
  user: 'People',
  session: 'Sessions',
  assignment: 'Pairings',
  scheduled_session: 'Schedule',
};

/**
 * Where a comment's subject lives in the app. A person and a lesson have screens of their own
 * here; a pairing and a recurring slot are rows in a list, which narrows to them on `focus`.
 */
export function commentTargetHref(entry: Pick<CommentFeedEntry, 'target_type' | 'target_id'>): Href {
  switch (entry.target_type) {
    case 'user':
      return { pathname: '/people/[id]', params: { id: entry.target_id } };
    case 'session':
      return { pathname: '/sessions/[id]', params: { id: entry.target_id } };
    case 'assignment':
      return { pathname: '/pairings', params: { focus: entry.target_id } };
    case 'scheduled_session':
      return { pathname: '/schedule', params: { focus: entry.target_id } };
  }
}
