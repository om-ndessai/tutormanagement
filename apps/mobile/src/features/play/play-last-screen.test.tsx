// Phase 62 (P6): the home-screen quick action's screen. Phase 73 (JF13): it is Continue, from the server's
// open-game read -- read fresh -- opening the game the reader is in where they are, else starting the last
// game's settings again with the same request as a tile, then giving way to the game; with neither, it says so.
import { screen, waitFor } from '@testing-library/react-native';
import { playAgain, type OpenGameResponse } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { PlayLastScreen } from './play-last-screen';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (to: unknown) => mockReplace(to) } }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ organization: { slug: 'ferreira' } }) }));

const SHAPE = { level_id: 'NC26.4' as const, level_scope: 'level' as const, mode: 'timed' as const, question_count: null, duration_seconds: 600 };

function serve(open: OpenGameResponse) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/quest/games/open') return { data: open };
    throw new Error(`unexpected GET ${path}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: { id: 'g-7' } });
});

describe('PlayLastScreen', () => {
  it('opens the game the reader is in, where they are, and starts nothing', async () => {
    serve({
      open: { game_id: 'g-open', status: 'running', label: 'Grade 4 10-minute challenge · 3 points', question: null, of: null, points: 3 },
      again: null,
    });
    await renderWithProviders(<PlayLastScreen />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/quest/games/[gameId]',
        params: { gameId: 'g-open', from: 'home' },
      }),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('with no game open, starts the last game’s settings again and opens it', async () => {
    const again = playAgain(SHAPE);
    serve({ open: null, again });
    await renderWithProviders(<PlayLastScreen />);
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/quest/games', again.request));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/quest/games/[gameId]',
        params: { gameId: 'g-7', from: 'home' },
      }),
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('says so when there is nothing to continue, and starts nothing', async () => {
    serve({ open: null, again: null });
    await renderWithProviders(<PlayLastScreen />);
    expect(await screen.findByTestId('play-last-problem')).toHaveTextContent('There is no quest to continue here yet.');
    expect(mockPost).not.toHaveBeenCalled();
  });
});
