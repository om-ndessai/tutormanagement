import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRoundIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react';
import { ORG_TIME_ZONES, formatRelativeTime, mayMakeSpace, type SpaceLookup } from '@tmi/shared';

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
  useWithdrawRequest,
} from './api';
import { markInviteStep } from './invite-step';
import { OrgAvatar } from './org-avatar';
import { RequestOutcomes } from './request-outcomes';

const message = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

/**
 * Phase 52: what a newcomer sees after signing in -- and anyone looking for another space. Join a
 * space with its code (by asking; its admins let you in), or make your own (adults). Requests
 * waiting for an answer are listed, and may be withdrawn.
 *
 * Phase 61 (S11): for a newcomer (no space, no invitation) the two choices sit side by side --
 * Join with a code, and Start a space (adults only; a 13-17 sees only the first). Starting one
 * goes on to "Invite people" (S12) inside the new space.
 */
export function Welcome({ firstTime }: { firstTime: boolean }) {
  const { joinRequests, account, memberships, invitations, platformAdmin } = useAuth();
  // Held here, not on the request's row: withdrawing refreshes the session, which unmounts the row
  // before a per-call onSuccess there would run (TanStack drops an unmounted observer's callbacks).
  const withdraw = useWithdrawRequest();
  const open = joinRequests.filter((r) => r.outcome === null);
  const canMake = mayMakeSpace({ account, memberships, platform_admin: platformAdmin });
  // A newcomer (nowhere to go yet) sees the two choices side by side.
  const sideBySide = canMake && firstTime && invitations.length === 0;

  return (
    <div className="grid gap-4" data-testid="welcome">
      {/* A space's answer (let in, or declined) stays until dismissed (owner, 2026-11-04; UI audit JF5). */}
      <RequestOutcomes answersOnly />
      {open.length > 0 && (
        <OpenRequests
          pending={withdraw.isPending}
          onWithdraw={(slug, name) =>
            withdraw.mutate(slug, {
              onSuccess: () => toast.success(`Request to ${name} withdrawn.`),
              onError: (e) => toast.error(message(e, 'Could not withdraw the request.')),
            })
          }
        />
      )}
      <div className={sideBySide ? 'grid items-start gap-4 md:grid-cols-2' : 'grid gap-4'} data-testid="welcome-choices">
        <JoinWithCode />
        {canMake && <MakeSpace />}
      </div>
      {!canMake && account?.age_band === '13-17' && (
        // A teen who runs a club met only a grey "no" (J04): the way forward instead (UI audit JF7). An invited adult
        // (no account of their own yet) is not told about ages at all (J09).
        <Card className="py-0" data-testid="welcome-adults-only">
          <CardContent className="grid gap-1 p-4 text-sm">
            <p className="font-semibold">A club needs an adult to start its space</p>
            <p className="text-muted-foreground">
              Ask a teacher or a parent to start it, then join it with its code here.
            </p>
          </CardContent>
        </Card>
      )}
      {/* Only for someone who belongs nowhere, has nothing open and is no platform admin (the API checks the same). */}
      {firstTime && !platformAdmin && memberships.length === 0 && invitations.length === 0 && open.length === 0 && <DeleteAccount />}
    </div>
  );
}

function OpenRequests({
  pending,
  onWithdraw,
}: {
  pending: boolean;
  onWithdraw: (slug: string, name: string) => void;
}) {
  const { joinRequests } = useAuth();
  return (
    <section className="grid gap-2" aria-label="Requests sent">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Requests sent</h2>
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
                disabled={pending}
                onClick={() => onWithdraw(r.slug, r.name)}
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
    <Card className="scroll-mt-20 py-0" id="join" data-testid="welcome-join">
      <CardContent className="grid gap-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <KeyRoundIcon className="text-muted-foreground size-4" /> Join with a code
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
      // S12: the new space opens on "Invite people", then the welcome tour.
      markInviteStep(made.data.slug);
      chooseOrganization(made.data.slug);
    } catch (caught) {
      setProblem(
        caught instanceof ApiRequestError ? (caught.fieldErrors.name ?? caught.message) : 'Could not make the space.',
      );
    }
  }

  return (
    <Card className="scroll-mt-20 py-0" id="start" data-testid="welcome-make">
      <CardContent className="grid gap-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <PlusIcon className="text-muted-foreground size-4" /> Start a space
        </h2>
        <p className="text-muted-foreground text-sm">
          For your family or your students: assessments answered by hand, with a PDF for you, and Quest. It gets its own
          code, so others can ask to join, and you can invite people next.
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
            Start the space
          </Button>
        </form>
        {problem && <p className="text-destructive text-sm">{problem}</p>}
      </CardContent>
    </Card>
  );
}

export function DeleteAccount({ note }: { note?: string } = {}) {
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
        <p>{note ? `${note} ` : ''}Your name, address and sign-in are removed. This cannot be undone.</p>
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
