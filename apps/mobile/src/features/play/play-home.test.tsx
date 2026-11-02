// Phase 62 (P6-P8): the members' Play home, with the api client mocked at the network edge -- the tiles
// in their curricula, each a game in one tap; a star keeps a tile as a favorite; a multiplayer favorite
// starts with the host playing and its roster invited; the roster dialog lists first names and saves
// them; Waiting for you joins through the join sheet; the code box tells a game from a space; and the
// console's switch hides it all. Phase 64 (P17-P20): My progress, the Daily's button and a tile's best.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  BADGES,
  DEFAULT_TILES,
  createGameSchema,
  tileGameRequest,
  tileWords,
  type GameFavorite,
  type HabitSummary,
  type MemberTile,
  type MemberTilesResponse,
  type QuestMember,
  type WaitingGame,
} from '@tmi/shared';

import { resetGuestMemoryForTests } from '@/features/guest/guest-store';
import { renderWithProviders } from '@/test/render';
import { PlayFavorites, PlayHome, WaitingForYou, rosterFirst } from './play-home';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    put: (path: string, body?: unknown) => mockPut(path, body),
    delete: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (to: unknown) => mockPush(to), replace: jest.fn() },
  useIsFocused: () => true,
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    organization: { slug: 'ferreira' },
    user: { id: 'me', roles: ['student'] },
    refreshSession: async () => undefined,
  }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({
  ...jest.requireActual('@/components/toast'),
  useToast: () => mockToast,
}));

const member = (code: string, beta = false): MemberTile => {
  const tile = DEFAULT_TILES.find((t) => t.code === code)!;
  return { ...tile, words: tileWords(tile), available: 300, beta };
};

const TILES: MemberTilesResponse = {
  play_home: true,
  tiles: [member('G4Q5', true), member('G4T10'), member('BA3Q5')],
};

const FAMILY: GameFavorite = {
  id: 'f-family',
  name: 'Family G4',
  roster: ['u-sofia'],
  config: createGameSchema.parse({
    level_id: 'NC26.4',
    mode: 'count',
    question_count: 10,
    max_team_size: 1,
    late_join: true,
  }),
  updated_at: '2026-11-01T10:00:00.000Z',
};
const SOLO: GameFavorite = {
  id: 'f-solo',
  name: 'BA3Q5',
  roster: null,
  config: createGameSchema.parse(tileGameRequest(member('BA3Q5'))),
  updated_at: '2026-11-01T10:00:00.000Z',
};
const MEMBERS: QuestMember[] = [
  { id: 'u-sofia', first_name: 'Sofia' },
  { id: 'u-mateo', first_name: 'Mateo' },
];
const WAITING: WaitingGame[] = [
  {
    game_id: 'g-9',
    code: 'FAM234',
    host_first_name: 'Ana',
    level_id: 'NC26.4',
    mode: 'count',
    question_count: 10,
    duration_seconds: null,
    status: 'lobby',
    created_at: '2026-11-01T10:00:00.000Z',
  },
];

const HABIT: HabitSummary = {
  streak_weeks: 2,
  days_this_week: 1,
  played_today: true,
  badges: BADGES.map((badge) => ({ ...badge, earned: badge.id === 'first_quest' })),
};

function serve({
  tiles = TILES,
  favorites = [] as GameFavorite[],
  waiting = [] as WaitingGame[],
  habit = HABIT,
}: {
  tiles?: MemberTilesResponse;
  favorites?: GameFavorite[];
  waiting?: WaitingGame[];
  habit?: HabitSummary;
} = {}) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/quest/tiles') return { data: tiles };
    if (path === '/quest/me/habit') return { data: habit };
    if (path === '/quest/games/favorites') return { data: favorites };
    if (path === '/quest/games/waiting') return { data: waiting };
    if (path === '/quest/games/members') return { data: MEMBERS };
    throw new Error(`unexpected GET ${path}`);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetGuestMemoryForTests({});
  mockPost.mockImplementation(async (path: string) => {
    if (path === '/quest/games') return { data: { id: 'g-new' } };
    if (path === '/spaces/join-requests') return { data: { requested: true, slug: 'other' } };
    throw new Error(`unexpected POST ${path}`);
  });
  mockPut.mockResolvedValue({ data: {} });
});

