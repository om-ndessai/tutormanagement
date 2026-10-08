import { screen } from '@testing-library/react-native';

import { adminDashboard, TODAY, tutorDashboard, upcoming } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminTutoring, TutorTutoring } from './tutoring-views';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: null }),
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
  it("the admin's renders its four sections and no $", async () => {
    await renderWithProviders(<AdminTutoring data={adminDashboard} />);
    for (const id of ['analytics', 'tutoring-sessions', 'progress', 'recent-activity']) {
      expect(screen.getByTestId(`dashboard-section-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('stat-students-value')).toHaveTextContent('50');
    expect(screen.queryByTestId('session-money')).toBeNull();
    const text = allText();
    expect(text).toContain('Sofia Okafor');
    expect(text).not.toMatch(/\$/);
    expect(text).not.toMatch(/97\.50|135\.00|1,234/);
  });

  it("the tutor's adds Student Reflections, narrows the carousel to them, and has no $", async () => {
    await renderWithProviders(<TutorTutoring data={tutorDashboard} />);
    expect(screen.getByTestId('dashboard-section-student-reflections')).toBeTruthy();
    expect(mockUpcoming).toHaveBeenCalledWith('tutor-1');
    expect(screen.queryByTestId('session-money')).toBeNull();
    expect(allText()).not.toMatch(/\$/);
  });
});
