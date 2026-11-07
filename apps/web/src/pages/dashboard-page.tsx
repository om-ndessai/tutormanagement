import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CompassIcon, EyeIcon, Loader2Icon, XIcon } from 'lucide-react';
import {
  DASHBOARD_ROLE_LABELS,
  USER_ROLES,
  dashboardRoleForHat,
  featureOn,
  orderHats,
  type ApiOk,
  type MemberHome,
  type UserRole,
} from '@tmi/shared';

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
import { useBrand } from '@/providers/brand-provider';
import { ApiRequestError } from '@/lib/api-client';
import { useDashboard } from '@/features/dashboard/api';
import { memberHomeKey } from '@/features/home/api';
import { useOnboarding } from '@/features/onboarding/onboarding-provider';
import { UserPicker } from '@/features/dashboard/user-picker';
import { RoleIcons } from '@/features/users/role-icon';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
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
/**
 * Phase 50: the dashboard belongs to Tutoring. A space without it gets the Assessment home, and
 * never calls /dashboard (which answers 403 there).
 */
export function DashboardPage() {
  const { organization } = useAuth();
  // Phase 66: the member home (/) leads; this page is the role dashboards, Tutoring's. A space
  // without Tutoring has none: its home is everything.
  if (!featureOn(organization, 'tutoring')) return <Navigate to="/" replace />;
  return <TutoringDashboard />;
}

const NO_ROLES: readonly UserRole[] = [];

/** Phase 74 (JF24): the role last chosen on the Dashboard, per space, on this device. */
const roleKey = (space: string | undefined) => `aimtrue.dashboard-role.${space ?? ''}`;

function readRole(space: string | undefined): UserRole | null {
  try {
    const role = localStorage.getItem(roleKey(space));
    return role && (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : null;
  } catch {
    return null;
  }
}

function rememberRole(space: string | undefined, role: UserRole): void {
  try {
    localStorage.setItem(roleKey(space), role);
  } catch {
    // Storage blocked: the choice lasts while the URL carries it.
  }
}

/** The dashboard role matching the hat a home leads with, if the person holds it. */
function roleForHome(home: MemberHome, roles: readonly UserRole[]): UserRole | undefined {
  const lead = orderHats(home)[0];
  const role = lead ? dashboardRoleForHat(lead) : undefined;
  return role && roles.includes(role) ? role : undefined;
}

/**
 * Phase 74 (JF24): the role the Dashboard opens on when the URL names none -- the one last chosen here on this device,
 * else the one matching the hat the home leads with, from the home already read (no request of its own), else the
 * server's. Decided once per visit, so a home refreshed meanwhile does not switch the view under the reader.
 */
function useOpeningRole(roles: readonly UserRole[]): UserRole | undefined {
  const { organization } = useAuth();
  const client = useQueryClient();
  const [role] = useState<UserRole | undefined>(() => {
    const remembered = readRole(organization?.slug);
    if (remembered && roles.includes(remembered)) return remembered;
    const cached = client.getQueryData<ApiOk<MemberHome>>(memberHomeKey)?.data;
    return cached ? roleForHome(cached, roles) : undefined;
  });
  return role;
}

function TutoringDashboard() {
  const brand = useBrand();
  const { user, organization } = useAuth();
  const [params, setParams] = useSearchParams();

  const isAdmin = user?.roles.includes('admin') ?? false;
  const viewingId = params.get('as') ?? undefined;
  // Someone else's dashboard opens on the server's choice for them; one's own, on the opening role (JF24).
  const opening = useOpeningRole(user?.roles ?? NO_ROLES);
  const requestedRole = (params.get('role') as UserRole | null) ?? (viewingId ? undefined : opening);

  const { data, isPending, isError, error } = useDashboard({
    ...(requestedRole ? { role: requestedRole } : {}),
    ...(viewingId ? { userId: viewingId } : {}),
  });

  const response = data?.data;
  const subject = response?.subject;

  const roleOptions = useMemo(() => subject?.roles ?? [], [subject]);

  // The tour describes the dashboard on screen: this role's, and never while
  // looking at somebody else's.
  const { openWizard, setDashboardRole } = useOnboarding();
  const shownRole = subject?.viewing_as_other ? null : (response?.role ?? null);
  useEffect(() => {
    setDashboardRole(shownRole);
    return () => setDashboardRole(null);
  }, [shownRole, setDashboardRole]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    // Changing who we are looking at invalidates the chosen role.
    if (key === 'as') next.delete('role');
    setParams(next, { replace: true });
  }

  function chooseRole(role: UserRole) {
    // Remembered for this space when it is one's own dashboard (JF24).
    if (!viewingId) rememberRole(organization?.slug, role);
    setParam('role', role);
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Phase 33: a lesson about to start, where its locations ask for a reminder. Never while viewing someone else. */}
      {!viewingId && <LessonReminderSheet />}
      <PageHeader
        title={subject?.viewing_as_other ? `${subject.full_name}'s dashboard` : 'Dashboard'}
        description={
          subject?.viewing_as_other
            ? 'You are seeing this exactly as they see it.'
            : brand.name
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Phase 26: the welcome wizard and tour, on demand -- never for a member (Phase 79), who has no tour. */}
            {!subject?.viewing_as_other && (user?.roles.length ?? 0) > 0 && (
              <Button variant="outline" onClick={openWizard} data-tour="getting-started">
                <CompassIcon />
                Getting started
              </Button>
            )}

            {/* "Handle cases where a single user could have multiple roles and
                so dashboard should have ability to select the role." */}
            {roleOptions.length > 1 && (
              // Phase 74 (JF24): the switch says what it is -- "Viewing as: Tutor".
              <div className="flex w-full items-center gap-2 sm:w-auto" data-testid="dashboard-viewing-as">
                <span id="dashboard-role-label" className="text-muted-foreground shrink-0 text-sm font-medium">
                  Viewing as
                </span>
                <Select value={response?.role ?? ''} onValueChange={(value) => chooseRole(value as UserRole)}>
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
              </div>
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
        // Phase 79 (M2): a member reached here by a link reads the server's words ("... is a member here").
        <p className="text-destructive py-16 text-sm" data-testid="dashboard-error">
          {error instanceof ApiRequestError && error.status === 409 ? error.message : 'Could not load the dashboard.'}
        </p>
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
