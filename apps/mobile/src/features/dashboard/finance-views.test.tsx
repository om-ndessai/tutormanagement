import type { MonthlyFinanceResponse, TutorDashboard, TutorPaymentOutlook } from '@tmi/shared';
import { screen, within } from '@testing-library/react-native';

import { adminDashboard, TODAY, tutorDashboard } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { advanceHint, AdminFinance, TutorFinance } from './finance-views';
import { activeMonths, yearTotals } from './monthly-finance';
import { balanceText, fromTopupText } from './tutor-payments';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: null }),
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockMonthly = jest.fn();
const mockTax = jest.fn();
jest.mock('./api', () => ({
  useMonthlyFinance: (year: number) => mockMonthly(year),
  useTaxStatus: (year: number) => mockTax(year),
}));

function month(overrides: Partial<MonthlyFinanceResponse['months'][number]>) {
  return {
    month: '2026-09',
    session_count: 4,
    minutes: 240,
    billed_cents: 36_000,
    received_from_families_cents: 20_000,
    earned_cents: 26_000,
    paid_to_tutors_cents: 15_000,
    ...overrides,
  };
}

const instituteMonthly: MonthlyFinanceResponse = {
  year: 2026,
  scope: 'institute',
  months: [
    month({
      month: '2026-01',
      session_count: 0,
      minutes: 0,
      billed_cents: 0,
      received_from_families_cents: 0,
      earned_cents: 0,
      paid_to_tutors_cents: 0,
    }),
    month({}),
  ],
};
const tutorMonthly: MonthlyFinanceResponse = {
  year: 2026,
  scope: 'tutor',
  months: [month({ billed_cents: null, received_from_families_cents: null })],
};

const outlook = (overrides: Partial<TutorPaymentOutlook>): TutorPaymentOutlook => ({
  user_id: 'tutor-1',
  full_name: 'Alex Chen',
  earned_cents: 24_250,
  paid_cents: 36_000,
  balance_cents: -11_750,
  session_count: 3,
  topup_amount_cents: 20_000,
  last_paid_cents: 15_000,
  last_paid_at: '2026-09-16T10:00:00.000Z',
  next_topup_on: null,
  scheduled_lessons: 35,
  urgency: 'past_due',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(`${TODAY}T14:00:00Z`) });
  mockTax.mockReturnValue({ data: { data: [] }, isPending: false });
});
afterEach(() => jest.useRealTimers());

/** Every string the tree renders, joined. */
function allText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string' || typeof node === 'number') {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    walk((node as { children?: unknown }).children);
  };
  walk(screen.toJSON());
  return out.join(' | ');
}

const INSTITUTE_LABELS = [
  /Owed by families/,
  /Owed to tutors/,
  /Billed all time/,
  /Kept by/,
  /Tutor payments/,
  /Year-end documents/,
  /Families with a balance/,
];

