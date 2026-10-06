import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ActivityIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  LinkIcon,
  WalletIcon,
  MenuIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';

import { DeveloperCredit } from '@/components/layout/developer-credit';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { LiveSessionBar } from '@/features/teaching/live-session-bar';
import { OnboardingProvider, useOnboarding } from '@/features/onboarding/onboarding-provider';
import {
  CommandPaletteButton,
  CommandPaletteProvider,
  type PaletteDestination,
} from '@/components/layout/command-palette';
import { OrgSwitcher } from '@/features/organizations/org-switcher';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBrand } from '@/providers/brand-provider';

const NAV_ITEMS: (PaletteDestination & { end: boolean; admin?: boolean })[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true, keywords: ['home', 'overview'] },
  { to: '/users', label: 'Users', icon: UsersIcon, end: false, keywords: ['people', 'students', 'tutors', 'parents', 'family'] },
  { to: '/assignments', label: 'Pairings', icon: LinkIcon, end: false, keywords: ['assignments', 'tutor', 'student'] },
  { to: '/sessions', label: 'Sessions', icon: BookOpenIcon, end: false, keywords: ['lessons', 'record', 'notes', 'drafts'] },
  { to: '/progress', label: 'Progress', icon: TrendingUpIcon, end: false, keywords: ['plans', 'assessments', 'goals'] },
  { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, end: false, keywords: ['calendar', 'cancel', 'weekly'] },
  { to: '/billing', label: 'Billing', icon: WalletIcon, end: false, keywords: ['payments', 'money', 'balances', '1099', 'tax'] },
  { to: '/comments', label: 'Comments', icon: MessageSquareIcon, end: false, keywords: ['notes', 'messages'] },
  { to: '/activity', label: 'Activity', icon: ActivityIcon, end: false, keywords: ['log', 'audit', 'history'] },
  { to: '/profile', label: 'My profile', icon: UserIcon, end: false, keywords: ['me', 'account'] },
  // The organization's own settings (its 1099 payer details): admins only.
  { to: '/organization', label: 'Organization', icon: Building2Icon, end: false, admin: true, keywords: ['settings', 'tin', 'payer'] },
];

/** The menu, less what this reader's roles do not reach. */
function useNavItems() {
  const { user } = useAuth();
  const admin = Boolean(user?.roles.includes('admin'));
  return NAV_ITEMS.filter((item) => !item.admin || admin);
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNavItems();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          // What the feature tour (Phase 26) points at: nav-sessions, nav-billing…
          data-tour={to === '/' ? 'nav-dashboard' : `nav-${to.slice(1)}`}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
              // The indicator: a bar that grows in beside the page you are on.
              'before:bg-sidebar-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:transition-transform before:duration-300',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs before:scale-y-100'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground before:scale-y-0 hover:translate-x-0.5',
            )
          }
        >
          <Icon className="icon-pop size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const brand = useBrand();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* The lockup, or -- for someone in several organizations -- the switcher. */}
      <OrgSwitcher className="px-1 py-2" />
      <Separator className="bg-sidebar-border" />
      <NavItems onNavigate={onNavigate} />
      <div className="text-sidebar-muted-foreground mt-auto px-1 text-xs">
        {/* One line, wrapping as it likes: a second hardcoded line only ever
            read correctly for one institute. */}
        <p className="text-pretty">{brand.name}</p>
        <DeveloperCredit className="mt-2" />
      </div>
    </div>
  );
}

/** The organization's short name in the phone header, where the sidebar is hidden. */
function BrandShort() {
  const brand = useBrand();
  return <span className="font-display text-sm font-semibold lg:hidden">{brand.short}</span>;
}

/**
 * Fixed sidebar on desktop, a slide-over on small screens. Kept deliberately
 * plain so new sections are one entry in NAV_ITEMS.
 */
export function AppShell() {
  return (
    // The welcome wizard and tour (Phase 26) sit over the whole signed-in portal,
    // and the command palette (⌘K) over that.
    <OnboardingProvider>
      <PaletteLayer>
        <Shell />
      </PaletteLayer>
    </OnboardingProvider>
  );
}

function PaletteLayer({ children }: { children: React.ReactNode }) {
  const { openWizard } = useOnboarding();
  const items = useNavItems();
  return (
    <CommandPaletteProvider destinations={items} onTour={openWizard}>
      {children}
    </CommandPaletteProvider>
  );
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="surface-mesh flex min-h-full">
      <aside className="bg-sidebar/90 text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 border-r backdrop-blur-xl lg:block">
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
          <div className="bg-sidebar text-sidebar-foreground border-sidebar-border animate-in slide-in-from-left absolute inset-y-0 left-0 w-72 border-r shadow-xl">
            <SidebarContents onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass border-border/60 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            data-tour="nav-toggle"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>

          <BrandShort />

          <div className="ml-auto flex items-center gap-1">
            <CommandPaletteButton className="mr-1" />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* A running lesson follows the tutor wherever they navigate, so it
            cannot be left ticking on a screen they have moved away from. */}
        <LiveSessionBar />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {/* Each page arrives, rather than appearing: a short rise and fade,
              keyed on the path so it plays on every page change. */}
          <div key={location.pathname} className="route-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
