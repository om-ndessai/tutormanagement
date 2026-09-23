import { useState } from 'react';
import {
  formatCents,
  formatMailingAddress,
  isMailingAddressComplete,
  type TutorTaxStatus,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { useUserDetail } from '@/features/users/api';
import { SsnReceiptButton } from '@/features/users/ssn-receipt-button';
import { useTaxStatus } from './api';
import { Form1099Dialog } from './form-1099-dialog';
import { EmptyNote, Panel } from './stat-card';

/** The year being filed for, plus the two before it. */
function selectableYears(): number[] {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2];
}

/**
 * Year-end documents, one row per tutor.
 *
 * A 1099 can be printed for any tutor at any time. Nothing here gates it:
 * the number is typed into the dialog when the form is printed, so "we have
 * their SSN on file" is a note to the office about its own paperwork, not a
 * precondition for producing the document. Gating on it meant an admin with
 * the number in front of them could not use it.
 *
 * The year is chosen rather than assumed, because the work happens in January
 * for the year that just ended -- pinning it to today's year made the forms
 * that were actually due impossible to reach.
 */
export function YearEndPanel({ index = 0 }: { index?: number }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [printing, setPrinting] = useState<TutorTaxStatus | null>(null);

  const { data, isPending } = useTaxStatus(year);
  const tutors = data?.data ?? [];

  // The institute's own TIN, from whoever is signed in.
  const { user } = useAuth();
  const me = useUserDetail(user?.id ?? null);
  const instituteTin = me.data?.data.admin_profile?.tin ?? null;

  // Paid first, since those are the forms that have to be filed; everyone else
  // stays reachable underneath rather than being hidden.
  const ordered = [...tutors].sort(
    (a, b) => b.paid_this_year_cents - a.paid_this_year_cents,
  );

  return (
    <Panel index={index} title="Year-end documents">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Tax year</span>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger className="h-8 w-28" aria-label="Tax year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableYears().map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : ordered.length === 0 ? (
        <EmptyNote>No tutors on the books.</EmptyNote>
      ) : (
        <ul className="divide-border divide-y">
          {ordered.map((tutor) => (
            <li
              key={tutor.user_id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{tutor.full_name}</span>
                <span className="text-muted-foreground text-xs">
                  {tutor.paid_this_year_cents > 0
                    ? `${formatCents(tutor.paid_this_year_cents)} paid in ${year}`
                    : `Nothing paid in ${year}`}
                  {!tutor.ssn_received_on && ' · SSN not on file'}
                  {!isMailingAddressComplete(tutor.address) && ' · No full address'}
                </span>
              </span>

              <span className="flex items-center gap-2">
                {/* Offered whether or not the office has ticked the SSN off:
                    the number is typed when the form is printed. */}
                {!tutor.ssn_received_on && (
                  <SsnReceiptButton
                    userId={tutor.user_id}
                    fullName={tutor.full_name}
                    received={false}
                    variant="ghost"
                  />
                )}
                <Button size="sm" variant="outline" onClick={() => setPrinting(tutor)}>
                  1099-NEC
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        The SSN is typed when the form is printed and is never stored. The recipient’s address
        comes from the tutor’s record.{' '}
        {instituteTin ? (
          <>The payer box is filled from your record ({instituteTin}).</>
        ) : (
          <>
            Add the institute’s TIN to your own record and it will fill the payer box for you.
          </>
        )}
      </p>

      {printing && (
        <Form1099Dialog
          open
          onOpenChange={(open) => !open && setPrinting(null)}
          tutorName={printing.full_name}
          year={year}
          amountCents={printing.paid_this_year_cents}
          instituteTin={instituteTin}
          recipientAddress={formatMailingAddress(printing.address)}
        />
      )}
    </Panel>
  );
}
