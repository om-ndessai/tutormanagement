import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ParentDashboard, StudentProgress } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { haptics } from '@/lib/haptics';
import { studentProgress, upcoming } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { resetCelebratedCache } from './celebrations';
import { ChildCard } from './child-card';
import { TodayCard, useToday } from './home-top';
import { ParentView } from './parent-balance-view';

const TODAY = '2026-10-15';
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({
    organization: null,
    user: { id: 'parent-1', full_name: 'Anita Patel', roles: ['parent'] },
  }),
}));
jest.mock('@/lib/haptics', () => ({
  haptics: { success: jest.fn(), selection: jest.fn(), error: jest.fn() },
}));
jest.mock('@/features/progress/api', () => ({
  useTopicIndex: () => ({ levels: [], topics: new Map([['BA3.1', { id: 'BA3.1', name: 'Fractions' }]]) }),
}));
const mockUpcoming = jest.fn();
jest.mock('./home-data', () => ({
  useOrgClock: () => ({ day: '2026-10-15', minutesOfDay: 14 * 60 }),
  useUpcomingThrough: (until: string, tutorUserId?: string) => mockUpcoming(until, tutorUserId),
}));
const mockSessions = jest.fn();
jest.mock('@/features/teaching/api', () => ({
  useSessions: (params: unknown) => mockSessions(params),
}));

const sofia = upcoming({ occurs_on: TODAY, start_time: '16:00', end_time: '17:00' });
const sanjay = upcoming({
  schedule_id: 'sch-2',
  occurs_on: '2026-10-17',
  student_user_id: 'student-2',
  student_name: 'Sanjay Patel',
});
// Someone else's lesson the reader's scope returns (a tutor who also parents, or an admin viewing).
const stranger = upcoming({
  schedule_id: 'sch-3',
  occurs_on: TODAY,
  student_user_id: 'student-9',
  student_name: 'Ben Whitfield',
});

const mastered: StudentProgress = {
  ...studentProgress,
  topics: [{ topic_id: 'BA3.1', baseline: 2, current: 4, last_rated_on: '2026-10-12', mastered: true }],
};

beforeEach(async () => {
  jest.clearAllMocks();
  resetCelebratedCache();
  await AsyncStorage.clear();
  mockUpcoming.mockReturnValue({ data: [sofia, stranger, sanjay], isPending: false, isError: false });
  mockSessions.mockReturnValue({ data: { data: [] }, isPending: false });
});

function Today(props: Parameters<typeof useToday>[0]) {
  const today = useToday(props);
  return <TodayCard summary={today.summary} pending={today.pending} failed={today.failed} />;
}

describe('Today', () => {
  it("counts only the family's lessons, and names the next", async () => {
    await renderWithProviders(<Today who="both" studentIds={['student-1', 'student-2']} horizonDays={14} />);
    expect(screen.getByTestId('home-today-headline')).toHaveTextContent('1 lesson today');
    expect(screen.getByTestId('home-today-detail')).toHaveTextContent('Next at 4:00 PM: Sofia with Alex');
    expect(mockUpcoming).toHaveBeenCalledWith('2026-10-29', undefined);
    await fireEvent.press(screen.getByTestId('home-today-open'));
    expect(router.navigate).toHaveBeenCalledWith('/schedule');
  });

  it("narrows a tutor's at the server, and counts what was recorded today", async () => {
    mockUpcoming.mockReturnValue({ data: [], isPending: false, isError: false });
    mockSessions.mockReturnValue({
      data: { data: [{ student_user_id: 'student-1', occurred_on: TODAY }] },
      isPending: false,
    });
    await renderWithProviders(<Today who="student" tutorUserId="tutor-1" />);
    expect(mockUpcoming).toHaveBeenCalledWith(TODAY, 'tutor-1');
    expect(mockSessions).toHaveBeenCalledWith(
      expect.objectContaining({ from: TODAY, to: TODAY, tutor_user_id: 'tutor-1' }),
    );
    expect(screen.getByTestId('home-today-headline')).toHaveTextContent('1 lesson today');
    expect(screen.getByTestId('home-today-detail')).toHaveTextContent('All done for today.');
  });
});

