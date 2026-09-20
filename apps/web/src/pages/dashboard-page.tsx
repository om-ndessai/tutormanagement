import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { USER_ROLE_LABELS, type UserRole } from '@tmi/shared';

import { LogoMark } from '@/components/brand/logo';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers } from '@/features/users/api';

const ROLE_ICONS: Record<UserRole, typeof UsersIcon> = {
  admin: ShieldCheckIcon,
  tutor: GraduationCapIcon,
  student: UsersIcon,
  parent: HeartHandshakeIcon,
};

/**
 * Counts come from the list endpoint's `meta.total` with `limit: 1`, so each
 * card costs a COUNT rather than fetching rows. Because a person can hold
 * several roles, these deliberately overlap and do not sum to the total.
 */
function useRoleCount(role: UserRole) {
  return useUsers({ role, limit: 1 }).data?.meta.total;
}

export function DashboardPage() {
  const total = useUsers({ limit: 1 }).data?.meta.total;

  const counts: Record<UserRole, number | undefined> = {
    admin: useRoleCount('admin'),
    tutor: useRoleCount('tutor'),
    student: useRoleCount('student'),
    parent: useRoleCount('parent'),
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dashboard" description="Mathematics Institute of the Triangle" />

      <Card className="brand-gradient mb-6 border-transparent text-white">
        <CardContent className="flex flex-wrap items-center gap-6">
          <LogoMark className="size-16 shrink-0 drop-shadow-lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-white">
              Exploring the fun of Math
            </h2>
            <p className="mt-1 max-w-prose text-sm text-white/85">
              {total === undefined ? 'Loading the directory…' : `${total} people on file.`} Classes
              and scheduling come in a later phase.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/users">
              Manage users
              <ArrowRightIcon />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(counts) as UserRole[]).map((role) => {
          const Icon = ROLE_ICONS[role];
          const value = counts[role];

          return (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" />
                  {USER_ROLE_LABELS[role]}s
                </CardTitle>
              </CardHeader>
              <CardContent>
                {value === undefined ? (
                  <Skeleton className="h-9 w-12" />
                ) : (
                  <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        A person can hold more than one role, so these counts overlap.
      </p>
    </div>
  );
}
