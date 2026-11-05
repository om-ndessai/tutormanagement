import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { SIGNUP_ACCESS_NOTES, type AccessErrorCode } from '@tmi/shared';

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
import { guestMemory } from './guest-store';

/** "Sign up free" for the calls to action; "Sign in" for the header's Sign in (UI audit JF11). */
export type SignupSheetMode = 'signup' | 'signin';

/**
 * Phase 63 (P13): signing up without leaving the page. A provider's button (or, with sign-in off,
 * a developer address), then the age question and the terms, then a short splash -- and the person is
 * back on the page they were on, now a member: no Welcome screen. Redirect providers come back here
 * (`returnTo`), and a quest in progress is kept in this tab's storage.
 *
 * Opened from "Sign in" it says so ("Welcome back") with the same buttons: a returning member is never told
 * to sign up (UI audit JF11). A refusal is one screen with one heading and a next step: Keep playing.
 */
export function SignupSheet({
  open,
  onClose,
  mode = 'signup',
}: {
  open: boolean;
  onClose: () => void;
  mode?: SignupSheetMode;
}) {
  const { config, pendingSignup, cancelSignup, signInWithGoogle, status, error, clearError } = useAuth();
  const location = useLocation();
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const [devReady, setDevReady] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);
  // A refusal of the About-you step, kept here: the half-finished sign-up is dropped as it is shown.
  const [refused, setRefused] = useState<{ code: AccessErrorCode; message: string; email: string | null } | null>(null);
  const [splash, setSplash] = useState(false);
  const [view, setView] = useState<SignupSheetMode>(mode);
  const here = location.pathname + location.search;
  const signInOff = config?.auth_enabled === false;
  const atForm = Boolean(pendingSignup) || devReady;
  const formEmail = pendingSignup?.email ?? (devReady ? devEmail : '');
  // An account refused as under 13 on this device is not asked its age again (owner, 2026-11-04).
  const knownYoung = atForm && guestMemory.refusedYoung(formEmail);

  // Each opening starts in the mode it was opened with.
  useEffect(() => {
    if (open) setView(mode);
  }, [open, mode]);

  // A refusal is said once and left behind: closing the sheet drops the sign-up and the provider's refusal,
  // so the guest page never reopens it by itself (UI audit J05 step 11, J02, J13).
  function close() {
    if (isAccessRefusal(error?.code)) clearError();
    if (knownYoung) cancelSignup();
    if (tooYoung || refused || knownYoung) {
      setTooYoung(false);
      setRefused(null);
      setDevReady(false);
    }
    onClose();
  }

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

  const signupOffered = config?.signup_open === true;
  const signingIn = view === 'signin' || !signupOffered;

  return (
    <Dialog open={open || splash} onOpenChange={(next) => !next && !splash && close()}>
      <DialogContent data-testid="signup-sheet">
        {splash ? (
          <div className="grid justify-items-center gap-3 py-8" data-testid="signup-splash">
            <LogoMark className="size-16 animate-pulse" />
            <p className="font-display text-lg font-semibold">You&apos;re in.</p>
          </div>
        ) : isAccessRefusal(error?.code) ? (
          // Phase 65: a provider sign-in that sign-up access stopped (not on the list, waiting, declined).
          <AccessRefused
            code={error.code}
            message={error.message}
            email={error.details?.email?.[0] ?? null}
            onKeepPlaying={close}
            onUseAnother={clearError}
          />
        ) : refused ? (
          // Phase 65: the About-you step refused (waiting for approval, declined, not on the list).
          <AccessRefused
            code={refused.code}
            message={refused.message}
            email={refused.email}
            onKeepPlaying={close}
            onUseAnother={() => {
              setRefused(null);
              setDevReady(false);
            }}
          />
        ) : tooYoung || knownYoung ? (
          <div className="grid gap-4" data-testid="signup-too-young">
            <DialogHeader>
              <DialogTitle>Ask a grown-up to add you</DialogTitle>
              <DialogDescription>
                You need to be 13 or older for an account of your own. You can keep playing without one, and a grown-up
                can sign up and add you to their space. Nothing about you was stored on our side.
              </DialogDescription>
            </DialogHeader>
            <Button className="justify-self-start" onClick={close} data-testid="signup-too-young-keep-playing">
              Keep playing
            </Button>
          </div>
        ) : atForm ? (
          <>
            <DialogHeader>
              <DialogTitle>Almost there</DialogTitle>
              <DialogDescription>{formEmail}</DialogDescription>
            </DialogHeader>
            <SignupForm
              devEmail={devReady ? devEmail : null}
              devName={devName || undefined}
              onDone={() => {
                countEvent({ name: 'signup_finished', source: 'sheet' });
                flushEvents();
                setSplash(true);
              }}
              onTooYoung={() => {
                guestMemory.rememberYoung(formEmail);
                setTooYoung(true);
                cancelSignup();
              }}
              onRefused={(refusal) => {
                setRefused({ ...refusal, email: formEmail || null });
                cancelSignup();
              }}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{signingIn ? 'Sign in' : 'Sign up free'}</DialogTitle>
              <DialogDescription>
                {signingIn
                  ? 'Welcome back. Use the account you signed up with.'
                  : 'Keep your scores, unlock every quest and play with your family.'}
              </DialogDescription>
            </DialogHeader>
            {!signingIn && config?.signup_access && SIGNUP_ACCESS_NOTES[config.signup_access] && (
              // Said before the provider's button, not after the whole form (UI audit JF2, JF8; J02 step 9, J13).
              <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm" data-testid="signup-access-note">
                {SIGNUP_ACCESS_NOTES[config.signup_access]}
              </p>
            )}
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
            {signingIn && signupOffered && (
              <p className="text-muted-foreground text-center text-sm">
                New here?{' '}
                <button
                  type="button"
                  className="text-primary font-medium underline underline-offset-4"
                  onClick={() => setView('signup')}
                  data-testid="signup-sheet-to-signup"
                >
                  Sign up free
                </button>
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
