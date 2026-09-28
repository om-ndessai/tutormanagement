import { useState } from 'react';
import { CheckIcon, Loader2Icon, MessageSquareIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAddComment } from '@/features/comments/api';
import { useUserDetail } from '@/features/users/api';
import { UserDetailView } from '@/features/users/user-detail-view';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useConfirmDetails } from './api';

const TEXTAREA =
  'border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';

/**
 * The last step for everyone but an admin (Phase 26): the record the office
 * keeps on them, to confirm. Only an admin may edit a record, so "something
 * needs changing" sends the office a note -- a comment on their own record,
 * which the office, they and their parents read -- rather than a form.
 */
export function ConfirmDetails({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const detail = useUserDetail(user?.id ?? null);
  const confirm = useConfirmDetails();
  const addComment = useAddComment();

  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleConfirm() {
    try {
      await confirm.mutateAsync();
      toast.success('Thanks — your details are confirmed.');
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not confirm your details.');
    }
  }

  async function handleSend() {
    setError(null);
    try {
      await addComment.mutateAsync({ target_type: 'user', target_id: user!.id, body: note.trim() });
      toast.success('Sent to the office — they will update your details.');
      onDone();
    } catch (caught) {
      if (caught instanceof ApiRequestError) setError(caught.fieldErrors.body ?? caught.message);
      else setError('Could not send the note.');
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        This is how the office has you on file. Only the office can change it — if something is
        wrong, tell them here.
      </p>

      <div className="max-h-[45dvh] overflow-y-auto rounded-lg border p-4">
        {detail.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            Loading your record…
          </p>
        ) : detail.data ? (
          <UserDetailView user={detail.data.data} compact />
        ) : (
          <p className="text-destructive text-sm">Could not load your record.</p>
        )}
      </div>

      {correcting ? (
        <div className="grid gap-2">
          <Label htmlFor="onboarding-correction">What needs changing?</Label>
          <textarea
            id="onboarding-correction"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="For example: my phone number is now (919) 555-0100."
            aria-invalid={Boolean(error)}
            className={TEXTAREA}
          />
          <p className="text-muted-foreground text-xs">
            Goes to the office as a note on your record. Your parents can read it too, if you have
            them on file. Never send a Social Security number here.
          </p>
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSend} disabled={!note.trim() || addComment.isPending}>
              {addComment.isPending && <Loader2Icon className="animate-spin" />}
              Send to the office
            </Button>
            <Button variant="ghost" onClick={() => setCorrecting(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfirm} disabled={confirm.isPending}>
            {confirm.isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Yes, that’s all right
          </Button>
          <Button variant="outline" onClick={() => setCorrecting(true)}>
            <MessageSquareIcon />
            Something needs changing
          </Button>
        </div>
      )}
    </div>
  );
}
