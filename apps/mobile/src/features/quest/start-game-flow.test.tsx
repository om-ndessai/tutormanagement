// The start wizard (Phase 47, design 61): Next is refused without a level; a game goes through the
// five steps to "Generate game code" (or "Start game" for a single player), sends the wizard's request
// and gives way to the game; a favorite fills every step and jumps to the Review; its × asks first.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createGameSchema, type GameFavorite } from '@tmi/shared';
import { Alert } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { StartGameFlow } from './start-game-flow';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    put: (path: string, body?: unknown) => mockPut(path, body),
    delete: (path: string) => mockDelete(path),
  },
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (to: unknown) => mockReplace(to), back: () => mockBack(), canGoBack: () => true },
  useNavigation: () => ({ isFocused: () => true }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({
  ...jest.requireActual('@/components/toast'),
  useToast: () => mockToast,
}));

const LEVELS = [
  { level_id: 'NC26.6', label: 'G6', available: 412 },
  { level_id: 'NC26.7', label: 'G7', available: 80 },
  { level_id: 'NC26.8', label: 'G8', available: 0 },
];

const FRIDAY: GameFavorite = {
  id: 'f1',
  name: 'Friday G6',
  config: createGameSchema.parse({
    level_id: 'NC26.6',
    mode: 'count',
    question_count: 2,
    wrong_points: -1,
    knockout: true,
    max_teams: 6,
    max_team_size: 2,
    late_join: true,
  }),
  updated_at: '2026-10-22T10:00:00.000Z',
};

