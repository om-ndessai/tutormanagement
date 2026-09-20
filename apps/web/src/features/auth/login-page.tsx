import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangleIcon, Loader2Icon, SettingsIcon } from 'lucide-react';
import { AUTH_ERROR_CODES } from '@tmi/shared';

import { LogoFull, LogoMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/providers/auth-provider';
import { GoogleSignInButton } from './google-sign-in-button';

/** Where the router stashes the page the user was trying to reach. */
interface LocationState {
  from?: string;
}

/** A client id that was never filled in. Worth saying so plainly. */
function isPlaceholderClientId(clientId: string | null): boolean {
  return !clientId || clientId.startsWith('REPLACE_WITH');
}

export function LoginPage() {
  const { status, config, error, signInWithGoogle, clearError } = useAuth();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from;

  if (status === 'authenticated') {
    return <Navigate to={from ?? '/profile'} replace />;
  }

  async function handleCredential(credential: string) {
    setSubmitting(true);
    clearError();
    await signInWithGoogle(credential);
    setSubmitting(false);
  }

  const clientId = config?.google_client_id ?? null;
  const needsSetup = status !== 'loading' && isPlaceholderClientId(clientId);

  return (
    <div className="bg-background min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/*
        The brand panel carries the purple so the sign-in side can stay calm.
        Google renders its own button and will not take our colours, so putting
        the brand next to it reads better than trying to fight it.
      */}
      <aside className="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/*
          Watermark keeps the logo's own shading: knocking it out to white
          flattens the Penrose illusion into a plain triangle.
        */}
        <LogoMark
          className="pointer-events-none absolute -right-24 -bottom-28 size-[30rem] opacity-[0.14]"
          aria-hidden
        />
        {/* Soft highlight so the flat gradient has some depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-white/15 blur-3xl"
        />

        <LogoMark className="relative size-11 brightness-0 invert drop-shadow-sm" />

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl leading-tight font-semibold text-white">
            Exploring the fun of Math
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Small classes, advanced-degree instructors, and a curriculum built around problem
            solving — for grades 1 through 12, in person and online.
          </p>
        </div>

        <p className="relative text-xs text-white/70">
          Mathematics Institute of the Triangle · Chapel Hill, North Carolina
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm">
            {/* The wordmark stands in for the brand panel on narrow screens. */}
            <div className="mb-10 flex justify-center lg:hidden">
              <LogoFull className="h-16 w-auto" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">Staff portal</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Sign in with the Google account your administrator added.
              </p>
            </div>

            {error && <SignInError code={error.code} message={error.message} />}

            {status === 'loading' && (
              <p className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </p>
            )}

            {needsSetup && <SetupNotice />}

            {status !== 'loading' && !needsSetup && clientId && (
              <>
                <GoogleSignInButton
                  clientId={clientId}
                  onCredential={handleCredential}
                  disabled={submitting}
                />

                <div className="mt-4 flex min-h-5 justify-center">
                  {submitting && (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2Icon className="size-4 animate-spin" />
                      Signing you in…
                    </p>
                  )}
                </div>
              </>
            )}

            <p className="text-muted-foreground mt-10 border-t pt-6 text-center text-xs leading-relaxed">
              Accounts are created by an administrator.
              <br />
              No portal account yet? Ask them to add your Google address.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Sign-in failures are mostly not the user's fault, and each one has a
 * different next step — so they get their own copy rather than one generic
 * "sign-in failed".
 */
function SignInError({ code, message }: { code: string; message: string }) {
  const guidance =
    code === AUTH_ERROR_CODES.NO_ACCOUNT
      ? 'Accounts are created by an administrator. Ask them to add your Google address to the portal.'
      : code === AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
        ? 'Contact an administrator to have your access restored.'
        : code === AUTH_ERROR_CODES.EMAIL_UNVERIFIED
          ? 'Verify your email address with Google, then try again.'
          : null;

  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 mb-6 rounded-lg border p-3.5"
    >
      <p className="text-destructive flex items-start gap-2 text-sm font-medium">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        {message}
      </p>
      {guidance && <p className="text-muted-foreground mt-2 pl-6 text-xs">{guidance}</p>}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="border-warning/40 bg-warning/10 rounded-lg border p-3.5">
      <p className="flex items-start gap-2 text-sm font-medium">
        <SettingsIcon className="mt-0.5 size-4 shrink-0" />
        Google sign-in is not configured yet
      </p>
      <p className="text-muted-foreground mt-2 pl-6 text-xs leading-relaxed">
        Set <code className="font-mono">GOOGLE_CLIENT_ID</code> in{' '}
        <code className="font-mono">apps/api/wrangler.jsonc</code>. See{' '}
        <code className="font-mono">docs/google-oauth-setup.md</code> for the steps.
      </p>
    </div>
  );
}
