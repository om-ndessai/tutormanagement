// Quest Games' hooks (Phase 46, design 60), with the api client mocked at the network edge: the game
// is polled only while its screen is focused and never once it is finished; an action's reply is
// written into the game's cache. And Quest's choices keep their own testIDs unless a game asks.
// Phase 47 (design 61): the favorites -- the person's own list under its key, read again after a save
// or a delete -- and the wizard's request sent as it is.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { GAME_POLL_MS, type GameView } from '@tmi/shared';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';
import { ApiRequestError } from '@/lib/api-client';
import {
  gameIsMissing,
  gameKeys,
  useCreateGame,
  useDeleteGameFavorite,
  useGame,
  useGameAction,
  useGameFavorites,
  useSaveGameFavorite,
} from './games-api';
import { QuestChoices } from './quest-choices';

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
    level_scope: 'level',
    mode: 'count',
    question_count: 2,
    duration_seconds: null,
    right_points: 1,
    wrong_points: 0,
    negative_marking: false,
    knockout: false,
    players: 'multi',
    max_teams: 20,
    max_team_size: 2,
    late_join: false,
    unreviewed: false,
    status: 'lobby',
    host: { user_id: 'p', first_name: 'Priya' },
    is_host: false,
    created_at: '2026-10-21T10:00:00.000Z',
    started_at: null,
    ends_at: null,
    ended_at: null,
    end_reason: null,
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
  mockPut.mockReset();
  mockDelete.mockReset();
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

  it('keeps a live game through a dropped connection, and carries on polling', async () => {
    mockGet.mockResolvedValueOnce({ data: aGame({ status: 'running' }) });
    const { wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useGame('g1', true), { wrapper });
    await flush(0);
    expect(result.current.data?.data.status).toBe('running');
    // The connection drops: every try fails (the first and its three retries, a second apart).
    mockGet.mockRejectedValue(new TypeError('Network request failed'));
    for (let i = 0; i < 10 && !result.current.isError; i += 1) await flush(1000);
    expect(result.current.isError).toBe(true);
    expect(gameIsMissing(result.current.error)).toBe(false);
    expect(result.current.data?.data.status).toBe('running');
    // Back again: the next poll succeeds and the error clears.
    mockGet.mockResolvedValue({ data: aGame({ status: 'running' }) });
    await flush(GAME_POLL_MS + 1000);
    expect(result.current.isError).toBe(false);
    unmount();
    client.clear();
  });

  it('stops polling a game that is not there for you (404)', async () => {
    mockGet.mockRejectedValue(new ApiRequestError(404, 'not_found', 'That game was not found.'));
    const { wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useGame('g1', true), { wrapper });
    await flush(0);
    expect(gameIsMissing(result.current.error)).toBe(true);
    const reads = gameReads();
    expect(reads).toBe(1);
    await flush(GAME_POLL_MS * 3);
    expect(gameReads()).toBe(reads);
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

describe('favorites (Phase 47)', () => {
  const favorite = {
    id: 'f1',
    name: 'Friday G6',
    config: {
      level_id: 'NC26.6' as const,
      level_scope: 'level' as const,
      mode: 'count' as const,
      question_count: 10,
      duration_minutes: undefined,
      right_points: 1,
      wrong_points: 0,
      knockout: false,
      players: 'multi' as const,
      max_teams: 10,
      max_team_size: 4,
      late_join: false,
    },
    updated_at: '2026-10-22T10:00:00.000Z',
  };

  it('keeps the list under its own key', () => {
    expect(gameKeys.favorites).toEqual(['quest-games', 'favorites']);
  });

  it('reads the list again after a save and after a delete', async () => {
    const { wrapper, client } = setup();
    mockGet.mockResolvedValue({ data: [favorite] });
    const { result, unmount } = await renderHook(
      () => ({ list: useGameFavorites(), save: useSaveGameFavorite(), remove: useDeleteGameFavorite() }),
      { wrapper },
    );
    await flush(0);
    const reads = () => mockGet.mock.calls.filter(([path]) => path === '/quest/games/favorites').length;
    expect(reads()).toBe(1);
    expect(result.current.list.data?.data[0]?.name).toBe('Friday G6');

    mockPut.mockResolvedValueOnce({ data: favorite });
    await act(async () => {
      await result.current.save.mutateAsync({ name: 'Friday G6', config: favorite.config });
    });
    expect(mockPut).toHaveBeenCalledWith('/quest/games/favorites', {
      name: 'Friday G6',
      config: favorite.config,
    });
    await flush(0);
    expect(reads()).toBe(2);

    mockDelete.mockResolvedValueOnce({ data: { id: 'f1' } });
    await act(async () => {
      await result.current.remove.mutateAsync('f1');
    });
    expect(mockDelete).toHaveBeenCalledWith('/quest/games/favorites/f1');
    await flush(0);
    expect(reads()).toBe(3);
    unmount();
    client.clear();
  });

  it("sends the wizard's request as it is, and writes the game it returns into its cache", async () => {
    const { wrapper, client } = setup();
    mockPost.mockResolvedValueOnce({ data: aGame({ id: 'g9', status: 'running', players: 'single' }) });
    const { result } = await renderHook(() => useCreateGame(), { wrapper });
    const request = {
      level_id: 'NC26.6' as const,
      level_scope: 'upward' as const,
      mode: 'count' as const,
      question_count: 2,
      right_points: 1,
      wrong_points: 0,
      knockout: false,
      players: 'single' as const,
      max_team_size: 1,
      late_join: false,
    };
    await act(async () => {
      await result.current.mutateAsync(request);
    });
    expect(mockPost).toHaveBeenCalledWith('/quest/games', request);
    expect(client.getQueryData<{ data: GameView }>(gameKeys.game('g9'))?.data.players).toBe('single');
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
