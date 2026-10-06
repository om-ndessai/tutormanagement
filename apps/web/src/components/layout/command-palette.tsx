import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRightIcon,
  CompassIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  ShieldCheckIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useUsers } from '@/features/users/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { switchTheme } from './theme-transition';

/** One place the palette can take you. Shared with the sidebar, so the two never disagree. */
export interface PaletteDestination {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Extra words that should find it ("money" finds Billing). */
  keywords?: string[];
}

interface PaletteContextValue {
  open: () => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

/** True on a Mac, where the shortcut is ⌘K rather than Ctrl K. */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The command palette: ⌘K / Ctrl+K from anywhere in the portal.
 *
 * Navigation becomes search -- type a few letters of a page, a person or an
 * action instead of remembering where it lives. It complements the sidebar
 * rather than replacing it: everything here is also reachable by clicking.
 * Only ever offers what the reader may do; the API decides the rest.
 */
export function CommandPaletteProvider({
  destinations,
  onTour,
  children,
}: {
  destinations: PaletteDestination[];
  onTour: () => void;
  children: ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, memberships, organization, platformAdmin, chooseOrganization, signOut, impersonated } =
    useAuth();
  const { setTheme } = useTheme();
  const isAdmin = Boolean(user?.roles.includes('admin'));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  // People are searched on the server, as the reader is allowed to see them,
  // once there are two letters to go on.
  const search = useDebouncedValue(query.trim(), 200);
  const people = useUsers(
    { search: search.length >= 2 ? search : undefined, limit: 6, sort: 'full_name' },
    { enabled: isOpen && search.length >= 2 },
  );
  const found = search.length >= 2 ? (people.data?.data ?? []) : [];

  const run = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  const otherOrganizations = memberships.filter(
    (membership) => membership.status === 'active' && membership.slug !== organization?.slug,
  );

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <PaletteContext value={value}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={setOpen}
        title="Go anywhere"
        description="Search pages, people and actions"
        className="sm:max-w-xl"
      >
        <CommandInput
          placeholder="Search pages, people and actions…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[min(60dvh,420px)]">
          <CommandEmpty>Nothing matches “{query}”.</CommandEmpty>

          <CommandGroup heading="Go to">
            {destinations.map((destination) => (
              <CommandItem
                key={destination.to}
                value={`${destination.label} ${(destination.keywords ?? []).join(' ')}`}
                onSelect={() => run(() => navigate(destination.to))}
              >
                <destination.icon />
                {destination.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {found.length > 0 && (
            <CommandGroup heading="People">
              {found.map((person) => (
                <CommandItem
                  key={person.id}
                  value={`person ${person.full_name} ${person.email ?? ''}`}
                  onSelect={() =>
                    run(() =>
                      navigate(
                        person.roles.includes('student') && !isAdmin
                          ? `/progress/${person.id}`
                          : `/users?view=${person.id}`,
                      ),
                    )
                  }
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 truncate">{person.full_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {person.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem value="take the tour help guide welcome" onSelect={() => run(onTour)}>
              <CompassIcon />
              Take the tour
            </CommandItem>
            {(['light', 'dark', 'system'] as const).map((theme) => {
              const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon;
              return (
                <CommandItem
                  key={theme}
                  value={theme === 'system' ? 'match the system theme appearance' : `switch to ${theme} theme mode appearance`}
                  onSelect={() => run(() => switchTheme(() => setTheme(theme)))}
                >
                  <Icon />
                  {theme === 'system' ? 'Match the system theme' : `Switch to ${theme} theme`}
                </CommandItem>
              );
            })}
            {otherOrganizations.map((membership) => (
              <CommandItem
                key={membership.slug}
                value={`switch organization ${membership.name}`}
                onSelect={() => run(() => chooseOrganization(membership.slug))}
              >
                <ArrowLeftRightIcon />
                Switch to {membership.name}
              </CommandItem>
            ))}
            {platformAdmin && (
              <CommandItem
                value="platform console organizations"
                onSelect={() => run(() => window.location.assign('/platform'))}
              >
                <ShieldCheckIcon />
                Platform console
              </CommandItem>
            )}
            {!impersonated && (
              <CommandItem
                value="sign out log out"
                onSelect={() => run(() => void signOut().then(() => window.location.assign('/login')))}
              >
                <LogOutIcon />
                Sign out
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
        <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-[11px]">
          <span>↑↓ to move · ↵ to open · esc to close</span>
          <CommandShortcut>{IS_MAC ? '⌘K' : 'Ctrl K'}</CommandShortcut>
        </div>
      </CommandDialog>
    </PaletteContext>
  );
}

export function useCommandPalette(): PaletteContextValue {
  const context = use(PaletteContext);
  if (!context) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>.');
  return context;
}

/** The header's way in, for anyone who does not know the shortcut. */
export function CommandPaletteButton({ className }: { className?: string }) {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search and go anywhere"
      aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
      className={cn(
        'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40 focus-visible:ring-ring group flex h-9 items-center gap-2 rounded-full border px-3 text-sm shadow-xs backdrop-blur transition-all outline-none hover:shadow-sm focus-visible:ring-2',
        className,
      )}
    >
      <SearchIcon className="icon-pop size-4" />
      <span className="hidden md:inline">Search or jump to…</span>
      <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-sans text-[10px] font-medium md:inline">
        {IS_MAC ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
