// Ported from apps/web/src/features/guest/guest-store.ts @ 0e3ec7a (working tree). Phase 63 (P10):
// what a guest's phone remembers -- their grade, the free questions it has played, best scores, the
// tiles played, and when the sign-up offer was last closed -- and a quest in progress.
//
// Mobile: the memory is read once from AsyncStorage (`loadGuestMemory`, before the Play home draws) and
// then read synchronously from this module, as the web reads localStorage; every change is written
// through. A quest in progress is kept in this module's memory for the run (the web's sessionStorage, per
// tab): a sign-up is a sheet over the quest and never reloads the app, so that is enough to come back
// to it. Nothing here is ever sent.
import { parseTileCode, type QuestionBankLevelId } from '@tmi/shared';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import type { GuestQuestState } from './guest-model';

export interface GuestMemory {
  grade?: QuestionBankLevelId;
  seen?: Record<string, string[]>;
  best?: Record<string, number>;
  played?: string[];
  /** Played tiles already made a member's favorites on this phone (P13), so each is carried once. */
  carried?: string[];
  nudgeDismissedAt?: number;
}

let memory: GuestMemory = {};
let loaded: Promise<void> | null = null;

/** Reads the phone's memory once per run (a second call waits on the first). */
export function loadGuestMemory(): Promise<void> {
  loaded ??= readPref(STORAGE_KEYS.guest).then((raw) => {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      memory = parsed && typeof parsed === 'object' ? (parsed as GuestMemory) : {};
    } catch {
      memory = {};
    }
  });
  return loaded;
}

function write(update: (m: GuestMemory) => GuestMemory): void {
  memory = update(memory);
  void writePref(STORAGE_KEYS.guest, JSON.stringify(memory));
}

export const guestMemory = {
  grade: (): QuestionBankLevelId | undefined => memory.grade,
  setGrade: (grade: QuestionBankLevelId) => write((m) => ({ ...m, grade })),
  seen: (level: string): Set<string> => new Set(memory.seen?.[level] ?? []),
  addSeen: (level: string, ids: readonly string[]) =>
    write((m) => ({ ...m, seen: { ...m.seen, [level]: [...new Set([...(m.seen?.[level] ?? []), ...ids])] } })),
  best: (code: string): number | undefined => memory.best?.[code],
  setBest: (code: string, score: number) =>
    write((m) => ({ ...m, best: { ...m.best, [code]: Math.max(score, m.best?.[code] ?? 0) } })),
  played: (): string[] => memory.played ?? [],
  addPlayed: (code: string) =>
    write((m) => ({ ...m, played: [code, ...(m.played ?? []).filter((c) => c !== code)].slice(0, 12) })),
  /** P13: the played tiles not yet carried into a member's favorites, most recent first. */
  uncarried: (): string[] => (memory.played ?? []).filter((code) => !(memory.carried ?? []).includes(code)),
  markCarried: (codes: readonly string[]) =>
    write((m) => ({ ...m, carried: [...new Set([...(m.carried ?? []), ...codes])].slice(-50) })),
  nudgeDismissedAt: (): number | undefined => memory.nudgeDismissedAt,
  dismissNudge: (now = Date.now()) => write((m) => ({ ...m, nudgeDismissedAt: now })),
};

/**
 * Phase 63 (P13, "its grade becomes the default"): the level a guest's play leads a member's Play home
 * with on this phone -- the grade they chose, else the level of the tile they played last. Read after
 * the memory has loaded.
 */
export function guestLeadLevel(): QuestionBankLevelId | null {
  if (memory.grade) return memory.grade;
  const lastPlayed = memory.played?.[0];
  return (lastPlayed && parseTileCode(lastPlayed)?.level_id) || null;
}

/** For tests: forget this run's memory (the phone's is not touched), or start from `next`. */
export function resetGuestMemoryForTests(next?: GuestMemory): void {
  memory = next ?? {};
  loaded = next ? Promise.resolve() : null;
  quest = null;
}

/** A quest in progress, one at a time, for this run. */
let quest: GuestQuestState | null = null;

export function readQuestState(code: string): GuestQuestState | null {
  return quest && quest.code === code ? quest : null;
}

export function writeQuestState(state: GuestQuestState | null): void {
  quest = state;
}
