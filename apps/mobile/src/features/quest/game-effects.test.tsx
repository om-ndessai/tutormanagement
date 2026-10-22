// The moments of a game (Phase 47, design 61): the countdown follows the server's clock whatever the
// device's says, and says it is done once; the doors and the K.O. stamp are drawn with motion and not
// at all under reduce motion (the numbers and the end-reason line stand in).
import { act, renderHook, screen } from '@testing-library/react-native';
import type { GameView } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { DoorsCountdown, KNOCKOUT_MS, KnockoutStamp, countdownLeft, useGameCountdown } from './game-effects';

let mockReduced = true;
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduced,
}));
jest.mock('@/lib/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    impact: jest.fn(),
  },
}));

const SERVER_NOW = '2026-10-22T10:00:00.000Z';
const server = Date.parse(SERVER_NOW);
/** A game the host has just started: the first question 5 s ahead of the server's now. */
const started = (now = SERVER_NOW): Pick<GameView, 'status' | 'started_at' | 'now'> => ({
  status: 'running',
  started_at: new Date(Date.parse(now) + 5000).toISOString(),
  now,
});

describe('countdownLeft', () => {
  it("counts on the server's clock, whatever the device's says", () => {
    // In step with the server, one second after the reading.
    expect(countdownLeft(started(), server, server + 1000)).toBe(4000);
    // A device an hour ahead, and ten minutes behind: only the time since the reading counts.
    const ahead = server + 3_600_000;
    expect(countdownLeft(started(), ahead, ahead + 1500)).toBe(3500);
    const behind = server - 600_000;
    expect(countdownLeft(started(), behind, behind + 2000)).toBe(3000);
  });

  it('is 0 once begun, before a start, and for a reading newer than the tick', () => {
    expect(countdownLeft(started(), server, server + 6000)).toBe(0);
    expect(countdownLeft({ status: 'lobby', started_at: null, now: SERVER_NOW }, server, server)).toBe(0);
    expect(countdownLeft(undefined, server, server)).toBe(0);
    // The tick is older than the reading: the reading's own figure, never more.
    expect(countdownLeft(started(), server, server - 900)).toBe(5000);
  });
});

describe('useGameCountdown', () => {
  beforeEach(() => jest.useFakeTimers({ now: server + 3_600_000 }));
  afterEach(() => jest.useRealTimers());

  it('ticks down to 0 on the device, and calls onDone once', async () => {
    const onDone = jest.fn();
    const receivedAt = Date.now();
    const game = started();
    const { result, rerender } = await renderHook(
      ({ g }: { g: Pick<GameView, 'status' | 'started_at' | 'now'> }) =>
        useGameCountdown(g, receivedAt, onDone),
      { initialProps: { g: game } },
    );
    expect(result.current).toBe(5000);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toBe(4000);
    // One whole second at a time: each tick's render sets the next timer.
    for (let second = 0; second < 5; second += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });
    }
    expect(result.current).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    // A later reading of the same game, running: no second call.
    await rerender({ g: { ...game, now: new Date(server + 6000).toISOString() } });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('never calls onDone for a game already under way when opened', async () => {
    const onDone = jest.fn();
    const game = { ...started(), now: new Date(server + 30_000).toISOString() };
    const { result } = await renderHook(() => useGameCountdown(game, Date.now(), onDone));
    expect(result.current).toBe(0);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('DoorsCountdown', () => {
  afterEach(() => {
    mockReduced = true;
  });

  it('under reduce motion: no doors, the words and the number', async () => {
    mockReduced = true;
    await renderWithProviders(<DoorsCountdown msLeft={3500} />);
    expect(screen.getByTestId('game-countdown')).toBeTruthy();
    expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('3');
    expect(screen.getByText('The Quest begins')).toBeTruthy();
    expect(screen.queryByTestId('game-door-left', { includeHiddenElements: true })).toBeNull();
  });

  it('with motion: two doors, and Go! for the last second', async () => {
    mockReduced = false;
    await renderWithProviders(<DoorsCountdown msLeft={800} />);
    expect(screen.getByTestId('game-door-left', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('game-door-right', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('Go!');
  });

  it('says Get ready first', async () => {
    await renderWithProviders(<DoorsCountdown msLeft={5000} />);
    expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('Get ready');
  });
});

describe('KnockoutStamp', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    mockReduced = true;
  });

  it('under reduce motion: nothing drawn, and done at once', async () => {
    mockReduced = true;
    const onDone = jest.fn();
    await renderWithProviders(<KnockoutStamp onDone={onDone} />);
    expect(screen.queryByTestId('game-knockout-burst', { includeHiddenElements: true })).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with motion: lands, then goes, then done', async () => {
    mockReduced = false;
    const onDone = jest.fn();
    await renderWithProviders(<KnockoutStamp onDone={onDone} />);
    expect(screen.getByTestId('game-knockout-burst', { includeHiddenElements: true })).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(KNOCKOUT_MS);
    });
    expect(screen.queryByTestId('game-knockout-burst', { includeHiddenElements: true })).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