function serve(favorites: GameFavorite[] = []) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/quest/games/levels') return { data: LEVELS };
    if (path === '/quest/games/favorites') return { data: favorites };
    throw new Error(`unexpected GET ${path}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

const next = async () => await fireEvent.press(screen.getByTestId('step-flow-next'));

describe('StartGameFlow', () => {
  it('refuses Next without a level, saying so under the tiles', async () => {
    serve();
    await renderWithProviders(<StartGameFlow />);
    await screen.findByTestId('game-tile-NC26.6');
    // Only levels with questions to draw.
    expect(screen.queryByTestId('game-tile-NC26.8')).toBeNull();
    expect(screen.getByTestId('game-step-1')).toBeTruthy();
    await next();
    expect(await screen.findByTestId('game-level-error')).toHaveTextContent('Choose a level.');
    // Random asks for its lowest level instead.
    await fireEvent.press(screen.getByTestId('game-tile-random'));
    expect(await screen.findByTestId('game-level-error')).toHaveTextContent('Choose the lowest level.');
    expect(screen.getByTestId('game-random-start')).toBeTruthy();
  });

  it("goes through the steps to Generate game code, sends the wizard's request and gives way to the game", async () => {
    serve();
    mockPost.mockResolvedValueOnce({ data: { id: 'g7', status: 'lobby' } });
    await renderWithProviders(<StartGameFlow />);
    await fireEvent.press(await screen.findByTestId('game-tile-NC26.6'));
    await next();
    expect(screen.getByTestId('game-step-2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-amount-minus'));
    await next();
    expect(screen.getByTestId('game-step-3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-wrong-minus'));
    expect(screen.getByTestId('game-wrong').props.value).toBe('−1');
    await fireEvent.press(screen.getByTestId('game-knockout'));
    await next();
    expect(screen.getByTestId('game-step-4')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-late-join-open'));
    await next();
    expect(screen.getByTestId('step-flow-review')).toBeTruthy();
    expect(screen.getByTestId('game-summary-scoring').props.accessibilityLabel).toBe(
      'Right +1, wrong −1. Knockout: On',
    );
    expect(screen.getByTestId('game-summary-players').props.accessibilityLabel).toBe(
      'Up to 10 teams of up to 4. Joining: Open while it runs',
    );
    expect(screen.getByTestId('game-create')).toHaveTextContent(/Generate game code/);
    await fireEvent.press(screen.getByTestId('game-create'));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/quest/games/[gameId]',
        params: { gameId: 'g7' },
      }),
    );
    expect(mockPost).toHaveBeenCalledWith('/quest/games', {
      level_id: 'NC26.6',
      level_scope: 'level',
      mode: 'count',
      question_count: 9,
      right_points: 1,
      wrong_points: -1,
      knockout: true,
      players: 'multi',
      max_teams: 10,
      max_team_size: 4,
      late_join: true,
    });
  });

  it('says Start game for a single player, with no Knockout or Joining lines', async () => {
    serve();
    await renderWithProviders(<StartGameFlow />);
    await fireEvent.press(await screen.findByTestId('game-tile-NC26.7'));
    await next();
    await next();
    await next();
    await fireEvent.press(screen.getByTestId('game-players-single'));
    expect(screen.queryByTestId('game-max-teams')).toBeNull();
    await next();
    expect(screen.getByTestId('game-create')).toHaveTextContent(/Start game/);
    expect(screen.getByTestId('game-summary-scoring').props.accessibilityLabel).toBe('Right +1, wrong 0');
    expect(screen.getByTestId('game-summary-players').props.accessibilityLabel).toBe('Single player');
  });

  it('fills every step from a favorite and jumps to the Review', async () => {
    serve([FRIDAY]);
    await renderWithProviders(<StartGameFlow />);
    expect(await screen.findByTestId('game-favorites')).toBeTruthy();
    expect(screen.getByTestId('game-fav-Friday G6').props.accessibilityLabel).toBe(
      'Friday G6, G6 · 2 questions · Up to 6 teams of up to 2',
    );
    await fireEvent.press(screen.getByTestId('game-fav-Friday G6'));
    expect(await screen.findByTestId('step-flow-review')).toBeTruthy();
    expect(screen.getByTestId('game-summary-questions').props.accessibilityLabel).toBe('G6');
    expect(screen.getByTestId('game-summary-length').props.accessibilityLabel).toBe('2 questions');
    expect(screen.getByTestId('game-summary-scoring').props.accessibilityLabel).toBe(
      'Right +1, wrong −1. Knockout: On',
    );
    // Back lands on the last step, filled in.
    await fireEvent.press(screen.getByTestId('step-flow-back'));
    expect(screen.getByTestId('game-step-4')).toBeTruthy();
    expect(screen.getByTestId('game-team-size').props.value).toBe('2');
  });

  it('asks before deleting a favorite, then deletes it', async () => {
    serve([FRIDAY]);
    mockDelete.mockResolvedValueOnce({ data: { id: 'f1' } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<StartGameFlow />);
    await fireEvent.press(await screen.findByTestId('game-fav-delete-Friday G6'));
    expect(alert).toHaveBeenCalledWith('Delete “Friday G6”?', undefined, expect.any(Array));
    expect(mockDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((button) => button.text === 'Delete')!.onPress!());
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Deleted “Friday G6”.'));
    expect(mockDelete).toHaveBeenCalledWith('/quest/games/favorites/f1');
    alert.mockRestore();
  });

  it('saves the Review as a favorite under a name', async () => {
    serve();
    mockPut.mockResolvedValueOnce({ data: { ...FRIDAY, name: 'Friday G6' } });
    await renderWithProviders(<StartGameFlow />);
    await fireEvent.press(await screen.findByTestId('game-tile-NC26.6'));
    await next();
    await next();
    await next();
    await next();
    expect(screen.getByTestId('game-fav-save')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('game-fav-name'), ' Friday G6 ');
    await fireEvent.press(screen.getByTestId('game-fav-save'));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Saved “Friday G6” to your favorites.'),
    );
    expect(mockPut).toHaveBeenCalledWith(
      '/quest/games/favorites',
      expect.objectContaining({ name: 'Friday G6', config: expect.objectContaining({ level_id: 'NC26.6' }) }),
    );
  });
});
