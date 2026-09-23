import { Link } from 'react-router-dom';
import type { ProgressOverview } from '@tmi/shared';

import { cn } from '@/lib/utils';
import { ProgressStatusBadge } from './rating';

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A meter: how much of the plan is mastered, with a tick where the pace line
 * says it should be by today. Filled and unfilled are steps of the one brand
 * ramp, so the bar reads as a single quantity.
 */
export function ProgressMeter({
  percent,
  expected,
  className,
}: {
  percent: number;
  expected: number;
  className?: string;
}) {
  return (
    <div
      className={cn('bg-brand-100 dark:bg-brand-950 relative h-2 w-full rounded-full', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${percent}% mastered, ${expected}% expected by now`}
    >
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }}
      />
      {expected > 0 && expected < 100 && (
        <span
          className="bg-foreground/60 absolute -top-1 h-4 w-0.5 rounded"
          style={{ left: `calc(${expected}% - 1px)` }}
          title={`Expected by now: ${expected}%`}
        />
      )}
    </div>
  );
}

/**
 * One line per student: goal, status, and how far along. Shared by the
 * progress page and the dashboards so a student reads the same everywhere.
 */
export function ProgressList({
  rows,
  empty,
  limit,
}: {
  rows: ProgressOverview[];
  empty: string;
  limit?: number;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>;
  }

  return (
    <ul className="divide-border divide-y">
      {(limit ? rows.slice(0, limit) : rows).map((row) => (
        <li key={row.student_user_id}>
          <Link
            to={`/progress/${row.student_user_id}`}
            className="hover:bg-accent/40 -mx-2 grid gap-2 rounded-md px-2 py-2.5 transition-colors sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center sm:gap-4"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{row.student_name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {row.goal
                  ? `${row.goal}${row.target_on ? ` · by ${shortDate(row.target_on)}` : ''}`
                  : row.last_assessed_on
                    ? `Assessed ${shortDate(row.last_assessed_on)} · no plan yet`
                    : 'Not assessed yet'}
              </span>
            </span>

            {row.summary.topic_count > 0 ? (
              <span className="flex items-center gap-2">
                <ProgressMeter percent={row.summary.percent} expected={row.summary.expected_percent} />
                <span className="w-9 text-right text-xs font-medium tabular-nums">
                  {row.summary.percent}%
                </span>
              </span>
            ) : (
              <span className="hidden sm:block" />
            )}

            <span className="sm:justify-self-end">
              <ProgressStatusBadge status={row.summary.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
