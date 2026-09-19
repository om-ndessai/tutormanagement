import { Link } from 'react-router-dom';
import { ArrowRightIcon, ShieldCheckIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { USER_STATUS_LABELS } from '@tmi/shared';

import { LogoMark } from '@/components/brand/logo';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers } from '@/features/users/api';

/**
 * Phase 1 dashboard: a welcome panel plus headline counts pulled from the
 * users endpoint. Classes, scheduling and homework land here in later phases.
 */
export function DashboardPage() {
  const all = useUsers({ limit: 1 });
  const admins = useUsers({ role: 'admin', limit: 1 });
  const tutors = useUsers({ role: 'tutor', limit: 1 });
  const invited = useUsers({ status: 'invited', limit: 1 });

  const stats = [
    { label: 'Staff', value: all.data?.meta.total, icon: UsersIcon },
    { label: 'Admins', value: admins.data?.meta.total, icon: ShieldCheckIcon },
    { label: 'Tutors', value: tutors.data?.meta.total, icon: UsersIcon },
    { label: USER_STATUS_LABELS.invited, value: invited.data?.meta.total, icon: UserPlusIcon },
  ];

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
              Manage the people behind the classroom. Start with the staff directory — classes,
              schedules and student records come in the next phase.
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
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" />
                {label}
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
        ))}
      </div>
    </div>
  );
}
