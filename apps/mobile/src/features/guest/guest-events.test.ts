// Phase 63 (P15): anonymous counts are queued and sent in batches of at most 20, marked as the app's,
// carrying only what the event names -- and a failed batch never throws.
import { PLAY_EVENTS_PER_BATCH, type PlayEvent } from '@tmi/shared';

import { createEventQueue } from './guest-events';

describe('the counts queue (P15)', () => {
  it('waits for a flush, then sends one batch marked as the app’s', () => {
    const send = jest.fn(async (_events: PlayEvent[]) => undefined);
    const queue = createEventQueue(send);
    queue.count({ name: 'home_viewed', source: 'home' });
    queue.count({ name: 'tile_started', tile: 'G4Q5', source: 'guest' });
    expect(send).not.toHaveBeenCalled();
    expect(queue.size()).toBe(2);
    queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual([
      { name: 'home_viewed', source: 'home', client: 'app' },
      { name: 'tile_started', tile: 'G4Q5', source: 'guest', client: 'app' },
    ]);
    expect(queue.size()).toBe(0);
    queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a full batch at once, and never more than 20 in one', () => {
    const send = jest.fn(async (_events: PlayEvent[]) => undefined);
    const queue = createEventQueue(send);
    for (let i = 0; i < PLAY_EVENTS_PER_BATCH + 5; i += 1) queue.count({ name: 'first_answer', value: i });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toHaveLength(PLAY_EVENTS_PER_BATCH);
    queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toHaveLength(5);
    for (const [events] of send.mock.calls) expect(events.length).toBeLessThanOrEqual(PLAY_EVENTS_PER_BATCH);
  });

  it('splits a long queue into batches on flush', () => {
    const send = jest.fn(async (_events: PlayEvent[]) => undefined);
    const queue = createEventQueue(send, 3);
    // Below the batch each time, then flushed together.
    queue.count({ name: 'nudge_shown', variant: 'n1' });
    queue.count({ name: 'nudge_dismissed' });
    expect(send).not.toHaveBeenCalled();
    queue.count({ name: 'quest_finished', value: 4 });
    expect(send).toHaveBeenCalledTimes(1);
    queue.count({ name: 'pool_used_up' });
    queue.flush();
    expect(send.mock.calls.map(([events]) => events.length)).toEqual([3, 1]);
  });

  it('drops a failed batch quietly: counts are best effort', async () => {
    const send = jest.fn(async () => {
      throw new Error('offline');
    });
    const queue = createEventQueue(send);
    queue.count({ name: 'ask_grown_up' });
    expect(() => queue.flush()).not.toThrow();
    await Promise.resolve();
    expect(queue.size()).toBe(0);
  });
});
