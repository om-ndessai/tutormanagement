// Phase 64 (P20): a single player's results say "New best!" when the game beat every earlier one of its
// shape (the server's `new_best`), and say nothing when it did not, or for a game of teams.
import { screen, waitFor } from '@testing-library/react-native';
import type { GameResults as GameResultsData, GameView } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { GameResults } from './game-results';

const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: (path: string) => mockGet(path), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissTo: jest.fn() },
}));
// Share the result is Phase 56's, tested on its own.
jest.mock('../sharing/share-button', () => ({ ShareButton: () => null }));
// The page cannot draw under Jest.
jest.mock('@/features/question-bank/math-body', () => ({ MathBody: () => null }));

function finished(players: 'single' | 'multi' = 'single'): GameView {
  return {
    id: 'g1',
    code: 'ABC234',
    level_id: 'NC26.4',
    level_scope: 'level',
    mode: 'count',
    question_count: 5,
    duration_seconds: null,
    right_points: 1,
    wrong_points: 0,
    negative_marking: false,
    knockout: false,
    players,
    max_teams: 1,
    max_team_size: 1,
    late_join: false,
    unreviewed: true,
    status: 'finished',
    host: { user_id: 'me', first_name: 'Sofia' },
    is_host: true,
    created_at: '2026-11-01T10:00:00.000Z',
    started_at: '2026-11-01T10:00:00.000Z',
    ends_at: null,
    ended_at: '2026-11-01T10:05:00.000Z',
    end_reason: 'complete',
    now: '2026-11-01T10:00:10.000Z',
    series_length: 5,
    teams: [
      {
        id: 't1',
        name: 'Sofia',
        solo: true,
        code: null,
        players: [{ user_id: 'me', first_name: 'Sofia' }],
        score: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        answered: 0,
        finished_at: '2026-11-01T10:05:00.000Z',
        place: 1,
      },
    ],
    me: { team_id: 't1', question: null, last: null, waiting: false },
  } as GameView;
}

function serve(game: GameView, newBest: boolean | undefined) {
  const data: GameResultsData = { game, team_id: 't1', items: [], ...(newBest === undefined ? {} : { new_best: newBest }) };
  mockGet.mockResolvedValue({ data });
}

beforeEach(() => {
  mockGet.mockReset();
});

describe('New best! (Phase 64)', () => {
  it('shows on a single player’s game that beat every earlier one', async () => {
    const game = finished();
    serve(game, true);
    await renderWithProviders(<GameResults game={game} />);
    expect(await screen.findByTestId('game-new-best')).toHaveTextContent('New best!');
  });

  it.each([
    ['the game did not beat the best', false],
    ['the server does not say (an older Worker)', undefined],
  ])('is not shown when %s', async (_why, newBest) => {
    const game = finished();
    serve(game, newBest);
    await renderWithProviders(<GameResults game={game} />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(await screen.findByTestId('game-winner')).toBeTruthy();
    expect(screen.queryByTestId('game-new-best')).toBeNull();
  });

  it('is never shown for a game of teams', async () => {
    const game = finished('multi');
    serve(game, true);
    await renderWithProviders(<GameResults game={game} />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.queryByTestId('game-new-best')).toBeNull();
  });
});
