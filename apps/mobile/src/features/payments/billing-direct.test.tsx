import type { BalancesResponse, Payment } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { BillingScreen } from './billing-screen';
import { PaymentFormSheet } from './payment-form-sheet';

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
  useUsers: (params: { role: string }) => ({
    data: {
      data:
        params.role === 'tutor'
          ? [
              { id: DIEGO, full_name: 'Diego Ramos' },
              { id: HANNAH, full_name: 'Hannah Brooks' },
            ]
          : [{ id: SAM, full_name: 'Sam Okafor' }],
    },
  }),
  useUserDetail: (id: string | null) => mockDetail(id),
}));

// Phase 54: a space paid directly (`docs/tutor-spaces-plan.md`, R24) -- families pay each tutor.
const HANNAH = '0e100000-0000-4000-8000-000000000001';
const DIEGO = '0e100000-0000-4000-8000-000000000002';
const SAM = '0e100000-0000-4000-8000-000000000005';
const ZOE = '0e100000-0000-4000-8000-000000000006';
const SOLO = { business: null };

const zoeWithDiego = {
  student_user_id: ZOE,
  student_name: 'Zoe Okafor',
  tutor_user_id: DIEGO,
  tutor_name: 'Diego Ramos',
  guardians: [{ user_id: SAM, full_name: 'Sam Okafor', is_primary: true }],
  charged_cents: 5000,
  paid_cents: 0,
  balance_cents: 5000,
  session_count: 1,
};
const zoeWithHannah = {
  ...zoeWithDiego,
  tutor_user_id: HANNAH,
  tutor_name: 'Hannah Brooks',
  paid_cents: 6000,
  charged_cents: 6000,
  balance_cents: 0,
};

const toDiego: Payment = {
  id: 'p2',
  direction: 'from_parent',
  party_user_id: SAM,
  party_name: 'Sam Okafor',
  student_user_id: ZOE,
  student_name: 'Zoe Okafor',
  amount_cents: 2500,
  method: 'cash',
  paid_at: '2026-09-11T16:00:00.000Z',
  reference: null,
  notes: null,
  payee_user_id: DIEGO,
  payee_name: 'Diego Ramos',
  created_at: '2026-09-11T16:00:00Z',
  updated_at: '2026-09-11T16:00:00Z',
};
const toHannah: Payment = { ...toDiego, id: 'p3', payee_user_id: HANNAH, payee_name: 'Hannah Brooks' };

function serve(balances: Partial<BalancesResponse>, payments: Payment[]) {
  mockBalances.mockReturnValue({
    data: {
      data: {
        paid_directly: true,
        direct: [],
        tutors: [],
        students: [],
        totals: {
          owed_directly_cents: 0,
          owed_to_tutors_cents: 0,
          owed_by_families_cents: 0,
          topups_due_cents: null,
        },
        ...balances,
      },
    },
    isPending: false,
    error: null,
  });
  mockPayments.mockReturnValue({
    data: { data: payments, meta: { total: payments.length, limit: 50, offset: 0 } },
    isPending: false,
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDetail.mockReset();
  mockDetail.mockImplementation((id: string | null) =>
    id
      ? {
          data: {
            data: { full_name: 'Sam Okafor', dependents: [{ user_id: ZOE, full_name: 'Zoe Okafor' }] },
          },
          isPending: false,
          isSuccess: true,
        }
      : { data: undefined, isPending: false, isSuccess: false },
  );
});

describe('Billing in a space paid directly', () => {
  it('lets a tutor record what they received, with their families and a year-end summary', async () => {
    mockAuth.mockReturnValue({ user: { id: DIEGO, roles: ['tutor'] }, organization: SOLO });
    serve(
      {
        direct: [zoeWithDiego],
        tutors: [
          {
            user_id: DIEGO,
            full_name: 'Diego Ramos',
            earned_cents: 0,
            paid_cents: 0,
            balance_cents: 0,
            session_count: 0,
            topup_amount_cents: null,
          },
        ],
      },
      [toDiego],
    );
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText('Record a payment you received')).toBeTruthy();
    expect(screen.getByText('Families and tutors')).toBeTruthy();
    expect(screen.getByTestId(`billing-direct-${ZOE}-${DIEGO}`)).toBeTruthy();
    expect(screen.getByTestId('billing-year-end')).toBeTruthy();
    expect(screen.queryByTestId('billing-tax-summary')).toBeNull();
    // The organization's empty ledger of them is not shown: nobody pays a tutor here.
    expect(screen.queryByText('Your pay')).toBeNull();
    // Paid to them: worded from their side, and theirs to correct.
    expect(screen.getByText(/^Paid to you · for Zoe Okafor$/)).toBeTruthy();
    expect(screen.getByTestId('billing-payment-delete-p2')).toBeTruthy();
  });

  it("never lets a tutor change another tutor's payment", async () => {
    mockAuth.mockReturnValue({ user: { id: DIEGO, roles: ['tutor'] }, organization: SOLO });
    serve({}, [toHannah]);
    await renderWithProviders(<BillingScreen />);
    expect(screen.queryByTestId('billing-payment-delete-p3')).toBeNull();
    expect(screen.getByText(/to Hannah Brooks/)).toBeTruthy();
  });

  it('gives the office one headline and the families-and-tutors ledger, no tax summary', async () => {
    mockAuth.mockReturnValue({ user: { id: HANNAH, roles: ['admin', 'tutor'] }, organization: SOLO });
    serve(
      {
        direct: [zoeWithDiego, zoeWithHannah],
        totals: {
          owed_directly_cents: 5000,
          owed_to_tutors_cents: 0,
          owed_by_families_cents: 0,
          topups_due_cents: null,
        },
      },
      [toDiego],
    );
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText('Owed by families to tutors')).toBeTruthy();
    expect(screen.queryByText('Owed to tutors')).toBeNull();
    expect(screen.queryByText('Top-ups due')).toBeNull();
    expect(screen.getByText('Record a payment')).toBeTruthy();
    expect(screen.queryByTestId('billing-tax-summary')).toBeNull();
    expect(screen.getByTestId('billing-year-end')).toBeTruthy();
    expect(screen.getByText(/^Received · for Zoe Okafor · to Diego Ramos$/)).toBeTruthy();
  });

  it('gives a parent their balance with each tutor and nothing to record', async () => {
    mockAuth.mockReturnValue({ user: { id: SAM, roles: ['parent'] }, organization: SOLO });
    serve({ direct: [zoeWithDiego, zoeWithHannah] }, [toDiego]);
    await renderWithProviders(<BillingScreen />);
    expect(screen.getByText('Families and tutors')).toBeTruthy();
    expect(screen.getByText(/^Diego Ramos · 1 lesson/)).toBeTruthy();
    expect(screen.getByText(/^Hannah Brooks · 1 lesson/)).toBeTruthy();
    expect(screen.queryByTestId('billing-record')).toBeNull();
    expect(screen.queryByTestId('billing-year-end')).toBeNull();
    expect(screen.queryByTestId('billing-payment-delete-p2')).toBeNull();
  });
});

