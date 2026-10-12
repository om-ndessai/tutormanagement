import type { BalancesResponse, Payment } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { BillingScreen } from './billing-screen';
import { PaymentFormBody, PaymentFormSheet } from './payment-form-sheet';

const mockAuth = jest.fn();
const mockBalances = jest.fn();
const mockPayments = jest.fn();
const mockRecord = jest.fn();
const mockUpdate = jest.fn();
const mockDetail = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('@/lib/download', () => ({ downloadAndShare: jest.fn() }));
jest.mock('./api', () => ({
  useBalances: () => mockBalances(),
  usePayments: () => mockPayments(),
  useDeletePayment: () => ({ mutate: jest.fn(), isPending: false }),
  useRecordPayment: () => ({ mutateAsync: mockRecord, isPending: false }),
  useUpdatePayment: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));
jest.mock('@/features/users/api', () => ({
  useUsers: () => ({ data: { data: [{ id: PARENT, full_name: 'Anita Patel' }] } }),
  useUserDetail: (id: string | null) => mockDetail(id),
}));

const PARENT = '00000000-0000-4000-8000-000000000007';
const STUDENT = '00000000-0000-4000-8000-000000000006';
const TUTOR = '00000000-0000-4000-8000-000000000003';

const tutorRow = {
  user_id: TUTOR,
  full_name: 'Alex Chen',
  earned_cents: 24250,
  paid_cents: 36000,
  balance_cents: -11750,
  session_count: 3,
  topup_amount_cents: 20000,
};
const familyRow = {
  student_user_id: STUDENT,
  student_name: 'Sanjay Patel',
  guardians: [{ user_id: PARENT, full_name: 'Anita Patel', is_primary: true }],
  charged_cents: 18000,
  paid_cents: 10000,
  balance_cents: 8000,
  session_count: 1,
};
const paid: Payment = {
  id: 'p1',
  direction: 'from_parent',
  party_user_id: PARENT,
  party_name: 'Anita Patel',
  student_user_id: STUDENT,
  student_name: 'Sanjay Patel',
  amount_cents: 10000,
  method: 'check',
  paid_at: '2026-09-11T16:00:00.000Z',
  reference: null,
  notes: null,
  created_at: '2026-09-11T16:00:00Z',
  updated_at: '2026-09-11T16:00:00Z',
};

function serve(balances: BalancesResponse, payments: Payment[]) {
  mockBalances.mockReturnValue({ data: { data: balances }, isPending: false, error: null });
  mockPayments.mockReturnValue({
    data: { data: payments, meta: { total: payments.length, limit: 50, offset: 0 } },
    isPending: false,
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDetail.mockReset();
  mockDetail.mockReturnValue({ data: undefined, isPending: false, isSuccess: false });
});

describe('Billing per reader', () => {
  it('gives the office its totals, both ledgers and every action', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin', 'tutor'] } });
    serve(
      {
        tutors: [tutorRow],
        students: [familyRow],
        totals: { owed_to_tutors_cents: 396274, owed_by_families_cents: 505975, topups_due_cents: 23250 },
      },
      [paid],
    );
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText('Owed to tutors')).toBeTruthy();
    expect(screen.getByText('$3,962.74')).toBeTruthy();
    expect(screen.getByText('Top-ups due')).toBeTruthy();
    expect(screen.getByText('Tutors')).toBeTruthy();
    expect(screen.getByText('Families')).toBeTruthy();
    expect(screen.getByTestId('billing-record')).toBeTruthy();
    expect(screen.getByTestId('billing-tax-summary')).toBeTruthy();
    expect(screen.getByTestId('billing-payment-delete-p1')).toBeTruthy();
    expect(screen.getByText(/^Received · for Sanjay Patel/)).toBeTruthy();
  });

  it('gives a tutor their own pay and nothing of the office or the families', async () => {
    mockAuth.mockReturnValue({ user: { id: TUTOR, roles: ['tutor'] } });
    serve(
      {
        tutors: [tutorRow],
        students: [],
        totals: { owed_to_tutors_cents: 0, owed_by_families_cents: 0, topups_due_cents: null },
      },
      [
        {
          ...paid,
          direction: 'to_tutor',
          party_user_id: TUTOR,
          party_name: 'Alex Chen',
          student_user_id: null,
          student_name: null,
        },
      ],
    );
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText('Your pay')).toBeTruthy();
    expect(screen.getByText(/holds \$117\.50 of \$200\.00 · top up \$82\.50/)).toBeTruthy();
    expect(screen.getByText(/^Paid to you/)).toBeTruthy();
    expect(screen.getByTestId('billing-export')).toBeTruthy();
    for (const absent of ['Owed to tutors', 'Owed by families', 'Top-ups due', 'Families', 'Tutors']) {
      expect(screen.queryByText(absent)).toBeNull();
    }
    expect(screen.queryByTestId('billing-record')).toBeNull();
    expect(screen.queryByTestId('billing-tax-summary')).toBeNull();
    expect(screen.queryByTestId('billing-payment-delete-p1')).toBeNull();
  });

  it("gives a parent their family's balance, worded from their side", async () => {
    mockAuth.mockReturnValue({ user: { id: PARENT, roles: ['parent'] } });
    serve(
      {
        tutors: [],
        students: [familyRow],
        totals: { owed_to_tutors_cents: 0, owed_by_families_cents: 8000, topups_due_cents: null },
      },
      [paid],
    );
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText("Your family's balance")).toBeTruthy();
    expect(screen.getByText(/^Paid by you · for Sanjay Patel/)).toBeTruthy();
    expect(screen.queryByText('Your pay')).toBeNull();
    expect(screen.queryByText('Owed by families')).toBeNull();
    expect(screen.queryByTestId('billing-record')).toBeNull();
  });
});

