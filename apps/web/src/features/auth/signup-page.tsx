import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { LogoMark } from '@/components/brand/logo';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { SignupForm } from './signup-form';

/**
 * Phase 52: a newcomer a provider vouched for says their birth month and year (only the band is kept,
 * never the date; under 13, nothing at all) and accepts the terms. With sign-in off (local, the demo),
 * `?dev_email=` stands in for Google. Phase 63: the same form also opens as a sheet over a guest's page.
 */
export function SignupPage() {
  const { pendingSignup, config, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const devEmail = config?.auth_enabled === false ? params.get('dev_email') : null;
  const devName = params.get('dev_name') ?? undefined;
  const [tooYoung, setTooYoung] = useState(false);

  if (status === 'loading') return null;
  if (!pendingSignup && !devEmail) return <Navigate to="/login" replace />;

  const who = pendingSignup ?? { name: devName ?? devEmail ?? '', email: devEmail ?? '' };

  if (tooYoung) return <TooYoung />;

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-10" data-testid="signup">
      <Card className="w-full max-w-md py-0">
        <CardContent className="grid gap-5 p-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9" />
            <div>
              <h1 className="text-lg font-semibold">Welcome, {who.name.split(' ')[0]}</h1>
              <p className="text-muted-foreground text-xs">{who.email}</p>
            </div>
          </div>
          <SignupForm
            devEmail={devEmail}
            devName={devName}
            onDone={() => navigate('/', { replace: true })}
            onTooYoung={() => setTooYoung(true)}
          />
        </CardContent>
      </Card>
    </main>
  );
}

/** Under 13: nothing kept, and a parent's way in. */
export function TooYoung() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4" data-testid="signup-too-young">
      <Card className="max-w-md py-0">
        <CardContent className="grid gap-3 p-6">
          <h1 className="text-lg font-semibold">Ask a parent to add you</h1>
          <p className="text-muted-foreground text-sm">
            You need to be 13 or older to have an account of your own. A parent can make a space and add you to it.
            Nothing about you has been kept.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
