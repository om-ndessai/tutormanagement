import { useState } from 'react';
import { toast } from 'sonner';
import {
  ACCESS_MODES,
  ACCESS_MODE_DESCRIPTIONS,
  ACCESS_MODE_LABELS,
  accessListEntrySchema,
  formatInstant,
  type AccessAccount,
  type AccessMode,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { browserTimeZone, cn } from '@/lib/utils';
import { useAccessConsole, useAddAccessEntry, useDecideAccess, useRemoveAccessEntry, useSaveAccessMode } from './api';
import { ApproveSheet } from './approve-sheet';

/** "Nov 4, 2026": the day, through the shared formatter (Phase 78), on the console's own clock. */
const when = (iso: string | null) => (iso ? formatInstant(iso, browserTimeZone(), { time: false, year: 'always' }) : '');
const failed = (caught: unknown, fallback: string) => toast.error(caught instanceof ApiRequestError ? caught.message : fallback);

/**
 * Phase 65 (docs/access-approval-plan.md): who may sign up -- Open, Pre-approved (the platform's list)
 * or Post-approved (each sign-up waits for a platform admin). Only people who sign up themselves are
 * gated; people a space adds or invites get in through that space.
 */
export function AccessSection() {
  const access = useAccessConsole();
  const saveMode = useSaveAccessMode();
  const data = access.data?.data;
  if (access.isPending) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (access.isError || !data) return <p className="text-destructive text-sm">Sign-up access could not be loaded.</p>;
  const mode = data.settings.mode;

  async function choose(next: AccessMode) {
    if (next === mode) return;
    try {
      await saveMode.mutateAsync({ mode: next });
      toast.success(`Sign-up access: ${ACCESS_MODE_LABELS[next]}.`);
    } catch (caught) {
      failed(caught, 'Sign-up access could not be saved.');
    }
  }

  return (
    <Card id="sign-up-access" className="scroll-mt-4 py-0" data-testid="access-section">
      <CardContent className="grid gap-4 p-4 text-sm">
        <div className="grid gap-1">
          <h3 className="flex items-center gap-2 font-medium">
            Sign-up access
            {data.waiting.length > 0 && (
              <Badge data-testid="access-waiting-count">{data.waiting.length} waiting</Badge>
            )}
          </h3>
          <p className="text-muted-foreground text-xs">
            Who may sign up on this platform. People a space adds or invites are not affected.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Sign-up access">
          {ACCESS_MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === mode}
              disabled={saveMode.isPending}
              onClick={() => void choose(option)}
              data-testid={`access-mode-${option}`}
              className={cn(
                'grid gap-0.5 rounded-lg border p-3 text-left transition-colors',
                option === mode ? 'border-primary bg-primary/10 ring-primary ring-1' : 'hover:bg-muted',
              )}
            >
              <span className="font-semibold">{ACCESS_MODE_LABELS[option]}</span>
              <span className="text-muted-foreground text-xs">{ACCESS_MODE_DESCRIPTIONS[option]}</span>
            </button>
          ))}
        </div>

        {(mode === 'postapproved' || data.waiting.length > 0) && <Waiting accounts={data.waiting} />}
        {mode === 'preapproved' && <AccessList entries={data.list} />}
        {data.decided.length > 0 && <Decided accounts={data.decided} />}
        {mode !== 'preapproved' && data.list.length > 0 && (
          <details>
            <summary className="text-muted-foreground cursor-pointer text-xs">
              The Pre-approved list ({data.list.length}), used only while Pre-approved is chosen
            </summary>
            <div className="pt-2">
              <AccessList entries={data.list} />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The top of Settings: the mode and the people waiting, with Review jumping down to Sign-up access,
 * which sits in Guest play below the long list of tiles.
 */
export function AccessJump() {
  const data = useAccessConsole().data?.data;
  if (!data) return null;
  const waiting = data.waiting.length;
  return (
    <Card className="py-0" data-testid="access-jump">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">Sign-up access: {ACCESS_MODE_LABELS[data.settings.mode]}</span>
          <span className="text-muted-foreground text-xs" data-testid="access-jump-waiting">
            {waiting > 0 ? `${waiting} waiting for approval` : 'Nobody waiting'}
          </span>
        </span>
        <Button
          size="sm"
          variant={waiting > 0 ? 'default' : 'outline'}
          onClick={() => document.getElementById('sign-up-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          data-testid="access-jump-review"
        >
          Review
        </Button>
      </CardContent>
    </Card>
  );
}

/** Where an approval placed someone (Phase 80, A11): joined at once, or asked to join for them. */
const placedWords = (placed: NonNullable<AccessAccount['placed_in']>) =>
  placed.how === 'joined' ? `Joined ${placed.name}` : `Asked to join ${placed.name}`;

function Waiting({ accounts }: { accounts: AccessAccount[] }) {
  const decide = useDecideAccess();
  // Phase 80 (A11): Approve asks where to place them first; Decline is at once, as before.
  const [approving, setApproving] = useState<AccessAccount | null>(null);
  async function decline(account: AccessAccount) {
    try {
      await decide.mutateAsync({ userId: account.user_id, access: 'declined' });
      toast.success(`${account.full_name} declined.`);
    } catch (caught) {
      failed(caught, 'That could not be saved.');
    }
  }
  return (
    <section className="grid gap-2" aria-label="Waiting for approval">
      <h4 className="text-[13px] font-semibold">Waiting for approval ({accounts.length})</h4>
      {accounts.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nobody is waiting.</p>
      ) : (
        <ul className="grid gap-2">
          {accounts.map((account) => (
            <li
              key={account.user_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
              data-testid={`access-waiting-${account.user_id}`}
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{account.full_name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {account.email} · {account.age_band === 'adult' ? 'Adult' : 'Age 13-17'}
                  {account.providers.length > 0 && ` · ${account.providers.join(', ')}`} · signed up {when(account.signed_up_at)}
                </span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" disabled={decide.isPending} onClick={() => setApproving(account)} data-testid={`access-approve-${account.user_id}`}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => void decline(account)} data-testid={`access-decline-${account.user_id}`}>
                  Decline
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {approving && <ApproveSheet account={approving} onClose={() => setApproving(null)} />}
    </section>
  );
}

function Decided({ accounts }: { accounts: AccessAccount[] }) {
  const decide = useDecideAccess();
  // A declined or revoked account is approved through the same sheet as a waiting one (Phase 80, A15).
  const [approving, setApproving] = useState<AccessAccount | null>(null);
  async function revoke(account: AccessAccount) {
    try {
      await decide.mutateAsync({ userId: account.user_id, access: 'declined' });
      toast.success(`${account.full_name}'s access revoked.`);
    } catch (caught) {
      failed(caught, 'That could not be saved.');
    }
  }
  return (
    <details className="grid gap-2">
      <summary className="cursor-pointer text-[13px] font-semibold">Recently decided ({accounts.length})</summary>
      <ul className="grid gap-1 pt-2">
        {accounts.map((account) => (
          <li key={account.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid={`access-decided-${account.user_id}`}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{account.full_name}</span>{' '}
              <span className="text-muted-foreground">
                {account.email} · {account.access === 'approved' ? 'Approved' : 'Declined'}
                {account.decided_by_name && ` by ${account.decided_by_name}`} {when(account.decided_at)}
                {account.access === 'approved' && account.placed_in && (
                  <>
                    {' · '}
                    <span data-testid={`access-placed-${account.user_id}`}>{placedWords(account.placed_in)}</span>
                  </>
                )}
              </span>
            </span>
            {account.access === 'approved' ? (
              <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => void revoke(account)} data-testid={`access-revoke-${account.user_id}`}>
                Revoke
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => setApproving(account)} data-testid={`access-approve-${account.user_id}`}>
                Approve
              </Button>
            )}
          </li>
        ))}
      </ul>
      {/* A dialog, in a portal: nothing of it sits inside the <details>. */}
      {approving && <ApproveSheet account={approving} onClose={() => setApproving(null)} />}
    </details>
  );
}

function AccessList({ entries }: { entries: { id: string; email: string | null; provider: string | null; subject: string | null; note: string | null; added_by_name: string | null; added_at: string }[] }) {
  const add = useAddAccessEntry();
  const remove = useRemoveAccessEntry();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = accessListEntrySchema.safeParse({ email: email.trim(), note: note.trim() || null });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Check the address.');
      return;
    }
    setProblem(null);
    try {
      await add.mutateAsync(parsed.data);
      setEmail('');
      setNote('');
      toast.success(`${parsed.data.email} may sign up.`);
    } catch (caught) {
      failed(caught, 'That could not be added.');
    }
  }

  return (
    <section className="grid gap-2" aria-label="Who may sign up">
      <h4 className="text-[13px] font-semibold">Who may sign up ({entries.length})</h4>
      <form className="flex flex-wrap items-start gap-2" onSubmit={(event) => void submit(event)}>
        <Input
          aria-label="Email or pattern"
          placeholder="name@gmail.com or *@school.org"
          className="min-w-0 flex-[2_1_14rem]"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          data-testid="access-list-add-email"
        />
        <Input aria-label="Note" placeholder="Note (optional)" className="min-w-0 flex-[1_1_8rem]" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button type="submit" disabled={add.isPending || !email.trim()} data-testid="access-list-add">
          Add
        </Button>
      </form>
      {problem && <p className="text-destructive text-xs">{problem}</p>}
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nobody yet: while Pre-approved is chosen, nobody can sign up.</p>
      ) : (
        <ul className="grid gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-xs" data-testid={`access-list-row-${entry.id}`}>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{entry.email ?? `${entry.provider}: ${entry.subject}`}</span>
                {entry.note && <span className="text-muted-foreground"> · {entry.note}</span>}
                {entry.added_by_name && <span className="text-muted-foreground"> · added by {entry.added_by_name}</span>}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                aria-label={`Remove ${entry.email ?? entry.subject}`}
                onClick={() => void remove.mutateAsync(entry.id).catch((caught) => failed(caught, 'That could not be removed.'))}
                data-testid={`access-list-remove-${entry.id}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
