// Phase 62 (P6): the "Play <tile>" quick action's screen starts the last quest kept on this phone with
// the same request as Continue, then gives way to the game; with nothing kept, it says so.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, waitFor } from '@testing-library/react-native';
import { DEFAULT_TILES, tileGameRequest } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { PlayLastScreen } from './play-last-screen';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: jest.fn(),
    post: (path: string, body?: unknown) => mockPost(path, body),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (to: unknown) => mockReplace(to) } }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ organization: { slug: 'ferreira' } }) }));

const G4T10 = tileGameRequest(DEFAULT_TILES.find((t) => t.code === 'G4T10')!);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPost.mockResolvedValue({ data: { id: 'g-7' } });
});

describe('PlayLastScreen', () => {
  it('starts the last tile and opens its game', async () => {
    await AsyncStorage.setItem('tmi.lastQuest.ferreira', JSON.stringify({ label: 'G4T10', request: G4T10 }));
    await renderWithProviders(<PlayLastScreen />);
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/quest/games', G4T10));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/quest/games/[gameId]',
        params: { gameId: 'g-7', from: 'home' },
      }),
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing is kept on this phone, and starts nothing', async () => {
    await renderWithProviders(<PlayLastScreen />);
    expect(await screen.findByTestId('play-last-problem')).toHaveTextContent(
      'There is no quest to continue on this phone yet.',
    );
    expect(mockPost).not.toHaveBeenCalled();
  });
});
