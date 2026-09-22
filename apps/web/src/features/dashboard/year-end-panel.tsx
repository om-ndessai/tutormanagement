import { useState } from 'react';
import { formatCents, type TutorTaxStatus } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { SsnReceiptButton } from '@/features/users/ssn-receipt-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Form1099Dialog } from './form-1099-dialog';
import { EmptyNote, Panel } from './stat-card';

/**
 * Year-end documents, one row per tutor.
 *
 * A 1099 can only be printed for somebody whose SSN the office actually has,
 * so the button is disabled until then and the row says why -- the chase and
 * the filing are the same list, rather than two screens that disagree.
 */
export function YearEndPanel({
  tutors,
  year,
  isLoading,
  index = 0,
}: {
  tutors: TutorTaxStatus[];
  year: number;
  isLoading: boolean;
  index?: number;
}) {
  const [printing, setPrinting] = useState<TutorTaxStatus | null>(null);

  // Somebody paid nothing all year needs no document.
  const paid = tutors.filter((tutor) => tutor.paid_this_year_cents > 0);

  return (
    <Panel index={index} title={`${year} year-end documents`}>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : paid.length === 0 ? (
        <EmptyNote>Nobody has been paid in {year} yet.</EmptyNote>
      ) : (
        <ul className="divide-border divide-y">
          {paid.map((tutor) => (
            <li
              key={tutor.user_id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{tutor.full_name}</span>
                <span className="text-muted-foreground text-xs">
                  {formatCents(tutor.paid_this_year_cents)} paid in {year}
                </span>
              </span>

              {tutor.ssn_received_on ? (
                <Button size="sm" variant="outline" onClick={() => setPrinting(tutor)}>
                  1099-NEC
                </Button>
              ) : (
                // Same question, same button: no 1099 until the office has it.
                <SsnReceiptButton
                  userId={tutor.user_id}
                  fullName={tutor.full_name}
                  received={false}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        The SSN is typed when the form is printed and is never stored — see the dialog.
      </p>

      {printing && (
        <Form1099Dialog
          open
          onOpenChange={(open) => !open && setPrinting(null)}
          tutorName={printing.full_name}
          year={year}
          amountCents={printing.paid_this_year_cents}
        />
      )}
    </Panel>
  );
}
