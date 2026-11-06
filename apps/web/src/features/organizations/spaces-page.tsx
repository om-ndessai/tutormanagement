import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRightIcon, CheckIcon, LogOutIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { USER_ROLE_LABELS, type Membership } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { AppShell } from '@/components/layout/app-shell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAnswerInvitation, useLeaveSpace } from './api';
import { OrgAvatar } from './org-avatar';
import { Welcome } from './welcome';

/**
 * Phase 60 (S7, docs/spaces-plan.md): `/spaces`, the person's own console. Inside a space it sits
 * in the portal's frame; with no space chosen in this tab it is the selector ("Choose a space"),
 * full screen. Everything on it comes from the person's own session (memberships, invitations,
 * requests) -- no other read.
 */
export function SpacesFrame() {
  const { organization } = useAuth();
  if (organization) return <AppShell />;
  return <SelectorFrame />;
}

function SelectorFrame() {
  const { signOut, impersonated } = useAuth();
  return (
    <div className="bg-background min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <LogoLockup />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-12">
        <Outlet />
        {!impersonated && (
          <div className="justify-self-center">
            <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => window.location.assign('/login'))}>
              Sign out
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

const fail = (caught: unknown, fallback: string) => (caught instanceof ApiRequestError ? caught.message : fallback);

export function SpacesPage() {
  const { user, organization, memberships, invitations, platformAdmin, chooseOrganization, refreshSession } = useAuth();
  const answer = useAnswerInvitation();

  const active = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');
  // Nowhere to go yet: the Welcome page.
  const newcomer = memberships.length === 0 && invitations.length === 0;

  async function respond(slug: string, name: string, accept: boolean) {
    try {
      await answer.mutateAsync({ slug, accept });
      if (accept) {
        // S6: accepting enters the space at once, and it becomes the last choice.
        toast.success(`You have joined ${name}.`);
        chooseOrganization(slug);
        return;
      }
      await refreshSession();
      toast.success(`Invitation to ${name} declined.`);
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  const title = organization ? 'Spaces' : newcomer ? 'Welcome to Aimtrue' : 'Choose a space';

  return (
    // Phase 61 (S11): a newcomer's Welcome is wider, its two choices side by side.
    <div
      className={`grid w-full grid-cols-[minmax(0,1fr)] gap-6 ${newcomer ? 'max-w-3xl' : 'max-w-xl'} ${organization ? '' : 'mx-auto'}`}
      data-testid="spaces-page"
    >
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {user ? `Signed in as ${user.email ?? user.full_name}. ` : ''}
          {newcomer
            ? 'Join a space with its code, or start your own.'
            : 'You land in the space you opened last. Each tab can be in a different one.'}
        </p>
      </div>

      {invitations.length > 0 && (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="Invitations">
          <h2 className="text-muted-foreground text-[13px] font-semibold">Invitations</h2>
          {invitations.map((invite) => (
            <Card key={invite.slug} className="py-0" data-testid={`invitation-${invite.slug}`}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <OrgAvatar org={invite} />
                <div className="min-w-0 flex-1">
                  {/* The whole name, wrapped: "Rivera …" was all J09 read (UI audit JF12). */}
                  <p className="font-medium break-words">{invite.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Invited as {invite.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ') || 'a member'}
                    {invite.invited_by_first_name ? ` by ${invite.invited_by_first_name}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={answer.isPending} onClick={() => void respond(invite.slug, invite.name, true)}>
                    <CheckIcon />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={answer.isPending}
                    onClick={() => void respond(invite.slug, invite.name, false)}
                  >
                    <XIcon />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {memberships.length > 0 && (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="Your spaces">
          <h2 className="text-muted-foreground text-[13px] font-semibold">Your spaces</h2>
          {active.map((org) => (
            <SpaceRow key={org.slug} org={org} current={org.slug === organization?.slug} />
          ))}
          {suspended.map((org) => (
            <SpaceRow key={org.slug} org={org} current={false} />
          ))}
        </section>
      )}

      {platformAdmin && (
        <a
          href="/platform"
          className="bg-card hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2"
        >
          <span className="bg-primary/10 text-primary inline-flex size-9 items-center justify-center rounded-lg">
            <ShieldCheckIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Platform console</span>
            <span className="text-muted-foreground block text-xs">Spaces and their admins</span>
          </span>
          <ArrowRightIcon className="text-muted-foreground size-4" />
        </a>
      )}

      {/* Requests sent, Join with a code, Start a space -- and, belonging nowhere, Delete my account. */}
      <Welcome firstTime={memberships.length === 0} />
    </div>
  );
}

/** One of the person's spaces: Open, and Leave (S8) with a confirmation. */
function SpaceRow({ org, current }: { org: Membership; current: boolean }) {
  const { organization, chooseOrganization, refreshSession } = useAuth();
  const leave = useLeaveSpace();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const suspended = org.status === 'suspended';

  async function confirmLeave() {
    setProblem(null);
    try {
      await leave.mutateAsync(org.slug);
      toast.success(`You have left ${org.name}.`);
      if (org.slug === organization?.slug) {
        // Leaving the space this tab is in: the landing rule decides where to go next.
        window.location.assign('/');
        return;
      }
      setAsking(false);
      await refreshSession();
    } catch (caught) {
      const message = fail(caught, 'Could not leave the space. Try again.');
      setProblem(message);
      toast.error(message);
    }
  }

  return (
    <div className="bg-card min-w-0 rounded-xl border" data-testid={`org-${org.slug}`}>
      <div className="flex items-stretch">
        {suspended ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 p-4 opacity-70">
            <OrgAvatar org={org} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium [overflow-wrap:anywhere]">{org.name}</span>
              <span className="text-muted-foreground block text-xs">Your access here is suspended.</span>
            </span>
            <Badge variant="outline">Suspended</Badge>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => chooseOrganization(org.slug)}
            className="hover:bg-accent/50 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-4 text-left transition-colors outline-none focus-visible:ring-2"
          >
            <OrgAvatar org={org} />
            <span className="min-w-0 flex-1">
              {/* Phase 78 (JF28): a long name wraps, never cut to "a..". */}
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{org.name}</span>
                {current && (
                  <Badge variant="secondary" className="shrink-0">
                    Here now
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground block text-xs">
                {org.personal ? 'Just you' : org.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
              </span>
            </span>
            <ArrowRightIcon className="text-muted-foreground size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setAsking((open) => !open)}
          aria-label={`Leave ${org.name}`}
          title={`Leave ${org.name}`}
          className="hover:bg-accent/50 focus-visible:ring-ring text-muted-foreground hover:text-foreground flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-r-xl border-l px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2"
          data-testid={`space-leave-${org.slug}`}
        >
          {/* Phase 78 (JF35): the icon says it in a word too. */}
          <LogOutIcon className="size-4" aria-hidden />
          Leave
        </button>
      </div>
      {asking && (
        <div className="grid gap-2 border-t p-4 text-sm" data-testid={`space-leave-confirm-${org.slug}`}>
          <p>You stop being a member of {org.name}. Its records of you stay.</p>
          {problem && (
            <p className="text-destructive" role="alert" data-testid={`space-leave-problem-${org.slug}`}>
              {problem}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={leave.isPending} onClick={() => void confirmLeave()}>
              Leave {org.short_name}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Stay
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
