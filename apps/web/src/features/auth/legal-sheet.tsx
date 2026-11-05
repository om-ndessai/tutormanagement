import { useState } from 'react';
import { toast } from 'sonner';
import { PRIVACY_VERSION, TERMS_VERSION, type ApiOk } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

/**
 * Phase 72 (owner, 2026-11-04; UI audit JF12): someone a space added never saw the terms or the privacy notice, which
 * a person who signs up accepts on the way in. At their first sign-in they read and accept both, once; until then the
 * portal waits behind this sheet. Sign out is the other way out.
 */
export function LegalSheet() {
  const { refreshSession, signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);

  async function accept() {
    setSending(true);
    try {
      await apiClient.post<ApiOk<{ accepted: true }>>('/auth/legal', { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
      await refreshSession();
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save that. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent data-testid="legal-sheet" showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Before you start</DialogTitle>
          <DialogDescription>
            You were added by a space, so you have not seen how the platform works yet. Read the terms and the privacy
            notice; you accept them once.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1 text-sm">
          <li>
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              Terms of use
            </a>
          </li>
          <li>
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              Privacy notice
            </a>
          </li>
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            data-testid="legal-agree"
          />
          I have read and accept the terms of use and the privacy notice.
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button disabled={!agreed || sending} onClick={() => void accept()} data-testid="legal-accept">
            Accept and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
