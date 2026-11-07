// Phase 66: the member home as rendered, per persona -- the band, the one Next up and its Later, the
// quick actions, the sections in the hats' order (`home-section-<hat>`), the space notes where Tutoring is
// off -- and no money anywhere on it. The children that read their own routes (the Play home, the
// Assessment home, the brief) are stood in for; their own tests cover them.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { openGameLabel, playAgain, type MemberHome } from '@tmi/shared';
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
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
  ToastBridge: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/providers/brand-provider', () => {
  const { PLATFORM_BRAND } = jest.requireActual('@tmi/shared');
  return {
    useBrand: () => ({ ...PLATFORM_BRAND, short: 'Chapel Hill' }),
    // The requests card's space marks (OrgAvatar): initials, with no logo.
    brandLogoUrl: () => null,
  };
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
  usePinHome: () => ({ mutate: mockPin, isPending: false }),
}));
const mockPin = jest.fn();
const mockTiles = { current: [] as { level_id: string }[] };
const mockStart = jest.fn();
const mockWaiting = { current: [] as { game_id: string; code: string; host_first_name: string; level_id: string; mode: string; question_count: number; duration_seconds: null; status: string }[] };
// Phase 73: Continue's read (the open game, else "again"), and whether it was asked for.
const mockOpen = { current: null as unknown, enabled: [] as boolean[] };
jest.mock('@/features/play/play-api', () => ({
  useWaitingGames: () => ({ data: { data: mockWaiting.current } }),
  useMemberTiles: () => ({ data: mockTiles.current.length ? { data: { tiles: mockTiles.current } } : undefined }),
  useOpenGame: (enabled: boolean) => {
    mockOpen.enabled.push(enabled);
    return { data: enabled && mockOpen.current ? { data: mockOpen.current } : undefined };
  },
  useGuestLeadLevel: () => ({ data: null }),
}));
jest.mock('@/features/play/play-home', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    // Phase 74: the board is told what Next up shows (its twin is then quiet); the stand-in says it.
    PlayHome: ({ nextUp }: { nextUp?: string | null }) => <Text testID="play-home">{`Play ${nextUp ?? ''}`}</Text>,
    PlayFavorites: () => <Text testID="play-favorites-row">Favorites</Text>,
    WaitingForYou: () => null,
    HaveACode: () => null,
    useStartQuest: () => ({ start: mockStart, pending: false }),
    openGameFromHome: (gameId: string) => mockOpenGame(gameId),
    openNewQuestFromHome: () => mockNewQuest(),
  };
});
const mockOpenGame = jest.fn();
const mockNewQuest = jest.fn();
jest.mock('@/features/dashboard/assessment-home', () => {
  const { Text } = jest.requireActual('react-native');
  return { AssessmentHome: () => <Text testID="assessment-home">Assessments</Text> };
});
const mockWelcomeBack = { current: false };
// Phase 74: the habit summary's streak and whether they have played here (`played_before`; absent: an older Worker).
const mockHabit = { current: { streak_weeks: 3, played_before: undefined as boolean | undefined } };
jest.mock('@/features/habit/api', () => ({
  useHabit: () => ({
    data: {
      data: {
        streak_weeks: mockHabit.current.streak_weeks,
        days_this_week: 1,
        played_today: false,
        badges: [],
        welcome_back: mockWelcomeBack.current,
        played_before: mockHabit.current.played_before,
      },
    },
  }),
  useDaily: () => ({ data: undefined }),
}));
// Phase 67: the student's Question Quest state (the old landing's read), and whether it was asked for.
const mockQuest = { current: null as { level_id: string | null; question: unknown } | null, enabled: [] as boolean[] };
jest.mock('@/features/quest/api', () => ({
  useQuestState: (enabled: boolean) => {
    mockQuest.enabled.push(enabled);
    return { data: enabled && mockQuest.current ? { data: mockQuest.current } : undefined };
  },
}));
jest.mock('./brief-cards', () => ({ BriefCards: () => null }));
// Phase 75 (JF30): the reader's running lesson, which leads Next up.
const mockActive = { current: null as null | { student_name: string; started_at: string; mode: 'in_person' | 'virtual' } };
jest.mock('@/features/teaching/api', () => ({
  useActiveSession: () => ({ data: { data: { mine: mockActive.current } } }),
}));
jest.mock('@/features/locations/lesson-reminder', () => ({ LessonReminderSheet: () => null }));
jest.mock('@/features/organizations/invitation-banner', () => ({ InvitationBanner: () => null }));
jest.mock('@/features/onboarding/onboarding-provider', () => ({ useOptionalOnboarding: () => null, TourOfferCard: () => null }));
// Phase 74: the band's Play door scrolls to the board when it is on screen (`home-board`), else opens a quest.
const mockBoard = { current: null as null | { view: unknown } };
jest.mock('@/features/onboarding/tour-targets', () => {
  const { View } = jest.requireActual('react-native');
  // The tour's targets: plain views carrying their id, so a test can see the home registered them.
  return {
    useTourScroller: () => undefined,
    useTourTarget: () => () => undefined,
    useTourRegistry: () => ({}),
    resolveTarget: async () => mockBoard.current,
    scrollIntoView: async () => mockBoard.current !== null,
    TourTarget: ({ id, children }: { id: string; children: unknown }) => <View nativeID={id}>{children}</View>,
  };
});

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

