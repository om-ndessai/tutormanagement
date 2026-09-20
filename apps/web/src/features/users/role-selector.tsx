import {
  USER_ROLES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  type UserRole,
} from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * Roles are a set, not a choice: the plan's whole point is that one person can
 * be a parent who tutors, or a senior student who teaches younger children.
 * Checkboxes rather than a dropdown make that obvious in the UI.
 */
export function RoleSelector({
  value,
  onChange,
  error,
}: {
  value: UserRole[];
  onChange: (roles: UserRole[]) => void;
  error?: string;
}) {
  function toggle(role: UserRole) {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  }

  return (
    <div className="grid gap-2">
      <span className={cn('text-sm font-medium', error && 'text-destructive')}>Roles</span>

      <div className="grid gap-2 sm:grid-cols-2">
        {USER_ROLES.map((role) => {
          const checked = value.includes(role);

          return (
            <label
              key={role}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors',
                checked ? 'border-primary bg-accent/50' : 'hover:bg-accent/30',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(role)}
                className="accent-primary mt-0.5 size-4"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{USER_ROLE_LABELS[role]}</span>
                <span className="text-muted-foreground block text-xs">
                  {USER_ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
