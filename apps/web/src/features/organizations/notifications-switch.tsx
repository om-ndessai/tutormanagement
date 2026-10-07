import { cn } from '@/lib/utils';

/**
 * An on/off switch for an organization's email notifications (Phase 32).
 * A real `role="switch"` button, so it is announced and toggled like one.
 */
export function NotificationsSwitch({
  id,
  checked,
  disabled,
  onCheckedChange,
  label = 'Email notifications',
}: {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'bg-background inline-block size-5 rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
