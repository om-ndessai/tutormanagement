import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EyeIcon, Loader2Icon, XIcon } from 'lucide-react';
import { DASHBOARD_ROLE_LABELS, type UserRole } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';
import { useDashboard } from '@/features/dashboard/api';
import { UserPicker } from '@/features/dashboard/user-picker';
import { RoleIcons } from '@/features/users/role-icon';
import {
  AdminView,
  ParentView,
  StudentView,
  TutorView,
} from '@/features/dashboard/role-dashboards';

/**
 * One route, four dashboards.
 *
 * Both the chosen role and the subject live in the URL, so a particular view
 * can be linked to and survives a refresh -- which is what makes the admin's
 * "show me what this tutor sees" useful rather than a dead end.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const isAdmin = user?.roles.includes('admin') ?? false;
  const viewingId = params.get('as') ?? undefined;
  const requestedRole = (params.get('role') as UserRole | null) ?? undefined;

  const { data, isPending, isError } = useDashboard({
    ...(requestedRole ? { role: requestedRole } : {}),
    ...(viewingId ? { userId: viewingId } : {}),
  });

  const response = data?.data;
  const subject = response?.subject;

  const roleOptions = useMemo(() => subject?.roles ?? [], [subject]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    // Changing who we are looking at invalidates the chosen role.
    if (key === 'as') next.delete('role');
    setParams(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={subject?.viewing_as_other ? `${subject.full_name}'s dashboard` : 'Dashboard'}
        description={
          subject?.viewing_as_other
            ? 'You are seeing the portal exactly as they see it.'
            : 'Mathematics Institute of the Triangle'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* "Handle cases where a single user could have multiple roles and
                so dashboard should have ability to select the role." */}
            {roleOptions.length > 1 && (
              <Select
                value={response?.role ?? ''}
                onValueChange={(value) => setParam('role', value)}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Dashboard role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {DASHBOARD_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isAdmin && (
              <UserPicker
                value={viewingId ?? null}
                onChange={(next) => setParam('as', next)}
                currentUserId={user?.id}
                selected={
                  subject?.viewing_as_other
                    ? { full_name: subject.full_name, roles: subject.roles }
                    : null
                }
              />
            )}
          </div>
        }
      />

      {subject?.viewing_as_other && (
        <div className="border-primary/30 bg-primary/10 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5">
          <EyeIcon className="size-4 shrink-0" />
          <RoleIcons roles={subject.roles} size="md" />
          <p className="min-w-0 flex-1 text-sm">
            Viewing as <span className="font-medium">{subject.full_name}</span>
            {response && (
              <span className="text-muted-foreground">
                {' '}
                · {DASHBOARD_ROLE_LABELS[response.role]}
              </span>
            )}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setParam('as', null)}>
            <XIcon />
            Back to mine
          </Button>
        </div>
      )}

      {isPending && (
        <p className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your dashboard…
        </p>
      )}

      {isError && (
        <p className="text-destructive py-16 text-sm">Could not load the dashboard.</p>
      )}

      {response?.data.kind === 'admin' && <AdminView data={response.data} />}
      {response?.data.kind === 'tutor' && (
        <TutorView
          data={response.data}
          subjectId={subject?.viewing_as_other ? subject.user_id : undefined}
        />
      )}
      {response?.data.kind === 'parent' && <ParentView data={response.data} />}
      {response?.data.kind === 'student' && <StudentView data={response.data} />}
    </div>
  );
}
