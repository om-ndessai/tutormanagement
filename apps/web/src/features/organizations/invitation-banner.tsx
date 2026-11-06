import { useState } from 'react';
import { toast } from 'sonner';
import { MailIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { useAnswerInvitation } from './api';

/** "Not now" hides the banner for this tab only (Phase 60, S6). */
const DISMISSED_KEY = 'aimtrue.invitations-not-now';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Phase 60 (S6): someone inside a space who has been invited to another sees it across the top
 * of the portal -- "<space> invited you", Accept (which enters it) and Not now. The invitation
 * comes from their own session; nothing else is read.
 */
export function InvitationBanner() {
  const { invitations, chooseOrganization } = useAuth();
  const answer = useAnswerInvitation();
  const [dismissed, setDismissed] = useState(readDismissed);

  const invite = invitations[0];
  if (!invite || dismissed) return null;
  const more = invitations.length - 1;

  function notNow() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: hidden until the page reloads.
    }
    setDismissed(true);
  }

  async function accept() {
    if (!invite) return;
    try {
      await answer.mutateAsync({ slug: invite.slug, accept: true });
      toast.success(`You have joined ${invite.name}.`);
      chooseOrganization(invite.slug);
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  return (
    <div
      role="region"
      aria-label="Invitation"
      // Phase 78 (JF28): two lines on a phone -- who invited them where, whole, then the answers.
      className="bg-primary/10 border-primary/20 flex flex-col gap-2 border-b px-4 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:px-8"
      data-testid="invitation-banner"
    >
      <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
        <MailIcon className="text-primary mt-0.5 size-4 shrink-0 sm:mt-0" />
        <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <span className="font-medium">
            {invite.invited_by_first_name ? `${invite.invited_by_first_name} invited you to ${invite.name}` : `You are invited to ${invite.name}`}
          </span>
          {more > 0 && (
            <a href="/spaces" className="text-muted-foreground ml-2 underline-offset-2 hover:underline">
              and {more} more
            </a>
          )}
        </p>
      </div>
      <div className="flex gap-2 pl-7 sm:pl-0">
        <Button size="sm" disabled={answer.isPending} onClick={() => void accept()} data-testid="invitation-banner-accept">
          Accept
        </Button>
        <Button size="sm" variant="ghost" onClick={notNow} data-testid="invitation-banner-not-now">
          Not now
        </Button>
      </div>
    </div>
  );
}
