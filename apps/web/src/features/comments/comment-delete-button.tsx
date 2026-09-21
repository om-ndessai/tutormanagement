import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { Comment, CommentTarget } from '@tmi/shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-client';
import { useDeleteComment } from './api';

/**
 * Withdrawing a comment, wherever it is being read.
 *
 * Renders nothing unless the API said this viewer may do it -- which is the
 * author and nobody else, not even an admin. The decision is never taken here.
 */
export function CommentDeleteButton({
  comment,
  target,
}: {
  comment: Comment;
  target: CommentTarget;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteComment();

  if (!comment.can_delete) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete this comment"
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon />
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops being visible to everybody it was shared with. Comments cannot be edited,
              so this cannot be undone by rewriting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync({ id: comment.id, target });
                  toast.success('Comment deleted.');
                } catch (error) {
                  toast.error(
                    error instanceof ApiRequestError
                      ? error.message
                      : 'Could not delete that comment.',
                  );
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
