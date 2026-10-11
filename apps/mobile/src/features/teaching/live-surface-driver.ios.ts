// iOS: a Live Activity (Lock Screen banner, Dynamic Island), from expo-widgets. See live-surface.ts
// for the contract. ActivityKit keeps an activity across launches, so every call starts from the
// system's own list: one is reused (updated) rather than a second started, and any other is ended.
import type { LiveSurfaceContent, LiveSurfaceDriver } from './live-surface';
import { LIVE_SURFACE_URL } from './live-surface';
import LiveLesson, { type LiveLessonProps } from './live-lesson-activity';

function props(content: LiveSurfaceContent): LiveLessonProps {
  return { title: content.title, startedAtMs: content.startedAtMs, endsAtMs: content.endsAtMs };
}

function instances() {
  try {
    return LiveLesson.getInstances();
  } catch {
    return [];
  }
}

export const liveSurfaceDriver: LiveSurfaceDriver = {
  async show(content) {
    const [first, ...rest] = instances();
    await Promise.all(rest.map((instance) => instance.end('immediate').catch(() => undefined)));
    if (first) {
      await first.update(props(content));
      return;
    }
    LiveLesson.start(props(content), LIVE_SURFACE_URL);
  },
  async end() {
    await Promise.all(instances().map((instance) => instance.end('immediate').catch(() => undefined)));
  },
  async isShowing() {
    return instances().length > 0;
  },
};
