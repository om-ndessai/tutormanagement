// The tutor's Now card and brief (Phase 43) as rendered: the celebration opens the record sheet
// filled in, "Later" puts it off, the next lesson's card and its four brief cards, the assessment
// notes hidden until tapped, and no money anywhere.
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { TutorHome } from '@tmi/shared';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/render';
import { resetCelebratedLessons } from './celebrated-lessons';
import { resetPutOff } from './later';
import { TutorNow } from './tutor-now';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: null, user: { id: 'tutor-1', full_name: 'Alex Chen', roles: ['tutor'] } }),
}));
const mockActive = { current: null as unknown };
jest.mock('@/features/teaching/api', () => ({
  useActiveSession: () => ({ data: { data: { mine: mockActive.current } } }),
}));
const mockHome = { current: null as TutorHome | null };
jest.mock('./api', () => ({
  useTutorHome: () => ({ data: mockHome.current ? { data: mockHome.current } : undefined, refetch: jest.fn() }),
}));

const TODAY = '2026-10-20';
const PLACE = {
  id: 'loc-1',
  owner_user_id: 'tutor-1',
  owner_name: 'Alex Chen',
  name: 'Chapel Hill Public Library',
  kind: 'physical' as const,
  address: '100 Library Dr',
  reminder_minutes: 0,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const NEXT = {
  schedule_id: 'sch-1',
  occurs_on: TODAY,
  start_time: '16:30',
  end_time: '17:30',
  mode: 'in_person' as const,
  student_user_id: 'student-1',
  student_name: 'Sofia Okafor',
  place: PLACE,
  lessons_together: 23,
  together_since: '2026-08-11',
};
const BRIEF: TutorHome['brief'] = {
  last_lesson: { session_id: 's-9', occurred_on: '2026-10-16' },
  homework: { assigned: 'Factor trees, pp. 48-53.', status_before: 'partial' },
  next_topic: {
    topic_id: 'BA4.08',
    code: 'BA4.08',
    name: 'Fractions',
    description: 'Equivalent fractions.',
    current: 2,
    plan_target_on: '2026-12-15',
  },
  assessments: [
    {
      session_id: 's-9',
      author_user_id: 'parent-1',
      author_name: 'Maria Okafor',
      author_role: 'parent',
      rating: 4,
      body: 'Strong on primes.',
      created_at: '2026-10-16T22:00:00Z',
      updated_at: '2026-10-16T22:00:00Z',
    },
  ],
};

function allText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string' || typeof node === 'number') return void out.push(String(node));
    if (Array.isArray(node)) return node.forEach(walk);
    walk((node as { children?: unknown }).children);
  };
  walk(screen.toJSON());
  return out.join(' | ');
}

beforeEach(() => {
  mockActive.current = null;
  resetPutOff();
  resetCelebratedLessons();
  (router.navigate as jest.Mock).mockClear();
  // 3:12 PM in New York (UTC-4).
  jest.useFakeTimers({ now: new Date(`${TODAY}T19:12:00Z`) });
});
afterEach(() => jest.useRealTimers());

