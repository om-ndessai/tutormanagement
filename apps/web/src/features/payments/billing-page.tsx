import { useState } from 'react';
import { DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_FORM_LABELS,
  formatCents,
  type Payment,
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
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
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
        </div>
      )}

      {(data?.tutors.length ?? 0) > 0 && (
        <LedgerTable
          title="Tutors"
          caption="What each tutor has earned, and what they have been paid."
          columns={['Tutor', 'Sessions', 'Earned', 'Paid', 'Owed']}
          rows={(data?.tutors ?? []).map((tutor) => ({
            key: tutor.user_id,
            cells: [
              tutor.full_name,
              String(tutor.session_count),
              formatCents(tutor.earned_cents),
              formatCents(tutor.paid_cents),
            ],
            balance: tutor.balance_cents,
          }))}
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
            balance: student.balance_cents,
          }))}
          isLoading={balances.isPending}
        />
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold">Payments</h2>
      <div className="border-border bg-card overflow-hidden rounded-lg border">
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
  rows: { key: string; cells: string[]; balance: number }[];
  isLoading: boolean;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-3 text-xs">{caption}</p>

      <div className="border-border bg-card overflow-hidden rounded-lg border">
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
