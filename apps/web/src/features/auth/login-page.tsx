import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangleIcon, Loader2Icon, SettingsIcon } from 'lucide-react';
import { AUTH_ERROR_CODES } from '@tmi/shared';

import { LogoFull, LogoMark } from '@/components/brand/logo';
import { DeveloperCredit } from '@/components/layout/developer-credit';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/providers/auth-provider';
import { useBrand, useBrandReady } from '@/providers/brand-provider';
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
  const brand = useBrand();
  const brandReady = useBrandReady();
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
          onDark
          className="pointer-events-none absolute -right-24 -bottom-28 size-[30rem] opacity-[0.14]"
        />
        {/* Soft highlight so the flat gradient has some depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-white/15 blur-3xl"
        />

        {/* The mark with the name beside it, as the wordmark has on narrow
            screens. The name waits for the brand, like the mark does, so the
            demo never shows the institute's for an instant. */}
        <div className="relative flex items-center gap-3">
          <LogoMark onDark className="size-11" />
          {brandReady ? (
            <p className="font-display text-lg leading-tight font-semibold text-white">
              {brand.name}
            </p>
          ) : (
            <span aria-hidden className="block h-4 w-56 rounded bg-white/20" />
          )}
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl leading-tight font-semibold text-white">
            {brand.tagline}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">{brand.blurb}</p>
        </div>

        <div className="relative space-y-1 text-xs text-white/70">
          <p>
            {brand.place ? `${brand.name} · ${brand.place}` : brand.name}
          </p>
          <DeveloperCredit linkClassName="hover:text-white" />
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 lg:pb-20">
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
              Access is granted by an administrator.
              <br />
              Can&apos;t sign in? Ask them to add your Google address.
            </p>
          </div>
        </div>

        {/* The brand panel carries it on wide screens; phones have no panel. */}
        <footer className="text-muted-foreground px-6 pb-6 text-center text-xs lg:hidden">
          <DeveloperCredit />
        </footer>
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
    // no_account already says what to do, so it gets no second line.
    code === AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
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
