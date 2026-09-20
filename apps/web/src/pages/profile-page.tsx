import { CalendarClockIcon, MailIcon, PhoneIcon, ShieldIcon, TriangleAlertIcon } from 'lucide-react';
import { USER_ROLE_LABELS } from '@tmi/shared';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { RoleBadge, StatusBadge } from '@/features/users/user-badges';
import { useAuth } from '@/providers/auth-provider';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Renders an ISO-8601 UTC timestamp in the viewer's own locale and zone. */
function formatTimestamp(value: string | null, fallback: string) {
  if (!value) return fallback;

  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Where a successful Google sign-in lands: the portal's own record of the
 * person whose email matched the Google account.
 */
export function ProfilePage() {
  const { user, impersonated } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My profile"
        description="How the Mathematics Institute of the Triangle has you on file."
      />

      {impersonated && (
        <div className="border-warning/40 bg-warning/10 mb-6 flex items-start gap-2 rounded-md border p-3">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Authentication is switched off</p>
            <p className="text-muted-foreground mt-1 text-xs">
              The API is running with <code className="font-mono">AUTH_ENABLED=false</code> and
              treating every request as {user.full_name}. Turn it back on before deploying.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden
              className="bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200 font-display flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
            >
              {initials(user.full_name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">{user.full_name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>
            </div>
          </div>

          <dl className="grid gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-2">
            <Detail icon={<MailIcon className="size-4" />} label="Email">
              <a href={`mailto:${user.email}`} className="hover:text-primary break-all">
                {user.email}
              </a>
            </Detail>

            <Detail icon={<PhoneIcon className="size-4" />} label="Phone">
              {user.phone ?? <span className="text-muted-foreground">Not recorded</span>}
            </Detail>

            <Detail icon={<ShieldIcon className="size-4" />} label="Role">
              {USER_ROLE_LABELS[user.role]}
            </Detail>

            <Detail icon={<CalendarClockIcon className="size-4" />} label="Last sign-in">
              {formatTimestamp(user.last_login_at, 'This is your first sign-in')}
            </Detail>

            <Detail icon={<CalendarClockIcon className="size-4" />} label="Added to the portal">
              {formatTimestamp(user.created_at, '—')}
            </Detail>
          </dl>

          <p className="text-muted-foreground border-t pt-4 text-xs">
            Something wrong here? Ask an administrator to update your record.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}
