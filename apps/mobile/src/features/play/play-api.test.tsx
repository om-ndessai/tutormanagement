// Phase 73 (JF13, JF14): Continue's read and the grade's save, with the api client mocked at the network edge.
// The open game is read only while asked for (Continue on screen, in front), held for a minute and never
// polled -- each read may call the game itself; a disabled reader (the home-screen quick action) only sees the
// cache. A grade picked on the row is PUT and the tiles are read again for the new lead.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { gameKeys } from '@/features/quest/games-api';
import { useOpenGame, useSaveQuestGrade } from './play-api';

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: jest.fn(),
    put: (path: string, body?: unknown) => mockPut(path, body),
    delete: jest.fn(),
  },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

async function flush(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const openReads = () => mockGet.mock.calls.filter(([path]) => path === '/quest/games/open').length;

beforeEach(() => {
  jest.useFakeTimers();
  mockGet.mockReset();
  mockPut.mockReset();
  mockGet.mockResolvedValue({ data: { open: null, again: null } });
});
afterEach(() => jest.useRealTimers());

describe('useOpenGame', () => {
  it('reads the open game once while asked for, and never polls it', async () => {
    const { wrapper, client } = setup();
    const { result } = await renderHook(() => useOpenGame(true), { wrapper });
    await flush(0);
    expect(openReads()).toBe(1);
    expect(result.current.data?.data).toEqual({ open: null, again: null });
    await flush(10 * 60_000);
    expect(openReads()).toBe(1);
    client.clear();
  });

  it('reads nothing while not asked for, and hands back only what is cached', async () => {
    const { wrapper, client } = setup();
    const { result } = await renderHook(() => useOpenGame(false), { wrapper });
    await flush(0);
    expect(openReads()).toBe(0);
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      client.setQueryData(gameKeys.open, { data: { open: null, again: null } });
    });
    await flush(0);
    expect(result.current.data?.data).toEqual({ open: null, again: null });
    expect(openReads()).toBe(0);
    client.clear();
  });
});

describe('useSaveQuestGrade', () => {
  it('saves the grade picked here and reads the tiles again for the new lead', async () => {
    const { wrapper, client } = setup();
    client.setQueryData(['quest', 'tiles'], { data: { play_home: true, tiles: [] } });
    mockPut.mockResolvedValue({ data: { grade: 6 } });
    const { result } = await renderHook(() => useSaveQuestGrade(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ grade: 6 });
    });
    expect(mockPut).toHaveBeenCalledWith('/quest/grade', { grade: 6 });
    expect(client.getQueryState(['quest', 'tiles'])?.isInvalidated).toBe(true);
    client.clear();
  });
});
