// Phase 62 (P3): a game's question that no person has approved yet ("checked") wears a small Beta
// chip, labelled for a screen reader; an approved one, and a series from before Phase 62 (no `beta`),
// do not.
import { screen } from '@testing-library/react-native';
import type { GameQuestion, GameView } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { GamePlay } from './game-play';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('./quest-notice', () => ({
  useQuestNotice: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
// The page cannot draw under Jest.
jest.mock('@/features/question-bank/math-body', () => ({ MathBody: () => null }));

function running(question: GameQuestion): GameView {
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
    players: 'single',
    max_teams: 1,
    max_team_size: 1,
    late_join: false,
    unreviewed: true,
    status: 'running',
    host: { user_id: 'me', first_name: 'Sofia' },
    is_host: true,
    created_at: '2026-11-01T10:00:00.000Z',
    started_at: '2026-11-01T10:00:00.000Z',
    ends_at: null,
    ended_at: null,
    end_reason: null,
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
        finished_at: null,
        place: null,
      },
    ],
    me: { team_id: 't1', question, last: null, waiting: false },
  } as GameView;
}

const QUESTION: GameQuestion = {
  id: 'q1',
  kind: 'choice',
  stem: 'What is 2 + 2?',
  choices: ['3', '4', '5', '6'],
  number: 1,
};

describe('the game question’s Beta chip', () => {
  it('shows on a checked question, labelled for a screen reader', async () => {
    await renderWithProviders(<GamePlay game={running({ ...QUESTION, beta: true })} />);
    const chip = screen.getByTestId('game-question-beta');
    expect(chip).toHaveTextContent(/Beta/);
    expect(screen.getByLabelText('Beta: a new question no person has approved yet')).toBeTruthy();
  });

  it('is absent on an approved question', async () => {
    await renderWithProviders(<GamePlay game={running({ ...QUESTION, beta: false })} />);
    expect(screen.getByTestId('game-question-number')).toBeTruthy();
    expect(screen.queryByTestId('game-question-beta')).toBeNull();
  });

  it('is absent on a series from before Phase 62 (no beta field)', async () => {
    await renderWithProviders(<GamePlay game={running(QUESTION)} />);
    expect(screen.getByTestId('game-question-number')).toBeTruthy();
    expect(screen.queryByTestId('game-question-beta')).toBeNull();
  });
});
