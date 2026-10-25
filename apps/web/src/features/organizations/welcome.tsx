import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRoundIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react';
import { ORG_TIME_ZONES, formatRelativeTime, type SpaceLookup } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import {
  useAskToJoin,
  useDeleteAccount,
  useLookupSpace,
  useMakeSpace,
  useMarkDeclinesSeen,
  useWithdrawRequest,
} from './api';
import { OrgAvatar } from './org-avatar';

const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

/**
 * Phase 52: what a newcomer sees after signing in -- and anyone looking for another space. Join a
 * space with its code (by asking; its admins let you in), or make your own (adults). Requests
 * waiting for an answer are listed, and may be withdrawn.
 */
export function Welcome({ firstTime }: { firstTime: boolean }) {
  const { joinRequests, account } = useAuth();
  const markSeen = useMarkDeclinesSeen();
  const declined = joinRequests.filter((r) => r.outcome === 'declined');
  const open = joinRequests.filter((r) => r.outcome === null);
  const canMake = !account || account.age_band === 'adult';

  // A decline is shown once.
  useEffect(() => {
    if (declined.length > 0) markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declined.length]);

  return (
    <div className="grid gap-4" data-testid="welcome">
      {declined.map((r) => (
        <p key={r.slug} className="bg-muted rounded-md px-3 py-2 text-sm" data-testid={`welcome-declined-${r.slug}`}>
          {r.name} didn’t accept your request to join.
        </p>
      ))}
      {open.length > 0 && <OpenRequests />}
      <JoinWithCode />
      {canMake ? (
        <MakeSpace />
      ) : (
        <p className="text-muted-foreground text-xs">To make a space of your own you need to be 18 or older.</p>
      )}
      {firstTime && <DeleteAccount />}
    </div>
  );
}

function OpenRequests() {
  const { joinRequests } = useAuth();
  const withdraw = useWithdrawRequest();
  return (
    <section className="grid gap-2" aria-label="Waiting to join">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Waiting to be let in</h2>
      {joinRequests
        .filter((r) => r.outcome === null)
        .map((r) => (
          <Card key={r.slug} className="py-0" data-testid={`welcome-request-${r.slug}`}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <OrgAvatar org={r} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-muted-foreground text-xs">
                  Asked {formatRelativeTime(r.requested_at)}. Its administrators will let you in.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={withdraw.isPending}
                onClick={() =>
                  withdraw.mutate(r.slug, {
                    onSuccess: () => toast.success(`Request to ${r.name} withdrawn.`),
                    onError: (e) => toast.error(message(e, 'Could not withdraw the request.')),
                  })
                }
              >
                <XIcon /> Withdraw
              </Button>
            </CardContent>
          </Card>
        ))}
    </section>
  );
}

function JoinWithCode() {
  const lookup = useLookupSpace();
  const ask = useAskToJoin();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<SpaceLookup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    setFound(null);
    try {
      setFound((await lookup.mutateAsync(code)).data);
    } catch (caught) {
      setProblem(message(caught, 'No space has that code.'));
    }
  }

  async function join() {
    try {
      await ask.mutateAsync(code);
      toast.success(`Asked to join ${found?.name}. Its administrators will let you in.`);
      setFound(null);
      setCode('');
    } catch (caught) {
      toast.error(message(caught, 'Could not ask to join.'));
    }
  }

  return (
    <Card className="py-0" data-testid="welcome-join">
      <CardContent className="grid gap-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <KeyRoundIcon className="text-muted-foreground size-4" /> Have a space code?
        </h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={find}>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="space-code">Space code</Label>
            <Input
              id="space-code"
              value={code}
              placeholder="K7QM-9XDA"
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(event) => setCode(event.target.value)}
              data-testid="welcome-code"
            />
          </div>
          <Button type="submit" variant="outline" disabled={code.trim().length < 8 || lookup.isPending} data-testid="welcome-find">
            {lookup.isPending && <Loader2Icon className="animate-spin" />}
            Find
          </Button>
        </form>
        {problem && <p className="text-destructive text-sm">{problem}</p>}
        {found && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid="welcome-found">
            <OrgAvatar org={found} />
            <p className="min-w-0 flex-1 truncate font-medium">{found.name}</p>
            {found.standing === 'member' ? (
              <span className="text-muted-foreground text-sm">You already belong here.</span>
            ) : found.standing === 'requested' ? (
              <span className="text-muted-foreground text-sm">You have asked already.</span>
            ) : (
              <Button size="sm" onClick={() => void join()} disabled={ask.isPending} data-testid="welcome-ask">
                Ask to join
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MakeSpace() {
  const make = useMakeSpace();
  const { chooseOrganization } = useAuth();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const made = await make.mutateAsync({
        name,
        ...((ORG_TIME_ZONES as readonly string[]).includes(zone) ? { time_zone: zone as (typeof ORG_TIME_ZONES)[number] } : {}),
      });
      toast.success(`${made.data.name} is ready.`);
      chooseOrganization(made.data.slug);
    } catch (caught) {
      setProblem(
        caught instanceof ApiRequestError ? (caught.fieldErrors.name ?? caught.message) : 'Could not make the space.',
      );
    }
  }

  return (
    <Card className="py-0" data-testid="welcome-make">
      <CardContent className="grid gap-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <PlusIcon className="text-muted-foreground size-4" /> No code? Make your own space
        </h2>
        <p className="text-muted-foreground text-sm">
          For your family or your students: assessments answered by hand, with a PDF for you. It gets its own code, so
          others can ask to join.
        </p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="space-name">Name your space</Label>
            <Input
              id="space-name"
              value={name}
              placeholder="The Patel family"
              onChange={(event) => setName(event.target.value)}
              data-testid="welcome-space-name"
            />
          </div>
          <Button type="submit" disabled={name.trim().length < 2 || make.isPending} data-testid="welcome-make-submit">
            {make.isPending && <Loader2Icon className="animate-spin" />}
            Make the space
          </Button>
        </form>
        {problem && <p className="text-destructive text-sm">{problem}</p>}
      </CardContent>
    </Card>
  );
}

function DeleteAccount() {
  const remove = useDeleteAccount();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAsking(true)} data-testid="welcome-delete-account">
          Delete my account
        </Button>
      </div>
    );
  }
  return (
    <Card className="border-destructive/40 py-0">
      <CardContent className="grid gap-2 p-4 text-sm">
        <p>Your name, address and sign-in are removed. This cannot be undone.</p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => window.location.assign('/login'),
                onError: (e) => toast.error(message(e, 'Could not delete the account.')),
              })
            }
            data-testid="welcome-delete-confirm"
          >
            Delete my account
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
            Keep it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
