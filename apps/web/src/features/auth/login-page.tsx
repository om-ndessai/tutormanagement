import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangleIcon, Loader2Icon, SettingsIcon } from 'lucide-react';
import { AUTH_ERROR_CODES } from '@tmi/shared';

import { LogoFull } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="bg-background flex min-h-dvh flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-24">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoFull className="h-20 w-auto" />
            <p className="text-muted-foreground font-display mt-4 text-sm">
              Exploring the fun of Math
            </p>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center gap-6 py-2">
              <div className="text-center">
                <h1 className="text-lg font-semibold">Staff portal</h1>
                <p className="text-muted-foreground mt-1 text-sm">
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
                <GoogleSignInButton
                  clientId={clientId}
                  onCredential={handleCredential}
                  disabled={submitting}
                />
              )}

              {submitting && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin" />
                  Signing you in…
                </p>
              )}
            </CardContent>
          </Card>

          <p className="text-muted-foreground mt-6 text-center text-xs">
            Mathematics Institute of the Triangle
          </p>
        </div>
      </div>
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
      className="border-destructive/40 bg-destructive/5 w-full rounded-md border p-3"
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
    <div className="border-warning/40 bg-warning/10 w-full rounded-md border p-3">
      <p className="flex items-start gap-2 text-sm font-medium">
        <SettingsIcon className="mt-0.5 size-4 shrink-0" />
        Google sign-in is not configured yet
      </p>
      <p className="text-muted-foreground mt-2 pl-6 text-xs">
        Set <code className="font-mono">GOOGLE_CLIENT_ID</code> in{' '}
        <code className="font-mono">apps/api/wrangler.jsonc</code>. See{' '}
        <code className="font-mono">docs/google-oauth-setup.md</code> for the steps.
      </p>
    </div>
  );
}
