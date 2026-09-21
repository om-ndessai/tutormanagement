import { useState } from 'react';
import { Loader2Icon, MessageSquareIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  MAX_COMMENT_LENGTH,
  commentAudienceHint,
  type Comment,
  type CommentTarget,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { useAddComment, useComments } from './api';
import { CommentDeleteButton } from './comment-delete-button';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The reverse-chronological view of everything said about one thing, with the
 * box to add to it.
 *
 * Newest first, and the composer above the list, because a thread here is a
 * short record of what happened rather than a conversation to read in order.
 */
export function CommentThread({ target }: { target: CommentTarget }) {
  const { data, isPending } = useComments(target);
  const comments = data?.data.comments ?? [];

  return (
    <div className="space-y-4">
      <Composer target={target} targetName={data?.data.target_name ?? null} />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nothing has been noted here yet.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} target={target} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ target, targetName }: { target: CommentTarget; targetName: string | null }) {
  const [body, setBody] = useState('');
  const add = useAddComment();
  const trimmed = body.trim();

  async function submit() {
    if (!trimmed) return;

    try {
      await add.mutateAsync({ ...target, body: trimmed });
      setBody('');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not post that comment.',
      );
    }
  }

  return (
    <div className="grid gap-2">
      <textarea
        aria-label="Write a comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_COMMENT_LENGTH}
        rows={3}
        placeholder="Add a note for the people this concerns…"
        className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Said plainly, because a comment about somebody is not a private
            note and writing one without knowing who reads it is how people
            say things they would not say to the reader's face. */}
        <p className="text-muted-foreground text-xs">
          {commentAudienceHint(target.target_type, targetName)} Comments cannot be edited.
        </p>
        <Button size="sm" onClick={submit} disabled={!trimmed || add.isPending}>
          {add.isPending ? <Loader2Icon className="animate-spin" /> : <MessageSquareIcon />}
          Post
        </Button>
      </div>
    </div>
  );
}

function CommentRow({ comment, target }: { comment: Comment; target: CommentTarget }) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{comment.author_name}</span>
            <span className="text-muted-foreground text-xs">
              {' '}
              · {formatWhen(comment.created_at)}
            </span>
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
        </div>

        <CommentDeleteButton comment={comment} target={target} />
      </div>
    </li>
  );
}
