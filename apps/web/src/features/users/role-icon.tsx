import {
  BackpackIcon,
  PresentationIcon,
  ShieldIcon,
  UserIcon,
  UsersRoundIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * One glyph per role, defined once so the dashboard cards, the user picker and
 * anywhere else that shows a role all say the same thing.
 *
 * Chosen for distinct silhouettes at 14px and for meaning what they show:
 *
 *   admin    a shield -- authority over the system. Plain rather than
 *            shield-with-tick, which turns to mush at this size.
 *   tutor    a board on a stand -- someone teaching. A graduation cap says
 *            "graduate", which is the student, not the person paid to teach.
 *   student  a backpack -- one learner's own object. The previous group-of-
 *            people glyph said the opposite of "a single student".
 *   parent   two figures -- a parent is defined by a relationship to a child,
 *            so a pair is the honest shape. A heart-and-handshake read as a
 *            business deal.
 */
export const ROLE_ICONS: Record<UserRole, ComponentType<{ className?: string }>> = {
  admin: ShieldIcon,
  tutor: PresentationIcon,
  student: BackpackIcon,
  parent: UsersRoundIcon,
};

/** Matches the badge colours, so a role reads the same whichever form it takes. */
const ROLE_TONES: Record<UserRole, string> = {
  admin: 'text-brand-700 dark:text-brand-300',
  tutor: 'text-sky-700 dark:text-sky-300',
  student: 'text-emerald-700 dark:text-emerald-300',
  parent: 'text-amber-700 dark:text-amber-300',
};

/**
 * The roles a person holds, as icons.
 *
 * Rendered in the canonical order from USER_ROLES rather than whatever order
 * the API returned, so the same person always looks the same. Each icon
 * carries a title, because a glyph on its own is not an accessible label.
 */
export function RoleIcons({
  roles,
  className,
  size = 'sm',
}: {
  roles: UserRole[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  const ordered = USER_ROLES.filter((role) => roles.includes(role));

  if (ordered.length === 0) {
    return <UserIcon className={cn('text-muted-foreground size-4', className)} aria-hidden />;
  }

  return (
    <span className={cn('flex shrink-0 items-center gap-0.5', className)}>
      {ordered.map((role) => {
        const Icon = ROLE_ICONS[role];

        return (
          <span key={role} title={USER_ROLE_LABELS[role]}>
            <Icon className={cn(size === 'md' ? 'size-4' : 'size-3.5', ROLE_TONES[role])} />
            <span className="sr-only">{USER_ROLE_LABELS[role]}</span>
          </span>
        );
      })}
    </span>
  );
}
