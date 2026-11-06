// Phase 77 (JF15): a game on one device. The host's view carries the child's hand (`seats`); the screen takes turns,
// the child first on each question -- "Ben's turn" with "Pass the device to Ben.", answered with `as_user_id` -- then
// "Your turn" with "Take the device back.", answered as the host; both scores side by side by first name. Coming back
// to the game lands on whoever's turn it is. The results give each player's own result, never team words.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { GameQuestion, GameSeat, GameView } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { GameResults } from './game-results';
import { SeatedPlay } from './game-seated-play';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
const mockNotice = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('./quest-notice', () => ({ useQuestNotice: () => mockNotice }));
jest.mock('@/lib/haptics', () => ({
  haptics: { selection: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), impact: jest.fn() },
}));
// The page cannot draw under Jest.
jest.mock('@/features/question-bank/math-body', () => ({ MathBody: () => null }));
jest.mock('../sharing/share-button', () => ({ ShareButton: () => null }));

const Q1 = '11111111-1111-4111-8111-111111111111';
const Q2 = '22222222-2222-4222-8222-222222222222';
const post = apiClient.post as jest.Mock;

function question(id: string, number: number): GameQuestion {
  return { id, kind: 'numeric', stem: `Question ${number}: what is 3 + 4?`, choices: [], number };
}

function team(id: string, name: string, userId: string, overrides: Partial<GameView['teams'][number]> = {}) {
  return {
    id,
    name,
    solo: true,
    code: null,
    players: [{ user_id: userId, first_name: name }],
    score: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    answered: 0,
    finished_at: null,
    place: null,
    ...overrides,
  };
}

function seated({
  mine,
  ben,
  status = 'running',
  teams,
}: {
  mine: GameQuestion | null;
  ben: Partial<GameSeat>;
  status?: GameView['status'];
  teams?: GameView['teams'];
}): GameView {
  return {
    id: 'g1',
    code: 'ABC234',
    level_id: 'NC26.5',
    level_scope: 'level',
    mode: 'count',
    question_count: 5,
    duration_seconds: null,
    right_points: 1,
    wrong_points: 0,
    negative_marking: false,
    knockout: false,
    players: 'multi',
    max_teams: 2,
    max_team_size: 1,
    late_join: false,
    unreviewed: true,
    status,
    host: { user_id: 'tom', first_name: 'Tom' },
    is_host: true,
    created_at: '2026-11-05T10:00:00.000Z',
    started_at: '2026-11-05T10:00:00.000Z',
    ends_at: null,
    ended_at: status === 'finished' ? '2026-11-05T10:05:00.000Z' : null,
    end_reason: null,
    now: '2026-11-05T10:00:10.000Z',
    series_length: 5,
    teams: teams ?? [team('t-tom', 'Tom', 'tom'), team('t-ben', 'Ben', 'ben', { score: 1, correct: 1, answered: 1 })],
    me: { team_id: 't-tom', question: mine, last: null, waiting: false },
    seats: [
      { user_id: 'ben', first_name: 'Ben', team_id: 't-ben', question: null, last: null, waiting: false, ...ben },
    ],
  } as GameView;
}

beforeEach(() => {
  post.mockReset();
  mockNotice.success.mockReset();
  mockNotice.info.mockReset();
});

