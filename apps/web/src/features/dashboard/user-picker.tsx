import { useEffect, useMemo, useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon, EyeIcon, SearchIcon } from 'lucide-react';
import { USER_ROLE_LABELS, type UserRole } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUsers } from '@/features/users/api';
import { RoleIcons } from '@/features/users/role-icon';
import { cn } from '@/lib/utils';

/**
 * Chooses whose dashboard to view.
 *
 * A plain select was fine for a handful of people and unusable once the
 * institute had dozens: there is no way to type a name. This is a combobox
 * that searches the directory server-side, so it stays usable however many
 * users exist rather than however many the page happened to load.
 */
export function UserPicker({
  value,
  onChange,
  currentUserId,
  selected,
}: {
  /** The user being viewed, or null for "my own dashboard". */
  value: string | null;
  onChange: (userId: string | null) => void;
  currentUserId: string | undefined;
  /**
   * Who `value` refers to. Supplied by the caller from the dashboard response
   * rather than looked up here: the trigger has to keep showing the selected
   * person's name while the list is filtered to something else, and the page
   * already knows who they are.
   */
  selected: { full_name: string; roles: UserRole[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);

  // Server-side search: the list is not capped at whatever the page preloaded.
  const { data, isFetching } = useUsers({
    ...(debounced ? { search: debounced } : {}),
    limit: 25,
    sort: 'full_name',
  });

  const users = useMemo(() => data?.data ?? [], [data]);

  // Clear the query when reopening, so the previous search is not still applied.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="View dashboard as"
          className="w-full justify-between sm:w-64"
        >
          <span className="flex min-w-0 items-center gap-2">
            <EyeIcon className="size-4 shrink-0" />
            {selected && value ? (
              <>
                <RoleIcons roles={selected.roles} />
                <span className="truncate">{selected.full_name}</span>
              </>
            ) : (
              <span className="truncate">My own dashboard</span>
            )}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="end">
        {/*
          shouldFilter={false}: the search happens on the server, so cmdk must
          not also filter the results it is given -- doing both would hide rows
          that matched on a field the client cannot see.
        */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or email…"
            value={query}
            onValueChange={setQuery}
          />

          <CommandList>
            <CommandEmpty>
              {isFetching ? 'Searching…' : 'No one matches that name or email.'}
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="__self__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <CheckIcon
                  className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')}
                />
                <span>My own dashboard</span>
              </CommandItem>

              {users
                .filter((candidate) => candidate.id !== currentUserId)
                .map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.id}
                    onSelect={() => {
                      onChange(candidate.id);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        'size-4',
                        value === candidate.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <RoleIcons roles={candidate.roles} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{candidate.full_name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {candidate.roles.map((role) => USER_ROLE_LABELS[role]).join(' · ') ||
                          'No role'}
                      </span>
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>

          {!debounced && (
            <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-xs">
              <SearchIcon className="size-3" />
              Showing the first {users.length}. Type to search everyone.
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
