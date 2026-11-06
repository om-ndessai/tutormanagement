// Phase 62 (P3) gave a game's question that no person had approved yet ("checked") a small Beta chip. Phase 78
// (owner 2026-11-05): "Beta" goes altogether -- a checked question is served like any other, so no question wears
// a chip or a label, whatever its `beta` field says (the API still sends it, for older apps).
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

describe('no Beta chip on a quest’s question (Phase 78)', () => {
  it('is absent on a checked question, and nothing says Beta to a screen reader', async () => {
    await renderWithProviders(<GamePlay game={running({ ...QUESTION, beta: true })} />);
    expect(screen.getByTestId('game-question-number')).toBeTruthy();
    expect(screen.queryByTestId('game-question-beta')).toBeNull();
    expect(screen.queryByText(/Beta/)).toBeNull();
    expect(screen.queryByLabelText(/Beta/)).toBeNull();
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
