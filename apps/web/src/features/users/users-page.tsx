import { useMemo, useState } from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  type User,
  type UserRole,
  type UserSortField,
  type UserStatus,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiRequestError } from '@/lib/api-client';
import { useDeleteUser, useRestoreUser, useUsers } from './api';
import { UserFormDialog } from './user-form-dialog';
import { UsersTable } from './users-table';

const PAGE_SIZE = 25;
const ANY = 'any';

/** Which confirmation the page is currently showing, if any. */
type PendingAction =
  | { kind: 'deactivate'; user: User }
  | { kind: 'delete'; user: User }
  | null;

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | typeof ANY>(ANY);
  const [status, setStatus] = useState<UserStatus | typeof ANY>(ANY);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [sortState, setSortState] = useState<{ sort: UserSortField; order: 'asc' | 'desc' }>({
    sort: 'full_name',
    order: 'asc',
  });
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const debouncedSearch = useDebouncedValue(search);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      role: role === ANY ? undefined : role,
      status: status === ANY ? undefined : status,
      include_deleted: includeDeleted,
      sort: sortState.sort,
      order: sortState.order,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [debouncedSearch, role, status, includeDeleted, sortState, page],
  );

  const { data, isPending, isError, error, isFetching } = useUsers(params);
  const deleteUser = useDeleteUser();
  const restoreUser = useRestoreUser();

  const users = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  /** Any filter change invalidates the current page number. */
  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setFormOpen(true);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const { kind, user } = pendingAction;

    try {
      await deleteUser.mutateAsync({ id: user.id, hard: kind === 'delete' });
      toast.success(
        kind === 'delete' ? `${user.full_name} deleted.` : `${user.full_name} deactivated.`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? caught.message : 'Could not complete that action.',
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRestore(user: User) {
    try {
      await restoreUser.mutateAsync(user.id);
      toast.success(`${user.full_name} restored.`);
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? caught.message : 'Could not restore that user.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Users"
        description="Admins and tutors at the Mathematics Institute of the Triangle."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon />
            Add user
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="user-search" className="sr-only">
            Search users
          </Label>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="user-search"
              value={search}
              onChange={(event) => resetPage(setSearch)(event.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
              type="search"
            />
          </div>
        </div>

        <FilterSelect
          id="role-filter"
          label="Role"
          value={role}
          onValueChange={resetPage((value: string) => setRole(value as UserRole | typeof ANY))}
          anyLabel="All roles"
          options={USER_ROLES.map((value) => ({ value, label: USER_ROLE_LABELS[value] }))}
        />

        <FilterSelect
          id="status-filter"
          label="Status"
          value={status}
          onValueChange={resetPage((value: string) =>
            setStatus(value as UserStatus | typeof ANY),
          )}
          anyLabel="All statuses"
          options={USER_STATUSES.map((value) => ({ value, label: USER_STATUS_LABELS[value] }))}
        />

        <label className="text-muted-foreground flex h-9 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(event) => resetPage(setIncludeDeleted)(event.target.checked)}
            className="accent-primary size-4 rounded"
          />
          Show deactivated
        </label>
      </div>

      {isError ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-8 text-center">
          <p className="text-destructive text-sm font-medium">
            {error instanceof ApiRequestError ? error.message : 'Could not load users.'}
          </p>
        </div>
      ) : (
        <>
          <UsersTable
            users={users}
            isLoading={isPending}
            sortState={sortState}
            onSortChange={resetPage(setSortState)}
            onEdit={openEdit}
            onDeactivate={(user) => setPendingAction({ kind: 'deactivate', user })}
            onRestore={handleRestore}
            onDelete={(user) => setPendingAction({ kind: 'delete', user })}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {total === 0
                ? 'No users'
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
              {isFetching && !isPending && ' · updating…'}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === 'delete'
                ? `Delete ${pendingAction.user.full_name}?`
                : `Deactivate ${pendingAction?.user.full_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === 'delete'
                ? 'This permanently removes the record. This cannot be undone — deactivate instead if you may need the history.'
                : 'They will be hidden from the directory but kept on file, and can be restored at any time.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingAction}
              disabled={deleteUser.isPending}
              className={
                pendingAction?.kind === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {pendingAction?.kind === 'delete' ? 'Delete permanently' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  anyLabel,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  anyLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
