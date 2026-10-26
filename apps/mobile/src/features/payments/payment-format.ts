// Ported from apps/web/src/features/payments/billing-page.tsx @ 1132322 -- the phone layout's
// summary lines -- with the payment's direction worded from the reader's side (Phase 17): the
// office reads "Received" / "Paid out", a tutor "Paid to you", a parent "Paid by you".
import {
  formatCents,
  topupDueCents,
  tutorAdvanceCents,
  type DirectBalance,
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
  // Phase 54: a family's payment straight to this tutor, in a space paid directly.
  if (payment.payee_user_id !== null && payment.payee_user_id === viewerId) return 'Paid to you';
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

/**
 * Phase 54: " · to Hannah Brooks", for a payment a family made to a tutor directly -- left out when
 * the reader is that tutor and not the office ("Paid to you" already says it).
 */
export function paymentPayeeText(payment: Payment, viewerId: string | undefined, isAdmin = false): string {
  if (!payment.payee_name || (!isAdmin && payment.payee_user_id === viewerId)) return '';
  return ` · to ${payment.payee_name}`;
}

/** Phase 54: "Diego Ramos · 3 lessons · $150.00 · $100.00 paid" -- one family's balance with one tutor. */
export function directLedgerSummary(row: DirectBalance): string {
  return (
    `${row.tutor_name} · ${row.session_count} ${row.session_count === 1 ? 'lesson' : 'lessons'} · ` +
    `${formatCents(row.charged_cents)} · ${formatCents(row.paid_cents)} paid`
  );
}

/** Who may change or delete a payment: the office, or (Phase 54) the tutor a family paid directly. */
export function mayChangePayment(payment: Payment, viewerId: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || (payment.payee_user_id !== null && payment.payee_user_id === viewerId);
}
