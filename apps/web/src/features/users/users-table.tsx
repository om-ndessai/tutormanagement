import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserMinusIcon,
} from 'lucide-react';
import { USER_SORT_FIELDS, type User, type UserSortField } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeletedBadge, RoleBadges, StatusBadge } from './user-badges';

interface SortState {
  sort: UserSortField;
  order: 'asc' | 'desc';
}

const COLUMNS: { key: UserSortField | null; label: string; className?: string }[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email', className: 'hidden lg:table-cell' },
  { key: null, label: 'Phone', className: 'hidden xl:table-cell' },
  { key: null, label: 'Roles' },
  { key: 'status', label: 'Status' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface RowActions {
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onRestore: (user: User) => void;
  onDelete: (user: User) => void;
}

interface Props extends RowActions {
  users: User[];
  isLoading: boolean;
  sortState: SortState;
  onSortChange: (next: SortState) => void;
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {initials(name)}
    </span>
  );
}

function ActionsMenu({ user, actions }: { user: User; actions: RowActions }) {
  const isDeleted = user.deleted_at !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.full_name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => actions.onView(user)}>
          <EyeIcon className="size-4" />
          View details
        </DropdownMenuItem>

        {!isDeleted && (
          <>
            <DropdownMenuItem onSelect={() => actions.onEdit(user)}>
              <PencilIcon className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onDeactivate(user)}>
              <UserMinusIcon className="size-4" />
              Deactivate
            </DropdownMenuItem>
          </>
        )}

        {isDeleted && (
          <DropdownMenuItem onSelect={() => actions.onRestore(user)}>
            <RotateCcwIcon className="size-4" />
            Restore
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(user)}>
          <Trash2Icon className="size-4" />
          Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The directory, in two layouts.
 *
 * A table needs roughly 700px before its columns stop fighting each other, so
 * below `md` the same rows are stacked as cards instead. Sideways-scrolling a
 * table on a phone hides exactly the columns people came for -- status and the
 * actions menu were both off-screen.
 */
export function UsersTable({
  users,
  isLoading,
  sortState,
  onSortChange,
  ...actions
}: Props) {
  function toggleSort(field: UserSortField) {
    onSortChange(
      sortState.sort === field
        ? { sort: field, order: sortState.order === 'asc' ? 'desc' : 'asc' }
        : { sort: field, order: 'asc' },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 md:space-y-0">
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <div className="border-border bg-card hidden overflow-x-auto rounded-lg border md:block">
          <Table>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border p-10 text-center">
        <p className="text-muted-foreground text-sm">No users match these filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Phone: one card per person, nothing hidden off-screen. */}
      <ul className="space-y-3 md:hidden">
        {users.map((user) => {
          const isDeleted = user.deleted_at !== null;

          return (
            <li
              key={user.id}
              className={cn(
                'border-border bg-card rounded-lg border p-3',
                isDeleted && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar name={user.full_name} />

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => actions.onView(user)}
                    className="hover:text-primary block max-w-full truncate text-left font-medium transition-colors"
                  >
                    {user.full_name}
                  </button>
                  <a
                    href={`mailto:${user.email}`}
                    className="text-muted-foreground hover:text-primary block truncate text-xs"
                  >
                    {user.email}
                  </a>
                  {user.phone && (
                    <span className="text-muted-foreground block text-xs">{user.phone}</span>
                  )}
                </div>

                <ActionsMenu user={user} actions={actions} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-12">
                <RoleBadges roles={user.roles} />
                <StatusBadge status={user.status} />
                {isDeleted && <DeletedBadge />}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Tablet and up: the full table. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.key && USER_SORT_FIELDS.includes(column.key) ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key as UserSortField)}
                      className="hover:text-foreground -mx-2 flex items-center gap-1 rounded px-2 py-1 transition-colors"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {sortState.sort === column.key &&
                        (sortState.order === 'asc' ? (
                          <ArrowUpIcon className="size-3" />
                        ) : (
                          <ArrowDownIcon className="size-3" />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.map((user) => {
              const isDeleted = user.deleted_at !== null;

              return (
                <TableRow key={user.id} className={cn(isDeleted && 'opacity-60')}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.full_name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => actions.onView(user)}
                            className="hover:text-primary truncate text-left font-medium transition-colors"
                          >
                            {user.full_name}
                          </button>
                          {isDeleted && <DeletedBadge />}
                        </div>
                        <span className="text-muted-foreground truncate text-xs lg:hidden">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    <a
                      href={`mailto:${user.email}`}
                      className="hover:text-primary text-muted-foreground truncate transition-colors"
                    >
                      {user.email}
                    </a>
                  </TableCell>

                  <TableCell className="text-muted-foreground hidden xl:table-cell">
                    {user.phone ?? '—'}
                  </TableCell>

                  <TableCell>
                    <RoleBadges roles={user.roles} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>

                  <TableCell>
                    <ActionsMenu user={user} actions={actions} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
