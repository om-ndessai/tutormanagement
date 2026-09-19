import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserMinusIcon,
} from 'lucide-react';
import {
  USER_SORT_FIELDS,
  type User,
  type UserSortField,
} from '@tmi/shared';

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
import { DeletedBadge, RoleBadge, StatusBadge } from './user-badges';

interface SortState {
  sort: UserSortField;
  order: 'asc' | 'desc';
}

const COLUMNS: { key: UserSortField | null; label: string; className?: string }[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email', className: 'hidden md:table-cell' },
  { key: null, label: 'Phone', className: 'hidden lg:table-cell' },
  { key: 'role', label: 'Role' },
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

export function UsersTable({
  users,
  isLoading,
  sortState,
  onSortChange,
  onEdit,
  onDeactivate,
  onRestore,
  onDelete,
}: {
  users: User[];
  isLoading: boolean;
  sortState: SortState;
  onSortChange: (next: SortState) => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onRestore: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  function toggleSort(field: UserSortField) {
    onSortChange(
      sortState.sort === field
        ? { sort: field, order: sortState.order === 'asc' ? 'desc' : 'asc' }
        : { sort: field, order: 'asc' },
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
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
          {isLoading &&
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.label} className={column.className}>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="size-8 rounded-md" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && users.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length + 1} className="h-32 text-center">
                <p className="text-muted-foreground text-sm">
                  No users match these filters.
                </p>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            users.map((user) => {
              const isDeleted = user.deleted_at !== null;

              return (
                <TableRow key={user.id} className={cn(isDeleted && 'opacity-60')}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      >
                        {initials(user.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{user.full_name}</span>
                          {isDeleted && <DeletedBadge />}
                        </div>
                        <span className="text-muted-foreground truncate text-xs md:hidden">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <a
                      href={`mailto:${user.email}`}
                      className="hover:text-primary text-muted-foreground truncate transition-colors"
                    >
                      {user.email}
                    </a>
                  </TableCell>

                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {user.phone ?? '—'}
                  </TableCell>

                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${user.full_name}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {!isDeleted && (
                          <>
                            <DropdownMenuItem onSelect={() => onEdit(user)}>
                              <PencilIcon className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDeactivate(user)}>
                              <UserMinusIcon className="size-4" />
                              Deactivate
                            </DropdownMenuItem>
                          </>
                        )}

                        {isDeleted && (
                          <DropdownMenuItem onSelect={() => onRestore(user)}>
                            <RotateCcwIcon className="size-4" />
                            Restore
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
                          <Trash2Icon className="size-4" />
                          Delete permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
