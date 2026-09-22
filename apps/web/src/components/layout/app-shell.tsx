import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ActivityIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  LinkIcon,
  WalletIcon,
  MenuIcon,
  MessageSquareIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';

import { LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { LiveSessionBar } from '@/features/teaching/live-session-bar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/users', label: 'Users', icon: UsersIcon, end: false },
  { to: '/assignments', label: 'Pairings', icon: LinkIcon, end: false },
  { to: '/sessions', label: 'Sessions', icon: BookOpenIcon, end: false },
  { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, end: false },
  { to: '/billing', label: 'Billing', icon: WalletIcon, end: false },
  { to: '/comments', label: 'Comments', icon: MessageSquareIcon, end: false },
  { to: '/activity', label: 'Activity', icon: ActivityIcon, end: false },
  { to: '/profile', label: 'My profile', icon: UserIcon, end: false },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <LogoLockup className="px-1 py-2" />
      <Separator className="bg-sidebar-border" />
      <NavItems onNavigate={onNavigate} />
      <div className="text-muted-foreground mt-auto px-1 text-xs">
        <p>Mathematics Institute</p>
        <p>of the Triangle</p>
      </div>
    </div>
  );
}

/**
 * Fixed sidebar on desktop, a slide-over on small screens. Kept deliberately
 * plain so new sections are one entry in NAV_ITEMS.
 */
export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-full">
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContents />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="bg-sidebar border-sidebar-border animate-in slide-in-from-left absolute inset-y-0 left-0 w-72 border-r shadow-xl">
            <SidebarContents onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 border-border sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-sm lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>

          <span className="font-display text-sm font-semibold lg:hidden">TMI Portal</span>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* A running lesson follows the tutor wherever they navigate, so it
            cannot be left ticking on a screen they have moved away from. */}
        <LiveSessionBar />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