async function show(
  home: MemberHome,
  roles: string[],
  organization: Record<string, unknown> = TUTORING,
  auth: Record<string, unknown> = {},
) {
  mockHome.current = home;
  mockAuth.mockReturnValue({
    user: { id: 'me', full_name: `${home.first_name} Someone`, roles },
    organization,
    invitations: [],
    joinRequests: [],
    account: null,
    memberships: [],
    platformAdmin: false,
    ...auth,
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
  mockWelcomeBack.current = false;
  mockHabit.current = { streak_weeks: 3, played_before: undefined };
  mockBoard.current = null;
  mockQuest.current = null;
  mockQuest.enabled = [];
  mockTiles.current = [];
  mockOpen.current = null;
  mockOpen.enabled = [];
  mockActive.current = null;
  mockPin.mockClear();
  mockStart.mockClear();
  mockOpenGame.mockClear();
  mockNewQuest.mockClear();
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
    // Phase 74 (JF6): nobody asking to join -- no "0 asking to join" row; and the band leaves out what Next up says.
    expect(screen.queryByTestId('home-office-requests')).toBeNull();
    expect(screen.queryByTestId('home-office-nothing')).toBeNull();
    expect(screen.getByTestId('home-strip')).toHaveTextContent(/^2 invitations$/);
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
    expect(screen.getByTestId('next-up-game_invite')).toHaveTextContent(/Maria started a quest/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    // From Home (Phase 73, JF36): the game's Exit comes back here.
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quest/join-game', params: { code: 'ABC123', from: 'home' } });
    expect(sectionOrder()).toEqual(['home-section-learner']);
    expect(screen.getByTestId('home-learner-next')).toHaveTextContent(/Tue, Nov 10 at 4:00 PM with Alex/);
    expect(screen.getByTestId('play-home')).toBeTruthy();
    // Phase 74 (JF23): the board carries its own New Quest, so the quick action is not shown beside it.
    expect(screen.queryByTestId('quick-new_quest')).toBeNull();
    expect(screen.getByTestId('quick-join_code')).toBeTruthy();
    expect(screen.queryByTestId('play-favorites-row')).toBeNull();
  });

  it('Maria (parent who tutors nobody): her child, and no empty tutor section', async () => {
    await show(MARIA, ['parent', 'tutor']);
    expect(sectionOrder()).toEqual(['home-section-parent']);
    expect(screen.getByTestId('home-child-sofia')).toBeTruthy();
    expect(screen.getByTestId('play-favorites-row')).toBeTruthy();
  });

  it('Ines (a space without Tutoring): her child first, then the office, then playing; the Assessment home once', async () => {
    await show(INES, ['student', 'admin', 'parent'], ASSESS);
    // Phase 74 (JF6, owner 2026-11-05): the server's order, kept -- no client re-sort puts playing first.
    expect(sectionOrder()).toEqual(['home-section-parent', 'home-section-office', 'home-section-learner']);
    // The band speaks for her child, and of nothing Tutoring's.
    expect(screen.getByTestId('home-strip')).toHaveTextContent('Noor: all caught up');
    expect(screen.getByTestId('home-strip')).not.toHaveTextContent(/lesson/i);
    // The office with nothing to do says so once -- never "0 invitations not yet accepted".
    expect(screen.getByTestId('home-office-nothing')).toHaveTextContent('Nothing needs you right now.');
    expect(screen.queryByTestId('home-office-invitations')).toBeNull();
    expect(screen.queryByTestId('home-office-requests')).toBeNull();
    expect(allText()).not.toMatch(/\b0 (invitations|asking)/);
    expect(screen.getByTestId('next-up-none')).toHaveTextContent(/You're all caught up/);
    expect(screen.getAllByTestId('assessment-home')).toHaveLength(1);
    expect(screen.queryByTestId('home-office-to-record')).toBeNull();
    expect(screen.queryByTestId('home-dashboard-link')).toBeNull();
    expect(screen.queryByTestId('quick-schedule')).toBeNull();
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it('may_assess false (nobody to assess here): no Start an assessment; the office adds people instead', async () => {
    // Playing leads (a learner first): the board's New Quest is on the page, so its quick action is not.
    const playing = { ...INES, hats: ['learner', 'office'] as MemberHome['hats'], parent: null, focus: 'quest' as const };
    await show({ ...playing, may_assess: true }, ['student', 'admin'], ASSESS);
    expect(screen.getByTestId('quick-start_assessment')).toBeTruthy();
    await show({ ...playing, may_assess: false }, ['student', 'admin'], ASSESS);
    expect(screen.queryByTestId('quick-start_assessment')).toBeNull();
    expect(screen.getByTestId('quick-add_person')).toBeTruthy();
  });

  // Phase 79 (M6, docs/members-plan.md): a member -- no role -- plays Quest; the home is the learner's board alone.
  it('a member: the learner section with the board, no Assessment home (nobody to assess), no money', async () => {
    const member: MemberHome = {
      ...SOFIA,
      first_name: 'Mo',
      learner: { next_lesson: null, assessment_in_progress: null, assessment_reviewed: null },
      focus: 'quest',
      may_assess: false,
    };
    const CHMI = { ...TUTORING, canvas_assessments: true };
    await show(member, [], CHMI);
    expect(sectionOrder()).toEqual(['home-section-learner']);
    expect(screen.getByTestId('play-home')).toBeTruthy();
    expect(screen.queryByTestId('assessment-home')).toBeNull();
    expect(screen.queryByTestId('quick-start_assessment')).toBeNull();
    expect(screen.queryByTestId('quick-record_lesson')).toBeNull();
    expect(screen.queryByTestId('home-dashboard-link')).toBeNull();
    expect(allText()).not.toMatch(NO_MONEY);
    // A student there, with someone to assess (themselves): the Assessment home stays with the learner.
    await show({ ...member, first_name: 'Sofia', may_assess: true }, ['student'], CHMI);
    expect(screen.getAllByTestId('assessment-home')).toHaveLength(1);
  });

  it("a member where Quest is off and Assessment on (the seed's chmi): only Quest is said to be off, as the web", async () => {
    const member: MemberHome = {
      ...SOFIA,
      first_name: 'Mo',
      learner: { next_lesson: null, assessment_in_progress: null, assessment_reviewed: null },
      focus: 'quest',
      may_assess: false,
    };
    await show(member, [], { ...TUTORING, canvas_assessments: true, gamify_question_quest: false });
    expect(screen.getByTestId('home-learner-empty')).toHaveTextContent('Nothing to play here yet: Quest is off in this space.');
    expect(allText()).not.toMatch(/Assessments are off/);
    expect(screen.queryByTestId('play-home')).toBeNull();
    expect(screen.queryByTestId('assessment-home')).toBeNull();
  });

  // Phase 80 (A12): placed in a space when approved, a member is offered a space of their own, once, at the very top.
  it('a member placed when approved: the offer of a space of their own leads the home, only while offered', async () => {
    const member: MemberHome = {
      ...SOFIA,
      first_name: 'Pia',
      learner: { next_lesson: null, assessment_in_progress: null, assessment_reviewed: null },
      focus: 'quest',
      may_assess: false,
    };
    const CHMI = { ...TUTORING, name: 'Chapel Hill Math Institute', personal: false };
    await show(member, [], CHMI, { personalSpaceOffer: true, account: { age_band: 'adult' } });
    expect(screen.getByTestId('home-personal-offer-text')).toHaveTextContent(/^You're in Chapel Hill Math Institute\. /);
    const ids: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const id = (node as { props?: { testID?: string } }).props?.testID;
      if (id === 'home-personal-offer' || id === 'home-band') ids.push(id);
      walk((node as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    expect(ids).toEqual(['home-personal-offer', 'home-band']);
    await show(member, [], CHMI, { personalSpaceOffer: false, account: { age_band: 'adult' } });
    expect(screen.queryByTestId('home-personal-offer')).toBeNull();
  });

  it('with nobody to assess, the learner leaves the Assessment home to the office where Tutoring is off (Phase 79)', async () => {
    const playing = { ...INES, hats: ['learner', 'office'] as MemberHome['hats'], parent: null, focus: 'quest' as const };
    await show({ ...playing, may_assess: false }, ['admin'], ASSESS);
    expect(screen.getAllByTestId('assessment-home')).toHaveLength(1);
    expect(within(screen.getByTestId('home-section-office')).getByTestId('assessment-home')).toBeTruthy();
    expect(within(screen.getByTestId('home-section-learner')).queryByTestId('assessment-home')).toBeNull();
  });

  it('one rule for adding people (JF22): a 13-17 admin is not offered Add a person', async () => {
    const office = { ...INES, hats: ['office'] as MemberHome['hats'], parent: null, learner: null };
    await show(office, ['admin'], ASSESS, { account: { age_band: 'adult' } });
    expect(screen.getByTestId('quick-add_person')).toBeTruthy();
    await show(office, ['admin'], ASSESS, { account: { age_band: '13-17' } });
    expect(screen.queryByTestId('quick-add_person')).toBeNull();
  });

  it('Your requests sits above Next up, and only when there is a request (JF5)', async () => {
    await show(INES, ['student', 'admin', 'parent'], ASSESS);
    expect(screen.queryByTestId('home-requests')).toBeNull();
    await show(INES, ['student', 'admin', 'parent'], ASSESS, {
      joinRequests: [
        {
          slug: 'riverside',
          name: 'Riverside Tutoring',
          short_name: 'Riverside',
          palette: 'teal',
          logo_mark_url: null,
          requested_at: '2026-11-01T12:00:00Z',
          outcome: 'declined',
          answered_at: '2026-11-03T15:00:00Z',
        },
      ],
    });
    expect(screen.getByTestId('home-request-riverside')).toHaveTextContent(/Riverside Tutoring did not let you in/);
    const ids: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const id = (node as { props?: { testID?: string } }).props?.testID;
      if (id) ids.push(id);
      walk((node as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    expect(ids.indexOf('home-requests')).toBeGreaterThan(-1);
    expect(ids.indexOf('home-requests')).toBeLessThan(ids.indexOf('next-up-none'));
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

describe('Phase 67: Next up carries what QuestLanding did, and welcome back', () => {
  it("Sofia (student): her Quest's waiting question is Next up, and opens Question Quest", async () => {
    mockQuest.current = { level_id: 'BA3', question: { id: 'q1' } };
    await show(SOFIA, ['student']);
    expect(screen.getByTestId('next-up-question_quest')).toHaveTextContent(/Your Quest has a question waiting\./);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.push).toHaveBeenCalledWith('/quest/play');
  });

  it('nothing to answer: no Quest card, and only a student reads the Quest state', async () => {
    mockQuest.current = { level_id: 'BA3', question: null };
    await show(SOFIA, ['student']);
    expect(screen.queryByTestId('next-up-question_quest')).toBeNull();
    mockQuest.enabled = [];
    await show(ALEX, ['tutor']);
    expect(mockQuest.enabled.every((on) => !on)).toBe(true);
  });

  it('back after a week away: a kind welcome by first name, never a loss', async () => {
    mockWelcomeBack.current = true;
    await show(SOFIA, ['student']);
    const card = screen.getByTestId('next-up-welcome_back');
    expect(card).toHaveTextContent(/Welcome back, Sofia\./);
    expect(card).toHaveTextContent(/A fresh week starts today\./);
    expect(allText()).not.toMatch(/lost|broke|missed/i);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    // From Home (JF36): the game it makes exits back here.
    expect(mockNewQuest).toHaveBeenCalled();
  });
});

describe('Phase 73: Continue in Next up is the server’s open game, else "again"', () => {
  const SHAPE = { level_id: 'NC26.7' as const, level_scope: 'level' as const, mode: 'count' as const, question_count: 5, duration_seconds: null };

  it('an open game: "Pick up where you left off", in words with where she is; Continue opens it (no new game)', async () => {
    mockOpen.current = {
      open: {
        game_id: 'g-open',
        status: 'running',
        label: openGameLabel({ ...SHAPE, status: 'running', question: 3, of: 5, points: 2 }),
        question: 3,
        of: 5,
        points: 2,
      },
      again: null,
    };
    await show({ ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null } }, ['student']);
    const card = screen.getByTestId('next-up-open_game');
    expect(card).toHaveTextContent(/Pick up where you left off/);
    expect(card).toHaveTextContent(/Grade 7 Quick 5 · question 3 of 5 · 2 points/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(mockOpenGame).toHaveBeenCalledWith('g-open');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('none open: "Play Grade 7 Quick 5 again" starts its settings in one request', async () => {
    const again = playAgain(SHAPE);
    mockOpen.current = { open: null, again };
    await show({ ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null } }, ['student']);
    const card = screen.getByTestId('next-up-continue_quest');
    expect(card).toHaveTextContent(/Play again/);
    expect(card).toHaveTextContent(/Play Grade 7 Quick 5 again\./);
    expect(card).not.toHaveTextContent(/Pick up where you left off/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(mockStart).toHaveBeenCalledWith(again.request);
  });

  it('is read only for a learner where Quest is on', async () => {
    await show(ALEX, ['tutor']);
    expect(mockOpen.enabled.every((on) => !on)).toBe(true);
    mockOpen.enabled = [];
    await show(SOFIA, ['student']);
    expect(mockOpen.enabled.some((on) => on)).toBe(true);
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

describe('Phase 68: focus and families', () => {
  it('Make this my home: Automatic and each choice, the chosen one checked; a tap pins it', async () => {
    await show({ ...MARIA, focus: 'family', pin: null, focus_options: ['assessment', 'family'] }, ['parent', 'tutor']);
    expect(screen.getByTestId('home-pin')).toBeTruthy();
    expect(screen.getByTestId('home-pin-auto')).toHaveTextContent('Automatic (My children)');
    expect(screen.getByTestId('home-pin-auto')).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(screen.getByTestId('home-pin-family')).toHaveProp('accessibilityState', expect.objectContaining({ selected: false }));
    expect(screen.getByTestId('home-pin-family')).toHaveTextContent('My children');
    await fireEvent.press(screen.getByTestId('home-pin-family'));
    expect(mockPin).toHaveBeenCalledWith('family', expect.anything());
  });

  it('no pin row with a single option', async () => {
    await show({ ...SOFIA, focus: 'quest', pin: null, focus_options: ['quest'] }, ['student']);
    expect(screen.queryByTestId('home-pin')).toBeNull();
  });

  it('a pinned focus leads the sections', async () => {
    await show({ ...PRIYA, focus: 'tutoring', pin: 'tutoring', focus_options: ['tutoring', 'office'] }, ['tutor', 'admin']);
    expect(sectionOrder()).toEqual(['home-section-tutor', 'home-section-office']);
    expect(screen.getByTestId('home-pin-auto')).toHaveTextContent(/^Automatic$/);
  });

  it("a parent's card: days played, and Play with starts a game of two with the child invited", async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    const kid = child({ days_played_this_week: 2, daily_done_today: true, next_lesson: null });
    await show({ ...ANITA, parent: { children: [kid] } }, ['parent']);
    expect(screen.getByTestId('home-child-played-sanjay')).toHaveTextContent("Played 2 days this week (aim: 3) · today's Daily done");
    expect(screen.getByTestId('home-child-play-sanjay')).toHaveTextContent(/Play with Sanjay$/);
    await fireEvent.press(screen.getByTestId('home-child-play-sanjay'));
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ level_id: 'NC26.4', players: 'multi', host_plays: true, invite_user_ids: ['sanjay'] }),
    );
  });

  it("the child's own last level wins, and a lesson soon makes it practice together", async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    await show({ ...ANITA, parent: { children: [child({ days_played_this_week: 0, daily_done_today: false, play_level_id: 'BA3' })] } }, ['parent']);
    expect(screen.getByTestId('home-child-play-sanjay')).toHaveTextContent(/Practise together before Thursday's lesson$/);
    await fireEvent.press(screen.getByTestId('home-child-play-sanjay'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ level_id: 'BA3' }));
  });

  // Phase 77 (JF15): a child who does not sign in plays on this device, at their grade, in one request.
  it('Play with a child who does not sign in is a game on this device, at the child’s grade', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }, { level_id: 'NC26.5' }];
    const ben = child({ student_user_id: 'ben', first_name: 'Ben', signs_in: false, grade: 5, next_lesson: null, days_played_this_week: 0 });
    await show({ ...ANITA, first_name: 'Tom', parent: { children: [ben] } }, ['parent']);
    expect(screen.getByTestId('home-child-play-ben')).toHaveTextContent(/Play with Ben on this device$/);
    // The button says where; the line under it is for "Practise together", which does not.
    expect(screen.queryByTestId('home-child-on-device-ben')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-child-play-ben'));
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ level_id: 'NC26.5', players: 'multi', host_plays: true, seat_user_ids: ['ben'] }),
    );
    expect(mockStart.mock.calls[0]![0]).not.toHaveProperty('invite_user_ids');
  });

  it('Continue with Ben reopens the game still running, rather than starting another', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    const ben = child({ student_user_id: 'ben', first_name: 'Ben', signs_in: false, open_game_id: 'g-77', next_lesson: null });
    await show({ ...ANITA, first_name: 'Tom', parent: { children: [ben] } }, ['parent']);
    expect(screen.getByTestId('home-child-continue-ben')).toHaveTextContent(/Continue with Ben$/);
    expect(screen.queryByTestId('home-child-play-ben')).toBeNull();
    expect(screen.queryByTestId('home-child-on-device-ben')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-child-continue-ben'));
    expect(mockOpenGame).toHaveBeenCalledWith('g-77');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('Practise together with a child on this device says where under the button', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    const ben = child({ student_user_id: 'ben', first_name: 'Ben', signs_in: false });
    await show({ ...ANITA, first_name: 'Tom', parent: { children: [ben] } }, ['parent']);
    expect(screen.getByTestId('home-child-play-ben')).toHaveTextContent(/Practise together before Thursday's lesson$/);
    expect(screen.getByTestId('home-child-on-device-ben')).toHaveTextContent('Ben plays beside you, on this device.');
    await fireEvent.press(screen.getByTestId('home-child-play-ben'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ seat_user_ids: ['ben'] }));
  });

  it('a child who signs in keeps the online invite, with no hint', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    await show({ ...ANITA, parent: { children: [child({ signs_in: true, next_lesson: null })] } }, ['parent']);
    expect(screen.getByTestId('home-child-play-sanjay')).toHaveTextContent(/Play with Sanjay$/);
    expect(screen.queryByTestId('home-child-on-device-sanjay')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-child-play-sanjay'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ invite_user_ids: ['sanjay'] }));
    expect(mockStart.mock.calls[0]![0]).not.toHaveProperty('seat_user_ids');
  });

  it('Quest off: no played line and no Play with', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    const off = { ...TUTORING, feature_quest: false };
    await show({ ...ANITA, parent: { children: [child({ days_played_this_week: null })] } }, ['parent'], off);
    expect(screen.queryByTestId('home-child-played-sanjay')).toBeNull();
    expect(screen.queryByTestId('home-child-play-sanjay')).toBeNull();
  });

  it('the parent card shows in a space without Tutoring too', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    await show({ ...ANITA, parent: { children: [child({ days_played_this_week: 1, next_lesson: null })] } }, ['parent'], ASSESS);
    expect(screen.getByTestId('home-child-sanjay')).toBeTruthy();
    expect(screen.getByTestId('home-child-play-sanjay')).toBeTruthy();
  });

  it('an assessment-led home puts Assessments before the Quest board', async () => {
    await show({ ...INES, focus: 'assessment' }, ['student', 'admin', 'parent'], ASSESS);
    const ids: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const id = (node as { props?: { testID?: string } }).props?.testID;
      if (id === 'assessment-home' || id === 'play-home') ids.push(id);
      walk((node as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    expect(ids).toEqual(['assessment-home', 'play-home']);
  });

  it('the Next up for an assessment-led home with nothing else opens Assessments', async () => {
    await show({ ...INES, focus: 'assessment', focus_options: ['assessment', 'quest'] }, ['student', 'admin', 'parent'], ASSESS);
    expect(screen.getByTestId('next-up-focus_default')).toHaveTextContent(/Start an assessment\./);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.navigate).toHaveBeenCalledWith('/assessments');
  });
});

describe('Your learning and the child card, with sets off', () => {
  const NONE = { ...ASSESS, feature_assessment: false, feature_quest: false };

  it('names the section "Your learning"', async () => {
    await show(SOFIA, ['student']);
    expect(screen.getByTestId('home-section-learner')).toHaveTextContent(/^Your learning/);
    expect(allText()).not.toMatch(/\bPractice\b/);
  });

  it("Sofia: Next up names her lesson, so her section leaves its own card out", async () => {
    await show(SOFIA, ['student']);
    expect(screen.getByTestId('next-up-learner_lesson')).toBeTruthy();
    expect(screen.queryByTestId('home-learner-next-card')).toBeNull();
    expect(screen.getByTestId('play-home')).toBeTruthy();
    expect(screen.queryByTestId('home-learner-empty')).toBeNull();
  });

  it('every set off: one muted line in Your learning, and no quest offered anywhere', async () => {
    const home = { ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null }, focus: 'quest' as const, focus_options: [] };
    await show(home, ['student'], NONE);
    expect(screen.getByTestId('home-learner-empty')).toHaveTextContent(
      'Nothing to practise here yet: Quest and Assessments are off in this space.',
    );
    expect(screen.queryByTestId('play-home')).toBeNull();
    expect(screen.queryByTestId('assessment-home')).toBeNull();
    expect(screen.queryByTestId('next-up-focus_default')).toBeNull();
    expect(screen.queryByTestId('quick-new_quest')).toBeNull();
    expect(allText()).not.toMatch(/Start a quest|New [Qq]uest/);
  });

  it('a lesson in the section is not "empty", with Quest and Assessments off', async () => {
    mockWaiting.current = [];
    const home = { ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: SOFIA.learner!.next_lesson } };
    await show(home, ['student'], { ...TUTORING, feature_assessment: false, feature_quest: false });
    // Next up shows it, so the section has nothing else: the line, not a second copy of the lesson.
    expect(screen.getByTestId('next-up-learner_lesson')).toBeTruthy();
    expect(screen.queryByTestId('home-learner-next-card')).toBeNull();
    expect(screen.getByTestId('home-learner-empty')).toBeTruthy();
  });

  it('a child card with Tutoring and Quest off: Assessments where it is on, opening the Assessment page', async () => {
    const off = { ...ASSESS, feature_quest: false };
    await show({ ...ANITA, parent: { children: [child({ next_lesson: null })] } }, ['parent'], off);
    expect(screen.queryByTestId('home-child-next-sanjay')).toBeNull();
    expect(screen.queryByTestId('home-child-month-sanjay')).toBeNull();
    expect(screen.queryByTestId('home-child-off-sanjay')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-child-assessments-sanjay'));
    expect(router.navigate).toHaveBeenCalledWith('/assessments');
  });

  it('a child card with every set off says lessons and quests are off', async () => {
    await show({ ...ANITA, parent: { children: [child({ next_lesson: null })] } }, ['parent'], NONE);
    expect(screen.getByTestId('home-child-off-sanjay')).toHaveTextContent('Lessons and quests are off in this space.');
    expect(screen.queryByTestId('home-child-assessments-sanjay')).toBeNull();
    expect(screen.queryByTestId('home-child-play-sanjay')).toBeNull();
  });

  it('a child card where Tutoring is on keeps its lessons and no fallback', async () => {
    await show(ANITA, ['parent']);
    expect(screen.getByTestId('home-child-next-sanjay')).toBeTruthy();
    expect(screen.queryByTestId('home-child-assessments-sanjay')).toBeNull();
    expect(screen.queryByTestId('home-child-off-sanjay')).toBeNull();
  });
});

describe('the tour lights the home’s blocks (Phase 66)', () => {
  const ids = () => {
    const out: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const id = (node as { props?: { nativeID?: string } }).props?.nativeID;
      if (id) out.push(id);
      walk((node as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    return out;
  };

  it('registers the band, Next up and To record for a tutor', async () => {
    await show(ALEX, ['tutor']);
    expect(ids()).toEqual(expect.arrayContaining(['home-band', 'home-next-up', 'home-to-record']));
  });

  it("registers a parent's section", async () => {
    await show(ANITA, ['parent']);
    expect(ids()).toEqual(expect.arrayContaining(['home-band', 'home-next-up', 'home-section-parent']));
    expect(ids()).not.toContain('home-to-record');
  });
});

describe('Phase 74: the first home', () => {
  const NEWCOMER: MemberHome = {
    ...SOFIA,
    first_name: 'Nina',
    personal: true,
    learner: { ...SOFIA.learner!, next_lesson: null },
    focus: 'quest',
    focus_options: ['quest', 'assessment'],
  };

  it('a learner who has not played here: three doors in the band and "Start a streak", never a zero (JF6, JF16)', async () => {
    mockHabit.current = { streak_weeks: 0, played_before: false };
    await show(NEWCOMER, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: 'adult' } });
    expect(screen.getByTestId('home-strip')).toHaveTextContent('Start a streak: play on three days this week.');
    // (A button's text starts with its icon's glyph.)
    expect(screen.getByTestId('home-door-play')).toHaveTextContent(/Play$/);
    expect(screen.getByTestId('home-door-code')).toHaveTextContent(/Join with a code$/);
    expect(screen.getByTestId('home-door-start')).toHaveTextContent(/Start a space$/);
    expect(allText()).not.toMatch(/0 of 3/);
    // The doors' twins are not repeated as quick actions.
    expect(screen.queryByTestId('quick-join_code')).toBeNull();
    expect(screen.queryByTestId('quick-new_quest')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-door-code'));
    expect(router.push).toHaveBeenCalledWith('/have-a-code');
    await fireEvent.press(screen.getByTestId('home-door-start'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/spaces', params: { start: '1' } });
  });

  it('Play goes down to the board when it is on screen, else opens a quest', async () => {
    mockHabit.current = { streak_weeks: 0, played_before: false };
    await show(NEWCOMER, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: 'adult' } });
    await act(async () => {
      await fireEvent.press(screen.getByTestId('home-door-play'));
    });
    expect(mockNewQuest).toHaveBeenCalledTimes(1);
    mockBoard.current = { view: {} };
    await act(async () => {
      await fireEvent.press(screen.getByTestId('home-door-play'));
    });
    expect(mockNewQuest).toHaveBeenCalledTimes(1);
  });

  it('no Start a space for a 13-17, and no doors once they have played (or from an older Worker)', async () => {
    mockHabit.current = { streak_weeks: 0, played_before: false };
    await show(NEWCOMER, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: '13-17' } });
    expect(screen.getByTestId('home-door-code')).toBeTruthy();
    expect(screen.queryByTestId('home-door-start')).toBeNull();
    mockHabit.current = { streak_weeks: 0, played_before: true };
    await show(NEWCOMER, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: 'adult' } });
    expect(screen.queryByTestId('home-doors')).toBeNull();
    expect(screen.getByTestId('home-strip')).toHaveTextContent('Start a streak');
    mockHabit.current = { streak_weeks: 0, played_before: undefined };
    await show(NEWCOMER, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: 'adult' } });
    expect(screen.queryByTestId('home-doors')).toBeNull();
  });

  it('open assessments: the office says how many, with a link to Assessments, and comes first today (JF6)', async () => {
    await show({ ...INES, office: { ...INES.office!, assessments_open: 2 } }, ['student', 'admin', 'parent'], ASSESS);
    expect(sectionOrder()[0]).toBe('home-section-office');
    expect(screen.getByTestId('home-office-assessments')).toHaveTextContent(/2 assessments not yet reviewed/);
    expect(screen.queryByTestId('home-office-nothing')).toBeNull();
    expect(screen.getByTestId('home-strip')).toHaveTextContent('2 assessments to review');
    await fireEvent.press(screen.getByTestId('home-office-assessments'));
    expect(router.navigate).toHaveBeenCalledWith('/assessments');
  });

  it("a child's card opens the child where Tutoring is off, their progress where it is on", async () => {
    await show(ANITA, ['parent'], ASSESS);
    await fireEvent.press(screen.getByTestId('home-child-link-sanjay'));
    expect(router.navigate).toHaveBeenLastCalledWith({ pathname: '/people/[id]', params: { id: 'sanjay' } });
    await show(ANITA, ['parent']);
    await fireEvent.press(screen.getByTestId('home-child-link-sanjay'));
    expect(router.navigate).toHaveBeenLastCalledWith(
      { pathname: '/progress/[studentId]', params: { studentId: 'sanjay' } },
      { withAnchor: true },
    );
  });

  it('a lesson line says where, and a learner may practise for it from there (JF17)', async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    const place = { name: 'Institute, room 2', kind: 'physical' as const };
    const sofia = { ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: { ...SOFIA.learner!.next_lesson!, place } } };
    await show(sofia, ['student']);
    // Seven days out: not yet "before your lesson", so Next up names the lesson, with its place.
    expect(screen.getByTestId('next-up-learner_lesson')).toHaveTextContent(/Tue, Nov 10 at 4:00 PM with Alex · Institute, room 2\./);
    await fireEvent.press(screen.getByTestId('next-up-practise'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ level_id: 'NC26.4', players: 'single', question_count: 5 }));
    // An invitation leads instead: the section's own lesson card says where, and its line starts practice.
    mockStart.mockClear();
    mockWaiting.current = [
      { game_id: 'g1', code: 'ABC123', host_first_name: 'Maria', level_id: 'NC26.4', mode: 'count', question_count: 10, duration_seconds: null, status: 'lobby' },
    ];
    await show(sofia, ['student']);
    expect(screen.getByTestId('home-learner-next')).toHaveTextContent('Tue, Nov 10 at 4:00 PM with Alex · Institute, room 2');
    expect(screen.getByTestId('home-learner-practise')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-learner-next-line'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ level_id: 'NC26.4' }));
  });

  it("a parent's lesson lines say where too", async () => {
    const place = { name: 'Online room', kind: 'virtual' as const };
    const kid = child({ next_lesson: { ...child().next_lesson!, place } });
    await show({ ...ANITA, parent: { children: [kid] } }, ['parent']);
    expect(screen.getByTestId('home-child-next-sanjay')).toHaveTextContent('Next: Thu at 5:00 PM with Priya · Online room');
    expect(screen.getByTestId('next-up-child_next_lesson')).toHaveTextContent(/with Priya · Online room/);
    // Next up names the lesson, so the band does not (JF23).
    expect(screen.queryByTestId('home-strip')).toBeNull();
  });

  it('the board is told what Next up shows, so its own Continue is the quiet twin (JF23)', async () => {
    mockOpen.current = {
      open: { game_id: 'g-open', status: 'running', label: 'Grade 7 Quick 5', question: 1, of: 5, points: 0 },
      again: null,
    };
    await show({ ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null } }, ['student']);
    expect(screen.getByTestId('next-up-open_game')).toBeTruthy();
    expect(screen.getByTestId('play-home')).toHaveTextContent('Play open_game');
  });
});