describe('TutorNow', () => {
  it('shows nothing for someone who teaches nobody', async () => {
    mockHome.current = { part_of_day: 'afternoon', unrecorded: [], next: null, brief: null };
    await renderWithProviders(<TutorNow />);
    expect(screen.queryByTestId('home-now')).toBeNull();
  });

  it('celebrates a finished lesson; Record it now opens the sheet filled in, Later puts it off', async () => {
    mockHome.current = {
      part_of_day: 'afternoon',
      unrecorded: [{ ...NEXT, start_time: '13:30', end_time: '14:30', homework_last: 'pp. 48-53' }],
      next: null,
      brief: null,
    };
    await renderWithProviders(<TutorNow />);
    expect(screen.getByTestId('home-now-celebrate-title')).toHaveTextContent(
      'Yay! You completed one more lesson with Sofia',
    );
    expect(screen.getByTestId('home-now-celebrate-detail')).toHaveTextContent(
      "That's 24 together since August. It ended at 2:30 PM. Record it while it's fresh.",
    );
    await fireEvent.press(screen.getByTestId('home-now-record'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/record-as-planned',
      params: {
        student: 'student-1',
        tutor: 'tutor-1',
        date: TODAY,
        start: '13:30',
        end: '14:30',
        mode: 'in_person',
        place: 'Chapel Hill Public Library',
        homework: 'Last time: pp. 48-53',
      },
    });
    await act(async () => {
      await fireEvent.press(screen.getByTestId('home-now-later'));
    });
    expect(screen.queryByTestId('home-now-celebrate')).toBeNull();
    expect(allText()).not.toMatch(/\$/);
  });

  it('the next lesson: the message, the four brief cards, the notes hidden until tapped', async () => {
    mockHome.current = { part_of_day: 'afternoon', unrecorded: [], next: NEXT, brief: BRIEF };
    await renderWithProviders(<TutorNow />);
    expect(screen.getByTestId('home-now-greeting')).toHaveTextContent('Good afternoon, Alex');
    expect(screen.getByTestId('home-now-headline')).toHaveTextContent(
      "Sofia's lesson is today at 4:30 PM, in 1 h 18 min",
    );
    expect(screen.getByTestId('home-now-directions')).toBeTruthy();
    // Over 15 minutes to go: See the plan, not Start.
    expect(screen.queryByTestId('home-now-start')).toBeNull();
    expect(screen.getByTestId('home-now-plan')).toBeTruthy();
    for (const id of ['home-brief-homework', 'home-brief-where', 'home-brief-maps', 'home-brief-topic', 'home-brief-notes']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.getByTestId('home-brief-homework-status')).toHaveTextContent('Partly done');
    expect(allText()).not.toContain('Strong on primes.');
    await fireEvent.press(screen.getByTestId('home-brief-notes-show'));
    expect(allText()).toContain('Strong on primes.');
    expect(allText()).toContain('Maria Okafor (Parent)');
    expect(allText()).not.toMatch(/\$/);
  });

  it('offers Start from 15 minutes before, with the student and mode chosen', async () => {
    jest.setSystemTime(new Date(`${TODAY}T20:20:00Z`)); // 4:20 PM
    mockHome.current = { part_of_day: 'afternoon', unrecorded: [], next: NEXT, brief: BRIEF };
    await renderWithProviders(<TutorNow />);
    await fireEvent.press(screen.getByTestId('home-now-start'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/start-lesson',
      params: { student: 'student-1', mode: 'in_person' },
    });
  });

  it('shows no Now card while a lesson runs, but keeps the brief', async () => {
    mockActive.current = { id: 'live-1' };
    mockHome.current = { part_of_day: 'afternoon', unrecorded: [], next: NEXT, brief: BRIEF };
    await renderWithProviders(<TutorNow />);
    expect(screen.queryByTestId('home-now-next')).toBeNull();
    expect(screen.getByTestId('home-brief')).toBeTruthy();
  });

  it('says so when there is no plan or no homework', async () => {
    mockHome.current = {
      part_of_day: 'evening',
      unrecorded: [],
      next: { ...NEXT, occurs_on: '2026-10-21', start_time: '08:00', end_time: '09:00' },
      brief: { ...BRIEF, homework: { assigned: null, status_before: null }, next_topic: null, assessments: [] },
    };
    await renderWithProviders(<TutorNow />);
    expect(screen.getByTestId('home-now-headline')).toHaveTextContent("Sofia's lesson is tomorrow at 8:00 AM");
    expect(screen.getByTestId('home-brief-homework-text')).toHaveTextContent('No homework was set last time.');
    expect(screen.getByTestId('home-brief-topic-none')).toHaveTextContent('No plan yet');
    expect(screen.getByTestId('home-brief-notes-none')).toBeTruthy();
  });
});
