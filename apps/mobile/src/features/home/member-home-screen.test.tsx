// Phase 66: the member home as rendered, per persona -- the band, the one Next up and its Later, the
// quick actions, the sections in the hats' order (`home-section-<hat>`), the space notes where Tutoring is
// off -- and no money anywhere on it. The children that read their own routes (the Play home, the
// Assessment home, the brief) are stood in for; their own tests cover them.
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { MemberHome } from '@tmi/shared';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/render';
import { resetPutOff } from './later';
import { ALEX, ANITA, INES, MARIA, PRIYA, SOFIA, child } from './member-home-fixtures';
import { MemberHomeScreen } from './member-home-screen';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/haptics', () => ({ haptics: { selection: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }));
jest.mock('@/providers/brand-provider', () => {
  const { PLATFORM_BRAND } = jest.requireActual('@tmi/shared');
  return { useBrand: () => ({ ...PLATFORM_BRAND, short: 'Chapel Hill' }) };
});

const TUTORING = {
  feature_tutoring: true,
  feature_assessment: true,
  feature_quest: true,
  canvas_assessments: false,
  gamify_question_quest: true,
  time_zone: 'America/New_York',
  slug: 'chmi',
};
const ASSESS = { ...TUTORING, feature_tutoring: false, canvas_assessments: true, gamify_question_quest: true, slug: 'assess' };

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const mockHome = { current: null as MemberHome | null };
jest.mock('./api', () => ({
  useMemberHome: () => ({
    data: mockHome.current ? { data: mockHome.current } : undefined,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));
const mockWaiting = { current: [] as { game_id: string; code: string; host_first_name: string; level_id: string; mode: string; question_count: number; duration_seconds: null; status: string }[] };
jest.mock('@/features/play/play-api', () => ({
  useWaitingGames: () => ({ data: { data: mockWaiting.current } }),
  useMemberTiles: () => ({ data: undefined }),
  useLastQuest: () => ({ data: null }),
  useGuestLeadLevel: () => ({ data: null }),
}));
jest.mock('@/features/play/play-home', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    PlayHome: () => <Text testID="play-home">Play</Text>,
    PlayFavorites: () => <Text testID="play-favorites-row">Favorites</Text>,
    WaitingForYou: () => null,
    HaveACode: () => null,
    useStartQuest: () => ({ start: jest.fn(), pending: false }),
  };
});
jest.mock('@/features/dashboard/assessment-home', () => {
  const { Text } = jest.requireActual('react-native');
  return { AssessmentHome: () => <Text testID="assessment-home">Assessments</Text> };
});
jest.mock('@/features/habit/api', () => ({
  useHabit: () => ({ data: { data: { streak_weeks: 3, days_this_week: 1, played_today: false, badges: [] } } }),
  useDaily: () => ({ data: undefined }),
}));
jest.mock('./brief-cards', () => ({ BriefCards: () => null }));
jest.mock('@/features/teaching/api', () => ({ useActiveSession: () => ({ data: { data: { mine: null } } }) }));
jest.mock('@/features/locations/lesson-reminder', () => ({ LessonReminderSheet: () => null }));
jest.mock('@/features/organizations/invitation-banner', () => ({ InvitationBanner: () => null }));
jest.mock('@/features/onboarding/onboarding-provider', () => ({ useOptionalOnboarding: () => null }));
jest.mock('@/features/onboarding/tour-targets', () => ({ useTourScroller: () => undefined, useTourTarget: () => () => undefined }));

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

async function show(home: MemberHome, roles: string[], organization: Record<string, unknown> = TUTORING) {
  mockHome.current = home;
  mockAuth.mockReturnValue({
    user: { id: 'me', full_name: `${home.first_name} Someone`, roles },
    organization,
    invitations: [],
  });
  await renderWithProviders(<MemberHomeScreen />);
}

function sectionOrder(): string[] {
  const ids: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const id = (node as { props?: { testID?: string } }).props?.testID;
    if (id?.startsWith('home-section-')) ids.push(id);
    walk((node as { children?: unknown }).children);
  };
  walk(screen.toJSON());
  return ids;
}

const NO_MONEY = /\$|Charged|Outstanding|Balance|Owed/;

