import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Phase 52: a newcomer Google vouched for says their birth month and year (only the band is kept,
 * never the date; under 13, nothing at all) and accepts the terms. Then the Welcome page.
 * With sign-in off (local, the demo), `?dev_email=` stands in for Google.
 */
export function SignupPage() {
  const { pendingSignup, completeSignup, config, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const devEmail = config?.auth_enabled === false ? params.get('dev_email') : null;
  const devName = params.get('dev_name') ?? undefined;
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);

  if (status === 'loading') return null;
  if (!pendingSignup && !devEmail) return <Navigate to="/login" replace />;

  const who = pendingSignup ?? { name: devName ?? devEmail ?? '', email: devEmail ?? '' };
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - i));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await completeSignup({
        birth_year: Number(year),
        birth_month: Number(month),
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        ...(devEmail ? { dev_email: devEmail, ...(devName ? { dev_name: devName } : {}) } : {}),
      });
      navigate('/', { replace: true });
    } catch (caught) {
      setProblem(
        caught instanceof ApiRequestError
          ? { code: caught.code, message: caught.message }
          : { code: 'internal_error', message: 'Could not sign you up. Please try again.' },
      );
    } finally {
      setBusy(false);
    }
  }

  if (problem?.code === 'too_young') {
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
          <form className="grid gap-4" onSubmit={submit} aria-label="About you">
            <div className="grid gap-1.5">
              <Label>When were you born?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger aria-label="Birth month" data-testid="signup-month">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger aria-label="Birth year" data-testid="signup-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground text-xs">Only whether you are over 18 is kept, never the date.</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                data-testid="signup-accept"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="underline">
                  Terms
                </Link>{' '}
                and the{' '}
                <Link to="/privacy" target="_blank" className="underline">
                  Privacy notice
                </Link>
                .
              </span>
            </label>
            {problem && <p className="text-destructive text-sm">{problem.message}</p>}
            <Button type="submit" disabled={!year || !month || !accepted || busy} data-testid="signup-submit">
              {busy && <Loader2Icon className="animate-spin" />}
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
