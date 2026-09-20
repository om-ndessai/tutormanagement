import {
  KeyRoundIcon,
  LogInIcon,
  LogOutIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserPlusIcon,
  UserXIcon,
  PencilIcon,
  RotateCcwIcon,
  ActivityIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { AUDIT_ACTION_LABELS, formatRelativeTime, type AuditEvent } from '@tmi/shared';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A glyph per action, so a long feed can be scanned by shape before it is read.
 * Falls back to a generic marker rather than breaking on an action added later.
 */
const ACTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'auth.signed_in': LogInIcon,
  'auth.signed_out': LogOutIcon,
  'auth.denied': ShieldAlertIcon,
  'user.created': UserPlusIcon,
  'user.updated': PencilIcon,
  'user.roles_changed': KeyRoundIcon,
  'user.deactivated': UserXIcon,
  'user.restored': RotateCcwIcon,
  'user.deleted': Trash2Icon,
};

/** Actions worth noticing at a glance get a colour; routine ones stay neutral. */
const ACTION_TONE: Record<string, string> = {
  'auth.denied': 'bg-destructive/10 text-destructive',
  'user.deleted': 'bg-destructive/10 text-destructive',
  'user.deactivated': 'bg-warning/15 text-warning-foreground dark:text-warning',
  'user.roles_changed': 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
  'user.created': 'bg-success/15 text-success',
};

function absoluteTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ActivityFeed({
  events,
  isLoading,
  emptyMessage = 'No activity recorded yet.',
  /** Hide the actor when the feed is already filtered to one person. */
  showActor = true,
}: {
  events: AuditEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  showActor?: boolean;
}) {
  if (isLoading) {
    return (
      <ul className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1">
      {events.map((event) => {
        const Icon = ACTION_ICONS[event.action] ?? ActivityIcon;

        return (
          <li key={event.id} className="hover:bg-accent/40 flex gap-3 rounded-md px-2 py-2.5">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                ACTION_TONE[event.action] ?? 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{event.description}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {showActor && <span className="font-medium">{event.actor_name}</span>}
                {showActor && ' · '}
                <span>{AUDIT_ACTION_LABELS[event.action as never] ?? event.action}</span>
                {' · '}
                <time dateTime={event.created_at} title={absoluteTime(event.created_at)}>
                  {formatRelativeTime(event.created_at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
