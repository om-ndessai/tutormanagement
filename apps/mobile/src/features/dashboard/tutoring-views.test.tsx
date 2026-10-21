import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { adminDashboard, TODAY, tutorDashboard, upcoming } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminFigures, AdminTutoring, TutorFigures, TutorTutoring } from './tutoring-views';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
const mockUser = { current: undefined as { id: string; roles: string[] } | undefined };
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: null, user: mockUser.current }),
}));
const mockActive = { current: null as unknown };
const mockDrafts = { current: [] as unknown[] };
jest.mock('@/features/teaching/api', () => ({
  useActiveSession: () => ({ data: { data: { mine: mockActive.current } } }),
  useMyDrafts: () => ({ data: { data: mockDrafts.current } }),
}));
// Reduce motion on: the figure must be final at once.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
const mockUpcoming = jest.fn();
jest.mock('@/features/schedules/api', () => ({
  useUpcomingSessions: (tutorUserId?: string) => mockUpcoming(tutorUserId),
}));

beforeEach(() => {
  mockUser.current = undefined;
  mockActive.current = null;
  mockDrafts.current = [];
  jest.useFakeTimers({ now: new Date(`${TODAY}T14:00:00Z`) });
  mockUpcoming.mockReturnValue({
    data: { pages: [{ data: [upcoming()], meta: { offset: 0, limit: 5, has_more: true } }] },
    isPending: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
  });
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
    const element = node as { children?: unknown };
    walk(element.children);
  };
  walk(screen.toJSON());
  return out.join(' | ');
}