describe('Phase 75 (JF19, JF30): the lessons owed, one way, from Home', () => {
  const DRAFT = { id: 'draft-7', updated_at: '2026-11-03T17:43:00Z' };

  it('a running lesson leads Next up, with Stop and how long it has run -- no money', async () => {
    mockActive.current = { student_name: 'Sofia Okafor', started_at: '2026-11-03T18:48:00Z', mode: 'in_person' };
    await show(ALEX, ['tutor']);
    expect(screen.getByTestId('next-up-lesson_running')).toHaveTextContent(/Your lesson with Sofia is running\./);
    expect(screen.getByTestId('next-up-detail')).toHaveTextContent('Running 12 min · In person');
    // It cannot be put off: it is under way.
    expect(screen.queryByTestId('next-up-later')).toBeNull();
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.navigate).toHaveBeenCalledWith('/stop-lesson');
    expect(allText()).not.toMatch(NO_MONEY);
  });

  it('a To record row with the reader’s draft says when it was kept, and Continue opens that draft', async () => {
    const home = {
      ...ALEX,
      tutor: { ...ALEX.tutor!, to_record: [{ ...ALEX.tutor!.to_record[0]!, draft: DRAFT }, ALEX.tutor!.to_record[1]!] },
    };
    await show(home, ['tutor']);
    expect(screen.getByTestId('home-to-record-sch-2-2026-10-31-draft')).toHaveTextContent('Draft saved 12:43 PM');
    expect(screen.getByTestId('home-to-record-sch-2-2026-10-31-record')).toHaveTextContent('Continue');
    await fireEvent.press(screen.getByTestId('home-to-record-sch-2-2026-10-31-record'));
    expect(router.navigate).toHaveBeenLastCalledWith({ pathname: '/record-lesson', params: { draft: 'draft-7' } });
    // A row without one still records it as planned; "+5 more" opens the whole list of lessons owed.
    expect(screen.getByTestId('home-to-record-sch-1-2026-10-27-record')).toHaveTextContent('Record');
    await fireEvent.press(screen.getByTestId('home-to-record-more'));
    expect(router.navigate).toHaveBeenLastCalledWith('/lessons-owed');
  });

  it('Next up’s finished lesson with a draft continues it, never a second one', async () => {
    const lesson = { ...ALEX.tutor!.to_record[0]!, occurs_on: '2026-11-03', draft: DRAFT };
    const home = { ...ALEX, tutor: { ...ALEX.tutor!, now: { ...ALEX.tutor!.now, unrecorded: [lesson] } } };
    await show(home, ['tutor']);
    expect(screen.getByTestId('next-up-lesson_unrecorded')).toBeTruthy();
    expect(screen.getByTestId('home-now-celebrate-draft')).toHaveTextContent('Draft saved 12:43 PM');
    expect(screen.getByTestId('next-up-action')).toHaveTextContent('Continue');
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { draft: 'draft-7' } });
  });

  it('"Record a lesson" opens the lessons still owed; the office’s to-record does too', async () => {
    await show(ALEX, ['tutor']);
    await fireEvent.press(screen.getByTestId('quick-record_lesson'));
    expect(router.navigate).toHaveBeenLastCalledWith('/lessons-owed');
    await show(PRIYA, ['tutor', 'admin']);
    expect(screen.getByTestId('next-up-action')).toHaveTextContent(/Record them/);
    await fireEvent.press(screen.getByTestId('next-up-action'));
    expect(router.navigate).toHaveBeenLastCalledWith('/lessons-owed');
    await fireEvent.press(screen.getByTestId('home-office-to-record'));
    expect(router.navigate).toHaveBeenLastCalledWith('/lessons-owed');
  });
});

