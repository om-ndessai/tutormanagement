import { useEffect, useState } from 'react';
import { CalendarXIcon, Loader2Icon, Undo2Icon } from 'lucide-react';
import {
  formatClockTime,
  type ScheduleCancellation,
  type UpcomingSession,
  type VisibleSchedule,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useScheduleCancellations, useScheduleOccurrences } from './api';
import {
  CancelLessonDialog,
  RestoreLessonDialog,
  cancelledByText,
  formatLessonDay,
  instituteToday,
} from './lesson-cancellation';

/**
 * One series' dates (Phase 24): what is coming, each one cancellable, with
 * the ones already called off shown in place -- struck through, with who and
 * why, and a way to put them back. Past cancellations follow, for the record.
 *
 * Every button here is one the API would honour for this reader: Cancel only
 * when the list says they may cancel at all, Restore only on rows it marks
 * `can_restore`.
 */
export function ScheduleDates({
  schedule,
  highlight,
}: {
  schedule: VisibleSchedule;
  /** A date to pick out, when a link from the dashboard names one. */
  highlight: string | null;
}) {
  const occurrences = useScheduleOccurrences(schedule.id, true);
  const cancellations = useScheduleCancellations({ schedule_id: schedule.id, limit: 50 });
  const [cancelTarget, setCancelTarget] = useState<{ schedule: VisibleSchedule; date: string | null } | null>(
    null,
  );
  const [restoreTarget, setRestoreTarget] = useState<{
    scheduleId: string;
    occursOn: string;
    studentName: string;
  } | null>(null);

  const today = instituteToday();
  const dates = occurrences.data?.pages.flatMap((page) => page.data) ?? [];
  const earlier = (cancellations.data?.data ?? [])
    .filter((row) => row.occurs_on < today)
    .reverse()
    .slice(0, 5);
  const mayCancel = schedule.cancel_as !== null && schedule.is_active;

  // A link can name a date several pages ahead (the sessions page's panel
  // links every cancelled date here): keep paging until it is on screen.
  const lastLoaded = dates.at(-1)?.occurs_on;
  useEffect(() => {
    if (
      highlight &&
      highlight >= today &&
      lastLoaded &&
      highlight > lastLoaded &&
      occurrences.hasNextPage &&
      !occurrences.isFetchingNextPage
    ) {
      void occurrences.fetchNextPage();
    }
  }, [highlight, today, lastLoaded, occurrences]);

  const restore = (row: { occurs_on: string }) =>
    setRestoreTarget({
      scheduleId: schedule.id,
      occursOn: row.occurs_on,
      studentName: schedule.student_name,
    });

  return (
    <div className="border-t pt-3">
      <h3 className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
        Coming dates
      </h3>

      {occurrences.isPending && <Skeleton className="h-24 w-full rounded-md" />}

      {!occurrences.isPending && dates.length === 0 && (
        <p className="text-muted-foreground py-2 text-xs">No more lessons in this series.</p>
      )}

      <ul className="divide-border divide-y">
        {dates.map((date) => (
          <DateRow
            key={date.occurs_on}
            date={date}
            highlighted={date.occurs_on === highlight}
            onCancel={
              mayCancel
                ? () => setCancelTarget({ schedule, date: date.occurs_on })
                : undefined
            }
            onRestore={date.cancellation?.can_restore ? () => restore(date) : undefined}
          />
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {occurrences.hasNextPage && (
          <Button
            variant="ghost"
            size="xs"
            disabled={occurrences.isFetchingNextPage}
            onClick={() => void occurrences.fetchNextPage()}
          >
            {occurrences.isFetchingNextPage && <Loader2Icon className="animate-spin" />}
            Show later dates
          </Button>
        )}
        {mayCancel && (
          <Button
            variant="ghost"
            size="xs"
            className="sm:ml-auto"
            onClick={() => setCancelTarget({ schedule, date: null })}
          >
            <CalendarXIcon />
            Cancel another date…
          </Button>
        )}
      </div>

      {earlier.length > 0 && (
        <>
          <h3 className="text-muted-foreground mt-3 mb-1 text-[11px] font-medium tracking-wide uppercase">
            Earlier cancelled dates
          </h3>
          <ul className="divide-border divide-y">
            {earlier.map((row) => (
              <PastCancellationRow
                key={row.occurs_on}
                row={row}
                highlighted={row.occurs_on === highlight}
                onRestore={row.can_restore ? () => restore(row) : undefined}
              />
            ))}
          </ul>
        </>
      )}

      <CancelLessonDialog target={cancelTarget} onClose={() => setCancelTarget(null)} />
      <RestoreLessonDialog target={restoreTarget} onClose={() => setRestoreTarget(null)} />
    </div>
  );
}

function DateRow({
  date,
  highlighted,
  onCancel,
  onRestore,
}: {
  date: UpcomingSession;
  highlighted: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
}) {
  const cancelled = date.cancellation;
  const day = formatLessonDay(date.occurs_on);

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 py-2',
        highlighted && 'bg-accent/60 -mx-2 rounded-md px-2',
      )}
      data-cancelled={cancelled ? 'true' : undefined}
    >
      <span
        className={cn(
          'w-24 shrink-0 text-sm tabular-nums',
          cancelled && 'text-muted-foreground line-through',
        )}
      >
        {day}
      </span>

      {cancelled ? (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Cancelled
          </Badge>
          <span className="text-muted-foreground text-xs">
            {cancelledByText(cancelled.cancelled_by_name, cancelled.cancelled_as)}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatClockTime(date.start_time)}–{formatClockTime(date.end_time)}
        </span>
      )}

      <span className="ml-auto">
        {cancelled
          ? onRestore && (
              <Button variant="ghost" size="xs" onClick={onRestore} aria-label={`Restore the lesson on ${day}`}>
                <Undo2Icon />
                Restore
              </Button>
            )
          : onCancel && (
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={onCancel}
                aria-label={`Cancel the lesson on ${day}`}
              >
                <CalendarXIcon />
                {/* Icon-only on a phone, so each date stays on one line. */}
                <span className="max-sm:sr-only">Cancel</span>
              </Button>
            )}
      </span>

      {cancelled?.note && (
        <p className="text-muted-foreground w-full text-xs whitespace-pre-wrap sm:pl-27">
          {cancelled.note}
        </p>
      )}
    </li>
  );
}

function PastCancellationRow({
  row,
  highlighted,
  onRestore,
}: {
  row: ScheduleCancellation;
  highlighted: boolean;
  onRestore?: () => void;
}) {
  const day = formatLessonDay(row.occurs_on);

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 py-2',
        highlighted && 'bg-accent/60 -mx-2 rounded-md px-2',
      )}
    >
      <span className="text-muted-foreground w-24 shrink-0 text-sm tabular-nums line-through">{day}</span>
      <span className="text-muted-foreground text-xs">
        {cancelledByText(row.cancelled_by_name, row.cancelled_as)}
      </span>
      <span className="ml-auto">
        {onRestore && (
          <Button variant="ghost" size="xs" onClick={onRestore} aria-label={`Restore the lesson on ${day}`}>
            <Undo2Icon />
            Restore
          </Button>
        )}
      </span>
      {row.note && (
        <p className="text-muted-foreground w-full text-xs whitespace-pre-wrap sm:pl-27">{row.note}</p>
      )}
    </li>
  );
}