describe('PlayHome', () => {
  it('groups the tiles by curriculum, each with its words and a Beta chip while its level is checked', async () => {
    serve();
    await renderWithProviders(<PlayHome />);
    await screen.findByTestId('play-tile-G4Q5');
    expect(screen.getByText('NC standards')).toBeTruthy();
    expect(screen.getByText('Beast Academy')).toBeTruthy();
    expect(screen.getByText('Grade 4 · 10 minutes')).toBeTruthy();
    expect(screen.getByTestId('play-tile-beta-G4Q5')).toBeTruthy();
    expect(screen.queryByTestId('play-tile-beta-G4T10')).toBeNull();
    // Nothing remembered on this phone yet: no Continue.
    expect(screen.queryByTestId('play-continue')).toBeNull();
  });

  it('starts a tile in one tap: the single player’s request, then the game, remembered for Continue', async () => {
    serve();
    await renderWithProviders(<PlayHome />);
    await fireEvent.press(await screen.findByTestId('play-tile-start-G4T10'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/quest/games', tileGameRequest(member('G4T10'))),
    );
    expect(mockPost.mock.calls[0]![1]).not.toHaveProperty('host_plays');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/quest/games/[gameId]',
      params: { gameId: 'g-new', from: 'home' },
    });
    // Continue appears, on this space's key.
    expect(await screen.findByTestId('play-continue')).toHaveTextContent(/Continue G4T10/);
    expect(JSON.parse((await AsyncStorage.getItem('tmi.lastQuest.ferreira'))!)).toMatchObject({
      label: 'G4T10',
    });
  });

  it('continues the last quest from this phone, its level first', async () => {
    await AsyncStorage.setItem(
      'tmi.lastQuest.ferreira',
      JSON.stringify({ label: 'BA3Q5', request: tileGameRequest(member('BA3Q5')) }),
    );
    serve();
    await renderWithProviders(<PlayHome />);
    const cont = await screen.findByTestId('play-continue');
    expect(cont).toHaveTextContent(/Continue BA3Q5/);
    // Beast Academy leads, as the level last played.
    const headings = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headings.indexOf('Beast Academy')).toBeLessThan(headings.indexOf('NC standards'));
    await fireEvent.press(cont);
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/quest/games', tileGameRequest(member('BA3Q5'))),
    );
  });

  it('keeps a starred tile as a favorite named by its code', async () => {
    serve({ favorites: [SOLO] });
    await renderWithProviders(<PlayHome />);
    await fireEvent.press(await screen.findByTestId('play-tile-star-G4Q5'));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/quest/games/favorites', {
        name: 'G4Q5',
        config: tileGameRequest(member('G4Q5')),
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('G4Q5 is in your favorites.');
    // A tile already a favorite cannot be starred twice.
    expect(screen.getByTestId('play-tile-star-BA3Q5').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('is nothing at all while the console has the Play home off', async () => {
    serve({ tiles: { play_home: false, tiles: TILES.tiles }, favorites: [SOLO], waiting: WAITING });
    await renderWithProviders(<PlayHome />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/quest/tiles'));
    expect(screen.queryByTestId('play-home')).toBeNull();
    expect(screen.queryByTestId('play-favorites')).toBeNull();
  });
});

describe('Phase 64: My progress, the Daily and a tile’s best', () => {
  it('shows My progress under Continue: the streak, today’s ring and the badges earned', async () => {
    serve();
    await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('my-progress')).toBeTruthy();
    expect(screen.getByTestId('my-progress-streak')).toHaveTextContent('2 weeks in a row');
    expect(screen.getByText('1 of 3 days this week')).toBeTruthy();
    expect(screen.getByTestId('my-progress-today').props.accessibilityLabel).toBe('Played today');
    expect(screen.getByTestId('badge-first_quest')).toBeTruthy();
    expect(screen.queryByTestId('badge-quests_10')).toBeNull();
  });

  it('says how to begin before any play: no streak, the ring empty, no badge yet', async () => {
    serve({
      habit: { ...HABIT, streak_weeks: 0, days_this_week: 0, played_today: false, badges: HABIT.badges.map((b) => ({ ...b, earned: false })) },
    });
    await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('my-progress-streak')).toHaveTextContent('Start a streak');
    expect(screen.getByTestId('my-progress-today').props.accessibilityLabel).toBe('Not played yet today');
    expect(screen.getByText('Your first badge is one quest away.')).toBeTruthy();
  });

  it('offers the Daily of the first tile’s level while the console has it on, and opens it', async () => {
    serve({ tiles: { ...TILES, daily: true } });
    await renderWithProviders(<PlayHome />);
    const daily = await screen.findByTestId('play-daily');
    expect(daily).toHaveTextContent(/Today's Daily · G4D/);
    await fireEvent.press(daily);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quest/daily/[level]', params: { level: 'NC26.4' } });
  });

  it('offers the Daily of the level last played', async () => {
    await AsyncStorage.setItem(
      'tmi.lastQuest.ferreira',
      JSON.stringify({ label: 'BA3Q5', request: tileGameRequest(member('BA3Q5')) }),
    );
    serve({ tiles: { ...TILES, daily: true } });
    await renderWithProviders(<PlayHome />);
    await waitFor(() => expect(screen.getByTestId('play-daily')).toHaveTextContent(/Today's Daily · BA3D/));
  });

  it('leads with a guest’s grade on this phone before any quest here (P13), the tile played if none was chosen', async () => {
    resetGuestMemoryForTests({ played: ['BA3Q5'] });
    serve({ tiles: { ...TILES, daily: true } });
    await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('play-daily')).toHaveTextContent(/BA3D/);
    const headings = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headings.indexOf('Beast Academy')).toBeLessThan(headings.indexOf('NC standards'));
  });

  it('a chosen grade outranks the tile played, and a quest started here outranks both', async () => {
    resetGuestMemoryForTests({ grade: 'NC26.4', played: ['BA3Q5'] });
    serve({ tiles: { ...TILES, daily: true } });
    const first = await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('play-daily')).toHaveTextContent(/G4D/);
    first.unmount();
    await AsyncStorage.setItem(
      'tmi.lastQuest.ferreira',
      JSON.stringify({ label: 'BA3Q5', request: tileGameRequest(member('BA3Q5')) }),
    );
    await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('play-daily')).toHaveTextContent(/BA3D/);
  });

  it('has no Daily while the console has it off (or an older Worker does not say)', async () => {
    serve({ tiles: { ...TILES, daily: false } });
    await renderWithProviders(<PlayHome />);
    await screen.findByTestId('play-tile-G4Q5');
    expect(screen.queryByTestId('play-daily')).toBeNull();
  });

  it('shows a tile’s best, and nothing on a tile never played', async () => {
    serve({ tiles: { ...TILES, tiles: [{ ...member('G4Q5'), best: 3 }, { ...member('G4T10'), best: null }, member('BA3Q5')] } });
    await renderWithProviders(<PlayHome />);
    expect(await screen.findByTestId('play-best-G4Q5')).toHaveTextContent('Best 3');
    expect(screen.queryByTestId('play-best-G4T10')).toBeNull();
    expect(screen.queryByTestId('play-best-BA3Q5')).toBeNull();
  });
});

