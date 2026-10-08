import type { SessionTotals, TutoringSession } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { SessionsScreen } from './sessions-screen';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParams(),
}));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => mockAuth(),
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/lib/download', () => ({ downloadAndShare: jest.fn() }));
jest.mock('./api', () => ({ useSession: () => ({ data: undefined, isPending: false, isError: false }) }));
const mockPages = jest.fn();
jest.mock('./use-session-pages', () => ({
  SESSIONS_PAGE_SIZE: 25,
  useSessionPages: () => mockPages(),
}));
// FlashList measures nothing under Jest; a plain list renders the same children.
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

function withMoney(view: TutoringSession['money_view']): TutoringSession {
  return session({
    money_view: view,
    write_up: null,
    assessments: [],
    reflection: null,
  } as Partial<TutoringSession>);
}

function givePages(sessions: TutoringSession[], totals: SessionTotals) {
  mockPages.mockReturnValue({
    data: { pages: [{ data: sessions, meta: { total: sessions.length }, totals }] },
    isPending: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  });
}

const allTotals: SessionTotals = {
  session_count: 1,
  total_minutes: 90,
  total_tutor_amount_cents: 9750,
  total_charge_amount_cents: 13500,
};

function signedInAs(roles: string[]) {
  mockAuth.mockReturnValue({ user: { id: 'me', full_name: 'Me', roles }, organization: null });
}

describe('sessions list', () => {
  it('shows no money at all on Tutoring, even with admin money on the rows', async () => {
    signedInAs(['admin', 'tutor']);
    mockParams.mockReturnValue({});
    givePages([withMoney('admin')], allTotals);
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByTestId('session-card-s1')).toBeTruthy();
    expect(screen.queryByTestId('session-money')).toBeNull();
    expect(screen.queryByTestId('sessions-export')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("labels the office's Finance: Charged, paid to tutors, the cut", async () => {
    signedInAs(['admin', 'tutor']);
    mockParams.mockReturnValue({ tab: 'finance' });
    givePages([withMoney('admin')], allTotals);
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByTestId('stat-charged')).toBeTruthy();
    expect(screen.getByText('$97.50 paid to tutors')).toBeTruthy();
    expect(screen.getByTestId(/^stat-.*-cut$/)).toBeTruthy();
    expect(screen.queryByTestId('stat-earned')).toBeNull();
    expect(screen.getByTestId('session-money')).toBeTruthy();
    expect(screen.getByTestId('sessions-export')).toBeTruthy();
  });

  it("gives a tutor Earned only, and the lesson's pay", async () => {
    signedInAs(['tutor']);
    mockParams.mockReturnValue({ tab: 'finance' });
    givePages([withMoney('tutor')], { ...allTotals, total_charge_amount_cents: null });
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByTestId('stat-earned')).toBeTruthy();
    expect(screen.queryByTestId('stat-charged')).toBeNull();
    expect(screen.getByText('Your pay')).toBeTruthy();
    expect(screen.queryByText('You pay')).toBeNull();
  });

  it('gives a parent Charged only, and "You pay"', async () => {
    signedInAs(['parent']);
    mockParams.mockReturnValue({ tab: 'finance' });
    givePages([withMoney('family')], { ...allTotals, total_tutor_amount_cents: null });
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByText('What these lessons cost you')).toBeTruthy();
    expect(screen.queryByTestId('stat-earned')).toBeNull();
    expect(screen.getByText('You pay')).toBeTruthy();
    expect(screen.queryByText('Your pay')).toBeNull();
  });
});
