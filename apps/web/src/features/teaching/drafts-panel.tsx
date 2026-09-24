import { useState } from 'react';
import { FileEditIcon, Loader2Icon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { SESSION_MODE_LABELS, formatClockTime, type SessionDraft } from '@tmi/shared';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { useDiscardDraft, useMyDrafts, usePostDraft } from './api';

/**
 * Write-ups the viewer has saved but not posted.
 *
 * Above the session list rather than mixed into it, because a draft is not a
 * lesson on the record: it is billed for nothing, counted nowhere, and read by
 * nobody else. Mixing them would put a row in the log that none of the log's
 * totals agree with.
 */
export function DraftsPanel({ onEdit }: { onEdit: (draft: SessionDraft) => void }) {
  const { data } = useMyDrafts();
  const drafts = data?.data ?? [];

  const post = usePostDraft();
  const discard = useDiscardDraft();
  const [discarding, setDiscarding] = useState<SessionDraft | null>(null);

  if (drafts.length === 0) return null;

  async function publish(draft: SessionDraft) {
    try {
      await post.mutateAsync(draft.id);
      toast.success(`Session with ${draft.student_name} recorded.`);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not post that draft.',
      );
    }
  }

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="px-4 py-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Your drafts
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                {drafts.length === 1 ? 'Only you can see it' : 'Only you can see these'}
              </span>
            </h2>
          </div>

          <ul className="divide-border divide-y">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {draft.student_name}
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Draft
                    </Badge>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {draft.occurred_on} · {formatClockTime(draft.started_at)}–
                    {formatClockTime(draft.ended_at)} · {SESSION_MODE_LABELS[draft.mode]}
                    {draft.notes || draft.write_up ? '' : ' · no notes yet'}
                  </span>
                </span>

                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(draft)}>
                    <FileEditIcon />
                    Edit
                  </Button>
                  <Button size="sm" disabled={post.isPending} onClick={() => publish(draft)}>
                    {post.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                    Post
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Discard the draft with ${draft.student_name}`}
                    onClick={() => setDiscarding(draft)}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={discarding !== null} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The write-up for {discarding?.student_name} on {discarding?.occurred_on} is deleted.
              Nothing was billed or recorded, so nothing else changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={discard.isPending}
              onClick={async () => {
                if (!discarding) return;
                try {
                  await discard.mutateAsync(discarding.id);
                  toast.success('Draft discarded.');
                } catch (error) {
                  toast.error(
                    error instanceof ApiRequestError
                      ? error.message
                      : 'Could not discard that draft.',
                  );
                }
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