beforeEach(() => {
  resetPutOff();
  mockWaiting.current = [];
  (router.navigate as jest.Mock).mockClear();
  (router.push as jest.Mock).mockClear();
  jest.useFakeTimers({ now: new Date('2026-11-03T19:00:00Z') });
});
afterEach(() => jest.useRealTimers());

describe('MemberHomeScreen', () => {
  it('Alex (tutor): band, reviews in Next up, his quick actions, To record, no money', async () => {
    await show(ALEX, ['tutor']);
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Good afternoon, Alex');
    expect(screen.getByTestId('home-strip')).toHaveTextContent('Today: 1 lesson · 7 to record');
    expect(screen.getByTestId('next-up-reviews_waiting')).toHaveTextContent(/5 assessments to review/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.navigate).toHaveBeenCalledWith('/assessments');
    expect(screen.getByTestId('quick-record_lesson')).toBeTruthy();
    expect(screen.getByTestId('quick-start_lesson')).toBeTruthy();
    expect(sectionOrder()).toEqual(['home-section-tutor']);
    expect(screen.getByTestId('home-to-record')).toBeTruthy();
    expect(screen.getByTestId('home-to-record-sch-2-2026-10-31')).toHaveTextContent(/Sofia/);
    expect(screen.getByTestId('home-to-record-more')).toHaveTextContent(/\+5 more/);
    await fireEvent.press(screen.getByTestId('home-to-record-sch-1-2026-10-27-record'));
    expect(router.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/record-as-planned', params: expect.objectContaining({ date: '2026-10-27', homework: 'Last time: pp. 22-23' }) }),
    );
    expect(screen.getByTestId('home-now-next')).toBeTruthy();
    expect(screen.getByTestId('home-tutor-week')).toHaveTextContent('This week: 2 lessons');
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it('Later puts the item off for today and the next one shows', async () => {
    await show(ALEX, ['tutor']);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('next-up-later'));
    });
    expect(screen.queryByTestId('next-up-reviews_waiting')).toBeNull();
    expect(screen.getByTestId('next-up-lesson_next')).toBeTruthy();
    // Next up IS the Now card for his own lesson (no greeting under the band); the section leaves it out.
    expect(screen.getAllByTestId('home-now-next')).toHaveLength(1);
    expect(screen.queryByTestId('home-now-greeting')).toBeNull();
    expect(screen.getByTestId('next-up-action')).toHaveTextContent(/See the plan/);
  });

  it("Priya (tutor and office): the office's to-record leads Next up; sections in the hats' order", async () => {
    await show(PRIYA, ['tutor', 'admin']);
    expect(screen.getByTestId('next-up-office_to_record')).toHaveTextContent(/24 lessons were not recorded this week/);
    expect(sectionOrder()).toEqual(['home-section-office', 'home-section-tutor']);
    expect(screen.getByTestId('home-office-to-record')).toBeTruthy();
    expect(screen.getByTestId('home-office-invitations')).toHaveTextContent(/2 invitations/);
    expect(screen.getByTestId('home-office-requests')).toBeTruthy();
    expect(screen.getByTestId('home-office-to-record-line-0')).toHaveTextContent(/Yesterday at 5:00 PM · Milo with Imani/);
    await fireEvent.press(screen.getByTestId('home-dashboard-link'));
    expect(router.navigate).toHaveBeenCalledWith('/analytics');
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it("Anita (parent): her child's card with the next lesson and homework, and no money", async () => {
    await show(ANITA, ['parent']);
    expect(screen.getByTestId('next-up-child_next_lesson')).toHaveTextContent(/Thu at 5:00 PM with Priya/);
    expect(screen.getByTestId('home-section-parent')).toBeTruthy();
    expect(screen.getByTestId('home-child-next-sanjay')).toHaveTextContent('Next: Thu at 5:00 PM with Priya');
    expect(screen.getByTestId('home-child-homework-sanjay')).toHaveTextContent(/implicit differentiation/);
    expect(screen.getByTestId('home-child-month-sanjay')).toHaveTextContent('3 lessons this month');
    expect(screen.getByTestId('quick-schedule')).toBeTruthy();
    expect(screen.getByTestId('quick-progress')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-child-sanjay').children[0] as never);
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it('a cancelled lesson is Next up and said on the card', async () => {
    const cancelled = { occurs_on: '2026-11-04', start_time: '17:00', tutor_name: 'Priya Raghavan' };
    await show({ ...ANITA, parent: { children: [child({ cancelled })] } }, ['parent']);
    expect(screen.getByTestId('next-up-child_change')).toHaveTextContent(/Sanjay's lesson tomorrow at 5:00 PM is cancelled/);
    expect(screen.getByTestId('home-child-cancelled-sanjay')).toHaveTextContent('Cancelled: tomorrow at 5:00 PM with Priya');
  });

  it('Sofia (learner): a waiting game is Next up with Join by its code; her section has her lesson and Play', async () => {
    mockWaiting.current = [
      { game_id: 'g1', code: 'ABC123', host_first_name: 'Maria', level_id: 'NC26.4', mode: 'count', question_count: 10, duration_seconds: null, status: 'lobby' },
    ];
    await show(SOFIA, ['student']);
    expect(screen.getByTestId('next-up-game_invite')).toHaveTextContent(/Maria started a game/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quest/join-game', params: { code: 'ABC123' } });
    expect(sectionOrder()).toEqual(['home-section-learner']);
    expect(screen.getByTestId('home-learner-next')).toHaveTextContent(/Tue, Nov 10 at 4:00 PM with Alex/);
    expect(screen.getByTestId('play-home')).toBeTruthy();
    expect(screen.getByTestId('quick-new_quest')).toBeTruthy();
    expect(screen.queryByTestId('play-favorites-row')).toBeNull();
  });

  it('Maria (parent who tutors nobody): her child, and no empty tutor section', async () => {
    await show(MARIA, ['parent', 'tutor']);
    expect(sectionOrder()).toEqual(['home-section-parent']);
    expect(screen.getByTestId('home-child-sofia')).toBeTruthy();
    expect(screen.getByTestId('play-favorites-row')).toBeTruthy();
  });

  it('Ines (a space without Tutoring): learner first, the Assessment home once, no tutoring pieces', async () => {
    await show(INES, ['student', 'admin', 'parent'], ASSESS);
    expect(sectionOrder()).toEqual(['home-section-learner', 'home-section-office', 'home-section-parent']);
    expect(screen.getByTestId('home-strip')).toHaveTextContent('3 weeks in a row');
    expect(screen.getByTestId('next-up-none')).toHaveTextContent(/You're all caught up/);
    expect(screen.getAllByTestId('assessment-home')).toHaveLength(1);
    expect(screen.queryByTestId('home-office-to-record')).toBeNull();
    expect(screen.queryByTestId('home-dashboard-link')).toBeNull();
    expect(screen.queryByTestId('quick-schedule')).toBeNull();
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it('says so in a space with nothing switched on', async () => {
    const none = { ...ASSESS, feature_assessment: false, feature_quest: false };
    await show({ ...INES, hats: ['office'], parent: null, learner: null }, ['admin'], none);
    expect(screen.getByTestId('space-home-empty')).toHaveTextContent(/Nothing is switched on in Chapel Hill yet\./);
  });

  it('says Assessment is off, with Open Space for an admin', async () => {
    const off = { ...ASSESS, canvas_assessments: false };
    await show({ ...INES, hats: ['office'], parent: null, learner: null }, ['admin'], off);
    expect(screen.getByTestId('space-home-assessment-off')).toBeTruthy();
    expect(screen.getByTestId('space-home-organization')).toBeTruthy();
    expect(screen.getByTestId('space-home-quest')).toBeTruthy();
  });
});

describe('MemberHomeScreen, a parent whose child is not added yet', () => {
  it('shows the parent hat, empty, with the word for it', async () => {
    await show({ ...ANITA, parent: { children: [] } }, ['parent']);
    expect(screen.getByTestId('home-section-parent')).toBeTruthy();
    expect(screen.getByTestId('home-children-empty')).toHaveTextContent(
      'No children here yet. Once the space adds your child, their lessons and homework show here.',
    );
  });
});
