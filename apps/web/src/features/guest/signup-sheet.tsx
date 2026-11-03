import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { ProviderButtons } from '@/features/auth/provider-buttons';
import { AccessRefused, isAccessRefusal } from '@/features/auth/access-refused';
import { SignupForm } from '@/features/auth/signup-form';
import { useAuth } from '@/providers/auth-provider';
import { countEvent, flushEvents } from './guest-api';

/**
 * Phase 63 (P13): signing up without leaving the page. A provider's button (or, with sign-in off,
 * a developer address), then the age question and the terms, then a short splash -- and the person is
 * back on the page they were on, now a member: no Welcome screen. Redirect providers come back here
 * (`returnTo`), and a quest in progress is kept in this tab's storage.
 */
export function SignupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, pendingSignup, signInWithGoogle, status, error, clearError } = useAuth();
  const location = useLocation();
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const [devReady, setDevReady] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);
  const [splash, setSplash] = useState(false);
  const here = location.pathname + location.search;
  const signInOff = config?.auth_enabled === false;
  const atForm = Boolean(pendingSignup) || devReady;

  useEffect(() => {
    if (!splash) return;
    const timer = setTimeout(() => {
      setSplash(false);
      onClose();
    }, 1100);
    return () => clearTimeout(timer);
  }, [splash, onClose]);

  // Signed in by a provider (an existing account): nothing more to ask.
  useEffect(() => {
    if (open && status === 'authenticated' && !splash) onClose();
  }, [open, status, splash, onClose]);

  return (
    <Dialog open={open || splash} onOpenChange={(next) => !next && !splash && onClose()}>
      <DialogContent data-testid="signup-sheet">
        {splash ? (
          <div className="grid justify-items-center gap-3 py-8" data-testid="signup-splash">
            <LogoMark className="size-16 animate-pulse" />
            <p className="font-display text-lg font-semibold">You&apos;re in.</p>
          </div>
        ) : isAccessRefusal(error?.code) ? (
          // Phase 65: a provider sign-in that sign-up access stopped (not on the list, waiting, declined).
          <AccessRefused code={error.code} message={error.message} onBack={clearError} />
        ) : tooYoung ? (
          <DialogHeader>
            <DialogTitle>Ask a parent to add you</DialogTitle>
            <DialogDescription>
              You need to be 13 or older to have an account of your own. A parent can start a space and add you. Nothing
              about you has been kept.
            </DialogDescription>
          </DialogHeader>
        ) : atForm ? (
          <>
            <DialogHeader>
              <DialogTitle>Almost there</DialogTitle>
              <DialogDescription>{pendingSignup?.email ?? devEmail}</DialogDescription>
            </DialogHeader>
            <SignupForm
              devEmail={devReady ? devEmail : null}
              devName={devName || undefined}
              onDone={() => {
                countEvent({ name: 'signup_finished', source: 'sheet' });
                flushEvents();
                setSplash(true);
              }}
              onTooYoung={() => setTooYoung(true)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{config?.signup_open ? 'Sign up free' : 'Sign in'}</DialogTitle>
              <DialogDescription>Keep your scores, unlock every quest and play with your family.</DialogDescription>
            </DialogHeader>
            {signInOff ? (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (devEmail.includes('@')) setDevReady(true);
                }}
                aria-label="Developer sign-up"
              >
                <Input aria-label="Email" placeholder="you@example.com" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} data-testid="signup-dev-email" />
                <Input aria-label="Name" placeholder="Your name" value={devName} onChange={(e) => setDevName(e.target.value)} data-testid="signup-dev-name" />
                <Button type="submit" data-testid="signup-dev-continue">
                  Continue
                </Button>
              </form>
            ) : (
              <div className="grid justify-items-center gap-2">
                {config?.google_client_id && (
                  <GoogleSignInButton clientId={config.google_client_id} onCredential={(credential) => void signInWithGoogle(credential)} />
                )}
                <ProviderButtons providers={config?.providers ?? []} signup={Boolean(config?.signup_open)} returnTo={here} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
