// Quest Games' hooks (Phase 46, design 60), with the api client mocked at the network edge: the game
// is polled only while its screen is focused and never once it is finished; an action's reply is
// written into the game's cache. And Quest's choices keep their own testIDs unless a game asks.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { GAME_POLL_MS, type GameView } from '@tmi/shared';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';
import { gameKeys, useGame, useGameAction } from './games-api';
import { QuestChoices } from './quest-choices';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
  },
}));
// The page cannot draw under Jest: it says so at once, and the native rows stand in.
jest.mock('@/features/question-bank/math-body', () => ({
  MathBody: ({ contentKey, onRendered }: { contentKey: string; onRendered?: (key: string) => void }) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => onRendered?.(contentKey), [contentKey, onRendered]);
    return null;
  },
}));

function aGame(over: Partial<GameView> = {}): GameView {
  return {
    id: 'g1',
    code: 'ABC234',
    level_id: 'NC26.6',
    mode: 'count',
    question_count: 2,
    duration_seconds: null,
    negative_marking: false,
    max_team_size: 2,
    unreviewed: false,
    status: 'lobby',
    host: { user_id: 'p', first_name: 'Priya' },
    is_host: false,
    created_at: '2026-10-21T10:00:00.000Z',
    started_at: null,
    ends_at: null,
    ended_at: null,
    now: '2026-10-21T10:00:00.000Z',
    series_length: null,
    teams: [],
    me: { team_id: null, question: null, last: null, waiting: false },
    ...over,
  };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGet.mockReset();
  mockPost.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Lets the timers run that far, and the promises they start settle. */
async function flush(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const gameReads = () => mockGet.mock.calls.filter(([path]) => path === '/quest/games/g1').length;

describe('useGame', () => {
  it('polls while the screen is focused, and stops when it is not', async () => {
    mockGet.mockResolvedValue({ data: aGame() });
    const { wrapper, client } = setup();
    const { rerender, unmount } = await renderHook(
      ({ active }: { active: boolean }) => useGame('g1', active),
      {
        wrapper,
        initialProps: { active: true },
      },
    );
    await flush(0);
    expect(gameReads()).toBe(1);
    await flush(GAME_POLL_MS);
    expect(gameReads()).toBe(2);

    await rerender({ active: false });
    await flush(GAME_POLL_MS * 3);
    expect(gameReads()).toBe(2);
    unmount();
    client.clear();
  });

  it('never polls a finished game', async () => {
    mockGet.mockResolvedValue({ data: aGame({ status: 'finished' }) });
    const { wrapper, client } = setup();
    const { unmount } = await renderHook(() => useGame('g1', true), { wrapper });
    await flush(0);
    expect(gameReads()).toBe(1);
    await flush(GAME_POLL_MS * 3);
    expect(gameReads()).toBe(1);
    unmount();
    client.clear();
  });
});

describe('useGameAction', () => {
  it("writes the reply into the game's cache, and leaves it be when the reply is empty", async () => {
    const { wrapper, client } = setup();
    client.setQueryData(gameKeys.game('g1'), { data: aGame() });
    mockPost.mockResolvedValueOnce({ data: aGame({ status: 'running' }) });
    const { result } = await renderHook(() => useGameAction('g1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ kind: 'start' });
    });
    expect(mockPost).toHaveBeenCalledWith('/quest/games/g1/start', undefined);
    expect(client.getQueryData<{ data: GameView }>(gameKeys.game('g1'))?.data.status).toBe('running');

    mockPost.mockResolvedValueOnce({ data: null });
    await act(async () => {
      await result.current.mutateAsync({ kind: 'leave' });
    });
    expect(client.getQueryData<{ data: GameView }>(gameKeys.game('g1'))?.data.status).toBe('running');

    mockPost.mockResolvedValueOnce({ data: aGame({ status: 'running' }) });
    await act(async () => {
      await result.current.mutateAsync({ kind: 'answer', question_id: 'q', skip: true });
    });
    expect(mockPost).toHaveBeenLastCalledWith('/quest/games/g1/answer', { question_id: 'q', skip: true });
    client.clear();
  });
});

describe('QuestChoices', () => {
  const draw = async (prefix?: string) =>
    await render(
      <ThemeProvider>
        <QuestChoices
          questionId="q1"
          choices={['1', '2', '3', '4']}
          selected={null}
          onChoose={() => undefined}
          {...(prefix ? { testIDPrefix: prefix } : {})}
        />
      </ThemeProvider>,
    );

  it("keeps Quest's quest-choice-* by default", async () => {
    await draw();
    expect(screen.getByTestId('quest-choice-A')).toBeTruthy();
    expect(screen.queryByTestId('game-choice-A')).toBeNull();
  });

  it("gives a game's choices its own prefix", async () => {
    await draw('game-choice');
    expect(screen.getByTestId('game-choice-D')).toBeTruthy();
    expect(screen.queryByTestId('quest-choice-A')).toBeNull();
  });
});
