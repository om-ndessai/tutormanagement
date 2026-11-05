// Ported from apps/web/src/features/guest/guest-store.ts @ 0e3ec7a (working tree). Phase 63 (P10):
// what a guest's phone remembers -- their grade, the free questions it has played, best scores, the
// tiles played, when the sign-up offer was last closed and Today's 5 as played -- and a quest in progress.
//
// Mobile: the memory is read once from AsyncStorage (`loadGuestMemory`, before the Play home draws) and
// then read synchronously from this module, as the web reads localStorage; every change is written
// through. A quest in progress is kept in this module's memory for the run (the web's sessionStorage, per
// tab): a sign-up is a sheet over the quest and never reloads the app, so that is enough to come back
// to it. Nothing here is ever sent.
//
// UI audit (JF8, owner 2026-11-04): the phone also remembers which accounts were refused as under 13 --
// a short one-way key of each address (`addressKey`), never the address -- so the age question is not
// offered to the same account again here; and, for this run only (memory, never stored), that a sign-up
// was declined, so the guest screens stop offering sign-up.
//
// Phase 72 (UI audit JF4, JF9; owner 2026-11-04): a code typed signed out, and a friend's quest link a guest
// cannot play, are kept here through sign-up and approval, and offered once on the first home. Never sent.
import { parseTileCode, type QuestionBankLevelId } from '@tmi/shared';
import { useSyncExternalStore } from 'react';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import type { GuestQuestState } from './guest-model';

export interface GuestMemory {
  grade?: QuestionBankLevelId;
  seen?: Record<string, string[]>;
  best?: Record<string, number>;
  played?: string[];
  /** Played tiles already made a member's favorites on this phone (P13), so each is carried once. */
  carried?: string[];
  /** Phase 73 (JF14): the guest grade has been saved as a member's pick once (`PUT /quest/grade`): never again. */
  gradeCarried?: boolean;
  nudgeDismissedAt?: number;
  /** Today's 5 as played on this phone: the day, the level, and which questions hit. */
  today?: GuestToday;
  /**
   * Accounts refused as under 13 on this phone (owner, 2026-11-04): `addressKey` of each address, never
   * the address, most recent first, at most `TOO_YOUNG_KEPT`.
   */
  tooYoung?: string[];
  /**
   * A code typed signed out (a space's or a game's), kept on this phone through sign-up and approval and offered
   * once on the first home (owner, 2026-11-04; UI audit JF4). Never sent until the person uses it.
   */
  keptCode?: string;
  /** A quest link a friend sent that a guest cannot play (JF9): kept for the first home, then opened there. */
  sentTile?: string;
}

/** How many under-13 refusals the phone remembers. */
export const TOO_YOUNG_KEPT = 10;

/**
 * A short, one-way key for an address kept on this phone only: the 32-bit FNV-1a hash of the trimmed,
 * lowercased address (over its code points, as the web's copy), as eight hex digits.
 */
export function addressKey(email: string): string {
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface GuestToday {
  day: string;
  level: QuestionBankLevelId;
  hits: boolean[];
}

let memory: GuestMemory = {};
let loaded: Promise<void> | null = null;
let ready = false;

/** Reads the phone's memory once per run (a second call waits on the first). */
export function loadGuestMemory(): Promise<void> {
  loaded ??= readPref(STORAGE_KEYS.guest).then((raw) => {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      memory = parsed && typeof parsed === 'object' ? (parsed as GuestMemory) : {};
    } catch {
      memory = {};
    }
    ready = true;
  });
  return loaded;
}

