import type { Payment, StudentBalance, TutorBalance } from '@tmi/shared';

import {
  familyLedgerSummary,
  mayChangePayment,
  paymentDirectionText,
  paymentPayeeText,
  tutorLedgerSummary,
} from './payment-format';

const ME = 'u-me';

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'p1',
    direction: 'from_parent',
    party_user_id: ME,
    party_name: 'Anita Patel',
    student_user_id: 's1',
    student_name: 'Sanjay Patel',
    amount_cents: 10000,
    method: 'check',
    paid_at: '2026-09-11T00:00:00Z',
    reference: null,
    notes: null,
    created_at: '2026-09-11T00:00:00Z',
    updated_at: '2026-09-11T00:00:00Z',
    payee_user_id: null,
    payee_name: null,
    ...overrides,
  };
}

const tutor = (overrides: Partial<TutorBalance> = {}): TutorBalance => ({
  user_id: 't1',
  full_name: 'Alex Chen',
  earned_cents: 24250,
  paid_cents: 36000,
  balance_cents: -11750,
  session_count: 3,
  topup_amount_cents: null,
  ...overrides,
});

describe('a payment worded from the reader', () => {
  it('reads Received / Paid out to the office', () => {
    expect(paymentDirectionText(payment({}), 'admin', true)).toBe('Received');
    expect(paymentDirectionText(payment({ direction: 'to_tutor' }), 'admin', true)).toBe('Paid out');
  });

  it('reads Paid to you to the tutor, Paid by you to the paying parent', () => {
    expect(paymentDirectionText(payment({ direction: 'to_tutor', student_user_id: null }), ME, false)).toBe(
      'Paid to you',
    );
    expect(paymentDirectionText(payment({}), ME, false)).toBe('Paid by you');
  });

  it('names the other guardian when they paid for a shared child', () => {
    expect(
      paymentDirectionText(payment({ party_user_id: 'other', party_name: 'Raj Patel' }), ME, false),
    ).toBe('Paid by Raj Patel');
  });
});

describe('ledger summaries', () => {
  it('leaves the advance out for a tutor paid after the work', () => {
    expect(tutorLedgerSummary(tutor())).toBe('3 sessions · $242.50 earned · $360.00 paid');
  });

  it('says what an advanced tutor holds and the top-up due', () => {
    // Holds 117.50 of a 200.00 level: 82.50 to top up.
    expect(tutorLedgerSummary(tutor({ topup_amount_cents: 20000 }))).toBe(
      '3 sessions · $242.50 earned · $360.00 paid · holds $117.50 of $200.00 · top up $82.50',
    );
    // Above the level: nothing due.
    expect(tutorLedgerSummary(tutor({ topup_amount_cents: 10000 }))).toBe(
      '3 sessions · $242.50 earned · $360.00 paid · holds $117.50 of $100.00',
    );
  });

  it('lists guardians, charged and paid for a family', () => {
    const student: StudentBalance = {
      student_user_id: 's1',
      student_name: 'Sanjay Patel',
      guardians: [{ user_id: 'g1', full_name: 'Anita Patel', is_primary: true }],
      charged_cents: 18000,
      paid_cents: 10000,
      balance_cents: 8000,
      session_count: 1,
    };
    expect(familyLedgerSummary(student)).toBe('Anita Patel · $180.00 charged · $100.00 paid');
    expect(familyLedgerSummary({ ...student, guardians: [] })).toBe(
      'No guardian · $180.00 charged · $100.00 paid',
    );
  });
});

describe('a payment made to a tutor directly (Phase 54)', () => {
  const direct = payment({ payee_user_id: 'diego', payee_name: 'Diego Ramos' });

  it('reads "Paid to you" to the tutor paid, and names them to everyone else', () => {
    expect(paymentDirectionText(direct, 'diego', false)).toBe('Paid to you');
    expect(paymentPayeeText(direct, 'diego')).toBe('');
    expect(paymentPayeeText(direct, 'sam')).toBe(' · to Diego Ramos');
    // The office reads "Received", so the payee is named even when it is them.
    expect(paymentPayeeText(direct, 'diego', true)).toBe(' · to Diego Ramos');
    expect(paymentPayeeText(payment({}), 'diego')).toBe('');
  });

  it('lets the office or the tutor paid change it, and nobody else', () => {
    expect(mayChangePayment(direct, 'diego', false)).toBe(true);
    expect(mayChangePayment(direct, 'hannah', false)).toBe(false);
    expect(mayChangePayment(direct, 'hannah', true)).toBe(true);
    expect(mayChangePayment(payment({}), 'diego', false)).toBe(false);
  });
});
