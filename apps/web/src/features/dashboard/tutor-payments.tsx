import { Link } from 'react-router-dom';
import {
  PAYMENT_SOON_DAYS,
  TOPUP_PROJECTION_WEEKS,
  TUTOR_PAYMENT_URGENCIES,
  formatCents,
  topupDueCents,
  tutorAdvanceCents,
  zonedClockParts,
  type TutorPaymentOutlook,
  type TutorPaymentUrgency,
} from '@tmi/shared';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatLessonDay } from '@/features/schedules/lesson-cancellation';
import { cn } from '@/lib/utils';
import { EmptyNote, Panel } from './stat-card';
import { useOrgTimeZone } from '@/providers/auth-provider';

/** The row's colour. The words in Next payment say the same thing. */
const ROW_TONE: Record<TutorPaymentUrgency, string> = {
  past_due: 'bg-destructive/10 hover:bg-destructive/15',
  due_soon: 'bg-warning/20 hover:bg-warning/25',
  on_track: 'bg-success/15 hover:bg-success/20',
};

const DOT_TONE: Record<TutorPaymentUrgency, string> = {
  past_due: 'bg-destructive',
  due_soon: 'bg-warning',
  on_track: 'bg-success',
};

const URGENCY_LABELS: Record<TutorPaymentUrgency, string> = {
  past_due: 'Below top-up',
  due_soon: `Due within ${PAYMENT_SOON_DAYS} days`,
  on_track: 'On track',
};