/** Whether the phone's memory has been read this run (so it may be read synchronously). */
export function guestMemoryReady(): boolean {
  return ready;
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
  /** Every tile's best on this phone, for a screen that keeps a copy in its state. */
  bests: (): Record<string, number> => ({ ...memory.best }),
  setBest: (code: string, score: number) =>
    write((m) => ({ ...m, best: { ...m.best, [code]: Math.max(score, m.best?.[code] ?? 0) } })),
  played: (): string[] => memory.played ?? [],
  addPlayed: (code: string) =>
    write((m) => ({ ...m, played: [code, ...(m.played ?? []).filter((c) => c !== code)].slice(0, 12) })),
  /** P13: the played tiles not yet carried into a member's favorites, most recent first. */
  uncarried: (): string[] => (memory.played ?? []).filter((code) => !(memory.carried ?? []).includes(code)),
  markCarried: (codes: readonly string[]) =>
    write((m) => ({ ...m, carried: [...new Set([...(m.carried ?? []), ...codes])].slice(-50) })),
  /** Phase 73 (JF14): whether this phone's guest grade has been carried into a member's pick already. */
  gradeCarried: (): boolean => Boolean(memory.gradeCarried),
  markGradeCarried: () => write((m) => ({ ...m, gradeCarried: true })),
  nudgeDismissedAt: (): number | undefined => memory.nudgeDismissedAt,
  dismissNudge: (now = Date.now()) => write((m) => ({ ...m, nudgeDismissedAt: now })),
  /** Today's 5 for this day and level, if played on this phone. */
  today: (day: string, level: string): GuestToday | undefined => {
    const today = memory.today;
    return today && today.day === day && today.level === level ? today : undefined;
  },
  /** Today's 5 as played this day, whatever its level. */
  todayOn: (day: string): GuestToday | undefined => (memory.today?.day === day ? memory.today : undefined),
  /** Kept apart from the played tiles (never carried into favorites) and from the best scores. */
  setToday: (today: GuestToday) => write((m) => ({ ...m, today })),
  /** Whether this account was refused as under 13 on this phone. Read after the memory has loaded. */
  refusedYoung: (email: string | null | undefined): boolean =>
    Boolean(email?.trim()) && (memory.tooYoung ?? []).includes(addressKey(email!)),
  /** Remembers an under-13 refusal of this account (its key only). Written after the memory has loaded. */
  rememberYoung: (email: string | null | undefined) => {
    if (!email?.trim()) return;
    const key = addressKey(email);
    write((m) => ({
      ...m,
      tooYoung: [key, ...(m.tooYoung ?? []).filter((k) => k !== key)].slice(0, TOO_YOUNG_KEPT),
    }));
  },
  /** Phase 72 (JF4): a code typed signed out, for the first home. Read after the memory has loaded. */
  keptCode: (): string | undefined => memory.keptCode,
  keepCode: (code: string) => {
    if (memory.keptCode !== code) write((m) => ({ ...m, keptCode: code }));
  },
  dropCode: () => {
    if (memory.keptCode !== undefined) write((m) => ({ ...m, keptCode: undefined }));
  },
  /** Phase 72 (JF9): a friend's quest link a guest could not play, for the guest home and the first home. */
  sentTile: (): string | undefined => memory.sentTile,
  keepSent: (code: string) => {
    if (memory.sentTile !== code) write((m) => ({ ...m, sentTile: code }));
  },
  dropSent: () => {
    if (memory.sentTile !== undefined) write((m) => ({ ...m, sentTile: undefined }));
  },
};

/**
 * A declined sign-up (Phase 65's access_declined) stops the guest screens offering sign-up for the rest of
 * this run (UI audit J02, JF8): "Sign up free" becomes "Sign in". Memory only: never stored, never sent.
 */
let declined = false;
const declinedListeners = new Set<() => void>();

export const declinedThisRun = {
  is: (): boolean => declined,
  mark: () => {
    if (declined) return;
    declined = true;
    declinedListeners.forEach((listener) => listener());
  },
};

function subscribeDeclined(listener: () => void): () => void {
  declinedListeners.add(listener);
  return () => {
    declinedListeners.delete(listener);
  };
}

/** True once a sign-up was declined in this run: the screen offers Sign in only. */
export function useSignupDeclined(): boolean {
  return useSyncExternalStore(subscribeDeclined, declinedThisRun.is);
}

/**
 * Whether the sign-up sheet is on screen (UI audit JF36). A refusal that arrives while it is shows in the
 * sheet itself, so the quest beneath stays mounted at its question and "Keep playing" goes back to it; any
 * other refusal covers the app (the root layout).
 */
let sheetsOpen = 0;

export const signupSheetPresence = {
  isOpen: (): boolean => sheetsOpen > 0,
  enter: () => {
    sheetsOpen += 1;
  },
  leave: () => {
    sheetsOpen = Math.max(0, sheetsOpen - 1);
  },
};

/**
 * Phase 63 (P13, "its grade becomes the default"): the level a guest's play leads a member's Play home
 * with on this phone -- the grade they chose, else the level of the tile they played last. Read after
 * the memory has loaded. Since Phase 73 it is carried once into the member's pick on the server
 * (`gradeCarried`), where they would otherwise be asked "Which grade?" or led by age alone.
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
  ready = Boolean(next);
  quest = null;
  declined = false;
  sheetsOpen = 0;
}

/** A quest in progress, one at a time, for this run. */
let quest: GuestQuestState | null = null;

export function readQuestState(code: string): GuestQuestState | null {
  return quest && quest.code === code ? quest : null;
}

export function writeQuestState(state: GuestQuestState | null): void {
  quest = state;
}
