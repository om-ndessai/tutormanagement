import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRightIcon, BuildingIcon, CheckIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { useAnswerInvitation } from './api';
import { OrgAvatar } from './org-avatar';

/**
 * Where someone who belongs to several organizations -- or has been invited
 * to one -- chooses where to go. Each tab chooses for itself; the choice is
 * remembered for the next visit.
 */
export function SelectOrganizationPage() {
  const { user, memberships, invitations, platformAdmin, chooseOrganization, refreshSession, signOut, impersonated } =
    useAuth();
  const answer = useAnswerInvitation();

  const active = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');

  // One organization and nothing to answer: no choice to make.
  const only = active.length === 1 && invitations.length === 0 && !platformAdmin ? active[0]!.slug : null;
  useEffect(() => {
    if (only) chooseOrganization(only);
  }, [only, chooseOrganization]);

  if (only) return null;
  if (active.length === 0 && invitations.length === 0 && platformAdmin) {
    return <Navigate to="/platform" replace />;
  }

  async function respond(slug: string, name: string, accept: boolean) {
    try {
      await answer.mutateAsync({ slug, accept });
      await refreshSession();
      toast.success(accept ? `You have joined ${name}.` : `Invitation to ${name} declined.`);
    } catch {
      toast.error('That invitation could not be answered. Try again.');
    }
  }

  return (
    <div className="bg-background min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <LogoLockup />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid max-w-xl gap-6 px-4 pb-12">
        <div>
          <h1 className="text-2xl font-semibold">Choose an organization</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {user ? `Signed in as ${user.email ?? user.full_name}. ` : ''}Each tab can be in a different
            one, and you can switch at any time from the menu.
          </p>
        </div>

        {invitations.length > 0 && (
          <section className="grid gap-3" aria-label="Invitations">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Invitations
            </h2>
            {invitations.map((invite) => (
              <Card key={invite.slug} className="py-0">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <OrgAvatar org={invite} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invite.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Invited as {invite.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ') || 'a member'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={answer.isPending} onClick={() => respond(invite.slug, invite.name, true)}>
                      <CheckIcon />
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => respond(invite.slug, invite.name, false)}>
                      <XIcon />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        <section className="grid gap-3" aria-label="Your organizations">
          {active.map((org) => (
            <button
              key={org.slug}
              type="button"
              onClick={() => chooseOrganization(org.slug)}
              className="bg-card hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2"
            >
              <OrgAvatar org={org} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {org.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
                </span>
              </span>
              <ArrowRightIcon className="text-muted-foreground size-4" />
            </button>
          ))}

          {suspended.map((org) => (
            <div key={org.slug} className="flex items-center gap-3 rounded-xl border border-dashed p-4 opacity-70">
              <OrgAvatar org={org} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="text-muted-foreground block text-xs">Your access here is suspended.</span>
              </span>
              <Badge variant="outline">Suspended</Badge>
            </div>
          ))}

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
                <span className="text-muted-foreground block text-xs">Organizations and their admins</span>
              </span>
              <ArrowRightIcon className="text-muted-foreground size-4" />
            </a>
          )}

          {active.length === 0 && invitations.length === 0 && !platformAdmin && (
            <Card className="py-0">
              <CardContent className="flex items-center gap-3 p-4 text-sm">
                <BuildingIcon className="text-muted-foreground size-4" />
                You do not belong to any organization yet. Ask an administrator to add you.
              </CardContent>
            </Card>
          )}
        </section>

        {!impersonated && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => window.location.assign('/login'))}>
              Sign out
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