describe('the child card', () => {
  it('gives the next lesson and this month, in words and a bar', async () => {
    await renderWithProviders(
      <ChildCard
        studentId="student-1"
        name="Sofia Okafor"
        progress={studentProgress}
        next={sofia}
        today={TODAY}
      />,
    );
    expect(screen.getByTestId('home-child-student-1-next')).toHaveTextContent(
      'Next: Today at 4:00 PM with Alex Chen',
    );
    expect(screen.getByTestId('home-child-student-1-month')).toHaveTextContent('No lessons yet this month');
    expect(screen.getByTestId('home-child-student-1-plan')).toHaveTextContent('25% of the plan mastered');
    expect(screen.getByTestId('home-child-student-1-bar')).toBeTruthy();
    expect(screen.queryByTestId('home-celebration-student-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-child-student-1-open'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/progress/[studentId]',
      params: { studentId: 'student-1' },
    });
  });

  it('celebrates a topic mastered lately once on this phone, with a success haptic', async () => {
    await renderWithProviders(
      <ChildCard studentId="student-1" name="Sofia Okafor" progress={mastered} next={null} today={TODAY} />,
    );
    expect(await screen.findByTestId('home-celebration-student-1')).toBeTruthy();
    expect(screen.getByTestId('home-celebration-student-1-text')).toHaveTextContent(
      'Sofia mastered Fractions!',
    );
    expect(haptics.success).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('home-child-student-1-next')).toHaveTextContent(
      'Nothing scheduled in the next two weeks',
    );
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem('tmi.celebrated')) ?? '[]')).toEqual(['student-1:BA3.1']),
    );
    await fireEvent.press(screen.getByTestId('home-celebration-student-1-close'));
    expect(screen.queryByTestId('home-celebration-student-1')).toBeNull();
  });

  it('does not celebrate a topic this phone has celebrated already', async () => {
    await AsyncStorage.setItem('tmi.celebrated', JSON.stringify(['student-1:BA3.1']));
    await renderWithProviders(
      <ChildCard
        studentId="student-1"
        name="Sofia Okafor"
        self
        progress={mastered}
        next={null}
        today={TODAY}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('home-child-student-1')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('home-celebration-student-1')).toBeNull();
    expect(haptics.success).not.toHaveBeenCalled();
  });
});

describe("a parent's Home", () => {
  const parent: ParentDashboard = {
    kind: 'parent',
    children: [
      {
        student_user_id: 'student-1',
        student_name: 'Sofia Okafor',
        guardians: [],
        charged_cents: 18_000,
        paid_cents: 10_000,
        balance_cents: 8_000,
        session_count: 2,
      },
      {
        student_user_id: 'student-2',
        student_name: 'Sanjay Patel',
        guardians: [],
        charged_cents: 0,
        paid_cents: 0,
        balance_cents: 0,
        session_count: 0,
      },
    ],
    totals: { charged_cents: 18_000, paid_cents: 10_000, balance_cents: 8_000 },
    recent_sessions: [],
    recent_payments: [],
    progress: [studentProgress],
    awaiting_reflection: [],
  };

  it('opens with Today and the figures, then a card per child with their own next lesson', async () => {
    await renderWithProviders(<ParentView data={parent} />);
    expect(screen.getByTestId('home-today')).toBeTruthy();
    expect(screen.getByTestId('stat-outstanding')).toHaveProp(
      'accessibilityLabel',
      'Outstanding: $80.00. $100.00 paid',
    );
    expect(screen.getByTestId('home-child-student-1-next')).toHaveTextContent(
      'Next: Today at 4:00 PM with Alex Chen',
    );
    expect(screen.getByTestId('home-child-student-2-next')).toHaveTextContent(
      'Next: Sat, Oct 17 at 4:00 PM with Alex Chen',
    );
    expect(screen.getByTestId('home-child-student-2-plan')).toHaveTextContent('No learning plan yet');
    expect(screen.getByText('Balances')).toBeTruthy();
  });
});
