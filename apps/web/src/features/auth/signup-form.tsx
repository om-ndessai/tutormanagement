import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Phase 52's age question and the terms, as one form: the sign-up page's, and (Phase 63, P13) the
 * sign-up sheet's over the page a guest is on. Under 13 is refused and nothing is stored.
 */
export function SignupForm({
  devEmail,
  devName,
  onDone,
  onTooYoung,
}: {
  devEmail?: string | null;
  devName?: string;
  onDone: () => void;
  onTooYoung: () => void;
}) {
  const { completeSignup } = useAuth();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
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
      onDone();
    } catch (caught) {
      const next =
        caught instanceof ApiRequestError
          ? { code: caught.code, message: caught.message }
          : { code: 'internal_error', message: 'Could not sign you up. Please try again.' };
      if (next.code === 'too_young') onTooYoung();
      else setProblem(next);
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
