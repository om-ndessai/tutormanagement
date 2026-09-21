import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  LinkIcon,
  MessageSquareIcon,
  UserIcon,
} from 'lucide-react';
import {
  COMMENT_TARGET_TYPES,
  COMMENT_TARGET_LABELS,
  type CommentFeedEntry,
  type CommentTargetType,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentDeleteButton } from './comment-delete-button';
import { useCommentFeed } from './api';

const PAGE_SIZE = 25;
const ANY = 'any';

const TARGET_ICONS: Record<CommentTargetType, typeof UserIcon> = {
  user: UserIcon,
  session: BookOpenIcon,
  assignment: LinkIcon,
  scheduled_session: CalendarDaysIcon,
};

const FILTER_LABELS: Record<CommentTargetType, string> = {
  user: 'People',
  session: 'Sessions',
  assignment: 'Assignments',
  scheduled_session: 'Schedule',
};

/**
 * Where a comment's subject lives in the app.
 *
 * None of these entities has a page of its own -- they are rows in a list --
 * so each link carries the id that the list uses to single it out. A person
 * opens their record; the other three narrow their page to that one row.
 */
export function commentTargetHref(entry: CommentFeedEntry): string {
  switch (entry.target_type) {
    case 'user':
      return `/users?view=${entry.target_id}`;
    case 'session':
      return `/sessions?focus=${entry.target_id}`;
    case 'assignment':
      return `/assignments?focus=${entry.target_id}`;
    case 'scheduled_session':
      return `/schedule?focus=${entry.target_id}`;
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Every comment the viewer may read, in one place.
 *
 * The same visibility rules as each individual thread -- this is a different
 * view of the same remarks, never a wider one -- so what a parent finds here
 * is their own family's, and what an admin finds is the institute's.
 */
export function CommentsPage() {
  const [targetType, setTargetType] = useState<string>(ANY);
  const [page, setPage] = useState(0);

  const params = useMemo(
    () => ({
      target_type: targetType === ANY ? undefined : (targetType as CommentTargetType),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [targetType, page],
  );

  const { data, isPending } = useCommentFeed(params);
  const entries = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Comments"
        description="Everything that has been said about the people and lessons you work with, newest first."
      />

      {/* Stacked rather than shrunk on a phone: a row of fixed-width controls
          pushes the whole page wider than the screen. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5 sm:flex-none">
          <Label htmlFor="about" className="text-muted-foreground text-xs">
            About
          </Label>
          <Select
            value={targetType}
            onValueChange={(value) => {
              setTargetType(value);
              setPage(0);
            }}
          >
            <SelectTrigger id="about" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Everything</SelectItem>
              {COMMENT_TARGET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {FILTER_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {targetType !== ANY && (
          <Button
            variant="ghost"
            onClick={() => {
              setTargetType(ANY);
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          {isPending ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <MessageSquareIcon className="size-5" />
              {targetType === ANY
                ? 'Nothing has been commented on yet.'
                : `No comments on ${COMMENT_TARGET_LABELS[targetType as CommentTargetType]}s yet.`}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {entries.map((entry) => (
                <FeedRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {total === 0
            ? 'No comments'
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeedRow({ entry }: { entry: CommentFeedEntry }) {
  const Icon = TARGET_ICONS[entry.target_type];

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="text-muted-foreground bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {/* Both ends of a comment lead somewhere: who said it, and what
              about. Reading the feed is otherwise a dead end. */}
          <Link
            to={`/users?view=${entry.author_user_id}`}
            className="hover:text-primary font-medium transition-colors"
          >
            {entry.author_name}
          </Link>
          <span className="text-muted-foreground"> on </span>
          <Link
            to={commentTargetHref(entry)}
            className="hover:text-primary underline-offset-4 transition-colors hover:underline"
          >
            {entry.target_label}
          </Link>
        </p>
        <p className="text-muted-foreground text-xs">{formatWhen(entry.created_at)}</p>
        <p className="mt-1.5 text-sm whitespace-pre-wrap">{entry.body}</p>
      </div>

      <CommentDeleteButton
        comment={entry}
        target={{ target_type: entry.target_type, target_id: entry.target_id }}
      />
    </li>
  );
}