/** Figures line up on the right; names and the next payment read from the left. */
const COLUMNS = [
  { label: 'Tutor', figure: false },
  { label: 'Balance', figure: true },
  { label: 'From top-up', figure: true },
  { label: 'Top-up', figure: true },
  { label: 'Last paid', figure: true },
  { label: 'Paid on', figure: true },
  { label: 'Next payment', figure: false },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function Muted({ children }: { children: string }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** What the institute owes the tutor, or what they still hold of an advance. */
function Balance({ tutor }: { tutor: TutorPaymentOutlook }) {
  if (tutor.balance_cents === 0) return <Muted>Settled</Muted>;

  const owed = tutor.balance_cents > 0;
  return (
    <span className="tabular-nums">
      <span className="font-medium">{formatCents(Math.abs(tutor.balance_cents))}</span>{' '}
      <Muted>{owed ? 'owed' : 'held'}</Muted>
    </span>
  );
}

/** How much more they can teach before a top-up is due, or how far past it they are. */
function FromTopup({ tutor }: { tutor: TutorPaymentOutlook }) {
  if (tutor.topup_amount_cents == null) return <Muted>—</Muted>;

  const short = topupDueCents(tutor) ?? 0;
  if (short > 0) {
    return (
      <span className="text-destructive font-medium tabular-nums">{formatCents(short)} below</span>
    );
  }

  const above = tutorAdvanceCents(tutor) - tutor.topup_amount_cents;
  if (above === 0) return <span>At top-up</span>;

  return <span className="tabular-nums">{formatCents(above)} above</span>;
}

/** "today", "tomorrow", "in 5 days" -- both dates on the institute's clock. */
function daysAway(date: string, today: string): string {
  const gap = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (gap <= 0) return 'today';
  if (gap === 1) return 'tomorrow';
  return `in ${gap} days`;
}

function NextPayment({ tutor, today }: { tutor: TutorPaymentOutlook; today: string }) {
  // Paid after the work: no level to fall below, just what they are owed.
  if (tutor.topup_amount_cents == null) {
    return tutor.balance_cents > 0 ? (
      <span className="text-warning-foreground dark:text-warning font-medium">Owed now</span>
    ) : (
      <Muted>After lessons</Muted>
    );
  }

  if (tutor.urgency === 'past_due') {
    return <span className="text-destructive font-semibold">Past due</span>;
  }

  if (tutor.next_topup_on) {
    return (
      <span
        className={cn(
          tutor.urgency === 'due_soon' && 'text-warning-foreground dark:text-warning font-medium',
        )}
      >
        {formatLessonDay(tutor.next_topup_on)}
        <span className="text-muted-foreground block text-xs font-normal">
          {daysAway(tutor.next_topup_on, today)}
        </span>
      </span>
    );
  }

  return (
    <Muted>
      {tutor.scheduled_lessons === 0
        ? 'No lessons scheduled'
        : `Not within ${TOPUP_PROJECTION_WEEKS} weeks`}
    </Muted>
  );
}

/** "Sep 28", with the year only when it is not this one. */
function LastPaidOn({ at }: { at: string | null }) {
  if (!at) return <Muted>—</Muted>;

  const paid = new Date(at);
  return (
    <>
      {paid.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(paid.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
      })}
    </>
  );
}

/** The tutor's own Finance tab, as they see it. */
function tutorLink(tutor: TutorPaymentOutlook): string {
  return `/dashboard?as=${tutor.user_id}&role=tutor&tab=finance`;
}

/**
 * Every tutor, and what the office has to pay them next.
 *
 * The admin's one place for "who needs money, and when": what each tutor is
 * owed or still holds, how far that is from their top-up level, when they were
 * last paid, and the day the lessons on their schedule are projected to take
 * them below the level (`next_topup_on`, worked out by the API). Each row is
 * coloured by how pressing it is -- below the level, due within a week, or
 * neither -- and the Next payment column says the same in words, so the colour
 * is never the only way to read it. The API sends the rows most pressing
 * first.
 */
export function TutorPayments({
  tutors,
  index = 0,
}: {
  tutors: TutorPaymentOutlook[];
  index?: number;
}) {
  const today = zonedClockParts(new Date().toISOString(), useOrgTimeZone()).day;

  const counts = Object.fromEntries(
    TUTOR_PAYMENT_URGENCIES.map((urgency) => [
      urgency,
      tutors.filter((tutor) => tutor.urgency === urgency).length,
    ]),
  ) as Record<TutorPaymentUrgency, number>;
  const toRestore = tutors.reduce((sum, tutor) => sum + (topupDueCents(tutor) ?? 0), 0);

  return (
    <Panel index={index} title="Tutor payments" action={{ label: 'Billing', to: '/billing' }}>
      {tutors.length === 0 ? (
        <EmptyNote>No tutors yet.</EmptyNote>
      ) : (
        <>
          <ul className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {TUTOR_PAYMENT_URGENCIES.map((urgency) => (
              <li key={urgency} className="flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-full', DOT_TONE[urgency])} />
                {URGENCY_LABELS[urgency]}
                <span className="text-foreground font-medium tabular-nums">{counts[urgency]}</span>
                {urgency === 'past_due' && toRestore > 0 && (
                  <span className="tabular-nums">· {formatCents(toRestore)} to top up</span>
                )}
              </li>
            ))}
          </ul>

          {/* Phone: a card per tutor, the next payment beside the name. */}
          <ul className="space-y-2 md:hidden">
            {tutors.map((tutor) => (
              <li
                key={tutor.user_id}
                className={cn('rounded-lg border px-3 py-2.5 text-sm', ROW_TONE[tutor.urgency])}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link to={tutorLink(tutor)} className="hover:text-primary font-medium transition-colors">
                    {tutor.full_name}
                  </Link>
                  <div className="text-right">
                    <NextPayment tutor={tutor} today={today} />
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Balance</dt>
                  <dd className="text-right">
                    <Balance tutor={tutor} />
                  </dd>
                  <dt className="text-muted-foreground">From top-up</dt>
                  <dd className="text-right">
                    <FromTopup tutor={tutor} />
                  </dd>
                  <dt className="text-muted-foreground">Top-up</dt>
                  <dd className="text-right tabular-nums">
                    {tutor.topup_amount_cents == null ? (
                      <Muted>None</Muted>
                    ) : (
                      formatCents(tutor.topup_amount_cents)
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Last paid</dt>
                  <dd className="text-right tabular-nums">
                    {tutor.last_paid_cents == null ? (
                      <Muted>Never</Muted>
                    ) : (
                      formatCents(tutor.last_paid_cents)
                    )}
                  </dd>
                  {tutor.last_paid_at && (
                    <>
                      <dt className="text-muted-foreground">Last paid on</dt>
                      <dd className="text-right">
                        <LastPaidOn at={tutor.last_paid_at} />
                      </dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((column) => (
                    <TableHead
                      key={column.label}
                      className={cn('h-8 text-xs', column.figure && 'text-right')}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tutors.map((tutor) => (
                  <TableRow key={tutor.user_id} className={ROW_TONE[tutor.urgency]}>
                    {/* A long name wraps before the table outgrows a small laptop. */}
                    <TableCell className="py-2 font-medium whitespace-normal">
                      <Link to={tutorLink(tutor)} className="hover:text-primary transition-colors">
                        {tutor.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Balance tutor={tutor} />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <FromTopup tutor={tutor} />
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">
                      {tutor.topup_amount_cents == null ? (
                        <Muted>None</Muted>
                      ) : (
                        formatCents(tutor.topup_amount_cents)
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">
                      {tutor.last_paid_cents == null ? (
                        <Muted>Never</Muted>
                      ) : (
                        formatCents(tutor.last_paid_cents)
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <LastPaidOn at={tutor.last_paid_at} />
                    </TableCell>
                    <TableCell className="py-2">
                      <NextPayment tutor={tutor} today={today} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-3 text-xs">
            Held is an advance the tutor has not yet worked off. The next payment is the day their
            scheduled lessons, at their rates and less any cancelled, are projected to take them
            below their top-up, looking {TOPUP_PROJECTION_WEEKS} weeks ahead. A tutor with no
            top-up is paid after lessons.
          </p>
        </>
      )}
    </Panel>
  );
}
