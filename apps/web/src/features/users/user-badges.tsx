import {
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Each role gets its own hue so a row's roles are scannable at a glance. All
 * four are brand-adjacent rather than a rainbow: admin carries the brand
 * purple, the rest sit around it.
 */
const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
  tutor: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200',
  student: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200',
  parent: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-success/15 text-success dark:text-success',
  invited: 'bg-warning/20 text-warning-foreground dark:bg-warning/20 dark:text-warning',
  suspended: 'bg-destructive/15 text-destructive',
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', ROLE_STYLES[role], className)}>
      {USER_ROLE_LABELS[role]}
    </Badge>
  );
}

/**
 * A user holds one or more roles, so the table shows a set. Rendered in the
 * canonical order from USER_ROLES, not the order the database returned.
 */
export function RoleBadges({ roles, className }: { roles: UserRole[]; className?: string }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground text-xs">No role</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {roles.map((role) => (
        <RoleBadge key={role} role={role} />
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_STYLES[status])}>
      {USER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DeletedBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground border-dashed">
      Deactivated
    </Badge>
  );
}

/**
 * Somebody's email, or a plain statement that they have none.
 *
 * Most students are children who never sign in, so an absent address is
 * ordinary rather than missing data -- it should not read as a gap, and it
 * must never become a mailto: pointing at the word "null".
 */
export function EmailOrNone({
  email,
  className,
  link = true,
}: {
  email: string | null;
  className?: string;
  link?: boolean;
}) {
  if (!email) {
    return <span className={cn('text-muted-foreground', className)}>No email</span>;
  }

  if (!link) return <span className={className}>{email}</span>;

  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
