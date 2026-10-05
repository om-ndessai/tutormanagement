import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { ArrowLeftRightIcon, LogOutIcon } from 'lucide-react';

import { LogoLockup } from '@/components/brand/logo';
import { DeveloperCredit } from '@/components/layout/developer-credit';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { usePlatformBrand } from '@/providers/brand-provider';

const TABS = [
  { to: '/platform', label: 'Organizations', end: true },
  { to: '/platform/admins', label: 'Platform admins', end: false },
  { to: '/platform/people', label: 'People', end: false },
  { to: '/platform/activity', label: 'Activity', end: false },
];

/**
 * The platform console: organizations, their look and their admins. It wears
 * the platform's own identity and runs outside every organization -- nothing
 * here reads an organization's students, lessons or money.
 */
export function PlatformShell() {
  const { platformAdmin, memberships, impersonated, signOut, user } = useAuth();
  usePlatformBrand();

  if (!platformAdmin) return <Navigate to="/" replace />;

  const hasOrganizations = memberships.some((m) => m.status === 'active');

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-8">
        <LogoLockup />
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
          Platform console
        </span>
        <div className="ml-auto flex items-center gap-1">
          {hasOrganizations && (
            <Button variant="ghost" size="sm" onClick={() => window.location.assign('/select-organization')}>
              <ArrowLeftRightIcon />
              <span className="hidden sm:inline">My organizations</span>
            </Button>
          )}
          <ThemeToggle />
          {!impersonated && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => void signOut().then(() => window.location.assign('/login'))}
            >
              <LogOutIcon />
            </Button>
          )}
        </div>
      </header>

      <nav className="border-border flex gap-1 overflow-x-auto border-b px-4 sm:px-8" aria-label="Platform">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8">
        <Outlet />
      </main>

      <footer className="text-muted-foreground px-4 py-4 text-xs sm:px-8">
        Signed in as {user?.email ?? user?.full_name}
        <DeveloperCredit className="mt-1" />
      </footer>
    </div>
  );
}
