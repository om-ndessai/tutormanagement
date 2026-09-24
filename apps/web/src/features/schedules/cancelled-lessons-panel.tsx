import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Undo2Icon } from 'lucide-react';
import { formatClockTime, type ScheduleCancellation } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useScheduleCancellations } from './api';
import {
  RestoreLessonDialog,
  cancelledByText,
  formatLessonDay,
  instituteToday,
  shiftDay,
} from './lesson-cancellation';

const SHOWN = 8;

/**
 * Lessons of the reader's schedules that were called off (Phase 24): the
 * ones coming up first, then the last four weeks. For the sessions page's
 * Tutoring tab, beside the lessons that did happen -- a cancelled one is why
 * a week has no entry in the log.
 *
 * Only the schedules the reader can list, so only their own lessons or their
 * family's; renders nothing when there are none.
 */
export function CancelledLessonsPanel() {
  const today = instituteToday();
  const { data } = useScheduleCancellations({ from: shiftDay(today, -28), limit: 100 });
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState<{
    scheduleId: string;
    occursOn: string;
    studentName: string;
  } | null>(null);

  const rows = data?.data ?? [];
  if (rows.length === 0) return null;

  const upcoming = rows.filter((row) => row.occurs_on >= today);
  const earlier = rows.filter((row) => row.occurs_on < today).reverse();
  const ordered = [...upcoming, ...earlier];
  const shown = expanded ? ordered : ordered.slice(0, SHOWN);

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold">
            Cancelled lessons
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              Called off from the schedule, so not counted as missed
            </span>
          </h2>

          <ul className="divide-border divide-y">
            {shown.map((row) => (
              <CancelledRow
                key={`${row.schedule_id}-${row.occurs_on}`}
                row={row}
                upcoming={row.occurs_on >= today}
                onRestore={
                  row.can_restore
                    ? () =>
                        setRestoring({
                          scheduleId: row.schedule_id,
                          occursOn: row.occurs_on,
                          studentName: row.student_name,
                        })
                    : undefined
                }
              />
            ))}
          </ul>

          {ordered.length > SHOWN && (
            <Button variant="ghost" size="xs" className="mt-2" onClick={() => setExpanded((open) => !open)}>
              {expanded ? 'Show fewer' : `Show all ${ordered.length}`}
            </Button>
          )}
        </CardContent>
      </Card>

      <RestoreLessonDialog target={restoring} onClose={() => setRestoring(null)} />
    </>
  );
}

function CancelledRow({
  row,
  upcoming,
  onRestore,
}: {
  row: ScheduleCancellation;
  upcoming: boolean;
  onRestore?: () => void;
}) {
  const day = formatLessonDay(row.occurs_on);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm">
          <Link
            to={`/schedule?focus=${row.schedule_id}&on=${row.occurs_on}`}
            className="font-medium hover:underline"
          >
            {row.student_name}
          </Link>
          <span className="text-muted-foreground"> with {row.tutor_name}</span>
          {upcoming && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              Upcoming
            </Badge>
          )}
        </span>
        <span className="text-muted-foreground text-xs">
          <span className="line-through">
            {day} · {formatClockTime(row.start_time)}–{formatClockTime(row.end_time)}
          </span>{' '}
          · cancelled {cancelledByText(row.cancelled_by_name, row.cancelled_as)}
        </span>
        {row.note && <span className="text-muted-foreground block text-xs">{row.note}</span>}
      </span>

      {onRestore && (
        <Button variant="ghost" size="sm" onClick={onRestore} aria-label={`Restore the lesson on ${day}`}>
          <Undo2Icon />
          Restore
        </Button>
      )}
    </li>
  );
}