describe('Phase 76 (JF21): one Add chooser from Home', () => {
  it('the office’s "Add a person" opens the chooser', async () => {
    const office = { ...INES, hats: ['office'] as MemberHome['hats'], parent: null, learner: null };
    await show(office, ['admin'], ASSESS, { account: { age_band: 'adult' } });
    // Phase 78: the glossary's words, the same as the web's (`QUICK_ACTION_LABELS`), never "Add someone".
    expect(screen.getByTestId('quick-add_person')).toHaveTextContent(/Add a person$/);
    await fireEvent.press(screen.getByTestId('quick-add_person'));
    expect(router.navigate).toHaveBeenLastCalledWith('/add');
  });

  it('a personal space’s adult is offered "Add my child" (no office hat there); a teen is not', async () => {
    const mine: MemberHome = { ...SOFIA, first_name: 'Nina', personal: true, focus: 'quest' };
    await show(mine, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: 'adult' } });
    expect(screen.getByTestId('quick-add_person')).toHaveTextContent(/Add my child$/);
    await fireEvent.press(screen.getByTestId('quick-add_person'));
    expect(router.navigate).toHaveBeenLastCalledWith('/add');
    await show(mine, ['admin'], { ...ASSESS, personal: true }, { account: { age_band: '13-17' } });
    expect(screen.queryByTestId('quick-add_person')).toBeNull();
  });
});