describe('the payment sheet in a space paid directly', () => {
  it('lets a tutor record a payment made to them, with no direction to choose', async () => {
    mockAuth.mockReturnValue({ user: { id: DIEGO, roles: ['tutor'] }, organization: SOLO });
    serve({}, []);
    mockRecord.mockResolvedValue({ data: toDiego });
    await renderWithProviders(<PaymentFormSheet paymentId={undefined} />);
    expect(screen.getByText('Record a payment you received')).toBeTruthy();
    expect(screen.queryByTestId('payment-direction-to_tutor')).toBeNull();
    expect(screen.queryByTestId('payment-payee')).toBeNull();
    await fireEvent.press(screen.getByTestId('payment-party'));
    await fireEvent.press(screen.getByTestId(`payment-party-${SAM}`));
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '25');
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    expect(mockRecord.mock.calls[0][0]).toMatchObject({
      direction: 'from_parent',
      party_user_id: SAM,
      student_user_id: ZOE,
      payee_user_id: DIEGO,
      amount_cents: 2500,
    });
  });

  it('has the office choose the tutor, and sends nothing until it does', async () => {
    mockAuth.mockReturnValue({ user: { id: HANNAH, roles: ['admin', 'tutor'] }, organization: SOLO });
    serve({}, []);
    mockRecord.mockResolvedValue({ data: toDiego });
    await renderWithProviders(<PaymentFormSheet paymentId={undefined} />);
    expect(screen.getByText('Record a payment')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payment-party'));
    await fireEvent.press(screen.getByTestId(`payment-party-${SAM}`));
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '25');
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(screen.getByText('Choose the tutor the family paid.')).toBeTruthy());
    expect(mockRecord).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('payment-payee'));
    await fireEvent.press(screen.getByTestId(`payment-payee-${DIEGO}`));
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    expect(mockRecord.mock.calls[0][0]).toMatchObject({ payee_user_id: DIEGO });
  });

  it('sends no payee in a space run by an organization', async () => {
    mockAuth.mockReturnValue({
      user: { id: HANNAH, roles: ['admin'] },
      organization: { business: { id: 'b', name: 'B' } },
    });
    serve({}, []);
    mockRecord.mockResolvedValue({ data: toDiego });
    await renderWithProviders(<PaymentFormSheet paymentId={undefined} />);
    expect(screen.getByTestId('payment-direction-to_tutor')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payment-party'));
    await fireEvent.press(screen.getByTestId(`payment-party-${SAM}`));
    await fireEvent.changeText(screen.getByTestId('payment-amount'), '25');
    await fireEvent.press(screen.getByTestId('payment-save'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    expect(mockRecord.mock.calls[0][0]).not.toHaveProperty('payee_user_id');
  });

  it('refuses a parent', async () => {
    mockAuth.mockReturnValue({ user: { id: SAM, roles: ['parent'] }, organization: SOLO });
    serve({}, []);
    await renderWithProviders(<PaymentFormSheet paymentId={undefined} />);
    expect(screen.getByText('Only an admin can record payments.')).toBeTruthy();
  });
});