describe('Finance tab: each reader sees their own side', () => {
  it("the admin's shows the organization's money, tutor payments, and the family columns", async () => {
    mockMonthly.mockReturnValue({ data: { data: instituteMonthly }, isPending: false });
    await renderWithProviders(
      <AdminFinance
        data={{
          ...adminDashboard,
          tutor_balances: [outlook({})],
          tutors_missing_ssn: [{ user_id: 'tutor-1', full_name: 'Alex Chen' }],
        }}
      />,
    );
    expect(screen.getByTestId('stat-owed-to-tutors-value')).toHaveTextContent('$1,234.00');
    expect(screen.getByTestId('stat-owed-by-families-value')).toHaveTextContent('$4,567.00');
    expect(screen.getByTestId('stat-billed-all-time-value')).toHaveTextContent('$98,765.00');
    const text = allText();
    for (const label of INSTITUTE_LABELS) expect(text).toMatch(label);
    expect(text).toContain('Paid out $54,321.00');
    // The month list carries the family side and drops the empty January.
    expect(screen.queryByTestId('monthly-finance-2026-01')).toBeNull();
    expect(within(screen.getByTestId('monthly-finance-2026-09')).getByText(/Billed \$360\.00/)).toBeTruthy();
    expect(screen.getByTestId('ssn-receipt-tutor-1')).toBeTruthy();
    expect(text).not.toMatch(/Earned \|/);
    expect(text).not.toMatch(/Paid to you/);
  });

  it("the tutor's shows their earnings and nothing of the organization's", async () => {
    mockMonthly.mockReturnValue({ data: { data: tutorMonthly }, isPending: false });
    await renderWithProviders(<TutorFinance data={tutorDashboard} />);
    expect(screen.getByTestId('stat-earned-value')).toHaveTextContent('$975.00');
    expect(screen.getByTestId('stat-paid-to-you-value')).toHaveTextContent('$800.00');
    expect(screen.getByTestId('stat-owed-to-you-value')).toHaveTextContent('$175.00');
    // Not on an advance: no advance card.
    expect(screen.queryByTestId('stat-advance-held')).toBeNull();
    expect(screen.getByTestId('tutor-ssn-notice')).toBeTruthy();
    const text = allText();
    for (const label of INSTITUTE_LABELS) expect(text).not.toMatch(label);
    expect(text).not.toMatch(/Billed|Received|Tutor cost|Net\b/);
    expect(text).toMatch(/Paid to you \$150\.00/);
    expect(mockTax).not.toHaveBeenCalled();
  });

  it('a tutor on an advance sees what they hold, "Owed to you" never below zero', async () => {
    mockMonthly.mockReturnValue({ data: { data: tutorMonthly }, isPending: false });
    const onAdvance: TutorDashboard = {
      ...tutorDashboard,
      ssn_received_on: '2026-01-05',
      earnings: {
        ...tutorDashboard.earnings,
        earned_cents: 24_250,
        paid_cents: 36_000,
        balance_cents: -11_750,
        topup_amount_cents: 20_000,
      },
    };
    await renderWithProviders(<TutorFinance data={onAdvance} />);
    expect(screen.getByTestId('stat-owed-to-you-value')).toHaveTextContent('$0.00');
    expect(screen.getByTestId('stat-owed-to-you')).toHaveProp(
      'accessibilityLabel',
      'Owed to you: $0.00. Paid up front',
    );
    // paid - earned = 360.00 - 242.50
    expect(screen.getByTestId('stat-advance-held-value')).toHaveTextContent('$117.50');
    expect(screen.getByTestId('stat-advance-held')).toHaveProp(
      'accessibilityLabel',
      'Advance held: $117.50. Below your $200.00 level — a top-up is due',
    );
    expect(screen.queryByTestId('tutor-ssn-notice')).toBeNull();
  });
});

describe('derivations', () => {
  it('the advance hint follows needsTopup', () => {
    const base = tutorDashboard.earnings;
    expect(advanceHint({ ...base, earned_cents: 0, paid_cents: 30_000, topup_amount_cents: 20_000 })).toBe(
      'Topped up below $200.00',
    );
    expect(
      advanceHint({ ...base, earned_cents: 15_000, paid_cents: 30_000, topup_amount_cents: 20_000 }),
    ).toBe('Below your $200.00 level — a top-up is due');
  });

  it('tutor payment cells: owed, held, settled; below, above, at the level', () => {
    expect(balanceText({ balance_cents: 5_000 })).toBe('$50.00 owed');
    expect(balanceText({ balance_cents: -11_750 })).toBe('$117.50 held');
    expect(balanceText({ balance_cents: 0 })).toBe('Settled');
    expect(fromTopupText(outlook({}))).toEqual({ text: '$82.50 below', below: true });
    expect(fromTopupText(outlook({ paid_cents: 54_250 }))).toEqual({ text: '$100.00 above', below: false });
    expect(fromTopupText(outlook({ paid_cents: 44_250 }))).toEqual({ text: 'At top-up', below: false });
    expect(fromTopupText(outlook({ topup_amount_cents: null }))).toEqual({ text: '—', below: false });
  });

  it("the year's line keeps a tutor's family columns null", () => {
    const months = activeMonths(tutorMonthly);
    expect(yearTotals(months, false).billed_cents).toBeNull();
    expect(yearTotals(activeMonths(instituteMonthly), true)).toMatchObject({
      billed_cents: 36_000,
      earned_cents: 26_000,
    });
  });
});