describe('a game on one device', () => {
  it("is the child's turn first on each question, and answers for the child", async () => {
    const game = seated({ mine: question(Q1, 1), ben: { question: question(Q1, 1) } });
    post.mockResolvedValue({
      data: { ...game, seats: [{ ...game.seats![0]!, question: question(Q2, 2), last: { correct: true, skipped: false } }] },
    });
    await renderWithProviders(<SeatedPlay game={game} />);
    expect(screen.getByTestId('game-turn-title')).toHaveTextContent("Ben's turn");
    expect(screen.getByTestId('game-hand-over')).toHaveTextContent('Pass the device to Ben.');
    expect(screen.getByTestId('game-question-number')).toHaveTextContent(/Question 1 of 5/i);
    // Both scores, by first name, the child first.
    expect(screen.getByTestId('game-seat-score-Ben')).toBeTruthy();
    expect(screen.getByTestId('game-seat-score-value-Ben')).toHaveTextContent('1');
    expect(screen.getByLabelText('Ben, 1 point, answering')).toBeTruthy();
    expect(screen.getByLabelText('Tom (you), 0 points')).toBeTruthy();

    expect(screen.getAllByText("Ben's answer").length).toBeGreaterThan(0);
    await fireEvent.changeText(screen.getByTestId('game-number'), '7');
    await fireEvent.press(screen.getByTestId('game-submit'));
    expect(post).toHaveBeenCalledWith('/quest/games/g1/answer', { question_id: Q1, answer: '7', as_user_id: 'ben' });
    // The notice reads the child's answer, not the host's, and says whose it was.
    await waitFor(() => expect(mockNotice.success).toHaveBeenCalledWith('Ben: Right! +1'));
  });

  it("then the host's: 'Your turn', answered as the host, with nothing of the child's answer left in the field", async () => {
    const game = seated({ mine: question(Q1, 1), ben: { question: question(Q2, 2) } });
    post.mockResolvedValue({ data: { ...game, me: { ...game.me, question: question(Q2, 2), last: { correct: false, skipped: true } } } });
    await renderWithProviders(<SeatedPlay game={game} />);
    expect(screen.getByTestId('game-turn-title')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('game-hand-over')).toHaveTextContent('Ben has answered: take the device back.');
    expect(screen.getByTestId('game-number').props.value).toBe('');
    // The field names whose answer it is.
    expect(screen.queryByText("Ben's answer")).toBeNull();
    await fireEvent.press(screen.getByTestId('game-skip'));
    expect(post).toHaveBeenCalledWith('/quest/games/g1/answer', { question_id: Q1, skip: true });
    // The host's own answer: the notice reads the host's hand.
    await waitFor(() => expect(mockNotice.info).toHaveBeenCalledWith('Skipped.'));
  });

  it('says the results are coming when nobody holds a question', async () => {
    await renderWithProviders(<SeatedPlay game={seated({ mine: null, ben: { question: null } })} />);
    expect(screen.queryByTestId('game-turn')).toBeNull();
    expect(screen.getByTestId('game-waiting')).toHaveTextContent(/Everyone has answered\. The results are on their way\./);
  });

  it('shows the doors, not a turn, while they count down', async () => {
    await renderWithProviders(<SeatedPlay game={seated({ mine: question(Q1, 1), ben: { question: question(Q1, 1) } })} counting />);
    expect(screen.getByTestId('game-getting-ready')).toHaveTextContent('Get ready: Ben goes first.');
    expect(screen.queryByTestId('game-turn')).toBeNull();
  });

  it("ends with each player's own result by name, and no team words", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { team_id: 't-tom', items: [], new_best: false } });
    const done = seated({
      mine: null,
      ben: { question: null },
      status: 'finished',
      teams: [
        team('t-ben', 'Ben', 'ben', { score: 3, correct: 3, answered: 5, place: 1 }),
        team('t-tom', 'Tom', 'tom', { score: 2, correct: 2, answered: 5, place: 2 }),
      ],
    });
    await renderWithProviders(<GameResults game={done} />);
    await screen.findByTestId('game-review-empty');
    expect(screen.getByTestId('game-winner')).toHaveTextContent('Ben wins!');
    expect(screen.getByTestId('game-seated-result-Ben')).toHaveTextContent('Ben: 3 right, 3 points · 1st');
    expect(screen.getByTestId('game-seated-result-Tom')).toHaveTextContent('You: 2 right, 2 points · 2nd');
    expect(screen.queryByTestId('game-encouragement')).toBeNull();
    expect(screen.queryByText(/team/i)).toBeNull();
    expect(screen.getByTestId('game-rules')).toHaveTextContent(/Ben and you, on this device/);
  });
});
