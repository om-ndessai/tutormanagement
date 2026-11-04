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
  usePinHome: () => ({ mutate: mockPin, isPending: false }),
}));
const mockPin = jest.fn();
const mockTiles = { current: [] as { level_id: string }[] };
const mockStart = jest.fn();
const mockWaiting = { current: [] as { game_id: string; code: string; host_first_name: string; level_id: string; mode: string; question_count: number; duration_seconds: null; status: string }[] };
jest.mock('@/features/play/play-api', () => ({
  useWaitingGames: () => ({ data: { data: mockWaiting.current } }),
  useMemberTiles: () => ({ data: mockTiles.current.length ? { data: { tiles: mockTiles.current } } : undefined }),
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
    useStartQuest: () => ({ start: mockStart, pending: false }),
  };
});
jest.mock('@/features/dashboard/assessment-home', () => {
  const { Text } = jest.requireActual('react-native');
  return { AssessmentHome: () => <Text testID="assessment-home">Assessments</Text> };
});
const mockWelcomeBack = { current: false };
jest.mock('@/features/habit/api', () => ({
  useHabit: () => ({
    data: {
      data: { streak_weeks: 3, days_this_week: 1, played_today: false, badges: [], welcome_back: mockWelcomeBack.current },
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
jest.mock('@/features/teaching/api', () => ({ useActiveSession: () => ({ data: { data: { mine: null } } }) }));
jest.mock('@/features/locations/lesson-reminder', () => ({ LessonReminderSheet: () => null }));
jest.mock('@/features/organizations/invitation-banner', () => ({ InvitationBanner: () => null }));
jest.mock('@/features/onboarding/onboarding-provider', () => ({ useOptionalOnboarding: () => null }));
jest.mock('@/features/onboarding/tour-targets', () => {
  const { View } = jest.requireActual('react-native');
  // The tour's targets: plain views carrying their id, so a test can see the home registered them.
  return {
    useTourScroller: () => undefined,
    useTourTarget: () => () => undefined,
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
  mockWelcomeBack.current = false;
  mockQuest.current = null;
  mockQuest.enabled = [];
  mockTiles.current = [];
  mockPin.mockClear();
  mockStart.mockClear();
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
    expect(router.push).toHaveBeenCalledWith('/quest/new-game');
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
      'With Sanjay',
      expect.objectContaining({ level_id: 'NC26.4', players: 'multi', host_plays: true, invite_user_ids: ['sanjay'] }),
    );
  });

  it("the child's own last level wins, and a lesson soon makes it practice together", async () => {
    mockTiles.current = [{ level_id: 'NC26.4' }];
    await show({ ...ANITA, parent: { children: [child({ days_played_this_week: 0, daily_done_today: false, play_level_id: 'BA3' })] } }, ['parent']);
    expect(screen.getByTestId('home-child-play-sanjay')).toHaveTextContent(/Practise together before Thursday's lesson$/);
    await fireEvent.press(screen.getByTestId('home-child-play-sanjay'));
    expect(mockStart).toHaveBeenCalledWith('With Sanjay', expect.objectContaining({ level_id: 'BA3' }));
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
