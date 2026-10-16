// Which mastered topics this phone has celebrated (UI upgrades U6). A per-viewer convenience: kept
// on the device, never shared, never sent. Several child cards may mark at once, so every update
// is chained on the one before, and nothing is lost to two read-then-writes overlapping.
import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import { parseCelebrated, withCelebrated } from './home-model';

let chain: Promise<string[]> | null = null;

/** The keys celebrated on this phone so far. */
export function readCelebrated(): Promise<string[]> {
  chain ??= readPref(STORAGE_KEYS.celebrated).then(parseCelebrated);
  return chain;
}

/** Remembers `keys` as celebrated; resolves to the list as stored. */
export function markCelebrated(keys: readonly string[]): Promise<string[]> {
  chain = readCelebrated().then(async (list) => {
    const next = withCelebrated(list, keys);
    await writePref(STORAGE_KEYS.celebrated, JSON.stringify(next));
    return next;
  });
  return chain;
}

/** Tests only: forget the cached list. */
export function resetCelebratedCache(): void {
  chain = null;
}