describe('Tutoring tab views carry no money', () => {
  it("the admin's renders its sections and no $; no Analytics and no Recent Activity (Phase 43)", async () => {
    await renderWithProviders(<AdminTutoring data={adminDashboard} />);
    for (const id of ['tutoring-sessions', 'progress']) {
      expect(screen.getByTestId(`dashboard-section-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('dashboard-section-analytics')).toBeNull();
    expect(screen.queryByTestId('dashboard-section-recent-activity')).toBeNull();
    expect(screen.queryByTestId('home-figures')).toBeNull();
    expect(screen.queryByTestId('session-money')).toBeNull();
    const text = allText();
    expect(text).toContain('Sofia Okafor');
    expect(text).not.toMatch(/\$/);
    expect(text).not.toMatch(/97\.50|135\.00|1,234/);
  });

  it('the figures row holds the counts, by their old ids, and no money', async () => {
    await renderWithProviders(<AdminFigures data={adminDashboard} />);
    expect(screen.getByTestId('home-figures')).toBeTruthy();
    expect(screen.getByTestId('stat-students-value')).toHaveTextContent('50');
    expect(screen.getByTestId('stat-sessions-running')).toHaveProp(
      'accessibilityLabel',
      'Sessions running: 1',
    );
    expect(allText()).not.toMatch(/\$/);
  });

  it("the tutor's figures row has no money either", async () => {
    await renderWithProviders(<TutorFigures data={tutorDashboard} />);
    expect(screen.getByTestId('stat-sessions-value')).toHaveTextContent('3');
    expect(allText()).not.toMatch(/\$/);
  });

  it("the tutor's adds Student Reflections, narrows the carousel to them, and has no $", async () => {
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    expect(screen.getByTestId('dashboard-section-student-reflections')).toBeTruthy();
    // Phase 43: Recent Activity left every Home; Analytics is the Dashboard screen's.
    expect(screen.queryByTestId('dashboard-section-recent-activity')).toBeNull();
    expect(screen.queryByTestId('home-figures')).toBeNull();
    expect(mockUpcoming).toHaveBeenCalledWith('tutor-1');
    expect(screen.queryByTestId('session-money')).toBeNull();
    expect(allText()).not.toMatch(/\$/);
  });
});

/** The strip lays out only once it knows its width. */
async function layOut() {
  await fireEvent(screen.getByTestId('sessions-carousel'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 200, x: 0, y: 0 } },
  });
}

describe('Finish write-up (UI upgrades U6)', () => {
  const draft = (overrides = {}) => ({
    id: 'draft-1',
    tutor_user_id: 'tutor-1',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    author_user_id: 'tutor-1',
    occurred_on: TODAY,
    started_at: '16:00',
    ended_at: '17:00',
    updated_at: `${TODAY}T18:00:00Z`,
    ...overrides,
  });

  it("offers the tutor's draft from today after Next up, opening the record flow on it", async () => {
    mockDrafts.current = [draft()];
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    expect(screen.getByTestId('home-finish-write-up-lesson')).toHaveTextContent(
      'Sofia Okafor · Today, 4:00–5:00 PM',
    );
    await fireEvent.press(screen.getByTestId('home-finish-write-up-open'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { draft: 'draft-1' } });
    expect(allText()).not.toMatch(/\$/);
  });

  it('offers nothing for an older draft, or while an admin views the tutor', async () => {
    mockDrafts.current = [draft({ occurred_on: '2026-10-06' })];
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    expect(screen.queryByTestId('home-finish-write-up')).toBeNull();
    await screen.unmount();
    mockDrafts.current = [draft()];
    await renderWithProviders(<TutorTutoring data={tutorDashboard} mine={false} />);
    expect(screen.queryByTestId('home-finish-write-up')).toBeNull();
  });
});

describe("Home's Next up card (#43)", () => {
  // 3:30 PM on the organization's clock (New York, UTC-4): a 4 PM lesson today is at hand.
  function atHand(overrides = {}) {
    jest.setSystemTime(new Date(`${TODAY}T19:30:00Z`));
    mockUpcoming.mockReturnValue({
      data: {
        pages: [
          {
            data: [upcoming({ occurs_on: TODAY, ...overrides })],
            meta: { offset: 0, limit: 5, has_more: false },
          },
        ],
      },
      isPending: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
    });
  }

  it('gives an admin viewing a tutor only Cancel', async () => {
    atHand();
    mockUser.current = { id: 'admin-1', roles: ['admin'] };
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    await layOut();
    expect(screen.queryByTestId('carousel-next-start')).toBeNull();
    expect(screen.queryByTestId('carousel-next-record')).toBeNull();
    expect(screen.getByTestId('carousel-next-cancel')).toBeTruthy();
  });

  it('hides Start and Record while a lesson is running', async () => {
    atHand();
    mockUser.current = { id: 'tutor-1', roles: ['tutor'] };
    mockActive.current = { id: 'live-1' };
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    await layOut();
    expect(screen.getByTestId('carousel-next')).toBeTruthy();
    expect(screen.queryByTestId('carousel-next-start')).toBeNull();
    expect(screen.queryByTestId('carousel-next-record')).toBeNull();
  });

  it('shows no buttons to a reader who neither teaches the lesson nor runs the office', async () => {
    atHand();
    mockUser.current = { id: 'someone-else', roles: ['tutor'] };
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    await layOut();
    expect(screen.getByTestId('carousel-next')).toBeTruthy();
    expect(screen.queryByTestId('carousel-next-actions')).toBeNull();
  });

  it('offers its own tutor Start, Record and Cancel, each opening its sheet filled in, with no $', async () => {
    atHand();
    mockUser.current = { id: 'tutor-1', roles: ['tutor'] };
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    await layOut();
    await fireEvent.press(screen.getByTestId('carousel-next-start'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/start-lesson',
      params: { student: 'student-1', mode: 'in_person' },
    });
    await fireEvent.press(screen.getByTestId('carousel-next-record'));
    expect(router.navigate).toHaveBeenCalledWith({
      // The quick sheet that records it as planned (UI upgrades U4), with the place by name.
      pathname: '/record-as-planned',
      params: {
        student: 'student-1',
        tutor: 'tutor-1',
        date: TODAY,
        start: '16:00',
        end: '17:00',
        mode: 'in_person',
        place: 'Room 2',
      },
    });
    await fireEvent.press(screen.getByTestId('carousel-next-cancel'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/cancel-lesson',
      params: { schedule: 'sch-1', date: TODAY },
    });
    expect(allText()).not.toMatch(/\$/);
  });
});
