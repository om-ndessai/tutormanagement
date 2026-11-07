import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { COMMON_COPY, featureOn, seesPeoplePages, seesTeachingPages, type FeatureSet } from '@tmi/shared';
import {
  ActivityIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LinkIcon,
  WalletIcon,
  MenuIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  XIcon,
  MapPinIcon,
  PenLineIcon,
  TrophyIcon,
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
import { InvitationBanner } from '@/features/organizations/invitation-banner';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBrand } from '@/providers/brand-provider';

const NAV_ITEMS: (PaletteDestination & {
  end: boolean;
  admin?: boolean;
  /** Phase 74 (JF31): the people pages -- for admins and tutors only (`seesPeoplePages`); a link still opens them. */
  people?: boolean;
  /**
   * Phase 79 (M6): a teaching page -- for someone who holds a role here (`seesTeachingPages`). A member (no role) plays
   * Quest, so their menu leaves these out; a link still opens them.
   */
  teaching?: boolean;
  /** Phase 50: the feature set it belongs to; shown only while that set is on here. */
  set?: FeatureSet;
})[] = [
  // Phase 66: the member home first; the role dashboards (with Finance) where Tutoring is on.
  { to: '/', label: 'Home', icon: HouseIcon, end: true, keywords: ['home', 'next', 'today'] },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, end: false, teaching: true, set: 'tutoring', keywords: ['overview', 'analytics', 'finance'] },
  // Phase 78 (JF32): the glossary's words; the routes stay /users and /sessions, and the old words still find them.
  { to: '/users', label: COMMON_COPY.people_page, icon: UsersIcon, end: false, people: true, keywords: ['users', 'students', 'tutors', 'parents', 'family'] },
  { to: '/assignments', label: 'Pairings', icon: LinkIcon, end: false, people: true, set: 'tutoring', keywords: ['assignments', 'tutor', 'student'] },
  { to: '/sessions', label: COMMON_COPY.lessons_page, icon: BookOpenIcon, end: false, teaching: true, set: 'tutoring', keywords: ['sessions', 'record', 'notes', 'drafts'] },
  { to: '/progress', label: 'Progress', icon: TrendingUpIcon, end: false, teaching: true, set: 'tutoring', keywords: ['plans', 'assessments', 'goals'] },
  // Phase 38: answers written on a canvas. Only while the space has it on. No "Beta" mark since Phase 78 (owner,
  // 2026-11-05): checked questions are served like any other.
  { to: '/assessments', label: 'Assessment', icon: PenLineIcon, end: false, teaching: true, set: 'assessment', keywords: ['test', 'quiz', 'canvas', 'handwriting', 'questions'] },
  // Phase 42: Question Quest and the quests on the board. Only while the space has it on.
  { to: '/quest', label: 'Quest', icon: TrophyIcon, end: false, set: 'quest', keywords: ['game', 'points', 'questions', 'approve', 'review'] },
  { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, end: false, teaching: true, set: 'tutoring', keywords: ['calendar', 'cancel', 'weekly'] },
  // Every tutor's and student's places (Phase 33): admins only.
  { to: '/locations', label: 'Locations', icon: MapPinIcon, end: false, admin: true, set: 'tutoring', keywords: ['places', 'rooms', 'address', 'online', 'reminder'] },
  { to: '/billing', label: 'Billing', icon: WalletIcon, end: false, people: true, set: 'tutoring', keywords: ['payments', 'money', 'balances', '1099', 'tax'] },
  { to: '/comments', label: 'Comments', icon: MessageSquareIcon, end: false, teaching: true, set: 'tutoring', keywords: ['notes', 'messages'] },
  { to: '/activity', label: 'Activity', icon: ActivityIcon, end: false, keywords: ['log', 'audit', 'history'] },
  { to: '/profile', label: 'My profile', icon: UserIcon, end: false, keywords: ['me', 'account'] },
  // The organization's own settings (its 1099 payer details): admins only.
  // "Space settings", not "Space": a teacher looking to start a space met this as a dead end (UI audit JF7).
  { to: '/organization', label: 'Space settings', icon: Building2Icon, end: false, admin: true, keywords: ['settings', 'tin', 'payer', 'organization', 'code', 'join'] },
];

/**
 * The menu, from the reader's roles: what they do not reach is left out. A student or a parent never sees People,
 * Pairings or Billing (owner, 2026-11-05; JF31) -- a parent reaches their child from the home's child card -- and a
 * member (no role, Phase 79) sees none of the teaching pages, so their menu is Home, Quest, Activity and My profile.
 * A link to one still opens it.
 */
function useNavItems() {
  const { user, organization } = useAuth();
  const roles = user?.roles ?? [];
  const admin = roles.includes('admin');
  const people = seesPeoplePages(roles);
  const teaching = seesTeachingPages(roles);
  return NAV_ITEMS.filter(
    (item) =>
      (!item.admin || admin) &&
      (!item.people || people) &&
      (!item.teaching || teaching) &&
      (!item.set || featureOn(organization, item.set)),
  );
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
          data-tour={to === '/' ? 'nav-home' : `nav-${to.slice(1)}`}
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
      {/* The lockup, which is always the space switcher (Phase 60). */}
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
  const { user } = useAuth();
  const items = useNavItems();
  // Phase 79 (M6): no tour for a member (no role): it walks the teaching pages their menu leaves out.
  const member = user?.roles.length === 0;
  return (
    <CommandPaletteProvider destinations={items} onTour={member ? undefined : openWizard}>
      {children}
    </CommandPaletteProvider>
  );
}

/**
 * Whether the page has scrolled under the header (Phase 78, JF35): the glass bar then turns all but solid, so
 * nothing shows through behind the space's name. A passive listener; the colour change itself is a short CSS
 * transition, which the reduced-motion guard stills.
 */
function usePageScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { organization } = useAuth();
  const scrolled = usePageScrolled();

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
        <header
          className="glass border-border/60 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 lg:px-8"
          data-scrolled={scrolled ? 'true' : 'false'}
          data-testid="app-header"
        >
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
        {featureOn(organization, 'tutoring') && <LiveSessionBar />}
        {/* Phase 60 (S6): an invitation to another space waits here until answered or put off. */}
        <InvitationBanner />

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
