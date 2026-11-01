import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon, MailIcon, ShieldCheckIcon } from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { OrgAvatar } from './org-avatar';

/** "1 invitation waiting", "2 invitations waiting". */
export function invitationsWaiting(count: number): string {
  return count === 1 ? '1 invitation waiting' : `${count} invitations waiting`;
}

/**
 * The sidebar's lockup, which is always the space switcher (Phase 60, S7): the person's spaces,
 * a count of invitations waiting, "All spaces" (the Spaces page), and the console for its admins.
 * Switching reloads this tab in the other space, which becomes the person's last choice; other
 * tabs stay where they are. There is no star: the last space opened is where they land.
 */
export function OrgSwitcher({ className }: { className?: string }) {
  const { organization, memberships, invitations, platformAdmin, chooseOrganization } = useAuth();
  const active = memberships.filter((m) => m.status === 'active');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-sidebar-accent/60 focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2',
          className,
        )}
        aria-label="Switch space"
        data-testid="org-switcher"
      >
        <LogoLockup className="min-w-0 flex-1" />
        {invitations.length > 0 && (
          <Badge
            className="shrink-0 px-1.5 py-0 text-[10px] font-semibold"
            aria-label={invitationsWaiting(invitations.length)}
            data-testid="org-switcher-invitations"
          >
            {invitations.length}
          </Badge>
        )}
        <ChevronsUpDownIcon className="text-sidebar-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Spaces</DropdownMenuLabel>
        {active.map((org) => (
          <DropdownMenuItem key={org.slug} onSelect={() => org.slug !== organization?.slug && chooseOrganization(org.slug)}>
            <OrgAvatar org={org} className="size-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{org.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {org.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
              </span>
            </span>
            {org.slug === organization?.slug && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        {invitations.length > 0 && (
          <DropdownMenuItem onSelect={() => window.location.assign('/spaces')}>
            <MailIcon className="size-4" />
            {invitationsWaiting(invitations.length)}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => window.location.assign('/spaces')} data-testid="org-switcher-all">
          <LayoutGridIcon className="size-4" />
          All spaces
        </DropdownMenuItem>
        {platformAdmin && (
          <DropdownMenuItem onSelect={() => window.location.assign('/platform')}>
            <ShieldCheckIcon className="size-4" />
            Platform console
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
