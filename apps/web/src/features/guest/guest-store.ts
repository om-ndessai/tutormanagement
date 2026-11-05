import { parseTileCode, type QuestionBankLevelId } from '@tmi/shared';

/**
 * Phase 63 (P10): what a guest's device remembers -- their grade, the free questions it has played,
 * best scores, the tiles played, and when the sign-up sheet was last dismissed. Kept in this browser
 * only, never sent: nothing about a guest is stored on our side. Every read and write survives a
 * private window (it just forgets).
 */
const KEY = 'aimtrue.guest';

interface GuestMemory {
  grade?: QuestionBankLevelId;
  seen?: Record<string, string[]>;
  best?: Record<string, number>;
  played?: string[];
  /** Played tiles already made a member's favorites on this device (P13), so each is carried once. */
  carried?: string[];
  nudgeDismissedAt?: number;
  /** Today's 5 as played on this device: the day, the level, and which questions hit. */
  today?: GuestToday;
  /**
   * Accounts refused as under 13 on this device (owner, 2026-11-04): a short hash of the address, never the
   * address, so the age question is not offered again to the same account here (UI audit J05).
   */
  tooYoung?: string[];
  /**
   * A code typed signed out (a space's or a game's), kept on this device through sign-up and approval and offered
   * once on the first home (owner, 2026-11-04; UI audit JF4). Never sent until the person uses it.
   */
  keptCode?: string;
  /** A quest link a friend sent that a guest cannot play (JF9): kept for the first home, then opened there. */
  sentTile?: string;
}

/** A short, one-way key for an address kept on this device only: 32-bit FNV-1a of the lowercased address. */
export function addressKey(email: string): string {
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const DECLINED_KEY = 'aimtrue.declined';

/**
 * A declined sign-up (Phase 65's access_declined) stops this TAB offering sign-up again (UI audit J02): the
 * tab's own storage, gone when the tab closes, and never sent.
 */
export const declinedTab = {
  is: (): boolean => {
    try {
      return sessionStorage.getItem(DECLINED_KEY) === '1';
    } catch {
      return false;
    }
  },
  mark: () => {
    try {
      sessionStorage.setItem(DECLINED_KEY, '1');
    } catch {
      // A private window: the tab simply forgets.
    }
  },
};

export interface GuestToday {
  day: string;
  level: QuestionBankLevelId;
  hits: boolean[];
}

function read(): GuestMemory {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as GuestMemory;
  } catch {
    return {};
  }
}

function write(update: (memory: GuestMemory) => GuestMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(update(read())));
  } catch {
    // A private window: the device simply forgets.
  }
}

export const guestMemory = {
  grade: (): QuestionBankLevelId | undefined => read().grade,
  setGrade: (grade: QuestionBankLevelId) => write((m) => ({ ...m, grade })),
  seen: (level: string): Set<string> => new Set(read().seen?.[level] ?? []),
  addSeen: (level: string, ids: readonly string[]) =>
    write((m) => ({ ...m, seen: { ...m.seen, [level]: [...new Set([...(m.seen?.[level] ?? []), ...ids])] } })),
  best: (code: string): number | undefined => read().best?.[code],
  setBest: (code: string, score: number) =>
    write((m) => ({ ...m, best: { ...m.best, [code]: Math.max(score, m.best?.[code] ?? 0) } })),
  played: (): string[] => read().played ?? [],
  addPlayed: (code: string) => write((m) => ({ ...m, played: [code, ...(m.played ?? []).filter((c) => c !== code)].slice(0, 12) })),
  /** P13: the played tiles not yet carried into a member's favorites, most recent first. */
  uncarried: (): string[] => {
    const memory = read();
    return (memory.played ?? []).filter((code) => !(memory.carried ?? []).includes(code));
  },
  markCarried: (codes: readonly string[]) =>
    write((m) => ({ ...m, carried: [...new Set([...(m.carried ?? []), ...codes])].slice(-50) })),
  nudgeDismissedAt: (): number | undefined => read().nudgeDismissedAt,
  dismissNudge: () => write((m) => ({ ...m, nudgeDismissedAt: Date.now() })),
  /** Today's 5 for this day and level, if played here. */
  today: (day: string, level: string): GuestToday | undefined => {
    const today = read().today;
    return today && today.day === day && today.level === level ? today : undefined;
  },
  setToday: (today: GuestToday) => write((m) => ({ ...m, today })),
  keptCode: (): string | undefined => read().keptCode,
  keepCode: (code: string) => write((m) => ({ ...m, keptCode: code })),
  dropCode: () => write((m) => ({ ...m, keptCode: undefined })),
  sentTile: (): string | undefined => read().sentTile,
  keepSent: (code: string) => write((m) => ({ ...m, sentTile: code })),
  dropSent: () => write((m) => ({ ...m, sentTile: undefined })),
  /** Whether this account was refused as under 13 on this device. */
  refusedYoung: (email: string | null | undefined): boolean => Boolean(email) && (read().tooYoung ?? []).includes(addressKey(email!)),
  rememberYoung: (email: string | null | undefined) => {
    if (!email) return;
    const key = addressKey(email);
    write((m) => ({ ...m, tooYoung: [key, ...(m.tooYoung ?? []).filter((k) => k !== key)].slice(0, 10) }));
  },
};

/**
 * Phase 63 (P13, "its grade becomes the default"): the level a guest's play leads a member's Play home with
 * in this browser -- the grade they chose, else the level of the tile they played last.
 */
export function guestLeadLevel(): QuestionBankLevelId | null {
  const memory = read();
  if (memory.grade) return memory.grade;
  const lastPlayed = memory.played?.[0];
  return (lastPlayed && parseTileCode(lastPlayed)?.level_id) || null;
}

/** A quest in progress, kept for this tab only, so a sign-up that reloads the page (a redirect provider) resumes it. */
export interface GuestQuestState {
  code: string;
  questionIds: string[];
  answers: { id: string; answer: string | null; correct: boolean }[];
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  nudged: boolean;
  /** The results are recorded (seen questions, best score, counts): once. */
  finished?: boolean;
}

const QUEST_KEY = 'aimtrue.guest-quest';

export function readQuestState(code: string): GuestQuestState | null {
  try {
    const state = JSON.parse(sessionStorage.getItem(QUEST_KEY) ?? 'null') as GuestQuestState | null;
    return state && state.code === code ? state : null;
  } catch {
    return null;
  }
}

export function writeQuestState(state: GuestQuestState | null): void {
  try {
    if (state) sessionStorage.setItem(QUEST_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(QUEST_KEY);
  } catch {
    // Not kept: a reload starts the quest again.
  }
}
