import { useState } from 'react';
import { guestLevelWords, type QuestionBankLevelId } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/providers/auth-provider';
import { countEvent } from './guest-api';

/** "1,200+" -- a level's member count, rounded down, never more than is true. */
export function roundedCount(n: number): string | null {
  if (n < 20) return null;
  const step = n >= 1000 ? 100 : n >= 100 ? 50 : 10;
  return `${(Math.floor(n / step) * step).toLocaleString()}+`;
}

/** What a free account adds, the level's own line first (P12). */
export function benefitsFor(levelId: QuestionBankLevelId | undefined, memberCounts: Record<string, number>): string[] {
  const count = levelId ? roundedCount(memberCounts[levelId] ?? 0) : null;
  return [
    count && levelId ? `${count} more ${guestLevelWords(levelId)} questions, never repeated` : 'Many more questions, never repeated',
    'Every quest unlocked: longer, timed, and family games',
    'Family games: one tap, no codes',
    'Your scores saved',
  ];
}

/**
 * Phase 63 (P12): the sign-up offer -- after an answer (the clock paused), on a locked tile, when the
 * free questions run out, and on the results. "Keep playing" is as visible as "Sign up"; "Ask a grown-up"
 * is the door for a child, and collects nothing.
 */
export function NudgeSheet({
  open,
  headline,
  description,
  benefits,
  onSignUp,
  onClose,
  closeLabel = 'Keep playing',
  shareLink,
}: {
  open: boolean;
  headline: string;
  description?: string;
  benefits: string[];
  onSignUp: () => void;
  onClose: () => void;
  closeLabel?: string;
  /** What "Ask a grown-up" shares: a link back to this quest. */
  shareLink: string;
}) {
  const { config } = useAuth();
  const signupOpen = config?.signup_open === true;
  const [askAdult, setAskAdult] = useState(false);

  async function ask() {
    countEvent({ name: 'ask_grown_up' });
    const text = 'I have been playing math quests on Aimtrue. Can you set me up with an account?';
    try {
      if (navigator.share) await navigator.share({ title: 'Aimtrue', text, url: shareLink });
      else {
        await navigator.clipboard.writeText(`${text} ${shareLink}`);
        setAskAdult(true);
      }
    } catch {
      // Dismissed.
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="guest-nudge">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{description ?? (signupOpen ? 'With a free account:' : 'With an account:')}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1.5 text-sm">
          {benefits.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="text-primary">✓</span>
              {line}
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="secondary" size="lg" className="border-foreground/15 border" onClick={onClose} data-testid="guest-nudge-close">
            {closeLabel}
          </Button>
          <Button size="lg" onClick={onSignUp} data-testid="guest-nudge-signup">
            {signupOpen ? 'Sign up free' : 'Sign in'}
          </Button>
        </DialogFooter>
        <button type="button" className="text-muted-foreground text-xs underline" onClick={() => void ask()} data-testid="guest-ask-adult">
          {askAdult ? 'Copied: send it to a grown-up' : 'Under 13? Ask a grown-up'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
