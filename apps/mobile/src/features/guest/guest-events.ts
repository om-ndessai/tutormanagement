// Ported from the counting half of apps/web/src/features/guest/guest-api.ts @ 0e3ec7a (working tree).
// Phase 63 (P15, docs/stickiness-plan.md): anonymous counts, queued on the device and sent in batches of
// at most PLAY_EVENTS_PER_BATCH -- when a quest or an Assessment ends, when the sign-up starts, and when
// the app goes to the background (the web's "page hidden"). An event carries its name and, when it has
// them, a tile, a variant, a source and a number; never a person, an id or anything typed. The queue is
// pure (its sender is given), so the batching is tested in Jest.
import { PLAY_EVENTS_PER_BATCH, type PlayEvent } from '@tmi/shared';

export type SendEvents = (events: PlayEvent[]) => Promise<unknown>;

export interface EventQueue {
  /** Queues one event (as the app's); a full batch is sent at once. */
  count: (event: PlayEvent) => void;
  /** Sends everything queued, a batch at a time. Best effort: a failed batch is dropped. */
  flush: () => void;
  /** How many are waiting (for tests). */
  size: () => number;
}

export function createEventQueue(send: SendEvents, batch = PLAY_EVENTS_PER_BATCH): EventQueue {
  let queue: PlayEvent[] = [];
  function flush() {
    while (queue.length > 0) {
      const events = queue.slice(0, batch);
      queue = queue.slice(batch);
      // Counts are best effort: nothing waits on them and nothing is retried.
      void send(events).catch(() => undefined);
    }
  }
  return {
    count(event) {
      queue.push({ ...event, client: 'app' });
      if (queue.length >= batch) flush();
    },
    flush,
    size: () => queue.length,
  };
}
