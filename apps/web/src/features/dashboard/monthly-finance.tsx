import {
  formatCents,
  formatMonthShort,
  monthlyNetCents,
  type MonthlyFinanceResponse,
  type MonthlyFinanceRow,
} from '@tmi/shared';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Panel } from './stat-card';

/** Hours to one decimal: "116.5", never a rounded-away quarter. */
function hours(minutes: number): string {
  return minutes === 0 ? '—' : (minutes / 60).toFixed(1);
}

function money(cents: number | null): string {
  if (cents === null) return '—';
  return cents === 0 ? '—' : formatCents(cents);
}

/**
 * The financial year, month by month.
 *
 * Lessons are counted in the month they were TAUGHT and payments in the month
 * the money MOVED, which is why billed and received sit side by side rather
 * than being reconciled into one figure: the gap between them is what the
 * institute is still owed, and it is invisible in either column alone.
 *
 * A tutor sees their own teaching and their own pay. The family side is not
 * theirs to see, and the columns are simply absent rather than blanked.
 */
export function MonthlyFinance({
  data,
  isLoading,
  index = 0,
}: {
  data: MonthlyFinanceResponse | undefined;
  isLoading: boolean;
  index?: number;
}) {
  const institute = data?.scope === 'institute';

  // Months with nothing in them are dropped once the year is under way, so a
  // January-to-December skeleton does not bury three months of real figures.
  const months = (data?.months ?? []).filter(
    (row) =>
      row.session_count > 0 ||
      row.paid_to_tutors_cents > 0 ||
      (row.received_from_families_cents ?? 0) > 0,
  );

  const totals = months.reduce<MonthlyFinanceRow>(
    (sum, row) => ({
      month: 'total',
      session_count: sum.session_count + row.session_count,
      minutes: sum.minutes + row.minutes,
      billed_cents:
        row.billed_cents === null ? null : (sum.billed_cents ?? 0) + row.billed_cents,
      received_from_families_cents:
        row.received_from_families_cents === null
          ? null
          : (sum.received_from_families_cents ?? 0) + row.received_from_families_cents,
      earned_cents: sum.earned_cents + row.earned_cents,
      paid_to_tutors_cents: sum.paid_to_tutors_cents + row.paid_to_tutors_cents,
    }),
    {
      month: 'total',
      session_count: 0,
      minutes: 0,
      billed_cents: institute ? 0 : null,
      received_from_families_cents: institute ? 0 : null,
      earned_cents: 0,
      paid_to_tutors_cents: 0,
    },
  );

  const columns = institute
    ? ['Month', 'Sessions', 'Hours', 'Billed', 'Received', 'Tutor cost', 'Net']
    : ['Month', 'Sessions', 'Hours', 'Earned', 'Paid to you'];

  const cells = (row: MonthlyFinanceRow) =>
    institute
      ? [
          String(row.session_count || '—'),
          hours(row.minutes),
          money(row.billed_cents),
          money(row.received_from_families_cents),
          money(row.earned_cents),
          money(monthlyNetCents(row)),
        ]
      : [
          String(row.session_count || '—'),
          hours(row.minutes),
          money(row.earned_cents),
          money(row.paid_to_tutors_cents),
        ];

  return (
    <Panel
      index={index}
      title={`${data?.year ?? ''} month by month`}
      action={{ label: 'Billing', to: '/billing' }}
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : months.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nothing recorded in {data?.year} yet.
        </p>
      ) : (
        <>
          {/* Phone: one line per month, the two figures that matter most. */}
          <ul className="divide-border divide-y sm:hidden">
            {months.map((row) => (
              <li key={row.month} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-medium">{formatMonthShort(row.month)}</span>
                <span className="text-muted-foreground text-xs">
                  {row.session_count} sessions · {hours(row.minutes)} hrs
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {institute ? money(monthlyNetCents(row)) : money(row.earned_cents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((column, position) => (
                    <TableHead
                      key={column}
                      className={cn('h-8 text-xs', position > 0 && 'text-right')}
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="py-2 font-medium">
                      {formatMonthShort(row.month)}
                    </TableCell>
                    {cells(row).map((cell, position) => (
                      <TableCell
                        key={position}
                        className={cn(
                          'py-2 text-right tabular-nums',
                          // The last column is the point of the table.
                          position === cells(row).length - 1 && 'font-semibold',
                        )}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                <TableRow className="border-t-2 hover:bg-transparent">
                  <TableCell className="py-2 font-semibold">Year</TableCell>
                  {cells(totals).map((cell, position) => (
                    <TableCell
                      key={position}
                      className="py-2 text-right font-semibold tabular-nums"
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-3 text-xs">
            {institute
              ? 'Lessons count in the month they were taught; payments in the month the money moved. Net is what was billed for the month’s lessons, less what the tutors earned for them.'
              : 'Lessons count in the month you taught them; payments in the month you were paid.'}
          </p>
        </>
      )}
    </Panel>
  );
}
