// How to join (Phase 47, design 61): a game of one-player teams offers "Join the game" alone; a game of
// teams offers no "on my own", only a tab bar of Join a team and New team, and one "Join the game"; the
// host only starts a team; a team's code offers that team. A new team is named "Team <first name>".
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { JoinChoices } from './game-join-choices';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: (path: string, body?: unknown) => mockPost(path, body) },
}));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { full_name: 'Sofia Okafor' } }) }));

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

  it('offers a tab bar and one "Join the game" in a game of teams', async () => {
    mockPost.mockResolvedValue({ data: { id: 'g1' } });
    await renderWithProviders(<JoinChoices gameId="g1" maxTeamSize={3} teamCount={1} />);
    expect(screen.queryByTestId('game-join-solo')).toBeNull();
    expect(screen.getByTestId('game-join-tabs')).toBeTruthy();
    // With a team in the game, Join a team opens first.
    expect(screen.getByTestId('game-team-code')).toBeTruthy();
    expect(screen.queryByTestId('game-team-name')).toBeNull();
    expect(screen.getByTestId('game-join-go')).toHaveTextContent(/Join the game$/);
    expect(screen.queryByText('Start a team')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('game-team-code'), 'w7wyqb');
    await fireEvent.press(screen.getByTestId('game-join-go'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/quest/games/g1/join', { as: 'team', team_code: 'W7WYQB' }),
    );
    await fireEvent.press(screen.getByTestId('game-join-tab-new'));
    expect(screen.getByTestId('game-team-name').props.value).toBe('Team Sofia');
    expect(screen.queryByTestId('game-team-code')).toBeNull();
    await fireEvent.press(screen.getByTestId('game-join-go'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/quest/games/g1/join', {
        as: 'new_team',
        team_name: 'Team Sofia',
      }),
    );
  });

  it('opens on New team while the game has no teams', async () => {
    await renderWithProviders(<JoinChoices gameId="g1" maxTeamSize={3} teamCount={0} />);
    expect(screen.getByTestId('game-team-name').props.value).toBe('Team Sofia');
  });

  it('lets the host start a team only, with no tab bar', async () => {
    await renderWithProviders(<JoinChoices gameId="g1" maxTeamSize={3} teamCount={2} host />);
    expect(screen.queryByTestId('game-join-tabs')).toBeNull();
    expect(screen.queryByTestId('game-team-code')).toBeNull();
    expect(screen.getByTestId('game-team-name').props.value).toBe('Team Sofia');
    expect(screen.getByTestId('game-join-go')).toHaveTextContent(/Join the game$/);
  });

  it("offers the named team alone for a team's code", async () => {
    await renderWithProviders(
      <JoinChoices
        gameId="g1"
        maxTeamSize={2}
        team={{ id: 't1', name: 'Owls', code: 'W7WYQB', players: 1 }}
      />,
    );
    expect(screen.getByText('Owls')).toBeTruthy();
    expect(screen.getByTestId('game-join-team-named')).toHaveTextContent(/Join the game$/);
    expect(screen.queryByTestId('game-join-solo')).toBeNull();
    expect(screen.queryByTestId('game-team-name')).toBeNull();
  });
});