describe('the payment sheet', () => {
  it('refuses anyone but an admin', async () => {
    mockAuth.mockReturnValue({ user: { id: PARENT, roles: ['parent'] } });
    serve(
      {
        tutors: [],
        students: [],
        totals: { owed_to_tutors_cents: 0, owed_by_families_cents: 0, topups_due_cents: null },
      },
      [],
    );
    await renderWithProviders(<PaymentFormSheet paymentId={undefined} />);
    expect(screen.getByText('Only an admin can record payments.')).toBeTruthy();
    expect(screen.queryByTestId('payment-save')).toBeNull();
  });

  it('asks which student a parent payment is for, and sends nothing until it knows', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin'] } });
    mockDetail.mockImplementation((id: string | null) =>
      id ? { data: { data: { dependents: [] } }, isPending: false, isSuccess: true } : { data: undefined },
    );
    await renderWithProviders(<PaymentFormBody existing={null} />);
    await fireEvent.press(screen.getByTestId(`payment-party-${PARENT}`));
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '75');
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(screen.getByText('Choose which student this is for.')).toBeTruthy());
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('records cents and the instant on the organization clock, choosing an only child', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin'] } });
    mockDetail.mockImplementation((id: string | null) =>
      id
        ? {
            data: { data: { dependents: [{ user_id: STUDENT, full_name: 'Sanjay Patel' }] } },
            isPending: false,
            isSuccess: true,
          }
        : { data: undefined },
    );
    mockRecord.mockResolvedValue({ data: paid });
    await renderWithProviders(<PaymentFormBody existing={null} />);
    await fireEvent.press(screen.getByTestId(`payment-party-${PARENT}`));
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '$1,234.56');
    await fireEvent.press(screen.getByTestId('payment-method-cash'));
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    const sent = mockRecord.mock.calls[0][0];
    expect(sent).toMatchObject({
      direction: 'from_parent',
      party_user_id: PARENT,
      student_user_id: STUDENT,
      amount_cents: 123456,
      method: 'cash',
      reference: null,
      notes: null,
    });
    expect(sent.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('corrects a payment with only the fields a PATCH may change, keeping its instant', async () => {
    mockAuth.mockReturnValue({ user: { id: 'admin', roles: ['admin'] } });
    mockUpdate.mockResolvedValue({ data: paid });
    await renderWithProviders(<PaymentFormBody existing={paid} />);
    expect(screen.getByText('Edit payment')).toBeTruthy();
    expect(screen.queryByTestId('payment-party')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '120');
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      id: 'p1',
      input: {
        amount_cents: 12000,
        method: 'check',
        paid_at: '2026-09-11T16:00:00.000Z',
        reference: null,
        notes: null,
      },
    });
  });
});
