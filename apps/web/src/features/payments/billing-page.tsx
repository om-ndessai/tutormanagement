import { useState, type ReactNode } from 'react';
import { DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_FORM_LABELS,
  formatCents,
  topupDueCents,
  tutorAdvanceCents,
  type Payment,
  type TutorBalance,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { PaymentDialog } from './payment-dialog';
import { useBalances, useDeletePayment, usePayments } from './api';

/**
 * Balances and the payment log on one screen, because the log is only
 * meaningful as the explanation of the balances above it.
 */
export function BillingPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<Payment | null>(null);

  const balances = useBalances();
  const payments = usePayments({ limit: 50 });
  const remove = useDeletePayment();

  const data = balances.data?.data;

  async function confirmRemove() {
    if (!removing) return;

    try {
      await remove.mutateAsync(removing.id);
      toast.success('Payment deleted.');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not delete the payment.',
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Billing"
        description="No money moves through the portal. This tracks what is owed and what has been paid."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <a href="/api/payments/export.csv" download>
                <DownloadIcon />
                CSV
              </a>
            </Button>

            {/* What each tutor was PAID in the year, and whether the office
                holds their SSN -- the two things a year-end tax document
                needs. The number itself is in neither this file nor the
                database it comes from. */}
            {isAdmin && (
              <Button variant="outline" asChild>
                <a
                  href={`/api/payments/tax-summary.csv?year=${new Date().getFullYear()}`}
                  download
                >
                  <DownloadIcon />
                  Tax summary
                </a>
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon />
                Record a payment
              </Button>
            )}
          </div>
        }
      />

      {isAdmin && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HeadlineTile
            label="Owed to tutors"
            cents={data?.totals.owed_to_tutors_cents}
            tone="warning"
          />
          <HeadlineTile
            label="Owed by families"
            cents={data?.totals.owed_by_families_cents}
            tone="brand"
          />
          {/* What it would take to put every tutor on an advance back at their
              agreed level. Zero is the resting state, and worth showing: it
              says the advances have been kept up, not that nobody is on one. */}
          <HeadlineTile
            label="Top-ups due"
            cents={data?.totals.topups_due_cents ?? 0}
            tone="warning"
          />
        </div>
      )}

      {(data?.tutors.length ?? 0) > 0 && (
        <LedgerTable
          title="Tutors"
          caption="What each tutor has earned, and what they have been paid."
          columns={['Tutor', 'Sessions', 'Earned', 'Paid', 'Advance held', 'Owed']}
          rows={(data?.tutors ?? []).map((tutor) => {
            const due = topupDueCents(tutor);

            return {
              key: tutor.user_id,
              cells: [
                tutor.full_name,
                String(tutor.session_count),
                formatCents(tutor.earned_cents),
                formatCents(tutor.paid_cents),
                <AdvanceCell key="advance" tutor={tutor} />,
              ],
              summary:
                `${tutor.session_count} sessions · ${formatCents(tutor.earned_cents)} earned · ` +
                `${formatCents(tutor.paid_cents)} paid` +
                (tutor.topup_amount_cents == null
                  ? ''
                  : ` · holds ${formatCents(tutorAdvanceCents(tutor))} of ` +
                    `${formatCents(tutor.topup_amount_cents)}`) +
                (due && due > 0 ? ` · top up ${formatCents(due)}` : ''),
              balance: tutor.balance_cents,
            };
          })}
          isLoading={balances.isPending}
        />
      )}

      {(data?.students.length ?? 0) > 0 && (
        <LedgerTable
          title="Families"
          caption="Charges follow the student; any of their guardians may pay."
          columns={['Student', 'Guardians', 'Charged', 'Paid', 'Outstanding']}
          rows={(data?.students ?? []).map((student) => ({
            key: student.student_user_id,
            cells: [
              student.student_name,
              student.guardians.map((g) => g.full_name).join(', ') || '—',
              formatCents(student.charged_cents),
              formatCents(student.paid_cents),
            ],
            summary: `${student.guardians.map((g) => g.full_name).join(', ') || 'No guardian'} · ${formatCents(student.charged_cents)} charged · ${formatCents(student.paid_cents)} paid`,
            balance: student.balance_cents,
          }))}
          isLoading={balances.isPending}
        />
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold">Payments</h2>

      {/* Phone: stacked payment cards. */}
      <ul className="border-border bg-card divide-border divide-y rounded-lg border sm:hidden">
        {(payments.data?.data ?? []).map((payment) => (
          <li key={payment.id} className="flex items-start gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{payment.party_name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {payment.direction === 'from_parent' ? 'Received' : 'Paid out'}
                {payment.student_name ? ` · for ${payment.student_name}` : ''}
              </span>
              <span className="text-muted-foreground block text-xs">
                {new Date(payment.paid_at).toLocaleDateString(undefined, { dateStyle: 'medium' })} ·{' '}
                {PAYMENT_FORM_LABELS[payment.method]}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCents(payment.amount_cents)}
            </span>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${PAYMENT_DIRECTION_LABELS[payment.direction]}`}
                onClick={() => setRemoving(payment)}
              >
                <Trash2Icon />
              </Button>
            )}
          </li>
        ))}
        {!payments.isPending && (payments.data?.data.length ?? 0) === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">
            No payments recorded yet.
          </li>
        )}
      </ul>

      <div className="border-border bg-card hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>When</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>For</TableHead>
              <TableHead>Form</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.isPending && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}

            {!payments.isPending && (payments.data?.data.length ?? 0) === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
                </TableCell>
              </TableRow>
            )}

            {(payments.data?.data ?? []).map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(payment.paid_at).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-transparent text-xs',
                      payment.direction === 'from_parent'
                        ? 'bg-success/15 text-success'
                        : 'bg-warning/20 text-warning-foreground dark:text-warning',
                    )}
                  >
                    {payment.direction === 'from_parent' ? 'Received' : 'Paid out'}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{payment.party_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.student_name ?? '—'}
                </TableCell>
                <TableCell>{PAYMENT_FORM_LABELS[payment.method]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(payment.amount_cents)}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${PAYMENT_DIRECTION_LABELS[payment.direction]}`}
                      onClick={() => setRemoving(payment)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              The {formatCents(removing?.amount_cents ?? 0)} record involving{' '}
              {removing?.party_name} will be removed and the balances will change accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeadlineTile({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number | undefined;
  tone: 'warning' | 'brand';
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        {cents === undefined ? (
          <Skeleton className="mt-2 h-9 w-28" />
        ) : (
          <p
            className={cn(
              'font-display mt-1 text-3xl font-semibold tabular-nums',
              cents === 0
                ? 'text-muted-foreground'
                : tone === 'warning'
                  ? 'text-warning-foreground dark:text-warning'
                  : 'text-brand-700 dark:text-brand-300',
            )}
          >
            {formatCents(cents)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What a tutor is holding, and what it would take to restore their floor.
 *
 * A dash rather than a zero when the tutor is not on an advance: they are paid
 * for work already done, so there is no level to be below.
 */
function AdvanceCell({ tutor }: { tutor: TutorBalance }) {
  if (tutor.topup_amount_cents == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const due = topupDueCents(tutor) ?? 0;

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span>{formatCents(tutorAdvanceCents(tutor))}</span>
      {due > 0 ? (
        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
          Top up {formatCents(due)}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">
          of {formatCents(tutor.topup_amount_cents)}
        </span>
      )}
    </span>
  );
}

function LedgerTable({
  title,
  caption,
  columns,
  rows,
  isLoading,
}: {
  title: string;
  caption: string;
  columns: string[];
  /** `summary` is the single line the phone layout shows under the name. */
  rows: { key: string; cells: ReactNode[]; summary: string; balance: number }[];
  isLoading: boolean;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-3 text-xs">{caption}</p>

      {/* Phone: each row stacked, so no column is pushed off-screen. */}
      <ul className="border-border bg-card divide-border divide-y rounded-lg border sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.cells[0]}</span>
              <span className="text-muted-foreground block text-xs text-pretty">
                {row.summary}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                row.balance > 0 ? '' : 'text-muted-foreground',
              )}
            >
              {formatCents(row.balance)}
            </span>
          </li>
        ))}
        {isLoading && (
          <li className="p-3">
            <Skeleton className="h-10 w-full" />
          </li>
        )}
      </ul>

      <div className="border-border bg-card hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableHead key={column} className={index >= 2 ? 'text-right' : undefined}>
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}

            {rows.map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, index) => (
                  <TableCell
                    key={index}
                    className={cn(
                      index === 0 && 'font-medium',
                      index === 1 && 'text-muted-foreground',
                      index >= 2 && 'text-right tabular-nums',
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
                <TableCell
                  className={cn(
                    'text-right font-semibold tabular-nums',
                    row.balance > 0 ? '' : 'text-muted-foreground',
                  )}
                >
                  {formatCents(row.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
