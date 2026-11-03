import { z } from 'zod';
import type { QuestionKind } from './questions.js';
import type { QuestionBankLevelId } from './questions.js';

// ---------------------------------------------------------------------------
// Guest play (Phase 63, P9-P16 in docs/stickiness-plan.md)
// ---------------------------------------------------------------------------
// Anyone may play without signing in, on the device: a small pool of questions per level, reserved
// for guests (`guest_questions`) and never served to members, so no member meets a question whose key
// was public. A guest's answers are marked on the device and never sent; only anonymous counts are
// (P15). Nothing about a guest is stored on our side.

/** How many questions a level's guest pool holds by default, and the console's bounds. */
export const GUEST_POOL_DEFAULT = 10;
export const GUEST_POOL_MIN = 5;
export const GUEST_POOL_MAX = 30;

/** One guest question as the device receives it: with its key and solution (the pool is public by design). */
export interface GuestQuestion {
  id: string;
  kind: QuestionKind;
  stem: string;
  choices: string[];
  answer: string;
  solution: string;
  difficulty: number;
  /** Still checked (not yet approved by a person): shown with the Beta chip. */
  beta: boolean;
}

/** A level's pool, served at /api/public/guest/<version>/<level>. */
export interface GuestPool {
  level_id: QuestionBankLevelId;
  version: string;
  questions: GuestQuestion[];
}

/**
 * The order a guest meets a pool: questions this device has not seen first, each group easiest
 * first (so the first answer is likely a win), then the seen ones in the same order. Pure, so the web
 * and the app agree, and testable.
 */
export function guestSeries(pool: readonly GuestQuestion[], seen: ReadonlySet<string>): GuestQuestion[] {
  const byEase = (a: GuestQuestion, b: GuestQuestion) => a.difficulty - b.difficulty || a.id.localeCompare(b.id);
  const fresh = pool.filter((q) => !seen.has(q.id)).sort(byEase);
  const again = pool.filter((q) => seen.has(q.id)).sort(byEase);
  return [...fresh, ...again];
}

/** Whether every question of a pool has been seen on this device: the "played all 10" offer. */
export function guestPoolUsedUp(pool: readonly GuestQuestion[], seen: ReadonlySet<string>): boolean {
  return pool.length > 0 && pool.every((q) => seen.has(q.id));
}

/**
 * The console's suggestion for a level's pool (P9): approved questions first, then checked ones; no
 * topic that needs a figure (the caller leaves those out); spread across topics; about 40% easy, 40%
 * medium and 20% hard, served easy first. Deterministic for the same input.
 */
export function suggestGuestPool<
  Q extends { id: string; topic_id: string; difficulty: number; status: string },
>(candidates: readonly Q[], size: number): Q[] {
  const wanted = { 1: Math.round(size * 0.4), 2: Math.round(size * 0.4), 3: 0 } as Record<number, number>;
  wanted[3] = Math.max(0, size - wanted[1]! - wanted[2]!);
  const chosen: Q[] = [];
  const usedTopics = new Set<string>();
  // Approved questions first, every one of them before a checked one; within each group, one per topic
  // by the difficulty quota, then whatever is left.
  const groups = [candidates.filter((q) => q.status === 'approved'), candidates.filter((q) => q.status !== 'approved')].map((group) =>
    [...group].sort((a, b) => a.topic_id.localeCompare(b.topic_id) || a.id.localeCompare(b.id)),
  );
  for (const group of groups) {
    for (const pass of [0, 1]) {
      for (const q of group) {
        if (chosen.length >= size) break;
        if (chosen.includes(q)) continue;
        const level = Math.min(3, Math.max(1, q.difficulty));
        if (pass === 0 && (usedTopics.has(q.topic_id) || (wanted[level] ?? 0) <= 0)) continue;
        chosen.push(q);
        usedTopics.add(q.topic_id);
        wanted[level] = (wanted[level] ?? 0) - 1;
      }
    }
  }
  return chosen.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

/** What the console sends for one level's pool: the question ids in order. */
export const guestPoolUpdateSchema = z.object({
  level_id: z.string().min(1).max(32),
  /** The ids in order: at least GUEST_POOL_MIN, or none (the level offers guests nothing). */
  question_ids: z
    .array(z.string().min(1).max(64))
    .max(GUEST_POOL_MAX)
    .refine((ids) => ids.length === 0 || ids.length >= GUEST_POOL_MIN, {
      message: `Choose at least ${GUEST_POOL_MIN} questions, or none.`,
    }),
});
export type GuestPoolUpdate = z.infer<typeof guestPoolUpdateSchema>;

/** The guest settings platform admins keep (P16), `platform_settings` 'guest'. */
export const guestSettingsSchema = z.object({
  /** Guest play on this platform (each Worker's GUEST_PLAY must allow it too). */
  enabled: z.boolean(),
  /** The guest Assessment (P11). */
  assessment_enabled: z.boolean(),
  /** How many questions a guest Assessment draws from the pool. */
  assessment_questions: z.number().int().min(1).max(GUEST_POOL_MAX),
  /** After which answered question the sign-up sheet shows (0: never). */
  nudge_after: z.number().int().min(0).max(20),
  /** After a dismissal, hours before the sheet shows again on that device. */
  nudge_cooldown_hours: z.number().int().min(0).max(24 * 14),
  /** The sheet's headline after a right answer, and after a wrong one. */
  nudge_right: z.string().trim().min(1).max(80),
  nudge_wrong: z.string().trim().min(1).max(80),
  /** The home bar's line. */
  home_bar: z.string().trim().min(1).max(160),
});
export type GuestSettings = z.infer<typeof guestSettingsSchema>;

export const DEFAULT_GUEST_SETTINGS: GuestSettings = {
  enabled: false,
  assessment_enabled: false,
  assessment_questions: 5,
  nudge_after: 1,
  nudge_cooldown_hours: 24,
  nudge_right: 'Nice! That one is right.',
  nudge_wrong: 'Good try. Keep going!',
  home_bar: 'Save your scores and unlock every quest.',
};

/** A tile as a guest sees it: open to play, or locked (the sign-up offer). */
export interface GuestTile {
  code: string;
  kind: 'quest' | 'assessment';
  level_id: QuestionBankLevelId;
  mode: 'count' | 'timed';
  value: number;
  words: string;
  locked: boolean;
}

/** What /api/auth/config adds for guests (P10): present only while guest play is on here. */
export interface GuestConfig {
  version: string;
  settings: Omit<GuestSettings, 'enabled'>;
  tiles: GuestTile[];
  /** How many questions each level offers a member, rounded down (the "1,200+ more" in the offer). */
  member_counts: Record<string, number>;
}

/** The console's view of guest play (P16): the settings, each level's pool size and the version. */
export interface GuestConsoleResponse {
  settings: GuestSettings;
  pools: { level_id: string; size: number }[];
  version: string;
  /** Whether this address may offer guest play at all (its GUEST_PLAY). */
  address_allows: boolean;
}

/** One question as the console lists it for a pool: enough to choose by. */
export interface GuestPoolCandidate {
  id: string;
  topic_id: string;
  difficulty: number;
  status: string;
  stem: string;
}

export interface GuestPoolConsoleResponse {
  level_id: string;
  current: GuestPoolCandidate[];
  suggestion: GuestPoolCandidate[];
}

