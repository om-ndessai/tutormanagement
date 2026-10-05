import { CheckIcon, ChevronsUpDownIcon, ShieldCheckIcon } from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
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

/** Whether the person has anywhere else to go: another organization, or the console. */
export function useHasOtherPlaces(): boolean {
  const { memberships, invitations, platformAdmin } = useAuth();
  const active = memberships.filter((m) => m.status === 'active');
  return active.length + (platformAdmin ? 1 : 0) > 1 || invitations.length > 0;
}

/**
 * The sidebar's lockup, which becomes a switcher when the person belongs to
 * more than one organization (the platform console counts as one). Switching
 * reloads this tab in the other organization; other tabs stay where they are.
 */
export function OrgSwitcher({ className }: { className?: string }) {
  const { organization, memberships, invitations, platformAdmin, chooseOrganization } = useAuth();
  const hasOthers = useHasOtherPlaces();

  if (!hasOthers) return <LogoLockup className={className} />;

  const active = memberships.filter((m) => m.status === 'active');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-sidebar-accent/60 focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2',
          className,
        )}
        aria-label="Switch organization"
        data-testid="org-switcher"
      >
        <LogoLockup className="min-w-0 flex-1" />
        <ChevronsUpDownIcon className="text-sidebar-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Organizations</DropdownMenuLabel>
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

        {(platformAdmin || invitations.length > 0) && <DropdownMenuSeparator />}
        {invitations.length > 0 && (
          <DropdownMenuItem onSelect={() => window.location.assign('/select-organization')}>
            {invitations.length === 1 ? '1 invitation waiting' : `${invitations.length} invitations waiting`}
          </DropdownMenuItem>
        )}
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
