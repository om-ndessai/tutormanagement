import { useState } from 'react';
import { MessageSquareIcon } from 'lucide-react';
import type { CommentTarget } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCommentCounts } from './api';
import { CommentThread } from './comment-thread';

/**
 * The way into a thread from a row in a list.
 *
 * A dialog rather than an inline expansion because these rows are dense and
 * ship two layouts -- cards on a phone, a table above it -- and one dialog
 * serves both without either growing a second copy of the thread.
 *
 * The count comes from one query for the whole page, so a list of forty
 * sessions still asks the server once.
 */
export function CommentsButton({
  target,
  title,
  description,
}: {
  target: CommentTarget;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useCommentCounts(target.target_type);
  const count = data?.data[target.target_id] ?? 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={count > 0 ? `Comments (${count}) on ${title}` : `Comment on ${title}`}
        onClick={() => setOpen(true)}
        className="relative"
      >
        <MessageSquareIcon />
        {count > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Comments on {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {/* Mounted only while open, so a page of rows fetches one thread at
              a time rather than all of them. */}
          {open && <CommentThread target={target} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
