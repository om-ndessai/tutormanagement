// How to join (Phase 47, design 61): a game of one-player teams offers "Join the game" alone; a game of
// teams offers no "on my own", only start a team or a team's code; a team's code offers that team.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { JoinChoices } from './game-join-choices';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: (path: string, body?: unknown) => mockPost(path, body) },
}));

beforeEach(() => mockPost.mockReset());

describe('JoinChoices', () => {
  it('offers one "Join the game" when everyone is on their own', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'g1' } });
    const onJoined = jest.fn();
    await renderWithProviders(<JoinChoices gameId="g1" maxTeamSize={1} onJoined={onJoined} />);
    expect(screen.getByTestId('game-join-solo')).toHaveTextContent(/Join the game$/);
    expect(screen.queryByTestId('game-team-name')).toBeNull();
    expect(screen.queryByTestId('game-team-code')).toBeNull();
    await fireEvent.press(screen.getByTestId('game-join-solo'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('g1'));
    expect(mockPost).toHaveBeenCalledWith('/quest/games/g1/join', { as: 'solo' });
  });

  it('offers no "on my own" in a game of teams: start one, or a team’s code', async () => {
    await renderWithProviders(<JoinChoices gameId="g1" maxTeamSize={3} />);
    expect(screen.queryByTestId('game-join-solo')).toBeNull();
    expect(screen.getByTestId('game-team-name')).toBeTruthy();
    expect(screen.getByTestId('game-join-new-team')).toBeTruthy();
    expect(screen.getByTestId('game-team-code')).toBeTruthy();
    expect(screen.getByTestId('game-join-team')).toBeTruthy();
  });

  it("offers the named team alone for a team's code", async () => {
    await renderWithProviders(
      <JoinChoices
        gameId="g1"
        maxTeamSize={2}
        team={{ id: 't1', name: 'Owls', code: 'W7WYQB', players: 1 }}
      />,
    );
    expect(screen.getByTestId('game-join-team-named')).toHaveTextContent(/Join Owls$/);
    expect(screen.queryByTestId('game-join-solo')).toBeNull();
    expect(screen.queryByTestId('game-team-name')).toBeNull();
  });
});
