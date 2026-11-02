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
