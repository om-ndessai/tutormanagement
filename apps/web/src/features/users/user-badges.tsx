import {
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
  tutor: 'bg-secondary text-secondary-foreground',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-success/15 text-success dark:text-success',
  invited: 'bg-warning/20 text-warning-foreground dark:bg-warning/20 dark:text-warning',
  suspended: 'bg-destructive/15 text-destructive',
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', ROLE_STYLES[role])}>
      {USER_ROLE_LABELS[role]}
    </Badge>
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