describe('Have a code?', () => {
  it('opens the join sheet for six characters, and asks to join a space for eight', async () => {
    serve();
    await renderWithProviders(<PlayHome />);
    const box = await screen.findByTestId('play-code');
    const go = screen.getByTestId('play-code-go');
    await fireEvent.changeText(box, 'abc23');
    expect(go.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(box, 'abc-234');
    await fireEvent.press(go);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quest/join-game', params: { code: 'ABC234' } });
    expect(mockPost).not.toHaveBeenCalled();

    await fireEvent.changeText(box, 'fmxy-2345');
    await fireEvent.press(screen.getByTestId('play-code-go'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/spaces/join-requests', { code: 'FMXY2345' }));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Asked to join. Its admins will let you in.'),
    );
  });
});

describe('PlayFavorites', () => {
  it('starts a multiplayer favorite with the host playing and its roster invited; a single one as it is', async () => {
    serve({ favorites: [FAMILY, SOLO] });
    await renderWithProviders(<PlayFavorites />);
    await fireEvent.press(await screen.findByTestId('play-favorite-Family G4'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/quest/games', {
        ...FAMILY.config,
        host_plays: true,
        invite_user_ids: ['u-sofia'],
      }),
    );
    await fireEvent.press(screen.getByTestId('play-favorite-BA3Q5'));
    await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/quest/games', SOLO.config));
    // Only a multiplayer favorite has players to choose.
    expect(screen.getByTestId('play-favorite-players-Family G4')).toBeTruthy();
    expect(screen.queryByTestId('play-favorite-players-BA3Q5')).toBeNull();
  });

  it('chooses a roster from the space’s first names and saves it with the favorite', async () => {
    serve({ favorites: [FAMILY] });
    await renderWithProviders(<PlayFavorites />);
    await fireEvent.press(await screen.findByTestId('play-favorite-players-Family G4'));
    expect(await screen.findByText('Players for Family G4')).toBeTruthy();
    const sofia = await screen.findByTestId('play-roster-member-u-sofia');
    expect(sofia.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('play-roster-member-u-mateo').props.accessibilityState).toMatchObject({
      checked: false,
    });
    await fireEvent.press(screen.getByTestId('play-roster-member-u-mateo'));
    await fireEvent.press(screen.getByTestId('play-roster-save'));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/quest/games/favorites', {
        name: 'Family G4',
        config: FAMILY.config,
        roster: ['u-sofia', 'u-mateo'],
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Family G4 invites 2 people.');
  });

  it('clears the roster (anyone with the code) when nobody is ticked', async () => {
    serve({ favorites: [FAMILY] });
    await renderWithProviders(<PlayFavorites />);
    await fireEvent.press(await screen.findByTestId('play-favorite-players-Family G4'));
    await fireEvent.press(await screen.findByTestId('play-roster-member-u-sofia'));
    await fireEvent.press(screen.getByTestId('play-roster-save'));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/quest/games/favorites', {
        name: 'Family G4',
        config: FAMILY.config,
        roster: null,
      }),
    );
  });

  it('is the compact row over a Tutoring dashboard', async () => {
    serve({ favorites: [SOLO] });
    await renderWithProviders(<PlayFavorites compact />);
    expect(await screen.findByTestId('play-favorites-row')).toBeTruthy();
    expect(screen.getByText('Play a favorite')).toBeTruthy();
  });

  it('is nothing without favorites', async () => {
    serve();
    await renderWithProviders(<PlayFavorites />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/quest/games/favorites'));
    expect(screen.queryByTestId('play-favorites')).toBeNull();
  });
});

describe('rosterFirst', () => {
  it('puts the favorite’s players first, keeping the server’s order otherwise', () => {
    const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(rosterFirst(people, ['c', 'a']).map((p) => p.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(rosterFirst(people, null).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('WaitingForYou', () => {
  it('lists a roster’s game by its host’s first name, and joins it through the join sheet', async () => {
    serve({ waiting: WAITING });
    await renderWithProviders(<WaitingForYou />);
    expect(await screen.findByText(/started a G4 game · 10 questions/)).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('play-waiting-join-FAM234'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quest/join-game', params: { code: 'FAM234' } });
  });

  it('is nothing when no game waits', async () => {
    serve();
    await renderWithProviders(<WaitingForYou />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/quest/games/waiting'));
    expect(screen.queryByTestId('play-waiting')).toBeNull();
  });
});
