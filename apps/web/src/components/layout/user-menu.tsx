import { useNavigate } from 'react-router-dom';
import { LogOutIcon, UserIcon } from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/providers/auth-provider';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu() {
  const { user, impersonated, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <span
            aria-hidden
            className="bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200 flex size-7 items-center justify-center rounded-full text-[11px] font-semibold"
          >
            {initials(user.full_name)}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            <p className="text-muted-foreground mt-1 text-xs">
            {user.roles.map((role) => USER_ROLE_LABELS[role]).join(" \u00b7 ")}
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserIcon className="size-4" />
          My profile
        </DropdownMenuItem>

        {/* With auth off there is no session to end, so the action would lie. */}
        {!impersonated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOutIcon className="size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
