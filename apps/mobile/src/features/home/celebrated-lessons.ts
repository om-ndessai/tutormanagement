// Which finished lessons this phone has thrown confetti for (Phase 43): once per lesson per device.
// A per-viewer convenience, kept on the device (schedule ids and dates only), never sent. Updates are
// chained, as the mastered-topic celebrations' are, so two quick marks never overwrite each other.
import { parseCelebrated, withCelebrated } from '@/features/dashboard/home-model';
import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';

let chain: Promise<string[]> | null = null;

export function readCelebratedLessons(): Promise<string[]> {
  chain ??= readPref(STORAGE_KEYS.lessonsCelebrated).then(parseCelebrated);
  return chain;
}

/** Remembers the lesson as celebrated; resolves to true when it had not been before. */
export function markLessonCelebrated(key: string): Promise<boolean> {
  let fresh = false;
  // Chained synchronously: a second mark of the same lesson waits for the first and finds it.
  chain = readCelebratedLessons().then(async (list) => {
    if (list.includes(key)) return list;
    fresh = true;
    const next = withCelebrated(list, [key]);
    await writePref(STORAGE_KEYS.lessonsCelebrated, JSON.stringify(next));
    return next;
  });
  return chain.then(() => fresh);
}

/** Tests only. */
export function resetCelebratedLessons(): void {
  chain = null;
}
