// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 -- the phone layout's
// summary lines -- with the payment's direction worded from the reader's side (Phase 17): the
// office reads "Received" / "Paid out", a tutor "Paid to you", a parent "Paid by you".
import {
  formatCents,
  topupDueCents,
  tutorAdvanceCents,
  type Payment,
  type StudentBalance,
  type TutorBalance,
} from '@tmi/shared';

/** How a payment's direction reads to this reader. */
export function paymentDirectionText(
  payment: Payment,
  viewerId: string | undefined,
  isAdmin: boolean,
): string {
  if (isAdmin) return payment.direction === 'from_parent' ? 'Received' : 'Paid out';
  if (payment.party_user_id === viewerId) {
    return payment.direction === 'to_tutor' ? 'Paid to you' : 'Paid by you';
  }
  // A child's payment made by their other guardian.
  return `Paid by ${payment.party_name}`;
}

/** "12 sessions · $900.00 earned · $800.00 paid · holds $50.00 of $200.00 · top up $150.00" */
export function tutorLedgerSummary(tutor: TutorBalance): string {
  const due = topupDueCents(tutor);
  return (
    `${tutor.session_count} sessions · ${formatCents(tutor.earned_cents)} earned · ` +
    `${formatCents(tutor.paid_cents)} paid` +
    (tutor.topup_amount_cents == null
      ? ''
      : ` · holds ${formatCents(tutorAdvanceCents(tutor))} of ${formatCents(tutor.topup_amount_cents)}`) +
    (due && due > 0 ? ` · top up ${formatCents(due)}` : '')
  );
}

/** "Anita Patel · $1,200.00 charged · $1,000.00 paid" */
export function familyLedgerSummary(student: StudentBalance): string {
  const guardians = student.guardians.map((g) => g.full_name).join(', ') || 'No guardian';
  return `${guardians} · ${formatCents(student.charged_cents)} charged · ${formatCents(student.paid_cents)} paid`;
}
