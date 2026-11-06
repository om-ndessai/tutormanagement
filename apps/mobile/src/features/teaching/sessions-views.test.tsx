import type { LessonOwed, SessionTotals, TutoringSession } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { SessionsScreen } from './sessions-screen';

const mockParams = jest.fn();
const mockOwed = jest.fn((): LessonOwed[] => []);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  Stack: { Screen: () => null },
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
jest.mock('./api', () => ({
  useSession: () => ({ data: undefined, isPending: false, isError: false }),
  useActiveSession: () => ({ isSuccess: true, data: { data: { mine: null, all: [] } } }),
  useAssignments: () => ({ data: { data: [] } }),
  useMyDrafts: () => ({ data: undefined }),
  usePostDraft: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDiscardDraft: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteSession: () => ({ mutate: jest.fn(), isPending: false }),
  useLessonsOwed: () => ({ data: { data: mockOwed() }, isPending: false, isError: false }),
}));
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

function owed(overrides: Partial<LessonOwed> = {}): LessonOwed {
  return {
    schedule_id: 'sch-1',
    occurs_on: '2026-11-03',
    start_time: '16:00',
    end_time: '17:00',
    mode: 'in_person',
    tutor_user_id: 'me',
    tutor_name: 'Me Tutor',
    student_user_id: 'stu-1',
    student_name: 'Yusuf Haddad',
    place: { name: 'Institute, room 2', kind: 'physical' },
    draft: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockOwed.mockReturnValue([]);
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
});

describe('Phase 75 (JF19, JF30): To record leads the Tutoring tab', () => {
  it('lists the lessons still owed, each with Record -- or its draft’s Continue -- and no money', async () => {
    signedInAs(['tutor']);
    mockParams.mockReturnValue({});
    givePages([], allTotals);
    mockOwed.mockReturnValue([
      owed(),
      owed({ schedule_id: 'sch-2', student_name: 'Ben Whitfield', draft: { id: 'd-1', updated_at: '2026-11-03T17:43:00Z' } }),
    ]);
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByTestId('sessions-to-record')).toBeTruthy();
    expect(screen.getByTestId('sessions-to-record-sch-1-2026-11-03-record')).toHaveTextContent('Record');
    expect(screen.getByTestId('sessions-to-record-sch-2-2026-11-03-draft')).toHaveTextContent(/^Draft saved .*12:43 PM$/);
    expect(screen.getByTestId('sessions-to-record-sch-2-2026-11-03-record')).toHaveTextContent('Continue');
    expect(screen.queryByText(/\$/)).toBeNull();

    // A lesson the schedule knows opens "Record a lesson" filled in from it; one with a draft opens that draft.
    await fireEvent.press(screen.getByTestId('sessions-to-record-sch-1-2026-11-03-record'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/record-as-planned',
      params: expect.objectContaining({ student: 'stu-1', tutor: 'me', date: '2026-11-03', start: '16:00', end: '17:00' }),
    });
    await fireEvent.press(screen.getByTestId('sessions-to-record-sch-2-2026-11-03-record'));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { draft: 'd-1' } });
  });

  it('"Record a lesson" opens the lessons still owed; Finance keeps its record sheet', async () => {
    signedInAs(['tutor']);
    mockParams.mockReturnValue({});
    givePages([], allTotals);
    await renderWithProviders(<SessionsScreen />);
    expect(screen.getByTestId('sessions-record-button')).toHaveTextContent(/Record a lesson/);
    // Nothing owed: no card at all.
    expect(screen.queryByTestId('sessions-to-record')).toBeNull();
    await fireEvent.press(screen.getByTestId('sessions-record-button'));
    expect(router.push).toHaveBeenCalledWith('/lessons-owed');
  });

  it('a parent sees no To record', async () => {
    signedInAs(['parent']);
    mockParams.mockReturnValue({});
    givePages([], allTotals);
    mockOwed.mockReturnValue([owed()]);
    await renderWithProviders(<SessionsScreen />);
    expect(screen.queryByTestId('sessions-to-record')).toBeNull();
  });
});

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
    // Recording is offered to the office and tutors.
    expect(screen.getByTestId('sessions-record-button')).toBeTruthy();
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
    // A parent records nothing.
    expect(screen.queryByTestId('sessions-record-button')).toBeNull();
  });
});
